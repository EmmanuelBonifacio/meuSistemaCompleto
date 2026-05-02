// =============================================================================
// src/app/[slug]/frota/page.tsx
// =============================================================================
// O QUE FAZ:
//   Painel principal da Gestão de Frota. Exibe métricas, mapa de rastreamento
//   e alertas de manutenção do tenant.
// =============================================================================

import { FleetDashboard } from "@/modules/fleet";

export default function FrotaPage() {
  return <FleetDashboard />;
}
