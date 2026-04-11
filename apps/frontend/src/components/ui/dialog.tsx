// =============================================================================
// src/components/ui/dialog.tsx
// =============================================================================
// O QUE FAZ:
//   Componente Dialog (modal) acessível, construído sobre @radix-ui/react-dialog.
//   Usado para formulários de criação/edição, confirmações de ação, etc.
//
// POR QUE RADIX UI?
//   Modais acessíveis são surpreendentemente complexos:
//   - Foco deve ser preso dentro do modal enquanto aberto
//   - Tecla ESC deve fechar o modal
//   - Screen readers devem anunciar corretamente o conteúdo
//   - Background deve "escurecer" mas não ser clicável
//   O Radix UI resolve TUDO isso, sem estilo algum — o Tailwind cuida visual.
//
// PADRÃO COMPOUND COMPONENT (mesmo do Card):
//   Dialog > DialogTrigger > [componente que abre]
//   Dialog > DialogContent > DialogHeader > DialogTitle + DialogDescription
//             DialogContent > [conteúdo do modal]
//             DialogContent > DialogFooter > [botões de ação]
//
// COMO USAR:
//   <Dialog open={isOpen} onOpenChange={setIsOpen}>
//     <DialogTrigger asChild>
//       <Button>Adicionar TV</Button>
//     </DialogTrigger>
//     <DialogContent>
//       <DialogHeader>
//         <DialogTitle>Nova TV</DialogTitle>
//         <DialogDescription>Preencha os dados da nova TV.</DialogDescription>
//       </DialogHeader>
//       <TvForm onSubmit={handleSubmit} />
//       <DialogFooter>
//         <Button onClick={() => setIsOpen(false)}>Cancelar</Button>
//       </DialogFooter>
//     </DialogContent>
//   </Dialog>
// =============================================================================

"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

// Re-exporta o componente raiz do Radix sem modificação
const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

// Overlay (fundo escurecido) — cobre toda a tela mas não bloqueia scroll
const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      // Cobre toda a tela com fundo semitransparente
      "fixed inset-0 z-50 bg-black/50 backdrop-blur-sm",
      // Animação de entrada/saída sincronizada com o Radix
      "data-[state=open]:animate-in data-[state=closed]:animate-out",
      "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

// Conteúdo do modal (a "caixa" que aparece no centro)
const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        // Posicionamento: centralizado na tela
        "fixed left-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%]",
        // Dimensões: largura fixa, altura auto com máximo
        "w-full max-w-lg max-h-[90vh] overflow-y-auto",
        // Visual: fundo branco, borda, sombra, cantos arredondados
        "bg-background border border-border rounded-xl shadow-xl p-6",
        // Animação de entrada (slide from center)
        "duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
        "data-[state=closed]:slide-out-to-left-1/2 data-[state=open]:slide-in-from-left-1/2",
        "data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-top-[48%]",
        className,
      )}
      {...props}
    >
      {children}
      {/* Botão X para fechar no canto superior direito */}
      <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
        <X className="h-4 w-4" />
        <span className="sr-only">Fechar</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

// Área de cabeçalho (título + descrição)
const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex flex-col space-y-1.5 text-left mb-4", className)}
    {...props}
  />
);
DialogHeader.displayName = "DialogHeader";

// Rodapé com botões de ação
const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 mt-4 pt-4 border-t border-border gap-2",
      className,
    )}
    {...props}
  />
);
DialogFooter.displayName = "DialogFooter";

// Título do modal
const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight text-foreground",
      className,
    )}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

// Descrição/subtítulo do modal (texto auxiliar menor)
const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
