// =============================================================================
// src/app/admin/tenants/page.tsx
// =============================================================================
// O QUE FAZ:
//   Página de gerenciamento de tenants. Renderiza a TenantTable que possui
//   a listagem completa, criação e gerenciamento de módulos por tenant.
// =============================================================================

import type { Metadata } from "next";
import { TenantTable } from "@/modules/admin/TenantTable";

export const metadata: Metadata = {
  title: "Tenants | Admin",
};

export default function TenantsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tenants</h1>
        <p className="text-muted-foreground mt-1">
          Gerencie os tenants, status e módulos habilitados.
        </p>
      </div>
      <TenantTable />
    </div>
  );
}
