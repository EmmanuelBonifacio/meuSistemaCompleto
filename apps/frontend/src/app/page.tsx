// =============================================================================
// src/app/page.tsx
// =============================================================================
// Landing pública na raiz "/". Painel superadmin: /admin. Tenants: /<slug>/login
// =============================================================================

import type { Metadata } from "next";
import { SaasPlatformLanding } from "@/components/landing/saas-platform-landing";

export const metadata: Metadata = {
  title: "SaaSPlatform — Módulo de Vendas e Catálogo",
  description:
    "Catálogo online com pedidos pelo WhatsApp. Planos, suporte e módulo de vendas para o seu negócio.",
};

export default function RootPage() {
  return <SaasPlatformLanding />;
}
