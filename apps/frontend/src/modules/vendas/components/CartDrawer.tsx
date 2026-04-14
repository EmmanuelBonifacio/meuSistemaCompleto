// =============================================================================
// src/modules/vendas/components/CartDrawer.tsx
// =============================================================================
// O QUE FAZ:
//   Drawer (painel lateral deslizante) que exibe os itens do carrinho.
//   Permite alterar quantidades, remover itens e finalizar pelo WhatsApp.
//
// FLUXO DE CHECKOUT:
//   1. Visitante clica no ícone do carrinho no Header
//   2. Drawer desliza da direita
//   3. Visitante revisa itens e quantidades
//   4. Clica em "Finalizar no WhatsApp"
//   5. Link wa.me abre o WhatsApp com o resumo do pedido
//   6. Pedido é registrado silenciosamente na API (POST /vendas/pedidos)
// =============================================================================

"use client";

import { useTransition } from "react";
import { X, Trash2, ShoppingBag, MessageCircle } from "lucide-react";
import Image from "next/image";
import type { ItemCarrinho } from "@/types/vendas.types";
import { gerarLinkWhatsAppCarrinho } from "@/modules/vendas/lib/whatsapp";
import { createPedido } from "@/services/vendas.service";

// Resolve URL relativa para absoluta (corrige imagens do carrinho)
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";
function resolveImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${API_BASE}${url}`;
}

// =============================================================================
// PROPS
// =============================================================================
interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  itens: ItemCarrinho[];
  totalValor: number;
  whatsappNumber: string;
  slug: string;
  onAtualizarQuantidade: (produtoId: string, quantidade: number) => void;
  onRemoverItem: (produtoId: string) => void;
  onLimparCarrinho: () => void;
  corPrimaria?: string;
}

// =============================================================================
// COMPONENTE: CartDrawer
// =============================================================================
export function CartDrawer({
  isOpen,
  onClose,
  itens,
  totalValor,
  whatsappNumber,
  slug,
  onAtualizarQuantidade,
  onRemoverItem,
  onLimparCarrinho,
  corPrimaria = "#4f46e5",
}: CartDrawerProps) {
  const [isPending, startTransition] = useTransition();

  const formatarMoeda = (valor: number) =>
    valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  // -------------------------------------------------------------------------
  // Finalizar no WhatsApp
  // -------------------------------------------------------------------------
  // Gera o link wa.me e registra o pedido no backend simultaneamente.
  const handleFinalizarWhatsApp = () => {
    if (itens.length === 0) return;

    const link = gerarLinkWhatsAppCarrinho(itens, whatsappNumber);

    // Registra o pedido no banco (silenciosamente — visitante não precisa saber)
    startTransition(() => {
      createPedido({ itens, total: totalValor, slug }).catch((err) => {
        // Falha silenciosa — não bloqueia o checkout
        console.error("[Carrinho] Erro ao registrar pedido:", err);
      });
    });

    // Abre o WhatsApp em nova aba
    window.open(link, "_blank", "noopener,noreferrer");

    // Limpa o carrinho e fecha o drawer após finalizar
    onLimparCarrinho();
    onClose();
  };

  return (
    <>
      {/* Overlay escuro — clicar fora fecha o drawer */}
      <div
        className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer lateral */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Carrinho de compras"
        className={`fixed right-0 top-0 z-50 h-full w-full max-w-md bg-white shadow-2xl flex flex-col transition-transform duration-300 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header do Drawer */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-gray-700" />
            <h2 className="font-semibold text-gray-900">
              Carrinho ({itens.length} {itens.length === 1 ? "item" : "itens"})
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar carrinho"
            className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Lista de Itens (área scrollável) */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {itens.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center py-16">
              <ShoppingBag className="w-16 h-16 text-gray-200" />
              <p className="text-gray-500 font-medium">
                Seu carrinho está vazio
              </p>
              <p className="text-sm text-gray-400">
                Adicione produtos para continuar
              </p>
            </div>
          ) : (
            itens.map((item) => (
              <div
                key={item.produto_id}
                className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl"
              >
                {/* Foto do item — corrige URLs relativas */}
                <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                  {item.foto_url ? (
                    <Image
                      src={resolveImageUrl(item.foto_url)!}
                      alt={item.nome}
                      fill
                      className="object-cover"
                      sizes="64px"
                      unoptimized
                    />
                  ) : (
                    <ShoppingBag className="w-8 h-8 text-gray-300 m-auto mt-4" />
                  )}
                </div>

                {/* Informações do item */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {item.nome}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatarMoeda(item.preco)} / un.
                  </p>
                  <p
                    className="text-sm font-bold"
                    style={{ color: corPrimaria }}
                  >
                    {formatarMoeda(item.preco * item.quantidade)}
                  </p>
                </div>

                {/* Controle de quantidade */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() =>
                      onAtualizarQuantidade(
                        item.produto_id,
                        item.quantidade - 1,
                      )
                    }
                    className="w-6 h-6 rounded-full bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-bold flex items-center justify-center transition-colors"
                    aria-label="Diminuir quantidade"
                  >
                    −
                  </button>
                  <span className="w-6 text-center text-sm font-semibold text-gray-900">
                    {item.quantidade}
                  </span>
                  <button
                    onClick={() =>
                      onAtualizarQuantidade(
                        item.produto_id,
                        item.quantidade + 1,
                      )
                    }
                    className="w-6 h-6 rounded-full bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-bold flex items-center justify-center transition-colors"
                    aria-label="Aumentar quantidade"
                  >
                    +
                  </button>

                  {/* Botão remover item */}
                  <button
                    onClick={() => onRemoverItem(item.produto_id)}
                    className="ml-1 p-1 text-gray-400 hover:text-red-500 transition-colors"
                    aria-label="Remover item"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer com Total e Botão de Checkout */}
        {itens.length > 0 && (
          <div className="border-t border-gray-100 p-4 space-y-3">
            {/* Total */}
            <div className="flex items-center justify-between">
              <span className="text-gray-600 font-medium">Total</span>
              <span className="text-xl font-bold text-gray-900">
                {formatarMoeda(totalValor)}
              </span>
            </div>

            {/* Botão Finalizar no WhatsApp */}
            <button
              onClick={handleFinalizarWhatsApp}
              disabled={isPending}
              className="w-full flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 active:scale-95 disabled:opacity-70 text-white font-bold py-3.5 rounded-2xl transition-all duration-200 text-sm shadow-md hover:shadow-lg"
            >
              <MessageCircle className="w-5 h-5" />
              Finalizar no WhatsApp
            </button>

            {/* Link para limpar carrinho */}
            <button
              onClick={onLimparCarrinho}
              className="w-full text-xs text-gray-400 hover:text-red-500 transition-colors py-1"
            >
              Limpar carrinho
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
