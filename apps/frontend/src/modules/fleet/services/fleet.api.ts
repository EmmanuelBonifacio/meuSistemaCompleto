// =============================================================================
// src/modules/fleet/services/fleet.api.ts
// =============================================================================
// O QUE FAZ:
//   Camada de comunicação com todos os endpoints do módulo Gestão de Frota.
//   Usa a instância Axios configurada em api.ts (interceptors de JWT).
//
// MAPEAMENTO DE ROTAS (fleet.routes.ts no backend):
//   GET  /fleet/dashboard           → getDashboard()
//   GET  /fleet/vehicles/unified    → getUnifiedVehicles()
//   POST /fleet/config              → saveEngineConfig()
//   GET/POST/PATCH/DELETE /fleet/vehicles   → vehicles*()
//   GET/POST/PATCH /fleet/drivers          → drivers*()
//   GET/POST/PATCH /fleet/maintenance      → maintenance*()
// =============================================================================

import api from "@/services/api";
import type {
  FleetDashboardSummary,
  UnifiedVehicle,
  Vehicle,
  Driver,
  MaintenanceRecord,
  DispatchOrder,
  PaginatedResponse,
  FleetEngineConfig,
} from "../types/fleet.types";

// =============================================================================
// DASHBOARD
// =============================================================================

/** Retorna o resumo estatístico do módulo de frota. */
export async function getDashboard(): Promise<FleetDashboardSummary> {
  const response = await api.get<FleetDashboardSummary>("/fleet/dashboard");
  return response.data;
}

/** Retorna veículos com dados combinados dos 3 engines (posição + ordens + alertas). */
export async function getUnifiedVehicles(): Promise<
  PaginatedResponse<UnifiedVehicle>
> {
  const response = await api.get<PaginatedResponse<UnifiedVehicle>>(
    "/fleet/vehicles/unified",
  );
  return response.data;
}

/** Salva as credenciais dos engines para o tenant atual. */
export async function saveEngineConfig(
  config: FleetEngineConfig,
): Promise<void> {
  await api.post("/fleet/config", config);
}

// =============================================================================
// VEÍCULOS
// =============================================================================

/** Lista veículos com paginação e filtros. */
export async function listVehicles(params?: {
  status?: string;
  busca?: string;
  page?: number;
  limit?: number;
}): Promise<PaginatedResponse<Vehicle>> {
  const response = await api.get<PaginatedResponse<Vehicle>>(
    "/fleet/vehicles",
    { params },
  );
  return response.data;
}

/** Busca um veículo pelo ID. */
export async function getVehicle(id: string): Promise<Vehicle> {
  const response = await api.get<Vehicle>(`/fleet/vehicles/${id}`);
  return response.data;
}

/** Cria um novo veículo. */
export async function createVehicle(
  data: Omit<Vehicle, "id" | "created_at" | "updated_at">,
): Promise<Vehicle> {
  const response = await api.post<Vehicle>("/fleet/vehicles", data);
  return response.data;
}

/** Atualiza parcialmente um veículo. */
export async function updateVehicle(
  id: string,
  data: Partial<Omit<Vehicle, "id" | "plate" | "created_at" | "updated_at">>,
): Promise<void> {
  await api.patch(`/fleet/vehicles/${id}`, data);
}

/** Desativa um veículo (soft delete). */
export async function deleteVehicle(id: string): Promise<void> {
  await api.delete(`/fleet/vehicles/${id}`);
}

// =============================================================================
// MOTORISTAS
// =============================================================================

/** Lista motoristas. */
export async function listDrivers(params?: {
  status?: string;
  busca?: string;
  page?: number;
  limit?: number;
}): Promise<PaginatedResponse<Driver>> {
  const response = await api.get<PaginatedResponse<Driver>>("/fleet/drivers", {
    params,
  });
  return response.data;
}

/** Busca um motorista pelo ID. */
export async function getDriver(id: string): Promise<Driver> {
  const response = await api.get<Driver>(`/fleet/drivers/${id}`);
  return response.data;
}

/** Cria um novo motorista. */
export async function createDriver(data: {
  name: string;
  phone?: string;
  email?: string | null;
  status?: string;
}): Promise<Driver> {
  const response = await api.post<Driver>("/fleet/drivers", data);
  return response.data;
}

// =============================================================================
// MANUTENÇÃO
// =============================================================================

/** Lista registros de manutenção. */
export async function listMaintenance(params?: {
  vehicle_id?: string;
  status?: string;
  type?: string;
  page?: number;
  limit?: number;
}): Promise<PaginatedResponse<MaintenanceRecord>> {
  const response = await api.get<PaginatedResponse<MaintenanceRecord>>(
    "/fleet/maintenance",
    { params },
  );
  return response.data;
}

/** Busca um registro de manutenção pelo ID. */
export async function getMaintenance(id: string): Promise<MaintenanceRecord> {
  const response = await api.get<MaintenanceRecord>(`/fleet/maintenance/${id}`);
  return response.data;
}

/** Cria um novo registro de manutenção. */
export async function createMaintenance(data: {
  vehicle_id: string;
  type: string;
  description: string;
  scheduled_date?: string | null;
  cost?: number | null;
  odometer_km?: number | null;
  notes?: string;
}): Promise<MaintenanceRecord> {
  const response = await api.post<MaintenanceRecord>(
    "/fleet/maintenance",
    data,
  );
  return response.data;
}

/** Atualiza status de um registro de manutenção. */
export async function updateMaintenance(
  id: string,
  data: Partial<{
    status: string;
    completed_date: string;
    cost: number;
    notes: string;
  }>,
): Promise<MaintenanceRecord> {
  const response = await api.patch<MaintenanceRecord>(
    `/fleet/maintenance/${id}`,
    data,
  );
  return response.data;
}

/** Atualiza parcialmente um motorista. */
export async function updateDriver(
  id: string,
  data: Partial<{
    name: string;
    cpf: string;
    cnh: string;
    cnh_category: string;
    cnh_expiry: string | null;
    phone: string;
    email: string | null;
    status: string;
    vehicle_id: string | null;
  }>,
): Promise<Driver> {
  const response = await api.patch<Driver>(`/fleet/drivers/${id}`, data);
  return response.data;
}

// Exportação padrão vazia para compatibilidade com barrels de módulo
export type { DispatchOrder };
