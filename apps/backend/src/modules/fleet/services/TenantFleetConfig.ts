// =============================================================================
// src/modules/fleet/services/TenantFleetConfig.ts
// =============================================================================
// O QUE FAZ:
//   Carrega e armazena as credenciais dos engines de frota por tenant.
//   Isola o acesso ao banco para credenciais — nunca loga nem expõe senhas.
//
// RESPONSABILIDADES:
//   ✅ Buscar credenciais no banco (tabela fleet_tenant_configs)
//   ✅ Cache em memória por sessão para evitar queries repetidas
//   ✅ Salvar/atualizar credenciais de um tenant
//
// NÃO É RESPONSABILIDADE DESTE ARQUIVO:
//   ❌ Fazer chamadas HTTP para os engines (isso é de cada XxxService)
//   ❌ Validar se as credenciais são corretas
// =============================================================================

import { prisma } from "../../../core/database/prisma";

// =============================================================================
// INTERFACE: credenciais de todos os engines para um tenant
// =============================================================================
export interface FleetCredentials {
  traccarUser: string | null;
  traccarPassword: string | null;
  fleetbaseApiKey: string | null;
  fleetmsToken: string | null;
}

// =============================================================================
// INTERFACE: input para salvar/atualizar credenciais
// =============================================================================
export interface SaveFleetCredentialsInput {
  tenantId: string;
  traccarUser?: string | null;
  traccarPassword?: string | null;
  fleetbaseApiKey?: string | null;
  fleetmsToken?: string | null;
}

// =============================================================================
// FUNÇÃO: getFleetCredentials
// =============================================================================
// Carrega as credenciais de um tenant. Retorna null se não configuradas.
// Usa $queryRaw porque a tabela fleet_tenant_configs fica no schema public
// e é gerenciada fora do Prisma schema (migration SQL manual).
// =============================================================================
export async function getFleetCredentials(
  tenantId: string,
): Promise<FleetCredentials | null> {
  // Usamos $queryRawUnsafe para que o cast ::text fique no SQL string
  // executado pelo PostgreSQL — evita o erro "text = uuid" do Prisma 6.
  const rows = await prisma.$queryRawUnsafe<
    Array<{
      traccar_user: string | null;
      traccar_password: string | null;
      fleetbase_api_key: string | null;
      fleetms_token: string | null;
    }>
  >(
    `SELECT traccar_user, traccar_password, fleetbase_api_key, fleetms_token
     FROM public.fleet_tenant_configs
     WHERE tenant_id = $1::text
     LIMIT 1`,
    tenantId,
  );

  if (rows.length === 0) return null;

  const row = rows[0];
  return {
    traccarUser: row.traccar_user,
    traccarPassword: row.traccar_password,
    fleetbaseApiKey: row.fleetbase_api_key,
    fleetmsToken: row.fleetms_token,
  };
}

// =============================================================================
// FUNÇÃO: saveFleetCredentials
// =============================================================================
// Insere ou atualiza as credenciais do tenant (UPSERT por tenant_id).
// =============================================================================
export async function saveFleetCredentials(
  input: SaveFleetCredentialsInput,
): Promise<void> {
  // Usamos $executeRawUnsafe para o mesmo motivo: evitar "text = uuid" do Prisma 6.
  await prisma.$executeRawUnsafe(
    `INSERT INTO public.fleet_tenant_configs
       (tenant_id, traccar_user, traccar_password, fleetbase_api_key, fleetms_token)
     VALUES ($1::text, $2, $3, $4, $5)
     ON CONFLICT (tenant_id) DO UPDATE SET
       traccar_user      = EXCLUDED.traccar_user,
       traccar_password  = EXCLUDED.traccar_password,
       fleetbase_api_key = EXCLUDED.fleetbase_api_key,
       fleetms_token     = EXCLUDED.fleetms_token,
       updated_at        = now()`,
    input.tenantId,
    input.traccarUser ?? null,
    input.traccarPassword ?? null,
    input.fleetbaseApiKey ?? null,
    input.fleetmsToken ?? null,
  );
}
