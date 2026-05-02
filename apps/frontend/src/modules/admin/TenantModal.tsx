"use client";
// src/modules/admin/TenantModal.tsx
// Modal acionado ao clicar em um tenant na tabela.
// Exibe os modulos ativos, logs de acesso e gerenciamento de usuarios do tenant.

import { useEffect, useState } from "react";
import {
  X,
  Building2,
  Monitor,
  DollarSign,
  Package,
  Users,
  ShoppingCart,
  Tv,
  Truck,
  Activity,
  Plus,
  KeyRound,
  Pencil,
  Trash2,
  UserCheck,
  UserX,
  Eye,
  EyeOff,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Tenant, TenantModule, RequestLog, TenantUser } from "@/types/api";
import {
  getTenantLogs,
  getTenant,
  listTenantUsers,
  createTenantUser,
  updateTenantUser,
  resetTenantUserPassword,
  deleteTenantUser,
} from "@/services/admin.service";

function ModuleIcon({ name }: { name: string }) {
  const cls = "h-5 w-5";
  switch (name) {
    case "tv":
      return <Tv className={cls} />;
    case "financeiro":
      return <DollarSign className={cls} />;
    case "estoque":
      return <Package className={cls} />;
    case "rh":
      return <Users className={cls} />;
    case "vendas":
      return <ShoppingCart className={cls} />;
    case "fleet":
      return <Truck className={cls} />;
    default:
      return <Monitor className={cls} />;
  }
}

interface TenantModalProps {
  tenant: Tenant | null;
  onClose: () => void;
}

function statusColor(code: number): string {
  if (code >= 500) return "text-red-500";
  if (code >= 400) return "text-orange-500";
  if (code >= 300) return "text-blue-400";
  return "text-green-500";
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s atras`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}min atras`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h atras`;
  return new Date(dateStr).toLocaleDateString("pt-BR");
}

interface UserRowProps {
  user: TenantUser;
  tenantId: string;
  onRefresh: () => void;
}

function UserRow({ user, tenantId, onRefresh }: UserRowProps) {
  const [editMode, setEditMode] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [editName, setEditName] = useState(user.name ?? "");
  const [editRole, setEditRole] = useState<"admin" | "user">(
    user.role as "admin" | "user",
  );
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function handleSaveEdit() {
    setLoading(true);
    setError(null);
    try {
      await updateTenantUser(tenantId, user.id, {
        name: editName,
        role: editRole,
      });
      setEditMode(false);
      onRefresh();
    } catch {
      setError("Erro ao salvar.");
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleActive() {
    setLoading(true);
    setError(null);
    try {
      await updateTenantUser(tenantId, user.id, { isActive: !user.is_active });
      onRefresh();
    } catch {
      setError("Erro ao alterar status.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword() {
    if (newPassword.length < 8) {
      setError("Minimo 8 caracteres.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await resetTenantUserPassword(tenantId, user.id, { newPassword });
      setResetMode(false);
      setNewPassword("");
    } catch {
      setError("Erro ao redefinir senha.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    // Primeiro clique: pede confirmação sem window.confirm
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 4000);
      return;
    }
    // Segundo clique: executa
    setConfirmDelete(false);
    setLoading(true);
    setError(null);
    try {
      await deleteTenantUser(tenantId, user.id);
      onRefresh();
    } catch {
      setError("Erro ao remover.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-border p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {editMode ? (
            <div className="space-y-2">
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Nome"
                className="h-7 text-sm"
              />
              <select
                value={editRole}
                onChange={(e) =>
                  setEditRole(e.target.value as "admin" | "user")
                }
                className="h-7 w-full rounded border border-input bg-background px-2 text-sm"
              >
                <option value="admin">admin</option>
                <option value="user">user</option>
              </select>
            </div>
          ) : (
            <>
              <p className="font-medium text-sm truncate">{user.name || "—"}</p>
              <p className="text-xs text-muted-foreground truncate">
                {user.email}
              </p>
            </>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${user.role === "admin" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}
          >
            {user.role}
          </span>
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${user.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
          >
            {user.is_active ? "Ativo" : "Inativo"}
          </span>
        </div>
      </div>

      {!editMode && !resetMode && (
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setEditMode(true)}
            className="flex items-center gap-1 px-2 py-1 rounded text-[11px] bg-muted hover:bg-muted/70 transition-colors"
          >
            <Pencil className="h-3 w-3" /> Editar
          </button>
          <button
            onClick={() => setResetMode(true)}
            className="flex items-center gap-1 px-2 py-1 rounded text-[11px] bg-muted hover:bg-muted/70 transition-colors"
          >
            <KeyRound className="h-3 w-3" /> Senha
          </button>
          <button
            onClick={handleToggleActive}
            disabled={loading}
            className="flex items-center gap-1 px-2 py-1 rounded text-[11px] bg-muted hover:bg-muted/70 transition-colors"
          >
            {user.is_active ? (
              <>
                <UserX className="h-3 w-3" /> Suspender
              </>
            ) : (
              <>
                <UserCheck className="h-3 w-3" /> Ativar
              </>
            )}
          </button>
          {confirmDelete ? (
            <div className="flex items-center gap-1">
              <button
                onClick={handleDelete}
                disabled={loading}
                className="flex items-center gap-1 px-2 py-1 rounded text-[11px] bg-red-600 text-white hover:bg-red-700 transition-colors"
              >
                <Trash2 className="h-3 w-3" /> Confirmar
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="flex items-center gap-1 px-2 py-1 rounded text-[11px] bg-muted hover:bg-muted/70 transition-colors"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <button
              onClick={handleDelete}
              disabled={loading}
              className="flex items-center gap-1 px-2 py-1 rounded text-[11px] bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
            >
              <Trash2 className="h-3 w-3" /> Remover
            </button>
          )}
        </div>
      )}

      {editMode && (
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={handleSaveEdit}
            disabled={loading}
            className="h-7 text-xs"
          >
            {loading ? "Salvando..." : "Salvar"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setEditMode(false);
              setError(null);
            }}
            className="h-7 text-xs"
          >
            Cancelar
          </Button>
        </div>
      )}

      {resetMode && (
        <div className="space-y-2">
          <div className="relative">
            <Input
              type={showPassword ? "text" : "password"}
              placeholder="Nova senha (min. 8)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="h-8 text-sm pr-9"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPassword ? (
                <EyeOff className="h-3.5 w-3.5" />
              ) : (
                <Eye className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleResetPassword}
              disabled={loading}
              className="h-7 text-xs"
            >
              {loading ? "Salvando..." : "Confirmar"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setResetMode(false);
                setNewPassword("");
                setError(null);
              }}
              className="h-7 text-xs"
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {error && <p className="text-[11px] text-destructive">{error}</p>}
    </div>
  );
}

interface NewUserFormProps {
  tenantId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

function NewUserForm({ tenantId, onSuccess, onCancel }: NewUserFormProps) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "user">("user");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError("Senha deve ter minimo 8 caracteres.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await createTenantUser(tenantId, { email, name, password, role });
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar usuario.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3"
    >
      <p className="text-xs font-semibold text-primary">Novo Usuario</p>
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2 space-y-1">
          <Label className="text-xs">E-mail</Label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="usuario@empresa.com"
            className="h-8 text-sm"
            required
          />
        </div>
        <div className="col-span-2 space-y-1">
          <Label className="text-xs">Nome</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome completo"
            className="h-8 text-sm"
            required
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Senha inicial</Label>
          <div className="relative">
            <Input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 8 caracteres"
              className="h-8 text-sm pr-9"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPassword ? (
                <EyeOff className="h-3.5 w-3.5" />
              ) : (
                <Eye className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Role</Label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as "admin" | "user")}
            className="h-8 w-full rounded border border-input bg-background px-2 text-sm"
          >
            <option value="user">user</option>
            <option value="admin">admin</option>
          </select>
        </div>
      </div>
      {error && <p className="text-[11px] text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button
          type="submit"
          size="sm"
          disabled={loading}
          className="h-7 text-xs"
        >
          {loading ? "Criando..." : "Criar usuario"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onCancel}
          className="h-7 text-xs"
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}

export function TenantModal({ tenant, onClose }: TenantModalProps) {
  const [freshTenant, setFreshTenant] = useState<Tenant | null>(null);
  const [tenantLoading, setTenantLoading] = useState(false);
  const [logs, setLogs] = useState<RequestLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [showNewUserForm, setShowNewUserForm] = useState(false);
  const [activeTab, setActiveTab] = useState<"modules" | "logs" | "users">(
    "modules",
  );

  useEffect(() => {
    if (!tenant) return;
    setFreshTenant(null);
    setLogs([]);
    setUsers([]);
    setActiveTab("modules");
    setShowNewUserForm(false);

    setTenantLoading(true);
    getTenant(tenant.id)
      .then(setFreshTenant)
      .catch(() => setFreshTenant(null))
      .finally(() => setTenantLoading(false));

    setLogsLoading(true);
    getTenantLogs(tenant.id, { limit: 50 })
      .then(setLogs)
      .catch(() => setLogs([]))
      .finally(() => setLogsLoading(false));

    loadUsers(tenant.id);
  }, [tenant?.id]);

  function loadUsers(id?: string) {
    const tid = id ?? tenant?.id;
    if (!tid) return;
    setUsersLoading(true);
    listTenantUsers(tid)
      .then(setUsers)
      .catch(() => setUsers([]))
      .finally(() => setUsersLoading(false));
  }

  if (!tenant) return null;
  const activeModules =
    (freshTenant ?? tenant).modules?.filter((m) => m.isActive) ?? [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-xl bg-background shadow-xl border border-border"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecalho */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-base">{tenant.name}</h2>
              <p className="text-xs text-muted-foreground font-mono">
                {tenant.slug}
              </p>
              <a
                href={`${process.env.NEXT_PUBLIC_APP_URL ?? ""}/${tenant.slug}/login`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[10px] text-primary hover:underline mt-0.5"
              >
                <ExternalLink className="h-3 w-3" />
                Abrir login do tenant
              </a>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Abas */}
        <div className="flex border-b border-border px-6">
          <button
            className={`py-2.5 pr-4 text-sm font-medium border-b-2 transition-colors ${activeTab === "modules" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            onClick={() => setActiveTab("modules")}
          >
            Modulos ({activeModules.length})
          </button>
          <button
            className={`py-2.5 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${activeTab === "users" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            onClick={() => setActiveTab("users")}
          >
            <Users className="h-3.5 w-3.5" /> Usuarios
            {users.length > 0 && (
              <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px]">
                {users.length}
              </span>
            )}
          </button>
          <button
            className={`py-2.5 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${activeTab === "logs" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            onClick={() => setActiveTab("logs")}
          >
            <Activity className="h-3.5 w-3.5" /> Logs
            {logs.length > 0 && (
              <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px]">
                {logs.length}
              </span>
            )}
          </button>
        </div>

        {/* Conteudo */}
        <div className="px-6 py-5 space-y-3 max-h-[55vh] overflow-y-auto">
          {activeTab === "modules" && (
            <>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Modulos disponiveis ({activeModules.length})
              </p>
              {tenantLoading && (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  Carregando modulos...
                </div>
              )}
              {!tenantLoading && activeModules.length === 0 && (
                <div className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
                  Este tenant nao possui modulos ativos.
                </div>
              )}
              {!tenantLoading &&
                activeModules.map((tm: TenantModule) => (
                  <div
                    key={tm.moduleId}
                    className="flex items-start gap-4 rounded-lg border border-border p-4"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <ModuleIcon name={tm.module.name} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">
                          {tm.module.displayName}
                        </span>
                        <Badge variant="success" className="text-[10px] py-0">
                          Ativo
                        </Badge>
                      </div>
                      {tm.module.description && (
                        <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                          {tm.module.description}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
            </>
          )}

          {activeTab === "users" && (
            <>
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Usuarios do tenant ({users.length})
                </p>
                {!showNewUserForm && (
                  <button
                    onClick={() => setShowNewUserForm(true)}
                    className="flex items-center gap-1 px-2 py-1 rounded text-[11px] bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    <Plus className="h-3 w-3" /> Novo usuario
                  </button>
                )}
              </div>
              {showNewUserForm && (
                <NewUserForm
                  tenantId={tenant.id}
                  onSuccess={() => {
                    setShowNewUserForm(false);
                    loadUsers();
                  }}
                  onCancel={() => setShowNewUserForm(false)}
                />
              )}
              {usersLoading && (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  Carregando usuarios...
                </div>
              )}
              {!usersLoading && users.length === 0 && !showNewUserForm && (
                <div className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
                  Nenhum usuario cadastrado neste tenant.
                </div>
              )}
              {!usersLoading &&
                users.map((user) => (
                  <UserRow
                    key={user.id}
                    user={user}
                    tenantId={tenant.id}
                    onRefresh={() => loadUsers()}
                  />
                ))}
            </>
          )}

          {activeTab === "logs" && (
            <>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Ultimos acessos (max. 50)
              </p>
              {logsLoading && (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  Carregando logs...
                </div>
              )}
              {!logsLoading && logs.length === 0 && (
                <div className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
                  Nenhum log registrado ainda.
                </div>
              )}
              {!logsLoading && logs.length > 0 && (
                <div className="space-y-1">
                  {logs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-xs hover:bg-muted/50 transition-colors"
                    >
                      <span className="w-10 shrink-0 font-mono font-bold text-muted-foreground text-[10px] uppercase">
                        {log.method}
                      </span>
                      <span
                        className={`w-8 shrink-0 font-mono font-bold ${statusColor(log.statusCode)}`}
                      >
                        {log.statusCode}
                      </span>
                      <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                        {log.module}
                      </span>
                      <span className="flex-1 truncate font-mono text-muted-foreground">
                        {log.path}
                      </span>
                      <span className="shrink-0 text-muted-foreground">
                        {log.durationMs}ms
                      </span>
                      <span className="shrink-0 text-muted-foreground/60">
                        {relativeTime(log.createdAt)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Rodape */}
        <div className="flex justify-end border-t border-border px-6 py-4">
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </div>
    </div>
  );
}
