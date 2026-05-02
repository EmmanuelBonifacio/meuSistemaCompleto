// =============================================================================
// src/modules/fleet/hooks/useFleetData.ts
// =============================================================================
// O QUE FAZ:
//   Hook principal do módulo de frota. Busca o resumo do dashboard e
//   a lista unificada de veículos ao montar o componente.
//   Expõe estados de loading e erro para cada fetch.
// =============================================================================

"use client";

import { useState, useEffect, useCallback } from "react";
import { getDashboard, getUnifiedVehicles } from "../services/fleet.api";
import type {
  FleetDashboardSummary,
  UnifiedVehicle,
} from "../types/fleet.types";

// =============================================================================
// INTERFACE: retorno do hook
// =============================================================================
export interface UseFleetDataReturn {
  summary: FleetDashboardSummary | null;
  vehicles: UnifiedVehicle[];
  isLoadingSummary: boolean;
  isLoadingVehicles: boolean;
  errorSummary: string | null;
  errorVehicles: string | null;
  refetch: () => void;
}

// =============================================================================
// HOOK: useFleetData
// =============================================================================
export function useFleetData(): UseFleetDataReturn {
  const [summary, setSummary] = useState<FleetDashboardSummary | null>(null);
  const [vehicles, setVehicles] = useState<UnifiedVehicle[]>([]);
  const [isLoadingSummary, setIsLoadingSummary] = useState(true);
  const [isLoadingVehicles, setIsLoadingVehicles] = useState(true);
  const [errorSummary, setErrorSummary] = useState<string | null>(null);
  const [errorVehicles, setErrorVehicles] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    // Busca resumo do dashboard
    setIsLoadingSummary(true);
    setErrorSummary(null);
    try {
      const data = await getDashboard();
      setSummary(data);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Erro ao carregar resumo.";
      setErrorSummary(msg);
    } finally {
      setIsLoadingSummary(false);
    }

    // Busca veículos unificados
    setIsLoadingVehicles(true);
    setErrorVehicles(null);
    try {
      const result = await getUnifiedVehicles();
      setVehicles(result.data);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Erro ao carregar veículos.";
      setErrorVehicles(msg);
    } finally {
      setIsLoadingVehicles(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    summary,
    vehicles,
    isLoadingSummary,
    isLoadingVehicles,
    errorSummary,
    errorVehicles,
    refetch: fetchData,
  };
}
