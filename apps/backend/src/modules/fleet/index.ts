// =============================================================================
// src/modules/fleet/index.ts
// =============================================================================
// O QUE FAZ:
//   Ponto de entrada público do módulo Gestão de Frota.
//   Re-exporta apenas o que outros módulos ou o server.ts precisam.
//
// USO NO server.ts:
//   import { fleetRoutes } from './modules/fleet';
//   await app.register(fleetRoutes, { prefix: '/fleet' });
// =============================================================================

export { fleetRoutes } from "./fleet.routes";
export { FleetBridgeService } from "./services/FleetBridgeService";
export type {
  UnifiedVehicleView,
  FleetDashboardSummary,
} from "./services/FleetBridgeService";
