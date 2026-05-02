// =============================================================================
// src/admin/crm-erp/admin.crm-erp.schema.ts
// =============================================================================
// Schemas Zod para validação dos endpoints de CRM e ERP do painel admin.
// =============================================================================

import { z } from "zod";

// =============================================================================
// SCHEMAS COMPARTILHADOS
// =============================================================================

export const TenantIdParamsSchema = z.object({
  tenantId: z.string().uuid("tenantId deve ser um UUID válido"),
});

export const PagamentoIdParamsSchema = z.object({
  tenantId: z.string().uuid("tenantId deve ser um UUID válido"),
  pagamentoId: z.string().uuid("pagamentoId deve ser um UUID válido"),
});

export const ArquivoIdParamsSchema = z.object({
  tenantId: z.string().uuid("tenantId deve ser um UUID válido"),
  arquivoId: z.string().uuid("arquivoId deve ser um UUID válido"),
});

export const ParcelaIdParamsSchema = z.object({
  tenantId: z.string().uuid("tenantId deve ser um UUID válido"),
  parcelaId: z.string().uuid("parcelaId deve ser um UUID válido"),
});

// =============================================================================
// SCHEMAS: CRM
// =============================================================================

export const UpdateCrmSchema = z.object({
  nome: z.string().max(255).optional(),
  telefone: z.string().max(50).optional(),
  email: z
    .string()
    .email("E-mail inválido")
    .max(255)
    .optional()
    .or(z.literal("")),
  cpf_cnpj: z.string().max(30).optional(),
  observacoes: z.string().optional(),
});

export type UpdateCrmInput = z.infer<typeof UpdateCrmSchema>;

// =============================================================================
// SCHEMAS: Pagamentos
// =============================================================================

const FORMAS_PAGAMENTO = [
  "PIX",
  "Boleto",
  "Cartão",
  "Transferência",
  "Dinheiro",
] as const;
const STATUS_PAGAMENTO = ["pago", "pendente", "atrasado"] as const;

export const CreatePagamentoSchema = z.object({
  data_pagamento: z
    .string({ required_error: "data_pagamento é obrigatório" })
    .regex(
      /^\d{4}-\d{2}-\d{2}$/,
      "data_pagamento deve estar no formato YYYY-MM-DD",
    ),
  valor: z
    .number({ required_error: "valor é obrigatório" })
    .positive("valor deve ser positivo"),
  forma: z.enum(FORMAS_PAGAMENTO, {
    errorMap: () => ({
      message: `forma deve ser um de: ${FORMAS_PAGAMENTO.join(", ")}`,
    }),
  }),
  referencia: z.string().max(255).optional(),
  status: z
    .enum(STATUS_PAGAMENTO, {
      errorMap: () => ({
        message: `status deve ser um de: ${STATUS_PAGAMENTO.join(", ")}`,
      }),
    })
    .default("pendente"),
});

export type CreatePagamentoInput = z.infer<typeof CreatePagamentoSchema>;

// =============================================================================
// SCHEMAS: Atualização de pagamento (PUT)
// =============================================================================

export const UpdatePagamentoSchema = z.object({
  data_pagamento: z
    .string()
    .regex(
      /^\d{4}-\d{2}-\d{2}$/,
      "data_pagamento deve estar no formato YYYY-MM-DD",
    )
    .optional(),
  valor: z.number().positive("valor deve ser positivo").optional(),
  forma: z
    .enum(FORMAS_PAGAMENTO, {
      errorMap: () => ({
        message: `forma deve ser um de: ${FORMAS_PAGAMENTO.join(", ")}`,
      }),
    })
    .optional(),
  referencia: z.string().max(255).optional(),
  status: z
    .enum(STATUS_PAGAMENTO, {
      errorMap: () => ({
        message: `status deve ser um de: ${STATUS_PAGAMENTO.join(", ")}`,
      }),
    })
    .optional(),
});

export type UpdatePagamentoInput = z.infer<typeof UpdatePagamentoSchema>;

// =============================================================================
// SCHEMAS: ERP Config
// =============================================================================

const PLANOS_ERP = ["anual", "semestral", "mensal"] as const;
const AMBIENTES_NFE = ["producao", "homologacao"] as const;
const MODULOS_ERP = [
  "Estoque",
  "Financeiro",
  "Compras",
  "Vendas",
  "NF-e",
  "Relatórios",
  "RH",
  "Produção",
] as const;

export const UpdateErpSchema = z.object({
  ativo: z.boolean().optional(),
  plano: z
    .enum(PLANOS_ERP, {
      errorMap: () => ({
        message: `plano deve ser um de: ${PLANOS_ERP.join(", ")}`,
      }),
    })
    .nullable()
    .optional(),
  limite_skus: z
    .number()
    .int("limite_skus deve ser inteiro")
    .positive("limite_skus deve ser positivo")
    .optional(),
  modulos: z
    .array(
      z.enum(MODULOS_ERP, {
        errorMap: () => ({
          message: `Módulo inválido. Válidos: ${MODULOS_ERP.join(", ")}`,
        }),
      }),
    )
    .optional(),
  certificado_nfe: z.string().max(255).optional(),
  ambiente_nfe: z
    .enum(AMBIENTES_NFE, {
      errorMap: () => ({
        message: `ambiente_nfe deve ser um de: ${AMBIENTES_NFE.join(", ")}`,
      }),
    })
    .optional(),
});

export type UpdateErpInput = z.infer<typeof UpdateErpSchema>;

// =============================================================================
// SCHEMAS: Parcelas ERP
// =============================================================================

const STATUS_PARCELA = ["pago", "pendente", "atrasado"] as const;

export const GerarParcelasSchema = z.object({
  plano: z.enum(["anual", "semestral", "mensal"], {
    errorMap: () => ({
      message: "plano deve ser um de: anual, semestral, mensal",
    }),
  }),
  data_inicio: z
    .string({ required_error: "data_inicio é obrigatório" })
    .regex(
      /^\d{4}-\d{2}-\d{2}$/,
      "data_inicio deve estar no formato YYYY-MM-DD",
    ),
  valor_parcela: z
    .number({ required_error: "valor_parcela é obrigatório" })
    .positive("valor_parcela deve ser positivo"),
});

export type GerarParcelasInput = z.infer<typeof GerarParcelasSchema>;

export const UpdateParcelaSchema = z.object({
  vencimento: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "vencimento deve estar no formato YYYY-MM-DD")
    .optional(),
  valor: z.number().positive("valor deve ser positivo").optional(),
  status: z
    .enum(STATUS_PARCELA, {
      errorMap: () => ({
        message: `status deve ser um de: ${STATUS_PARCELA.join(", ")}`,
      }),
    })
    .optional(),
});

export type UpdateParcelaInput = z.infer<typeof UpdateParcelaSchema>;
