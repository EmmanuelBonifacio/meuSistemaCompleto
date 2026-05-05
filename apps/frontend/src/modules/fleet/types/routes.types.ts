// =============================================================================
// src/modules/fleet/types/routes.types.ts
// =============================================================================
// Tipos TypeScript para o módulo Criar Rotas (frontend).
// =============================================================================

export type OperationType = "delivery" | "transport" | "collection" | "service";
export type RouteEngine = "vroom" | "ortools" | "combined";
export type SessionStatus = "draft" | "optimized" | "approved" | "dispatched";
export type RouteStatus = "pending" | "approved" | "dispatched" | "completed";
export type StopStatus = "pending" | "completed" | "failed" | "skipped";

// ---------------------------------------------------------------------------
// Parada (configuração)
// ---------------------------------------------------------------------------
export interface StopInput {
  id: string;
  address: string;
  lat: number;
  lng: number;
  time_window_start: string | null;
  time_window_end: string | null;
  service_duration_min: number;
  weight_kg: number | null;
  volume_m3: number | null;
  required_skill: string | null;
  notes: string | null;
  order_id: string | null;
}

// ---------------------------------------------------------------------------
// Veículo (configuração)
// ---------------------------------------------------------------------------
export interface VehicleInput {
  id: string;
  plate: string;
  model: string | null;
  capacity_kg: number;
  capacity_m3: number;
  driver_id: string;
  driverName?: string;
  shift_start: string;
  shift_end: string;
}

// ---------------------------------------------------------------------------
// Payload de otimização
// ---------------------------------------------------------------------------
export interface OptimizePayload {
  sessionId: string;
  depotAddress: string;
  depotLat: number;
  depotLng: number;
  vehicles: Array<{
    id: string;
    capacity_kg: number;
    capacity_m3: number;
    driver_id?: string;
    shift_start: string;
    shift_end: string;
  }>;
  stops: Array<{
    id: string;
    address: string;
    lat: number;
    lng: number;
    time_window_start?: string | null;
    time_window_end?: string | null;
    service_duration_min?: number;
    weight_kg?: number | null;
    volume_m3?: number | null;
    required_skill?: string | null;
    notes?: string | null;
    order_id?: string | null;
  }>;
  engine: RouteEngine;
  operationType: OperationType;
  operationDate: string;
}

// ---------------------------------------------------------------------------
// Parada de rota (resultado)
// ---------------------------------------------------------------------------
export interface RouteStop {
  id: string;
  routeId: string;
  sequenceOrder: number;
  address: string;
  lat: number | null;
  lng: number | null;
  timeWindowStart: string | null;
  timeWindowEnd: string | null;
  serviceDurationMin: number;
  weightKg: number | null;
  volumeM3: number | null;
  requiredSkill: string | null;
  status: StopStatus;
  orderId: string | null;
  notes: string | null;
}

// ---------------------------------------------------------------------------
// Rota (resultado)
// ---------------------------------------------------------------------------
export interface Route {
  id: string;
  sessionId: string;
  name: string;
  vehicleId: string | null;
  driverId: string | null;
  totalDistanceKm: number | null;
  estimatedDurationMin: number | null;
  status: RouteStatus;
  color: string;
  stops: RouteStop[];
  geometry?: string;
}

// ---------------------------------------------------------------------------
// Resultado de otimização
// ---------------------------------------------------------------------------
export interface OptimizeResult {
  sessionId: string;
  status: SessionStatus;
  routes: Route[];
  unassignedStops: StopInput[];
  engineUsed: RouteEngine;
}

// ---------------------------------------------------------------------------
// Sessão de rota
// ---------------------------------------------------------------------------
export interface RouteSession {
  id: string;
  operation_type: OperationType;
  operation_date: string;
  depot_address: string;
  depot_lat: string | null;
  depot_lng: string | null;
  engine: RouteEngine;
  status: SessionStatus;
  created_at: string;
  updated_at: string;
}

export interface SessionWithRoutes {
  session: RouteSession;
  routes: Route[];
}

// ---------------------------------------------------------------------------
// Geocodificação
// ---------------------------------------------------------------------------
export interface GeocodeResult {
  lat: number | null;
  lng: number | null;
  address: string;
  city?: string;
  state?: string;
  cep?: string;
  /** ViaCEP ok, mas Nominatim não retornou coordenadas */
  needsManualPin?: boolean;
}

// ---------------------------------------------------------------------------
// Dispatch orders com informação de rota
// ---------------------------------------------------------------------------
export interface DispatchOrderWithRoute {
  id: string;
  driver_id: string | null;
  vehicle_id: string | null;
  origin_address: string;
  destination_address: string;
  destination_lat: number | null;
  destination_lng: number | null;
  description: string | null;
  scheduled_at: string | null;
  priority: "low" | "medium" | "high" | "critical";
  status: "pending" | "assigned" | "dispatched" | "in_transit" | "arrived" | "completed" | "cancelled";
  route_id: string | null;
  route_sequence: number | null;
  route_name: string | null;
  route_color: string | null;
  created_at: string;
  updated_at: string;
}
