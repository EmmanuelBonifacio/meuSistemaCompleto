"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CircleCheck, Clock3, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getFinancialProjection, settleOccurrence } from "@/services/financeiro.service";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { FinancialProjectionResponse } from "@/types/api";

export function ProjectionPanel() {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [data, setData] = useState<FinancialProjectionResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [settlingId, setSettlingId] = useState<string | null>(null);
  const [status, setStatus] = useState<"all" | "pendente" | "pago" | "atrasado" | "cancelado">("all");
  const [type, setType] = useState<"all" | "conta_fixa_mensal" | "assinatura_mensal" | "parcelamento">("all");
  const [supplier, setSupplier] = useState("");
  const [costCenter, setCostCenter] = useState("");

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await getFinancialProjection({
        fromMonth: month,
        toMonth: month,
        status: status === "all" ? undefined : status,
        type: type === "all" ? undefined : type,
        supplier: supplier.trim() || undefined,
        costCenter: costCenter.trim() || undefined,
      });
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar projeção.");
    } finally {
      setIsLoading(false);
    }
  }, [month, status, type, supplier, costCenter]);

  useEffect(() => {
    load();
  }, [load]);

  const cards = useMemo(
    () => [
      {
        label: "Previsto no mês",
        value: data?.resumo.totalPrevisto ?? 0,
        className: "text-foreground",
      },
      {
        label: "Pago no mês",
        value: data?.resumo.totalPago ?? 0,
        className: "text-emerald-600",
      },
      {
        label: "Atrasado",
        value: data?.resumo.totalAtrasado ?? 0,
        className: "text-red-600",
      },
    ],
    [data],
  );

  async function handleSettle(id: string) {
    setSettlingId(id);
    try {
      await settleOccurrence(id, {});
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao baixar ocorrência.");
    } finally {
      setSettlingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Competência</p>
          <Input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="w-[200px]"
          />
        </div>
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Status</p>
          <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="pago">Pago</SelectItem>
              <SelectItem value="atrasado">Atrasado</SelectItem>
              <SelectItem value="cancelado">Cancelado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Tipo</p>
          <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="conta_fixa_mensal">Conta fixa</SelectItem>
              <SelectItem value="assinatura_mensal">Assinatura</SelectItem>
              <SelectItem value="parcelamento">Parcelamento</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Fornecedor</p>
          <Input value={supplier} onChange={(e) => setSupplier(e.target.value)} />
        </div>
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Centro custo</p>
          <div className="flex gap-2">
            <Input value={costCenter} onChange={(e) => setCostCenter(e.target.value)} />
            <Button variant="outline" onClick={load}>
              Atualizar
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {cards.map((card) => (
          <Card key={card.label}>
            <CardContent className="pt-6">
              <p className="text-xs text-muted-foreground">{card.label}</p>
              <p className={`text-2xl font-bold ${card.className}`}>
                {formatCurrency(card.value)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Ocorrências do mês</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando projeção...</p>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : !data?.ocorrencias.length ? (
            <p className="text-sm text-muted-foreground">
              Sem ocorrências para esta competência.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="py-2 text-left">Compromisso</th>
                    <th className="py-2 text-left">Vencimento</th>
                    <th className="py-2 text-right">Valor</th>
                    <th className="py-2 text-left">Status</th>
                    <th className="py-2 text-left">Fornecedor</th>
                    <th className="py-2 text-left">Centro custo</th>
                    <th className="py-2 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {data.ocorrencias.map((item) => (
                    <tr key={item.id} className="border-b">
                      <td className="py-3 font-medium">
                        {item.commitmentTitle}
                        {item.installmentNumber > 0 &&
                          item.installmentCount &&
                          ` (${item.installmentNumber}/${item.installmentCount})`}
                      </td>
                      <td className="py-3">{formatDate(item.dueDate)}</td>
                      <td className="py-3 text-right">
                        {formatCurrency(item.expectedAmount)}
                      </td>
                      <td className="py-3">
                        {item.status === "pago" ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600">
                            <CircleCheck className="h-4 w-4" /> Pago
                          </span>
                        ) : item.status === "atrasado" ? (
                          <span className="inline-flex items-center gap-1 text-red-600">
                            <Clock3 className="h-4 w-4" /> Atrasado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-amber-600">
                            <Wallet className="h-4 w-4" /> Pendente
                          </span>
                        )}
                      </td>
                      <td className="py-3">{item.supplier ?? "-"}</td>
                      <td className="py-3">{item.costCenter ?? "-"}</td>
                      <td className="py-3">
                        <div className="flex justify-end">
                          {item.status !== "pago" && item.status !== "cancelado" ? (
                            <Button
                              size="sm"
                              onClick={() => handleSettle(item.id)}
                              isLoading={settlingId === item.id}
                            >
                              Marcar pago
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </div>
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
