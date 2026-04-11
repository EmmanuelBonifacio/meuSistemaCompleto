// =============================================================================
// src/app/[slug]/estoque/page.tsx
// =============================================================================
// O QUE FAZ:
//   Página do módulo Estoque. Renderiza a tabela de produtos com busca,
//   paginação e formulário de criar/editar.
// =============================================================================

import type { Metadata } from "next";
import { ProductTable } from "@/modules/estoque/ProductTable";

export const metadata: Metadata = {
  title: "Estoque",
};

export default function EstoquePage() {
  return <ProductTable />;
}
