// =============================================================================
// src/modules/fleet/hooks/useVehicleTracking.ts
// =============================================================================
// O QUE FAZ:
//   Hook de rastreamento em tempo real. Busca posições dos veículos
//   periodicamente (polling configurável) e atualiza o estado.
//   Útil para o mapa ao vivo no FleetDashboard.
// =============================================================================

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { getUnifiedVehicles } from "../services/fleet.api";
import type { UnifiedVehicle } from "../types/fleet.types";

// Intervalo padrão de atualização (30 segundos)
const DEFAULT_INTERVAL_MS = 30_000;

// =============================================================================
// INTERFACE: retorno do hook
// =============================================================================
export interface UseVehicleTrackingReturn {
  vehicles: UnifiedVehicle[];
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  startTracking: () => void;
  stopTracking: () => void;
  isTracking: boolean;
}

// =============================================================================
// HOOK: useVehicleTracking
// =============================================================================
export function useVehicleTracking(
  intervalMs: number = DEFAULT_INTERVAL_MS,
): UseVehicleTrackingReturn {
  const [vehicles, setVehicles] = useState<UnifiedVehicle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isTracking, setIsTracking] = useState(false);

  // Ref para o intervalo — evita memory leak ao desmontar
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchPositions = useCallback(async () => {
    try {
      const result = await getUnifiedVehicles();
      setVehicles(result.data);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Erro ao buscar posições.";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const startTracking = useCallback(() => {
    if (intervalRef.current) return; // já rodando
    setIsTracking(true);
    fetchPositions(); // primeira busca imediata
    intervalRef.current = setInterval(fetchPositions, intervalMs);
  }, [fetchPositions, intervalMs]);

  const stopTracking = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsTracking(false);
  }, []);

  // Inicia rastreamento ao montar e para ao desmontar
  useEffect(() => {
    startTracking();
    return () => stopTracking();
  }, [startTracking, stopTracking]);

  return {
    vehicles,
    isLoading,
    error,
    lastUpdated,
    startTracking,
    stopTracking,
    isTracking,
  };
}
