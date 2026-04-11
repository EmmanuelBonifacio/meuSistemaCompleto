// =============================================================================
// src/modules/auth/auth.routes.ts
// =============================================================================
// O QUE FAZ:
//   Registra as rotas de autenticação como um plugin Fastify.
//
// PONTO CRÍTICO — ROTAS PÚBLICAS:
//   As rotas de auth são intencionalmente PÚBLICAS (sem tenantMiddleware).
//   Faz sentido: o usuário ainda não tem um token quando vai fazer login!
//   A verificação de credenciais acontece DENTRO do handler de login.
//
// ROTAS REGISTRADAS (prefixo /auth aplicado no server.ts):
//   POST /auth/login   → verifica slug + email + senha → retorna tokens
//   POST /auth/refresh → valida refresh token → emite novo par
//   POST /auth/logout  → revoga refresh token → encerra sessão
// =============================================================================

import { FastifyInstance } from "fastify";
import { login, refresh, logout } from "./auth.controller";

export async function authRoutes(fastify: FastifyInstance): Promise<void> {
  // ==========================================================================
  // ROTA: POST /auth/login
  // ==========================================================================
  // Rota PÚBLICA — sem nenhum preHandler de autenticação.
  // A autenticação acontece DENTRO do handler (verifica email+senha no banco).
  //
  // RATE LIMIT ESPECÍFICO: 10 tentativas por minuto por IP.
  // Mais restritivo que o global (200/min) pois esta é a rota mais crítica
  // do sistema — alvo preferído de ataques de brute force.
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
    login,
  );

  // ==========================================================================
  // ROTA: POST /auth/refresh
  // ==========================================================================
  // Rota PÚBLICA — o cliente não tem access_token válido quando chega aqui
  // (o access_token expirou). A verificação é feita pelo refresh token.
  // ==========================================================================
  fastify.post("/refresh", refresh);

  // ==========================================================================
  // ROTA: POST /auth/logout
  // ==========================================================================
  // Rota PÚBLICA — intencionalmente não exige access_token.
  // Motivo: o usuário pode querer fazer logout mesmo com o access_token expirado.
  // A revogação do refresh_token é o que importa — o access expira sozinho.
  // ==========================================================================
  fastify.post("/logout", logout);
}
