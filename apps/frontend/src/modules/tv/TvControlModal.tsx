"use client";
// =============================================================================
// src/modules/tv/TvControlModal.tsx
// =============================================================================
// O QUE FAZ:
//   Modal para enviar uma URL/conteúdo para uma TV específica.
//   O usuário escolhe o tipo de conteúdo (web, vídeo, imagem) e insere a URL.
//
// FLUXO:
//   1. Usuário clica "Enviar conteúdo" em um slot de TV
//   2. Este modal abre com o nome da TV no título
//   3. Usuário preenche a URL e escolhe o tipo
//   4. Ao confirmar, chama tvService.controlTv()
//   5. O Backend usa UPnP/DIAL para enviar à TV
// =============================================================================

import { useState } from "react";
import { Send, Globe, Film, Image } from "lucide-react";
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
import { controlTv } from "@/services/tv.service";
import type { TvDevice, ControlTvInput } from "@/types/api";

// =============================================================================
// PROPS
// =============================================================================
interface TvControlModalProps {
  device: TvDevice | null; // TV selecionada (null = modal fechado)
  onClose: () => void; // Callback para fechar o modal
  onSuccess: (msg: string) => void; // Callback após envio bem-sucedido
}

// Tipos de conteúdo disponíveis com suas descrições
const CONTENT_TYPES: {
  value: ControlTvInput["contentType"];
  label: string;
  icon: typeof Globe;
  description: string;
}[] = [
  {
    value: "web",
    label: "Página Web",
    icon: Globe,
    description: "Abre a URL no navegador da TV (Tizen, WebOS, Android TV)",
  },
  {
    value: "video",
    label: "Vídeo / Stream",
    icon: Film,
    description: "Reproduz via UPnP AVTransport (MP4, HLS, IPTV)",
  },
  {
    value: "image",
    label: "Imagem",
    icon: Image,
    description: "Exibe imagem via UPnP AVTransport (JPG, PNG)",
  },
];

// =============================================================================
// COMPONENTE: TvControlModal
// =============================================================================
export function TvControlModal({
  device,
  onClose,
  onSuccess,
}: TvControlModalProps) {
  const [contentUrl, setContentUrl] = useState("");
  const [contentType, setContentType] =
    useState<ControlTvInput["contentType"]>("web");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Limpa o estado ao fechar o modal
  function handleClose() {
    setContentUrl("");
    setContentType("web");
    setError(null);
    onClose();
  }

  // Envia o conteúdo para a TV via Backend
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!device || !contentUrl.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await controlTv({
        deviceId: device.id,
        contentUrl: contentUrl.trim(),
        contentType,
      });

      // O Backend retorna success=true apenas se a TV confirmou o recebimento
      // POR QUE não fechar sempre? Quando a TV não responde (offline, porta errada),
      // o operador precisa saber — fechar o modal daria falsa sensação de sucesso.
      if (result.success) {
        const proto = result.protocol !== "none" ? ` via ${result.protocol.toUpperCase()}` : "";
        onSuccess(result.message ?? `Conteúdo enviado para "${device.name}"${proto}!`);
        handleClose();
      } else {
        // TV não respondeu — exibe aviso no modal sem fechá-lo
        setError(result.message ?? "A TV não respondeu ao comando. Verifique se ela está online.");
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Falha ao enviar conteúdo para a TV.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={!!device} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-4 w-4 text-primary" />
            Enviar para {device?.name}
          </DialogTitle>
          <DialogDescription>
            Escolha o tipo de conteúdo e insira a URL para exibir na TV.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Seleção do tipo de conteúdo — botões card */}
          <div>
            <Label className="text-sm font-medium mb-3 block">
              Tipo de conteúdo
            </Label>
            <div className="grid grid-cols-3 gap-2">
              {CONTENT_TYPES.map(
                ({ value, label, icon: Icon, description }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setContentType(value)}
                    className={`flex flex-col items-center gap-1.5 rounded-lg border p-3 text-center text-xs transition-all ${
                      contentType === value
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border bg-background text-muted-foreground hover:border-primary/30"
                    }`}
                    title={description}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="font-medium">{label}</span>
                  </button>
                ),
              )}
            </div>
            {/* Descrição do tipo selecionado */}
            <p className="text-xs text-muted-foreground mt-2">
              {CONTENT_TYPES.find((t) => t.value === contentType)?.description}
            </p>
          </div>

          {/* Campo de URL */}
          <div className="space-y-1.5">
            <Label htmlFor="content-url">URL do conteúdo</Label>
            <Input
              id="content-url"
              type="url"
              placeholder="https://exemplo.com/video.mp4"
              value={contentUrl}
              onChange={(e) => setContentUrl(e.target.value)}
              hasError={!!error}
              required
              autoFocus
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              isLoading={isLoading}
              disabled={!contentUrl.trim()}
            >
              <Send className="h-4 w-4" />
              Enviar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
