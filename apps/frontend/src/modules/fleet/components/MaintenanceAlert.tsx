// =============================================================================
// src/modules/fleet/components/MaintenanceAlert.tsx
// =============================================================================
// O QUE FAZ:
//   Componente de alerta de manutenção pendente.
//   Exibido no dashboard e nos cards de veículo com manutenções agendadas.
// =============================================================================

"use client";

import { AlertTriangle, Wrench, Clock, Fuel, FileText } from "lucide-react";
import type { MaintenanceRecord, MaintenanceType } from "../types/fleet.types";

// =============================================================================
// HELPERS
// =============================================================================
const TYPE_CONFIG: Record<
  MaintenanceType,
  { label: string; icon: React.ElementType; className: string }
> = {
  preventive: {
    label: "Preventiva",
    icon: Wrench,
    className: "text-blue-600 bg-blue-50",
  },
  corrective: {
    label: "Corretiva",
    icon: AlertTriangle,
    className: "text-red-600 bg-red-50",
  },
  inspection: {
    label: "Inspeção",
    icon: Clock,
    className: "text-amber-600 bg-amber-50",
  },
  fuel: {
    label: "Combustível",
    icon: Fuel,
    className: "text-green-600 bg-green-50",
  },
  document: {
    label: "Documento",
    icon: FileText,
    className: "text-purple-600 bg-purple-50",
  },
};

// Formata data para exibição local
function formatDate(iso: string | null): string {
  if (!iso) return "Sem data";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(iso));
}

// =============================================================================
// PROPS
// =============================================================================
interface MaintenanceAlertProps {
  record: MaintenanceRecord;
  compact?: boolean;
  onClick?: (record: MaintenanceRecord) => void;
}

// =============================================================================
// COMPONENTE: MaintenanceAlert
// =============================================================================
export function MaintenanceAlert({
  record,
  compact = false,
  onClick,
}: MaintenanceAlertProps) {
  const config =
    TYPE_CONFIG[record.type as MaintenanceType] ?? TYPE_CONFIG.preventive;
  const Icon = config.icon;

  if (compact) {
    return (
      <div
        onClick={() => onClick?.(record)}
        className={`
          flex items-center gap-2 px-3 py-2 rounded-lg text-sm
          ${config.className}
          ${onClick ? "cursor-pointer hover:opacity-80" : ""}
        `}
      >
        <Icon className="w-4 h-4 flex-shrink-0" />
        <span className="truncate">{record.description}</span>
        <span className="text-xs opacity-75 ml-auto flex-shrink-0">
          {formatDate(record.scheduled_date)}
        </span>
      </div>
    );
  }

  return (
    <div
      onClick={() => onClick?.(record)}
      className={`
        rounded-xl border p-4
        ${config.className} border-current border-opacity-20
        ${onClick ? "cursor-pointer hover:opacity-90" : ""}
      `}
    >
      <div className="flex items-start gap-3">
        <span className={`p-2 rounded-lg ${config.className}`}>
          <Icon className="w-4 h-4" />
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="font-medium text-sm">{config.label}</p>
            <span className="text-xs opacity-75">
              {formatDate(record.scheduled_date)}
            </span>
          </div>
          <p className="text-sm mt-0.5 truncate">{record.description}</p>
          {record.cost != null && (
            <p className="text-xs mt-1 opacity-75">
              Custo estimado:{" "}
              {new Intl.NumberFormat("pt-BR", {
                style: "currency",
                currency: "BRL",
              }).format(record.cost)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
