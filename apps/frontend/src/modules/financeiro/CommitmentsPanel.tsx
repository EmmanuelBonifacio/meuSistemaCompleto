"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, PlusCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createCommitment,
  deleteCommitment,
  listCommitments,
} from "@/services/financeiro.service";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { CommitmentType, FinancialCommitmentInput } from "@/types/api";

const COMMITMENT_LABEL: Record<CommitmentType, string> = {
  conta_fixa_mensal: "Conta fixa mensal",
  assinatura_mensal: "Assinatura mensal",
  parcelamento: "Parcelamento",
};

const INITIAL_FORM: FinancialCommitmentInput = {
  title: "",
  type: "conta_fixa_mensal",
  direction: "despesa",
  amount: 0,
  startDate: new Date().toISOString().slice(0, 10),
  dueDay: new Date().getDate(),
};

export function CommitmentsPanel() {
  const [form, setForm] = useState<FinancialCommitmentInput>(INITIAL_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<Awaited<
    ReturnType<typeof listCommitments>
  >["data"]>([]);

  const isInstallment = form.type === "parcelamento";

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await listCommitments({ page: 1, limit: 50, isActive: true });
      setItems(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar compromissos.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const canSave = useMemo(() => {
    if (!form.title.trim()) return false;
    if (!form.amount || form.amount <= 0) return false;
    if (!form.startDate) return false;
    if (isInstallment && (!form.installmentCount || form.installmentCount < 2)) {
      return false;
    }
    return true;
  }, [form, isInstallment]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave) return;

    setIsSaving(true);
    setError(null);
    try {
      await createCommitment({
        ...form,
        title: form.title.trim(),
        amount: Number(form.amount),
      });
      setForm(INITIAL_FORM);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar compromisso.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteCommitment(id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao excluir compromisso.");
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Novo compromisso recorrente</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-6" onSubmit={handleSave}>
            <div className="md:col-span-2 space-y-1.5">
              <Label>Título</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Ex: Internet escritório"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select
                value={form.type}
                onValueChange={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    type: value as CommitmentType,
                    installmentCount: value === "parcelamento" ? 12 : undefined,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="conta_fixa_mensal">Conta fixa</SelectItem>
                  <SelectItem value="assinatura_mensal">Assinatura</SelectItem>
                  <SelectItem value="parcelamento">Parcelamento</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Valor (R$)</Label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                value={form.amount || ""}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    amount: parseFloat(e.target.value) || 0,
                  }))
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label>Dia de vencimento</Label>
              <Input
                type="number"
                min="1"
                max="31"
                value={form.dueDay ?? ""}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    dueDay: parseInt(e.target.value || "1", 10),
                  }))
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label>Início</Label>
              <Input
                type="date"
                value={form.startDate}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, startDate: e.target.value }))
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label>Fornecedor</Label>
              <Input
                value={form.supplier ?? ""}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, supplier: e.target.value }))
                }
                placeholder="Ex: Banco X"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Centro de custo</Label>
              <Input
                value={form.costCenter ?? ""}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, costCenter: e.target.value }))
                }
                placeholder="Ex: Operacional"
              />
            </div>

            {isInstallment && (
              <div className="space-y-1.5">
                <Label>Parcelas</Label>
                <Input
                  type="number"
                  min="2"
                  max="480"
                  value={form.installmentCount ?? 12}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      installmentCount: parseInt(e.target.value || "2", 10),
                    }))
                  }
                />
              </div>
            )}

            <div className="md:col-span-6 flex justify-end">
              <Button type="submit" disabled={!canSave} isLoading={isSaving}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Salvar compromisso
              </Button>
            </div>
          </form>
          {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Compromissos ativos</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum compromisso cadastrado.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="py-2 text-left">Título</th>
                    <th className="py-2 text-left">Tipo</th>
                    <th className="py-2 text-right">Valor</th>
                    <th className="py-2 text-left">Início</th>
                    <th className="py-2 text-left">Fornecedor</th>
                    <th className="py-2 text-left">Centro custo</th>
                    <th className="py-2 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-b">
                      <td className="py-3 font-medium">{item.title}</td>
                      <td className="py-3">{COMMITMENT_LABEL[item.type]}</td>
                      <td className="py-3 text-right">{formatCurrency(item.amount)}</td>
                      <td className="py-3">
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                          {formatDate(item.startDate)}
                        </span>
                      </td>
                      <td className="py-3">{item.supplier ?? "-"}</td>
                      <td className="py-3">{item.costCenter ?? "-"}</td>
                      <td className="py-3">
                        <div className="flex justify-end">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleDelete(item.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
