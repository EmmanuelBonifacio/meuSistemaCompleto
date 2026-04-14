// =============================================================================
// src/modules/vendas/admin/OrdersTable.tsx
// =============================================================================
// O QUE FAZ:
//   Tabela de pedidos recebidos via WhatsApp no painel admin.
//   Permite: visualizar detalhes do pedido, alterar status e adicionar notas.
//
// STATUS:
//   pendente → pago → enviado → finalizado (ou cancelado a qualquer momento)
// =============================================================================

"use client";

import { Fragment, useState } from "react";
import { ChevronDown, MessageSquare, Loader2 } from "lucide-react";
import type { PedidoVenda, StatusPedido } from "@/types/vendas.types";
import { STATUS_PEDIDO_LABEL, STATUS_PEDIDO_COR } from "@/types/vendas.types";
import { updatePedido } from "@/services/vendas.service";

// =============================================================================
// PROPS
// =============================================================================
interface OrdersTableProps {
  pedidos: PedidoVenda[];
  onPedidoAtualizado: (pedido: PedidoVenda) => void;
}

// =============================================================================
// COMPONENTE: OrdersTable
// =============================================================================
export function OrdersTable({ pedidos, onPedidoAtualizado }: OrdersTableProps) {
  // ID do pedido com linha expandida (detalhes + notas)
  const [expandidoId, setExpandidoId] = useState<string | null>(null);
  // ID do pedido sendo salvo (spinner)
  const [salvandoId, setSalvandoId] = useState<string | null>(null);
  // Notas editadas localmente antes de salvar
  const [notasEditadas, setNotasEditadas] = useState<Record<string, string>>(
    {},
  );

  const formatarMoeda = (valor: number) =>
    valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const formatarData = (iso: string) =>
    new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

  // -------------------------------------------------------------------------
  // Atualiza o status de um pedido
  // -------------------------------------------------------------------------
  const handleStatusChange = async (
    pedidoId: string,
    novoStatus: StatusPedido,
  ) => {
    setSalvandoId(pedidoId);
    try {
      const { pedido } = await updatePedido(pedidoId, { status: novoStatus });
      onPedidoAtualizado(pedido);
    } catch {
      // Erro silencioso — em produção usar toast
    } finally {
      setSalvandoId(null);
    }
  };

  // -------------------------------------------------------------------------
  // Salva as notas de um pedido
  // -------------------------------------------------------------------------
  const handleSalvarNotas = async (pedidoId: string) => {
    const notas = notasEditadas[pedidoId] ?? "";
    setSalvandoId(pedidoId);
    try {
      const { pedido } = await updatePedido(pedidoId, { notas });
      onPedidoAtualizado(pedido);
      // Remove do estado local após salvar
      setNotasEditadas((prev) => {
        const next = { ...prev };
        delete next[pedidoId];
        return next;
      });
    } catch {
      // Erro silencioso
    } finally {
      setSalvandoId(null);
    }
  };

  const STATUS_OPCOES: StatusPedido[] = [
    "pendente",
    "pago",
    "enviado",
    "finalizado",
    "cancelado",
  ];

  if (pedidos.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-200" />
        <p className="font-medium">Nenhum pedido recebido ainda</p>
        <p className="text-sm mt-1">
          Os pedidos aparecerão aqui quando visitantes finalizarem pelo WhatsApp
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-100">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-100">
            <th className="text-left px-4 py-3 font-medium text-gray-600">
              Data
            </th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">
              WhatsApp
            </th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">
              Itens
            </th>
            <th className="text-right px-4 py-3 font-medium text-gray-600">
              Total
            </th>
            <th className="text-center px-4 py-3 font-medium text-gray-600">
              Status
            </th>
            <th className="text-center px-4 py-3 font-medium text-gray-600">
              Detalhes
            </th>
          </tr>
        </thead>
        <tbody>
          {pedidos.map((pedido) => (
            <Fragment key={pedido.id}>
              {/* Linha principal do pedido */}
              <tr className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                  {formatarData(pedido.created_at)}
                </td>
                <td className="px-4 py-3 text-gray-800">
                  {pedido.numero_whatsapp ?? (
                    <span className="text-gray-400 italic">Não informado</span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {pedido.itens_json.length}{" "}
                  {pedido.itens_json.length === 1 ? "item" : "itens"}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-gray-900">
                  {formatarMoeda(pedido.total)}
                </td>
                <td className="px-4 py-3">
                  {/* Select de status com spinner */}
                  <div className="flex items-center justify-center gap-2">
                    {salvandoId === pedido.id ? (
                      <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                    ) : (
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_PEDIDO_COR[pedido.status]}`}
                      >
                        {STATUS_PEDIDO_LABEL[pedido.status]}
                      </span>
                    )}
                    <select
                      value={pedido.status}
                      onChange={(e) =>
                        handleStatusChange(
                          pedido.id,
                          e.target.value as StatusPedido,
                        )
                      }
                      className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 bg-white"
                      aria-label="Alterar status do pedido"
                    >
                      {STATUS_OPCOES.map((s) => (
                        <option key={s} value={s}>
                          {STATUS_PEDIDO_LABEL[s]}
                        </option>
                      ))}
                    </select>
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() =>
                      setExpandidoId(
                        expandidoId === pedido.id ? null : pedido.id,
                      )
                    }
                    className="text-indigo-600 hover:text-indigo-800 transition-colors"
                    aria-label="Ver detalhes do pedido"
                  >
                    <ChevronDown
                      className={`w-4 h-4 transition-transform ${expandidoId === pedido.id ? "rotate-180" : ""}`}
                    />
                  </button>
                </td>
              </tr>

              {/* Linha expandida com detalhes e notas */}
              {expandidoId === pedido.id && (
                <tr key={`${pedido.id}-detalhes`} className="bg-indigo-50/30">
                  <td colSpan={6} className="px-6 py-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Lista de itens do pedido */}
                      <div>
                        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                          Itens do Pedido
                        </h4>
                        <ul className="space-y-1">
                          {pedido.itens_json.map((item, i) => (
                            <li
                              key={i}
                              className="flex justify-between text-sm"
                            >
                              <span className="text-gray-700">
                                {item.quantidade}x {item.nome}
                              </span>
                              <span className="font-medium text-gray-900">
                                {formatarMoeda(item.preco * item.quantidade)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Notas do admin */}
                      <div>
                        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                          Notas de Entrega
                        </h4>
                        <textarea
                          value={notasEditadas[pedido.id] ?? pedido.notas ?? ""}
                          onChange={(e) =>
                            setNotasEditadas((prev) => ({
                              ...prev,
                              [pedido.id]: e.target.value,
                            }))
                          }
                          placeholder="Ex: Pix recebido às 14h. Enviar pelos Correios amanhã."
                          rows={3}
                          className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 resize-none bg-white"
                        />
                        {/* Salvar notas apenas se foram editadas */}
                        {notasEditadas[pedido.id] !== undefined && (
                          <button
                            onClick={() => handleSalvarNotas(pedido.id)}
                            disabled={salvandoId === pedido.id}
                            className="mt-2 text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1"
                          >
                            {salvandoId === pedido.id && (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            )}
                            Salvar notas
                          </button>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
