// =============================================================================
// src/modules/fleet/hooks/useDispatch.ts
// =============================================================================
// O QUE FAZ:
//   Hook para gerenciar despachos e ordens de serviço.
//   Busca a lista de motoristas disponíveis e ordens ativas,
//   e expõe ações para criar/atualizar despachos.
// =============================================================================

"use client";

import { useState, useEffect, useCallback } from "react";
import { listDrivers, listVehicles } from "../services/fleet.api";
import type { Driver, Vehicle } from "../types/fleet.types";

// =============================================================================
// INTERFACE: retorno do hook
// =============================================================================
export interface UseDispatchReturn {
  availableDrivers: Driver[];
  availableVehicles: Vehicle[];
  isLoadingDrivers: boolean;
  isLoadingVehicles: boolean;
  errorDrivers: string | null;
  errorVehicles: string | null;
  refetch: () => void;
}

// =============================================================================
// HOOK: useDispatch
// =============================================================================
export function useDispatch(): UseDispatchReturn {
  const [availableDrivers, setAvailableDrivers] = useState<Driver[]>([]);
  const [availableVehicles, setAvailableVehicles] = useState<Vehicle[]>([]);
  const [isLoadingDrivers, setIsLoadingDrivers] = useState(true);
  const [isLoadingVehicles, setIsLoadingVehicles] = useState(true);
  const [errorDrivers, setErrorDrivers] = useState<string | null>(null);
  const [errorVehicles, setErrorVehicles] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    // Motoristas disponíveis (status active)
    setIsLoadingDrivers(true);
    setErrorDrivers(null);
    try {
      const result = await listDrivers({ status: "active", limit: 100 });
      setAvailableDrivers(result.data);
    } catch (err) {
      setErrorDrivers(
        err instanceof Error ? err.message : "Erro ao carregar motoristas.",
      );
    } finally {
      setIsLoadingDrivers(false);
    }

    // Veículos disponíveis (status active)
    setIsLoadingVehicles(true);
    setErrorVehicles(null);
    try {
      const result = await listVehicles({ status: "active", limit: 100 });
      setAvailableVehicles(result.data);
    } catch (err) {
      setErrorVehicles(
        err instanceof Error ? err.message : "Erro ao carregar veículos.",
      );
    } finally {
      setIsLoadingVehicles(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    availableDrivers,
    availableVehicles,
    isLoadingDrivers,
    isLoadingVehicles,
    errorDrivers,
    errorVehicles,
    refetch: fetchData,
  };
}
