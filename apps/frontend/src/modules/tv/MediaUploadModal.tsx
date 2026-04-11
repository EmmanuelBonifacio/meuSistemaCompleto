"use client";
// =============================================================================
// src/modules/tv/MediaUploadModal.tsx
// =============================================================================
// O QUE FAZ:
//   Modal para upload de arquivos de mídia (vídeo ou imagem) para o sistema.
//   Suporta arrastar & soltar ou seletor de arquivo nativo.
//
// FLUXO:
//   1. Usuário arrasta um arquivo ou clica em "Selecionar Arquivo"
//   2. Validação client-side: tipo MIME e tamanho (100 MB max)
//   3. Ao confirmar, chama tvService.uploadMedia(file) → POST /tv/media/upload
//   4. Backend salva em /uploads/{tenantSlug}/{uuid}.ext
//   5. onSuccess é chamado com o arquivo criado
//
// POR QUE VALIDAR NO FRONT E NO BACK?
//   Front: feedback imediato ao usuário antes de fazer upload desnecessário
//   Back: defesa real contra arquivos maliciosos (nunca confiar só no front)
// =============================================================================

import { useState, useRef, DragEvent, ChangeEvent } from "react";
import {
  Upload,
  X,
  Film,
  Image as ImageIcon,
  CheckCircle2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import * as tvService from "@/services/tv.service";
import type { MediaFile } from "@/types/api";

// Tipos aceitos — espelha ALLOWED_MIME_TYPES do backend
const ALLOWED_MIME = [
  "video/mp4",
  "video/webm",
  "video/ogg",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];
const MAX_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB

// =============================================================================
// PROPS
// =============================================================================
interface MediaUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (file: MediaFile) => void;
}

// =============================================================================
// COMPONENTE: MediaUploadModal
// =============================================================================
export function MediaUploadModal({
  isOpen,
  onClose,
  onSuccess,
}: MediaUploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadDone, setUploadDone] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --------------------------------------------------------------------------
  // Valida o arquivo selecionado (tipo e tamanho)
  // --------------------------------------------------------------------------
  function validateFile(f: File): string | null {
    if (!ALLOWED_MIME.includes(f.type)) {
      return `Tipo não suportado: "${f.type}". Use MP4, WebM, OGG, JPEG, PNG, GIF ou WebP.`;
    }
    if (f.size > MAX_SIZE_BYTES) {
      return `Arquivo muito grande: ${(f.size / 1024 / 1024).toFixed(1)} MB. Máximo: 100 MB.`;
    }
    return null;
  }

  function selectFile(f: File) {
    const err = validateFile(f);
    if (err) {
      setValidationError(err);
      setFile(null);
    } else {
      setValidationError(null);
      setFile(f);
    }
  }

  // --------------------------------------------------------------------------
  // Handlers de drag & drop
  // --------------------------------------------------------------------------
  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(true);
  }

  function handleDragLeave() {
    setDragOver(false);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) selectFile(dropped);
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    if (picked) selectFile(picked);
  }

  // --------------------------------------------------------------------------
  // Upload
  // --------------------------------------------------------------------------
  async function handleUpload() {
    if (!file) return;
    setIsUploading(true);
    try {
      const created = await tvService.uploadMedia(file);
      setUploadDone(true);
      setTimeout(() => {
        onSuccess(created);
        handleClose();
      }, 1000);
    } catch (err) {
      setValidationError(
        err instanceof Error ? err.message : "Erro ao enviar arquivo.",
      );
    } finally {
      setIsUploading(false);
    }
  }

  function handleClose() {
    if (isUploading) return;
    setFile(null);
    setValidationError(null);
    setUploadDone(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    onClose();
  }

  // Determina ícone pelo tipo do arquivo
  const fileIcon = file?.type.startsWith("video/") ? (
    <Film className="h-6 w-6 text-blue-400" />
  ) : (
    <ImageIcon className="h-6 w-6 text-emerald-400" />
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Enviar Mídia
          </DialogTitle>
          <DialogDescription>
            Adicione vídeos ou imagens para exibir nas TVs.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Zona de drop */}
          {!file && !uploadDone && (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`
                border-2 border-dashed rounded-xl p-8 text-center cursor-pointer
                transition-colors duration-150 select-none
                ${
                  dragOver
                    ? "border-blue-400 bg-blue-50 dark:bg-blue-950/30"
                    : "border-muted-foreground/30 hover:border-muted-foreground/50"
                }
              `}
            >
              <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
              <p className="text-sm font-medium text-foreground">
                Arraste um arquivo aqui
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                ou clique para selecionar
              </p>
              <p className="text-xs text-muted-foreground mt-3">
                MP4, WebM, OGG, JPEG, PNG, GIF, WebP · máx 100 MB
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept={ALLOWED_MIME.join(",")}
                className="sr-only"
                onChange={handleFileChange}
              />
            </div>
          )}

          {/* Arquivo selecionado */}
          {file && !uploadDone && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-muted">
              {fileIcon}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(file.size / 1024 / 1024).toFixed(2)} MB · {file.type}
                </p>
              </div>
              {!isUploading && (
                <button
                  onClick={() => {
                    setFile(null);
                    setValidationError(null);
                  }}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Remover arquivo"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          )}

          {/* Upload em andamento */}
          {isUploading && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Enviando...</p>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full w-1/2 bg-primary rounded-full animate-pulse" />
              </div>
            </div>
          )}

          {/* Upload concluído */}
          {uploadDone && (
            <div className="flex items-center gap-2 text-emerald-600 text-sm font-medium">
              <CheckCircle2 className="h-5 w-5" />
              Arquivo enviado com sucesso!
            </div>
          )}

          {/* Erro de validação */}
          {validationError && (
            <p className="text-sm text-destructive">{validationError}</p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isUploading}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleUpload}
            disabled={!file || isUploading || uploadDone}
          >
            {isUploading ? "Enviando..." : "Enviar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
