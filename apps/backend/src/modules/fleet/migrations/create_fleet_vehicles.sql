-- =============================================================================
-- migrations/create_fleet_vehicles.sql
-- =============================================================================
-- O QUE FAZ:
--   Cria a tabela de veículos dentro do schema do tenant.
--   Serve como cache/mapeamento dos veículos registrados nos 3 engines,
--   unificando os IDs externos para facilitar consultas cruzadas.
--
-- USO (substituir {schema} pelo schemaName do tenant, ex: tenant_acme):
--   psql $DATABASE_URL -c "SET search_path TO {schema}" \
--        -f migrations/create_fleet_vehicles.sql
--
-- OBSERVAÇÃO:
--   O script usa SET search_path para garantir execução no schema correto.
--   Em produção, use a função withTenantSchema do prisma.ts.
-- =============================================================================

-- Tabela de veículos do tenant
-- Sincronizada com os 3 engines via FleetBridgeService
CREATE TABLE IF NOT EXISTS vehicles (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identificador legível (placa)
  plate               VARCHAR(20) NOT NULL,
  brand               VARCHAR(100),
  model               VARCHAR(100),
  year                INTEGER,
  color               VARCHAR(50),

  -- IDs externos nos engines (nullable — preenchido ao sincronizar)
  traccar_device_id   INTEGER,      -- ID do device no Traccar
  fleetbase_asset_id  TEXT,         -- UUID do asset no Fleetbase
  fleetms_vehicle_id  TEXT,         -- ID do veículo no Fleetms

  -- Estado operacional
  status              VARCHAR(30)  NOT NULL DEFAULT 'active',
                      -- active | inactive | maintenance | decommissioned

  -- Controles de auditoria
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice por placa para busca rápida
CREATE INDEX IF NOT EXISTS idx_vehicles_plate ON vehicles(plate);

-- Índice por traccar_device_id para lookups de rastreamento
CREATE INDEX IF NOT EXISTS idx_vehicles_traccar_device_id
  ON vehicles(traccar_device_id)
  WHERE traccar_device_id IS NOT NULL;

-- Trigger de updated_at (reutiliza a função criada na migration de configs)
DROP TRIGGER IF EXISTS trg_vehicles_updated_at ON vehicles;
CREATE TRIGGER trg_vehicles_updated_at
  BEFORE UPDATE ON vehicles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE vehicles IS
  'Cache unificado de veículos do tenant — sincronizado com Traccar, Fleetbase e Fleetms.';
