// =============================================================================
// src/routes/xibo/xiboTenantResolver.service.ts
// =============================================================================
// Resolve qual tenant corresponde ao ?token= comparando com .env por tenant.
// =============================================================================

import { prisma } from "../../core/database/prisma";
import { isValidXiboTokenForTenant } from "./xiboToken.service";

export interface XiboTenantContext {
  id: string;
  schemaName: string;
  slug: string;
}

export async function resolveTenantFromXiboToken(
  token: string | undefined,
): Promise<XiboTenantContext | null> {
  if (!token?.trim()) return null;

  const tenants = await prisma.tenant.findMany({
    where: { isActive: true },
    select: { id: true, schemaName: true, slug: true },
  });

  for (const t of tenants) {
    if (isValidXiboTokenForTenant(t.id, token)) {
      return t;
    }
  }

  return null;
}
