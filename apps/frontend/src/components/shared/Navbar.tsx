"use client";
// =============================================================================
// src/components/shared/Navbar.tsx
// =============================================================================
// O QUE FAZ:
//   Barra de navegação superior (topbar) da aplicação.
//   Exibe: nome do tenant atual, breadcrumb da página, e info do usuário.
//
// POR QUE TER NAVBAR E SIDEBAR?
//   É o padrão de enterprise dashboards (GitHub, Vercel, Stripe):
//   - Sidebar: navegação entre SEÇÕES (módulos)
//   - Navbar: contexto da PÁGINA ATUAL + ações globais (usuário, notificações)
//   A Navbar fica no topo, a Sidebar na lateral — formando o shell da aplicação.
// =============================================================================

import { Bell, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

interface NavbarProps {
  pageTitle: string;
  tenantName?: string;
  onMenuToggle?: () => void; // Para mobile: abre/fecha a sidebar
}

export function Navbar({ pageTitle, tenantName, onMenuToggle }: NavbarProps) {
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {/* Botão hamburguer — visível apenas em mobile (md:hidden) */}
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={onMenuToggle}
        aria-label="Abrir menu"
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Título da página atual */}
      <div className="flex-1">
        <h1 className="text-base font-semibold text-foreground">{pageTitle}</h1>
        {tenantName && (
          <p className="text-xs text-muted-foreground">{tenantName}</p>
        )}
      </div>

      {/* Ações à direita */}
      <div className="flex items-center gap-2">
        {/* Notificações (placeholder para feature futura) */}
        <Button variant="ghost" size="icon" aria-label="Notificações">
          <Bell className="h-4 w-4" />
        </Button>

        {/* Avatar do usuário com iniciais */}
        <div
          className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold"
          title={`Usuário: ${user?.sub ?? "—"} | Role: ${user?.role ?? "—"}`}
        >
          {/* Iniciais do ID do usuário (substituir por nome real em produção) */}
          {user?.sub?.slice(0, 2).toUpperCase() ?? "?"}
        </div>
      </div>
    </header>
  );
}
