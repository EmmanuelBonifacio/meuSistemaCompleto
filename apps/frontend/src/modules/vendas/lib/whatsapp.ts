// =============================================================================
// src/modules/vendas/lib/whatsapp.ts
// =============================================================================
// O QUE FAZ:
//   Funções utilitárias para gerar links wa.me com texto pré-formatado.
//   Centralizado aqui para que ProductCard e CartDrawer usem a mesma lógica.
// =============================================================================

import type { ProdutoVenda, ItemCarrinho } from "@/types/vendas.types";
import { formatBrl, formatQuantidadeKg } from "@/lib/format-ptbr";

export function gerarLinkWhatsAppSingle(
  produto: ProdutoVenda,
  whatsappNumber: string,
  quantidade = 1,
): string {
  const porPeso = produto.vendido_por_peso ?? false;
  const preco = produto.preco_promocional ?? produto.preco;
  const quantidadeValida = porPeso
    ? Math.round(Math.min(99, Math.max(0.05, quantidade)) * 100) / 100
    : Math.min(99, Math.max(1, Math.floor(quantidade)));
  const total = preco * quantidadeValida;
  const linhaProduto = porPeso
    ? `- ${formatQuantidadeKg(quantidadeValida)} kg × ${produto.nome} — ${formatBrl(preco)}/kg`
    : `- ${quantidadeValida}x ${produto.nome} — ${formatBrl(preco)} c/u`;
  const texto = [
    "Olá! Quero comprar:",
    "",
    linhaProduto,
    "",
    `*Total: ${formatBrl(total)}*`,
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
  const linhas = itens.map((item) => {
    const porPeso = item.vendido_por_peso ?? false;
    if (porPeso) {
      const kg = item.quantidade;
      return `- ${formatQuantidadeKg(kg)} kg × ${item.nome} — ${formatBrl(item.preco)}/kg`;
    }
    return `- ${item.quantidade}x ${item.nome} — ${formatBrl(item.preco)} c/u`;
  });

  const total = itens.reduce((soma, i) => soma + i.preco * i.quantidade, 0);

  const texto = [
    "Olá! Quero fazer um pedido:",
    "",
    ...linhas,
    "",
    `*Total: ${formatBrl(total)}*`,
  ].join("\n");

  return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(texto)}`;
}
