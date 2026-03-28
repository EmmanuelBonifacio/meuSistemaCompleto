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

  ip_address: z
    .string()
    .ip({
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
