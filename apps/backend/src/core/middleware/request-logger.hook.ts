// =============================================================================
// src/core/middleware/request-logger.hook.ts
// =============================================================================
// O QUE FAZ:
//   Hook global do Fastify que intercepta TODAS as respostas e grava um
//   registro na tabela `request_logs` do banco de dados.
//
// POR QUE USAR onResponse E NÃO onRequest?
//   O hook `onResponse` roda APÓS a resposta ser enviada ao cliente.
//   Isso garante que temos acesso ao statusCode final e ao tempo total
//   de resposta (durationMs) sem atrasar a resposta ao usuário.
//
// COMO IDENTIFICAMOS O MÓDULO?
//   Extraímos o primeiro segmento da URL. Ex:
//   - "/estoque/produtos" → módulo "estoque"
//   - "/financeiro/transacoes" → módulo "financeiro"
//   - "/tv/devices" → módulo "tv"
//   - "/admin/tenants" → módulo "admin"
//
// SEGURANÇA:
//   Só gravamos logs de requisições autenticadas (com tenantId no JWT).
//   Rotas públicas (/health, /dev/token) são ignoradas.
// =============================================================================

import { FastifyInstance } from "fastify";
import { prisma } from "../database/prisma";

// Módulos que devem ser monitorados.
// Rotas fora desta lista são ignoradas (ex: /health, /dev/token).
const MONITORED_MODULES = new Set([
  "estoque",
  "financeiro",
  "tv",
  "admin",
  "auth",
]);

// =============================================================================
// FUNÇÃO: extractModule
// =============================================================================
// O QUE FAZ:
//   Extrai o nome do módulo a partir do caminho da URL.
//   Ex: "/estoque/produtos/123" → "estoque"
// =============================================================================
function extractModule(url: string): string | null {
  // Remove query string antes de processar
  const path = url.split("?")[0];
  // Divide por "/" e pega o primeiro segmento não vazio
  const segment = path.split("/").find((s) => s.length > 0);
  if (!segment) return null;
  return MONITORED_MODULES.has(segment) ? segment : null;
}

// =============================================================================
// FUNÇÃO: registerRequestLoggerHook
// =============================================================================
// O QUE FAZ:
//   Registra o hook `onResponse` na instância global do Fastify.
//   Deve ser chamada UMA VEZ durante a inicialização do servidor.
//
// POR QUE PASSAR A INSTÂNCIA DO FASTIFY COMO PARÂMETRO?
//   Segue o princípio de Injeção de Dependência: a função não depende de
//   um singleton global do Fastify. Isso facilita testar a função isoladamente.
// =============================================================================
export function registerRequestLoggerHook(app: FastifyInstance): void {
  app.addHook("onResponse", async (request, reply) => {
    try {
      // Identifica o módulo — ignora rotas não monitoradas
      const module = extractModule(request.url);
      if (!module) return;

      // Só loga requisições autenticadas (com tenantId no JWT)
      // request.user é populado pelo fastify-jwt após jwtVerify()
      const tenantId = (request.user as { tenantId?: string } | undefined)
        ?.tenantId;
      if (!tenantId) return;

      // Calcula duração: Fastify popula request.raw com o tempo de início
      const startTime =
        (request.raw as { startTime?: number }).startTime ?? Date.now();
      const durationMs = Date.now() - startTime;

      // Captura apenas os primeiros 500 chars do path para evitar URLs gigantes
      const path = request.url.split("?")[0].substring(0, 500);

      // Grava o log de forma assíncrona sem bloquear a resposta
      // Usamos a conexão pública (sem schema de tenant) pois request_logs fica no public
      await prisma.requestLog.create({
        data: {
          tenantId,
          module,
          method: request.method,
          path,
          statusCode: reply.statusCode,
          durationMs,
        },
      });
    } catch (err: unknown) {
      // P2003 = Foreign key constraint violation (tenant não existe no banco)
      // Ignoramos silenciosamente para não poluir os logs com token expirado/inválido
      const code = (err as { code?: string })?.code;
      if (code !== "P2003") {
        request.log.warn(
          { err },
          "request-logger: erro inesperado ao gravar log",
        );
      }
    }
  });
}
