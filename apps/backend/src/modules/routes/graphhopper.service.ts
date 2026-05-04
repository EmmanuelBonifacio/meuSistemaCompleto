// =============================================================================
// src/modules/routes/graphhopper.service.ts
// =============================================================================
// Wrapper da API do GraphHopper local (http://localhost:8989).
// Fornece matriz de tempo/distância e geocodificação via OpenStreetMap.
//
// O GraphHopper open source (imagem Docker local) normalmente NÃO expõe POST /matrix
// (404). A API Matrix paga (GraphHopper Directions) sim. Aqui: tentamos /matrix;
// se 404, montamos a matriz N×N com chamadas GET /route (simétrica).
// =============================================================================

import {
  GeocodingResult,
  MatrixResponse,
} from "./routes.types";

const GH_URL = process.env.GRAPHHOPPER_URL ?? "http://localhost:8989";

const ROUTE_MATRIX_CONCURRENCY = Math.max(
  1,
  Math.min(8, Number(process.env.GRAPHHOPPER_ROUTE_MATRIX_CONCURRENCY) || 6),
);

// ---------------------------------------------------------------------------
// Verifica se o GraphHopper está disponível
// ---------------------------------------------------------------------------
export async function isGraphHopperAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${GH_URL}/health`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Geocodificação: endereço → lat/lng usando a Geocoding API do GraphHopper
// ---------------------------------------------------------------------------
export async function geocodeAddress(address: string): Promise<GeocodingResult | null> {
  try {
    const params = new URLSearchParams({
      q: address,
      limit: "1",
      locale: "pt-BR",
    });
    const res = await fetch(`${GH_URL}/geocode?${params}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const json = await res.json() as { hits?: Array<{ point?: { lat: number; lng: number }; name?: string }> };
    const hit = json?.hits?.[0];
    if (!hit?.point) return null;
    return {
      lat: hit.point.lat,
      lng: hit.point.lng,
      address: hit.name ?? address,
    };
  } catch (err) {
    console.error("[GraphHopper] Geocoding error:", err);
    return null;
  }
}

async function fetchRouteMetrics(
  fromLng: number,
  fromLat: number,
  toLng: number,
  toLat: number,
  profile: string,
): Promise<{ time: number; distance: number }> {
  const params = new URLSearchParams({
    point: `${fromLat},${fromLng}`,
    profile,
    locale: "pt-BR",
    calc_points: "false",
    type: "json",
  });
  params.append("point", `${toLat},${toLng}`);

  const res = await fetch(`${GH_URL}/route?${params}`, {
    signal: AbortSignal.timeout(25_000),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`[GraphHopper] /route ${res.status}: ${body.slice(0, 500)}`);
  }
  const json = await res.json() as { paths?: Array<{ time: number; distance: number }> };
  const p0 = json?.paths?.[0];
  if (p0 == null) {
    throw new Error("[GraphHopper] /route sem paths — impossível montar matriz.");
  }
  return { time: Math.round(p0.time / 1000), distance: Math.round(p0.distance) };
}

/** Matriz simétrica via /route (GraphHopper OSS). */
async function getDistanceMatrixViaRoutes(
  points: Array<[number, number]>,
  profile: string,
): Promise<MatrixResponse> {
  const n = points.length;
  const times: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  const distances: number[][] = Array.from({ length: n }, () => Array(n).fill(0));

  type Pair = { i: number; j: number };
  const pairs: Pair[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) pairs.push({ i, j });
  }

  let cursor = 0;
  async function worker(): Promise<void> {
    for (;;) {
      const k = cursor++;
      if (k >= pairs.length) return;
      const { i, j } = pairs[k];
      const [li, la] = points[i];
      const [lj, ja] = points[j];
      const m = await fetchRouteMetrics(li, la, lj, ja, profile);
      times[i][j] = m.time;
      times[j][i] = m.time;
      distances[i][j] = m.distance;
      distances[j][i] = m.distance;
    }
  }

  const workers = Math.min(ROUTE_MATRIX_CONCURRENCY, Math.max(1, pairs.length));
  await Promise.all(Array.from({ length: workers }, () => worker()));

  return { times, distances, weights: times };
}

// ---------------------------------------------------------------------------
// Matriz de tempo e distância entre N pontos
// Retorna matriz NxN de seconds e meters.
// ---------------------------------------------------------------------------
export async function getDistanceMatrix(
  points: Array<[number, number]>, // [lng, lat]
  profile = "car",
): Promise<MatrixResponse> {
  if (points.length < 2) {
    throw new Error("A matriz requer pelo menos 2 pontos.");
  }

  const payload = {
    from_points: points,
    to_points: points,
    profile,
    out_arrays: ["times", "distances", "weights"],
    fail_fast: false,
  };

  let res: Response;
  try {
    res = await fetch(`${GH_URL}/matrix`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (err) {
    throw new Error(`[GraphHopper] Falha na conexão: ${String(err)}`);
  }

  if (res.status === 404) {
    return getDistanceMatrixViaRoutes(points, profile);
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`[GraphHopper] Matrix API retornou ${res.status}: ${body}`);
  }

  const json = await res.json() as { times?: number[][]; distances?: number[][]; weights?: number[][] };

  if (!json.times || !json.distances) {
    throw new Error("[GraphHopper] Resposta da Matrix API incompleta.");
  }

  return {
    times: json.times,
    distances: json.distances,
    weights: json.weights ?? json.times,
  };
}

// ---------------------------------------------------------------------------
// Calcula a rota entre dois pontos e retorna a polyline encoded
// ---------------------------------------------------------------------------
export async function getRouteGeometry(
  fromLng: number,
  fromLat: number,
  toLng: number,
  toLat: number,
  profile = "car",
): Promise<string | null> {
  try {
    const params = new URLSearchParams({
      point: `${fromLat},${fromLng}`,
      profile,
      locale: "pt-BR",
      calc_points: "true",
      type: "json",
    });
    params.append("point", `${toLat},${toLng}`);

    const res = await fetch(`${GH_URL}/route?${params}`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const json = await res.json() as { paths?: Array<{ points?: string }> };
    return json?.paths?.[0]?.points ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Converte "HH:MM" → segundos desde meia-noite (para janelas de tempo VROOM)
// ---------------------------------------------------------------------------
export function timeStringToSeconds(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h ?? 0) * 3600 + (m ?? 0) * 60;
}
