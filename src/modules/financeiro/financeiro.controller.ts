// =============================================================================
// src/modules/financeiro/financeiro.controller.ts
// =============================================================================
// O QUE FAZ:
//   Controller do módulo financeiro. Mesma estrutura do estoque.controller.ts,
//   demonstrando que o padrão é 100% reaproveitável entre módulos.
// =============================================================================

import { FastifyRequest, FastifyReply } from "fastify";
import {
  CreateTransactionSchema,
  UpdateTransactionSchema,
  TransactionParamsSchema,
  ListTransactionsQuerySchema,
} from "./financeiro.schema";
import * as financeiroRepository from "./financeiro.repository";

// =============================================================================
// HANDLER: Listar Transações
// GET /financeiro/transacoes
// =============================================================================
export async function listTransactions(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const schemaName = request.tenant!.schemaName;
  const query = ListTransactionsQuerySchema.parse(request.query);

  const result = await financeiroRepository.findAllTransactions(
    schemaName,
    query,
  );

  return reply.status(200).send(result);
}

// =============================================================================
// HANDLER: Buscar Transação por ID
// GET /financeiro/transacoes/:id
// =============================================================================
export async function getTransaction(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const schemaName = request.tenant!.schemaName;
  const { id } = TransactionParamsSchema.parse(request.params);

  const transaction = await financeiroRepository.findTransactionById(
    schemaName,
    id,
  );

  if (!transaction) {
    return reply.status(404).send({
      statusCode: 404,
      error: "Não Encontrado",
      message: "Transação não encontrada.",
    });
  }

  return reply.status(200).send(transaction);
}

// =============================================================================
// HANDLER: Criar Transação
// POST /financeiro/transacoes
// =============================================================================
export async function createTransaction(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const schemaName = request.tenant!.schemaName;
  const data = CreateTransactionSchema.parse(request.body);

  const transaction = await financeiroRepository.createTransaction(
    schemaName,
    data,
  );

  return reply.status(201).send(transaction);
}

// =============================================================================
// HANDLER: Atualizar Transação
// PATCH /financeiro/transacoes/:id
// =============================================================================
export async function updateTransaction(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const schemaName = request.tenant!.schemaName;
  const { id } = TransactionParamsSchema.parse(request.params);
  const data = UpdateTransactionSchema.parse(request.body);

  const transaction = await financeiroRepository.updateTransaction(
    schemaName,
    id,
    data,
  );

  if (!transaction) {
    return reply.status(404).send({
      statusCode: 404,
      error: "Não Encontrado",
      message: "Transação não encontrada.",
    });
  }

  return reply.status(200).send(transaction);
}

// =============================================================================
// HANDLER: Deletar Transação
// DELETE /financeiro/transacoes/:id
// =============================================================================
export async function deleteTransaction(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const schemaName = request.tenant!.schemaName;
  const { id } = TransactionParamsSchema.parse(request.params);

  const deleted = await financeiroRepository.deleteTransaction(schemaName, id);

  if (!deleted) {
    return reply.status(404).send({
      statusCode: 404,
      error: "Não Encontrado",
      message: "Transação não encontrada.",
    });
  }

  return reply.status(204).send();
}
