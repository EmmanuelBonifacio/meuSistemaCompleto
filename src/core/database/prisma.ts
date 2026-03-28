// =============================================================================
// src/core/database/prisma.ts
// =============================================================================
// O QUE FAZ:
//   Este é o arquivo MAIS IMPORTANTE da arquitetura. Ele resolve o maior
//   desafio técnico do projeto: como fazer um único Prisma client "falar"
//   com schemas diferentes no PostgreSQL em tempo real, por requisição.
//
// O PROBLEMA QUE ESTAMOS RESOLVENDO:
//   O Prisma foi projetado para trabalhar com UM banco/schema por vez.
//   Mas nosso SaaS tem dezenas de clientes, cada um com seu próprio schema.
//   Como fazer o Prisma "trocar de schema" a cada requisição sem criar
//   um cliente novo (o que seria muito lento e consumiria muita memória)?
//
// A SOLUÇÃO: search_path + $transaction
//   O PostgreSQL tem um conceito chamado 'search_path': é a ordem em que
//   o banco procura as tabelas quando você não especifica o schema.
//   Exemplo: com search_path = 'tenant_acme, public', ao executar
//   SELECT * FROM products, o Postgres busca em 'tenant_acme.products'
//   primeiro, depois em 'public.products'.
//
//   COMO TROCAMOS DINAMICAMENTE:
//   1. Mantemos UM único PrismaClient global (econômico em memória)
//   2. Para queries de tenant, abrimos uma TRANSAÇÃO
//   3. Dentro da transação, executamos: SET LOCAL search_path = 'tenant_x, public'
//   4. Executamos as queries normalmente — o Postgres vai ao schema certo
//   5. Ao fim da transação, o search_path RESETA automaticamente
//
//   Por que funciona? PostgreSQL garante que SET LOCAL só afeta a transação
//   atual. Quando a transação termina (commit/rollback), tudo reseta.
//   Isso é THREAD-SAFE: duas requisições simultâneas não se interferem.
// =============================================================================

import { PrismaClient, Prisma } from "@prisma/client";

// =============================================================================
// PADRÃO SINGLETON: Uma única instância do PrismaClient
// =============================================================================
// POR QUE SINGLETON?
//   Criar um novo PrismaClient abre um novo POOL de conexões com o banco.
//   Se criarmos um cliente por requisição, rapidamente esgotamos as conexões
//   disponíveis do PostgreSQL (o padrão é ~100 conexões).
//   Com o Singleton, todas as requisições compartilham o mesmo pool.
//
// POR QUE O globalThis?
//   Em desenvolvimento, o Node.js recarrega os módulos quando um arquivo muda
//   (hot-reload via tsx watch). Sem o globalThis, cada recarga criaria um novo
//   PrismaClient, esgotando as conexões.
//   Armazenando no globalThis, o cliente persiste entre recargas.
//   Em produção, isso não importa (não há hot-reload), mas não causa problemas.
// =============================================================================

/** Tipo auxiliar para armazenar o cliente no objeto global sem erros de TypeScript */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * O cliente Prisma GLOBAL — conectado ao schema 'public'.
 * Usado para acessar tabelas globais: tenants, modules, tenant_modules, admin_users.
 *
 * EXPORTADO como 'prisma' para uso direto nos middlewares e no admin.
 */
export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Em desenvolvimento, loga todas as queries SQL no console para fins de
    // aprendizado e debug. Em produção, logamos apenas erros para não poluir
    // os logs com informações desnecessárias.
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

// Persiste o cliente no globalThis APENAS em desenvolvimento (hot-reload safe)
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// =============================================================================
// SEGURANÇA: Validação do nome do Schema
// =============================================================================
// O QUE FAZ:
//   Valida que o nome do schema segue o padrão correto ANTES de usá-lo
//   em uma query SQL.
//
// POR QUE É CRÍTICO (SQL INJECTION):
//   Quando usamos $executeRawUnsafe com uma string, não podemos usar
//   "parameterized queries" (placeholders como $1, $2) para o nome do schema,
//   pois o PostgreSQL não aceita nomes de objetos (schemas, tabelas) como
//   parâmetros — apenas valores de dados.
//
//   Isso significa que o nome do schema vai DIRETAMENTE na string SQL:
//   `SET LOCAL search_path TO "${schemaName}", public`
//
//   Se schemaName fosse algo como: `"; DROP TABLE tenants; --`
//   A query viraria: SET LOCAL search_path TO ""; DROP TABLE tenants; --", public
//   Isso é um ATAQUE DE SQL INJECTION!
//
//   A DEFESA: Validamos que schemaName SOMENTE contém letras, números e
//   underscores (regex: ^[a-z_][a-z0-9_]*$). Se qualquer caracter malicioso
//   for inserido, a função lança um erro ANTES de executar qualquer SQL.
//
// NOTA: O schemaName vem do nosso próprio banco de dados (tabela public.tenants),
// não diretamente do usuário. Mas defesa em profundidade é sempre boa prática.
// =============================================================================
function validateSchemaName(schemaName: string): void {
  // Regex explicada:
  // ^          → início da string
  // [a-z_]     → primeiro caractere: letra minúscula ou underscore
  // [a-z0-9_]* → demais caracteres: letras minúsculas, números ou underscore
  // $          → fim da string
  const SAFE_SCHEMA_REGEX = /^[a-z_][a-z0-9_]*$/;

  if (!SAFE_SCHEMA_REGEX.test(schemaName)) {
    // Lançamos um erro genérico para não expor detalhes da validação ao cliente
    throw new Error(
      `[SEGURANÇA] Nome de schema inválido detectado: "${schemaName}". ` +
        `Apenas letras minúsculas, números e underscores são permitidos.`,
    );
  }
}

// =============================================================================
// A FUNÇÃO PRINCIPAL: withTenantSchema
// =============================================================================
// O QUE FAZ:
//   Executa um conjunto de queries do Prisma dentro do schema de um tenant
//   específico, trocando o search_path de forma segura e isolada.
//
// ANALOGIA PEDAGÓGICA (A Gaveta):
//   Imagine o PostgreSQL como um arquivo com várias gavetas (schemas).
//   Cada tenant tem sua própria gaveta: "tenant_acme", "tenant_foobar", etc.
//   Por padrão, o Prisma abre a gaveta "public".
//   Esta função diz para o Postgres: "Para ESTA transação, abra a gaveta
//   do cliente X". Quando a transação termina, a gaveta fecha sozinha.
//
// PARÂMETROS:
//   @param schemaName - Nome do schema do tenant (ex: "tenant_acme_corp")
//   @param fn - Função de callback que recebe o cliente de transação (tx)
//               e retorna uma Promise com o resultado das queries
//
// RETORNO:
//   Promise<T> - O resultado da função de callback, do tipo que você definir
//
// EXEMPLO DE USO (nos módulos de Estoque, Financeiro, etc.):
//   const produtos = await withTenantSchema(request.tenant.schemaName, async (tx) => {
//     return tx.$queryRaw`SELECT * FROM products WHERE active = true`
//   })
//
// POR QUE $transaction?
//   Garantia de conexão única: dentro de uma $transaction, o Prisma usa
//   a MESMA conexão do pool para todas as queries. Isso é essencial porque
//   o SET LOCAL search_path só vale para a conexão atual.
//   Sem a transaction, o Prisma poderia usar conexões diferentes do pool
//   para queries diferentes, e apenas a primeira teria o search_path correto.
// =============================================================================
export async function withTenantSchema<T>(
  schemaName: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  // PASSO 1: Validação de segurança (previne SQL injection)
  validateSchemaName(schemaName);

  // PASSO 2: Abre uma transação no banco de dados.
  // O callback recebe 'tx' (transaction client) — funciona igual ao 'prisma'
  // mas garante que todas as queries usam a mesma conexão.
  return prisma.$transaction(async (tx) => {
    // PASSO 3: O CORAÇÃO DA ARQUITETURA — A TROCA DE SCHEMA
    //
    // Esta linha diz ao PostgreSQL:
    // "Nesta transação, quando eu disser 'products', procure em
    //  'tenant_acme_corp.products' primeiro, depois em 'public.products'"
    //
    // DIFERENÇA ENTRE SET e SET LOCAL:
    //   SET search_path = ...        → Muda para toda a SESSÃO (conexão)
    //   SET LOCAL search_path = ...  → Muda APENAS para esta TRANSAÇÃO ✅
    //   Usamos SET LOCAL porque queremos que o search_path resete
    //   automaticamente quando a transação terminar. Isso é THREAD-SAFE.
    //
    // POR QUE $executeRawUnsafe e não $executeRaw?
    //   $executeRaw usa tagged template literals e faz escaping automático
    //   dos valores — mas isso impede o uso de nomes de schemas como valor.
    //   $executeRawUnsafe aceita string direta. É SEGURO aqui porque
    //   validateSchemaName() já garantiu que schemaName não contém SQL malicioso.
    await tx.$executeRawUnsafe(
      `SET LOCAL search_path TO "${schemaName}", public`,
    );

    // LOG para desenvolvimento — mostra quando a troca acontece
    if (process.env.NODE_ENV === "development") {
      console.log(`[DB] 🔀 search_path trocado para: "${schemaName}", public`);
    }

    // PASSO 4: Executa as queries do caller. Todas rodarão no schema correto.
    return fn(tx);

    // PASSO 5 (automático): Ao sair desta função (fim da transação),
    // o PostgreSQL reseta o search_path para o padrão automaticamente.
    // Nenhuma ação manual necessária. ✨
  });
}

// =============================================================================
// GERENCIAMENTO DO CICLO DE VIDA DA CONEXÃO
// =============================================================================
// O QUE FAZ:
//   Fecha graciosamente a conexão com o banco quando a aplicação encerra.
//
// POR QUE É IMPORTANTE?
//   Sem isso, o processo Node.js pode "travar" ao encerrar, esperando
//   conexões abertas. Em deploys (restart do servidor, CI/CD), isso causa
//   delay e pode corromper transações em andamento.
//
// COMO USAR:
//   No arquivo server.ts, registramos este função no hook de encerramento:
//   process.on('SIGTERM', disconnectPrisma)
// =============================================================================
export async function disconnectPrisma(): Promise<void> {
  console.log("[DB] Fechando conexão com o banco de dados...");
  await prisma.$disconnect();
  console.log("[DB] Conexão encerrada.");
}
