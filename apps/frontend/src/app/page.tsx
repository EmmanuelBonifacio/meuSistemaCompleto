// =============================================================================
// src/app/page.tsx
// =============================================================================
// O QUE FAZ:
//   Página raiz "/" da aplicação. Apenas redireciona para /admin, que é o
//   ponto de entrada administrativo. Tenants acessam via /<slug>/login.
// =============================================================================

import { redirect } from "next/navigation";

export default function RootPage() {
  // Redireciona imediatamente para o painel administrativo
  redirect("/admin");
}
