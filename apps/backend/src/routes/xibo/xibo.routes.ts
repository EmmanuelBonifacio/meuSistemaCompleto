// =============================================================================
// src/routes/xibo/xibo.routes.ts
// =============================================================================
// Rotas públicas para o Xibo CMS (DataSet remoto), autenticadas por ?token=.
// Rate limit: 60 req/min por valor de token (chave estável no CMS).
// =============================================================================

import { FastifyInstance } from "fastify";
import fastifyRateLimit from "@fastify/rate-limit";
import { xiboTokenAuthMiddleware } from "./xiboAuth.middleware";
import { getXiboProducts, getXiboPlatformAds } from "./xibo.controller";

export async function xiboRoutes(fastify: FastifyInstance): Promise<void> {
  await fastify.register(fastifyRateLimit, {
    max: 60,
    timeWindow: "1 minute",
    keyGenerator: (request) => {
      const q = request.query as { token?: string } | undefined;
      const t = q?.token;
      if (typeof t === "string" && t.length > 0) {
        return `xibo-token:${t}`;
      }
      return `xibo-anon:${request.ip}`;
    },
    errorResponseBuilder: (_request, context) => ({
      statusCode: 429,
      error: "Too Many Requests",
      message: `Limite Xibo (60/min). Tente em ${Math.ceil(context.ttl / 1000)}s.`,
    }),
  });

  fastify.get(
    "/products",
    { preHandler: [xiboTokenAuthMiddleware] },
    getXiboProducts,
  );

  fastify.get(
    "/platform-ad",
    { preHandler: [xiboTokenAuthMiddleware] },
    getXiboPlatformAds,
  );
}
