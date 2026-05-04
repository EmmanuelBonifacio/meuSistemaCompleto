// =============================================================================
// src/modules/routes/routes.repository.ts
// =============================================================================
// Queries SQL raw para as tabelas route_sessions, routes, route_stops e
// dispatch_orders dentro do schema do tenant.
// Segue o padrão withTenantSchema + ensure das tabelas do módulo rotas.
// =============================================================================

import { withTenantSchema } from "../../core/database/prisma";
import type { Prisma } from "@prisma/client";
import { ensureRouteModuleTables } from "./routes.schema-ensure";
import {
  SessionRow,
  RouteRow,
  RouteStopRow,
  RouteResult,
  RouteStopResult,
  SessionStatus,
  RouteStatus,
  OptimizeStopInput,
  OptimizeVehicleInput,
  OperationType,
  RouteEngine,
} from "./routes.types";

async function withRoutesSchema<T>(
  schemaName: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  await ensureRouteModuleTables(schemaName);
  return withTenantSchema(schemaName, fn);
}

// ---------------------------------------------------------------------------
// Helper: converte RouteRow + stops em RouteResult
// ---------------------------------------------------------------------------
function toRouteResult(row: RouteRow, stops: RouteStopRow[]): RouteResult {
  return {
    id: row.id,
    sessionId: row.session_id,
    name: row.name,
    vehicleId: row.vehicle_id,
    driverId: row.driver_id,
    totalDistanceKm: parseFloat(row.total_distance_km ?? "0"),
    estimatedDurationMin: row.estimated_duration_min ?? 0,
    status: row.status,
    color: row.color,
    stops: stops.map((s) => ({
      id: s.id,
      routeId: s.route_id,
      sequenceOrder: s.sequence_order,
      address: s.address,
      lat: s.lat ? parseFloat(s.lat) : null,
      lng: s.lng ? parseFloat(s.lng) : null,
      timeWindowStart: s.time_window_start,
      timeWindowEnd: s.time_window_end,
      serviceDurationMin: s.service_duration_min,
      weightKg: s.weight_kg ? parseFloat(s.weight_kg) : null,
      volumeM3: s.volume_m3 ? parseFloat(s.volume_m3) : null,
      requiredSkill: s.required_skill,
      status: s.status,
      orderId: s.order_id,
      notes: s.notes,
    } as RouteStopResult)),
  };
}

// ---------------------------------------------------------------------------
// Cria uma session de rota
// ---------------------------------------------------------------------------
export async function createSession(
  schemaName: string,
  data: {
    operationType: OperationType;
    operationDate: string;
    depotAddress: string;
    depotLat: number;
    depotLng: number;
    engine: RouteEngine;
    createdBy?: string | null;
  },
): Promise<string> {
  const rows = await withRoutesSchema(
    schemaName,
    (db) => db.$queryRaw<[{ id: string }]>`
      INSERT INTO route_sessions
        (operation_type, operation_date, depot_address, depot_lat, depot_lng, engine, created_by)
      VALUES (
        ${data.operationType},
        ${data.operationDate}::date,
        ${data.depotAddress},
        ${data.depotLat},
        ${data.depotLng},
        ${data.engine},
        ${data.createdBy ?? null}::uuid
      )
      RETURNING id
    `,
  );
  return rows[0].id;
}

// ---------------------------------------------------------------------------
// Atualiza o status de uma sessão
// ---------------------------------------------------------------------------
export async function updateSessionStatus(
  schemaName: string,
  sessionId: string,
  status: SessionStatus,
): Promise<void> {
  await withRoutesSchema(
    schemaName,
    (db) => db.$executeRaw`
      UPDATE route_sessions
      SET status = ${status}, updated_at = now()
      WHERE id = ${sessionId}::uuid
    `,
  );
}

// ---------------------------------------------------------------------------
// Lista sessões do tenant
// ---------------------------------------------------------------------------
export async function listSessions(
  schemaName: string,
  limit = 20,
  offset = 0,
): Promise<{ data: SessionRow[]; total: number }> {
  return withRoutesSchema(schemaName, async (db) => {
    const data = await db.$queryRaw<SessionRow[]>`
      SELECT * FROM route_sessions
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    const cnt = await db.$queryRaw<[{ count: string }]>`
      SELECT COUNT(*)::text AS count FROM route_sessions
    `;
    return { data, total: Number(cnt[0].count) };
  });
}

// ---------------------------------------------------------------------------
// Busca sessão com suas rotas e paradas
// ---------------------------------------------------------------------------
export async function getSessionWithRoutes(
  schemaName: string,
  sessionId: string,
): Promise<{ session: SessionRow; routes: RouteResult[] } | null> {
  return withRoutesSchema(schemaName, async (db) => {
    const sessions = await db.$queryRaw<SessionRow[]>`
      SELECT * FROM route_sessions WHERE id = ${sessionId}::uuid LIMIT 1
    `;
    if (sessions.length === 0) return null;

    const routes = await db.$queryRaw<RouteRow[]>`
      SELECT * FROM routes WHERE session_id = ${sessionId}::uuid ORDER BY name
    `;

    const results: RouteResult[] = [];
    for (const route of routes) {
      const stops = await db.$queryRaw<RouteStopRow[]>`
        SELECT * FROM route_stops
        WHERE route_id = ${route.id}::uuid
        ORDER BY sequence_order
      `;
      results.push(toRouteResult(route, stops));
    }

    return { session: sessions[0], routes: results };
  });
}

// ---------------------------------------------------------------------------
// Salva rotas e paradas otimizadas (apaga e recria para a sessão)
// ---------------------------------------------------------------------------
export async function saveOptimizedRoutes(
  schemaName: string,
  sessionId: string,
  routeResults: Array<{
    name: string;
    vehicleId: string | null;
    driverId: string | null;
    totalDistanceKm: number;
    estimatedDurationMin: number;
    color: string;
    stops: OptimizeStopInput[];
    stopCoords: Array<{ lat: number; lng: number }>;
  }>,
): Promise<RouteResult[]> {
  return withRoutesSchema(schemaName, async (db) => {
    // Limpa rotas anteriores desta sessão
    await db.$executeRaw`
      DELETE FROM route_stops
      WHERE route_id IN (SELECT id FROM routes WHERE session_id = ${sessionId}::uuid)
    `;
    await db.$executeRaw`
      DELETE FROM routes WHERE session_id = ${sessionId}::uuid
    `;

    const saved: RouteResult[] = [];

    for (const r of routeResults) {
      const routeRows = await db.$queryRaw<[{ id: string }]>`
        INSERT INTO routes (session_id, name, vehicle_id, driver_id,
          total_distance_km, estimated_duration_min, color)
        VALUES (
          ${sessionId}::uuid,
          ${r.name},
          ${r.vehicleId ?? null}::uuid,
          ${r.driverId ?? null}::uuid,
          ${r.totalDistanceKm},
          ${r.estimatedDurationMin},
          ${r.color}
        )
        RETURNING id
      `;
      const routeId = routeRows[0].id;
      const savedStops: RouteStopRow[] = [];

      for (let i = 0; i < r.stops.length; i++) {
        const s = r.stops[i];
        const coord = r.stopCoords[i] ?? { lat: s.lat, lng: s.lng };
        const stopRows = await db.$queryRaw<RouteStopRow[]>`
          INSERT INTO route_stops (
            route_id, sequence_order, address, lat, lng,
            time_window_start, time_window_end, service_duration_min,
            weight_kg, volume_m3, required_skill, order_id, notes
          ) VALUES (
            ${routeId}::uuid,
            ${i + 1},
            ${s.address},
            ${coord.lat},
            ${coord.lng},
            ${s.time_window_start ?? null}::time,
            ${s.time_window_end ?? null}::time,
            ${s.service_duration_min ?? 5},
            ${s.weight_kg ?? null},
            ${s.volume_m3 ?? null},
            ${s.required_skill ?? null},
            ${s.order_id ?? null}::uuid,
            ${s.notes ?? null}
          )
          RETURNING *
        `;
        savedStops.push(stopRows[0]);
      }

      saved.push(toRouteResult({
        id: routeId,
        session_id: sessionId,
        name: r.name,
        vehicle_id: r.vehicleId,
        driver_id: r.driverId,
        total_distance_km: String(r.totalDistanceKm),
        estimated_duration_min: r.estimatedDurationMin,
        status: "pending",
        color: r.color,
        created_at: new Date(),
        updated_at: new Date(),
      }, savedStops));
    }

    return saved;
  });
}

// ---------------------------------------------------------------------------
// Atualiza a ordem das paradas de uma rota (drag-and-drop)
// ---------------------------------------------------------------------------
export async function updateStopsOrder(
  schemaName: string,
  routeId: string,
  stopIds: string[], // nova ordem
): Promise<void> {
  await withRoutesSchema(schemaName, async (db) => {
    for (let i = 0; i < stopIds.length; i++) {
      await db.$executeRaw`
        UPDATE route_stops
        SET sequence_order = ${i + 1}
        WHERE id = ${stopIds[i]}::uuid AND route_id = ${routeId}::uuid
      `;
    }
    await db.$executeRaw`
      UPDATE routes SET updated_at = now() WHERE id = ${routeId}::uuid
    `;
  });
}

// ---------------------------------------------------------------------------
// Aprova uma rota
// ---------------------------------------------------------------------------
export async function approveRoute(
  schemaName: string,
  routeId: string,
): Promise<boolean> {
  const rows = await withRoutesSchema(
    schemaName,
    (db) => db.$queryRaw<[{ id: string }]>`
      UPDATE routes SET status = 'approved', updated_at = now()
      WHERE id = ${routeId}::uuid
      RETURNING id
    `,
  );
  return rows.length > 0;
}

// ---------------------------------------------------------------------------
// Envia rotas aprovadas ao despacho (cria dispatch_orders por parada)
// ---------------------------------------------------------------------------
export async function dispatchApprovedRoutes(
  schemaName: string,
  sessionId: string,
): Promise<number> {
  return withRoutesSchema(schemaName, async (db) => {
    const routes = await db.$queryRaw<RouteRow[]>`
      SELECT * FROM routes
      WHERE session_id = ${sessionId}::uuid AND status = 'approved'
    `;

    let created = 0;
    for (const route of routes) {
      const stops = await db.$queryRaw<RouteStopRow[]>`
        SELECT * FROM route_stops
        WHERE route_id = ${route.id}::uuid
        ORDER BY sequence_order
      `;

      for (const stop of stops) {
        if (stop.order_id) continue; // já tem order
        const orderRows = await db.$queryRaw<[{ id: string }]>`
          INSERT INTO dispatch_orders (
            driver_id, vehicle_id,
            destination_address, destination_lat, destination_lng,
            description, status, priority, route_id, route_sequence
          ) VALUES (
            ${route.driver_id ?? null}::uuid,
            ${route.vehicle_id ?? null}::uuid,
            ${stop.address},
            ${stop.lat ?? null},
            ${stop.lng ?? null},
            ${stop.notes ?? null},
            'pending',
            'medium',
            ${route.id}::uuid,
            ${stop.sequence_order}
          )
          RETURNING id
        `;
        const orderId = orderRows[0].id;
        await db.$executeRaw`
          UPDATE route_stops SET order_id = ${orderId}::uuid
          WHERE id = ${stop.id}::uuid
        `;
        created++;
      }

      await db.$executeRaw`
        UPDATE routes SET status = 'dispatched', updated_at = now()
        WHERE id = ${route.id}::uuid
      `;
    }

    await db.$executeRaw`
      UPDATE route_sessions SET status = 'dispatched', updated_at = now()
      WHERE id = ${sessionId}::uuid
    `;

    return created;
  });
}

// ---------------------------------------------------------------------------
// Conta sessões otimizadas/aprovadas do dia (para banner do Despacho)
// ---------------------------------------------------------------------------
export async function countPendingDispatchRoutes(
  schemaName: string,
): Promise<number> {
  const rows = await withRoutesSchema(
    schemaName,
    (db) => db.$queryRaw<[{ count: string }]>`
      SELECT COUNT(*)::text AS count
      FROM routes
      WHERE status = 'approved'
        AND date_trunc('day', created_at) = date_trunc('day', now())
    `,
  );
  return Number(rows[0]?.count ?? 0);
}

// ---------------------------------------------------------------------------
// Lista dispatch_orders com informação de rota (para Despacho)
// ---------------------------------------------------------------------------
export async function listDispatchOrders(
  schemaName: string,
  status?: string,
  routeId?: string,
  limit = 50,
  offset = 0,
): Promise<{ data: unknown[]; total: number }> {
  return withRoutesSchema(schemaName, async (db) => {
    const data = await db.$queryRaw<unknown[]>`
      SELECT
        do2.id, do2.driver_id, do2.vehicle_id,
        do2.origin_address, do2.origin_lat, do2.origin_lng,
        do2.destination_address, do2.destination_lat, do2.destination_lng,
        do2.description, do2.scheduled_at, do2.priority, do2.status,
        do2.route_id, do2.route_sequence, do2.fleetbase_order_id,
        do2.created_at, do2.updated_at,
        r.name AS route_name, r.color AS route_color
      FROM dispatch_orders do2
      LEFT JOIN routes r ON r.id = do2.route_id
      WHERE (${status ?? null}::text IS NULL OR do2.status = ${status ?? null}::text)
        AND (${routeId ?? null}::uuid IS NULL OR do2.route_id = ${routeId ?? null}::uuid)
      ORDER BY do2.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    const cnt = await db.$queryRaw<[{ count: string }]>`
      SELECT COUNT(*)::text AS count FROM dispatch_orders
      WHERE (${status ?? null}::text IS NULL OR status = ${status ?? null}::text)
        AND (${routeId ?? null}::uuid IS NULL OR route_id = ${routeId ?? null}::uuid)
    `;
    return { data, total: Number(cnt[0].count) };
  });
}

// ---------------------------------------------------------------------------
// Rotas do dia (para aba "Rotas do dia" no Despacho)
// ---------------------------------------------------------------------------
export async function listTodayRoutes(
  schemaName: string,
): Promise<RouteResult[]> {
  return withRoutesSchema(schemaName, async (db) => {
    const routes = await db.$queryRaw<RouteRow[]>`
      SELECT r.*
      FROM routes r
      JOIN route_sessions s ON s.id = r.session_id
      WHERE s.operation_date = CURRENT_DATE
      ORDER BY r.name
    `;

    const results: RouteResult[] = [];
    for (const route of routes) {
      const stops = await db.$queryRaw<RouteStopRow[]>`
        SELECT * FROM route_stops
        WHERE route_id = ${route.id}::uuid
        ORDER BY sequence_order
      `;
      results.push(toRouteResult(route, stops));
    }
    return results;
  });
}
