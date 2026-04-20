"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  downloadMonthlyReportCsv,
  listMonthlyHistory,
  snapshotMonthlyHistory,
} from "@/services/financeiro.service";
import { formatCurrency } from "@/lib/utils";
import type { FinancialMonthlyHistoryItem } from "@/types/api";

export function HistoryReportPanel() {
  const [fromMonth, setFromMonth] = useState(
    new Date(new Date().setMonth(new Date().getMonth() - 5))
      .toISOString()
      .slice(0, 7),
  );
  const [toMonth, setToMonth] = useState(new Date().toISOString().slice(0, 7));
  const [rows, setRows] = useState<FinancialMonthlyHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSnapshotLoading, setIsSnapshotLoading] = useState(false);
  const [isDownloadLoading, setIsDownloadLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await listMonthlyHistory({
        page: 1,
        limit: 100,
        fromMonth,
        toMonth,
      });
      setRows(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar histórico.");
    } finally {
      setIsLoading(false);
    }
  }, [fromMonth, toMonth]);

  useEffect(() => {
    load();
  }, [load]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, row) => {
          acc.previsto += row.previsto;
          acc.pago += row.pago;
          acc.realizado += row.saldoRealizado;
          return acc;
        },
        { previsto: 0, pago: 0, realizado: 0 },
      ),
    [rows],
  );

  async function handleSnapshotCurrentMonth() {
    setIsSnapshotLoading(true);
    setMessage(null);
    setError(null);
    try {
      const saved = await snapshotMonthlyHistory();
      setMessage(`Snapshot salvo para ${saved.month.slice(0, 7)}.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao gerar snapshot.");
    } finally {
      setIsSnapshotLoading(false);
    }
  }

  async function handleDownloadCsv() {
    setIsDownloadLoading(true);
    setError(null);
    try {
      const csv = await downloadMonthlyReportCsv({ fromMonth, toMonth });
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `relatorio-financeiro-${fromMonth}-a-${toMonth}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao baixar relatório.");
    } finally {
      setIsDownloadLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Histórico mensal e relatórios</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">De</p>
              <Input
                type="month"
                value={fromMonth}
                onChange={(e) => setFromMonth(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Até</p>
              <Input
                type="month"
                value={toMonth}
                onChange={(e) => setToMonth(e.target.value)}
              />
            </div>
            <div className="md:col-span-2 flex items-end justify-end gap-2">
              <Button variant="outline" onClick={load} disabled={isLoading}>
                Atualizar
              </Button>
              <Button
                variant="secondary"
                onClick={handleSnapshotCurrentMonth}
                isLoading={isSnapshotLoading}
              >
                <History className="mr-2 h-4 w-4" />
                Salvar mês atual
              </Button>
              <Button onClick={handleDownloadCsv} isLoading={isDownloadLoading}>
                <Download className="mr-2 h-4 w-4" />
                Baixar CSV
              </Button>
            </div>
          </div>

          {message && <p className="text-sm text-emerald-600">{message}</p>}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Previsto acumulado</p>
            <p className="text-xl font-bold">{formatCurrency(totals.previsto)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Pago acumulado</p>
            <p className="text-xl font-bold text-emerald-600">
              {formatCurrency(totals.pago)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Saldo realizado acumulado</p>
            <p
              className={`text-xl font-bold ${
                totals.realizado >= 0 ? "text-emerald-600" : "text-red-600"
              }`}
            >
              {formatCurrency(totals.realizado)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Histórico salvo por mês</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum histórico salvo para o período.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="py-2 text-left">Mês</th>
                    <th className="py-2 text-right">Previsto</th>
                    <th className="py-2 text-right">Pago</th>
                    <th className="py-2 text-right">Pendente</th>
                    <th className="py-2 text-right">Atrasado</th>
                    <th className="py-2 text-right">Saldo realizado</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={`${row.month}-${row.id}`} className="border-b">
                      <td className="py-3 font-medium">{row.month.slice(0, 7)}</td>
                      <td className="py-3 text-right">{formatCurrency(row.previsto)}</td>
                      <td className="py-3 text-right">{formatCurrency(row.pago)}</td>
                      <td className="py-3 text-right">{formatCurrency(row.pendente)}</td>
                      <td className="py-3 text-right">{formatCurrency(row.atrasado)}</td>
                      <td className="py-3 text-right">
                        {formatCurrency(row.saldoRealizado)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
