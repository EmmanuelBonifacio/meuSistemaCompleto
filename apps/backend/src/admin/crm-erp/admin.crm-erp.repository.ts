// =============================================================================
// src/admin/crm-erp/admin.crm-erp.repository.ts
// =============================================================================
// Camada de acesso a dados para CRM e ERP do painel admin.
// Opera no schema public via Prisma client.
// =============================================================================

import { prisma } from "../../core/database/prisma";
import {
  UpdateCrmInput,
  CreatePagamentoInput,
  UpdatePagamentoInput,
  UpdateErpInput,
  GerarParcelasInput,
  UpdateParcelaInput,
} from "./admin.crm-erp.schema";

// =============================================================================
// CRM — upsert automático
// =============================================================================

export async function upsertCrm(tenantId: string) {
  return prisma.tenantCrm.upsert({
    where: { tenantId },
    create: { tenantId },
    update: {},
  });
}

export async function getCrm(tenantId: string) {
  return prisma.tenantCrm.upsert({
    where: { tenantId },
    create: { tenantId },
    update: {},
  });
}

export async function updateCrm(tenantId: string, data: UpdateCrmInput) {
  return prisma.tenantCrm.upsert({
    where: { tenantId },
    create: {
      tenantId,
      nome: data.nome,
      telefone: data.telefone,
      email: data.email ?? null,
      cpfCnpj: data.cpf_cnpj,
      observacoes: data.observacoes,
    },
    update: {
      nome: data.nome,
      telefone: data.telefone,
      email: data.email ?? null,
      cpfCnpj: data.cpf_cnpj,
      observacoes: data.observacoes,
      updatedAt: new Date(),
    },
  });
}

// =============================================================================
// PAGAMENTOS
// =============================================================================

export async function listPagamentos(tenantId: string) {
  return prisma.tenantCrmPagamento.findMany({
    where: { tenantId },
    orderBy: { dataPagamento: "asc" },
  });
}

export async function createPagamento(
  tenantId: string,
  data: CreatePagamentoInput,
) {
  return prisma.tenantCrmPagamento.create({
    data: {
      tenantId,
      dataPagamento: new Date(data.data_pagamento),
      valor: data.valor,
      forma: data.forma,
      referencia: data.referencia,
      status: data.status,
    },
  });
}

export async function deletePagamento(tenantId: string, pagamentoId: string) {
  // Verificar que o pagamento pertence ao tenant (isolamento)
  const found = await prisma.tenantCrmPagamento.findFirst({
    where: { id: pagamentoId, tenantId },
  });
  if (!found) return null;
  return prisma.tenantCrmPagamento.delete({ where: { id: pagamentoId } });
}

export async function updatePagamento(
  tenantId: string,
  pagamentoId: string,
  data: UpdatePagamentoInput,
) {
  const found = await prisma.tenantCrmPagamento.findFirst({
    where: { id: pagamentoId, tenantId },
  });
  if (!found) return null;
  return prisma.tenantCrmPagamento.update({
    where: { id: pagamentoId },
    data: {
      ...(data.data_pagamento !== undefined && {
        dataPagamento: new Date(data.data_pagamento),
      }),
      ...(data.valor !== undefined && { valor: data.valor }),
      ...(data.forma !== undefined && { forma: data.forma }),
      ...(data.referencia !== undefined && { referencia: data.referencia }),
      ...(data.status !== undefined && { status: data.status }),
    },
  });
}

// =============================================================================
// ARQUIVOS
// =============================================================================

export async function listArquivos(tenantId: string) {
  return prisma.tenantCrmArquivo.findMany({
    where: { tenantId },
    orderBy: { createdAt: "asc" },
  });
}

export async function createArquivo(
  tenantId: string,
  data: {
    nomeOriginal: string;
    caminho: string;
    mimeType: string;
    tamanhoBytes: number;
  },
) {
  return prisma.tenantCrmArquivo.create({
    data: {
      tenantId,
      nomeOriginal: data.nomeOriginal,
      caminho: data.caminho,
      mimeType: data.mimeType,
      tamanhoBytes: data.tamanhoBytes,
    },
  });
}

export async function findArquivo(tenantId: string, arquivoId: string) {
  return prisma.tenantCrmArquivo.findFirst({
    where: { id: arquivoId, tenantId },
  });
}

export async function deleteArquivo(tenantId: string, arquivoId: string) {
  const found = await prisma.tenantCrmArquivo.findFirst({
    where: { id: arquivoId, tenantId },
  });
  if (!found) return null;
  return prisma.tenantCrmArquivo.delete({ where: { id: arquivoId } });
}

// =============================================================================
// ERP — upsert automático
// =============================================================================

export async function getErpConfig(tenantId: string) {
  return prisma.tenantErpConfig.upsert({
    where: { tenantId },
    create: { tenantId },
    update: {},
  });
}

export async function updateErpConfig(tenantId: string, data: UpdateErpInput) {
  return prisma.tenantErpConfig.upsert({
    where: { tenantId },
    create: {
      tenantId,
      ativo: data.ativo ?? false,
      plano: data.plano ?? null,
      limiteSkus: data.limite_skus ?? 1000,
      modulos: data.modulos ?? [],
      certificadoNfe: data.certificado_nfe,
      ambienteNfe: data.ambiente_nfe ?? "homologacao",
    },
    update: {
      ...(data.ativo !== undefined && { ativo: data.ativo }),
      ...(data.plano !== undefined && { plano: data.plano }),
      ...(data.limite_skus !== undefined && { limiteSkus: data.limite_skus }),
      ...(data.modulos !== undefined && { modulos: data.modulos }),
      ...(data.certificado_nfe !== undefined && {
        certificadoNfe: data.certificado_nfe,
      }),
      ...(data.ambiente_nfe !== undefined && {
        ambienteNfe: data.ambiente_nfe,
      }),
      updatedAt: new Date(),
    },
  });
}

// =============================================================================
// PARCELAS ERP
// =============================================================================

export async function listParcelas(tenantId: string) {
  return prisma.tenantErpParcela.findMany({
    where: { tenantId },
    orderBy: { numero: "asc" },
  });
}

export async function gerarParcelas(
  tenantId: string,
  data: GerarParcelasInput,
) {
  const quantidades: Record<string, number> = {
    anual: 12,
    semestral: 6,
    mensal: 1,
  };
  const n = quantidades[data.plano];
  const inicio = new Date(data.data_inicio + "T12:00:00Z");

  // Calcular data de fim
  const fim = new Date(inicio);
  fim.setMonth(fim.getMonth() + n);

  // Usar transação para deletar e recriar atomicamente
  return prisma.$transaction(async (tx) => {
    // Deletar parcelas existentes do tenant
    await tx.tenantErpParcela.deleteMany({ where: { tenantId } });

    // Atualizar config ERP com dados do contrato
    await tx.tenantErpConfig.upsert({
      where: { tenantId },
      create: {
        tenantId,
        dataInicioContrato: inicio,
        dataFimContrato: fim,
        valorParcela: data.valor_parcela,
      },
      update: {
        dataInicioContrato: inicio,
        dataFimContrato: fim,
        valorParcela: data.valor_parcela,
        updatedAt: new Date(),
      },
    });

    // Criar as N parcelas
    const parcelasData = Array.from({ length: n }, (_, i) => {
      const vencimento = new Date(inicio);
      vencimento.setMonth(vencimento.getMonth() + i);
      return {
        tenantId,
        numero: i + 1,
        totalParcelas: n,
        vencimento,
        valor: data.valor_parcela,
        status: "pendente",
      };
    });

    await tx.tenantErpParcela.createMany({ data: parcelasData });

    return tx.tenantErpParcela.findMany({
      where: { tenantId },
      orderBy: { numero: "asc" },
    });
  });
}

export async function updateParcela(
  tenantId: string,
  parcelaId: string,
  data: UpdateParcelaInput,
) {
  const found = await prisma.tenantErpParcela.findFirst({
    where: { id: parcelaId, tenantId },
  });
  if (!found) return null;
  return prisma.tenantErpParcela.update({
    where: { id: parcelaId },
    data: {
      ...(data.vencimento !== undefined && {
        vencimento: new Date(data.vencimento + "T12:00:00Z"),
      }),
      ...(data.valor !== undefined && { valor: data.valor }),
      ...(data.status !== undefined && { status: data.status }),
      updatedAt: new Date(),
    },
  });
}
