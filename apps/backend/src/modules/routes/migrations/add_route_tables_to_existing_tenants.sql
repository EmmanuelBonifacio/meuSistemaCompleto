-- =============================================================================
-- Migration: add_route_tables_to_existing_tenants.sql
-- =============================================================================
-- Adiciona as tabelas dispatch_orders, route_sessions, routes e route_stops
-- a todos os schemas de tenants existentes no banco.
--
-- COMO RODAR (uma única vez):
--   psql -U saas_user -d saas_multitenant_db -f add_route_tables_to_existing_tenants.sql
--
-- Ou via psql interativo:
--   \i /caminho/para/add_route_tables_to_existing_tenants.sql
-- =============================================================================

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT schema_name FROM public.tenants LOOP
    -- dispatch_orders
    EXECUTE format('
      CREATE TABLE IF NOT EXISTS %I.dispatch_orders (
        id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        driver_id         UUID,
        vehicle_id        UUID,
        origin_address    TEXT        NOT NULL DEFAULT '''',
        origin_lat        DECIMAL(10,7),
        origin_lng        DECIMAL(10,7),
        destination_address TEXT      NOT NULL DEFAULT '''',
        destination_lat   DECIMAL(10,7),
        destination_lng   DECIMAL(10,7),
        description       TEXT,
        scheduled_at      TIMESTAMPTZ,
        priority          VARCHAR(20) NOT NULL DEFAULT ''medium''
                          CHECK (priority IN (''low'',''medium'',''high'',''critical'')),
        status            VARCHAR(20) NOT NULL DEFAULT ''pending''
                          CHECK (status IN (''pending'',''assigned'',''dispatched'',''in_transit'',''arrived'',''completed'',''cancelled'')),
        route_id          UUID,
        route_sequence    INTEGER,
        fleetbase_order_id TEXT,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
      )', r.schema_name);

    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_dispatch_orders_status ON %I.dispatch_orders (status)', r.schema_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_dispatch_orders_route_id ON %I.dispatch_orders (route_id) WHERE route_id IS NOT NULL', r.schema_name);

    -- route_sessions
    EXECUTE format('
      CREATE TABLE IF NOT EXISTS %I.route_sessions (
        id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        operation_type   VARCHAR(20) NOT NULL DEFAULT ''delivery''
                         CHECK (operation_type IN (''delivery'',''transport'',''collection'',''service'')),
        operation_date   DATE        NOT NULL,
        depot_address    TEXT        NOT NULL,
        depot_lat        DECIMAL(10,7),
        depot_lng        DECIMAL(10,7),
        engine           VARCHAR(20) NOT NULL DEFAULT ''vroom''
                         CHECK (engine IN (''vroom'',''ortools'',''combined'')),
        status           VARCHAR(20) NOT NULL DEFAULT ''draft''
                         CHECK (status IN (''draft'',''optimized'',''approved'',''dispatched'')),
        created_by       UUID,
        created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
      )', r.schema_name);

    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_route_sessions_status ON %I.route_sessions (status)', r.schema_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_route_sessions_date ON %I.route_sessions (operation_date DESC)', r.schema_name);

    -- routes
    EXECUTE format('
      CREATE TABLE IF NOT EXISTS %I.routes (
        id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id            UUID        NOT NULL,
        name                  VARCHAR(100) NOT NULL,
        vehicle_id            UUID,
        driver_id             UUID,
        total_distance_km     DECIMAL(8,2),
        estimated_duration_min INTEGER,
        status                VARCHAR(20) NOT NULL DEFAULT ''pending''
                              CHECK (status IN (''pending'',''approved'',''dispatched'',''completed'')),
        color                 VARCHAR(7)  NOT NULL DEFAULT ''#185FA5'',
        created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
      )', r.schema_name);

    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_routes_session_id ON %I.routes (session_id)', r.schema_name);

    -- route_stops
    EXECUTE format('
      CREATE TABLE IF NOT EXISTS %I.route_stops (
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
        status               VARCHAR(20) NOT NULL DEFAULT ''pending''
                             CHECK (status IN (''pending'',''completed'',''failed'',''skipped'')),
        order_id             UUID,
        notes                TEXT,
        created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
      )', r.schema_name);

    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_route_stops_route_id ON %I.route_stops (route_id)', r.schema_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_route_stops_seq ON %I.route_stops (route_id, sequence_order)', r.schema_name);

    RAISE NOTICE 'Tables created for schema: %', r.schema_name;
  END LOOP;
END;
$$;
