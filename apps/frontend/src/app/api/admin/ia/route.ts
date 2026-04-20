import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

type AdminAction = "toggle" | "run";

interface AdminIaRequestBody {
  action: AdminAction;
  workflowId: string;
  input?: Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isAdminIaRequestBody(value: unknown): value is AdminIaRequestBody {
  if (!isRecord(value)) return false;
  if ((value.action !== "toggle" && value.action !== "run") || !value.workflowId) {
    return false;
  }
  return typeof value.workflowId === "string";
}

async function getAdminSession() {
  const session = await auth();
  if (!session) {
    return { error: NextResponse.json({ error: "Não autenticado." }, { status: 401 }) };
  }

  if (session.user.role !== "admin" && session.user.role !== "superadmin") {
    return { error: NextResponse.json({ error: "Acesso negado." }, { status: 403 }) };
  }

  return { session };
}

function getN8nConfig() {
  const baseUrl = process.env.N8N_API_URL?.trim();
  const apiKey = process.env.N8N_API_KEY?.trim();

  if (!baseUrl || !apiKey) {
    return null;
  }

  return { baseUrl: baseUrl.replace(/\/$/, ""), apiKey };
}

function getN8nFriendlyErrorMessage(status: number): string | null {
  if (status === 401) {
    return "API key do n8n inválida ou expirada. Atualize N8N_API_KEY no .env.local.";
  }

  if (status === 403) {
    return "A API key do n8n não possui permissão para esta operação.";
  }

  return null;
}

async function n8nFetch(
  input: string,
  init: RequestInit = {},
): Promise<{ status: number; data: unknown }> {
  const config = getN8nConfig();
  if (!config) {
    return {
      status: 500,
      data: { error: "Variáveis N8N_API_URL/N8N_API_KEY não configuradas." },
    };
  }

  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}${input}`, {
      ...init,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-N8N-API-KEY": config.apiKey,
        Authorization: `Bearer ${config.apiKey}`,
        ...(init.headers ?? {}),
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Falha de conexão com n8n.";
    return {
      status: 503,
      data: {
        error:
          "Não foi possível conectar ao n8n. Verifique N8N_API_URL e se o serviço está online.",
        details: { message },
      },
    };
  }

  const contentType = response.headers.get("content-type") ?? "";
  const data: unknown = contentType.includes("application/json")
    ? await response.json()
    : { raw: await response.text() };

  const friendlyMessage = getN8nFriendlyErrorMessage(response.status);
  if (friendlyMessage) {
    return {
      status: response.status,
      data: {
        error: friendlyMessage,
        details: data,
      },
    };
  }

  return { status: response.status, data };
}

export async function GET(request: Request) {
  try {
    const authResult = await getAdminSession();
    if ("error" in authResult) return authResult.error;

    const { searchParams } = new URL(request.url);
    const wantsExecutions = searchParams.get("executions") === "true";

    const endpoint = wantsExecutions ? "/executions?limit=20" : "/workflows";
    const result = await n8nFetch(endpoint);
    if (result.status >= 400) {
      return NextResponse.json(
        {
          data: [],
          warning: result.data,
        },
        { status: 200 },
      );
    }

    return NextResponse.json(result.data, { status: result.status });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro interno inesperado.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const authResult = await getAdminSession();
    if ("error" in authResult) return authResult.error;

    const body: unknown = await request.json();
    if (!isAdminIaRequestBody(body)) {
      return NextResponse.json(
        { error: "Payload inválido. Use { action, workflowId, input? }." },
        { status: 400 },
      );
    }

    if (body.action === "toggle") {
      const activeValue = body.input?.active;
      const active = typeof activeValue === "boolean" ? activeValue : true;

      const result = await n8nFetch(`/workflows/${body.workflowId}`, {
        method: "PATCH",
        body: JSON.stringify({ active }),
      });

      return NextResponse.json(result.data, { status: result.status });
    }

    const result = await n8nFetch(`/workflows/${body.workflowId}/run`, {
      method: "POST",
      body: JSON.stringify(body.input ?? {}),
    });

    return NextResponse.json(result.data, { status: result.status });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro interno inesperado.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
