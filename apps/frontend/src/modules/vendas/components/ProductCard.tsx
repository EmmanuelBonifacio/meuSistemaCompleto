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

import Image from "next/image";
import { ShoppingCart, Zap } from "lucide-react";
import type { ProdutoVenda, ItemCarrinho } from "@/types/vendas.types";
import { gerarLinkWhatsAppSingle } from "@/modules/vendas/lib/whatsapp";

// =============================================================================
// PROPS
// =============================================================================
interface ProductCardProps {
  produto: ProdutoVenda;
  whatsappNumber: string;
  onAdicionarCarrinho: (item: Omit<ItemCarrinho, "quantidade">) => void;
  corPrimaria?: string;
}

// =============================================================================
// COMPONENTE: ProductCard
// =============================================================================
// Raiz do backend — imagens são servidas por ele, não pelo frontend
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

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
  const precoAtivo = produto.preco_promocional ?? produto.preco;
  const temPromocao =
    produto.preco_promocional !== null &&
    produto.preco_promocional < produto.preco;

  const formatarPreco = (valor: number) =>
    valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const linkComprar = gerarLinkWhatsAppSingle(produto, whatsappNumber);

  const handleAdicionarCarrinho = () => {
    onAdicionarCarrinho({
      produto_id: produto.id,
      nome: produto.nome,
      preco: precoAtivo,
      foto_url: produto.foto_url,
    });
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
        {produto.foto_url ? (
          <Image
            src={resolveImageUrl(produto.foto_url)!}
            alt={produto.nome}
            fill
            className="object-cover group-hover:scale-110 transition-transform duration-500"
            sizes="224px"
            unoptimized
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-gray-50">
            <ShoppingCart className="w-10 h-10 text-gray-200" />
            <span className="text-xs text-gray-300">Sem foto</span>
          </div>
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
