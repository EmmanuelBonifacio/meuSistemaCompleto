"use client";
// =============================================================================
// src/app/admin/page.tsx
// =============================================================================
// O QUE FAZ:
//   Dashboard do painel administrativo. Exibe estatísticas gerais do sistema:
//   - Total de tenants
//   - Tenants ativos / suspensos
//   - Total de usuários
//   Também lista os últimos tenants criados.
// =============================================================================

import { useEffect, useState } from "react";
import {
  Building2,
  Users,
  CheckCircle2,
  XCircle,
  RefreshCw,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getSystemStats, listTenants } from "@/services/admin.service";
import { formatDate } from "@/lib/utils";
import type { SystemStats, Tenant } from "@/types/api";

interface StatCardProps {
  title: string;
  value: number | undefined;
  icon: React.ElementType;
  iconColor: string;
  isLoading: boolean;
}

function StatCard({
  title,
  value,
  icon: Icon,
  iconColor,
  isLoading,
}: StatCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {title}
          </CardTitle>
          <Icon className={`h-4 w-4 ${iconColor}`} />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <p className="text-3xl font-bold tabular-nums">{value ?? "—"}</p>
        )}
      </CardContent>
    </Card>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [recentTenants, setRecentTenants] = useState<Tenant[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  async function load() {
    setIsLoading(true);
    try {
      const [statsData, tenantsData] = await Promise.all([
        getSystemStats(),
        listTenants(),
      ]);
      setStats(statsData);
      // Exibe apenas os 5 mais recentes
      setRecentTenants(tenantsData.slice(0, 5));
    } catch (err) {
      console.error("Erro ao carregar dashboard admin:", err);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-8">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Visão Geral</h1>
          <p className="text-muted-foreground mt-1">
            Estatísticas globais do sistema
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Cards de métricas */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total de Tenants"
          value={stats?.totalTenants}
          icon={Building2}
          iconColor="text-primary"
          isLoading={isLoading}
        />
        <StatCard
          title="Tenants Ativos"
          value={stats?.activeTenants}
          icon={CheckCircle2}
          iconColor="text-emerald-600"
          isLoading={isLoading}
        />
        <StatCard
          title="Tenants Suspensos"
          value={
            stats
              ? (stats.totalTenants ?? 0) - (stats.activeTenants ?? 0)
              : undefined
          }
          icon={XCircle}
          iconColor="text-destructive"
          isLoading={isLoading}
        />
        <StatCard
          title="Total de Usuários"
          value={stats?.totalUsers}
          icon={Users}
          iconColor="text-blue-600"
          isLoading={isLoading}
        />
      </div>

      {/* Tenants recentes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Tenants Recentes</CardTitle>
          <CardDescription>
            Os últimos 5 tenants criados no sistema.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Empresa
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Slug
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Status
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Criado em
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i} className="border-b border-border">
                      <td className="px-4 py-3">
                        <Skeleton className="h-4 w-36" />
                      </td>
                      <td className="px-4 py-3">
                        <Skeleton className="h-4 w-24" />
                      </td>
                      <td className="px-4 py-3">
                        <Skeleton className="h-5 w-16 rounded-full" />
                      </td>
                      <td className="px-4 py-3">
                        <Skeleton className="h-4 w-24" />
                      </td>
                    </tr>
                  ))
                : recentTenants.map((tenant) => (
                    <tr
                      key={tenant.id}
                      className="border-b border-border hover:bg-muted/30"
                    >
                      <td className="px-4 py-3 font-medium">{tenant.name}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {tenant.slug}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={tenant.isActive ? "success" : "muted"}>
                          {tenant.isActive ? "Ativo" : "Suspenso"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDate(tenant.createdAt)}
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
