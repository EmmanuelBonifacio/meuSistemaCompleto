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
} from "@/types/api";

// Filtros disponíveis para a listagem de transações
export interface ListTransactionsParams {
  page?: number;
  limit?: number;
  type?: TransactionType;
  category?: string;
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
