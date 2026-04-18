// =============================================================================
// src/app/[slug]/tv/planos/page.tsx
// =============================================================================
// Página de gerenciamento do plano de TVs.
// Renderiza o TvPlanPanel com tier, modo e indicador de uso.
// =============================================================================

import type { Metadata } from "next";
import { TvPlanPanel } from "@/modules/tv/TvPlanPanel";

export const metadata: Metadata = {
  title: "TV Digital — Plano",
};

export default function TvPlanosPage() {
  return <TvPlanPanel />;
}
