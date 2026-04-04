// =============================================================================
// src/admin/admin.auth.routes.ts
// =============================================================================
// O QUE FAZ:
//   Plugin Fastify que registra a rota pública de login do painel admin.
//   É mantido SEPARADO de admin.routes.ts propositalmente.
//
// POR QUE SEPARADO DO admin.routes.ts?
//   O admin.routes.ts aplica o adminMiddleware via addHook em TODAS as rotas
//   daquele plugin. O login é uma rota PÚBLICA — o usuário ainda não tem token.
//   Se incluíssemos o login lá, criaria um paradoxo:
//   precisaria de token para logar. O encapsulamento de plugins do Fastify
//   é exatamente o mecanismo correto para resolver isso.
//
// PADRÃO DO PROJETO:
//   Segue o mesmo padrão do auth.routes.ts (autenticação de tenant):
//   plugin separado para rotas públicas de autenticação, sem middleware.
//
// COMO REGISTRAR NO SERVIDOR:
//   await app.register(adminAuthRoutes, { prefix: "/admin" });
//   Resultado: POST /admin/login (sem nenhum preHandler de autenticação)
// =============================================================================

import { FastifyInstance } from "fastify";
import { adminLogin } from "./admin.auth.controller";

// =============================================================================
// PLUGIN: adminAuthRoutes
// =============================================================================
// Plugin público — sem addHook de autenticação.
// Registrado em server.ts com prefix "/admin".
// =============================================================================
export async function adminAuthRoutes(fastify: FastifyInstance): Promise<void> {
  // ==========================================================================
  // ROTA: POST /admin/login
  // ==========================================================================
  // Rota completamente pública — sem preHandler de autenticação.
  // O handler `adminLogin` valida credenciais e emite JWT com role "superadmin".
  //
  // RATE LIMIT ESPECÍFICO: 10 tentativas por minuto por IP.
  // O painel admin é o alvo mais sensível do sistema.
  // 10 tentativas/min ainda permite um admin legítimo entrar com conforto.
  //
  // POR QUE POST E NÃO GET?
  //   Credenciais (email + senha) vão no BODY da requisição, nunca na URL.
  //   GET coloca os dados na URL — ficam em logs do servidor, histórico do
  //   browser e cabeçalhos de referência. POST garante que vão no body
  //   (trafegam criptografados pelo TLS em produção).
  // ==========================================================================
  fastify.post(
    "/login",
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: "1 minute",
        },
      },
    },
    adminLogin,
  );
}
