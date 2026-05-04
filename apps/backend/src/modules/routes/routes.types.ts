// =============================================================================
// src/modules/routes/routes.types.ts
// =============================================================================
// Tipos compartilhados do módulo Criar Rotas.
// =============================================================================

export type OperationType = "delivery" | "transport" | "collection" | "service";
export type RouteEngine = "vroom" | "ortools" | "combined";
export type SessionStatus = "draft" | "optimized" | "approved" | "dispatched";
export type RouteStatus = "pending" | "approved" | "dispatched" | "completed";
export type StopStatus = "pending" | "completed" | "failed" | "skipped";

// ---------------------------------------------------------------------------
// GraphHopper
// ---------------------------------------------------------------------------

export interface GeocodingResult {
  lat: number;
  lng: number;
  address: string;
}

export interface MatrixRequest {
  points: Array<[number, number]>; // [lng, lat]
  profile: string;
  out_arrays: string[];
}

export interface MatrixResponse {
  times: number[][];        // seconds
  distances: number[][];    // meters
  weights: number[][];
}

// ---------------------------------------------------------------------------
// VROOM
// ---------------------------------------------------------------------------

export interface VroomVehicle {
  id: number;
  profile?: string;
  start?: [number, number];
  end?: [number, number];
  start_index?: number;
  end_index?: number;
  capacity?: number[];
  time_window?: [number, number];
  description?: string;
}

export interface VroomJob {
  id: number;
  location?: [number, number];
  location_index?: number;
  service?: number;
  delivery?: number[];
  time_windows?: Array<[number, number]>;
  description?: string;
}

export interface VroomRequest {
  vehicles: VroomVehicle[];
  jobs: VroomJob[];
  matrices?: Record<
    string,
    { durations: number[][]; distances?: number[][] }
  >;
  options?: {
    g?: boolean;
  };
}

export interface VroomStep {
  type: string;
  location: [number, number];
  id?: number;
  arrival: number;
  duration: number;
  distance?: number;
}

export interface VroomRoute {
  vehicle: number;
  cost: number;
  steps: VroomStep[];
  duration: number;
  distance: number;
  geometry?: string;
}

export interface VroomResponse {
  code: number;
  error?: string;
  routes: VroomRoute[];
  unassigned: VroomJob[];
  summary: {
    cost: number;
    routes: number;
    unassigned: number;
    duration: number;
    distance: number;
  };
}

// ---------------------------------------------------------------------------
// Domain: Optimize request/response
// ---------------------------------------------------------------------------

export interface OptimizeVehicleInput {
  id: string;
  capacity_kg: number;
  capacity_m3: number;
  driver_id?: string;
  shift_start: string; // "08:00"
  shift_end: string;   // "18:00"
}

export interface OptimizeStopInput {
  id: string;
  address: string;
  lat: number;
  lng: number;
  time_window_start?: string | null;
  time_window_end?: string | null;
  service_duration_min?: number;
  weight_kg?: number;
  volume_m3?: number;
  required_skill?: string | null;
  notes?: string | null;
  order_id?: string | null;
}

export interface OptimizePayload {
  sessionId: string;
  depotAddress: string;
  depotLat: number;
  depotLng: number;
  vehicles: OptimizeVehicleInput[];
  stops: OptimizeStopInput[];
  engine: RouteEngine;
  operationType: OperationType;
  operationDate: string;
}

export interface RouteResult {
  id: string;
  sessionId: string;
  name: string;
  vehicleId: string | null;
  driverId: string | null;
  totalDistanceKm: number;
  estimatedDurationMin: number;
  status: RouteStatus;
  color: string;
  stops: RouteStopResult[];
  geometry?: string;
}

export interface RouteStopResult {
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

export interface OptimizeResult {
  sessionId: string;
  status: SessionStatus;
  routes: RouteResult[];
  unassignedStops: OptimizeStopInput[];
  engineUsed: RouteEngine;
}

// ---------------------------------------------------------------------------
// DB row types (raw SQL results)
// ---------------------------------------------------------------------------

export interface SessionRow {
  id: string;
  operation_type: OperationType;
  operation_date: Date;
  depot_address: string;
  depot_lat: string | null;
  depot_lng: string | null;
  engine: RouteEngine;
  status: SessionStatus;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface RouteRow {
  id: string;
  session_id: string;
  name: string;
  vehicle_id: string | null;
  driver_id: string | null;
  total_distance_km: string | null;
  estimated_duration_min: number | null;
  status: RouteStatus;
  color: string;
  created_at: Date;
  updated_at: Date;
}

export interface RouteStopRow {
  id: string;
  route_id: string;
  sequence_order: number;
  address: string;
  lat: string | null;
  lng: string | null;
  time_window_start: string | null;
  time_window_end: string | null;
  service_duration_min: number;
  weight_kg: string | null;
  volume_m3: string | null;
  required_skill: string | null;
  status: StopStatus;
  order_id: string | null;
  notes: string | null;
  created_at: Date;
}
