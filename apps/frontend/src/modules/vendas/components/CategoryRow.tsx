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
  onAdicionarCarrinho: (item: Omit<ItemCarrinho, "quantidade">) => void;
}

// =============================================================================
// COMPONENTE: CategoryRow
// =============================================================================
export function CategoryRow({
  categoria,
  produtos,
  whatsappNumber,
  onAdicionarCarrinho,
}: CategoryRowProps) {
  // Ref para o container scrollável — usado pelos botões de seta
  const scrollRef = useRef<HTMLDivElement>(null);

  // Avança ou recua o scroll ao clicar nas setas
  const scrollBy = (direcao: "esquerda" | "direita") => {
    if (!scrollRef.current) return;
    const largura = scrollRef.current.clientWidth * 0.75; // 75% da largura visível
    scrollRef.current.scrollBy({
      left: direcao === "direita" ? largura : -largura,
      behavior: "smooth",
    });
  };

  // Nome amigável da categoria (ex: "lancamentos" → "Lançamentos")
  const nomeCategoria = CATEGORIAS_LABEL[categoria] ?? categoria;

  // A categoria "lancamentos" tem visual especial
  const isLancamentos = categoria === "lancamentos";

  if (produtos.length === 0) return null;

  return (
    <section
      className={`py-8 ${isLancamentos ? "bg-gradient-to-r from-indigo-50 to-purple-50" : ""}`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Cabeçalho da Fileira */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {/* Indicador visual especial para Lançamentos */}
            {isLancamentos && (
              <span className="inline-block w-2 h-6 bg-indigo-600 rounded-full" />
            )}
            <h2
              className={`text-xl font-bold ${isLancamentos ? "text-indigo-900" : "text-gray-900"}`}
            >
              {nomeCategoria}
            </h2>
            {isLancamentos && (
              <span className="text-xs bg-indigo-600 text-white px-2 py-0.5 rounded-full font-medium">
                {produtos.length} produtos
              </span>
            )}
          </div>

          {/* Botões de navegação — aparecem ao hover no container */}
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

        {/* Container com scroll horizontal e snap */}
        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto pb-4 scroll-smooth snap-x snap-mandatory scrollbar-hide"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {produtos.map((produto) => (
            <div key={produto.id} className="snap-start">
              <ProductCard
                produto={produto}
                whatsappNumber={whatsappNumber}
                onAdicionarCarrinho={onAdicionarCarrinho}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
