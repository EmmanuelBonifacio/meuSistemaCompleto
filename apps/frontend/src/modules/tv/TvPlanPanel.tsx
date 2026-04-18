"use client";
// =============================================================================
// src/modules/tv/TvPlanPanel.tsx
// =============================================================================
// Painel de gerenciamento do plano de TVs do tenant.
// Mostra tier, modo, limites e uso atual. Botão "Solicitar Upgrade".
// =============================================================================

import { useState, useEffect } from "react";
import { Tv2, Zap, ExternalLink, RefreshCw, AlertCircle } from "lucide-react";
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
import * as tvService from "@/services/tv.service";
import type { TvPlan } from "@/types/api";

// ---------------------------------------------------------------------------
// Mapas de label e cor
// ---------------------------------------------------------------------------
const TIER_LABEL: Record<string, string> = {
  THREE: "3 TVs",
  FIVE: "5 TVs",
  TEN: "10 TVs",
  CUSTOM: "Personalizado",
};

const MODE_LABEL: Record<string, string> = {
  SELF: "Autogerenciado",
  PARTNERSHIP: "Parceria",
  OWNER_PLACED: "TV da Plataforma",
};

const MODE_DESC: Record<string, string> = {
  SELF: "Você gerencia suas TVs de forma independente.",
  PARTNERSHIP:
    "A plataforma usa parte do tempo de tela em troca de receita extra.",
  OWNER_PLACED: "A plataforma instalou uma TV no seu estabelecimento.",
};

function tierBadgeVariant(
  tier: string,
): "default" | "secondary" | "outline" | "destructive" {
  if (tier === "CUSTOM") return "secondary";
  if (tier === "TEN") return "default";
  return "outline";
}

// ---------------------------------------------------------------------------
// Barra de progresso de uso
// ---------------------------------------------------------------------------
function UsageBar({
  used,
  max,
}: {
  used: number;
  max: number;
}) {
  const pct = max > 0 ? Math.min((used / max) * 100, 100) : 0;
  const isWarning = pct >= 80;
  const isFull = pct >= 100;
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">TVs em uso</span>
        <span
          className={`font-semibold ${isFull ? "text-destructive" : isWarning ? "text-amber-600" : "text-foreground"}`}
        >
          {used} de {max}
        </span>
      </div>
      <div className="h-2 rounded-full bg-secondary overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            isFull
              ? "bg-destructive"
              : isWarning
                ? "bg-amber-500"
                : "bg-primary"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {max - used > 0
          ? `${max - used} slot(s) disponível(is)`
          : "Limite atingido — solicite um upgrade para adicionar mais TVs."}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// COMPONENTE PRINCIPAL
// ---------------------------------------------------------------------------
export function TvPlanPanel() {
  const [plan, setPlan] = useState<TvPlan | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadPlan() {
    setIsLoading(true);
    setError(null);
    try {
      const data = await tvService.getTvPlan();
      setPlan(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao carregar plano de TVs.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadPlan();
  }, []);

  const isAtLimit = plan ? plan.tvs_em_uso >= plan.max_client_tvs : false;

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Tv2 className="h-5 w-5 text-primary" />
            Plano de TVs
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gerencie o plano e os limites de dispositivos do tenant.
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={loadPlan}
          disabled={isLoading}
          aria-label="Atualizar plano"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Erro */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto text-xs"
            onClick={loadPlan}
          >
            Tentar novamente
          </Button>
        </div>
      )}

      {/* Skeleton */}
      {isLoading && !plan && (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      )}

      {/* Conteúdo */}
      {plan && (
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Card: Tier do Plano */}
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Tier do Plano</CardDescription>
              <CardTitle className="text-2xl">
                {TIER_LABEL[plan.plan_tier] ?? plan.plan_tier}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant={tierBadgeVariant(plan.plan_tier)}>
                {plan.plan_tier}
              </Badge>
            </CardContent>
          </Card>

          {/* Card: Modo */}
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Modo de Operação</CardDescription>
              <CardTitle className="text-base font-semibold">
                {MODE_LABEL[plan.plan_mode] ?? plan.plan_mode}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                {MODE_DESC[plan.plan_mode]}
              </p>
            </CardContent>
          </Card>

          {/* Card: Uso de TVs */}
          <Card className="sm:col-span-2">
            <CardHeader className="pb-3">
              <CardDescription>Utilização</CardDescription>
            </CardHeader>
            <CardContent>
              <UsageBar used={plan.tvs_em_uso} max={plan.max_client_tvs} />
            </CardContent>
          </Card>

          {/* Card: Parceria (visível somente em PARTNERSHIP) */}
          {plan.plan_mode === "PARTNERSHIP" && (
            <Card className="sm:col-span-2 border-primary/30 bg-primary/5">
              <CardHeader className="pb-2">
                <CardDescription>Detalhes da Parceria</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-2 sm:grid-cols-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Tempo de Tela</p>
                  <p className="font-semibold">
                    {plan.platform_screen_share_percent}% da plataforma
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Repasse de Lucro</p>
                  <p className="font-semibold">
                    +{plan.platform_profit_share_percent}% para você
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">TVs da Plataforma</p>
                  <p className="font-semibold">
                    {plan.platform_reserved_tv_count} TV(s) reservada(s)
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Ações */}
      <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-border">
        <Button
          variant={isAtLimit ? "default" : "outline"}
          className="gap-2"
          disabled={!plan}
          onClick={() =>
            alert(
              "Solicitação de upgrade enviada! Em breve nossa equipe entrará em contato.",
            )
          }
        >
          <Zap className="h-4 w-4" />
          {isAtLimit ? "Limite Atingido — Solicitar Upgrade" : "Solicitar Upgrade"}
        </Button>

        <Button variant="ghost" className="gap-2" asChild>
          <a
            href="http://cms.seudominio.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink className="h-4 w-4" />
            Abrir Painel Xibo
          </a>
        </Button>
      </div>
    </div>
  );
}
