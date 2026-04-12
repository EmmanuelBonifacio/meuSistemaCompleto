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
}: ProductCardProps) {
  // Preço que será exibido em destaque (promocional tem prioridade)
  const precoAtivo = produto.preco_promocional ?? produto.preco;
  const temPromocao =
    produto.preco_promocional !== null &&
    produto.preco_promocional < produto.preco;

  // Formata o preço no padrão brasileiro: R$ 1.299,90
  const formatarPreco = (valor: number) =>
    valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  // Gera o link wa.me para compra direta (1 unidade deste produto)
  const linkComprar = gerarLinkWhatsAppSingle(produto, whatsappNumber);

  // Handler do botão "Adicionar ao Carrinho"
  const handleAdicionarCarrinho = () => {
    onAdicionarCarrinho({
      produto_id: produto.id,
      nome: produto.nome,
      preco: precoAtivo,
      foto_url: produto.foto_url,
    });
  };

  return (
    <article className="group relative flex flex-col bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all duration-300 w-56 flex-shrink-0">
      {/* Badge de Promoção */}
      {temPromocao && (
        <span className="absolute top-2 left-2 z-10 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
          PROMO
        </span>
      )}

      {/* Badge de Destaque / Lançamento */}
      {produto.destaque && !temPromocao && (
        <span className="absolute top-2 left-2 z-10 bg-indigo-600 text-white text-xs font-bold px-2 py-1 rounded-full">
          NOVO
        </span>
      )}

      {/* Foto do Produto */}
      <div className="relative w-full h-44 bg-gray-50 overflow-hidden">
        {produto.foto_url ? (
          <Image
            src={resolveImageUrl(produto.foto_url)!}
            alt={produto.nome}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
            sizes="224px"
            unoptimized
          />
        ) : (
          // Placeholder quando não há foto
          <div className="w-full h-full flex items-center justify-center">
            <ShoppingCart className="w-12 h-12 text-gray-300" />
          </div>
        )}
      </div>

      {/* Informações do Produto */}
      <div className="flex flex-col gap-2 p-4 flex-1">
        {/* Nome */}
        <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 leading-snug">
          {produto.nome}
        </h3>

        {/* Descrição (opcional) */}
        {produto.descricao && (
          <p className="text-xs text-gray-500 line-clamp-2">
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
            className={`text-lg font-bold ${temPromocao ? "text-red-600" : "text-gray-900"}`}
          >
            {formatarPreco(precoAtivo)}
          </span>
        </div>

        {/* Botões de Ação */}
        <div className="flex flex-col gap-2 mt-2">
          {/* Botão Comprar — abre WhatsApp com 1 unidade diretamente */}
          <a
            href={linkComprar}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-semibold py-2 rounded-xl transition-colors duration-200"
          >
            <Zap className="w-3.5 h-3.5" />
            Comprar
          </a>

          {/* Botão Adicionar ao Carrinho */}
          <button
            onClick={handleAdicionarCarrinho}
            className="flex items-center justify-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-semibold py-2 rounded-xl transition-colors duration-200"
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            Adicionar ao carrinho
          </button>
        </div>
      </div>
    </article>
  );
}
