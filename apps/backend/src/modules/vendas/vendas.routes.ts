// =============================================================================
// src/modules/vendas/vendas.routes.ts
// =============================================================================
// O QUE FAZ:
//   Registra todas as rotas do módulo SalesWpp como um plugin Fastify.
//   O prefixo /vendas é definido no server.ts.
//
// DIVISÃO DE ACESSO:
//   Rotas PÚBLICAS (sem tenantMiddleware):
//     GET  /vendas/produtos            → catálogo para visitantes
//     POST /vendas/pedidos             → registrar pedido ao clicar no WA
//     POST /vendas/webhook/whatsapp    → webhook Evolution API
//
//   Rotas PROTEGIDAS (com tenantMiddleware + requireModule):
//     GET    /vendas/produtos/admin    → lista completa para o admin
//     POST   /vendas/produtos          → criar produto
//     PATCH  /vendas/produtos/:id      → editar produto
//     DELETE /vendas/produtos/:id      → deletar produto
//     POST   /vendas/produtos/:id/foto → upload de foto
//     GET    /vendas/pedidos           → lista de pedidos (admin)
//     PATCH  /vendas/pedidos/:id       → atualizar pedido (admin)
//     GET    /vendas/resumo            → métricas do dashboard
// =============================================================================

import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { tenantMiddleware } from "../../core/middleware/tenant.middleware";
import { requireModule } from "../../core/middleware/module.middleware";
import * as vendasController from "./vendas.controller";
import * as pedidosController from "./vendas.pedidos.controller";
import { prisma } from "../../core/database/prisma";

// Guard reutilizável para todas as rotas protegidas do módulo vendas
const moduleGuard = [tenantMiddleware, requireModule("vendas")];

// =============================================================================
// MIDDLEWARE: publicTenantResolver
// =============================================================================
// Resolve o tenant pelo query param ?slug= sem exigir JWT.
// Usado nas rotas públicas do catálogo (catálogo + criar pedido).
async function publicTenantResolver(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { slug } = request.query as { slug?: string };
  if (!slug) {
    return reply.status(400).send({
      statusCode: 400,
      error: "Bad Request",
      message: "O parâmetro 'slug' é obrigatório para acessar o catálogo.",
    });
  }
  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      schemaName: true,
      isActive: true,
    },
  });
  if (!tenant) {
    return reply.status(404).send({
      statusCode: 404,
      error: "Não Encontrado",
      message: "Cliente não encontrado.",
    });
  }
  if (!tenant.isActive) {
    return reply.status(403).send({
      statusCode: 403,
      error: "Acesso Negado",
      message: "Esta conta está suspensa.",
    });
  }
  request.tenant = tenant;
}

// =============================================================================
// MIDDLEWARE: publicOrTenantResolver
// =============================================================================
// Resolver combinado para a rota GET /vendas/config:
//   - Se houver Authorization JWT → resolve tenant pelo token (admin logado)
//   - Caso contrário                → usa publicTenantResolver (?slug= obrigatório)
async function publicOrTenantResolver(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const auth = request.headers.authorization;
  if (auth && auth.startsWith("Bearer ")) {
    return tenantMiddleware(request, reply);
  }
  return publicTenantResolver(request, reply);
}

// =============================================================================
// PLUGIN: vendasRoutes
// =============================================================================
export async function vendasRoutes(fastify: FastifyInstance) {
  // ==========================================================================
  // ROTAS PÚBLICAS — acessíveis por qualquer visitante sem autenticação
  // Requerem o query param ?slug= para identificar o tenant.
  // ==========================================================================

  // GET /vendas/produtos?slug=<tenant-slug>
  // Catálogo público de produtos — usado na página de vendas visível ao cliente
  fastify.get("/produtos", {
    preHandler: [publicTenantResolver],
    handler: vendasController.listProdutosVenda,
  });

  // POST /vendas/pedidos?slug=<tenant-slug>
  // Registra o pedido quando o visitante clica em "Finalizar no WhatsApp"
  fastify.post("/pedidos", {
    preHandler: [publicTenantResolver],
    handler: pedidosController.createPedidoVenda,
  });

  // POST /vendas/webhook/whatsapp
  // Endpoint chamado pela Evolution API para cada mensagem recebida
  // NOTA: esta rota NÃO usa tenantMiddleware pois a Evolution API não envia JWT.
  // Proteja com um token fixo no header se necessário (EVOLUTION_WEBHOOK_TOKEN).
  fastify.post("/webhook/whatsapp", {
    handler: pedidosController.webhookWhatsApp,
  });

  // ==========================================================================
  // ROTAS PROTEGIDAS — exigem JWT válido do tenant + módulo "vendas" ativo
  // ==========================================================================

  // GET /vendas/produtos/admin
  // Lista todos os produtos (incluindo inativos) — para o painel admin
  // IMPORTANTE: deve ser registrada ANTES de /produtos/:id para não confundir
  // o roteador do Fastify ("admin" pode ser interpretado como um :id)
  fastify.get("/produtos/admin", {
    preHandler: moduleGuard,
    handler: vendasController.listProdutosAdmin,
  });

  // POST /vendas/produtos
  // Cria um novo produto de venda
  fastify.post("/produtos", {
    preHandler: moduleGuard,
    handler: vendasController.createProdutoVenda,
  });

  // PATCH /vendas/produtos/:id
  // Atualiza parcialmente um produto (apenas os campos enviados)
  fastify.patch<{ Params: { id: string } }>("/produtos/:id", {
    preHandler: moduleGuard,
    handler: vendasController.updateProdutoVenda,
  });

  // DELETE /vendas/produtos/:id
  // Remove um produto permanentemente
  fastify.delete<{ Params: { id: string } }>("/produtos/:id", {
    preHandler: moduleGuard,
    handler: vendasController.deleteProdutoVenda,
  });

  // POST /vendas/produtos/:id/foto
  // Upload da foto do produto (multipart/form-data)
  fastify.post<{ Params: { id: string } }>("/produtos/:id/foto", {
    preHandler: moduleGuard,
    handler: vendasController.uploadFotoProduto,
  });

  // GET /vendas/pedidos
  // Lista todos os pedidos do tenant para o painel admin
  fastify.get("/pedidos", {
    preHandler: moduleGuard,
    handler: pedidosController.listPedidosVenda,
  });

  // PATCH /vendas/pedidos/:id
  // Atualiza status e notas de um pedido (marcar como pago, enviado, etc.)
  fastify.patch<{ Params: { id: string } }>("/pedidos/:id", {
    preHandler: moduleGuard,
    handler: pedidosController.updatePedidoVenda,
  });

  // GET /vendas/resumo
  // Retorna métricas para o dashboard admin (totais, por status)
  fastify.get("/resumo", {
    preHandler: moduleGuard,
    handler: pedidosController.getResumoVendas,
  });

  // GET /vendas/config?slug=<tenant-slug>
  // Retorna as configurações públicas da loja (ex: número do WhatsApp).
  // Suporta dois modos:
  //   - Com Authorization JWT  → resolve tenant pelo token (admin logado)
  //   - Sem Authorization + ?slug= → resolve pelo slug (catálogo público)
  fastify.get("/config", {
    preHandler: [publicOrTenantResolver],
    handler: vendasController.getVendasConfig,
  });

  // PUT /vendas/config
  // Atualiza as configurações da loja (protegido — apenas admin do tenant)
  fastify.put("/config", {
    preHandler: moduleGuard,
    handler: vendasController.updateVendasConfig,
  });

  // POST /vendas/config/logo
  // Upload da logo da loja (multipart/form-data)
  fastify.post("/config/logo", {
    preHandler: moduleGuard,
    handler: vendasController.uploadLogoVendas,
  });

  // DELETE /vendas/config/logo
  // Remove a logo da loja
  fastify.delete("/config/logo", {
    preHandler: moduleGuard,
    handler: vendasController.removeLogoVendas,
  });
}
