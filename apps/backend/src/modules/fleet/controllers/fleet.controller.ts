// =============================================================================
// src/modules/fleet/controllers/fleet.controller.ts
// =============================================================================
// O QUE FAZ:
//   Handlers HTTP do painel unificado de frota.
//   Endpoints gerais: dashboard summary e visão unificada de veículos.
// =============================================================================

import { FastifyRequest, FastifyReply } from "fastify";
import { FleetBridgeService } from "../services/FleetBridgeService";
import {
  SaveFleetCredentialsInput,
  saveFleetCredentials,
} from "../services/TenantFleetConfig";

// =============================================================================
// HANDLER: GET /fleet/dashboard
// Retorna o resumo estatístico do módulo de frota.
// =============================================================================
export async function getDashboard(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { id: tenantId, schemaName } = request.tenant!;
  const bridge = new FleetBridgeService(tenantId, schemaName);

  const summary = await bridge.getDashboardSummary();
  return reply.status(200).send(summary);
}

// =============================================================================
// HANDLER: GET /fleet/vehicles/unified
// Retorna todos os veículos com dados combinados dos 3 engines.
// =============================================================================
export async function getUnifiedVehicles(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { id: tenantId, schemaName } = request.tenant!;
  const bridge = new FleetBridgeService(tenantId, schemaName);

  const vehicles = await bridge.getUnifiedVehicles();
  return reply.status(200).send({ data: vehicles, total: vehicles.length });
}

// =============================================================================
// HANDLER: POST /fleet/config
// Salva as credenciais dos engines para o tenant.
// Body: { traccarUser?, traccarPassword?, fleetbaseApiKey?, fleetmsToken? }
// =============================================================================
export async function saveConfig(
  request: FastifyRequest<{
    Body: Omit<SaveFleetCredentialsInput, "tenantId">;
  }>,
  reply: FastifyReply,
) {
  const { id: tenantId } = request.tenant!;

  await saveFleetCredentials({
    tenantId,
    ...request.body,
  });

  return reply
    .status(200)
    .send({ message: "Configurações salvas com sucesso." });
}
