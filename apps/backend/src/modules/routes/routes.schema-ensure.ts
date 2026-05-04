// =============================================================================
// routes.schema-ensure.ts
// =============================================================================
// DDL idempotente (CREATE IF NOT EXISTS) para tenants criados antes das
// tabelas do módulo Criar Rotas. Nomes de tabela sem prefixo de schema —
// executado com search_path = tenant, public via withTenantSchema.
// =============================================================================

import { withTenantSchema } from "../../core/database/prisma";

const ROUTE_MODULE_DDL: string[] = [
  `CREATE TABLE IF NOT EXISTS dispatch_orders (
      id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      driver_id         UUID,
      vehicle_id        UUID,
      origin_address    TEXT        NOT NULL DEFAULT '',
      origin_lat        DECIMAL(10,7),
      origin_lng        DECIMAL(10,7),
      destination_address TEXT      NOT NULL DEFAULT '',
      destination_lat   DECIMAL(10,7),
      destination_lng   DECIMAL(10,7),
      description       TEXT,
      scheduled_at      TIMESTAMPTZ,
      priority          VARCHAR(20) NOT NULL DEFAULT 'medium'
                        CONSTRAINT dispatch_orders_priority_check
                        CHECK (priority IN ('low','medium','high','critical')),
      status            VARCHAR(20) NOT NULL DEFAULT 'pending'
                        CONSTRAINT dispatch_orders_status_check
                        CHECK (status IN ('pending','assigned','dispatched','in_transit','arrived','completed','cancelled')),
      route_id          UUID,
      route_sequence    INTEGER,
      fleetbase_order_id TEXT,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
    )`,
  `CREATE INDEX IF NOT EXISTS idx_dispatch_orders_status
      ON dispatch_orders (status)`,
  `CREATE INDEX IF NOT EXISTS idx_dispatch_orders_driver_id
      ON dispatch_orders (driver_id)
      WHERE driver_id IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS idx_dispatch_orders_route_id
      ON dispatch_orders (route_id)
      WHERE route_id IS NOT NULL`,

  `CREATE TABLE IF NOT EXISTS route_sessions (
      id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      operation_type   VARCHAR(20) NOT NULL DEFAULT 'delivery'
                       CONSTRAINT route_sessions_operation_type_check
                       CHECK (operation_type IN ('delivery','transport','collection','service')),
      operation_date   DATE        NOT NULL,
      depot_address    TEXT        NOT NULL,
      depot_lat        DECIMAL(10,7),
      depot_lng        DECIMAL(10,7),
      engine           VARCHAR(20) NOT NULL DEFAULT 'vroom'
                       CONSTRAINT route_sessions_engine_check
                       CHECK (engine IN ('vroom','ortools','combined')),
      status           VARCHAR(20) NOT NULL DEFAULT 'draft'
                       CONSTRAINT route_sessions_status_check
                       CHECK (status IN ('draft','optimized','approved','dispatched')),
      created_by       UUID,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
    )`,
  `CREATE INDEX IF NOT EXISTS idx_route_sessions_status
      ON route_sessions (status)`,
  `CREATE INDEX IF NOT EXISTS idx_route_sessions_operation_date
      ON route_sessions (operation_date DESC)`,

  `CREATE TABLE IF NOT EXISTS routes (
      id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id            UUID        NOT NULL,
      name                  VARCHAR(100) NOT NULL,
      vehicle_id            UUID,
      driver_id             UUID,
      total_distance_km     DECIMAL(8,2),
      estimated_duration_min INTEGER,
      status                VARCHAR(20) NOT NULL DEFAULT 'pending'
                            CONSTRAINT routes_status_check
                            CHECK (status IN ('pending','approved','dispatched','completed')),
      color                 VARCHAR(7)  NOT NULL DEFAULT '#185FA5',
      created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
    )`,
  `CREATE INDEX IF NOT EXISTS idx_routes_session_id
      ON routes (session_id)`,
  `CREATE INDEX IF NOT EXISTS idx_routes_status
      ON routes (status)`,

  `CREATE TABLE IF NOT EXISTS route_stops (
      id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      route_id             UUID        NOT NULL,
      sequence_order       INTEGER     NOT NULL,
      address              TEXT        NOT NULL,
      lat                  DECIMAL(10,7),
      lng                  DECIMAL(10,7),
      time_window_start    TIME,
      time_window_end      TIME,
      service_duration_min INTEGER     NOT NULL DEFAULT 5,
      weight_kg            DECIMAL(8,2),
      volume_m3            DECIMAL(8,3),
      required_skill       VARCHAR(100),
      status               VARCHAR(20) NOT NULL DEFAULT 'pending'
                           CONSTRAINT route_stops_status_check
                           CHECK (status IN ('pending','completed','failed','skipped')),
      order_id             UUID,
      notes                TEXT,
      created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
    )`,
  `CREATE INDEX IF NOT EXISTS idx_route_stops_route_id
      ON route_stops (route_id)`,
  `CREATE INDEX IF NOT EXISTS idx_route_stops_sequence
      ON route_stops (route_id, sequence_order)`,
];

const ensuredSchemas = new Set<string>();

/**
 * Garante que dispatch_orders, route_sessions, routes e route_stops existem
 * no schema do tenant. Memorizado por processo após sucesso.
 */
export async function ensureRouteModuleTables(schemaName: string): Promise<void> {
  if (ensuredSchemas.has(schemaName)) return;

  await withTenantSchema(schemaName, async (tx) => {
    for (const sql of ROUTE_MODULE_DDL) {
      await tx.$executeRawUnsafe(sql);
    }
  });

  ensuredSchemas.add(schemaName);
}
