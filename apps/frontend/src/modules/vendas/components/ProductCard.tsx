// =============================================================================
// src/modules/vendas/components/ProductCard.tsx
// =============================================================================
// O QUE FAZ:
//   Card de produto exibido no catálogo de vendas.
//   Mostra foto, nome, preço, badge de promoção e dois botões:
//     - "Comprar" → abre WhatsApp direto com 1 produto
//     - "Adicionar ao Carrinho" → adiciona ao carrinho lateral
//
// DESIGN: Inspirado em Apple/Shopify — minimalista, limpo, com hover elegante.
// =============================================================================

"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Minus, Plus, ShoppingCart, Zap } from "lucide-react";
import type { ProdutoVenda, ItemCarrinho } from "@/types/vendas.types";
import { gerarLinkWhatsAppSingle } from "@/modules/vendas/lib/whatsapp";
import { formatBrl } from "@/lib/format-ptbr";

// =============================================================================
// PROPS
// =============================================================================
interface ProductCardProps {
  produto: ProdutoVenda;
  whatsappNumber: string;
  onAdicionarCarrinho: (
    item: Omit<ItemCarrinho, "quantidade">,
    quantidade?: number,
  ) => void;
  corPrimaria?: string;
}

// =============================================================================
// COMPONENTE: ProductCard
// =============================================================================
// Raiz do backend — imagens são servidas por ele, não pelo frontend
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";
const MAX_QUANTIDADE = 99;
const MAX_KG = 99;
const MIN_KG = 0.05;
const STEP_KG = 0.05;

function arredondarKg(n: number): number {
  return Math.round(n * 100) / 100;
}

// Constrói a URL completa para imagens armazenadas como caminhos relativos
// ex: "/uploads/vendas/xxx.jpg" → "http://localhost:3000/uploads/vendas/xxx.jpg"
function resolveImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${API_BASE}${url}`;
}

export function ProductCard({
  produto,
  whatsappNumber,
  onAdicionarCarrinho,
  corPrimaria = "#4f46e5",
}: ProductCardProps) {
  const porPeso = produto.vendido_por_peso ?? false;
  const [quantidade, setQuantidade] = useState(1);
  const [imagemInvalida, setImagemInvalida] = useState(false);

  useEffect(() => {
    setQuantidade(1);
  }, [produto.id, porPeso]);

  const normalizarUnidade = (valor: number) =>
    Math.min(MAX_QUANTIDADE, Math.max(1, Math.floor(valor || 1)));
  const normalizarPeso = (valor: number) =>
    arredondarKg(Math.min(MAX_KG, Math.max(MIN_KG, valor || MIN_KG)));

  const precoAtivo = produto.preco_promocional ?? produto.preco;
  const temPromocao =
    produto.preco_promocional !== null &&
    produto.preco_promocional < produto.preco;

  const formatarPreco = (valor: number) => formatBrl(valor);
  const fotoUrl = !imagemInvalida ? resolveImageUrl(produto.foto_url) : null;

  const linkComprar = gerarLinkWhatsAppSingle(
    produto,
    whatsappNumber,
    quantidade,
  );

  const handleAdicionarCarrinho = () => {
    onAdicionarCarrinho(
      {
        produto_id: produto.id,
        nome: produto.nome,
        preco: precoAtivo,
        foto_url: produto.foto_url,
        vendido_por_peso: porPeso,
      },
      porPeso ? normalizarPeso(quantidade) : normalizarUnidade(quantidade),
    );
  };

  return (
    <article className="group relative flex h-[min(560px,85dvh)] sm:h-[560px] w-[min(100%,14rem)] max-w-[14rem] flex-col bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-lg transition-all duration-300 flex-shrink-0 touch-manipulation">
      {/* Badge Promoção */}
      {temPromocao && (
        <span className="absolute top-2.5 left-2.5 z-10 bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-md">
          🔥 PROMO
        </span>
      )}

      {/* Badge Lançamento / Destaque */}
      {produto.destaque && !temPromocao && (
        <span
          className="absolute top-2.5 left-2.5 z-10 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-md"
          style={{ backgroundColor: corPrimaria }}
        >
          ✨ NOVO
        </span>
      )}

      {/* Foto do Produto */}
      <div className="relative w-full h-44 bg-gray-50 overflow-hidden">
        {fotoUrl ? (
          <Image
            src={fotoUrl}
            alt={produto.nome}
            fill
            className="object-cover"
            sizes="224px"
            unoptimized
            onError={() => setImagemInvalida(true)}
          />
        ) : (
          <Image
            src="/images/sem-foto-produto.svg"
            alt="Produto sem foto"
            fill
            className="object-cover"
            sizes="224px"
            unoptimized
          />
        )}
        {/* Overlay gradiente sutil */}
        <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/10 to-transparent" />
      </div>

      {/* Informações */}
      <div className="flex flex-col gap-2 p-4 flex-1">
        <h3 className="min-h-[42px] text-sm font-bold text-gray-900 line-clamp-2 leading-snug">
          {produto.nome}
        </h3>

        {produto.descricao && (
          <p className="min-h-[36px] text-xs text-gray-500 line-clamp-2 leading-relaxed">
            {produto.descricao}
          </p>
        )}

        {/* Preços */}
        <div className="min-h-[52px] pt-1">
          {porPeso && (
            <span className="text-[10px] font-bold uppercase text-gray-500 block mb-0.5">
              Preço por kg
            </span>
          )}
          {temPromocao && (
            <span className="text-xs text-gray-400 line-through block">
              {formatarPreco(produto.preco)}
            </span>
          )}
          <span
            className={`text-xl font-extrabold ${temPromocao ? "text-red-600" : "text-gray-900"}`}
          >
            {formatarPreco(precoAtivo)}
          </span>
          {temPromocao && (
            <span className="ml-2 text-xs text-green-600 font-semibold">
              {Math.round(((produto.preco - precoAtivo) / produto.preco) * 100)}
              % off
            </span>
          )}
        </div>

        {/* Seletor: unidades ou peso (kg) */}
        <div className="mt-2">
          <p className="text-[11px] uppercase tracking-wide text-gray-400 mb-1.5 font-semibold">
            {porPeso ? "Peso (kg)" : "Quantidade"}
          </p>
          <div className="inline-flex max-w-full items-center rounded-xl border border-gray-200 overflow-hidden">
            <button
              type="button"
              onClick={() =>
                setQuantidade((qtd) =>
                  porPeso
                    ? normalizarPeso(qtd - STEP_KG)
                    : normalizarUnidade(qtd - 1),
                )
              }
              disabled={porPeso ? quantidade <= MIN_KG : quantidade <= 1}
              className="min-h-11 min-w-11 sm:min-h-0 sm:min-w-0 sm:w-8 sm:h-8 flex items-center justify-center text-gray-600 hover:bg-gray-100 active:bg-gray-200 disabled:hover:bg-transparent disabled:text-gray-300 disabled:cursor-not-allowed transition-colors"
              aria-label={porPeso ? "Diminuir peso" : "Diminuir quantidade"}
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <input
              type="number"
              min={porPeso ? MIN_KG : 1}
              max={porPeso ? MAX_KG : MAX_QUANTIDADE}
              step={porPeso ? STEP_KG : 1}
              value={quantidade}
              onChange={(e) => {
                const n = Number(e.target.value);
                setQuantidade(
                  porPeso ? normalizarPeso(n) : normalizarUnidade(n),
                );
              }}
              inputMode={porPeso ? "decimal" : "numeric"}
              className={`${porPeso ? "w-16" : "w-14"} min-h-11 sm:min-h-8 text-center text-base sm:text-sm font-bold text-gray-900 outline-none [appearance:textfield]`}
              aria-label={porPeso ? "Peso em kg" : "Quantidade do produto"}
            />
            <button
              type="button"
              onClick={() =>
                setQuantidade((qtd) =>
                  porPeso
                    ? normalizarPeso(qtd + STEP_KG)
                    : normalizarUnidade(qtd + 1),
                )
              }
              disabled={porPeso ? quantidade >= MAX_KG : quantidade >= MAX_QUANTIDADE}
              className="min-h-11 min-w-11 sm:min-h-0 sm:min-w-0 sm:w-8 sm:h-8 flex items-center justify-center text-gray-600 hover:bg-gray-100 active:bg-gray-200 disabled:hover:bg-transparent disabled:text-gray-300 disabled:cursor-not-allowed transition-colors"
              aria-label={porPeso ? "Aumentar peso" : "Aumentar quantidade"}
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Botões */}
        <div className="flex flex-col gap-2 mt-auto pt-2">
          <a
            href={linkComprar}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 bg-green-500 hover:bg-green-600 active:scale-95 text-white text-xs font-bold py-2.5 rounded-xl transition-all duration-200 shadow-sm hover:shadow-md"
          >
            <Zap className="w-3.5 h-3.5" />
            Comprar agora
          </a>

          <button
            onClick={handleAdicionarCarrinho}
            className="flex items-center justify-center gap-1.5 border-2 text-xs font-bold py-2 rounded-xl transition-all duration-200 active:scale-95 hover:text-white"
            style={
              {
                "--border-col": corPrimaria,
                "--text-col": corPrimaria,
                borderColor: corPrimaria,
                color: corPrimaria,
              } as React.CSSProperties
            }
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                corPrimaria;
              (e.currentTarget as HTMLButtonElement).style.color = "white";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                "transparent";
              (e.currentTarget as HTMLButtonElement).style.color = corPrimaria;
            }}
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            Adicionar ao carrinho
          </button>
        </div>
      </div>
    </article>
  );
}
