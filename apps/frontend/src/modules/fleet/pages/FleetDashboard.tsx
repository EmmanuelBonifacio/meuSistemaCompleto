// =============================================================================
// src/modules/fleet/pages/FleetDashboard.tsx
// =============================================================================

"use client";

import {
  Truck,
  Users,
  Navigation,
  Wrench,
  AlertTriangle,
  RefreshCw,
  CheckCircle,
  Clock,
  Flame,
  TrendingUp,
  Activity,
  FileText,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { useFleetData } from "../hooks/useFleetData";
import { useVehicleTracking } from "../hooks/useVehicleTracking";
import { FleetMap } from "../components/FleetMap";
import type { MaintenanceRecord } from "../types/fleet.types";

// =============================================================================
// HELPERS
// =============================================================================
function formatDateShort(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(iso));
}

function isOverdueMaint(record: MaintenanceRecord): boolean {
  if (!record.scheduled_date) return false;
  return (
    new Date(record.scheduled_date) < new Date() &&
    record.status !== "completed" &&
    record.status !== "cancelled"
  );
}

// =============================================================================
// SUBCOMPONENTE: KpiCard
// =============================================================================
function KpiCard({
  label,
  value,
  icon: Icon,
  bgIcon,
  textIcon,
  isLoading,
  sub,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  bgIcon: string;
  textIcon: string;
  isLoading: boolean;
  sub?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500">{label}</span>
        <span className={`p-2 rounded-lg ${bgIcon}`}>
          <Icon className={`w-4 h-4 ${textIcon}`} />
        </span>
      </div>
      {isLoading ? (
        <div className="h-8 w-16 bg-gray-100 rounded animate-pulse" />
      ) : (
        <div>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// SUBCOMPONENTE: AlertRow
// =============================================================================
function AlertRow({
  record,
  plate,
}: {
  record: MaintenanceRecord;
  plate: string;
}) {
  const overdue = isOverdueMaint(record);
  return (
    <div
      className={`flex items-start gap-3 p-3 rounded-lg text-sm ${
        overdue
          ? "bg-red-50 border border-red-100"
          : "bg-amber-50 border border-amber-100"
      }`}
    >
      {overdue ? (
        <Flame className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
      ) : (
        <Clock className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
      )}
      <div className="min-w-0 flex-1">
        <p
          className={`font-medium truncate ${overdue ? "text-red-800" : "text-amber-800"}`}
        >
          {record.description}
        </p>
        <p className={`text-xs ${overdue ? "text-red-500" : "text-amber-500"}`}>
          {plate} · {overdue ? "VENCIDA" : "Prevista"}{" "}
          {formatDateShort(record.scheduled_date)}
        </p>
      </div>
    </div>
  );
}

// =============================================================================
// COMPONENTE: FleetDashboard
// =============================================================================
export function FleetDashboard() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug ?? "";

  const {
    summary,
    vehicles,
    isLoadingSummary,
    isLoadingVehicles,
    errorSummary,
    errorVehicles,
    refetch,
  } = useFleetData();

  const {
    vehicles: trackedVehicles,
    isLoading: isLoadingTracking,
    lastUpdated,
    startTracking,
  } = useVehicleTracking(30_000);

  // Coleta alertas de manutenção de todos os veículos rastreados
  const allAlerts: Array<{ plate: string; alert: MaintenanceRecord }> = [];
  for (const v of trackedVehicles) {
    for (const a of v.maintenanceAlerts) {
      allAlerts.push({
        plate: v.plate,
        alert: {
          id: `${v.id}-${a.type}`,
          vehicle_id: v.id,
          type: a.type as MaintenanceRecord["type"],
          description: a.description,
          status: "scheduled",
          scheduled_date: a.scheduledDate,
          completed_date: null,
          cost: null,
          odometer_km: null,
          notes: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      });
    }
  }

  const overdueAlerts = allAlerts.filter((a) => isOverdueMaint(a.alert));
  const upcomingAlerts = allAlerts.filter((a) => !isOverdueMaint(a.alert));

  const displayVehicles =
    trackedVehicles.length > 0 ? trackedVehicles : vehicles;

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            Visão Geral da Frota
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Rastreamento, manutenção e despacho em tempo real
          </p>
        </div>
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className="hidden md:block text-xs text-gray-400">
              Atualizado às{" "}
              {new Intl.DateTimeFormat("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              }).format(lastUpdated)}
            </span>
          )}
          <button
            onClick={() => {
              refetch();
              startTracking();
            }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 text-blue-600 text-sm font-medium hover:bg-blue-100 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Atualizar
          </button>
        </div>
      </div>

      {/* Erros */}
      {(errorSummary || errorVehicles) && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-2 text-red-700 text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {errorSummary ?? errorVehicles}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <KpiCard
          label="Total de Veículos"
          value={summary?.totalVehicles ?? 0}
          icon={Truck}
          bgIcon="bg-blue-50"
          textIcon="text-blue-600"
          isLoading={isLoadingSummary}
          sub={`${summary?.activeVehicles ?? 0} ativos`}
        />
        <KpiCard
          label="Ativos"
          value={summary?.activeVehicles ?? 0}
          icon={CheckCircle}
          bgIcon="bg-green-50"
          textIcon="text-green-600"
          isLoading={isLoadingSummary}
        />
        <KpiCard
          label="Em Rota"
          value={summary?.vehiclesOnRoute ?? 0}
          icon={Navigation}
          bgIcon="bg-amber-50"
          textIcon="text-amber-600"
          isLoading={isLoadingSummary}
        />
        <KpiCard
          label="Em Manutenção"
          value={summary?.vehiclesInMaintenance ?? 0}
          icon={Wrench}
          bgIcon="bg-orange-50"
          textIcon="text-orange-600"
          isLoading={isLoadingSummary}
        />
        <KpiCard
          label="Ordens Ativas"
          value={summary?.activeOrders ?? 0}
          icon={Users}
          bgIcon="bg-purple-50"
          textIcon="text-purple-600"
          isLoading={isLoadingSummary}
        />
        <KpiCard
          label="Manutenções Pendentes"
          value={summary?.pendingMaintenances ?? 0}
          icon={AlertTriangle}
          bgIcon="bg-red-50"
          textIcon="text-red-600"
          isLoading={isLoadingSummary}
          sub={
            overdueAlerts.length > 0
              ? `${overdueAlerts.length} vencida(s)`
              : undefined
          }
        />
      </div>

      {/* Acesso Rápido */}
      <div>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
          Acesso Rápido
        </h2>
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {[
            {
              icon: Truck,
              label: "Veículos",
              desc: "Gerenciar frota",
              path: "veiculos",
              count: summary?.totalVehicles ?? 0,
              unit: "veículo",
              bg: "bg-blue-50",
              text: "text-blue-600",
              border: "border-blue-100",
            },
            {
              icon: Users,
              label: "Motoristas",
              desc: "Gerenciar equipe",
              path: "motoristas",
              count: summary?.activeVehicles ?? 0,
              unit: "ativo",
              bg: "bg-green-50",
              text: "text-green-600",
              border: "border-green-100",
            },
            {
              icon: FileText,
              label: "Despacho",
              desc: "Ordens e rotas",
              path: "despacho",
              count: summary?.activeOrders ?? 0,
              unit: "ordem",
              bg: "bg-purple-50",
              text: "text-purple-600",
              border: "border-purple-100",
            },
            {
              icon: Wrench,
              label: "Manutenção",
              desc: "Revisões e docs",
              path: "manutencao",
              count: summary?.pendingMaintenances ?? 0,
              unit: "pendente",
              bg: "bg-orange-50",
              text: "text-orange-600",
              border: "border-orange-100",
            },
          ].map(
            ({
              icon: Icon,
              label,
              desc,
              path,
              count,
              unit,
              bg,
              text,
              border,
            }) => (
              <Link
                key={path}
                href={`/${slug}/frota/${path}`}
                className={cn(
                  "bg-white rounded-xl border p-4 flex flex-col gap-3 transition-all duration-150 group",
                  border,
                  "hover:shadow-sm hover:border-opacity-70",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className={`p-2 rounded-lg ${bg}`}>
                    <Icon className={`w-4 h-4 ${text}`} />
                  </span>
                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{label}</p>
                  <p className="text-xs text-gray-400">{desc}</p>
                </div>
                {isLoadingSummary ? (
                  <div className="h-4 w-20 bg-gray-100 rounded animate-pulse" />
                ) : (
                  <p className={`text-xs font-medium ${text}`}>
                    {count} {unit}
                    {count !== 1 ? "s" : ""}
                  </p>
                )}
              </Link>
            ),
          )}
        </div>
      </div>

      {/* Conteúdo Principal — Mapa + Alertas */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Mapa (2/3) */}
        <div className="xl:col-span-2">
          <FleetMap
            vehicles={displayVehicles}
            isLoading={isLoadingTracking || isLoadingVehicles}
            lastUpdated={lastUpdated}
            onRefresh={startTracking}
          />
        </div>

        {/* Painel de alertas (1/3) */}
        <div className="space-y-4">
          {/* Alertas vencidos */}
          {overdueAlerts.length > 0 && (
            <div className="bg-white rounded-xl border border-red-200 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Flame className="w-4 h-4 text-red-500" />
                <h3 className="font-semibold text-gray-900 text-sm">
                  Manutenções Vencidas ({overdueAlerts.length})
                </h3>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {overdueAlerts.map((item, idx) => (
                  <AlertRow key={idx} record={item.alert} plate={item.plate} />
                ))}
              </div>
            </div>
          )}

          {/* Alertas próximos */}
          {upcomingAlerts.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4 text-amber-500" />
                <h3 className="font-semibold text-gray-900 text-sm">
                  Próximas Manutenções ({upcomingAlerts.length})
                </h3>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {upcomingAlerts.slice(0, 8).map((item, idx) => (
                  <AlertRow key={idx} record={item.alert} plate={item.plate} />
                ))}
                {upcomingAlerts.length > 8 && (
                  <p className="text-xs text-gray-400 text-center pt-1">
                    + {upcomingAlerts.length - 8} outros
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Status quando sem alertas */}
          {allAlerts.length === 0 && !isLoadingTracking && (
            <div className="bg-white rounded-xl border border-gray-200 p-6 flex flex-col items-center justify-center text-center">
              <div className="p-3 bg-green-50 rounded-full mb-3">
                <CheckCircle className="w-6 h-6 text-green-500" />
              </div>
              <p className="font-medium text-gray-700 text-sm">
                Sem alertas pendentes
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Frota em dia com as manutenções
              </p>
            </div>
          )}

          {/* Resumo rápido da frota */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Activity className="w-4 h-4 text-blue-500" />
              <h3 className="font-semibold text-gray-900 text-sm">
                Resumo da Frota
              </h3>
            </div>
            {isLoadingSummary ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-5 bg-gray-100 rounded animate-pulse"
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {[
                  {
                    label: "Veículos ativos",
                    value: summary?.activeVehicles ?? 0,
                    color: "bg-green-500",
                  },
                  {
                    label: "Em rota",
                    value: summary?.vehiclesOnRoute ?? 0,
                    color: "bg-blue-500",
                  },
                  {
                    label: "Em manutenção",
                    value: summary?.vehiclesInMaintenance ?? 0,
                    color: "bg-orange-500",
                  },
                  {
                    label: "Ordens ativas",
                    value: summary?.activeOrders ?? 0,
                    color: "bg-purple-500",
                  },
                ].map(({ label, value, color }) => (
                  <div
                    key={label}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${color}`} />
                      <span className="text-sm text-gray-600">{label}</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-900">
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Atividade Recente */}
      {displayVehicles.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-gray-500" />
            <h3 className="font-semibold text-gray-900 text-sm">
              Veículos Rastreados
            </h3>
            <span className="ml-auto text-xs text-gray-400">
              {displayVehicles.length} veículo(s)
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left pb-2 text-xs font-medium text-gray-400 uppercase tracking-wide">
                    Placa / Modelo
                  </th>
                  <th className="text-left pb-2 text-xs font-medium text-gray-400 uppercase tracking-wide">
                    Motorista
                  </th>
                  <th className="text-left pb-2 text-xs font-medium text-gray-400 uppercase tracking-wide">
                    Status
                  </th>
                  <th className="text-left pb-2 text-xs font-medium text-gray-400 uppercase tracking-wide">
                    Alertas
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {displayVehicles.slice(0, 8).map((v) => {
                  const statusMap: Record<
                    string,
                    { label: string; bg: string; text: string }
                  > = {
                    active: {
                      label: "Ativo",
                      bg: "bg-green-100",
                      text: "text-green-700",
                    },
                    on_route: {
                      label: "Em Rota",
                      bg: "bg-blue-100",
                      text: "text-blue-700",
                    },
                    maintenance: {
                      label: "Manutenção",
                      bg: "bg-orange-100",
                      text: "text-orange-700",
                    },
                    inactive: {
                      label: "Inativo",
                      bg: "bg-gray-100",
                      text: "text-gray-500",
                    },
                  };
                  const st = statusMap[v.status] ?? statusMap.inactive;
                  return (
                    <tr
                      key={v.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="py-3 pr-4">
                        <p className="font-medium text-gray-900">{v.plate}</p>
                        {v.model && (
                          <p className="text-xs text-gray-400">{v.model}</p>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-gray-600">
                        {v.driverName ?? (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${st.bg} ${st.text}`}
                        >
                          {st.label}
                        </span>
                      </td>
                      <td className="py-3">
                        {v.maintenanceAlerts.length > 0 ? (
                          <span className="flex items-center gap-1 text-xs text-amber-600">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            {v.maintenanceAlerts.length} alerta(s)
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-green-600">
                            <CheckCircle className="w-3.5 h-3.5" />
                            Em dia
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {displayVehicles.length > 8 && (
              <p className="text-xs text-gray-400 text-center pt-3">
                + {displayVehicles.length - 8} veículos não exibidos
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
