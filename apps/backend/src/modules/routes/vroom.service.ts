// =============================================================================
// src/modules/routes/vroom.service.ts
// =============================================================================
// Wrapper da API VROOM (VROOM_URL, ex.: http://localhost:3002).
//
// IMPORTANTE: a imagem Docker oficial configura router OSRM em 0.0.0.0:5000,
// mas este projeto usa GraphHopper (8989), que não fala o protocolo OSRM.
// Enviar `options.g: true` ou depender do router interno quebra com code 3.
//
// Solução: matriz durations/distances via GraphHopper (POST /matrix se existir;
// senão /route par a par no OSS) + location_index nos jobs e start/end_index.
// =============================================================================

import {
  VroomRequest,
  VroomResponse,
  VroomVehicle,
  VroomJob,
  OptimizeVehicleInput,
  OptimizeStopInput,
  MatrixResponse,
} from "./routes.types";
import { getDistanceMatrix, timeStringToSeconds } from "./graphhopper.service";

const VROOM_URL = process.env.VROOM_URL ?? "http://localhost:3002";

const ROUTING_PROFILE = "car";

function matrixToUIntGrid(times: number[][], distances: number[][]): {
  durations: number[][];
  distances: number[][];
} {
  const durations = times.map((row) =>
    row.map((t) => Math.max(0, Math.round(Number(t)))),
  );
  const dists = distances.map((row) =>
    row.map((d) => Math.max(0, Math.round(Number(d)))),
  );
  return { durations: durations, distances: dists };
}

// ---------------------------------------------------------------------------
export async function isVroomAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${VROOM_URL}/health`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
export async function optimizeWithVroom(
  depotLng: number,
  depotLat: number,
  vehicles: OptimizeVehicleInput[],
  stops: OptimizeStopInput[],
  precomputedMatrix?: MatrixResponse,
): Promise<VroomResponse> {
  // Índice 0 = depósito; 1..n = paradas na mesma ordem dos jobs (id 0..n-1)
  const ghPoints: Array<[number, number]> = [[depotLng, depotLat]];
  for (const s of stops) {
    ghPoints.push([s.lng, s.lat]);
  }

  const matrix =
    precomputedMatrix ?? (await getDistanceMatrix(ghPoints, ROUTING_PROFILE));
  const { durations, distances } = matrixToUIntGrid(matrix.times, matrix.distances);

  const vroomVehicles: VroomVehicle[] = vehicles.map((v, idx) => {
    const vehicle: VroomVehicle = {
      id: idx,
      profile: ROUTING_PROFILE,
      start_index: 0,
      end_index: 0,
      start: [depotLng, depotLat],
      end: [depotLng, depotLat],
      description: v.id,
    };

    if (v.capacity_kg > 0 || v.capacity_m3 > 0) {
      vehicle.capacity = [
        Math.round(v.capacity_kg * 10),
        Math.round(v.capacity_m3 * 1000),
      ];
    }

    const startSec = timeStringToSeconds(v.shift_start);
    const endSec = timeStringToSeconds(v.shift_end);
    if (startSec < endSec) {
      vehicle.time_window = [startSec, endSec];
    }

    return vehicle;
  });

  const vroomJobs: VroomJob[] = stops.map((s, idx) => {
    const job: VroomJob = {
      id: idx,
      location_index: idx + 1,
      location: [s.lng, s.lat],
      service: (s.service_duration_min ?? 5) * 60,
      description: s.id,
    };

    if (s.weight_kg || s.volume_m3) {
      job.delivery = [
        Math.round((s.weight_kg ?? 0) * 10),
        Math.round((s.volume_m3 ?? 0) * 1000),
      ];
    }

    if (s.time_window_start && s.time_window_end) {
      job.time_windows = [[
        timeStringToSeconds(s.time_window_start),
        timeStringToSeconds(s.time_window_end),
      ]];
    }

    return job;
  });

  const payload: VroomRequest = {
    vehicles: vroomVehicles,
    jobs: vroomJobs,
    matrices: {
      [ROUTING_PROFILE]: {
        durations,
        distances,
      },
    },
  };

  let res: Response;
  try {
    res = await fetch(VROOM_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(60_000),
    });
  } catch (err) {
    throw new Error(`[VROOM] Falha na conexão: ${String(err)}`);
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`[VROOM] API retornou ${res.status}: ${body}`);
  }

  const result = await res.json() as VroomResponse;

  if (result.code !== 0) {
    throw new Error(`[VROOM] Erro na otimização: ${result.error ?? "desconhecido"}`);
  }

  return result;
}
