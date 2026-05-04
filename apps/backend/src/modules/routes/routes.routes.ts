// =============================================================================
// src/modules/routes/routes.routes.ts
// =============================================================================
// Plugin Fastify para o módulo Criar Rotas.
// Registrado em server.ts em /api/v1/routes e /routes (legado).
// =============================================================================

import { FastifyInstance } from "fastify";
import { fleetModuleGuard } from "../fleet/fleet.middleware";
import * as routesController from "./routes.controller";

const guard = [...fleetModuleGuard];

export async function routesModule(fastify: FastifyInstance) {
  // Otimização
  fastify.post("/optimize", {
    preHandler: guard,
    handler: routesController.optimize,
  });

  // Sessões
  fastify.get("/sessions", {
    preHandler: guard,
    handler: routesController.listSessions,
  });

  fastify.get("/sessions/:id", {
    preHandler: guard,
    handler: routesController.getSession,
  });

  fastify.post("/sessions/:id/dispatch", {
    preHandler: guard,
    handler: routesController.dispatchRoutes,
  });

  // Rotas individuais
  fastify.put("/:id/stops", {
    preHandler: guard,
    handler: routesController.updateStops,
  });

  fastify.put("/:id/approve", {
    preHandler: guard,
    handler: routesController.approveRoute,
  });

  // Geocodificação por texto livre (Nominatim)
  fastify.get("/geocode", {
    preHandler: guard,
    handler: routesController.geocode,
  });

  // Geocodificação por CEP (ViaCEP + Nominatim)
  fastify.get("/geocode/cep/:cep", {
    preHandler: guard,
    handler: routesController.geocodeCep,
  });

  // Geocodificação por endereço + cidade + estado (Nominatim)
  fastify.post("/geocode/address", {
    preHandler: guard,
    handler: routesController.geocodeAddr,
  });

  // Dispatch orders (para integração com a tela de Despacho)
  fastify.get("/dispatch-orders", {
    preHandler: guard,
    handler: routesController.listDispatchOrders,
  });

  fastify.get("/dispatch-orders/today-routes", {
    preHandler: guard,
    handler: routesController.listTodayRoutes,
  });

  fastify.get("/dispatch-orders/pending-count", {
    preHandler: guard,
    handler: routesController.pendingDispatchCount,
  });
}
