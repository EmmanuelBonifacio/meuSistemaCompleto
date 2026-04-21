// =============================================================================
// src/modules/vendas/components/CategoryRow.tsx
// =============================================================================
// O QUE FAZ:
//   Fileira horizontal de produtos de uma categoria com scroll lateral.
//   Seguindo o padrão Netflix/Amazon — cada categoria é uma "prateleira".
//   A categoria "lancamentos" tem destaque visual especial (fundo gradiente).
// =============================================================================

"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ProductCard } from "./ProductCard";
import type { ProdutoVenda, ItemCarrinho } from "@/types/vendas.types";
import { CATEGORIAS_LABEL } from "@/types/vendas.types";

// =============================================================================
// PROPS
// =============================================================================
interface CategoryRowProps {
  categoria: string;
  produtos: ProdutoVenda[];
  whatsappNumber: string;
  onAdicionarCarrinho: (
    item: Omit<ItemCarrinho, "quantidade">,
    quantidade?: number,
  ) => void;
  corPrimaria?: string;
  corClara?: string;
}

// =============================================================================
// COMPONENTE: CategoryRow
// =============================================================================
export function CategoryRow({
  categoria,
  produtos,
  whatsappNumber,
  onAdicionarCarrinho,
  corPrimaria = "#4f46e5",
  corClara = "#eef2ff",
}: CategoryRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollBy = (direcao: "esquerda" | "direita") => {
    if (!scrollRef.current) return;
    const largura = scrollRef.current.clientWidth * 0.75;
    scrollRef.current.scrollBy({
      left: direcao === "direita" ? largura : -largura,
      behavior: "smooth",
    });
  };

  const nomeCategoria = CATEGORIAS_LABEL[categoria] ?? categoria;
  const isLancamentos = categoria === "lancamentos";
  const isPromocoes = categoria === "promocoes";

  if (produtos.length === 0) return null;

  return (
    <section
      className="py-7"
      style={
        isLancamentos || isPromocoes
          ? {
              background: `linear-gradient(180deg, ${corClara} 0%, white 100%)`,
            }
          : {}
      }
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Cabeçalho da fileira */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            {/* Barra colorida lateral — usa a cor da marca */}
            <span
              className="inline-block w-1.5 h-7 rounded-full"
              style={{ backgroundColor: corPrimaria }}
            />
            <h2 className="text-xl font-bold text-gray-900">{nomeCategoria}</h2>
            {isLancamentos && (
              <span
                className="text-xs text-white px-2.5 py-0.5 rounded-full font-semibold"
                style={{ backgroundColor: corPrimaria }}
              >
                {produtos.length} produtos
              </span>
            )}
            {isPromocoes && (
              <span className="text-xs bg-red-500 text-white px-2.5 py-0.5 rounded-full font-semibold">
                Oferta
              </span>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => scrollBy("esquerda")}
              aria-label="Ver produtos anteriores"
              className="flex items-center justify-center w-8 h-8 rounded-full bg-white shadow-sm border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            </button>
            <button
              onClick={() => scrollBy("direita")}
              aria-label="Ver mais produtos"
              className="flex items-center justify-center w-8 h-8 rounded-full bg-white shadow-sm border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              <ChevronRight className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Container scrollável */}
        <div
          ref={scrollRef}
          className="flex items-stretch gap-4 overflow-x-auto pb-4 scroll-smooth snap-x snap-mandatory"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {produtos.map((produto) => (
            <div key={produto.id} className="snap-start">
              <ProductCard
                produto={produto}
                whatsappNumber={whatsappNumber}
                onAdicionarCarrinho={onAdicionarCarrinho}
                corPrimaria={corPrimaria}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
