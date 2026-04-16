import { describe, it, expect, afterEach } from "vitest";
import {
  xiboTokenEnvVarName,
  readXiboTokenFromEnv,
  isValidXiboTokenForTenant,
} from "./xiboToken.service";

describe("xiboToken.service", () => {
  const tenantId = "550e8400-e29b-41d4-a716-446655440000";

  afterEach(() => {
    delete process.env[xiboTokenEnvVarName(tenantId)];
  });

  it("xiboTokenEnvVarName usa UUID em maiúsculas com underscores", () => {
    expect(xiboTokenEnvVarName(tenantId)).toBe(
      "XIBO_API_TOKEN_550E8400_E29B_41D4_A716_446655440000",
    );
  });

  it("readXiboTokenFromEnv lê variável configurada", () => {
    const key = xiboTokenEnvVarName(tenantId);
    process.env[key] = "  segredo-xibo  ";
    expect(readXiboTokenFromEnv(tenantId)).toBe("segredo-xibo");
  });

  it("isValidXiboTokenForTenant aceita token igual ao .env", () => {
    process.env[xiboTokenEnvVarName(tenantId)] = "abc123";
    expect(isValidXiboTokenForTenant(tenantId, "abc123")).toBe(true);
    expect(isValidXiboTokenForTenant(tenantId, "abc124")).toBe(false);
    expect(isValidXiboTokenForTenant(tenantId, undefined)).toBe(false);
  });

  it("isValidXiboTokenForTenant retorna false sem env", () => {
    expect(isValidXiboTokenForTenant(tenantId, "qualquer")).toBe(false);
  });
});
