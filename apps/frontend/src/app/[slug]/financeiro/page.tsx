// =============================================================================
// src/app/[slug]/financeiro/page.tsx
// =============================================================================
// O QUE FAZ:
//   Página do módulo Financeiro. Renderiza a TransactionTable que já contém
//   internamente o FinanceiroSummary (KPIs) na parte superior.
// =============================================================================

import type { Metadata } from "next";
import { TransactionTable } from "@/modules/financeiro/TransactionTable";

export const metadata: Metadata = {
  title: "Financeiro",
};

export default function FinanceiroPage() {
  return <TransactionTable />;
}
