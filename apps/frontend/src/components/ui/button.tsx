// =============================================================================
// src/components/ui/button.tsx
// =============================================================================
// O QUE FAZ:
//   Componente Button reutilizável com múltiplas variantes visuais e tamanhos.
//   Segue o padrão de componentes do Shadcn/UI usando class-variance-authority (CVA).
//
// O QUE É CVA (class-variance-authority)?
//   É uma biblioteca que torna a criação de variações de componentes Tailwind
//   muito mais organizada. Em vez de dezenas de condicionais `clsx`, você
//   define um "mapa" de variantes e CVA monta as classes automaticamente.
//
// VARIANTES DISPONÍVEIS:
//   - default:     Azul primário (ação principal)
//   - secondary:   Cinza suave (ação secundária)
//   - outline:     Borda com fundo transparente (alternativa discreta)
//   - ghost:       Sem borda, apenas hover com fundo
//   - destructive: Vermelho para ações perigosas (excluir, etc.)
//   - link:        Parece um hyperlink
//
// COMO USAR:
//   <Button>Salvar</Button>
//   <Button variant="destructive">Excluir</Button>
//   <Button variant="outline" size="sm">Cancelar</Button>
//   <Button isLoading={true}>Salvando...</Button>
// =============================================================================

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// =============================================================================
// CONFIGURAÇÃO DE VARIANTES (CVA)
// =============================================================================
const buttonVariants = cva(
  // Classes BASE: aplicadas em TODAS as variantes
  // cursor-not-allowed: quando desabilitado, mostra cursor de proibido
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none",
  {
    variants: {
      // VARIANTE: estilo visual do botão
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 active:scale-[0.98]",
        secondary:
          "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80 active:scale-[0.98]",
        outline:
          "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground active:scale-[0.98]",
        ghost:
          "hover:bg-accent hover:text-accent-foreground active:scale-[0.98]",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90 active:scale-[0.98]",
        link: "text-primary underline-offset-4 hover:underline",
      },
      // VARIANTE: tamanho do botão
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-11 rounded-lg px-8 text-base",
        icon: "h-9 w-9", // Botão quadrado para ícones
        "icon-sm": "h-7 w-7", // Ícone pequeno
      },
    },
    // Variantes padrão quando não especificado explicitamente
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

// =============================================================================
// INTERFACE: Props do Button
// =============================================================================
// Extende os atributos nativos do <button> HTML, mais as variantes do CVA.
// asChild: padrão Radix UI — permite que o Button "vista" outro elemento.
//   Ex: <Button asChild><Link href="/dashboard">Ir</Link></Button>
//   O Link renderizará com o estilo do Button (sem duplo <a>/<button>).
export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  isLoading?: boolean; // Mostra spinner e desabilita o botão
}

// =============================================================================
// COMPONENTE: Button
// =============================================================================
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      isLoading = false,
      children,
      disabled,
      ...props
    },
    ref,
  ) => {
    // Quando asChild=true, usamos Slot do Radix que "passa" props para o filho.
    // Isso evita criar <button><a>, que é HTML inválido.
    const Comp = asChild ? Slot : "button";

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        // Desabilita o botão durante carregamento também
        disabled={disabled ?? isLoading}
        {...props}
      >
        {/*
         * Quando asChild=true, o Comp é o Slot do Radix UI, que usa
         * React.Children.only internamente — ou seja, exige exatamente 1 filho.
         * Se renderizarmos `{false}{children}`, ele recebe um array [false, element]
         * e lança "React.Children.only expected to receive a single React element child."
         *
         * Solução: quando asChild=true, passamos APENAS children.
         * Quando asChild=false (button normal), podemos ter spinner + children.
         */}
        {asChild ? (
          children
        ) : (
          <>
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            {children}
          </>
        )}
      </Comp>
    );
  },
);

// displayName facilita debugging no React DevTools
Button.displayName = "Button";

export { Button, buttonVariants };
