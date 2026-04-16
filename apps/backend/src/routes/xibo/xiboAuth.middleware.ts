// =============================================================================
// src/routes/xibo/xiboAuth.middleware.ts
// =============================================================================

import { FastifyRequest, FastifyReply } from "fastify";
import { resolveTenantFromXiboToken } from "./xiboTenantResolver.service";

function readQueryToken(request: FastifyRequest): string | undefined {
  const q = request.query as Record<string, unknown> | undefined;
  const raw = q?.token;
  if (typeof raw !== "string") return undefined;
  const t = raw.trim();
  return t || undefined;
}

export async function xiboTokenAuthMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const token = readQueryToken(request);
  const ctx = await resolveTenantFromXiboToken(token);

  if (!ctx) {
    return reply.status(401).send({
      statusCode: 401,
      error: "Unauthorized",
      message: "Token inválido ou ausente",
    });
  }

  request.xiboTenant = ctx;
}
