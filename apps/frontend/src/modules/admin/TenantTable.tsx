"use client";
// =============================================================================
// src/modules/admin/TenantTable.tsx
// =============================================================================
// O QUE FAZ:
//   Tabela de gerenciamento de todos os tenants do sistema. Funcionalidades:
//   - Listar tenants com status, slug, data de criação e módulos ativos
//   - Expandir linha para ver/gerenciar módulos via ModuleToggle
//   - Suspender/reativar tenant
//   - Excluir tenant de forma permanente (com confirmação)
//   - Criar novo tenant via TenantForm modal
// =============================================================================

import { useState, useEffect, useCallback } from "react";
import {
  PlusCircle,
  Building2,
  AlertCircle,
  RefreshCw,
  ShieldOff,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TenantForm } from "./TenantForm";
import { TenantModal } from "./TenantModal";
import {
  listTenants,
  suspendTenant,
  reactivateTenant,
  deleteTenant,
} from "@/services/admin.service";
import { formatDate } from "@/lib/utils";
import type { Tenant } from "@/types/api";

export function TenantTable() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  // id do tenant aguardando confirmação de suspend/reactivate
  const [confirmStatusId, setConfirmStatusId] = useState<string | null>(null);
  // id do tenant aguardando confirmação de exclusão
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Modal de criação
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Modal de detalhes do tenant
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);

  const loadTenants = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await listTenants();
      setTenants(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao carregar tenants.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTenants();
  }, [loadTenants]);

  // Limpa mensagem de sucesso após 3 segundos
  useEffect(() => {
    if (!successMsg) return;
    const t = setTimeout(() => setSuccessMsg(null), 3000);
    return () => clearTimeout(t);
  }, [successMsg]);

  async function handleToggleStatus(tenant: Tenant) {
    // Primeiro clique: pede confirmação visual (sem window.confirm)
    if (confirmStatusId !== tenant.id) {
      setConfirmStatusId(tenant.id);
      setConfirmDeleteId(null);
      setTimeout(() => setConfirmStatusId(null), 4000);
      return;
    }
    // Segundo clique: executa
    setConfirmStatusId(null);
    try {
      if (tenant.isActive) {
        await suspendTenant(tenant.id);
        setSuccessMsg(`Tenant "${tenant.name}" suspenso.`);
      } else {
        await reactivateTenant(tenant.id);
        setSuccessMsg(`Tenant "${tenant.name}" reativado.`);
      }
      loadTenants();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao alterar status.");
    }
  }

  async function handleDeleteTenant(tenant: Tenant) {
    // Primeiro clique: pede confirmação visual (sem window.confirm)
    if (confirmDeleteId !== tenant.id) {
      setConfirmDeleteId(tenant.id);
      setConfirmStatusId(null);
      setTimeout(() => setConfirmDeleteId(null), 4000);
      return;
    }
    // Segundo clique: executa
    setConfirmDeleteId(null);
    try {
      await deleteTenant(tenant.id);
      setSuccessMsg(`Tenant "${tenant.name}" excluído.`);
      loadTenants();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao excluir tenant.");
    }
  }

  return (
    <div className="space-y-6">
      {/* Feedback */}
      {successMsg && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <Building2 className="h-4 w-4 shrink-0" />
          {successMsg}
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Tenants Cadastrados</CardTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={loadTenants}
                disabled={isLoading}
              >
                <RefreshCw
                  className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
                />
              </Button>
              <Button size="sm" onClick={() => setIsFormOpen(true)}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Novo Tenant
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Empresa
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden sm:table-cell">
                    Slug
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell">
                    Criado em
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody>
                {/* Skeleton de carregamento */}
                {isLoading &&
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-border">
                      <td className="px-4 py-3">
                        <Skeleton className="h-4 w-40" />
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <Skeleton className="h-4 w-24" />
                      </td>
                      <td className="px-4 py-3">
                        <Skeleton className="h-5 w-16 rounded-full" />
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <Skeleton className="h-4 w-20" />
                      </td>
                      <td className="px-4 py-3">
                        <Skeleton className="h-8 w-20 ml-auto" />
                      </td>
                    </tr>
                  ))}

                {/* Sem resultados */}
                {!isLoading && tenants.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-12 text-center text-muted-foreground"
                    >
                      <Building2 className="mx-auto mb-3 h-8 w-8 opacity-30" />
                      <p className="font-medium">Nenhum tenant cadastrado</p>
                      <p className="text-xs mt-1">
                        Clique em "Novo Tenant" para começar.
                      </p>
                    </td>
                  </tr>
                )}

                {/* Linhas de dados */}
                {!isLoading &&
                  tenants.map((tenant) => (
                    <tr
                      key={tenant.id}
                      className="border-b border-border hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => setSelectedTenant(tenant)}
                    >
                      {/* Nome */}
                      <td className="px-4 py-3 font-medium">{tenant.name}</td>

                      {/* Slug */}
                      <td className="px-4 py-3 text-muted-foreground font-mono text-xs hidden sm:table-cell">
                        {tenant.slug}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <Badge variant={tenant.isActive ? "success" : "muted"}>
                          {tenant.isActive ? "Ativo" : "Suspenso"}
                        </Badge>
                      </td>

                      {/* Data de criação */}
                      <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                        {formatDate(tenant.createdAt)}
                      </td>

                      {/* Ações */}
                      <td
                        className="px-4 py-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex justify-end">
                          {confirmStatusId === tenant.id ? (
                            <div className="flex items-center gap-1">
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleToggleStatus(tenant)}
                              >
                                {tenant.isActive ? (
                                  <>
                                    <ShieldOff className="mr-1 h-3 w-3" />{" "}
                                    Confirmar
                                  </>
                                ) : (
                                  <>
                                    <ShieldCheck className="mr-1 h-3 w-3" />{" "}
                                    Confirmar
                                  </>
                                )}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setConfirmStatusId(null)}
                              >
                                Cancelar
                              </Button>
                            </div>
                          ) : confirmDeleteId === tenant.id ? (
                            <div className="flex items-center gap-1">
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleDeleteTenant(tenant)}
                              >
                                <Trash2 className="mr-1 h-3 w-3" /> Confirmar
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setConfirmDeleteId(null)}
                              >
                                Cancelar
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <Button
                                variant={
                                  tenant.isActive ? "outline" : "secondary"
                                }
                                size="sm"
                                onClick={() => handleToggleStatus(tenant)}
                                className={
                                  tenant.isActive
                                    ? "text-destructive hover:text-destructive/80"
                                    : ""
                                }
                              >
                                {tenant.isActive ? (
                                  <>
                                    <ShieldOff className="mr-1 h-3 w-3" />{" "}
                                    Suspender
                                  </>
                                ) : (
                                  <>
                                    <ShieldCheck className="mr-1 h-3 w-3" />{" "}
                                    Reativar
                                  </>
                                )}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDeleteTenant(tenant)}
                                className="text-destructive hover:text-destructive/80"
                              >
                                <Trash2 className="mr-1 h-3 w-3" /> Excluir
                              </Button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Modal detalhes do tenant */}
      <TenantModal
        tenant={selectedTenant}
        onClose={() => setSelectedTenant(null)}
      />

      {/* Modal criar tenant */}
      <TenantForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSuccess={(msg) => {
          setIsFormOpen(false);
          setSuccessMsg(msg);
          loadTenants();
        }}
      />
    </div>
  );
}
