// =============================================================================
// src/modules/financeiro/financeiro.routes.ts
// =============================================================================
// O QUE FAZ:
//   Registra as rotas do módulo financeiro. Mesmo padrão do estoque.routes.ts.
//   Prefixo '/financeiro' é definido no server.ts.
// =============================================================================

import { FastifyInstance } from "fastify";
import { tenantMiddleware } from "../../core/middleware/tenant.middleware";
import { requireModule } from "../../core/middleware/module.middleware";
import * as financeiroController from "./financeiro.controller";

const moduleGuard = [tenantMiddleware, requireModule("financeiro")];

export async function financeiroRoutes(fastify: FastifyInstance) {
  // GET /financeiro/transacoes
  // Lista transações com filtros e resumo financeiro do período
  fastify.get("/transacoes", {
    preHandler: moduleGuard,
    handler: financeiroController.listTransactions,
  });

  // GET /financeiro/transacoes/:id
  fastify.get<{ Params: { id: string } }>("/transacoes/:id", {
    preHandler: moduleGuard,
    handler: financeiroController.getTransaction,
  });

  // POST /financeiro/transacoes
  fastify.post("/transacoes", {
    preHandler: moduleGuard,
    handler: financeiroController.createTransaction,
  });

  // PATCH /financeiro/transacoes/:id
  fastify.patch<{ Params: { id: string } }>("/transacoes/:id", {
    preHandler: moduleGuard,
    handler: financeiroController.updateTransaction,
  });

  // DELETE /financeiro/transacoes/:id
  fastify.delete<{ Params: { id: string } }>("/transacoes/:id", {
    preHandler: moduleGuard,
    handler: financeiroController.deleteTransaction,
  });
}
