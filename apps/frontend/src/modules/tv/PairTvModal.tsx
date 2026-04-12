"use client";
// =============================================================================
// src/modules/tv/PairTvModal.tsx
// =============================================================================
// O QUE FAZ:
//   Modal de pareamento de TV. Exibe o QR code e a URL que o operador deve
//   abrir no browser da TV para conectá-la ao WebSocket do backend.
//
// FLUXO DE PAREAMENTO:
//   1. Operador clica em "Parear" no TvSlot
//   2. Este modal abre e busca GET /tv/devices/:id/token (token existente)
//   3. Exibe o QR code gerado pelo backend (data URL base64)
//   4. Operador escaneia o QR code com a TV ou digita a URL manualmente
//   5. TV abre receiver.html com os parâmetros corretos
//   6. receiver.html conecta ao WebSocket → TV aparece online no painel
//
// BOTÃO "GERAR NOVO TOKEN":
//   Chama POST /pair — invalida o token atual e gera um novo.
//   Use apenas ao reparear (troca de TV, token comprometido).
// =============================================================================

import { useState, useEffect } from "react";
import {
  RefreshCw,
  Copy,
  Check,
  QrCode,
  Loader2,
  AlertCircle,
  Link,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import * as tvService from "@/services/tv.service";
import type { TvDevice, PairDeviceResponse } from "@/types/api";

// =============================================================================
// PROPS
// =============================================================================
interface PairTvModalProps {
  /** TV a ser pareada. `null` fecha o modal. */
  device: TvDevice | null;
  /** Fechamento do modal */
  onClose: () => void;
}

// =============================================================================
// COMPONENTE: PairTvModal
// =============================================================================
export function PairTvModal({ device, onClose }: PairTvModalProps) {
  const [loading, setLoading] = useState(false);
  const [repairLoading, setRepairLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pairData, setPairData] = useState<PairDeviceResponse | null>(null);
  const [copied, setCopied] = useState(false);

  // ──────────────────────────────────────────────────────────────────────────
  // Ao abrir o modal, busca o token atual (sem rotacionar)
  // ──────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!device) {
      setPairData(null);
      setError(null);
      return;
    }
    loadCurrentToken();
  }, [device]);

  async function loadCurrentToken() {
    if (!device) return;
    setLoading(true);
    setError(null);
    try {
      const data = await tvService.getDeviceToken(device.id);
      setPairData(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Erro ao carregar token de pareamento.",
      );
    } finally {
      setLoading(false);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Gera um novo token (invalida o atual — desconecta receiver existente)
  // ──────────────────────────────────────────────────────────────────────────
  async function handleRePair() {
    if (!device) return;
    setRepairLoading(true);
    setError(null);
    try {
      const data = await tvService.pairDevice(device.id);
      setPairData(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao gerar novo token.",
      );
    } finally {
      setRepairLoading(false);
    }
  }

  async function handleCopyUrl() {
    if (!pairData?.receiverUrl) return;
    try {
      await navigator.clipboard.writeText(pairData.receiverUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard pode não estar disponível em HTTP
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Renderização
  // ──────────────────────────────────────────────────────────────────────────
  return (
    <Dialog open={!!device} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-4 w-4" />
            Parear TV
          </DialogTitle>
          <DialogDescription>
            {device?.name} — abra o link abaixo no browser da TV
          </DialogDescription>
        </DialogHeader>

        {/* ── Estado: carregando ── */}
        {loading && (
          <div className="flex flex-col items-center gap-3 py-10">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Carregando token...</p>
          </div>
        )}

        {/* ── Estado: erro ── */}
        {!loading && error && (
          <div className="flex flex-col items-center gap-3 py-6">
            <div className="flex items-center gap-2 text-destructive text-sm">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
            <Button variant="outline" size="sm" onClick={loadCurrentToken}>
              Tentar novamente
            </Button>
          </div>
        )}

        {/* ── Estado: dados carregados ── */}
        {!loading && !error && pairData && (
          <div className="flex flex-col items-center gap-4">
            {/* QR Code */}
            {pairData.qrCodeDataUrl ? (
              <div className="rounded-xl border bg-white p-3 shadow-sm">
                <img
                  src={pairData.qrCodeDataUrl}
                  alt="QR Code para parear a TV"
                  className="block w-52 h-52"
                />
              </div>
            ) : (
              <div className="flex h-52 w-52 items-center justify-center rounded-xl border bg-muted">
                <QrCode className="h-14 w-14 text-muted-foreground" />
              </div>
            )}

            {/* Instrução */}
            <p className="text-center text-sm text-muted-foreground px-2">
              Escaneie o QR code ou copie a URL abaixo e abra no{" "}
              <strong>browser da TV</strong>.
            </p>

            {/* URL copiável */}
            <div className="w-full relative">
              <div
                className={cn(
                  "flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2",
                  "text-xs font-mono text-muted-foreground overflow-hidden",
                )}
              >
                <Link className="h-3 w-3 shrink-0 text-muted-foreground" />
                <span className="truncate flex-1" title={pairData.receiverUrl}>
                  {pairData.receiverUrl}
                </span>
                <button
                  onClick={handleCopyUrl}
                  className="shrink-0 text-muted-foreground hover:text-foreground transition-colors ml-1"
                  title={copied ? "Copiado!" : "Copiar URL"}
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </div>

            {/* Botão de reparear */}
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2 text-xs"
              onClick={handleRePair}
              disabled={repairLoading}
            >
              {repairLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Gerar novo token (reparear)
            </Button>

            <p className="text-[11px] text-muted-foreground text-center leading-relaxed px-2">
              Gerar novo token <strong>desconecta</strong> o receiver atual. Use
              apenas ao trocar de TV ou se o link anterior parou de funcionar.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
