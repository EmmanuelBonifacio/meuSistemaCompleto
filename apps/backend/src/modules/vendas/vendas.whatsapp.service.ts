// =============================================================================
// src/modules/vendas/vendas.whatsapp.service.ts
// =============================================================================
// O QUE FAZ:
//   Serviço de integração com WhatsApp.
//   Responsabilidades:
//     1. Gerar o link wa.me com o texto do pedido formatado
//     2. Receber e processar mensagens do webhook da Evolution API
//
// COMO PLUGAR A EVOLUTION API:
//   1. Configure EVOLUTION_API_URL e EVOLUTION_API_KEY no arquivo .env
//   2. Substitua os TODO abaixo pela integração real
//   3. Documentação: https://doc.evolution-api.com
// =============================================================================

import type { ItemPedido } from "./vendas.schema";

// =============================================================================
// FUNÇÃO: gerarLinkWhatsApp
// =============================================================================
// Gera o link wa.me que abre o WhatsApp com o texto do pedido pré-preenchido.
//
// Formato do link:
//   https://wa.me/5511999999999?text=Olá, quero comprar:%0A1x Produto A R$100%0ATotal: R$100
//
// %0A = quebra de linha URL-encoded
// %20 = espaço URL-encoded (gerado automaticamente por encodeURIComponent)
//
// @param itens       - Array de itens do carrinho
// @param whatsappNum - Número com DDI. Ex: "5511999999999"
// @returns URL completa do link wa.me
// =============================================================================
export function gerarLinkWhatsApp(
  itens: ItemPedido[],
  whatsappNum: string,
): string {
  // Formata cada item como "1x Produto A - R$ 100,00"
  const linhasItens = itens.map((item) => {
    const precoFormatado = item.preco.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
    return `${item.quantidade}x ${item.nome} - ${precoFormatado}`;
  });

  // Calcula o total somando (preco * quantidade) de cada item
  const total = itens.reduce(
    (soma, item) => soma + item.preco * item.quantidade,
    0,
  );
  const totalFormatado = total.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

  // Monta o texto completo do pedido
  const texto = [
    "Olá, quero fazer um pedido:",
    "",
    ...linhasItens,
    "",
    `*Total: ${totalFormatado}*`,
  ].join("\n");

  // encodeURIComponent converte o texto para formato URL-safe
  // Ex: "\n" → "%0A", " " → "%20"
  return `https://wa.me/${whatsappNum}?text=${encodeURIComponent(texto)}`;
}

// =============================================================================
// FUNÇÃO: processarWebhookWhatsApp
// =============================================================================
// Recebe o payload do webhook da Evolution API e processa a mensagem recebida.
// Por enquanto apenas loga o payload — a integração com IA será adicionada aqui.
//
// COMO FUNCIONA O WEBHOOK:
//   1. Configure a URL do webhook na Evolution API:
//      PATCH /webhook/set/{instance} → { "url": "https://seudominio.com/vendas/webhook/whatsapp" }
//   2. A Evolution API fará POST nessa URL para cada mensagem recebida
//   3. Este serviço processa o payload
//
// @param payload - Objeto JSON enviado pela Evolution API
// @returns void
// =============================================================================
export async function processarWebhookWhatsApp(
  payload: unknown,
): Promise<void> {
  // Log completo para diagnóstico e desenvolvimento
  console.log(
    "[SalesWpp] Webhook WhatsApp recebido:",
    JSON.stringify(payload, null, 2),
  );

  // TODO: integrar IA aqui
  // Exemplo de integração futura com ChatGPT/Gemini:
  //   const mensagem = extrairMensagem(payload);
  //   const resposta = await gerarRespostaIA(mensagem);
  //   await enviarMensagemWhatsApp(resposta, EVOLUTION_API_URL, EVOLUTION_API_KEY);

  // TODO: salvar conversa no banco para exibição no painel admin
  //   await conversaRepository.salvar(schemaName, { mensagem, resposta, contato });
}

// =============================================================================
// FUNÇÃO: enviarMensagemWhatsApp
// =============================================================================
// Envia uma mensagem de texto via Evolution API.
// Deixado como stub para integração futura.
//
// @param numero    - Número destino com DDI. Ex: "5511999999999"
// @param mensagem  - Texto da mensagem
// @returns void
// =============================================================================
export async function enviarMensagemWhatsApp(
  numero: string,
  mensagem: string,
): Promise<void> {
  // TODO: implementar envio via Evolution API
  // Exemplo:
  //   const apiUrl  = process.env.EVOLUTION_API_URL;   // ex: http://localhost:8080
  //   const apiKey  = process.env.EVOLUTION_API_KEY;   // ex: sua-chave-secreta
  //   const instancia = process.env.EVOLUTION_INSTANCE; // ex: minha-instancia
  //
  //   await fetch(`${apiUrl}/message/sendText/${instancia}`, {
  //     method: "POST",
  //     headers: {
  //       "Content-Type": "application/json",
  //       "apikey": apiKey,
  //     },
  //     body: JSON.stringify({
  //       number: numero,
  //       text: mensagem,
  //     }),
  //   });

  console.log(`[SalesWpp] Envio WhatsApp para ${numero}:`, mensagem);
}
