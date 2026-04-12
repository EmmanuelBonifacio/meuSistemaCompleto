// =============================================================================
// src/app/[slug]/vendas/page.tsx
// =============================================================================
// O QUE FAZ:
//   Página pública do catálogo de vendas — a "vitrine" da loja.
//   Exibe produtos organizados em fileiras horizontais por categoria.
//   A primeira fileira é sempre "Lançamentos".
//   Inclui header com logo + busca + ícone do carrinho, e o chat fake.
//
// FLUXO COMPLETO:
//   1. Página carrega os produtos via GET /vendas/produtos (público)
//   2. Renderiza uma fileira por categoria (CategoryRow)
//   3. Visitante clica "Adicionar ao Carrinho" → useCart adiciona ao drawer
//   4. Visitante abre o carrinho e clica "Finalizar no WhatsApp"
//   5. Link wa.me abre, pedido é registrado no backend silenciosamente
// =============================================================================

"use client";

import { useState, useEffect, useMemo } from "react";
import { Search, ShoppingCart, Store } from "lucide-react";
import { useParams } from "next/navigation";
import { CategoryRow } from "@/modules/vendas/components/CategoryRow";
import { CartDrawer } from "@/modules/vendas/components/CartDrawer";
import { FakeChatWidget } from "@/modules/vendas/components/FakeChatWidget";
import { useCart } from "@/modules/vendas/hooks/useCart";
import {
  listProdutosCatalogo,
  getVendasConfig,
} from "@/services/vendas.service";
import type { ProdutoVenda } from "@/types/vendas.types";
import { CATEGORIAS_LABEL } from "@/types/vendas.types";

// Ordem das categorias — Lançamentos SEMPRE primeiro
const ORDEM_CATEGORIAS = [
  "lancamentos",
  "mais-vendidos",
  "promocoes",
  "eletronicos",
  "vestuario",
  "acessorios",
  "servicos",
];

export default function VendasPage() {
  const params = useParams<{ slug: string }>();
  const [produtos, setProdutos] = useState<ProdutoVenda[]>([]);
  const [busca, setBusca] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [whatsappNumber, setWhatsappNumber] = useState("");

  const {
    itens,
    totalItens,
    totalValor,
    adicionarItem,
    removerItem,
    atualizarQuantidade,
    limparCarrinho,
    isOpen: isCartOpen,
    setIsOpen: setIsCartOpen,
  } = useCart();

  // -------------------------------------------------------------------------
  // Carrega os produtos do catálogo ao montar a página
  // -------------------------------------------------------------------------
  useEffect(() => {
    listProdutosCatalogo({ limit: 200, slug: params.slug })
      .then((res) => setProdutos(res.data))
      .catch((err) =>
        console.error("[VendasPage] Erro ao carregar produtos:", err),
      )
      .finally(() => setIsLoading(false));
  }, []);

  // Carrega o número de WhatsApp configurado pelo tenant
  useEffect(() => {
    getVendasConfig(params.slug)
      .then((cfg) => {
        if (cfg.whatsapp_number) setWhatsappNumber(cfg.whatsapp_number);
      })
      .catch(() => {
        // Silencioso — sem número configurado, botões ficam ocultos
      });
  }, [params.slug]);

  // -------------------------------------------------------------------------
  // Filtra produtos pela busca e agrupa por categoria (memoizado)
  // -------------------------------------------------------------------------
  const produtosPorCategoria = useMemo(() => {
    const textoBusca = busca.toLowerCase().trim();

    const filtrados = textoBusca
      ? produtos.filter(
          (p) =>
            p.nome.toLowerCase().includes(textoBusca) ||
            p.descricao?.toLowerCase().includes(textoBusca),
        )
      : produtos;

    // Agrupa em um Map: categoria → [produtos]
    const mapa = new Map<string, ProdutoVenda[]>();

    for (const categoria of ORDEM_CATEGORIAS) {
      const grupo = filtrados.filter((p) => p.categoria === categoria);
      if (grupo.length > 0) {
        mapa.set(categoria, grupo);
      }
    }

    // Categorias não mapeadas em ORDEM_CATEGORIAS vão pro final
    for (const produto of filtrados) {
      if (!ORDEM_CATEGORIAS.includes(produto.categoria)) {
        const atual = mapa.get(produto.categoria) ?? [];
        mapa.set(produto.categoria, [...atual, produto]);
      }
    }

    return mapa;
  }, [produtos, busca]);

  const semResultados = busca && produtosPorCategoria.size === 0;

  return (
    <>
      {/* ===== HEADER ===== */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-4">
          {/* Logo / Nome da Loja */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="flex items-center justify-center w-8 h-8 bg-indigo-600 rounded-lg">
              <Store className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-gray-900 text-lg tracking-tight">
              {params.slug}
            </span>
          </div>

          {/* Barra de Busca */}
          <div className="flex-1 max-w-lg mx-auto">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar produtos..."
                className="w-full pl-9 pr-4 py-2 text-sm bg-gray-100 border border-transparent rounded-xl focus:outline-none focus:bg-white focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/20 transition-all"
              />
            </div>
          </div>

          {/* Ícone do Carrinho */}
          <button
            onClick={() => setIsCartOpen(true)}
            aria-label={`Abrir carrinho (${totalItens} ${totalItens === 1 ? "item" : "itens"})`}
            className="relative flex items-center justify-center p-2 rounded-xl hover:bg-gray-100 transition-colors flex-shrink-0"
          >
            <ShoppingCart className="w-5 h-5 text-gray-700" />
            {totalItens > 0 && (
              <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 bg-indigo-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
                {totalItens > 99 ? "99+" : totalItens}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* ===== CONTEÚDO PRINCIPAL ===== */}
      <main>
        {/* Hero Banner — personalize aqui */}
        <div className="bg-gradient-to-br from-indigo-600 to-purple-700 text-white py-12 px-4 text-center">
          <h1 className="text-3xl sm:text-4xl font-bold mb-2">
            Bem-vindo à nossa loja! 🛍️
          </h1>
          <p className="text-indigo-100 text-lg">
            Encontre os melhores produtos e finalize pelo WhatsApp
          </p>
        </div>

        {/* Estado de carregamento */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-500 text-sm">Carregando produtos...</p>
          </div>
        )}

        {/* Sem resultados de busca */}
        {semResultados && (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-center px-4">
            <Search className="w-12 h-12 text-gray-200" />
            <p className="text-gray-600 font-medium">
              Nenhum produto encontrado para "{busca}"
            </p>
            <button
              onClick={() => setBusca("")}
              className="text-sm text-indigo-600 hover:underline"
            >
              Limpar busca
            </button>
          </div>
        )}

        {/* Fileiras de Categorias */}
        {!isLoading && !semResultados && (
          <div className="divide-y divide-gray-100">
            {Array.from(produtosPorCategoria.entries()).map(
              ([categoria, produtosDaCategoria]) => (
                <CategoryRow
                  key={categoria}
                  categoria={categoria}
                  produtos={produtosDaCategoria}
                  whatsappNumber={whatsappNumber}
                  onAdicionarCarrinho={adicionarItem}
                />
              ),
            )}
          </div>
        )}

        {/* Estado vazio (sem produtos cadastrados) */}
        {!isLoading && produtos.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-center px-4">
            <ShoppingCart className="w-16 h-16 text-gray-200" />
            <p className="text-gray-600 font-medium text-lg">
              Nenhum produto disponível ainda
            </p>
            <p className="text-gray-400 text-sm">
              Em breve novidades por aqui!
            </p>
          </div>
        )}
      </main>

      {/* ===== FOOTER SIMPLES ===== */}
      <footer className="py-8 text-center text-xs text-gray-400 border-t border-gray-100 mt-8">
        <p>Pagamentos e entregas via WhatsApp • {params.slug}</p>
      </footer>

      {/* ===== CARRINHO LATERAL ===== */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        itens={itens}
        totalValor={totalValor}
        whatsappNumber={whatsappNumber}
        slug={params.slug}
        onAtualizarQuantidade={atualizarQuantidade}
        onRemoverItem={removerItem}
        onLimparCarrinho={limparCarrinho}
      />

      {/* ===== CHAT FAKE ===== */}
      <FakeChatWidget whatsappNumber={whatsappNumber} />
    </>
  );
}
