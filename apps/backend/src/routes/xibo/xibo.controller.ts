// =============================================================================
// src/routes/xibo/xibo.controller.ts
// =============================================================================

import { FastifyRequest, FastifyReply } from "fastify";
import {
  listXiboActiveProducts,
  listXiboPlatformAds,
} from "./xiboData.service";

const CACHE_CONTROL = "public, max-age=300";

export async function getXiboProducts(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const tenant = request.xiboTenant!;
  const data = await listXiboActiveProducts(tenant.schemaName);
  reply.header("Cache-Control", CACHE_CONTROL);
  await reply.send(data);
}

export async function getXiboPlatformAds(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const tenant = request.xiboTenant!;
  const data = await listXiboPlatformAds(tenant.schemaName);
  reply.header("Cache-Control", CACHE_CONTROL);
  await reply.send(data);
}
