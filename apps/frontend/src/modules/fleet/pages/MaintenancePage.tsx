// =============================================================================
// src/modules/fleet/pages/MaintenancePage.tsx
// =============================================================================

"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Wrench,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Fuel,
  Clock,
  X,
  Flame,
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
  listMaintenance,
  createMaintenance,
  updateMaintenance,
  listVehicles,
} from "../services/fleet.api";
import type {
  MaintenanceRecord,
  MaintenanceType,
  MaintenanceStatus,
  Vehicle,
} from "../types/fleet.types";

// =============================================================================
// HELPERS
// =============================================================================
type ToastType = "success" | "error";
interface UiToast {
  message: string;
  type: ToastType;
}
type TabKey = "pending" | "scheduled" | "completed" | "fuel";

const TYPE_CONFIG: Record<
  MaintenanceType,
  { label: string; icon: React.ElementType }
> = {
  preventive: { label: "Preventiva", icon: Calendar },
  corrective: { label: "Corretiva", icon: Wrench },
  inspection: { label: "Inspeção", icon: CheckCircle },
  fuel: { label: "Combustível", icon: Fuel },
  document: { label: "Documento", icon: AlertTriangle },
};

const STATUS_CONFIG: Record<
  MaintenanceStatus,
  { label: string; bg: string; text: string }
> = {
  scheduled: { label: "Agendado", bg: "bg-blue-100", text: "text-blue-700" },
  in_progress: {
    label: "Em andamento",
    bg: "bg-amber-100",
    text: "text-amber-800",
  },
  completed: {
    label: "Concluído",
    bg: "bg-green-100",
    text: "text-green-800",
  },
  cancelled: { label: "Cancelado", bg: "bg-gray-100", text: "text-gray-600" },
};

function isOverdue(record: MaintenanceRecord): boolean {
  if (!record.scheduled_date) return false;
  return (
    new Date(record.scheduled_date) < new Date() &&
    record.status !== "completed" &&
    record.status !== "cancelled"
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(iso));
}

function formatCurrency(val: number | null): string {
  if (val === null) return "-";
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const EMPTY_FORM = {
  vehicle_id: "",
  type: "preventive" as MaintenanceType,
  description: "",
  scheduled_date: "",
  cost: "",
  odometer_km: "",
  notes: "",
};

const EMPTY_COMPLETE = {
  completed_date: new Date().toISOString().slice(0, 16),
  cost: "",
  notes: "",
};

const EMPTY_FUEL = {
  vehicle_id: "",
  description: "",
  scheduled_date: new Date().toISOString().slice(0, 10),
  cost: "",
  odometer_km: "",
  notes: "",
};

// =============================================================================
// COMPONENTE: MaintenancePage
// =============================================================================
export function MaintenancePage() {
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("pending");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);

  const [completeId, setCompleteId] = useState<string | null>(null);
  const [completeForm, setCompleteForm] = useState(EMPTY_COMPLETE);
  const [isCompleting, setIsCompleting] = useState(false);

  const [postponeId, setPostponeId] = useState<string | null>(null);
  const [postponeDate, setPostponeDate] = useState("");
  const [isPostponing, setIsPostponing] = useState(false);

  const [cancelId, setCancelId] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  const [fuelOpen, setFuelOpen] = useState(false);
  const [fuelForm, setFuelForm] = useState(EMPTY_FUEL);
  const [isSavingFuel, setIsSavingFuel] = useState(false);

  const [toast, setToast] = useState<UiToast | null>(null);

  function showToast(message: string, type: ToastType) {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2800);
  }

  const tabToStatus: Record<TabKey, MaintenanceStatus | undefined> = {
    pending: "scheduled",
    scheduled: "scheduled",
    completed: "completed",
    fuel: undefined,
  };

  const fetchRecords = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params =
        activeTab === "fuel"
          ? { type: "fuel" as MaintenanceType, page, limit: 30 }
          : {
              status: tabToStatus[activeTab],
              page,
              limit: 30,
            };
      const result = await listMaintenance(params);
      let data = result.data;
      if (activeTab === "pending") {
        data = data
          .filter((r) => r.status !== "completed" && r.status !== "cancelled")
          .sort((a, b) => {
            const aOver = isOverdue(a) ? 0 : 1;
            const bOver = isOverdue(b) ? 0 : 1;
            return aOver - bOver;
          });
      }
      if (activeTab === "fuel") {
        data = data.filter((r) => r.type === "fuel");
      }
      setRecords(data);
      setTotalPages(result.totalPages);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao carregar manutenções.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, page]);

  useEffect(() => {
    fetchRecords();
    listVehicles({ limit: 100 })
      .then((r) => setVehicles(r.data))
      .catch(() => {});
  }, [fetchRecords]);

  function getVehicleLabel(vehicleId: string): string {
    const v = vehicles.find((x) => x.id === vehicleId);
    if (!v) return vehicleId.slice(0, 8);
    return v.plate + (v.model ? ` - ${v.model}` : "");
  }

  async function handleSchedule() {
    if (!form.vehicle_id || !form.description.trim()) {
      showToast("Veículo e descrição são obrigatórios.", "error");
      return;
    }
    setIsSaving(true);
    try {
      await createMaintenance({
        vehicle_id: form.vehicle_id,
        type: form.type,
        description: form.description.trim(),
        scheduled_date: form.scheduled_date
          ? new Date(form.scheduled_date).toISOString()
          : undefined,
        cost: form.cost ? parseFloat(form.cost) : undefined,
        odometer_km: form.odometer_km ? parseInt(form.odometer_km) : undefined,
        notes: form.notes || undefined,
      });
      showToast("Manutenção agendada com sucesso.", "success");
      setScheduleOpen(false);
      setForm(EMPTY_FORM);
      fetchRecords();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Erro ao agendar.",
        "error",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleComplete() {
    if (!completeId) return;
    setIsCompleting(true);
    try {
      await updateMaintenance(completeId, {
        status: "completed",
        completed_date: new Date(completeForm.completed_date).toISOString(),
        cost: completeForm.cost ? parseFloat(completeForm.cost) : undefined,
        notes: completeForm.notes || undefined,
      });
      showToast("Manutenção registrada como concluída.", "success");
      setCompleteId(null);
      fetchRecords();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Erro ao concluir.",
        "error",
      );
    } finally {
      setIsCompleting(false);
    }
  }

  async function handlePostpone() {
    if (!postponeId || !postponeDate) {
      showToast("Selecione a nova data.", "error");
      return;
    }
    setIsPostponing(true);
    try {
      await updateMaintenance(postponeId, {
        status: "scheduled",
        completed_date: undefined,
      });
      showToast("Manutenção adiada.", "success");
      setPostponeId(null);
      setPostponeDate("");
      fetchRecords();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Erro ao adiar.", "error");
    } finally {
      setIsPostponing(false);
    }
  }

  async function handleCancel() {
    if (!cancelId) return;
    setIsCancelling(true);
    try {
      await updateMaintenance(cancelId, { status: "cancelled" });
      showToast("Manutenção cancelada.", "success");
      setCancelId(null);
      fetchRecords();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Erro ao cancelar.",
        "error",
      );
    } finally {
      setIsCancelling(false);
    }
  }

  async function handleSaveFuel() {
    if (!fuelForm.vehicle_id || !fuelForm.description.trim()) {
      showToast("Veículo e descrição são obrigatórios.", "error");
      return;
    }
    setIsSavingFuel(true);
    try {
      await createMaintenance({
        vehicle_id: fuelForm.vehicle_id,
        type: "fuel",
        description: fuelForm.description.trim(),
        scheduled_date: fuelForm.scheduled_date
          ? new Date(fuelForm.scheduled_date).toISOString()
          : undefined,
        cost: fuelForm.cost ? parseFloat(fuelForm.cost) : undefined,
        odometer_km: fuelForm.odometer_km
          ? parseInt(fuelForm.odometer_km)
          : undefined,
        notes: fuelForm.notes || undefined,
      });
      showToast("Abastecimento registrado.", "success");
      setFuelOpen(false);
      setFuelForm(EMPTY_FUEL);
      fetchRecords();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Erro ao registrar.",
        "error",
      );
    } finally {
      setIsSavingFuel(false);
    }
  }

  const tabs: Array<{ key: TabKey; label: string; icon: React.ElementType }> = [
    { key: "pending", label: "Pendentes", icon: AlertTriangle },
    { key: "scheduled", label: "Agendadas", icon: Calendar },
    { key: "completed", label: "Concluídas", icon: CheckCircle },
    { key: "fuel", label: "Combustível", icon: Fuel },
  ];

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Manutenção</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Controle de manutenções e abastecimentos
          </p>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === "fuel" ? (
            <button
              onClick={() => {
                setFuelForm(EMPTY_FUEL);
                setFuelOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Registrar Abastecimento
            </button>
          ) : (
            <button
              onClick={() => {
                setForm(EMPTY_FORM);
                setScheduleOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Agendar Manutenção
            </button>
          )}
          <button
            onClick={fetchRecords}
            title="Atualizar"
            className="p-2 border border-gray-200 rounded-lg text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
          >
            <RefreshCw
              className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
            />
          </button>
        </div>
      </div>

      {/* Abas */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => {
              setActiveTab(key);
              setPage(1);
            }}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === key
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
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
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-20 bg-gray-100 rounded-xl animate-pulse"
            />
          ))}
        </div>
      ) : records.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-gray-200 text-center">
          <Wrench className="w-12 h-12 mb-3 text-gray-300" />
          <p className="font-medium text-gray-600">
            Nenhum registro encontrado
          </p>
          <p className="text-sm text-gray-400 mt-1">
            {activeTab === "fuel"
              ? "Registre o primeiro abastecimento."
              : "Agende a primeira manutenção."}
          </p>
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
                    Tipo
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">
                    Descrição
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">
                    {activeTab === "fuel" ? "Data" : "Data prevista"}
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">
                    Custo
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">
                    Status
                  </th>
                  {activeTab !== "fuel" && activeTab !== "completed" && (
                    <th className="text-right px-4 py-3 font-medium text-gray-500">
                      Ações
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {records.map((r) => {
                  const overdue = isOverdue(r);
                  const TypeIcon = TYPE_CONFIG[r.type]?.icon ?? Wrench;
                  const st = STATUS_CONFIG[r.status] ?? STATUS_CONFIG.scheduled;
                  return (
                    <tr
                      key={r.id}
                      className={`hover:bg-gray-50 transition-colors ${overdue ? "bg-red-50/40" : ""}`}
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">
                          {getVehicleLabel(r.vehicle_id)}
                        </p>
                        {r.odometer_km && (
                          <p className="text-xs text-gray-400">
                            {r.odometer_km.toLocaleString()} km
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1.5 text-gray-600">
                          <TypeIcon className="w-3.5 h-3.5 flex-shrink-0" />
                          {TYPE_CONFIG[r.type]?.label ?? r.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 max-w-[200px]">
                        <p className="truncate">{r.description}</p>
                        {r.notes && (
                          <p className="text-xs text-gray-400 truncate">
                            {r.notes}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`flex items-center gap-1 ${overdue ? "text-red-600 font-semibold" : "text-gray-600"}`}
                        >
                          {overdue && <Flame className="w-3.5 h-3.5" />}
                          {formatDate(r.scheduled_date ?? r.completed_date)}
                        </span>
                        {overdue && (
                          <p className="text-xs text-red-500 font-medium">
                            VENCIDA
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {formatCurrency(r.cost)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${st.bg} ${st.text}`}
                        >
                          {st.label}
                        </span>
                      </td>
                      {activeTab !== "fuel" && activeTab !== "completed" && (
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            {r.status !== "completed" &&
                              r.status !== "cancelled" && (
                                <button
                                  onClick={() => {
                                    setCompleteId(r.id);
                                    setCompleteForm({
                                      ...EMPTY_COMPLETE,
                                      cost: r.cost?.toString() ?? "",
                                    });
                                  }}
                                  title="Registrar conclusão"
                                  className="p-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors"
                                >
                                  <CheckCircle className="w-4 h-4" />
                                </button>
                              )}
                            {r.status !== "completed" &&
                              r.status !== "cancelled" && (
                                <button
                                  onClick={() => {
                                    setPostponeId(r.id);
                                    setPostponeDate("");
                                  }}
                                  title="Adiar"
                                  className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                                >
                                  <Clock className="w-4 h-4" />
                                </button>
                              )}
                            {r.status !== "completed" &&
                              r.status !== "cancelled" && (
                                <button
                                  onClick={() => setCancelId(r.id)}
                                  title="Cancelar"
                                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              )}
                          </div>
                        </td>
                      )}
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

      {/* Modal: Agendar Manutenção */}
      <Dialog
        open={scheduleOpen}
        onOpenChange={(open) => {
          if (!isSaving) setScheduleOpen(open);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Agendar Manutenção</DialogTitle>
            <DialogDescription>
              Preencha os dados da manutenção a ser agendada.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Veículo *
              </label>
              <select
                value={form.vehicle_id}
                onChange={(e) =>
                  setForm((f) => ({ ...f, vehicle_id: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Selecionar veículo...</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.plate}
                    {v.model ? ` - ${v.model}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo *
                </label>
                <select
                  value={form.type}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      type: e.target.value as MaintenanceType,
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="preventive">Preventiva</option>
                  <option value="corrective">Corretiva</option>
                  <option value="inspection">Inspeção</option>
                  <option value="document">Documento</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data prevista
                </label>
                <input
                  type="date"
                  value={form.scheduled_date}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, scheduled_date: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Descrição *
              </label>
              <input
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                placeholder="Troca de óleo, revisão dos 50.000 km..."
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Custo estimado (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={form.cost}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, cost: e.target.value }))
                  }
                  placeholder="350.00"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Odômetro (km)
                </label>
                <input
                  type="number"
                  value={form.odometer_km}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, odometer_km: e.target.value }))
                  }
                  placeholder="50000"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Observações
              </label>
              <textarea
                value={form.notes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, notes: e.target.value }))
                }
                placeholder="Peças necessárias, oficina responsável..."
                rows={2}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <button
              onClick={() => setScheduleOpen(false)}
              disabled={isSaving}
              className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleSchedule}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {isSaving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              {isSaving ? "Salvando..." : "Agendar"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Registrar Conclusão */}
      <Dialog
        open={!!completeId}
        onOpenChange={(open) => {
          if (!open && !isCompleting) setCompleteId(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Registrar Conclusão</DialogTitle>
            <DialogDescription>
              Informe os dados de conclusão da manutenção.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Data de conclusão *
              </label>
              <input
                type="datetime-local"
                value={completeForm.completed_date}
                onChange={(e) =>
                  setCompleteForm((f) => ({
                    ...f,
                    completed_date: e.target.value,
                  }))
                }
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Custo real (R$)
              </label>
              <input
                type="number"
                step="0.01"
                value={completeForm.cost}
                onChange={(e) =>
                  setCompleteForm((f) => ({ ...f, cost: e.target.value }))
                }
                placeholder="0.00"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Observações
              </label>
              <textarea
                value={completeForm.notes}
                onChange={(e) =>
                  setCompleteForm((f) => ({ ...f, notes: e.target.value }))
                }
                rows={2}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <button
              onClick={() => setCompleteId(null)}
              disabled={isCompleting}
              className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleComplete}
              disabled={isCompleting}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {isCompleting && (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              )}
              Confirmar Conclusão
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Adiar */}
      <Dialog
        open={!!postponeId}
        onOpenChange={(open) => {
          if (!open && !isPostponing) {
            setPostponeId(null);
            setPostponeDate("");
          }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Adiar Manutenção</DialogTitle>
            <DialogDescription>
              Selecione a nova data para a manutenção.
            </DialogDescription>
          </DialogHeader>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nova data *
            </label>
            <input
              type="date"
              value={postponeDate}
              onChange={(e) => setPostponeDate(e.target.value)}
              min={new Date().toISOString().slice(0, 10)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <DialogFooter>
            <button
              onClick={() => {
                setPostponeId(null);
                setPostponeDate("");
              }}
              disabled={isPostponing}
              className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              onClick={handlePostpone}
              disabled={isPostponing}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50"
            >
              {isPostponing && (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              )}
              Adiar
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Cancelar */}
      <Dialog
        open={!!cancelId}
        onOpenChange={(open) => {
          if (!open && !isCancelling) setCancelId(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Cancelar Manutenção?</DialogTitle>
            <DialogDescription>
              Esta ação marcará a manutenção como cancelada. Não é
              possível desfazer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              onClick={() => setCancelId(null)}
              disabled={isCancelling}
              className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              Voltar
            </button>
            <button
              onClick={handleCancel}
              disabled={isCancelling}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {isCancelling && (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              )}
              Confirmar Cancelamento
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Registrar Abastecimento */}
      <Dialog
        open={fuelOpen}
        onOpenChange={(open) => {
          if (!isSavingFuel) setFuelOpen(open);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar Abastecimento</DialogTitle>
            <DialogDescription>
              Informe os dados do abastecimento.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Veículo *
              </label>
              <select
                value={fuelForm.vehicle_id}
                onChange={(e) =>
                  setFuelForm((f) => ({ ...f, vehicle_id: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Selecionar veículo...</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.plate}
                    {v.model ? ` - ${v.model}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Descrição *
              </label>
              <input
                value={fuelForm.description}
                onChange={(e) =>
                  setFuelForm((f) => ({ ...f, description: e.target.value }))
                }
                placeholder="Abastecimento completo - 45 litros"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data
                </label>
                <input
                  type="date"
                  value={fuelForm.scheduled_date}
                  onChange={(e) =>
                    setFuelForm((f) => ({
                      ...f,
                      scheduled_date: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Valor (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={fuelForm.cost}
                  onChange={(e) =>
                    setFuelForm((f) => ({ ...f, cost: e.target.value }))
                  }
                  placeholder="250.00"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  KM atual
                </label>
                <input
                  type="number"
                  value={fuelForm.odometer_km}
                  onChange={(e) =>
                    setFuelForm((f) => ({ ...f, odometer_km: e.target.value }))
                  }
                  placeholder="52000"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <button
              onClick={() => setFuelOpen(false)}
              disabled={isSavingFuel}
              className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleSaveFuel}
              disabled={isSavingFuel}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {isSavingFuel && (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              )}
              Registrar
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
