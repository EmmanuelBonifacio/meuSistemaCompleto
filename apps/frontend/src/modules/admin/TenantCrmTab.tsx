"use client";
// =============================================================================
// src/modules/admin/TenantCrmTab.tsx
// =============================================================================
// Aba CRM do painel expandido de tenant.
// Seções: Dados do cliente | Pagamentos | Arquivos | Observações
// =============================================================================

import { useState, useRef, useCallback, useEffect } from "react";
import {
  FileText,
  ImageIcon,
  Video,
  Trash2,
  Download,
  Upload,
  Plus,
  X,
  CheckCircle,
  AlertCircle,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBrl } from "@/lib/format-ptbr";
import {
  updateCrm,
  listPagamentos,
  createPagamento,
  deletePagamento,
  updatePagamento,
  listArquivos,
  uploadArquivo,
  deleteArquivo,
  updateParcela,
} from "@/services/crm-erp.service";
import type {
  TenantCrm,
  TenantCrmPagamento,
  TenantCrmArquivo,
  TenantErpParcela,
  FormaPagamento,
  StatusPagamento,
  StatusParcela,
  CreatePagamentoPayload,
  UpdatePagamentoPayload,
  UpdateParcelaPayload,
} from "@/types/crm-erp.types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDateBR(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pt-BR");
}

function statusBadgeVariant(
  status: StatusPagamento,
): "success" | "warning" | "destructive" {
  if (status === "pago") return "success";
  if (status === "pendente") return "warning";
  return "destructive";
}

function statusLabel(status: StatusPagamento): string {
  const map: Record<StatusPagamento, string> = {
    pago: "Pago",
    pendente: "Pendente",
    atrasado: "Atrasado",
  };
  return map[status];
}

function fileIcon(mime: string | null) {
  if (!mime) return <FileText className="h-4 w-4 text-muted-foreground" />;
  if (mime.startsWith("image/"))
    return <ImageIcon className="h-4 w-4 text-blue-500" />;
  if (mime.startsWith("video/"))
    return <Video className="h-4 w-4 text-purple-500" />;
  return <FileText className="h-4 w-4 text-red-500" />;
}

function sumPagamentos(
  pagamentos: TenantCrmPagamento[],
  status: StatusPagamento,
): number {
  return pagamentos
    .filter((p) => p.status === status)
    .reduce((acc, p) => acc + parseFloat(p.valor), 0);
}

function sumParcelas(
  parcelas: TenantErpParcela[],
  status: StatusParcela,
): number {
  return parcelas
    .filter((p) => p.status === status)
    .reduce((acc, p) => acc + parseFloat(p.valor), 0);
}

function parcelaStatusBadge(
  status: StatusParcela,
): "success" | "warning" | "destructive" {
  if (status === "pago") return "success";
  if (status === "pendente") return "warning";
  return "destructive";
}

function parcelaStatusLabel(status: StatusParcela): string {
  const map: Record<StatusParcela, string> = {
    pago: "Pago",
    pendente: "Pendente",
    atrasado: "Atrasado",
  };
  return map[status];
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TenantCrmTabProps {
  tenantId: string;
  tenantSlug: string;
  crm: TenantCrm;
  pagamentos: TenantCrmPagamento[];
  arquivos: TenantCrmArquivo[];
  parcelas: TenantErpParcela[];
  onCrmChange: (crm: TenantCrm) => void;
  onPagamentosChange: (pagamentos: TenantCrmPagamento[]) => void;
  onArquivosChange: (arquivos: TenantCrmArquivo[]) => void;
  onParcelasChange: (parcelas: TenantErpParcela[]) => void;
}

// ---------------------------------------------------------------------------
// Formulário de lançamento de pagamento (estado local)
// ---------------------------------------------------------------------------

const EMPTY_PAGAMENTO: CreatePagamentoPayload = {
  data_pagamento: new Date().toISOString().slice(0, 10),
  valor: 0,
  forma: "PIX",
  referencia: "",
  status: "pendente",
};

// =============================================================================
// COMPONENTE PRINCIPAL
// =============================================================================

export function TenantCrmTab({
  tenantId,
  crm,
  pagamentos,
  arquivos,
  parcelas,
  onCrmChange,
  onPagamentosChange,
  onArquivosChange,
  onParcelasChange,
}: TenantCrmTabProps) {
  // ---------------------------------------------------------------------------
  // Estados da UI
  // ---------------------------------------------------------------------------
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    msg: string;
  } | null>(null);

  // Formulário de edição de dados CRM
  const [form, setForm] = useState({
    nome: crm.nome ?? "",
    telefone: crm.telefone ?? "",
    email: crm.email ?? "",
    cpf_cnpj: crm.cpfCnpj ?? "",
    observacoes: crm.observacoes ?? "",
  });

  // Formulário de lançamento de pagamento
  const [showPagamentoForm, setShowPagamentoForm] = useState(false);
  const [pagamentoForm, setPagamentoForm] =
    useState<CreatePagamentoPayload>(EMPTY_PAGAMENTO);
  const [savingPagamento, setSavingPagamento] = useState(false);

  // Edição inline de pagamento
  const [editingPagamentoId, setEditingPagamentoId] = useState<string | null>(
    null,
  );
  const [editPagamentoForm, setEditPagamentoForm] =
    useState<UpdatePagamentoPayload>({});
  const [savingEditPagamento, setSavingEditPagamento] = useState(false);

  // Modal de parcelas
  const [showParcelasModal, setShowParcelasModal] = useState(false);

  // Edição inline de parcela (no modal)
  const [editingParcelaId, setEditingParcelaId] = useState<string | null>(null);
  const [editParcelaForm, setEditParcelaForm] = useState<UpdateParcelaPayload>(
    {},
  );
  const [savingEditParcela, setSavingEditParcela] = useState(false);

  // Upload drag-and-drop
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ---------------------------------------------------------------------------
  // Helpers de feedback
  // ---------------------------------------------------------------------------

  function showFeedback(type: "success" | "error", msg: string) {
    setFeedback({ type, msg });
    setTimeout(() => setFeedback(null), 4000);
  }

  // ---------------------------------------------------------------------------
  // Salvar dados CRM
  // ---------------------------------------------------------------------------

  async function handleSaveCrm() {
    setSaving(true);
    try {
      const updated = await updateCrm(tenantId, form);
      onCrmChange(updated);
      setEditMode(false);
      showFeedback("success", "Dados do cliente salvos.");
    } catch (err) {
      showFeedback(
        "error",
        err instanceof Error ? err.message : "Erro ao salvar.",
      );
    } finally {
      setSaving(false);
    }
  }

  function handleCancelEdit() {
    setForm({
      nome: crm.nome ?? "",
      telefone: crm.telefone ?? "",
      email: crm.email ?? "",
      cpf_cnpj: crm.cpfCnpj ?? "",
      observacoes: crm.observacoes ?? "",
    });
    setEditMode(false);
  }

  // ---------------------------------------------------------------------------
  // Pagamentos
  // ---------------------------------------------------------------------------

  async function handleCreatePagamento() {
    if (!pagamentoForm.valor || pagamentoForm.valor <= 0) {
      showFeedback("error", "Valor deve ser positivo.");
      return;
    }
    setSavingPagamento(true);
    try {
      const novo = await createPagamento(tenantId, pagamentoForm);
      onPagamentosChange(
        [...pagamentos, novo].sort(
          (a, b) =>
            new Date(a.dataPagamento).getTime() -
            new Date(b.dataPagamento).getTime(),
        ),
      );
      setPagamentoForm(EMPTY_PAGAMENTO);
      setShowPagamentoForm(false);
      showFeedback("success", "Lançamento registrado.");
    } catch (err) {
      showFeedback(
        "error",
        err instanceof Error ? err.message : "Erro ao criar lançamento.",
      );
    } finally {
      setSavingPagamento(false);
    }
  }

  async function handleDeletePagamento(pagamento: TenantCrmPagamento) {
    // Remoção otimista
    const previous = pagamentos;
    onPagamentosChange(pagamentos.filter((p) => p.id !== pagamento.id));
    try {
      await deletePagamento(tenantId, pagamento.id);
    } catch (err) {
      onPagamentosChange(previous);
      showFeedback(
        "error",
        err instanceof Error ? err.message : "Erro ao excluir.",
      );
    }
  }

  function startEditPagamento(pagamento: TenantCrmPagamento) {
    setEditingPagamentoId(pagamento.id);
    setEditPagamentoForm({
      data_pagamento: pagamento.dataPagamento.slice(0, 10),
      valor: parseFloat(pagamento.valor),
      forma: pagamento.forma,
      referencia: pagamento.referencia ?? "",
      status: pagamento.status,
    });
  }

  async function handleSaveEditPagamento(pagamentoId: string) {
    setSavingEditPagamento(true);
    try {
      const updated = await updatePagamento(
        tenantId,
        pagamentoId,
        editPagamentoForm,
      );
      onPagamentosChange(
        pagamentos
          .map((p) => (p.id === pagamentoId ? updated : p))
          .sort(
            (a, b) =>
              new Date(a.dataPagamento).getTime() -
              new Date(b.dataPagamento).getTime(),
          ),
      );
      setEditingPagamentoId(null);
      showFeedback("success", "Lançamento atualizado.");
    } catch (err) {
      showFeedback(
        "error",
        err instanceof Error ? err.message : "Erro ao atualizar lançamento.",
      );
    } finally {
      setSavingEditPagamento(false);
    }
  }

  function startEditParcela(parcela: TenantErpParcela) {
    setEditingParcelaId(parcela.id);
    setEditParcelaForm({
      vencimento: parcela.vencimento.slice(0, 10),
      valor: parseFloat(parcela.valor),
      status: parcela.status,
    });
  }

  async function handleSaveEditParcela(parcelaId: string) {
    setSavingEditParcela(true);
    try {
      const updated = await updateParcela(tenantId, parcelaId, editParcelaForm);
      onParcelasChange(parcelas.map((p) => (p.id === parcelaId ? updated : p)));
      setEditingParcelaId(null);
    } catch (err) {
      showFeedback(
        "error",
        err instanceof Error ? err.message : "Erro ao atualizar parcela.",
      );
    } finally {
      setSavingEditParcela(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Upload de arquivos
  // ---------------------------------------------------------------------------

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      setUploading(true);
      try {
        for (const file of Array.from(files)) {
          const novo = await uploadArquivo(tenantId, file);
          onArquivosChange([...arquivos, novo]);
        }
        showFeedback("success", "Arquivo(s) enviado(s) com sucesso.");
      } catch (err) {
        showFeedback(
          "error",
          err instanceof Error ? err.message : "Erro ao enviar arquivo.",
        );
      } finally {
        setUploading(false);
      }
    },
    [tenantId, arquivos, onArquivosChange],
  );

  async function handleDeleteArquivo(arquivo: TenantCrmArquivo) {
    try {
      await deleteArquivo(tenantId, arquivo.id);
      onArquivosChange(arquivos.filter((a) => a.id !== arquivo.id));
      showFeedback("success", "Arquivo excluído.");
    } catch (err) {
      showFeedback(
        "error",
        err instanceof Error ? err.message : "Erro ao excluir arquivo.",
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Métricas de pagamentos
  // ---------------------------------------------------------------------------

  const totalPago = sumPagamentos(pagamentos, "pago");
  const totalPendente = sumPagamentos(pagamentos, "pendente");
  const totalAtrasado = sumPagamentos(pagamentos, "atrasado");

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <div className="space-y-6 py-4">
      {/* Feedback */}
      {feedback && (
        <div
          className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm ${
            feedback.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-destructive/30 bg-destructive/10 text-destructive"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          {feedback.msg}
        </div>
      )}

      {/* ====================================================================
          SEÇÃO: Dados do cliente
      ==================================================================== */}
      <section>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
          <h3 className="text-sm font-semibold text-foreground">
            Dados do cliente
          </h3>
          {!editMode ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditMode(true)}
            >
              Editar
            </Button>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={handleSaveCrm} disabled={saving}>
                {saving ? "Salvando..." : "Salvar alterações"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancelEdit}
                disabled={saving}
              >
                Cancelar
              </Button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {(
            [
              { key: "nome", label: "Nome" },
              { key: "telefone", label: "Telefone" },
              { key: "email", label: "E-mail" },
              { key: "cpf_cnpj", label: "CPF / CNPJ" },
            ] as const
          ).map(({ key, label }) => (
            <div key={key}>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                {label}
              </label>
              <input
                type="text"
                disabled={!editMode}
                value={form[key]}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, [key]: e.target.value }))
                }
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>
          ))}
        </div>

        {/* Observações */}
        <div className="mt-4">
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Observações internas
          </label>
          <textarea
            disabled={!editMode}
            value={form.observacoes}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, observacoes: e.target.value }))
            }
            rows={3}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 resize-none"
            placeholder="Anotações internas sobre este cliente..."
          />
        </div>
      </section>

      {/* ====================================================================
          SEÇÃO: Pagamentos
      ==================================================================== */}
      <section>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
          <h3 className="text-sm font-semibold text-foreground">Pagamentos</h3>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowParcelasModal(true)}
            >
              Parcelas do plano
            </Button>
            {!showPagamentoForm && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPagamentoForm(true)}
              >
                <Plus className="mr-1 h-3 w-3" />
                Lançar cobrança
              </Button>
            )}
          </div>
        </div>

        {/* Cards de métricas */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[
            {
              label: "Total recebido",
              value: totalPago,
              color: "text-emerald-600",
            },
            {
              label: "Total pendente",
              value: totalPendente,
              color: "text-amber-600",
            },
            {
              label: "Total em atraso",
              value: totalAtrasado,
              color: "text-red-600",
            },
          ].map(({ label, value, color }) => (
            <div
              key={label}
              className="rounded-lg border border-border bg-muted/20 px-2 py-2 sm:px-4 sm:py-3 text-center"
            >
              <p className="text-xs text-muted-foreground mb-1 leading-tight">{label}</p>
              <p className={`text-sm font-bold ${color}`}>{formatBrl(value)}</p>
            </div>
          ))}
        </div>

        {/* Formulário de lançamento */}
        {showPagamentoForm && (
          <div className="rounded-lg border border-border bg-muted/10 p-4 mb-4 space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Data
                </label>
                <input
                  type="date"
                  value={pagamentoForm.data_pagamento}
                  onChange={(e) =>
                    setPagamentoForm((p) => ({
                      ...p,
                      data_pagamento: e.target.value,
                    }))
                  }
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Valor (R$)
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="0,00"
                  value={pagamentoForm.valor || ""}
                  onChange={(e) =>
                    setPagamentoForm((p) => ({
                      ...p,
                      valor: parseFloat(e.target.value) || 0,
                    }))
                  }
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Forma de pagamento
                </label>
                <select
                  value={pagamentoForm.forma}
                  onChange={(e) =>
                    setPagamentoForm((p) => ({
                      ...p,
                      forma: e.target.value as FormaPagamento,
                    }))
                  }
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {(
                    [
                      "PIX",
                      "Boleto",
                      "Cartão",
                      "Transferência",
                      "Dinheiro",
                    ] as FormaPagamento[]
                  ).map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Referência
                </label>
                <input
                  type="text"
                  placeholder="Ex: Mensalidade Mai/26"
                  value={pagamentoForm.referencia ?? ""}
                  onChange={(e) =>
                    setPagamentoForm((p) => ({
                      ...p,
                      referencia: e.target.value,
                    }))
                  }
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Status
                </label>
                <select
                  value={pagamentoForm.status}
                  onChange={(e) =>
                    setPagamentoForm((p) => ({
                      ...p,
                      status: e.target.value as StatusPagamento,
                    }))
                  }
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="pago">Pago</option>
                  <option value="pendente">Pendente</option>
                  <option value="atrasado">Atrasado</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                onClick={handleCreatePagamento}
                disabled={savingPagamento}
              >
                {savingPagamento ? "Salvando..." : "Confirmar"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowPagamentoForm(false);
                  setPagamentoForm(EMPTY_PAGAMENTO);
                }}
              >
                <X className="mr-1 h-3 w-3" />
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {/* Tabela de lançamentos */}
        {pagamentos.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Nenhum lançamento registrado.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground text-xs">
                    Data
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground text-xs">
                    Valor
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground text-xs hidden sm:table-cell">
                    Forma
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground text-xs hidden md:table-cell">
                    Referência
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground text-xs">
                    Status
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground text-xs">
                    Ação
                  </th>
                </tr>
              </thead>
              <tbody>
                {pagamentos.map((p) =>
                  editingPagamentoId === p.id ? (
                    <tr
                      key={p.id}
                      className="border-b border-border last:border-0 bg-muted/10"
                    >
                      <td colSpan={6} className="px-3 py-3">
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-2">
                          <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-1">
                              Data
                            </label>
                            <input
                              type="date"
                              value={editPagamentoForm.data_pagamento ?? ""}
                              onChange={(e) =>
                                setEditPagamentoForm((f) => ({
                                  ...f,
                                  data_pagamento: e.target.value,
                                }))
                              }
                              className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-1">
                              Valor (R$)
                            </label>
                            <input
                              type="number"
                              min="0.01"
                              step="0.01"
                              value={editPagamentoForm.valor ?? ""}
                              onChange={(e) =>
                                setEditPagamentoForm((f) => ({
                                  ...f,
                                  valor: parseFloat(e.target.value) || 0,
                                }))
                              }
                              className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-1">
                              Forma
                            </label>
                            <select
                              value={editPagamentoForm.forma ?? "PIX"}
                              onChange={(e) =>
                                setEditPagamentoForm((f) => ({
                                  ...f,
                                  forma: e.target.value as FormaPagamento,
                                }))
                              }
                              className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              {(
                                [
                                  "PIX",
                                  "Boleto",
                                  "Cartão",
                                  "Transferência",
                                  "Dinheiro",
                                ] as FormaPagamento[]
                              ).map((fm) => (
                                <option key={fm} value={fm}>
                                  {fm}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-1">
                              Referência
                            </label>
                            <input
                              type="text"
                              value={editPagamentoForm.referencia ?? ""}
                              onChange={(e) =>
                                setEditPagamentoForm((f) => ({
                                  ...f,
                                  referencia: e.target.value,
                                }))
                              }
                              className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-1">
                              Status
                            </label>
                            <select
                              value={editPagamentoForm.status ?? "pendente"}
                              onChange={(e) =>
                                setEditPagamentoForm((f) => ({
                                  ...f,
                                  status: e.target.value as StatusPagamento,
                                }))
                              }
                              className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              <option value="pago">Pago</option>
                              <option value="pendente">Pendente</option>
                              <option value="atrasado">Atrasado</option>
                            </select>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleSaveEditPagamento(p.id)}
                            disabled={savingEditPagamento}
                          >
                            {savingEditPagamento ? "Salvando..." : "Salvar"}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingPagamentoId(null)}
                            disabled={savingEditPagamento}
                          >
                            Cancelar
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr
                      key={p.id}
                      className="border-b border-border last:border-0 hover:bg-muted/20"
                    >
                      <td className="px-3 py-2 text-xs">
                        {formatDateBR(p.dataPagamento)}
                      </td>
                      <td className="px-3 py-2 text-xs font-medium">
                        {formatBrl(parseFloat(p.valor))}
                      </td>
                      <td className="px-3 py-2 text-xs hidden sm:table-cell">
                        {p.forma}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground hidden md:table-cell">
                        {p.referencia ?? "—"}
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant={statusBadgeVariant(p.status)}>
                          {statusLabel(p.status)}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => startEditPagamento(p)}
                            className="text-muted-foreground hover:text-foreground transition-colors"
                            title="Editar lançamento"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeletePagamento(p)}
                            className="text-muted-foreground hover:text-destructive transition-colors"
                            title="Excluir lançamento"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ====================================================================
          SEÇÃO: Arquivos e contratos
      ==================================================================== */}
      <section>
        <h3 className="text-sm font-semibold text-foreground mb-3">
          Arquivos e contratos
        </h3>

        {/* Área drag-and-drop */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            handleFiles(e.dataTransfer.files);
          }}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg px-4 py-8 text-center cursor-pointer transition-colors ${
            isDragging
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50 hover:bg-muted/30"
          } ${uploading ? "pointer-events-none opacity-60" : ""}`}
        >
          <Upload className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {uploading
              ? "Enviando..."
              : "Arraste e solte ou clique para selecionar"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            PDF, imagens, vídeos — máx. 50MB
          </p>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            multiple
            accept="image/*,video/*,application/pdf"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>

        {/* Lista de arquivos */}
        {arquivos.length > 0 && (
          <ul className="mt-3 space-y-2">
            {arquivos.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between rounded-lg border border-border bg-muted/10 px-3 py-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {fileIcon(a.mimeType)}
                  <span className="text-xs truncate">{a.nomeOriginal}</span>
                  {a.tamanhoBytes && (
                    <span className="text-xs text-muted-foreground shrink-0">
                      {(Number(a.tamanhoBytes) / 1024).toFixed(0)} KB
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 ml-2 shrink-0">
                  <a
                    href={`${process.env.NEXT_PUBLIC_API_URL}/uploads/${a.caminho}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    title="Baixar arquivo"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Download className="h-3.5 w-3.5" />
                  </a>
                  <button
                    onClick={() => handleDeleteArquivo(a)}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                    title="Excluir arquivo"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ====================================================================
          MODAL: Parcelas do plano
      ==================================================================== */}
      {showParcelasModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setShowParcelasModal(false)}
        >
          <div
            className="bg-background rounded-xl border border-border shadow-xl w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabeçalho do modal */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
              <h2 className="text-sm font-semibold">Parcelas do plano</h2>
              <button
                onClick={() => setShowParcelasModal(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Corpo do modal */}
            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
              {parcelas.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Nenhuma parcela gerada. Acesse a aba ERP, configure o plano e
                  clique em &quot;Gerar parcelas&quot;.
                </p>
              ) : (
                <>
                  {/* Cards de resumo */}
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      {
                        label: "Total recebido",
                        status: "pago" as StatusParcela,
                        color: "text-emerald-600",
                      },
                      {
                        label: "Total pendente",
                        status: "pendente" as StatusParcela,
                        color: "text-amber-600",
                      },
                      {
                        label: "Total em atraso",
                        status: "atrasado" as StatusParcela,
                        color: "text-red-600",
                      },
                    ].map(({ label, status, color }) => (
                      <div
                        key={label}
                        className="rounded-lg border border-border bg-muted/20 px-2 py-2 sm:px-3 sm:py-2 text-center"
                      >
                        <p className="text-xs text-muted-foreground mb-1 leading-tight">
                          {label}
                        </p>
                        <p className={`text-sm font-bold ${color}`}>
                          {formatBrl(sumParcelas(parcelas, status))}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Tabela de parcelas */}
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/30">
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground text-xs">
                            #
                          </th>
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground text-xs">
                            Vencimento
                          </th>
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground text-xs">
                            Valor
                          </th>
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground text-xs">
                            Status
                          </th>
                          <th className="px-3 py-2 text-right font-medium text-muted-foreground text-xs">
                            Ação
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {parcelas.map((parc) =>
                          editingParcelaId === parc.id ? (
                            <tr
                              key={parc.id}
                              className="border-b border-border last:border-0 bg-muted/10"
                            >
                              <td colSpan={5} className="px-3 py-3">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2">
                                  <div>
                                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                                      Vencimento
                                    </label>
                                    <input
                                      type="date"
                                      value={editParcelaForm.vencimento ?? ""}
                                      onChange={(e) =>
                                        setEditParcelaForm((f) => ({
                                          ...f,
                                          vencimento: e.target.value,
                                        }))
                                      }
                                      className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                                      Valor (R$)
                                    </label>
                                    <input
                                      type="number"
                                      min="0.01"
                                      step="0.01"
                                      value={editParcelaForm.valor ?? ""}
                                      onChange={(e) =>
                                        setEditParcelaForm((f) => ({
                                          ...f,
                                          valor:
                                            parseFloat(e.target.value) || 0,
                                        }))
                                      }
                                      className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                                      Status
                                    </label>
                                    <select
                                      value={
                                        editParcelaForm.status ?? "pendente"
                                      }
                                      onChange={(e) =>
                                        setEditParcelaForm((f) => ({
                                          ...f,
                                          status: e.target
                                            .value as StatusParcela,
                                        }))
                                      }
                                      className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    >
                                      <option value="pago">Pago</option>
                                      <option value="pendente">Pendente</option>
                                      <option value="atrasado">Atrasado</option>
                                    </select>
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() =>
                                      handleSaveEditParcela(parc.id)
                                    }
                                    disabled={savingEditParcela}
                                  >
                                    {savingEditParcela
                                      ? "Salvando..."
                                      : "Salvar"}
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setEditingParcelaId(null)}
                                    disabled={savingEditParcela}
                                  >
                                    Cancelar
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ) : (
                            <tr
                              key={parc.id}
                              className="border-b border-border last:border-0 hover:bg-muted/20"
                            >
                              <td className="px-3 py-2 text-xs font-medium">
                                {parc.numero}/{parc.totalParcelas}
                              </td>
                              <td className="px-3 py-2 text-xs">
                                {formatDateBR(parc.vencimento)}
                              </td>
                              <td className="px-3 py-2 text-xs">
                                {formatBrl(parseFloat(parc.valor))}
                              </td>
                              <td className="px-3 py-2">
                                <Badge
                                  variant={parcelaStatusBadge(parc.status)}
                                >
                                  {parcelaStatusLabel(parc.status)}
                                </Badge>
                              </td>
                              <td className="px-3 py-2 text-right">
                                <button
                                  onClick={() => startEditParcela(parc)}
                                  className="text-muted-foreground hover:text-foreground transition-colors"
                                  title="Editar parcela"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                              </td>
                            </tr>
                          ),
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
