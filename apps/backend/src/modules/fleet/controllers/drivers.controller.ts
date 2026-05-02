// =============================================================================
// src/modules/fleet/controllers/drivers.controller.ts
// =============================================================================
// O QUE FAZ:
//   Handlers HTTP para gerenciamento de motoristas.
//   Sincroniza com o Fleetbase para criação/consulta de motoristas.
// =============================================================================

import { FastifyRequest, FastifyReply } from "fastify";
import { getFleetCredentials } from "../services/TenantFleetConfig";
import { FleetbaseService } from "../services/FleetbaseService";
import {
  CreateDriverSchema,
  UpdateDriverSchema,
  DriverParamsSchema,
  ListDriversQuerySchema,
} from "../dto/driver.dto";

// =============================================================================
// HANDLER: GET /fleet/drivers
// Lista motoristas do Fleetbase.
// =============================================================================
export async function listDrivers(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { id: tenantId } = request.tenant!;
  const query = ListDriversQuerySchema.parse(request.query);
  void query; // filtros aplicados localmente quando necessário

  const creds = await getFleetCredentials(tenantId);
  if (!creds?.fleetbaseApiKey) {
    return reply.status(503).send({
      statusCode: 503,
      error: "Service Unavailable",
      message:
        "Credenciais do Fleetbase não configuradas para este tenant. " +
        "Configure em POST /fleet/config.",
    });
  }

  const fleetbase = new FleetbaseService(creds.fleetbaseApiKey);
  const drivers = await fleetbase.listDrivers();

  // Aplica filtro de status localmente se informado
  const filtered = query.status
    ? drivers.filter((d) => d.status === query.status)
    : drivers;

  // Paginação simples no retorno
  const page = query.page;
  const limit = query.limit;
  const start = (page - 1) * limit;
  const data = filtered.slice(start, start + limit);

  return reply.status(200).send({
    data,
    total: filtered.length,
    page,
    limit,
    totalPages: Math.ceil(filtered.length / limit),
  });
}

// =============================================================================
// HANDLER: GET /fleet/drivers/:id
// Busca um motorista no Fleetbase pelo ID externo.
// =============================================================================
export async function getDriver(request: FastifyRequest, reply: FastifyReply) {
  const { id: tenantId } = request.tenant!;
  const { id } = DriverParamsSchema.parse(request.params);

  const creds = await getFleetCredentials(tenantId);
  if (!creds?.fleetbaseApiKey) {
    return reply.status(503).send({
      statusCode: 503,
      error: "Service Unavailable",
      message: "Credenciais do Fleetbase não configuradas.",
    });
  }

  const fleetbase = new FleetbaseService(creds.fleetbaseApiKey);
  const driver = await fleetbase.getDriver(id);
  return reply.status(200).send(driver);
}

// =============================================================================
// HANDLER: POST /fleet/drivers
// Cria motorista no Fleetbase.
// =============================================================================
export async function createDriver(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { id: tenantId } = request.tenant!;
  const data = CreateDriverSchema.parse(request.body);

  const creds = await getFleetCredentials(tenantId);
  if (!creds?.fleetbaseApiKey) {
    return reply.status(503).send({
      statusCode: 503,
      error: "Service Unavailable",
      message: "Credenciais do Fleetbase não configuradas.",
    });
  }

  const fleetbase = new FleetbaseService(creds.fleetbaseApiKey);
  const driver = await fleetbase.createDriver({
    name: data.name,
    phone: data.phone,
    email: data.email ?? undefined,
  });

  return reply.status(201).send(driver);
}

// =============================================================================
// HANDLER: PATCH /fleet/drivers/:id
// Stub para atualização futura — retorna 501 Not Implemented por enquanto.
// =============================================================================
export async function updateDriver(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  void UpdateDriverSchema.parse(request.body);
  void DriverParamsSchema.parse(request.params);

  return reply.status(501).send({
    statusCode: 501,
    error: "Not Implemented",
    message:
      "Atualização de motoristas será implementada em versão futura. " +
      "Use o painel do Fleetbase diretamente.",
  });
}
