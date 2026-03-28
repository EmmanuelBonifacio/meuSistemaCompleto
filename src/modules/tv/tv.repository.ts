// =============================================================================
// src/modules/tv/tv.repository.ts
// =============================================================================
// O QUE FAZ:
//   Camada de ACESSO A DADOS do módulo TV. Toda operação de leitura e escrita
//   na tabela `tv_devices` passa por aqui — controller e service não tocam
//   no banco de dados diretamente.
//
// REGRA DE NEGÓCIO CRÍTICA:
//   Máximo de 5 dispositivos por tenant (TV_MAX_LIMIT).
//   Esta verificação é feita ANTES de cada INSERT, gerando um erro com código
//   customizado 'TV_LIMIT_EXCEEDED' que o controller trata como HTTP 422.
//
// ISOLAMENTO MULTI-TENANT:
//   Toda função recebe `schemaName` e usa `withTenantSchema()`.
//   Isso executa `SET LOCAL search_path TO "tenant_x", public` antes das queries,
//   garantindo que cada tenant só acessa seus próprios dispositivos.
// =============================================================================

import { withTenantSchema } from "../../core/database/prisma";
import { RegisterTvDeviceInput, UpdateTvDeviceInput } from "./tv.schema";

// =============================================================================
// CONSTANTE: TV_MAX_LIMIT
// =============================================================================
// Regra de negócio: limite máximo de TVs por tenant.
// Centralizado aqui para facilitar alteração futura (ex: por plano de assinatura).
// =============================================================================
export const TV_MAX_LIMIT = 5;

// =============================================================================
// TIPO: TvDevice
// =============================================================================
// Estrutura de um dispositivo TV como existe no banco de dados.
// Criado manualmente pois o Prisma não gerencia tabelas dentro de schemas
// de tenant — essas tabelas existem apenas dentro de cada schema dinâmico.
// =============================================================================
export interface TvDevice {
  id: string;
  name: string;
  ip_address: string;
  mac_address: string | null;
  status: "online" | "offline";
  current_content: string | null;
  last_seen_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

// =============================================================================
// TIPO: TvDeviceListResult
// =============================================================================
export interface TvDeviceListResult {
  data: TvDevice[];
  total: number;
  limite_maximo: number; // informativo: lembra o consumidor do limite de 5
}

// =============================================================================
// FUNÇÃO: findAllTvDevices
// =============================================================================
// Lista todos os dispositivos TV do tenant, ordenados por status (online primeiro)
// e depois por nome.
// =============================================================================
export async function findAllTvDevices(
  schemaName: string,
): Promise<TvDeviceListResult> {
  return withTenantSchema(schemaName, async (tx) => {
    // Conta o total de devices (para informar quantos slots restam)
    const countResult = await tx.$queryRawUnsafe<[{ count: string }]>(
      `SELECT COUNT(*)::text AS count FROM tv_devices`,
    );
    const total = parseInt(countResult[0].count, 10);

    // Busca todos os devices
    // ORDER BY: online primeiro (status ASC invertido: 'online' < 'offline' alfabeticamente),
    // depois por nome para consistência
    const rows = await tx.$queryRawUnsafe<TvDevice[]>(
      `SELECT
         id, name, ip_address, mac_address, status,
         current_content, last_seen_at, created_at, updated_at
       FROM tv_devices
       ORDER BY
         CASE WHEN status = 'online' THEN 0 ELSE 1 END,
         name ASC`,
    );

    return {
      data: rows,
      total,
      limite_maximo: TV_MAX_LIMIT,
    };
  });
}

// =============================================================================
// FUNÇÃO: findTvDeviceById
// =============================================================================
// Retorna um dispositivo pelo UUID. Retorna `null` se não encontrado.
// =============================================================================
export async function findTvDeviceById(
  schemaName: string,
  id: string,
): Promise<TvDevice | null> {
  return withTenantSchema(schemaName, async (tx) => {
    const rows = await tx.$queryRawUnsafe<TvDevice[]>(
      `SELECT
         id, name, ip_address, mac_address, status,
         current_content, last_seen_at, created_at, updated_at
       FROM tv_devices
       WHERE id = $1::uuid`,
      id,
    );

    return rows[0] ?? null;
  });
}

// =============================================================================
// FUNÇÃO: registerTvDevice
// =============================================================================
// O QUE FAZ:
//   Registra uma nova TV no sistema.
//
// REGRA DE NEGÓCIO (implementada aqui, não no banco):
//   Antes de inserir, conta quantos devices o tenant já tem.
//   Se já tem TV_MAX_LIMIT (5), lança erro com código 'TV_LIMIT_EXCEEDED'.
//   O controller captura este código e retorna HTTP 422 com mensagem amigável.
//
// POR QUE VERIFICAR AQUI E NÃO COM CHECK CONSTRAINT NO BANCO?
//   Um CHECK constraint no PostgreSQL não tem acesso ao COUNT de outras linhas.
//   Para verificar "máximo X linhas por tabela", precisamos de um trigger PL/pgSQL
//   ou verificação na aplicação. Optamos pela aplicação para dar mensagem de erro
//   amigável e em português. Triggers são hard de debugar e não escalam bem.
// =============================================================================
export async function registerTvDevice(
  schemaName: string,
  data: RegisterTvDeviceInput,
): Promise<TvDevice> {
  return withTenantSchema(schemaName, async (tx) => {
    // --- VERIFICAÇÃO DO LIMITE ---
    const countResult = await tx.$queryRawUnsafe<[{ count: string }]>(
      `SELECT COUNT(*)::text AS count FROM tv_devices`,
    );
    const currentCount = parseInt(countResult[0].count, 10);

    if (currentCount >= TV_MAX_LIMIT) {
      // Lança um erro com código customizado — o controller trata como 422
      throw {
        code: "TV_LIMIT_EXCEEDED",
        message:
          `Este tenant já possui ${currentCount} de ${TV_MAX_LIMIT} TVs permitidas. ` +
          `Remova uma TV existente antes de adicionar uma nova.`,
        current: currentCount,
        limit: TV_MAX_LIMIT,
      };
    }

    // --- INSERT ---
    const rows = await tx.$queryRawUnsafe<TvDevice[]>(
      `INSERT INTO tv_devices (name, ip_address, mac_address)
       VALUES ($1, $2, $3)
       RETURNING id, name, ip_address, mac_address, status,
                 current_content, last_seen_at, created_at, updated_at`,
      data.name,
      data.ip_address,
      data.mac_address ?? null,
    );

    return rows[0];
  });
}

// =============================================================================
// FUNÇÃO: updateTvDevice
// =============================================================================
// Atualiza campos de uma TV existente.
// Constrói o SET dinamicamente para atualizar apenas os campos fornecidos.
// Igual ao padrão do estoque.repository.ts — evita sobrescrever campos com null.
// =============================================================================
export async function updateTvDevice(
  schemaName: string,
  id: string,
  data: UpdateTvDeviceInput,
): Promise<TvDevice | null> {
  return withTenantSchema(schemaName, async (tx) => {
    const setClauses: string[] = [];
    const values: unknown[] = [];

    // Constrói o SET dinamicamente: apenas os campos presentes no body
    if (data.name !== undefined) {
      values.push(data.name);
      setClauses.push(`name = $${values.length}`);
    }
    if (data.ip_address !== undefined) {
      values.push(data.ip_address);
      setClauses.push(`ip_address = $${values.length}`);
    }
    if (data.mac_address !== undefined) {
      values.push(data.mac_address);
      setClauses.push(`mac_address = $${values.length}`);
    }

    // Sempre atualiza o updated_at (auditoria básica)
    setClauses.push(`updated_at = NOW()`);

    values.push(id);
    const idParamIndex = values.length;

    const rows = await tx.$queryRawUnsafe<TvDevice[]>(
      `UPDATE tv_devices
       SET ${setClauses.join(", ")}
       WHERE id = $${idParamIndex}::uuid
       RETURNING id, name, ip_address, mac_address, status,
                 current_content, last_seen_at, created_at, updated_at`,
      ...values,
    );

    return rows[0] ?? null;
  });
}

// =============================================================================
// FUNÇÃO: removeTvDevice
// =============================================================================
// Remove permanentemente uma TV do sistema.
// Hard delete: dispositivos removidos liberam um slot do limite de 5.
// Retorna true se foi deletado, false se não foi encontrado.
// =============================================================================
export async function removeTvDevice(
  schemaName: string,
  id: string,
): Promise<boolean> {
  return withTenantSchema(schemaName, async (tx) => {
    const result = await tx.$executeRawUnsafe(
      `DELETE FROM tv_devices WHERE id = $1::uuid`,
      id,
    );

    // $executeRawUnsafe retorna o número de linhas afetadas
    return result > 0;
  });
}

// =============================================================================
// FUNÇÃO: updateDeviceContentAndStatus
// =============================================================================
// O QUE FAZ:
//   Após enviar conteúdo com sucesso para uma TV, atualiza:
//   - current_content: a URL que está sendo exibida
//   - status: 'online' (a TV respondeu com sucesso)
//   - last_seen_at: timestamp atual (última comunicação bem-sucedida)
//
// Chamada pelo controller APÓS sendContentToDevice() retornar success: true.
// =============================================================================
export async function updateDeviceContentAndStatus(
  schemaName: string,
  id: string,
  contentUrl: string,
  newStatus: "online" | "offline",
): Promise<void> {
  await withTenantSchema(schemaName, async (tx) => {
    await tx.$executeRawUnsafe(
      `UPDATE tv_devices
       SET current_content = $1,
           status = $2,
           last_seen_at = CASE WHEN $3 = 'online' THEN NOW() ELSE last_seen_at END,
           updated_at = NOW()
       WHERE id = $4::uuid`,
      contentUrl,
      newStatus,
      newStatus, // parâmetro para o CASE
      id,
    );
  });
}
