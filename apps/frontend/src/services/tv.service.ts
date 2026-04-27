// =============================================================================
// src/services/tv.service.ts
// =============================================================================
// O QUE FAZ:
//   Camada de comunicação com todos os endpoints do módulo de TV no Backend.
//   Cada função corresponde a uma rota do Backend (tv.routes.ts).
//
// MAPEAMENTO DE ROTAS (como definido em tv.routes.ts do Backend):
//   GET    /tv/devices              → listDevices()
//   GET    /tv/devices/:id          → getDevice()
//   POST   /tv/devices              → registerDevice()
//   PATCH  /tv/devices/:id          → updateDevice()
//   DELETE /tv/devices/:id          → removeDevice()
//   POST   /tv/control              → controlTv()
//   GET    /tv/discover             → discoverDevices()
//   POST   /tv/devices/:id/wol      → wolDevice()
//   GET    /tv/devices/:id/historico → getDeviceHistory()
//
// POR QUE SEPARAR EM SERVIÇOS?
//   O componente React (TvGrid.tsx) não deve saber que linha de URL chamar,
//   qual método HTTP usar ou como formatar os dados.
//   Ele só precisa chamar: `const { devices } = await tvService.listDevices()`
//   Se a URL do backend mudar, só este arquivo precisa ser atualizado.
// =============================================================================

import api from "./api";
import type {
  TvDevice,
  TvDeviceListResponse,
  TvPlan,
  RegisterTvDeviceInput,
  PairDeviceResponse,
  ControlTvInput,
  ControlTvResponse,
  DiscoveredDevice,
  TvCommandLog,
  MediaFile,
  MediaListResponse,
  TvApp,
  TvAppsResponse,
} from "@/types/api";

// =============================================================================
// FUNÇÃO: listDevices
// =============================================================================
// Busca todos os dispositivos TV do tenant logado.
// Retorna também o total e quantos slots ainda estão disponíveis (máx 5).
// =============================================================================
export async function listDevices(): Promise<TvDeviceListResponse> {
  const response = await api.get<TvDeviceListResponse>("/tv/devices");
  return response.data;
}

// =============================================================================
// FUNÇÃO: getTvPlan
// =============================================================================
// Retorna o plano de TVs do tenant com uso atual: GET /tv/plan
// =============================================================================
export async function getTvPlan(): Promise<TvPlan> {
  const response = await api.get<TvPlan>("/tv/plan");
  return response.data;
}

// =============================================================================
// FUNÇÃO: getDevice
// =============================================================================
// Busca um dispositivo TV específico pelo ID.
// =============================================================================
export async function getDevice(id: string): Promise<TvDevice> {
  const response = await api.get<TvDevice>(`/tv/devices/${id}`);
  return response.data;
}

// =============================================================================
// FUNÇÃO: registerDevice
// =============================================================================
// Cadastra uma nova TV no sistema do tenant.
// Lança erro se o tenant já tem 5 TVs registradas (limite do Backend).
// =============================================================================
export async function registerDevice(
  data: RegisterTvDeviceInput,
): Promise<{ mensagem: string; device: TvDevice }> {
  const response = await api.post<{ mensagem: string; device: TvDevice }>(
    "/tv/devices",
    data,
  );
  return response.data;
}

// =============================================================================
// FUNÇÃO: updateDevice
// =============================================================================
// Atualiza parcialmente os dados de uma TV (nome, IP, MAC).
// Usa método PATCH: apenas os campos enviados são atualizados.
// =============================================================================
export async function updateDevice(
  id: string,
  data: Partial<RegisterTvDeviceInput>,
): Promise<{ mensagem: string; device: TvDevice }> {
  const response = await api.patch<{ mensagem: string; device: TvDevice }>(
    `/tv/devices/${id}`,
    data,
  );
  return response.data;
}

// =============================================================================
// FUNÇÃO: removeDevice
// =============================================================================
// Remove uma TV permanentemente, liberando 1 slot (de 5 disponíveis).
// =============================================================================
export async function removeDevice(id: string): Promise<void> {
  await api.delete(`/tv/devices/${id}`);
}

// =============================================================================
// FUNÇÃO: controlTv
// =============================================================================
// Envia uma URL/conteúdo para ser exibido em uma TV via protocolo UPnP/DIAL.
// O Backend se comunica diretamente com a TV na rede local.
//
// FLUXO:
//   Frontend → Backend → (UPnP SOAP ou DIAL) → Smart TV na rede local
//
// POR QUE EXTRAIR `resultado`?
//   O Backend envelopa a resposta em { dispositivo, resultado, alternativa }.
//   O Frontend só precisa saber se funcionou e qual mensagem exibir.
//   Extrair aqui evita que cada componente que usa controlTv precise
//   lembrar de acessar `.resultado.success` — mais simples e à prova de bugs.
// =============================================================================
export async function controlTv(
  data: ControlTvInput,
): Promise<ControlTvResponse["resultado"]> {
  const response = await api.post<ControlTvResponse>("/tv/control", data);
  // Extrai apenas `resultado` — o componente não precisa dos dados do dispositivo
  return response.data.resultado;
}

// =============================================================================
// FUNÇÃO: discoverDevices
// =============================================================================
// Solicita ao Backend que faça varredura SSDP na rede local.
// Retorna uma lista de Smart TVs e dispositivos UPnP encontrados.
//
// ATENÇÃO: Esta chamada pode demorar até 10 segundos (timeout do SSDP).
// Use com loading state na UI!
//
// POR QUE `dispositivos` e não `discovered`?
//   O Backend retorna `{ dispositivos: [...] }` — a chave em português.
//   A chave antiga `discovered` causava retorno undefined silencioso.
// =============================================================================
export async function discoverDevices(): Promise<DiscoveredDevice[]> {
  const response = await api.get<{ dispositivos: DiscoveredDevice[] }>(
    "/tv/discover",
  );
  return response.data.dispositivos ?? [];
}

// =============================================================================
// FUNÇÃO: wolDevice
// =============================================================================
// Dispara um pacote Wake-on-LAN para ligar uma TV remotamente.
// A TV precisa ter um endereço MAC cadastrado e suportar WoL.
// O Backend monta e envia o magic packet UDP (102 bytes) para broadcast.
// =============================================================================
export async function wolDevice(
  deviceId: string,
): Promise<{ mensagem: string }> {
  const response = await api.post<{ mensagem: string }>(
    `/tv/devices/${deviceId}/wol`,
  );
  return response.data;
}

// =============================================================================
// FUNÇÃO: getDeviceHistory
// =============================================================================
// Busca os últimos comandos enviados para uma TV específica.
// Útil para auditoria e diagnóstico ("por que a TV não está exibindo nada?").
//
// POR QUE `limit` como parâmetro?
//   Permite que o componente de histórico solicite mais ou menos registros
//   sem precisar chamar um endpoint diferente — reutilizável.
// =============================================================================
export async function getDeviceHistory(
  deviceId: string,
  limit = 20,
): Promise<TvCommandLog[]> {
  const response = await api.get<{ historico: TvCommandLog[] }>(
    `/tv/devices/${deviceId}/historico`,
    { params: { limit } },
  );
  return response.data.historico ?? [];
}

// =============================================================================
// FUNÇÃO: listMedia
// =============================================================================
// Busca todos os arquivos de mídia (vídeo/imagem) enviados pelo tenant.
// =============================================================================
export async function listMedia(): Promise<MediaListResponse> {
  const response = await api.get<MediaListResponse>("/tv/media");
  return response.data;
}

// =============================================================================
// FUNÇÃO: uploadMedia
// =============================================================================
// Envia um arquivo de mídia (vídeo ou imagem) para o servidor.
// Usa multipart/form-data — o Axios define o Content-Type automaticamente
// quando recebe um FormData como body, incluindo o boundary correto.
// =============================================================================
export async function uploadMedia(file: File): Promise<MediaFile> {
  const form = new FormData();
  form.append("file", file);
  const response = await api.post<{ mensagem: string; file: MediaFile }>(
    "/tv/media/upload",
    form,
  );
  return response.data.file;
}

// =============================================================================
// FUNÇÃO: deleteMedia
// =============================================================================
// Remove um arquivo de mídia do servidor (banco + disco).
// =============================================================================
export async function deleteMedia(id: string): Promise<void> {
  await api.delete(`/tv/media/${id}`);
}

// =============================================================================
// FUNÇÃO: listApps
// =============================================================================
// Busca o catálogo de apps de Digital Signage disponíveis no sistema.
// =============================================================================
export async function listApps(): Promise<TvAppsResponse> {
  const response = await api.get<TvAppsResponse>("/tv/apps");
  return response.data;
}

// =============================================================================
// FUNÇÃO: castToSocket
// =============================================================================
// Envia um comando de cast via POST /tv/cast (Socket.IO pelo backend).
// Permite enviar mídia, apps ou iniciar espelhamento de tela.
// =============================================================================
export async function castToSocket(payload: {
  deviceId: string;
  tipo: "video" | "image" | "web" | "timer" | "clear" | "screen-share";
  url?: string;
  duracao?: number;
  label?: string;
}): Promise<{ mensagem: string }> {
  const response = await api.post<{ mensagem: string }>("/tv/cast", payload);
  return response.data;
}

// =============================================================================
// FUNÇÃO: pairDevice
// =============================================================================
// Gera um NOVO socket_token para a TV e retorna o QR code + receiverUrl.
// O token anterior é invalidado imediatamente (desconecta receiver atual).
// Use quando precisar reparear a TV (ex: troca de equipamento, token comprometido).
// =============================================================================
export async function pairDevice(
  deviceId: string,
): Promise<PairDeviceResponse> {
  const response = await api.post<PairDeviceResponse>(
    `/tv/devices/${deviceId}/pair`,
  );
  return response.data;
}

// =============================================================================
// FUNÇÃO: getDeviceToken
// =============================================================================
// Retorna o token ATUAL da TV com o QR code — SEM rotacionar.
// Use para exibir o QR code novamente sem desconectar a TV que já está pareada.
// =============================================================================
export async function getDeviceToken(
  deviceId: string,
): Promise<PairDeviceResponse> {
  const response = await api.get<PairDeviceResponse>(
    `/tv/devices/${deviceId}/token`,
  );
  return response.data;
}
