"use client";
// =============================================================================
// src/modules/tv/DiscoverModal.tsx
// =============================================================================
// O QUE FAZ:
//   Modal de descoberta automática de TVs na rede local via SSDP.
//   Ao abrir, dispara uma varredura no Backend (que emite pacotes SSDP M-SEARCH
//   e aguarda respostas por ~5 segundos). Exibe a lista de dispositivos
//   encontrados e permite cadastrar qualquer um com um clique.
//
// POR QUE UM MODAL SEPARADO?
//   A descoberta tem estado próprio e complexo (loading, resultados, erro).
//   Misturar isso no TvGrid tornaria o componente difícil de manter.
//   O DiscoverModal é auto-contido: o TvGrid só sabe que ele abriu
//   e qual IP o usuário escolheu.
// =============================================================================

import { useState, useEffect } from "react";
import { Search, Wifi, Loader2, ServerOff } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { discoverDevices } from "@/services/tv.service";
import type { DiscoveredDevice } from "@/types/api";

// =============================================================================
// PROPS
// =============================================================================
interface DiscoverModalProps {
  isOpen: boolean;
  onClose: () => void;
  /**
   * Chamado quando o usuário clica em "Cadastrar" em um dispositivo descoberto.
   * O TvGrid recebe o IP e abre o AddTvModal com ele pré-preenchido.
   */
  onSelectDevice: (ip: string) => void;
}

// =============================================================================
// COMPONENTE: DiscoverModal
// =============================================================================
export function DiscoverModal({
  isOpen,
  onClose,
  onSelectDevice,
}: DiscoverModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [devices, setDevices] = useState<DiscoveredDevice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // Inicia a varredura automaticamente ao abrir o modal
  // POR QUE automático? Reduz atrito — o usuário clicou "Descobrir TVs"
  // porque quer descobrir. Pedir que clique novamente seria redundante.
  useEffect(() => {
    if (isOpen) {
      handleDiscover();
    } else {
      // Limpa o estado ao fechar para que a próxima abertura comece do zero
      setDevices([]);
      setError(null);
      setHasSearched(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  async function handleDiscover() {
    setIsLoading(true);
    setError(null);
    setDevices([]);
    try {
      const found = await discoverDevices();
      setDevices(found);
      setHasSearched(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Erro ao realizar varredura na rede.",
      );
      setHasSearched(true);
    } finally {
      setIsLoading(false);
    }
  }

  function handleSelect(device: DiscoveredDevice) {
    onSelectDevice(device.ip);
    onClose();
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-4 w-4 text-primary" />
            Descobrir TVs na rede
          </DialogTitle>
          <DialogDescription>
            Varredura SSDP na rede local. Encontra Smart TVs e dispositivos UPnP
            compatíveis. Pode demorar até 10 segundos.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2 space-y-3">
          {/* ── Estado: Carregando ── */}
          {isLoading && (
            <div className="flex flex-col items-center gap-3 py-8 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <div className="text-center">
                <p className="text-sm font-medium">Varrendo a rede...</p>
                <p className="text-xs mt-0.5">
                  Enviando pacotes SSDP e aguardando respostas
                </p>
              </div>
            </div>
          )}

          {/* ── Estado: Erro ── */}
          {!isLoading && error && (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                <ServerOff className="h-6 w-6 text-destructive" />
              </div>
              <div>
                <p className="text-sm font-medium text-destructive">{error}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Verifique se o servidor tem acesso à rede local.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={handleDiscover}>
                Tentar novamente
              </Button>
            </div>
          )}

          {/* ── Estado: Nenhum dispositivo encontrado ── */}
          {!isLoading && hasSearched && !error && devices.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Wifi className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">
                  Nenhum dispositivo encontrado
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Certifique-se que as TVs estão ligadas e na mesma rede.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={handleDiscover}>
                Varrer novamente
              </Button>
            </div>
          )}

          {/* ── Estado: Lista de dispositivos encontrados ── */}
          {!isLoading && devices.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-medium">
                {devices.length} dispositivo{devices.length !== 1 ? "s" : ""}{" "}
                encontrado{devices.length !== 1 ? "s" : ""}
              </p>

              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {devices.map((d) => (
                  <div
                    key={d.usn ?? d.ip}
                    className="flex items-center gap-3 rounded-lg border bg-card p-3 hover:bg-muted/40 transition-colors"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10">
                      <Wifi className="h-4 w-4 text-primary" />
                    </div>

                    <div className="min-w-0 flex-1">
                      {/* IP do dispositivo — informação mais importante */}
                      <p className="text-sm font-semibold font-mono">{d.ip}</p>
                      {/* Informações do servidor UPnP (modelo/fabricante) */}
                      {d.server && (
                        <p
                          className="text-xs text-muted-foreground truncate"
                          title={d.server}
                        >
                          {d.server}
                        </p>
                      )}
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0 text-xs h-7"
                      onClick={() => handleSelect(d)}
                    >
                      Cadastrar
                    </Button>
                  </div>
                ))}
              </div>

              {/* Opção de refazer a varredura — pode ter aparecido mais TVs */}
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs text-muted-foreground"
                onClick={handleDiscover}
              >
                <Search className="h-3 w-3 mr-1.5" />
                Varrer novamente
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
