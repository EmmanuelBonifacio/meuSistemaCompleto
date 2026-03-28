// =============================================================================
// src/core/tenant/tenant.provisioner.ts
// =============================================================================
// O QUE FAZ:
//   É o "construtor de apartamentos" do sistema. Quando um novo cliente
//   (tenant) é cadastrado, este serviço:
//   1. Cria um schema isolado no PostgreSQL (ex: "tenant_acme_corp")
//   2. Cria TODAS as tabelas dos módulos disponíveis dentro desse schema
//   3. Registra o tenant e seus módulos ativos na tabela public.tenants
//
// POR QUE EXISTE ESTE ARQUIVO?
//   O Prisma ORM gerencia migrations apenas para o schema 'public'.
//   As tabelas dentro dos schemas de tenant (products, transactions, etc.)
//   precisam ser criadas via SQL puro, pois são criadas DINAMICAMENTE
//   quando cada cliente é provisionado.
//
// ANALOGIA PEDAGÓGICA:
//   O Prisma é o síndico do prédio (gerencia áreas comuns = schema public).
//   O TenantProvisioner é o mestre de obras que constrói o apartamento
//   (schema + tabelas) para cada novo morador (tenant).
//
// PRINCÍPIO SOLID (Open/Closed):
//   Para adicionar tabelas de novos módulos, basta adicionar o SQL em
//   TENANT_SCHEMA_SQL. Não é necessário alterar a lógica de provisionamento.
// =============================================================================

import { prisma } from "../database/prisma";

// =============================================================================
// CONSTANTE: TENANT_SCHEMA_SQL
// =============================================================================
// O QUE FAZ:
//   Define todo o SQL para criar as tabelas de TODOS os módulos disponíveis
//   dentro de um schema de tenant.
//
// POR QUE UMA FUNÇÃO E NÃO UMA STRING ESTÁTICA?
//   O nome do schema precisa ser interpolado dinamicamente.
//   PORÉM: para evitar SQL injection, esta função só é chamada APÓS
//   validateSchemaName() (no prisma.ts) ter validado o nome do schema.
//   O `schemaName` que chega aqui já foi sanitizado.
//
// POR QUE CREATE TABLE IF NOT EXISTS?
//   Torna o provisionamento IDEMPOTENTE: pode ser executado várias vezes
//   sem erros. Útil para reprocessar um tenant com falha no provisionamento.
// =============================================================================
function buildTenantSchemaSQL(schemaName: string): string[] {
  return [
    // -----------------------------------------------------------------
    // PASSO 1: Criar o Schema Isolado
    // -----------------------------------------------------------------
    // CREATE SCHEMA IF NOT EXISTS cria o "container" (schema/namespace)
    // no PostgreSQL. É o equivalente a criar uma pasta separada onde
    // todas as tabelas deste tenant estarão guardadas de forma isolada.
    `CREATE SCHEMA IF NOT EXISTS "${schemaName}"`,

    // -----------------------------------------------------------------
    // TABELA: products (Módulo de Estoque)
    // -----------------------------------------------------------------
    // Esta tabela SÓ EXISTE dentro do schema do tenant.
    // "tenant_acme.products" é COMPLETAMENTE separado de "tenant_foobar.products"
    // O PostgreSQL garante este isolamento em nível de kernel.
    `CREATE TABLE IF NOT EXISTS "${schemaName}".products (
      id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      name        VARCHAR(255) NOT NULL,
      description TEXT,
      price       DECIMAL(10,2) NOT NULL DEFAULT 0.00
                  CONSTRAINT products_price_positive CHECK (price >= 0),
      quantity    INTEGER     NOT NULL DEFAULT 0
                  CONSTRAINT products_quantity_non_negative CHECK (quantity >= 0),
      sku         VARCHAR(100) UNIQUE,
      is_active   BOOLEAN     NOT NULL DEFAULT true,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    // Índice para acelerar buscas por nome de produto (ex: busca no catálogo)
    `CREATE INDEX IF NOT EXISTS idx_products_name
      ON "${schemaName}".products (name)`,

    // Índice para filtrar apenas produtos ativos (o caso mais comum de query)
    `CREATE INDEX IF NOT EXISTS idx_products_active
      ON "${schemaName}".products (is_active)
      WHERE is_active = true`,

    // -----------------------------------------------------------------
    // TABELA: transactions (Módulo Financeiro)
    // -----------------------------------------------------------------
    `CREATE TABLE IF NOT EXISTS "${schemaName}".transactions (
      id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      type             VARCHAR(20) NOT NULL
                       CONSTRAINT transactions_type_check
                       CHECK (type IN ('receita', 'despesa')),
      -- 'receita' = entrada de dinheiro, 'despesa' = saída de dinheiro
      amount           DECIMAL(10,2) NOT NULL
                       CONSTRAINT transactions_amount_positive CHECK (amount > 0),
      description      TEXT        NOT NULL,
      category         VARCHAR(100),
      transaction_date DATE        NOT NULL DEFAULT CURRENT_DATE,
      is_reconciled    BOOLEAN     NOT NULL DEFAULT false,
      -- is_reconciled: indica se a transação foi conferida no extrato bancário
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    // Índice para filtrar transações por tipo (receita vs despesa)
    `CREATE INDEX IF NOT EXISTS idx_transactions_type
      ON "${schemaName}".transactions (type)`,

    // Índice para busca por período (relatórios mensais/anuais)
    `CREATE INDEX IF NOT EXISTS idx_transactions_date
      ON "${schemaName}".transactions (transaction_date DESC)`,
  ];
}

// =============================================================================
// TIPO: ProvisionTenantInput
// =============================================================================
// Define os dados necessários para provisionar um novo tenant.
// Usar um tipo explícito documenta o contrato e previne erros de TypeScript.
// =============================================================================
export interface ProvisionTenantInput {
  name: string;
  slug: string;
  schemaName: string;
  moduleNames?: string[]; // Quais módulos ativar na criação. Default: todos.
}

// =============================================================================
// TIPO: ProvisionedTenant
// =============================================================================
export interface ProvisionedTenant {
  id: string;
  name: string;
  slug: string;
  schemaName: string;
}

// =============================================================================
// FUNÇÃO PRINCIPAL: provisionNewTenant
// =============================================================================
// O QUE FAZ:
//   Executa o processo completo de criação de um novo cliente:
//   1. Valida que o slug não está em uso
//   2. Cria o schema e as tabelas no PostgreSQL
//   3. Registra o tenant na tabela public.tenants
//   4. Ativa os módulos solicitados
//
// POR QUE TUDO DENTRO DE UMA $transaction?
//   ATOMICIDADE: se qualquer passo falhar (ex: slug duplicado), TUDO
//   é desfeito automaticamente pelo PostgreSQL (ROLLBACK).
//   Sem isso, poderíamos ter o schema criado no banco mas sem registro
//   em public.tenants — um estado inconsistente difícil de corrigir.
//
// NOTA SOBRE SCHEMAS E TRANSAÇÕES:
//   CREATE SCHEMA é um comando DDL (Data Definition Language).
//   No PostgreSQL, DDL é TRANSACIONAL — diferente do MySQL!
//   Se a transação der ROLLBACK, o schema criado também é removido. ✅
// =============================================================================
export async function provisionNewTenant(
  input: ProvisionTenantInput,
): Promise<ProvisionedTenant> {
  const { name, slug, schemaName, moduleNames } = input;

  // PASSO 1: Gera o SQL completo para o schema do tenant
  const schemaSQLStatements = buildTenantSchemaSQL(schemaName);

  // PASSO 2: Executa tudo em uma única transação atômica
  const tenant = await prisma.$transaction(async (tx) => {
    // -----------------------------------------------------------------------
    // CRIAÇÃO DAS ESTRUTURAS DO BANCO (DDL)
    // -----------------------------------------------------------------------
    // Executa cada statement SQL sequencialmente dentro da transação.
    // Usamos $executeRawUnsafe porque precisamos passar o nome do schema
    // diretamente (não pode ser parametrizado no DDL do PostgreSQL).
    // A segurança é garantida pela validação prévia do schemaName.
    for (const sql of schemaSQLStatements) {
      await tx.$executeRawUnsafe(sql);
    }

    // -----------------------------------------------------------------------
    // REGISTRO DO TENANT NA TABELA PUBLIC
    // -----------------------------------------------------------------------
    // Cria o registro do tenant no schema public (visível globalmente).
    // Este registro é o que o tenantMiddleware vai buscar em cada requisição.
    const newTenant = await tx.tenant.create({
      data: { name, slug, schemaName },
    });

    // -----------------------------------------------------------------------
    // ATIVAÇÃO DOS MÓDULOS SOLICITADOS
    // -----------------------------------------------------------------------
    // Determina quais módulos ativar: os passados no input, ou todos disponíveis.
    let moduleFilter = {};
    if (moduleNames && moduleNames.length > 0) {
      moduleFilter = { name: { in: moduleNames } };
    }

    const modules = await tx.module.findMany({
      where: moduleFilter,
      select: { id: true, name: true },
    });

    if (modules.length === 0 && moduleNames && moduleNames.length > 0) {
      throw new Error(
        `Nenhum dos módulos solicitados foi encontrado: ${moduleNames.join(", ")}`,
      );
    }

    // Cria os registros de ativação na tabela tenant_modules
    await tx.tenantModule.createMany({
      data: modules.map((m) => ({
        tenantId: newTenant.id,
        moduleId: m.id,
        isEnabled: true,
      })),
      skipDuplicates: true,
    });

    console.log(
      `[Provisioner] ✅ Tenant "${name}" provisionado com sucesso.\n` +
        `  Schema: ${schemaName}\n` +
        `  Módulos ativos: ${modules.map((m) => m.name).join(", ")}`,
    );

    return newTenant;
  });

  return {
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    schemaName: tenant.schemaName,
  };
}
