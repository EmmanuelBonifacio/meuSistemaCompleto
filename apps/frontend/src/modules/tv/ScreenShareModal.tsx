"use client";
// =============================================================================
// src/modules/tv/ScreenShareModal.tsx
// =============================================================================
// O QUE FAZ:
//   Modal para iniciar espelhamento de tela em uma TV via WebRTC.
//   O operador seleciona a TV destino e o sistema abre a página de
//   compartilhamento em nova aba e notifica a TV para aguardar a conexão P2P.
//
// FLUXO:
//   1. Operador abre o modal e seleciona a TV destino
//   2. Clica em "Iniciar Espelhamento"
//   3. Backend recebe POST /tv/cast { tipo: 'screen-share', deviceId }
//      → backend envia 'cast:screen-share' para o receiver.html da TV via Socket.IO
//      → TV entra no namespace /webrtc/:tenantId aguardando oferta
//   4. Abre /static/screen-share.html?tenantId=...&deviceId=... em nova aba
//      → Operador seleciona janela/tela para compartilhar
//      → screen-share.html cria oferta WebRTC e a TV responde
//      → Conexão P2P estabelecida — mídia flui diretamente (sem passar pelo backend)
//
// POR QUE NOVA ABA PARA screen-share.html?
//   A captura de tela (getDisplayMedia) requer que a página SEJA a aba ativa
//   que o usuário quer compartilhar, ou que o browser exiba o seletor nativo.
//   Abrir em nova aba dá ao operador contexto completo do seletor nativo.
//
// POR QUE NÃO USAR O WEBRTC DIRETAMENTE NO PAINEL?
//   O painel é um dashboard de gestão — o operador pode querer compartilhar
//   qualquer janela do sistema, não apenas o próprio painel.
//   A página dedicada screen-share.html é mais limpa e focada para esse propósito.
// =============================================================================

import { useState } from "react";
import { Monitor, ExternalLink, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import * as tvService from "@/services/tv.service";
import type { TvDevice } from "@/types/api";
import { useAuth } from "@/hooks/useAuth";

// URL base do backend — para construir a URL da página screen-share.html
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

// =============================================================================
// PROPS
// =============================================================================
interface ScreenShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  devices: TvDevice[];
  onSuccess: (msg: string) => void;
}

// =============================================================================
// COMPONENTE: ScreenShareModal
// =============================================================================
export function ScreenShareModal({
  isOpen,
  onClose,
  devices,
  onSuccess,
}: ScreenShareModalProps) {
  const { user } = useAuth();
  const [deviceId, setDeviceId] = useState("");
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleStart() {
    if (!deviceId || !user?.tenantId) return;
    setIsStarting(true);
    setError(null);

    try {
      // Passo 1: Notifica o backend que esta TV deve aguardar WebRTC
      await tvService.castToSocket({ deviceId, tipo: "screen-share" });

      // Passo 2: Abre a página de compartilhamento em nova aba
      // A página conecta ao namespace /webrtc/:tenantId e inicia o P2P
      const url = new URL(`${BACKEND_URL}/static/screen-share.html`);
      url.searchParams.set("tenantId", user.tenantId);
      url.searchParams.set("deviceId", deviceId);
      window.open(url.toString(), "_blank", "noopener,noreferrer");

      const deviceName = devices.find((d) => d.id === deviceId)?.name ?? "TV";
      onSuccess(
        `Espelhamento iniciado para "${deviceName}". Continue na nova aba.`,
      );
      handleClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao iniciar espelhamento.",
      );
    } finally {
      setIsStarting(false);
    }
  }

  function handleClose() {
    setDeviceId("");
    setError(null);
    onClose();
  }

  const onlineDevices = devices.filter((d) => d.is_online);
  const offlineDevices = devices.filter((d) => !d.is_online);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Monitor className="h-5 w-5" />
            Espelhar Tela na TV
          </DialogTitle>
          <DialogDescription>
            Compartilhe sua tela diretamente para uma TV via WebRTC P2P.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Como funciona */}
          <div className="rounded-xl bg-muted/50 p-4 space-y-2 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Como funciona:</p>
            <ol className="space-y-1 list-decimal list-inside">
              <li>Selecione a TV destino abaixo</li>
              <li>Clique em &apos;Iniciar Espelhamento&apos;</li>
              <li>
                Uma nova aba abrirá — selecione a janela para compartilhar
              </li>
              <li>A TV exibirá sua tela em tempo real (P2P, sem servidor)</li>
            </ol>
          </div>

          {/* Seleção de TV */}
          <div className="space-y-2">
            <Label htmlFor="screen-share-device">TV Destino</Label>
            {devices.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma TV cadastrada.
              </p>
            ) : (
              <select
                id="screen-share-device"
                value={deviceId}
                onChange={(e) => setDeviceId(e.target.value)}
                className="w-full text-sm border border-input rounded-lg px-3 py-2 bg-background text-foreground"
              >
                <option value="">Selecionar TV...</option>
                {onlineDevices.map((d) => (
                  <option key={d.id} value={d.id}>
                    🟢 {d.name}
                  </option>
                ))}
                {offlineDevices.length > 0 && (
                  <optgroup label="Offline (receiver.html pode não estar ativo)">
                    {offlineDevices.map((d) => (
                      <option key={d.id} value={d.id}>
                        🔴 {d.name}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            )}
          </div>

          {/* Alerta sobre nova aba */}
          {deviceId && (
            <div className="flex items-start gap-2 text-sm text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/30 rounded-xl p-3">
              <ExternalLink className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                Uma nova aba será aberta para capturar a tela. Certifique-se de
                que popups estão permitidos para esta página.
              </span>
            </div>
          )}

          {/* Erro */}
          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isStarting}>
            Cancelar
          </Button>
          <Button
            onClick={handleStart}
            disabled={!deviceId || isStarting || !user?.tenantId}
            className="gap-1.5"
          >
            <Monitor className="h-4 w-4" />
            {isStarting ? "Iniciando..." : "Iniciar Espelhamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
