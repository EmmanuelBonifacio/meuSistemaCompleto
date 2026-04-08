// =============================================================================
// src/modules/tv/tv.cast.ts
// =============================================================================
// O QUE FAZ:
//   Orquestrador de envio de conteúdo para TVs usando múltiplos protocolos
//   em cascata (waterfall). Cada protocolo é tentado em ordem de prioridade.
//   Se um falha, o próximo é tentado automaticamente.
//
// WATERFALL DE PROTOCOLOS (ordem de tentativa):
//
//   1. WebSocket (socket.io)           → latência <100ms, bidirecional
//      ↓ se TV não está conectada ao socket
//   2. Chromecast (Cast REST API)      → se chromecast_id cadastrado
//      ↓ se sem chromecast_id ou cast falhou
//   3. DLNA/UPnP (AVTransport SOAP)   → para mídia (video/image)
//      ↓ se UPnP falhou
//   4. DIAL (HTTP POST /apps/Browser)  → para URLs/web
//      ↓ se DIAL falhou
//   → Retorna failure com diagnóstico completo
//
// POR QUE WATERFALL E NÃO PARALELO?
//   Envio paralelo causaria exibição duplicada na TV (dois protocolos
//   bem-sucedidos = vídeo tocando duas vezes, por exemplo).
//   O waterfall garante que apenas UM protocolo efetivamente entrega o conteúdo.
//   A ordem prioriza latência (WebSocket) e compatibilidade (DLNA para TVs antigas).
//
// POR QUE SEPARAR EM tv.cast.ts E NÃO COLOCAR NO tv.service.ts?
//   tv.service.ts já tem 550+ linhas de protocolos UPnP/DIAL/SSDP.
//   tv.cast.ts tem UMA responsabilidade: decidir QUAL protocolo usar.
//   SOLID — Single Responsibility: cada arquivo faz uma coisa.
//   tv.cast.ts ORQUESTRA. tv.service.ts IMPLEMENTA os protocolos.
//
// COMO A IMAGEM DA TABELA SE ENCAIXA AQUI:
//   Timer/Cronômetro → WebSocket (cast:timer) → receiver.html desenha o timer
//   Imagens          → WebSocket OU DLNA (serve via @fastify/static)
//   Vídeos           → WebSocket (<video>) OU DLNA (AVTransport)
//   Multi-conexão    → Waterfall: WebSocket → Chromecast → DIAL → DLNA
// =============================================================================

import { castToDeviceViaSocket, CastPayload } from "./tv.socket";
import { sendContentToDevice, SendContentResult } from "./tv.service";

// =============================================================================
// TIPO: CastInput
// =============================================================================
// Payload completo que o controller envia ao orquestrador.
// =============================================================================
export interface CastInput {
  /** UUID do dispositivo TV no banco do tenant */
  deviceId: string;
  /** Nome da TV (para logs — evita query extra) */
  deviceName: string;
  /** IP da TV (necessário para UPnP/DIAL) */
  ipAddress: string;
  /** ID Chromecast cadastrado no dispositivo (opcional) */
  chromecastId?: string | null;
  /** tenantId para montar o namespace WebSocket (/cast/{tenantId}) */
  tenantId: string;
  /** Payload do conteúdo a ser exibido */
  payload: CastPayload;
  /** Portas opcionais de UPnP e DIAL (defaults: 7676, 8008) */
  upnpPort?: number;
  dialPort?: number;
}

// =============================================================================
// TIPO: CastResult
// =============================================================================
// Resultado do waterfall — informa qual protocolo foi usado (ou todos falharam).
// =============================================================================
export interface CastResult {
  success: boolean;
  /** Qual protocolo entregou o conteúdo */
  protocol: "websocket" | "chromecast" | "upnp" | "dial" | "none";
  message: string;
  /** Detalhes técnicos para diagnóstico (respostas HTTP brutas, etc.) */
  details?: string;
}

// =============================================================================
// FUNÇÃO: castToDevice
// =============================================================================
// O QUE FAZ:
//   Ponto de entrada do orquestrador. Recebe um CastInput e tenta cada
//   protocolo em ordem até um ter sucesso.
//   Retorna CastResult com o protocolo que funcionou (ou 'none' se todos falharam).
//
// COMO CHAMAR:
//   const result = await castToDevice({
//     deviceId: device.id,
//     deviceName: device.name,
//     ipAddress: device.ip_address,
//     chromecastId: device.chromecast_id,
//     tenantId: tenant.id,
//     payload: { tipo: 'timer', duracao: 300, label: 'Fila de atendimento' },
//   });
// =============================================================================
export async function castToDevice(input: CastInput): Promise<CastResult> {
  const { deviceId, tenantId, payload, ipAddress, chromecastId } = input;
  const contentType = payload.tipo;

  // ===========================================================================
  // PROTOCOLO 1: WebSocket (Socket.IO)
  // ===========================================================================
  // POR QUE PRIMEIRO?
  //   Latência <100ms, funciona para TODOS os tipos de conteúdo (timer, vídeo,
  //   imagem, web). Não depende do protocolo da TV — depende apenas do
  //   receiver.html estar aberto no browser da TV.
  // ===========================================================================
  const socketDelivered = castToDeviceViaSocket(tenantId, deviceId, payload);

  if (socketDelivered) {
    return {
      success: true,
      protocol: "websocket",
      message:
        `Conteúdo '${contentType}' enviado via WebSocket com sucesso. ` +
        `O receiver.html na TV receberá o comando em <100ms.`,
    };
  }

  // ===========================================================================
  // PROTOCOLO 2: Chromecast
  // ===========================================================================
  // POR QUE SEGUNDO?
  //   Se a TV tem Chromecast, é uma opção mais confiável que UPnP/DIAL para
  //   reproduzir URLs de vídeo e páginas web. O Chromecast faz o stream
  //   diretamente — não precisa do browser da TV, só do dongles/built-in.
  //
  // IMPLEMENTAÇÃO ATUAL: Stub que simula a chamada à Cast REST API.
  //   A integração real requer o Cast Application Framework (CAF) V3,
  //   rodando no frontend (browser do operador), não no backend Node.js.
  //   O backend aqui pode chamar a REST API de um receiver já aberto
  //   (Media Receiver padrão do Google: CC1AD845).
  //   Para produção: implementar com o pacote 'castv2' ou a API Cast Web SDK.
  //
  // POR QUE NÃO IMPLEMENTAR COMPLETAMENTE AGORA?
  //   É necessário um App ID registrado no Google Cast Developer Console
  //   + o receiver.html hospedado em HTTPS acessível ao Chromecast.
  //   O receiver.html que criamos já pode SERVIR como receiver do Chromecast
  //   quando hospedado via @fastify/static + HTTPS.
  // ===========================================================================
  if (
    chromecastId &&
    (contentType === "video" ||
      contentType === "web" ||
      contentType === "image")
  ) {
    const castResult = await tryChromecast(chromecastId, payload);
    if (castResult.success) {
      return castResult;
    }
    // Chromecast falhou → continua para UPnP/DIAL
  }

  // ===========================================================================
  // PROTOCOLO 3 e 4: DLNA/UPnP + DIAL (já implementados em tv.service.ts)
  // ===========================================================================
  // POR QUE REUTILIZAR sendContentToDevice?
  //   Já implementa UPnP AVTransport + DIAL com fallback interno.
  //   tv.cast.ts não precisa reimplementar — chama e interpreta o resultado.
  //   SOLID — não duplicar lógica: quem sabe fazer SOAP é o tv.service.ts.
  //
  // LIMITAÇÃO: 'timer' não pode ser enviado via UPnP/DIAL.
  //   O timer é uma feature exclusiva do receiver.html (HTML+JS).
  //   Se WebSocket falhou e o conteúdo é 'timer', não há fallback.
  // ===========================================================================
  if (contentType === "timer" || contentType === "clear") {
    return {
      success: false,
      protocol: "none",
      message:
        `Tipo '${contentType}' requer WebSocket — o receiver.html não está ` +
        `conectado. Verifique se a TV abriu a página receiver.html e se o ` +
        `socket_token está correto.`,
    };
  }

  // Para media e web, chama o waterfall UPnP/DIAL existente
  const legacyContentType = contentType as "video" | "image" | "web";
  const legacyResult: SendContentResult = await sendContentToDevice(
    ipAddress,
    payload.url ?? "",
    legacyContentType,
    input.upnpPort,
    input.dialPort,
  );

  return {
    success: legacyResult.success,
    protocol: legacyResult.protocol as CastResult["protocol"],
    message: legacyResult.message,
    details: legacyResult.tvResponse,
  };
}

// =============================================================================
// FUNÇÃO PRIVADA: tryChromecast
// =============================================================================
// O QUE FAZ:
//   Tenta enviar conteúdo via Cast REST API para um Chromecast identificado
//   pelo seu ID de dispositivo.
//
// COMO FUNCIONA A CAST REST API:
//   O Chromecast expõe uma API REST (castv2 protocol / mini-controller):
//   POST http://{chromecast-local-ip}:8008/apps/CC1AD845
//   com o body da mídia a carregar. O Chrome primeiro descobre o IP
//   via mDNS — mas como temos apenas o ID, precisamos descobrir o IP.
//
// STUB ATUAL:
//   Esta é uma implementação educacional que simula o comportamento.
//   Em produção, usar 'castv2' (npm) para descoberta mDNS e controle real.
//   O receiver.html hospedado em HTTPS pode ser registrado como Chromecast
//   Custom Receiver, substituindo o CC1AD845 (Default Media Receiver).
// =============================================================================
async function tryChromecast(
  chromecastId: string,
  payload: CastPayload,
): Promise<CastResult> {
  try {
    // Em produção: descobrir IP via mDNS → enviar via castv2
    // Simula tempo de descoberta mDNS (~200ms) para fins de desenvolvimento
    await new Promise((r) => setTimeout(r, 200));

    // Stub: em desenvolvimento, sempre reporta como não disponível
    // para que o waterfall continue para DLNA.
    // Em produção: substituir por integração real com castv2.
    console.info(
      `[TV Cast] Chromecast ${chromecastId} — integração real pendente. ` +
        `Usando DLNA como fallback.`,
    );

    return {
      success: false,
      protocol: "chromecast",
      message: `Chromecast ${chromecastId}: integração em implementação. Usando DLNA.`,
    };
  } catch (err) {
    return {
      success: false,
      protocol: "chromecast",
      message: `Falha ao contatar Chromecast ${chromecastId}: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
