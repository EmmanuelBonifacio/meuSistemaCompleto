// =============================================================================
// src/modules/vendas/vendas.pedidos.controller.ts
// =============================================================================
// O QUE FAZ:
//   Handlers HTTP dos PEDIDOS recebidos via WhatsApp.
//
// ROTAS:
//   POST   /vendas/pedidos         → createPedidoVenda    (público)
//   GET    /vendas/pedidos         → listPedidosVenda     (protegida — admin)
//   PATCH  /vendas/pedidos/:id     → updatePedidoVenda    (protegida — admin)
//   POST   /vendas/webhook/whatsapp → webhookWhatsApp     (público — Evolution API)
// =============================================================================

import { FastifyRequest, FastifyReply } from "fastify";
import {
  CriarPedidoSchema,
  AtualizarPedidoSchema,
  PedidoParamsSchema,
} from "./vendas.schema";
import * as pedidosRepository from "./vendas.pedidos.repository";
import { processarWebhookWhatsApp } from "./vendas.whatsapp.service";

// =============================================================================
// HANDLER: Criar Pedido via WhatsApp (chamado pelo frontend ao clicar no link)
// POST /vendas/pedidos
// =============================================================================
// O frontend gera o link wa.me e simultaneamente registra o pedido aqui.
// Isso permite ao admin ver os pedidos mesmo antes de confirmar o pagamento.
// =============================================================================
export async function createPedidoVenda(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const schemaName = request.tenant!.schemaName;
  const data = CriarPedidoSchema.parse(request.body);

  // Valida que o total informado pelo frontend bate com a soma dos itens.
  // Evita manipulação de preço no lado do cliente.
  const totalCalculado = data.itens.reduce(
    (soma, item) => soma + item.preco * item.quantidade,
    0,
  );

  // Tolerância de R$ 0,01 para arredondamentos de ponto flutuante
  if (Math.abs(totalCalculado - data.total) > 0.01) {
    return reply.status(400).send({
      statusCode: 400,
      error: "Bad Request",
      message: "Total informado não confere com a soma dos itens.",
    });
  }

  const pedido = await pedidosRepository.createPedidoVenda(schemaName, data);

  return reply.status(201).send({
    mensagem: "Pedido registrado com sucesso.",
    pedido,
  });
}

// =============================================================================
// HANDLER: Listar Pedidos (admin)
// GET /vendas/pedidos
// =============================================================================
export async function listPedidosVenda(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const schemaName = request.tenant!.schemaName;

  // Filtro opcional por status: ?status=pendente
  const { status } = request.query as { status?: string };

  const pedidos = await pedidosRepository.findAllPedidosVenda(
    schemaName,
    status,
  );

  return reply.status(200).send({ pedidos });
}

// =============================================================================
// HANDLER: Atualizar Pedido (marcar como pago, enviado, etc.)
// PATCH /vendas/pedidos/:id
// =============================================================================
export async function updatePedidoVenda(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const schemaName = request.tenant!.schemaName;
  const { id } = PedidoParamsSchema.parse(request.params);
  const { status, notas } = AtualizarPedidoSchema.parse({
    ...request.body,
    id,
  });

  const pedido = await pedidosRepository.updatePedidoVenda(schemaName, id, {
    status,
    notas,
  });

  if (!pedido) {
    return reply.status(404).send({
      statusCode: 404,
      error: "Não Encontrado",
      message: "Pedido não encontrado.",
    });
  }

  return reply.status(200).send({ mensagem: "Pedido atualizado.", pedido });
}

// =============================================================================
// HANDLER: Resumo de Vendas (dashboard do admin)
// GET /vendas/resumo
// =============================================================================
export async function getResumoVendas(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const schemaName = request.tenant!.schemaName;
  const resumo = await pedidosRepository.getResumoVendas(schemaName);

  return reply.status(200).send(resumo);
}

// =============================================================================
// HANDLER: Webhook WhatsApp (recebe mensagens da Evolution API)
// POST /vendas/webhook/whatsapp
// =============================================================================
// Chamado pela Evolution API para cada mensagem recebida no WhatsApp.
// Por enquanto, faz log e responde 200 OK para a Evolution não re-tentar.
// =============================================================================
export async function webhookWhatsApp(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  // Processa de forma assíncrona sem bloquear o response.
  // A Evolution API espera um 200 rápido — processamento pesado vai em fila.
  processarWebhookWhatsApp(request.body).catch((err) => {
    console.error("[SalesWpp] Erro ao processar webhook:", err);
  });

  // Responde 200 imediatamente para a Evolution API não re-enviar o evento
  return reply.status(200).send({ recebido: true });
}
