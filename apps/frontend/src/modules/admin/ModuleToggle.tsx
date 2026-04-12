"use client";
// =============================================================================
// src/modules/admin/ModuleToggle.tsx
// =============================================================================
// O QUE FAZ:
//   Exibe os módulos disponíveis de um tenant com botões toggle para ativar
//   ou desativar cada um. Chamado dentro do TenantTable ao expandir um tenant.
// =============================================================================

import { useState } from "react";
import { LayoutGrid, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toggleTenantModule } from "@/services/admin.service";
import type { TenantModule } from "@/types/api";

// Mapa visual para cada módulo
const MODULE_LABELS: Record<string, { label: string; color: string }> = {
  tv: { label: "TV Digital", color: "text-blue-600" },
  estoque: { label: "Estoque", color: "text-amber-600" },
  financeiro: { label: "Financeiro", color: "text-emerald-600" },
};

interface ModuleToggleProps {
  tenantId: string;
  modules: TenantModule[];
  onToggled: () => void;
}

export function ModuleToggle({
  tenantId,
  modules,
  onToggled,
}: ModuleToggleProps) {
  // Rastreia qual módulo está sendo alterado (para desabilitar botões duplicados)
  const [loadingModuleId, setLoadingModuleId] = useState<string | null>(null);

  async function handleToggle(mod: TenantModule) {
    setLoadingModuleId(mod.moduleId);
    try {
      // Inverte o estado atual via API admin
      // Usa mod.module.name (ex: "estoque") pois o backend espera o nome do módulo, não o UUID
      await toggleTenantModule(tenantId, mod.module.name, !mod.isActive);
      onToggled(); // Sobe para o pai recarregar a lista
    } catch (err) {
      console.error("Erro ao alternar módulo:", err);
    } finally {
      setLoadingModuleId(null);
    }
  }

  if (!modules || modules.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic px-1">
        Nenhum módulo vinculado a este tenant.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {modules.map((mod) => {
        const meta = MODULE_LABELS[mod.module?.name ?? ""] ?? {
          label: mod.module?.name ?? mod.moduleId,
          color: "text-foreground",
        };
        const isLoading = loadingModuleId === mod.moduleId;

        return (
          <div
            key={mod.moduleId}
            className={`flex items-center gap-2 rounded-lg border p-2 text-sm transition-colors ${
              mod.isActive
                ? "border-primary/40 bg-primary/5"
                : "border-border bg-muted/30"
            }`}
          >
            <LayoutGrid className={`h-3.5 w-3.5 ${meta.color}`} />
            <span
              className={mod.isActive ? "font-medium" : "text-muted-foreground"}
            >
              {meta.label}
            </span>
            <Badge
              variant={mod.isActive ? "success" : "muted"}
              className="text-xs"
            >
              {mod.isActive ? "Ativo" : "Inativo"}
            </Badge>
            <Button
              size="icon-sm"
              variant={mod.isActive ? "destructive" : "outline"}
              onClick={() => handleToggle(mod)}
              disabled={isLoading}
              title={mod.isActive ? "Desativar módulo" : "Ativar módulo"}
            >
              {isLoading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : mod.isActive ? (
                "✕"
              ) : (
                "✓"
              )}
            </Button>
          </div>
        );
      })}
    </div>
  );
}
