// =============================================================================
// src/app/[slug]/tv/dispositivos/page.tsx
// =============================================================================
// Página de inventário de dispositivos TV.
// Renderiza TvDevicesTable com tabela, badges de role e botão Adicionar TV.
// =============================================================================

import type { Metadata } from "next";
import { TvDevicesTable } from "@/modules/tv/TvDevicesTable";

export const metadata: Metadata = {
  title: "TV Digital — Dispositivos",
};

export default function TvDispositivosPage() {
  return <TvDevicesTable />;
}
