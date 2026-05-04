"use client";

import React from "react";
import {
  Route,
  Send,
  AlertCircle,
  CheckCircle,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { RouteCard } from "./RouteCard";
import type {
  VehicleInput,
  Route as RouteType,
  OptimizeResult,
} from "../../../types/routes.types";

export interface ResultPanelProps {
  optimizeError: string;
  isOptimizing: boolean;
  allRoutes: RouteType[];
  result: OptimizeResult | null;
  dispatchSuccess: string | null;
  expandedRouteId: string | null;
  vehicleMap: Map<string, VehicleInput>;
  approvingRouteId: string | null;
  approvedCount: number;
  canDispatch: boolean;
  isDispatching: boolean;
  depot: { lat: number | null; lng: number | null; address: string } | null;
  vehicles: VehicleInput[];
  stopsLength: number;
  onExpandToggle: (routeId: string) => void;
  onApproveRoute: (routeId: string) => void;
  onDispatch: () => void;
  onReoptimize: () => void;
}

export function ResultPanel({
  optimizeError,
  isOptimizing,
  allRoutes,
  result,
  dispatchSuccess,
  expandedRouteId,
  vehicleMap,
  approvingRouteId,
  approvedCount,
  canDispatch,
  isDispatching,
  depot,
  vehicles,
  stopsLength,
  onExpandToggle,
  onApproveRoute,
  onDispatch,
  onReoptimize,
}: ResultPanelProps) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex shrink-0 items-center justify-between">
        <span className="text-[13px] font-semibold text-gray-800">
          {allRoutes.length > 0
            ? `${allRoutes.length} rota${allRoutes.length > 1 ? "s" : ""}`
            : "Resultado"}
        </span>
        {result && (
          <span className="font-mono text-xs text-gray-400">
            {result.engineUsed.toUpperCase()}
          </span>
        )}
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        {optimizeError && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>{optimizeError}</span>
          </div>
        )}

        {isOptimizing && (
          <div className="flex flex-col items-center gap-2 py-6">
            <Loader2 className="h-8 w-8 animate-spin text-[#185FA5]" />
            <p className="text-sm text-gray-500">Otimizando rotas...</p>
            <p className="text-xs text-gray-400">GraphHopper + VROOM</p>
          </div>
        )}

        {!isOptimizing && allRoutes.length === 0 && !optimizeError && (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <Route className="h-10 w-10 text-gray-200" />
            <p className="text-[13px] text-gray-400">
              Configure as paradas e clique em &ldquo;Otimizar rotas&rdquo;
            </p>
          </div>
        )}

        {dispatchSuccess && (
          <div className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-xs text-green-700">
            <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>{dispatchSuccess}</span>
          </div>
        )}

        {result && result.unassignedStops.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="mb-1.5 text-xs font-medium text-amber-700">
              {result.unassignedStops.length} parada
              {result.unassignedStops.length > 1 ? "s" : ""} não atribuída
              {result.unassignedStops.length > 1 ? "s" : ""}
            </p>
            <p className="text-xs text-amber-600">
              Capacidade insuficiente ou janela de tempo inviável. Adicione mais veículos ou
              ajuste as paradas.
            </p>
          </div>
        )}

        {!isOptimizing &&
          allRoutes.map((route) => (
            <RouteCard
              key={route.id}
              route={route}
              vehiclePlate={vehicleMap.get(route.vehicleId ?? "")?.plate}
              driverName={vehicleMap.get(route.vehicleId ?? "")?.driverName}
              isExpanded={expandedRouteId === route.id}
              onToggle={() => onExpandToggle(route.id)}
              onApprove={() => onApproveRoute(route.id)}
              isApproving={approvingRouteId === route.id}
            />
          ))}
      </div>

      {allRoutes.length > 0 && !isOptimizing && (
        <div className="shrink-0 space-y-2 border-t border-gray-100 pt-3">
          {approvedCount > 0 && !dispatchSuccess && (
            <p className="text-center text-[12px] text-gray-500">
              {approvedCount} rota{approvedCount > 1 ? "s" : ""} aprovada
              {approvedCount > 1 ? "s" : ""} para despacho
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onReoptimize}
              disabled={
                isOptimizing ||
                !depot ||
                depot.lat == null ||
                depot.lng == null ||
                stopsLength === 0 ||
                vehicles.length === 0
              }
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-200 py-2.5 text-[13px] text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Reotimizar
            </button>
            <button
              type="button"
              onClick={onDispatch}
              disabled={!canDispatch || isDispatching}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#185FA5] py-2.5 text-[13px] font-medium text-white transition-colors hover:bg-[#1456a0] disabled:opacity-50"
            >
              {isDispatching ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              Enviar ao despacho
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
