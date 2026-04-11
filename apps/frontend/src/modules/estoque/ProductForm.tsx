"use client";
// =============================================================================
// src/modules/estoque/ProductForm.tsx
// =============================================================================
// O QUE FAZ:
//   Formulário modal para criar ou editar um produto.
//   Funciona em dois modos:
//   - Criação: `product` é null → chama createProduct()
//   - Edição:  `product` é o objeto → chama updateProduct() com as alterações
// =============================================================================

import { useState, useEffect } from "react";
import { Package } from "lucide-react";
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
import { createProduct, updateProduct } from "@/services/estoque.service";
import type { Produto, ProdutoInput } from "@/types/api";

interface ProductFormProps {
  isOpen: boolean;
  product: Produto | null; // null = modo criação
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

const INITIAL_FORM: ProdutoInput = {
  name: "",
  description: "",
  price: 0,
  quantity: 0,
  sku: "",
};

export function ProductForm({
  isOpen,
  product,
  onClose,
  onSuccess,
}: ProductFormProps) {
  const [form, setForm] = useState<ProdutoInput>(INITIAL_FORM);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<
    Partial<Record<keyof ProdutoInput, string>>
  >({});

  // Preenche o formulário quando estiver em modo edição
  useEffect(() => {
    if (product) {
      setForm({
        name: product.name,
        description: product.description ?? "",
        price: product.price,
        quantity: product.quantity,
        sku: product.sku ?? "",
      });
    } else {
      setForm(INITIAL_FORM);
    }
    setErrors({});
  }, [product, isOpen]);

  function handleChange(field: keyof ProdutoInput, value: string | number) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function validate(): boolean {
    const newErrors: typeof errors = {};
    if (!form.name?.trim()) newErrors.name = "Nome é obrigatório";
    if (typeof form.price !== "number" || form.price < 0) {
      newErrors.price = "Preço deve ser um número positivo";
    }
    if (typeof form.quantity !== "number" || form.quantity < 0) {
      newErrors.quantity = "Quantidade não pode ser negativa";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setIsLoading(true);

    // Prepara payload: remove campos opcionais vazios
    const payload: ProdutoInput = {
      name: form.name.trim(),
      price: Number(form.price),
      quantity: Number(form.quantity),
      ...(form.description?.trim() && { description: form.description.trim() }),
      ...(form.sku?.trim() && { sku: form.sku.trim() }),
    };

    try {
      if (product) {
        // Modo edição: envia apenas o DIFF (campos que mudaram)
        const diff: Partial<ProdutoInput> = {};
        if (payload.name !== product.name) diff.name = payload.name;
        if (payload.price !== product.price) diff.price = payload.price;
        if (payload.quantity !== product.quantity)
          diff.quantity = payload.quantity;
        if (payload.description !== (product.description ?? ""))
          diff.description = payload.description;
        if (payload.sku !== (product.sku ?? "")) diff.sku = payload.sku;

        const result = await updateProduct(product.id, diff);
        onSuccess(result.mensagem ?? "Produto atualizado!");
      } else {
        // Modo criação
        const result = await createProduct(payload);
        onSuccess(result.mensagem ?? "Produto criado!");
      }
    } catch (err) {
      setErrors({
        name: err instanceof Error ? err.message : "Erro ao salvar produto.",
      });
    } finally {
      setIsLoading(false);
    }
  }

  const isEditing = !!product;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
            {isEditing ? "Editar Produto" : "Novo Produto"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? `Atualize os dados de "${product.name}".`
              : "Preencha os dados do novo produto."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nome */}
          <div className="space-y-1.5">
            <Label htmlFor="prod-name">Nome *</Label>
            <Input
              id="prod-name"
              placeholder="Ex: Camiseta Branca G"
              value={form.name}
              onChange={(e) => handleChange("name", e.target.value)}
              hasError={!!errors.name}
              autoFocus
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name}</p>
            )}
          </div>

          {/* Preço + Quantidade em grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="prod-price">Preço (R$) *</Label>
              <Input
                id="prod-price"
                type="number"
                min="0"
                step="0.01"
                placeholder="0,00"
                value={form.price}
                onChange={(e) =>
                  handleChange("price", parseFloat(e.target.value) || 0)
                }
                hasError={!!errors.price}
              />
              {errors.price && (
                <p className="text-xs text-destructive">{errors.price}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prod-qty">Quantidade</Label>
              <Input
                id="prod-qty"
                type="number"
                min="0"
                step="1"
                placeholder="0"
                value={form.quantity}
                onChange={(e) =>
                  handleChange("quantity", parseInt(e.target.value) || 0)
                }
                hasError={!!errors.quantity}
              />
              {errors.quantity && (
                <p className="text-xs text-destructive">{errors.quantity}</p>
              )}
            </div>
          </div>

          {/* SKU */}
          <div className="space-y-1.5">
            <Label htmlFor="prod-sku">
              SKU{" "}
              <span className="text-muted-foreground font-normal">
                (opcional)
              </span>
            </Label>
            <Input
              id="prod-sku"
              placeholder="Ex: CAM-BRA-G-001"
              value={form.sku ?? ""}
              onChange={(e) => handleChange("sku", e.target.value)}
            />
          </div>

          {/* Descrição */}
          <div className="space-y-1.5">
            <Label htmlFor="prod-desc">
              Descrição{" "}
              <span className="text-muted-foreground font-normal">
                (opcional)
              </span>
            </Label>
            <textarea
              id="prod-desc"
              rows={3}
              placeholder="Descrição detalhada do produto..."
              value={form.description ?? ""}
              onChange={(e) => handleChange("description", e.target.value)}
              className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 resize-none"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" isLoading={isLoading}>
              {isEditing ? "Salvar Alterações" : "Criar Produto"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
