// =============================================================================
// src/modules/financeiro/financeiro.controller.ts
// =============================================================================
// O QUE FAZ:
//   Controller do módulo financeiro. Mesma estrutura do estoque.controller.ts,
//   demonstrando que o padrão é 100% reaproveitável entre módulos.
// =============================================================================

import { FastifyRequest, FastifyReply } from "fastify";
import { MultipartFile } from "@fastify/multipart";
import {
  CreateTransactionSchema,
  UpdateTransactionSchema,
  TransactionParamsSchema,
  ListTransactionsQuerySchema,
  CreateCommitmentSchema,
  UpdateCommitmentSchema,
  CommitmentParamsSchema,
  ListCommitmentsQuerySchema,
  ProjectionQuerySchema,
  OccurrenceParamsSchema,
  SettleOccurrenceSchema,
  DashboardQuerySchema,
  ImportBankCsvOptionsSchema,
  SnapshotMonthSchema,
  MonthlyHistoryQuerySchema,
  MonthlyReportQuerySchema,
} from "./financeiro.schema";
import * as financeiroRepository from "./financeiro.repository";

// =============================================================================
// HANDLER: Listar Transações
// GET /financeiro/transacoes
// =============================================================================
export async function listTransactions(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const schemaName = request.tenant!.schemaName;
  const query = ListTransactionsQuerySchema.parse(request.query);

  const result = await financeiroRepository.findAllTransactions(
    schemaName,
    query,
  );

  return reply.status(200).send(result);
}

// =============================================================================
// HANDLER: Buscar Transação por ID
// GET /financeiro/transacoes/:id
// =============================================================================
export async function getTransaction(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const schemaName = request.tenant!.schemaName;
  const { id } = TransactionParamsSchema.parse(request.params);

  const transaction = await financeiroRepository.findTransactionById(
    schemaName,
    id,
  );

  if (!transaction) {
    return reply.status(404).send({
      statusCode: 404,
      error: "Não Encontrado",
      message: "Transação não encontrada.",
    });
  }

  return reply.status(200).send(transaction);
}

// =============================================================================
// HANDLER: Criar Transação
// POST /financeiro/transacoes
// =============================================================================
export async function createTransaction(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const schemaName = request.tenant!.schemaName;
  const data = CreateTransactionSchema.parse(request.body);

  const transaction = await financeiroRepository.createTransaction(
    schemaName,
    data,
  );

  return reply.status(201).send(transaction);
}

// =============================================================================
// HANDLER: Atualizar Transação
// PATCH /financeiro/transacoes/:id
// =============================================================================
export async function updateTransaction(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const schemaName = request.tenant!.schemaName;
  const { id } = TransactionParamsSchema.parse(request.params);
  const data = UpdateTransactionSchema.parse(request.body);

  const transaction = await financeiroRepository.updateTransaction(
    schemaName,
    id,
    data,
  );

  if (!transaction) {
    return reply.status(404).send({
      statusCode: 404,
      error: "Não Encontrado",
      message: "Transação não encontrada.",
    });
  }

  return reply.status(200).send(transaction);
}

// =============================================================================
// HANDLER: Deletar Transação
// DELETE /financeiro/transacoes/:id
// =============================================================================
export async function deleteTransaction(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const schemaName = request.tenant!.schemaName;
  const { id } = TransactionParamsSchema.parse(request.params);

  const deleted = await financeiroRepository.deleteTransaction(schemaName, id);

  if (!deleted) {
    return reply.status(404).send({
      statusCode: 404,
      error: "Não Encontrado",
      message: "Transação não encontrada.",
    });
  }

  return reply.status(204).send();
}

// =============================================================================
// HANDLER: Listar Compromissos
// GET /financeiro/compromissos
// =============================================================================
export async function listCommitments(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const schemaName = request.tenant!.schemaName;
  const query = ListCommitmentsQuerySchema.parse(request.query);

  const result = await financeiroRepository.listCommitments(schemaName, query);
  return reply.status(200).send(result);
}

// =============================================================================
// HANDLER: Criar Compromisso
// POST /financeiro/compromissos
// =============================================================================
export async function createCommitment(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const schemaName = request.tenant!.schemaName;
  const data = CreateCommitmentSchema.parse(request.body);

  const commitment = await financeiroRepository.createCommitment(schemaName, data);
  return reply.status(201).send(commitment);
}

// =============================================================================
// HANDLER: Atualizar Compromisso
// PATCH /financeiro/compromissos/:id
// =============================================================================
export async function updateCommitment(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const schemaName = request.tenant!.schemaName;
  const { id } = CommitmentParamsSchema.parse(request.params);
  const data = UpdateCommitmentSchema.parse(request.body);

  const commitment = await financeiroRepository.updateCommitment(
    schemaName,
    id,
    data,
  );
  if (!commitment) {
    return reply.status(404).send({
      statusCode: 404,
      error: "Não Encontrado",
      message: "Compromisso não encontrado.",
    });
  }

  return reply.status(200).send(commitment);
}

// =============================================================================
// HANDLER: Desativar Compromisso
// DELETE /financeiro/compromissos/:id
// =============================================================================
export async function deleteCommitment(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const schemaName = request.tenant!.schemaName;
  const { id } = CommitmentParamsSchema.parse(request.params);

  const deleted = await financeiroRepository.deleteCommitment(schemaName, id);
  if (!deleted) {
    return reply.status(404).send({
      statusCode: 404,
      error: "Não Encontrado",
      message: "Compromisso não encontrado.",
    });
  }

  return reply.status(204).send();
}

// =============================================================================
// HANDLER: Projeção financeira
// GET /financeiro/projecao?fromMonth=YYYY-MM&toMonth=YYYY-MM
// =============================================================================
export async function getProjection(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const schemaName = request.tenant!.schemaName;
  const query = ProjectionQuerySchema.parse(request.query);

  const projection = await financeiroRepository.getProjection(schemaName, query);
  return reply.status(200).send(projection);
}

// =============================================================================
// HANDLER: Baixa de ocorrência
// POST /financeiro/ocorrencias/:id/baixar
// =============================================================================
export async function settleOccurrence(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const schemaName = request.tenant!.schemaName;
  const { id } = OccurrenceParamsSchema.parse(request.params);
  const body = SettleOccurrenceSchema.parse(request.body);

  const occurrence = await financeiroRepository.settleOccurrence(
    schemaName,
    id,
    body,
  );

  if (!occurrence) {
    return reply.status(404).send({
      statusCode: 404,
      error: "Não Encontrado",
      message: "Ocorrência não encontrada ou cancelada.",
    });
  }

  return reply.status(200).send(occurrence);
}

// =============================================================================
// HANDLER: Dashboard previsto x realizado
// GET /financeiro/dashboard
// =============================================================================
export async function getDashboard(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const schemaName = request.tenant!.schemaName;
  const query = DashboardQuerySchema.parse(request.query);
  const dashboard = await financeiroRepository.getFinancialDashboard(
    schemaName,
    query,
  );
  return reply.status(200).send(dashboard);
}

function parseDateValue(input: string): Date | null {
  const clean = input.trim();
  if (!clean) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    const d = new Date(`${clean}T00:00:00.000Z`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(clean)) {
    const [dd, mm, yyyy] = clean.split("/");
    const d = new Date(`${yyyy}-${mm}-${dd}T00:00:00.000Z`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(clean);
  return Number.isNaN(d.getTime()) ? null : d;
}

function normalizeAmount(raw: string): number | null {
  const clean = raw.trim();
  if (!clean) return null;
  const normalized = clean
    .replace(/[R$\s]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const value = Number(normalized);
  return Number.isFinite(value) ? Math.abs(value) : null;
}

function parseCsvRows(csv: string): Array<Record<string, string>> {
  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];

  const delimiter =
    (lines[0].match(/;/g)?.length ?? 0) >= (lines[0].match(/,/g)?.length ?? 0)
      ? ";"
      : ",";

  const headers = lines[0].split(delimiter).map((h) => h.trim().toLowerCase());
  const rows: Array<Record<string, string>> = [];

  for (let i = 1; i < lines.length; i += 1) {
    const cols = lines[i].split(delimiter).map((c) => c.trim());
    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      row[header] = cols[idx] ?? "";
    });
    rows.push(row);
  }
  return rows;
}

function getMultipartFieldValue(
  fields: MultipartFile["fields"] | undefined,
  name: string,
): string | undefined {
  const field = fields?.[name];
  if (!field) return undefined;
  if (typeof field === "object" && "value" in field) {
    const value = field.value;
    return typeof value === "string" ? value : undefined;
  }
  return undefined;
}

// =============================================================================
// HANDLER: Importar extrato CSV
// POST /financeiro/importacoes/extrato-csv
// multipart/form-data: file=<csv>, useAiCategorization?, defaultType?, skipDuplicates?
// =============================================================================
export async function importBankCsv(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const schemaName = request.tenant!.schemaName;

  let uploadedFile: MultipartFile | undefined;
  try {
    uploadedFile = await request.file({
      limits: { fileSize: 10 * 1024 * 1024 },
    });
  } catch {
    return reply.status(400).send({
      statusCode: 400,
      error: "Arquivo inválido",
      message: "Falha ao ler arquivo CSV (limite máximo 10MB).",
    });
  }

  if (!uploadedFile) {
    return reply.status(400).send({
      statusCode: 400,
      error: "Arquivo não enviado",
      message: "Envie um arquivo CSV no campo 'file'.",
    });
  }

  const rawBuffer = await uploadedFile.toBuffer();
  const csvText = rawBuffer.toString("utf-8");
  const parsedRows = parseCsvRows(csvText);
  if (parsedRows.length === 0) {
    return reply.status(400).send({
      statusCode: 400,
      error: "CSV vazio",
      message: "O arquivo não possui linhas de dados para importar.",
    });
  }

  const fields = uploadedFile.fields;
  const opts = ImportBankCsvOptionsSchema.parse({
    defaultType: getMultipartFieldValue(fields, "defaultType") ?? "despesa",
    useAiCategorization:
      getMultipartFieldValue(fields, "useAiCategorization") ?? false,
    skipDuplicates: getMultipartFieldValue(fields, "skipDuplicates") ?? true,
  });

  const mappedRows: financeiroRepository.BankCsvImportInputRow[] = [];
  const mapErrors: Array<{ row: number; reason: string }> = [];

  for (let i = 0; i < parsedRows.length; i += 1) {
    const row = parsedRows[i];
    const dateRaw = row.date ?? row.data ?? row.transaction_date ?? row["data lançamento"] ?? "";
    const description =
      row.description ?? row.descricao ?? row.historico ?? row["descrição"] ?? "";
    const amountRaw = row.amount ?? row.valor ?? row.value ?? "";
    const typeRaw = (row.type ?? row.tipo ?? "").toLowerCase();

    const transactionDate = parseDateValue(dateRaw);
    const amount = normalizeAmount(amountRaw);
    if (!transactionDate || !amount || !description.trim()) {
      mapErrors.push({ row: i + 1, reason: "Data/descrição/valor inválidos" });
      continue;
    }

    const inferredType =
      typeRaw === "receita" ||
      typeRaw === "entrada" ||
      typeRaw === "credito" ||
      typeRaw === "crédito"
        ? "receita"
        : typeRaw === "despesa" ||
            typeRaw === "saida" ||
            typeRaw === "saída" ||
            typeRaw === "debito" ||
            typeRaw === "débito"
          ? "despesa"
          : opts.defaultType;

    mappedRows.push({
      transactionDate,
      description: description.trim(),
      amount,
      type: inferredType,
      category: row.category ?? row.categoria ?? undefined,
      supplier: row.supplier ?? row.fornecedor ?? undefined,
      costCenter: row.cost_center ?? row.centro_custo ?? row["centro de custo"] ?? undefined,
    });
  }

  const importResult = await financeiroRepository.importBankCsvRows(
    schemaName,
    mappedRows,
    opts,
  );

  return reply.status(200).send({
    ...importResult,
    skipped: importResult.skipped + mapErrors.length,
    errors: [...mapErrors, ...importResult.errors],
  });
}

// =============================================================================
// HANDLER: Gerar snapshot mensal (histórico)
// POST /financeiro/historico/snapshot
// =============================================================================
export async function snapshotMonthlyHistory(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const schemaName = request.tenant!.schemaName;
  const input = SnapshotMonthSchema.parse(request.body ?? {});
  const row = await financeiroRepository.snapshotMonthlyHistory(schemaName, input);
  return reply.status(201).send(row);
}

// =============================================================================
// HANDLER: Listar histórico mensal
// GET /financeiro/historico
// =============================================================================
export async function listMonthlyHistory(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const schemaName = request.tenant!.schemaName;
  const query = MonthlyHistoryQuerySchema.parse(request.query);
  const rows = await financeiroRepository.listMonthlyHistory(schemaName, query);
  return reply.status(200).send(rows);
}

// =============================================================================
// HANDLER: Relatório mensal (JSON ou CSV)
// GET /financeiro/relatorios/mensal
// =============================================================================
export async function getMonthlyReport(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const schemaName = request.tenant!.schemaName;
  const query = MonthlyReportQuerySchema.parse(request.query);
  const rows = await financeiroRepository.generateMonthlyReport(schemaName, query);

  if (query.format === "csv") {
    const header = [
      "month",
      "previsto",
      "pago",
      "pendente",
      "atrasado",
      "realizadoReceitas",
      "realizadoDespesas",
      "saldoRealizado",
      "generatedAt",
    ].join(",");
    const body = rows
      .map((row) =>
        [
          row.month.toISOString().slice(0, 7),
          row.previsto.toFixed(2),
          row.pago.toFixed(2),
          row.pendente.toFixed(2),
          row.atrasado.toFixed(2),
          row.realizadoReceitas.toFixed(2),
          row.realizadoDespesas.toFixed(2),
          row.saldoRealizado.toFixed(2),
          row.generatedAt.toISOString(),
        ].join(","),
      )
      .join("\n");

    const csv = `${header}\n${body}`;
    reply.header("Content-Type", "text/csv; charset=utf-8");
    reply.header(
      "Content-Disposition",
      `attachment; filename="relatorio-financeiro-${new Date().toISOString().slice(0, 10)}.csv"`,
    );
    return reply.status(200).send(csv);
  }

  return reply.status(200).send({ data: rows, total: rows.length });
}
