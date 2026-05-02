// =============================================================================
// src/modules/fleet/pages/VehiclesPage.tsx
// =============================================================================

"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Search,
  Truck,
  RefreshCw,
  Edit2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  CheckCircle,
  ToggleLeft,
  ToggleRight,
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
  listVehicles,
  createVehicle,
  updateVehicle,
  deleteVehicle,
  listDrivers,
} from "../services/fleet.api";
import type { Vehicle, Driver } from "../types/fleet.types";

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
  active: { label: "Ativo", bg: "bg-green-100", text: "text-green-800" },
  inactive: { label: "Inativo", bg: "bg-gray-100", text: "text-gray-600" },
  maintenance: {
    label: "Manutenção",
    bg: "bg-amber-100",
    text: "text-amber-800",
  },
  decommissioned: {
    label: "Desativado",
    bg: "bg-red-100",
    text: "text-red-700",
  },
};

const EMPTY_FORM = {
  plate: "",
  brand: "",
  model: "",
  year: new Date().getFullYear(),
  color: "",
  status: "active" as Vehicle["status"],
  traccar_device_id: "",
  fleetbase_asset_id: "",
  fleetms_vehicle_id: "",
};

// =============================================================================
// COMPONENTE: VehiclesPage
// =============================================================================
export function VehiclesPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [modalOpen, setModalOpen] = useState(false);
  const [editVehicle, setEditVehicle] = useState<Vehicle | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);

  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<
    "delete" | "toggle" | null
  >(null);
  const [isConfirming, setIsConfirming] = useState(false);

  const [toast, setToast] = useState<UiToast | null>(null);

  function showToast(message: string, type: ToastType) {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2800);
  }

  const fetchVehicles = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await listVehicles({
        busca: busca || undefined,
        status: statusFilter || undefined,
        page,
        limit: 20,
      });
      setVehicles(result.data);
      setTotalPages(result.totalPages);
      setTotal(result.total);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao carregar veículos.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [busca, statusFilter, page]);

  useEffect(() => {
    fetchVehicles();
    listDrivers({ limit: 100 })
      .then((r) => setDrivers(r.data))
      .catch(() => {});
  }, [fetchVehicles]);

  function openCreate() {
    setEditVehicle(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(v: Vehicle) {
    setEditVehicle(v);
    setForm({
      plate: v.plate,
      brand: v.brand ?? "",
      model: v.model ?? "",
      year: v.year ?? new Date().getFullYear(),
      color: v.color ?? "",
      status: v.status,
      traccar_device_id: v.traccar_device_id?.toString() ?? "",
      fleetbase_asset_id: v.fleetbase_asset_id ?? "",
      fleetms_vehicle_id: v.fleetms_vehicle_id ?? "",
    });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.plate.trim()) {
      showToast("Placa é obrigatória.", "error");
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        plate: form.plate.trim().toUpperCase(),
        brand: form.brand || undefined,
        model: form.model || undefined,
        year: form.year || undefined,
        color: form.color || undefined,
        status: form.status,
        traccar_device_id: form.traccar_device_id
          ? parseInt(form.traccar_device_id)
          : undefined,
        fleetbase_asset_id: form.fleetbase_asset_id || undefined,
        fleetms_vehicle_id: form.fleetms_vehicle_id || undefined,
      };
      if (editVehicle) {
        await updateVehicle(editVehicle.id, payload);
        showToast("Veículo atualizado com sucesso.", "success");
      } else {
        await createVehicle(payload as Parameters<typeof createVehicle>[0]);
        showToast("Veículo criado com sucesso.", "success");
      }
      setModalOpen(false);
      fetchVehicles();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Erro ao salvar.",
        "error",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleConfirm() {
    if (!confirmId) return;
    setIsConfirming(true);
    try {
      if (confirmAction === "delete") {
        await deleteVehicle(confirmId);
        showToast("Veículo removido.", "success");
      } else {
        const v = vehicles.find((x) => x.id === confirmId);
        const next = v?.status === "active" ? "inactive" : "active";
        await updateVehicle(confirmId, { status: next });
        showToast(
          `Veículo ${next === "active" ? "ativado" : "desativado"}.`,
          "success",
        );
      }
      setConfirmId(null);
      setConfirmAction(null);
      fetchVehicles();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Erro ao executar ação.",
        "error",
      );
    } finally {
      setIsConfirming(false);
    }
  }

  function getDriver(vehicleId: string) {
    return drivers.find((d) => d.vehicle_id === vehicleId);
  }

  const confirmVehicle = vehicles.find((v) => v.id === confirmId);

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Veículos</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {total} veículo{total !== 1 ? "s" : ""} cadastrado
            {total !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Adicionar Veículo
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por placa ou modelo..."
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
          <option value="active">Ativo</option>
          <option value="inactive">Inativo</option>
          <option value="maintenance">Manutenção</option>
          <option value="decommissioned">Desativado</option>
        </select>
        <button
          onClick={fetchVehicles}
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

      {/* Tabela / Skeleton / Empty */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-16 bg-gray-100 rounded-xl animate-pulse"
            />
          ))}
        </div>
      ) : vehicles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-gray-200 text-center">
          <Truck className="w-12 h-12 mb-3 text-gray-300" />
          <p className="font-medium text-gray-600">Nenhum veículo encontrado</p>
          <p className="text-sm text-gray-400 mt-1">
            {busca || statusFilter
              ? "Tente ajustar os filtros."
              : "Adicione o primeiro veículo da frota."}
          </p>
          {!busca && !statusFilter && (
            <button
              onClick={openCreate}
              className="mt-4 flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Adicionar primeiro veículo
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-500">
                    Veículo
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">
                    Ano
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">
                    Status
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">
                    Motorista
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {vehicles.map((v) => {
                  const driver = getDriver(v.id);
                  const st = STATUS_CONFIG[v.status] ?? STATUS_CONFIG.inactive;
                  return (
                    <tr
                      key={v.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${st.bg} ${st.text}`}
                          >
                            <Truck className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900 tracking-wider">
                              {v.plate}
                            </p>
                            {(v.brand || v.model) && (
                              <p className="text-xs text-gray-500">
                                {[v.brand, v.model].filter(Boolean).join(" ")}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {v.year ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${st.bg} ${st.text}`}
                        >
                          {st.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {driver ? (
                          <span className="flex items-center gap-1.5 text-gray-700">
                            <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold flex items-center justify-center">
                              {driver.name.charAt(0).toUpperCase()}
                            </span>
                            {driver.name}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">
                            Não atribuído
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEdit(v)}
                            title="Editar"
                            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setConfirmId(v.id);
                              setConfirmAction("toggle");
                            }}
                            title={
                              v.status === "active" ? "Desativar" : "Ativar"
                            }
                            className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                          >
                            {v.status === "active" ? (
                              <ToggleRight className="w-4 h-4" />
                            ) : (
                              <ToggleLeft className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={() => {
                              setConfirmId(v.id);
                              setConfirmAction("delete");
                            }}
                            title="Excluir"
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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
              {editVehicle ? "Editar Veículo" : "Adicionar Veículo"}
            </DialogTitle>
            <DialogDescription>
              {editVehicle
                ? `Editando ${editVehicle.plate}`
                : "Preencha os dados do novo veículo."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Placa *
                </label>
                <input
                  value={form.plate}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      plate: e.target.value.toUpperCase(),
                    }))
                  }
                  placeholder="ABC-1234"
                  disabled={!!editVehicle}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Marca
                </label>
                <input
                  value={form.brand}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, brand: e.target.value }))
                  }
                  placeholder="Toyota"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Modelo
                </label>
                <input
                  value={form.model}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, model: e.target.value }))
                  }
                  placeholder="Corolla"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ano
                </label>
                <input
                  type="number"
                  value={form.year}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      year:
                        parseInt(e.target.value) || new Date().getFullYear(),
                    }))
                  }
                  min={1990}
                  max={new Date().getFullYear() + 1}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cor
                </label>
                <input
                  value={form.color}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, color: e.target.value }))
                  }
                  placeholder="Branco"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      status: e.target.value as Vehicle["status"],
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="active">Ativo</option>
                  <option value="inactive">Inativo</option>
                  <option value="maintenance">Em manutenção</option>
                  <option value="decommissioned">Desativado</option>
                </select>
              </div>
            </div>

            <div className="border-t border-gray-100 pt-4">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">
                Integração com engines (opcional)
              </p>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ID Traccar (GPS)
                  </label>
                  <input
                    type="number"
                    value={form.traccar_device_id}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        traccar_device_id: e.target.value,
                      }))
                    }
                    placeholder="ID numérico do dispositivo"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ID Fleetbase
                  </label>
                  <input
                    value={form.fleetbase_asset_id}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        fleetbase_asset_id: e.target.value,
                      }))
                    }
                    placeholder="UUID do asset"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
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

      {/* Confirm Dialog */}
      <Dialog
        open={!!confirmId}
        onOpenChange={(open) => {
          if (!open && !isConfirming) {
            setConfirmId(null);
            setConfirmAction(null);
          }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {confirmAction === "delete"
                ? "Excluir veículo?"
                : confirmVehicle?.status === "active"
                  ? "Desativar veículo?"
                  : "Ativar veículo?"}
            </DialogTitle>
            <DialogDescription>
              {confirmAction === "delete"
                ? `O veículo ${confirmVehicle?.plate} será removido permanentemente.`
                : confirmVehicle?.status === "active"
                  ? `O veículo ${confirmVehicle?.plate} será marcado como inativo.`
                  : `O veículo ${confirmVehicle?.plate} será reativado.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              onClick={() => {
                setConfirmId(null);
                setConfirmAction(null);
              }}
              disabled={isConfirming}
              className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              disabled={isConfirming}
              className={`flex items-center gap-2 px-4 py-2 text-sm text-white rounded-lg transition-colors disabled:opacity-50 ${
                confirmAction === "delete"
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-amber-600 hover:bg-amber-700"
              }`}
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
          className={`fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-white text-sm font-medium animate-in fade-in slide-in-from-bottom-2 ${
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
