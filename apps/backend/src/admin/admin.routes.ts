// =============================================================================
// src/admin/admin.routes.ts
// =============================================================================
// O QUE FAZ:
//   Registra todas as rotas do painel admin como um plugin Fastify.
//   Aplica o adminMiddleware em TODAS as rotas deste plugin via `preHandler`.
//
// COMO O PLUGIN FASTIFY ISOLA AS ROTAS ADMIN:
//   O sistema de plugins do Fastify cria um escopo encapsulado.
//   Qualquer configuração (hooks, decorators) definida DENTRO do plugin
//   afeta APENAS as rotas deste plugin, não as rotas de outros módulos.
//
//   Isso é perfeito para o painel admin:
//   - Uma única configuração de preHandler aplica adminMiddleware a TUDO
//   - Impossível esquecer de proteger uma rota admin
//   - Módulos de tenant (estoque, financeiro) não são afetados
//
// ROTAS DISPONÍVEIS APÓS REGISTRO:
//   GET    /admin/stats                         → Dashboard: estatísticas do sistema
//   GET    /admin/tenants                       → Listar todos os tenants (paginado)
//   GET    /admin/tenants/:id                   → Detalhes de um tenant
//   POST   /admin/tenants                       → Criar + provisionar novo tenant
//   PATCH  /admin/tenants/:id/suspend           → Suspender tenant (acesso bloqueado)
//   PATCH  /admin/tenants/:id/reactivate        → Reativar tenant suspenso
//   DELETE /admin/tenants/:id                   → Excluir tenant permanentemente
//   PATCH  /admin/tenants/:id/modules           → Ligar/desligar módulo de um tenant
// =============================================================================

import { FastifyInstance } from "fastify";
import { adminMiddleware } from "./admin.middleware";
import {
  listTenants,
  getTenant,
  createTenant,
  suspendTenantHandler,
  reactivateTenantHandler,
  deleteTenantHandler,
  toggleModuleHandler,
  getStatsHandler,
  getTenantLogsHandler,
  listTenantUsersHandler,
  createTenantUserHandler,
  updateTenantUserHandler,
  resetTenantUserPasswordHandler,
  deleteTenantUserHandler,
} from "./admin.controller";
import { adminCrmErpRoutes } from "./crm-erp/admin.crm-erp.routes";

// =============================================================================
// PLUGIN: adminRoutes
// =============================================================================
// COMO REGISTRAR NO SERVIDOR:
//   await app.register(adminRoutes, { prefix: "/admin" });
//
// Todas as rotas abaixo serão prefixadas com /admin automaticamente.
// =============================================================================
export async function adminRoutes(fastify: FastifyInstance): Promise<void> {
  // ---------------------------------------------------------------------------
  // PROTEÇÃO GLOBAL DO PLUGIN
  // ---------------------------------------------------------------------------
  // O QUE FAZ:
  //   `fastify.addHook("preHandler", adminMiddleware)` aplica o adminMiddleware
  //   a TODAS as rotas registradas neste plugin — sem exceção.
  //
  // POR QUE addHook É MELHOR DO QUE REPETIR preHandler EM CADA ROTA?
  //   1. DRY: sem repetição — uma linha protege tudo
  //   2. Segurança: impossível esquecer de proteger uma rota nova
  //   3. Manutenção: trocar o middleware admin = mudar em apenas 1 lugar
  //
  // IMPORTANTE: Este hook afeta APENAS este plugin (escopo encapsulado).
  // Rotas fora deste plugin (ex: /estoque, /financeiro) NÃO são afetadas.
  // ---------------------------------------------------------------------------
  fastify.addHook("preHandler", adminMiddleware);

  // ==========================================================================
  // ROTA: GET /admin/stats (prefixo aplicado pelo register)
  // ==========================================================================
  // Dashboard do sistema: total de tenants, ativos, módulos mais usados, etc.
  // Útil para a tela inicial do painel administrativo.
  // ==========================================================================
  fastify.get("/stats", getStatsHandler);

  // ==========================================================================
  // ROTA: GET /admin/tenants
  // ==========================================================================
  // Lista todos os clientes com paginação.
  // Query params: ?page=1&limit=10&search=acme&active=true
  // ==========================================================================
  fastify.get("/tenants", listTenants);

  // ==========================================================================
  // ROTA: GET /admin/tenants/:id
  // ==========================================================================
  // Detalhes completos de um tenant incluindo módulos ativos.
  // ==========================================================================
  fastify.get("/tenants/:id", getTenant);

  // ==========================================================================
  // ROTA: POST /admin/tenants
  // ==========================================================================
  // Cria e provisiona um novo tenant automaticamente.
  // Body: { name, slug, moduleNames?: string[] }
  // ==========================================================================
  fastify.post("/tenants", createTenant);

  // ==========================================================================
  // ROTA: PATCH /admin/tenants/:id/suspend
  // ==========================================================================
  // Suspende o tenant: isActive = false.
  // Efeito imediato: próxima requisição do tenant retorna 403.
  //
  // HTTP PATCH vs DELETE:
  //   DELETE = remove o recurso. PATCH = modifica parcialmente.
  //   Suspender é uma MODIFICAÇÃO do estado do tenant, não uma remoção.
  //   PATCH é semanticamente correto aqui.
  // ==========================================================================
  fastify.patch("/tenants/:id/suspend", suspendTenantHandler);

  // ==========================================================================
  // ROTA: PATCH /admin/tenants/:id/reactivate
  // ==========================================================================
  // Reativa tenant suspenso: isActive = true.
  // Acesso restaurado imediatamente.
  // ==========================================================================
  fastify.patch("/tenants/:id/reactivate", reactivateTenantHandler);

  // ==========================================================================
  // ROTA: DELETE /admin/tenants/:id
  // ==========================================================================
  // Exclui definitivamente o tenant e todos os seus dados (schema + metadados).
  // Requer confirmação no frontend, pois é uma ação irreversível.
  // ==========================================================================
  fastify.delete("/tenants/:id", deleteTenantHandler);

  // ==========================================================================
  // ROTA: PATCH /admin/tenants/:id/modules
  // ==========================================================================
  // Liga ou desliga um módulo para o tenant em tempo real.
  // Body: { moduleName: "financeiro", enabled: false }
  //
  // POR QUE UMA ROTA ÚNICA E NÃO DUAS (enable/disable)?
  //   Uma rota com { enabled: boolean } é mais RESTful e semântica.
  //   É o estado DESEJADO, não uma ação. O servidor decide o que fazer
  //   com base no estado atual vs desejado (upsert no repository).
  // ==========================================================================
  fastify.patch("/tenants/:id/modules", toggleModuleHandler);

  // ==========================================================================
  // ROTA: GET /admin/tenants/:id/logs
  // ==========================================================================
  // Logs de acesso do tenant: módulo, método, path, status, duração.
  // Query params: ?module=estoque&limit=50
  // ==========================================================================
  fastify.get("/tenants/:id/logs", getTenantLogsHandler);

  // ==========================================================================
  // ROTAS: Gestão de usuários de tenant
  // ==========================================================================
  // Permitem ao admin criar, listar, editar e remover usuários dentro de
  // qualquer tenant — sem precisar de acesso ao banco diretamente.
  //
  // PADRÃO REST ANINHADO:
  //   GET    /admin/tenants/:id/users                      → listar
  //   POST   /admin/tenants/:id/users                      → criar
  //   PATCH  /admin/tenants/:id/users/:userId              → editar
  //   POST   /admin/tenants/:id/users/:userId/reset-password → trocar senha
  //   DELETE /admin/tenants/:id/users/:userId              → remover
  // ==========================================================================
  fastify.get("/tenants/:id/users", listTenantUsersHandler);
  fastify.post("/tenants/:id/users", createTenantUserHandler);
  fastify.patch("/tenants/:id/users/:userId", updateTenantUserHandler);
  fastify.post(
    "/tenants/:id/users/:userId/reset-password",
    resetTenantUserPasswordHandler,
  );
  fastify.delete("/tenants/:id/users/:userId", deleteTenantUserHandler);

  // ==========================================================================
  // ROTAS: CRM e ERP por tenant
  // ==========================================================================
  // Registradas como sub-plugin — herdam o preHandler do adminMiddleware
  // aplicado no escopo deste plugin (sem necessidade de nova proteção).
  //
  // Rotas disponíveis:
  //   GET/PUT  /admin/tenants/:tenantId/crm
  //   GET/POST /admin/tenants/:tenantId/crm/pagamentos
  //   DELETE   /admin/tenants/:tenantId/crm/pagamentos/:pagamentoId
  //   GET/POST /admin/tenants/:tenantId/crm/arquivos
  //   DELETE   /admin/tenants/:tenantId/crm/arquivos/:arquivoId
  //   GET/PUT  /admin/tenants/:tenantId/erp
  // ==========================================================================
  await fastify.register(adminCrmErpRoutes);
}
