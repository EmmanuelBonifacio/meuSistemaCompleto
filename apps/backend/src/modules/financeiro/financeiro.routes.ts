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

  // GET /financeiro/compromissos
  fastify.get("/compromissos", {
    preHandler: moduleGuard,
    handler: financeiroController.listCommitments,
  });

  // POST /financeiro/compromissos
  fastify.post("/compromissos", {
    preHandler: moduleGuard,
    handler: financeiroController.createCommitment,
  });

  // PATCH /financeiro/compromissos/:id
  fastify.patch<{ Params: { id: string } }>("/compromissos/:id", {
    preHandler: moduleGuard,
    handler: financeiroController.updateCommitment,
  });

  // DELETE /financeiro/compromissos/:id
  fastify.delete<{ Params: { id: string } }>("/compromissos/:id", {
    preHandler: moduleGuard,
    handler: financeiroController.deleteCommitment,
  });

  // GET /financeiro/projecao
  fastify.get("/projecao", {
    preHandler: moduleGuard,
    handler: financeiroController.getProjection,
  });

  // GET /financeiro/dashboard
  fastify.get("/dashboard", {
    preHandler: moduleGuard,
    handler: financeiroController.getDashboard,
  });

  // POST /financeiro/ocorrencias/:id/baixar
  fastify.post<{ Params: { id: string } }>("/ocorrencias/:id/baixar", {
    preHandler: moduleGuard,
    handler: financeiroController.settleOccurrence,
  });

  // POST /financeiro/importacoes/extrato-csv
  fastify.post("/importacoes/extrato-csv", {
    preHandler: moduleGuard,
    handler: financeiroController.importBankCsv,
  });

  // POST /financeiro/historico/snapshot
  fastify.post("/historico/snapshot", {
    preHandler: moduleGuard,
    handler: financeiroController.snapshotMonthlyHistory,
  });

  // GET /financeiro/historico
  fastify.get("/historico", {
    preHandler: moduleGuard,
    handler: financeiroController.listMonthlyHistory,
  });

  // GET /financeiro/relatorios/mensal
  fastify.get("/relatorios/mensal", {
    preHandler: moduleGuard,
    handler: financeiroController.getMonthlyReport,
  });
}
