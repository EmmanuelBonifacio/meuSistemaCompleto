// =============================================================================
// src/types/crm-erp.types.ts
// =============================================================================
// Tipos TypeScript para os dados de CRM e ERP do painel admin.
// =============================================================================

// =============================================================================
// CRM
// =============================================================================

export interface TenantCrm {
  id: string;
  tenantId: string;
  nome: string | null;
  telefone: string | null;
  email: string | null;
  cpfCnpj: string | null;
  observacoes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateCrmPayload {
  nome?: string;
  telefone?: string;
  email?: string;
  cpf_cnpj?: string;
  observacoes?: string;
}

// =============================================================================
// Pagamentos
// =============================================================================

export type FormaPagamento =
  | "PIX"
  | "Boleto"
  | "Cartão"
  | "Transferência"
  | "Dinheiro";

export type StatusPagamento = "pago" | "pendente" | "atrasado";

export interface TenantCrmPagamento {
  id: string;
  tenantId: string;
  dataPagamento: string; // ISO date string
  valor: string; // Decimal vem como string do Prisma
  forma: FormaPagamento;
  referencia: string | null;
  status: StatusPagamento;
  createdAt: string;
}

export interface CreatePagamentoPayload {
  data_pagamento: string; // YYYY-MM-DD
  valor: number;
  forma: FormaPagamento;
  referencia?: string;
  status: StatusPagamento;
}

// =============================================================================
// Arquivos
// =============================================================================

export interface TenantCrmArquivo {
  id: string;
  tenantId: string;
  nomeOriginal: string;
  caminho: string;
  mimeType: string | null;
  tamanhoBytes: string | null; // BigInt vem como string
  createdAt: string;
}

// =============================================================================
// ERP
// =============================================================================

export type PlanoErp = "anual" | "semestral" | "mensal";
export type AmbienteNfe = "producao" | "homologacao";

export const MODULOS_ERP_LIST = [
  "Estoque",
  "Financeiro",
  "Compras",
  "Vendas",
  "NF-e",
  "Relatórios",
  "RH",
  "Produção",
] as const;

export type ModuloErp = (typeof MODULOS_ERP_LIST)[number];

export interface TenantErpConfig {
  id: string;
  tenantId: string;
  ativo: boolean;
  plano: PlanoErp | null;
  limiteSkus: number;
  modulos: ModuloErp[];
  certificadoNfe: string | null;
  ambienteNfe: AmbienteNfe;
  dataInicioContrato: string | null; // YYYY-MM-DD
  dataFimContrato: string | null; // YYYY-MM-DD
  valorParcela: string | null; // Decimal como string
  createdAt: string;
  updatedAt: string;
}

export interface UpdateErpPayload {
  ativo?: boolean;
  plano?: PlanoErp | null;
  limite_skus?: number;
  modulos?: ModuloErp[];
  certificado_nfe?: string;
  ambiente_nfe?: AmbienteNfe;
}

// =============================================================================
// ERP — Parcelas
// =============================================================================

export type StatusParcela = "pago" | "pendente" | "atrasado";

export interface TenantErpParcela {
  id: string;
  tenantId: string;
  numero: number;
  totalParcelas: number;
  vencimento: string; // YYYY-MM-DD
  valor: string; // Decimal vem como string
  status: StatusParcela;
  createdAt: string;
  updatedAt: string;
}

export interface GerarParcelasPayload {
  plano: PlanoErp;
  data_inicio: string; // YYYY-MM-DD
  valor_parcela: number;
}

export interface UpdateParcelaPayload {
  vencimento?: string; // YYYY-MM-DD
  valor?: number;
  status?: StatusParcela;
}

export interface UpdatePagamentoPayload {
  data_pagamento?: string;
  valor?: number;
  forma?: FormaPagamento;
  referencia?: string;
  status?: StatusPagamento;
}
