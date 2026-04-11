"use client";
// =============================================================================
// src/modules/financeiro/TransactionTable.tsx
// =============================================================================
// O QUE FAZ:
//   Tabela principal do módulo financeiro. Exibe todas as transações com:
//   - Filtro por tipo (todos/receita/despesa)
//   - Busca por descrição/categoria
//   - Paginação
//   - Ações de editar e excluir por linha
//   - Integra com FinanceiroSummary (KPIs) na parte superior
// =============================================================================

import { useState, useEffect, useCallback } from "react";
import {
  Search,
  PlusCircle,
  Edit2,
  Trash2,
  TrendingUp,
  TrendingDown,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FinanceiroSummary } from "./FinanceiroSummary";
import { TransactionForm } from "./TransactionForm";
import {
  listTransactions,
  deleteTransaction,
  getFinanceiroSummary,
} from "@/services/financeiro.service";
import { formatCurrency, formatDate } from "@/lib/utils";
import type {
  Transacao,
  TransacaoListResponse,
  TransactionType,
  FinanceiroSummaryData,
} from "@/types/api";

// Número de linhas por página
const PAGE_SIZE = 10;

// Tipos de filtro disponíveis para o dropdown
type Filter = "all" | TransactionType;

const FILTER_OPTIONS: { value: Filter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "receita", label: "Receitas" },
  { value: "despesa", label: "Despesas" },
];

export function TransactionTable() {
  // Estado da lista de transações
  const [data, setData] = useState<TransacaoListResponse | null>(null);
  const [summary, setSummary] = useState<FinanceiroSummaryData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros e paginação
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(1);

  // Modal de criação/edição
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] =
    useState<Transacao | null>(null);

  // Feedback após ação
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Carrega transações e resumo financeiro
  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params: Parameters<typeof listTransactions>[0] = {
        page,
        limit: PAGE_SIZE,
        ...(search.trim() && { search: search.trim() }),
        ...(filter !== "all" && { type: filter }),
      };
      const [txResult, sumResult] = await Promise.all([
        listTransactions(params),
        getFinanceiroSummary(),
      ]);
      setData(txResult);
      setSummary(sumResult);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao carregar transações.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [page, search, filter]);

  // Recarrega ao mudar filtros ou página
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Reseta para a primeira página ao mudar busca/filtro
  useEffect(() => {
    setPage(1);
  }, [search, filter]);

  // Exibe mensagem de sucesso por 3 segundos
  useEffect(() => {
    if (!successMsg) return;
    const timer = setTimeout(() => setSuccessMsg(null), 3000);
    return () => clearTimeout(timer);
  }, [successMsg]);

  async function handleDelete(tx: Transacao) {
    const confirmed = window.confirm(
      `Excluir a transação "${tx.description}"?\nEssa ação não pode ser desfeita.`,
    );
    if (!confirmed) return;
    try {
      await deleteTransaction(tx.id);
      setSuccessMsg("Transação excluída com sucesso!");
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao excluir.");
    }
  }

  function handleEdit(tx: Transacao) {
    setEditingTransaction(tx);
    setIsFormOpen(true);
  }

  function handleNew() {
    setEditingTransaction(null);
    setIsFormOpen(true);
  }

  function handleFormSuccess(msg: string) {
    setIsFormOpen(false);
    setEditingTransaction(null);
    setSuccessMsg(msg);
    loadData();
  }

  // Total de páginas calculado a partir da resposta da API
  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <FinanceiroSummary summary={summary ?? undefined} isLoading={isLoading} />

      {/* Mensagem de sucesso */}
      {successMsg && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <TrendingUp className="h-4 w-4 shrink-0" />
          {successMsg}
        </div>
      )}

      {/* Mensagem de erro */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Cabeçalho + Filtros */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-lg">Lançamentos</CardTitle>
            <Button size="sm" onClick={handleNew}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Nova Transação
            </Button>
          </div>

          {/* Linha de filtros */}
          <div className="flex flex-col gap-3 sm:flex-row">
            {/* Campo busca */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por descrição ou categoria..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Filtro por tipo */}
            <div className="flex gap-1 rounded-lg border border-border p-1">
              {FILTER_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setFilter(opt.value)}
                  className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
                    filter === opt.value
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Tipo
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Descrição
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">
                    Categoria
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    Valor
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden sm:table-cell">
                    Data
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody>
                {/* Estado de carregamento: linhas skeleton */}
                {isLoading &&
                  Array.from({ length: PAGE_SIZE }).map((_, i) => (
                    <tr key={i} className="border-b border-border">
                      <td className="px-4 py-3">
                        <Skeleton className="h-5 w-16 rounded-full" />
                      </td>
                      <td className="px-4 py-3">
                        <Skeleton className="h-4 w-48" />
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <Skeleton className="h-4 w-24" />
                      </td>
                      <td className="px-4 py-3">
                        <Skeleton className="h-4 w-20 ml-auto" />
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <Skeleton className="h-4 w-24" />
                      </td>
                      <td className="px-4 py-3">
                        <Skeleton className="h-7 w-16 ml-auto" />
                      </td>
                    </tr>
                  ))}

                {/* Estado vazio */}
                {!isLoading &&
                  (!data?.transactions || data.transactions.length === 0) && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-12 text-center text-muted-foreground"
                      >
                        <TrendingUp className="mx-auto mb-3 h-8 w-8 opacity-30" />
                        <p className="font-medium">
                          Nenhuma transação encontrada
                        </p>
                        <p className="text-xs mt-1">
                          {search || filter !== "all"
                            ? "Tente ajustar os filtros de busca."
                            : "Clique em 'Nova Transação' para começar."}
                        </p>
                      </td>
                    </tr>
                  )}

                {/* Linhas de dados */}
                {!isLoading &&
                  data?.transactions.map((tx) => (
                    <tr
                      key={tx.id}
                      className="border-b border-border hover:bg-muted/30 transition-colors"
                    >
                      {/* Badge do tipo */}
                      <td className="px-4 py-3">
                        {tx.type === "receita" ? (
                          <Badge variant="success" className="gap-1">
                            <TrendingUp className="h-3 w-3" />
                            Receita
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="gap-1">
                            <TrendingDown className="h-3 w-3" />
                            Despesa
                          </Badge>
                        )}
                      </td>

                      {/* Descrição */}
                      <td className="px-4 py-3 font-medium text-foreground">
                        {tx.description}
                      </td>

                      {/* Categoria */}
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                        {tx.category ?? <span className="text-xs">—</span>}
                      </td>

                      {/* Valor colorido pelo tipo */}
                      <td
                        className={`px-4 py-3 text-right font-semibold tabular-nums ${
                          tx.type === "receita"
                            ? "text-emerald-600"
                            : "text-red-600"
                        }`}
                      >
                        {tx.type === "receita" ? "+" : "-"}{" "}
                        {formatCurrency(tx.amount)}
                      </td>

                      {/* Data */}
                      <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                        {formatDate(tx.transactionDate)}
                      </td>

                      {/* Ações */}
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleEdit(tx)}
                            title="Editar"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleDelete(tx)}
                            title="Excluir"
                            className="text-destructive hover:text-destructive/80"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* Barra de paginação */}
          {!isLoading && totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border px-4 py-3">
              <span className="text-sm text-muted-foreground">
                Página {page} de {totalPages} &middot; {data?.total ?? 0}{" "}
                registros
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de criação/edição */}
      <TransactionForm
        isOpen={isFormOpen}
        transaction={editingTransaction}
        onClose={() => {
          setIsFormOpen(false);
          setEditingTransaction(null);
        }}
        onSuccess={handleFormSuccess}
      />
    </div>
  );
}
