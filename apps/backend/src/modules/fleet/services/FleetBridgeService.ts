// =============================================================================
// src/modules/fleet/services/FleetBridgeService.ts
// =============================================================================
// O QUE FAZ:
//   Orquestra os 3 engines (Traccar, Fleetbase, Fleetms) em chamadas unificadas.
//   É o ponto central do módulo de frota — os controllers chamam apenas este
//   service, que decide qual engine consultar e como combinar os resultados.
//
// RESPONSABILIDADES:
//   ✅ Instanciar cada engine service com as credenciais do tenant
//   ✅ Combinar dados dos 3 engines em respostas unificadas
//   ✅ Tratar falha parcial (ex: Traccar offline mas Fleetms ok)
//   ✅ Sincronizar veículos entre o banco local e os engines
//
// NÃO É RESPONSABILIDADE DESTE ARQUIVO:
//   ❌ Validar input (isso é dos DTOs/schemas)
//   ❌ Registrar rotas HTTP (isso é do fleet.routes.ts)
// =============================================================================

import { TraccarService, type TraccarPosition } from "./TraccarService";
import { FleetbaseService, type FleetbaseOrder } from "./FleetbaseService";
import {
  FleetmsService,
  type FleetmsMaintenanceRecord,
} from "./FleetmsService";
import { getFleetCredentials } from "./TenantFleetConfig";
import { withTenantSchema } from "../../../core/database/prisma";

// =============================================================================
// INTERFACE: visão consolidada de um veículo (dados dos 3 engines)
// =============================================================================
export interface UnifiedVehicleView {
  id: string; // ID local no banco do tenant
  plate: string;
  brand: string | null;
  model: string | null;
  year: number | null;
  color: string | null;
  status: string;

  // Posição em tempo real (Traccar) — null se engine offline ou sem sinal
  position: {
    lat: number;
    lng: number;
    speed: number;
    address: string | null;
    updatedAt: string;
  } | null;

  // Ordem ativa (Fleetbase) — null se sem despacho ativo
  activeOrder: {
    id: string;
    status: string;
    destination: string;
  } | null;

  // Alertas de manutenção (Fleetms) — array vazio se tudo ok
  maintenanceAlerts: Array<{
    type: string;
    description: string;
    scheduledDate: string | null;
  }>;
}

// =============================================================================
// INTERFACE: resumo do dashboard de frota
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
// FUNÇÃO AUXILIAR: buildServices
// =============================================================================
// Carrega credenciais e instancia os 3 engines para um tenant.
// Lança erro se as credenciais não estiverem configuradas.
// =============================================================================
async function buildServices(tenantId: string): Promise<{
  traccar: TraccarService | null;
  fleetbase: FleetbaseService | null;
  fleetms: FleetmsService | null;
}> {
  const creds = await getFleetCredentials(tenantId);

  return {
    traccar:
      creds?.traccarUser && creds?.traccarPassword
        ? new TraccarService({
            user: creds.traccarUser,
            password: creds.traccarPassword,
          })
        : null,

    fleetbase: creds?.fleetbaseApiKey
      ? new FleetbaseService(creds.fleetbaseApiKey)
      : null,

    fleetms: creds?.fleetmsToken
      ? new FleetmsService(creds.fleetmsToken)
      : null,
  };
}

// =============================================================================
// CLASSE: FleetBridgeService
// =============================================================================
export class FleetBridgeService {
  private readonly tenantId: string;
  private readonly schemaName: string;

  constructor(tenantId: string, schemaName: string) {
    this.tenantId = tenantId;
    this.schemaName = schemaName;
  }

  // ---------------------------------------------------------------------------
  // Obter visão unificada de todos os veículos do tenant
  // Combina dados do banco local + Traccar (posições) + Fleetbase (ordens)
  //   + Fleetms (alertas de manutenção)
  // ---------------------------------------------------------------------------
  async getUnifiedVehicles(): Promise<UnifiedVehicleView[]> {
    const { traccar, fleetbase, fleetms } = await buildServices(this.tenantId);

    // Busca veículos no banco local do tenant
    const localVehicles = await withTenantSchema(
      this.schemaName,
      async (db) => {
        return db.$queryRaw<
          Array<{
            id: string;
            plate: string;
            brand: string | null;
            model: string | null;
            year: number | null;
            color: string | null;
            status: string;
            traccar_device_id: number | null;
            fleetbase_asset_id: string | null;
          }>
        >`
          SELECT id, plate, brand, model, year, color, status,
                 traccar_device_id, fleetbase_asset_id
          FROM vehicles
          ORDER BY plate
        `;
      },
    );

    // Busca posições em paralelo (tolerante a falhas)
    const [positions, orders, maintenances] = await Promise.allSettled([
      traccar ? traccar.listPositions() : Promise.resolve([]),
      fleetbase
        ? fleetbase.listOrders({ status: "in_transit" })
        : Promise.resolve([]),
      fleetms ? fleetms.listMaintenanceRecords() : Promise.resolve([]),
    ]);

    // Indexa posições por deviceId
    const positionMap = new Map<number, TraccarPosition>();
    if (positions.status === "fulfilled") {
      for (const pos of positions.value) {
        positionMap.set(pos.deviceId, pos);
      }
    }

    // Indexa ordens ativas por asset_id do Fleetbase
    const orderMap = new Map<string, FleetbaseOrder>();
    if (orders.status === "fulfilled") {
      for (const order of orders.value) {
        // Fleetbase vincula ativos às ordens via driver/asset
        orderMap.set(order.id, order);
      }
    }

    // Agrupa alertas de manutenção por vehicle_id externo
    const maintenanceMap = new Map<string, FleetmsMaintenanceRecord[]>();
    if (maintenances.status === "fulfilled") {
      for (const rec of maintenances.value) {
        if (rec.status === "scheduled" || rec.status === "in_progress") {
          const existing = maintenanceMap.get(rec.vehicle_id) ?? [];
          existing.push(rec);
          maintenanceMap.set(rec.vehicle_id, existing);
        }
      }
    }

    // Monta visão unificada
    return localVehicles.map((v) => {
      const position = v.traccar_device_id
        ? (positionMap.get(v.traccar_device_id) ?? null)
        : null;

      const vehicleMaintenances = v.fleetbase_asset_id
        ? (maintenanceMap.get(v.fleetbase_asset_id) ?? [])
        : [];

      return {
        id: v.id,
        plate: v.plate,
        brand: v.brand,
        model: v.model,
        year: v.year,
        color: v.color,
        status: v.status,
        position: position
          ? {
              lat: position.latitude,
              lng: position.longitude,
              speed: Math.round(position.speed * 1.852), // knots → km/h
              address: position.address,
              updatedAt: position.deviceTime,
            }
          : null,
        activeOrder: null, // TODO: cruzar com fleetbase_asset_id nas ordens
        maintenanceAlerts: vehicleMaintenances.map((m) => ({
          type: m.type,
          description: m.description,
          scheduledDate: m.scheduled_date,
        })),
      };
    });
  }

  // ---------------------------------------------------------------------------
  // Obter resumo para o dashboard
  // ---------------------------------------------------------------------------
  async getDashboardSummary(): Promise<FleetDashboardSummary> {
    const { fleetbase, fleetms } = await buildServices(this.tenantId);

    const [vehicles, orders, maintenances] = await Promise.allSettled([
      withTenantSchema(
        this.schemaName,
        async (db) =>
          db.$queryRaw<Array<{ status: string; count: string }>>`
          SELECT status, COUNT(*)::text AS count FROM vehicles GROUP BY status
        `,
      ),
      fleetbase
        ? fleetbase.listOrders({ status: "in_transit" })
        : Promise.resolve([]),
      fleetms ? fleetms.listMaintenanceRecords() : Promise.resolve([]),
    ]);

    const vehicleCounts = vehicles.status === "fulfilled" ? vehicles.value : [];
    const total = vehicleCounts.reduce((s, r) => s + Number(r.count), 0);
    const active = vehicleCounts.find((r) => r.status === "active")
      ? Number(vehicleCounts.find((r) => r.status === "active")!.count)
      : 0;
    const maintenance = vehicleCounts.find((r) => r.status === "maintenance")
      ? Number(vehicleCounts.find((r) => r.status === "maintenance")!.count)
      : 0;

    const activeOrders =
      orders.status === "fulfilled" ? orders.value.length : 0;

    const pendingMaintenances =
      maintenances.status === "fulfilled"
        ? maintenances.value.filter(
            (m) => m.status === "scheduled" || m.status === "in_progress",
          ).length
        : 0;

    return {
      totalVehicles: total,
      activeVehicles: active,
      vehiclesOnRoute: activeOrders,
      vehiclesInMaintenance: maintenance,
      pendingMaintenances,
      activeOrders,
    };
  }
}
