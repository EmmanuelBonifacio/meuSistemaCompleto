"use client";
// =============================================================================
// src/modules/admin/TenantForm.tsx
// =============================================================================
// O QUE FAZ:
//   Modal para criar um novo tenant. Solicita: nome, slug (gerado auto) e
//   seleção dos módulos iniciais. Ao criar, valida unicidade do slug via API.
// =============================================================================

import { useState, useEffect } from "react";
import { Building2 } from "lucide-react";
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
import { createTenant } from "@/services/admin.service";
import type { CreateTenantInput } from "@/types/api";

interface TenantFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

// Módulos disponíveis para seleção ao criar o tenant
const AVAILABLE_MODULES = ["tv", "estoque", "financeiro", "vendas"];

export function TenantForm({ isOpen, onClose, onSuccess }: TenantFormProps) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{
    name?: string;
    slug?: string;
    form?: string;
  }>({});

  // Reseta ao abrir
  useEffect(() => {
    if (isOpen) {
      setName("");
      setSlug("");
      setSelectedModules([]);
      setErrors({});
    }
  }, [isOpen]);

  // Gera slug automaticamente a partir do nome: "Minha Empresa" → "minha-empresa"
  function handleNameChange(value: string) {
    setName(value);
    const autoSlug = value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    setSlug(autoSlug);
    if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
  }

  // Permite edição manual do slug
  function handleSlugChange(value: string) {
    const clean = value
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "")
      .replace(/--+/g, "-");
    setSlug(clean);
    if (errors.slug) setErrors((prev) => ({ ...prev, slug: undefined }));
  }

  function toggleModule(mod: string) {
    setSelectedModules((prev) =>
      prev.includes(mod) ? prev.filter((m) => m !== mod) : [...prev, mod],
    );
  }

  function validate(): boolean {
    const newErrors: typeof errors = {};
    if (!name.trim()) newErrors.name = "Nome é obrigatório";
    if (!slug.trim()) newErrors.slug = "Slug é obrigatório";
    else if (!/^[a-z0-9-]+$/.test(slug))
      newErrors.slug = "Use apenas letras minúsculas, números e hífens";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setIsLoading(true);
    try {
      const payload: CreateTenantInput = {
        name: name.trim(),
        slug: slug.trim(),
        moduleNames: selectedModules,
      };
      const result = await createTenant(payload);
      onSuccess(result.mensagem ?? `Tenant "${name}" criado com sucesso!`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao criar tenant.";
      // Verifica mensagem de slug duplicado
      if (msg.toLowerCase().includes("slug")) {
        setErrors({ slug: "Este slug já está em uso. Escolha outro." });
      } else {
        setErrors({ form: msg });
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            Novo Tenant
          </DialogTitle>
          <DialogDescription>
            Crie um novo tenant (empresa) no sistema. O slug será a URL de
            acesso.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nome da empresa */}
          <div className="space-y-1.5">
            <Label htmlFor="tenant-name">Nome da Empresa *</Label>
            <Input
              id="tenant-name"
              placeholder="Ex: Supermercado Silva"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              hasError={!!errors.name}
              autoFocus
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name}</p>
            )}
          </div>

          {/* Slug */}
          <div className="space-y-1.5">
            <Label htmlFor="tenant-slug">Slug (URL de acesso) *</Label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground shrink-0">
                localhost:3001/
              </span>
              <Input
                id="tenant-slug"
                placeholder="supermercado-silva"
                value={slug}
                onChange={(e) => handleSlugChange(e.target.value)}
                hasError={!!errors.slug}
                className="font-mono"
              />
            </div>
            {errors.slug && (
              <p className="text-xs text-destructive">{errors.slug}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Apenas letras minúsculas, números e hífens. Não pode ser alterado
              depois.
            </p>
          </div>

          {/* Módulos iniciais */}
          <div className="space-y-2">
            <Label>
              Módulos iniciais{" "}
              <span className="font-normal text-muted-foreground">
                (opcional)
              </span>
            </Label>
            <div className="grid grid-cols-3 gap-2">
              {AVAILABLE_MODULES.map((mod) => {
                const active = selectedModules.includes(mod);
                return (
                  <button
                    key={mod}
                    type="button"
                    onClick={() => toggleModule(mod)}
                    className={`rounded-lg border p-2.5 text-sm font-medium capitalize transition-all ${
                      active
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {mod}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Erro geral */}
          {errors.form && (
            <p className="text-sm text-destructive rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2">
              {errors.form}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" isLoading={isLoading}>
              Criar Tenant
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
