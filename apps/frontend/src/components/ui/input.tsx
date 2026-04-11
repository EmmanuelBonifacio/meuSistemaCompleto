// =============================================================================
// src/components/ui/input.tsx
// =============================================================================
// O QUE FAZ:
//   Componente Input estilizado que substitui o <input> nativo.
//   Padroniza o visual de todos os campos de formulário da aplicação.
//
// DIFERENÇA DE USAR COMPONENTE vs <input> DIRETO:
//   Usar este componente garante que todas as formas de input na aplicação
//   terão o mesmo visual, focus ring, comportamento de erro, etc.
//   Se precisar mudar o design dos inputs, muda aqui — reflete em toda app.
// =============================================================================

import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  // Prop opcional para mostrar estado de erro (borda vermelha)
  hasError?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, hasError, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          // Estilo base: tamanho, fundo, borda, transição
          "flex h-9 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm",
          // Placeholder mais suave
          "placeholder:text-muted-foreground",
          // Acessibilidade: anel de foco visível ao navegar por teclado
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          // Arquivo: estiliza o input type="file"
          "file:border-0 file:bg-transparent file:text-sm file:font-medium",
          // Desabilitado: cursor não permitido e reduz opacidade
          "disabled:cursor-not-allowed disabled:opacity-50",
          // Erro: borda vermelha
          hasError && "border-destructive focus-visible:ring-destructive",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
