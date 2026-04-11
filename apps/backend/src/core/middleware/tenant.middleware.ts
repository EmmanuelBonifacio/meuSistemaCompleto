// =============================================================================
// src/core/middleware/tenant.middleware.ts
// =============================================================================
// O QUE FAZ:
//   É o "porteiro" do sistema. Intercepta TODA requisição a rotas protegidas
//   e responde duas perguntas fundamentais:
//   1. "Você tem um token JWT válido?"
//   2. "O cliente (tenant) referenciado neste token existe e está ativo?"
//
//   Se ambas as respostas forem SIM, a requisição prossegue com
//   `request.tenant` preenchido com os dados do cliente.
//   Se qualquer resposta for NÃO, a requisição é bloqueada com 401/403.
//
// ONDE ELE ENTRA NO FLUXO?
//   Request → [JWT Plugin] → [tenantMiddleware] → [moduleMiddleware] → Handler
//   ↑ este arquivo cuida desta parte ↑
//
// POR QUE SEPARAR EM UM ARQUIVO PRÓPRIO?
//   Seguindo o princípio SOLID de Responsabilidade Única (SRP):
//   Este arquivo tem UMA responsabilidade: identificar o tenant.
//   Autenticação (verificar JWT) e autorização de módulos ficam em arquivos
//   separados. Isso facilita manutenção e testes unitários independentes.
//
// COMO ISSO AJUDA NO REAPROVEITAMENTO?
//   Este middleware pode ser aplicado a qualquer rota com uma única linha:
//   { preHandler: [tenantMiddleware] }
//   Independentemente do módulo (Estoque, Financeiro, RH), todas as rotas
//   de tenant passam pelo mesmo porteiro.
// =============================================================================

import { FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../database/prisma";

// =============================================================================
// FUNÇÃO PRINCIPAL: tenantMiddleware
// =============================================================================
// ASSINATURA: (request, reply) => Promise<void>
//
// Esta é a assinatura padrão de um hook 'preHandler' no Fastify.
// O Fastify chama esta função ANTES de executar o handler da rota.
// Se a função não chamar reply.send() ou lançar um erro, a requisição
// continua para o próximo hook ou para o handler da rota.
// =============================================================================
export async function tenantMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  // ---------------------------------------------------------------------------
  // PASSO 1: Verificação do JWT
  // ---------------------------------------------------------------------------
  // O QUE FAZ:
  //   `request.jwtVerify()` é um método injetado pelo plugin @fastify/jwt.
  //   Ele faz TRÊS coisas em uma chamada:
  //   a) Extrai o token do header: Authorization: Bearer <token>
  //   b) Valida a ASSINATURA do token com o JWT_SECRET
  //   c) Verifica se o token não expirou (campo 'exp' do payload)
  //
  // POR QUE USAR request.jwtVerify() E NÃO VERIFICAR MANUALMENTE?
  //   O @fastify/jwt já trata todos os casos de erro (token ausente, inválido,
  //   expirado) e lança exceções padronizadas. Menos código = menos bugs.
  //   Se a verificação falhar, o Fastify retorna automaticamente 401.
  //
  // SE TIVER SUCESSO:
  //   O payload decodificado fica disponível em `request.user`
  //   (tipado pela nossa declaração em fastify.d.ts)
  // ---------------------------------------------------------------------------
  try {
    await request.jwtVerify();
  } catch (error) {
    // O @fastify/jwt já define a resposta de erro adequada (401),
    // mas relançamos para Fastify tratar com seu sistema de erros padronizado.
    return reply.status(401).send({
      statusCode: 401,
      error: "Não Autorizado",
      message: "Token de acesso inválido, ausente ou expirado.",
    });
  }

  // ---------------------------------------------------------------------------
  // PASSO 2: Extração do tenantId do payload JWT
  // ---------------------------------------------------------------------------
  // O QUE FAZ:
  //   Lemos o `tenantId` que foi inserido no JWT no momento do login.
  //   Este ID aponta para uma linha na tabela `public.tenants`.
  //
  // POR QUE O tenantId FICA NO JWT?
  //   Alternativa 1: Guardar o tenant no JWT → rápido, mas o token fica maior
  //   Alternativa 2: Enviar o tenantId no header → fácil de forjar
  //   Alternativa 3: Subdomínio → complexo de configurar
  //
  //   A escolha de guardar APENAS o ID no JWT é um equilíbrio: o token é
  //   pequeno, o cliente não pode forjar o tenantId (está assinado pelo
  //   servidor), e buscamos os detalhes atualizados no banco a cada request.
  //   Isso permite, por exemplo, suspender um tenant imediatamente sem
  //   esperar o JWT expirar.
  // ---------------------------------------------------------------------------
  const { tenantId } = request.user;

  if (!tenantId) {
    return reply.status(401).send({
      statusCode: 401,
      error: "Não Autorizado",
      message: "Token malformado: identificação do cliente ausente.",
    });
  }

  // ---------------------------------------------------------------------------
  // PASSO 3: Busca do Tenant no Banco de Dados
  // ---------------------------------------------------------------------------
  // O QUE FAZ:
  //   Consulta a tabela `public.tenants` para obter os dados completos do
  //   cliente, especialmente o `schemaName` (nome do schema PostgreSQL).
  //
  // POR QUE SELECT ESPECÍFICO E NÃO findUnique SEM SELECT?
  //   Seguindo o princípio do menor privilégio: buscamos APENAS os campos
  //   necessários. Se a tabela tenants ganhar campos sensíveis no futuro
  //   (como dados de pagamento), eles não virão para o request por acidente.
  //   Também é mais performático: menos dados trafegam pelo fio.
  //
  // OPORTUNIDADE DE CACHE (TODO para produção):
  //   Esta query roda a CADA requisição. Em produção, isso pode ser um
  //   gargalo. A solução é usar Redis para cachear o tenant por 5-10 minutos:
  //   const cached = await redis.get(`tenant:${tenantId}`)
  //   if (cached) { request.tenant = JSON.parse(cached); return }
  //   Por ora, mantemos simples para fins didáticos.
  // ---------------------------------------------------------------------------
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      id: true,
      name: true,
      slug: true,
      schemaName: true, // O campo MAIS IMPORTANTE: nome do schema no PostgreSQL
      isActive: true,
    },
  });

  // ---------------------------------------------------------------------------
  // PASSO 4: Validações de Negócio
  // ---------------------------------------------------------------------------

  // Cenário 1: Tenant não encontrado
  // Isso pode acontecer se: o JWT foi emitido para um tenant que foi deletado,
  // ou se o tenantId no token foi forjado (raro, pois a assinatura protege).
  if (!tenant) {
    return reply.status(404).send({
      statusCode: 404,
      error: "Não Encontrado",
      message: "Cliente não encontrado.",
    });
  }

  // Cenário 2: Tenant existe mas está suspenso
  // Permite bloquear IMEDIATAMENTE o acesso de um cliente inadimplente ou
  // suspenso, mesmo que seu JWT ainda esteja válido (não expirou).
  // Esta é uma camada de segurança além da validade do JWT.
  if (!tenant.isActive) {
    return reply.status(403).send({
      statusCode: 403,
      error: "Acesso Negado",
      message: "Esta conta está suspensa. Entre em contato com o suporte.",
    });
  }

  // ---------------------------------------------------------------------------
  // PASSO 5: Disponibiliza o Tenant no Request
  // ---------------------------------------------------------------------------
  // O QUE FAZ:
  //   Anexa os dados do tenant ao objeto `request`. A partir daqui, qualquer
  //   código que rode DEPOIS deste middleware (outros hooks, o handler da rota)
  //   pode acessar `request.tenant` com tipagem completa do TypeScript.
  //
  // POR QUE request.tenant E NÃO UMA VARIÁVEL LOCAL?
  //   No modelo de concorrência do Node.js, múltiplas requisições rodam no
  //   mesmo processo "simultaneamente" (event loop). Uma variável local de
  //   módulo seria compartilhada entre todas as requisições — um bug grave!
  //   Usando `request.tenant`, os dados ficam ISOLADOS naque objeto de
  //   requisição específico. Cada requisição tem seu próprio `request`.
  // ---------------------------------------------------------------------------
  request.tenant = {
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    schemaName: tenant.schemaName,
  };

  // Se chegamos até aqui, tudo está correto.
  // Não chamamos reply.send() — isso sinaliza ao Fastify para continuar
  // para o próximo middleware ou para o handler da rota.
  request.log.info(
    `[Tenant] ✅ Requisição autenticada para: "${tenant.name}" (schema: ${tenant.schemaName})`,
  );
}
