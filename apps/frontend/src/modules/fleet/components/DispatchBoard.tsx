// =============================================================================
// src/modules/fleet/components/DispatchBoard.tsx
// =============================================================================
// O QUE FAZ:
//   Quadro de despacho Kanban — exibe as ordens agrupadas por status.
//   Usado na DispatchPage para visualizar e gerenciar ordens de serviço.
// =============================================================================

"use client";

import { MapPin, User, Truck, Clock } from "lucide-react";
import type { DispatchOrder, DispatchStatus } from "../types/fleet.types";

// =============================================================================
// CONFIGURAÇÃO DAS COLUNAS
// =============================================================================
const COLUMNS: Array<{
  status: DispatchStatus;
  label: string;
  color: string;
}> = [
  { status: "pending", label: "Aguardando", color: "bg-gray-100" },
  { status: "dispatched", label: "Despachado", color: "bg-blue-50" },
  { status: "in_transit", label: "Em Trânsito", color: "bg-amber-50" },
  { status: "completed", label: "Concluído", color: "bg-green-50" },
];

// =============================================================================
// HELPER: formata data/hora
// =============================================================================
function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

// =============================================================================
// SUBCOMPONENTE: OrderCard
// =============================================================================
function OrderCard({
  order,
  onClick,
}: {
  order: DispatchOrder;
  onClick?: (order: DispatchOrder) => void;
}) {
  const priorityColors: Record<string, string> = {
    low: "bg-gray-200 text-gray-700",
    medium: "bg-blue-100 text-blue-700",
    high: "bg-amber-100 text-amber-700",
    critical: "bg-red-100 text-red-700",
  };

  return (
    <div
      onClick={() => onClick?.(order)}
      className={`
        bg-white rounded-lg border border-gray-200 p-3 shadow-sm
        ${onClick ? "cursor-pointer hover:shadow-md transition-shadow" : ""}
      `}
    >
      {/* Prioridade + ID */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-400 font-mono">
          #{order.id.slice(0, 8)}
        </span>
        <span
          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            priorityColors[order.priority] ?? priorityColors.medium
          }`}
        >
          {order.priority.toUpperCase()}
        </span>
      </div>

      {/* Origem → Destino */}
      <div className="text-sm space-y-1 text-gray-700">
        <p className="flex items-start gap-1">
          <MapPin className="w-3.5 h-3.5 text-green-500 mt-0.5 flex-shrink-0" />
          <span className="truncate">{order.origin_address}</span>
        </p>
        <p className="flex items-start gap-1">
          <MapPin className="w-3.5 h-3.5 text-red-500 mt-0.5 flex-shrink-0" />
          <span className="truncate">{order.destination_address}</span>
        </p>
      </div>

      {/* Motorista + Veículo */}
      <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
        <span className="flex items-center gap-1">
          <User className="w-3 h-3" />
          {order.driver_id.slice(0, 8)}
        </span>
        <span className="flex items-center gap-1">
          <Truck className="w-3 h-3" />
          {order.vehicle_id.slice(0, 8)}
        </span>
        {order.scheduled_at && (
          <span className="flex items-center gap-1 ml-auto">
            <Clock className="w-3 h-3" />
            {formatDateTime(order.scheduled_at)}
          </span>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// PROPS
// =============================================================================
interface DispatchBoardProps {
  orders: DispatchOrder[];
  isLoading: boolean;
  onOrderClick?: (order: DispatchOrder) => void;
}

// =============================================================================
// COMPONENTE: DispatchBoard
// =============================================================================
export function DispatchBoard({
  orders,
  isLoading,
  onOrderClick,
}: DispatchBoardProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {COLUMNS.map((col) => (
          <div key={col.status} className={`rounded-xl p-3 ${col.color}`}>
            <div className="h-4 w-24 bg-gray-200 rounded animate-pulse mb-3" />
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="bg-white rounded-lg p-3 h-20 animate-pulse"
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {COLUMNS.map((col) => {
        const colOrders = orders.filter((o) => o.status === col.status);
        return (
          <div key={col.status} className={`rounded-xl p-3 ${col.color}`}>
            {/* Cabeçalho da coluna */}
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-gray-700">
                {col.label}
              </h4>
              <span className="text-xs bg-white text-gray-500 px-2 py-0.5 rounded-full">
                {colOrders.length}
              </span>
            </div>

            {/* Cards */}
            <div className="space-y-2">
              {colOrders.length === 0 ? (
                <p className="text-center text-xs text-gray-400 py-4">
                  Nenhuma ordem
                </p>
              ) : (
                colOrders.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    onClick={onOrderClick}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
