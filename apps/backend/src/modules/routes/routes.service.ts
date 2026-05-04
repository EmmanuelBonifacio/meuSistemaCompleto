// =============================================================================
// src/modules/routes/routes.service.ts
// =============================================================================
// Orquestra o pipeline de otimização:
//   1. Geocodifica depósito e paradas sem coordenadas
//   2. Monta lista de pontos para a matriz GraphHopper
//   3. Chama VROOM / OR-Tools / Combinado
//   4. Mapeia resultado VROOM → RouteResult
//   5. Salva no banco via routes.repository
// =============================================================================

import { geocodeAddress } from "./graphhopper.service";
import { optimizeWithVroom } from "./vroom.service";
import { optimizeWithOrTools, optimizeCombined } from "./ortools.service";
import * as repo from "./routes.repository";
import {
  OptimizePayload,
  OptimizeResult,
  OptimizeStopInput,
  RouteResult,
  VroomResponse,
} from "./routes.types";

// Paleta de cores para as rotas (até 10 rotas)
const ROUTE_COLORS = [
  "#185FA5", "#2D9E6B", "#E05E3A", "#8E44AD", "#F39C12",
  "#16A085", "#C0392B", "#2C3E50", "#1ABC9C", "#E74C3C",
];

// ---------------------------------------------------------------------------
// Geocodifica paradas sem lat/lng
// ---------------------------------------------------------------------------
async function ensureCoords(
  stops: OptimizeStopInput[],
  depotLat: number,
  depotLng: number,
): Promise<OptimizeStopInput[]> {
  const result: OptimizeStopInput[] = [];
  for (const s of stops) {
    if (s.lat && s.lng) {
      result.push(s);
      continue;
    }
    const geo = await geocodeAddress(s.address);
    result.push({
      ...s,
      lat: geo?.lat ?? depotLat,
      lng: geo?.lng ?? depotLng,
    });
  }
  return result;
}

// ---------------------------------------------------------------------------
// Converte resultado VROOM em array de dados para salvar
// ---------------------------------------------------------------------------
function mapVroomResult(
  vroomRes: VroomResponse,
  vehicles: OptimizePayload["vehicles"],
  stops: OptimizeStopInput[],
  depotLat: number,
  depotLng: number,
) {
  const stopById = new Map(stops.map((s) => [s.id, s]));

  const routeData = vroomRes.routes.map((vRoute, idx) => {
    const vehicle = vehicles[vRoute.vehicle];
    const routeStops: OptimizeStopInput[] = [];
    const stopCoords: Array<{ lat: number; lng: number }> = [];

    for (const step of vRoute.steps) {
      if (step.type === "job" && step.id !== undefined) {
        const originalStop = stops[step.id];
        if (originalStop) {
          routeStops.push(originalStop);
          stopCoords.push({ lat: originalStop.lat, lng: originalStop.lng });
        }
      }
    }

    const distKm = Math.round((vRoute.distance / 1000) * 100) / 100;
    const durationMin = Math.round(vRoute.duration / 60);

    return {
      name: `Rota ${String.fromCharCode(65 + idx)}`,
      vehicleId: vehicle?.id ?? null,
      driverId: vehicle?.driver_id ?? null,
      totalDistanceKm: distKm,
      estimatedDurationMin: durationMin,
      color: ROUTE_COLORS[idx % ROUTE_COLORS.length],
      stops: routeStops,
      stopCoords,
    };
  });

  const assignedStopIds = new Set(
    vroomRes.routes.flatMap((r) =>
      r.steps.filter((s) => s.type === "job" && s.id !== undefined).map((s) => stops[s.id!]?.id),
    ),
  );
  const unassigned = stops.filter((s) => !assignedStopIds.has(s.id));

  return { routeData, unassigned };
}

// ---------------------------------------------------------------------------
// Pipeline principal: otimiza e persiste
// ---------------------------------------------------------------------------
export async function optimizeRoutes(
  schemaName: string,
  tenantId: string,
  payload: OptimizePayload,
  userId?: string,
): Promise<OptimizeResult> {
  // 1. Garantir coordenadas
  const stopsWithCoords = await ensureCoords(
    payload.stops,
    payload.depotLat,
    payload.depotLng,
  );

  // 2. Criar sessão (se não existir)
  let sessionId = payload.sessionId;
  if (!sessionId || sessionId === "new") {
    sessionId = await repo.createSession(schemaName, {
      operationType: payload.operationType,
      operationDate: payload.operationDate,
      depotAddress: payload.depotAddress,
      depotLat: payload.depotLat,
      depotLng: payload.depotLng,
      engine: payload.engine,
      createdBy: userId ?? null,
    });
  }

  // 3. Chamar o motor de otimização
  let vroomRes: VroomResponse;
  switch (payload.engine) {
    case "ortools":
      vroomRes = await optimizeWithOrTools(
        payload.depotLng, payload.depotLat,
        payload.vehicles, stopsWithCoords,
      );
      break;
    case "combined":
      vroomRes = await optimizeCombined(
        payload.depotLng, payload.depotLat,
        payload.vehicles, stopsWithCoords,
      );
      break;
    default:
      vroomRes = await optimizeWithVroom(
        payload.depotLng, payload.depotLat,
        payload.vehicles, stopsWithCoords,
      );
  }

  // 4. Mapear resultado
  const { routeData, unassigned } = mapVroomResult(
    vroomRes, payload.vehicles, stopsWithCoords,
    payload.depotLat, payload.depotLng,
  );

  // 5. Salvar no banco
  const savedRoutes: RouteResult[] = await repo.saveOptimizedRoutes(
    schemaName, sessionId, routeData,
  );

  // 6. Atualizar status da sessão
  await repo.updateSessionStatus(schemaName, sessionId, "optimized");

  return {
    sessionId,
    status: "optimized",
    routes: savedRoutes,
    unassignedStops: unassigned,
    engineUsed: payload.engine,
  };
}
