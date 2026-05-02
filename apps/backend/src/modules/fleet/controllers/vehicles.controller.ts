// =============================================================================
// src/modules/fleet/controllers/vehicles.controller.ts
// =============================================================================
// O QUE FAZ:
//   Handlers HTTP para CRUD de veículos da frota.
//   Gerencia a tabela local `vehicles` no schema do tenant.
// =============================================================================

import { FastifyRequest, FastifyReply } from "fastify";
import { withTenantSchema } from "../../../core/database/prisma";
import {
  CreateVehicleSchema,
  UpdateVehicleSchema,
  VehicleParamsSchema,
  ListVehiclesQuerySchema,
} from "../dto/vehicle.dto";

// =============================================================================
// HANDLER: GET /fleet/vehicles
// Lista veículos com paginação e filtros.
// =============================================================================
export async function listVehicles(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { schemaName } = request.tenant!;
  const query = ListVehiclesQuerySchema.parse(request.query);
  const offset = (query.page - 1) * query.limit;

  const result = await withTenantSchema(schemaName, async (db) => {
    // Condições de filtro montadas dinamicamente
    const statusCondition = query.status
      ? db.$queryRaw<never[]>`SELECT 1 WHERE FALSE` // placeholder
      : null;
    void statusCondition; // evita warning de unused

    const data = await db.$queryRaw<
      Array<{
        id: string;
        plate: string;
        brand: string | null;
        model: string | null;
        year: number | null;
        color: string | null;
        status: string;
        traccar_device_id: number | null;
        fleetbase_asset_id: string | null;
        fleetms_vehicle_id: string | null;
        created_at: Date;
        updated_at: Date;
      }>
    >`
      SELECT id, plate, brand, model, year, color, status,
             traccar_device_id, fleetbase_asset_id, fleetms_vehicle_id,
             created_at, updated_at
      FROM vehicles
      WHERE (${query.status ?? null}::text IS NULL OR status = ${query.status ?? null}::text)
        AND (${query.busca ?? null}::text IS NULL
             OR plate ILIKE ${"%" + (query.busca ?? "") + "%"}
             OR brand ILIKE ${"%" + (query.busca ?? "") + "%"}
             OR model ILIKE ${"%" + (query.busca ?? "") + "%"})
      ORDER BY plate
      LIMIT ${query.limit} OFFSET ${offset}
    `;

    const countResult = await db.$queryRaw<[{ count: string }]>`
      SELECT COUNT(*)::text AS count
      FROM vehicles
      WHERE (${query.status ?? null}::text IS NULL OR status = ${query.status ?? null}::text)
        AND (${query.busca ?? null}::text IS NULL
             OR plate ILIKE ${"%" + (query.busca ?? "") + "%"}
             OR brand ILIKE ${"%" + (query.busca ?? "") + "%"}
             OR model ILIKE ${"%" + (query.busca ?? "") + "%"})
    `;

    return { data, total: Number(countResult[0].count) };
  });

  return reply.status(200).send({
    data: result.data,
    total: result.total,
    page: query.page,
    limit: query.limit,
    totalPages: Math.ceil(result.total / query.limit),
  });
}

// =============================================================================
// HANDLER: GET /fleet/vehicles/:id
// Busca um veículo pelo UUID.
// =============================================================================
export async function getVehicle(request: FastifyRequest, reply: FastifyReply) {
  const { schemaName } = request.tenant!;
  const { id } = VehicleParamsSchema.parse(request.params);

  const rows = await withTenantSchema(
    schemaName,
    async (db) =>
      db.$queryRaw<
        Array<{
          id: string;
          plate: string;
          brand: string | null;
          model: string | null;
          year: number | null;
          color: string | null;
          status: string;
          traccar_device_id: number | null;
          fleetbase_asset_id: string | null;
          fleetms_vehicle_id: string | null;
          created_at: Date;
          updated_at: Date;
        }>
      >`
      SELECT id, plate, brand, model, year, color, status,
             traccar_device_id, fleetbase_asset_id, fleetms_vehicle_id,
             created_at, updated_at
      FROM vehicles
      WHERE id = ${id}::uuid
      LIMIT 1
    `,
  );

  if (rows.length === 0) {
    return reply.status(404).send({
      statusCode: 404,
      error: "Not Found",
      message: "Veículo não encontrado.",
    });
  }

  return reply.status(200).send(rows[0]);
}

// =============================================================================
// HANDLER: POST /fleet/vehicles
// Cria um novo veículo.
// =============================================================================
export async function createVehicle(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { schemaName } = request.tenant!;
  const data = CreateVehicleSchema.parse(request.body);

  const rows = await withTenantSchema(
    schemaName,
    async (db) =>
      db.$queryRaw<[{ id: string }]>`
      INSERT INTO vehicles
        (plate, brand, model, year, color, status,
         traccar_device_id, fleetbase_asset_id, fleetms_vehicle_id)
      VALUES (
        ${data.plate},
        ${data.brand ?? null},
        ${data.model ?? null},
        ${data.year ?? null},
        ${data.color ?? null},
        ${data.status},
        ${data.traccar_device_id ?? null},
        ${data.fleetbase_asset_id ?? null},
        ${data.fleetms_vehicle_id ?? null}
      )
      RETURNING id
    `,
  );

  return reply.status(201).send({ id: rows[0].id, ...data });
}

// =============================================================================
// HANDLER: PATCH /fleet/vehicles/:id
// Atualiza parcialmente um veículo.
// =============================================================================
export async function updateVehicle(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { schemaName } = request.tenant!;
  const { id } = VehicleParamsSchema.parse(request.params);
  const data = UpdateVehicleSchema.parse(request.body);

  // Verifica existência
  const existing = await withTenantSchema(
    schemaName,
    async (db) =>
      db.$queryRaw<[{ id: string }]>`
      SELECT id FROM vehicles WHERE id = ${id}::uuid LIMIT 1
    `,
  );
  if (existing.length === 0) {
    return reply.status(404).send({
      statusCode: 404,
      error: "Not Found",
      message: "Veículo não encontrado.",
    });
  }

  await withTenantSchema(
    schemaName,
    async (db) =>
      db.$executeRaw`
      UPDATE vehicles SET
        brand               = COALESCE(${data.brand ?? null}, brand),
        model               = COALESCE(${data.model ?? null}, model),
        year                = COALESCE(${data.year ?? null}, year),
        color               = COALESCE(${data.color ?? null}, color),
        status              = COALESCE(${data.status ?? null}, status),
        traccar_device_id   = COALESCE(${data.traccar_device_id ?? null}, traccar_device_id),
        fleetbase_asset_id  = COALESCE(${data.fleetbase_asset_id ?? null}, fleetbase_asset_id),
        fleetms_vehicle_id  = COALESCE(${data.fleetms_vehicle_id ?? null}, fleetms_vehicle_id),
        updated_at          = now()
      WHERE id = ${id}::uuid
    `,
  );

  return reply.status(200).send({ message: "Veículo atualizado." });
}

// =============================================================================
// HANDLER: DELETE /fleet/vehicles/:id
// Soft delete — marca o veículo como 'decommissioned'.
// =============================================================================
export async function deleteVehicle(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { schemaName } = request.tenant!;
  const { id } = VehicleParamsSchema.parse(request.params);

  const existing = await withTenantSchema(
    schemaName,
    async (db) =>
      db.$queryRaw<[{ id: string }]>`
      SELECT id FROM vehicles WHERE id = ${id}::uuid LIMIT 1
    `,
  );
  if (existing.length === 0) {
    return reply.status(404).send({
      statusCode: 404,
      error: "Not Found",
      message: "Veículo não encontrado.",
    });
  }

  await withTenantSchema(
    schemaName,
    async (db) =>
      db.$executeRaw`
      UPDATE vehicles SET status = 'decommissioned', updated_at = now()
      WHERE id = ${id}::uuid
    `,
  );

  return reply.status(200).send({ message: "Veículo desativado." });
}
