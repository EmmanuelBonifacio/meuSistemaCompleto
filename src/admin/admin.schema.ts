// =============================================================================
// src/admin/admin.schema.ts
// =============================================================================
// O QUE FAZ:
//   Define os schemas de validação Zod para todas as entradas do painel admin.
//   Assim como nos módulos de negócio, validamos ANTES de tocar no banco.
//
// POR QUE ZOD E NÃO VALIDAÇÃO MANUAL?
//   Zod gera tipagens TypeScript automaticamente (z.infer<typeof Schema>).
//   Uma única fonte de verdade: o schema valida E tipifica.
//   Erros de validação são retornados em formato estruturado e padronizado.
// =============================================================================

import { z } from "zod";

// =============================================================================
// SCHEMA: Criação de Tenant via Admin
// =============================================================================
// Usado em: POST /admin/tenants
// O slug é transformado para minúsculas e hífen → snake_case para o schema.
// =============================================================================
export const AdminCreateTenantSchema = z.object({
  name: z
    .string({ required_error: "Nome do tenant é obrigatório" })
    .min(2, "Nome deve ter no mínimo 2 caracteres")
    .max(100, "Nome pode ter no máximo 100 caracteres")
    .trim(),

  slug: z
    .string({ required_error: "Slug é obrigatório" })
    .min(2, "Slug deve ter no mínimo 2 caracteres")
    .max(50, "Slug pode ter no máximo 50 caracteres")
    // Aceita letras minúsculas, números e hífens (padrão URL-friendly)
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug deve conter apenas letras minúsculas, números e hífens (ex: minha-empresa)",
    )
    .transform((val) => val.toLowerCase()),

  // Lista de módulos a ativar: ["estoque", "financeiro", "vendas", "rh"]
  // Se não informado, o tenant é criado sem módulos (pode ativar depois).
  moduleNames: z.array(z.string().min(1)).optional().default([]),
});

export type AdminCreateTenantInput = z.infer<typeof AdminCreateTenantSchema>;

// =============================================================================
// SCHEMA: Parâmetros de Tenant por ID
// =============================================================================
// Usado em: GET /admin/tenants/:id, PATCH /admin/tenants/:id/suspend, etc.
// =============================================================================
export const AdminTenantParamsSchema = z.object({
  id: z.string().uuid("ID do tenant deve ser um UUID válido"),
});

export type AdminTenantParams = z.infer<typeof AdminTenantParamsSchema>;

// =============================================================================
// SCHEMA: Ativar/Desativar módulo de um tenant
// =============================================================================
// Usado em: PATCH /admin/tenants/:id/modules
//
// O CAMPO `enabled` COMO BOOLEAN EXPLÍCITO:
//   true  → ativar o módulo para este tenant
//   false → desativar o módulo para este tenant
//
// Isso é mais intuitivo e seguro do que usar "toggle" (que dependeria de
// buscar o estado atual para invertê-lo — abrindo race conditions).
// =============================================================================
export const AdminToggleModuleSchema = z.object({
  moduleName: z
    .string({ required_error: "Nome do módulo é obrigatório" })
    .min(1, "Nome do módulo não pode ser vazio")
    .toLowerCase()
    .trim(),
  // ex: "estoque", "financeiro", "vendas", "rh"

  enabled: z.boolean({
    required_error: "O campo 'enabled' é obrigatório (true ou false)",
    invalid_type_error: "O campo 'enabled' deve ser boolean (true ou false)",
  }),
  // true  = ligar o módulo   → insere ou atualiza tenant_modules.is_enabled = true
  // false = desligar o módulo → atualiza tenant_modules.is_enabled = false
});

export type AdminToggleModuleInput = z.infer<typeof AdminToggleModuleSchema>;

// =============================================================================
// SCHEMA: Query de listagem de tenants
// =============================================================================
// Usado em: GET /admin/tenants?page=1&limit=10&search=acme&active=true
// =============================================================================
export const AdminListTenantsQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1))
    .pipe(z.number().min(1, "Página deve ser pelo menos 1")),

  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 20))
    .pipe(z.number().min(1).max(100, "Limite máximo é 100 por página")),

  search: z.string().optional(),
  // Filtra por nome ou slug do tenant

  active: z
    .string()
    .optional()
    .transform((val) => {
      if (val === "true") return true;
      if (val === "false") return false;
      return undefined; // sem filtro → retorna todos
    }),
});

export type AdminListTenantsQuery = z.infer<typeof AdminListTenantsQuerySchema>;
