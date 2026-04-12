// =============================================================================
// src/app/[slug]/vendas/admin/layout.tsx
// =============================================================================
// O QUE FAZ:
//   Layout protegido do painel admin de vendas.
//   Aplica o auth guard: verifica JWT no localStorage.
//   Se não autenticado → redireciona para /{slug}/login (login do tenant).
//
// POR QUE NÃO USAR O [slug]/layout.tsx DIRETAMENTE?
//   O [slug]/layout.tsx já faz o auth guard — mas envolve o conteúdo com
//   o AppLayout (sidebar + navbar) que é o painel geral do sistema.
//   O admin de vendas usa um layout customizado mais simples,
//   focado apenas no módulo de vendas.
// =============================================================================

"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { TOKEN_KEY, TENANT_SLUG_KEY } from "@/services/api";
import { isJwtExpired } from "@/lib/utils";
import { Store, LogOut } from "lucide-react";
import Link from "next/link";

export default function VendasAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const [authState, setAuthState] = useState<"checking" | "ok" | "redirect">(
    "checking",
  );

  // -------------------------------------------------------------------------
  // Auth Guard: verifica JWT do tenant
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!slug) return;

    if (typeof window !== "undefined") {
      localStorage.setItem(TENANT_SLUG_KEY, slug);
    }

    const token =
      typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;

    if (!token || isJwtExpired(token)) {
      // Sem token ou expirado → redireciona para login do tenant
      router.replace(`/${slug}/login`);
      setAuthState("redirect");
    } else {
      setAuthState("ok");
    }
  }, [slug, router]);

  // Spinner durante verificação
  if (authState === "checking" || authState === "redirect") {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  const handleLogout = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(TOKEN_KEY);
    }
    router.replace(`/${slug}/login`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header do Painel Admin */}
      <header className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          {/* Logo + breadcrumb */}
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-7 h-7 bg-indigo-600 rounded-lg">
              <Store className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="flex items-center gap-1.5 text-sm">
              <span className="text-gray-500">{slug}</span>
              <span className="text-gray-300">/</span>
              <span className="font-semibold text-gray-900">
                Admin de Vendas
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Link para ver a loja como visitante */}
            <Link
              href={`/${slug}/vendas`}
              target="_blank"
              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors"
            >
              <Store className="w-3.5 h-3.5" />
              Ver loja
            </Link>

            {/* Botão de logout */}
            <button
              onClick={handleLogout}
              className="text-xs text-gray-500 hover:text-red-600 font-medium flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sair
            </button>
          </div>
        </div>
      </header>

      {/* Conteúdo da página */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">{children}</main>
    </div>
  );
}
