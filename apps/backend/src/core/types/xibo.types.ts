// =============================================================================
// src/core/types/xibo.types.ts
// =============================================================================
// Tipos compartilhados do módulo Xibo.
// Centralizado aqui para evitar dependência invertida entre
// core/types/fastify.d.ts e routes/xibo/*.
// =============================================================================

/**
 * Contexto do tenant resolvido a partir de um token Xibo (?token=).
 * Disponível em request.xiboTenant nas rotas /api/v1/xibo/*.
 */
export interface XiboTenantContext {
  /** UUID do tenant na tabela public.tenants */
  id: string;

  /** Nome do schema PostgreSQL deste tenant. Ex: "tenant_acme_corp" */
  schemaName: string;

  /** Slug único do tenant. Ex: "acme-corp" */
  slug: string;
}
