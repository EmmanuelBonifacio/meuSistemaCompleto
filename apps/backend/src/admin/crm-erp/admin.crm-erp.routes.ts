// =============================================================================
// src/admin/crm-erp/admin.crm-erp.routes.ts
// =============================================================================
// Registra as rotas de CRM e ERP do painel admin como sub-plugin Fastify.
// Deve ser registrado DENTRO do plugin adminRoutes para herdar o preHandler
// do adminMiddleware (proteção automática).
// =============================================================================

import { FastifyInstance } from "fastify";
import {
  getCrmHandler,
  updateCrmHandler,
  listPagamentosHandler,
  createPagamentoHandler,
  deletePagamentoHandler,
  updatePagamentoHandler,
  listArquivosHandler,
  uploadArquivoHandler,
  deleteArquivoHandler,
  getErpHandler,
  updateErpHandler,
  listParcelasHandler,
  gerarParcelasHandler,
  updateParcelaHandler,
} from "./admin.crm-erp.controller";

export async function adminCrmErpRoutes(
  fastify: FastifyInstance,
): Promise<void> {
  // -------------------------------------------------------------------------
  // CRM — Dados do cliente
  // -------------------------------------------------------------------------
  // GET  /admin/tenants/:tenantId/crm  → retorna dados CRM (upsert automático)
  fastify.get("/tenants/:tenantId/crm", getCrmHandler);

  // PUT  /admin/tenants/:tenantId/crm  → atualiza dados do cliente
  fastify.put("/tenants/:tenantId/crm", updateCrmHandler);

  // -------------------------------------------------------------------------
  // CRM — Pagamentos
  // -------------------------------------------------------------------------
  // GET    /admin/tenants/:tenantId/crm/pagamentos        → lista pagamentos
  fastify.get("/tenants/:tenantId/crm/pagamentos", listPagamentosHandler);

  // POST   /admin/tenants/:tenantId/crm/pagamentos        → cria lançamento
  fastify.post("/tenants/:tenantId/crm/pagamentos", createPagamentoHandler);

  // DELETE /admin/tenants/:tenantId/crm/pagamentos/:pagamentoId → exclui
  fastify.delete(
    "/tenants/:tenantId/crm/pagamentos/:pagamentoId",
    deletePagamentoHandler,
  );

  // PUT    /admin/tenants/:tenantId/crm/pagamentos/:pagamentoId → atualiza
  fastify.put(
    "/tenants/:tenantId/crm/pagamentos/:pagamentoId",
    updatePagamentoHandler,
  );

  // -------------------------------------------------------------------------
  // CRM — Arquivos
  // -------------------------------------------------------------------------
  // GET    /admin/tenants/:tenantId/crm/arquivos          → lista arquivos
  fastify.get("/tenants/:tenantId/crm/arquivos", listArquivosHandler);

  // POST   /admin/tenants/:tenantId/crm/arquivos          → upload (multipart)
  fastify.post("/tenants/:tenantId/crm/arquivos", uploadArquivoHandler);

  // DELETE /admin/tenants/:tenantId/crm/arquivos/:arquivoId → exclui arquivo
  fastify.delete(
    "/tenants/:tenantId/crm/arquivos/:arquivoId",
    deleteArquivoHandler,
  );

  // -------------------------------------------------------------------------
  // ERP — Configuração
  // -------------------------------------------------------------------------
  // GET /admin/tenants/:tenantId/erp  → retorna config ERP (upsert automático)
  fastify.get("/tenants/:tenantId/erp", getErpHandler);

  // PUT /admin/tenants/:tenantId/erp  → atualiza config ERP
  fastify.put("/tenants/:tenantId/erp", updateErpHandler);

  // -------------------------------------------------------------------------
  // ERP — Parcelas
  // -------------------------------------------------------------------------
  // GET  /admin/tenants/:tenantId/erp/parcelas         → lista parcelas
  fastify.get("/tenants/:tenantId/erp/parcelas", listParcelasHandler);

  // POST /admin/tenants/:tenantId/erp/parcelas/gerar   → gera/substitui parcelas
  fastify.post("/tenants/:tenantId/erp/parcelas/gerar", gerarParcelasHandler);

  // PUT  /admin/tenants/:tenantId/erp/parcelas/:parcelaId → edita parcela individual
  fastify.put(
    "/tenants/:tenantId/erp/parcelas/:parcelaId",
    updateParcelaHandler,
  );
}
