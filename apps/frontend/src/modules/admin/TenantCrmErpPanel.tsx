"use client";
// =============================================================================
// src/modules/admin/TenantCrmErpPanel.tsx
// =============================================================================
// Painel expandido inline de CRM e ERP para um tenant.
// Carrega dados lazy (só quando aberto pela primeira vez).
// Duas abas: CRM | ERP
// =============================================================================

import { useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { TenantCrmTab } from "./TenantCrmTab";
import { TenantErpTab } from "./TenantErpTab";
import {
  getCrm,
  getErp,
  listPagamentos,
  listArquivos,
  listParcelas,
} from "@/services/crm-erp.service";
import type {
  TenantCrm,
  TenantCrmPagamento,
  TenantCrmArquivo,
  TenantErpConfig,
  TenantErpParcela,
} from "@/types/crm-erp.types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TenantCrmErpPanelProps {
  tenantId: string;
  tenantSlug: string;
}

type Tab = "crm" | "erp";

// =============================================================================
// COMPONENTE
// =============================================================================

export function TenantCrmErpPanel({
  tenantId,
  tenantSlug,
}: TenantCrmErpPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>("crm");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dados CRM
  const [crm, setCrm] = useState<TenantCrm | null>(null);
  const [pagamentos, setPagamentos] = useState<TenantCrmPagamento[]>([]);
  const [arquivos, setArquivos] = useState<TenantCrmArquivo[]>([]);

  // Dados ERP
  const [erp, setErp] = useState<TenantErpConfig | null>(null);

  // Parcelas — estado compartilhado entre CRM e ERP
  const [parcelas, setParcelas] = useState<TenantErpParcela[]>([]);

  // ---------------------------------------------------------------------------
  // Carregamento lazy na montagem do componente
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [crmData, erpData, pagamentosData, arquivosData, parcelasData] =
          await Promise.all([
            getCrm(tenantId),
            getErp(tenantId),
            listPagamentos(tenantId),
            listArquivos(tenantId),
            listParcelas(tenantId),
          ]);
        if (cancelled) return;
        setCrm(crmData);
        setErp(erpData);
        setPagamentos(pagamentosData);
        setArquivos(arquivosData);
        setParcelas(parcelasData);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Erro ao carregar dados.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  // ---------------------------------------------------------------------------
  // Skeleton de carregamento
  // ---------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="px-4 py-5 space-y-4">
        <div className="flex gap-3">
          <Skeleton className="h-8 w-16 rounded-full" />
          <Skeleton className="h-8 w-16 rounded-full" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Erro de carregamento
  // ---------------------------------------------------------------------------
  if (error || !crm || !erp) {
    return (
      <div className="px-4 py-5 text-sm text-destructive">
        {error ?? "Erro inesperado ao carregar os dados."}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render com abas
  // ---------------------------------------------------------------------------
  return (
    <div className="border-t border-border bg-muted/5">
      {/* Tabs */}
      <div className="flex border-b border-border px-4 pt-3">
        {(["crm", "erp"] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors focus-visible:outline-none ${
              activeTab === tab
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Conteúdo das abas */}
      <div className="px-4">
        {activeTab === "crm" && (
          <TenantCrmTab
            tenantId={tenantId}
            tenantSlug={tenantSlug}
            crm={crm}
            pagamentos={pagamentos}
            arquivos={arquivos}
            parcelas={parcelas}
            onCrmChange={setCrm}
            onPagamentosChange={setPagamentos}
            onArquivosChange={setArquivos}
            onParcelasChange={setParcelas}
          />
        )}
        {activeTab === "erp" && (
          <TenantErpTab
            tenantId={tenantId}
            erp={erp}
            parcelas={parcelas}
            onErpChange={setErp}
            onParcelasChange={setParcelas}
          />
        )}
      </div>
    </div>
  );
}
