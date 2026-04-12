"use client";
// =============================================================================
// src/app/[slug]/dashboard/page.tsx
// =============================================================================
// O QUE FAZ:
//   Página inicial do tenant após o login. Exibe:
//   - Saudação com nome do usuário
//   - Cards de indicadores rápidos (KPIs) de cada módulo ativo
//   - Atalhos para cada módulo
// =============================================================================

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Tv2,
  Package,
  TrendingUp,
  ShoppingCart,
  LayoutGrid,
  ArrowRight,
  LayoutDashboard,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useModules } from "@/hooks/useModules";
import { getStoredPayload } from "@/services/auth.service";

// Mapa visual de cada módulo para o card de atalho
const MODULE_CARDS = {
  tv: {
    icon: Tv2,
    title: "TV Digital",
    description:
      "Gerencie seus dispositivos de TV e envie conteúdo em tempo real.",
    color: "text-blue-600",
    bg: "bg-blue-50",
  },
  estoque: {
    icon: Package,
    title: "Estoque",
    description:
      "Controle de produtos, quantidades e categorias do seu inventário.",
    color: "text-amber-600",
    bg: "bg-amber-50",
  },
  financeiro: {
    icon: TrendingUp,
    title: "Financeiro",
    description: "Acompanhe receitas, despesas e o saldo do seu negócio.",
    color: "text-emerald-600",
    bg: "bg-emerald-50",
  },
  vendas: {
    icon: ShoppingCart,
    title: "SalesWpp",
    description: "Catálogo de vendas público com checkout direto via WhatsApp.",
    color: "text-green-600",
    bg: "bg-green-50",
  },
  "vendas-admin": {
    icon: LayoutGrid,
    title: "Vendas — Admin",
    description: "Gerencie produtos, pedidos e métricas do módulo SalesWpp.",
    color: "text-green-700",
    bg: "bg-green-100",
    href: "vendas/admin",
  },
};

export default function DashboardPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const { modules, isLoading } = useModules();

  // Pega o nome do usuário do token armazenado (apenas para saudação visual)
  const [userName, setUserName] = useState<string>("");

  useEffect(() => {
    const payload = getStoredPayload();
    if (payload?.sub) {
      // sub é o ID do usuário, mas poderia ser o email; exibe como está
      setUserName(payload.sub);
    }
  }, []);

  return (
    <div className="space-y-8">
      {/* Saudação */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <LayoutDashboard className="h-6 w-6 text-muted-foreground" />
          Dashboard
        </h1>
        <p className="text-muted-foreground mt-1">
          Bem-vindo{userName ? `, ${userName}` : ""}! Escolha um módulo para
          gerenciar.
        </p>
      </div>

      {/* Grid de módulos ativos */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-10 w-10 rounded-lg" />
                <Skeleton className="h-5 w-32 mt-3" />
                <Skeleton className="h-4 w-full mt-1" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-9 w-28" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : modules.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <LayoutDashboard className="mx-auto mb-3 h-10 w-10 text-muted-foreground opacity-30" />
            <p className="font-medium text-muted-foreground">
              Nenhum módulo ativo para este tenant.
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Entre no painel admin para ativar módulos.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {modules.flatMap((mod) => {
            const modName =
              typeof mod === "string" ? mod : ((mod as any).name as string);
            const meta = MODULE_CARDS[modName as keyof typeof MODULE_CARDS];
            if (!meta) return [];

            const cards = [{ key: modName, meta, href: `/${slug}/${modName}` }];

            // Para o módulo vendas, adiciona card extra para o painel admin
            if (modName === "vendas") {
              const adminMeta =
                MODULE_CARDS["vendas-admin" as keyof typeof MODULE_CARDS];
              cards.push({
                key: "vendas-admin",
                meta: adminMeta,
                href: `/${slug}/vendas/admin`,
              });
            }

            return cards.map(({ key, meta: m, href }) => {
              const Icon = m.icon;
              return (
                <Card
                  key={key}
                  className="group hover:shadow-md transition-shadow"
                >
                  <CardHeader>
                    <div
                      className={`h-10 w-10 rounded-lg ${m.bg} flex items-center justify-center`}
                    >
                      <Icon className={`h-5 w-5 ${m.color}`} />
                    </div>
                    <CardTitle className="mt-3 text-base">{m.title}</CardTitle>
                    <CardDescription>{m.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button asChild variant="outline" size="sm">
                      <Link href={href}>
                        Acessar
                        <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              );
            });
          })}
        </div>
      )}

      {/* Badge informativo */}
      <div className="text-center">
        <Badge variant="outline" className="text-xs text-muted-foreground">
          Tenant: <span className="ml-1 font-mono">{slug}</span>
        </Badge>
      </div>
    </div>
  );
}
