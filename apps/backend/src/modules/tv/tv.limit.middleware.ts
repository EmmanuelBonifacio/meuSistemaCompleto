// =============================================================================
// src/modules/tv/tv.limit.middleware.ts
// =============================================================================
// Valida limite de TVs do tipo CLIENT antes de POST /tv/devices.
// Deve rodar após tenantMiddleware e requireModule('tv').
// =============================================================================

import { FastifyRequest, FastifyReply } from "fastify";
import { getTvLimit } from "./tvLimitService";
import { countTvDevicesByClientRole } from "./tv.repository";

export async function checkTvLimit(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const tenant = request.tenant;
  if (!tenant?.id || !tenant.schemaName) {
    request.log.error(
      "[TV] checkTvLimit chamado sem tenantMiddleware — configure os preHandlers.",
    );
    return reply.status(500).send({
      statusCode: 500,
      error: "Erro de Configuração",
      message: "Erro interno de configuração do servidor.",
    });
  }

  const limit = await getTvLimit(tenant.id);
  const clientCount = await countTvDevicesByClientRole(tenant.schemaName);

  if (clientCount >= limit.maxClientTvs) {
    return reply.status(400).send({
      statusCode: 400,
      error: "Bad Request",
      message: "Limite de TVs do plano atingido",
    });
  }
}
