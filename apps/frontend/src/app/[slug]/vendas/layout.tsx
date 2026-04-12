// =============================================================================
// src/app/[slug]/vendas/layout.tsx
// =============================================================================
// O QUE FAZ:
//   Layout da página de vendas PÚBLICA — qualquer visitante acessa sem login.
//   NÃO usa o auth guard do layout pai ([slug]/layout.tsx).
//   Não exibe a sidebar/navbar do sistema interno.
//
// POR QUE NÃO HERDAR O AUTH GUARD DO [slug]/layout.tsx?
//   A página de vendas é uma vitrine pública, como uma loja no Instagram.
//   O visitante não tem conta no sistema e não precisa de JWT.
//   Criamos um layout filho que substitui o wrapper do pai para esta rota.
// =============================================================================

"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { TENANT_SLUG_KEY } from "@/services/api";

export default function VendasPublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams<{ slug: string }>();

  // Persiste o slug para que os interceptors do Axios identifiquem o tenant
  // mesmo sem o auth guard do layout pai.
  useEffect(() => {
    if (params.slug && typeof window !== "undefined") {
      localStorage.setItem(TENANT_SLUG_KEY, params.slug);
    }
  }, [params.slug]);

  return (
    // Fundo cinza clarinho — neutro para qualquer paleta de produto
    <div className="min-h-screen bg-gray-50">{children}</div>
  );
}
