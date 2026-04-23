"use client";
// =============================================================================
// src/app/admin/layout.tsx
// =============================================================================
// O QUE FAZ:
//   Layout do painel administrativo. Aplica:
//   - Guard de autenticação (precisa de JWT válido)
//   - Guard de role (apenas 'superadmin')
//   - Sidebar simples para o admin panel
// =============================================================================

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { LayoutDashboard, Building2, Bot, LogOut, Shield } from "lucide-react";
import { ADMIN_TOKEN_KEY } from "@/services/api";
import { isJwtExpired, decodeJwt } from "@/lib/utils";
import { logout, adminLogout } from "@/services/auth.service";
import type { JwtPayload } from "@/types/api";

const NAV_ITEMS = [
  { href: "/admin", label: "Visão Geral", icon: LayoutDashboard, exact: true },
  { href: "/admin/tenants", label: "Tenants", icon: Building2, exact: false },
  { href: "/admin/ia", label: "IA", icon: Bot, exact: false },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const [authState, setAuthState] = useState<"checking" | "ok" | "denied">(
    "checking",
  );

  useEffect(() => {
    // Página de login não precisa de autenticação
    if (pathname === "/admin/login") {
      setAuthState("ok");
      return;
    }

    if (typeof window === "undefined") return;

    const token = localStorage.getItem(ADMIN_TOKEN_KEY);
    if (!token || isJwtExpired(token)) {
      router.replace("/admin/login");
      setAuthState("denied");
      return;
    }

    const payload = decodeJwt<JwtPayload>(token);
    if (payload?.role !== "superadmin") {
      setAuthState("denied");
      return;
    }

    setAuthState("ok");
  }, [router, pathname]);

  function handleLogout() {
    adminLogout();
    router.push("/admin/login");
  }

  if (authState === "checking") {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (authState === "denied") {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-background gap-4">
        <Shield className="h-12 w-12 text-destructive" />
        <p className="font-semibold text-lg">Acesso Negado</p>
        <p className="text-sm text-muted-foreground">
          Você precisa de permissão de superadmin para acessar esta área.
        </p>
      </div>
    );
  }

  // Página de login: sem sidebar
  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar admin */}
      <aside className="flex w-56 flex-col border-r border-border bg-sidebar">
        {/* Logo */}
        <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground text-sm font-bold">
            S
          </div>
          <span className="font-semibold text-sidebar-foreground">
            Admin Panel
          </span>
        </div>

        {/* Navegação */}
        <nav className="flex-1 space-y-1 p-3">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? "bg-sidebar-accent text-foreground font-medium"
                    : "text-sidebar-foreground hover:bg-sidebar-accent"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Rodapé com logout */}
        <div className="border-t border-sidebar-border p-3">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </div>
      </aside>

      {/* Conteúdo principal */}
      <main className="flex-1 overflow-auto">
        <div className="container mx-auto p-6 max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
