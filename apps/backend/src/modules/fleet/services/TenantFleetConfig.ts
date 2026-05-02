// =============================================================================
// src/modules/fleet/services/TenantFleetConfig.ts
// =============================================================================
// O QUE FAZ:
//   Carrega e armazena as credenciais dos engines de frota por tenant.
//   Isola o acesso ao banco para credenciais — nunca loga nem expõe senhas.
//
// RESPONSABILIDADES:
//   ✅ Buscar credenciais no banco (tabela fleet_tenant_configs via Prisma)
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
// Usa o modelo Prisma FleetTenantConfig (tabela fleet_tenant_configs).
// =============================================================================
export async function getFleetCredentials(
  tenantId: string,
): Promise<FleetCredentials | null> {
  const config = await prisma.fleetTenantConfig.findUnique({
    where: { tenantId },
    select: {
      traccarUser: true,
      traccarPassword: true,
      fleetbaseApiKey: true,
      fleetmsToken: true,
    },
  });

  if (!config) return null;

  return {
    traccarUser: config.traccarUser,
    traccarPassword: config.traccarPassword,
    fleetbaseApiKey: config.fleetbaseApiKey,
    fleetmsToken: config.fleetmsToken,
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
  const payload = {
    traccarUser: input.traccarUser ?? null,
    traccarPassword: input.traccarPassword ?? null,
    fleetbaseApiKey: input.fleetbaseApiKey ?? null,
    fleetmsToken: input.fleetmsToken ?? null,
  };

  await prisma.fleetTenantConfig.upsert({
    where: { tenantId: input.tenantId },
    create: {
      tenantId: input.tenantId,
      ...payload,
    },
    update: payload,
  });
}
