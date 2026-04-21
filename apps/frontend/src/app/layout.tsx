// =============================================================================
// src/app/layout.tsx
// =============================================================================
// O QUE FAZ:
//   Layout raiz do Next.js App Router. Configura a fonte Inter, metadata SEO
//   e envolve toda a aplicação. É o único lugar onde <html> e <body> são
//   renderizados.
// =============================================================================

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// Configura a fonte Inter com subconjunto Latin e a expõe como variável CSS
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "SaaS Multitenant",
    // Páginas filhas podem setar: export const metadata = { title: "TV Digital" }
    // e o resultado será: "TV Digital | SaaS Multitenant"
    template: "%s | SaaS Multitenant",
  },
  description:
    "Sistema de gestão multitenant com módulos de TV, Estoque e Financeiro.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      {/* suppressHydrationWarning evita warnings causados por extensões do browser */}
      <body
        className={`${inter.variable} overflow-x-hidden font-sans antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
