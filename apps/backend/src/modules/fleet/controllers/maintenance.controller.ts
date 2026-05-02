// =============================================================================
// src/modules/fleet/controllers/maintenance.controller.ts
// =============================================================================
// O QUE FAZ:
//   Handlers HTTP para CRUD de manutenções e abastecimentos da frota.
//   Gerencia a tabela local `maintenance_records` no schema do tenant.
//   Integração com Fleetms é opcional (campo fleetms_record_id).
// =============================================================================

import { FastifyRequest, FastifyReply } from "fastify";
import { withTenantSchema } from "../../../core/database/prisma";
import {
  CreateMaintenanceSchema,
  UpdateMaintenanceSchema,
  MaintenanceParamsSchema,
  ListMaintenanceQuerySchema,
} from "../dto/maintenance.dto";

// =============================================================================
// HANDLER: GET /fleet/maintenance
// Lista registros de manutenção com filtros e paginação.
// =============================================================================
export async function listMaintenance(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { schemaName } = request.tenant!;
  const query = ListMaintenanceQuerySchema.parse(request.query);
  const offset = (query.page - 1) * query.limit;

  const result = await withTenantSchema(schemaName, async (db) => {
    const data = await db.$queryRaw<
      Array<{
        id: string;
        vehicle_id: string;
        type: string;
        description: string;
        status: string;
        scheduled_date: Date | null;
        completed_date: Date | null;
        cost: number | null;
        odometer_km: number | null;
        fleetms_record_id: string | null;
        notes: string | null;
        created_at: Date;
        updated_at: Date;
      }>
    >`
      SELECT id, vehicle_id, type, description, status,
             scheduled_date, completed_date, cost, odometer_km,
             fleetms_record_id, notes, created_at, updated_at
      FROM maintenance_records
      WHERE (${query.vehicle_id ?? null}::uuid IS NULL OR vehicle_id = ${query.vehicle_id ?? null}::uuid)
        AND (${query.status ?? null}::text IS NULL OR status = ${query.status ?? null}::text)
        AND (${query.type ?? null}::text IS NULL OR type = ${query.type ?? null}::text)
      ORDER BY
        CASE WHEN status IN ('scheduled','in_progress') THEN 0 ELSE 1 END,
        scheduled_date ASC NULLS LAST,
        created_at DESC
      LIMIT ${query.limit} OFFSET ${offset}
    `;

    const countResult = await db.$queryRaw<[{ count: string }]>`
      SELECT COUNT(*)::text AS count
      FROM maintenance_records
      WHERE (${query.vehicle_id ?? null}::uuid IS NULL OR vehicle_id = ${query.vehicle_id ?? null}::uuid)
        AND (${query.status ?? null}::text IS NULL OR status = ${query.status ?? null}::text)
        AND (${query.type ?? null}::text IS NULL OR type = ${query.type ?? null}::text)
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
// HANDLER: GET /fleet/maintenance/:id
// Busca um registro de manutenção pelo UUID.
// =============================================================================
export async function getMaintenance(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { schemaName } = request.tenant!;
  const { id } = MaintenanceParamsSchema.parse(request.params);

  const rows = await withTenantSchema(
    schemaName,
    async (db) =>
      db.$queryRaw<
        Array<{
          id: string;
          vehicle_id: string;
          type: string;
          description: string;
          status: string;
          scheduled_date: Date | null;
          completed_date: Date | null;
          cost: number | null;
          odometer_km: number | null;
          fleetms_record_id: string | null;
          notes: string | null;
          created_at: Date;
          updated_at: Date;
        }>
      >`
      SELECT id, vehicle_id, type, description, status,
             scheduled_date, completed_date, cost, odometer_km,
             fleetms_record_id, notes, created_at, updated_at
      FROM maintenance_records
      WHERE id = ${id}::uuid
      LIMIT 1
    `,
  );

  if (rows.length === 0) {
    return reply.status(404).send({
      statusCode: 404,
      error: "Not Found",
      message: "Registro de manutenção não encontrado.",
    });
  }

  return reply.status(200).send(rows[0]);
}

// =============================================================================
// HANDLER: POST /fleet/maintenance
// Cria um novo registro de manutenção no banco local do tenant.
// =============================================================================
export async function createMaintenance(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { schemaName } = request.tenant!;
  const data = CreateMaintenanceSchema.parse(request.body);

  const rows = await withTenantSchema(
    schemaName,
    async (db) =>
      db.$queryRaw<[{ id: string }]>`
      INSERT INTO maintenance_records
        (vehicle_id, type, description, status,
         scheduled_date, completed_date, cost, odometer_km,
         fleetms_record_id, notes)
      VALUES (
        ${data.vehicle_id}::uuid,
        ${data.type},
        ${data.description},
        ${data.status},
        ${data.scheduled_date ?? null}::timestamptz,
        ${data.completed_date ?? null}::timestamptz,
        ${data.cost ?? null},
        ${data.odometer_km ?? null},
        ${(data as { fleetms_record_id?: string | null }).fleetms_record_id ?? null},
        ${data.notes ?? null}
      )
      RETURNING id
    `,
  );

  return reply.status(201).send({ id: rows[0].id, ...data });
}

// =============================================================================
// HANDLER: PATCH /fleet/maintenance/:id
// Atualiza parcialmente um registro de manutenção.
// =============================================================================
export async function updateMaintenance(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { schemaName } = request.tenant!;
  const { id } = MaintenanceParamsSchema.parse(request.params);
  const data = UpdateMaintenanceSchema.parse(request.body);

  const existing = await withTenantSchema(
    schemaName,
    async (db) =>
      db.$queryRaw<[{ id: string }]>`
      SELECT id FROM maintenance_records WHERE id = ${id}::uuid LIMIT 1
    `,
  );

  if (existing.length === 0) {
    return reply.status(404).send({
      statusCode: 404,
      error: "Not Found",
      message: "Registro de manutenção não encontrado.",
    });
  }

  await withTenantSchema(
    schemaName,
    async (db) =>
      db.$executeRaw`
      UPDATE maintenance_records SET
        type            = COALESCE(${data.type ?? null}, type),
        description     = COALESCE(${data.description ?? null}, description),
        status          = COALESCE(${data.status ?? null}, status),
        scheduled_date  = COALESCE(${data.scheduled_date ?? null}::timestamptz, scheduled_date),
        completed_date  = COALESCE(${data.completed_date ?? null}::timestamptz, completed_date),
        cost            = COALESCE(${data.cost ?? null}, cost),
        odometer_km     = COALESCE(${data.odometer_km ?? null}, odometer_km),
        notes           = COALESCE(${data.notes ?? null}, notes),
        updated_at      = now()
      WHERE id = ${id}::uuid
    `,
  );

  return reply.status(200).send({ message: "Manutenção atualizada." });
}
