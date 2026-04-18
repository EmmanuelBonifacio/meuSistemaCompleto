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
import QRCode from "qrcode";
import {
  RegisterTvDeviceSchema,
  UpdateTvDeviceSchema,
  TvDeviceParamsSchema,
  ControlTvSchema,
  CastPayloadSchema,
  PairDeviceParamsSchema,
} from "./tv.schema";
import {
  findAllTvDevices,
  findTvDeviceById,
  registerTvDevice,
  updateTvDevice,
  removeTvDevice,
  updateDeviceContentAndStatus,
  saveCommandLog,
  getCommandHistory,
  rotateSocketToken,
  countTvDevicesByClientRole,
} from "./tv.repository";
import { getTvLimit, getTvPlan } from "./tvLimitService";
import {
  discoverTvDevices,
  sendContentToDevice,
  sendWakeOnLan,
} from "./tv.service";
import { castToDevice } from "./tv.cast";

// =============================================================================
// HANDLER: getTvPlanHandler
// GET /tv/plan
// =============================================================================
// Retorna o plano de TVs do tenant com uso atual para o painel /admin/tv/planos.
// =============================================================================
export async function getTvPlanHandler(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { schemaName, id: tenantId } = request.tenant!;
  const [plan, clientCount] = await Promise.all([
    getTvPlan(tenantId),
    countTvDevicesByClientRole(schemaName),
  ]);

  return reply.send({
    ...plan,
    tvs_em_uso: clientCount,
    slots_disponiveis: Math.max(0, plan.max_client_tvs - clientCount),
  });
}

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
  const { schemaName, id: tenantId } = request.tenant!;
  const result = await findAllTvDevices(schemaName);
  const limit = await getTvLimit(tenantId);
  const clientCount = await countTvDevicesByClientRole(schemaName);

  return reply.send({
    devices: result.devices.map((d) => ({
      ...d,
      is_online: d.status === "online",
    })),
    total: result.total,
    limite_maximo: limit.maxClientTvs,
    slots_disponiveis: Math.max(0, limit.maxClientTvs - clientCount),
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

  return reply.send({ ...device, is_online: device.status === "online" });
}

// =============================================================================
// HANDLER: registerDevice
// POST /tv/devices
// =============================================================================
// O QUE FAZ:
//   Registra uma nova TV (role CLIENT por padrão no banco). O limite por plano
//   é aplicado no preHandler checkTvLimit (contagem só de device_role = CLIENT).
//
// TRATAMENTO DE ERROS:
//   - 400 → limite CLIENT (checkTvLimit) ou payload inválido (Zod)
//   - 409 Conflict → IP já cadastrado para outro dispositivo
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

  // --- Passo 4: Salva no histórico de comandos ---
  // Registra o evento sempre, independente de sucesso ou falha na TV.
  // Logs de falha são valiosos para diagnóstico posterior.
  await saveCommandLog(schemaName, {
    deviceId: device.id,
    deviceName: device.name,
    contentUrl: body.contentUrl,
    contentType: body.contentType,
    protocolUsed: result.protocol !== "none" ? result.protocol : null,
    success: result.success,
    errorMessage: result.success ? null : result.message,
  });

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
// HANDLER: wakeDevice
// POST /tv/devices/:id/wol
// =============================================================================
// O QUE FAZ:
//   Envia um Magic Packet UDP para ligar uma TV em modo standby via
//   protocolo Wake-on-LAN. Só funciona se a TV tiver MAC address cadastrado.
//
// PRÉ-REQUISITOS:
//   1. TV deve ter MAC address registrado no dispositivo
//   2. TV deve suportar Wake-on-LAN (configuração na BIOS/firmware da TV)
//   3. Servidor e TV devem estar na mesma sub-rede
//
// RESPOSTA:
//   200 → Magic Packet enviado (não garante que a TV ligou — UDP é fire-and-forget)
//   404 → Dispositivo não encontrado
//   422 → Dispositivo sem MAC address cadastrado (WoL requer o endereço físico)
// =============================================================================
export async function wakeDevice(request: FastifyRequest, reply: FastifyReply) {
  const params = TvDeviceParamsSchema.parse(request.params);
  const { schemaName } = request.tenant!;

  // Busca o dispositivo para obter o MAC address
  const device = await findTvDeviceById(schemaName, params.id);

  if (!device) {
    return reply.status(404).send({
      statusCode: 404,
      error: "Não Encontrado",
      message: `Dispositivo com ID "${params.id}" não encontrado neste tenant.`,
    });
  }

  // WoL requer o MAC address — sem ele não é possível enviar o Magic Packet
  if (!device.mac_address) {
    return reply.status(422).send({
      statusCode: 422,
      error: "Dados Insuficientes",
      message:
        `O dispositivo "${device.name}" não tem MAC address cadastrado. ` +
        `Edite o dispositivo adicionando o MAC para usar Wake-on-LAN.`,
    });
  }

  try {
    await sendWakeOnLan(device.mac_address);

    request.log.info(
      `[TV] ⚡ Magic Packet WoL enviado para "${device.name}" (MAC: ${device.mac_address})`,
    );

    return reply.send({
      mensagem:
        `Magic Packet enviado para "${device.name}". ` +
        `Se a TV suportar Wake-on-LAN, ela deve ligar em alguns segundos.`,
      dispositivo: {
        id: device.id,
        name: device.name,
        mac_address: device.mac_address,
      },
      aviso:
        `UDP é fire-and-forget — o envio não garante que a TV ligou. ` +
        `Verifique o status após ~10 segundos.`,
    });
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "Erro ao enviar Magic Packet.";
    return reply.status(500).send({
      statusCode: 500,
      error: "Erro ao Enviar WoL",
      message: msg,
    });
  }
}

// =============================================================================
// HANDLER: getDeviceHistory
// GET /tv/devices/:id/historico
// =============================================================================
// O QUE FAZ:
//   Retorna o histórico de comandos enviados para um dispositivo específico.
//   Inclui tanto envios bem-sucedidos quanto falhas de comunicação com a TV.
//
// QUERY PARAMS:
//   limit → número de registros (default 50, máximo 100)
//
// UTILIDADE:
//   Permite diagnosticar padrões de falha:
//   - A TV está sempre offline em determinado horário?
//   - O protocolo DIAL está falhando mas UPnP não?
//   - A URL enviada estava correta?
// =============================================================================
export async function getDeviceHistory(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const params = TvDeviceParamsSchema.parse(request.params);
  const { schemaName } = request.tenant!;

  // Verifica se o dispositivo existe antes de buscar o histórico
  const device = await findTvDeviceById(schemaName, params.id);

  if (!device) {
    return reply.status(404).send({
      statusCode: 404,
      error: "Não Encontrado",
      message: `Dispositivo com ID "${params.id}" não encontrado neste tenant.`,
    });
  }

  const query = request.query as Record<string, string>;
  const rawLimit = parseInt(query.limit ?? "50", 10);
  const limit = Math.min(Math.max(isNaN(rawLimit) ? 50 : rawLimit, 1), 100);

  const historico = await getCommandHistory(schemaName, params.id, limit);

  return reply.send({
    device: { id: device.id, name: device.name },
    total: historico.length,
    limit,
    historico,
  });
}

// =============================================================================
// HANDLER: castToTv
// POST /tv/cast
// =============================================================================
// O QUE FAZ:
//   Envia conteúdo para uma TV usando o waterfall multi-protocolo:
//   WebSocket → Chromecast → UPnP → DIAL.
//
//   Diferença em relação ao POST /tv/control:
//   - /control: chama diretamente UPnP/DIAL (legado, sem WebSocket)
//   - /cast: orquestrador inteligente — usa o protocolo mais adequado
//             automaticamente, priorizando WebSocket (<100ms de latência)
//
//   Tipos de conteúdo suportados:
//   - 'timer'  → Cronômetro no receiver.html (exclusivo WebSocket)
//   - 'video'  → Reprodução de vídeo (WebSocket / UPnP)
//   - 'image'  → Exibição de imagem (WebSocket / UPnP)
//   - 'web'    → Página web (WebSocket / DIAL)
//   - 'clear'  → Limpa tela (exclusivo WebSocket)
//
// REGISTRO NO HISTÓRICO:
//   Salva o log independente do sucesso (falhas também ficam registradas).
//   O campo protocol_used indica qual protocolo efetivamente entregou o conteúdo.
// =============================================================================
export async function castToTv(request: FastifyRequest, reply: FastifyReply) {
  const body = CastPayloadSchema.parse(request.body);
  const { schemaName, id: tenantId, name: tenantName } = request.tenant!;

  // --- Passo 1: Busca o dispositivo ---
  const device = await findTvDeviceById(schemaName, body.deviceId);

  if (!device) {
    return reply.status(404).send({
      statusCode: 404,
      error: "Não Encontrado",
      message: `Dispositivo com ID "${body.deviceId}" não encontrado neste tenant.`,
    });
  }

  request.log.info(
    `[TV Cast] 📡 Enviando '${body.tipo}' para "${device.name}" (${device.ip_address}) ` +
      `no tenant "${tenantName}"`,
  );

  // --- Passo 2: Orquestrador waterfall ---
  const result = await castToDevice({
    deviceId: device.id,
    deviceName: device.name,
    ipAddress: device.ip_address,
    chromecastId: device.chromecast_id,
    tenantId,
    payload: {
      tipo: body.tipo,
      url: body.url,
      duracao: body.duracao,
      label: body.label,
    },
  });

  // --- Passo 3: Atualiza banco se houve conteúdo de mídia ---
  // Para 'clear', não há conteúdo a persistir.
  if (body.tipo !== "clear" && result.success) {
    await updateDeviceContentAndStatus(
      schemaName,
      device.id,
      body.url ?? `timer:${body.duracao}s`,
      "online",
    );
  } else if (!result.success) {
    // Apenas atualiza status para offline se falha de comunicação
    await updateDeviceContentAndStatus(
      schemaName,
      device.id,
      device.current_content ?? "",
      "offline",
    );
  }

  // --- Passo 4: Salva no histórico ---
  await saveCommandLog(schemaName, {
    deviceId: device.id,
    deviceName: device.name,
    contentUrl: body.url ?? "",
    contentType: body.tipo === "clear" ? "web" : body.tipo,
    protocolUsed:
      result.success && result.protocol !== "none" ? result.protocol : null,
    success: result.success,
    errorMessage: result.success ? null : result.message,
  });

  if (result.success) {
    request.log.info(
      `[TV Cast] ✅ "${device.name}" recebeu '${body.tipo}' via ${result.protocol}`,
    );
  } else {
    request.log.warn(
      `[TV Cast] ⚠️ Falha ao enviar '${body.tipo}' para "${device.name}": ${result.message}`,
    );
  }

  return reply.send({
    dispositivo: {
      id: device.id,
      name: device.name,
      ip_address: device.ip_address,
    },
    resultado: result,
  });
}

// =============================================================================
// HANDLER: pairDevice
// POST /tv/devices/:id/pair
// =============================================================================
// O QUE FAZ:
//   Gera um novo socket_token para o dispositivo e retorna as informações
//   necessárias para conectar o receiver.html na TV ao WebSocket do backend.
//
// CASO DE USO:
//   1. Operador acessa o painel e clica em "Parear TV"
//   2. POST /tv/devices/:id/pair → recebe { socketToken, receiverUrl, qrCodeData }
//   3. Operador exibe o QR code ou a URL na TV
//   4. TV abre o receiverUrl no browser
//   5. receiver.html usa o socketToken para se autenticar no WebSocket
//   6. A partir desse momento, comandos via POST /tv/cast chegam em <100ms
//
// SEGURANÇA:
//   Cada chamada a /pair ROTACIONA o token (gera um novo UUID v4).
//   O token antigo imediatamente para de funcionar.
//   Isso permite "desparear" uma TV simplesmente gerando um novo token.
// =============================================================================
export async function pairDevice(request: FastifyRequest, reply: FastifyReply) {
  const params = PairDeviceParamsSchema.parse(request.params);
  const { schemaName, id: tenantId } = request.tenant!;

  const device = await findTvDeviceById(schemaName, params.id);

  if (!device) {
    return reply.status(404).send({
      statusCode: 404,
      error: "Não Encontrado",
      message: `Dispositivo com ID "${params.id}" não encontrado neste tenant.`,
    });
  }

  // Rotaciona o token — o token antigo é invalidado imediatamente
  const newToken = await rotateSocketToken(schemaName, params.id);

  // URL que a TV deve abrir no browser para se conectar ao receiver.html
  // Em produção, usar HTTPS + domínio real. Este é o caminho via @fastify/static.
  const backendBase = process.env.BACKEND_PUBLIC_URL ?? "http://localhost:3000";
  const receiverUrl =
    `${backendBase}/static/receiver.html` +
    `?token=${newToken}&tenantId=${tenantId}&deviceId=${params.id}`;

  // Gera QR code como data URL (base64 PNG) — a TV pode escanear para abrir a URL
  const qrCodeDataUrl = await QRCode.toDataURL(receiverUrl, {
    width: 280,
    margin: 2,
    errorCorrectionLevel: "M",
  });

  request.log.info(
    `[TV Cast] 🔑 Novo token gerado para "${device.name}" — pareamento iniciado`,
  );

  return reply.send({
    mensagem: `Token gerado. Abra o link receiver na TV "${device.name}".`,
    dispositivo: {
      id: device.id,
      name: device.name,
    },
    socketToken: newToken,
    receiverUrl,
    qrCodeDataUrl,
    instrucoes: [
      "1. Escaneie o QR code ou copie a URL receiverUrl",
      "2. Abra essa URL no navegador da TV",
      "3. A TV aparecerá como 'conectada' no painel após alguns segundos",
      "4. Agora use POST /tv/cast para enviar conteúdo em tempo real",
    ],
  });
}

// =============================================================================
// HANDLER: getDeviceToken
// GET /tv/devices/:id/token
// =============================================================================
// O QUE FAZ:
//   Retorna o socket_token atual do dispositivo SEM rotacioná-lo.
//   Útil para exibir o QR code novamente sem invalidar a sessão atual.
//
// DIFERENÇA vs /pair:
//   /pair → Gera um NOVO token (desconecta receiver atual)
//   /token → Retorna o token EXISTENTE (QR code de releitura)
// =============================================================================
export async function getDeviceToken(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const params = PairDeviceParamsSchema.parse(request.params);
  const { schemaName, id: tenantId } = request.tenant!;

  const device = await findTvDeviceById(schemaName, params.id);

  if (!device) {
    return reply.status(404).send({
      statusCode: 404,
      error: "Não Encontrado",
      message: `Dispositivo com ID "${params.id}" não encontrado neste tenant.`,
    });
  }

  const backendBase = process.env.BACKEND_PUBLIC_URL ?? "http://localhost:3000";
  const receiverUrl =
    `${backendBase}/static/receiver.html` +
    `?token=${device.socket_token}&tenantId=${tenantId}&deviceId=${params.id}`;

  // Gera QR code como data URL (base64 PNG)
  const qrCodeDataUrl = await QRCode.toDataURL(receiverUrl, {
    width: 280,
    margin: 2,
    errorCorrectionLevel: "M",
  });

  return reply.send({
    mensagem: `Token atual da TV "${device.name}". Use POST /pair para gerar um novo.`,
    dispositivo: {
      id: device.id,
      name: device.name,
    },
    socketToken: device.socket_token,
    receiverUrl,
    qrCodeDataUrl,
    aviso:
      "Para gerar um novo token (desconectar receiver atual), use POST /tv/devices/:id/pair",
  });
}

// =============================================================================
// HELPERS DE ERRO (type guards)
// =============================================================================

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
