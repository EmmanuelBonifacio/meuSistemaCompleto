// =============================================================================
// src/modules/fleet/controllers/drivers.controller.ts
// =============================================================================
// O QUE FAZ:
//   Handlers HTTP para CRUD de motoristas da frota.
//   Gerencia a tabela local `drivers` no schema do tenant.
//   Integração com Fleetbase é opcional (campo fleetbase_driver_id).
// =============================================================================

import { FastifyRequest, FastifyReply } from "fastify";
import { withTenantSchema } from "../../../core/database/prisma";
import {
  CreateDriverSchema,
  UpdateDriverSchema,
  DriverParamsSchema,
  ListDriversQuerySchema,
} from "../dto/driver.dto";

// =============================================================================
// HANDLER: GET /fleet/drivers
// Lista motoristas com paginação e filtros.
// =============================================================================
export async function listDrivers(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { schemaName } = request.tenant!;
  const query = ListDriversQuerySchema.parse(request.query);
  const offset = (query.page - 1) * query.limit;

  const result = await withTenantSchema(schemaName, async (db) => {
    const data = await db.$queryRaw<
      Array<{
        id: string;
        name: string;
        cpf: string | null;
        cnh: string | null;
        cnh_category: string | null;
        cnh_expiry: Date | null;
        phone: string | null;
        email: string | null;
        status: string;
        current_job_id: string | null;
        vehicle_id: string | null;
        fleetbase_driver_id: string | null;
        created_at: Date;
        updated_at: Date;
      }>
    >`
      SELECT id, name, cpf, cnh, cnh_category, cnh_expiry,
             phone, email, status, current_job_id, vehicle_id,
             fleetbase_driver_id, created_at, updated_at
      FROM drivers
      WHERE (${query.status ?? null}::text IS NULL OR status = ${query.status ?? null}::text)
        AND (${query.busca ?? null}::text IS NULL
             OR name ILIKE ${"%" + (query.busca ?? "") + "%"}
             OR phone ILIKE ${"%" + (query.busca ?? "") + "%"})
      ORDER BY name
      LIMIT ${query.limit} OFFSET ${offset}
    `;

    const countResult = await db.$queryRaw<[{ count: string }]>`
      SELECT COUNT(*)::text AS count
      FROM drivers
      WHERE (${query.status ?? null}::text IS NULL OR status = ${query.status ?? null}::text)
        AND (${query.busca ?? null}::text IS NULL
             OR name ILIKE ${"%" + (query.busca ?? "") + "%"}
             OR phone ILIKE ${"%" + (query.busca ?? "") + "%"})
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
// HANDLER: GET /fleet/drivers/:id
// Busca um motorista pelo UUID.
// =============================================================================
export async function getDriver(request: FastifyRequest, reply: FastifyReply) {
  const { schemaName } = request.tenant!;
  const { id } = DriverParamsSchema.parse(request.params);

  const rows = await withTenantSchema(
    schemaName,
    async (db) =>
      db.$queryRaw<
        Array<{
          id: string;
          name: string;
          cpf: string | null;
          cnh: string | null;
          cnh_category: string | null;
          cnh_expiry: Date | null;
          phone: string | null;
          email: string | null;
          status: string;
          current_job_id: string | null;
          vehicle_id: string | null;
          fleetbase_driver_id: string | null;
          created_at: Date;
          updated_at: Date;
        }>
      >`
      SELECT id, name, cpf, cnh, cnh_category, cnh_expiry,
             phone, email, status, current_job_id, vehicle_id,
             fleetbase_driver_id, created_at, updated_at
      FROM drivers
      WHERE id = ${id}::uuid
      LIMIT 1
    `,
  );

  if (rows.length === 0) {
    return reply.status(404).send({
      statusCode: 404,
      error: "Not Found",
      message: "Motorista não encontrado.",
    });
  }

  return reply.status(200).send(rows[0]);
}

// =============================================================================
// HANDLER: POST /fleet/drivers
// Cria um novo motorista no banco local do tenant.
// =============================================================================
export async function createDriver(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { schemaName } = request.tenant!;
  const data = CreateDriverSchema.parse(request.body);

  const rows = await withTenantSchema(
    schemaName,
    async (db) =>
      db.$queryRaw<[{ id: string }]>`
      INSERT INTO drivers
        (name, cpf, cnh, cnh_category, cnh_expiry,
         phone, email, status, fleetbase_driver_id)
      VALUES (
        ${data.name},
        ${data.cpf ?? null},
        ${data.cnh ?? null},
        ${data.cnh_category ?? null},
        ${data.cnh_expiry ?? null}::timestamptz,
        ${data.phone ?? null},
        ${data.email ?? null},
        ${data.status},
        ${data.fleetbase_driver_id ?? null}
      )
      RETURNING id
    `,
  );

  return reply.status(201).send({ id: rows[0].id, ...data });
}

// =============================================================================
// HANDLER: PATCH /fleet/drivers/:id
// Atualiza parcialmente um motorista.
// =============================================================================
export async function updateDriver(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { schemaName } = request.tenant!;
  const { id } = DriverParamsSchema.parse(request.params);
  const data = UpdateDriverSchema.parse(request.body);

  const existing = await withTenantSchema(
    schemaName,
    async (db) =>
      db.$queryRaw<[{ id: string }]>`
      SELECT id FROM drivers WHERE id = ${id}::uuid LIMIT 1
    `,
  );

  if (existing.length === 0) {
    return reply.status(404).send({
      statusCode: 404,
      error: "Not Found",
      message: "Motorista não encontrado.",
    });
  }

  await withTenantSchema(
    schemaName,
    async (db) =>
      db.$executeRaw`
      UPDATE drivers SET
        name                = COALESCE(${data.name ?? null}, name),
        cpf                 = COALESCE(${data.cpf ?? null}, cpf),
        cnh                 = COALESCE(${data.cnh ?? null}, cnh),
        cnh_category        = COALESCE(${data.cnh_category ?? null}, cnh_category),
        cnh_expiry          = COALESCE(${data.cnh_expiry ?? null}::timestamptz, cnh_expiry),
        phone               = COALESCE(${data.phone ?? null}, phone),
        email               = COALESCE(${data.email ?? null}, email),
        status              = COALESCE(${data.status ?? null}, status),
        fleetbase_driver_id = COALESCE(${data.fleetbase_driver_id ?? null}, fleetbase_driver_id),
        updated_at          = now()
      WHERE id = ${id}::uuid
    `,
  );

  return reply.status(200).send({ message: "Motorista atualizado." });
}
