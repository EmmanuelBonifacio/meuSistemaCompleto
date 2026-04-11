"use client";
// =============================================================================
// src/modules/tv/MediaGallery.tsx
// =============================================================================
// O QUE FAZ:
//   Modal de galeria de mídia do tenant: lista vídeos e imagens enviados,
//   permite deletar e enviar um arquivo diretamente para uma TV via Socket.IO.
//
// FLUXO:
//   1. Abre → busca GET /tv/media
//   2. Exibe grid de cards com preview
//   3. "Enviar para TV" → chama castToSocket com tipo 'video' ou 'image'
//   4. "Excluir" → chama deleteMedia → remove do banco + disco
//   5. "Enviar Mídia" abre MediaUploadModal acima da galeria
// =============================================================================

import { useState, useEffect, useCallback } from "react";
import {
  Trash2,
  Send,
  Film,
  Image as ImageIcon,
  Upload,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MediaUploadModal } from "./MediaUploadModal";
import * as tvService from "@/services/tv.service";
import type { MediaFile, TvDevice } from "@/types/api";

// =============================================================================
// PROPS
// =============================================================================
interface MediaGalleryProps {
  isOpen: boolean;
  onClose: () => void;
  /** Lista de TVs disponíveis para seleção de destino */
  devices: TvDevice[];
  onSuccess: (msg: string) => void;
}

// =============================================================================
// COMPONENTE: MediaGallery
// =============================================================================
export function MediaGallery({
  isOpen,
  onClose,
  devices,
  onSuccess,
}: MediaGalleryProps) {
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  // ID do arquivo sendo excluído (para mostrar loading apenas nele)
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // Arquivo selecionado para enviar para TV (aguarda escolha de TV)
  const [sending, setSending] = useState<MediaFile | null>(null);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");

  // --------------------------------------------------------------------------
  // Busca a lista de arquivos de mídia
  // --------------------------------------------------------------------------
  const fetchFiles = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await tvService.listMedia();
      setFiles(res.files ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar mídias.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Carrega ao abrir o modal
  useEffect(() => {
    if (isOpen) fetchFiles();
  }, [isOpen, fetchFiles]);

  // --------------------------------------------------------------------------
  // Excluir arquivo
  // --------------------------------------------------------------------------
  async function handleDelete(file: MediaFile) {
    if (
      !window.confirm(
        `Excluir "${file.original_name}"? Esta ação não pode ser desfeita.`,
      )
    )
      return;
    setDeletingId(file.id);
    try {
      await tvService.deleteMedia(file.id);
      setFiles((prev) => prev.filter((f) => f.id !== file.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao excluir arquivo.");
    } finally {
      setDeletingId(null);
    }
  }

  // --------------------------------------------------------------------------
  // Enviar para TV
  // --------------------------------------------------------------------------
  async function handleCast() {
    if (!sending || !selectedDeviceId) return;
    const tipo = sending.mime_type.startsWith("video/") ? "video" : "image";
    try {
      await tvService.castToSocket({
        deviceId: selectedDeviceId,
        tipo,
        url: sending.url,
      });
      onSuccess(`"${sending.original_name}" enviado para a TV com sucesso!`);
      setSending(null);
      setSelectedDeviceId("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao enviar para TV.");
    }
  }

  // Quando fecha: reseta o estado de envio
  function handleClose() {
    setSending(null);
    setSelectedDeviceId("");
    onClose();
  }

  // --------------------------------------------------------------------------
  // Formata tamanho em bytes para leitura humana
  // --------------------------------------------------------------------------
  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Galeria de Mídia</DialogTitle>
            <DialogDescription>
              Gerencie vídeos e imagens para exibir nas TVs.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Barra de ações */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {files.length} arquivo{files.length !== 1 ? "s" : ""}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={fetchFiles}
                  disabled={isLoading}
                  aria-label="Recarregar"
                >
                  <RefreshCw
                    className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
                  />
                </Button>
                <Button
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setIsUploadOpen(true)}
                >
                  <Upload className="h-3.5 w-3.5" />
                  Enviar Mídia
                </Button>
              </div>
            </div>

            {/* Mensagem de erro */}
            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive rounded-lg bg-destructive/10 px-3 py-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            {/* Painel de seleção de TV para envio */}
            {sending && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                <span className="text-sm font-medium text-blue-800 dark:text-blue-200 truncate flex-1">
                  Enviar <strong>{sending.original_name}</strong> para:
                </span>
                <select
                  value={selectedDeviceId}
                  onChange={(e) => setSelectedDeviceId(e.target.value)}
                  className="text-sm border rounded-lg px-2 py-1 bg-background"
                >
                  <option value="">Selecionar TV...</option>
                  {devices.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
                <Button
                  size="sm"
                  onClick={handleCast}
                  disabled={!selectedDeviceId}
                >
                  Enviar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSending(null)}
                >
                  Cancelar
                </Button>
              </div>
            )}

            {/* Grid de arquivos */}
            {isLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-32 rounded-xl" />
                ))}
              </div>
            ) : files.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Upload className="mx-auto h-8 w-8 mb-2 opacity-40" />
                <p className="text-sm">Nenhuma mídia enviada ainda.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[50vh] overflow-y-auto pr-1">
                {files.map((file) => {
                  const isVideo = file.mime_type.startsWith("video/");
                  return (
                    <div
                      key={file.id}
                      className="group relative rounded-xl overflow-hidden bg-muted border border-border"
                    >
                      {/* Preview */}
                      <div className="aspect-video bg-black flex items-center justify-center">
                        {isVideo ? (
                          <Film className="h-8 w-8 text-blue-400 opacity-70" />
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={file.url}
                            alt={file.original_name}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        )}
                      </div>

                      {/* Info */}
                      <div className="p-2">
                        <p
                          className="text-xs font-medium truncate"
                          title={file.original_name}
                        >
                          {file.original_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatSize(file.size_bytes)}
                        </p>
                      </div>

                      {/* Ações (visíveis no hover) */}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          className="gap-1"
                          onClick={() => {
                            setSending(file);
                            setSelectedDeviceId("");
                          }}
                        >
                          <Send className="h-3 w-3" />
                          Enviar
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={deletingId === file.id}
                          onClick={() => handleDelete(file)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Sub-modal de upload — montado sobre a galeria */}
      <MediaUploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onSuccess={(newFile) => {
          setFiles((prev) => [newFile, ...prev]);
          setIsUploadOpen(false);
        }}
      />
    </>
  );
}
