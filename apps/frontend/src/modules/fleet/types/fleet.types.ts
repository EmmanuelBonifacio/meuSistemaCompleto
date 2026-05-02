// =============================================================================
// src/modules/fleet/types/fleet.types.ts
// =============================================================================
// O QUE FAZ:
//   Interfaces TypeScript do módulo Gestão de Frota.
//   Espelham as entidades retornadas pela API do backend.
//
// COMO USAR:
//   import type { Vehicle, Driver, MaintenanceRecord } from '@/modules/fleet/types/fleet.types'
// =============================================================================

// =============================================================================
// VEÍCULOS
// =============================================================================

export type VehicleStatus =
  | "active"
  | "inactive"
  | "maintenance"
  | "decommissioned";

export interface Vehicle {
  id: string;
  plate: string;
  brand: string | null;
  model: string | null;
  year: number | null;
  color: string | null;
  status: VehicleStatus;
  traccar_device_id: number | null;
  fleetbase_asset_id: string | null;
  fleetms_vehicle_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface VehiclePosition {
  lat: number;
  lng: number;
  speed: number; // km/h
  address: string | null;
  updatedAt: string;
}

export interface UnifiedVehicle extends Vehicle {
  driverName?: string | null;
  position: VehiclePosition | null;
  activeOrder: {
    id: string;
    status: string;
    destination: string;
  } | null;
  maintenanceAlerts: Array<{
    type: string;
    description: string;
    scheduledDate: string | null;
  }>;
}

// Resposta do endpoint GET /fleet/vehicles/unified
// (não é paginada — retorna todos os veículos com dados dos engines)
export interface UnifiedVehiclesResponse {
  data: UnifiedVehicle[];
  total: number;
}

// =============================================================================
// MOTORISTAS
// =============================================================================

export type DriverStatus = "active" | "inactive" | "on_leave";

export interface Driver {
  id: string;
  name: string;
  cpf: string | null;
  cnh: string | null;
  cnh_category: string | null;
  cnh_expiry: string | null;
  phone: string | null;
  email: string | null;
  status: DriverStatus;
  current_job_id: string | null;
  vehicle_id: string | null;
  fleetbase_driver_id: string | null;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// MANUTENÇÃO
// =============================================================================

export type MaintenanceType =
  | "preventive"
  | "corrective"
  | "inspection"
  | "fuel"
  | "document";

export type MaintenanceStatus =
  | "scheduled"
  | "in_progress"
  | "completed"
  | "cancelled";

export interface MaintenanceRecord {
  id: string;
  vehicle_id: string;
  type: MaintenanceType;
  description: string;
  status: MaintenanceStatus;
  scheduled_date: string | null;
  completed_date: string | null;
  cost: number | null;
  odometer_km: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// DESPACHO
// =============================================================================

export type DispatchStatus =
  | "pending"
  | "assigned"
  | "dispatched"
  | "in_transit"
  | "arrived"
  | "completed"
  | "cancelled";

export type DispatchPriority = "low" | "medium" | "high" | "critical";

export interface DispatchOrder {
  id: string;
  driver_id: string;
  vehicle_id: string;
  origin_address: string;
  origin_lat: number | null;
  origin_lng: number | null;
  destination_address: string;
  destination_lat: number | null;
  destination_lng: number | null;
  description: string | null;
  scheduled_at: string | null;
  priority: DispatchPriority;
  status: DispatchStatus;
  fleetbase_order_id: string | null;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// DASHBOARD
// =============================================================================

export interface FleetDashboardSummary {
  totalVehicles: number;
  activeVehicles: number;
  vehiclesOnRoute: number;
  vehiclesInMaintenance: number;
  pendingMaintenances: number;
  activeOrders: number;
}

// =============================================================================
// RESPOSTAS PAGINADAS
// =============================================================================

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// =============================================================================
// CONFIGURAÇÃO DOS ENGINES
// =============================================================================

export interface FleetEngineConfig {
  traccarUser?: string;
  traccarPassword?: string;
  fleetbaseApiKey?: string;
  fleetmsToken?: string;
}
