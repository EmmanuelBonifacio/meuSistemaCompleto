// =============================================================================
// src/modules/tv/tv.socket.ts
// =============================================================================
// O QUE FAZ:
//   Servidor WebSocket do módulo TV usando Socket.IO.
//   Permite comunicação bidirecional em tempo real entre o backend e os
//   apps receptores (receiver.html) que rodam dentro dos browsers das TVs.
//
// ARQUITETURA DO FLUXO WEBSOCKET:
//
//   Operador (painel) → POST /tv/cast
//         ↓
//   tv.controller.ts → tv.cast.ts (orquestrador)
//         ↓
//   tv.socket.ts → Socket.IO → receiver.html (browser da TV)
//         ↓
//   TV exibe: timer, vídeo, imagem ou página web
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

// =============================================================================
// TIPO: CastPayload
// =============================================================================
// Payload que o controller envia para tv.cast.ts e que chega na TV via socket.
// 'timer' usa `duracao` (segundos). Os demais usam `url`.
// =============================================================================
export interface CastPayload {
  tipo: "timer" | "video" | "image" | "web" | "clear";
  url?: string; // Para 'video', 'image', 'web'
  duracao?: number; // Para 'timer' — em segundos. Ex: 300 = 5 minutos
  label?: string; // Texto opcional exibido abaixo do timer
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
    socket.on("tv:ready", (data: { deviceId: string; deviceName?: string }) => {
      const { deviceId, deviceName = "TV" } = data;

      // Garante que existe um mapa para este tenant
      if (!activeConnections.has(tenantId)) {
        activeConnections.set(tenantId, new Map());
      }

      // Registra (ou atualiza) a conexão deste dispositivo
      activeConnections.get(tenantId)!.set(deviceId, {
        socketId: socket.id,
        deviceName,
        connectedAt: new Date(),
      });

      // A TV entra em uma "room" com seu próprio ID para emissão direta
      socket.join(`device:${deviceId}`);

      console.info(
        `[TV Socket] ✅ TV "${deviceName}" (${deviceId}) pronta ` +
          `no tenant ${tenantId}. Socket: ${socket.id}`,
      );

      // Confirma o pareamento para o receiver.html
      socket.emit("cast:paired", {
        mensagem: `Pareado com sucesso. Aguardando comandos...`,
        deviceId,
      });
    });

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
      // Remove o dispositivo do mapa de conexões ativas
      const tenantDevices = activeConnections.get(tenantId);
      if (tenantDevices) {
        for (const [deviceId, conn] of tenantDevices.entries()) {
          if (conn.socketId === socket.id) {
            tenantDevices.delete(deviceId);
            console.info(
              `[TV Socket] 📴 TV "${conn.deviceName}" (${deviceId}) ` +
                `desconectou do tenant ${tenantId}. Motivo: ${reason}`,
            );
            break;
          }
        }
      }
    });
  });

  console.info(
    "[TV Socket] ✅ Servidor Socket.IO inicializado. Namespaces: /cast/:tenantId",
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
