"use client";
// =============================================================================
// src/components/shared/AppLayout.tsx
// =============================================================================
// O QUE FAZ:
//   Layout principal que encapsula TODAS as páginas autenticadas do tenant.
//   É o "shell" da aplicação — composto por Sidebar + Navbar + área de conteúdo.
//
// HIERARQUIA DE LAYOUTS NO NEXT.JS APP ROUTER:
//   app/layout.tsx                → Layout raiz (fonte, meta, providers)
//   app/[slug]/layout.tsx         → Verifica auth + passa módulos pro AppLayout
//   AppLayout (este componente)   → Sidebar + Navbar + main content
//
// POR QUE SEPARAR AppLayout DE app/[slug]/layout.tsx?
//   O arquivo app/[slug]/layout.tsx é um Server Component por padrão.
//   Ele faz a verificação de auth e passa props iniciais.
//   O AppLayout é um Client Component (usa useState para mobile sidebar).
//   Separar permite usar o melhor de cada mundo.
//
// COMO USAR:
//   Não é chamado diretamente — é usado em app/[slug]/layout.tsx
// =============================================================================

import { useState } from "react";
import { usePathname } from "next/navigation";
import { useModules } from "@/hooks/useModules";
import { Sidebar } from "./Sidebar";
import { Navbar } from "./Navbar";
import { cn } from "@/lib/utils";

interface AppLayoutProps {
  children: React.ReactNode;
  tenantSlug: string;
  tenantName?: string;
  pageTitle?: string; // optional — Navbar deriva do pathname se não informado
}

export function AppLayout({
  children,
  tenantSlug,
  tenantName,
  pageTitle,
}: AppLayoutProps) {
  // Estado para controlar a sidebar em mobile (aberta/fechada)
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Descoberta dinâmica dos módulos ativos (o "Lego" em ação)
  const { modules, isLoading: isLoadingModules } = useModules();
  const pathname = usePathname() ?? "";
  // Página full-bleed: flex em altura + sem container limitado (Leaflet + painéis laterais)
  const isCriarRotasFullBleed = /\/frota\/criar-rotas(?:\/|$)/.test(pathname);

  return (
    // Container principal: flex horizontal (sidebar | conteúdo)
    <div className="flex h-screen bg-background overflow-hidden">
      {/* ----------------------------------------------------------------
          SIDEBAR DESKTOP: sempre visível em telas md e maiores
      ---------------------------------------------------------------- */}
      <div className="hidden md:flex relative">
        <Sidebar
          tenantSlug={tenantSlug}
          modules={modules}
          isLoading={isLoadingModules}
        />
      </div>

      {/* ----------------------------------------------------------------
          SIDEBAR MOBILE: overlay quando aberta
          O backdrop fecha a sidebar ao clicar fora dela
      ---------------------------------------------------------------- */}
      {isMobileSidebarOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          {/* Backdrop semitransparente */}
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setIsMobileSidebarOpen(false)}
          />
          {/* Sidebar por cima do backdrop */}
          <div className="relative z-50 animate-slide-in">
            <Sidebar
              tenantSlug={tenantSlug}
              modules={modules}
              isLoading={isLoadingModules}
            />
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------
          ÁREA PRINCIPAL: Navbar + conteúdo da página
          flex-1: ocupa todo o espaço restante após a sidebar
          overflow-auto: permite scroll no conteúdo sem mover a sidebar
      ---------------------------------------------------------------- */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Navbar
          pageTitle={pageTitle ?? ""}
          tenantName={tenantName}
          onMenuToggle={() => setIsMobileSidebarOpen(true)}
        />

        {/* Área de conteúdo das páginas */}
        <main
          className={cn(
            "flex-1 bg-background",
            isCriarRotasFullBleed
              ? "flex min-h-0 flex-col overflow-hidden p-0"
              : "overflow-y-auto",
          )}
        >
          {isCriarRotasFullBleed ? (
            <div className="flex min-h-0 flex-1 flex-col">{children}</div>
          ) : (
            <div className="container mx-auto max-w-7xl p-4 md:p-6">
              {children}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
