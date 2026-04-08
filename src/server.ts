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
import fastifyCors from "@fastify/cors";
import fastifyHelmet from "@fastify/helmet";
import fastifyRateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import path from "path";
import { disconnectPrisma } from "./core/database/prisma";
import { initSocketServer } from "./modules/tv/tv.socket";
import { tenantMiddleware } from "./core/middleware/tenant.middleware";
import { provisionNewTenant } from "./core/tenant/tenant.provisioner";
import { estoqueRoutes } from "./modules/estoque/estoque.routes";
import { financeiroRoutes } from "./modules/financeiro/financeiro.routes";
import { adminRoutes } from "./admin/admin.routes";
import { adminAuthRoutes } from "./admin/admin.auth.routes";
import { tvRoutes } from "./modules/tv/tv.routes";
import { authRoutes } from "./modules/auth/auth.routes";
import { registerRequestLoggerHook } from "./core/middleware/request-logger.hook";

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

  // ---------------------------------------------------------------------------
  // PLUGIN: HELMET — Security Headers HTTP
  // ---------------------------------------------------------------------------
  // O QUE FAZ:
  //   Define cabeçalhos HTTP de segurança automaticamente em todas as respostas.
  //   Cada header protege contra um tipo específico de ataque:
  //
  //   - Content-Security-Policy (CSP): previne XSS ao restringir fontes de scripts
  //   - X-Content-Type-Options: impede o browser de "adivinhar" o MIME type
  //   - X-Frame-Options: bloqueia clickjacking (embedding em iframes maliciosos)
  //   - Strict-Transport-Security (HSTS): força HTTPS em produção
  //   - Referrer-Policy: controla quais dados de URL são enviados como referrer
  //
  // POR QUE HELMET ANTES DO CORS?
  //   Os headers de segurança devem ser aplicados a TODAS as respostas,
  //   incluindo as de erro. Registrar o Helmet primeiro garante isso.
  // ---------------------------------------------------------------------------
  await app.register(fastifyHelmet, {
    // CSP desabilitado em dev (quebraria as DevTools do browser)
    // Em produção, configure conforme as fontes que sua aplicação usa
    contentSecurityPolicy: process.env.NODE_ENV === "production",
  });

  // ---------------------------------------------------------------------------
  // PLUGIN: RATE LIMIT — Proteção contra Brute Force
  // ---------------------------------------------------------------------------
  // O QUE FAZ:
  //   Limita o número de requisições por IP em um dado intervalo de tempo.
  //   Aplicado globalmente, com configurações específicas mais restritivas
  //   nas rotas de login (via config inline nas rotas).
  //
  // POR QUE RATE LIMIT É CRÍTICO EM ROTAS DE LOGIN?
  //   Sem rate limit, um atacante pode tentar 1.000.000 senhas por segundo.
  //   Com 10 tentativas / minuto por IP, um ataque de dicionário levaria
  //   anos para completar — inviabilizando o brute force.
  //
  // CONFIGURAÇÃO GLOBAL (fallback para rotas não configuradas individualmente):
  //   200 requisições por minuto por IP — generoso para uso normal da API
  // ---------------------------------------------------------------------------
  await app.register(fastifyRateLimit, {
    global: true,
    max: 200,
    timeWindow: "1 minute",
    // Mensagem de erro padronizada e sem revelar detalhes internos
    errorResponseBuilder: (_request, context) => ({
      statusCode: 429,
      error: "Too Many Requests",
      message: `Muitas requisições. Tente novamente em ${Math.ceil(context.ttl / 1000)} segundos.`,
    }),
  });

  // ---------------------------------------------------------------------------
  // PLUGIN: CORS
  // ---------------------------------------------------------------------------
  // Permite que o frontend (localhost:3001) faça requisições ao backend.
  // Em produção, substitua origin pelo domínio real do frontend.
  // ---------------------------------------------------------------------------
  await app.register(fastifyCors, {
    origin:
      process.env.NODE_ENV === "production"
        ? (process.env.FRONTEND_URL ?? false)
        : true, // Em dev aceita qualquer origem
    credentials: true,
  });

  // Registra hook que grava logs de acesso por tenant/módulo na tabela request_logs
  registerRequestLoggerHook(app);

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

  // ---------------------------------------------------------------------------
  // PLUGIN: @fastify/static — serve arquivos estáticos da pasta /public
  // ---------------------------------------------------------------------------
  // O QUE FAZ:
  //   Serve a pasta public/ como arquivos estáticos acessíveis via /static/*
  //   Isso permite que o receiver.html seja aberto no browser da TV com:
  //   http://servidor:3000/static/receiver.html?token=...&tenantId=...&deviceId=...
  //
  // POR QUE /static/ E NÃO /public/?
  //   Convenção web: /static/ é o prefixo padrão para assets estáticos.
  //   Evita colisão com rotas de API que possam começar com os mesmos nomes.
  //
  // SEGURANÇA: @fastify/static não permite path traversal (../../etc/passwd)
  //   O plugin normaliza caminhos e confina ao `root` especificado.
  // ---------------------------------------------------------------------------
  await app.register(fastifyStatic, {
    root: path.join(__dirname, "../public"),
    prefix: "/static/",
    // Cache de 1 hora para assets que não mudam frequentemente.
    // receiver.html muda raramente — cache melhora a performance na TV.
    cacheControl: true,
    maxAge: "1h",
  });

  // Módulo de Autenticação (rotas públicas — sem tenantMiddleware)
  await app.register(authRoutes, { prefix: "/auth" });

  // Módulo de Gestão de Estoque
  await app.register(estoqueRoutes, { prefix: "/estoque" });

  // Módulo Financeiro
  await app.register(financeiroRoutes, { prefix: "/financeiro" });

  // Módulo de Controle de Telas (Digital Signage)
  await app.register(tvRoutes, { prefix: "/tv" });

  // ==========================================================================
  // PAINEL ADMIN — LOGIN PÚBLICO (sem middleware)
  // ==========================================================================
  // O QUE FAZ:
  //   Registra a rota POST /admin/login como rota pública (sem autenticação).
  //   Plugin separado de adminRoutes para não herdar o addHook do adminMiddleware.
  // ==========================================================================
  await app.register(adminAuthRoutes, { prefix: "/admin" });

  // ==========================================================================
  // PAINEL ADMIN — ROTAS PROTEGIDAS (role: superadmin)
  // ==========================================================================
  // O QUE FAZ:
  //   Registra o painel de administração em /admin/*.
  //   O adminMiddleware (aplicado via addHook dentro do plugin) garante que
  //   APENAS usuários com role: "superadmin" no JWT podem acessar essas rotas.
  //
  // COMO FAZER LOGIN COMO ADMIN:
  //   POST /admin/login com { "email": "admin@sistema.com", "password": "..." }
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

    // -------------------------------------------------------------------------
    // INITIIALIZAÇÃO DO SERVIDOR SOCKET.IO
    // -------------------------------------------------------------------------
    // O QUE FAZ:
    //   Anexa o servidor WebSocket ao mesmo http.Server do Fastify.
    //   Después do app.listen() o httpServer está garantidamente aberto.
    //   initSocketServer() configura: namespaces /cast/:tenantId, auth middleware,
    //   in-memory activeConnections Map, e todos os eventos socket.io.
    //
    // POR QUE DEPOIS DO listen() E NÃO ANTES?
    //   O socket.io se anexa ao httpServer nativo (app.server).
    //   Antes do listen(), o httpServer ainda não está inicializado pelo Fastify.
    //   Chamar initSocketServer() antes do listen() jogaria um erro.
    //
    // POR QUE PASSAR corsOrigin?
    //   Socket.IO tem seu próprio sistema de CORS independente do @fastify/cors.
    //   Em produção, restringir ao domínio real do frontend aumenta a segurança.
    //   Em desenvolvimento, `true` aceita qualquer origem.
    // -------------------------------------------------------------------------
    const corsOrigin =
      process.env.NODE_ENV === "production"
        ? (process.env.FRONTEND_URL ?? false)
        : true;
    initSocketServer(app.server, corsOrigin);
    console.log(
      `🔌 WebSocket (Socket.IO) ativo em ws://localhost:${port}/cast/:tenantId`,
    );

    console.log(`\n🚀 Servidor rodando em http://localhost:${port}`);
    console.log(`📋 Rotas disponíveis:`);
    console.log(`   GET  /health              → Health check (público)`);
    if (process.env.NODE_ENV === "development") {
      console.log(
        `   POST /dev/token            → Gerar JWT de teste (apenas DEV)`,
      );
    }
    console.log(`   GET  /me                  → Dados do tenant (requer JWT)`);
    console.log(`\n   --- AUTENTICAÇÃO (rotas públicas) ---`);
    console.log(`   POST   /auth/login             → Login com email + senha`);
    console.log(`   POST   /auth/refresh           → Renovar tokens`);
    console.log(`   POST   /auth/logout            → Encerrar sessão`);
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
    console.log(`\n   --- PAINEL ADMIN (role: superadmin) ---`);
    console.log(
      `   POST   /admin/login                     → Login do painel admin (público)`,
    );
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
    console.log(`\n   --- MÓDULO: TV / DIGITAL SIGNAGE ---`);
    console.log(
      `   GET    /tv/devices                    → Listar TVs do tenant`,
    );
    console.log(
      `   GET    /tv/devices/:id                → Detalhes de uma TV`,
    );
    console.log(
      `   POST   /tv/devices                    → Registrar TV (máx 5/tenant)`,
    );
    console.log(`   PATCH  /tv/devices/:id                → Atualizar TV`);
    console.log(`   DELETE /tv/devices/:id                → Remover TV`);
    console.log(
      `   POST   /tv/control                    → Enviar conteúdo via UPnP/DIAL (legado)`,
    );
    console.log(
      `   POST   /tv/cast                       → Enviar conteúdo (waterfall multi-protocolo)`,
    );
    console.log(
      `   POST   /tv/devices/:id/pair           → Gerar token + URL receiver.html`,
    );
    console.log(
      `   GET    /tv/devices/:id/token          → Ver token atual (sem rotacionar)`,
    );
    console.log(`   POST   /tv/devices/:id/wol            → Wake-on-LAN`);
    console.log(
      `   GET    /tv/devices/:id/historico      → Histórico de comandos`,
    );
    console.log(
      `   GET    /tv/discover                   → Varredura SSDP na rede`,
    );
    console.log(
      `   GET    /static/receiver.html          → App para o browser da TV`,
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
