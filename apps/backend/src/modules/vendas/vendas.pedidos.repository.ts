// =============================================================================
// src/modules/vendas/vendas.pedidos.repository.ts
// =============================================================================
// O QUE FAZ:
//   Camada de acesso a dados dos PEDIDOS recebidos via WhatsApp.
//   Persiste cada pedido iniciado pelo visitante para que o admin possa
//   acompanhar, marcar como pago, enviado ou finalizado.
//
// TABELA: venda_pedidos — criada pelo tenant.provisioner.ts no provisionamento
// =============================================================================

import { withTenantSchema } from "../../core/database/prisma";
import type { CriarPedidoInput, AtualizarPedidoInput } from "./vendas.schema";

// =============================================================================
// INTERFACE: PedidoVenda — espelha a tabela venda_pedidos do banco
// =============================================================================
export interface PedidoVenda {
  id: string;
  numero_whatsapp: string | null;
  // itens_json é serializado como JSONB no banco — deserializado automaticamente
  itens_json: Array<{
    produto_id: string;
    nome: string;
    preco: number;
    quantidade: number;
  }>;
  total: number;
  status: "pendente" | "pago" | "enviado" | "finalizado" | "cancelado";
  notas: string | null;
  created_at: Date;
  updated_at: Date;
}

// =============================================================================
// FUNÇÃO: createPedidoVenda
// =============================================================================
// Cria um novo pedido quando o visitante clica em "Finalizar no WhatsApp".
// O pedido entra com status "pendente" por padrão.
// =============================================================================
export async function createPedidoVenda(
  schemaName: string,
  data: CriarPedidoInput,
): Promise<PedidoVenda> {
  return withTenantSchema(schemaName, async (tx) => {
    const results = await tx.$queryRaw<PedidoVenda[]>`
      INSERT INTO venda_pedidos
        (numero_whatsapp, itens_json, total, status)
      VALUES (
        ${data.numero_whatsapp ?? null},
        ${JSON.stringify(data.itens)}::jsonb,
        ${data.total},
        'pendente'
      )
      RETURNING id, numero_whatsapp, itens_json, total::float,
                status, notas, created_at, updated_at
    `;
    return results[0];
  });
}

// =============================================================================
// FUNÇÃO: findAllPedidosVenda
// =============================================================================
// Lista todos os pedidos do tenant para exibição no painel admin.
// Ordenado por data decrescente (mais recentes primeiro).
// =============================================================================
export async function findAllPedidosVenda(
  schemaName: string,
  filtroStatus?: string,
): Promise<PedidoVenda[]> {
  return withTenantSchema(schemaName, async (tx) => {
    if (filtroStatus) {
      return tx.$queryRawUnsafe<PedidoVenda[]>(
        `SELECT id, numero_whatsapp, itens_json, total::float,
                status, notas, created_at, updated_at
         FROM venda_pedidos
         WHERE status = $1
         ORDER BY created_at DESC`,
        filtroStatus,
      );
    }

    return tx.$queryRaw<PedidoVenda[]>`
      SELECT id, numero_whatsapp, itens_json, total::float,
             status, notas, created_at, updated_at
      FROM venda_pedidos
      ORDER BY created_at DESC
    `;
  });
}

// =============================================================================
// FUNÇÃO: findPedidoVendaById
// =============================================================================
export async function findPedidoVendaById(
  schemaName: string,
  id: string,
): Promise<PedidoVenda | null> {
  return withTenantSchema(schemaName, async (tx) => {
    const results = await tx.$queryRaw<PedidoVenda[]>`
      SELECT id, numero_whatsapp, itens_json, total::float,
             status, notas, created_at, updated_at
      FROM venda_pedidos
      WHERE id = ${id}::uuid
      LIMIT 1
    `;
    return results[0] ?? null;
  });
}

// =============================================================================
// FUNÇÃO: updatePedidoVenda
// =============================================================================
// Atualiza status e/ou notas de um pedido. Ação exclusiva do admin.
// =============================================================================
export async function updatePedidoVenda(
  schemaName: string,
  id: string,
  data: Omit<AtualizarPedidoInput, "id">,
): Promise<PedidoVenda | null> {
  const setClauses: string[] = [];
  const values: unknown[] = [];

  if (data.status !== undefined) {
    values.push(data.status);
    setClauses.push(`status = $${values.length}`);
  }

  if (data.notas !== undefined) {
    values.push(data.notas);
    setClauses.push(`notas = $${values.length}`);
  }

  if (setClauses.length === 0) return null;

  setClauses.push("updated_at = NOW()");
  values.push(id);
  const idIndex = values.length;

  return withTenantSchema(schemaName, async (tx) => {
    const results = await tx.$queryRawUnsafe<PedidoVenda[]>(
      `UPDATE venda_pedidos
       SET ${setClauses.join(", ")}
       WHERE id = $${idIndex}::uuid
       RETURNING id, numero_whatsapp, itens_json, total::float,
                 status, notas, created_at, updated_at`,
      ...values,
    );
    return results[0] ?? null;
  });
}

// =============================================================================
// FUNÇÃO: getResumoVendas
// =============================================================================
// Retorna métricas para o dashboard do admin:
//   - Total de pedidos por status
//   - Valor total de pedidos pagos/finalizados
// =============================================================================
export async function getResumoVendas(schemaName: string): Promise<{
  totalPedidos: number;
  totalValor: number;
  porStatus: Record<string, number>;
}> {
  return withTenantSchema(schemaName, async (tx) => {
    const rows = await tx.$queryRaw<
      Array<{ status: string; count: bigint; soma: number }>
    >`
      SELECT
        status,
        COUNT(*) as count,
        COALESCE(SUM(total), 0)::float as soma
      FROM venda_pedidos
      GROUP BY status
    `;

    const porStatus: Record<string, number> = {};
    let totalPedidos = 0;
    let totalValor = 0;

    for (const row of rows) {
      porStatus[row.status] = Number(row.count);
      totalPedidos += Number(row.count);
      // Soma apenas pedidos concluídos financeiramente
      if (row.status === "pago" || row.status === "finalizado") {
        totalValor += Number(row.soma);
      }
    }

    return { totalPedidos, totalValor, porStatus };
  });
}
