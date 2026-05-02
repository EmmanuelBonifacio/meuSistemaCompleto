// =============================================================================
// src/services/crm-erp.service.ts
// =============================================================================
// Camada de comunicação com os endpoints de CRM e ERP do painel admin.
// =============================================================================

import api from "./api";
import type {
  TenantCrm,
  UpdateCrmPayload,
  TenantCrmPagamento,
  CreatePagamentoPayload,
  UpdatePagamentoPayload,
  TenantCrmArquivo,
  TenantErpConfig,
  UpdateErpPayload,
  TenantErpParcela,
  GerarParcelasPayload,
  UpdateParcelaPayload,
} from "@/types/crm-erp.types";

// =============================================================================
// CRM — Dados do cliente
// =============================================================================

export async function getCrm(tenantId: string): Promise<TenantCrm> {
  const response = await api.get<TenantCrm>(`/admin/tenants/${tenantId}/crm`);
  return response.data;
}

export async function updateCrm(
  tenantId: string,
  data: UpdateCrmPayload,
): Promise<TenantCrm> {
  const response = await api.put<TenantCrm>(
    `/admin/tenants/${tenantId}/crm`,
    data,
  );
  return response.data;
}

// =============================================================================
// Pagamentos
// =============================================================================

export async function listPagamentos(
  tenantId: string,
): Promise<TenantCrmPagamento[]> {
  const response = await api.get<TenantCrmPagamento[]>(
    `/admin/tenants/${tenantId}/crm/pagamentos`,
  );
  return response.data;
}

export async function createPagamento(
  tenantId: string,
  data: CreatePagamentoPayload,
): Promise<TenantCrmPagamento> {
  const response = await api.post<TenantCrmPagamento>(
    `/admin/tenants/${tenantId}/crm/pagamentos`,
    data,
  );
  return response.data;
}

export async function deletePagamento(
  tenantId: string,
  pagamentoId: string,
): Promise<void> {
  await api.delete(`/admin/tenants/${tenantId}/crm/pagamentos/${pagamentoId}`);
}

export async function updatePagamento(
  tenantId: string,
  pagamentoId: string,
  data: UpdatePagamentoPayload,
): Promise<TenantCrmPagamento> {
  const response = await api.put<TenantCrmPagamento>(
    `/admin/tenants/${tenantId}/crm/pagamentos/${pagamentoId}`,
    data,
  );
  return response.data;
}

// =============================================================================
// Arquivos
// =============================================================================

export async function listArquivos(
  tenantId: string,
): Promise<TenantCrmArquivo[]> {
  const response = await api.get<TenantCrmArquivo[]>(
    `/admin/tenants/${tenantId}/crm/arquivos`,
  );
  return response.data;
}

export async function uploadArquivo(
  tenantId: string,
  file: File,
): Promise<TenantCrmArquivo> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await api.post<TenantCrmArquivo>(
    `/admin/tenants/${tenantId}/crm/arquivos`,
    formData,
  );
  return response.data;
}

export async function deleteArquivo(
  tenantId: string,
  arquivoId: string,
): Promise<void> {
  await api.delete(`/admin/tenants/${tenantId}/crm/arquivos/${arquivoId}`);
}

// =============================================================================
// ERP
// =============================================================================

export async function getErp(tenantId: string): Promise<TenantErpConfig> {
  const response = await api.get<TenantErpConfig>(
    `/admin/tenants/${tenantId}/erp`,
  );
  return response.data;
}

export async function updateErp(
  tenantId: string,
  data: UpdateErpPayload,
): Promise<TenantErpConfig> {
  const response = await api.put<TenantErpConfig>(
    `/admin/tenants/${tenantId}/erp`,
    data,
  );
  return response.data;
}

// =============================================================================
// ERP — Parcelas
// =============================================================================

export async function listParcelas(
  tenantId: string,
): Promise<TenantErpParcela[]> {
  const response = await api.get<TenantErpParcela[]>(
    `/admin/tenants/${tenantId}/erp/parcelas`,
  );
  return response.data;
}

export async function gerarParcelas(
  tenantId: string,
  data: GerarParcelasPayload,
): Promise<TenantErpParcela[]> {
  const response = await api.post<TenantErpParcela[]>(
    `/admin/tenants/${tenantId}/erp/parcelas/gerar`,
    data,
  );
  return response.data;
}

export async function updateParcela(
  tenantId: string,
  parcelaId: string,
  data: UpdateParcelaPayload,
): Promise<TenantErpParcela> {
  const response = await api.put<TenantErpParcela>(
    `/admin/tenants/${tenantId}/erp/parcelas/${parcelaId}`,
    data,
  );
  return response.data;
}
