// =============================================================================
// src/modules/vendas/admin/VendasDashboard.tsx
// =============================================================================
// O QUE FAZ:
//   Dashboard do painel admin do módulo SalesWpp.
//   Exibe:
//     - Cards de métricas: total de pedidos, valor total, produtos cadastrados
//     - Tabela de pedidos recentes + controle de status
//     - Tabela/listagem de produtos com modal de add/edit/delete
// =============================================================================

"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ShoppingBag,
  DollarSign,
  Package,
  Clock,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  RefreshCw,
  Settings,
  Save,
} from "lucide-react";
import Image from "next/image";
import type {
  ProdutoVenda,
  PedidoVenda,
  ResumoVendas,
} from "@/types/vendas.types";
import { CATEGORIAS_LABEL } from "@/types/vendas.types";
import {
  listProdutosAdmin,
  listPedidos,
  getResumo,
  deleteProduto,
  getVendasConfig,
  updateVendasConfig,
} from "@/services/vendas.service";
import { ProductModal } from "./ProductModal";
import { OrdersTable } from "./OrdersTable";

// =============================================================================
// COMPONENTE: MetricCard (card de KPI)
// =============================================================================
function MetricCard({
  icon: Icon,
  label,
  valor,
  cor,
}: {
  icon: React.ElementType;
  label: string;
  valor: string;
  cor: string;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex items-center gap-4">
      <div
        className={`flex items-center justify-center w-12 h-12 rounded-xl ${cor}`}
      >
        <Icon className="w-6 h-6 text-white" />
      </div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-xl font-bold text-gray-900">{valor}</p>
      </div>
    </div>
  );
}

// =============================================================================
// COMPONENTE: VendasDashboard
// =============================================================================
export function VendasDashboard() {
  const [aba, setAba] = useState<"pedidos" | "produtos" | "configuracoes">(
    "pedidos",
  );
  const [produtos, setProdutos] = useState<ProdutoVenda[]>([]);
  const [pedidos, setPedidos] = useState<PedidoVenda[]>([]);
  const [resumo, setResumo] = useState<ResumoVendas | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [produtoEditando, setProdutoEditando] = useState<ProdutoVenda | null>(
    null,
  );
  const [deletandoId, setDeletandoId] = useState<string | null>(null);
  const [config, setConfig] = useState({ whatsapp_number: "", nome_loja: "" });
  const [salvandoConfig, setSalvandoConfig] = useState(false);

  const formatarMoeda = (valor: number) =>
    valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  // -------------------------------------------------------------------------
  // Carrega todos os dados do dashboard
  // -------------------------------------------------------------------------
  const carregarDados = useCallback(async () => {
    setIsLoading(true);
    try {
      const [produtosRes, pedidosRes, resumoRes, configRes] = await Promise.all(
        [
          listProdutosAdmin(),
          listPedidos(),
          getResumo(),
          getVendasConfig().catch(() => ({
            whatsapp_number: null,
            nome_loja: null,
          })),
        ],
      );
      setProdutos(produtosRes.data);
      setPedidos(pedidosRes.pedidos);
      setResumo(resumoRes);
      setConfig({
        whatsapp_number: configRes.whatsapp_number ?? "",
        nome_loja: configRes.nome_loja ?? "",
      });
    } catch (err) {
      console.error("[VendasDashboard] Erro ao carregar dados:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  // -------------------------------------------------------------------------
  // Deletar produto com confirmação
  // -------------------------------------------------------------------------
  const handleDeletar = async (produto: ProdutoVenda) => {
    const confirmado = window.confirm(
      `Tem certeza que deseja deletar o produto "${produto.nome}"? Esta ação é irreversível.`,
    );
    if (!confirmado) return;

    setDeletandoId(produto.id);
    try {
      await deleteProduto(produto.id);
      setProdutos((prev) => prev.filter((p) => p.id !== produto.id));
    } catch {
      alert("Erro ao deletar produto. Tente novamente.");
    } finally {
      setDeletandoId(null);
    }
  };

  // -------------------------------------------------------------------------
  // Callback quando produto é salvo no modal (add ou edit)
  // -------------------------------------------------------------------------
  const handleProdutoSalvo = (produtoSalvo: ProdutoVenda) => {
    setProdutos((prev) => {
      const existe = prev.find((p) => p.id === produtoSalvo.id);
      if (existe) {
        // Atualiza produto existente
        return prev.map((p) => (p.id === produtoSalvo.id ? produtoSalvo : p));
      }
      // Adiciona novo produto
      return [produtoSalvo, ...prev];
    });
  };

  // -------------------------------------------------------------------------
  // Callback quando pedido é atualizado na tabela
  // -------------------------------------------------------------------------
  const handlePedidoAtualizado = (pedidoAtualizado: PedidoVenda) => {
    setPedidos((prev) =>
      prev.map((p) => (p.id === pedidoAtualizado.id ? pedidoAtualizado : p)),
    );
  };

  // -------------------------------------------------------------------------
  // Abre modal para edição de produto
  // -------------------------------------------------------------------------
  const handleEditarProduto = (produto: ProdutoVenda) => {
    setProdutoEditando(produto);
    setModalAberto(true);
  };

  const handleAbrirAdicionarProduto = () => {
    setProdutoEditando(null);
    setModalAberto(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ===== MÉTRICAS ===== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          icon={ShoppingBag}
          label="Total de Pedidos"
          valor={String(resumo?.totalPedidos ?? 0)}
          cor="bg-indigo-500"
        />
        <MetricCard
          icon={DollarSign}
          label="Valor Total (pago+finalizado)"
          valor={formatarMoeda(resumo?.totalValor ?? 0)}
          cor="bg-green-500"
        />
        <MetricCard
          icon={Package}
          label="Produtos Cadastrados"
          valor={String(produtos.length)}
          cor="bg-purple-500"
        />
        <MetricCard
          icon={Clock}
          label="Pedidos Pendentes"
          valor={String(resumo?.porStatus?.["pendente"] ?? 0)}
          cor="bg-yellow-500"
        />
      </div>

      {/* ===== ABAS ===== */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
        {/* Header das abas */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100 flex-wrap gap-3">
          <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
            <button
              onClick={() => setAba("pedidos")}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                aba === "pedidos"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Pedidos via WhatsApp
              {(resumo?.porStatus?.["pendente"] ?? 0) > 0 && (
                <span className="ml-2 bg-yellow-400 text-yellow-900 text-xs font-bold px-1.5 py-0.5 rounded-full">
                  {resumo?.porStatus?.["pendente"]}
                </span>
              )}
            </button>
            <button
              onClick={() => setAba("produtos")}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                aba === "produtos"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Produtos
            </button>
            <button
              onClick={() => setAba("configuracoes")}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                aba === "configuracoes"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Configurações
            </button>
          </div>

          <div className="flex gap-2">
            {/* Botão Adicionar Produto (apenas na aba produtos) */}
            {aba === "produtos" && (
              <button
                onClick={handleAbrirAdicionarProduto}
                className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
              >
                <Plus className="w-4 h-4" />
                Adicionar Produto
              </button>
            )}
            {/* Botão Recarregar */}
            <button
              onClick={carregarDados}
              className="flex items-center gap-1.5 border border-gray-200 hover:bg-gray-50 text-gray-600 text-sm font-medium px-3 py-2 rounded-xl transition-colors"
              aria-label="Recarregar dados"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Conteúdo da aba selecionada */}
        <div className="p-4">
          {/* ABA: Pedidos */}
          {aba === "pedidos" && (
            <OrdersTable
              pedidos={pedidos}
              onPedidoAtualizado={handlePedidoAtualizado}
            />
          )}

          {/* ABA: Configurações */}
          {aba === "configuracoes" && (
            <div className="max-w-lg space-y-5 py-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Número do WhatsApp
                </label>
                <p className="text-xs text-gray-500 mb-2">
                  Número completo com DDI e DDD, sem espaços ou traços. Ex:
                  5538998184735
                </p>
                <input
                  type="text"
                  value={config.whatsapp_number}
                  onChange={(e) =>
                    setConfig((c) => ({
                      ...c,
                      whatsapp_number: e.target.value,
                    }))
                  }
                  placeholder="5538998184735"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome da Loja
                </label>
                <input
                  type="text"
                  value={config.nome_loja}
                  onChange={(e) =>
                    setConfig((c) => ({ ...c, nome_loja: e.target.value }))
                  }
                  placeholder="Minha Loja"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
                />
              </div>
              <button
                onClick={async () => {
                  setSalvandoConfig(true);
                  try {
                    await updateVendasConfig({
                      whatsapp_number: config.whatsapp_number || undefined,
                      nome_loja: config.nome_loja || undefined,
                    });
                    alert("Configurações salvas com sucesso!");
                  } catch {
                    alert("Erro ao salvar. Tente novamente.");
                  } finally {
                    setSalvandoConfig(false);
                  }
                }}
                disabled={salvandoConfig}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
              >
                {salvandoConfig ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Salvar Configurações
              </button>
            </div>
          )}

          {/* ABA: Produtos */}
          {aba === "produtos" && (
            <div>
              {produtos.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                  <Package className="w-12 h-12 mx-auto mb-3 text-gray-200" />
                  <p className="font-medium">Nenhum produto cadastrado</p>
                  <p className="text-sm mt-1">
                    Clique em "Adicionar Produto" para começar
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-gray-100">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="text-left px-4 py-3 font-medium text-gray-600">
                          Produto
                        </th>
                        <th className="text-left px-4 py-3 font-medium text-gray-600">
                          Categoria
                        </th>
                        <th className="text-right px-4 py-3 font-medium text-gray-600">
                          Preço
                        </th>
                        <th className="text-center px-4 py-3 font-medium text-gray-600">
                          Status
                        </th>
                        <th className="text-center px-4 py-3 font-medium text-gray-600">
                          Ações
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {produtos.map((produto) => (
                        <tr
                          key={produto.id}
                          className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors"
                        >
                          {/* Foto + Nome */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                                {produto.foto_url ? (
                                  <Image
                                    src={produto.foto_url}
                                    alt={produto.nome}
                                    fill
                                    className="object-cover"
                                    sizes="40px"
                                  />
                                ) : (
                                  <Package className="w-5 h-5 text-gray-300 m-auto mt-2.5" />
                                )}
                              </div>
                              <div>
                                <p className="font-medium text-gray-900">
                                  {produto.nome}
                                </p>
                                {produto.destaque && (
                                  <span className="text-xs text-indigo-600 font-medium">
                                    ★ Destaque
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          {/* Categoria */}
                          <td className="px-4 py-3 text-gray-600">
                            {CATEGORIAS_LABEL[produto.categoria] ??
                              produto.categoria}
                          </td>
                          {/* Preço */}
                          <td className="px-4 py-3 text-right">
                            {produto.preco_promocional ? (
                              <div>
                                <p className="text-xs text-gray-400 line-through">
                                  {formatarMoeda(produto.preco)}
                                </p>
                                <p className="font-semibold text-red-600">
                                  {formatarMoeda(produto.preco_promocional)}
                                </p>
                              </div>
                            ) : (
                              <p className="font-semibold text-gray-900">
                                {formatarMoeda(produto.preco)}
                              </p>
                            )}
                          </td>
                          {/* Status ativo/inativo */}
                          <td className="px-4 py-3 text-center">
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium ${
                                produto.ativo
                                  ? "bg-green-100 text-green-800"
                                  : "bg-gray-100 text-gray-600"
                              }`}
                            >
                              {produto.ativo ? "Ativo" : "Inativo"}
                            </span>
                          </td>
                          {/* Ações */}
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => handleEditarProduto(produto)}
                                className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                aria-label="Editar produto"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeletar(produto)}
                                disabled={deletandoId === produto.id}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                                aria-label="Deletar produto"
                              >
                                {deletandoId === produto.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Trash2 className="w-4 h-4" />
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal de Add/Edit Produto */}
      <ProductModal
        isOpen={modalAberto}
        onClose={() => setModalAberto(false)}
        produto={produtoEditando}
        onSalvo={handleProdutoSalvo}
      />
    </div>
  );
}
