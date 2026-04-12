// =============================================================================
// src/modules/vendas/lib/whatsapp.ts
// =============================================================================
// O QUE FAZ:
//   Funções utilitárias para gerar links wa.me com texto pré-formatado.
//   Centralizado aqui para que ProductCard e CartDrawer usem a mesma lógica.
// =============================================================================

import type { ProdutoVenda, ItemCarrinho } from "@/types/vendas.types";

/**
 * Formata um valor numérico como moeda brasileira.
 * Ex: 1299.9 → "R$ 1.299,90"
 */
function formatarMoeda(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * Gera o link wa.me para compra de UM produto diretamente (botão "Comprar" do card).
 *
 * @param produto        - Produto a ser comprado
 * @param whatsappNumber - Número com DDI. Ex: "5511999999999"
 * @returns URL completa do link wa.me
 */
export function gerarLinkWhatsAppSingle(
  produto: ProdutoVenda,
  whatsappNumber: string,
): string {
  const preco = produto.preco_promocional ?? produto.preco;
  const texto = [
    "Olá! Quero comprar:",
    "",
    `▶ 1x ${produto.nome} — ${formatarMoeda(preco)}`,
    "",
    `*Total: ${formatarMoeda(preco)}*`,
  ].join("\n");

  return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(texto)}`;
}

/**
 * Gera o link wa.me para o carrinho completo (botão "Finalizar no WhatsApp").
 *
 * @param itens          - Itens do carrinho
 * @param whatsappNumber - Número com DDI. Ex: "5511999999999"
 * @returns URL completa do link wa.me
 */
export function gerarLinkWhatsAppCarrinho(
  itens: ItemCarrinho[],
  whatsappNumber: string,
): string {
  const linhas = itens.map(
    (item) =>
      `▶ ${item.quantidade}x ${item.nome} — ${formatarMoeda(item.preco)} cada`,
  );

  const total = itens.reduce((soma, i) => soma + i.preco * i.quantidade, 0);

  const texto = [
    "Olá! Quero fazer um pedido:",
    "",
    ...linhas,
    "",
    `*Total: ${formatarMoeda(total)}*`,
  ].join("\n");

  return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(texto)}`;
}
