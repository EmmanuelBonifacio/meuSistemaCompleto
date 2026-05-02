// =============================================================================
// src/modules/fleet/services/FleetmsService.ts
// =============================================================================
// O QUE FAZ:
//   Camada de comunicação com o Fleetms (engine de manutenção).
//   Encapsula chamadas à REST API do Fleetms para manutenção de veículos,
//   documentos e controle de combustível.
//
// AUTENTICAÇÃO: Bearer token por tenant
// BASE URL: FLEETMS_URL (env var, padrão: http://localhost:4000)
//
// REFERÊNCIA: https://github.com/jmnda-dev/fleetms
// =============================================================================

// =============================================================================
// INTERFACES: entidades do Fleetms
// =============================================================================

export interface FleetmsVehicle {
  id: string;
  plate: string;
  brand: string | null;
  model: string | null;
  year: number | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface FleetmsMaintenanceRecord {
  id: string;
  vehicle_id: string;
  type: string;
  description: string;
  status: string;
  scheduled_date: string | null;
  completed_date: string | null;
  cost: number | null;
  odometer_km: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface FleetmsFuelRecord {
  id: string;
  vehicle_id: string;
  liters: number;
  cost: number;
  odometer_km: number | null;
  fueled_at: string;
  notes: string | null;
}

// URL base do Fleetms
const FLEETMS_URL = process.env.FLEETMS_URL ?? "http://localhost:4000";

// =============================================================================
// FUNÇÃO AUXILIAR: fleetmsFetch
// =============================================================================
// Wrapper do fetch com Bearer token e tratamento de erros.
// =============================================================================
async function fleetmsFetch<T>(
  path: string,
  token: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${FLEETMS_URL}/api${path}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers ?? {}),
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Fleetms API error [${response.status}] ${path}: ${body}`);
  }

  return response.json() as Promise<T>;
}

// =============================================================================
// CLASSE: FleetmsService
// =============================================================================
export class FleetmsService {
  private readonly token: string;

  constructor(token: string) {
    this.token = token;
  }

  // ---------------------------------------------------------------------------
  // VEÍCULOS
  // ---------------------------------------------------------------------------

  async listVehicles(): Promise<FleetmsVehicle[]> {
    return fleetmsFetch<FleetmsVehicle[]>("/vehicles", this.token);
  }

  async getVehicle(vehicleId: string): Promise<FleetmsVehicle> {
    return fleetmsFetch<FleetmsVehicle>(`/vehicles/${vehicleId}`, this.token);
  }

  async createVehicle(data: {
    plate: string;
    brand?: string;
    model?: string;
    year?: number;
  }): Promise<FleetmsVehicle> {
    return fleetmsFetch<FleetmsVehicle>("/vehicles", this.token, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // ---------------------------------------------------------------------------
  // REGISTROS DE MANUTENÇÃO
  // ---------------------------------------------------------------------------

  async listMaintenanceRecords(
    vehicleId?: string,
  ): Promise<FleetmsMaintenanceRecord[]> {
    const query = vehicleId ? `?vehicle_id=${vehicleId}` : "";
    return fleetmsFetch<FleetmsMaintenanceRecord[]>(
      `/maintenance${query}`,
      this.token,
    );
  }

  async getMaintenanceRecord(
    recordId: string,
  ): Promise<FleetmsMaintenanceRecord> {
    return fleetmsFetch<FleetmsMaintenanceRecord>(
      `/maintenance/${recordId}`,
      this.token,
    );
  }

  async createMaintenanceRecord(data: {
    vehicle_id: string;
    type: string;
    description: string;
    scheduled_date?: string | null;
    cost?: number | null;
    odometer_km?: number | null;
    notes?: string;
  }): Promise<FleetmsMaintenanceRecord> {
    return fleetmsFetch<FleetmsMaintenanceRecord>("/maintenance", this.token, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateMaintenanceRecord(
    recordId: string,
    data: Partial<{
      status: string;
      completed_date: string;
      cost: number;
      notes: string;
    }>,
  ): Promise<FleetmsMaintenanceRecord> {
    return fleetmsFetch<FleetmsMaintenanceRecord>(
      `/maintenance/${recordId}`,
      this.token,
      {
        method: "PATCH",
        body: JSON.stringify(data),
      },
    );
  }

  // ---------------------------------------------------------------------------
  // COMBUSTÍVEL
  // ---------------------------------------------------------------------------

  async listFuelRecords(vehicleId?: string): Promise<FleetmsFuelRecord[]> {
    const query = vehicleId ? `?vehicle_id=${vehicleId}` : "";
    return fleetmsFetch<FleetmsFuelRecord[]>(`/fuel${query}`, this.token);
  }

  async createFuelRecord(data: {
    vehicle_id: string;
    liters: number;
    cost: number;
    odometer_km?: number | null;
    notes?: string;
  }): Promise<FleetmsFuelRecord> {
    return fleetmsFetch<FleetmsFuelRecord>("/fuel", this.token, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }
}
