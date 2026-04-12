"use client";
// =============================================================================
// src/modules/tv/TvGrid.tsx
// =============================================================================
// O QUE FAZ:
//   Componente principal do módulo TV. Orquestra a grade de 5 slots,
//   todos os modais e a comunicação com o Backend.
//
// ARQUITETURA DO MÓDULO TV:
//   TvGrid (este arquivo) — orquestra tudo
//   ├── TvSlot        — renderiza slot individual (vazio ou ocupado)
//   ├── AddTvModal    — cadastrar nova TV (aceita IP pré-preenchido da descoberta)
//   ├── EditTvModal   — editar TV existente
//   ├── TvControlModal — enviar conteúdo para TV
//   ├── DiscoverModal — varredura SSDP para descobrir TVs na rede
//   └── TvHistoryModal — histórico de comandos enviados para uma TV
//
// POR QUE 5 SLOTS FIXOS?
//   Limite do Backend (TV_MAX_LIMIT = 5 por tenant). Mostrar os 5 sempre
//   dá visibilidade imediata: quantas TVs tenho e quantos slots livres.
//
// POLLING DE STATUS:
//   A cada 30 segundos, o grid atualiza silenciosamente (sem spinner global).
//   POR QUE 30s? Balanceio entre frescor dos dados e carga no servidor.
//   POR QUE silencioso? Não interromper o operador que pode estar interagindo
//   com os modais.
// =============================================================================

import { useState, useEffect, useCallback, useRef } from "react";
import {
  RefreshCw,
  Wifi,
  AlertCircle,
  FolderOpen,
  LayoutGrid,
  Monitor,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TvSlot } from "./TvSlot";
import { AddTvModal } from "./AddTvModal";
import { EditTvModal } from "./EditTvModal";
import { TvControlModal } from "./TvControlModal";
import { DiscoverModal } from "./DiscoverModal";
import { TvHistoryModal } from "./TvHistoryModal";
import { MediaGallery } from "./MediaGallery";
import { TvAppsModal } from "./TvAppsModal";
import { ScreenShareModal } from "./ScreenShareModal";
import { PairTvModal } from "./PairTvModal";
import * as tvService from "@/services/tv.service";
import type { TvDevice } from "@/types/api";

// Espelha TV_MAX_LIMIT do Backend
const TV_MAX_SLOTS = 5;

// Intervalo de polling silencioso (em ms)
const POLLING_INTERVAL_MS = 30_000;

// =============================================================================
// COMPONENTE: TvGrid
// =============================================================================
export function TvGrid() {
  // ── Dados ──────────────────────────────────────────────────────────────────
  const [devices, setDevices] = useState<TvDevice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // ── Modais ─────────────────────────────────────────────────────────────────
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<TvDevice | null>(null);
  const [editDevice, setEditDevice] = useState<TvDevice | null>(null);
  const [historyDevice, setHistoryDevice] = useState<TvDevice | null>(null);
  const [isDiscoverOpen, setIsDiscoverOpen] = useState(false);
  // Modais de novas funcionalidades
  const [isMediaGalleryOpen, setIsMediaGalleryOpen] = useState(false);
  const [isTvAppsOpen, setIsTvAppsOpen] = useState(false);
  const [isScreenShareOpen, setIsScreenShareOpen] = useState(false);
  // TV a ser pareada via QR code (null = modal fechado)
  const [pairDevice, setPairDevice] = useState<TvDevice | null>(null);

  // IP pré-preenchido vindo da descoberta SSDP
  const [prefilledIp, setPrefilledIp] = useState<string>("");

  // Ref para o timer de polling — evita leak de memória ao desmontar
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ==========================================================================
  // FUNÇÃO: fetchDevices — busca a lista de TVs do Backend
  // `silent = true` não exibe spinner (usado pelo polling)
  // ==========================================================================
  const fetchDevices = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    setError(null);
    try {
      const response = await tvService.listDevices();
      const list = response.devices ?? (response as any).data ?? [];
      setDevices(list);
    } catch (err) {
      // Erros silenciosos de polling não sobrescrevem mensagem de sucesso
      if (!silent) {
        setError(
          err instanceof Error ? err.message : "Erro ao carregar dispositivos.",
        );
      }
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, []);

  // Carrega ao montar e inicia o polling silencioso
  useEffect(() => {
    fetchDevices();

    // Polling periódico: atualiza status sem interromper o operador
    pollingRef.current = setInterval(() => {
      fetchDevices(true);
    }, POLLING_INTERVAL_MS);

    return () => {
      // Limpa o interval ao desmontar para evitar chamadas "orphan"
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [fetchDevices]);

  // ==========================================================================
  // FUNÇÃO: handleSuccess — exibe feedback de sucesso e recarrega a lista
  // ==========================================================================
  function handleSuccess(msg: string) {
    setSuccessMsg(msg);
    setTimeout(() => {
      setSuccessMsg(null);
      fetchDevices();
    }, 3000);
  }

  // ==========================================================================
  // FUNÇÃO: handleRemoveDevice — remove TV após confirmação nativa do browser
  // POR QUE window.confirm? Operação destrutiva e irreversível.
  // ==========================================================================
  async function handleRemoveDevice(deviceId: string) {
    const device = devices.find((d) => d.id === deviceId);
    if (
      !window.confirm(
        `Remover "${device?.name}"? Esta ação não pode ser desfeita.`,
      )
    ) {
      return;
    }
    try {
      await tvService.removeDevice(deviceId);
      handleSuccess(`TV "${device?.name}" removida com sucesso!`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao remover TV.");
    }
  }

  // ==========================================================================
  // FUNÇÃO: handleWakeOnLan — envia magic packet UDP para ligar a TV
  // ==========================================================================
  async function handleWakeOnLan(deviceId: string) {
    const device = devices.find((d) => d.id === deviceId);
    try {
      await tvService.wolDevice(deviceId);
      handleSuccess(
        `Pacote Wake-on-LAN enviado para "${device?.name}". ` +
          `A TV pode levar alguns segundos para ligar.`,
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : `Falha ao enviar Wake-on-LAN para "${device?.name}".`,
      );
    }
  }

  // ==========================================================================
  // FUNÇÃO: handleSelectDiscovered — recebe IP escolhido na descoberta SSDP
  // e abre o AddTvModal pré-preenchido
  // ==========================================================================
  function handleSelectDiscovered(ip: string) {
    setPrefilledIp(ip);
    setIsDiscoverOpen(false);
    setIsAddModalOpen(true);
  }

  // Quando o AddTvModal fecha, limpa o IP pré-preenchido
  function handleAddModalClose() {
    setIsAddModalOpen(false);
    setPrefilledIp("");
  }

  // ==========================================================================
  // MONTAGEM DA GRADE: 5 slots fixos
  // ==========================================================================
  const safeDevices = devices ?? [];
  const slots = Array.from({ length: TV_MAX_SLOTS }, (_, i) => safeDevices[i]);

  // ==========================================================================
  // RENDERIZAÇÃO
  // ==========================================================================
  return (
    <div className="space-y-6">
      {/* ── Cabeçalho ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            Controle de TVs
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isLoading
              ? "Carregando..."
              : `${safeDevices.length} de ${TV_MAX_SLOTS} slots utilizados`}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          {/* Galeria de mídia (upload de vídeos/imagens) */}
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setIsMediaGalleryOpen(true)}
          >
            <FolderOpen className="h-3.5 w-3.5" />
            Mídia
          </Button>

          {/* Catálogo de apps de Digital Signage */}
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setIsTvAppsOpen(true)}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            Apps
          </Button>

          {/* Espelhamento de tela via WebRTC */}
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setIsScreenShareOpen(true)}
          >
            <Monitor className="h-3.5 w-3.5" />
            Espelhar Tela
          </Button>

          {/* Descoberta automática via SSDP */}
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setIsDiscoverOpen(true)}
          >
            <Wifi className="h-3.5 w-3.5" />
            Descobrir TVs
          </Button>

          {/* Refresh manual (não cancela o polling automático) */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => fetchDevices()}
            disabled={isLoading}
            aria-label="Recarregar lista de TVs"
          >
            <RefreshCw
              className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
            />
          </Button>
        </div>
      </div>

      {/* ── Mensagem de sucesso ── */}
      {successMsg && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800 animate-fade-in dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300">
          <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
          {successMsg}
        </div>
      )}

      {/* ── Mensagem de erro ── */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto text-destructive hover:text-destructive text-xs"
            onClick={() => fetchDevices()}
          >
            Tentar novamente
          </Button>
        </div>
      )}

      {/* ── Grade de 5 slots ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {isLoading
          ? Array.from({ length: TV_MAX_SLOTS }).map((_, i) => (
              <Skeleton key={i} className="h-[196px] rounded-xl" />
            ))
          : slots.map((device, index) => (
              <TvSlot
                key={device?.id ?? `empty-${index}`}
                device={device}
                slotNumber={index + 1}
                onAddDevice={() => setIsAddModalOpen(true)}
                onSendContent={(dev) => setSelectedDevice(dev)}
                onRemoveDevice={handleRemoveDevice}
                onEditDevice={(dev) => setEditDevice(dev)}
                onWakeOnLan={handleWakeOnLan}
                onViewHistory={(dev) => setHistoryDevice(dev)}
                onPairDevice={(dev) => setPairDevice(dev)}
              />
            ))}
      </div>

      {/* ── Modais ── */}

      {/* Cadastrar nova TV (com IP opcionalmente pré-preenchido da descoberta) */}
      <AddTvModal
        isOpen={isAddModalOpen}
        onClose={handleAddModalClose}
        onSuccess={handleSuccess}
        initialValues={prefilledIp ? { ip_address: prefilledIp } : undefined}
      />

      {/* Editar TV existente */}
      <EditTvModal
        isOpen={!!editDevice}
        device={editDevice}
        onClose={() => setEditDevice(null)}
        onSuccess={handleSuccess}
      />

      {/* Enviar conteúdo para TV */}
      <TvControlModal
        device={selectedDevice}
        onClose={() => setSelectedDevice(null)}
        onSuccess={handleSuccess}
      />

      {/* Descoberta SSDP */}
      <DiscoverModal
        isOpen={isDiscoverOpen}
        onClose={() => setIsDiscoverOpen(false)}
        onSelectDevice={handleSelectDiscovered}
      />

      {/* Histórico de comandos da TV */}
      <TvHistoryModal
        isOpen={!!historyDevice}
        device={historyDevice}
        onClose={() => setHistoryDevice(null)}
      />

      {/* Galeria de mídia (vídeos e imagens enviados pelo tenant) */}
      <MediaGallery
        isOpen={isMediaGalleryOpen}
        onClose={() => setIsMediaGalleryOpen(false)}
        devices={safeDevices}
        onSuccess={handleSuccess}
      />

      {/* Catálogo de apps de Digital Signage */}
      <TvAppsModal
        isOpen={isTvAppsOpen}
        onClose={() => setIsTvAppsOpen(false)}
        devices={safeDevices}
        onSuccess={handleSuccess}
      />

      {/* Espelhamento de tela via WebRTC P2P */}
      <ScreenShareModal
        isOpen={isScreenShareOpen}
        onClose={() => setIsScreenShareOpen(false)}
        devices={safeDevices}
        onSuccess={handleSuccess}
      />

      {/* Pareamento de TV — QR code + receiverUrl */}
      <PairTvModal
        device={pairDevice}
        onClose={() => setPairDevice(null)}
      />
    </div>
  );
}
