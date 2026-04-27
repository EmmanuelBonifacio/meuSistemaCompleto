// =============================================================================
// resolveApiAssetUrl — URLs de arquivos servidos pela API (/uploads/...)
// =============================================================================
// O banco guarda caminhos relativos (ex: /uploads/vendas/uuid.webp). O browser
// precisa da URL absoluta do host da API (NEXT_PUBLIC_API_URL). Sem isso, o
// bundle pode apontar para localhost e as fotos quebram em produção.
// =============================================================================

/** Base pública da API, sem barra final. */
export function getPublicApiBaseUrl(): string {
  const raw = (process.env.NEXT_PUBLIC_API_URL || "").trim().replace(/\/$/, "");
  if (raw) return raw;
  if (process.env.NODE_ENV !== "production") {
    return "http://localhost:3000";
  }
  return "";
}

/**
 * Converte foto_url do produto (relativa ou absoluta) em URL absoluta para <img>.
 */
export function resolveApiAssetUrl(
  url: string | null | undefined,
): string | null {
  if (!url?.trim()) return null;
  const u = url.trim();
  if (u.startsWith("data:") || u.startsWith("blob:")) return u;
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  const base = getPublicApiBaseUrl();
  const path = u.startsWith("/") ? u : `/${u}`;
  if (!base) {
    if (typeof window !== "undefined") {
      console.warn(
        "[resolveApiAssetUrl] NEXT_PUBLIC_API_URL vazia — imagens podem não carregar.",
      );
    }
    return path;
  }
  return `${base}${path}`;
}
