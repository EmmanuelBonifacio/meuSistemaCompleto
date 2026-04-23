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
// =============================================================================

import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Monorepo: evita que o Next infira a raiz errada quando há outros lockfiles.
  outputFileTracingRoot: path.join(__dirname, "../.."),

  // Necessário para build Docker com Next.js standalone
  output: "standalone",

  // Passa a URL do backend para o browser via variável pública.
  env: {
    NEXT_PUBLIC_API_URL:
      process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000",
  },

  // Imagens externas (logos de tenants, fotos de produtos, etc.)
  // PRODUÇÃO: defina NEXT_PUBLIC_API_HOST com o hostname da API (ex: api.seudominio.com.br)
  images: {
    remotePatterns: [
      // Desenvolvimento: backend local (http://localhost:3000/uploads/...)
      {
        protocol: "http",
        hostname: "localhost",
        port: "3000",
        pathname: "/uploads/**",
      },
      // Produção: HTTPS com o hostname configurado em .env
      ...(process.env.NEXT_PUBLIC_API_HOST
        ? [
            {
              protocol: /** @type {"https"} */ ("https"),
              hostname: process.env.NEXT_PUBLIC_API_HOST,
              pathname: "/uploads/**",
            },
          ]
        : [
            // Fallback permissivo — SUBSTITUA pelo domínio real antes do deploy!
            {
              protocol: /** @type {"https"} */ ("https"),
              hostname: "**",
            },
          ]),
    ],
  },

  // Opcional: suprimir avisos do ESLint durante builds de produção
  eslint: {
    ignoreDuringBuilds: false,
  },

  // Dev / monorepo: em alguns ambientes o bundle do servidor deixa de encontrar
  // o chunk vendor de `tailwind-merge`; forçar require no runtime evita o erro.
  serverExternalPackages: ["tailwind-merge"],
};

export default nextConfig;
