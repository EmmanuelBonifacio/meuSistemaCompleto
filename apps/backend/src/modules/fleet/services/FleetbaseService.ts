// =============================================================================
// src/modules/fleet/services/FleetbaseService.ts
// =============================================================================
// O QUE FAZ:
//   Camada de comunicação com o Fleetbase (engine de despacho e ordens).
//   Encapsula todas as chamadas à REST API do Fleetbase.
//
// AUTENTICAÇÃO: API Key no header X-Api-Key por tenant
// BASE URL: FLEETBASE_URL (env var, padrão: http://localhost:4200)
//
// REFERÊNCIA DA API: https://docs.fleetbase.io/api
// =============================================================================

// =============================================================================
// INTERFACES: entidades do Fleetbase
// =============================================================================

export interface FleetbaseDriver {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  status: string;
  current_job_id: string | null;
  vehicle_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface FleetbaseOrder {
  id: string;
  public_id: string;
  status: string;
  driver_assigned: FleetbaseDriver | null;
  pickup: {
    address: string;
    lat: number | null;
    lng: number | null;
  };
  dropoff: {
    address: string;
    lat: number | null;
    lng: number | null;
  };
  scheduled_at: string | null;
  dispatched_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface FleetbaseAsset {
  id: string;
  name: string;
  plate_number: string | null;
  status: string;
  driver_assigned: FleetbaseDriver | null;
  created_at: string;
  updated_at: string;
}

// URL base do Fleetbase
const FLEETBASE_URL = process.env.FLEETBASE_URL ?? "http://localhost:4200";

// =============================================================================
// FUNÇÃO AUXILIAR: fleetbaseFetch
// =============================================================================
// Wrapper do fetch com API Key e tratamento de erros padronizado.
// =============================================================================
async function fleetbaseFetch<T>(
  path: string,
  apiKey: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${FLEETBASE_URL}/v1${path}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-Api-Key": apiKey,
      ...(options.headers ?? {}),
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Fleetbase API error [${response.status}] ${path}: ${body}`,
    );
  }

  return response.json() as Promise<T>;
}

// =============================================================================
// CLASSE: FleetbaseService
// =============================================================================
export class FleetbaseService {
  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  // ---------------------------------------------------------------------------
  // MOTORISTAS
  // ---------------------------------------------------------------------------

  async listDrivers(): Promise<FleetbaseDriver[]> {
    return fleetbaseFetch<FleetbaseDriver[]>("/drivers", this.apiKey);
  }

  async getDriver(driverId: string): Promise<FleetbaseDriver> {
    return fleetbaseFetch<FleetbaseDriver>(`/drivers/${driverId}`, this.apiKey);
  }

  async createDriver(data: {
    name: string;
    phone?: string;
    email?: string;
  }): Promise<FleetbaseDriver> {
    return fleetbaseFetch<FleetbaseDriver>("/drivers", this.apiKey, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // ---------------------------------------------------------------------------
  // ORDENS DE DESPACHO
  // ---------------------------------------------------------------------------

  async listOrders(params?: {
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<FleetbaseOrder[]> {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.page) qs.set("page", String(params.page));
    if (params?.limit) qs.set("limit", String(params.limit));
    const query = qs.toString() ? `?${qs.toString()}` : "";
    return fleetbaseFetch<FleetbaseOrder[]>(`/orders${query}`, this.apiKey);
  }

  async getOrder(orderId: string): Promise<FleetbaseOrder> {
    return fleetbaseFetch<FleetbaseOrder>(`/orders/${orderId}`, this.apiKey);
  }

  async createOrder(data: {
    driver_id: string;
    pickup_address: string;
    dropoff_address: string;
    scheduled_at?: string | null;
    notes?: string;
  }): Promise<FleetbaseOrder> {
    return fleetbaseFetch<FleetbaseOrder>("/orders", this.apiKey, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateOrderStatus(
    orderId: string,
    status: string,
  ): Promise<FleetbaseOrder> {
    return fleetbaseFetch<FleetbaseOrder>(`/orders/${orderId}`, this.apiKey, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
  }

  // ---------------------------------------------------------------------------
  // ATIVOS (VEÍCULOS)
  // ---------------------------------------------------------------------------

  async listAssets(): Promise<FleetbaseAsset[]> {
    return fleetbaseFetch<FleetbaseAsset[]>("/assets", this.apiKey);
  }

  async createAsset(data: {
    name: string;
    plate_number?: string;
  }): Promise<FleetbaseAsset> {
    return fleetbaseFetch<FleetbaseAsset>("/assets", this.apiKey, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }
}
