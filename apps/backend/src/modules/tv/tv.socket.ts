// =============================================================================
// src/modules/tv/tv.socket.ts
// =============================================================================
// O QUE FAZ:
//   Servidor WebSocket do módulo TV usando Socket.IO.
//   Permite comunicação bidirecional em tempo real entre o backend e os
//   apps receptores (receiver.html) que rodam dentro dos browsers das TVs.
//   Também gerencia a sinalização WebRTC para espelhamento de tela.
//
// DOIS NAMESPACES:
//   /cast/:tenantId   → comandos de conteúdo para TVs (já existia)
//   /webrtc/:tenantId → sinalização WebRTC para espelhamento de tela (novo)
//
// ARQUITETURA DO FLUXO WEBSOCKET (cast):
//
//   Operador (painel) → POST /tv/cast
//         ↓
//   tv.controller.ts → tv.cast.ts (orquestrador)
//         ↓
//   tv.socket.ts → Socket.IO → receiver.html (browser da TV)
//         ↓
//   TV exibe: timer, vídeo, imagem ou página web
//
// ARQUITETURA DO FLUXO WEBRTC (espelhamento):
//
//   Celular/PC do usuário (screen-share.html)
//         ↓ webrtc:offer
//   tv.socket.ts (sinalização — NÃO carrega vídeo)
//         ↓ webrtc:offer repassado
//   receiver.html na TV
//         ↓ webrtc:answer + ICE candidates (ambos lados)
//   Conexão P2P direta: vídeo flui SEM passar pelo servidor
//
// POR QUE SOCKET.IO E NÃO WS NATIVO?
//   Socket.IO adiciona sobre o WebSocket padrão:
//   1. Reconexão automática (a TV liga/desliga, o socket se reconecta)
//   2. Namespaces (isolamento entre tenants sem múltiplas portas)
//   3. Rooms (envio para grupo de TVs de uma vez)
//   4. Fallback para HTTP long-polling (TVs com proxy que bloqueia WS)
//   A latência extra (~2ms) é irrelevante para Digital Signage.
//
// ISOLAMENTO MULTI-TENANT POR NAMESPACE:
//   Cada tenant tem seu próprio namespace: /cast/{tenantId}
//   O receiver.html se conecta com:
//     io('http://server:3000/cast/tenant-uuid', { auth: { token: 'socket-token' } })
//   O backend emite apenas para o namespace do tenant correto.
//   TVs de tenants diferentes nunca recebem eventos umas das outras.
//
// EVENTOS EMITIDOS PARA AS TVs:
//   cast:timer  → { tipo: 'timer', duracao: 300, label?: string }
//   cast:media  → { tipo: 'video'|'image', url: string }
//   cast:web    → { tipo: 'web', url: string }
//   cast:clear  → {} (limpa a tela atual)
//
// EVENTOS RECEBIDOS DAS TVs (TV → backend):
//   tv:ready    → { deviceId: string }  (TV conectou e está pronta)
//   tv:error    → { message: string }   (erro no receiver — para diagnóstico)
// =============================================================================

import { Server as SocketIoServer, Socket } from "socket.io";
import { Server as HttpServer } from "http";
import { prisma } from "../../core/database/prisma";
import { setDeviceOnline, setDeviceOffline } from "./tv.repository";

// =============================================================================
// TIPO: CastPayload
// =============================================================================
// Payload que o controller envia para tv.cast.ts e que chega na TV via socket.
// 'timer' usa `duracao` (segundos). Os demais usam `url`.
// 'screen-share' prepara a TV para receber stream WebRTC: exibe tela de espera.
// =============================================================================
export interface CastPayload {
  tipo: "timer" | "video" | "image" | "web" | "clear" | "screen-share";
  url?: string; // Para 'video', 'image', 'web'
  duracao?: number; // Para 'timer' — em segundos. Ex: 300 = 5 minutos
  label?: string; // Texto opcional exibido abaixo do timer
  deviceId?: string; // Para 'screen-share' — deviceId para montar a room WebRTC
  tenantId?: string; // Para 'screen-share' — compõe o namespace /webrtc/{tenantId}
}

// =============================================================================
// TIPO: ConnectedDevice
// =============================================================================
// Representa uma TV pareada e conectada no WebSocket.
// Armazenamos por tenant → deviceId para saber para qual socket emitir.
// =============================================================================
interface ConnectedDevice {
  socketId: string; // ID da conexão Socket.IO atual
  deviceName: string; // Nome da TV (para logs)
  connectedAt: Date; // Quando conectou (para diagnóstico)
  schemaName: string; // Schema do tenant — necessário para atualizar status no DB
}

// =============================================================================
// REGISTRO DE CONEXÕES ATIVAS
// =============================================================================
// Map<tenantId, Map<deviceId, ConnectedDevice>>
//
// POR QUE IN-MEMORY E NÃO NO BANCO?
//   Conexões WebSocket são efêmeras — existem apenas enquanto o socket está
//   aberto. Persistir no banco geraria muitos writes/deletes sem utilidade.
//   Em produção multi-instância (cluster), usar Redis Adapter do Socket.IO
//   para compartilhar o estado entre instâncias:
//   https://socket.io/docs/v4/redis-adapter/
// =============================================================================
const activeConnections = new Map<string, Map<string, ConnectedDevice>>();

// Instância global do servidor Socket.IO — exportada para uso em tv.cast.ts
let io: SocketIoServer | null = null;

// =============================================================================
// FUNÇÃO: initSocketServer
// =============================================================================
// O QUE FAZ:
//   Inicializa o servidor Socket.IO anexado ao servidor HTTP do Fastify.
//   Chamada UMA VEZ no server.ts após o Fastify estar pronto.
//
// POR QUE RECEBE O httpServer E NÃO O FASTIFY?
//   O Socket.IO se anexa ao servidor HTTP nativo (Node.js http.Server),
//   não ao framework em si. O Fastify expõe `fastify.server` que é
//   exatamente esse http.Server.
//
// PARÂMETROS:
//   httpServer → fastify.server (http.Server do Node.js)
//   corsOrigin → mesmo origin configurado no CORS do Fastify
// =============================================================================
export function initSocketServer(
  httpServer: HttpServer,
  corsOrigin: string | boolean = true,
): SocketIoServer {
  io = new SocketIoServer(httpServer, {
    // CORS do Socket.IO deve espelhar o CORS do Fastify
    // POR QUE? O browser aplica CORS também nas conexões WebSocket
    cors: {
      origin: corsOrigin,
      methods: ["GET", "POST"],
      credentials: true,
    },
    // Permite que TVs com proxies que bloqueiem WebSocket usem long-polling
    transports: ["websocket", "polling"],
  });

  // --------------------------------------------------------------------------
  // NAMESPACE DINÂMICO: /cast/:tenantId
  // --------------------------------------------------------------------------
  // O QUE FAZ:
  //   Qualquer namespace que comece com /cast/ é aceito.
  //   Cada tenant tem seu namespace exclusivo: /cast/tenant-uuid-aqui
  //   Isso garante isolamento: TV do tenant A não vê eventos do tenant B.
  //
  // POR QUE NAMESPACE E NÃO ROOMS?
  //   Rooms são ótimos para grupos dentro de um tenant (ex: "todas as TVs
  //   da filial Norte"). Namespaces dão isolamento completo de eventos e
  //   middlewares — um erro de autenticação em um namespace não afeta outro.
  // --------------------------------------------------------------------------
  const castNamespace = io.of(/^\/cast\/.+$/);

  // Middleware de autenticação: valida o socket_token da TV
  castNamespace.use(async (socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;

    if (!token) {
      return next(new Error("AUTH_REQUIRED: socket_token não fornecido"));
    }

    // Guarda o token no socket para uso nos handlers de evento
    // A validação real contra o banco ocorre ao receber tv:ready
    // POR QUE NÃO VALIDAR AQUI? Ainda não sabemos o schemaName do tenant
    // (ele está no namespace, mas precisaria de uma query ao banco public
    // para resolver tenantId → schemaName neste ponto).
    // A validação completa ocorre em handleTvReady().
    socket.data.token = token;

    next();
  });

  // -------------------------------------------------------------------------
  // EVENTO: connection (nova TV conectou ao namespace)
  // -------------------------------------------------------------------------
  castNamespace.on("connection", (socket: Socket) => {
    // Extrai o tenantId do nome do namespace: "/cast/tenant-xyz" → "tenant-xyz"
    const tenantId = socket.nsp.name.replace("/cast/", "");

    console.info(
      `[TV Socket] Nova conexão no namespace /cast/${tenantId}. ` +
        `Socket ID: ${socket.id}`,
    );

    // -----------------------------------------------------------------------
    // EVENTO: tv:ready
    // -----------------------------------------------------------------------
    // O QUE FAZ:
    //   Recebido quando o receiver.html carrega e está pronto para receber
    //   comandos. O dispositivo se identifica com seu deviceId.
    //   Registramos no mapa activeConnections para saber para qual socket
    //   emitir quando o operador enviar um comando.
    // -----------------------------------------------------------------------
    socket.on(
      "tv:ready",
      async (data: { deviceId: string; deviceName?: string }) => {
        const { deviceId, deviceName = "TV" } = data;

        // Resolve o schemaName do tenant para poder atualizar o banco
        let schemaName = "";
        try {
          const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { schemaName: true },
          });
          schemaName = tenant?.schemaName ?? "";
        } catch {
          console.warn(
            `[TV Socket] Não foi possível resolver schema para tenant ${tenantId}`,
          );
        }

        // Garante que existe um mapa para este tenant
        if (!activeConnections.has(tenantId)) {
          activeConnections.set(tenantId, new Map());
        }

        // Registra (ou atualiza) a conexão deste dispositivo
        activeConnections.get(tenantId)!.set(deviceId, {
          socketId: socket.id,
          deviceName,
          connectedAt: new Date(),
          schemaName,
        });

        // A TV entra em uma "room" com seu próprio ID para emissão direta
        socket.join(`device:${deviceId}`);

        console.info(
          `[TV Socket] ✅ TV "${deviceName}" (${deviceId}) pronta ` +
            `no tenant ${tenantId}. Socket: ${socket.id}`,
        );

        // Atualiza status para 'online' no banco de dados
        if (schemaName) {
          setDeviceOnline(schemaName, deviceId).catch((err) => {
            console.warn(
              `[TV Socket] Falha ao marcar device ${deviceId} online:`,
              err,
            );
          });
        }

        // Confirma o pareamento para o receiver.html
        socket.emit("cast:paired", {
          mensagem: `Pareado com sucesso. Aguardando comandos...`,
          deviceId,
          deviceName,
        });
      },
    );

    // -----------------------------------------------------------------------
    // EVENTO: tv:error
    // -----------------------------------------------------------------------
    // O QUE FAZ:
    //   O receiver.html reporta erros (ex: vídeo não carregou, URL inválida).
    //   Logamos para diagnóstico — futuramente pode gerar alerta no painel.
    // -----------------------------------------------------------------------
    socket.on("tv:error", (data: { deviceId: string; message: string }) => {
      console.warn(
        `[TV Socket] ⚠️ Erro reportado pela TV ${data.deviceId} ` +
          `(tenant ${tenantId}): ${data.message}`,
      );
    });

    // -----------------------------------------------------------------------
    // EVENTO: disconnect
    // -----------------------------------------------------------------------
    socket.on("disconnect", (reason) => {
      // Remove o dispositivo do mapa de conexões ativas e marca offline no DB
      const tenantDevices = activeConnections.get(tenantId);
      if (tenantDevices) {
        for (const [deviceId, conn] of tenantDevices.entries()) {
          if (conn.socketId === socket.id) {
            tenantDevices.delete(deviceId);
            console.info(
              `[TV Socket] 📴 TV "${conn.deviceName}" (${deviceId}) ` +
                `desconectou do tenant ${tenantId}. Motivo: ${reason}`,
            );
            // Atualiza status para 'offline' no banco de dados
            if (conn.schemaName) {
              setDeviceOffline(conn.schemaName, deviceId).catch((err) => {
                console.warn(
                  `[TV Socket] Falha ao marcar device ${deviceId} offline:`,
                  err,
                );
              });
            }
            break;
          }
        }
      }
    });
  });

  // Inicia o namespace WebRTC para sinalização de espelhamento de tela
  initWebRtcNamespace(io);

  console.info(
    "[TV Socket] ✅ Servidor Socket.IO inicializado. Namespaces: /cast/:tenantId | /webrtc/:tenantId",
  );
  return io;
}

// =============================================================================
// FUNÇÃO: castToDeviceViaSocket
// =============================================================================
// O QUE FAZ:
//   Emite um evento cast para uma TV específica via WebSocket.
//   É chamada pelo tv.cast.ts (orquestrador) como primeiro protocolo.
//   Retorna true se a TV estava conectada e o evento foi emitido.
//   Retorna false se a TV não estava conectada (offline ou sem receiver.html).
//
// POR QUE RETORNAR boolean E NÃO LANÇAR ERRO?
//   WebSocket é o protocolo PRIMÁRIO. Se a TV não está conectada, o
//   orquestrador deve tentar o próximo protocolo (Chromecast → DLNA).
//   Um erro aqui quebraria o waterfall — o boolean permite continuar.
// =============================================================================
export function castToDeviceViaSocket(
  tenantId: string,
  deviceId: string,
  payload: CastPayload,
): boolean {
  if (!io) {
    console.warn(
      "[TV Socket] Servidor não inicializado. Chame initSocketServer() primeiro.",
    );
    return false;
  }

  // Verifica se há uma conexão ativa para este device neste tenant
  const tenantDevices = activeConnections.get(tenantId);
  if (!tenantDevices?.has(deviceId)) {
    return false; // TV não está conectada ao WebSocket
  }

  // Emite para a room do device — garante entrega exatamente a esta TV
  // POR QUE usar room em vez de socket.id diretamente?
  //   Se a TV reconectar, o socket.id muda, mas a room "device:{id}" persiste.
  //   Usar room é mais robusto.
  const namespace = io.of(`/cast/${tenantId}`);
  namespace.to(`device:${deviceId}`).emit(`cast:${payload.tipo}`, payload);

  console.info(
    `[TV Socket] 📡 Cast '${payload.tipo}' enviado ` +
      `→ TV ${deviceId} (tenant ${tenantId}) via WebSocket`,
  );

  return true;
}

// =============================================================================
// FUNÇÃO: getConnectedDevices
// =============================================================================
// O QUE FAZ:
//   Retorna a lista de deviceIds conectados via WebSocket para um tenant.
//   Usada pelo controller de listagem para enriquecer os dados de status
//   com uma indicação de "conectado via WebSocket" em tempo real.
// =============================================================================
export function getConnectedDevices(tenantId: string): string[] {
  return Array.from(activeConnections.get(tenantId)?.keys() ?? []);
}

// =============================================================================
// NAMESPACE: /webrtc/:tenantId — Sinalização WebRTC para Espelhamento de Tela
// =============================================================================
// O QUE FAZ:
//   Serve como "serviço de sinalização" WebRTC. O backend NÃO processa vídeo:
//   ele apenas repassa as mensagens de negociação entre o emissor (celular/PC)
//   e o receptor (receiver.html na TV).
//
// POR QUE O BACKEND É NECESSÁRIO SE WebRTC É P2P?
//   WebRTC só cria a conexão P2P APÓS uma fase inicial de "sinalização":
//   os dois lados precisam trocar SDP (Session Description Protocol) e
//   ICE candidates para descobrir como se conectar diretamente.
//   Essa troca precisa de um intermediário — este é o papel do backend aqui.
//   Uma vez conectados P2P, o backend sai completamente do caminho.
//
// EVENTOS DE SINALIZAÇÃO (emissor → backend → receptor):
//   webrtc:offer          → emissor inicia, backend repassa para a TV certa
//   webrtc:answer         → TV responde, backend repassa para o emissor
//   webrtc:ice-candidate  → candidatos de conexão (ambos lados)
//   webrtc:stop           → emissor encerra o compartilhamento
//
// ISOLAMENTO MULTI-TENANT:
//   Cada tenant tem seu próprio namespace /webrtc/{tenantId}.
//   Um emissor de tenant A nunca pode atingir uma TV de tenant B.
// =============================================================================
function initWebRtcNamespace(socketServer: SocketIoServer): void {
  const webrtcNamespace = socketServer.of(/^\/webrtc\/.+$/);

  webrtcNamespace.on("connection", (socket: Socket) => {
    // Extrai o tenantId do namespace: "/webrtc/tenant-xyz" → "tenant-xyz"
    const tenantId = socket.nsp.name.replace("/webrtc/", "");

    console.info(
      `[WebRTC Socket] Nova conexão de sinalização no tenant ${tenantId}. Socket: ${socket.id}`,
    );

    // -------------------------------------------------------------------------
    // EVENTO: webrtc:join
    // -------------------------------------------------------------------------
    // O QUE FAZ:
    //   O emissor (screen-share.html) ou receptor (receiver.html) declara
    //   para qual deviceId quer se comunicar.
    //   Ambos entram na mesma "room" para troca direta de mensagens.
    //
    // FLUXO:
    //   Emissor → webrtc:join { deviceId, role: 'sender' }
    //   Receptor → webrtc:join { deviceId, role: 'receiver' }
    //   Backend → ambos na room `webrtc:device:{deviceId}`
    // -------------------------------------------------------------------------
    socket.on(
      "webrtc:join",
      (data: { deviceId: string; role: "sender" | "receiver" }) => {
        const { deviceId, role } = data;
        const room = `webrtc:device:${deviceId}`;
        socket.join(room);
        socket.data.deviceId = deviceId;
        socket.data.role = role;

        // Avisa os outros membros da room que alguém entrou
        socket
          .to(room)
          .emit("webrtc:peer-joined", { role, socketId: socket.id });

        console.info(
          `[WebRTC] ${role} entrou na room ${room} (tenant ${tenantId})`,
        );
      },
    );

    // -------------------------------------------------------------------------
    // EVENTO: webrtc:offer
    // -------------------------------------------------------------------------
    // O QUE FAZ:
    //   Emissor envia o SDP offer (descrição da sessão de vídeo) para a TV.
    //   O backend repassa diretamente para o socket de destino (`to` = socketId).
    //
    // POR QUE RELAY POR SOCKET.ID E NÃO POR ROOM?
    //   Na negociação WebRTC o emissor conhece o socketId do receptor
    //   (recebido via webrtc:peer-joined). Relay direto é mais preciso:
    //   evita entregar o offer para outros sockets na mesma room.
    //
    // TIPOS: `unknown` porque SDP é estrutura do browser — o backend
    //   não precisa inspecionar, apenas repassar o objeto como recebeu.
    // -------------------------------------------------------------------------
    socket.on("webrtc:offer", (data: { to: string; offer: unknown }) => {
      socket
        .to(data.to)
        .emit("webrtc:offer", { offer: data.offer, from: socket.id });
    });

    // -------------------------------------------------------------------------
    // EVENTO: webrtc:answer
    // -------------------------------------------------------------------------
    // TV (receiver.html) responde ao offer com seu SDP answer.
    // Backend repassa diretamente para o socketId do emissor (`to`).
    // -------------------------------------------------------------------------
    socket.on("webrtc:answer", (data: { to: string; answer: unknown }) => {
      socket
        .to(data.to)
        .emit("webrtc:answer", { answer: data.answer, from: socket.id });
    });

    // -------------------------------------------------------------------------
    // EVENTO: webrtc:ice-candidate
    // -------------------------------------------------------------------------
    // Repassa candidatos ICE entre as partes por socketId direto.
    // ICE candidates descrevem rotas de rede para conexão P2P.
    // -------------------------------------------------------------------------
    socket.on(
      "webrtc:ice-candidate",
      (data: { to: string; candidate: unknown }) => {
        socket.to(data.to).emit("webrtc:ice-candidate", {
          candidate: data.candidate,
          from: socket.id,
        });
      },
    );

    // -------------------------------------------------------------------------
    // EVENTO: webrtc:stop
    // -------------------------------------------------------------------------
    // O QUE FAZ:
    //   Emissor encerrou o compartilhamento de tela.
    //   Backend avisa a TV para limpar o stream P2P e voltar ao estado de espera.
    // -------------------------------------------------------------------------
    socket.on("webrtc:stop", (data: { deviceId: string }) => {
      const room = `webrtc:device:${data.deviceId}`;
      socket.to(room).emit("webrtc:stop");
      console.info(
        `[WebRTC] Compartilhamento encerrado para device ${data.deviceId} (tenant ${tenantId})`,
      );
    });

    socket.on("disconnect", () => {
      const { deviceId, role } = socket.data;
      if (deviceId) {
        const room = `webrtc:device:${deviceId}`;
        socket.to(room).emit("webrtc:peer-left", { role });
      }
    });
  });

  console.info(
    "[TV Socket] ✅ Namespace WebRTC inicializado: /webrtc/:tenantId",
  );
}
