// =============================================================================
// src/modules/financeiro/financeiro.schema.ts
// =============================================================================
// O QUE FAZ:
//   Define os schemas de validação Zod para o módulo financeiro.
//   Mesmo padrão do estoque — demonstrando o reaproveitamento da arquitetura.
// =============================================================================

import { z } from "zod";

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

  startDate: z.string().optional(),
  // Filtra transações a partir desta data (formato: YYYY-MM-DD)

  endDate: z.string().optional(),
  // Filtra transações até esta data (formato: YYYY-MM-DD)
});

// =============================================================================
// TIPOS INFERIDOS
// =============================================================================
export type CreateTransactionInput = z.infer<typeof CreateTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof UpdateTransactionSchema>;
export type TransactionParams = z.infer<typeof TransactionParamsSchema>;
export type ListTransactionsQuery = z.infer<typeof ListTransactionsQuerySchema>;
