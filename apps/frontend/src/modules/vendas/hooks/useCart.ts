// =============================================================================
// src/modules/vendas/hooks/useCart.ts
// =============================================================================
// O QUE FAZ:
//   Hook customizado que gerencia o estado do carrinho de compras.
//   Persiste o carrinho no localStorage para sobreviver a refreshes de página.
//   Expõe funções para adicionar, remover, alterar quantidade e limpar o carrinho.
// =============================================================================

"use client";

import { useState, useEffect, useCallback } from "react";
import type { ItemCarrinho } from "@/types/vendas.types";

// Chave usada no localStorage — prefixo evita colisão com outras libs
const CART_STORAGE_KEY = "@saas/carrinho-vendas";
const MAX_QUANTIDADE_POR_ITEM = 99;
const MAX_KG_POR_ITEM = 99;
const MIN_KG = 0.05;
const STEP_KG = 0.05;

function arredondarKg(valor: number): number {
  return Math.round(valor * 100) / 100;
}

// =============================================================================
// INTERFACE: Estado e ações exportadas pelo hook
// =============================================================================
export interface UseCartReturn {
  itens: ItemCarrinho[];
  totalItens: number;
  totalValor: number;
  adicionarItem: (
    item: Omit<ItemCarrinho, "quantidade">,
    quantidade?: number,
  ) => void;
  removerItem: (produtoId: string) => void;
  atualizarQuantidade: (produtoId: string, quantidade: number) => void;
  limparCarrinho: () => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

// =============================================================================
// HOOK: useCart
// =============================================================================
export function useCart(): UseCartReturn {
  // Estado do carrinho — inicializado com [] até o useEffect carregar do localStorage
  const [itens, setItens] = useState<ItemCarrinho[]>([]);
  // Controla se o drawer do carrinho está aberto
  const [isOpen, setIsOpen] = useState(false);
  // Flag para evitar salvar no localStorage antes de carregar
  const [carregado, setCarregado] = useState(false);

  // -------------------------------------------------------------------------
  // EFEITO: Carrega o carrinho do localStorage ao montar o componente
  // -------------------------------------------------------------------------
  // Por que em useEffect e não no useState inicial?
  //   localStorage só existe no browser (não no SSR do Next.js).
  //   Inicializar no useState causaria erro durante o Server-Side Rendering.
  useEffect(() => {
    try {
      const salvo = localStorage.getItem(CART_STORAGE_KEY);
      if (salvo) {
        const bruto = JSON.parse(salvo) as ItemCarrinho[];
        setItens(
          bruto.map((i) => ({
            ...i,
            vendido_por_peso: i.vendido_por_peso ?? false,
          })),
        );
      }
    } catch {
      // Carrinho corrompido — começa vazio
      localStorage.removeItem(CART_STORAGE_KEY);
    } finally {
      setCarregado(true);
    }
  }, []);

  // -------------------------------------------------------------------------
  // EFEITO: Persiste o carrinho no localStorage a cada mudança
  // -------------------------------------------------------------------------
  useEffect(() => {
    // Só salva depois do primeiro carregamento (evita sobrescrever com [])
    if (!carregado) return;
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(itens));
  }, [itens, carregado]);

  // -------------------------------------------------------------------------
  // AÇÃO: Adicionar item ao carrinho
  // -------------------------------------------------------------------------
  // Se o produto já existir, incrementa a quantidade.
  // Se for novo, adiciona com quantidade 1.
  const adicionarItem = useCallback(
    (novoItem: Omit<ItemCarrinho, "quantidade">, quantidade = 1) => {
      const porPeso = !!novoItem.vendido_por_peso;
      const quantidadeValida = porPeso
        ? arredondarKg(
            Math.min(
              MAX_KG_POR_ITEM,
              Math.max(MIN_KG, quantidade),
            ),
          )
        : Math.min(
            MAX_QUANTIDADE_POR_ITEM,
            Math.max(1, Math.floor(quantidade)),
          );
      setItens((prev) => {
        const existente = prev.find(
          (i) =>
            i.produto_id === novoItem.produto_id &&
            !!i.vendido_por_peso === porPeso,
        );
        if (existente) {
          if (porPeso) {
            return prev.map((i) =>
              i.produto_id === novoItem.produto_id && !!i.vendido_por_peso
                ? {
                    ...i,
                    quantidade: arredondarKg(
                      Math.min(
                        MAX_KG_POR_ITEM,
                        i.quantidade + quantidadeValida,
                      ),
                    ),
                  }
                : i,
            );
          }
          return prev.map((i) =>
            i.produto_id === novoItem.produto_id && !i.vendido_por_peso
              ? {
                  ...i,
                  quantidade: Math.min(
                    MAX_QUANTIDADE_POR_ITEM,
                    i.quantidade + quantidadeValida,
                  ),
                }
              : i,
          );
        }
        return [...prev, { ...novoItem, quantidade: quantidadeValida }];
      });
      // Abre o drawer automaticamente ao adicionar
      setIsOpen(true);
    },
    [],
  );

  // -------------------------------------------------------------------------
  // AÇÃO: Remover item do carrinho
  // -------------------------------------------------------------------------
  const removerItem = useCallback((produtoId: string) => {
    setItens((prev) => prev.filter((i) => i.produto_id !== produtoId));
  }, []);

  // -------------------------------------------------------------------------
  // AÇÃO: Alterar quantidade de um item
  // -------------------------------------------------------------------------
  // Se quantidade <= 0, remove o item do carrinho.
  const atualizarQuantidade = useCallback(
    (produtoId: string, quantidade: number) => {
      setItens((prev) => {
        const alvo = prev.find((i) => i.produto_id === produtoId);
        if (!alvo) return prev;

        if (alvo.vendido_por_peso) {
          if (quantidade < MIN_KG) {
            return prev.filter((i) => i.produto_id !== produtoId);
          }
          const q = arredondarKg(
            Math.min(MAX_KG_POR_ITEM, Math.max(MIN_KG, quantidade)),
          );
          return prev.map((i) =>
            i.produto_id === produtoId ? { ...i, quantidade: q } : i,
          );
        }

        if (quantidade <= 0) {
          return prev.filter((i) => i.produto_id !== produtoId);
        }
        const quantidadeValida = Math.min(
          MAX_QUANTIDADE_POR_ITEM,
          Math.max(1, Math.floor(quantidade)),
        );
        return prev.map((i) =>
          i.produto_id === produtoId ? { ...i, quantidade: quantidadeValida } : i,
        );
      });
    },
    [],
  );

  // -------------------------------------------------------------------------
  // AÇÃO: Limpar carrinho completamente
  // -------------------------------------------------------------------------
  const limparCarrinho = useCallback(() => {
    setItens([]);
  }, []);

  // -------------------------------------------------------------------------
  // COMPUTADOS: Total de itens e valor total
  // -------------------------------------------------------------------------
  const totalItens = itens.reduce((soma, item) => soma + item.quantidade, 0);
  const totalValor = itens.reduce(
    (soma, item) => soma + item.preco * item.quantidade,
    0,
  );

  return {
    itens,
    totalItens,
    totalValor,
    adicionarItem,
    removerItem,
    atualizarQuantidade,
    limparCarrinho,
    isOpen,
    setIsOpen,
  };
}
