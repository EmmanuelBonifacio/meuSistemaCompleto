// =============================================================================
// src/modules/tv/tv.routes.ts
// =============================================================================
// O QUE FAZ:
//   Registra as rotas do módulo de Controle de Telas como um plugin Fastify.
//   Conecta cada URL ao seu handler no controller.
//
// PROTEÇÃO EM DUAS CAMADAS (preHandler array):
//   1. tenantMiddleware   → Quem você é? (autenticação + carrega request.tenant)
//   2. requireModule('tv') → Você tem acesso a este módulo? (autorização por module)
//
// ROTAS REGISTRADAS (todas com prefixo /tv via server.ts):
//   GET    /tv/plan                 → plano do tenant (tier, modo, limites, uso atual)
//   GET    /tv/devices              → listar todas as TVs do tenant
//   GET    /tv/devices/:id          → detalhe de uma TV
//   POST   /tv/devices              → registrar nova TV (limite por plano / CLIENT)
//   PATCH  /tv/devices/:id          → atualizar dados de uma TV
//   DELETE /tv/devices/:id          → remover TV (libera slot)
//   POST   /tv/control              → enviar conteúdo via UPnP/DIAL (legado)
//   POST   /tv/cast                 → enviar conteúdo waterfall multi-protocolo
//   GET    /tv/discover             → varredura SSDP na rede local
//   POST   /tv/devices/:id/pair     → gerar token + URL receiver.html
//   GET    /tv/devices/:id/token    → ver token atual (sem rotacionar)
//   POST   /tv/devices/:id/wol      → Wake-on-LAN
//   GET    /tv/devices/:id/historico → histórico de comandos
//   --- NOVAS ROTAS DE MÍDIA ---
//   GET    /tv/media                → listar arquivos de mídia do tenant
//   GET    /tv/media/:mediaId       → metadados de um arquivo específico
//   POST   /tv/media/upload         → upload de vídeo ou imagem
//   DELETE /tv/media/:mediaId       → remover arquivo
//   --- APPS DE DIGITAL SIGNAGE ---
//   GET    /tv/apps                 → listar apps disponíveis
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
  getTvPlanHandler,
} from "./tv.controller";
import {
  listMedia,
  uploadMedia,
  removeMedia,
  getMedia,
} from "./tv.media.controller";
import { listApps } from "./tv.apps";
import { checkTvLimit } from "./tv.limit.middleware";

// Middleware de acesso ao módulo TV (reutilizável como preHandler)
// requireModule('tv') retorna uma função que verifica se o tenant tem
// o módulo 'tv' ativo no cadastro do painel admin.
const requireTvModule = requireModule("tv");

export async function tvRoutes(fastify: FastifyInstance) {
  // Prehandler padrão para TODAS as rotas deste plugin
  const guards = [tenantMiddleware, requireTvModule];

  // --------------------------------------------------------------------------
  // GET /tv/plan
  // --------------------------------------------------------------------------
  fastify.get("/plan", { preHandler: guards }, getTvPlanHandler);

  // --------------------------------------------------------------------------
  // GET /tv/devices
  // --------------------------------------------------------------------------
  fastify.get("/devices", { preHandler: guards }, listDevices);

  // --------------------------------------------------------------------------
  // GET /tv/devices/:id
  // --------------------------------------------------------------------------
  fastify.get("/devices/:id", { preHandler: guards }, getDevice);

  // --------------------------------------------------------------------------
  // POST /tv/devices
  // --------------------------------------------------------------------------
  fastify.post("/devices", { preHandler: [...guards, checkTvLimit] }, registerDevice);

  // --------------------------------------------------------------------------
  // PATCH /tv/devices/:id
  // --------------------------------------------------------------------------
  fastify.patch("/devices/:id", { preHandler: guards }, updateDevice);

  // --------------------------------------------------------------------------
  // DELETE /tv/devices/:id
  // --------------------------------------------------------------------------
  fastify.delete("/devices/:id", { preHandler: guards }, removeDevice);

  // --------------------------------------------------------------------------
  // POST /tv/control — legado (UPnP/DIAL direto)
  // --------------------------------------------------------------------------
  fastify.post("/control", { preHandler: guards }, controlTv);

  // --------------------------------------------------------------------------
  // GET /tv/discover — varredura SSDP na rede local
  // --------------------------------------------------------------------------
  fastify.get("/discover", { preHandler: guards }, discoverDevices);

  // --------------------------------------------------------------------------
  // POST /tv/devices/:id/wol — Wake-on-LAN
  // --------------------------------------------------------------------------
  fastify.post("/devices/:id/wol", { preHandler: guards }, wakeDevice);

  // --------------------------------------------------------------------------
  // GET /tv/devices/:id/historico — histórico de comandos
  // --------------------------------------------------------------------------
  fastify.get(
    "/devices/:id/historico",
    { preHandler: guards },
    getDeviceHistory,
  );

  // --------------------------------------------------------------------------
  // POST /tv/cast — waterfall multi-protocolo
  // --------------------------------------------------------------------------
  // Suporta: timer, video, image, web, clear, screen-share
  // --------------------------------------------------------------------------
  fastify.post("/cast", { preHandler: guards }, castToTv);

  // --------------------------------------------------------------------------
  // POST /tv/devices/:id/pair — gera token + URL receiver.html
  // --------------------------------------------------------------------------
  fastify.post("/devices/:id/pair", { preHandler: guards }, pairDevice);

  // --------------------------------------------------------------------------
  // GET /tv/devices/:id/token — ver token atual sem rotacionar
  // --------------------------------------------------------------------------
  fastify.get("/devices/:id/token", { preHandler: guards }, getDeviceToken);

  // ==========================================================================
  // ROTAS DE MÍDIA — Upload, Listagem e Remoção de Arquivos
  // ==========================================================================

  // --------------------------------------------------------------------------
  // GET /tv/media
  // --------------------------------------------------------------------------
  // Lista todos os arquivos de mídia (vídeos e imagens) do tenant.
  // Retorna: id, url, original_name, mime_type, size_bytes, created_at
  // --------------------------------------------------------------------------
  fastify.get("/media", { preHandler: guards }, listMedia);

  // --------------------------------------------------------------------------
  // GET /tv/media/:mediaId
  // --------------------------------------------------------------------------
  // Retorna metadados de um arquivo específico.
  // Útil para preview antes de enviar para a TV.
  // --------------------------------------------------------------------------
  fastify.get("/media/:mediaId", { preHandler: guards }, getMedia);

  // --------------------------------------------------------------------------
  // POST /tv/media/upload
  // --------------------------------------------------------------------------
  // Recebe multipart/form-data com campo 'file'.
  // Valida mime type, salva no disco e registra no banco do tenant.
  // Limite: 100MB por arquivo. Formatos: mp4, webm, jpg, png, gif, webp.
  //
  // NOTA: Esta rota usa o @fastify/multipart que deve estar registrado
  // globalmente no server.ts (como addContentTypeParser).
  // --------------------------------------------------------------------------
  fastify.post("/media/upload", { preHandler: guards }, uploadMedia);

  // --------------------------------------------------------------------------
  // DELETE /tv/media/:mediaId
  // --------------------------------------------------------------------------
  // Remove o arquivo do disco e o registro do banco simultaneamente.
  // Retorna 404 se o arquivo não pertencer ao tenant.
  // --------------------------------------------------------------------------
  fastify.delete("/media/:mediaId", { preHandler: guards }, removeMedia);

  // ==========================================================================
  // ROTAS DE APPS — Catálogo de Aplicativos de Digital Signage
  // ==========================================================================

  // --------------------------------------------------------------------------
  // GET /tv/apps
  // --------------------------------------------------------------------------
  // Retorna o catálogo de apps disponíveis para envio às TVs.
  // Cada app tem: id, name, description, icon, url, category.
  // O operador pode escolher um app e enviar via POST /tv/cast com tipo 'web'.
  // --------------------------------------------------------------------------
  fastify.get("/apps", { preHandler: guards }, listApps);
}
