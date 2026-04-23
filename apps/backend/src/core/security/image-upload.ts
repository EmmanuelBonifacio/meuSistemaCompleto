// Validação de uploads de imagem: tamanho, MIME declarado e assinatura real (magic bytes).
// Reduz risco de enviar ficheiro malicioso com Content-Type forjado.

/** Limite alinhado com uso de fotos de produto/logo (ajustável por rota com request.file). */
export const MAX_IMAGE_UPLOAD_BYTES = 8 * 1024 * 1024;

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

export function extensionForImageMime(
  mimetype: string,
): (typeof MIME_TO_EXT)[keyof typeof MIME_TO_EXT] | null {
  return MIME_TO_EXT[mimetype] ?? null;
}

/**
 * Verifica se o buffer começa com assinatura conhecida de imagem.
 * O MIME declarado tem de bater com o conteúdo.
 */
export function isImageBufferConsistentWithMime(
  buffer: Buffer,
  mimetype: string,
): boolean {
  if (buffer.length < 12) return false;
  if (mimetype === "image/jpeg") {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mimetype === "image/png") {
    return (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    );
  }
  if (mimetype === "image/gif") {
    return (
      buffer[0] === 0x47 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x38
    );
  }
  if (mimetype === "image/webp") {
    return (
      buffer[0] === 0x52 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x46 &&
      buffer[8] === 0x57 &&
      buffer[9] === 0x45 &&
      buffer[10] === 0x42 &&
      buffer[11] === 0x50
    );
  }
  return false;
}
