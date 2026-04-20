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
import { Prisma } from "@prisma/client";
import {
  CreateTransactionInput,
  UpdateTransactionInput,
  ListTransactionsQuery,
  CreateCommitmentInput,
  UpdateCommitmentInput,
  ListCommitmentsQuery,
  ProjectionQuery,
  CommitmentType,
  OccurrenceStatus,
  SettleOccurrenceInput,
  DashboardQuery,
  ImportBankCsvOptions,
  SnapshotMonthInput,
  MonthlyHistoryQuery,
  MonthlyReportQuery,
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
  supplier: string | null;
  costCenter: string | null;
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

export interface FinancialCommitment {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  supplier: string | null;
  costCenter: string | null;
  type: CommitmentType;
  direction: "receita" | "despesa";
  amount: number;
  startDate: Date;
  endDate: Date | null;
  dueDay: number;
  installmentCount: number | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface FinancialOccurrence {
  id: string;
  commitmentId: string;
  commitmentTitle: string;
  commitmentType: CommitmentType;
  direction: "receita" | "despesa";
  category: string | null;
  supplier: string | null;
  costCenter: string | null;
  competenceMonth: Date;
  dueDate: Date;
  installmentNumber: number;
  installmentCount: number | null;
  expectedAmount: number;
  status: OccurrenceStatus;
  paidAmount: number | null;
  paidAt: Date | null;
  transactionId: string | null;
}

export interface FinancialCommitmentListResult {
  data: FinancialCommitment[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface FinancialProjectionResult {
  periodo: { fromMonth: string; toMonth: string };
  resumo: {
    totalPrevisto: number;
    totalPago: number;
    totalPendente: number;
    totalAtrasado: number;
  };
  ocorrencias: FinancialOccurrence[];
}

export interface FinancialDashboardResult {
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

export interface BankCsvImportInputRow {
  transactionDate: Date;
  description: string;
  amount: number;
  type: "receita" | "despesa";
  category?: string | null;
  supplier?: string | null;
  costCenter?: string | null;
}

export interface BankCsvImportResult {
  imported: number;
  skipped: number;
  duplicated: number;
  errors: Array<{ row: number; reason: string }>;
}

export interface FinancialMonthlyHistoryItem {
  id: string;
  month: Date;
  previsto: number;
  pago: number;
  pendente: number;
  atrasado: number;
  realizadoReceitas: number;
  realizadoDespesas: number;
  saldoRealizado: number;
  generatedAt: Date;
}

export interface FinancialMonthlyHistoryListResult {
  data: FinancialMonthlyHistoryItem[];
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
  const { page, limit, type, category, supplier, costCenter, search, startDate, endDate } =
    query;
  const offset = (page - 1) * limit;

  return withTenantSchema(schemaName, async (tx) => {
    await ensureFinancialPlanningTables(tx);
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
    if (supplier) {
      values.push(`%${supplier.toLowerCase()}%`);
      conditions.push(`LOWER(supplier) LIKE $${values.length}`);
    }
    if (costCenter) {
      values.push(`%${costCenter.toLowerCase()}%`);
      conditions.push(`LOWER(cost_center) LIKE $${values.length}`);
    }
    if (search) {
      values.push(`%${search.toLowerCase()}%`);
      const idx = values.length;
      conditions.push(
        `(LOWER(description) LIKE $${idx} OR LOWER(category) LIKE $${idx} OR LOWER(supplier) LIKE $${idx} OR LOWER(cost_center) LIKE $${idx})`,
      );
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
              supplier, cost_center AS "costCenter",
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
    await ensureFinancialPlanningTables(tx);
    const results = await tx.$queryRaw<Transaction[]>`
      SELECT id, type, amount::float, description, category,
             supplier, cost_center AS "costCenter",
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
    await ensureFinancialPlanningTables(tx);
    const results = await tx.$queryRaw<Transaction[]>`
      INSERT INTO transactions (
        type,
        amount,
        description,
        category,
        supplier,
        cost_center,
        transaction_date
      )
      VALUES (
        ${data.type},
        ${data.amount},
        ${data.description},
        ${data.category ?? null},
        ${data.supplier ?? null},
        ${data.costCenter ?? null},
        ${data.transactionDate ?? new Date()}
      )
      RETURNING id, type, amount::float, description, category,
                supplier, cost_center AS "costCenter",
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
    await ensureFinancialPlanningTables(tx);
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
    if (data.supplier !== undefined) {
      values.push(data.supplier);
      setClauses.push(`supplier = $${values.length}`);
    }
    if (data.costCenter !== undefined) {
      values.push(data.costCenter);
      setClauses.push(`cost_center = $${values.length}`);
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
                 supplier, cost_center AS "costCenter",
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
    await ensureFinancialPlanningTables(tx);
    const result = await tx.$queryRaw<[{ id: string }]>`
      DELETE FROM transactions
      WHERE id = ${id}::uuid
      RETURNING id
    `;
    return result.length > 0;
  });
}

function toMonthStart(month: string): Date {
  return new Date(`${month}-01T00:00:00.000Z`);
}

function formatMonth(date: Date): string {
  return date.toISOString().slice(0, 7);
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}

function buildDueDate(monthDate: Date, dueDay: number): Date {
  const year = monthDate.getUTCFullYear();
  const month = monthDate.getUTCMonth();
  const monthLastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const day = Math.min(Math.max(dueDay, 1), monthLastDay);
  return new Date(Date.UTC(year, month, day));
}

async function ensureFinancialPlanningTables(
  tx: Prisma.TransactionClient,
): Promise<void> {
  await tx.$executeRawUnsafe(`
    ALTER TABLE transactions
    ADD COLUMN IF NOT EXISTS supplier VARCHAR(150)
  `);
  await tx.$executeRawUnsafe(`
    ALTER TABLE transactions
    ADD COLUMN IF NOT EXISTS cost_center VARCHAR(100)
  `);

  await tx.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS financial_commitments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title VARCHAR(200) NOT NULL,
      description TEXT,
      category VARCHAR(100),
      supplier VARCHAR(150),
      cost_center VARCHAR(100),
      type VARCHAR(30) NOT NULL
        CONSTRAINT financial_commitments_type_check
        CHECK (type IN ('conta_fixa_mensal','assinatura_mensal','parcelamento')),
      direction VARCHAR(20) NOT NULL DEFAULT 'despesa'
        CONSTRAINT financial_commitments_direction_check
        CHECK (direction IN ('receita','despesa')),
      amount DECIMAL(12,2) NOT NULL
        CONSTRAINT financial_commitments_amount_positive CHECK (amount > 0),
      start_date DATE NOT NULL,
      end_date DATE,
      due_day INTEGER NOT NULL
        CONSTRAINT financial_commitments_due_day_check CHECK (due_day BETWEEN 1 AND 31),
      installment_count INTEGER
        CONSTRAINT financial_commitments_installment_count_check CHECK (installment_count IS NULL OR installment_count >= 2),
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await tx.$executeRawUnsafe(`
    ALTER TABLE financial_commitments
    ADD COLUMN IF NOT EXISTS supplier VARCHAR(150)
  `);
  await tx.$executeRawUnsafe(`
    ALTER TABLE financial_commitments
    ADD COLUMN IF NOT EXISTS cost_center VARCHAR(100)
  `);

  await tx.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS financial_occurrences (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      commitment_id UUID NOT NULL
        REFERENCES financial_commitments(id) ON DELETE CASCADE,
      competence_month DATE NOT NULL,
      due_date DATE NOT NULL,
      installment_number INTEGER NOT NULL DEFAULT 0,
      expected_amount DECIMAL(12,2) NOT NULL
        CONSTRAINT financial_occurrences_expected_amount_positive CHECK (expected_amount > 0),
      status VARCHAR(20) NOT NULL DEFAULT 'pendente'
        CONSTRAINT financial_occurrences_status_check
        CHECK (status IN ('pendente','pago','atrasado','cancelado')),
      paid_amount DECIMAL(12,2),
      paid_at DATE,
      transaction_id UUID,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT financial_occurrences_unique UNIQUE (
        commitment_id,
        competence_month,
        installment_number
      )
    )
  `);

  await tx.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_financial_occurrences_due_date
      ON financial_occurrences (due_date)
  `);
  await tx.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_financial_occurrences_status
      ON financial_occurrences (status)
  `);

  await tx.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS financial_payments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      occurrence_id UUID NOT NULL UNIQUE
        REFERENCES financial_occurrences(id) ON DELETE CASCADE,
      paid_amount DECIMAL(12,2) NOT NULL
        CONSTRAINT financial_payments_paid_amount_positive CHECK (paid_amount > 0),
      penalty_amount DECIMAL(12,2) NOT NULL DEFAULT 0
        CONSTRAINT financial_payments_penalty_non_negative CHECK (penalty_amount >= 0),
      interest_amount DECIMAL(12,2) NOT NULL DEFAULT 0
        CONSTRAINT financial_payments_interest_non_negative CHECK (interest_amount >= 0),
      discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0
        CONSTRAINT financial_payments_discount_non_negative CHECK (discount_amount >= 0),
      payment_date DATE NOT NULL,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await tx.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS financial_monthly_history (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      month DATE NOT NULL UNIQUE,
      previsto DECIMAL(14,2) NOT NULL DEFAULT 0,
      pago DECIMAL(14,2) NOT NULL DEFAULT 0,
      pendente DECIMAL(14,2) NOT NULL DEFAULT 0,
      atrasado DECIMAL(14,2) NOT NULL DEFAULT 0,
      realizado_receitas DECIMAL(14,2) NOT NULL DEFAULT 0,
      realizado_despesas DECIMAL(14,2) NOT NULL DEFAULT 0,
      saldo_realizado DECIMAL(14,2) NOT NULL DEFAULT 0,
      generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await tx.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_financial_monthly_history_month
      ON financial_monthly_history (month DESC)
  `);
}

async function materializeOccurrences(
  tx: Prisma.TransactionClient,
  fromMonth: Date,
  toMonth: Date,
): Promise<void> {
  const commitments = await tx.$queryRawUnsafe<FinancialCommitment[]>(
    `SELECT id, title, description, category, supplier,
            cost_center AS "costCenter", type, direction, amount::float,
            start_date AS "startDate",
            end_date AS "endDate",
            due_day AS "dueDay",
            installment_count AS "installmentCount",
            is_active AS "isActive",
            created_at AS "createdAt",
            updated_at AS "updatedAt"
     FROM financial_commitments
     WHERE is_active = true`,
  );

  for (const commitment of commitments) {
    const startMonth = new Date(
      Date.UTC(
        commitment.startDate.getUTCFullYear(),
        commitment.startDate.getUTCMonth(),
        1,
      ),
    );
    const endMonth = commitment.endDate
      ? new Date(
          Date.UTC(
            commitment.endDate.getUTCFullYear(),
            commitment.endDate.getUTCMonth(),
            1,
          ),
        )
      : null;

    if (commitment.type === "parcelamento") {
      const totalInstallments = commitment.installmentCount ?? 0;
      if (totalInstallments < 2) continue;

      const baseInstallment = Number(
        (commitment.amount / totalInstallments).toFixed(2),
      );
      const lastInstallment = Number(
        (commitment.amount - baseInstallment * (totalInstallments - 1)).toFixed(2),
      );

      for (let i = 1; i <= totalInstallments; i += 1) {
        const monthDate = addMonths(startMonth, i - 1);
        if (monthDate < fromMonth || monthDate > toMonth) continue;

        const dueDate = buildDueDate(monthDate, commitment.dueDay);
        const expectedAmount = i === totalInstallments ? lastInstallment : baseInstallment;

        await tx.$executeRaw`
          INSERT INTO financial_occurrences (
            commitment_id,
            competence_month,
            due_date,
            installment_number,
            expected_amount,
            status
          )
          VALUES (
            ${commitment.id}::uuid,
            ${monthDate}::date,
            ${dueDate}::date,
            ${i},
            ${expectedAmount},
            'pendente'
          )
          ON CONFLICT (commitment_id, competence_month, installment_number) DO NOTHING
        `;
      }
      continue;
    }

    const iterStart = startMonth > fromMonth ? startMonth : fromMonth;
    let cursor = new Date(iterStart);
    while (cursor <= toMonth) {
      if (endMonth && cursor > endMonth) break;

      const dueDate = buildDueDate(cursor, commitment.dueDay);
      await tx.$executeRaw`
        INSERT INTO financial_occurrences (
          commitment_id,
          competence_month,
          due_date,
          installment_number,
          expected_amount,
          status
        )
        VALUES (
          ${commitment.id}::uuid,
          ${cursor}::date,
          ${dueDate}::date,
          0,
          ${commitment.amount},
          'pendente'
        )
        ON CONFLICT (commitment_id, competence_month, installment_number) DO NOTHING
      `;

      cursor = addMonths(cursor, 1);
    }
  }
}

export async function listCommitments(
  schemaName: string,
  query: ListCommitmentsQuery,
): Promise<FinancialCommitmentListResult> {
  const { page, limit, type, isActive, supplier, costCenter } = query;
  const offset = (page - 1) * limit;

  return withTenantSchema(schemaName, async (tx) => {
    await ensureFinancialPlanningTables(tx);

    const conditions: string[] = [];
    const values: unknown[] = [];

    if (type) {
      values.push(type);
      conditions.push(`type = $${values.length}`);
    }
    if (isActive !== undefined) {
      values.push(isActive);
      conditions.push(`is_active = $${values.length}`);
    }
    if (supplier) {
      values.push(`%${supplier.toLowerCase()}%`);
      conditions.push(`LOWER(supplier) LIKE $${values.length}`);
    }
    if (costCenter) {
      values.push(`%${costCenter.toLowerCase()}%`);
      conditions.push(`LOWER(cost_center) LIKE $${values.length}`);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const listValues = [...values, limit, offset];
    const data = await tx.$queryRawUnsafe<FinancialCommitment[]>(
      `SELECT id, title, description, category, supplier,
              cost_center AS "costCenter", type, direction, amount::float,
              start_date AS "startDate",
              end_date AS "endDate",
              due_day AS "dueDay",
              installment_count AS "installmentCount",
              is_active AS "isActive",
              created_at AS "createdAt",
              updated_at AS "updatedAt"
       FROM financial_commitments
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${listValues.length - 1} OFFSET $${listValues.length}`,
      ...listValues,
    );

    const countResult = await tx.$queryRawUnsafe<[{ count: bigint }]>(
      `SELECT COUNT(*) as count FROM financial_commitments ${whereClause}`,
      ...values,
    );
    const total = Number(countResult[0]?.count ?? 0);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  });
}

export async function createCommitment(
  schemaName: string,
  data: CreateCommitmentInput,
): Promise<FinancialCommitment> {
  return withTenantSchema(schemaName, async (tx) => {
    await ensureFinancialPlanningTables(tx);

    const startDate = new Date(data.startDate);
    const endDate = data.endDate ? new Date(data.endDate) : null;
    const dueDay =
      data.dueDay ?? Math.min(31, Math.max(1, startDate.getUTCDate()));

    const results = await tx.$queryRaw<FinancialCommitment[]>`
      INSERT INTO financial_commitments (
        title,
        description,
        category,
        supplier,
        cost_center,
        type,
        direction,
        amount,
        start_date,
        end_date,
        due_day,
        installment_count
      )
      VALUES (
        ${data.title},
        ${data.description ?? null},
        ${data.category ?? null},
        ${data.supplier ?? null},
        ${data.costCenter ?? null},
        ${data.type},
        ${data.direction},
        ${data.amount},
        ${startDate},
        ${endDate},
        ${dueDay},
        ${data.installmentCount ?? null}
      )
      RETURNING id, title, description, category, supplier,
                cost_center AS "costCenter", type, direction, amount::float,
                start_date AS "startDate",
                end_date AS "endDate",
                due_day AS "dueDay",
                installment_count AS "installmentCount",
                is_active AS "isActive",
                created_at AS "createdAt",
                updated_at AS "updatedAt"
    `;

    const created = results[0];
    const currentMonth = new Date();
    const fromMonth = new Date(
      Date.UTC(currentMonth.getUTCFullYear(), currentMonth.getUTCMonth(), 1),
    );
    const toMonth = addMonths(fromMonth, 12);
    await materializeOccurrences(tx, fromMonth, toMonth);

    return created;
  });
}

export async function updateCommitment(
  schemaName: string,
  id: string,
  data: UpdateCommitmentInput,
): Promise<FinancialCommitment | null> {
  return withTenantSchema(schemaName, async (tx) => {
    await ensureFinancialPlanningTables(tx);

    const setClauses: string[] = [];
    const values: unknown[] = [];

    if (data.title !== undefined) {
      values.push(data.title);
      setClauses.push(`title = $${values.length}`);
    }
    if (data.description !== undefined) {
      values.push(data.description);
      setClauses.push(`description = $${values.length}`);
    }
    if (data.category !== undefined) {
      values.push(data.category);
      setClauses.push(`category = $${values.length}`);
    }
    if (data.supplier !== undefined) {
      values.push(data.supplier);
      setClauses.push(`supplier = $${values.length}`);
    }
    if (data.costCenter !== undefined) {
      values.push(data.costCenter);
      setClauses.push(`cost_center = $${values.length}`);
    }
    if (data.type !== undefined) {
      values.push(data.type);
      setClauses.push(`type = $${values.length}`);
    }
    if (data.direction !== undefined) {
      values.push(data.direction);
      setClauses.push(`direction = $${values.length}`);
    }
    if (data.amount !== undefined) {
      values.push(data.amount);
      setClauses.push(`amount = $${values.length}`);
    }
    if (data.startDate !== undefined) {
      values.push(new Date(data.startDate));
      setClauses.push(`start_date = $${values.length}`);
    }
    if (data.endDate !== undefined) {
      values.push(data.endDate ? new Date(data.endDate) : null);
      setClauses.push(`end_date = $${values.length}`);
    }
    if (data.dueDay !== undefined) {
      values.push(data.dueDay);
      setClauses.push(`due_day = $${values.length}`);
    }
    if (data.installmentCount !== undefined) {
      values.push(data.installmentCount);
      setClauses.push(`installment_count = $${values.length}`);
    }

    if (setClauses.length === 0) {
      const found = await tx.$queryRaw<FinancialCommitment[]>`
        SELECT id, title, description, category, supplier,
               cost_center AS "costCenter", type, direction, amount::float,
               start_date AS "startDate",
               end_date AS "endDate",
               due_day AS "dueDay",
               installment_count AS "installmentCount",
               is_active AS "isActive",
               created_at AS "createdAt",
               updated_at AS "updatedAt"
        FROM financial_commitments
        WHERE id = ${id}::uuid
        LIMIT 1
      `;
      return found[0] ?? null;
    }

    setClauses.push(`updated_at = NOW()`);
    values.push(id);

    const results = await tx.$queryRawUnsafe<FinancialCommitment[]>(
      `UPDATE financial_commitments
       SET ${setClauses.join(", ")}
       WHERE id = $${values.length}::uuid
       RETURNING id, title, description, category, supplier,
                 cost_center AS "costCenter", type, direction, amount::float,
                 start_date AS "startDate",
                 end_date AS "endDate",
                 due_day AS "dueDay",
                 installment_count AS "installmentCount",
                 is_active AS "isActive",
                 created_at AS "createdAt",
                 updated_at AS "updatedAt"`,
      ...values,
    );

    return results[0] ?? null;
  });
}

export async function deleteCommitment(
  schemaName: string,
  id: string,
): Promise<boolean> {
  return withTenantSchema(schemaName, async (tx) => {
    await ensureFinancialPlanningTables(tx);
    const result = await tx.$queryRaw<[{ id: string }]>`
      UPDATE financial_commitments
      SET is_active = false, updated_at = NOW()
      WHERE id = ${id}::uuid
      RETURNING id
    `;
    return result.length > 0;
  });
}

export async function getProjection(
  schemaName: string,
  query: ProjectionQuery,
): Promise<FinancialProjectionResult> {
  return withTenantSchema(schemaName, async (tx) => {
    await ensureFinancialPlanningTables(tx);

    const now = new Date();
    const defaultFrom = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );
    const defaultTo = addMonths(defaultFrom, 2);

    const fromMonth = query.fromMonth ? toMonthStart(query.fromMonth) : defaultFrom;
    const toMonth = query.toMonth ? toMonthStart(query.toMonth) : defaultTo;
    const orderedFrom = fromMonth <= toMonth ? fromMonth : toMonth;
    const orderedTo = fromMonth <= toMonth ? toMonth : fromMonth;

    await materializeOccurrences(tx, orderedFrom, orderedTo);

    await tx.$executeRaw`
      UPDATE financial_occurrences
      SET status = 'atrasado', updated_at = NOW()
      WHERE status = 'pendente'
        AND due_date < CURRENT_DATE
    `;

    const conditions: string[] = [
      `o.competence_month >= $1::date`,
      `o.competence_month <= $2::date`,
    ];
    const values: unknown[] = [orderedFrom, orderedTo];

    if (query.status) {
      values.push(query.status);
      conditions.push(`o.status = $${values.length}`);
    }
    if (query.type) {
      values.push(query.type);
      conditions.push(`c.type = $${values.length}`);
    }
    if (query.supplier) {
      values.push(`%${query.supplier.toLowerCase()}%`);
      conditions.push(`LOWER(c.supplier) LIKE $${values.length}`);
    }
    if (query.costCenter) {
      values.push(`%${query.costCenter.toLowerCase()}%`);
      conditions.push(`LOWER(c.cost_center) LIKE $${values.length}`);
    }

    const rows = await tx.$queryRawUnsafe<FinancialOccurrence[]>(
      `SELECT
         o.id,
         o.commitment_id AS "commitmentId",
         c.title AS "commitmentTitle",
         c.type AS "commitmentType",
         c.direction,
         c.category,
         c.supplier,
         c.cost_center AS "costCenter",
         o.competence_month AS "competenceMonth",
         o.due_date AS "dueDate",
         o.installment_number AS "installmentNumber",
         c.installment_count AS "installmentCount",
         o.expected_amount::float AS "expectedAmount",
         o.status,
         o.paid_amount::float AS "paidAmount",
         o.paid_at AS "paidAt",
         o.transaction_id AS "transactionId"
       FROM financial_occurrences o
       INNER JOIN financial_commitments c ON c.id = o.commitment_id
       WHERE ${conditions.join(" AND ")}
       ORDER BY o.due_date ASC, o.created_at ASC`,
      ...values,
    );

    let totalPrevisto = 0;
    let totalPago = 0;
    let totalPendente = 0;
    let totalAtrasado = 0;

    for (const row of rows) {
      totalPrevisto += row.expectedAmount;
      if (row.status === "pago") {
        totalPago += row.paidAmount ?? row.expectedAmount;
      } else if (row.status === "pendente") {
        totalPendente += row.expectedAmount;
      } else if (row.status === "atrasado") {
        totalAtrasado += row.expectedAmount;
      }
    }

    return {
      periodo: {
        fromMonth: formatMonth(orderedFrom),
        toMonth: formatMonth(orderedTo),
      },
      resumo: {
        totalPrevisto: Number(totalPrevisto.toFixed(2)),
        totalPago: Number(totalPago.toFixed(2)),
        totalPendente: Number(totalPendente.toFixed(2)),
        totalAtrasado: Number(totalAtrasado.toFixed(2)),
      },
      ocorrencias: rows,
    };
  });
}

export async function getFinancialDashboard(
  schemaName: string,
  query: DashboardQuery,
): Promise<FinancialDashboardResult> {
  return withTenantSchema(schemaName, async (tx) => {
    await ensureFinancialPlanningTables(tx);

    const now = new Date();
    const months = query.months;
    const currentMonth = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );
    const fromMonth = addMonths(currentMonth, -(months - 1));
    const toMonth = currentMonth;

    await materializeOccurrences(tx, fromMonth, toMonth);

    const monthlyProjection = await tx.$queryRaw<
      Array<{
        month: Date;
        previsto: string;
        pago: string;
      }>
    >`
      SELECT
        date_trunc('month', competence_month)::date AS month,
        COALESCE(SUM(expected_amount), 0) AS previsto,
        COALESCE(SUM(paid_amount), 0) AS pago
      FROM financial_occurrences
      WHERE competence_month >= ${fromMonth}::date
        AND competence_month <= ${toMonth}::date
      GROUP BY 1
      ORDER BY 1 ASC
    `;

    const monthlyTransactions = await tx.$queryRaw<
      Array<{
        month: Date;
        receitas: string;
        despesas: string;
      }>
    >`
      SELECT
        date_trunc('month', transaction_date)::date AS month,
        COALESCE(SUM(amount) FILTER (WHERE type = 'receita'), 0) AS receitas,
        COALESCE(SUM(amount) FILTER (WHERE type = 'despesa'), 0) AS despesas
      FROM transactions
      WHERE transaction_date >= ${fromMonth}::date
        AND transaction_date <= ${toMonth}::date
      GROUP BY 1
      ORDER BY 1 ASC
    `;

    const map = new Map<
      string,
      {
        month: string;
        previsto: number;
        pago: number;
        realizadoReceitas: number;
        realizadoDespesas: number;
      }
    >();

    for (let i = 0; i < months; i += 1) {
      const m = addMonths(fromMonth, i);
      const key = formatMonth(m);
      map.set(key, {
        month: key,
        previsto: 0,
        pago: 0,
        realizadoReceitas: 0,
        realizadoDespesas: 0,
      });
    }

    for (const row of monthlyProjection) {
      const key = formatMonth(row.month);
      const entry = map.get(key);
      if (!entry) continue;
      entry.previsto = Number(parseFloat(row.previsto ?? "0").toFixed(2));
      entry.pago = Number(parseFloat(row.pago ?? "0").toFixed(2));
    }

    for (const row of monthlyTransactions) {
      const key = formatMonth(row.month);
      const entry = map.get(key);
      if (!entry) continue;
      entry.realizadoReceitas = Number(parseFloat(row.receitas ?? "0").toFixed(2));
      entry.realizadoDespesas = Number(parseFloat(row.despesas ?? "0").toFixed(2));
    }

    const monthly = Array.from(map.values()).map((m) => ({
      ...m,
      saldoRealizado: Number((m.realizadoReceitas - m.realizadoDespesas).toFixed(2)),
    }));

    const totals = monthly.reduce(
      (acc, cur) => {
        acc.previsto += cur.previsto;
        acc.pago += cur.pago;
        acc.realizadoReceitas += cur.realizadoReceitas;
        acc.realizadoDespesas += cur.realizadoDespesas;
        acc.saldoRealizado += cur.saldoRealizado;
        return acc;
      },
      {
        previsto: 0,
        pago: 0,
        realizadoReceitas: 0,
        realizadoDespesas: 0,
        saldoRealizado: 0,
      },
    );

    return {
      monthly,
      totals: {
        previsto: Number(totals.previsto.toFixed(2)),
        pago: Number(totals.pago.toFixed(2)),
        realizadoReceitas: Number(totals.realizadoReceitas.toFixed(2)),
        realizadoDespesas: Number(totals.realizadoDespesas.toFixed(2)),
        saldoRealizado: Number(totals.saldoRealizado.toFixed(2)),
      },
    };
  });
}

async function buildMonthlySnapshot(
  tx: Prisma.TransactionClient,
  monthDate: Date,
  persist: boolean,
): Promise<FinancialMonthlyHistoryItem> {
  const monthStart = new Date(
    Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth(), 1),
  );
  await materializeOccurrences(tx, monthStart, monthStart);

  const occurrenceAgg = await tx.$queryRaw<
    Array<{
      previsto: string;
      pago: string;
      pendente: string;
      atrasado: string;
    }>
  >`
    SELECT
      COALESCE(SUM(expected_amount), 0) AS previsto,
      COALESCE(SUM(paid_amount) FILTER (WHERE status = 'pago'), 0) AS pago,
      COALESCE(SUM(expected_amount) FILTER (WHERE status = 'pendente'), 0) AS pendente,
      COALESCE(SUM(expected_amount) FILTER (WHERE status = 'atrasado'), 0) AS atrasado
    FROM financial_occurrences
    WHERE competence_month = ${monthStart}::date
  `;

  const txAgg = await tx.$queryRaw<
    Array<{
      receitas: string;
      despesas: string;
    }>
  >`
    SELECT
      COALESCE(SUM(amount) FILTER (WHERE type = 'receita'), 0) AS receitas,
      COALESCE(SUM(amount) FILTER (WHERE type = 'despesa'), 0) AS despesas
    FROM transactions
    WHERE date_trunc('month', transaction_date)::date = ${monthStart}::date
  `;

  const previsto = Number(parseFloat(occurrenceAgg[0]?.previsto ?? "0").toFixed(2));
  const pago = Number(parseFloat(occurrenceAgg[0]?.pago ?? "0").toFixed(2));
  const pendente = Number(parseFloat(occurrenceAgg[0]?.pendente ?? "0").toFixed(2));
  const atrasado = Number(parseFloat(occurrenceAgg[0]?.atrasado ?? "0").toFixed(2));
  const realizadoReceitas = Number(parseFloat(txAgg[0]?.receitas ?? "0").toFixed(2));
  const realizadoDespesas = Number(parseFloat(txAgg[0]?.despesas ?? "0").toFixed(2));
  const saldoRealizado = Number((realizadoReceitas - realizadoDespesas).toFixed(2));

  if (persist) {
    await tx.$executeRaw`
      INSERT INTO financial_monthly_history (
        month,
        previsto,
        pago,
        pendente,
        atrasado,
        realizado_receitas,
        realizado_despesas,
        saldo_realizado,
        generated_at
      )
      VALUES (
        ${monthStart}::date,
        ${previsto},
        ${pago},
        ${pendente},
        ${atrasado},
        ${realizadoReceitas},
        ${realizadoDespesas},
        ${saldoRealizado},
        NOW()
      )
      ON CONFLICT (month) DO UPDATE
      SET previsto = EXCLUDED.previsto,
          pago = EXCLUDED.pago,
          pendente = EXCLUDED.pendente,
          atrasado = EXCLUDED.atrasado,
          realizado_receitas = EXCLUDED.realizado_receitas,
          realizado_despesas = EXCLUDED.realizado_despesas,
          saldo_realizado = EXCLUDED.saldo_realizado,
          generated_at = NOW()
    `;
  }

  return {
    id: "snapshot",
    month: monthStart,
    previsto,
    pago,
    pendente,
    atrasado,
    realizadoReceitas,
    realizadoDespesas,
    saldoRealizado,
    generatedAt: new Date(),
  };
}

export async function snapshotMonthlyHistory(
  schemaName: string,
  input: SnapshotMonthInput,
): Promise<FinancialMonthlyHistoryItem> {
  return withTenantSchema(schemaName, async (tx) => {
    await ensureFinancialPlanningTables(tx);
    const monthStart = input.month
      ? toMonthStart(input.month)
      : new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));

    await buildMonthlySnapshot(tx, monthStart, true);
    const saved = await tx.$queryRaw<FinancialMonthlyHistoryItem[]>`
      SELECT
        id,
        month,
        previsto::float AS previsto,
        pago::float AS pago,
        pendente::float AS pendente,
        atrasado::float AS atrasado,
        realizado_receitas::float AS "realizadoReceitas",
        realizado_despesas::float AS "realizadoDespesas",
        saldo_realizado::float AS "saldoRealizado",
        generated_at AS "generatedAt"
      FROM financial_monthly_history
      WHERE month = ${monthStart}::date
      LIMIT 1
    `;
    return saved[0];
  });
}

export async function listMonthlyHistory(
  schemaName: string,
  query: MonthlyHistoryQuery,
): Promise<FinancialMonthlyHistoryListResult> {
  const { page, limit, fromMonth, toMonth } = query;
  const offset = (page - 1) * limit;

  return withTenantSchema(schemaName, async (tx) => {
    await ensureFinancialPlanningTables(tx);

    const conditions: string[] = [];
    const values: unknown[] = [];

    if (fromMonth) {
      values.push(toMonthStart(fromMonth));
      conditions.push(`month >= $${values.length}::date`);
    }
    if (toMonth) {
      values.push(toMonthStart(toMonth));
      conditions.push(`month <= $${values.length}::date`);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const listValues = [...values, limit, offset];
    const data = await tx.$queryRawUnsafe<FinancialMonthlyHistoryItem[]>(
      `SELECT
         id,
         month,
         previsto::float AS previsto,
         pago::float AS pago,
         pendente::float AS pendente,
         atrasado::float AS atrasado,
         realizado_receitas::float AS "realizadoReceitas",
         realizado_despesas::float AS "realizadoDespesas",
         saldo_realizado::float AS "saldoRealizado",
         generated_at AS "generatedAt"
       FROM financial_monthly_history
       ${whereClause}
       ORDER BY month DESC
       LIMIT $${listValues.length - 1} OFFSET $${listValues.length}`,
      ...listValues,
    );

    const countResult = await tx.$queryRawUnsafe<[{ count: bigint }]>(
      `SELECT COUNT(*) AS count FROM financial_monthly_history ${whereClause}`,
      ...values,
    );
    const total = Number(countResult[0]?.count ?? 0);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  });
}

export async function generateMonthlyReport(
  schemaName: string,
  query: MonthlyReportQuery,
): Promise<FinancialMonthlyHistoryItem[]> {
  return withTenantSchema(schemaName, async (tx) => {
    await ensureFinancialPlanningTables(tx);

    const now = new Date();
    const defaultTo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const defaultFrom = addMonths(defaultTo, -5);

    const from = query.fromMonth ? toMonthStart(query.fromMonth) : defaultFrom;
    const to = query.toMonth ? toMonthStart(query.toMonth) : defaultTo;
    const orderedFrom = from <= to ? from : to;
    const orderedTo = from <= to ? to : from;

    const months: Date[] = [];
    let cursor = new Date(orderedFrom);
    while (cursor <= orderedTo) {
      months.push(new Date(cursor));
      cursor = addMonths(cursor, 1);
    }

    const rows: FinancialMonthlyHistoryItem[] = [];
    for (const monthDate of months) {
      const existing = await tx.$queryRaw<FinancialMonthlyHistoryItem[]>`
        SELECT
          id,
          month,
          previsto::float AS previsto,
          pago::float AS pago,
          pendente::float AS pendente,
          atrasado::float AS atrasado,
          realizado_receitas::float AS "realizadoReceitas",
          realizado_despesas::float AS "realizadoDespesas",
          saldo_realizado::float AS "saldoRealizado",
          generated_at AS "generatedAt"
        FROM financial_monthly_history
        WHERE month = ${monthDate}::date
        LIMIT 1
      `;

      if (existing[0]) {
        rows.push(existing[0]);
        continue;
      }

      const generated = await buildMonthlySnapshot(tx, monthDate, query.persistMissing);
      if (query.persistMissing) {
        const persisted = await tx.$queryRaw<FinancialMonthlyHistoryItem[]>`
          SELECT
            id,
            month,
            previsto::float AS previsto,
            pago::float AS pago,
            pendente::float AS pendente,
            atrasado::float AS atrasado,
            realizado_receitas::float AS "realizadoReceitas",
            realizado_despesas::float AS "realizadoDespesas",
            saldo_realizado::float AS "saldoRealizado",
            generated_at AS "generatedAt"
          FROM financial_monthly_history
          WHERE month = ${monthDate}::date
          LIMIT 1
        `;
        rows.push(persisted[0] ?? generated);
      } else {
        rows.push(generated);
      }
    }

    return rows.sort((a, b) => a.month.getTime() - b.month.getTime());
  });
}

async function classifyWithOllama(input: {
  description: string;
  amount: number;
  type: "receita" | "despesa";
}): Promise<{ category?: string; supplier?: string; costCenter?: string } | null> {
  const baseUrl = process.env.OLLAMA_BASE_URL?.trim();
  const model = process.env.OLLAMA_MODEL?.trim();
  if (!baseUrl || !model) return null;

  const prompt =
    "Classifique a transação financeira retornando APENAS JSON válido no formato " +
    '{"category":"", "supplier":"", "costCenter":""}. ' +
    "Use no máximo 30 caracteres por campo. Se não souber, deixe vazio. " +
    `Descrição: ${input.description}. Valor: ${input.amount}. Tipo: ${input.type}.`;

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        format: "json",
      }),
    });

    if (!response.ok) return null;
    const payload = (await response.json()) as { response?: string };
    if (!payload.response) return null;
    const parsed = JSON.parse(payload.response) as Record<string, unknown>;
    return {
      category:
        typeof parsed.category === "string" && parsed.category.trim()
          ? parsed.category.trim().slice(0, 100)
          : undefined,
      supplier:
        typeof parsed.supplier === "string" && parsed.supplier.trim()
          ? parsed.supplier.trim().slice(0, 150)
          : undefined,
      costCenter:
        typeof parsed.costCenter === "string" && parsed.costCenter.trim()
          ? parsed.costCenter.trim().slice(0, 100)
          : undefined,
    };
  } catch {
    return null;
  }
}

export async function importBankCsvRows(
  schemaName: string,
  rows: BankCsvImportInputRow[],
  options: ImportBankCsvOptions,
): Promise<BankCsvImportResult> {
  return withTenantSchema(schemaName, async (tx) => {
    await ensureFinancialPlanningTables(tx);

    const result: BankCsvImportResult = {
      imported: 0,
      skipped: 0,
      duplicated: 0,
      errors: [],
    };

    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i];
      if (!row.description?.trim() || !row.amount || row.amount <= 0) {
        result.skipped += 1;
        result.errors.push({ row: i + 1, reason: "Linha com dados incompletos" });
        continue;
      }

      const rowType = row.type ?? options.defaultType;
      let category = row.category ?? null;
      let supplier = row.supplier ?? null;
      let costCenter = row.costCenter ?? null;

      if (options.useAiCategorization && (!category || !supplier || !costCenter)) {
        const ai = await classifyWithOllama({
          description: row.description,
          amount: row.amount,
          type: rowType,
        });
        category = category ?? ai?.category ?? null;
        supplier = supplier ?? ai?.supplier ?? null;
        costCenter = costCenter ?? ai?.costCenter ?? null;
      }

      if (options.skipDuplicates) {
        const duplicates = await tx.$queryRaw<[{ count: bigint }]>`
          SELECT COUNT(*)::bigint AS count
          FROM transactions
          WHERE type = ${rowType}
            AND amount = ${row.amount}
            AND description = ${row.description}
            AND transaction_date = ${row.transactionDate}::date
          LIMIT 1
        `;
        if (Number(duplicates[0]?.count ?? 0) > 0) {
          result.duplicated += 1;
          continue;
        }
      }

      await tx.$executeRaw`
        INSERT INTO transactions (
          type, amount, description, category, supplier, cost_center, transaction_date
        ) VALUES (
          ${rowType},
          ${row.amount},
          ${row.description},
          ${category},
          ${supplier},
          ${costCenter},
          ${row.transactionDate}::date
        )
      `;
      result.imported += 1;
    }

    return result;
  });
}

export async function settleOccurrence(
  schemaName: string,
  id: string,
  data: SettleOccurrenceInput,
): Promise<FinancialOccurrence | null> {
  return withTenantSchema(schemaName, async (tx) => {
    await ensureFinancialPlanningTables(tx);

    const results = await tx.$queryRaw<FinancialOccurrence[]>`
      SELECT
        o.id,
        o.commitment_id AS "commitmentId",
        c.title AS "commitmentTitle",
        c.type AS "commitmentType",
        c.direction,
        c.category,
        c.supplier,
        c.cost_center AS "costCenter",
        o.competence_month AS "competenceMonth",
        o.due_date AS "dueDate",
        o.installment_number AS "installmentNumber",
        c.installment_count AS "installmentCount",
        o.expected_amount::float AS "expectedAmount",
        o.status,
        o.paid_amount::float AS "paidAmount",
        o.paid_at AS "paidAt",
        o.transaction_id AS "transactionId"
      FROM financial_occurrences o
      INNER JOIN financial_commitments c ON c.id = o.commitment_id
      WHERE o.id = ${id}::uuid
      LIMIT 1
    `;

    const occurrence = results[0];
    if (!occurrence) return null;
    if (occurrence.status === "pago") return occurrence;
    if (occurrence.status === "cancelado") return null;

    const paymentDate = data.paymentDate ? new Date(data.paymentDate) : new Date();
    const netExpected =
      occurrence.expectedAmount +
      data.penaltyAmount +
      data.interestAmount -
      data.discountAmount;
    const paidAmount = data.paidAmount ?? Number(netExpected.toFixed(2));

    let transactionId: string | null = null;
    if (data.createTransaction) {
      const txInsert = await tx.$queryRaw<[{ id: string }]>`
        INSERT INTO transactions (
          type,
          amount,
          description,
          category,
          supplier,
          cost_center,
          transaction_date
        )
        VALUES (
          ${occurrence.direction},
          ${paidAmount},
          ${`Baixa: ${occurrence.commitmentTitle}`},
          ${occurrence.category},
          ${occurrence.supplier},
          ${occurrence.costCenter},
          ${paymentDate}
        )
        RETURNING id
      `;
      transactionId = txInsert[0]?.id ?? null;
    }

    await tx.$executeRaw`
      UPDATE financial_occurrences
      SET status = 'pago',
          paid_amount = ${paidAmount},
          paid_at = ${paymentDate}::date,
          transaction_id = ${transactionId}::uuid,
          updated_at = NOW()
      WHERE id = ${id}::uuid
    `;

    await tx.$executeRaw`
      INSERT INTO financial_payments (
        occurrence_id,
        paid_amount,
        penalty_amount,
        interest_amount,
        discount_amount,
        payment_date,
        notes
      )
      VALUES (
        ${id}::uuid,
        ${paidAmount},
        ${data.penaltyAmount},
        ${data.interestAmount},
        ${data.discountAmount},
        ${paymentDate}::date,
        ${data.notes ?? null}
      )
      ON CONFLICT (occurrence_id) DO UPDATE
      SET paid_amount = EXCLUDED.paid_amount,
          penalty_amount = EXCLUDED.penalty_amount,
          interest_amount = EXCLUDED.interest_amount,
          discount_amount = EXCLUDED.discount_amount,
          payment_date = EXCLUDED.payment_date,
          notes = EXCLUDED.notes
    `;

    const updated = await tx.$queryRaw<FinancialOccurrence[]>`
      SELECT
        o.id,
        o.commitment_id AS "commitmentId",
        c.title AS "commitmentTitle",
        c.type AS "commitmentType",
        c.direction,
        c.category,
        c.supplier,
        c.cost_center AS "costCenter",
        o.competence_month AS "competenceMonth",
        o.due_date AS "dueDate",
        o.installment_number AS "installmentNumber",
        c.installment_count AS "installmentCount",
        o.expected_amount::float AS "expectedAmount",
        o.status,
        o.paid_amount::float AS "paidAmount",
        o.paid_at AS "paidAt",
        o.transaction_id AS "transactionId"
      FROM financial_occurrences o
      INNER JOIN financial_commitments c ON c.id = o.commitment_id
      WHERE o.id = ${id}::uuid
      LIMIT 1
    `;

    return updated[0] ?? null;
  });
}
