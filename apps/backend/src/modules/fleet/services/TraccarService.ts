// =============================================================================
// src/modules/fleet/services/TraccarService.ts
// =============================================================================
// O QUE FAZ:
//   Camada de comunicação com o Traccar (engine de rastreamento GPS).
//   Encapsula todas as chamadas à REST API do Traccar para o backend.
//
// AUTENTICAÇÃO: Basic Auth (usuário/senha por tenant)
// BASE URL: TRACCAR_URL (env var, padrão: http://localhost:8082)
//
// REFERÊNCIA DA API: https://www.traccar.org/api-reference/
// =============================================================================

// =============================================================================
// INTERFACE: posição atual de um dispositivo
// =============================================================================
export interface TraccarPosition {
  id: number;
  deviceId: number;
  serverTime: string;
  deviceTime: string;
  fixTime: string;
  outdated: boolean;
  valid: boolean;
  latitude: number;
  longitude: number;
  altitude: number;
  speed: number; // knots
  course: number;
  address: string | null;
  accuracy: number;
  attributes: Record<string, unknown>;
}

// =============================================================================
// INTERFACE: dispositivo registrado no Traccar
// =============================================================================
export interface TraccarDevice {
  id: number;
  name: string;
  uniqueId: string; // identificador único (placa, IMEI, etc.)
  status: string; // online | offline | unknown
  lastUpdate: string;
  groupId: number | null;
  attributes: Record<string, unknown>;
}

// =============================================================================
// INTERFACE: credenciais para autenticação no Traccar
// =============================================================================
interface TraccarCredentials {
  user: string;
  password: string;
}

// URL base do Traccar (injetada via env para permitir troca sem recompilar)
const TRACCAR_URL = process.env.TRACCAR_URL ?? "http://localhost:8082";

// =============================================================================
// FUNÇÃO AUXILIAR: buildBasicAuthHeader
// =============================================================================
// Gera o header Authorization: Basic <base64(user:password)>
// =============================================================================
function buildBasicAuthHeader(user: string, password: string): string {
  const encoded = Buffer.from(`${user}:${password}`).toString("base64");
  return `Basic ${encoded}`;
}

// =============================================================================
// FUNÇÃO AUXILIAR: traccarFetch
// =============================================================================
// Wrapper do fetch nativo com autenticação Basic Auth e tratamento de erros.
// =============================================================================
async function traccarFetch<T>(
  path: string,
  credentials: TraccarCredentials,
  options: RequestInit = {},
): Promise<T> {
  const url = `${TRACCAR_URL}/api${path}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: buildBasicAuthHeader(
        credentials.user,
        credentials.password,
      ),
      ...(options.headers ?? {}),
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Traccar API error [${response.status}] ${path}: ${body}`);
  }

  return response.json() as Promise<T>;
}

// =============================================================================
// CLASSE: TraccarService
// =============================================================================
export class TraccarService {
  private readonly credentials: TraccarCredentials;

  constructor(credentials: TraccarCredentials) {
    this.credentials = credentials;
  }

  // ---------------------------------------------------------------------------
  // Listar todos os dispositivos do tenant
  // GET /api/devices
  // ---------------------------------------------------------------------------
  async listDevices(): Promise<TraccarDevice[]> {
    return traccarFetch<TraccarDevice[]>("/devices", this.credentials);
  }

  // ---------------------------------------------------------------------------
  // Buscar um dispositivo pelo ID
  // GET /api/devices?id={id}
  // ---------------------------------------------------------------------------
  async getDevice(deviceId: number): Promise<TraccarDevice | null> {
    const devices = await traccarFetch<TraccarDevice[]>(
      `/devices?id=${deviceId}`,
      this.credentials,
    );
    return devices[0] ?? null;
  }

  // ---------------------------------------------------------------------------
  // Criar dispositivo (registrar novo veículo para rastreamento)
  // POST /api/devices
  // ---------------------------------------------------------------------------
  async createDevice(name: string, uniqueId: string): Promise<TraccarDevice> {
    return traccarFetch<TraccarDevice>("/devices", this.credentials, {
      method: "POST",
      body: JSON.stringify({ name, uniqueId }),
    });
  }

  // ---------------------------------------------------------------------------
  // Listar posições atuais de todos os dispositivos
  // GET /api/positions
  // ---------------------------------------------------------------------------
  async listPositions(): Promise<TraccarPosition[]> {
    return traccarFetch<TraccarPosition[]>("/positions", this.credentials);
  }

  // ---------------------------------------------------------------------------
  // Buscar posição atual de um dispositivo específico
  // GET /api/positions?deviceId={id}
  // ---------------------------------------------------------------------------
  async getDevicePosition(deviceId: number): Promise<TraccarPosition | null> {
    const positions = await traccarFetch<TraccarPosition[]>(
      `/positions?deviceId=${deviceId}`,
      this.credentials,
    );
    return positions[0] ?? null;
  }

  // ---------------------------------------------------------------------------
  // Histórico de posições de um dispositivo em um intervalo de tempo
  // GET /api/positions?deviceId={id}&from={from}&to={to}
  // ---------------------------------------------------------------------------
  async getPositionHistory(
    deviceId: number,
    from: string, // ISO 8601
    to: string, // ISO 8601
  ): Promise<TraccarPosition[]> {
    const params = new URLSearchParams({
      deviceId: String(deviceId),
      from,
      to,
    });
    return traccarFetch<TraccarPosition[]>(
      `/positions?${params.toString()}`,
      this.credentials,
    );
  }
}
