// =============================================================================
// src/components/ui/skeleton.tsx
// =============================================================================
// O QUE FAZ:
//   Componente Skeleton (esqueleto) para estados de carregamento.
//   Ao invés de um spinner girando, o skeleton mostra "sombras" no formato
//   exato do conteúdo que está sendo carregado.
//
// POR QUE SKELETON É MELHOR QUE UM SPINNER?
//   O skeleton reduz a "ansiedade de espera" do usuário porque ele já
//   enxerga a forma do conteúdo antes de ele chegar.
//   É o que Stripe, Vercel, GitHub usam no seus dashboards.
//   Referência: https://uxdesign.cc/what-you-should-know-about-skeleton-screens-a820c45a571a
//
// COMO USAR:
//   // Skeleton de 1 linha de texto:
//   <Skeleton className="h-4 w-[200px]" />
//
//   // Skeleton de card completo:
//   <Card>
//     <CardHeader>
//       <Skeleton className="h-5 w-[150px]" />
//       <Skeleton className="h-4 w-[100px]" />
//     </CardHeader>
//     <CardContent>
//       <Skeleton className="h-32 w-full" />
//     </CardContent>
//   </Card>
// =============================================================================

import { cn } from "@/lib/utils";

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        // animate-pulse: oscila a opacidade (de 1 para 0.5 e volta)
        // Isso cria o efeito visual de "pulsação" que indica carregamento.
        "animate-pulse rounded-md bg-muted",
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
