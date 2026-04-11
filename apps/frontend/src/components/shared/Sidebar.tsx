"use client";
// =============================================================================
// src/components/shared/Sidebar.tsx
// =============================================================================
// O QUE FAZ:
//   A Sidebar é o menu lateral da aplicação. É o coração do "Menu Lego":
//   ela recebe a lista de módulos ativos e renderiza dinamicamente os links.
//   Se um módulo não está na lista, ele simplesmente não aparece.
//
// PROPS:
//   - tenantSlug: usado para construir as URLs dos links (ex: /acme-corp/tv)
//   - modules: lista de módulos ativos (vinda do hook useModules())
//   - isCollapsed: modo minimizado (apenas ícones, sem texto)
//   - onToggle: função para expandir/recolher a sidebar
//
// COMO O MENU DINÂMICO FUNCIONA:
//   1. useModules() hook busca a lista de módulos do Backend
//   2. Sidebar recebe essa lista como prop
//   3. Para cada módulo, encontramos sua configuração (ícone, path) em MODULE_CONFIG
//   4. Renderizamos o link — se o módulo não está na lista, não renderiza!
//
// DESIGN DE SIDEBAR ENTERPRISE:
//   - Fundo escuro (contraste com o conteúdo branco)
//   - Logo no topo
//   - Links com ícone + texto
//   - Item ativo com destaque sutil
//   - Botão de collapse para mais espaço em telas menores
// =============================================================================

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  DollarSign,
  Tv,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import type { Module } from "@/types/api";

// =============================================================================
// CONFIGURAÇÃO DOS MÓDULOS: O "Lego" visual
// =============================================================================
// Este mapa conecta o `name` do módulo (como vem do Backend) ao seu visual.
// Para adicionar novo módulo: adicionar entrada aqui + criar pasta em /src/modules/
// Em NENHUM outro lugar precisa mudar para o link aparecer no menu!
// =============================================================================
interface ModuleConfig {
  icon: LucideIcon;
  label: string;
  path: string;
}

const MODULE_CONFIG: Record<string, ModuleConfig> = {
  estoque: {
    icon: Package,
    label: "Estoque",
    path: "estoque",
  },
  financeiro: {
    icon: DollarSign,
    label: "Financeiro",
    path: "financeiro",
  },
  tv: {
    icon: Tv,
    label: "Controle de TVs",
    path: "tv",
  },
};

// =============================================================================
// PROPS
// =============================================================================
interface SidebarProps {
  tenantSlug: string;
  modules: Module[]; // Lista de módulos ativos vindos do Backend
  isLoading?: boolean; // Mostra skeleton enquanto descobre os módulos
}

// =============================================================================
// COMPONENTE: SidebarNavItem (item individual do menu)
// =============================================================================
interface NavItemProps {
  href: string;
  icon: LucideIcon;
  label: string;
  isActive: boolean;
  isCollapsed: boolean;
}

function SidebarNavItem({
  href,
  icon: Icon,
  label,
  isActive,
  isCollapsed,
}: NavItemProps) {
  return (
    <Link
      href={href}
      title={isCollapsed ? label : undefined} // Tooltip quando minimizado
      className={cn(
        // Layout base
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-150",
        // Estado padrão
        "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent",
        // Estado ativo (página atual)
        isActive && "bg-sidebar-accent text-sidebar-foreground font-medium",
        // Modo minimizado: centraliza o ícone
        isCollapsed && "justify-center px-2",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {/* Hide text when collapsed */}
      {!isCollapsed && <span className="truncate">{label}</span>}
    </Link>
  );
}

// =============================================================================
// COMPONENTE PRINCIPAL: Sidebar
// =============================================================================
export function Sidebar({
  tenantSlug,
  modules,
  isLoading = false,
}: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Gera a URL base do tenant: "/acme-corp"
  const tenantBase = `/${tenantSlug}`;

  // Verifica se uma URL está ativa comparando com a URL atual do browser
  const isActive = (path: string) => pathname === `${tenantBase}/${path}`;

  return (
    <aside
      className={cn(
        // Layout: flexbox vertical, altura total da viewport
        "flex flex-col h-full bg-sidebar border-r border-sidebar-border",
        // Transição suave ao colapsar/expandir
        "transition-all duration-300 ease-in-out",
        // Largura: 240px expandido, 64px minimizado
        isCollapsed ? "w-16" : "w-60",
      )}
    >
      {/* ------------------------------------------------------------------
          CABEÇALHO DA SIDEBAR: Logo + nome do tenant
      ------------------------------------------------------------------ */}
      <div
        className={cn(
          "flex items-center h-14 px-4 border-b border-sidebar-border",
          isCollapsed ? "justify-center" : "justify-between",
        )}
      >
        {/* Logo / ícone do sistema */}
        <div
          className={cn(
            "flex items-center gap-2",
            isCollapsed && "justify-center w-full",
          )}
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground text-xs font-bold shrink-0">
            S
          </div>
          {!isCollapsed && (
            <span className="font-semibold text-sm text-sidebar-foreground truncate">
              SaaS Platform
            </span>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------------
          NAVEGAÇÃO PRINCIPAL
          O scroll interno garante que funciona mesmo com muitos módulos
      ------------------------------------------------------------------ */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
        {/* Dashboard (sempre visível) */}
        <SidebarNavItem
          href={`${tenantBase}/dashboard`}
          icon={LayoutDashboard}
          label="Dashboard"
          isActive={isActive("dashboard")}
          isCollapsed={isCollapsed}
        />

        {/* Separador */}
        {!isCollapsed && (
          <div className="pt-3 pb-1 px-3">
            <p className="text-xs font-medium text-sidebar-foreground/40 uppercase tracking-wider">
              Módulos
            </p>
          </div>
        )}

        {/* ----------------------------------------------------------------
            MÓDULOS DINÂMICOS (o "Lego" em ação!)
            Filtramos a lista de módulos ativos e renderizamos apenas esses.
        ---------------------------------------------------------------- */}
        {isLoading ? (
          // Skeleton enquanto carrega os módulos
          <div className="space-y-1 px-1">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-9 rounded-lg bg-sidebar-accent/50 animate-pulse"
              />
            ))}
          </div>
        ) : (
          modules.map((module) => {
            // Busca a configuração visual do módulo pelo nome (ex: "estoque")
            const config = MODULE_CONFIG[module.name];

            // Se o módulo não tem configuração visual, não renderiza.
            // Isso previne erros se o Backend adicionar módulos desconhecidos.
            if (!config) return null;

            return (
              <SidebarNavItem
                key={module.name}
                href={`${tenantBase}/${config.path}`}
                icon={config.icon}
                label={config.label}
                isActive={isActive(config.path)}
                isCollapsed={isCollapsed}
              />
            );
          })
        )}
      </nav>

      {/* ------------------------------------------------------------------
          RODAPÉ: Configurações + Logout
      ------------------------------------------------------------------ */}
      <div className={cn("border-t border-sidebar-border py-3 px-2 space-y-1")}>
        {/* Botão de configurações */}
        <SidebarNavItem
          href={`${tenantBase}/configuracoes`}
          icon={Settings}
          label="Configurações"
          isActive={isActive("configuracoes")}
          isCollapsed={isCollapsed}
        />

        {/* Informações do usuário + botão de logout */}
        <button
          onClick={logout}
          title={isCollapsed ? "Sair" : undefined}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm",
            "text-sidebar-foreground/70 hover:text-destructive hover:bg-destructive/10",
            "transition-all duration-150",
            isCollapsed && "justify-center px-2",
          )}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!isCollapsed && <span>Sair</span>}
        </button>
      </div>

      {/* ------------------------------------------------------------------
          BOTÃO DE COLLAPSE (expande/minimiza a sidebar)
      ------------------------------------------------------------------ */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className={cn(
          "absolute -right-3 top-16 z-10",
          "flex h-6 w-6 items-center justify-center",
          "rounded-full border border-border bg-background shadow-sm",
          "text-muted-foreground hover:text-foreground",
          "transition-colors duration-150",
        )}
        aria-label={isCollapsed ? "Expandir menu" : "Minimizar menu"}
      >
        {isCollapsed ? (
          <ChevronRight className="h-3 w-3" />
        ) : (
          <ChevronLeft className="h-3 w-3" />
        )}
      </button>
    </aside>
  );
}
