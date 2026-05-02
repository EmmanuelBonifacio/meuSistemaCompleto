// =============================================================================
// src/modules/fleet/index.ts
// =============================================================================
// O QUE FAZ:
//   Ponto de entrada público do módulo Fleet no frontend.
//   Re-exporta páginas, componentes e hooks para uso no roteador do Next.js.
// =============================================================================

// Páginas
export { FleetDashboard } from "./pages/FleetDashboard";
export { VehiclesPage } from "./pages/VehiclesPage";
export { DriversPage } from "./pages/DriversPage";
export { DispatchPage } from "./pages/DispatchPage";
export { MaintenancePage } from "./pages/MaintenancePage";

// Componentes
export { FleetMap } from "./components/FleetMap";
export { VehicleCard } from "./components/VehicleCard";
export { DriverCard } from "./components/DriverCard";
export { MaintenanceAlert } from "./components/MaintenanceAlert";
export { DispatchBoard } from "./components/DispatchBoard";

// Hooks
export { useFleetData } from "./hooks/useFleetData";
export { useVehicleTracking } from "./hooks/useVehicleTracking";
export { useDispatch } from "./hooks/useDispatch";

// Tipos
export type * from "./types/fleet.types";
