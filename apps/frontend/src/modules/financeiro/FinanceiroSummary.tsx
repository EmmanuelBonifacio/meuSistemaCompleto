"use client";
// =============================================================================
// src/modules/financeiro/FinanceiroSummary.tsx
// =============================================================================
// O QUE FAZ:
//   Cards de resumo financeiro: Total de Receitas, Total de Despesas e Saldo.
//   Dados vêm do campo `resumo` na resposta do GET /financeiro/transacoes.
//
// CONCEITO DE "KPI CARDS" EM DASHBOARDS:
//   KPI = Key Performance Indicator. São os números mais importantes do módulo
//   exibidos em destaque no topo da página, antes da tabela de detalhes.
//   Em apps financeiros (Stripe, QuickBooks), estes cards dão uma visão rápida
//   sem precisar ler linha por linha da tabela.
// =============================================================================

import { TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";

interface SummaryData {
  totalReceitas: number;
  totalDespesas: number;
  saldo: number;
}

interface FinanceiroSummaryProps {
  summary?: SummaryData;
  isLoading: boolean;
}

export function FinanceiroSummary({
  summary,
  isLoading,
}: FinanceiroSummaryProps) {
  const cards = [
    {
      title: "Total de Receitas",
      value: summary?.totalReceitas ?? 0,
      icon: TrendingUp,
      // Verde para receitas (dinheiro entrando)
      colorClass: "text-emerald-600",
      bgClass: "bg-emerald-50",
    },
    {
      title: "Total de Despesas",
      value: summary?.totalDespesas ?? 0,
      icon: TrendingDown,
      // Vermelho para despesas (dinheiro saindo)
      colorClass: "text-red-600",
      bgClass: "bg-red-50",
    },
    {
      title: "Saldo do Período",
      value: summary?.saldo ?? 0,
      icon: Wallet,
      // Saldo: verde se positivo, vermelho se negativo, cinza se zero
      colorClass:
        (summary?.saldo ?? 0) > 0
          ? "text-emerald-600"
          : (summary?.saldo ?? 0) < 0
            ? "text-red-600"
            : "text-muted-foreground",
      bgClass:
        (summary?.saldo ?? 0) > 0
          ? "bg-emerald-50"
          : (summary?.saldo ?? 0) < 0
            ? "bg-red-50"
            : "bg-muted",
    },
  ];

  return (
    // Grid: 1 coluna em mobile, 3 em tablet/desktop
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.title}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {card.title}
                </CardTitle>
                {/* Ícone com background colorido */}
                <div
                  className={`h-8 w-8 rounded-lg ${card.bgClass} flex items-center justify-center`}
                >
                  <Icon className={`h-4 w-4 ${card.colorClass}`} />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-32" />
              ) : (
                <p className={`text-2xl font-bold ${card.colorClass}`}>
                  {formatCurrency(card.value)}
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
