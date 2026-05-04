// =============================================================================
// src/modules/routes/routes.controller.ts
// =============================================================================
// Handlers Fastify para o módulo Criar Rotas.
// =============================================================================

import { FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { optimizeRoutes } from "./routes.service";
import * as repo from "./routes.repository";
import { geocodeAddress, geocodeByCep, geocodeByAddress } from "./geocoding.service";

// ---------------------------------------------------------------------------
// Schemas Zod
// ---------------------------------------------------------------------------

const OptimizeVehicleSchema = z.object({
  id: z.string().uuid(),
  capacity_kg: z.number().min(0).default(0),
  capacity_m3: z.number().min(0).default(0),
  /** Opcional: veículo pode não ter motorista vinculado no cadastro. */
  driver_id: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : v),
    z.string().uuid().optional(),
  ),
  shift_start: z.string().regex(/^\d{2}:\d{2}$/).default("08:00"),
  shift_end: z.string().regex(/^\d{2}:\d{2}$/).default("18:00"),
});

const OptimizeStopSchema = z.object({
  id: z.string(),
  address: z.string().min(1),
  lat: z.number().default(0),
  lng: z.number().default(0),
  time_window_start: z.string().nullable().optional(),
  time_window_end: z.string().nullable().optional(),
  service_duration_min: z.number().min(1).default(5),
  weight_kg: z.number().min(0).optional().nullable(),
  volume_m3: z.number().min(0).optional().nullable(),
  required_skill: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  order_id: z.string().uuid().optional().nullable(),
});

const OptimizeSchema = z.object({
  sessionId: z.string().default("new"),
  depotAddress: z.string().min(1),
  depotLat: z.number(),
  depotLng: z.number(),
  vehicles: z.array(OptimizeVehicleSchema).min(1),
  stops: z.array(OptimizeStopSchema).min(1),
  engine: z.enum(["vroom", "ortools", "combined"]).default("vroom"),
  operationType: z.enum(["delivery", "transport", "collection", "service"]).default("delivery"),
  operationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const UpdateStopsSchema = z.object({
  stopIds: z.array(z.string().uuid()).min(1),
});

const ListSessionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const ListDispatchQuerySchema = z.object({
  status: z.string().optional(),
  routeId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

// ---------------------------------------------------------------------------
// POST /routes/optimize
// ---------------------------------------------------------------------------
export async function optimize(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { id: tenantId, schemaName } = request.tenant!;
  const userId = (request.user as { id?: string } | undefined)?.id;
  const body = OptimizeSchema.parse(request.body);

  const result = await optimizeRoutes(
    schemaName,
    tenantId,
    body as import("./routes.types").OptimizePayload,
    userId,
  );
  return reply.status(200).send(result);
}

// ---------------------------------------------------------------------------
// GET /routes/sessions
// ---------------------------------------------------------------------------
export async function listSessions(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { schemaName } = request.tenant!;
  const { page, limit } = ListSessionsQuerySchema.parse(request.query);
  const offset = (page - 1) * limit;

  const { data, total } = await repo.listSessions(schemaName, limit, offset);

  return reply.status(200).send({
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
}

// ---------------------------------------------------------------------------
// GET /routes/sessions/:id
// ---------------------------------------------------------------------------
export async function getSession(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { schemaName } = request.tenant!;
  const { id } = z.object({ id: z.string().uuid() }).parse(request.params);

  const result = await repo.getSessionWithRoutes(schemaName, id);
  if (!result) {
    return reply.status(404).send({
      statusCode: 404,
      error: "Not Found",
      message: "Sessão de rota não encontrada.",
    });
  }

  return reply.status(200).send(result);
}

// ---------------------------------------------------------------------------
// PUT /routes/:id/stops
// Reordena paradas após drag-and-drop
// ---------------------------------------------------------------------------
export async function updateStops(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { schemaName } = request.tenant!;
  const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
  const { stopIds } = UpdateStopsSchema.parse(request.body);

  await repo.updateStopsOrder(schemaName, id, stopIds);
  return reply.status(200).send({ message: "Ordem das paradas atualizada." });
}

// ---------------------------------------------------------------------------
// PUT /routes/:id/approve
// ---------------------------------------------------------------------------
export async function approveRoute(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { schemaName } = request.tenant!;
  const { id } = z.object({ id: z.string().uuid() }).parse(request.params);

  const ok = await repo.approveRoute(schemaName, id);
  if (!ok) {
    return reply.status(404).send({
      statusCode: 404,
      error: "Not Found",
      message: "Rota não encontrada.",
    });
  }

  return reply.status(200).send({ message: "Rota aprovada." });
}

// ---------------------------------------------------------------------------
// POST /routes/sessions/:id/dispatch
// Envia rotas aprovadas ao Despacho
// ---------------------------------------------------------------------------
export async function dispatchRoutes(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { schemaName } = request.tenant!;
  const { id } = z.object({ id: z.string().uuid() }).parse(request.params);

  const ordersCreated = await repo.dispatchApprovedRoutes(schemaName, id);

  return reply.status(200).send({
    message: `${ordersCreated} ordens de despacho criadas.`,
    ordersCreated,
  });
}

// ---------------------------------------------------------------------------
// GET /routes/geocode?q=endereço — geocodificação por texto livre (Nominatim)
// ---------------------------------------------------------------------------
export async function geocode(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { q } = z.object({ q: z.string().min(3) }).parse(request.query);
  const result = await geocodeAddress(q);
  if (!result) {
    return reply.status(404).send({
      statusCode: 404,
      error: "Not Found",
      message: "Endereço não encontrado.",
    });
  }
  return reply.status(200).send(result);
}

// ---------------------------------------------------------------------------
// GET /routes/geocode/cep/:cep — geocodificação por CEP (ViaCEP + Nominatim)
// ---------------------------------------------------------------------------
export async function geocodeCep(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { cep } = z
    .object({ cep: z.string().regex(/^\d{8}$/, "CEP deve ter 8 dígitos") })
    .parse(request.params);

  const result = await geocodeByCep(cep);
  if (!result) {
    return reply.status(404).send({
      statusCode: 404,
      error: "Not Found",
      message: "CEP não encontrado ou não geocodificável.",
    });
  }
  return reply.status(200).send(result);
}

// ---------------------------------------------------------------------------
// POST /routes/geocode/address — geocodificação por endereço + cidade + estado
// Body: { address: string, city?: string, state?: string }
// ---------------------------------------------------------------------------
export async function geocodeAddr(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { address, city, state } = z
    .object({
      address: z.string().min(3),
      city: z.string().optional(),
      state: z.string().max(2).optional(),
    })
    .parse(request.body);

  const result = await geocodeByAddress(address, city, state);
  if (!result) {
    return reply.status(404).send({
      statusCode: 404,
      error: "Not Found",
      message: "Endereço não encontrado. Verifique a cidade e o estado.",
    });
  }
  return reply.status(200).send(result);
}

// ---------------------------------------------------------------------------
// GET /routes/dispatch-orders
// Lista dispatch_orders com info de rota (para Despacho)
// ---------------------------------------------------------------------------
export async function listDispatchOrders(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { schemaName } = request.tenant!;
  const { status, routeId, page, limit } = ListDispatchQuerySchema.parse(request.query);
  const offset = (page - 1) * limit;

  const { data, total } = await repo.listDispatchOrders(
    schemaName, status, routeId, limit, offset,
  );

  return reply.status(200).send({
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
}

// ---------------------------------------------------------------------------
// GET /routes/dispatch-orders/today-routes
// Rotas do dia para aba "Rotas do dia" no Despacho
// ---------------------------------------------------------------------------
export async function listTodayRoutes(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { schemaName } = request.tenant!;
  const routes = await repo.listTodayRoutes(schemaName);
  return reply.status(200).send({ data: routes, total: routes.length });
}

// ---------------------------------------------------------------------------
// GET /routes/dispatch-orders/pending-count
// Contagem de rotas aprovadas aguardando despacho (para banner)
// ---------------------------------------------------------------------------
export async function pendingDispatchCount(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { schemaName } = request.tenant!;
  const count = await repo.countPendingDispatchRoutes(schemaName);
  return reply.status(200).send({ count });
}
