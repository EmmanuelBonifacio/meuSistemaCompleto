import type { ReactNode } from "react";

/**
 * Garante que rotas /frota herdem altura flexível corretamente até as páginas filhas.
 */
export default function FrotaLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      {children}
    </div>
  );
}
