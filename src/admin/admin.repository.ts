// =============================================================================
// src/admin/admin.repository.ts
// =============================================================================
// O QUE FAZ:
//   Camada de acesso a dados EXCLUSIVA do painel admin.
//   Opera APENAS no schema `public` (tabelas globais: tenants, modules,
//   tenant_modules) usando o PrismaClient diretamente — sem withTenantSchema().
//
// POR QUE NÃO USAR withTenantSchema() AQUI?
//   withTenantSchema() existe para trocar o search_path e acessar dados
//   ISOLADOS de um tenant específico (tabelas products, transactions, etc.)
//   O admin NÃO precisa disso — ele acessa os dados GLOBAIS (metadados),
//   que ficam no schema public e são gerenciados pelo Prisma ORM normalmente.
//
// DIFERENÇA DE ACESSO:
//   Módulo de tenant: prisma via withTenantSchema → tenant_acme.products
//   Admin:            prisma direto              → public.tenants, public.modules
//
// POR QUE SEPARAR DO CONTROLLER?
//   Princípio de Responsabilidade Única (SRP):
//   Repository = COMO buscar dados (SQL/Prisma)
//   Controller = O QUE fazer com os dados (lógica HTTP)
//   Isso facilita trocar o banco (ex: Prisma → Drizzle) sem tocar nos controllers.
// =============================================================================

import { prisma } from "../core/database/prisma";
import { AdminListTenantsQuery, AdminToggleModuleInput } from "./admin.schema";

// =============================================================================
// INTERFACE: TenantWithModules
// =============================================================================
// Representa um tenant com seus módulos ativos — usado na listagem admin.
// =============================================================================
export interface TenantAdminView {
  id: string;
  name: string;
  slug: string;
  schemaName: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  modules: Array<{
    id: string;
    moduleName: string;
    displayName: string;
    isEnabled: boolean;
    enabledAt: Date | null;
  }>;
}

// =============================================================================
// FUNÇÃO: findAllTenantsAdmin
// =============================================================================
// O QUE FAZ:
//   Busca todos os tenants com paginação, filtros e seus módulos relacionados.
//   Retorna uma visão completa de cada cliente para o painel administrativo.
//
// POR QUE INCLUIR OS MÓDULOS NA LISTAGEM?
//   O admin precisa ver de relance quais módulos cada cliente tem ativo.
//   Uma segunda requisição por tenant seria N+1 queries — ineficiente.
//   Com `include: { tenantModules: { include: { module: true } } }`, o
//   Prisma monta um JOIN eficiente em uma única query.
// =============================================================================
export async function findAllTenantsAdmin(
  query: AdminListTenantsQuery,
): Promise<{
  data: TenantAdminView[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}> {
  const { page, limit, search, active } = query;
  const skip = (page - 1) * limit;

  // Monta o filtro WHERE dinamicamente baseado nos query params recebidos
  const where = {
    // Filtro por texto: procura no name OU no slug (case-insensitive via `mode: 'insensitive'`)
    ...(search && {
      OR: [
        { name: { contains: search, mode: "insensitive" as const } },
        { slug: { contains: search, mode: "insensitive" as const } },
      ],
    }),
    // Filtro por status ativo/suspenso — undefined = sem filtro (retorna todos)
    ...(active !== undefined && { isActive: active }),
  };

  // Executa count e listagem em paralelo para melhor performance
  // Promise.all garante que as duas queries rodam ao mesmo tempo no banco.
  const [total, tenants] = await Promise.all([
    prisma.tenant.count({ where }),

    prisma.tenant.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" }, // mais recentes primeiro
      include: {
        // 'modules' é o nome da relação definida no schema.prisma (Tenant.modules)
        modules: {
          include: {
            module: true,
          },
          // Ordena módulos por nome para exibição consistente
          orderBy: { module: { name: "asc" } },
        },
      },
    }),
  ]);

  // Transforma o resultado do Prisma no formato da nossa interface TenantAdminView
  const data: TenantAdminView[] = tenants.map((tenant) => ({
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    schemaName: tenant.schemaName,
    isActive: tenant.isActive,
    createdAt: tenant.createdAt,
    updatedAt: tenant.updatedAt,
    modules: tenant.modules.map((tm) => ({
      id: tm.id,
      moduleName: tm.module.name,
      displayName: tm.module.displayName,
      isEnabled: tm.isEnabled,
      enabledAt: tm.enabledAt,
    })),
  }));

  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

// =============================================================================
// FUNÇÃO: findTenantByIdAdmin
// =============================================================================
// O QUE FAZ:
//   Busca um único tenant pelo ID com todos os seus módulos.
//   Retorna null se não encontrar (o controller trata o 404).
// =============================================================================
export async function findTenantByIdAdmin(
  id: string,
): Promise<TenantAdminView | null> {
  const tenant = await prisma.tenant.findUnique({
    where: { id },
    include: {
      // 'modules' é o nome da relação definida no schema.prisma (Tenant.modules)
      modules: {
        include: { module: true },
        orderBy: { module: { name: "asc" } },
      },
    },
  });

  if (!tenant) return null;

  return {
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    schemaName: tenant.schemaName,
    isActive: tenant.isActive,
    createdAt: tenant.createdAt,
    updatedAt: tenant.updatedAt,
    modules: tenant.modules.map((tm) => ({
      id: tm.id,
      moduleName: tm.module.name,
      displayName: tm.module.displayName,
      isEnabled: tm.isEnabled,
      enabledAt: tm.enabledAt,
    })),
  };
}

// =============================================================================
// FUNÇÃO: suspendTenant
// =============================================================================
// O QUE FAZ:
//   Desativa o acesso de um tenant inteiro (isActive = false).
//   Isso NÃO apaga dados — é uma suspensão reversível.
//
// EFEITO IMEDIATO EM TEMPO REAL:
//   O tenantMiddleware verifica `isActive` a CADA requisição (sem cache).
//   Assim que este update for feito, a próxima requisição do tenant
//   suspenso receberá um 403. NENHUM restart necessário.
//
// POR QUE NÃO DELETAR O TENANT?
//   Hard delete = perda irreversível de dados. Em SaaS B2B, nunca deletamos
//   dados de clientes sem um processo formal (LGPD, auditorias, etc.).
//   A suspensão é sempre o primeiro passo — a deleção pode vir depois
//   com um procedimento separado e controlado.
// =============================================================================
export async function suspendTenant(
  tenantId: string,
): Promise<{ id: string; isActive: boolean; updatedAt: Date }> {
  const updated = await prisma.tenant.update({
    where: { id: tenantId },
    data: { isActive: false },
    select: { id: true, isActive: true, updatedAt: true },
  });

  return updated;
}

// =============================================================================
// FUNÇÃO: reactivateTenant
// =============================================================================
// O QUE FAZ:
//   Reativa um tenant suspenso (isActive = true).
//   Operação inversa de suspendTenant — restaura acesso imediatamente.
// =============================================================================
export async function reactivateTenant(
  tenantId: string,
): Promise<{ id: string; isActive: boolean; updatedAt: Date }> {
  const updated = await prisma.tenant.update({
    where: { id: tenantId },
    data: { isActive: true },
    select: { id: true, isActive: true, updatedAt: true },
  });

  return updated;
}

// =============================================================================
// FUNÇÃO: toggleTenantModule
// =============================================================================
// O QUE FAZ:
//   Liga ou desliga um módulo específico para um tenant específico.
//
// COMO FUNCIONA:
//   1. Busca o módulo pelo nome (ex: "financeiro") para obter seu ID
//   2. Usa upsert para:
//      - Se a relação tenant_modules já existe: atualiza is_enabled
//      - Se não existe ainda: cria o registro (upsert = insert or update)
//
// POR QUE UPSERT E NÃO UPDATE SIMPLES?
//   Ao criar um tenant, podemos não ativar todos os módulos imediatamente.
//   Quando o admin ativa um módulo depois, o registro pode não existir ainda.
//   O upsert (INSERT...ON CONFLICT DO UPDATE) garante que funciona nos dois casos.
//
// EFEITO IMEDIATO:
//   O requireModule() verifica tenant_modules a cada requisição.
//   Desativar aqui = próxima chamada ao módulo retorna 403 imediatamente.
// =============================================================================
export async function toggleTenantModule(
  tenantId: string,
  data: AdminToggleModuleInput,
): Promise<{
  moduleName: string;
  displayName: string;
  isEnabled: boolean;
  tenantId: string;
}> {
  // Passo 1: Busca o módulo pelo nome para validar existência e obter o ID
  const module = await prisma.module.findFirst({
    where: { name: data.moduleName },
  });

  if (!module) {
    // Lança erro com código customizado para o controller identificar (404 vs 500)
    const error = new Error(
      `Módulo "${data.moduleName}" não existe no sistema.`,
    );
    (error as NodeJS.ErrnoException).code = "MODULE_NOT_FOUND";
    throw error;
  }

  // Passo 2: Upsert na tabela tenant_modules
  // create: cria o registro se não existe
  // update: atualiza is_enabled se já existe
  const tenantModule = await prisma.tenantModule.upsert({
    where: {
      // Chave composta única: tenantId + moduleId
      tenantId_moduleId: {
        tenantId,
        moduleId: module.id,
      },
    },
    create: {
      tenantId,
      moduleId: module.id,
      isEnabled: data.enabled,
      // enabledAt: usa o valor default do Prisma (now()) quando ativado pela 1ª vez.
      // Quando criamos desativado, ainda precisamos um valor (campo non-nullable).
      enabledAt: new Date(),
    },
    update: {
      isEnabled: data.enabled,
      // Atualiza enabledAt apenas quando estamos ATIVANDO (não ao desativar)
      ...(data.enabled && { enabledAt: new Date() }),
    },
    include: { module: true },
  });

  return {
    moduleName: tenantModule.module.name,
    displayName: tenantModule.module.displayName,
    isEnabled: tenantModule.isEnabled,
    tenantId: tenantModule.tenantId,
  };
}

// =============================================================================
// FUNÇÃO: getSystemStats
// =============================================================================
// O QUE FAZ:
//   Retorna estatísticas gerais do sistema para o dashboard admin.
//   Uma única função com múltiplas queries em paralelo para eficiência.
// =============================================================================
export async function getSystemStats(): Promise<{
  totalTenants: number;
  activeTenants: number;
  suspendedTenants: number;
  totalModules: number;
  tenantsByModule: Array<{
    moduleName: string;
    displayName: string;
    activeCount: number;
  }>;
}> {
  const [totalTenants, activeTenants, totalModules, moduleStats] =
    await Promise.all([
      // Quantidade total de tenants cadastrados
      prisma.tenant.count(),

      // Apenas os tenants ativos (não suspensos)
      prisma.tenant.count({ where: { isActive: true } }),

      // Quantidade de módulos disponíveis no sistema
      prisma.module.count(),

      // Agrupamento: quantos tenants têm cada módulo ATIVO
      prisma.tenantModule.groupBy({
        by: ["moduleId"],
        where: { isEnabled: true },
        _count: { moduleId: true },
      }),
    ]);

  // Busca os nomes dos módulos para enriquecer as estatísticas
  const modules = await prisma.module.findMany({
    where: {
      id: { in: moduleStats.map((s) => s.moduleId) },
    },
    select: { id: true, name: true, displayName: true },
  });

  const moduleMap = new Map(modules.map((m) => [m.id, m]));

  const tenantsByModule = moduleStats.map((stat) => {
    const mod = moduleMap.get(stat.moduleId);
    return {
      moduleName: mod?.name ?? "desconhecido",
      displayName: mod?.displayName ?? "Desconhecido",
      activeCount: stat._count.moduleId,
    };
  });

  return {
    totalTenants,
    activeTenants,
    suspendedTenants: totalTenants - activeTenants,
    totalModules,
    tenantsByModule,
  };
}
