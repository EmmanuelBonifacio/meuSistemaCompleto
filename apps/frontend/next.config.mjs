// =============================================================================
// next.config.mjs
// =============================================================================
// O QUE FAZ:
//   Arquivo de configuração do Next.js (versão ESModule .mjs).
//   O Next.js 14 não suporta next.config.ts — use .mjs ou .js.
//
// ATENÇÃO DE SEGURANÇA:
//   NUNCA coloque segredos (JWT_SECRET, senhas) em variáveis NEXT_PUBLIC.
//   Elas aparecem no bundle JavaScript do cliente e podem ser inspecionadas.
// =============================================================================

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Necessário para build Docker com Next.js standalone
  output: "standalone",

  // Passa a URL do backend para o browser via variável pública.
  env: {
    NEXT_PUBLIC_API_URL:
      process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000",
  },

  // Imagens externas (logos de tenants, etc.)
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**", // Ajuste para hosts específicos em produção
      },
    ],
  },

  // Opcional: suprimir avisos do ESLint durante builds de produção
  eslint: {
    ignoreDuringBuilds: false,
  },
};

export default nextConfig;
