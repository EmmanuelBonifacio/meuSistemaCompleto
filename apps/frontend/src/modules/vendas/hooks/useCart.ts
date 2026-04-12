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

// =============================================================================
// INTERFACE: Estado e ações exportadas pelo hook
// =============================================================================
export interface UseCartReturn {
  itens: ItemCarrinho[];
  totalItens: number;
  totalValor: number;
  adicionarItem: (item: Omit<ItemCarrinho, "quantidade">) => void;
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
        setItens(JSON.parse(salvo));
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
    (novoItem: Omit<ItemCarrinho, "quantidade">) => {
      setItens((prev) => {
        const existente = prev.find(
          (i) => i.produto_id === novoItem.produto_id,
        );
        if (existente) {
          // Produto já no carrinho — só incrementa
          return prev.map((i) =>
            i.produto_id === novoItem.produto_id
              ? { ...i, quantidade: i.quantidade + 1 }
              : i,
          );
        }
        // Produto novo — adiciona com quantidade 1
        return [...prev, { ...novoItem, quantidade: 1 }];
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
      if (quantidade <= 0) {
        setItens((prev) => prev.filter((i) => i.produto_id !== produtoId));
        return;
      }
      setItens((prev) =>
        prev.map((i) =>
          i.produto_id === produtoId ? { ...i, quantidade } : i,
        ),
      );
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
