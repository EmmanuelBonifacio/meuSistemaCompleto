// =============================================================================
// CropImageModal — seleciona a área visível da foto antes do upload
// =============================================================================
// Exibe a imagem original em um frame arrastável. O usuário posiciona
// a imagem para escolher o enquadramento desejado (como o Instagram faz).
// Ao confirmar, exporta via canvas apenas a área selecionada como WebP/JPEG.
// =============================================================================

"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Check, X, Move } from "lucide-react";

// Dimensão máxima do frame de corte na tela (px)
const MAX_DIM = 300;

// Opções de proporção disponíveis ao usuário
const ASPECT_OPTIONS: { label: string; value: number | "original" }[] = [
  { label: "1:1", value: 1 },
  { label: "4:3", value: 4 / 3 },
  { label: "3:4", value: 3 / 4 },
  { label: "Original", value: "original" },
];

export interface CropImageModalProps {
  file: File;
  onConfirm: (croppedFile: File) => void;
  onCancel: () => void;
}

export function CropImageModal({
  file,
  onConfirm,
  onCancel,
}: CropImageModalProps) {
  const [imageSrc, setImageSrc] = useState<string>("");
  const [naturalW, setNaturalW] = useState(0);
  const [naturalH, setNaturalH] = useState(0);
  const [selectedAspect, setSelectedAspect] = useState<number | "original">(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const dragStartRef = useRef<{
    mx: number;
    my: number;
    ox: number;
    oy: number;
  } | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // Cria object URL da imagem original (sem processar)
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setImageSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Proporção efetiva: "original" usa a proporção natural da imagem
  const aspectRatio =
    selectedAspect === "original"
      ? naturalW > 0 && naturalH > 0
        ? naturalW / naturalH
        : 1
      : selectedAspect;

  // Tamanho do frame de corte (nunca excede MAX_DIM em nenhum eixo)
  const cropW = aspectRatio >= 1 ? MAX_DIM : Math.round(MAX_DIM * aspectRatio);
  const cropH = aspectRatio >= 1 ? Math.round(MAX_DIM / aspectRatio) : MAX_DIM;

  // Escala para que a imagem cubra o frame (cover)
  const scale =
    naturalW > 0 && naturalH > 0
      ? Math.max(cropW / naturalW, cropH / naturalH)
      : 1;

  const dispW = Math.round(naturalW * scale);
  const dispH = Math.round(naturalH * scale);

  // Limita o offset para não mostrar área fora da imagem
  const clamp = useCallback(
    (ox: number, oy: number) => ({
      x: Math.min(0, Math.max(-(dispW - cropW), ox)),
      y: Math.min(0, Math.max(-(dispH - cropH), oy)),
    }),
    [dispW, dispH, cropW, cropH],
  );

  // Reseta posição ao trocar proporção
  useEffect(() => {
    setOffset({ x: 0, y: 0 });
  }, [selectedAspect]);

  const handleImageLoad = () => {
    if (!imgRef.current) return;
    setNaturalW(imgRef.current.naturalWidth);
    setNaturalH(imgRef.current.naturalHeight);
    setOffset({ x: 0, y: 0 });
  };

  // ── Mouse ──────────────────────────────────────────────────────────────────
  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    dragStartRef.current = {
      mx: e.clientX,
      my: e.clientY,
      ox: offset.x,
      oy: offset.y,
    };
    setIsDragging(true);
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDragging || !dragStartRef.current) return;
      const dx = e.clientX - dragStartRef.current.mx;
      const dy = e.clientY - dragStartRef.current.my;
      setOffset(
        clamp(dragStartRef.current.ox + dx, dragStartRef.current.oy + dy),
      );
    };
    const onUp = () => setIsDragging(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [isDragging, clamp]);

  // ── Touch ──────────────────────────────────────────────────────────────────
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    dragStartRef.current = {
      mx: t.clientX,
      my: t.clientY,
      ox: offset.x,
      oy: offset.y,
    };
    setIsDragging(true);
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!dragStartRef.current) return;
    const t = e.touches[0];
    const dx = t.clientX - dragStartRef.current.mx;
    const dy = t.clientY - dragStartRef.current.my;
    setOffset(
      clamp(dragStartRef.current.ox + dx, dragStartRef.current.oy + dy),
    );
  };

  // ── Confirmar corte ────────────────────────────────────────────────────────
  const handleConfirm = async () => {
    if (!naturalW || !naturalH || !imgRef.current) return;
    setIsProcessing(true);
    try {
      // Retângulo fonte em coordenadas naturais da imagem
      const srcX = Math.round(-offset.x / scale);
      const srcY = Math.round(-offset.y / scale);
      const srcW = Math.round(cropW / scale);
      const srcH = Math.round(cropH / scale);

      // Saída: no máximo 1200px de largura, proporção preservada
      const outW = Math.min(srcW, 1200);
      const outH = Math.round(srcH * (outW / srcW));

      const canvas = document.createElement("canvas");
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(imgRef.current, srcX, srcY, srcW, srcH, 0, 0, outW, outH);

      // Prefere WebP; cai para JPEG se não suportado
      const webpBlob = await new Promise<Blob | null>((res) =>
        canvas.toBlob(res, "image/webp", 0.85),
      );
      const blob =
        webpBlob?.type === "image/webp"
          ? webpBlob
          : await new Promise<Blob | null>((res) =>
              canvas.toBlob(res, "image/jpeg", 0.85),
            );

      if (!blob) return;
      const ext = blob.type === "image/webp" ? "webp" : "jpg";
      const baseName = file.name.replace(/\.[^.]+$/, "") || "produto";
      onConfirm(new File([blob], `${baseName}.${ext}`, { type: blob.type }));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="font-semibold text-gray-900 text-sm">
              Posicionar foto
            </h3>
            <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
              <Move className="w-3 h-3" />
              Arraste para centralizar o produto
            </p>
          </div>
          <button
            onClick={onCancel}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Fechar"
          >
            <X className="w-4 h-4 text-gray-600" />
          </button>
        </div>

        {/* Seletor de proporção */}
        <div className="flex gap-1.5 px-5 pt-4">
          {ASPECT_OPTIONS.map((opt) => (
            <button
              key={opt.label}
              type="button"
              onClick={() => setSelectedAspect(opt.value)}
              className={`flex-1 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                selectedAspect === opt.value
                  ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                  : "border-gray-200 text-gray-600 hover:border-gray-300"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Frame de corte (imagem arrastável dentro) */}
        <div className="flex justify-center px-5 pt-4 pb-2">
          <div
            style={{ width: cropW, height: cropH }}
            className={`relative overflow-hidden rounded-xl border-2 border-indigo-500 select-none touch-none ${
              isDragging ? "cursor-grabbing" : "cursor-grab"
            }`}
            onMouseDown={onMouseDown}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={() => setIsDragging(false)}
          >
            {imageSrc && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                ref={imgRef}
                src={imageSrc}
                alt=""
                draggable={false}
                onLoad={handleImageLoad}
                style={{
                  position: "absolute",
                  left: offset.x,
                  top: offset.y,
                  width: dispW || "auto",
                  height: dispH || "auto",
                  maxWidth: "none",
                  userSelect: "none",
                  pointerEvents: "none",
                }}
              />
            )}
            {/* Cantos indicando o frame */}
            <span className="absolute top-1.5 left-1.5 w-4 h-4 border-t-2 border-l-2 border-white/80 rounded-tl pointer-events-none" />
            <span className="absolute top-1.5 right-1.5 w-4 h-4 border-t-2 border-r-2 border-white/80 rounded-tr pointer-events-none" />
            <span className="absolute bottom-1.5 left-1.5 w-4 h-4 border-b-2 border-l-2 border-white/80 rounded-bl pointer-events-none" />
            <span className="absolute bottom-1.5 right-1.5 w-4 h-4 border-b-2 border-r-2 border-white/80 rounded-br pointer-events-none" />
          </div>
        </div>

        {/* Ações */}
        <div className="flex gap-3 px-5 pb-5 pt-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isProcessing || !naturalW}
            className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-1.5"
          >
            {isProcessing ? (
              <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            Usar foto
          </button>
        </div>
      </div>
    </div>
  );
}
