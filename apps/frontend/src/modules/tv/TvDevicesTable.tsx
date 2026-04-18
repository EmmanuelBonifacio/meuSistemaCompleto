"use client";
// =============================================================================
// src/modules/tv/TvDevicesTable.tsx
// =============================================================================
// Tabela de inventário de dispositivos TV para o painel /[slug]/tv/dispositivos.
// Colunas: nome, device_role, status.
// Botão "Adicionar TV" bloqueado se limite do plano for atingido.
// =============================================================================

import { useState, useEffect, useCallback } from "react";
import {
  Tv2,
  Plus,
  Trash2,
  RefreshCw,
  ExternalLink,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AddTvModal } from "./AddTvModal";
import * as tvService from "@/services/tv.service";
import type { TvDevice, TvDeviceListResponse } from "@/types/api";

// ---------------------------------------------------------------------------
// Badges de role e status
// ---------------------------------------------------------------------------
function RoleBadge({ role }: { role: TvDevice["device_role"] }) {
  if (role === "PLATFORM_ADS") {
    return (
      <Badge className="bg-purple-100 text-purple-800 border-purple-200 hover:bg-purple-100 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800">
        TV da Plataforma
      </Badge>
    );
  }
  return (
    <Badge className="bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800">
      Cliente
    </Badge>
  );
}

function StatusBadge({ isOnline }: { isOnline: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className={`h-2 w-2 rounded-full ${isOnline ? "bg-emerald-500" : "bg-zinc-400"}`}
      />
      <span
        className={`text-xs font-medium ${isOnline ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"}`}
      >
        {isOnline ? "Online" : "Offline"}
      </span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// COMPONENTE PRINCIPAL
// ---------------------------------------------------------------------------
export function TvDevicesTable() {
  const [listData, setListData] = useState<TvDeviceListResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const fetchDevices = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await tvService.listDevices();
      setListData(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao carregar dispositivos.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  function handleSuccess(msg: string) {
    setSuccessMsg(msg);
    setTimeout(() => {
      setSuccessMsg(null);
      fetchDevices();
    }, 3000);
  }

  async function handleRemove(device: TvDevice) {
    if (
      !window.confirm(
        `Remover "${device.name}"? Esta ação não pode ser desfeita.`,
      )
    )
      return;
    try {
      await tvService.removeDevice(device.id);
      handleSuccess(`TV "${device.name}" removida com sucesso!`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao remover TV.");
    }
  }

  const devices = listData?.devices ?? [];
  const limitReached =
    listData != null && listData.slots_disponiveis <= 0;

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Tv2 className="h-5 w-5 text-primary" />
            Dispositivos TV
          </h2>
          {listData && (
            <p className="text-sm text-muted-foreground mt-0.5">
              Você usa{" "}
              <strong>
                {listData.limite_maximo - listData.slots_disponiveis}
              </strong>{" "}
              de <strong>{listData.limite_maximo}</strong> TVs do seu plano.
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Abrir Xibo */}
          <Button variant="ghost" size="sm" className="gap-1.5" asChild>
            <a
              href="http://cms.seudominio.com"
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Painel Xibo
            </a>
          </Button>

          {/* Refresh */}
          <Button
            variant="ghost"
            size="icon"
            onClick={fetchDevices}
            disabled={isLoading}
            aria-label="Recarregar"
          >
            <RefreshCw
              className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
            />
          </Button>

          {/* Adicionar TV */}
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => setIsAddModalOpen(true)}
            disabled={limitReached || isLoading}
            title={
              limitReached
                ? "Limite de TVs do plano atingido. Solicite um upgrade."
                : "Adicionar nova TV"
            }
          >
            <Plus className="h-4 w-4" />
            Adicionar TV
          </Button>
        </div>
      </div>

      {/* Alerta de limite */}
      {limitReached && (
        <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Limite de TVs do seu plano atingido. Acesse{" "}
          <strong className="mx-1">TV &rsaquo; Plano</strong> para solicitar
          upgrade.
        </div>
      )}

      {/* Mensagem de sucesso */}
      {successMsg && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300">
          <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
          {successMsg}
        </div>
      )}

      {/* Erro */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto text-xs"
            onClick={fetchDevices}
          >
            Tentar novamente
          </Button>
        </div>
      )}

      {/* Tabela */}
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Nome</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tipo</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">IP</th>
              <th className="w-12 px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 5 }).map((__, j) => (
                    <td key={j} className="px-4 py-3">
                      <Skeleton className="h-4 w-full" />
                    </td>
                  ))}
                </tr>
              ))
            ) : devices.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="py-12 text-center text-muted-foreground"
                >
                  <Tv2 className="mx-auto mb-2 h-8 w-8 opacity-20" />
                  Nenhum dispositivo cadastrado.
                </td>
              </tr>
            ) : (
              devices.map((device) => (
                <tr key={device.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{device.name}</td>
                  <td className="px-4 py-3">
                    <RoleBadge role={device.device_role} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge isOnline={device.is_online} />
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {device.ip_address}
                  </td>
                  <td className="px-4 py-3">
                    {device.device_role === "CLIENT" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive h-8 w-8"
                        onClick={() => handleRemove(device)}
                        aria-label={`Remover ${device.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal de adicionar TV */}
      <AddTvModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
