"use client";
// =============================================================================
// src/modules/tv/TvAppsModal.tsx
// =============================================================================
// O QUE FAZ:
//   Modal de catálogo de apps de Digital Signage.
//   Lista os apps disponíveis (timer, slides, fila, mensagem, relógio) e
//   permite enviar um app para uma TV via Socket.IO (/tv/cast).
//
// FLUXO:
//   1. Abre → busca GET /tv/apps
//   2. Exibe grid de cards com nome, ícone e descrição de cada app
//   3. Usuário seleciona um app → formulário de parâmetros opcionais aparece
//   4. Usuário escolhe a TV destino
//   5. Ao confirmar, monta a URL do app com os parâmetros e envia via castToSocket
//
// POR QUE PARÂMETROS COMO QUERY STRING?
//   Os apps HTML são estáticos — sem estado no servidor.
//   Os parâmetros de configuração (duração, texto, cores) são passados
//   na URL para que o app leia via URLSearchParams sem precisar de API.
// =============================================================================

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import * as tvService from "@/services/tv.service";
import type { TvApp, TvDevice } from "@/types/api";

// =============================================================================
// PROPS
// =============================================================================
interface TvAppsModalProps {
  isOpen: boolean;
  onClose: () => void;
  devices: TvDevice[];
  onSuccess: (msg: string) => void;
}

// Parâmetros extras por app (inputs para o usuário preencher)
type AppParam = {
  key: string;
  label: string;
  placeholder: string;
  type?: string;
};
const APP_PARAMS: Record<string, AppParam[]> = {
  timer: [
    {
      key: "duracao",
      label: "Duração (segundos)",
      placeholder: "300",
      type: "number",
    },
    { key: "label", label: "Texto exibido", placeholder: "Apresentação" },
  ],
  slides: [
    {
      key: "imagens",
      label: "URLs das imagens (separadas por vírgula)",
      placeholder: "https://...",
    },
    {
      key: "intervalo",
      label: "Intervalo entre slides (segundos)",
      placeholder: "5",
      type: "number",
    },
    { key: "titulo", label: "Título opcional", placeholder: "Meu Evento" },
  ],
  fila: [
    { key: "titulo", label: "Título do painel", placeholder: "Atendimento" },
    { key: "cor", label: "Cor principal (hex)", placeholder: "#3b82f6" },
  ],
  mensagem: [
    { key: "texto", label: "Mensagem principal", placeholder: "Bem-vindos" },
    {
      key: "subtitulo",
      label: "Subtítulo (opcional)",
      placeholder: "Segunda linha",
    },
    { key: "bg", label: "Cor de fundo (hex)", placeholder: "#111827" },
    { key: "cor", label: "Cor do texto (hex)", placeholder: "#ffffff" },
  ],
  relogio: [
    { key: "formato", label: "Formato do horário", placeholder: "24" },
    { key: "cor", label: "Cor do texto (hex)", placeholder: "#60a5fa" },
    { key: "bg", label: "Cor de fundo (hex)", placeholder: "#0f172a" },
  ],
};

// =============================================================================
// COMPONENTE: TvAppsModal
// =============================================================================
export function TvAppsModal({
  isOpen,
  onClose,
  devices,
  onSuccess,
}: TvAppsModalProps) {
  const [apps, setApps] = useState<TvApp[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<TvApp | null>(null);
  const [params, setParams] = useState<Record<string, string>>({});
  const [deviceId, setDeviceId] = useState("");
  const [isSending, setIsSending] = useState(false);

  // --------------------------------------------------------------------------
  // Busca a lista de apps
  // --------------------------------------------------------------------------
  const fetchApps = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await tvService.listApps();
      setApps(res.apps ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar apps.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) fetchApps();
  }, [isOpen, fetchApps]);

  // --------------------------------------------------------------------------
  // Ao selecionar um app, inicializa os parâmetros com strings vazias
  // --------------------------------------------------------------------------
  function handleSelectApp(app: TvApp) {
    setSelected(app);
    const initial: Record<string, string> = {};
    (APP_PARAMS[app.id] ?? []).forEach((p) => {
      initial[p.key] = "";
    });
    setParams(initial);
  }

  // --------------------------------------------------------------------------
  // Monta a URL do app com os parâmetros preenchidos e envia
  // --------------------------------------------------------------------------
  async function handleSend() {
    if (!selected || !deviceId) return;
    setIsSending(true);
    setError(null);
    try {
      // Constrói URL com os parâmetros não-vazios
      const baseUrl = selected.url;
      const qs = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v.trim()) qs.set(k, v.trim());
      });
      const finalUrl = qs.toString() ? `${baseUrl}?${qs.toString()}` : baseUrl;

      await tvService.castToSocket({ deviceId, tipo: "web", url: finalUrl });
      onSuccess(`App "${selected.name}" enviado para a TV!`);
      handleClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao enviar app para TV.",
      );
    } finally {
      setIsSending(false);
    }
  }

  function handleClose() {
    setSelected(null);
    setParams({});
    setDeviceId("");
    setError(null);
    onClose();
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Apps de Digital Signage</DialogTitle>
          <DialogDescription>
            Selecione um app para exibir em uma TV.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Erro */}
          {error && <p className="text-sm text-destructive">{error}</p>}

          {/* Grid de apps */}
          {!selected ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {isLoading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-24 rounded-xl" />
                  ))
                : apps.map((app) => (
                    <button
                      key={app.id}
                      onClick={() => handleSelectApp(app)}
                      className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border bg-card hover:bg-accent/50 hover:border-primary/40 transition-colors text-left"
                    >
                      <span className="text-3xl">{app.icon}</span>
                      <span className="text-sm font-semibold text-foreground">
                        {app.name}
                      </span>
                      <span className="text-xs text-muted-foreground text-center line-clamp-2">
                        {app.description}
                      </span>
                    </button>
                  ))}
            </div>
          ) : (
            // Formulário de parâmetros do app selecionado
            <div className="space-y-4">
              {/* Breadcrumb: volta ao catálogo */}
              <button
                onClick={() => setSelected(null)}
                className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                ← Voltar ao catálogo
              </button>

              <div className="flex items-center gap-3 p-3 rounded-xl bg-muted">
                <span className="text-2xl">{selected.icon}</span>
                <div>
                  <p className="font-semibold">{selected.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {selected.description}
                  </p>
                </div>
              </div>

              {/* Parâmetros específicos do app */}
              {(APP_PARAMS[selected.id] ?? []).map((p) => (
                <div key={p.key} className="space-y-1.5">
                  <Label htmlFor={`app-param-${p.key}`}>{p.label}</Label>
                  <Input
                    id={`app-param-${p.key}`}
                    type={p.type ?? "text"}
                    placeholder={p.placeholder}
                    value={params[p.key] ?? ""}
                    onChange={(e) =>
                      setParams((prev) => ({
                        ...prev,
                        [p.key]: e.target.value,
                      }))
                    }
                  />
                </div>
              ))}

              {/* Seleção de TV destino */}
              <div className="space-y-1.5">
                <Label htmlFor="app-device">TV Destino</Label>
                <select
                  id="app-device"
                  value={deviceId}
                  onChange={(e) => setDeviceId(e.target.value)}
                  className="w-full text-sm border border-input rounded-lg px-3 py-2 bg-background text-foreground"
                >
                  <option value="">Selecionar TV...</option>
                  {devices
                    .filter((d) => d.is_online)
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  {devices.filter((d) => !d.is_online).length > 0 && (
                    <optgroup label="Offline">
                      {devices
                        .filter((d) => !d.is_online)
                        .map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name} (offline)
                          </option>
                        ))}
                    </optgroup>
                  )}
                </select>
              </div>
            </div>
          )}
        </div>

        {selected && (
          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isSending}
            >
              Cancelar
            </Button>
            <Button onClick={handleSend} disabled={!deviceId || isSending}>
              {isSending ? "Enviando..." : `Enviar ${selected.icon}`}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
