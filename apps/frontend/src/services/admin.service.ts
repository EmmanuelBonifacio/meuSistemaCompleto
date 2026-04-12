// =============================================================================
// src/services/admin.service.ts
// =============================================================================
// O QUE FAZ:
//   Camada de comunicação com os endpoints do painel Admin.
//   Estas rotas requerem role='admin' ou 'superadmin' no JWT.
//
// MAPEAMENTO DE ROTAS (admin.routes.ts no Backend):
//   GET    /admin/stats                                          → getStats()
//   GET    /admin/tenants                                        → listTenants()
//   GET    /admin/tenants/:id                                    → getTenant()
//   POST   /admin/tenants                                        → createTenant()
//   PATCH  /admin/tenants/:id/suspend                            → suspendTenant()
//   PATCH  /admin/tenants/:id/reactivate                         → reactivateTenant()
//   PATCH  /admin/tenants/:id/modules                            → toggleModule()
//   GET    /admin/tenants/:id/logs                               → getTenantLogs()
//   GET    /admin/tenants/:id/users                              → listTenantUsers()
//   POST   /admin/tenants/:id/users                              → createTenantUser()
//   PATCH  /admin/tenants/:id/users/:userId                      → updateTenantUser()
//   POST   /admin/tenants/:id/users/:userId/reset-password       → resetTenantUserPassword()
//   DELETE /admin/tenants/:id/users/:userId                      → deleteTenantUser()
// =============================================================================

import api from "./api";
import type {
  Tenant,
  TenantListResponse,
  SystemStats,
  CreateTenantInput,
  RequestLog,
  TenantUser,
  CreateTenantUserInput,
  UpdateTenantUserInput,
  ResetPasswordInput,
} from "@/types/api";

// Parâmetros de busca para listar tenants
export interface ListTenantsParams {
  page?: number;
  limit?: number;
  search?: string;
  active?: boolean;
}

// =============================================================================
// FUNÇÃO: getStats
// =============================================================================
// Busca estatísticas gerais do sistema para o dashboard admin.
// =============================================================================
export async function getStats(): Promise<SystemStats> {
  const response = await api.get<SystemStats>("/admin/stats");
  return response.data;
}

// Alias conveniente para o dashboard
export const getSystemStats = getStats;

// =============================================================================
// FUNÇÃO: listTenants
// =============================================================================
export async function listTenants(
  params: ListTenantsParams = {},
): Promise<Tenant[]> {
  const response = await api.get<TenantListResponse | Tenant[]>(
    "/admin/tenants",
    {
      params: {
        page: params.page ?? 1,
        limit: params.limit ?? 50,
        search: params.search,
        active: params.active,
      },
    },
  );
  // Normaliza: backend pode retornar array direto ou objeto paginado
  const raw = response.data;
  if (Array.isArray(raw)) return raw;
  if ("data" in raw && Array.isArray((raw as TenantListResponse).data)) {
    return (raw as TenantListResponse).data as unknown as Tenant[];
  }
  return [];
}

// =============================================================================
// FUNÇÃO: getTenant
// =============================================================================
export async function getTenant(id: string): Promise<Tenant> {
  const response = await api.get<Tenant>(`/admin/tenants/${id}`);
  return response.data;
}

// =============================================================================
// FUNÇÃO: createTenant
// =============================================================================
// Cria e provisiona um novo tenant (cria schema PostgreSQL, tabelas, etc.)
// =============================================================================
export async function createTenant(
  data: CreateTenantInput,
): Promise<{ mensagem: string; tenant: Tenant }> {
  const response = await api.post<{ mensagem: string; tenant: Tenant }>(
    "/admin/tenants",
    data,
  );
  return response.data;
}

// =============================================================================
// FUNÇÃO: suspendTenant
// =============================================================================
export async function suspendTenant(id: string): Promise<{ mensagem: string }> {
  const response = await api.patch<{ mensagem: string }>(
    `/admin/tenants/${id}/suspend`,
  );
  return response.data;
}

// =============================================================================
// FUNÇÃO: reactivateTenant
// =============================================================================
export async function reactivateTenant(
  id: string,
): Promise<{ mensagem: string }> {
  const response = await api.patch<{ mensagem: string }>(
    `/admin/tenants/${id}/reactivate`,
  );
  return response.data;
}

// =============================================================================
// FUNÇÃO: toggleModule
// =============================================================================
// Liga ou desliga um módulo específico para um tenant.
// isActive=true ativa, isActive=false desativa.
// =============================================================================
export async function toggleModule(
  tenantId: string,
  moduleName: string,
  isActive: boolean,
): Promise<{ mensagem: string; tenant: Tenant }> {
  const response = await api.patch<{ mensagem: string; tenant: Tenant }>(
    `/admin/tenants/${tenantId}/modules`,
    { moduleName, enabled: isActive },
  );
  return response.data;
}

// Alias com assinatura usada pelo ModuleToggle (passa moduleId = moduleName)
export const toggleTenantModule = toggleModule;

// =============================================================================
// FUNÇÃO: getTenantLogs
// =============================================================================
// Retorna os logs de acesso de um tenant, ordenados do mais recente.
// Parâmetros opcionais: modúlo específico e limite de registros.
// =============================================================================
export async function getTenantLogs(
  tenantId: string,
  options: { module?: string; limit?: number } = {},
): Promise<RequestLog[]> {
  const response = await api.get<RequestLog[]>(
    `/admin/tenants/${tenantId}/logs`,
    {
      params: {
        ...(options.module ? { module: options.module } : {}),
        ...(options.limit ? { limit: options.limit } : {}),
      },
    },
  );
  return response.data;
}

// =============================================================================
// FUNÇÕES: Gestão de usuários de tenant
// =============================================================================

// Lista todos os usuários de um tenant
export async function listTenantUsers(tenantId: string): Promise<TenantUser[]> {
  const response = await api.get<TenantUser[]>(
    `/admin/tenants/${tenantId}/users`,
  );
  return response.data;
}

// Cria um novo usuário em um tenant
export async function createTenantUser(
  tenantId: string,
  data: CreateTenantUserInput,
): Promise<{ mensagem: string; usuario: TenantUser }> {
  const response = await api.post<{ mensagem: string; usuario: TenantUser }>(
    `/admin/tenants/${tenantId}/users`,
    data,
  );
  return response.data;
}

// Atualiza nome, role ou status de um usuário
export async function updateTenantUser(
  tenantId: string,
  userId: string,
  data: UpdateTenantUserInput,
): Promise<{ mensagem: string; usuario: TenantUser }> {
  const response = await api.patch<{ mensagem: string; usuario: TenantUser }>(
    `/admin/tenants/${tenantId}/users/${userId}`,
    data,
  );
  return response.data;
}

// Redefine a senha de um usuário (superadmin, sem precisar da senha antiga)
export async function resetTenantUserPassword(
  tenantId: string,
  userId: string,
  data: ResetPasswordInput,
): Promise<{ mensagem: string }> {
  const response = await api.post<{ mensagem: string }>(
    `/admin/tenants/${tenantId}/users/${userId}/reset-password`,
    data,
  );
  return response.data;
}

// Remove um usuário permanentemente do tenant
export async function deleteTenantUser(
  tenantId: string,
  userId: string,
): Promise<{ mensagem: string }> {
  const response = await api.delete<{ mensagem: string }>(
    `/admin/tenants/${tenantId}/users/${userId}`,
  );
  return response.data;
}
