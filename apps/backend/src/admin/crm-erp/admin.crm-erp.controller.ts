// =============================================================================
// src/admin/crm-erp/admin.crm-erp.controller.ts
// =============================================================================
// Handlers HTTP para os endpoints de CRM e ERP do painel admin.
// =============================================================================

import { FastifyRequest, FastifyReply } from "fastify";
import path from "path";
import fs from "fs/promises";
import { randomUUID } from "crypto";
import { ZodError } from "zod";
import {
  TenantIdParamsSchema,
  PagamentoIdParamsSchema,
  ArquivoIdParamsSchema,
  ParcelaIdParamsSchema,
  UpdateCrmSchema,
  CreatePagamentoSchema,
  UpdatePagamentoSchema,
  UpdateErpSchema,
  GerarParcelasSchema,
  UpdateParcelaSchema,
} from "./admin.crm-erp.schema";
import {
  getCrm,
  updateCrm,
  listPagamentos,
  createPagamento,
  deletePagamento,
  updatePagamento,
  listArquivos,
  createArquivo,
  findArquivo,
  deleteArquivo,
  getErpConfig,
  updateErpConfig,
  listParcelas,
  gerarParcelas,
  updateParcela,
} from "./admin.crm-erp.repository";
import { prisma } from "../../core/database/prisma";

// Tamanho máximo para upload de arquivos CRM: 50MB
const MAX_CRM_FILE_BYTES = 50 * 1024 * 1024;

// MIME types aceitos para arquivos CRM
const ALLOWED_MIME_PREFIXES = ["image/", "video/", "application/pdf"];

function isMimeAllowed(mime: string): boolean {
  return ALLOWED_MIME_PREFIXES.some((prefix) => mime.startsWith(prefix));
}

// Recupera slug do tenant pelo ID (necessário para determinar o path do upload)
async function getTenantSlug(tenantId: string): Promise<string | null> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { slug: true },
  });
  return tenant?.slug ?? null;
}

// Caminho raiz do volume de uploads
const UPLOADS_ROOT = path.resolve(process.cwd(), "..", "..", "uploads");

// =============================================================================
// CRM — Dados do cliente
// =============================================================================

export async function getCrmHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { tenantId } = TenantIdParamsSchema.parse(request.params);
  const crm = await getCrm(tenantId);
  reply.status(200).send(crm);
}

export async function updateCrmHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { tenantId } = TenantIdParamsSchema.parse(request.params);
  const body = UpdateCrmSchema.parse(request.body);
  const crm = await updateCrm(tenantId, body);
  reply.status(200).send(crm);
}

// =============================================================================
// Pagamentos
// =============================================================================

export async function listPagamentosHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { tenantId } = TenantIdParamsSchema.parse(request.params);
  const pagamentos = await listPagamentos(tenantId);
  reply.status(200).send(pagamentos);
}

export async function createPagamentoHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { tenantId } = TenantIdParamsSchema.parse(request.params);
  const body = CreatePagamentoSchema.parse(request.body);
  const pagamento = await createPagamento(tenantId, body);
  reply.status(201).send(pagamento);
}

export async function deletePagamentoHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { tenantId, pagamentoId } = PagamentoIdParamsSchema.parse(
    request.params,
  );
  const deleted = await deletePagamento(tenantId, pagamentoId);
  if (!deleted) {
    return reply.status(404).send({
      statusCode: 404,
      error: "Não Encontrado",
      message: "Pagamento não encontrado.",
    });
  }
  reply.status(200).send({ message: "Pagamento excluído com sucesso." });
}

export async function updatePagamentoHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { tenantId, pagamentoId } = PagamentoIdParamsSchema.parse(
    request.params,
  );
  const body = UpdatePagamentoSchema.parse(request.body);
  const updated = await updatePagamento(tenantId, pagamentoId, body);
  if (!updated) {
    return reply.status(404).send({
      statusCode: 404,
      error: "Não Encontrado",
      message: "Pagamento não encontrado.",
    });
  }
  reply.status(200).send(updated);
}

export async function listArquivosHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { tenantId } = TenantIdParamsSchema.parse(request.params);
  const arquivos = await listArquivos(tenantId);
  const serialized = arquivos.map((a) => ({
    ...a,
    tamanhoBytes: a.tamanhoBytes?.toString() ?? null,
  }));
  reply.status(200).send(serialized);
}

export async function uploadArquivoHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { tenantId } = TenantIdParamsSchema.parse(request.params);

  const slug = await getTenantSlug(tenantId);
  if (!slug) {
    return reply.status(404).send({
      statusCode: 404,
      error: "Não Encontrado",
      message: "Tenant não encontrado.",
    });
  }

  // Lê o arquivo via @fastify/multipart
  const data = await request.file();
  if (!data) {
    return reply.status(400).send({
      statusCode: 400,
      error: "Bad Request",
      message: "Nenhum arquivo enviado.",
    });
  }

  const mimeType = data.mimetype;
  if (!isMimeAllowed(mimeType)) {
    return reply.status(400).send({
      statusCode: 400,
      error: "Bad Request",
      message:
        "Tipo de arquivo não permitido. Aceitos: imagens, vídeos e PDFs.",
    });
  }

  // Lê o conteúdo e verifica o tamanho
  const chunks: Buffer[] = [];
  for await (const chunk of data.file) {
    chunks.push(chunk as Buffer);
  }
  const fileBuffer = Buffer.concat(chunks);

  if (fileBuffer.byteLength > MAX_CRM_FILE_BYTES) {
    return reply.status(400).send({
      statusCode: 400,
      error: "Bad Request",
      message: "Arquivo muito grande. Limite: 50MB.",
    });
  }

  // Determina extensão a partir do nome original ou MIME
  const ext = path.extname(data.filename) || "";
  const uniqueName = `${randomUUID()}${ext}`;
  const relativePath = path.join(slug, "crm", uniqueName);
  const fullPath = path.join(UPLOADS_ROOT, relativePath);

  // Garante que o diretório existe
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, fileBuffer);

  const arquivo = await createArquivo(tenantId, {
    nomeOriginal: data.filename,
    caminho: relativePath.replace(/\\/g, "/"),
    mimeType,
    tamanhoBytes: fileBuffer.byteLength,
  });

  reply.status(201).send({
    ...arquivo,
    tamanhoBytes: arquivo.tamanhoBytes?.toString() ?? null,
  });
}

export async function deleteArquivoHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { tenantId, arquivoId } = ArquivoIdParamsSchema.parse(request.params);

  const arquivo = await findArquivo(tenantId, arquivoId);
  if (!arquivo) {
    return reply.status(404).send({
      statusCode: 404,
      error: "Não Encontrado",
      message: "Arquivo não encontrado.",
    });
  }

  // Remove do disco
  const fullPath = path.join(UPLOADS_ROOT, arquivo.caminho);
  try {
    await fs.unlink(fullPath);
  } catch {
    // Se o arquivo não existir no disco, prossegue para remover do banco
  }

  await deleteArquivo(tenantId, arquivoId);
  reply.status(200).send({ message: "Arquivo excluído com sucesso." });
}

// =============================================================================
// ERP
// =============================================================================

export async function getErpHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { tenantId } = TenantIdParamsSchema.parse(request.params);
  const erp = await getErpConfig(tenantId);
  reply.status(200).send(erp);
}

export async function updateErpHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { tenantId } = TenantIdParamsSchema.parse(request.params);
  const body = UpdateErpSchema.parse(request.body);
  const erp = await updateErpConfig(tenantId, body);
  reply.status(200).send(erp);
}

// =============================================================================
// ERP — Parcelas
// =============================================================================

export async function listParcelasHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { tenantId } = TenantIdParamsSchema.parse(request.params);
  const parcelas = await listParcelas(tenantId);
  const serialized = parcelas.map((p) => ({
    ...p,
    valor: p.valor.toString(),
    vencimento:
      p.vencimento instanceof Date
        ? p.vencimento.toISOString().slice(0, 10)
        : p.vencimento,
  }));
  reply.status(200).send(serialized);
}

export async function gerarParcelasHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { tenantId } = TenantIdParamsSchema.parse(request.params);
  const body = GerarParcelasSchema.parse(request.body);
  const parcelas = await gerarParcelas(tenantId, body);
  const serialized = parcelas.map((p) => ({
    ...p,
    valor: p.valor.toString(),
    vencimento:
      p.vencimento instanceof Date
        ? p.vencimento.toISOString().slice(0, 10)
        : p.vencimento,
  }));
  reply.status(201).send(serialized);
}

export async function updateParcelaHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { tenantId, parcelaId } = ParcelaIdParamsSchema.parse(request.params);
  const body = UpdateParcelaSchema.parse(request.body);
  const updated = await updateParcela(tenantId, parcelaId, body);
  if (!updated) {
    return reply.status(404).send({
      statusCode: 404,
      error: "Não Encontrado",
      message: "Parcela não encontrada.",
    });
  }
  reply.status(200).send({
    ...updated,
    valor: updated.valor.toString(),
    vencimento:
      updated.vencimento instanceof Date
        ? updated.vencimento.toISOString().slice(0, 10)
        : updated.vencimento,
  });
}
