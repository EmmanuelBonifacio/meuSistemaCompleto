// =============================================================================
// src/modules/estoque/estoque.routes.ts
// =============================================================================
// O QUE FAZ:
//   Registra todas as rotas do módulo de Estoque no servidor Fastify.
//   É o "cardápio" do módulo: define quais URLs existem, quais middlewares
//   cada uma usa e qual controller é responsável por cada ação.
//
// PADRÃO FASTIFY PLUGIN:
//   Usamos o sistema de plugins do Fastify (fastify.register()).
//   Cada módulo é um plugin isolado com seu próprio prefixo de URL.
//   Isso permite que os módulos sejam ativados/desativados no server.ts
//   com uma única linha.
//
// COMO ISSO AJUDA NO REAPROVEITAMENTO?
//   Para adicionar o módulo de Estoque a um novo cliente:
//   1. Provisionar o tenant com o módulo 'estoque' ativado
//   2. Este arquivo já está registrado no servidor
//   3. O requireModule('estoque') faz todo o controle de acesso
//
//   Não é necessário alterar nenhum código para servir um novo cliente.
// =============================================================================

import { FastifyInstance } from "fastify";
import { tenantMiddleware } from "../../core/middleware/tenant.middleware";
import { requireModule } from "../../core/middleware/module.middleware";
import * as estoqueController from "./estoque.controller";

// Combinação de middlewares que TODA rota deste módulo precisa.
// Definimos uma vez aqui para não repetir em cada rota (DRY - Don't Repeat Yourself).
const moduleGuard = [tenantMiddleware, requireModule("estoque")];

// =============================================================================
// PLUGIN DE ROTAS: estoqueRoutes
// =============================================================================
// Esta função é passada para `fastify.register()` no server.ts.
// O prefixo '/estoque' é definido no server.ts, não aqui.
// Aqui definimos apenas os sub-paths: /produtos, /produtos/:id, etc.
// =============================================================================
export async function estoqueRoutes(fastify: FastifyInstance) {
  // GET /estoque/produtos
  // Lista todos os produtos do tenant (com paginação e filtros)
  fastify.get("/produtos", {
    preHandler: moduleGuard,
    handler: estoqueController.listProducts,
  });

  // GET /estoque/produtos/:id
  // Busca um produto específico pelo UUID
  fastify.get<{ Params: { id: string } }>("/produtos/:id", {
    preHandler: moduleGuard,
    handler: estoqueController.getProduct,
  });

  // POST /estoque/produtos
  // Cria um novo produto
  fastify.post("/produtos", {
    preHandler: moduleGuard,
    handler: estoqueController.createProduct,
  });

  // PATCH /estoque/produtos/:id
  // Atualiza parcialmente um produto (apenas os campos enviados no body)
  fastify.patch<{ Params: { id: string } }>("/produtos/:id", {
    preHandler: moduleGuard,
    handler: estoqueController.updateProduct,
  });

  // DELETE /estoque/produtos/:id
  // Desativa um produto (soft delete)
  fastify.delete<{ Params: { id: string } }>("/produtos/:id", {
    preHandler: moduleGuard,
    handler: estoqueController.deleteProduct,
  });
}
