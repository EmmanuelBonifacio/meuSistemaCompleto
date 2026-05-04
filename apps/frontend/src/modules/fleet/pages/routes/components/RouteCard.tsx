"use client";

import React from "react";
import { MapPin, Clock, Ruler, CheckCircle, Truck, User, ChevronDown, ChevronUp } from "lucide-react";
import type { Route } from "../../../types/routes.types";

interface Props {
  route: Route;
  vehiclePlate?: string;
  driverName?: string;
  isExpanded: boolean;
  onToggle: () => void;
  onApprove: () => void;
  isApproving: boolean;
}

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  pending: { label: "Pendente", className: "bg-gray-100 text-gray-600" },
  approved: { label: "Aprovada", className: "bg-green-100 text-green-700" },
  dispatched: { label: "Despachada", className: "bg-blue-100 text-blue-700" },
  completed: { label: "Concluída", className: "bg-purple-100 text-purple-700" },
};

export function RouteCard({
  route,
  vehiclePlate,
  driverName,
  isExpanded,
  onToggle,
  onApprove,
  isApproving,
}: Props) {
  const statusInfo = STATUS_LABELS[route.status] ?? STATUS_LABELS.pending;

  return (
    <div
      className="border rounded-lg overflow-hidden"
      style={{ borderColor: route.color + "66" }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={onToggle}
        style={{ borderLeft: `3px solid ${route.color}` }}
      >
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
          style={{ backgroundColor: route.color }}
        >
          {route.name.replace("Rota ", "")}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-800">{route.name}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusInfo.className}`}>
              {statusInfo.label}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {route.stops.length} parada{route.stops.length !== 1 ? "s" : ""}
            </span>
            <span className="flex items-center gap-1">
              <Ruler className="w-3 h-3" />
              {route.totalDistanceKm.toFixed(1)} km
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {route.estimatedDurationMin} min
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {route.status === "pending" && (
            <button
              onClick={(e) => { e.stopPropagation(); onApprove(); }}
              disabled={isApproving}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-60 transition-colors"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              {isApproving ? "..." : "Aprovar"}
            </button>
          )}
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-gray-100 bg-gray-50 p-3">
          {/* Vehicle / Driver */}
          <div className="flex gap-4 mb-3">
            {vehiclePlate && (
              <div className="flex items-center gap-1.5 text-xs text-gray-600">
                <Truck className="w-3.5 h-3.5 text-gray-400" />
                {vehiclePlate}
              </div>
            )}
            {driverName && (
              <div className="flex items-center gap-1.5 text-xs text-gray-600">
                <User className="w-3.5 h-3.5 text-gray-400" />
                {driverName}
              </div>
            )}
          </div>

          {/* Stops list */}
          <div className="flex flex-col gap-1.5">
            {route.stops.map((stop, idx) => (
              <div key={stop.id} className="flex items-start gap-2">
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5"
                  style={{ backgroundColor: route.color }}
                >
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-700 leading-snug truncate">{stop.address}</p>
                  {(stop.timeWindowStart || stop.weightKg) && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {stop.timeWindowStart && `${stop.timeWindowStart} - ${stop.timeWindowEnd}`}
                      {stop.timeWindowStart && stop.weightKg && " · "}
                      {stop.weightKg && `${stop.weightKg} kg`}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
