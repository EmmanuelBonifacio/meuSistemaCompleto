// =============================================================================
// src/modules/tv/tvLimitService.ts
// =============================================================================
// Limites de TVs por tenant a partir de tenant_tv_plan (schema do tenant).
// =============================================================================

import { prisma, withTenantSchema } from "../../core/database/prisma";

export interface TvLimitResult {
  maxClientTvs: number;
  maxPlatformTvs: number;
  total: number;
}

const FALLBACK: TvLimitResult = {
  maxClientTvs: 5,
  maxPlatformTvs: 0,
  total: 5,
};

/**
 * Lê o plano de TVs do tenant. Sem tenant ou sem linha em tenant_tv_plan,
 * devolve o fallback equivalente ao comportamento histórico (5 TVs cliente).
 */
export async function getTvLimit(tenantId: string): Promise<TvLimitResult> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { schemaName: true },
  });

  if (!tenant) {
    return FALLBACK;
  }

  return withTenantSchema(tenant.schemaName, async (tx) => {
    const rows = await tx.$queryRawUnsafe<
      {
        max_client_tvs: number;
        platform_reserved_tv_count: number | null;
      }[]
    >(
      `SELECT max_client_tvs, platform_reserved_tv_count
       FROM tenant_tv_plan
       LIMIT 1`,
    );

    const row = rows[0];
    if (!row) {
      return FALLBACK;
    }

    const maxClientTvs = row.max_client_tvs;
    const maxPlatformTvs = row.platform_reserved_tv_count ?? 0;

    return {
      maxClientTvs,
      maxPlatformTvs,
      total: maxClientTvs + maxPlatformTvs,
    };
  });
}
