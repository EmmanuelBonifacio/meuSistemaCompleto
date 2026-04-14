// =============================================================================
// src/modules/vendas/vendas.repository.ts
// =============================================================================
// O QUE FAZ:
//   Camada de acesso a dados dos PRODUTOS de venda.
//   Usa SQL raw via withTenantSchema() — o mesmo padrão do módulo de estoque.
//   Todas as queries operam na tabela `venda_produtos` do schema do tenant.
//
// PADRÃO REPOSITORY:
//   Isola o SQL do resto da aplicação. Se trocar de banco, só muda este arquivo.
// =============================================================================

import { withTenantSchema } from "../../core/database/prisma";
import type {
  CriarProdutoVendaInput,
  AtualizarProdutoVendaInput,
  ListarProdutosVendaQuery,
} from "./vendas.schema";

// =============================================================================
// INTERFACE: ProdutoVenda — espelha a tabela venda_produtos do banco
// =============================================================================
export interface ProdutoVenda {
  id: string;
  nome: string;
  descricao: string | null;
  preco: number;
  preco_promocional: number | null;
  categoria: string;
  foto_url: string | null;
  ativo: boolean;
  destaque: boolean;
  ordem: number;
  created_at: Date;
  updated_at: Date;
}

// =============================================================================
// INTERFACE: Resultado paginado de listagem de produtos
// =============================================================================
export interface ProdutoVendaListResult {
  data: ProdutoVenda[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// =============================================================================
// HELPER: garante que as tabelas do módulo de vendas existem no schema do tenant.
// Idempotente: CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS.
// Necessário para tenants provisionados antes das tabelas serem adicionadas.
// =============================================================================
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function ensureVendasTables(schemaName: string): Promise<void> {
  await withTenantSchema(schemaName, async (tx) => {
    // Tabela de produtos
    await tx.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "${schemaName}".venda_produtos (
        id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
        nome              VARCHAR(255)  NOT NULL,
        descricao         TEXT,
        preco             DECIMAL(10,2) NOT NULL DEFAULT 0.00
                          CONSTRAINT venda_produtos_preco_positivo CHECK (preco >= 0),
        preco_promocional DECIMAL(10,2)
                          CONSTRAINT venda_produtos_preco_promo_positivo CHECK (preco_promocional >= 0),
        categoria         VARCHAR(50)   NOT NULL DEFAULT 'lancamentos',
        foto_url          TEXT,
        ativo             BOOLEAN       NOT NULL DEFAULT true,
        destaque          BOOLEAN       NOT NULL DEFAULT false,
        ordem             INTEGER       NOT NULL DEFAULT 0,
        created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
      )
    `);
    await tx.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_venda_produtos_catalogo
        ON "${schemaName}".venda_produtos (categoria, ativo, ordem ASC)
    `);
    await tx.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_venda_produtos_destaque
        ON "${schemaName}".venda_produtos (destaque)
        WHERE destaque = true
    `);
    // Tabela de pedidos
    await tx.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "${schemaName}".venda_pedidos (
        id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
        numero_whatsapp VARCHAR(20),
        itens_json      JSONB         NOT NULL DEFAULT '[]'::jsonb,
        total           DECIMAL(10,2) NOT NULL DEFAULT 0.00
                        CONSTRAINT venda_pedidos_total_positivo CHECK (total >= 0),
        status          VARCHAR(20)   NOT NULL DEFAULT 'pendente'
                        CONSTRAINT venda_pedidos_status_check
                        CHECK (status IN ('pendente', 'pago', 'enviado', 'finalizado', 'cancelado')),
        notas           TEXT,
        created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
      )
    `);
  });
}

// =============================================================================
// FUNÇÃO: findAllProdutosVenda
// =============================================================================
// Retorna o catálogo de produtos com filtros opcionais.
// - Rota pública: onlyActive = true por padrão
// - Rota admin: pode passar onlyActive = false para ver todos
// =============================================================================
export async function findAllProdutosVenda(
  schemaName: string,
  query: ListarProdutosVendaQuery,
  onlyActive = true,
): Promise<ProdutoVendaListResult> {
  await ensureVendasTables(schemaName);
  const { page, limit, busca, categoria } = query;
  const offset = (page - 1) * limit;

  return withTenantSchema(schemaName, async (tx) => {
    // Constrói WHERE dinamicamente usando parâmetros posicionais do PostgreSQL.
    // Isso PREVINE SQL INJECTION — os valores são passados como dados, não SQL.
    const values: unknown[] = [];
    const conditions: string[] = [];

    if (onlyActive) {
      values.push(true);
      conditions.push(`ativo = $${values.length}`);
    }

    if (categoria) {
      values.push(categoria);
      conditions.push(`categoria = $${values.length}`);
    }

    if (busca) {
      values.push(`%${busca.toLowerCase()}%`);
      conditions.push(`LOWER(nome) LIKE $${values.length}`);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // Busca os produtos com paginação. Ordenação: destaque first, depois por ordem ASC
    values.push(limit, offset);
    const produtos = await tx.$queryRawUnsafe<ProdutoVenda[]>(
      `SELECT id, nome, descricao, preco::float, preco_promocional::float,
              categoria, foto_url, ativo, destaque, ordem, created_at, updated_at
       FROM venda_produtos
       ${whereClause}
       ORDER BY destaque DESC, categoria ASC, ordem ASC, nome ASC
       LIMIT $${values.length - 1} OFFSET $${values.length}`,
      ...values,
    );

    // Conta total para paginação (sem LIMIT/OFFSET)
    const countValues = values.slice(0, values.length - 2);
    const countResult = await tx.$queryRawUnsafe<[{ count: bigint }]>(
      `SELECT COUNT(*) as count FROM venda_produtos ${whereClause}`,
      ...countValues,
    );

    const total = Number(countResult[0]?.count ?? 0);

    return {
      data: produtos,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  });
}

// =============================================================================
// FUNÇÃO: findProdutoVendaById
// =============================================================================
export async function findProdutoVendaById(
  schemaName: string,
  id: string,
): Promise<ProdutoVenda | null> {
  return withTenantSchema(schemaName, async (tx) => {
    const results = await tx.$queryRaw<ProdutoVenda[]>`
      SELECT id, nome, descricao, preco::float, preco_promocional::float,
             categoria, foto_url, ativo, destaque, ordem, created_at, updated_at
      FROM venda_produtos
      WHERE id = ${id}::uuid
      LIMIT 1
    `;
    return results[0] ?? null;
  });
}

// =============================================================================
// FUNÇÃO: createProdutoVenda
// =============================================================================
export async function createProdutoVenda(
  schemaName: string,
  data: CriarProdutoVendaInput,
): Promise<ProdutoVenda> {
  await ensureVendasTables(schemaName);
  return withTenantSchema(schemaName, async (tx) => {
    const results = await tx.$queryRaw<ProdutoVenda[]>`
      INSERT INTO venda_produtos
        (nome, descricao, preco, preco_promocional, categoria,
         foto_url, ativo, destaque, ordem)
      VALUES (
        ${data.nome},
        ${data.descricao ?? null},
        ${data.preco},
        ${data.preco_promocional ?? null},
        ${data.categoria},
        ${data.foto_url ?? null},
        ${data.ativo ?? true},
        ${data.destaque ?? false},
        ${data.ordem ?? 0}
      )
      RETURNING id, nome, descricao, preco::float, preco_promocional::float,
                categoria, foto_url, ativo, destaque, ordem, created_at, updated_at
    `;
    // RETURNING — evita um segundo SELECT após o INSERT
    return results[0];
  });
}

// =============================================================================
// FUNÇÃO: updateProdutoVenda
// =============================================================================
// Atualiza apenas os campos fornecidos (padrão PATCH).
// Constrói o SET dinamicamente para não sobrescrever campos não enviados.
// =============================================================================
export async function updateProdutoVenda(
  schemaName: string,
  id: string,
  data: AtualizarProdutoVendaInput,
): Promise<ProdutoVenda | null> {
  // Monta o SET dinamicamente: só inclui campos que foram enviados no body
  const setClauses: string[] = [];
  const values: unknown[] = [];

  const fieldMap: Record<string, unknown> = {
    nome: data.nome,
    descricao: data.descricao,
    preco: data.preco,
    preco_promocional: data.preco_promocional,
    categoria: data.categoria,
    foto_url: data.foto_url,
    ativo: data.ativo,
    destaque: data.destaque,
    ordem: data.ordem,
  };

  for (const [col, val] of Object.entries(fieldMap)) {
    if (val !== undefined) {
      values.push(val);
      setClauses.push(`${col} = $${values.length}`);
    }
  }

  if (setClauses.length === 0) return null;

  // updated_at é sempre atualizado
  setClauses.push("updated_at = NOW()");

  values.push(id); // último parâmetro para o WHERE id = $N
  const idIndex = values.length;

  return withTenantSchema(schemaName, async (tx) => {
    const results = await tx.$queryRawUnsafe<ProdutoVenda[]>(
      `UPDATE venda_produtos
       SET ${setClauses.join(", ")}
       WHERE id = $${idIndex}::uuid
       RETURNING id, nome, descricao, preco::float, preco_promocional::float,
                 categoria, foto_url, ativo, destaque, ordem, created_at, updated_at`,
      ...values,
    );
    return results[0] ?? null;
  });
}

// =============================================================================
// FUNÇÃO: deleteProdutoVenda
// =============================================================================
// Hard delete — remove o produto permanentemente.
// Retorna o produto removido para confirmar no response.
// =============================================================================
export async function deleteProdutoVenda(
  schemaName: string,
  id: string,
): Promise<ProdutoVenda | null> {
  return withTenantSchema(schemaName, async (tx) => {
    const results = await tx.$queryRaw<ProdutoVenda[]>`
      DELETE FROM venda_produtos
      WHERE id = ${id}::uuid
      RETURNING id, nome, descricao, preco::float, preco_promocional::float,
                categoria, foto_url, ativo, destaque, ordem, created_at, updated_at
    `;
    return results[0] ?? null;
  });
}

// =============================================================================
// FUNÇÃO: updateFotoProdutoVenda
// =============================================================================
// Atualiza apenas a URL da foto do produto após upload bem-sucedido.
// =============================================================================
export async function updateFotoProdutoVenda(
  schemaName: string,
  id: string,
  fotoUrl: string,
): Promise<ProdutoVenda | null> {
  return withTenantSchema(schemaName, async (tx) => {
    const results = await tx.$queryRaw<ProdutoVenda[]>`
      UPDATE venda_produtos
      SET foto_url = ${fotoUrl}, updated_at = NOW()
      WHERE id = ${id}::uuid
      RETURNING id, nome, descricao, preco::float, preco_promocional::float,
                categoria, foto_url, ativo, destaque, ordem, created_at, updated_at
    `;
    return results[0] ?? null;
  });
}
