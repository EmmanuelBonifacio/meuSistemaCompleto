"use client";
// =============================================================================
// src/modules/tv/TvHistoryModal.tsx
// =============================================================================
// O QUE FAZ:
//   Modal de histórico de comandos enviados para uma TV específica.
//   Busca os últimos registros de GET /tv/devices/:id/historico e os exibe
//   em uma lista com: data/hora, URL enviada, tipo de conteúdo, protocolo
//   usado e indicador de sucesso/falha.
//
// POR QUE HISTÓRICO É ÚTIL?
//   Permite ao operador auditar o que foi enviado para cada TV,
//   diagnosticar falhas ("a TV não exibiu nada — o envio falhou?") e
//   reencontrar URLs de campanhas anteriores sem precisar buscá-las.
// =============================================================================

import { useState, useEffect } from "react";
import {
  History,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  Inbox,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { getDeviceHistory } from "@/services/tv.service";
import type { TvDevice, TvCommandLog } from "@/types/api";

// =============================================================================
// PROPS
// =============================================================================
interface TvHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** TV cujo histórico será exibido. `null` quando o modal está fechado. */
  device: TvDevice | null;
}

// =============================================================================
// HELPERS
// =============================================================================

// Formata data/hora em pt-BR usando a API nativa Intl
// POR QUE Intl e não date-fns? Evita dependência extra para uma única operação.
const DATE_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatDate(isoString: string): string {
  try {
    return DATE_FORMATTER.format(new Date(isoString));
  } catch {
    return isoString;
  }
}

// Mapeia o tipo de conteúdo para um rótulo legível
const CONTENT_TYPE_LABEL: Record<string, string> = {
  video: "Vídeo",
  image: "Imagem",
  web: "Página Web",
};

// Cores do badge de tipo de conteúdo
const CONTENT_TYPE_CLASS: Record<string, string> = {
  video: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
  image:
    "bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300",
  web: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
};

// =============================================================================
// COMPONENTE: TvHistoryModal
// =============================================================================
export function TvHistoryModal({
  isOpen,
  onClose,
  device,
}: TvHistoryModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [logs, setLogs] = useState<TvCommandLog[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Carrega o histórico toda vez que o modal abre para uma TV específica
  // POR QUE no isOpen? Garante dados frescos a cada abertura — o operador
  // pode ter enviado algo desde a última vez que consultou.
  useEffect(() => {
    if (isOpen && device) {
      loadHistory();
    } else if (!isOpen) {
      setLogs([]);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, device?.id]);

  async function loadHistory() {
    if (!device) return;
    setIsLoading(true);
    setError(null);
    try {
      const history = await getDeviceHistory(device.id, 30);
      setLogs(history);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao carregar histórico.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-4 w-4 text-primary" />
            Histórico — {device?.name ?? "TV"}
          </DialogTitle>
          <DialogDescription>
            Últimos 30 comandos enviados para esta TV. Cada linha registra URL,
            protocolo utilizado e se a TV confirmou o recebimento.
          </DialogDescription>
        </DialogHeader>

        <div className="py-1">
          {/* ── Carregando ── */}
          {isLoading && (
            <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Carregando histórico...</span>
            </div>
          )}

          {/* ── Erro ── */}
          {!isLoading && error && (
            <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* ── Sem histório ── */}
          {!isLoading && !error && logs.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
              <Inbox className="h-8 w-8" />
              <p className="text-sm">Nenhum comando enviado ainda.</p>
            </div>
          )}

          {/* ── Lista de registros ── */}
          {!isLoading && logs.length > 0 && (
            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className={cn(
                    "flex items-start gap-3 rounded-lg border p-3",
                    log.success
                      ? "bg-card border-border"
                      : "bg-destructive/5 border-destructive/20",
                  )}
                >
                  {/* Ícone de sucesso ou falha — visualmente imediato */}
                  <div className="shrink-0 mt-0.5">
                    {log.success ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-destructive" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1 space-y-1">
                    {/* URL enviada (truncada, com title para hover) */}
                    <p
                      className="text-xs font-mono text-foreground truncate"
                      title={log.content_url}
                    >
                      {log.content_url}
                    </p>

                    {/* Metadados: tipo, protocolo, data */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {/* Badge de tipo de conteúdo */}
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
                          CONTENT_TYPE_CLASS[log.content_type] ??
                            "bg-muted text-muted-foreground",
                        )}
                      >
                        {CONTENT_TYPE_LABEL[log.content_type] ??
                          log.content_type}
                      </span>

                      {/* Protocolo usado (UPnP, DIAL, etc.) */}
                      {log.protocol_used && (
                        <span className="text-[10px] text-muted-foreground font-mono uppercase">
                          {log.protocol_used}
                        </span>
                      )}

                      {/* Separador visual */}
                      <span className="text-muted-foreground/40 text-[10px]">
                        ·
                      </span>

                      {/* Data e hora */}
                      <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                        <Clock className="h-2.5 w-2.5" />
                        {formatDate(log.sent_at)}
                      </span>
                    </div>

                    {/* Mensagem de erro, se houver */}
                    {!log.success && log.error_message && (
                      <p className="text-[10px] text-destructive">
                        {log.error_message}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
