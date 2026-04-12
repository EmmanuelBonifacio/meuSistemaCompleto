// =============================================================================
// src/app/[slug]/vendas/admin/page.tsx
// =============================================================================
// O QUE FAZ:
//   Página do painel admin de vendas — /{slug}/vendas/admin
//   Renderiza o VendasDashboard que contém métricas, pedidos e gerenciamento
//   de produtos.
//
// ACESSO:
//   Protegido pelo layout.tsx desta pasta (auth guard JWT do tenant).
// =============================================================================

import { VendasDashboard } from "@/modules/vendas/admin/VendasDashboard";

export default function VendasAdminPage() {
  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Painel de Vendas</h1>
        <p className="text-sm text-gray-500 mt-1">
          Gerencie produtos, acompanhe pedidos e configure o catálogo da sua
          loja
        </p>
      </div>

      <VendasDashboard />
    </>
  );
}
