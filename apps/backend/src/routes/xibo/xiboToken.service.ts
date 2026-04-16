// =============================================================================
// src/routes/xibo/xiboToken.service.ts
// =============================================================================
// Token estático por tenant para integração Xibo (DataSet remoto).
// Variável de ambiente: XIBO_API_TOKEN_<UUID_COM_UNDERSCORES_UPPERCASE>
// Ex.: tenant id 550e8400-e29b-41d4-a716-446655440000
//      → XIBO_API_TOKEN_550E8400_E29B_41D4_A716_446655440000
// =============================================================================

import crypto from "crypto";

export function xiboTokenEnvVarName(tenantId: string): string {
  const normalized = tenantId.replace(/-/g, "_").toUpperCase();
  return `XIBO_API_TOKEN_${normalized}`;
}

export function readXiboTokenFromEnv(tenantId: string): string | undefined {
  const raw = process.env[xiboTokenEnvVarName(tenantId)];
  const v = raw?.trim();
  return v || undefined;
}

/**
 * Comparação em tempo constante para evitar timing attacks.
 */
export function isValidXiboTokenForTenant(
  tenantId: string,
  token: string | undefined,
): boolean {
  if (!token) return false;
  const expected = readXiboTokenFromEnv(tenantId);
  if (!expected) return false;
  const a = Buffer.from(token, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
