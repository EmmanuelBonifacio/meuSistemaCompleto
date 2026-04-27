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

import { useState, useTransition } from "react";
import { X, Trash2, ShoppingBag, MessageCircle } from "lucide-react";
import Image from "next/image";
import type { ItemCarrinho } from "@/types/vendas.types";
import { gerarLinkWhatsAppCarrinho } from "@/modules/vendas/lib/whatsapp";
import { createPedido } from "@/services/vendas.service";
import { formatBrl, formatQuantidadeKg } from "@/lib/format-ptbr";
import { resolveApiAssetUrl } from "@/lib/resolve-api-asset-url";

const STEP_KG = 0.05;

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
  const [imagensInvalidas, setImagensInvalidas] = useState<
    Record<string, boolean>
  >({});

  const formatarMoeda = (valor: number) => formatBrl(valor);
  const formatarPeso = (kg: number) => formatQuantidadeKg(kg);

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
        className={`fixed right-0 top-0 z-50 h-[100dvh] max-h-[100dvh] w-full max-w-md bg-white shadow-2xl flex flex-col touch-manipulation transition-transform duration-300 ${
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
            itens.map((item) => {
              const porPeso = item.vendido_por_peso ?? false;
              const fotoUrl = imagensInvalidas[item.produto_id]
                ? null
                : resolveApiAssetUrl(item.foto_url);

              return (
                <div
                  key={item.produto_id}
                  className="flex flex-col gap-3 p-3 bg-gray-50 rounded-xl sm:flex-row sm:items-center"
                >
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl bg-gray-100">
                      {fotoUrl ? (
                        <Image
                          src={fotoUrl}
                          alt={item.nome}
                          fill
                          className="object-cover"
                          sizes="64px"
                          unoptimized
                          onError={() =>
                            setImagensInvalidas((prev) => ({
                              ...prev,
                              [item.produto_id]: true,
                            }))
                          }
                        />
                      ) : (
                        <Image
                          src="/images/sem-foto-produto.svg"
                          alt="Produto sem foto"
                          fill
                          className="object-cover"
                          sizes="64px"
                          unoptimized
                        />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-gray-900">
                        {item.nome}
                      </p>
                      <p className="text-xs text-gray-500">
                        {porPeso
                          ? `${formatarMoeda(item.preco)}/kg`
                          : `${formatarMoeda(item.preco)} / un.`}
                      </p>
                      <p
                        className="text-sm font-bold"
                        style={{ color: corPrimaria }}
                      >
                        {formatarMoeda(item.preco * item.quantidade)}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-shrink-0 items-center justify-end gap-2 sm:ml-0">
                    <button
                      type="button"
                      onClick={() =>
                        onAtualizarQuantidade(
                          item.produto_id,
                          porPeso
                            ? Math.round((item.quantidade - STEP_KG) * 100) / 100
                            : item.quantidade - 1,
                        )
                      }
                      className="flex h-10 min-w-10 items-center justify-center rounded-full bg-gray-200 text-base font-bold text-gray-700 transition-colors hover:bg-gray-300 active:bg-gray-400 sm:h-7 sm:min-w-7 sm:text-sm"
                      aria-label={porPeso ? "Diminuir peso" : "Diminuir quantidade"}
                    >
                      −
                    </button>
                    <span
                      className={`min-w-[2.75rem] text-center text-sm font-semibold text-gray-900 sm:min-w-[1.5rem] ${porPeso ? "px-0.5" : ""}`}
                    >
                      {porPeso ? formatarPeso(item.quantidade) : item.quantidade}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        onAtualizarQuantidade(
                          item.produto_id,
                          porPeso
                            ? Math.round((item.quantidade + STEP_KG) * 100) / 100
                            : item.quantidade + 1,
                        )
                      }
                      className="flex h-10 min-w-10 items-center justify-center rounded-full bg-gray-200 text-base font-bold text-gray-700 transition-colors hover:bg-gray-300 active:bg-gray-400 sm:h-7 sm:min-w-7 sm:text-sm"
                      aria-label={porPeso ? "Aumentar peso" : "Aumentar quantidade"}
                    >
                      +
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemoverItem(item.produto_id)}
                      className="ml-0.5 flex h-10 w-10 items-center justify-center text-gray-400 transition-colors hover:text-red-500 sm:h-8 sm:w-8"
                      aria-label="Remover item"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer com Total e Botão de Checkout */}
        {itens.length > 0 && (
          <div className="border-t border-gray-100 p-4 space-y-3 pb-[max(1rem,env(safe-area-inset-bottom,0px))]">
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
