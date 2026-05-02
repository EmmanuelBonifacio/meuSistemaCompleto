// =============================================================================
// src/modules/fleet/pages/DriversPage.tsx
// =============================================================================

"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Search,
  Users,
  RefreshCw,
  Edit2,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  CheckCircle,
  Phone,
  Mail,
  Car,
  ToggleLeft,
  ToggleRight,
  UserX,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  listDrivers,
  createDriver,
  updateDriver,
  listVehicles,
} from "../services/fleet.api";
import type { Driver, Vehicle } from "../types/fleet.types";

// =============================================================================
// HELPERS
// =============================================================================
type ToastType = "success" | "error";
interface UiToast {
  message: string;
  type: ToastType;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; bg: string; text: string }
> = {
  active: { label: "Disponível", bg: "bg-green-100", text: "text-green-800" },
  inactive: { label: "Inativo", bg: "bg-gray-100", text: "text-gray-600" },
  on_leave: { label: "De folga", bg: "bg-blue-100", text: "text-blue-700" },
};

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function cnhExpiryBadge(dateStr: string | null) {
  const days = daysUntil(dateStr);
  if (days === null) return null;
  if (days < 0) return { label: "CNH vencida", cls: "bg-red-100 text-red-700" };
  if (days <= 30)
    return { label: `CNH vence em ${days}d`, cls: "bg-red-100 text-red-700" };
  if (days <= 60)
    return {
      label: `CNH vence em ${days}d`,
      cls: "bg-amber-100 text-amber-700",
    };
  return null;
}

const EMPTY_FORM = {
  name: "",
  cpf: "",
  cnh: "",
  cnh_category: "",
  cnh_expiry: "",
  phone: "",
  email: "",
  status: "active" as Driver["status"],
  vehicle_id: "",
};

const CNH_CATEGORIES = ["A", "B", "C", "D", "E", "AB", "AC", "AD", "AE"];

// =============================================================================
// COMPONENTE: DriversPage
// =============================================================================
export function DriversPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [modalOpen, setModalOpen] = useState(false);
  const [editDriver, setEditDriver] = useState<Driver | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);

  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  const [toast, setToast] = useState<UiToast | null>(null);

  function showToast(message: string, type: ToastType) {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2800);
  }

  const fetchDrivers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await listDrivers({
        status: statusFilter || undefined,
        page,
        limit: 20,
      });
      const filtered = busca
        ? result.data.filter((d) =>
            d.name.toLowerCase().includes(busca.toLowerCase()),
          )
        : result.data;
      setDrivers(filtered);
      setTotalPages(result.totalPages);
      setTotal(result.total);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao carregar motoristas.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [busca, statusFilter, page]);

  useEffect(() => {
    fetchDrivers();
    listVehicles({ status: "active", limit: 100 })
      .then((r) => setVehicles(r.data))
      .catch(() => {});
  }, [fetchDrivers]);

  function openCreate() {
    setEditDriver(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(d: Driver) {
    setEditDriver(d);
    setForm({
      name: d.name,
      cpf: d.cpf ?? "",
      cnh: d.cnh ?? "",
      cnh_category: d.cnh_category ?? "",
      cnh_expiry: d.cnh_expiry ? d.cnh_expiry.slice(0, 10) : "",
      phone: d.phone ?? "",
      email: d.email ?? "",
      status: d.status,
      vehicle_id: d.vehicle_id ?? "",
    });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      showToast("Nome é obrigatório.", "error");
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        cpf: form.cpf || undefined,
        cnh: form.cnh || undefined,
        cnh_category: form.cnh_category || undefined,
        cnh_expiry: form.cnh_expiry
          ? new Date(form.cnh_expiry).toISOString()
          : undefined,
        phone: form.phone || undefined,
        email: form.email || undefined,
        status: form.status,
      };
      if (editDriver) {
        await updateDriver(editDriver.id, {
          ...payload,
          vehicle_id: form.vehicle_id || null,
        });
        showToast("Motorista atualizado com sucesso.", "success");
      } else {
        await createDriver(payload);
        if (form.vehicle_id) {
          const newDriver = await listDrivers({ limit: 1 });
          if (newDriver.data[0]) {
            await updateDriver(newDriver.data[0].id, {
              vehicle_id: form.vehicle_id,
            });
          }
        }
        showToast("Motorista criado com sucesso.", "success");
      }
      setModalOpen(false);
      fetchDrivers();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Erro ao salvar.",
        "error",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleToggle() {
    if (!confirmId) return;
    setIsConfirming(true);
    try {
      const d = drivers.find((x) => x.id === confirmId);
      const next = d?.status === "active" ? "inactive" : "active";
      await updateDriver(confirmId, { status: next });
      showToast(
        `Motorista ${next === "active" ? "ativado" : "desativado"}.`,
        "success",
      );
      setConfirmId(null);
      fetchDrivers();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Erro ao alterar status.",
        "error",
      );
    } finally {
      setIsConfirming(false);
    }
  }

  function getVehicle(vehicleId: string | null) {
    if (!vehicleId) return null;
    return vehicles.find((v) => v.id === vehicleId) ?? null;
  }

  const confirmDriver = drivers.find((d) => d.id === confirmId);

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Motoristas</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {total} motorista{total !== 1 ? "s" : ""} cadastrado
            {total !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Adicionar Motorista
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nome..."
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todos os status</option>
          <option value="active">Disponível</option>
          <option value="inactive">Inativo</option>
          <option value="on_leave">De folga</option>
        </select>
        <button
          onClick={fetchDrivers}
          title="Atualizar"
          className="p-2 border border-gray-200 rounded-lg text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Erro */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-2 text-sm text-red-700">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Lista */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-36 bg-gray-100 rounded-xl animate-pulse"
            />
          ))}
        </div>
      ) : drivers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-gray-200 text-center">
          <Users className="w-12 h-12 mb-3 text-gray-300" />
          <p className="font-medium text-gray-600">
            Nenhum motorista encontrado
          </p>
          <p className="text-sm text-gray-400 mt-1">
            {busca || statusFilter
              ? "Tente ajustar os filtros."
              : "Cadastre o primeiro motorista."}
          </p>
          {!busca && !statusFilter && (
            <button
              onClick={openCreate}
              className="mt-4 flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Adicionar primeiro motorista
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {drivers.map((d) => {
            const st = STATUS_CONFIG[d.status] ?? STATUS_CONFIG.inactive;
            const veh = getVehicle(d.vehicle_id);
            const cnhBdg = cnhExpiryBadge(d.cnh_expiry);
            return (
              <div
                key={d.id}
                className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md hover:border-blue-200 transition-all"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 font-bold text-sm flex items-center justify-center flex-shrink-0">
                      {d.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 leading-tight">
                        {d.name}
                      </p>
                      {d.current_job_id && (
                        <p className="text-xs text-blue-600 flex items-center gap-1 mt-0.5">
                          <Car className="w-3 h-3" />
                          Em rota
                        </p>
                      )}
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${st.bg} ${st.text}`}
                  >
                    {st.label}
                  </span>
                </div>

                {/* Info */}
                <div className="space-y-1.5 text-sm text-gray-600">
                  {d.phone && (
                    <p className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      {d.phone}
                    </p>
                  )}
                  {d.email && (
                    <p className="flex items-center gap-2 truncate">
                      <Mail className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <span className="truncate">{d.email}</span>
                    </p>
                  )}
                  {veh && (
                    <p className="flex items-center gap-2">
                      <Car className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      {veh.plate} {veh.model ? `— ${veh.model}` : ""}
                    </p>
                  )}
                  {d.cnh && (
                    <p className="text-xs text-gray-400">
                      CNH {d.cnh}
                      {d.cnh_category ? ` (Cat. ${d.cnh_category})` : ""}
                    </p>
                  )}
                </div>

                {/* CNH expiry alert */}
                {cnhBdg && (
                  <div
                    className={`mt-2 flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium ${cnhBdg.cls}`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {cnhBdg.label}
                  </div>
                )}

                {/* Ações */}
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                  <button
                    onClick={() => openEdit(d)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    Editar
                  </button>
                  <button
                    onClick={() => setConfirmId(d.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg hover:bg-amber-50 hover:text-amber-600 hover:border-amber-200 transition-colors"
                  >
                    {d.status === "active" ? (
                      <>
                        <ToggleRight className="w-3.5 h-3.5" /> Desativar
                      </>
                    ) : (
                      <>
                        <ToggleLeft className="w-3.5 h-3.5" /> Ativar
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
          >
            <ChevronLeft className="w-4 h-4" /> Anterior
          </button>
          <span className="text-sm text-gray-500">
            Página {page} de {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
          >
            Próxima <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Modal Criar / Editar */}
      <Dialog
        open={modalOpen}
        onOpenChange={(open) => {
          if (!isSaving) setModalOpen(open);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editDriver ? "Editar Motorista" : "Adicionar Motorista"}
            </DialogTitle>
            <DialogDescription>
              {editDriver
                ? `Editando ${editDriver.name}`
                : "Preencha os dados do novo motorista."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome completo *
                </label>
                <input
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  placeholder="João da Silva"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  CPF
                </label>
                <input
                  value={form.cpf}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      cpf: e.target.value.replace(/\D/g, ""),
                    }))
                  }
                  placeholder="12345678901"
                  maxLength={11}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Telefone
                </label>
                <input
                  value={form.phone}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, phone: e.target.value }))
                  }
                  placeholder="(11) 99999-9999"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  E-mail
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, email: e.target.value }))
                  }
                  placeholder="joao@email.com"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="border-t border-gray-100 pt-4">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">
                Habilitação (CNH)
              </p>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Número da CNH
                  </label>
                  <input
                    value={form.cnh}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, cnh: e.target.value }))
                    }
                    placeholder="00000000000"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Categoria
                  </label>
                  <select
                    value={form.cnh_category}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, cnh_category: e.target.value }))
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">—</option>
                    {CNH_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Validade da CNH
                  </label>
                  <input
                    type="date"
                    value={form.cnh_expiry}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, cnh_expiry: e.target.value }))
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {form.cnh_expiry &&
                    (() => {
                      const badge = cnhExpiryBadge(
                        new Date(form.cnh_expiry).toISOString(),
                      );
                      return badge ? (
                        <p
                          className={`mt-1 text-xs flex items-center gap-1 font-medium ${badge.cls.replace("bg-red-100", "").replace("bg-amber-100", "")}`}
                        >
                          <AlertTriangle className="w-3 h-3" />
                          {badge.label}
                        </p>
                      ) : null;
                    })()}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 border-t border-gray-100 pt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      status: e.target.value as Driver["status"],
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="active">Disponível</option>
                  <option value="inactive">Inativo</option>
                  <option value="on_leave">De folga</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Veículo padrão
                </label>
                <select
                  value={form.vehicle_id}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, vehicle_id: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Nenhum</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.plate}
                      {v.model ? ` — ${v.model}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <button
              onClick={() => setModalOpen(false)}
              disabled={isSaving}
              className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {isSaving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              {isSaving ? "Salvando..." : "Salvar"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm toggle */}
      <Dialog
        open={!!confirmId}
        onOpenChange={(open) => {
          if (!open && !isConfirming) setConfirmId(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {confirmDriver?.status === "active"
                ? "Desativar motorista?"
                : "Ativar motorista?"}
            </DialogTitle>
            <DialogDescription>
              {confirmDriver?.status === "active"
                ? `${confirmDriver?.name} será marcado como inativo.`
                : `${confirmDriver?.name} será reativado e disponibilizado.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              onClick={() => setConfirmId(null)}
              disabled={isConfirming}
              className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleToggle}
              disabled={isConfirming}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50"
            >
              {isConfirming && (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              )}
              {isConfirming ? "Processando..." : "Confirmar"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-white text-sm font-medium ${
            toast.type === "success" ? "bg-emerald-600" : "bg-red-600"
          }`}
        >
          {toast.type === "success" ? (
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          )}
          {toast.message}
        </div>
      )}
    </div>
  );
}
