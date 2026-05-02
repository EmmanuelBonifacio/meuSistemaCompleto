// =============================================================================
// src/modules/fleet/fleet.routes.ts
// =============================================================================
// O QUE FAZ:
//   Registra todas as rotas do módulo Gestão de Frota como plugin Fastify.
//   O prefixo /fleet é definido no server.ts.
//
// ROTAS DISPONÍVEIS:
//   GET    /fleet/dashboard             → resumo estatístico do módulo
//   GET    /fleet/vehicles/unified      → veículos + posição + ordens + alertas
//   POST   /fleet/config               → salvar credenciais dos engines
//
//   GET    /fleet/vehicles             → listar veículos (banco local)
//   GET    /fleet/vehicles/:id         → buscar veículo
//   POST   /fleet/vehicles             → criar veículo
//   PATCH  /fleet/vehicles/:id         → atualizar veículo
//   DELETE /fleet/vehicles/:id         → desativar veículo (soft delete)
//
//   GET    /fleet/drivers              → listar motoristas (Fleetbase)
//   GET    /fleet/drivers/:id          → buscar motorista
//   POST   /fleet/drivers              → criar motorista
//   PATCH  /fleet/drivers/:id          → atualizar motorista
//
//   GET    /fleet/maintenance          → listar manutenções (Fleetms)
//   GET    /fleet/maintenance/:id      → buscar manutenção
//   POST   /fleet/maintenance          → criar manutenção
//   PATCH  /fleet/maintenance/:id      → atualizar manutenção
// =============================================================================

import { FastifyInstance } from "fastify";
import { fleetModuleGuard } from "./fleet.middleware";
import * as fleetController from "./controllers/fleet.controller";
import * as vehiclesController from "./controllers/vehicles.controller";
import * as driversController from "./controllers/drivers.controller";
import * as maintenanceController from "./controllers/maintenance.controller";

// =============================================================================
// PLUGIN: fleetRoutes
// =============================================================================
export async function fleetRoutes(fastify: FastifyInstance) {
  // --------------------------------------------------------------------------
  // PAINEL UNIFICADO
  // --------------------------------------------------------------------------

  // GET /fleet/dashboard — resumo estatístico
  fastify.get("/dashboard", {
    preHandler: fleetModuleGuard,
    handler: fleetController.getDashboard,
  });

  // GET /fleet/vehicles/unified — veículos com dados dos 3 engines
  // ATENÇÃO: esta rota deve ficar ANTES de GET /vehicles/:id para não colidir
  fastify.get("/vehicles/unified", {
    preHandler: fleetModuleGuard,
    handler: fleetController.getUnifiedVehicles,
  });

  // POST /fleet/config — salvar credenciais dos engines
  fastify.post("/config", {
    preHandler: fleetModuleGuard,
    handler: fleetController.saveConfig,
  });

  // --------------------------------------------------------------------------
  // VEÍCULOS (banco local do tenant)
  // --------------------------------------------------------------------------

  fastify.get("/vehicles", {
    preHandler: fleetModuleGuard,
    handler: vehiclesController.listVehicles,
  });

  fastify.get<{ Params: { id: string } }>("/vehicles/:id", {
    preHandler: fleetModuleGuard,
    handler: vehiclesController.getVehicle,
  });

  fastify.post("/vehicles", {
    preHandler: fleetModuleGuard,
    handler: vehiclesController.createVehicle,
  });

  fastify.patch<{ Params: { id: string } }>("/vehicles/:id", {
    preHandler: fleetModuleGuard,
    handler: vehiclesController.updateVehicle,
  });

  fastify.delete<{ Params: { id: string } }>("/vehicles/:id", {
    preHandler: fleetModuleGuard,
    handler: vehiclesController.deleteVehicle,
  });

  // --------------------------------------------------------------------------
  // MOTORISTAS (Fleetbase)
  // --------------------------------------------------------------------------

  fastify.get("/drivers", {
    preHandler: fleetModuleGuard,
    handler: driversController.listDrivers,
  });

  fastify.get<{ Params: { id: string } }>("/drivers/:id", {
    preHandler: fleetModuleGuard,
    handler: driversController.getDriver,
  });

  fastify.post("/drivers", {
    preHandler: fleetModuleGuard,
    handler: driversController.createDriver,
  });

  fastify.patch<{ Params: { id: string } }>("/drivers/:id", {
    preHandler: fleetModuleGuard,
    handler: driversController.updateDriver,
  });

  // --------------------------------------------------------------------------
  // MANUTENÇÃO (Fleetms)
  // --------------------------------------------------------------------------

  fastify.get("/maintenance", {
    preHandler: fleetModuleGuard,
    handler: maintenanceController.listMaintenance,
  });

  fastify.get<{ Params: { id: string } }>("/maintenance/:id", {
    preHandler: fleetModuleGuard,
    handler: maintenanceController.getMaintenance,
  });

  fastify.post("/maintenance", {
    preHandler: fleetModuleGuard,
    handler: maintenanceController.createMaintenance,
  });

  fastify.patch<{ Params: { id: string } }>("/maintenance/:id", {
    preHandler: fleetModuleGuard,
    handler: maintenanceController.updateMaintenance,
  });
}
