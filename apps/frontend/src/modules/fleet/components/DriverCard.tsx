// =============================================================================
// src/modules/fleet/components/DriverCard.tsx
// =============================================================================
// O QUE FAZ:
//   Card de motorista exibido na listagem de drivers.
//   Mostra nome, status, contato e se está em serviço.
// =============================================================================

"use client";

import { Phone, Mail, Truck, UserCheck, UserX } from "lucide-react";
import type { Driver } from "../types/fleet.types";

// =============================================================================
// HELPERS
// =============================================================================
const STATUS_CONFIG: Record<
  string,
  { label: string; className: string; icon: React.ElementType | null }
> = {
  active: {
    label: "Disponível",
    className: "bg-green-100 text-green-800",
    icon: UserCheck,
  },
  inactive: {
    label: "Inativo",
    className: "bg-gray-100 text-gray-600",
    icon: UserX,
  },
  on_leave: {
    label: "De folga",
    className: "bg-blue-100 text-blue-700",
    icon: null,
  },
};

// =============================================================================
// PROPS
// =============================================================================
interface DriverCardProps {
  driver: Driver;
  onClick?: (driver: Driver) => void;
}

// =============================================================================
// COMPONENTE: DriverCard
// =============================================================================
export function DriverCard({ driver, onClick }: DriverCardProps) {
  const config = STATUS_CONFIG[driver.status] ?? STATUS_CONFIG.inactive;
  const StatusIcon = config.icon;
  const isOnRoute = !!driver.current_job_id;

  return (
    <div
      onClick={() => onClick?.(driver)}
      className={`
        bg-white rounded-xl border border-gray-200 p-4
        transition-all duration-200
        ${onClick ? "cursor-pointer hover:shadow-md hover:border-blue-300" : ""}
      `}
    >
      {/* Cabeçalho */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="font-semibold text-gray-900">{driver.name}</p>
          {isOnRoute && (
            <p className="text-xs text-blue-600 flex items-center gap-1 mt-0.5">
              <Truck className="w-3 h-3" />
              Em rota
            </p>
          )}
        </div>

        <span
          className={`
            inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium
            ${config.className}
          `}
        >
          {StatusIcon && <StatusIcon className="w-3 h-3" />}
          {config.label}
        </span>
      </div>

      {/* Contato */}
      <div className="space-y-1">
        {driver.phone && (
          <p className="text-sm text-gray-500 flex items-center gap-2">
            <Phone className="w-3.5 h-3.5 text-gray-400" />
            {driver.phone}
          </p>
        )}
        {driver.email && (
          <p className="text-sm text-gray-500 flex items-center gap-2 truncate">
            <Mail className="w-3.5 h-3.5 text-gray-400" />
            <span className="truncate">{driver.email}</span>
          </p>
        )}
      </div>
    </div>
  );
}
