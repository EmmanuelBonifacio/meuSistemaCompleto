// =============================================================================
// src/modules/financeiro/financeiro.repository.ts
// =============================================================================
// O QUE FAZ:
//   Camada de acesso a dados do módulo financeiro. Executa queries SQL na
//   tabela `transactions` do schema do tenant via withTenantSchema.
//
// REAPROVEITAMENTO 100% COMPROVADO:
//   Compare este arquivo com estoque.repository.ts.
//   O PADRÃO É IDÊNTICO:
//   1. Recebe `schemaName` como parâmetro
//   2. Chama `withTenantSchema(schemaName, ...)`
//   3. Executa SQL parametrizado
//   4. Retorna os dados tipados
//
//   A diferença é APENAS o domínio (products vs transactions).
//   A lógica de isolamento é a mesma — o Core faz o trabalho pesado.
// =============================================================================

import { withTenantSchema } from "../../core/database/prisma";
import {
  CreateTransactionInput,
  UpdateTransactionInput,
  ListTransactionsQuery,
} from "./financeiro.schema";

// =============================================================================
// TIPO: Transaction
// =============================================================================
export interface Transaction {
  id: string;
  type: "receita" | "despesa";
  amount: number;
  description: string;
  category: string | null;
  transactionDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// TIPO: TransactionSummary (para o painel de resumo financeiro)
// =============================================================================
export interface FinancialSummary {
  totalReceitas: number;
  totalDespesas: number;
  saldo: number;
  periodo: { startDate: string | null; endDate: string | null };
}

// =============================================================================
// TIPO: TransactionListResult
// =============================================================================
export interface TransactionListResult {
  data: Transaction[];
  resumo: FinancialSummary;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// =============================================================================
// FUNÇÃO: findAllTransactions
// =============================================================================
export async function findAllTransactions(
  schemaName: string,
  query: ListTransactionsQuery,
): Promise<TransactionListResult> {
  const { page, limit, type, category, startDate, endDate } = query;
  const offset = (page - 1) * limit;

  return withTenantSchema(schemaName, async (tx) => {
    // Constrói WHERE dinamicamente com parâmetros seguros
    const conditions: string[] = [];
    const values: unknown[] = [];

    if (type) {
      values.push(type);
      conditions.push(`type = $${values.length}`);
    }
    if (category) {
      values.push(`%${category.toLowerCase()}%`);
      conditions.push(`LOWER(category) LIKE $${values.length}`);
    }
    if (startDate) {
      values.push(startDate);
      conditions.push(`transaction_date >= $${values.length}::date`);
    }
    if (endDate) {
      values.push(endDate);
      conditions.push(`transaction_date <= $${values.length}::date`);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // Busca as transações paginadas
    const listValues = [...values, limit, offset];
    const transactions = await tx.$queryRawUnsafe<Transaction[]>(
      `SELECT id, type, amount::float, description, category,
              transaction_date AS "transactionDate",
              created_at AS "createdAt",
              updated_at AS "updatedAt"
       FROM transactions
       ${whereClause}
       ORDER BY transaction_date DESC, created_at DESC
       LIMIT $${listValues.length - 1} OFFSET $${listValues.length}`,
      ...listValues,
    );

    // Total de registros para paginação
    const countResult = await tx.$queryRawUnsafe<[{ count: bigint }]>(
      `SELECT COUNT(*) as count FROM transactions ${whereClause}`,
      ...values,
    );
    const total = Number(countResult[0]?.count ?? 0);

    // Resumo financeiro do período filtrado
    // Esta query calcula receitas e despesas em uma única passagem na tabela
    // usando FILTER (extensão do padrão SQL suportada pelo PostgreSQL).
    const summaryResult = await tx.$queryRawUnsafe<
      [{ total_receitas: string; total_despesas: string }]
    >(
      `SELECT
         COALESCE(SUM(amount) FILTER (WHERE type = 'receita'), 0) AS total_receitas,
         COALESCE(SUM(amount) FILTER (WHERE type = 'despesa'), 0) AS total_despesas
       FROM transactions
       ${whereClause}`,
      ...values,
    );

    const totalReceitas = parseFloat(summaryResult[0]?.total_receitas ?? "0");
    const totalDespesas = parseFloat(summaryResult[0]?.total_despesas ?? "0");

    return {
      data: transactions,
      resumo: {
        totalReceitas,
        totalDespesas,
        saldo: totalReceitas - totalDespesas,
        periodo: {
          startDate: startDate ?? null,
          endDate: endDate ?? null,
        },
      },
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  });
}

// =============================================================================
// FUNÇÃO: findTransactionById
// =============================================================================
export async function findTransactionById(
  schemaName: string,
  id: string,
): Promise<Transaction | null> {
  return withTenantSchema(schemaName, async (tx) => {
    const results = await tx.$queryRaw<Transaction[]>`
      SELECT id, type, amount::float, description, category,
             transaction_date AS "transactionDate",
             created_at AS "createdAt",
             updated_at AS "updatedAt"
      FROM transactions
      WHERE id = ${id}::uuid
      LIMIT 1
    `;
    return results[0] ?? null;
  });
}

// =============================================================================
// FUNÇÃO: createTransaction
// =============================================================================
export async function createTransaction(
  schemaName: string,
  data: CreateTransactionInput,
): Promise<Transaction> {
  return withTenantSchema(schemaName, async (tx) => {
    const results = await tx.$queryRaw<Transaction[]>`
      INSERT INTO transactions (type, amount, description, category, transaction_date)
      VALUES (
        ${data.type},
        ${data.amount},
        ${data.description},
        ${data.category ?? null},
        ${data.transactionDate ?? new Date()}
      )
      RETURNING id, type, amount::float, description, category,
                transaction_date AS "transactionDate",
                created_at AS "createdAt",
                updated_at AS "updatedAt"
    `;
    return results[0];
  });
}

// =============================================================================
// FUNÇÃO: updateTransaction
// =============================================================================
export async function updateTransaction(
  schemaName: string,
  id: string,
  data: UpdateTransactionInput,
): Promise<Transaction | null> {
  return withTenantSchema(schemaName, async (tx) => {
    const setClauses: string[] = [];
    const values: unknown[] = [];

    if (data.type !== undefined) {
      values.push(data.type);
      setClauses.push(`type = $${values.length}`);
    }
    if (data.amount !== undefined) {
      values.push(data.amount);
      setClauses.push(`amount = $${values.length}`);
    }
    if (data.description !== undefined) {
      values.push(data.description);
      setClauses.push(`description = $${values.length}`);
    }
    if (data.category !== undefined) {
      values.push(data.category);
      setClauses.push(`category = $${values.length}`);
    }
    if (data.transactionDate !== undefined) {
      values.push(data.transactionDate);
      setClauses.push(`transaction_date = $${values.length}`);
    }

    if (setClauses.length === 0) {
      return findTransactionById(schemaName, id);
    }

    setClauses.push(`updated_at = NOW()`);
    values.push(id);

    const results = await tx.$queryRawUnsafe<Transaction[]>(
      `UPDATE transactions
       SET ${setClauses.join(", ")}
       WHERE id = $${values.length}::uuid
       RETURNING id, type, amount::float, description, category,
                 transaction_date AS "transactionDate",
                 created_at AS "createdAt",
                 updated_at AS "updatedAt"`,
      ...values,
    );

    return results[0] ?? null;
  });
}

// =============================================================================
// FUNÇÃO: deleteTransaction
// =============================================================================
// No financeiro, realizamos DELETE físico pois transações excluídas por
// engano podem ser recriadas, e manter transações "inativas" polui relatórios.
// Esta é uma decisão de NEGÓCIO que pode variar por projeto.
// =============================================================================
export async function deleteTransaction(
  schemaName: string,
  id: string,
): Promise<boolean> {
  return withTenantSchema(schemaName, async (tx) => {
    const result = await tx.$queryRaw<[{ id: string }]>`
      DELETE FROM transactions
      WHERE id = ${id}::uuid
      RETURNING id
    `;
    return result.length > 0;
  });
}
