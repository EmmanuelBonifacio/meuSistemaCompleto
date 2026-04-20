// =============================================================================
// src/modules/financeiro/financeiro.schema.ts
// =============================================================================
// O QUE FAZ:
//   Define os schemas de validação Zod para o módulo financeiro.
//   Mesmo padrão do estoque — demonstrando o reaproveitamento da arquitetura.
// =============================================================================

import { z } from "zod";

const StringBooleanSchema = z.preprocess((value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "sim"].includes(normalized)) return true;
    if (["false", "0", "no", "nao", "não"].includes(normalized)) return false;
  }
  return value;
}, z.boolean());

// Enum dos tipos válidos de transação.
// Exportado separadamente pois pode ser útil em outros lugares (ex: relatórios).
export const TransactionTypeEnum = z.enum(["receita", "despesa"], {
  errorMap: () => ({ message: "Tipo deve ser 'receita' ou 'despesa'" }),
});
// 'receita' = dinheiro entrando (vendas, serviços, etc.)
// 'despesa' = dinheiro saindo  (fornecedores, salários, etc.)

// =============================================================================
// SCHEMA: Criação de Transação
// =============================================================================
export const CreateTransactionSchema = z.object({
  type: TransactionTypeEnum,

  amount: z
    .number({ required_error: "Valor é obrigatório" })
    .positive("Valor deve ser positivo"),
  // Positivo pois o tipo (receita/despesa) já indica a direção do dinheiro.
  // Ex: uma despesa de R$100 é { type: 'despesa', amount: 100 } não { amount: -100 }

  description: z
    .string({ required_error: "Descrição é obrigatória" })
    .min(3, "Descrição deve ter no mínimo 3 caracteres")
    .max(500, "Descrição pode ter no máximo 500 caracteres")
    .trim(),

  category: z
    .string()
    .max(100, "Categoria pode ter no máximo 100 caracteres")
    .optional(),
  // Exemplos: 'Vendas', 'Fornecedores', 'Salários', 'Aluguel'

  supplier: z
    .string()
    .max(150, "Fornecedor pode ter no máximo 150 caracteres")
    .optional(),

  costCenter: z
    .string()
    .max(100, "Centro de custo pode ter no máximo 100 caracteres")
    .optional(),

  transactionDate: z
    .string()
    // Aceita YYYY-MM-DD (ex: "2024-03-15") ou datetime ISO completo (ex: "2024-03-15T10:00:00Z")
    .refine(
      (val) => !isNaN(Date.parse(val)),
      "Data inválida (use YYYY-MM-DD ou ISO 8601 com timezone)",
    )
    .optional()
    .transform((val) => (val ? new Date(val) : new Date())),
  // Transforma a string em objeto Date. Default: hoje.
});

// =============================================================================
// SCHEMA: Atualização de Transação
// =============================================================================
export const UpdateTransactionSchema = CreateTransactionSchema.partial();

// =============================================================================
// SCHEMA: Parâmetros de URL
// =============================================================================
export const TransactionParamsSchema = z.object({
  id: z.string().uuid("ID deve ser um UUID válido"),
});

// =============================================================================
// SCHEMA: Query Params para listagem com filtros financeiros
// =============================================================================
export const ListTransactionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),

  type: TransactionTypeEnum.optional(),
  // Filtra por tipo: ?type=receita ou ?type=despesa

  category: z.string().optional(),
  supplier: z.string().optional(),
  costCenter: z.string().optional(),
  search: z.string().optional(),

  startDate: z.string().optional(),
  // Filtra transações a partir desta data (formato: YYYY-MM-DD)

  endDate: z.string().optional(),
  // Filtra transações até esta data (formato: YYYY-MM-DD)
});

// =============================================================================
// ENUMS: Planejamento Financeiro (compromissos, parcelas e projeção)
// =============================================================================
export const CommitmentTypeEnum = z.enum(
  ["conta_fixa_mensal", "assinatura_mensal", "parcelamento"],
  {
    errorMap: () => ({
      message:
        "Tipo inválido. Use 'conta_fixa_mensal', 'assinatura_mensal' ou 'parcelamento'",
    }),
  },
);

export const OccurrenceStatusEnum = z.enum(
  ["pendente", "pago", "atrasado", "cancelado"],
  {
    errorMap: () => ({
      message:
        "Status inválido. Use 'pendente', 'pago', 'atrasado' ou 'cancelado'",
    }),
  },
);

// =============================================================================
// SCHEMA: Criação de Compromisso Financeiro
// =============================================================================
const CommitmentBaseSchema = z.object({
    title: z
      .string({ required_error: "Título é obrigatório" })
      .min(3, "Título deve ter no mínimo 3 caracteres")
      .max(200, "Título deve ter no máximo 200 caracteres")
      .trim(),

    description: z.string().max(500, "Descrição pode ter até 500 caracteres").optional(),

    category: z.string().max(100, "Categoria pode ter no máximo 100 caracteres").optional(),

    supplier: z
      .string()
      .max(150, "Fornecedor pode ter no máximo 150 caracteres")
      .optional(),

    costCenter: z
      .string()
      .max(100, "Centro de custo pode ter no máximo 100 caracteres")
      .optional(),

    type: CommitmentTypeEnum,

    direction: TransactionTypeEnum.default("despesa"),
    // Para futuras expansões (compromissos de receita recorrente).

    amount: z
      .number({ required_error: "Valor é obrigatório" })
      .positive("Valor deve ser positivo"),

    startDate: z
      .string({ required_error: "Data inicial é obrigatória" })
      .refine((val) => !isNaN(Date.parse(val)), "Data inicial inválida"),

    endDate: z
      .string()
      .refine((val) => !isNaN(Date.parse(val)), "Data final inválida")
      .optional(),

    dueDay: z.number().int().min(1).max(31).optional(),

    installmentCount: z.number().int().min(2).max(480).optional(),
  });

export const CreateCommitmentSchema = CommitmentBaseSchema
  .superRefine((data, ctx) => {
    if (data.type === "parcelamento" && !data.installmentCount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["installmentCount"],
        message: "Parcelamento exige quantidade de parcelas",
      });
    }
  });

// =============================================================================
// SCHEMA: Atualização de Compromisso
// =============================================================================
export const UpdateCommitmentSchema = CommitmentBaseSchema.partial();

// =============================================================================
// SCHEMA: Params
// =============================================================================
export const CommitmentParamsSchema = z.object({
  id: z.string().uuid("ID deve ser um UUID válido"),
});

export const OccurrenceParamsSchema = z.object({
  id: z.string().uuid("ID deve ser um UUID válido"),
});

// =============================================================================
// SCHEMA: Query de listagem de compromissos
// =============================================================================
export const ListCommitmentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  type: CommitmentTypeEnum.optional(),
  isActive: StringBooleanSchema.optional(),
  supplier: z.string().optional(),
  costCenter: z.string().optional(),
});

// =============================================================================
// SCHEMA: Query de projeção mensal
// =============================================================================
export const ProjectionQuerySchema = z.object({
  fromMonth: z
    .string()
    .regex(/^\d{4}-\d{2}$/, "Use o formato YYYY-MM")
    .optional(),
  toMonth: z
    .string()
    .regex(/^\d{4}-\d{2}$/, "Use o formato YYYY-MM")
    .optional(),
  status: OccurrenceStatusEnum.optional(),
  type: CommitmentTypeEnum.optional(),
  supplier: z.string().optional(),
  costCenter: z.string().optional(),
});

export const DashboardQuerySchema = z.object({
  months: z.coerce.number().int().min(1).max(24).default(6),
});

export const SnapshotMonthSchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/, "Use o formato YYYY-MM")
    .optional(),
});

export const MonthlyHistoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  fromMonth: z
    .string()
    .regex(/^\d{4}-\d{2}$/, "Use o formato YYYY-MM")
    .optional(),
  toMonth: z
    .string()
    .regex(/^\d{4}-\d{2}$/, "Use o formato YYYY-MM")
    .optional(),
});

export const MonthlyReportQuerySchema = z.object({
  fromMonth: z
    .string()
    .regex(/^\d{4}-\d{2}$/, "Use o formato YYYY-MM")
    .optional(),
  toMonth: z
    .string()
    .regex(/^\d{4}-\d{2}$/, "Use o formato YYYY-MM")
    .optional(),
  format: z.enum(["json", "csv"]).default("json"),
  persistMissing: StringBooleanSchema.default(true),
});

// =============================================================================
// SCHEMA: Baixa de ocorrência (pagamento)
// =============================================================================
export const SettleOccurrenceSchema = z.object({
  paidAmount: z.number().positive("Valor pago deve ser positivo").optional(),
  paymentDate: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), "Data de pagamento inválida")
    .optional(),
  penaltyAmount: z.number().min(0).default(0),
  interestAmount: z.number().min(0).default(0),
  discountAmount: z.number().min(0).default(0),
  notes: z.string().max(500).optional(),
  createTransaction: z.boolean().default(true),
});

export const ImportBankCsvOptionsSchema = z.object({
  defaultType: TransactionTypeEnum.default("despesa"),
  useAiCategorization: StringBooleanSchema.default(false),
  skipDuplicates: StringBooleanSchema.default(true),
});

// =============================================================================
// TIPOS INFERIDOS
// =============================================================================
export type CreateTransactionInput = z.infer<typeof CreateTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof UpdateTransactionSchema>;
export type TransactionParams = z.infer<typeof TransactionParamsSchema>;
export type ListTransactionsQuery = z.infer<typeof ListTransactionsQuerySchema>;
export type CommitmentType = z.infer<typeof CommitmentTypeEnum>;
export type OccurrenceStatus = z.infer<typeof OccurrenceStatusEnum>;
export type CreateCommitmentInput = z.infer<typeof CreateCommitmentSchema>;
export type UpdateCommitmentInput = z.infer<typeof UpdateCommitmentSchema>;
export type CommitmentParams = z.infer<typeof CommitmentParamsSchema>;
export type OccurrenceParams = z.infer<typeof OccurrenceParamsSchema>;
export type ListCommitmentsQuery = z.infer<typeof ListCommitmentsQuerySchema>;
export type ProjectionQuery = z.infer<typeof ProjectionQuerySchema>;
export type SettleOccurrenceInput = z.infer<typeof SettleOccurrenceSchema>;
export type DashboardQuery = z.infer<typeof DashboardQuerySchema>;
export type ImportBankCsvOptions = z.infer<typeof ImportBankCsvOptionsSchema>;
export type SnapshotMonthInput = z.infer<typeof SnapshotMonthSchema>;
export type MonthlyHistoryQuery = z.infer<typeof MonthlyHistoryQuerySchema>;
export type MonthlyReportQuery = z.infer<typeof MonthlyReportQuerySchema>;
