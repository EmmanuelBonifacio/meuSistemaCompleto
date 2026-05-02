// =============================================================================
// src/modules/fleet/services/FleetBridgeService.ts
// =============================================================================
// O QUE FAZ:
//   Orquestra os dados de frota combinando:
//   - Banco local do tenant (veículos, motoristas, manutenções)
//   - Traccar (posições GPS em tempo real) — opcional
//   - Fleetbase (ordens de despacho) — opcional
//
// RESPONSABILIDADES:
//   ✅ Instanciar engines externos com as credenciais do tenant (se configuradas)
//   ✅ Combinar dados locais + engines em respostas unificadas
//   ✅ Tratar falha parcial (ex: Traccar offline — retorna dados sem posição)
//
// NÃO É RESPONSABILIDADE DESTE ARQUIVO:
//   ❌ Validar input (isso é dos DTOs/schemas)
//   ❌ Registrar rotas HTTP (isso é do fleet.routes.ts)
// =============================================================================

import { TraccarService, type TraccarPosition } from "./TraccarService";
import { FleetbaseService, type FleetbaseOrder } from "./FleetbaseService";
import { getFleetCredentials } from "./TenantFleetConfig";
import { withTenantSchema } from "../../../core/database/prisma";

// =============================================================================
// INTERFACE: visão consolidada de um veículo (dados locais + engines opcionais)
// =============================================================================
export interface UnifiedVehicleView {
  id: string;
  plate: string;
  brand: string | null;
  model: string | null;
  year: number | null;
  color: string | null;
  status: string;

  position: {
    lat: number;
    lng: number;
    speed: number;
    address: string | null;
    updatedAt: string;
  } | null;

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
// FUNÇÃO AUXILIAR: buildOptionalServices
// =============================================================================
// Tenta carregar credenciais e instanciar engines externos.
// Se não configurados, retorna null — o restante do código trata isso.
// =============================================================================
async function buildOptionalServices(tenantId: string): Promise<{
  traccar: TraccarService | null;
  fleetbase: FleetbaseService | null;
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
  // ---------------------------------------------------------------------------
  async getUnifiedVehicles(): Promise<UnifiedVehicleView[]> {
    const { traccar, fleetbase } = await buildOptionalServices(this.tenantId);

    // Busca veículos e manutenções pendentes do banco local em paralelo
    const [localVehicles, localMaintenances] = await Promise.allSettled([
      withTenantSchema(this.schemaName, async (db) =>
        db.$queryRaw<
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
        `,
      ),
      withTenantSchema(this.schemaName, async (db) =>
        db.$queryRaw<
          Array<{
            id: string;
            vehicle_id: string;
            type: string;
            description: string;
            scheduled_date: Date | null;
          }>
        >`
          SELECT id, vehicle_id, type, description, scheduled_date
          FROM maintenance_records
          WHERE status IN ('scheduled', 'in_progress')
          ORDER BY scheduled_date ASC NULLS LAST
        `,
      ),
    ]);

    if (localVehicles.status === "rejected") {
      throw localVehicles.reason as Error;
    }

    const vehicles = localVehicles.value;

    // Busca posições e ordens dos engines externos em paralelo (tolerante a falhas)
    const [positions, orders] = await Promise.allSettled([
      traccar ? traccar.listPositions() : Promise.resolve([]),
      fleetbase
        ? fleetbase.listOrders({ status: "in_transit" })
        : Promise.resolve([]),
    ]);

    // Indexa posições por traccar_device_id
    const positionMap = new Map<number, TraccarPosition>();
    if (positions.status === "fulfilled") {
      for (const pos of positions.value) {
        positionMap.set(pos.deviceId, pos);
      }
    }

    // Indexa ordens ativas por fleetbase_asset_id
    const orderMap = new Map<string, FleetbaseOrder>();
    if (orders.status === "fulfilled") {
      for (const order of orders.value) {
        orderMap.set(order.id, order);
      }
    }

    // Agrupa alertas de manutenção por vehicle_id (ID local)
    const maintenanceMap = new Map<
      string,
      Array<{ type: string; description: string; scheduledDate: string | null }>
    >();
    if (localMaintenances.status === "fulfilled") {
      for (const rec of localMaintenances.value) {
        const alerts = maintenanceMap.get(rec.vehicle_id) ?? [];
        alerts.push({
          type: rec.type,
          description: rec.description,
          scheduledDate: rec.scheduled_date
            ? rec.scheduled_date.toISOString()
            : null,
        });
        maintenanceMap.set(rec.vehicle_id, alerts);
      }
    }

    return vehicles.map((v) => {
      const position = v.traccar_device_id
        ? (positionMap.get(v.traccar_device_id) ?? null)
        : null;

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
        activeOrder: null,
        maintenanceAlerts: maintenanceMap.get(v.id) ?? [],
      };
    });
  }

  // ---------------------------------------------------------------------------
  // Obter resumo para o dashboard
  // ---------------------------------------------------------------------------
  async getDashboardSummary(): Promise<FleetDashboardSummary> {
    const { fleetbase } = await buildOptionalServices(this.tenantId);

    const [vehicleCounts, maintenanceCounts, orders] =
      await Promise.allSettled([
        withTenantSchema(
          this.schemaName,
          async (db) =>
            db.$queryRaw<Array<{ status: string; count: string }>>`
              SELECT status, COUNT(*)::text AS count
              FROM vehicles
              GROUP BY status
            `,
        ),
        withTenantSchema(
          this.schemaName,
          async (db) =>
            db.$queryRaw<[{ count: string }]>`
              SELECT COUNT(*)::text AS count
              FROM maintenance_records
              WHERE status IN ('scheduled', 'in_progress')
            `,
        ),
        fleetbase
          ? fleetbase.listOrders({ status: "in_transit" })
          : Promise.resolve([]),
      ]);

    const counts =
      vehicleCounts.status === "fulfilled" ? vehicleCounts.value : [];
    const total = counts.reduce((s, r) => s + Number(r.count), 0);
    const active =
      Number(counts.find((r) => r.status === "active")?.count ?? 0);
    const maintenance = Number(
      counts.find((r) => r.status === "maintenance")?.count ?? 0,
    );

    const pendingMaintenances =
      maintenanceCounts.status === "fulfilled"
        ? Number(maintenanceCounts.value[0]?.count ?? 0)
        : 0;

    const activeOrders =
      orders.status === "fulfilled" ? orders.value.length : 0;

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
