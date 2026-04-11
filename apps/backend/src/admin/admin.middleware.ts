// =============================================================================
// src/admin/admin.middleware.ts
// =============================================================================
// O QUE FAZ:
//   É o "porteiro do andar executivo". Enquanto o tenantMiddleware verifica
//   se o token é válido e o tenant está ativo, o adminMiddleware acrescenta
//   uma camada a mais: verifica se o USUÁRIO TEM PAPEL DE ADMINISTRADOR.
//
// COMO ELE DIFERENCIA O ADMIN DE UM USUÁRIO COMUM?
//   A diferença está no campo `role` dentro do payload JWT:
//
//   Token de usuário comum:    { sub: "user-1", tenantId: "...", role: "user" }
//   Token de admin do sistema: { sub: "admin-1", role: "ADMIN" }
//                               ↑ Note: SEM tenantId (ou ignorado)
//                               O admin não pertence a UM tenant, ele gerencia TODOS.
//
//   O adminMiddleware extrai o `role` do JWT e rejeita qualquer valor
//   diferente de "ADMIN" com um 403 Forbidden.
//
// ORDEM NO PIPELINE DE REQUISIÇÃO:
//   Request → [JWT Plugin] → [adminMiddleware] → Handler Admin
//                                ↑ NÃO usa tenantMiddleware — o admin não
//                                  precisa de tenant context, ele acessa
//                                  a tabela public diretamente via Prisma.
//
// POR QUE NÃO REUTILIZAR O tenantMiddleware?
//   Seguindo o Princípio da Responsabilidade Única (SRP) do SOLID:
//   - tenantMiddleware: identifica o TENANT da requisição
//   - adminMiddleware:  verifica se o USUÁRIO é ADMIN do SISTEMA
//   São responsabilidades distintas. Misturá-las criaria um middleware
//   complexo e difícil de manter.
//
// COMO ISSO AJUDA NO REAPROVEITAMENTO?
//   Este middleware pode ser aplicado em qualquer rota admin com:
//   preHandler: [adminMiddleware]
//   Se amanhã adicionarmos um painel Super-Admin, basta criar
//   um novo middleware com role: "SUPER_ADMIN".
// =============================================================================

import { FastifyRequest, FastifyReply } from "fastify";

// =============================================================================
// CONSTANTE: ADMIN_ROLE
// =============================================================================
// Centralizar o valor da role em uma constante evita erros de digitação
// espalhados pelo código (ex: "admin" vs "ADMIN" vs "superadmin").
// Se precisarmos renomear a role, mudamos apenas aqui.
//
// POR QUE "superadmin" E NÃO "ADMIN"?
//   O frontend e o backend precisam usar o mesmo valor de role.
//   O frontend (admin/layout.tsx, admin/login/page.tsx) usa "superadmin".
//   Alinhamos o backend para usar o mesmo valor, evitando inconsistência.
// =============================================================================
const ADMIN_ROLE = "superadmin" as const;

// =============================================================================
// FUNÇÃO PRINCIPAL: adminMiddleware
// =============================================================================
// COMO FUNCIONA PASSO A PASSO:
//
// 1. Verifica se o token JWT está presente e é válido
//    (usando request.jwtVerify() do @fastify/jwt)
//
// 2. Extrai o campo `role` do payload decodificado (request.user.role)
//
// 3. Compara com a role esperada ("ADMIN")
//    - SE igual: a requisição prossegue para o handler da rota admin
//    - SE diferente: retorna 403 Forbidden com mensagem clara
//
// A SEPARAÇÃO ENTRE 401 e 403 é intencional e semanticamente correta:
//   401 Unauthorized = "Eu não sei quem você é" (token inválido/ausente)
//   403 Forbidden    = "Eu SEI quem você é, mas você NÃO PODE fazer isso"
// =============================================================================
export async function adminMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  // ---------------------------------------------------------------------------
  // PASSO 1: Verificação do JWT
  // ---------------------------------------------------------------------------
  // O QUE FAZ:
  //   Valida a assinatura e expiração do token JWT no header Authorization.
  //   Se válido, popula `request.user` com o payload decodificado.
  //   Se inválido/ausente, lança exceção → retornamos 401.
  //
  // NOTA: Este passo é idêntico ao tenantMiddleware porque ambos usam JWT.
  //   A diferença começa no PASSO 2, onde verificamos roles diferentes.
  // ---------------------------------------------------------------------------
  try {
    await request.jwtVerify();
  } catch {
    return reply.status(401).send({
      statusCode: 401,
      error: "Não Autorizado",
      message: "Token JWT ausente, inválido ou expirado.",
    });
  }

  // ---------------------------------------------------------------------------
  // PASSO 2: Verificação da Role de Administrador
  // ---------------------------------------------------------------------------
  // O QUE FAZ:
  //   `request.user` foi populado pelo jwtVerify() acima.
  //   Extraímos o campo `role` e comparamos com "ADMIN".
  //
  // POR QUE COMPARAÇÃO CASE-SENSITIVE?
  //   "admin" !== "ADMIN". Mantemos a consistência exigindo sempre maiúsculas.
  //   Isso evita tokens com "admin" minúsculo burlarem a proteção.
  //
  // CENÁRIOS DE BLOQUEIO:
  //   - role: "user"          → 403 (usuário comum de um tenant)
  //   - role: "admin_tenant"  → 403 (admin de um tenant específico, não do sistema)
  //   - role ausente no token → 403
  //   - role: "superadmin"    → ✅ prossegue
  // ---------------------------------------------------------------------------
  const userRole = request.user?.role;

  if (userRole !== ADMIN_ROLE) {
    return reply.status(403).send({
      statusCode: 403,
      error: "Acesso Negado",
      // Mensagem intencional: não revelamos quais roles existem no sistema
      // (princípio de segurança: information hiding).
      message:
        "Você não tem permissão para acessar o painel de administração. " +
        "Esta área exige credenciais de administrador do sistema.",
    });
  }

  // ---------------------------------------------------------------------------
  // PASSO 3: Requisição autorizada — prossegue para o handler
  // ---------------------------------------------------------------------------
  // Se chegou aqui, o token é válido E o usuário é ADMIN.
  // Nenhuma ação necessária: o Fastify automaticamente passa para o próximo
  // preHandler ou para o handler da rota.
  // ---------------------------------------------------------------------------
  request.log.info(
    `[Admin] ✅ Acesso admin autorizado para usuário: "${request.user.sub}"`,
  );
}
