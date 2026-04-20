"use client";
// =============================================================================
// src/modules/financeiro/TransactionForm.tsx
// =============================================================================
// O QUE FAZ:
//   Modal para criar ou editar uma transação financeira.
//   Permite definir: tipo (receita/despesa), valor, descrição, categoria e data.
// =============================================================================

import { useState, useEffect } from "react";
import { DollarSign } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
  createTransaction,
  updateTransaction,
} from "@/services/financeiro.service";
import type { Transacao, TransacaoInput, TransactionType } from "@/types/api";

interface TransactionFormProps {
  isOpen: boolean;
  transaction: Transacao | null;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

const INITIAL_FORM: TransacaoInput = {
  type: "receita",
  amount: 0,
  description: "",
  category: "",
  transactionDate: new Date().toISOString().slice(0, 10), // YYYY-MM-DD
};

export function TransactionForm({
  isOpen,
  transaction,
  onClose,
  onSuccess,
}: TransactionFormProps) {
  const [form, setForm] = useState<TransacaoInput>(INITIAL_FORM);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<
    Partial<Record<keyof TransacaoInput, string>>
  >({});

  // Preenche o formulário ao editar uma transação existente
  useEffect(() => {
    if (transaction) {
      setForm({
        type: transaction.type,
        amount: transaction.amount,
        description: transaction.description,
        category: transaction.category ?? "",
        supplier: transaction.supplier ?? "",
        costCenter: transaction.costCenter ?? "",
        transactionDate: transaction.transactionDate.slice(0, 10),
      });
    } else {
      setForm(INITIAL_FORM);
    }
    setErrors({});
  }, [transaction, isOpen]);

  function handleChange(field: keyof TransacaoInput, value: string | number) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function validate(): boolean {
    const newErrors: typeof errors = {};
    if (!form.description?.trim())
      newErrors.description = "Descrição é obrigatória";
    if (!form.amount || form.amount <= 0)
      newErrors.amount = "Valor deve ser maior que zero";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setIsLoading(true);

    const payload: TransacaoInput = {
      type: form.type,
      amount: Number(form.amount),
      description: form.description.trim(),
      ...(form.category?.trim() && { category: form.category.trim() }),
      ...(form.supplier?.trim() && { supplier: form.supplier.trim() }),
      ...(form.costCenter?.trim() && { costCenter: form.costCenter.trim() }),
      transactionDate: form.transactionDate,
    };

    try {
      if (transaction) {
        const result = await updateTransaction(transaction.id, payload);
        onSuccess(result.mensagem ?? "Transação atualizada!");
      } else {
        const result = await createTransaction(payload);
        onSuccess(result.mensagem ?? "Transação criada!");
      }
    } catch (err) {
      setErrors({
        description:
          err instanceof Error ? err.message : "Erro ao salvar transação.",
      });
    } finally {
      setIsLoading(false);
    }
  }

  const isEditing = !!transaction;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-primary" />
            {isEditing ? "Editar Transação" : "Nova Transação"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Atualize os dados desta transação financeira."
              : "Registre uma nova movimentação financeira."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Tipo: receita ou despesa */}
          <div className="space-y-1.5">
            <Label>Tipo de Transação *</Label>
            <div className="grid grid-cols-2 gap-3">
              {(["receita", "despesa"] as TransactionType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => handleChange("type", type)}
                  className={`flex items-center justify-center gap-2 rounded-lg border p-3 text-sm font-medium transition-all capitalize ${
                    form.type === type
                      ? type === "receita"
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                        : "border-red-500 bg-red-50 text-red-700"
                      : "border-border bg-background text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {type === "receita" ? "↑ Receita" : "↓ Despesa"}
                </button>
              ))}
            </div>
          </div>

          {/* Valor + Data */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="tx-amount">Valor (R$) *</Label>
              <Input
                id="tx-amount"
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0,00"
                value={form.amount || ""}
                onChange={(e) =>
                  handleChange("amount", parseFloat(e.target.value) || 0)
                }
                hasError={!!errors.amount}
                autoFocus
              />
              {errors.amount && (
                <p className="text-xs text-destructive">{errors.amount}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tx-date">Data</Label>
              <Input
                id="tx-date"
                type="date"
                value={form.transactionDate ?? ""}
                onChange={(e) =>
                  handleChange("transactionDate", e.target.value)
                }
              />
            </div>
          </div>

          {/* Descrição */}
          <div className="space-y-1.5">
            <Label htmlFor="tx-desc">Descrição *</Label>
            <Input
              id="tx-desc"
              placeholder="Ex: Venda de produtos, Pagamento de fornecedor"
              value={form.description}
              onChange={(e) => handleChange("description", e.target.value)}
              hasError={!!errors.description}
            />
            {errors.description && (
              <p className="text-xs text-destructive">{errors.description}</p>
            )}
          </div>

          {/* Categoria */}
          <div className="space-y-1.5">
            <Label htmlFor="tx-cat">
              Categoria{" "}
              <span className="text-muted-foreground font-normal">
                (opcional)
              </span>
            </Label>
            <Input
              id="tx-cat"
              placeholder="Ex: Vendas, Aluguel, Salários"
              value={form.category ?? ""}
              onChange={(e) => handleChange("category", e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="tx-supplier">
                Fornecedor{" "}
                <span className="text-muted-foreground font-normal">(opcional)</span>
              </Label>
              <Input
                id="tx-supplier"
                placeholder="Ex: Banco X, Mercado Y"
                value={form.supplier ?? ""}
                onChange={(e) => handleChange("supplier", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tx-cost-center">
                Centro de custo{" "}
                <span className="text-muted-foreground font-normal">(opcional)</span>
              </Label>
              <Input
                id="tx-cost-center"
                placeholder="Ex: Administrativo"
                value={form.costCenter ?? ""}
                onChange={(e) => handleChange("costCenter", e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" isLoading={isLoading}>
              {isEditing ? "Salvar Alterações" : "Registrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
