"use client";

import React, { useState } from "react";
import {
  Loader2,
  Calendar,
  MapPin,
  Plus,
  Edit2,
} from "lucide-react";
import { VehicleSelector } from "./VehicleSelector";
import { EngineSelector } from "./EngineSelector";
import { StopEditor } from "./StopEditor";
import { AddressModal } from "./AddressModal";
import type { GeoResult } from "./AddressModal";
import type {
  OperationType,
  RouteEngine,
  StopInput,
  VehicleInput,
} from "../../../types/routes.types";

interface Props {
  vehicles: VehicleInput[];
  stops: StopInput[];
  onStopsChange: (stops: StopInput[]) => void;
  onDepotChange: (
    depot: { lat: number | null; lng: number | null; address: string } | null,
  ) => void;
  onOptimize: (params: {
    operationType: OperationType;
    operationDate: string;
    depotAddress: string;
    depotLat: number;
    depotLng: number;
    selectedVehicleIds: string[];
    engine: RouteEngine;
  }) => void;
  isOptimizing: boolean;
  hasResults: boolean;
}

const OPERATION_TYPES: Array<{ value: OperationType; label: string }> = [
  { value: "delivery", label: "Entregas / E-commerce" },
  { value: "transport", label: "Transporte de pessoas" },
  { value: "collection", label: "Coleta" },
  { value: "service", label: "Serviços técnicos" },
];

export function LeftPanel({
  vehicles,
  stops,
  onStopsChange,
  onDepotChange,
  onOptimize,
  isOptimizing,
  hasResults,
}: Props) {
  const [operationType, setOperationType] = useState<OperationType>("delivery");
  const [operationDate, setOperationDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [depot, setDepot] = useState<GeoResult | null>(null);
  const [engine, setEngine] = useState<RouteEngine>("vroom");
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<string[]>([]);

  const [depotModalOpen, setDepotModalOpen] = useState(false);
  const [stopModalOpen, setStopModalOpen] = useState(false);

  function handleDepotConfirm(result: GeoResult) {
    setDepot({ ...result });
    onDepotChange({
      lat: result.lat ?? null,
      lng: result.lng ?? null,
      address: result.address,
    });
  }

  function handleStopConfirm(result: GeoResult) {
    if (result.lat == null || result.lng == null) {
      alert(
        "Esta parada precisa de coordenadas. Use a aba de endereço completo ou outro CEP.",
      );
      return;
    }
    const newStop: StopInput = {
      id: crypto.randomUUID(),
      address: result.address,
      lat: result.lat,
      lng: result.lng,
      time_window_start: null,
      time_window_end: null,
      service_duration_min: 5,
      weight_kg: null,
      volume_m3: null,
      required_skill: null,
      notes: null,
      order_id: null,
    };
    onStopsChange([...stops, newStop]);
  }

  function handleOptimize() {
    if (!depot) {
      alert("Defina o depósito / ponto de saída antes de otimizar.");
      return;
    }
    if (depot.lat == null || depot.lng == null) {
      alert(
        "O depósito precisa de coordenadas no mapa. Busque o CEP de novo ou use endereço completo.",
      );
      return;
    }
    if (selectedVehicleIds.length === 0) {
      alert("Selecione pelo menos um veículo.");
      return;
    }
    if (stops.length === 0) {
      alert("Adicione pelo menos uma parada.");
      return;
    }
    onOptimize({
      operationType,
      operationDate,
      depotAddress: depot.address,
      depotLat: depot.lat,
      depotLng: depot.lng,
      selectedVehicleIds,
      engine,
    });
  }

  return (
    <>
      {/* Modais */}
      <AddressModal
        open={depotModalOpen}
        title="Depósito / ponto de saída"
        onClose={() => setDepotModalOpen(false)}
        onConfirm={handleDepotConfirm}
        allowConfirmWithoutCoords
      />
      <AddressModal
        open={stopModalOpen}
        title="Adicionar parada"
        onClose={() => setStopModalOpen(false)}
        onConfirm={handleStopConfirm}
      />

      {/* Painel */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto px-5 py-6 flex flex-col gap-6">

          {/* ── Tipo de operação ── */}
          <div>
            <label className="block text-[13px] font-medium text-gray-700 mb-1.5">
              Tipo de operação
            </label>
            <select
              value={operationType}
              onChange={(e) => setOperationType(e.target.value as OperationType)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#185FA5] focus:border-transparent bg-white"
            >
              {OPERATION_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* ── Data da operação ── */}
          <div>
            <label className="flex items-center gap-1.5 text-[13px] font-medium text-gray-700 mb-1.5">
              <Calendar className="w-3.5 h-3.5 text-gray-500" />
              Data da operação
            </label>
            <input
              type="date"
              value={operationDate}
              onChange={(e) => setOperationDate(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#185FA5]"
            />
          </div>

          {/* ── Depósito ── */}
          <div>
            <label className="flex items-center gap-1.5 text-[13px] font-medium text-gray-700 mb-1.5">
              <MapPin className="w-3.5 h-3.5 text-gray-500" />
              Depósito / ponto de saída
            </label>
            <button
              type="button"
              onClick={() => setDepotModalOpen(true)}
              className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 text-[13px] border rounded-lg transition-colors text-left ${
                depot && (depot.lat == null || depot.lng == null)
                  ? "border-amber-200 bg-amber-50 text-gray-800"
                  : depot
                    ? "border-green-200 bg-green-50 text-gray-800"
                    : "border-gray-200 bg-white text-gray-400 hover:border-[#185FA5] hover:bg-blue-50"
              }`}
            >
              <span className="flex-1 truncate">
                {depot ? (
                  <span className="flex items-center gap-2">
                    <MapPin
                      className={`w-3.5 h-3.5 flex-shrink-0 ${depot.lat != null && depot.lng != null ? "text-green-600" : "text-amber-700"}`}
                    />
                    <span className="text-gray-800">{depot.address}</span>
                  </span>
                ) : (
                  "Clique para definir o ponto de saída"
                )}
              </span>
              <span className="flex-shrink-0 flex items-center gap-1 text-[12px] font-medium text-[#185FA5]">
                {depot ? (
                  <>
                    <Edit2 className="w-3 h-3" />
                    Alterar
                  </>
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5" />
                    Definir
                  </>
                )}
              </span>
            </button>
          </div>

          {/* ── Veículos ── */}
          <VehicleSelector
            vehicles={vehicles}
            selected={selectedVehicleIds}
            onChange={setSelectedVehicleIds}
          />

          {/* ── Motor de otimização ── */}
          <EngineSelector value={engine} onChange={setEngine} />

          {/* ── Paradas ── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[13px] font-medium text-gray-700">
                Paradas
                {stops.length > 0 && (
                  <span className="ml-2 text-[12px] font-normal text-gray-500">
                    ({stops.length})
                  </span>
                )}
              </label>
            </div>

            <button
              type="button"
              onClick={() => setStopModalOpen(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 text-[13px] font-medium text-[#185FA5] border border-dashed border-[#185FA5]/50 rounded-lg hover:bg-blue-50 transition-colors mb-3"
            >
              <Plus className="w-4 h-4" />
              Adicionar parada
            </button>

            <StopEditor stops={stops} onChange={onStopsChange} />
          </div>
        </div>

        {/* ── Botão Otimizar — sticky no bottom ── */}
        <div className="px-5 py-4 bg-white border-t border-gray-100 flex-shrink-0">
          <button
            type="button"
            onClick={handleOptimize}
            disabled={
              isOptimizing ||
              !depot ||
              depot.lat == null ||
              depot.lng == null ||
              stops.length === 0 ||
              selectedVehicleIds.length === 0
            }
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-[#185FA5] text-white rounded-lg text-[13px] font-semibold hover:bg-[#1456a0] disabled:opacity-50 transition-colors"
          >
            {isOptimizing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Otimizando...
              </>
            ) : (
              hasResults ? "Reotimizar" : "Otimizar rotas"
            )}
          </button>
          {stops.length > 0 &&
            selectedVehicleIds.length > 0 &&
            depot &&
            depot.lat != null &&
            depot.lng != null && (
            <p className="text-[12px] text-gray-400 text-center mt-1.5">
              {stops.length} parada{stops.length > 1 ? "s" : ""} ·{" "}
              {selectedVehicleIds.length} veículo{selectedVehicleIds.length > 1 ? "s" : ""} ·{" "}
              {engine.toUpperCase()}
            </p>
          )}
        </div>
      </div>
    </>
  );
}
