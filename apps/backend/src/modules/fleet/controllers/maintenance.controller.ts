// =============================================================================
// src/modules/fleet/controllers/maintenance.controller.ts
// =============================================================================
// O QUE FAZ:
//   Handlers HTTP para manutenção de veículos via Fleetms.
//   CRUD de ordens de manutenção, documentos e abastecimentos.
// =============================================================================

import { FastifyRequest, FastifyReply } from "fastify";
import { getFleetCredentials } from "../services/TenantFleetConfig";
import { FleetmsService } from "../services/FleetmsService";
import {
  CreateMaintenanceSchema,
  UpdateMaintenanceSchema,
  MaintenanceParamsSchema,
  ListMaintenanceQuerySchema,
} from "../dto/maintenance.dto";

// =============================================================================
// HANDLER: GET /fleet/maintenance
// Lista registros de manutenção do Fleetms.
// =============================================================================
export async function listMaintenance(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { id: tenantId } = request.tenant!;
  const query = ListMaintenanceQuerySchema.parse(request.query);

  const creds = await getFleetCredentials(tenantId);
  if (!creds?.fleetmsToken) {
    return reply.status(503).send({
      statusCode: 503,
      error: "Service Unavailable",
      message:
        "Credenciais do Fleetms não configuradas para este tenant. " +
        "Configure em POST /fleet/config.",
    });
  }

  const fleetms = new FleetmsService(creds.fleetmsToken);
  let records = await fleetms.listMaintenanceRecords(query.vehicle_id);

  // Filtros adicionais aplicados no lado do backend
  if (query.status) {
    records = records.filter((r) => r.status === query.status);
  }
  if (query.type) {
    records = records.filter((r) => r.type === query.type);
  }

  // Paginação simples
  const page = query.page;
  const limit = query.limit;
  const start = (page - 1) * limit;
  const data = records.slice(start, start + limit);

  return reply.status(200).send({
    data,
    total: records.length,
    page,
    limit,
    totalPages: Math.ceil(records.length / limit),
  });
}

// =============================================================================
// HANDLER: GET /fleet/maintenance/:id
// Busca um registro de manutenção pelo ID.
// =============================================================================
export async function getMaintenance(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { id: tenantId } = request.tenant!;
  const { id } = MaintenanceParamsSchema.parse(request.params);

  const creds = await getFleetCredentials(tenantId);
  if (!creds?.fleetmsToken) {
    return reply.status(503).send({
      statusCode: 503,
      error: "Service Unavailable",
      message: "Credenciais do Fleetms não configuradas.",
    });
  }

  const fleetms = new FleetmsService(creds.fleetmsToken);
  const record = await fleetms.getMaintenanceRecord(id);
  return reply.status(200).send(record);
}

// =============================================================================
// HANDLER: POST /fleet/maintenance
// Cria um novo registro de manutenção no Fleetms.
// =============================================================================
export async function createMaintenance(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { id: tenantId } = request.tenant!;
  const data = CreateMaintenanceSchema.parse(request.body);

  const creds = await getFleetCredentials(tenantId);
  if (!creds?.fleetmsToken) {
    return reply.status(503).send({
      statusCode: 503,
      error: "Service Unavailable",
      message: "Credenciais do Fleetms não configuradas.",
    });
  }

  const fleetms = new FleetmsService(creds.fleetmsToken);
  const record = await fleetms.createMaintenanceRecord({
    vehicle_id: data.vehicle_id,
    type: data.type,
    description: data.description,
    scheduled_date: data.scheduled_date ?? null,
    cost: data.cost ?? null,
    odometer_km: data.odometer_km ?? null,
    notes: data.notes,
  });

  return reply.status(201).send(record);
}

// =============================================================================
// HANDLER: PATCH /fleet/maintenance/:id
// Atualiza status de um registro de manutenção.
// =============================================================================
export async function updateMaintenance(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { id: tenantId } = request.tenant!;
  const { id } = MaintenanceParamsSchema.parse(request.params);
  const data = UpdateMaintenanceSchema.parse(request.body);

  const creds = await getFleetCredentials(tenantId);
  if (!creds?.fleetmsToken) {
    return reply.status(503).send({
      statusCode: 503,
      error: "Service Unavailable",
      message: "Credenciais do Fleetms não configuradas.",
    });
  }

  const fleetms = new FleetmsService(creds.fleetmsToken);
  const record = await fleetms.updateMaintenanceRecord(id, {
    status: data.status ?? undefined,
    completed_date: data.completed_date ?? undefined,
    cost: data.cost ?? undefined,
    notes: data.notes ?? undefined,
  });

  return reply.status(200).send(record);
}
