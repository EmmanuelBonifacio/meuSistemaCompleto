// =============================================================================
// next.config.mjs
// =============================================================================
// O QUE FAZ:
//   Arquivo de configuração do Next.js (versão ESModule .mjs).
//   O Next.js não suporta next.config.ts — use .mjs ou .js.
//
// ATENÇÃO DE SEGURANÇA:
//   NUNCA coloque segredos (JWT_SECRET, senhas) em variáveis NEXT_PUBLIC.
//   Elas aparecem no bundle JavaScript do cliente e podem ser inspecionadas.
//
// PRODUÇÃO:
//   NEXT_PUBLIC_API_URL deve existir no build (ex: https://api.seudominio.com.br).
//   Sem isso, fotos em /uploads/ viram http://localhost no bundle e quebram na vitrine.
//   Para builds excepcionais: SKIP_PUBLIC_API_URL_CHECK=1
// =============================================================================

import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const rawApi = (process.env.NEXT_PUBLIC_API_URL || "").trim();
const isProdBuild = process.env.NODE_ENV === "production";

if (
  isProdBuild &&
  !process.env.SKIP_PUBLIC_API_URL_CHECK &&
  (!rawApi ||
    (!rawApi.startsWith("https://") && !rawApi.startsWith("http://")))
) {
  throw new Error(
    "next.config.mjs: em produção, defina NEXT_PUBLIC_API_URL com a URL pública da API " +
      "(ex: https://api.saasplatform.com.br). Sem isso, imagens de produtos apontam para localhost. " +
      "Docker: docker build --build-arg NEXT_PUBLIC_API_URL=https://api...",
  );
}

const nextPublicApiUrl = rawApi || (isProdBuild ? "" : "http://localhost:3000");

/** @returns {import('next').NextConfig['images']['remotePatterns']} */
function buildUploadsRemotePatterns() {
  try {
    const u = new URL(nextPublicApiUrl);
    return [
      {
        protocol: /** @type {"http" | "https"} */ (
          u.protocol === "https:" ? "https" : "http"
        ),
        hostname: u.hostname,
        ...(u.port ? { port: u.port } : {}),
        pathname: "/uploads/**",
      },
    ];
  } catch {
    return [
      {
        protocol: "http",
        hostname: "localhost",
        port: "3000",
        pathname: "/uploads/**",
      },
      { protocol: /** @type {"https"} */ ("https"), hostname: "**" },
    ];
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Monorepo: evita que o Next infira a raiz errada quando há outros lockfiles.
  outputFileTracingRoot: path.join(__dirname, "../.."),

  // Necessário para build Docker com Next.js standalone
  output: "standalone",

  env: {
    NEXT_PUBLIC_API_URL: nextPublicApiUrl,
  },

  images: {
    remotePatterns: buildUploadsRemotePatterns(),
  },

  eslint: {
    ignoreDuringBuilds: false,
  },

  serverExternalPackages: ["tailwind-merge"],
};

export default nextConfig;
