// =============================================================================
// src/modules/tv/tv.controller.ts
// =============================================================================
// O QUE FAZ:
//   Camada de APRESENTAÇÃO do módulo TV. Recebe requisições HTTP,
//   chama o Repository (para banco de dados) ou o Service (para UPnP/SSDP),
//   e devolve a resposta HTTP adequada.
//
// RESPONSABILIDADE ÚNICA (SOLID — Single Responsibility Principle):
//   O controller NÃO sabe sobre SQL, NÃO sabe sobre SOAP, NÃO sabe sobre SSDP.
//   Ele apenas:
//   1. Valida o input com Zod (via parse nos schemas)
//   2. Chama repository ou service
//   3. Mapeia o resultado para HTTP (status code + body)
//   4. Trata erros conhecidos (404, 422, conflitos de IP)
// =============================================================================

import { FastifyRequest, FastifyReply } from "fastify";
import {
  RegisterTvDeviceSchema,
  UpdateTvDeviceSchema,
  TvDeviceParamsSchema,
  ControlTvSchema,
} from "./tv.schema";
import {
  findAllTvDevices,
  findTvDeviceById,
  registerTvDevice,
  updateTvDevice,
  removeTvDevice,
  updateDeviceContentAndStatus,
  TV_MAX_LIMIT,
} from "./tv.repository";
import { discoverTvDevices, sendContentToDevice } from "./tv.service";

// =============================================================================
// HANDLER: listDevices
// GET /tv/devices
// =============================================================================
// Lista todos os dispositivos TV registrados pelo tenant logado.
// Retorna também o total e o limite máximo (informativo para o frontend).
// =============================================================================
export async function listDevices(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { schemaName } = request.tenant!;
  const result = await findAllTvDevices(schemaName);

  return reply.send({
    ...result,
    slots_disponiveis: TV_MAX_LIMIT - result.total,
  });
}

// =============================================================================
// HANDLER: getDevice
// GET /tv/devices/:id
// =============================================================================
export async function getDevice(request: FastifyRequest, reply: FastifyReply) {
  const params = TvDeviceParamsSchema.parse(request.params);
  const { schemaName } = request.tenant!;

  const device = await findTvDeviceById(schemaName, params.id);

  if (!device) {
    return reply.status(404).send({
      statusCode: 404,
      error: "Não Encontrado",
      message: `Dispositivo com ID "${params.id}" não encontrado neste tenant.`,
    });
  }

  return reply.send(device);
}

// =============================================================================
// HANDLER: registerDevice
// POST /tv/devices
// =============================================================================
// O QUE FAZ:
//   Registra uma nova TV. Verifica o limite de 5 TVs por tenant.
//
// TRATAMENTO DE ERROS:
//   - 422 Unprocessable Entity → limite de 5 TVs atingido
//   - 409 Conflict → IP já cadastrado para outro dispositivo
//   - 400 Bad Request → dados inválidos (Zod)
// =============================================================================
export async function registerDevice(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const body = RegisterTvDeviceSchema.parse(request.body);
  const { schemaName, name: tenantName } = request.tenant!;

  try {
    const device = await registerTvDevice(schemaName, body);

    request.log.info(
      `[TV] ✅ Dispositivo "${device.name}" (${device.ip_address}) registrado no tenant "${tenantName}"`,
    );

    return reply.status(201).send({
      mensagem: `Dispositivo "${device.name}" registrado com sucesso!`,
      device,
    });
  } catch (err: unknown) {
    // Erro de limite de TVs — nosso código customizado do repository
    if (isLimitError(err)) {
      return reply.status(422).send({
        statusCode: 422,
        error: "Limite Atingido",
        message: err.message,
        detalhe: {
          limite_maximo: err.limit,
          quantidade_atual: err.current,
          dica: "Remova um dispositivo existente (DELETE /tv/devices/:id) para liberar um slot.",
        },
      });
    }

    // Violação de UNIQUE CONSTRAINT (ip_address único por tenant)
    // Código Prisma/PostgreSQL: P2002 (Prisma) ou "23505" (PostgreSQL direto)
    if (isUniqueConstraintError(err)) {
      return reply.status(409).send({
        statusCode: 409,
        error: "Conflito",
        message:
          `O endereço IP "${body.ip_address}" já está cadastrado neste tenant. ` +
          `Cada dispositivo deve ter um IP único.`,
      });
    }

    throw err; // Erro inesperado — propaga para o handler global do Fastify
  }
}

// =============================================================================
// HANDLER: updateDevice
// PATCH /tv/devices/:id
// =============================================================================
export async function updateDevice(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const params = TvDeviceParamsSchema.parse(request.params);
  const body = UpdateTvDeviceSchema.parse(request.body);
  const { schemaName } = request.tenant!;

  try {
    const updated = await updateTvDevice(schemaName, params.id, body);

    if (!updated) {
      return reply.status(404).send({
        statusCode: 404,
        error: "Não Encontrado",
        message: `Dispositivo com ID "${params.id}" não encontrado.`,
      });
    }

    return reply.send({
      mensagem: "Dispositivo atualizado com sucesso.",
      device: updated,
    });
  } catch (err: unknown) {
    if (isUniqueConstraintError(err)) {
      return reply.status(409).send({
        statusCode: 409,
        error: "Conflito",
        message: `O endereço IP "${body.ip_address}" já está em uso por outro dispositivo.`,
      });
    }
    throw err;
  }
}

// =============================================================================
// HANDLER: removeDevice
// DELETE /tv/devices/:id
// =============================================================================
// Hard delete — remove a TV e libera um slot no limite de 5.
// =============================================================================
export async function removeDevice(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const params = TvDeviceParamsSchema.parse(request.params);
  const { schemaName, name: tenantName } = request.tenant!;

  const deleted = await removeTvDevice(schemaName, params.id);

  if (!deleted) {
    return reply.status(404).send({
      statusCode: 404,
      error: "Não Encontrado",
      message: `Dispositivo com ID "${params.id}" não encontrado.`,
    });
  }

  request.log.info(
    `[TV] 🗑️ Dispositivo ${params.id} removido do tenant "${tenantName}"`,
  );

  return reply.status(200).send({
    mensagem: "Dispositivo removido com sucesso. Slot liberado.",
  });
}

// =============================================================================
// HANDLER: controlTv
// POST /tv/control
// =============================================================================
// O QUE FAZ:
//   Envia uma URL de conteúdo para uma TV registrada.
//   1. Valida o body com ControlTvSchema
//   2. Busca o device pelo ID (obtém o IP)
//   3. Chama tv.service.sendContentToDevice() com o protocolo correto
//   4. Atualiza o status e current_content no banco
//   5. Retorna o resultado da operação (sucesso + protocolo usado)
//
// RESPOSTA EM CASO DE FALHA DE COMUNICAÇÃO:
//   HTTP 200 com { success: false } — o comando foi processado, mas a TV
//   não estava acessível. Retornamos 200 (não 500) porque o SISTEMA
//   funcionou corretamente — o problema é a TV estar offline.
//   O cliente pode usar esse feedback para marcar a TV como 'offline'.
// =============================================================================
export async function controlTv(request: FastifyRequest, reply: FastifyReply) {
  const body = ControlTvSchema.parse(request.body);
  const { schemaName, name: tenantName } = request.tenant!;

  // --- Passo 1: Busca o dispositivo pelo ID ---
  const device = await findTvDeviceById(schemaName, body.deviceId);

  if (!device) {
    return reply.status(404).send({
      statusCode: 404,
      error: "Não Encontrado",
      message: `Dispositivo com ID "${body.deviceId}" não encontrado neste tenant.`,
    });
  }

  request.log.info(
    `[TV] 📡 Enviando conteúdo para "${device.name}" (${device.ip_address}) ` +
      `via ${body.contentType}: ${body.contentUrl}`,
  );

  // --- Passo 2: Envia o conteúdo via protocolo correto ---
  const result = await sendContentToDevice(
    device.ip_address,
    body.contentUrl,
    body.contentType,
    body.upnpPort,
    body.dialPort,
  );

  // --- Passo 3: Atualiza o banco com o resultado ---
  await updateDeviceContentAndStatus(
    schemaName,
    device.id,
    body.contentUrl,
    result.success ? "online" : "offline",
  );

  if (result.success) {
    request.log.info(
      `[TV] ✅ Conteúdo entregue para "${device.name}" via ${result.protocol} no tenant "${tenantName}"`,
    );
  } else {
    request.log.warn(
      `[TV] ⚠️ Falha ao entregar conteúdo para "${device.name}" (${device.ip_address}): ${result.message}`,
    );
  }

  return reply.send({
    dispositivo: {
      id: device.id,
      name: device.name,
      ip_address: device.ip_address,
    },
    resultado: result,
    // Se a TV não respondeu, oferecemos a alternativa de polling
    ...(result.success
      ? {}
      : {
          alternativa:
            `Se a TV não responde aos protocolos UPnP/DIAL, instale um app HTML5 ` +
            `que faça polling em GET /tv/devices/${device.id} e exiba o campo ` +
            `'current_content'. Isso garante compatibilidade com qualquer TV/monitor.`,
        }),
  });
}

// =============================================================================
// HANDLER: discoverDevices
// GET /tv/discover
// =============================================================================
// O QUE FAZ:
//   Escaneia a rede local usando SSDP para encontrar Smart TVs e outros
//   dispositivos UPnP/DIAL disponíveis.
//
// PARÂMETRO DE QUERY: timeout (segundos, default 5, máximo 30)
//   Aumentar o timeout melhora a chance de encontrar TVs em redes lentas
//   ou com latência alta (ex: rede Wi-Fi lotada).
//
// IMPORTANTE: Esta operação é BLOQUEANTE no servidor pelo tempo do timeout.
//   Em produção, considere executar em worker thread ou limitar a 1 execução
//   simultânea por tenant para evitar sobrecarga de UDP multicast.
// =============================================================================
export async function discoverDevices(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  // Valida e limita o timeout entre 2 e 30 segundos
  const query = request.query as Record<string, string>;
  const rawTimeout = parseInt(query.timeout ?? "5", 10);
  const timeoutSec = Math.min(
    Math.max(isNaN(rawTimeout) ? 5 : rawTimeout, 2),
    30,
  );

  request.log.info(
    `[TV] 🔍 Iniciando varredura SSDP (timeout: ${timeoutSec}s) para tenant "${request.tenant!.name}"`,
  );

  const startedAt = Date.now();
  const devices = await discoverTvDevices(timeoutSec * 1000);
  const elapsedMs = Date.now() - startedAt;

  return reply.send({
    mensagem:
      devices.length > 0
        ? `${devices.length} dispositivo(s) encontrado(s) na rede local.`
        : "Nenhum dispositivo UPnP/DIAL encontrado. Certifique-se de que as TVs estão ligadas e na mesma rede.",
    dispositivos_encontrados: devices.length,
    varredura_durou_ms: elapsedMs,
    dispositivos: devices,
    proximo_passo:
      `Para registrar um dispositivo encontrado, use: ` +
      `POST /tv/devices com { "name": "...", "ip_address": "IP_DA_TV" }`,
  });
}

// =============================================================================
// HELPERS DE ERRO (type guards)
// =============================================================================

interface LimitError {
  code: "TV_LIMIT_EXCEEDED";
  message: string;
  current: number;
  limit: number;
}

function isLimitError(err: unknown): err is LimitError {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as LimitError).code === "TV_LIMIT_EXCEEDED"
  );
}

function isUniqueConstraintError(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const e = err as Record<string, unknown>;
  // Prisma unique constraint: code P2002
  if (e["code"] === "P2002") return true;
  // PostgreSQL direto: pgcode 23505
  const meta = e["meta"] as Record<string, unknown> | undefined;
  if (meta?.["pgCode"] === "23505") return true;
  // Mensagem genérica do PostgreSQL (fallback)
  const msg = String(e["message"] ?? "");
  return (
    msg.includes("unique") || msg.includes("23505") || msg.includes("UNIQUE")
  );
}
