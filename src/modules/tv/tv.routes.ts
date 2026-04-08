// =============================================================================
// src/modules/tv/tv.routes.ts
// =============================================================================
// O QUE FAZ:
//   Registra as rotas do módulo de Controle de Telas como um plugin Fastify.
//   Conecta cada URL ao seu handler no controller.
//
// PROTEÇÃO EM DUAS CAMADAS (preHandler array):
//   1. tenantMiddleware  → Quem você é? (autenticação + carrega request.tenant)
//   2. requireModule('tv') → Você tem acesso a este módulo? (autorização por module)
//
// ROTAS REGISTRADAS (todas com prefixo /tv via server.ts):
//   GET    /tv/devices         → listar todas as TVs do tenant
//   GET    /tv/devices/:id     → detalhe de uma TV
//   POST   /tv/devices         → registrar nova TV (limite: 5 por tenant)
//   PATCH  /tv/devices/:id     → atualizar dados de uma TV
//   DELETE /tv/devices/:id     → remover TV (libera slot)
//   POST   /tv/control         → enviar conteúdo/URL para uma TV (UPnP/DIAL)
//   GET    /tv/discover        → varredura SSDP na rede local
// =============================================================================

import { FastifyInstance } from "fastify";
import { tenantMiddleware } from "../../core/middleware/tenant.middleware";
import { requireModule } from "../../core/middleware/module.middleware";
import {
  listDevices,
  getDevice,
  registerDevice,
  updateDevice,
  removeDevice,
  controlTv,
  discoverDevices,
  wakeDevice,
  getDeviceHistory,
  castToTv,
  pairDevice,
  getDeviceToken,
} from "./tv.controller";

// Middleware de acesso ao módulo TV (reutilizável como preHandler)
// requireModule('tv') retorna uma função que verifica se o tenant tem
// o módulo 'tv' ativo no cadastro do painel admin.
const requireTvModule = requireModule("tv");

export async function tvRoutes(fastify: FastifyInstance) {
  // Prehandler padrão para TODAS as rotas deste plugin
  const guards = [tenantMiddleware, requireTvModule];

  // --------------------------------------------------------------------------
  // GET /tv/devices
  // --------------------------------------------------------------------------
  // Lista todos os dispositivos TV cadastrados pelo tenant.
  // Resposta inclui: dados dos devices + total + slots disponíveis.
  // --------------------------------------------------------------------------
  fastify.get("/devices", { preHandler: guards }, listDevices);

  // --------------------------------------------------------------------------
  // GET /tv/devices/:id
  // --------------------------------------------------------------------------
  // Retorna detalhes de um único dispositivo, incluindo o current_content
  // (última URL enviada para a tela — útil para polling de apps na TV).
  // --------------------------------------------------------------------------
  fastify.get("/devices/:id", { preHandler: guards }, getDevice);

  // --------------------------------------------------------------------------
  // POST /tv/devices
  // --------------------------------------------------------------------------
  // Registra uma nova TV. Verifica limite de 5 TVs por tenant.
  // Body: { name, ip_address, mac_address? }
  // --------------------------------------------------------------------------
  fastify.post("/devices", { preHandler: guards }, registerDevice);

  // --------------------------------------------------------------------------
  // PATCH /tv/devices/:id
  // --------------------------------------------------------------------------
  // Atualiza campos de uma TV (name, ip_address, mac_address).
  // Todos os campos são opcionais (semântica PATCH).
  // --------------------------------------------------------------------------
  fastify.patch("/devices/:id", { preHandler: guards }, updateDevice);

  // --------------------------------------------------------------------------
  // DELETE /tv/devices/:id
  // --------------------------------------------------------------------------
  // Remove uma TV permanentemente, liberando um slot no limite de 5.
  // --------------------------------------------------------------------------
  fastify.delete("/devices/:id", { preHandler: guards }, removeDevice);

  // --------------------------------------------------------------------------
  // POST /tv/control
  // --------------------------------------------------------------------------
  // Envia conteúdo (URL) para uma TV via UPnP ou DIAL.
  // Body: { deviceId, contentUrl, contentType, upnpPort?, dialPort? }
  //
  // contentType:
  //   'video' | 'image' → UPnP AVTransport (SetAVTransportURI + Play)
  //   'web'             → DIAL (POST /apps/Browser com url=...)
  // --------------------------------------------------------------------------
  fastify.post("/control", { preHandler: guards }, controlTv);

  // --------------------------------------------------------------------------
  // GET /tv/discover
  // --------------------------------------------------------------------------
  // Varre a rede local com SSDP para encontrar Smart TVs e dispositivos UPnP.
  // Query params: ?timeout=5 (segundos, máximo 30)
  //
  // NOTA: Esta rota faz varredura UDP na rede — pode ser lenta dependendo
  // do ambiente. Em produção, considere limitar a frequência de chamadas.
  // --------------------------------------------------------------------------
  fastify.get("/discover", { preHandler: guards }, discoverDevices);

  // --------------------------------------------------------------------------
  // POST /tv/devices/:id/wol
  // --------------------------------------------------------------------------
  // Envia Magic Packet UDP para ligar uma TV via Wake-on-LAN.
  // Requer MAC address cadastrado no dispositivo.
  // --------------------------------------------------------------------------
  fastify.post("/devices/:id/wol", { preHandler: guards }, wakeDevice);

  // --------------------------------------------------------------------------
  // GET /tv/devices/:id/historico
  // --------------------------------------------------------------------------
  // Retorna o histórico de comandos enviados para uma TV específica.
  // Query param: ?limit=50 (padrão 50, máximo 100)
  // --------------------------------------------------------------------------
  fastify.get(
    "/devices/:id/historico",
    { preHandler: guards },
    getDeviceHistory,
  );

  // --------------------------------------------------------------------------
  // POST /tv/cast
  // --------------------------------------------------------------------------
  // Envia conteúdo para uma TV via waterfall multi-protocolo:
  //   WebSocket (socket.io) → Chromecast → UPnP/DLNA → DIAL
  //
  // Suporta: timer, video, image, web, clear
  // Body: { deviceId, tipo, url?, duracao?, label? }
  //
  // Diferença vs POST /tv/control:
  //   /control → UPnP/DIAL direto (legado, sem WebSocket)
  //   /cast    → Waterfall inteligente, prioriza WebSocket (<100ms)
  // --------------------------------------------------------------------------
  fastify.post("/cast", { preHandler: guards }, castToTv);

  // --------------------------------------------------------------------------
  // POST /tv/devices/:id/pair
  // --------------------------------------------------------------------------
  // Gera um novo socket_token para o dispositivo.
  // Retorna a URL do receiver.html com o token embutido na query string.
  // A TV deve abrir essa URL no browser para parear com o WebSocket.
  // ATENÇÃO: rotaciona o token — desconecta sessão anterior do receiver.
  // --------------------------------------------------------------------------
  fastify.post("/devices/:id/pair", { preHandler: guards }, pairDevice);

  // --------------------------------------------------------------------------
  // GET /tv/devices/:id/token
  // --------------------------------------------------------------------------
  // Retorna o socket_token ATUAL (sem rotacionar) e a receiverUrl.
  // Útil para exibir QR code de releitura sem desconectar a TV.
  // --------------------------------------------------------------------------
  fastify.get("/devices/:id/token", { preHandler: guards }, getDeviceToken);
}
