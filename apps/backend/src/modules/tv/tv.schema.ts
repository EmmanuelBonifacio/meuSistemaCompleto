// =============================================================================
// src/modules/tv/tv.schema.ts
// =============================================================================
// O QUE FAZ:
//   Define e valida os formatos de dados de entrada do módulo de TV.
//   Usa Zod para garantir que nunca chegue um payload malformado ao banco.
//
// POR QUE ZOD E NÃO VALIDAÇÃO MANUAL?
//   O Zod valida, transforma e infere tipos TypeScript em uma única operação.
//   Ex: z.string().ip() rejeita "não-sou-um-ip" automaticamente — você não
//   precisa escrever regex de validação de IP sozinho.
//
// CAMPOS ESPECIAIS:
//   ip_address → z.string().ip() valida IPv4 ("192.168.1.10") e IPv6
//   mac_address → regex manual, pois Zod não tem validador nativo de MAC
//   contentType → enum estrito: 'video' | 'image' | 'web'
//                 Define a estratégia de protocolo usada pelo tv.service.ts
// =============================================================================

import { z } from "zod";

// =============================================================================
// SCHEMA: RegisterTvDeviceSchema
// =============================================================================
// Usado em POST /tv/devices — registrar uma nova TV na plataforma.
//
// ip_address: deve ser um IP válido (o Zod valida IPv4 e IPv6).
//   Exemplos válidos: "192.168.0.100", "10.0.1.50", "::1"
//
// mac_address opcional: formato "AA:BB:CC:DD:EE:FF" ou "AA-BB-CC-DD-EE-FF".
//   Necessário para funcionalidades futuras de Wake-on-LAN.
// =============================================================================
export const RegisterTvDeviceSchema = z.object({
  name: z
    .string()
    .min(1, "Nome é obrigatório")
    .max(100, "Nome muito longo (máx 100 chars)")
    .trim(),

  ip_address: z.string().ip({
    message:
      "Endereço IP inválido. Use formato IPv4 (ex: 192.168.1.10) ou IPv6",
  }),

  mac_address: z
    .string()
    // Aceita separadores : ou -  (padrão IEEE EUI-48)
    // Ex válido: "A1:B2:C3:D4:E5:F6" ou "a1-b2-c3-d4-e5-f6"
    .regex(
      /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/,
      "MAC Address inválido. Use formato AA:BB:CC:DD:EE:FF",
    )
    .optional(),

  // device_role distingue TVs do cliente de TVs da plataforma (PLATFORM_ADS).
  // Padrão: CLIENT — TVs da plataforma são registradas pelo admin do sistema.
  device_role: z
    .enum(["CLIENT", "PLATFORM_ADS"], {
      errorMap: () => ({
        message: "device_role deve ser 'CLIENT' ou 'PLATFORM_ADS'",
      }),
    })
    .optional()
    .default("CLIENT"),
});

// =============================================================================
// SCHEMA: UpdateTvDeviceSchema
// =============================================================================
// Usado em PATCH /tv/devices/:id — atualizar campos de um dispositivo.
// `.partial()` torna TODOS os campos opcionais (PATCH semântico).
// Precisa de pelo menos 1 campo preenchido para ter sentido.
// =============================================================================
export const UpdateTvDeviceSchema = RegisterTvDeviceSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: "Informe pelo menos um campo para atualizar" },
);

// =============================================================================
// SCHEMA: TvDeviceParamsSchema
// =============================================================================
// Valida o parâmetro :id nas rotas GET/PATCH/DELETE /tv/devices/:id
// =============================================================================
export const TvDeviceParamsSchema = z.object({
  id: z.string().uuid("ID deve ser um UUID válido"),
});

// =============================================================================
// SCHEMA: ControlTvSchema
// =============================================================================
// Usado em POST /tv/control — enviar conteúdo para uma TV.
//
// CAMPO: contentType
//   'video' → Protocolo UPnP AVTransport (SOAP SetAVTransportURI + Play)
//             Ideal para: vídeos MP4, streams HLS, IPTV
//
//   'image' → Protocolo UPnP AVTransport (igual ao vídeo; Smart TVs
//             aceitam JPG/PNG via SetAVTransportURI)
//
//   'web'   → Protocolo DIAL (Discovery and Launch) ou API proprietária
//             Ideal para: páginas HTML5, dashboards, apps web, painéis
//             A TV abre a URL no seu navegador embutido (Tizen/WebOS/Android)
//
// CAMPO: upnpPort (opcional, default 7676)
//   Porta onde o serviço AVTransport da TV está escutando.
//   Obtida automaticamente na etapa de descoberta (SSDP). Se não souber,
//   os padrões mais comuns são: 7676, 8008, 1400, 49200.
//
// CAMPO: dialPort (opcional, default 8008)
//   Porta do servidor DIAL (para conteúdo do tipo 'web').
//   Samsung Smart TV usa 8001 (nova API) ou 8080 (antiga).
//   LG WebOS usa 3000. Chromecast usa 8008.
// =============================================================================
export const ControlTvSchema = z.object({
  deviceId: z
    .string()
    .uuid("deviceId deve ser um UUID válido — consulte GET /tv/devices"),

  contentUrl: z
    .string()
    .url(
      "contentUrl deve ser uma URL válida (ex: http://meu-servidor/video.mp4)",
    ),

  contentType: z.enum(["video", "image", "web"], {
    errorMap: () => ({
      message: "contentType deve ser: 'video', 'image' ou 'web'",
    }),
  }),

  // Configurações opcionais de protocolo (avançado)
  upnpPort: z.number().int().min(1).max(65535).optional().default(7676),

  dialPort: z.number().int().min(1).max(65535).optional().default(8008),
});

// =============================================================================
// TIPOS INFERIDOS (TypeScript via Zod)
// =============================================================================
// Inferir tipos dos schemas evita duplicação: um único lugar de verdade.
// Usado no controller e repository para type safety.
// =============================================================================
export type RegisterTvDeviceInput = z.infer<typeof RegisterTvDeviceSchema>;
export type UpdateTvDeviceInput = z.infer<typeof UpdateTvDeviceSchema>;
export type ControlTvInput = z.infer<typeof ControlTvSchema>;

// =============================================================================
// SCHEMA: CastPayloadSchema
// =============================================================================
// Usado em POST /tv/cast — enviar conteúdo para uma TV via waterfall de
// múltiplos protocolos (WebSocket → Chromecast → UPnP/DIAL).
//
// CAMPO: tipo
//   'timer'  → Cronômetro HTML+JS rodando no receiver.html na TV.
//              ÚNICO protocolo disponível: WebSocket. Se TV não estiver
//              conectada ao socket, o envio falha completamente.
//              Requer: duracao (segundos)
//
//   'video'  → Reproduz vídeo (MP4, HLS, IPTV stream).
//              Waterfall: WebSocket → Chromecast → UPnP AVTransport
//              Requer: url (URL do stream ou arquivo)
//
//   'image'  → Exibe imagem em fullscreen.
//              Waterfall: WebSocket → Chromecast → UPnP AVTransport
//              Requer: url (URL da imagem JPG/PNG)
//
//   'web'    → Abre URL em fullscreen (iframe no receiver.html)
//              Waterfall: WebSocket → Chromecast → DIAL
//              Requer: url (URL da página)
//
//   'clear'  → Limpa a tela — volta ao estado de espera.
//              ÚNICO protocolo disponível: WebSocket.
//              Sem parâmetros adicionais.
//
// VALIDAÇÃO CROSS-FIELD (refinamento Zod):
//   'timer' → duracao obrigatório (em segundos, 1–86400)
//   'video' | 'image' | 'web' → url obrigatório
//   'clear' → nenhum campo adicional necessário
// =============================================================================
export const CastPayloadSchema = z
  .object({
    deviceId: z
      .string()
      .uuid("deviceId deve ser um UUID válido — consulte GET /tv/devices"),

    tipo: z.enum(["timer", "video", "image", "web", "clear", "screen-share"], {
      errorMap: () => ({
        message:
          "tipo deve ser: 'timer', 'video', 'image', 'web', 'clear' ou 'screen-share'",
      }),
    }),

    url: z
      .string()
      .url("url deve ser uma URL válida (ex: https://servidor/video.mp4)")
      .optional(),

    duracao: z
      .number()
      .int("duracao deve ser um número inteiro de segundos")
      .min(1, "duracao mínima: 1 segundo")
      .max(86400, "duracao máxima: 86400 segundos (24 horas)")
      .optional(),

    // Texto exibido no cronômetro (ex: "Fila de Atendimento", "Exame em")
    label: z
      .string()
      .max(100, "label muito longa (máx 100 caracteres)")
      .optional(),
  })
  .refine(
    (data) => {
      if (data.tipo === "timer" && !data.duracao) return false;
      if (["video", "image", "web"].includes(data.tipo) && !data.url)
        return false;
      // screen-share e clear não exigem url nem duracao
      return true;
    },
    {
      message:
        "'timer' requer o campo 'duracao' (segundos). " +
        "'video', 'image' e 'web' requerem o campo 'url'.",
    },
  );

// =============================================================================
// SCHEMA: PairDeviceParamsSchema
// =============================================================================
// Usado em POST /tv/devices/:id/pair — obtém socket_token do dispositivo.
// Reutiliza TvDeviceParamsSchema (mesma validação de UUID).
// =============================================================================
export const PairDeviceParamsSchema = TvDeviceParamsSchema;

export type CastPayloadInput = z.infer<typeof CastPayloadSchema>;
