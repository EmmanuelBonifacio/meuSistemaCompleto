// =============================================================================
// tratarImagem — otimização client-side antes do upload (Canvas API, sem libs)
// =============================================================================
// Redimensiona (se largura > 1200px), comprime WebP q=0.8 com fallback JPEG,
// nunca amplia foto pequena. Atalho: se já ≤1200px de largura e ≤500KB, devolve o File original.
// =============================================================================

/** Largura máxima: só reduz se a foto for mais larga que isso (proporção preservada). */
const MAX_LARGURA_ALVO = 1200;

/** Se largura ≤ isto E arquivo ≤ SKIP_MAX_BYTES, não passa pelo canvas (envia original). */
const SKIP_LARGURA_MAX = 1200;
const SKIP_MAX_BYTES = 500 * 1024;

/** Após processar (ou original no atalho), bloqueia se passar disso. */
const MAX_BYTES_FINAL = 2 * 1024 * 1024;

/** Largura mínima exigida na imagem final (vitrine). */
const MIN_LARGURA_FINAL = 800;

const WEBP_QUALITY = 0.8;
const JPEG_QUALITY = 0.8;

/**
 * Carrega um File como HTMLImageElement via object URL (compatível Chrome / Safari).
 */
function carregarImagemDeArquivo(arquivo: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(arquivo);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(
        new Error(
          "Não foi possível ler a imagem. Tente outro arquivo (JPG, PNG ou WebP).",
        ),
      );
    };
    img.src = url;
  });
}

/**
 * Encapsula canvas.toBlob em Promise para usar com async/await.
 */
function canvasParaBlob(
  canvas: HTMLCanvasElement,
  tipo: string,
  qualidade?: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), tipo, qualidade);
  });
}

/**
 * Testa se o navegador consegue gerar WebP a partir de um canvas 1×1.
 * Usado uma vez por chamada é aceitável; podemos memoizar se necessário.
 */
let memoSuportaWebp: boolean | null = null;
async function navegadorSuportaWebpExport(): Promise<boolean> {
  if (memoSuportaWebp !== null) return memoSuportaWebp;
  try {
    const c = document.createElement("canvas");
    c.width = 1;
    c.height = 1;
    const b = await canvasParaBlob(c, "image/webp", WEBP_QUALITY);
    memoSuportaWebp = !!(b && b.type === "image/webp");
  } catch {
    memoSuportaWebp = false;
  }
  return memoSuportaWebp;
}

/**
 * Valida tamanho em bytes e largura em pixels da imagem que será enviada.
 */
function validarImagemFinal(larguraPx: number, tamanhoBytes: number): void {
  if (larguraPx < MIN_LARGURA_FINAL) {
    throw new Error(
      `A foto precisa ter pelo menos ${MIN_LARGURA_FINAL}px de largura (atual: ${larguraPx}px). Use uma imagem maior.`,
    );
  }
  if (tamanhoBytes > MAX_BYTES_FINAL) {
    throw new Error(
      `A imagem ainda ficou grande demais após otimizar (${(tamanhoBytes / 1024 / 1024).toFixed(2)}MB; máximo 2MB). Escolha outra foto ou reduza a qualidade na câmera.`,
    );
  }
}

/**
 * Remove extensão do nome e monta um nome seguro para o novo arquivo.
 */
function nomeArquivoSaida(nomeOriginal: string, extensao: "webp" | "jpeg"): string {
  const base = nomeOriginal.replace(/\.[^.]+$/, "").trim() || "produto";
  return `${base}.${extensao === "jpeg" ? "jpg" : "webp"}`;
}

/**
 * Trata a imagem antes do upload.
 *
 * - Redimensiona só se largura > 1200px (mantém proporção, sem upscale).
 * - Comprime WebP 0.8 ou JPEG 0.8 se WebP não disponível.
 * - Atalho: largura ≤1200 e tamanho ≤500KB → retorna o mesmo File.
 * - Lança Error se leitura/compressão falhar ou se validação final falhar (formulário não deve enviar).
 *
 * @param arquivo File do input type="file"
 * @returns Novo File (ou o original no atalho), pronto para FormData
 */
export async function tratarImagem(arquivo: File): Promise<File> {
  if (!arquivo.type.startsWith("image/")) {
    throw new Error("Selecione um arquivo de imagem válido.");
  }

  const bytesAntes = arquivo.size;
  const img = await carregarImagemDeArquivo(arquivo);
  const w0 = img.naturalWidth;
  const h0 = img.naturalHeight;

  if (!w0 || !h0) {
    throw new Error("Dimensões da imagem inválidas.");
  }

  // -------------------------------------------------------------------------
  // Atalho: já pequena em pixels e leve em bytes → não processa no canvas
  // -------------------------------------------------------------------------
  if (w0 <= SKIP_LARGURA_MAX && bytesAntes <= SKIP_MAX_BYTES) {
    validarImagemFinal(w0, bytesAntes);
    console.log(
      "[tratarImagem] Atalho (≤1200px e ≤500KB) — arquivo original, sem canvas.",
      "| Antes/depois:",
      `${(bytesAntes / 1024).toFixed(1)} KB`,
    );
    return arquivo;
  }

  // -------------------------------------------------------------------------
  // Dimensões de desenho: nunca aumenta; só reduz largura se > MAX_LARGURA_ALVO
  // -------------------------------------------------------------------------
  const larguraDesenho = Math.min(w0, MAX_LARGURA_ALVO);
  const alturaDesenho = Math.round(h0 * (larguraDesenho / w0));

  const canvas = document.createElement("canvas");
  canvas.width = larguraDesenho;
  canvas.height = alturaDesenho;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Não foi possível preparar a imagem (canvas indisponível).");
  }

  // Suavização ao reduzir (padrão útil em downsampling)
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, larguraDesenho, alturaDesenho);

  // -------------------------------------------------------------------------
  // Export: WebP preferencial, fallback JPEG
  // -------------------------------------------------------------------------
  let blob: Blob | null = null;
  let mimeSaida: string = "image/jpeg";
  let extSaida: "webp" | "jpeg" = "jpeg";

  if (await navegadorSuportaWebpExport()) {
    const webpBlob = await canvasParaBlob(canvas, "image/webp", WEBP_QUALITY);
    if (webpBlob && webpBlob.size > 0) {
      blob = webpBlob;
      mimeSaida = "image/webp";
      extSaida = "webp";
    }
  }

  if (!blob || blob.size === 0) {
    blob = await canvasParaBlob(canvas, "image/jpeg", JPEG_QUALITY);
    if (!blob || blob.size === 0) {
      throw new Error(
        "Falha ao comprimir a imagem. Tente outro formato (JPG ou PNG).",
      );
    }
    mimeSaida = "image/jpeg";
    extSaida = "jpeg";
  }

  const bytesDepois = blob.size;
  console.log(
    "[tratarImagem] Otimizado",
    "| Antes:",
    `${(bytesAntes / 1024).toFixed(1)} KB`,
    "| Depois:",
    `${(bytesDepois / 1024).toFixed(1)} KB`,
    "| Dimensões:",
    `${larguraDesenho}×${alturaDesenho}`,
    "| Tipo:",
    mimeSaida,
  );

  validarImagemFinal(larguraDesenho, bytesDepois);

  return new File([blob], nomeArquivoSaida(arquivo.name, extSaida), {
    type: mimeSaida,
    lastModified: Date.now(),
  });
}
