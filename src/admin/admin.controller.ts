// =============================================================================
// src/admin/admin.controller.ts
// =============================================================================
// O QUE FAZ:
//   Camada de apresentação (HTTP) do painel admin.
//   Recebe o FastifyRequest, valida os dados com Zod, chama o repository
//   e retorna respostas HTTP padronizadas.
//
// RESPONSABILIDADES DESTE ARQUIVO:
//   ✅ Validar e parsear o input (body, params, query) com Zod
//   ✅ Chamar as funções certas do repository
//   ✅ Formatar a resposta HTTP (status codes, mensagens claras)
//   ✅ Tratar erros de forma diferenciada (404, 409 conflito, etc.)
//
// NÃO É RESPONSABILIDADE DESTE ARQUIVO:
//   ❌ Fazer queries SQL/Prisma diretamente (isso é do repository)
//   ❌ Registrar rotas no Fastify (isso é do routes.ts)
//   ❌ Verificar autenticação/autorização (isso é do middleware)
// =============================================================================

import { FastifyRequest, FastifyReply } from "fastify";
import { provisionNewTenant } from "../core/tenant/tenant.provisioner";
import {
  findAllTenantsAdmin,
  findTenantByIdAdmin,
  suspendTenant,
  reactivateTenant,
  toggleTenantModule,
  getSystemStats,
} from "./admin.repository";
import {
  AdminCreateTenantSchema,
  AdminTenantParamsSchema,
  AdminToggleModuleSchema,
  AdminListTenantsQuerySchema,
} from "./admin.schema";

// =============================================================================
// HANDLER: listTenants
// =============================================================================
// ROTA: GET /admin/tenants
// O QUE FAZ: Lista todos os clientes com paginação, filtros e módulos ativos.
// =============================================================================
export async function listTenants(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  // Valida e transforma os query params (page, limit, search, active)
  const query = AdminListTenantsQuerySchema.parse(request.query);

  const result = await findAllTenantsAdmin(query);
  reply.status(200).send(result);
}

// =============================================================================
// HANDLER: getTenant
// =============================================================================
// ROTA: GET /admin/tenants/:id
// O QUE FAZ: Retorna os detalhes completos de um tenant específico.
// =============================================================================
export async function getTenant(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { id } = AdminTenantParamsSchema.parse(request.params);

  const tenant = await findTenantByIdAdmin(id);

  if (!tenant) {
    return reply.status(404).send({
      statusCode: 404,
      error: "Não Encontrado",
      message: `Tenant com ID "${id}" não encontrado.`,
    });
  }

  reply.status(200).send(tenant);
}

// =============================================================================
// HANDLER: createTenant
// =============================================================================
// ROTA: POST /admin/tenants
// O QUE FAZ:
//   Cria um novo tenant COM provisionamento automático:
//   - Valida os dados de entrada
//   - Verifica se o slug já está em uso (409 Conflict com mensagem amigável)
//   - Gera o schemaName a partir do slug
//   - Chama o provisionNewTenant() que faz TUDO em uma transação:
//     * Cria o schema PostgreSQL
//     * Cria as tabelas do módulo
//     * Insere na tabela public.tenants
//     * Ativa os módulos informados
//
// POR QUE REUTILIZAR provisionNewTenant() E NÃO DUPLICAR A LÓGICA?
//   DRY (Don't Repeat Yourself): a lógica de provisionamento já existe e foi
//   testada. O controller admin apenas orquestra — não reimplementa.
// =============================================================================
export async function createTenant(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const data = AdminCreateTenantSchema.parse(request.body);

  // Gera o nome do schema PostgreSQL a partir do slug
  // Regra: "minha-empresa" → "tenant_minha_empresa"
  // Hífens viram underscores pois PostgreSQL aceita hífens em schema names
  // apenas com aspas — usar underscores é mais seguro e convencional.
  const schemaName = `tenant_${data.slug.replace(/-/g, "_")}`;

  let tenant;
  try {
    tenant = await provisionNewTenant({
      name: data.name,
      slug: data.slug,
      schemaName,
      moduleNames: data.moduleNames,
    });
  } catch (error: unknown) {
    // Trata violação de unique constraint no slug (erro Prisma P2002)
    // Isso acontece se outro admin tentar criar um tenant com o mesmo slug
    // ao mesmo tempo (race condition) ou se o slug já existir.
    if (
      error instanceof Error &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "P2002"
    ) {
      return reply.status(409).send({
        statusCode: 409,
        error: "Conflito",
        message: `O slug "${data.slug}" já está em uso por outro tenant. Escolha um slug diferente.`,
      });
    }
    // Outros erros (ex: conexão com DB) são relançados para o Fastify tratar como 500
    throw error;
  }

  reply.status(201).send({
    mensagem: `Tenant "${data.name}" criado e provisionado com sucesso!`,
    tenant,
    proximoPasso: `Para gerar um token de teste: POST /dev/token com { "tenantId": "${tenant.id}" }`,
  });
}

// =============================================================================
// HANDLER: suspendTenantHandler
// =============================================================================
// ROTA: PATCH /admin/tenants/:id/suspend
// O QUE FAZ:
//   Suspende o acesso de um tenant (isActive = false).
//   O bloqueio é IMEDIATO: o tenantMiddleware verifica isActive a cada request.
//
// PROTEÇÃO CONTRA SUSPENDER MÚLTIPLAS VEZES:
//   Se o tenant já está suspenso, retornamos 409 com mensagem informativa
//   em vez de fazer um UPDATE desnecessário no banco.
// =============================================================================
export async function suspendTenantHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { id } = AdminTenantParamsSchema.parse(request.params);

  // Busca o tenant para verificar se existe e se já está suspenso
  const tenant = await findTenantByIdAdmin(id);

  if (!tenant) {
    return reply.status(404).send({
      statusCode: 404,
      error: "Não Encontrado",
      message: `Tenant com ID "${id}" não encontrado.`,
    });
  }

  if (!tenant.isActive) {
    return reply.status(409).send({
      statusCode: 409,
      error: "Conflito",
      message: `O tenant "${tenant.name}" já está suspenso.`,
    });
  }

  const result = await suspendTenant(id);

  request.log.warn(
    `[Admin] ⚠️ Tenant "${tenant.name}" (${tenant.slug}) SUSPENSO por admin: ${request.user.sub}`,
  );

  reply.status(200).send({
    mensagem: `Tenant "${tenant.name}" foi suspenso com sucesso.`,
    aviso:
      "O acesso deste tenant foi bloqueado imediatamente. Todos os tokens JWT ativos deles retornarão 403.",
    tenant: {
      id: result.id,
      isActive: result.isActive,
      updatedAt: result.updatedAt,
    },
  });
}

// =============================================================================
// HANDLER: reactivateTenantHandler
// =============================================================================
// ROTA: PATCH /admin/tenants/:id/reactivate
// O QUE FAZ: Restaura o acesso de um tenant suspenso (isActive = true).
// =============================================================================
export async function reactivateTenantHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { id } = AdminTenantParamsSchema.parse(request.params);

  const tenant = await findTenantByIdAdmin(id);

  if (!tenant) {
    return reply.status(404).send({
      statusCode: 404,
      error: "Não Encontrado",
      message: `Tenant com ID "${id}" não encontrado.`,
    });
  }

  if (tenant.isActive) {
    return reply.status(409).send({
      statusCode: 409,
      error: "Conflito",
      message: `O tenant "${tenant.name}" já está ativo.`,
    });
  }

  const result = await reactivateTenant(id);

  request.log.info(
    `[Admin] ✅ Tenant "${tenant.name}" (${tenant.slug}) REATIVADO por admin: ${request.user.sub}`,
  );

  reply.status(200).send({
    mensagem: `Tenant "${tenant.name}" foi reativado com sucesso.`,
    tenant: {
      id: result.id,
      isActive: result.isActive,
      updatedAt: result.updatedAt,
    },
  });
}

// =============================================================================
// HANDLER: toggleModuleHandler
// =============================================================================
// ROTA: PATCH /admin/tenants/:id/modules
// O QUE FAZ:
//   Liga ou desliga um módulo para um tenant específico em tempo real.
//
// EXEMPLO DE USO:
//   Body: { "moduleName": "financeiro", "enabled": false }
//   → Desliga o módulo financeiro para o tenant :id
//   → Próximas requisições desse tenant a /financeiro/* retornam 403
//
//   Body: { "moduleName": "vendas", "enabled": true }
//   → Liga o módulo de vendas para o tenant :id
//   → Tenant passa a ter acesso a /vendas/* imediatamente
// =============================================================================
export async function toggleModuleHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { id } = AdminTenantParamsSchema.parse(request.params);
  const data = AdminToggleModuleSchema.parse(request.body);

  // Verifica se o tenant existe antes de tentar alterar módulos
  const tenant = await findTenantByIdAdmin(id);

  if (!tenant) {
    return reply.status(404).send({
      statusCode: 404,
      error: "Não Encontrado",
      message: `Tenant com ID "${id}" não encontrado.`,
    });
  }

  let result;
  try {
    result = await toggleTenantModule(id, data);
  } catch (error: unknown) {
    // Trata o caso do módulo não existir no sistema (lançado pelo repository)
    if (
      error instanceof Error &&
      (error as NodeJS.ErrnoException).code === "MODULE_NOT_FOUND"
    ) {
      return reply.status(404).send({
        statusCode: 404,
        error: "Não Encontrado",
        message: error.message,
        dica: "Módulos disponíveis: estoque, financeiro, vendas, rh",
      });
    }
    throw error;
  }

  const acao = data.enabled ? "ATIVADO" : "DESATIVADO";
  request.log.info(
    `[Admin] 🔧 Módulo "${data.moduleName}" ${acao} para tenant "${tenant.name}" por admin: ${request.user.sub}`,
  );

  reply.status(200).send({
    mensagem: `Módulo "${result.displayName}" ${data.enabled ? "ativado" : "desativado"} para o tenant "${tenant.name}".`,
    efeito: data.enabled
      ? `O tenant "${tenant.slug}" agora tem acesso ao módulo "${data.moduleName}".`
      : `O tenant "${tenant.slug}" não tem mais acesso ao módulo "${data.moduleName}". Requisições retornarão 403.`,
    modulo: result,
  });
}

// =============================================================================
// HANDLER: getStatsHandler
// =============================================================================
// ROTA: GET /admin/stats
// O QUE FAZ: Retorna métricas gerais do sistema para o dashboard admin.
// =============================================================================
export async function getStatsHandler(
  _request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const stats = await getSystemStats();
  reply.status(200).send(stats);
}
