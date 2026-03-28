// =============================================================================
// src/modules/estoque/estoque.controller.ts
// =============================================================================
// O QUE FAZ:
//   É o "garçom" do módulo. Recebe as requisições HTTP, valida os dados
//   de entrada com Zod, delega o trabalho ao Repository e formata a resposta.
//
// RESPONSABILIDADES DO CONTROLLER (e o que ele NÃO deve fazer):
//   ✅ Extrair dados do request (body, params, query)
//   ✅ Validar os dados com os schemas Zod
//   ✅ Chamar o Repository passando os dados limpos
//   ✅ Formatar e enviar a resposta HTTP
//   ❌ Não deve ter lógica de negócio (isso fica no Service/Repository)
//   ❌ Não deve escrever SQL (isso fica no Repository)
//
// COMO O ISOLAMENTO DE TENANT FUNCIONA AQUI:
//   O controller recebe `request.tenant.schemaName` do tenantMiddleware.
//   Passa esse valor para CADA chamada do repository.
//   O repository então usa `withTenantSchema(schemaName, ...)` para
//   executar as queries NO SCHEMA CORRETO.
//
//   Resultado: A mesma função `findAllProducts` serve para TODOS os tenants.
//   Com "tenant_acme", busca em "tenant_acme.products".
//   Com "tenant_foobar", busca em "tenant_foobar.products".
//   100% de reaproveitamento de código com 100% de isolamento de dados. ✅
// =============================================================================

import { FastifyRequest, FastifyReply } from "fastify";
import {
  CreateProductSchema,
  UpdateProductSchema,
  ProductParamsSchema,
  ListProductsQuerySchema,
} from "./estoque.schema";
import * as estoqueRepository from "./estoque.repository";

// =============================================================================
// HANDLER: Listar Produtos
// GET /estoque/produtos
// =============================================================================
export async function listProducts(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  // O operador `!` (non-null assertion) é seguro aqui porque este handler
  // só é registrado com o tenantMiddleware no preHandler.
  const schemaName = request.tenant!.schemaName;

  // Valida e converte os query params (page, limit, search, onlyActive)
  const query = ListProductsQuerySchema.parse(request.query);

  const result = await estoqueRepository.findAllProducts(schemaName, query);

  return reply.status(200).send(result);
}

// =============================================================================
// HANDLER: Buscar Produto por ID
// GET /estoque/produtos/:id
// =============================================================================
export async function getProduct(request: FastifyRequest, reply: FastifyReply) {
  const schemaName = request.tenant!.schemaName;

  // Valida que o `id` é um UUID válido. Previne queries com IDs malformados.
  const { id } = ProductParamsSchema.parse(request.params);

  const product = await estoqueRepository.findProductById(schemaName, id);

  if (!product) {
    return reply.status(404).send({
      statusCode: 404,
      error: "Não Encontrado",
      message: "Produto não encontrado.",
    });
  }

  return reply.status(200).send(product);
}

// =============================================================================
// HANDLER: Criar Produto
// POST /estoque/produtos
// =============================================================================
export async function createProduct(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const schemaName = request.tenant!.schemaName;

  // Valida o body completo. Se inválido, Zod lança ZodError com detalhes.
  // O Fastify captura o erro e retorna 400 automaticamente (configurado no server.ts).
  const data = CreateProductSchema.parse(request.body);

  const product = await estoqueRepository.createProduct(schemaName, data);

  // 201 Created: convenção HTTP para recursos criados com sucesso
  return reply.status(201).send(product);
}

// =============================================================================
// HANDLER: Atualizar Produto
// PATCH /estoque/produtos/:id
// =============================================================================
export async function updateProduct(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const schemaName = request.tenant!.schemaName;

  const { id } = ProductParamsSchema.parse(request.params);
  const data = UpdateProductSchema.parse(request.body);

  const product = await estoqueRepository.updateProduct(schemaName, id, data);

  if (!product) {
    return reply.status(404).send({
      statusCode: 404,
      error: "Não Encontrado",
      message: "Produto não encontrado.",
    });
  }

  return reply.status(200).send(product);
}

// =============================================================================
// HANDLER: Deletar Produto (soft delete)
// DELETE /estoque/produtos/:id
// =============================================================================
export async function deleteProduct(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const schemaName = request.tenant!.schemaName;

  const { id } = ProductParamsSchema.parse(request.params);

  const deleted = await estoqueRepository.deleteProduct(schemaName, id);

  if (!deleted) {
    return reply.status(404).send({
      statusCode: 404,
      error: "Não Encontrado",
      message: "Produto não encontrado ou já desativado.",
    });
  }

  // 204 No Content: convenção HTTP para deleção bem-sucedida sem body de resposta
  return reply.status(204).send();
}
