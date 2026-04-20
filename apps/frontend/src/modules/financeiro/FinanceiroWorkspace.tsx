"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { TransactionTable } from "./TransactionTable";
import { CommitmentsPanel } from "./CommitmentsPanel";
import { ProjectionPanel } from "./ProjectionPanel";
import { FinanceiroDashboardPanel } from "./FinanceiroDashboardPanel";
import { BankImportPanel } from "./BankImportPanel";
import { HistoryReportPanel } from "./HistoryReportPanel";

type FinanceTab =
  | "dashboard"
  | "lancamentos"
  | "compromissos"
  | "projecao"
  | "importacao"
  | "historico";

const TABS: { id: FinanceTab; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "lancamentos", label: "Lançamentos" },
  { id: "compromissos", label: "Compromissos" },
  { id: "projecao", label: "Projeção" },
  { id: "importacao", label: "Importar Extrato" },
  { id: "historico", label: "Histórico/Relatórios" },
];

export function FinanceiroWorkspace() {
  const [tab, setTab] = useState<FinanceTab>("dashboard");

  return (
    <div className="space-y-5">
      <div className="inline-flex rounded-lg border border-border p-1">
        {TABS.map((item) => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm transition-colors",
              tab === item.id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "dashboard" && <FinanceiroDashboardPanel />}
      {tab === "lancamentos" && <TransactionTable />}
      {tab === "compromissos" && <CommitmentsPanel />}
      {tab === "projecao" && <ProjectionPanel />}
      {tab === "importacao" && <BankImportPanel />}
      {tab === "historico" && <HistoryReportPanel />}
    </div>
  );
}
