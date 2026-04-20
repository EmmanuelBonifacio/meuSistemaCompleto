// =============================================================================
// src/services/financeiro.service.ts
// =============================================================================
// O QUE FAZ:
//   Camada de comunicação com os endpoints do módulo Financeiro.
//
// MAPEAMENTO DE ROTAS (financeiro.routes.ts no Backend):
//   GET    /financeiro/transacoes         → listTransactions()
//   GET    /financeiro/transacoes/:id     → getTransaction()
//   POST   /financeiro/transacoes         → createTransaction()
//   PATCH  /financeiro/transacoes/:id     → updateTransaction()
//   DELETE /financeiro/transacoes/:id     → deleteTransaction()
// =============================================================================

import api from "./api";
import type {
  Transacao,
  TransacaoListResponse,
  TransacaoInput,
  TransactionType,
  FinanceiroSummaryData,
  FinancialCommitment,
  FinancialCommitmentInput,
  FinancialCommitmentListResponse,
  FinancialProjectionResponse,
  SettleOccurrenceInput,
  FinancialDashboardResponse,
  ImportBankCsvResult,
  FinancialMonthlyHistoryItem,
  FinancialMonthlyHistoryListResponse,
} from "@/types/api";
import { TOKEN_KEY } from "./api";

// Filtros disponíveis para a listagem de transações
export interface ListTransactionsParams {
  page?: number;
  limit?: number;
  type?: TransactionType;
  category?: string;
  supplier?: string;
  costCenter?: string;
  search?: string; // busca por descrição/categoria
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
}

// =============================================================================
// FUNÇÃO: listTransactions
// =============================================================================
// Busca transações com filtros. O Backend retorna também um `resumo`
// com totalReceitas, totalDespesas e saldo do período filtrado.
// =============================================================================
export async function listTransactions(
  params: ListTransactionsParams = {},
): Promise<TransacaoListResponse> {
  const response = await api.get<TransacaoListResponse>(
    "/financeiro/transacoes",
    {
      params: {
        page: params.page ?? 1,
        limit: params.limit ?? 20,
        type: params.type,
        category: params.category,
        supplier: params.supplier,
        costCenter: params.costCenter,
        search: params.search,
        startDate: params.startDate,
        endDate: params.endDate,
      },
    },
  );
  // Normaliza: garante que o array esteja em .transactions
  const raw = response.data;
  if (!raw.transactions && (raw as any).data) {
    raw.transactions = (raw as any).data;
  }
  return raw;
}

// =============================================================================
// FUNÇÃO: getTransaction
// =============================================================================
export async function getTransaction(id: string): Promise<Transacao> {
  const response = await api.get<Transacao>(`/financeiro/transacoes/${id}`);
  return response.data;
}

// =============================================================================
// FUNÇÃO: createTransaction
// =============================================================================
export async function createTransaction(
  data: TransacaoInput,
): Promise<{ mensagem: string; transacao: Transacao }> {
  const response = await api.post<{ mensagem: string; transacao: Transacao }>(
    "/financeiro/transacoes",
    data,
  );
  return response.data;
}

// =============================================================================
// FUNÇÃO: updateTransaction
// =============================================================================
export async function updateTransaction(
  id: string,
  data: Partial<TransacaoInput>,
): Promise<{ mensagem: string; transacao: Transacao }> {
  const response = await api.patch<{ mensagem: string; transacao: Transacao }>(
    `/financeiro/transacoes/${id}`,
    data,
  );
  return response.data;
}

// =============================================================================
// FUNÇÃO: deleteTransaction
// =============================================================================
export async function deleteTransaction(id: string): Promise<void> {
  await api.delete(`/financeiro/transacoes/${id}`);
}

// =============================================================================
// FUNÇÃO: getFinanceiroSummary
// =============================================================================
// Busca o resumo financeiro (KPIs) do tenant. Tenta reutilizar o resumo
// retornado pela última chamada de listTransactions ou faz uma chamada
// dedicada se o backend suportar o endpoint.
// =============================================================================
export async function getFinanceiroSummary(): Promise<FinanceiroSummaryData> {
  // Busca a listagem completa com resumo (sem filtros de paginação restrictos)
  const response = await listTransactions({ page: 1, limit: 1 });
  if (response.resumo) {
    return response.resumo;
  }
  // Fallback: calcula localmente caso o backend não retorne resumo
  return { totalReceitas: 0, totalDespesas: 0, saldo: 0 };
}

export interface ListCommitmentsParams {
  page?: number;
  limit?: number;
  type?: "conta_fixa_mensal" | "assinatura_mensal" | "parcelamento";
  isActive?: boolean;
  supplier?: string;
  costCenter?: string;
}

export async function listCommitments(
  params: ListCommitmentsParams = {},
): Promise<FinancialCommitmentListResponse> {
  const response = await api.get<FinancialCommitmentListResponse>(
    "/financeiro/compromissos",
    {
      params: {
        page: params.page ?? 1,
        limit: params.limit ?? 20,
        type: params.type,
        isActive: params.isActive,
        supplier: params.supplier,
        costCenter: params.costCenter,
      },
    },
  );
  return response.data;
}

export async function createCommitment(
  data: FinancialCommitmentInput,
): Promise<FinancialCommitment> {
  const response = await api.post<FinancialCommitment>(
    "/financeiro/compromissos",
    data,
  );
  return response.data;
}

export async function updateCommitment(
  id: string,
  data: Partial<FinancialCommitmentInput>,
): Promise<FinancialCommitment> {
  const response = await api.patch<FinancialCommitment>(
    `/financeiro/compromissos/${id}`,
    data,
  );
  return response.data;
}

export async function deleteCommitment(id: string): Promise<void> {
  await api.delete(`/financeiro/compromissos/${id}`);
}

export async function getFinancialProjection(params?: {
  fromMonth?: string;
  toMonth?: string;
  status?: "pendente" | "pago" | "atrasado" | "cancelado";
  type?: "conta_fixa_mensal" | "assinatura_mensal" | "parcelamento";
  supplier?: string;
  costCenter?: string;
}): Promise<FinancialProjectionResponse> {
  const response = await api.get<FinancialProjectionResponse>(
    "/financeiro/projecao",
    { params },
  );
  return response.data;
}

export async function settleOccurrence(
  id: string,
  data: SettleOccurrenceInput = {},
) {
  const response = await api.post(`/financeiro/ocorrencias/${id}/baixar`, data);
  return response.data;
}

export async function getFinancialDashboard(months = 6) {
  const response = await api.get<FinancialDashboardResponse>(
    "/financeiro/dashboard",
    {
      params: { months },
    },
  );
  return response.data;
}

export async function importBankCsv(
  file: File,
  options?: {
    defaultType?: "receita" | "despesa";
    useAiCategorization?: boolean;
    skipDuplicates?: boolean;
  },
): Promise<ImportBankCsvResult> {
  const form = new FormData();
  form.append("file", file);
  if (options?.defaultType) form.append("defaultType", options.defaultType);
  if (options?.useAiCategorization !== undefined) {
    form.append("useAiCategorization", String(options.useAiCategorization));
  }
  if (options?.skipDuplicates !== undefined) {
    form.append("skipDuplicates", String(options.skipDuplicates));
  }

  const response = await api.post<ImportBankCsvResult>(
    "/financeiro/importacoes/extrato-csv",
    form,
    {
      headers: { "Content-Type": "multipart/form-data" },
    },
  );
  return response.data;
}

export async function snapshotMonthlyHistory(month?: string) {
  const response = await api.post<FinancialMonthlyHistoryItem>(
    "/financeiro/historico/snapshot",
    month ? { month } : {},
  );
  return response.data;
}

export async function listMonthlyHistory(params?: {
  page?: number;
  limit?: number;
  fromMonth?: string;
  toMonth?: string;
}) {
  const response = await api.get<FinancialMonthlyHistoryListResponse>(
    "/financeiro/historico",
    { params },
  );
  return response.data;
}

export async function getMonthlyReport(params?: {
  fromMonth?: string;
  toMonth?: string;
}) {
  const response = await api.get<{ data: FinancialMonthlyHistoryItem[]; total: number }>(
    "/financeiro/relatorios/mensal",
    {
      params: { ...params, format: "json" },
    },
  );
  return response.data;
}

export async function downloadMonthlyReportCsv(params?: {
  fromMonth?: string;
  toMonth?: string;
}) {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";
  const query = new URLSearchParams({
    format: "csv",
    ...(params?.fromMonth ? { fromMonth: params.fromMonth } : {}),
    ...(params?.toMonth ? { toMonth: params.toMonth } : {}),
  });
  const token =
    typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;

  const response = await fetch(
    `${baseUrl}/financeiro/relatorios/mensal?${query.toString()}`,
    {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      credentials: "include",
    },
  );
  if (!response.ok) {
    throw new Error("Falha ao gerar relatório CSV.");
  }
  return response.text();
}
