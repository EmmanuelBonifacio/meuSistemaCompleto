"use client";
// =============================================================================
// src/modules/estoque/ProductTable.tsx
// =============================================================================
// O QUE FAZ:
//   Tabela responsiva de produtos com busca, paginação e ações (editar/excluir).
//   Renderiza os dados retornados pelo endpoint GET /estoque/produtos.
//
// CONCEITO DE "TABELA DE DADOS" EM SaaS:
//   Tabelas de dados são a principal forma de exibir listas de registros.
//   Boas tabelas precisam de:
//   - Cabeçalhos claros com labels dos campos
//   - Linhas com hover (feedback visual ao navegar)
//   - Ações rápidas por item (editar, excluir)
//   - Paginação (não carregar 10000 registros de uma vez)
//   - Estado vazio (mostrar mensagem útil quando não há dados)
//   - Estado de loading (skeleton enquanto busca)
// =============================================================================

import { useState, useEffect, useCallback } from "react";
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  Package,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { ProductForm } from "./ProductForm";
import * as estoqueService from "@/services/estoque.service";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Produto } from "@/types/api";

// =============================================================================
// COMPONENTE PRINCIPAL: ProductTable
// =============================================================================
export function ProductTable() {
  const [products, setProducts] = useState<Produto[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Estado de busca e paginação
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const LIMIT = 10;
  const totalPages = Math.ceil(total / LIMIT);

  // Estado do modal de formulário
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Produto | null>(null);

  // Mensagem de sucesso temporária
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // ID do produto aguardando confirmação de exclusão (dois cliques)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // ==========================================================================
  // Busca produtos quando page ou search mudam
  // useCallback memoriza a função para evitar loops no useEffect
  // ==========================================================================
  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await estoqueService.listProducts({
        page,
        search,
        limit: LIMIT,
      });
      setProducts(response.data);
      setTotal(response.total);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao carregar produtos.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    // Debounce: espera 300ms após o usuário parar de digitar antes de buscar.
    // Evita uma requisição ao Backend a cada letra digitada.
    const timer = setTimeout(fetchProducts, 300);
    return () => clearTimeout(timer);
  }, [fetchProducts]);

  function showSuccess(msg: string) {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  }

  async function handleDelete(product: Produto) {
    // Primeiro clique: pede confirmação sem usar window.confirm
    if (confirmDeleteId !== product.id) {
      setConfirmDeleteId(product.id);
      setTimeout(() => setConfirmDeleteId(null), 4000);
      return;
    }
    // Segundo clique: executa
    setConfirmDeleteId(null);
    try {
      await estoqueService.deleteProduct(product.id);
      showSuccess(`"${product.name}" desativado com sucesso.`);
      fetchProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao excluir produto.");
    }
  }

  function handleEdit(product: Produto) {
    setEditingProduct(product);
    setIsFormOpen(true);
  }

  function handleFormSuccess(msg: string) {
    setIsFormOpen(false);
    setEditingProduct(null);
    showSuccess(msg);
    fetchProducts();
  }

  return (
    <div className="space-y-4">
      {/* Cabeçalho com busca e botão novo */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar produtos..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={fetchProducts}
            disabled={isLoading}
          >
            <RefreshCw
              className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
            />
          </Button>
          <Button
            onClick={() => {
              setEditingProduct(null);
              setIsFormOpen(true);
            }}
            className="gap-1.5"
          >
            <Plus className="h-4 w-4" />
            Novo Produto
          </Button>
        </div>
      </div>

      {/* Mensagem de sucesso */}
      {successMsg && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800 animate-fade-in">
          {successMsg}
        </div>
      )}

      {/* Mensagem de erro */}
      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Tabela de produtos */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Produto
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide hidden md:table-cell">
                    SKU
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Preço
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide hidden sm:table-cell">
                    Estoque
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide hidden sm:table-cell">
                    Status
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  // Skeleton rows enquanto carrega
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      {[1, 2, 3, 4, 5, 6].map((j) => (
                        <td key={j} className="px-4 py-3">
                          <Skeleton className="h-4 w-full" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : products.length === 0 ? (
                  // Estado vazio
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Package className="h-8 w-8 opacity-40" />
                        <p className="text-sm">
                          {search
                            ? "Nenhum produto encontrado para sua busca."
                            : "Nenhum produto cadastrado ainda."}
                        </p>
                        {!search && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setIsFormOpen(true)}
                            className="mt-2"
                          >
                            <Plus className="h-3.5 w-3.5 mr-1" />
                            Cadastrar primeiro produto
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  // Linhas de dados
                  products.map((product) => (
                    <tr
                      key={product.id}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-foreground">
                            {product.name}
                          </p>
                          {product.description && (
                            <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                              {product.description}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground font-mono text-xs hidden md:table-cell">
                        {product.sku ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {formatCurrency(product.price)}
                      </td>
                      <td className="px-4 py-3 text-right hidden sm:table-cell">
                        <span
                          className={
                            product.quantity <= 5
                              ? "text-amber-600 font-medium"
                              : ""
                          }
                        >
                          {product.quantity}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center hidden sm:table-cell">
                        <Badge variant={product.isActive ? "success" : "muted"}>
                          {product.isActive ? "Ativo" : "Inativo"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleEdit(product)}
                            aria-label="Editar produto"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          {confirmDeleteId === product.id ? (
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="destructive"
                                className="h-6 text-[11px] px-2"
                                onClick={() => handleDelete(product)}
                              >
                                Confirmar
                              </Button>
                              <Button
                                size="icon-sm"
                                variant="ghost"
                                className="h-6 w-6"
                                onClick={() => setConfirmDeleteId(null)}
                              >
                                <ChevronLeft className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => handleDelete(product)}
                              className="hover:text-destructive hover:bg-destructive/10"
                              aria-label="Excluir produto"
                              title="Clique para excluir"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Paginação */}
          {!isLoading && total > LIMIT && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <p className="text-xs text-muted-foreground">
                {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} de{" "}
                {total} produtos
              </p>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de formulário (criar/editar) */}
      <ProductForm
        isOpen={isFormOpen}
        product={editingProduct}
        onClose={() => {
          setIsFormOpen(false);
          setEditingProduct(null);
        }}
        onSuccess={handleFormSuccess}
      />
    </div>
  );
}
