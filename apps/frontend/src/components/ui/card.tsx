// =============================================================================
// src/components/ui/card.tsx
// =============================================================================
// O QUE FAZ:
//   Conjunto de componentes para criar cards/painéis com estilo consistente.
//   Um Card é a unidade visual básica de dashboards enterprise (como Stripe):
//   um retângulo com fundo branco, borda sutil e sombra leve.
//
// COMPOSIÇÃO (padrão Compound Component):
//   Ao invés de um único componente com dezenas de props, criamos componentes
//   menores que se encaixam: Card > CardHeader > CardTitle + CardDescription
//   Isso dá flexibilidade: use só o que precisar!
//
// COMO USAR:
//   <Card>
//     <CardHeader>
//       <CardTitle>Total de Produtos</CardTitle>
//       <CardDescription>Estoque ativo</CardDescription>
//     </CardHeader>
//     <CardContent>
//       <p className="text-3xl font-bold">142</p>
//     </CardContent>
//     <CardFooter>
//       <Button>Ver todos</Button>
//     </CardFooter>
//   </Card>
// =============================================================================

import * as React from "react";
import { cn } from "@/lib/utils";

// -----------------------------------------------------------------------------
// Card (container principal)
// -----------------------------------------------------------------------------
const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      // Fundo branco, borda sutil, cantos arredondados, sombra leve
      "rounded-xl border border-border bg-card text-card-foreground shadow-sm",
      className,
    )}
    {...props}
  />
));
Card.displayName = "Card";

// -----------------------------------------------------------------------------
// CardHeader (área do topo do card: título e descrição)
// -----------------------------------------------------------------------------
const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
));
CardHeader.displayName = "CardHeader";

// -----------------------------------------------------------------------------
// CardTitle (título do card)
// -----------------------------------------------------------------------------
const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "text-base font-semibold leading-none tracking-tight text-foreground",
      className,
    )}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

// -----------------------------------------------------------------------------
// CardDescription (subtítulo/descrição abaixo do título)
// -----------------------------------------------------------------------------
const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

// -----------------------------------------------------------------------------
// CardContent (área de conteúdo principal do card)
// -----------------------------------------------------------------------------
const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
));
CardContent.displayName = "CardContent";

// -----------------------------------------------------------------------------
// CardFooter (rodapé do card: ações, botões)
// -----------------------------------------------------------------------------
const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
));
CardFooter.displayName = "CardFooter";

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
};
