// =============================================================================
// src/components/ui/badge.tsx
// =============================================================================
// O QUE FAZ:
//   Componente Badge (etiqueta/tag) para exibir status, categorias e labels.
//   Ex: badge verde "Online", badge vermelho "Offline", badge azul "Receita"
//
// ONDE É USADO:
//   - Status de TVs (Online/Offline)
//   - Status de tenants (Ativo/Suspenso)
//   - Tipo de transação (Receita/Despesa)
//   - Módulos ativos/inativos
// =============================================================================

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  // Classes base: display inline, padding, texto pequeno, fontWeight semibold
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        // Padrão: azul (para informações gerais)
        default: "border-transparent bg-primary text-primary-foreground",
        // Secundário: cinza suave
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        // Sucesso: verde (online, ativo, receita)
        success:
          "border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400",
        // Destrutivo: vermelho (offline, erro, despesa)
        destructive:
          "border-transparent bg-destructive text-destructive-foreground",
        // Aviso: amarelo (atenção, pendente)
        warning:
          "border-transparent bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400",
        // Outline: apenas borda, sem preenchimento
        outline: "text-foreground",
        // Inativo: cinza opaco
        muted: "border-transparent bg-muted text-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
