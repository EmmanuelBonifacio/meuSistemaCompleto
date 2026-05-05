// =============================================================================
// src/modules/fleet/pages/DispatchPage.tsx
// =============================================================================

"use client";

import { useState, useEffect } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  Plus,
  MapPin,
  User,
  Truck,
  Clock,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  X,
  GripVertical,
  Route,
  Map,
  LayoutList,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { listDrivers, listVehicles } from "../services/fleet.api";
import { getPendingDispatchCount, listTodayRoutes } from "../services/routes.api";
import type { Route as RouteType } from "../types/routes.types";
import type {
  Driver,
  Vehicle,
  DispatchOrder,
  DispatchStatus,
  DispatchPriority,
} from "../types/fleet.types";

// =============================================================================
// TIPOS LOCAIS
// =============================================================================
type ToastType = "success" | "error";
interface UiToast {
  message: string;
  type: ToastType;
}

interface LocalOrder extends DispatchOrder {
  _driverName?: string;
  _vehiclePlate?: string;
  _routeName?: string;
  _routeColor?: string;
  /** Preenchido quando a ordem vem de rota otimizada (filtro kanban) */
  route_id?: string | null;
}

// =============================================================================
// CONFIGURAÇÃO DO KANBAN
// =============================================================================
const COLUMNS: Array<{
  status: DispatchStatus;
  label: string;
  color: string;
  headerColor: string;
}> = [
  {
    status: "pending",
    label: "Pendente",
    color: "bg-gray-50",
    headerColor: "bg-gray-200 text-gray-700",
  },
  {
    status: "assigned",
    label: "Atribuída",
    color: "bg-blue-50",
    headerColor: "bg-blue-200 text-blue-800",
  },
  {
    status: "in_transit",
    label: "Em Rota",
    color: "bg-amber-50",
    headerColor: "bg-amber-200 text-amber-800",
  },
  {
    status: "completed",
    label: "Entregue",
    color: "bg-green-50",
    headerColor: "bg-green-200 text-green-800",
  },
  {
    status: "cancelled",
    label: "Cancelada",
    color: "bg-red-50",
    headerColor: "bg-red-200 text-red-700",
  },
];

const PRIORITY_CONFIG: Record<
  DispatchPriority,
  { label: string; cls: string }
> = {
  low: { label: "Baixa", cls: "bg-gray-100 text-gray-600" },
  medium: { label: "Normal", cls: "bg-blue-100 text-blue-700" },
  high: { label: "Alta", cls: "bg-amber-100 text-amber-700" },
  critical: { label: "Urgente", cls: "bg-red-100 text-red-700" },
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

const EMPTY_FORM = {
  origin_address: "",
  destination_address: "",
  driver_id: "",
  vehicle_id: "",
  description: "",
  scheduled_at: "",
  priority: "medium" as DispatchPriority,
};

// =============================================================================
// SUBCOMPONENTE: OrderCard (draggable)
// =============================================================================
function OrderCard({
  order,
  isDragging,
}: {
  order: LocalOrder;
  isDragging?: boolean;
}) {
  const pri = PRIORITY_CONFIG[order.priority] ?? PRIORITY_CONFIG.medium;
  return (
    <div
      className={`bg-white rounded-lg border p-3 shadow-sm select-none ${
        isDragging ? "opacity-60 border-blue-400 shadow-lg" : "border-gray-200"
      }`}
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-gray-400 font-mono">
          #{order.id.slice(0, 8)}
        </span>
        <div className="flex items-center gap-1.5">
          {order._routeName && (
            <span
              className="text-xs px-2 py-0.5 rounded-full font-medium text-white"
              style={{ backgroundColor: order._routeColor ?? "#185FA5" }}
            >
              {order._routeName}
            </span>
          )}
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium ${pri.cls}`}
          >
            {pri.label}
          </span>
        </div>
      </div>
      <div className="space-y-1 text-sm text-gray-700 mb-2">
        <p className="flex items-start gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-green-500 mt-0.5 flex-shrink-0" />
          <span className="truncate text-xs">{order.origin_address}</span>
        </p>
        <p className="flex items-start gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-red-500 mt-0.5 flex-shrink-0" />
          <span className="truncate text-xs">{order.destination_address}</span>
        </p>
      </div>
      <div className="flex items-center gap-3 text-xs text-gray-400">
        {order._driverName && (
          <span className="flex items-center gap-1">
            <User className="w-3 h-3" />
            {order._driverName}
          </span>
        )}
        {order._vehiclePlate && (
          <span className="flex items-center gap-1">
            <Truck className="w-3 h-3" />
            {order._vehiclePlate}
          </span>
        )}
        {order.scheduled_at && (
          <span className="flex items-center gap-1 ml-auto">
            <Clock className="w-3 h-3" />
            {formatDate(order.scheduled_at)}
          </span>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// SUBCOMPONENTE: DraggableCard
// =============================================================================
function DraggableCard({ order }: { order: LocalOrder }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: order.id,
      data: { order },
    });
  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <OrderCard order={order} isDragging={isDragging} />
    </div>
  );
}

// =============================================================================
// SUBCOMPONENTE: DroppableColumn
// =============================================================================
function DroppableColumn({
  col,
  orders,
}: {
  col: (typeof COLUMNS)[0];
  orders: LocalOrder[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: col.status });
  return (
    <div className="flex flex-col min-w-[220px] flex-1">
      {/* Header */}
      <div
        className={`flex items-center justify-between px-3 py-2 rounded-t-xl ${col.headerColor}`}
      >
        <span className="text-xs font-semibold">{col.label}</span>
        <span className="text-xs font-bold bg-white/50 px-1.5 py-0.5 rounded-full">
          {orders.length}
        </span>
      </div>
      {/* Body */}
      <div
        ref={setNodeRef}
        className={`flex-1 min-h-[200px] p-2 space-y-2 rounded-b-xl border border-t-0 border-gray-200 transition-colors ${
          col.color
        } ${isOver ? "ring-2 ring-blue-400 ring-inset" : ""}`}
      >
        {orders.map((o) => (
          <DraggableCard key={o.id} order={o} />
        ))}
        {orders.length === 0 && (
          <p className="text-xs text-gray-400 text-center pt-6 select-none">
            Arraste ordens aqui
          </p>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// COMPONENTE: DispatchPage
// =============================================================================
export function DispatchPage() {
  const [orders, setOrders] = useState<LocalOrder[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [activeOrder, setActiveOrder] = useState<LocalOrder | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);

  const [filterDriver, setFilterDriver] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [filterRoute, setFilterRoute] = useState("");
  const [activeTab, setActiveTab] = useState<"kanban" | "routes" | "map">("kanban");
  const [pendingRouteCount, setPendingRouteCount] = useState(0);
  const [todayRoutes, setTodayRoutes] = useState<RouteType[]>([]);

  const [toast, setToast] = useState<UiToast | null>(null);

  function showToast(message: string, type: ToastType) {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2800);
  }

  useEffect(() => {
    setIsLoading(true);
    Promise.all([
      listDrivers({ limit: 100 }),
      listVehicles({ status: "active", limit: 100 }),
    ])
      .then(([d, v]) => {
        setDrivers(d.data);
        setVehicles(v.data);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));

    // Fetch route integration data
    getPendingDispatchCount().then(setPendingRouteCount).catch(() => {});
    listTodayRoutes().then((res) => setTodayRoutes(res.data)).catch(() => {});
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  function handleDragStart(event: DragStartEvent) {
    const order = orders.find((o) => o.id === event.active.id);
    setActiveOrder(order ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveOrder(null);
    if (!over) return;
    const orderId = active.id as string;
    const newStatus = over.id as DispatchStatus;
    const validCols = COLUMNS.map((c) => c.status);
    if (!validCols.includes(newStatus)) return;
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o)),
    );
  }

  function handleCreateOrder() {
    if (!form.origin_address.trim() || !form.destination_address.trim()) {
      showToast("Origem e destino são obrigatórios.", "error");
      return;
    }
    if (!form.driver_id || !form.vehicle_id) {
      showToast("Selecione um motorista e um veículo.", "error");
      return;
    }
    setIsSaving(true);
    const driver = drivers.find((d) => d.id === form.driver_id);
    const vehicle = vehicles.find((v) => v.id === form.vehicle_id);
    const now = new Date().toISOString();
    const newOrder: LocalOrder = {
      id: crypto.randomUUID(),
      driver_id: form.driver_id,
      vehicle_id: form.vehicle_id,
      origin_address: form.origin_address.trim(),
      origin_lat: null,
      origin_lng: null,
      destination_address: form.destination_address.trim(),
      destination_lat: null,
      destination_lng: null,
      description: form.description || null,
      scheduled_at: form.scheduled_at
        ? new Date(form.scheduled_at).toISOString()
        : null,
      priority: form.priority,
      status: "pending",
      fleetbase_order_id: null,
      created_at: now,
      updated_at: now,
      _driverName: driver?.name,
      _vehiclePlate: vehicle?.plate,
    };
    setOrders((prev) => [newOrder, ...prev]);
    setModalOpen(false);
    setForm(EMPTY_FORM);
    showToast("Ordem criada com sucesso.", "success");
    setIsSaving(false);
  }

  const filteredOrders = orders.filter((o) => {
    if (filterDriver && o.driver_id !== filterDriver) return false;
    if (filterPriority && o.priority !== filterPriority) return false;
    if (filterRoute === "with_route" && !o.route_id) return false;
    if (filterRoute === "no_route" && o.route_id) return false;
    return true;
  });

  const availableDrivers = drivers.filter((d) => d.status === "active");
  const availableVehicles = vehicles;

  return (
    <div className="space-y-4">
      {/* Banner: rotas aguardando despacho */}
      {pendingRouteCount > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 bg-[#E6F1FB] border border-[#185FA5]/20 rounded-lg">
          <Route className="w-4 h-4 text-[#185FA5] flex-shrink-0" />
          <p className="text-sm text-[#185FA5] font-medium">
            {pendingRouteCount} rota{pendingRouteCount > 1 ? "s" : ""} otimizada{pendingRouteCount > 1 ? "s" : ""} aguardam despacho
          </p>
          <a
            href="../frota/criar-rotas"
            className="ml-auto text-xs text-[#185FA5] underline hover:no-underline"
          >
            Ver em Criar Rotas →
          </a>
        </div>
      )}

      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Despacho</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {availableDrivers.length} motoristas · {availableVehicles.length}{" "}
            veículos disponíveis
          </p>
        </div>
        <button
          onClick={() => {
            setForm(EMPTY_FORM);
            setModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nova Ordem
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {[
          { id: "kanban" as const, label: "Kanban", icon: <LayoutList className="w-3.5 h-3.5" /> },
          { id: "routes" as const, label: "Rotas do dia", icon: <Route className="w-3.5 h-3.5" /> },
          { id: "map" as const, label: "Mapa ao vivo", icon: <Map className="w-3.5 h-3.5" /> },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? "border-[#185FA5] text-[#185FA5]"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.icon}
            {tab.label}
            {tab.id === "routes" && todayRoutes.length > 0 && (
              <span className="ml-1 text-xs px-1.5 py-0.5 rounded-full bg-[#185FA5] text-white">
                {todayRoutes.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab: Rotas do dia */}
      {activeTab === "routes" && (
        <div className="space-y-3">
          {todayRoutes.length === 0 ? (
            <div className="text-center py-12">
              <Route className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-400">Nenhuma rota criada hoje.</p>
              <p className="text-xs text-gray-400 mt-1">
                Use <strong>Criar Rotas</strong> para otimizar e aprovar rotas.
              </p>
            </div>
          ) : (
            todayRoutes.map((route) => (
              <div
                key={route.id}
                className="flex items-center gap-3 p-3 bg-white border rounded-lg"
                style={{ borderLeftWidth: "3px", borderLeftColor: route.color }}
              >
                <div
                  className="w-7 h-7 rounded-full text-white text-xs font-bold flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: route.color }}
                >
                  {route.name.replace("Rota ", "")}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800">{route.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {route.stops.length} paradas · {(route.totalDistanceKm ?? 0).toFixed(1)} km · {route.estimatedDurationMin ?? 0} min
                  </p>
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded-full font-medium ${
                    route.status === "approved" ? "bg-green-100 text-green-700" :
                    route.status === "dispatched" ? "bg-blue-100 text-blue-700" :
                    route.status === "completed" ? "bg-purple-100 text-purple-700" :
                    "bg-gray-100 text-gray-600"
                  }`}
                >
                  {route.status === "approved" ? "Aprovada" :
                   route.status === "dispatched" ? "Despachada" :
                   route.status === "completed" ? "Concluída" : "Pendente"}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab: Mapa ao vivo */}
      {activeTab === "map" && (
        <div className="flex flex-col items-center justify-center py-16 bg-gray-50 rounded-lg border border-dashed border-gray-200">
          <Map className="w-12 h-12 text-gray-200 mb-3" />
          <p className="text-sm font-medium text-gray-500">Mapa ao vivo</p>
          <p className="text-xs text-gray-400 mt-1 text-center max-w-xs">
            Rastreamento em tempo real das paradas de hoje.
            Disponível na próxima fase com integração ao Traccar.
          </p>
        </div>
      )}

      {/* Tab: Kanban (default) */}
      {activeTab === "kanban" && <>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-center">
        <select
          value={filterDriver}
          onChange={(e) => setFilterDriver(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todos os motoristas</option>
          {drivers.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <select
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todas as prioridades</option>
          <option value="critical">Urgente</option>
          <option value="high">Alta</option>
          <option value="medium">Normal</option>
          <option value="low">Baixa</option>
        </select>
        <select
          value={filterRoute}
          onChange={(e) => setFilterRoute(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todas as rotas</option>
          <option value="with_route">Com rota vinculada</option>
          <option value="no_route">Sem rota</option>
        </select>
        {(filterDriver || filterPriority || filterRoute) && (
          <button
            onClick={() => {
              setFilterDriver("");
              setFilterPriority("");
              setFilterRoute("");
            }}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-500"
          >
            <X className="w-3.5 h-3.5" /> Limpar filtros
          </button>
        )}
        <span className="ml-auto text-xs text-gray-400">
          {filteredOrders.length} ordem{filteredOrders.length !== 1 ? "s" : ""}
          {(filterDriver || filterPriority || filterRoute)
            ? " (filtrada" + (filteredOrders.length !== 1 ? "s" : "") + ")"
            : ""}
        </span>
      </div>

      {/* Kanban */}
      {isLoading ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {COLUMNS.map((c) => (
            <div key={c.status} className="min-w-[220px] flex-1">
              <div className="h-8 bg-gray-200 rounded-t-xl animate-pulse" />
              <div className="h-48 bg-gray-100 rounded-b-xl animate-pulse" />
            </div>
          ))}
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 overflow-x-auto pb-4">
            {COLUMNS.map((col) => (
              <DroppableColumn
                key={col.status}
                col={col}
                orders={filteredOrders.filter((o) => o.status === col.status)}
              />
            ))}
          </div>

          <DragOverlay>
            {activeOrder && (
              <div className="rotate-2 opacity-90">
                <OrderCard order={activeOrder} isDragging />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      {orders.length === 0 && !isLoading && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <GripVertical className="w-10 h-10 mb-3 text-gray-300" />
          <p className="font-medium text-gray-600">Nenhuma ordem de despacho</p>
          <p className="text-sm text-gray-400 mt-1">
            Crie a primeira ordem para começar.
          </p>
          <button
            onClick={() => {
              setForm(EMPTY_FORM);
              setModalOpen(true);
            }}
            className="mt-4 flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Criar primeira ordem
          </button>
        </div>
      )}

      </> /* end kanban tab */}

      {/* Modal Nova Ordem */}
      <Dialog
        open={modalOpen}
        onOpenChange={(open) => {
          if (!isSaving) setModalOpen(open);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nova Ordem de Despacho</DialogTitle>
            <DialogDescription>
              Preencha os dados da ordem de serviço.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Origem *
              </label>
              <input
                value={form.origin_address}
                onChange={(e) =>
                  setForm((f) => ({ ...f, origin_address: e.target.value }))
                }
                placeholder="Endereço de coleta ou ponto de partida"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Destino *
              </label>
              <input
                value={form.destination_address}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    destination_address: e.target.value,
                  }))
                }
                placeholder="Endereço de entrega ou destino final"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Motorista *
                </label>
                <select
                  value={form.driver_id}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, driver_id: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Selecionar...</option>
                  {availableDrivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
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
                  <option value="">Selecionar...</option>
                  {availableVehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.plate}
                      {v.model ? ` — ${v.model}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Prioridade
                </label>
                <select
                  value={form.priority}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      priority: e.target.value as DispatchPriority,
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="low">Baixa</option>
                  <option value="medium">Normal</option>
                  <option value="high">Alta</option>
                  <option value="critical">Urgente</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data / Hora prevista
                </label>
                <input
                  type="datetime-local"
                  value={form.scheduled_at}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, scheduled_at: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Descrição / Observações
              </label>
              <textarea
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                placeholder="Detalhes da carga ou instrução ao motorista..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
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
              onClick={handleCreateOrder}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {isSaving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              Criar Ordem
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
