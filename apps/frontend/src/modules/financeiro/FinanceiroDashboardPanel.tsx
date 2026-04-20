"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getFinancialDashboard } from "@/services/financeiro.service";
import { formatCurrency } from "@/lib/utils";
import type { FinancialDashboardResponse } from "@/types/api";

const MONTH_OPTIONS = [3, 6, 9, 12];

export function FinanceiroDashboardPanel() {
  const [months, setMonths] = useState(6);
  const [data, setData] = useState<FinancialDashboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const result = await getFinancialDashboard(months);
        if (!mounted) return;
        setData(result);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "Erro ao carregar dashboard.");
      } finally {
        if (mounted) setIsLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [months]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Previsto x Realizado</h3>
        <Select value={String(months)} onValueChange={(v) => setMonths(Number(v))}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MONTH_OPTIONS.map((m) => (
              <SelectItem key={m} value={String(m)}>
                {m} meses
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Previsto</p>
            <p className="text-xl font-bold">{formatCurrency(data?.totals.previsto ?? 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Pago</p>
            <p className="text-xl font-bold text-emerald-600">
              {formatCurrency(data?.totals.pago ?? 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Receitas realizadas</p>
            <p className="text-xl font-bold text-emerald-600">
              {formatCurrency(data?.totals.realizadoReceitas ?? 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Despesas realizadas</p>
            <p className="text-xl font-bold text-red-600">
              {formatCurrency(data?.totals.realizadoDespesas ?? 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Saldo realizado</p>
            <p
              className={`text-xl font-bold ${
                (data?.totals.saldoRealizado ?? 0) >= 0 ? "text-emerald-600" : "text-red-600"
              }`}
            >
              {formatCurrency(data?.totals.saldoRealizado ?? 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Evolução mensal</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : !data?.monthly.length ? (
            <p className="text-sm text-muted-foreground">Sem dados para o período.</p>
          ) : (
            <div className="space-y-3">
              {data.monthly.map((month) => {
                const max = Math.max(
                  month.previsto,
                  month.pago,
                  month.realizadoReceitas,
                  month.realizadoDespesas,
                  1,
                );
                const pct = (v: number) => Math.max(4, Math.round((v / max) * 100));
                return (
                  <div key={month.month} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{month.month}</span>
                      <span>Saldo {formatCurrency(month.saldoRealizado)}</span>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      <div className="space-y-1">
                        <p className="text-[11px] text-muted-foreground">Previsto</p>
                        <div className="h-2 rounded bg-muted">
                          <div className="h-2 rounded bg-slate-500" style={{ width: `${pct(month.previsto)}%` }} />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[11px] text-muted-foreground">Pago</p>
                        <div className="h-2 rounded bg-muted">
                          <div className="h-2 rounded bg-emerald-600" style={{ width: `${pct(month.pago)}%` }} />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[11px] text-muted-foreground">Receitas</p>
                        <div className="h-2 rounded bg-muted">
                          <div className="h-2 rounded bg-emerald-400" style={{ width: `${pct(month.realizadoReceitas)}%` }} />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[11px] text-muted-foreground">Despesas</p>
                        <div className="h-2 rounded bg-muted">
                          <div className="h-2 rounded bg-red-500" style={{ width: `${pct(month.realizadoDespesas)}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
