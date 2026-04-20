"use client";

import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TOKEN_KEY } from "@/services/api";

type ChatRole = "user" | "assistant";

interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseAssistantText(payload: unknown): string {
  if (typeof payload === "string") return payload;
  if (!isRecord(payload)) return "Resposta recebida.";

  const answerKeys = ["resposta", "message", "mensagem", "output", "text"];
  for (const key of answerKeys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  return JSON.stringify(payload, null, 2);
}

export function ChatIa() {
  const [mensagem, setMensagem] = useState("");
  const [loading, setLoading] = useState(false);
  const [historico, setHistorico] = useState<ChatMessage[]>([]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!mensagem.trim() || loading) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      text: mensagem.trim(),
    };

    setHistorico((prev) => [...prev, userMessage]);
    setMensagem("");
    setLoading(true);

    try {
      const token =
        typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch("/api/ia", {
        method: "POST",
        headers,
        body: JSON.stringify({ mensagem: userMessage.text }),
      });

      const payload: unknown = await response.json();
      if (!response.ok) {
        const errorMessage =
          isRecord(payload) && typeof payload.error === "string"
            ? payload.error
            : "Erro ao consultar IA.";
        throw new Error(errorMessage);
      }

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        text: parseAssistantText(payload),
      };
      setHistorico((prev) => [...prev, assistantMessage]);
    } catch (error) {
      const fallbackMessage =
        error instanceof Error ? error.message : "Falha inesperada.";
      setHistorico((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: `Erro: ${fallbackMessage}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="max-h-80 space-y-2 overflow-y-auto rounded-lg border p-3">
        {historico.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Comece enviando uma mensagem para a IA.
          </p>
        )}

        {historico.map((item) => (
          <div
            key={item.id}
            className={`rounded-lg px-3 py-2 text-sm ${
              item.role === "user"
                ? "ml-auto w-fit max-w-[85%] bg-primary text-primary-foreground"
                : "mr-auto w-fit max-w-[85%] bg-muted text-foreground"
            }`}
          >
            {item.text}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input
          value={mensagem}
          onChange={(event) => setMensagem(event.target.value)}
          placeholder="Digite sua mensagem..."
          disabled={loading}
        />
        <Button type="submit" isLoading={loading}>
          Enviar
        </Button>
      </form>
    </div>
  );
}
