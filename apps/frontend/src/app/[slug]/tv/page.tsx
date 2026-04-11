// =============================================================================
// src/app/[slug]/tv/page.tsx
// =============================================================================
// O QUE FAZ:
//   Página do módulo TV Digital. Simplesmente renderiza o TvGrid que contém
//   toda a lógica de display dos 5 slots + modais de controle.
// =============================================================================

import type { Metadata } from "next";
import { TvGrid } from "@/modules/tv/TvGrid";

export const metadata: Metadata = {
  title: "TV Digital",
};

export default function TvPage() {
  return <TvGrid />;
}
