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

import { useState } from "react";
import Image from "next/image";
import { Minus, Plus, ShoppingCart, Zap } from "lucide-react";
import type { ProdutoVenda, ItemCarrinho } from "@/types/vendas.types";
import { gerarLinkWhatsAppSingle } from "@/modules/vendas/lib/whatsapp";

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
  const [quantidade, setQuantidade] = useState(1);
  const [imagemInvalida, setImagemInvalida] = useState(false);
  const normalizarQuantidade = (valor: number) =>
    Math.min(MAX_QUANTIDADE, Math.max(1, Math.floor(valor || 1)));

  const precoAtivo = produto.preco_promocional ?? produto.preco;
  const temPromocao =
    produto.preco_promocional !== null &&
    produto.preco_promocional < produto.preco;

  const formatarPreco = (valor: number) =>
    valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const fotoUrl = !imagemInvalida ? resolveImageUrl(produto.foto_url) : null;

  const linkComprar = gerarLinkWhatsAppSingle(produto, whatsappNumber, quantidade);

  const handleAdicionarCarrinho = () => {
    onAdicionarCarrinho({
      produto_id: produto.id,
      nome: produto.nome,
      preco: precoAtivo,
      foto_url: produto.foto_url,
    }, quantidade);
  };

  return (
    <article className="group relative flex flex-col bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 w-56 flex-shrink-0">
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
      <div className="relative w-full h-48 bg-gray-50 overflow-hidden">
        {fotoUrl ? (
          <Image
            src={fotoUrl}
            alt={produto.nome}
            fill
            className="object-cover group-hover:scale-110 transition-transform duration-500"
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
        <h3 className="text-sm font-bold text-gray-900 line-clamp-2 leading-snug">
          {produto.nome}
        </h3>

        {produto.descricao && (
          <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed">
            {produto.descricao}
          </p>
        )}

        {/* Preços */}
        <div className="mt-auto pt-2">
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

        {/* Seletor de quantidade */}
        <div className="mt-3">
          <p className="text-[11px] uppercase tracking-wide text-gray-400 mb-1.5 font-semibold">
            Quantidade
          </p>
          <div className="inline-flex items-center rounded-xl border border-gray-200 overflow-hidden">
            <button
              type="button"
              onClick={() => setQuantidade((qtd) => normalizarQuantidade(qtd - 1))}
              disabled={quantidade <= 1}
              className="w-8 h-8 flex items-center justify-center text-gray-600 hover:bg-gray-100 disabled:hover:bg-transparent disabled:text-gray-300 disabled:cursor-not-allowed transition-colors"
              aria-label="Diminuir quantidade"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <input
              type="number"
              min={1}
              max={MAX_QUANTIDADE}
              value={quantidade}
              onChange={(e) =>
                setQuantidade(normalizarQuantidade(Number(e.target.value)))
              }
              className="w-12 h-8 text-center text-sm font-bold text-gray-900 outline-none [appearance:textfield]"
              aria-label="Quantidade do produto"
            />
            <button
              type="button"
              onClick={() => setQuantidade((qtd) => normalizarQuantidade(qtd + 1))}
              disabled={quantidade >= MAX_QUANTIDADE}
              className="w-8 h-8 flex items-center justify-center text-gray-600 hover:bg-gray-100 disabled:hover:bg-transparent disabled:text-gray-300 disabled:cursor-not-allowed transition-colors"
              aria-label="Aumentar quantidade"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Botões */}
        <div className="flex flex-col gap-2 mt-3">
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
