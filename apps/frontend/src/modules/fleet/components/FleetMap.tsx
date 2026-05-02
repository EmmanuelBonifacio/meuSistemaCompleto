// =============================================================================
// src/modules/fleet/components/FleetMap.tsx
// =============================================================================
// O QUE FAZ:
//   Mapa de rastreamento em tempo real dos veículos da frota.
//   Usa iframe apontando para o Traccar (que tem mapa embutido) ou,
//   se não configurado, exibe uma grade com cards de posição.
//
// NOTA SOBRE MAPAS:
//   O Traccar inclui uma interface web com mapa embutido em localhost:8082.
//   Para integrar um mapa customizado, seria necessário leaflet/mapbox — o que
//   exige dependência adicional não prevista no projeto. Por ora, usamos o
//   mapa do Traccar via iframe + fallback em cards.
// =============================================================================

"use client";

import { MapPin, RefreshCw } from "lucide-react";
import type { UnifiedVehicle } from "../types/fleet.types";

// =============================================================================
// PROPS
// =============================================================================
interface FleetMapProps {
  vehicles: UnifiedVehicle[];
  isLoading: boolean;
  lastUpdated: Date | null;
  onRefresh?: () => void;
}

// =============================================================================
// COMPONENTE: FleetMap
// =============================================================================
export function FleetMap({
  vehicles,
  isLoading,
  lastUpdated,
  onRefresh,
}: FleetMapProps) {
  // Apenas veículos com posição GPS válida
  const vehiclesWithPosition = vehicles.filter((v) => v.position !== null);
  const traccarUrl =
    typeof window !== "undefined"
      ? (process.env.NEXT_PUBLIC_TRACCAR_URL ?? "http://localhost:8082")
      : "http://localhost:8082";

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div>
          <h3 className="font-semibold text-gray-900">Mapa de Rastreamento</h3>
          {lastUpdated && (
            <p className="text-xs text-gray-400 mt-0.5">
              Atualizado:{" "}
              {lastUpdated.toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">
            {vehiclesWithPosition.length} / {vehicles.length} com sinal
          </span>
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-50"
              title="Atualizar posições"
            >
              <RefreshCw
                className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
              />
            </button>
          )}
        </div>
      </div>

      {/* Corpo: iframe do Traccar ou grid de posições */}
      {vehiclesWithPosition.length > 0 ? (
        <div>
          {/* Iframe do Traccar — mapa embutido */}
          <div className="relative h-64 md:h-96 bg-gray-50">
            <iframe
              src={traccarUrl}
              className="w-full h-full border-0"
              title="Mapa Traccar"
              sandbox="allow-scripts allow-same-origin allow-forms"
            />
            {isLoading && (
              <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
                <RefreshCw className="w-6 h-6 text-blue-500 animate-spin" />
              </div>
            )}
          </div>

          {/* Lista de posições abaixo do mapa */}
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
            {vehiclesWithPosition.map((v) => (
              <div
                key={v.id}
                className="flex items-start gap-2 text-sm text-gray-600 p-2 rounded-lg bg-gray-50"
              >
                <MapPin className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="font-medium text-gray-900">{v.plate}</p>
                  <p className="truncate">
                    {v.position!.address ??
                      `${v.position!.lat.toFixed(4)}, ${v.position!.lng.toFixed(4)}`}
                  </p>
                  <p className="text-xs text-gray-400">
                    {v.position!.speed} km/h
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <MapPin className="w-10 h-10 mb-3" />
          <p className="text-sm font-medium">Nenhum veículo com sinal GPS</p>
          <p className="text-xs mt-1">
            Verifique se o Traccar está configurado e os dispositivos estão
            enviando posições.
          </p>
        </div>
      )}
    </div>
  );
}
