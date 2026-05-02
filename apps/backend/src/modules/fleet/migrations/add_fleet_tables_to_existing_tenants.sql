-- =============================================================================
-- add_fleet_tables_to_existing_tenants.sql
-- =============================================================================
-- Cria as tabelas do módulo de frota em TODOS os schemas de tenant existentes.
-- Execute uma vez para tenants já provisionados antes da adição do módulo.
-- Idempotente: usa CREATE TABLE IF NOT EXISTS.
-- =============================================================================

DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN SELECT schema_name FROM public.tenants LOOP

    -- vehicles
    EXECUTE format('
      CREATE TABLE IF NOT EXISTS %I.vehicles (
        id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        plate               VARCHAR(20) NOT NULL,
        brand               VARCHAR(100),
        model               VARCHAR(100),
        year                INTEGER,
        color               VARCHAR(50),
        traccar_device_id   INTEGER,
        fleetbase_asset_id  TEXT,
        fleetms_vehicle_id  TEXT,
        status              VARCHAR(30) NOT NULL DEFAULT ''active''
                            CONSTRAINT vehicles_status_check
                            CHECK (status IN (''active'',''inactive'',''maintenance'',''decommissioned'')),
        created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
      )', rec.schema_name);

    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_vehicles_plate
      ON %I.vehicles (plate)', rec.schema_name);

    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_vehicles_status
      ON %I.vehicles (status)', rec.schema_name);

    -- drivers
    EXECUTE format('
      CREATE TABLE IF NOT EXISTS %I.drivers (
        id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        name                VARCHAR(255) NOT NULL,
        cpf                 VARCHAR(20),
        cnh                 VARCHAR(30),
        cnh_category        VARCHAR(5),
        cnh_expiry          DATE,
        phone               VARCHAR(20),
        email               VARCHAR(255),
        status              VARCHAR(20) NOT NULL DEFAULT ''active''
                            CONSTRAINT drivers_status_check
                            CHECK (status IN (''active'',''inactive'',''on_leave'')),
        current_job_id      UUID,
        vehicle_id          UUID,
        fleetbase_driver_id TEXT,
        created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
      )', rec.schema_name);

    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_drivers_status
      ON %I.drivers (status)', rec.schema_name);

    -- maintenance_records
    EXECUTE format('
      CREATE TABLE IF NOT EXISTS %I.maintenance_records (
        id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        vehicle_id        UUID        NOT NULL,
        type              VARCHAR(30) NOT NULL DEFAULT ''preventive''
                          CONSTRAINT maintenance_records_type_check
                          CHECK (type IN (''preventive'',''corrective'',''inspection'',''fuel'',''document'')),
        description       TEXT        NOT NULL,
        status            VARCHAR(30) NOT NULL DEFAULT ''scheduled''
                          CONSTRAINT maintenance_records_status_check
                          CHECK (status IN (''scheduled'',''in_progress'',''completed'',''cancelled'')),
        scheduled_date    TIMESTAMPTZ,
        completed_date    TIMESTAMPTZ,
        cost              DECIMAL(10,2),
        odometer_km       INTEGER,
        fleetms_record_id TEXT,
        notes             TEXT,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
      )', rec.schema_name);

    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_maintenance_records_vehicle_id
      ON %I.maintenance_records (vehicle_id)', rec.schema_name);

    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_maintenance_records_status
      ON %I.maintenance_records (status)', rec.schema_name);

    RAISE NOTICE 'Fleet tables created/verified for schema: %', rec.schema_name;

  END LOOP;
END;
$$;
