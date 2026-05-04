// =============================================================================
// src/modules/fleet/services/routes.api.ts
// =============================================================================
// Camada de comunicação com os endpoints do módulo Criar Rotas.
//
// Endpoints do módulo Criar Rotas — prefixo versionado no Fastify.
// baseURL do axios = host (ex.: http://localhost:3000).
//   POST  /api/v1/routes/optimize
//   GET   /api/v1/routes/sessions
//   GET   /api/v1/routes/geocode/cep/:cep
//   …
// =============================================================================

import api from "@/services/api";
import type {
  OptimizePayload,
  OptimizeResult,
  RouteSession,
  SessionWithRoutes,
  GeocodeResult,
  DispatchOrderWithRoute,
  Route,
} from "../types/routes.types";

/** Prefixo canônico do módulo (duplicado em /routes no backend para legado). */
const R = "/api/v1/routes";

// ---------------------------------------------------------------------------
// Otimização de rotas
// ---------------------------------------------------------------------------
export async function optimizeRoutes(payload: OptimizePayload): Promise<OptimizeResult> {
  const res = await api.post<OptimizeResult>(`${R}/optimize`, payload);
  return res.data;
}

// ---------------------------------------------------------------------------
// Sessões
// ---------------------------------------------------------------------------
export async function listSessions(params?: {
  page?: number;
  limit?: number;
}): Promise<{ data: RouteSession[]; total: number; page: number; limit: number; totalPages: number }> {
  const res = await api.get(`${R}/sessions`, { params });
  return res.data;
}

export async function getSession(sessionId: string): Promise<SessionWithRoutes> {
  const res = await api.get<SessionWithRoutes>(`${R}/sessions/${sessionId}`);
  return res.data;
}

export async function dispatchSession(sessionId: string): Promise<{ message: string; ordersCreated: number }> {
  const res = await api.post(`${R}/sessions/${sessionId}/dispatch`);
  return res.data;
}

// ---------------------------------------------------------------------------
// Rotas individuais
// ---------------------------------------------------------------------------
export async function updateStopsOrder(routeId: string, stopIds: string[]): Promise<void> {
  await api.put(`${R}/${routeId}/stops`, { stopIds });
}

export async function approveRoute(routeId: string): Promise<void> {
  await api.put(`${R}/${routeId}/approve`);
}

// ---------------------------------------------------------------------------
// Geocodificação
// ---------------------------------------------------------------------------
export async function geocodeAddress(q: string): Promise<GeocodeResult | null> {
  try {
    const res = await api.get<GeocodeResult>(`${R}/geocode`, { params: { q } });
    return res.data;
  } catch {
    return null;
  }
}

export async function geocodeByCep(cep: string): Promise<GeocodeResult | null> {
  const digits = cep.replace(/\D/g, "");
  if (digits.length !== 8) return null;
  try {
    const res = await api.get<GeocodeResult>(`${R}/geocode/cep/${digits}`);
    return res.data;
  } catch {
    return null;
  }
}

/** POST — logradouro + cidade + UF (Nominatim) */
export async function geocodeStructuredAddress(
  address: string,
  city?: string,
  state?: string,
): Promise<GeocodeResult | null> {
  try {
    const res = await api.post<GeocodeResult>(`${R}/geocode/address`, {
      address,
      city,
      state,
    });
    return res.data;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Dispatch orders (para integração com a tela de Despacho)
// ---------------------------------------------------------------------------
export async function listDispatchOrders(params?: {
  status?: string;
  routeId?: string;
  page?: number;
  limit?: number;
}): Promise<{ data: DispatchOrderWithRoute[]; total: number; totalPages: number }> {
  const res = await api.get(`${R}/dispatch-orders`, { params });
  return res.data;
}

export async function listTodayRoutes(): Promise<{ data: Route[]; total: number }> {
  const res = await api.get(`${R}/dispatch-orders/today-routes`);
  return res.data;
}

export async function getPendingDispatchCount(): Promise<number> {
  const res = await api.get<{ count: number }>(`${R}/dispatch-orders/pending-count`);
  return res.data.count;
}
