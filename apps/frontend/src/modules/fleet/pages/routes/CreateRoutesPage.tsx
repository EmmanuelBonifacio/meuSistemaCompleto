"use client";

import React, { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import { Route, History } from "lucide-react";
import { LeftPanel } from "./components/LeftPanel";
import { ResultPanel } from "./components/ResultPanel";
import type {
  StopInput,
  VehicleInput,
  OptimizeResult,
  OperationType,
  RouteEngine,
} from "../../types/routes.types";
import { listVehicles } from "../../services/fleet.api";
import { listDrivers } from "../../services/fleet.api";
import {
  optimizeRoutes,
  approveRoute,
  dispatchSession,
} from "../../services/routes.api";

const MapPanel = dynamic(
  () => import("./components/MapPanel").then((m) => m.MapPanel),
  {
    ssr: false,
    loading: () => (
      <div
        className="absolute inset-0 flex items-center justify-center bg-[#dde8f0] text-[13px] text-gray-600"
        aria-live="polite"
      >
        Carregando mapa...
      </div>
    ),
  },
);

export function CreateRoutesPage() {
  const router = useRouter();
  const params = useParams<{ slug: string | string[] }>();
  const tenantSlug = Array.isArray(params.slug) ? params.slug[0] : params.slug;

  const [vehicles, setVehicles] = useState<VehicleInput[]>([]);
  const [stops, setStops] = useState<StopInput[]>([]);
  const [result, setResult] = useState<OptimizeResult | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizeError, setOptimizeError] = useState("");
  const [expandedRouteId, setExpandedRouteId] = useState<string | null>(null);
  const [approvingRouteId, setApprovingRouteId] = useState<string | null>(null);
  const [isDispatching, setIsDispatching] = useState(false);
  const [dispatchSuccess, setDispatchSuccess] = useState<string | null>(null);
  const [depot, setDepot] = useState<{
    lat: number | null;
    lng: number | null;
    address: string;
  } | null>(null);

  useEffect(() => {
    Promise.all([
      listVehicles({ status: "active", limit: 100 }),
      listDrivers({ limit: 100 }),
    ])
      .then(([vehicleRes, driverRes]) => {
        const driverMap = new Map(
          driverRes.data.map((d: { id: string; name: string }) => [d.id, d.name]),
        );
        const mapped: VehicleInput[] = vehicleRes.data.map((v) => ({
          id: v.id,
          plate: v.plate,
          model: v.model ?? null,
          capacity_kg: 0,
          capacity_m3: 0,
          driver_id: (v as { driver_id?: string }).driver_id ?? "",
          driverName: (v as { driver_id?: string }).driver_id
            ? driverMap.get((v as { driver_id?: string }).driver_id ?? "") ?? undefined
            : undefined,
          shift_start: "08:00",
          shift_end: "18:00",
        }));
        setVehicles(mapped);
      })
      .catch(() => {});
  }, []);

  const handleOptimize = useCallback(
    async (params: {
      operationType: OperationType;
      operationDate: string;
      depotAddress: string;
      depotLat: number;
      depotLng: number;
      selectedVehicleIds: string[];
      engine: RouteEngine;
    }) => {
      setIsOptimizing(true);
      setOptimizeError("");
      setDispatchSuccess(null);

      const selectedVehicles = vehicles.filter((v) =>
        params.selectedVehicleIds.includes(v.id),
      );

      try {
        const res = await optimizeRoutes({
          sessionId: result?.sessionId ?? "new",
          depotAddress: params.depotAddress,
          depotLat: params.depotLat,
          depotLng: params.depotLng,
          vehicles: selectedVehicles.map((v) => ({
            id: v.id,
            capacity_kg: v.capacity_kg,
            capacity_m3: v.capacity_m3,
            driver_id: v.driver_id,
            shift_start: v.shift_start,
            shift_end: v.shift_end,
          })),
          stops,
          engine: params.engine,
          operationType: params.operationType,
          operationDate: params.operationDate,
        });

        setResult(res);
        if (res.routes.length > 0) {
          setExpandedRouteId(res.routes[0].id);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erro ao otimizar rotas.";
        setOptimizeError(msg);
      } finally {
        setIsOptimizing(false);
      }
    },
    [vehicles, stops, result?.sessionId],
  );

  async function handleApproveRoute(routeId: string) {
    setApprovingRouteId(routeId);
    try {
      await approveRoute(routeId);
      setResult((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          routes: prev.routes.map((r) =>
            r.id === routeId ? { ...r, status: "approved" } : r,
          ),
        };
      });
    } catch {
      // silently fail
    } finally {
      setApprovingRouteId(null);
    }
  }

  async function handleDispatch() {
    if (!result?.sessionId) return;
    const approvedCount = result.routes.filter((r) => r.status === "approved").length;
    if (approvedCount === 0) {
      alert("Aprove pelo menos uma rota antes de enviar ao despacho.");
      return;
    }
    setIsDispatching(true);
    try {
      const res = await dispatchSession(result.sessionId);
      setDispatchSuccess(`${res.ordersCreated} ordens criadas no Despacho.`);
      setResult((prev) =>
        prev
          ? {
              ...prev,
              status: "dispatched",
              routes: prev.routes.map((r) =>
                r.status === "approved" ? { ...r, status: "dispatched" } : r,
              ),
            }
          : prev,
      );
    } catch {
      // silently fail
    } finally {
      setIsDispatching(false);
    }
  }

  function handleReoptimize() {
    if (!depot || depot.lat == null || depot.lng == null) {
      alert("Defina o depósito com coordenadas antes de reotimizar.");
      return;
    }
    handleOptimize({
      operationType: "delivery",
      operationDate: new Date().toISOString().split("T")[0],
      depotAddress: depot.address,
      depotLat: depot.lat,
      depotLng: depot.lng,
      selectedVehicleIds: vehicles.map((v) => v.id),
      engine: "vroom",
    });
  }

  function goHistorico() {
    if (!tenantSlug) return;
    router.push(`/${tenantSlug}/frota/despacho`);
  }

  const allRoutes = result?.routes ?? [];
  const approvedCount = allRoutes.filter((r) => r.status === "approved").length;
  const canDispatch = approvedCount > 0 && result?.status !== "dispatched";

  const vehicleMap = new Map(vehicles.map((v) => [v.id, v]));

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-gray-50">
      {/* Topbar da página (abaixo da Navbar global) */}
      <header className="flex h-16 min-h-[64px] shrink-0 items-center justify-between border-b border-gray-200 bg-white px-6">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Criar Rotas</h1>
          <p className="mt-0.5 text-[12px] text-gray-500">
            Configure as paradas e gere rotas otimizadas
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goHistorico}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-4 py-2.5 text-[13px] font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            <History className="h-4 w-4" />
            Histórico
          </button>
          <button
            type="button"
            onClick={handleDispatch}
            disabled={!canDispatch || isDispatching || allRoutes.length === 0}
            className="rounded-lg bg-[#185FA5] px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#1456a0] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Aprovar e enviar ao despacho
          </button>
        </div>
      </header>

      {/* Corpo: painel esquerdo | (mapa + resultado) */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Painel esquerdo */}
        <aside className="flex w-[420px] min-w-[420px] shrink-0 flex-col overflow-hidden border-r border-gray-200 bg-white">
          <div className="flex shrink-0 items-center gap-2 border-b border-gray-100 px-5 py-4">
            <Route className="h-4 w-4 text-[#185FA5]" />
            <span className="text-[13px] font-semibold text-gray-800">Configurar rota</span>
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <LeftPanel
              vehicles={vehicles}
              stops={stops}
              onStopsChange={setStops}
              onDepotChange={(d) => setDepot(d)}
              onOptimize={handleOptimize}
              isOptimizing={isOptimizing}
              hasResults={allRoutes.length > 0}
            />
          </div>
        </aside>

        {/* Área direita */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <div className="relative min-h-0 flex-1 bg-gray-100">
            <MapPanel depot={depot} stops={stops} routes={allRoutes} />
          </div>

          <section className="h-[220px] min-h-[220px] shrink-0 overflow-hidden border-t border-gray-200 bg-white px-5 py-4">
            <ResultPanel
              optimizeError={optimizeError}
              isOptimizing={isOptimizing}
              allRoutes={allRoutes}
              result={result}
              dispatchSuccess={dispatchSuccess}
              expandedRouteId={expandedRouteId}
              vehicleMap={vehicleMap}
              approvingRouteId={approvingRouteId}
              approvedCount={approvedCount}
              canDispatch={canDispatch}
              isDispatching={isDispatching}
              depot={depot}
              vehicles={vehicles}
              stopsLength={stops.length}
              onExpandToggle={(id) =>
                setExpandedRouteId((prev) => (prev === id ? null : id))
              }
              onApproveRoute={handleApproveRoute}
              onDispatch={handleDispatch}
              onReoptimize={handleReoptimize}
            />
          </section>
        </div>
      </div>
    </div>
  );
}
