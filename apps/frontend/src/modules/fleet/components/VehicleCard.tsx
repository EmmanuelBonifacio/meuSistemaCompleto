// =============================================================================
// src/modules/fleet/components/VehicleCard.tsx
// =============================================================================
// O QUE FAZ:
//   Card de veículo exibido na listagem da frota.
//   Mostra placa, modelo, status e posição GPS atual (se disponível).
// =============================================================================

"use client";

import {
  MapPin,
  Gauge,
  AlertTriangle,
  CheckCircle,
  Wrench,
} from "lucide-react";
import type { UnifiedVehicle } from "../types/fleet.types";

// =============================================================================
// HELPERS: badge de status
// =============================================================================
const STATUS_CONFIG = {
  active: {
    label: "Ativo",
    className: "bg-green-100 text-green-800",
    icon: CheckCircle,
  },
  inactive: {
    label: "Inativo",
    className: "bg-gray-100 text-gray-600",
    icon: null,
  },
  maintenance: {
    label: "Manutenção",
    className: "bg-amber-100 text-amber-800",
    icon: Wrench,
  },
  decommissioned: {
    label: "Desativado",
    className: "bg-red-100 text-red-700",
    icon: null,
  },
} as const;

// =============================================================================
// PROPS
// =============================================================================
interface VehicleCardProps {
  vehicle: UnifiedVehicle;
  onClick?: (vehicle: UnifiedVehicle) => void;
}

// =============================================================================
// COMPONENTE: VehicleCard
// =============================================================================
export function VehicleCard({ vehicle, onClick }: VehicleCardProps) {
  const statusConfig =
    STATUS_CONFIG[vehicle.status as keyof typeof STATUS_CONFIG] ??
    STATUS_CONFIG.inactive;
  const StatusIcon = statusConfig.icon;

  const hasAlerts = vehicle.maintenanceAlerts.length > 0;

  return (
    <div
      onClick={() => onClick?.(vehicle)}
      className={`
        bg-white rounded-xl border border-gray-200 p-4
        transition-all duration-200
        ${onClick ? "cursor-pointer hover:shadow-md hover:border-blue-300" : ""}
      `}
    >
      {/* Cabeçalho: placa + status */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-lg font-bold text-gray-900 tracking-widest">
            {vehicle.plate}
          </p>
          {(vehicle.brand || vehicle.model) && (
            <p className="text-sm text-gray-500 mt-0.5">
              {[vehicle.brand, vehicle.model, vehicle.year]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
        </div>

        <span
          className={`
            inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium
            ${statusConfig.className}
          `}
        >
          {StatusIcon && <StatusIcon className="w-3 h-3" />}
          {statusConfig.label}
        </span>
      </div>

      {/* Posição GPS */}
      {vehicle.position ? (
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span className="flex items-center gap-1">
            <Gauge className="w-4 h-4 text-blue-500" />
            {vehicle.position.speed} km/h
          </span>
          {vehicle.position.address && (
            <span className="flex items-center gap-1 truncate">
              <MapPin className="w-4 h-4 text-blue-500 flex-shrink-0" />
              <span className="truncate">{vehicle.position.address}</span>
            </span>
          )}
        </div>
      ) : (
        <p className="text-sm text-gray-400 flex items-center gap-1">
          <MapPin className="w-4 h-4" />
          Sem sinal GPS
        </p>
      )}

      {/* Alertas de manutenção */}
      {hasAlerts && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <p className="flex items-center gap-1 text-xs text-amber-600 font-medium">
            <AlertTriangle className="w-3.5 h-3.5" />
            {vehicle.maintenanceAlerts.length === 1
              ? "1 alerta de manutenção"
              : `${vehicle.maintenanceAlerts.length} alertas de manutenção`}
          </p>
        </div>
      )}
    </div>
  );
}
