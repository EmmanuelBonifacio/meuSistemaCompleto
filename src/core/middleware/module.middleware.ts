// =============================================================================
// src/core/middleware/module.middleware.ts
// =============================================================================
// O QUE FAZ:
//   É o "controlador de acesso por funcionalidade". Enquanto o tenantMiddleware
//   responde "quem é você?", este middleware responde "você tem permissão
//   para usar ESTE módulo específico?".
//
// EXEMPLO PRÁTICO:
//   O tenant "Padaria do João" assinou o plano básico (apenas Estoque).
//   Se o João tentar acessar GET /financeiro/relatorios, este middleware
//   verifica a tabela `tenant_modules` e retorna 403: módulo não ativo.
//   Se o João acessar GET /estoque/produtos, o módulo está ativo → prossegue.
//
// PADRÃO DE DESIGN: FACTORY FUNCTION
//   Esta não é uma função de middleware direta como o tenantMiddleware.
//   É uma FÁBRICA: uma função que CRIA e RETORNA um middleware configurado.
//   Isso permite reutilizar a mesma lógica para qualquer módulo:
//
//   requireModule('estoque')    → retorna um middleware para o módulo de estoque
//   requireModule('financeiro') → retorna um middleware para o módulo financeiro
//   requireModule('rh')         → retorna um middleware para o módulo de RH
//
//   Adicionar um novo módulo ao sistema NÃO requer nenhuma alteração aqui.
//   Basta chamar requireModule('novo_modulo') na rota e cadastrar na tabela.
//
// COMO USAR NAS ROTAS:
//   import { tenantMiddleware } from '@core/middleware/tenant.middleware'
//   import { requireModule } from '@core/middleware/module.middleware'
//
//   // Os preHandlers rodam em ORDEM. Primeiro identifica o tenant, depois
//   // verifica se o módulo está ativo para aquele tenant.
//   fastify.get('/produtos', {
//     preHandler: [tenantMiddleware, requireModule('estoque')]
//   }, handler)
//
// ONDE ELE ENTRA NO FLUXO?
//   Request → [JWT Plugin] → [tenantMiddleware] → [requireModule('x')] → Handler
//                                                   ↑ este arquivo cuida desta parte ↑
// =============================================================================

import { FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../database/prisma";

// =============================================================================
// TIPO: FastifyPreHandlerHook
// =============================================================================
// Define explicitamente o tipo do que nossa factory function retorna.
// Isto é boa prática de TypeScript: documentar contratos via tipos.
// =============================================================================
type FastifyPreHandlerHook = (
  request: FastifyRequest,
  reply: FastifyReply,
) => Promise<void>;

// =============================================================================
// FUNÇÃO PRINCIPAL: requireModule (Factory Function)
// =============================================================================
// O QUE FAZ:
//   Recebe o nome de um módulo e retorna uma função de middleware que verifica
//   se aquele módulo está ativo para o tenant da requisição.
//
// PARÂMETRO:
//   @param moduleName - O nome do módulo como cadastrado na tabela `modules`.
//                       Ex: 'estoque', 'financeiro', 'rh', 'vendas'
//
// RETORNO:
//   Uma função com a assinatura de preHandler do Fastify.
//   Esta função captura (via closure) o `moduleName` do parâmetro acima.
//
// O QUE É UMA CLOSURE?
//   A função retornada "lembra" do valor de `moduleName` mesmo depois
//   que requireModule() terminou de executar. Isso é uma closure em JavaScript.
//   Cada chamada de requireModule('x') cria uma nova função independente.
// =============================================================================
export function requireModule(moduleName: string): FastifyPreHandlerHook {
  // Retorna a função de middleware configurada para o `moduleName` específico.
  // Esta função será chamada pelo Fastify a cada requisição na rota protegida.
  return async function checkModuleAccess(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    // -------------------------------------------------------------------------
    // GUARDA DE SEGURANÇA: Garante que o tenantMiddleware rodou antes
    // -------------------------------------------------------------------------
    // O QUE FAZ:
    //   Verifica se `request.tenant` foi preenchido pelo tenantMiddleware.
    //   Se não foi, significa que o devedor configurou mal as rotas (esqueceu
    //   de adicionar o tenantMiddleware antes deste).
    //
    // POR QUE VERIFICAR EXPLICITAMENTE?
    //   Fail-fast: é melhor errar cedo com uma mensagem clara do que deixar
    //   o código continuar e falhar de forma confusa mais adiante.
    // -------------------------------------------------------------------------
    if (!request.tenant) {
      // Este erro é uma falha do DESENVOLVEDOR, não do usuário.
      // Em produção, este cenário não deveria ocorrer se as rotas estiverem
      // configuradas corretamente.
      request.log.error(
        `[Módulo] ❌ requireModule('${moduleName}') chamado sem tenantMiddleware. ` +
          `Adicione tenantMiddleware antes de requireModule() nos preHandlers da rota.`,
      );
      return reply.status(500).send({
        statusCode: 500,
        error: "Erro de Configuração",
        message: "Erro interno de configuração do servidor.",
      });
    }

    // -------------------------------------------------------------------------
    // CONSULTA: Verifica a ativação do módulo para este tenant
    // -------------------------------------------------------------------------
    // O QUE FAZ:
    //   Busca na tabela `tenant_modules` (schema public) um registro que:
    //   1. Pertença ao tenant atual (tenantId = request.tenant.id)
    //   2. Seja para o módulo solicitado (module.name = moduleName)
    //   3. Esteja ativo (isEnabled = true)
    //
    //   Usamos `findFirst` com `select: { id: true }` por performance:
    //   - Não precisamos do registro completo, apenas saber se existe
    //   - SELECT apenas o 'id' é o mínimo possível de dados trafegados
    //
    // POR QUE NÃO FAZER JOIN MANUAL?
    //   O Prisma faz o JOIN automaticamente quando usamos `module: { name: ... }`.
    //   Internamente, o Prisma gera:
    //   SELECT tm.id FROM tenant_modules tm
    //   JOIN modules m ON tm.module_id = m.id
    //   WHERE tm.tenant_id = $1 AND m.name = $2 AND tm.is_enabled = true
    //   LIMIT 1
    // -------------------------------------------------------------------------
    const activeModule = await prisma.tenantModule.findFirst({
      where: {
        tenantId: request.tenant.id,
        module: { name: moduleName },
        isEnabled: true,
      },
      select: { id: true }, // Buscamos apenas o ID para verificar existência
    });

    // -------------------------------------------------------------------------
    // DECISÃO DE ACESSO
    // -------------------------------------------------------------------------
    if (!activeModule) {
      // O módulo não está ativo para este tenant.
      // Retornamos 403 (Forbidden) em vez de 404 (Not Found) porque:
      // - 404 sugere que o recurso não existe no sistema
      // - 403 indica que o recurso existe, mas o acesso é negado
      // Isso é correto: o módulo existe, mas não está disponível para este plano.
      request.log.warn(
        `[Módulo] 🚫 Acesso negado: tenant "${request.tenant.slug}" ` +
          `tentou acessar módulo "${moduleName}" (não ativo).`,
      );

      return reply.status(403).send({
        statusCode: 403,
        error: "Acesso Negado",
        message:
          `O módulo "${moduleName}" não está disponível no seu plano atual. ` +
          `Entre em contato com o suporte para ativá-lo.`,
      });
    }

    // Módulo ativo! A requisição pode prosseguir para o handler.
    request.log.info(
      `[Módulo] ✅ Acesso permitido: tenant "${request.tenant.slug}" → módulo "${moduleName}"`,
    );
    // Não chamamos reply.send() → o Fastify continua para o próximo handler.
  };
}
