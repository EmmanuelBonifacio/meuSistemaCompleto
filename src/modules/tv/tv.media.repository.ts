// =============================================================================
// src/modules/tv/tv.media.repository.ts
// =============================================================================
// O QUE FAZ:
//   Camada de ACESSO A DADOS do submódulo de mídia.
//   Toda operação de leitura e escrita na tabela `media_files` passa por aqui.
//   O controller e o handler de upload não tocam no banco diretamente.
//
// ISOLAMENTO MULTI-TENANT:
//   Toda função recebe `schemaName` e usa `withTenantSchema()`.
//   Isso garante que cada tenant só acessa suas próprias mídias.
//
// POR QUE SEPARAR DE tv.repository.ts?
//   Single Responsibility (SOLID): tv.repository.ts gerencia dispositivos.
//   tv.media.repository.ts gerencia arquivos de mídia.
//   Arquivos separados facilitam manutenção e testes independentes.
// =============================================================================

import { withTenantSchema } from "../../core/database/prisma";
import path from "path";
import fs from "fs/promises";

// =============================================================================
// TIPO: MediaFile
// =============================================================================
// Representa um arquivo de mídia como existe no banco de dados.
// Espelha exatamente os campos da tabela media_files criada no provisioner.
// =============================================================================
export interface MediaFile {
  id: string;
  filename: string; // Nome único no disco (UUID + extensão)
  original_name: string; // Nome original informado pelo usuário no upload
  url: string; // URL pública: /uploads/{tenantSlug}/{filename}
  mime_type: string; // Ex: "video/mp4", "image/jpeg", "image/png"
  size_bytes: number; // Tamanho em bytes
  uploaded_by: string | null; // UUID do usuário que fez upload (auditoria)
  created_at: Date;
}

// =============================================================================
// TIPO: CreateMediaFileInput
// =============================================================================
// Dados necessários para registrar um novo arquivo no banco após o upload.
// O `filename` já é o nome gerado (UUID), não o nome original do usuário.
// =============================================================================
export interface CreateMediaFileInput {
  filename: string;
  original_name: string;
  url: string;
  mime_type: string;
  size_bytes: number;
  uploaded_by?: string;
}

// =============================================================================
// CONSTANTES: Limites de Upload
// =============================================================================
// Centralizado aqui para facilitar ajuste futuro por plano de assinatura.
// MAX_FILE_SIZE: 100MB — limite para vídeos comuns de Digital Signage.
// ALLOWED_MIME_TYPES: apenas formatos seguros e amplamente suportados em TVs.
// =============================================================================
export const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024; // 100MB
export const ALLOWED_MIME_TYPES = [
  "video/mp4",
  "video/webm",
  "video/ogg",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];

// =============================================================================
// FUNÇÃO AUXILIAR: normalizarMediaFile
// =============================================================================
// O QUE FAZ:
//   Converte o campo size_bytes de BigInt (retorno do Prisma para BIGINT)
//   para number, permitindo serialização JSON.
// POR QUE?
//   O Prisma $queryRawUnsafe retorna colunas BIGINT como BigInt nativo do JS,
//   que não é serializável pelo JSON.stringify padrão.
// =============================================================================
function normalizarMediaFile(row: MediaFile): MediaFile {
  return {
    ...row,
    size_bytes:
      typeof row.size_bytes === "bigint"
        ? Number(row.size_bytes)
        : row.size_bytes,
  };
}

// =============================================================================
// FUNÇÃO: findAllMediaFiles
// =============================================================================
// O QUE FAZ:
//   Lista todos os arquivos de mídia do tenant, ordenados do mais recente.
//
// POR QUE LIMITAR A 100?
//   Proteção contra queries pesadas em tenants com muitos arquivos.
//   Paginação completa pode ser adicionada quando necessário.
// =============================================================================
export async function findAllMediaFiles(
  schemaName: string,
): Promise<MediaFile[]> {
  return withTenantSchema(schemaName, async (tx) => {
    const rows = await tx.$queryRawUnsafe<MediaFile[]>(
      `SELECT id, filename, original_name, url, mime_type, size_bytes,
              uploaded_by, created_at
       FROM media_files
       ORDER BY created_at DESC
       LIMIT 100`,
    );
    return rows.map(normalizarMediaFile);
  });
}

// =============================================================================
// FUNÇÃO: findMediaFileById
// =============================================================================
// O QUE FAZ:
//   Busca um arquivo de mídia pelo UUID. Retorna null se não encontrado.
//   Usada pelo controller de deleção antes de remover o arquivo do disco.
// =============================================================================
export async function findMediaFileById(
  schemaName: string,
  id: string,
): Promise<MediaFile | null> {
  return withTenantSchema(schemaName, async (tx) => {
    const rows = await tx.$queryRawUnsafe<MediaFile[]>(
      `SELECT id, filename, original_name, url, mime_type, size_bytes,
              uploaded_by, created_at
       FROM media_files
       WHERE id = $1::uuid`,
      id,
    );
    return rows[0] ? normalizarMediaFile(rows[0]) : null;
  });
}

// =============================================================================
// FUNÇÃO: createMediaFile
// =============================================================================
// O QUE FAZ:
//   Registra os metadados de um arquivo recém-uploadado no banco.
//   Chamada APÓS o arquivo já ter sido gravado com sucesso no disco.
//   Se a inserção no banco falhar, o controller deve remover o arquivo do disco.
//
// POR QUE SEPARAR "gravar no disco" de "registrar no banco"?
//   Permite tratar cada passo no controller:
//   1. Grava no disco → se falhar, retorna 500 sem poluir o banco
//   2. Registra no banco → se falhar, remove o arquivo do disco (limpeza)
//   Isso garante consistência entre o sistema de arquivos e o banco.
// =============================================================================
export async function createMediaFile(
  schemaName: string,
  data: CreateMediaFileInput,
): Promise<MediaFile> {
  return withTenantSchema(schemaName, async (tx) => {
    const rows = await tx.$queryRawUnsafe<MediaFile[]>(
      `INSERT INTO media_files (filename, original_name, url, mime_type, size_bytes, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6::uuid)
       RETURNING id, filename, original_name, url, mime_type, size_bytes,
                 uploaded_by, created_at`,
      data.filename,
      data.original_name,
      data.url,
      data.mime_type,
      data.size_bytes,
      data.uploaded_by ?? null,
    );
    return normalizarMediaFile(rows[0]);
  });
}

// =============================================================================
// FUNÇÃO: deleteMediaFile
// =============================================================================
// O QUE FAZ:
//   Remove o registro do banco E o arquivo físico do disco.
//   Retorna false se o registro não existia (para o controller enviar 404).
//
// POR QUE DELETAR O ARQUIVO APÓS O BANCO E NÃO ANTES?
//   ATOMICIDADE PARCIAL: se o DELETE no banco falhar, o arquivo continua no
//   disco (estado consistente). Se deletarmos o arquivo primeiro e o banco
//   falhar, ficamos com registro "órfão" apontando para arquivo inexistente.
//   Banco depois é mais seguro aqui.
//
// NOTA: Se o arquivo não existir no disco (já foi deletado manualmente),
//   a função continua e retorna true — o banco é limpo mesmo assim.
// =============================================================================
export async function deleteMediaFile(
  schemaName: string,
  id: string,
  uploadsBasePath: string,
): Promise<boolean> {
  return withTenantSchema(schemaName, async (tx) => {
    // Busca o arquivo para obter o filename antes de deletar
    const rows = await tx.$queryRawUnsafe<MediaFile[]>(
      `DELETE FROM media_files WHERE id = $1::uuid RETURNING filename`,
      id,
    );

    if (rows.length === 0) {
      return false; // Não encontrado — controller retornará 404
    }

    // Remove o arquivo físico do disco (erro de IO não reverte o DELETE do banco)
    const filePath = path.join(uploadsBasePath, rows[0].filename);
    try {
      await fs.unlink(filePath);
    } catch {
      // Arquivo já não existe no disco — log informativo apenas
      console.warn(
        `[TV Media] Arquivo não encontrado no disco (já removido?): ${filePath}`,
      );
    }

    return true;
  });
}
