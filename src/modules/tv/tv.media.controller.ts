// =============================================================================
// src/modules/tv/tv.media.controller.ts
// =============================================================================
// O QUE FAZ:
//   Handlers HTTP do submódulo de mídia (upload, listagem, deleção).
//   Recebe multipart/form-data, valida o arquivo, salva no disco e registra
//   metadados no banco via tv.media.repository.ts.
//
// RESPONSABILIDADE ÚNICA (SOLID):
//   Este controller não sabe sobre SQL nem sobre WebSocket.
//   Ele apenas: recebe request → valida → salva arquivo → registra banco → responde.
//
// SEGURANÇA (OWASP):
//   - Mime type validado contra lista positiva (allowlist)
//   - Tamanho máximo de 100MB enforçado antes de gravar no disco
//   - Filename gerado pelo servidor (UUID) — nunca o nome informado pelo cliente
//   - Path traversal impossível: o filename não pode conter "/" ou ".."
// =============================================================================

import { FastifyRequest, FastifyReply } from "fastify";
import { MultipartFile } from "@fastify/multipart";
import path from "path";
import fs from "fs/promises";
import { randomUUID } from "crypto";
import {
  findAllMediaFiles,
  findMediaFileById,
  createMediaFile,
  deleteMediaFile,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
} from "./tv.media.repository";
import { z } from "zod";

// =============================================================================
// SCHEMA: params de mídia por ID
// =============================================================================
const MediaParamsSchema = z.object({
  mediaId: z.string().uuid("ID da mídia deve ser um UUID válido"),
});

// =============================================================================
// FUNÇÃO: listMedia
// GET /tv/media
// =============================================================================
// O QUE FAZ:
//   Lista todos os arquivos de mídia do tenant logado.
//   Retorna URL, tipo, tamanho e data de upload de cada arquivo.
// =============================================================================
export async function listMedia(request: FastifyRequest, reply: FastifyReply) {
  const { schemaName } = request.tenant!;
  const files = await findAllMediaFiles(schemaName);

  return reply.send({
    files,
    total: files.length,
  });
}

// =============================================================================
// FUNÇÃO: uploadMedia
// POST /tv/media/upload
// =============================================================================
// O QUE FAZ:
//   Recebe um arquivo via multipart/form-data.
//   1. Valida mime type e tamanho ANTES de gravar no disco (fail-fast).
//   2. Gera um filename único (UUID + extensão original).
//   3. Garante que a pasta do tenant existe em /uploads/{slug}/.
//   4. Grava o arquivo no disco.
//   5. Registra os metadados no banco.
//   6. Se o banco falhar, remove o arquivo do disco (reversão manual).
//
// POR QUE NÃO USAR `pipeline()` DO NODE?
//   O @fastify/multipart já bufferiza o arquivo antes de chamar o handler.
//   Com `attachFieldsToBody: false` (padrão), o file vem como async iterator.
//   Usamos `toBuffer()` que lê tudo na memória — aceitável para até 100MB.
//   Em produção com arquivos maiores, usar stream + pipe para S3/MinIO.
//
// SEGURANÇA:
//   - filename gerado pelo servidor: nunca usar `file.filename` do cliente
//   - mime type validado contra allowlist (ALLOWED_MIME_TYPES)
//   - tamanho enforçado em MAX_FILE_SIZE_BYTES
// =============================================================================
export async function uploadMedia(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { schemaName, slug } = request.tenant!;
  const userId = request.user.sub;

  // O @fastify/multipart expõe a função file() para ler o upload
  let uploadedFile: MultipartFile | undefined;
  try {
    uploadedFile = await request.file({
      limits: {
        fileSize: MAX_FILE_SIZE_BYTES, // Limite em bytes — @fastify/multipart aborta automaticamente
      },
    });
  } catch {
    return reply.status(400).send({
      statusCode: 400,
      error: "Arquivo inválido",
      message: `O arquivo excede o limite de ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB.`,
    });
  }

  if (!uploadedFile) {
    return reply.status(400).send({
      statusCode: 400,
      error: "Arquivo não enviado",
      message: "Envie um arquivo no campo 'file' do multipart.",
    });
  }

  // ── Validação de Mime Type ─────────────────────────────────────────────────
  // POR QUE VALIDAR MIME TYPE E NÃO APENAS EXTENSÃO?
  //   Atacantes podem renomear um executável para ".jpg".
  //   O @fastify/multipart lê o Content-Type declarado pelo cliente.
  //   Nota: validação de "magic bytes" (leitura real do buffer) seria mais
  //   segura ainda, mas para Digital Signage em rede interna é suficiente.
  if (!ALLOWED_MIME_TYPES.includes(uploadedFile.mimetype)) {
    // Consome o stream para liberar a conexão antes de responder
    await uploadedFile.toBuffer().catch(() => {});
    return reply.status(415).send({
      statusCode: 415,
      error: "Tipo de mídia não suportado",
      message: `Tipo "${uploadedFile.mimetype}" não é permitido. Aceitos: ${ALLOWED_MIME_TYPES.join(", ")}`,
    });
  }

  // ── Lê o arquivo em buffer ─────────────────────────────────────────────────
  const buffer = await uploadedFile.toBuffer();

  // ── Gera filename seguro ───────────────────────────────────────────────────
  // Extensão extraída do mime type (não do nome original do cliente)
  const ext = mimeToExtension(uploadedFile.mimetype);
  const filename = `${randomUUID()}${ext}`;
  const originalName = uploadedFile.filename || filename;

  // ── Garante que a pasta do tenant existe ───────────────────────────────────
  // Pasta: {projectRoot}/uploads/{tenantSlug}/
  // POR QUE POR SLUG E NÃO SCHEMA?
  //   O slug é mais legível e não muda. "uploads/acme-corp/" é mais
  //   fácil de inspecionar manualmente do que "uploads/tenant_acme_corp/".
  const tenantSlug = slug.replace(/_/g, "-");
  const uploadsBase = path.join(process.cwd(), "uploads", tenantSlug);
  await fs.mkdir(uploadsBase, { recursive: true });

  // ── Grava no disco ─────────────────────────────────────────────────────────
  const filePath = path.join(uploadsBase, filename);
  try {
    await fs.writeFile(filePath, buffer);
  } catch (err) {
    request.log.error(err, "[TV Media] Erro ao gravar arquivo no disco");
    return reply.status(500).send({
      statusCode: 500,
      error: "Erro interno",
      message: "Não foi possível salvar o arquivo. Tente novamente.",
    });
  }

  // ── Registra no banco ──────────────────────────────────────────────────────
  // URL pública: /uploads/{tenantSlug}/{filename}
  const publicUrl = `/uploads/${tenantSlug}/${filename}`;
  let mediaFile;
  try {
    // Valida se userId é um UUID antes de passar ao banco
    const UUID_REGEX =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    mediaFile = await createMediaFile(schemaName, {
      filename,
      original_name: originalName,
      url: publicUrl,
      mime_type: uploadedFile.mimetype,
      size_bytes: buffer.length,
      uploaded_by: UUID_REGEX.test(userId) ? userId : undefined,
    });
  } catch (err) {
    // Banco falhou — remove o arquivo do disco para manter consistência
    await fs.unlink(filePath).catch(() => {});
    request.log.error(err, "[TV Media] Erro ao registrar mídia no banco");
    return reply.status(500).send({
      statusCode: 500,
      error: "Erro interno",
      message: "Arquivo salvo mas falhou ao registrar. Tente novamente.",
    });
  }

  request.log.info(
    `[TV Media] ✅ Upload concluído: "${originalName}" → ${publicUrl} (${(buffer.length / 1024).toFixed(1)}KB)`,
  );

  return reply.status(201).send({
    mensagem: `Arquivo "${originalName}" enviado com sucesso!`,
    file: mediaFile,
  });
}

// =============================================================================
// FUNÇÃO: removeMedia
// DELETE /tv/media/:mediaId
// =============================================================================
// O QUE FAZ:
//   Remove o registro do banco e o arquivo físico do disco.
//   Retorna 404 se o arquivo não existir no banco do tenant.
// =============================================================================
export async function removeMedia(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const params = MediaParamsSchema.parse(request.params);
  const { schemaName, slug } = request.tenant!;

  const tenantSlug = slug.replace(/_/g, "-");
  const uploadsBase = path.join(process.cwd(), "uploads", tenantSlug);

  const deleted = await deleteMediaFile(
    schemaName,
    params.mediaId,
    uploadsBase,
  );

  if (!deleted) {
    return reply.status(404).send({
      statusCode: 404,
      error: "Não Encontrado",
      message: `Arquivo com ID "${params.mediaId}" não encontrado.`,
    });
  }

  return reply.status(200).send({
    mensagem: "Arquivo removido com sucesso.",
  });
}

// =============================================================================
// FUNÇÃO: getMedia
// GET /tv/media/:mediaId
// =============================================================================
// O QUE FAZ:
//   Retorna os metadados de um arquivo específico pelo ID.
//   Útil para o frontend exibir preview antes de enviar para a TV.
// =============================================================================
export async function getMedia(request: FastifyRequest, reply: FastifyReply) {
  const params = MediaParamsSchema.parse(request.params);
  const { schemaName } = request.tenant!;

  const file = await findMediaFileById(schemaName, params.mediaId);

  if (!file) {
    return reply.status(404).send({
      statusCode: 404,
      error: "Não Encontrado",
      message: `Arquivo com ID "${params.mediaId}" não encontrado.`,
    });
  }

  return reply.send(file);
}

// =============================================================================
// UTILITÁRIO: mimeToExtension
// =============================================================================
// O QUE FAZ:
//   Converte um mime type em extensão de arquivo.
//   POR QUE GERAR EXTENSÃO A PARTIR DO MIME (e não do filename original)?
//   O nome do arquivo do cliente é controlado pelo usuário — pode ter extensão
//   errada ou maliciosa. Derivar da extensão do mime type é mais seguro.
// =============================================================================
function mimeToExtension(mime: string): string {
  const map: Record<string, string> = {
    "video/mp4": ".mp4",
    "video/webm": ".webm",
    "video/ogg": ".ogv",
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
  };
  return map[mime] ?? "";
}
