// =============================================================================
// src/types/api.ts
// =============================================================================
// O QUE FAZ:
//   Define as interfaces TypeScript que espelham as respostas do Backend.
//   Isso garante type-safety de ponta a ponta: você sabe exatamente quais
//   campos existem e quais são opcionais ao trabalhar com dados da API.
//
// PRINCÍPIO DE DESIGN:
//   Cada interface aqui corresponde a uma entidade ou resposta do Backend.
//   Ao invés de usar `any`, tipamos tudo explicitamente — o TypeScript
//   nos avisará se o Backend mudar a estrutura de resposta.
//
// COMO USAR:
//   import type { TvDevice, Produto } from '@/types/api'
// =============================================================================

// =============================================================================
// TIPOS: Autenticação e Usuário
// =============================================================================

/**
 * Payload que o Backend injeta dentro do JWT.
 * Quando decodificamos o token no front, temos acesso a estes campos.
 * Definido em src/core/types/fastify.d.ts no Backend.
 */
export interface JwtPayload {
  sub: string; // ID único do usuário (UUID)
  tenantId: string; // ID do tenant ao qual este usuário pertence
  role: "admin" | "user" | "superadmin"; // Nível de permissão
  iat?: number; // "issued at" — quando o token foi gerado (Unix timestamp)
  exp?: number; // "expires at" — quando o token expira (Unix timestamp)
}

/**
 * Resposta do endpoint GET /me
 * Retorna informações sobre o usuário logado e seu tenant.
 */
export interface MeResponse {
  mensagem: string;
  tenant: {
    id: string;
    slug: string;
    schemaName: string;
  };
  usuario: {
    id: string;
    role: string;
  };
}

/**
 * Resposta do endpoint POST /dev/token (apenas em desenvolvimento!)
 * Em produção, o token viria de um endpoint de login real com senha.
 */
export interface DevTokenResponse {
  token: string;
  instruções: string;
}

// =============================================================================
// TIPOS: Tenant (dados do cliente SaaS)
// =============================================================================

/**
 * Representa um módulo do sistema (Estoque, Financeiro, TV Control, etc.)
 * Retornado pela API de Admin junto com os tenants.
 */
export interface Module {
  id: string;
  name: string; // Ex: "estoque", "financeiro", "tv"
  displayName: string; // Ex: "Gestão de Estoque", "Controle Financeiro"
  description?: string;
}

/**
 * Ligação entre Tenant e Module — indica que um módulo está ativo
 * para aquele tenant específico.
 */
export interface TenantModule {
  id: string;
  moduleId: string; // ID do módulo (referenciado para toggle)
  isActive: boolean;
  module: Module;
}

/**
 * Dados completos de um Tenant (retornado pela API de Admin).
 */
export interface Tenant {
  id: string;
  name: string;
  slug: string;
  schemaName: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  modules: TenantModule[];
}

/**
 * Log de acesso de um tenant a um módulo.
 * Retornado por GET /admin/tenants/:id/logs
 */
export interface RequestLog {
  id: string;
  module: string;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  createdAt: string;
}

// =============================================================================
// TIPOS: Usuários de Tenant (gestão pelo painel admin)
// =============================================================================

/**
 * Usuário cadastrado dentro de um schema de tenant.
 * Retornado por GET /admin/tenants/:id/users
 * NÃO inclui password_hash — nunca expor hash em respostas HTTP.
 */
export interface TenantUser {
  id: string;
  email: string;
  name: string | null;
  role: "admin" | "user";
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** Body para criar usuário via painel admin: POST /admin/tenants/:id/users */
export interface CreateTenantUserInput {
  email: string;
  name: string;
  password: string;
  role: "admin" | "user";
}

/** Body para atualizar usuário: PATCH /admin/tenants/:id/users/:userId */
export interface UpdateTenantUserInput {
  name?: string;
  role?: "admin" | "user";
  isActive?: boolean;
}

/** Body para reset de senha: POST /admin/tenants/:id/users/:userId/reset-password */
export interface ResetPasswordInput {
  newPassword: string;
}

/**
 * Versão resumida do Tenant para listagens.
 */
export interface TenantSummary {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  createdAt: string;
  activeModulesCount: number;
}

/**
 * Resposta paginada da listagem de tenants: GET /admin/tenants
 */
export interface TenantListResponse {
  data: TenantSummary[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Estatísticas do sistema: GET /admin/stats
 */
export interface SystemStats {
  totalTenants: number;
  activeTenants: number;
  inactiveTenants: number;
  totalUsers?: number; // Total de usuários no sistema
  totalModuleActivations: number;
  moduleUsage: {
    moduleName: string;
    displayName: string;
    activeCount: number;
  }[];
}

// =============================================================================
// TIPOS: Módulo de TV
// =============================================================================

/**
 * Representa um dispositivo TV registrado no sistema.
 * Retornado pelos endpoints GET /tv/devices e GET /tv/devices/:id
 */
export interface TvDevice {
  id: string;
  name: string;
  ip_address: string;
  mac_address?: string;
  status?: "online" | "offline"; // campo real do banco
  is_online: boolean; // mapeado pelo backend: status === 'online'
  device_role: "CLIENT" | "PLATFORM_ADS";
  socket_token?: string | null;
  current_content?: string;
  last_seen_at?: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Resposta da listagem de dispositivos TV: GET /tv/devices
 * Inclui informações sobre os slots disponíveis (dinâmico por plano).
 */
export interface TvDeviceListResponse {
  devices: TvDevice[];
  total: number;
  slots_disponiveis: number;
  limite_maximo: number;
}

/**
 * Body para registrar uma nova TV: POST /tv/devices
 */
export interface RegisterTvDeviceInput {
  name: string;
  ip_address: string;
  mac_address?: string;
  device_role?: "CLIENT" | "PLATFORM_ADS";
}

/**
 * Plano de TVs do tenant: GET /tv/plan
 */
export interface TvPlan {
  plan_tier: "THREE" | "FIVE" | "TEN" | "CUSTOM";
  plan_mode: "SELF" | "PARTNERSHIP" | "OWNER_PLACED";
  max_client_tvs: number;
  platform_screen_share_percent: number;
  platform_profit_share_percent: number;
  platform_reserved_tv_count: number;
  tvs_em_uso: number;
  slots_disponiveis: number;
}

/**
 * Body para enviar conteúdo para uma TV: POST /tv/control
 * contentType determina qual protocolo usar (UPnP, DIAL, etc.)
 */
export interface ControlTvInput {
  deviceId: string;
  contentUrl: string;
  contentType: "video" | "image" | "web";
  upnpPort?: number; // Padrão: 7676
  dialPort?: number; // Padrão: 8008
  dialAppName?: string; // Ex: "YouTube", "Netflix", "Browser"
}

/**
 * Dispositivo descoberto via SSDP na rede local: GET /tv/discover
 */
export interface DiscoveredDevice {
  ip: string;
  location: string;
  usn: string;
  server: string;
  st: string;
}

/**
 * Resposta completa do POST /tv/control.
 * O backend sempre retorna 200, mesmo se a TV não respondeu.
 * O campo `resultado.success` indica se a TV recebeu o comando.
 */
export interface ControlTvResponse {
  dispositivo: { id: string; name: string; ip_address: string };
  resultado: {
    success: boolean;
    protocol: "upnp" | "dial" | "none";
    message: string;
    tvResponse?: string;
  };
  alternativa?: string;
}

/**
 * Arquivo de mídia salvo no sistema (vídeo ou imagem).
 * Retornado por GET /tv/media e POST /tv/media/upload
 */
export interface MediaFile {
  id: string;
  filename: string; // nome gerado no servidor (UUID + extensão)
  original_name: string; // nome original que o usuário enviou
  url: string; // URL pública para acesso à mídia
  mime_type: string; // ex: "video/mp4", "image/jpeg"
  size_bytes: number; // tamanho em bytes
  uploaded_by: string | null;
  created_at: string;
}

/** Resposta de GET /tv/media */
export interface MediaListResponse {
  files: MediaFile[];
  total: number;
}

/**
 * Resposta de POST /tv/devices/:id/pair e GET /tv/devices/:id/token
 * Contém o QR code e a URL para parear a TV ao receiver.html.
 */
export interface PairDeviceResponse {
  mensagem: string;
  dispositivo: { id: string; name: string };
  socketToken: string | null;
  receiverUrl: string;
  qrCodeDataUrl: string; // data URL base64 PNG do QR code gerado pelo backend
  instrucoes?: string[];
  aviso?: string;
}

/**
 * App de Digital Signage disponível no catálogo do sistema.
 * Retornado por GET /tv/apps
 */
export interface TvApp {
  id: string; // ex: "timer", "slides"
  name: string; // ex: "Cronômetro Regressivo"
  description: string;
  icon: string; // emoji ou nome de ícone
  url: string; // URL para abrir o app no iframe da TV
  category: string; // ex: "utilidade", "apresentação"
}

/** Resposta de GET /tv/apps */
export interface TvAppsResponse {
  apps: TvApp[];
  total: number;
}

/**
 * Registro do histórico de comandos enviados para uma TV.
 * Retornado por GET /tv/devices/:id/historico
 */
export interface TvCommandLog {
  id: string;
  device_id: string;
  device_name: string;
  content_url: string;
  content_type: "video" | "image" | "web";
  protocol_used: string | null;
  success: boolean;
  error_message: string | null;
  sent_at: string;
}

// =============================================================================
// TIPOS: Módulo de Estoque
// =============================================================================

/**
 * Representa um produto no estoque.
 * Retornado pelos endpoints GET /estoque/produtos
 */
export interface Produto {
  id: string;
  name: string;
  description?: string;
  price: number;
  quantity: number;
  sku?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Resposta paginada da listagem de produtos: GET /estoque/produtos
 */
export interface ProdutoListResponse {
  data: Produto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Body para criar/atualizar produto
 */
export interface ProdutoInput {
  name: string;
  description?: string;
  price: number;
  quantity?: number;
  sku?: string;
}

// =============================================================================
// TIPOS: Módulo Financeiro
// =============================================================================

/**
 * Tipo de transação financeira.
 * 'receita' = dinheiro entrando | 'despesa' = dinheiro saindo
 */
export type TransactionType = "receita" | "despesa";
export type CommitmentType =
  | "conta_fixa_mensal"
  | "assinatura_mensal"
  | "parcelamento";
export type FinancialOccurrenceStatus =
  | "pendente"
  | "pago"
  | "atrasado"
  | "cancelado";

/**
 * Representa uma transação financeira.
 */
export interface Transacao {
  id: string;
  type: TransactionType;
  amount: number; // Sempre positivo — o tipo indica a direção
  description: string;
  category?: string;
  supplier?: string;
  costCenter?: string;
  transactionDate: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Resumo financeiro retornado pela API (KPIs)
 */
export interface FinanceiroSummaryData {
  totalReceitas: number;
  totalDespesas: number;
  saldo: number;
}

/**
 * Resposta paginada com resumo financeiro: GET /financeiro/transacoes
 */
export interface TransacaoListResponse {
  transactions: Transacao[]; // array principal
  data?: Transacao[]; // alias alternativo que alguns endpoints usam
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  resumo?: FinanceiroSummaryData;
}

/**
 * Body para criar/atualizar transação
 */
export interface TransacaoInput {
  type: TransactionType;
  amount: number;
  description: string;
  category?: string;
  supplier?: string;
  costCenter?: string;
  transactionDate?: string; // YYYY-MM-DD, default = hoje
}

export interface FinancialCommitment {
  id: string;
  title: string;
  description?: string | null;
  category?: string | null;
  supplier?: string | null;
  costCenter?: string | null;
  type: CommitmentType;
  direction: TransactionType;
  amount: number;
  startDate: string;
  endDate?: string | null;
  dueDay: number;
  installmentCount?: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FinancialCommitmentInput {
  title: string;
  description?: string;
  category?: string;
  supplier?: string;
  costCenter?: string;
  type: CommitmentType;
  direction: TransactionType;
  amount: number;
  startDate: string;
  endDate?: string;
  dueDay?: number;
  installmentCount?: number;
}

export interface FinancialCommitmentListResponse {
  data: FinancialCommitment[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface FinancialOccurrence {
  id: string;
  commitmentId: string;
  commitmentTitle: string;
  commitmentType: CommitmentType;
  direction: TransactionType;
  category?: string | null;
  supplier?: string | null;
  costCenter?: string | null;
  competenceMonth: string;
  dueDate: string;
  installmentNumber: number;
  installmentCount?: number | null;
  expectedAmount: number;
  status: FinancialOccurrenceStatus;
  paidAmount?: number | null;
  paidAt?: string | null;
  transactionId?: string | null;
}

export interface FinancialProjectionResponse {
  periodo: { fromMonth: string; toMonth: string };
  resumo: {
    totalPrevisto: number;
    totalPago: number;
    totalPendente: number;
    totalAtrasado: number;
  };
  ocorrencias: FinancialOccurrence[];
}

export interface SettleOccurrenceInput {
  paidAmount?: number;
  paymentDate?: string;
  penaltyAmount?: number;
  interestAmount?: number;
  discountAmount?: number;
  notes?: string;
  createTransaction?: boolean;
}

export interface FinancialDashboardResponse {
  monthly: Array<{
    month: string;
    previsto: number;
    pago: number;
    realizadoReceitas: number;
    realizadoDespesas: number;
    saldoRealizado: number;
  }>;
  totals: {
    previsto: number;
    pago: number;
    realizadoReceitas: number;
    realizadoDespesas: number;
    saldoRealizado: number;
  };
}

export interface ImportBankCsvResult {
  imported: number;
  skipped: number;
  duplicated: number;
  errors: Array<{ row: number; reason: string }>;
}

export interface FinancialMonthlyHistoryItem {
  id: string;
  month: string;
  previsto: number;
  pago: number;
  pendente: number;
  atrasado: number;
  realizadoReceitas: number;
  realizadoDespesas: number;
  saldoRealizado: number;
  generatedAt: string;
}

export interface FinancialMonthlyHistoryListResponse {
  data: FinancialMonthlyHistoryItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// =============================================================================
// TIPOS: Respostas genéricas de erro da API
// =============================================================================

/**
 * Formato padrão de erro retornado pelo Backend Fastify.
 * Fastify segue o padrão RFC 7807 (Problem Details) por padrão.
 */
/**
 * Body para criar um novo tenant via admin
 */
export interface CreateTenantInput {
  name: string;
  slug: string;
  moduleNames?: string[]; // nomes dos módulos iniciais a ativar
}

export interface ApiError {
  statusCode: number;
  error: string;
  message: string;
  detalhe?: unknown; // Informações extras de debug (apenas em dev)
}
