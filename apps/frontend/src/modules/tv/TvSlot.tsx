"use client";
// =============================================================================
// src/modules/tv/TvSlot.tsx
// =============================================================================
// O QUE FAZ:
//   Representa visualmente um único slot na grade de TVs.
//   SLOT VAZIO:   botão dashed com "+" convida o usuário a cadastrar.
//   SLOT OCUPADO: exibe nome, IP copiável, status badge, preview do conteúdo
//                 atual e botões de ação (Enviar, WoL, Histórico, Editar, Remover).
//
// POR QUE UM COMPONENTE SEPARADO?
//   O TvGrid renderiza até 5 slots com estrutura idêntica mas dados diferentes.
//   Extrair TvSlot segue o princípio SRP: o TvGrid ORQUESTRA,
//   o TvSlot RENDERIZA — cada um mantendo seu próprio estado local
//   (ex: feedback de "IP copiado") de forma isolada.
// =============================================================================

import { useState } from "react";
import {
  Tv,
  Wifi,
  WifiOff,
  Send,
  Trash2,
  Plus,
  Pencil,
  Copy,
  Check,
  Power,
  History,
  QrCode,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TvDevice } from "@/types/api";

// =============================================================================
// PROPS
// =============================================================================
interface TvSlotProps {
  /** TV cadastrada neste slot. `undefined` = slot vazio. */
  device?: TvDevice;
  /** Número do slot (1–5) exibido quando o slot está vazio. */
  slotNumber: number;
  /** Chamado ao clicar no slot vazio ou em "+ Adicionar". */
  onAddDevice: () => void;
  /** Chamado ao clicar em "Enviar" — abre TvControlModal. */
  onSendContent: (device: TvDevice) => void;
  /** Chamado ao clicar em "Remover" — delega confirmação ao TvGrid. */
  onRemoveDevice: (deviceId: string) => void;
  /** Chamado ao clicar em "Editar" — abre EditTvModal com dados atuais. */
  onEditDevice: (device: TvDevice) => void;
  /**
   * Chamado ao clicar no botão "Ligar" (Wake-on-LAN).
   * Só é exibido quando MAC cadastrado + TV offline.
   */
  onWakeOnLan: (deviceId: string) => void;
  /** Chamado ao clicar em "Histórico" — abre TvHistoryModal. */
  onViewHistory: (device: TvDevice) => void;
  /** Chamado ao clicar em "Parear" — abre PairTvModal com QR code. */
  onPairDevice: (device: TvDevice) => void;
}

// =============================================================================
// COMPONENTE: TvSlot
// =============================================================================
export function TvSlot({
  device,
  slotNumber,
  onAddDevice,
  onSendContent,
  onRemoveDevice,
  onEditDevice,
  onWakeOnLan,
  onViewHistory,
  onPairDevice,
}: TvSlotProps) {
  // Estado local para feedback de "IP copiado"
  // POR QUE local? Cada slot tem feedback independente — copiar IP do slot 1
  // não deve afetar o slot 2. Isolar aqui elimina gerenciamento no TvGrid.
  const [copied, setCopied] = useState(false);

  async function handleCopyIp() {
    if (!device) return;
    try {
      await navigator.clipboard.writeText(device.ip_address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard pode não estar disponível em HTTP sem HTTPS
    }
  }
  // ============================================================
  // RENDERIZAÇÃO: SLOT VAZIO
  // ============================================================
  if (!device) {
    return (
      <button
        onClick={onAddDevice}
        className={cn(
          "flex flex-col items-center justify-center gap-3",
          "h-[196px] w-full rounded-xl border-2 border-dashed border-border/60",
          "bg-muted/20 text-muted-foreground cursor-pointer",
          "hover:border-primary/40 hover:bg-muted/40 hover:text-primary",
          "transition-all duration-200 group",
        )}
        aria-label={`Adicionar TV no slot ${slotNumber}`}
        title={`Slot ${slotNumber} disponível — clique para adicionar uma TV`}
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-dashed border-muted-foreground/40 group-hover:border-primary/40 transition-colors">
          <Plus className="h-5 w-5" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium">Slot {slotNumber}</p>
          <p className="text-xs opacity-60">Clique para adicionar</p>
        </div>
      </button>
    );
  }

  // ============================================================
  // RENDERIZAÇÃO: SLOT OCUPADO
  // ============================================================
  const isOnline = device.is_online;

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border bg-card p-4",
        "shadow-sm hover:shadow-md transition-shadow duration-200",
        // Borda verde suave indica status online — feedback imediato ao operador
        isOnline
          ? "border-emerald-200 dark:border-emerald-800"
          : "border-border",
      )}
    >
      {/* ── Cabeçalho: ícone + nome + status ── */}
      <div className="flex items-start gap-2.5">
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
            isOnline
              ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400"
              : "bg-muted text-muted-foreground",
          )}
        >
          <Tv className="h-4 w-4" />
        </div>

        <div className="min-w-0 flex-1">
          <p
            className="text-sm font-semibold text-foreground truncate leading-tight"
            title={device.name}
          >
            {device.name}
          </p>
          <div className="flex items-center gap-1 mt-0.5">
            {isOnline ? (
              <Wifi className="h-3 w-3 text-emerald-500 shrink-0" />
            ) : (
              <WifiOff className="h-3 w-3 text-muted-foreground shrink-0" />
            )}
            <span
              className={cn(
                "text-xs font-medium",
                isOnline
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-muted-foreground",
              )}
            >
              {isOnline ? "Online" : "Offline"}
            </span>
          </div>
        </div>
      </div>

      {/* ── IP com botão de cópia ── */}
      <div className="flex items-center gap-1.5 rounded-md bg-muted/40 px-2 py-1">
        <span
          className="text-xs font-mono text-muted-foreground truncate flex-1"
          title={device.ip_address}
        >
          {device.ip_address}
        </span>
        <button
          onClick={handleCopyIp}
          className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
          title={copied ? "IP copiado!" : "Copiar endereço IP"}
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-emerald-500" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {/* ── Preview do conteúdo atual (se houver) ── */}
      {device.current_content && (
        <div className="rounded-lg bg-muted/50 px-2.5 py-1.5">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium mb-0.5">
            Exibindo agora
          </p>
          <a
            href={device.current_content}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline truncate block"
            title={device.current_content}
          >
            {device.current_content}
          </a>
        </div>
      )}

      {/* ── Ações ── */}
      <div className="flex items-center gap-1 mt-auto pt-0.5">
        {/* Enviar conteúdo — botão principal */}
        <Button
          size="sm"
          className="flex-1 h-7 gap-1 text-xs"
          onClick={() => onSendContent(device)}
          title="Enviar conteúdo para esta TV"
        >
          <Send className="h-3 w-3" />
          Enviar
        </Button>

        {/*
          Wake-on-LAN — só visível quando TV tem MAC E está offline.
          POR QUE essa condição dupla? Não faz sentido enviar WoL para
          uma TV que já está ligada, e sem MAC o pacote não tem destino.
        */}
        {device.mac_address && !isOnline && (
          <Button
            size="icon"
            variant="outline"
            className="h-7 w-7"
            onClick={() => onWakeOnLan(device.id)}
            title="Ligar TV via Wake-on-LAN"
          >
            <Power className="h-3.5 w-3.5" />
          </Button>
        )}

        {/* Histórico de comandos enviados */}
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          onClick={() => onViewHistory(device)}
          title="Ver histórico de comandos"
        >
          <History className="h-3.5 w-3.5" />
        </Button>

        {/* Parear TV — gera QR code + URL para o receiver.html */}
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          onClick={() => onPairDevice(device)}
          title="Parear TV (gerar QR code)"
        >
          <QrCode className="h-3.5 w-3.5" />
        </Button>

        {/* Editar dados da TV */}
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          onClick={() => onEditDevice(device)}
          title="Editar TV"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>

        {/* Remover TV */}
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-muted-foreground hover:text-destructive"
          onClick={() => onRemoveDevice(device.id)}
          title="Remover TV"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
