-- =============================================================================
-- migrations/create_fleet_tenant_configs.sql
-- =============================================================================
-- O QUE FAZ:
--   Cria a tabela que armazena as credenciais de cada engine de frota
--   por tenant. Executar no schema PUBLIC (credenciais são globais).
--
-- SEGURANÇA:
--   Senhas e tokens são armazenados em colunas TEXT — em produção considere
--   criptografar com pgcrypto ou armazenar em um secret manager.
--
-- USO:
--   psql $DATABASE_URL -f migrations/create_fleet_tenant_configs.sql
-- =============================================================================

-- Tabela: fleet_tenant_configs
-- Uma linha por tenant contendo as credenciais dos 3 engines.
CREATE TABLE IF NOT EXISTS public.fleet_tenant_configs (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             TEXT        NOT NULL UNIQUE
                          REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Credenciais Traccar (Basic Auth)
  traccar_user          TEXT,
  traccar_password      TEXT,

  -- Credenciais Fleetbase (API Key)
  fleetbase_api_key     TEXT,

  -- Credenciais Fleetms (Bearer token)
  fleetms_token         TEXT,

  -- Controles de auditoria
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice para busca rápida por tenant_id (já coberto pelo UNIQUE, mas explícito)
CREATE INDEX IF NOT EXISTS idx_fleet_tenant_configs_tenant_id
  ON public.fleet_tenant_configs(tenant_id);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fleet_tenant_configs_updated_at
  ON public.fleet_tenant_configs;

CREATE TRIGGER trg_fleet_tenant_configs_updated_at
  BEFORE UPDATE ON public.fleet_tenant_configs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.fleet_tenant_configs IS
  'Credenciais por tenant para os engines do módulo Gestão de Frota.';
