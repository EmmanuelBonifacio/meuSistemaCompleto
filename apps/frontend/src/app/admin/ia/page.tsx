"use client";

import { useEffect, useMemo, useState } from "react";
import { Play, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ChatIa } from "@/components/ia/ChatIa";
import { ADMIN_TOKEN_KEY } from "@/services/api";
import { decodeJwt, formatDateTime } from "@/lib/utils";

type AdminRole = "admin" | "superadmin";

interface AdminJwtPayload {
  sub: string;
  role: "user" | AdminRole;
}

interface Workflow {
  id: string;
  name: string;
  active: boolean;
}

interface Execution {
  id: string;
  workflowName: string;
  workflowId: string;
  status: string;
  startedAt: string;
  stoppedAt?: string;
  durationMs?: number;
  estimatedTokens: number;
}

type ToastType = "success" | "error";

interface UiToast {
  message: string;
  type: ToastType;
}

interface N8nWorkflowItem {
  id: string | number;
  name?: string;
  active?: boolean;
}

interface N8nExecutionItem {
  id: string | number;
  status?: string;
  startedAt?: string;
  stoppedAt?: string;
  finished?: boolean;
  workflowId?: string | number;
  workflowData?: {
    id?: string | number;
    name?: string;
  };
  data?: unknown;
}

interface AdminIaApiResponse {
  data?: unknown[];
  warning?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseWorkflows(payload: unknown): Workflow[] {
  if (!isRecord(payload) || !Array.isArray(payload.data)) return [];

  return payload.data
    .map((item): Workflow | null => {
      if (!isRecord(item) || (!item.id && item.id !== 0)) return null;
      const id = String(item.id);
      const name = typeof item.name === "string" ? item.name : `Workflow ${id}`;
      const active = typeof item.active === "boolean" ? item.active : false;
      return { id, name, active };
    })
    .filter((workflow): workflow is Workflow => workflow !== null);
}

function countTokenLikeValues(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  if (Array.isArray(value)) {
    return value.reduce((acc, current) => acc + countTokenLikeValues(current), 0);
  }

  if (!isRecord(value)) return 0;

  return Object.entries(value).reduce((acc, [key, current]) => {
    const isTokenField = key.toLowerCase().includes("token");
    if (isTokenField && typeof current === "number" && Number.isFinite(current)) {
      return acc + current;
    }
    return acc + countTokenLikeValues(current);
  }, 0);
}

function getExecutionStatus(execution: Record<string, unknown>): string {
  if (typeof execution.status === "string" && execution.status.trim()) {
    return execution.status.toLowerCase();
  }

  if (execution.finished === true) return "success";
  if (execution.finished === false) return "running";
  return "unknown";
}

function parseExecutions(payload: unknown): Execution[] {
  if (!isRecord(payload) || !Array.isArray(payload.data)) return [];

  return payload.data
    .map((item): Execution | null => {
      if (!isRecord(item) || (!item.id && item.id !== 0)) return null;

      const id = String(item.id);
      const workflowId =
        item.workflowId !== undefined ? String(item.workflowId) : "desconhecido";
      const workflowName =
        isRecord(item.workflowData) && typeof item.workflowData.name === "string"
          ? item.workflowData.name
          : `Workflow ${workflowId}`;

      const startedAt =
        typeof item.startedAt === "string"
          ? item.startedAt
          : new Date().toISOString();
      const stoppedAt = typeof item.stoppedAt === "string" ? item.stoppedAt : undefined;

      const durationMs =
        stoppedAt && startedAt
          ? Math.max(new Date(stoppedAt).getTime() - new Date(startedAt).getTime(), 0)
          : undefined;

      return {
        id,
        workflowName,
        workflowId,
        status: getExecutionStatus(item),
        startedAt,
        stoppedAt,
        durationMs,
        estimatedTokens: Math.floor(countTokenLikeValues(item.data)),
      };
    })
    .filter((execution): execution is Execution => execution !== null);
}

export default function AdminIaPage() {
  const router = useRouter();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [toast, setToast] = useState<UiToast | null>(null);

  const [runDialogOpen, setRunDialogOpen] = useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [jsonInput, setJsonInput] = useState("{}");

  useEffect(() => {
    const timer = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(timer);
  }, [toast]);

  const metrics = useMemo(() => {
    const today = new Date();
    const sameDayExecutions = executions.filter((execution) => {
      const date = new Date(execution.startedAt);
      return (
        date.getDate() === today.getDate() &&
        date.getMonth() === today.getMonth() &&
        date.getFullYear() === today.getFullYear()
      );
    });

    const callsToday = sameDayExecutions.length;
    const tokens = sameDayExecutions.reduce(
      (acc, execution) => acc + execution.estimatedTokens,
      0,
    );
    const errors = sameDayExecutions.filter((execution) =>
      ["error", "failed", "crashed"].includes(execution.status),
    ).length;

    return { callsToday, tokens, errors };
  }, [executions]);

  function showToast(message: string, type: ToastType) {
    setToast({ message, type });
  }

  function getAuthHeader(): Record<string, string> {
    if (typeof window === "undefined") return {};
    const token = localStorage.getItem(ADMIN_TOKEN_KEY);
    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
  }

  async function readResponseJson(response: Response): Promise<unknown> {
    try {
      return (await response.json()) as unknown;
    } catch {
      return null;
    }
  }

function extractApiErrorMessage(payload: unknown): string {
  if (isRecord(payload) && typeof payload.error === "string" && payload.error.trim()) {
    return payload.error;
  }

  if (
    isRecord(payload) &&
    typeof payload.message === "string" &&
    payload.message.trim()
  ) {
    return payload.message;
  }

  return "Não foi possível carregar dados da IA admin.";
}

function extractApiWarningMessage(payload: unknown): string | null {
  if (!isRecord(payload) || !("warning" in payload)) {
    return null;
  }

  const warning = payload.warning;
  if (isRecord(warning) && typeof warning.error === "string") {
    return warning.error;
  }

  if (typeof warning === "string") {
    return warning;
  }

  return null;
}

  async function fetchData() {
    setLoading(true);
    try {
      const headers = getAuthHeader();
      const [workflowRes, executionRes] = await Promise.all([
        fetch("/api/admin/ia", { headers, cache: "no-store" }),
        fetch("/api/admin/ia?executions=true", { headers, cache: "no-store" }),
      ]);

      const workflowPayload = (await workflowRes.json()) as AdminIaApiResponse;
      const executionPayload = (await executionRes.json()) as AdminIaApiResponse;

      if (!workflowRes.ok || !executionRes.ok) {
        const message = !workflowRes.ok
          ? extractApiErrorMessage(workflowPayload)
          : extractApiErrorMessage(executionPayload);
        throw new Error(message);
      }

      setWorkflows(parseWorkflows(workflowPayload));
      setExecutions(parseExecutions(executionPayload));

      const warningMessage =
        extractApiWarningMessage(workflowPayload) ??
        extractApiWarningMessage(executionPayload);
      if (warningMessage) {
        showToast(warningMessage, "error");
      }
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Erro ao carregar dados.",
        "error",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    const token = localStorage.getItem(ADMIN_TOKEN_KEY);
    if (!token) {
      router.replace("/admin/login");
      return;
    }
    const payload = decodeJwt<AdminJwtPayload>(token);
    if (!payload || (payload.role !== "admin" && payload.role !== "superadmin")) {
      showToast("Acesso restrito ao administrador.", "error");
      router.replace("/admin");
      return;
    }
    fetchData();
  }, [router]);

  async function handleToggle(workflow: Workflow, active: boolean) {
    setActionLoadingId(workflow.id);
    try {
      const response = await fetch("/api/admin/ia", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify({
          action: "toggle",
          workflowId: workflow.id,
          input: { active },
        }),
      });

      if (!response.ok) {
        const payload = await readResponseJson(response);
        const message =
          isRecord(payload) && typeof payload.error === "string"
            ? payload.error
            : "Falha ao atualizar workflow.";
        throw new Error(message);
      }

      setWorkflows((current) =>
        current.map((item) =>
          item.id === workflow.id ? { ...item, active } : item,
        ),
      );
      showToast(`Workflow ${active ? "ativado" : "desativado"} com sucesso.`, "success");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Erro ao alternar workflow.",
        "error",
      );
    } finally {
      setActionLoadingId(null);
    }
  }

  function openRunDialog(workflow: Workflow) {
    setSelectedWorkflow(workflow);
    setJsonInput("{}");
    setRunDialogOpen(true);
  }

  async function handleRunWorkflow() {
    if (!selectedWorkflow) return;

    setActionLoadingId(selectedWorkflow.id);
    try {
      const parsedInput: unknown = JSON.parse(jsonInput || "{}");
      if (!isRecord(parsedInput)) {
        throw new Error("O input precisa ser um objeto JSON.");
      }

      const response = await fetch("/api/admin/ia", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify({
          action: "run",
          workflowId: selectedWorkflow.id,
          input: parsedInput,
        }),
      });

      if (!response.ok) {
        const payload = await readResponseJson(response);
        const message =
          isRecord(payload) && typeof payload.error === "string"
            ? payload.error
            : "Falha ao executar workflow.";
        throw new Error(message);
      }

      setRunDialogOpen(false);
      showToast("Execução iniciada com sucesso.", "success");
      await fetchData();
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Erro ao executar workflow.",
        "error",
      );
    } finally {
      setActionLoadingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">IA Admin</h1>
          <p className="text-muted-foreground mt-1">
            Monitore workflows e execuções do n8n.
          </p>
        </div>
        <Button variant="outline" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Chamadas Hoje
            </CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold">{metrics.callsToday}</CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Tokens</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold">{metrics.tokens}</CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Erros</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold">{metrics.errors}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Chat IA</CardTitle>
          <CardDescription>
            Converse com a IA via webhook configurado no n8n.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChatIa />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Workflows</CardTitle>
          <CardDescription>
            Ative/desative e execute testes dos workflows cadastrados.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Nome
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Status
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Ativar/Desativar
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Testar
                </th>
              </tr>
            </thead>
            <tbody>
              {workflows.map((workflow) => (
                <tr key={workflow.id} className="border-b hover:bg-muted/20">
                  <td className="px-4 py-3 font-medium">{workflow.name}</td>
                  <td className="px-4 py-3">
                    <Badge variant={workflow.active ? "success" : "muted"}>
                      {workflow.active ? "Ativo" : "Inativo"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={workflow.active}
                        disabled={actionLoadingId === workflow.id}
                        onChange={(event) =>
                          handleToggle(workflow, event.target.checked)
                        }
                      />
                      <span className="text-xs text-muted-foreground">
                        {workflow.active ? "Desativar" : "Ativar"}
                      </span>
                    </label>
                  </td>
                  <td className="px-4 py-3">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openRunDialog(workflow)}
                    >
                      <Play className="h-4 w-4" />
                      Testar
                    </Button>
                  </td>
                </tr>
              ))}
              {!loading && workflows.length === 0 && (
                <tr>
                  <td className="px-4 py-4 text-muted-foreground" colSpan={4}>
                    Nenhum workflow encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Execuções Recentes</CardTitle>
          <CardDescription>Últimas 20 execuções retornadas pelo n8n.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Data
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Workflow
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Status
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Duração
                </th>
              </tr>
            </thead>
            <tbody>
              {executions.map((execution) => (
                <tr key={execution.id} className="border-b hover:bg-muted/20">
                  <td className="px-4 py-3">{formatDateTime(execution.startedAt)}</td>
                  <td className="px-4 py-3">{execution.workflowName}</td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={
                        execution.status === "success"
                          ? "success"
                          : execution.status === "error" || execution.status === "failed"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {execution.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    {execution.durationMs !== undefined
                      ? `${Math.round(execution.durationMs / 1000)}s`
                      : "—"}
                  </td>
                </tr>
              ))}
              {!loading && executions.length === 0 && (
                <tr>
                  <td className="px-4 py-4 text-muted-foreground" colSpan={4}>
                    Nenhuma execução encontrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={runDialogOpen} onOpenChange={setRunDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Testar workflow</DialogTitle>
            <DialogDescription>
              Envie um input JSON para: {selectedWorkflow?.name ?? "workflow"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Input value={selectedWorkflow?.id ?? ""} readOnly />
            <textarea
              className="min-h-40 w-full rounded-lg border border-input bg-background p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={jsonInput}
              onChange={(event) => setJsonInput(event.target.value)}
              placeholder='{"mensagem":"teste"}'
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRunDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleRunWorkflow}
              disabled={!selectedWorkflow || actionLoadingId === selectedWorkflow.id}
            >
              Executar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {toast && (
        <div className="fixed bottom-4 right-4 z-50">
          <div
            className={`rounded-lg px-4 py-3 text-sm text-white shadow-lg ${
              toast.type === "success" ? "bg-emerald-600" : "bg-destructive"
            }`}
          >
            {toast.message}
          </div>
        </div>
      )}
    </div>
  );
}
