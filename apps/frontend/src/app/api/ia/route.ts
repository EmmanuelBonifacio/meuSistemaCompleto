import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

interface IaRequestBody {
  mensagem: string;
}

function isIaRequestBody(value: unknown): value is IaRequestBody {
  return (
    typeof value === "object" &&
    value !== null &&
    "mensagem" in value &&
    typeof value.mensagem === "string"
  );
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  try {
    const body: unknown = await request.json();
    if (!isIaRequestBody(body) || !body.mensagem.trim()) {
      return NextResponse.json(
        { error: "Payload inválido. Envie { mensagem }." },
        { status: 400 },
      );
    }

    const provider = (process.env.IA_PROVIDER ?? "n8n").toLowerCase();

    if (provider === "ollama") {
      const ollamaBaseUrl = process.env.OLLAMA_BASE_URL;
      const ollamaModel = process.env.OLLAMA_MODEL;
      if (!ollamaBaseUrl || !ollamaModel) {
        return NextResponse.json(
          {
            error:
              "Variáveis OLLAMA_BASE_URL/OLLAMA_MODEL não configuradas para IA_PROVIDER=ollama.",
          },
          { status: 500 },
        );
      }

      const response = await fetch(`${ollamaBaseUrl.replace(/\/$/, "")}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: ollamaModel,
          stream: false,
          prompt: body.mensagem.trim(),
        }),
      });

      const contentType = response.headers.get("content-type") ?? "";
      const payload: unknown = contentType.includes("application/json")
        ? await response.json()
        : { raw: await response.text() };

      if (!response.ok) {
        return NextResponse.json(
          {
            error: "Falha ao consultar Ollama.",
            details: payload,
          },
          { status: response.status },
        );
      }

      const message =
        typeof payload === "object" &&
        payload !== null &&
        "response" in payload &&
        typeof (payload as Record<string, unknown>).response === "string"
          ? (payload as Record<string, unknown>).response
          : payload;

      return NextResponse.json({ resposta: message });
    }

    const webhookUrl = process.env.N8N_WEBHOOK_URL;
    const n8nSecret = process.env.N8N_SECRET;

    if (!webhookUrl || !n8nSecret) {
      return NextResponse.json(
        { error: "Variáveis N8N_WEBHOOK_URL/N8N_SECRET não configuradas." },
        { status: 500 },
      );
    }

    const n8nResponse = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Secret": n8nSecret,
      },
      body: JSON.stringify({
        mensagem: body.mensagem.trim(),
        userId: session.user.id,
      }),
    });

    const contentType = n8nResponse.headers.get("content-type") ?? "";
    const responseData: unknown = contentType.includes("application/json")
      ? await n8nResponse.json()
      : { raw: await n8nResponse.text() };

    if (!n8nResponse.ok) {
      return NextResponse.json(
        {
          error: "Falha ao chamar webhook do n8n.",
          details: responseData,
        },
        { status: n8nResponse.status },
      );
    }

    return NextResponse.json(responseData);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro interno inesperado.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
