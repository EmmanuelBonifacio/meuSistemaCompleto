import { headers } from "next/headers";
import { decodeJwt, isJwtExpired } from "@/lib/utils";

export type AuthRole = "user" | "admin" | "superadmin";

interface JwtSessionPayload {
  sub: string;
  role: AuthRole;
  tenantId?: string;
  exp?: number;
}

export interface SessionData {
  user: {
    id: string;
    role: AuthRole;
    tenantId?: string;
  };
}

function getBearerToken(authorizationHeader: string | null): string | null {
  if (!authorizationHeader) return null;
  const [scheme, token] = authorizationHeader.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

export async function auth(): Promise<SessionData | null> {
  const requestHeaders = headers();
  const token = getBearerToken(
    requestHeaders.get("authorization") ?? requestHeaders.get("Authorization"),
  );

  if (!token || isJwtExpired(token)) {
    return null;
  }

  const payload = decodeJwt<JwtSessionPayload>(token);
  if (!payload?.sub || !payload?.role) {
    return null;
  }

  return {
    user: {
      id: payload.sub,
      role: payload.role,
      tenantId: payload.tenantId,
    },
  };
}
