"use client";
// =============================================================================
// src/modules/admin/TenantErpTab.tsx
// =============================================================================
// Aba ERP do painel expandido de tenant.
// Seções: Status | Plano | Limite de SKUs | Módulos | NF-e | Parcelas
// =============================================================================

import { useState } from "react";
import { CheckCircle, AlertCircle, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  updateErp,
  gerarParcelas,
  updateParcela,
} from "@/services/crm-erp.service";
import type {
  TenantErpConfig,
  TenantErpParcela,
  PlanoErp,
  AmbienteNfe,
  ModuloErp,
  StatusParcela,
  UpdateErpPayload,
  GerarParcelasPayload,
  UpdateParcelaPayload,
} from "@/types/crm-erp.types";
import { MODULOS_ERP_LIST } from "@/types/crm-erp.types";
import { cn } from "@/lib/utils";
import { formatBrl } from "@/lib/format-ptbr";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDateBR(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso + "T12:00:00");
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pt-BR");
}

function calcDataFim(dataInicio: string, plano: PlanoErp): string {
  if (!dataInicio) return "";
  const d = new Date(dataInicio + "T12:00:00");
  const meses = plano === "anual" ? 12 : plano === "semestral" ? 6 : 1;
  d.setMonth(d.getMonth() + meses);
  return d.toISOString().slice(0, 10);
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

function sumParcelas(
  parcelas: TenantErpParcela[],
  status: StatusParcela,
): number {
  return parcelas
    .filter((p) => p.status === status)
    .reduce((acc, p) => acc + parseFloat(p.valor), 0);
}

// ---------------------------------------------------------------------------
// Configurações dos planos
// ---------------------------------------------------------------------------

const PLANOS: Array<{
  value: PlanoErp;
  label: string;
  desc: string;
  badge?: string;
}> = [
  {
    value: "anual",
    label: "Plano Anual",
    desc: "12 meses — melhor custo-benefício",
    badge: "Mais econômico",
  },
  {
    value: "semestral",
    label: "Plano Semestral",
    desc: "6 meses com renovação flexível",
  },
  {
    value: "mensal",
    label: "Plano Mensal",
    desc: "Mês a mês, sem fidelidade",
  },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TenantErpTabProps {
  tenantId: string;
  erp: TenantErpConfig;
  parcelas: TenantErpParcela[];
  onErpChange: (erp: TenantErpConfig) => void;
  onParcelasChange: (parcelas: TenantErpParcela[]) => void;
}

// =============================================================================
// COMPONENTE PRINCIPAL
// =============================================================================

export function TenantErpTab({
  tenantId,
  erp,
  parcelas,
  onErpChange,
  onParcelasChange,
}: TenantErpTabProps) {
  // ---------------------------------------------------------------------------
  // Estados
  // ---------------------------------------------------------------------------
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    msg: string;
  } | null>(null);

  // Formulário de edição (espelha os dados do ERP)
  const [form, setForm] = useState<UpdateErpPayload>({
    ativo: erp.ativo,
    plano: erp.plano,
    limite_skus: erp.limiteSkus,
    modulos: erp.modulos,
    certificado_nfe: erp.certificadoNfe ?? "",
    ambiente_nfe: erp.ambienteNfe,
  });

  // Configurar contrato
  const [contratoDataInicio, setContratoDataInicio] = useState(
    erp.dataInicioContrato ? erp.dataInicioContrato.slice(0, 10) : "",
  );
  const [contratoValorParcela, setContratoValorParcela] = useState(
    erp.valorParcela ? parseFloat(erp.valorParcela) : 0,
  );
  const [gerandoParcelas, setGerandoParcelas] = useState(false);

  // Edição inline de parcela (na aba ERP)
  const [editingParcelaId, setEditingParcelaId] = useState<string | null>(null);
  const [editParcelaForm, setEditParcelaForm] = useState<UpdateParcelaPayload>(
    {},
  );
  const [savingEditParcela, setSavingEditParcela] = useState(false);

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function showFeedback(type: "success" | "error", msg: string) {
    setFeedback({ type, msg });
    setTimeout(() => setFeedback(null), 4000);
  }

  function toggleModulo(mod: ModuloErp) {
    if (!editMode) return;
    const current = form.modulos ?? [];
    const next = current.includes(mod)
      ? current.filter((m) => m !== mod)
      : [...current, mod];
    setForm((prev) => ({ ...prev, modulos: next }));
  }

  // ---------------------------------------------------------------------------
  // Gerar Parcelas
  // ---------------------------------------------------------------------------

  async function handleGerarParcelas() {
    if (!form.plano) {
      showFeedback("error", "Selecione um plano antes de gerar as parcelas.");
      return;
    }
    if (!contratoDataInicio) {
      showFeedback("error", "Informe a data de início do contrato.");
      return;
    }
    if (!contratoValorParcela || contratoValorParcela <= 0) {
      showFeedback("error", "Informe o valor de cada parcela.");
      return;
    }

    // Confirmar se já houver parcelas
    if (parcelas.length > 0) {
      const ok = window.confirm(
        `Isso irá substituir as ${parcelas.length} parcelas existentes. Deseja continuar?`,
      );
      if (!ok) return;
    }

    setGerandoParcelas(true);
    try {
      const payload: GerarParcelasPayload = {
        plano: form.plano as PlanoErp,
        data_inicio: contratoDataInicio,
        valor_parcela: contratoValorParcela,
      };
      const novasParcelas = await gerarParcelas(tenantId, payload);
      onParcelasChange(novasParcelas);
      showFeedback("success", "Parcelas geradas com sucesso.");
    } catch (err) {
      showFeedback(
        "error",
        err instanceof Error ? err.message : "Erro ao gerar parcelas.",
      );
    } finally {
      setGerandoParcelas(false);
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
  // Salvar
  // ---------------------------------------------------------------------------

  async function handleSave() {
    setSaving(true);
    try {
      const updated = await updateErp(tenantId, form);
      onErpChange(updated);
      setEditMode(false);
      showFeedback("success", "Configuração do ERP salva.");
    } catch (err) {
      showFeedback(
        "error",
        err instanceof Error ? err.message : "Erro ao salvar.",
      );
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setForm({
      ativo: erp.ativo,
      plano: erp.plano,
      limite_skus: erp.limiteSkus,
      modulos: erp.modulos,
      certificado_nfe: erp.certificadoNfe ?? "",
      ambiente_nfe: erp.ambienteNfe,
    });
    setEditMode(false);
  }

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

      {/* Barra de ações */}
      <div className="flex justify-end">
        {!editMode ? (
          <Button variant="outline" size="sm" onClick={() => setEditMode(true)}>
            Editar
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? "Salvando..." : "Salvar alterações"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancel}
              disabled={saving}
            >
              Cancelar
            </Button>
          </div>
        )}
      </div>

      {/* ====================================================================
          SEÇÃO: Status do ERP
      ==================================================================== */}
      <section>
        <h3 className="text-sm font-semibold text-foreground mb-3">
          Status do ERP
        </h3>
        <div className="flex items-center gap-3">
          <button
            role="switch"
            aria-checked={form.ativo}
            disabled={!editMode}
            onClick={() =>
              editMode && setForm((p) => ({ ...p, ativo: !p.ativo }))
            }
            className={cn(
              "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              form.ativo ? "bg-emerald-500" : "bg-muted-foreground/30",
              !editMode && "cursor-not-allowed opacity-60",
            )}
          >
            <span
              className={cn(
                "inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform",
                form.ativo ? "translate-x-6" : "translate-x-1",
              )}
            />
          </button>
          <span className="text-sm text-muted-foreground">
            ERP{" "}
            <span
              className={
                form.ativo
                  ? "text-emerald-600 font-medium"
                  : "text-muted-foreground"
              }
            >
              {form.ativo ? "ativado" : "desativado"}
            </span>
          </span>
        </div>
      </section>

      {/* ====================================================================
          SEÇÃO: Plano contratado
      ==================================================================== */}
      <section>
        <h3 className="text-sm font-semibold text-foreground mb-3">
          Plano contratado
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {PLANOS.map((plano) => {
            const isSelected = form.plano === plano.value;
            return (
              <button
                key={plano.value}
                type="button"
                disabled={!editMode}
                onClick={() =>
                  editMode &&
                  setForm((p) => ({
                    ...p,
                    plano: isSelected ? null : plano.value,
                  }))
                }
                className={cn(
                  "rounded-lg border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isSelected
                    ? "border-primary bg-primary/5"
                    : "border-border bg-background hover:bg-muted/30",
                  !editMode && "cursor-default",
                )}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className="text-sm font-semibold">{plano.label}</span>
                  {plano.badge && (
                    <Badge variant="default" className="text-xs shrink-0">
                      {plano.badge}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{plano.desc}</p>
              </button>
            );
          })}
        </div>
        {!form.plano && (
          <p className="text-xs text-muted-foreground mt-2">
            Nenhum plano selecionado.
          </p>
        )}
      </section>

      {/* ====================================================================
          SEÇÃO: Configurar contrato (aparece quando plano está selecionado)
      ==================================================================== */}
      {form.plano && (
        <section>
          <h3 className="text-sm font-semibold text-foreground mb-3">
            Configurar contrato
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Data de início
              </label>
              <input
                type="date"
                value={contratoDataInicio}
                onChange={(e) => setContratoDataInicio(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Data de fim (calculada)
              </label>
              <input
                type="text"
                readOnly
                value={
                  contratoDataInicio
                    ? formatDateBR(
                        calcDataFim(contratoDataInicio, form.plano as PlanoErp),
                      )
                    : "—"
                }
                className="w-full rounded-md border border-input bg-muted/30 px-3 py-2 text-sm cursor-not-allowed opacity-70"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Valor de cada parcela (R$)
              </label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0,00"
                value={contratoValorParcela || ""}
                onChange={(e) =>
                  setContratoValorParcela(parseFloat(e.target.value) || 0)
                }
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>

          {/* Pílula informativa */}
          {contratoDataInicio && contratoValorParcela > 0 && (
            <div className="inline-flex items-center rounded-full bg-blue-50 border border-blue-200 px-3 py-1.5 text-xs text-blue-700 mb-3">
              {form.plano === "anual" ? 12 : form.plano === "semestral" ? 6 : 1}{" "}
              parcelas
              {" · "}de {formatDateBR(contratoDataInicio)} até{" "}
              {formatDateBR(
                calcDataFim(contratoDataInicio, form.plano as PlanoErp),
              )}
              {" · "}
              {formatBrl(contratoValorParcela)}/parcela
            </div>
          )}

          <Button
            size="sm"
            onClick={handleGerarParcelas}
            disabled={gerandoParcelas}
          >
            {gerandoParcelas ? "Gerando..." : "Gerar parcelas"}
          </Button>
        </section>
      )}

      {/* ====================================================================
          SEÇÃO: Parcelas geradas
      ==================================================================== */}
      {parcelas.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-foreground mb-3">
            Parcelas geradas
          </h3>

          {/* Card de valor padrão */}
          {erp.valorParcela && (
            <div className="inline-flex items-center rounded-md border border-border bg-muted/20 px-3 py-1.5 text-xs text-muted-foreground mb-4">
              Valor padrão das parcelas:{" "}
              <span className="font-semibold ml-1">
                {formatBrl(parseFloat(erp.valorParcela))}
              </span>
            </div>
          )}

          {/* Cards de resumo */}
          <div className="grid grid-cols-3 gap-2 mb-4">
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
                className="rounded-lg border border-border bg-muted/20 px-2 py-2 sm:px-4 sm:py-3 text-center"
              >
                <p className="text-xs text-muted-foreground mb-1 leading-tight">{label}</p>
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
                                  valor: parseFloat(e.target.value) || 0,
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
                              value={editParcelaForm.status ?? "pendente"}
                              onChange={(e) =>
                                setEditParcelaForm((f) => ({
                                  ...f,
                                  status: e.target.value as StatusParcela,
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
                            onClick={() => handleSaveEditParcela(parc.id)}
                            disabled={savingEditParcela}
                          >
                            {savingEditParcela ? "Salvando..." : "Salvar"}
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
                        <Badge variant={parcelaStatusBadge(parc.status)}>
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
        </section>
      )}
      <section>
        <h3 className="text-sm font-semibold text-foreground mb-3">
          Limite de produtos / SKUs
        </h3>
        <div className="max-w-xs">
          <input
            type="number"
            min="1"
            disabled={!editMode}
            value={form.limite_skus ?? 1000}
            onChange={(e) =>
              setForm((p) => ({
                ...p,
                limite_skus: parseInt(e.target.value) || 1000,
              }))
            }
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Quantidade máxima de SKUs permitida.
          </p>
        </div>
      </section>

      {/* ====================================================================
          SEÇÃO: Módulos habilitados
      ==================================================================== */}
      <section>
        <h3 className="text-sm font-semibold text-foreground mb-3">
          Módulos habilitados
        </h3>
        <div className="flex flex-wrap gap-2">
          {MODULOS_ERP_LIST.map((mod) => {
            const isActive = (form.modulos ?? []).includes(mod);
            return (
              <button
                key={mod}
                type="button"
                disabled={!editMode}
                onClick={() => toggleModulo(mod)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isActive
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-muted text-muted-foreground",
                  editMode && "cursor-pointer hover:opacity-80",
                  !editMode && "cursor-default",
                )}
              >
                {mod}
              </button>
            );
          })}
        </div>
        {!editMode && (form.modulos ?? []).length === 0 && (
          <p className="text-xs text-muted-foreground mt-2">
            Nenhum módulo habilitado.
          </p>
        )}
      </section>

      {/* ====================================================================
          SEÇÃO: Emissão de NF-e
      ==================================================================== */}
      <section>
        <h3 className="text-sm font-semibold text-foreground mb-3">
          Emissão de NF-e
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Certificado digital
            </label>
            <input
              type="text"
              disabled={!editMode}
              value={form.certificado_nfe ?? ""}
              onChange={(e) =>
                setForm((p) => ({ ...p, certificado_nfe: e.target.value }))
              }
              placeholder="Ex: Cert. A1 — válido até 12/2026"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Ambiente
            </label>
            <select
              disabled={!editMode}
              value={form.ambiente_nfe ?? "homologacao"}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  ambiente_nfe: e.target.value as AmbienteNfe,
                }))
              }
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
            >
              <option value="homologacao">Homologação</option>
              <option value="producao">Produção</option>
            </select>
          </div>
        </div>
      </section>
    </div>
  );
}
