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
  // Campos Multi-Protocolo
  // chromecast_id: ID do dispositivo Chromecast (usado pelo Cast SDK no frontend)
  chromecast_id: string | null;
  // socket_token: UUID que autentica o receiver.html da TV no WebSocket
  socket_token: string | null;
  created_at: Date;
  updated_at: Date;
}

// =============================================================================
// TIPO: TvDeviceListResult
// =============================================================================
export interface TvDeviceListResult {
  devices: TvDevice[];
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
         current_content, last_seen_at,
         chromecast_id, socket_token,
         created_at, updated_at
       FROM tv_devices
       ORDER BY
         CASE WHEN status = 'online' THEN 0 ELSE 1 END,
         name ASC`,
    );

    return {
      devices: rows,
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
         current_content, last_seen_at,
         chromecast_id, socket_token,
         created_at, updated_at
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
                 current_content, last_seen_at,
                 chromecast_id, socket_token,
                 created_at, updated_at`,
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

    // Campos Multi-Protocolo: chromecast_id pode ser atualizado via PATCH
    if ((data as any).chromecast_id !== undefined) {
      values.push((data as any).chromecast_id);
      setClauses.push(`chromecast_id = $${values.length}`);
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
                 current_content, last_seen_at,
                 chromecast_id, socket_token,
                 created_at, updated_at`,
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

// =============================================================================
// TIPO: TvCommandLog
// =============================================================================
// Representa um registro do histórico de comandos enviados para uma TV.
// Reflete a tabela tv_command_logs criada no provisioner.
// =============================================================================
export interface TvCommandLog {
  id: string;
  device_id: string;
  device_name: string;
  content_url: string;
  content_type: "video" | "image" | "web" | "screen-share";
  protocol_used: string | null;
  success: boolean;
  error_message: string | null;
  sent_at: Date;
}

// =============================================================================
// TIPO: SaveCommandLogInput
// =============================================================================
export interface SaveCommandLogInput {
  deviceId: string;
  deviceName: string;
  contentUrl: string;
  // 'timer' e 'screen-share' adicionados para suporte via WebSocket
  contentType: "video" | "image" | "web" | "timer" | "screen-share";
  // Expandido: 'websocket' | 'chromecast' | 'upnp' | 'dial' | 'none'
  protocolUsed: "websocket" | "chromecast" | "upnp" | "dial" | "none" | null;
  success: boolean;
  errorMessage: string | null;
}

// =============================================================================
// FUNÇÃO: saveCommandLog
// =============================================================================
// O QUE FAZ:
//   Persiste um registro no histórico de comandos enviados para uma TV.
//   Chamada pelo controller após cada POST /tv/control,
//   independentemente de sucesso ou falha da comunicação com a TV.
//
// POR QUE LOGAR MESMO SE FALHOU?
//   Logs de falha são os mais valiosos para diagnóstico.
//   Se uma TV fica "offline" no sistema, o histórico de tentativas
//   facilita identificar padrões (sempre falha às 2h da manhã?
//   IP mudou? Protocolo errado?).
// =============================================================================
export async function saveCommandLog(
  schemaName: string,
  data: SaveCommandLogInput,
): Promise<void> {
  await withTenantSchema(schemaName, async (tx) => {
    await tx.$executeRawUnsafe(
      `INSERT INTO tv_command_logs
         (device_id, device_name, content_url, content_type,
          protocol_used, success, error_message)
       VALUES ($1::uuid, $2, $3, $4, $5, $6, $7)`,
      data.deviceId,
      data.deviceName,
      data.contentUrl,
      data.contentType,
      data.protocolUsed ?? null,
      data.success,
      data.errorMessage ?? null,
    );
  });
}

// =============================================================================
// FUNÇÃO: getCommandHistory
// =============================================================================
// O QUE FAZ:
//   Retorna os últimos N comandos enviados para um dispositivo específico.
//   Ordenados do mais recente para o mais antigo.
//
// POR QUE LIMITAR A 50?
//   O histórico cresce indefinidamente. Limitar evita transferir muitos dados
//   desnecessariamente. Para análises mais longas, um relatório separado
//   (com filtro por data) seria mais apropriado.
// =============================================================================
export async function getCommandHistory(
  schemaName: string,
  deviceId: string,
  limit = 50,
): Promise<TvCommandLog[]> {
  return withTenantSchema(schemaName, async (tx) => {
    const rows = await tx.$queryRawUnsafe<TvCommandLog[]>(
      `SELECT
         id, device_id, device_name, content_url, content_type,
         protocol_used, success, error_message, sent_at
       FROM tv_command_logs
       WHERE device_id = $1::uuid
       ORDER BY sent_at DESC
       LIMIT $2`,
      deviceId,
      limit,
    );

    return rows;
  });
}

// =============================================================================
// FUNÇÃO: updateDeviceChromecastId
// =============================================================================
// O QUE FAZ:
//   Salva o ID do dispositivo Chromecast associado a uma TV.
//   Chamada quando o operador pareia a TV via Cast SDK no frontend.
//
// POR QUE SEPARAR DO updateTvDevice?
//   O pareamento Chromecast é uma operação de configuração de protocolo,
//   não uma edição de dados da TV. Manter separado facilita auditar e
//   revogar acessos sem mexer nos dados principais do dispositivo.
// =============================================================================
export async function updateDeviceChromecastId(
  schemaName: string,
  deviceId: string,
  chromecastId: string | null,
): Promise<void> {
  await withTenantSchema(schemaName, async (tx) => {
    await tx.$executeRawUnsafe(
      `UPDATE tv_devices
       SET chromecast_id = $1, updated_at = NOW()
       WHERE id = $2::uuid`,
      chromecastId,
      deviceId,
    );
  });
}

// =============================================================================
// FUNÇÃO: rotateSocketToken
// =============================================================================
// O QUE FAZ:
//   Gera um novo socket_token para um dispositivo, invalidando o anterior.
//   O receiver.html na TV precisará de reconexão com o novo token após isso.
//
// QUANDO USAR?
//   - Quando o operador suspeitar que o token foi comprometido
//   - Quando a TV for cedida a outro usuário
//   - Rotação periódica de segurança
// =============================================================================
export async function rotateSocketToken(
  schemaName: string,
  deviceId: string,
): Promise<string> {
  return withTenantSchema(schemaName, async (tx) => {
    const rows = await tx.$queryRawUnsafe<[{ socket_token: string }]>(
      `UPDATE tv_devices
       SET socket_token = gen_random_uuid(), updated_at = NOW()
       WHERE id = $1::uuid
       RETURNING socket_token::text`,
      deviceId,
    );
    return rows[0].socket_token;
  });
}

// =============================================================================
// FUNÇÃO: findDeviceBySocketToken
// =============================================================================
// O QUE FAZ:
//   Localiza um dispositivo pelo socket_token.
//   Chamada no middleware de autenticação WebSocket quando o receiver.html
//   se conecta com ?token=<uuid> na query string do socket.
//
// POR QUE RETORNAR schemaName ANINHADO?
//   O WebSocket server não tem acesso ao tenant do request HTTP.
//   Precisamos do tenantId para montar o namespace correto e do schemaName
//   para logar o comando no banco correto.
// =============================================================================
export async function findDeviceBySocketToken(
  schemaName: string,
  token: string,
): Promise<Pick<TvDevice, "id" | "name"> | null> {
  return withTenantSchema(schemaName, async (tx) => {
    const rows = await tx.$queryRawUnsafe<Pick<TvDevice, "id" | "name">[]>(
      `SELECT id, name
       FROM tv_devices
       WHERE socket_token = $1::uuid`,
      token,
    );
    return rows[0] ?? null;
  });
}
