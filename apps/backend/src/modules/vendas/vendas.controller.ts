// =============================================================================
// src/modules/vendas/vendas.controller.ts
// =============================================================================
// O QUE FAZ:
//   Handlers HTTP dos PRODUTOS de venda.
//   Valida o input (Zod), delega ao repository e formata a resposta.
//
// ROTAS QUE USA ESTE CONTROLLER:
//   GET    /vendas/produtos         → listProdutosVenda     (público)
//   GET    /vendas/produtos/admin   → listProdutosAdmin     (protegida)
//   POST   /vendas/produtos         → createProdutoVenda    (protegida)
//   PATCH  /vendas/produtos/:id     → updateProdutoVenda    (protegida)
//   DELETE /vendas/produtos/:id     → deleteProdutoVenda    (protegida)
//   POST   /vendas/produtos/:id/foto → uploadFotoProduto    (protegida)
// =============================================================================

import { FastifyRequest, FastifyReply } from "fastify";
import path from "path";
import fs from "fs";
import {
  CriarProdutoVendaSchema,
  AtualizarProdutoVendaSchema,
  ProdutoVendaParamsSchema,
  ListarProdutosVendaQuerySchema,
} from "./vendas.schema";
import * as vendasRepository from "./vendas.repository";

// Diretório onde as fotos dos produtos são salvas
const UPLOADS_DIR = path.join(__dirname, "../../../..", "uploads", "vendas");

// =============================================================================
// HANDLER: Listar Produtos (catálogo público — visitante)
// GET /vendas/produtos
// =============================================================================
export async function listProdutosVenda(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const schemaName = request.tenant!.schemaName;
  const query = ListarProdutosVendaQuerySchema.parse(request.query);

  // onlyActive = true → visitante vê apenas produtos ativos
  const result = await vendasRepository.findAllProdutosVenda(
    schemaName,
    query,
    true,
  );

  return reply.status(200).send(result);
}

// =============================================================================
// HANDLER: Listar Produtos (painel admin — vê todos, incluindo inativos)
// GET /vendas/produtos/admin
// =============================================================================
export async function listProdutosAdmin(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const schemaName = request.tenant!.schemaName;
  const query = ListarProdutosVendaQuerySchema.parse(request.query);

  // onlyActive = false → admin vê tudo
  const result = await vendasRepository.findAllProdutosVenda(
    schemaName,
    query,
    false,
  );

  return reply.status(200).send(result);
}

// =============================================================================
// HANDLER: Criar Produto
// POST /vendas/produtos
// =============================================================================
export async function createProdutoVenda(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const schemaName = request.tenant!.schemaName;

  // Valida e transforma o body com Zod
  const data = CriarProdutoVendaSchema.parse(request.body);

  const produto = await vendasRepository.createProdutoVenda(schemaName, data);

  return reply.status(201).send({
    mensagem: "Produto criado com sucesso.",
    produto,
  });
}

// =============================================================================
// HANDLER: Atualizar Produto
// PATCH /vendas/produtos/:id
// =============================================================================
export async function updateProdutoVenda(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const schemaName = request.tenant!.schemaName;
  const { id } = ProdutoVendaParamsSchema.parse(request.params);
  const data = AtualizarProdutoVendaSchema.parse(request.body);

  const produto = await vendasRepository.updateProdutoVenda(
    schemaName,
    id,
    data,
  );

  if (!produto) {
    return reply.status(404).send({
      statusCode: 404,
      error: "Não Encontrado",
      message: "Produto não encontrado.",
    });
  }

  return reply.status(200).send({ mensagem: "Produto atualizado.", produto });
}

// =============================================================================
// HANDLER: Deletar Produto
// DELETE /vendas/produtos/:id
// =============================================================================
export async function deleteProdutoVenda(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const schemaName = request.tenant!.schemaName;
  const { id } = ProdutoVendaParamsSchema.parse(request.params);

  const produto = await vendasRepository.deleteProdutoVenda(schemaName, id);

  if (!produto) {
    return reply.status(404).send({
      statusCode: 404,
      error: "Não Encontrado",
      message: "Produto não encontrado para deletar.",
    });
  }

  return reply
    .status(200)
    .send({ mensagem: "Produto deletado com sucesso.", produto });
}

// =============================================================================
// HANDLER: Upload de Foto do Produto
// POST /vendas/produtos/:id/foto
// =============================================================================
// Recebe um arquivo via multipart/form-data e salva em /uploads/vendas/.
// Atualiza o campo foto_url do produto com a URL pública do arquivo.
// =============================================================================
export async function uploadFotoProduto(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const schemaName = request.tenant!.schemaName;
  const { id } = ProdutoVendaParamsSchema.parse(request.params);

  // Verifica se o produto existe antes de salvar o arquivo
  const produtoExistente = await vendasRepository.findProdutoVendaById(
    schemaName,
    id,
  );
  if (!produtoExistente) {
    return reply.status(404).send({
      statusCode: 404,
      error: "Não Encontrado",
      message: "Produto não encontrado.",
    });
  }

  // Lê o arquivo enviado via @fastify/multipart
  const data = await request.file();

  if (!data) {
    return reply.status(400).send({
      statusCode: 400,
      error: "Bad Request",
      message: "Nenhum arquivo enviado.",
    });
  }

  // Validação do tipo MIME — apenas imagens são permitidas
  const mimeTypesPermitidos = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
  ];
  if (!mimeTypesPermitidos.includes(data.mimetype)) {
    return reply.status(400).send({
      statusCode: 400,
      error: "Bad Request",
      message:
        "Tipo de arquivo inválido. Envie uma imagem (jpeg, png, webp, gif).",
    });
  }

  // Garante que o diretório de uploads existe
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }

  // Gera nome seguro para o arquivo: {id}-{timestamp}.{ext}
  const ext = path.extname(data.filename).toLowerCase() || ".jpg";
  const nomeArquivo = `${id}-${Date.now()}${ext}`;
  const caminhoCompleto = path.join(UPLOADS_DIR, nomeArquivo);

  // Salva o arquivo em disco
  const buffer = await data.toBuffer();
  fs.writeFileSync(caminhoCompleto, buffer);

  // URL pública do arquivo (servida pelo @fastify/static com prefixo /uploads/)
  const fotoUrl = `/uploads/vendas/${nomeArquivo}`;

  const produto = await vendasRepository.updateFotoProdutoVenda(
    schemaName,
    id,
    fotoUrl,
  );

  return reply.status(200).send({
    mensagem: "Foto atualizada com sucesso.",
    foto_url: fotoUrl,
    produto,
  });
}
