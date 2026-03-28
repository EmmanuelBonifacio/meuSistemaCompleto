// =============================================================================
// src/server.ts
// =============================================================================
// O QUE FAZ:
//   É o ponto de entrada da aplicação. Cria e configura o servidor Fastify,
//   registra os plugins essenciais (JWT) e define as rotas de demonstração
//   que mostram como todo o Core funciona junto.
//
// POR QUE SEPARAR server.ts DE index.ts (ou main.ts)?
//   Boa prática: separar a CRIAÇÃO do servidor (buildServer) do seu
//   INÍCIO (start). Isso facilita testes de integração: nos testes, importamos
//   apenas buildServer() sem iniciar o servidor de fato.
// =============================================================================

import Fastify from "fastify";
import fastifyJwt from "@fastify/jwt";
import { disconnectPrisma } from "./core/database/prisma";
import { tenantMiddleware } from "./core/middleware/tenant.middleware";
import { provisionNewTenant } from "./core/tenant/tenant.provisioner";
import { estoqueRoutes } from "./modules/estoque/estoque.routes";
import { financeiroRoutes } from "./modules/financeiro/financeiro.routes";
import { adminRoutes } from "./admin/admin.routes";

// =============================================================================
// FUNÇÃO: buildServer
// =============================================================================
// O QUE FAZ:
//   Cria e configura a instância do Fastify com todos os plugins e rotas.
//   Retorna a instância configurada (mas não iniciada).
//
// POR QUE RETORNAR A INSTÂNCIA E NÃO INICIAR DIRETAMENTE?
//   Separação de responsabilidades. buildServer() → configura.
//   start()         → inicia. Isso permite reutilizar buildServer() em testes.
// =============================================================================
async function buildServer() {
  // ---------------------------------------------------------------------------
  // CRIAÇÃO DO SERVIDOR FASTIFY
  // ---------------------------------------------------------------------------
  const app = Fastify({
    // 'logger: true' ativa o sistema de logs integrado do Fastify (usando pino).
    // Em produção, os logs são em JSON estruturado (fácil de indexar no Datadog, etc.)
    // Em desenvolvimento, são formatados legívelmente no console.
    logger: {
      level: process.env.NODE_ENV === "development" ? "info" : "warn",
      transport:
        process.env.NODE_ENV === "development"
          ? { target: "pino-pretty" } // Logs coloridos no terminal em dev
          : undefined, // JSON puro em produção
    },
  });

  // ---------------------------------------------------------------------------
  // PLUGIN: JWT
  // ---------------------------------------------------------------------------
  // O QUE FAZ:
  //   Registra o plugin @fastify/jwt que adiciona:
  //   - fastify.jwt.sign(payload) → cria um token
  //   - request.jwtVerify()       → valida o token (usado no tenantMiddleware)
  //
  // POR QUE VERIFICAR JWT_SECRET?
  //   Se o JWT_SECRET não estiver configurado, TODOS os tokens gerados com
  //   segredo vazio seriam aceitos por qualquer aplicação — uma falha grave.
  //   O 'fail-fast' aqui impede iniciar o servidor em estado inseguro.
  // ---------------------------------------------------------------------------
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret || jwtSecret.length < 32) {
    throw new Error(
      "JWT_SECRET não configurado ou muito curto (mínimo 32 caracteres). " +
        "Verifique seu arquivo .env",
    );
  }

  await app.register(fastifyJwt, {
    secret: jwtSecret,
  });

  // ==========================================================================
  // ROTAS DA APLICAÇÃO
  // ==========================================================================

  // --------------------------------------------------------------------------
  // ROTA: Health Check (pública, sem autenticação)
  // --------------------------------------------------------------------------
  // Usada pelo Docker, Kubernetes e balanceadores de carga para saber se
  // a aplicação está viva e pronta para receber tráfego.
  // --------------------------------------------------------------------------
  app.get("/health", async () => {
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
    };
  });

  // --------------------------------------------------------------------------
  // ROTA DE DEMONSTRAÇÃO: Gerar um JWT de teste (apenas em desenvolvimento!)
  // --------------------------------------------------------------------------
  // ATENÇÃO: Esta rota é APENAS para demonstração e testes.
  // Em produção, os JWTs são gerados na rota de LOGIN após verificar senha.
  // Remova ou proteja esta rota antes de ir para produção!
  // --------------------------------------------------------------------------
  if (process.env.NODE_ENV === "development") {
    app.post<{
      Body: { tenantId: string; userId: string; role?: string };
    }>("/dev/token", async (request, reply) => {
      const { tenantId, userId, role = "user" } = request.body;

      if (!tenantId || !userId) {
        return reply
          .status(400)
          .send({ error: "tenantId e userId são obrigatórios" });
      }

      // Gera um JWT com nosso payload padrão (definido em fastify.d.ts)
      const token = app.jwt.sign(
        {
          sub: userId,
          tenantId,
          role,
        },
        {
          expiresIn: process.env.JWT_ACCESS_TOKEN_EXPIRATION ?? "1h",
        },
      );

      return reply.send({
        token,
        instruções: "Use este token no header: Authorization: Bearer <token>",
      });
    });
  }

  // --------------------------------------------------------------------------
  // ROTA PROTEGIDA: Demonstra o tenantMiddleware em ação
  // --------------------------------------------------------------------------
  // Esta rota só funciona com um JWT válido de um tenant ativo.
  // Mostra o que estará disponível em `request.tenant` nas rotas dos módulos.
  // --------------------------------------------------------------------------
  app.get(
    "/me",
    {
      // preHandler: array de funções que rodam ANTES do handler principal.
      // A ORDEM IMPORTA: tenantMiddleware deve SEMPRE vir antes de requireModule.
      preHandler: [tenantMiddleware],
    },
    async (request) => {
      // Aqui `request.tenant` está garantidamente preenchido pelo tenantMiddleware.
      // O `!` (non-null assertion) é seguro porque se chegar aqui, o middleware rodou.
      const tenant = request.tenant!;

      return {
        mensagem: `Olá! Você está acessando o tenant: ${tenant.name}`,
        tenant: {
          id: tenant.id,
          slug: tenant.slug,
          schemaName: tenant.schemaName,
        },
        usuario: {
          id: request.user.sub,
          role: request.user.role,
        },
      };
    },
  );

  // ==========================================================================
  // REGISTRO DOS MÓDULOS (PLUGINS FASTIFY)
  // ==========================================================================
  // O QUE FAZ:
  //   Registra cada módulo como um plugin Fastify com seu prefixo de URL.
  //   O prefixo garante que as rotas do Estoque ficam em /estoque/*
  //   e as do Financeiro em /financeiro/*.
  //
  // POR QUE fastify.register()?
  //   O sistema de plugins do Fastify encapsula cada módulo em seu próprio
  //   contexto. Erros em um módulo não afetam os outros.
  //   Para DESATIVAR um módulo do sistema (não apenas por tenant, mas globalmente),
  //   basta comentar a linha de registro aqui.
  // ==========================================================================

  // Módulo de Gestão de Estoque
  await app.register(estoqueRoutes, { prefix: "/estoque" });

  // Módulo Financeiro
  await app.register(financeiroRoutes, { prefix: "/financeiro" });

  // ==========================================================================
  // PAINEL ADMIN (rotas protegidas por role: "ADMIN")
  // ==========================================================================
  // O QUE FAZ:
  //   Registra o painel de administração em /admin/*.
  //   O adminMiddleware (aplicado via addHook dentro do plugin) garante que
  //   APENAS usuários com role: "ADMIN" no JWT podem acessar essas rotas.
  //
  // COMO GERAR UM TOKEN ADMIN PARA TESTES:
  //   POST /dev/token com body: { "tenantId": "qualquer-uuid", "userId": "admin-001", "role": "ADMIN" }
  //   Note: o tenantId é ignorado pelo adminMiddleware, mas o campo é exigido pelo schema.
  // ==========================================================================
  await app.register(adminRoutes, { prefix: "/admin" });

  // ==========================================================================
  // ROTA DE PROVISIONAMENTO DE TENANT (apenas DEV — em produção = /admin)
  // ==========================================================================
  if (process.env.NODE_ENV === "development") {
    app.post<{
      Body: {
        name: string;
        slug: string;
        moduleNames?: string[];
      };
    }>("/dev/provisionar-tenant", async (request, reply) => {
      const { name, slug, moduleNames } = request.body;

      if (!name || !slug) {
        return reply
          .status(400)
          .send({ error: "name e slug são obrigatórios" });
      }

      // Gera o nome do schema a partir do slug
      // Ex: "acme-corp" → "tenant_acme_corp"
      const schemaName = `tenant_${slug.toLowerCase().replace(/-/g, "_")}`;

      const tenant = await provisionNewTenant({
        name,
        slug,
        schemaName,
        moduleNames,
      });

      return reply.status(201).send({
        mensagem: `Tenant "${name}" provisionado com sucesso!`,
        tenant,
        proximoPasso: `Gere um token: POST /dev/token com { "tenantId": "${tenant.id}", "userId": "user-001" }`,
      });
    });
  }

  return app;
}

// =============================================================================
// FUNÇÃO: start
// =============================================================================
// Inicia o servidor e gerencia o ciclo de vida da aplicação.
// =============================================================================
async function start() {
  const app = await buildServer();
  const port = Number(process.env.PORT) || 3000;

  try {
    await app.listen({ port, host: "0.0.0.0" });
    // host: '0.0.0.0' → aceita conexões de qualquer interface de rede.
    // Necessário para funcionar dentro de containers Docker.
    // Em desenvolvimento, 'localhost' ou '127.0.0.1' também funciona.

    console.log(`\n🚀 Servidor rodando em http://localhost:${port}`);
    console.log(`📋 Rotas disponíveis:`);
    console.log(`   GET  /health              → Health check (público)`);
    if (process.env.NODE_ENV === "development") {
      console.log(
        `   POST /dev/token            → Gerar JWT de teste (apenas DEV)`,
      );
    }
    console.log(`   GET  /me                  → Dados do tenant (requer JWT)`);
    console.log(`\n   --- MÓDULO: ESTOQUE ---`);
    console.log(`   GET    /estoque/produtos          → Listar produtos`);
    console.log(`   GET    /estoque/produtos/:id      → Buscar produto`);
    console.log(`   POST   /estoque/produtos          → Criar produto`);
    console.log(`   PATCH  /estoque/produtos/:id      → Atualizar produto`);
    console.log(`   DELETE /estoque/produtos/:id      → Deletar produto`);
    console.log(`\n   --- MÓDULO: FINANCEIRO ---`);
    console.log(
      `   GET    /financeiro/transacoes          → Listar transações`,
    );
    console.log(`   GET    /financeiro/transacoes/:id      → Buscar transação`);
    console.log(`   POST   /financeiro/transacoes          → Criar transação`);
    console.log(
      `   PATCH  /financeiro/transacoes/:id      → Atualizar transação`,
    );
    console.log(
      `   DELETE /financeiro/transacoes/:id      → Deletar transação`,
    );
    console.log(`\n   --- PAINEL ADMIN (role: ADMIN) ---`);
    console.log(
      `   GET    /admin/stats                     → Dashboard do sistema`,
    );
    console.log(
      `   GET    /admin/tenants                   → Listar todos os tenants`,
    );
    console.log(
      `   GET    /admin/tenants/:id               → Detalhes de um tenant`,
    );
    console.log(
      `   POST   /admin/tenants                   → Criar + provisionar tenant`,
    );
    console.log(
      `   PATCH  /admin/tenants/:id/suspend       → Suspender tenant`,
    );
    console.log(`   PATCH  /admin/tenants/:id/reactivate    → Reativar tenant`);
    console.log(
      `   PATCH  /admin/tenants/:id/modules       → Ligar/desligar módulo`,
    );
    if (process.env.NODE_ENV === "development") {
      console.log(`\n   --- ROTAS DE DEV ---`);
      console.log(`   POST /dev/token                → Gerar JWT de teste`);
      console.log(
        `   POST /dev/provisionar-tenant   → Criar novo tenant (atalho DEV)`,
      );
    }
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

// =============================================================================
// GERENCIAMENTO DE ENCERRAMENTO GRACIOSO
// =============================================================================
// O QUE FAZ:
//   Garante que quando o servidor é encerrado (Ctrl+C, SIGTERM do Docker),
//   as conexões com o banco de dados são fechadas corretamente antes do
//   processo encerrar.
//
// POR QUE É IMPORTANTE?
//   Sem isso, transações pendentes podem ser corrompidas e o pool de conexões
//   do PostgreSQL pode ficar "preso" por alguns minutos.
//   SIGTERM é o sinal que o Docker/Kubernetes envia antes de parar o container.
//   SIGINT é o sinal do Ctrl+C no terminal.
// =============================================================================
process.on("SIGTERM", async () => {
  console.log("[Server] SIGTERM recebido. Encerrando graciosamente...");
  await disconnectPrisma();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("[Server] SIGINT recebido (Ctrl+C). Encerrando...");
  await disconnectPrisma();
  process.exit(0);
});

// Inicia o servidor!
start();
