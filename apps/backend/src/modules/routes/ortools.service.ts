// =============================================================================
// src/modules/routes/ortools.service.ts
// =============================================================================
// Stub do motor OR-Tools.
// OR-Tools não tem uma imagem Docker standalone oficial com API REST.
// Esta implementação delega para VROOM e registra um aviso no log.
// Em uma fase futura, este módulo pode chamar um microserviço Python dedicado.
// =============================================================================

import {
  OptimizeVehicleInput,
  OptimizeStopInput,
  VroomResponse,
  MatrixResponse,
} from "./routes.types";
import { optimizeWithVroom } from "./vroom.service";

const ORTOOLS_ENABLED = process.env.ORTOOLS_ENABLED === "true";

// ---------------------------------------------------------------------------
// Otimiza com OR-Tools (stub → delega para VROOM)
// ---------------------------------------------------------------------------
export async function optimizeWithOrTools(
  depotLng: number,
  depotLat: number,
  vehicles: OptimizeVehicleInput[],
  stops: OptimizeStopInput[],
  matrix?: MatrixResponse,
): Promise<VroomResponse> {
  if (!ORTOOLS_ENABLED) {
    console.warn(
      "[OR-Tools] ORTOOLS_ENABLED=false — usando VROOM como fallback. " +
      "Para ativar OR-Tools nativo, implemente um microserviço Python separado " +
      "e configure ORTOOLS_ENABLED=true e ORTOOLS_URL no .env.",
    );
  } else {
    console.info(
      "[OR-Tools] Motor OR-Tools selecionado. " +
      "Delegando para VROOM (microserviço Python OR-Tools não configurado).",
    );
  }

  return optimizeWithVroom(depotLng, depotLat, vehicles, stops, matrix);
}

// ---------------------------------------------------------------------------
// Combinado: VROOM gera, OR-Tools refinaria (stub: apenas VROOM)
// ---------------------------------------------------------------------------
export async function optimizeCombined(
  depotLng: number,
  depotLat: number,
  vehicles: OptimizeVehicleInput[],
  stops: OptimizeStopInput[],
  matrix?: MatrixResponse,
): Promise<VroomResponse> {
  console.info("[Combined] Pipeline combinado: usando VROOM (OR-Tools refinement em desenvolvimento).");
  return optimizeWithVroom(depotLng, depotLat, vehicles, stops, matrix);
}
