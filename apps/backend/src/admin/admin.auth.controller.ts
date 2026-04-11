// =============================================================================
// src/admin/admin.auth.controller.ts
// =============================================================================
// O QUE FAZ:
//   Handler HTTP para o login do painel administrativo.
//   Autentica o usuário contra a tabela public.admin_users usando bcrypt.
//   Retorna um JWT com role "superadmin" para acesso ao painel /admin.
//
// POR QUE ARQUIVO SEPARADO E NÃO NO admin.controller.ts?
//   Separação de responsabilidades (SRP do SOLID):
//   - admin.controller.ts     → operações de gestão de tenants (requer auth)
//   - admin.auth.controller.ts → autenticação do admin (rota pública, sem auth)
//   Misturá-los tornaria impossível aplicar middlewares diferentes.
//
// DIFERENÇA DO auth.controller.ts (tenant):
//   - auth.controller.ts usa tabela `users` DENTRO do schema do tenant
//   - Este arquivo usa tabela `public.admin_users` (schema global do Prisma)
//   - Admin não pertence a nenhum tenant — tem visão cross-tenant
//
// SEGURANÇA — BOAS PRÁTICAS APLICADAS:
//   ✅ Mensagem de erro genérica ("Credenciais inválidas") — sem user enumeration
//   ✅ bcrypt.compare roda MESMO se usuário não existir — previne timing attack
//   ✅ Token com role "superadmin" (validado pelo adminMiddleware)
//   ✅ Expiração de 8h — adequada para sessão de trabalho administrativa
// =============================================================================

import { FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { prisma } from "../core/database/prisma";
import bcrypt from "bcrypt";

// =============================================================================
// SCHEMA: AdminLoginSchema
// =============================================================================
// Validação Zod para o corpo da requisição POST /admin/login.
// Simples e direto: email normalizado + senha não vazia.
// =============================================================================
const AdminLoginSchema = z.object({
  email: z
    .string({ required_error: "E-mail é obrigatório" })
    .email("E-mail inválido")
    .toLowerCase()
    .trim(),

  password: z
    .string({ required_error: "Senha é obrigatória" })
    .min(1, "Senha não pode ser vazia"),
});

// =============================================================================
// HANDLER: adminLogin
// POST /admin/login
// =============================================================================
// FLUXO COMPLETO:
//   1. Valida body (email + password) com Zod
//   2. Busca o AdminUser pelo email no schema PUBLIC (via Prisma)
//   3. Verifica a senha com bcrypt.compare (sempre roda, mesmo se user=null)
//   4. Em caso de falha: retorna 401 genérico (sem revelar o motivo)
//   5. Em caso de sucesso: gera JWT com role "superadmin" (8h de expiração)
//   6. Retorna o access_token para o frontend armazenar no localStorage
// =============================================================================
export async function adminLogin(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  // ---------------------------------------------------------------------------
  // PASSO 1: Validação do input com Zod
  // ---------------------------------------------------------------------------
  const parsed = AdminLoginSchema.safeParse(request.body);

  if (!parsed.success) {
    return reply.status(400).send({
      statusCode: 400,
      error: "Dados inválidos",
      message: parsed.error.issues[0]?.message ?? "Dados inválidos",
    });
  }

  const { email, password } = parsed.data;

  // ---------------------------------------------------------------------------
  // MENSAGEM DE ERRO GENÉRICA
  // ---------------------------------------------------------------------------
  // Por que "Credenciais inválidas" e não "Usuário não encontrado"?
  // Se o erro for diferente para usuário inexistente vs senha errada,
  // um atacante consegue confirmar se um e-mail existe no sistema
  // (user enumeration attack). Uma mensagem única para todos os casos previne isso.
  // ---------------------------------------------------------------------------
  const GENERIC_ERROR = {
    statusCode: 401,
    error: "Não Autorizado",
    message: "Credenciais inválidas",
  };

  // ---------------------------------------------------------------------------
  // PASSO 2: Busca o admin pelo e-mail
  // ---------------------------------------------------------------------------
  // Prisma acessa public.admin_users diretamente (schema global).
  // Diferente dos usuários de tenant que ficam em schemas isolados.
  // ---------------------------------------------------------------------------
  const adminUser = await prisma.adminUser.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      passwordHash: true,
    },
  });

  // ---------------------------------------------------------------------------
  // PASSO 3: Verificação de senha com bcrypt
  // ---------------------------------------------------------------------------
  // IMPORTANTE: chamamos bcrypt.compare() SEMPRE — mesmo se o usuário não
  // existir. Quando user=null, comparamos contra uma string inválida.
  // Isso garante que o tempo de resposta seja similar em ambos os casos,
  // tornando inviável descobrir se um e-mail existe via diferença de tempo
  // (timing attack / side-channel attack).
  //
  // O bcrypt.compare retorna false (não lança erro) para hashes inválidos.
  // ---------------------------------------------------------------------------
  const FAKE_HASH_FOR_TIMING_PROTECTION =
    "HASH_INVALIDO_PARA_EVITAR_TIMING_ATTACK";

  const passwordIsValid = await bcrypt.compare(
    password,
    adminUser?.passwordHash ?? FAKE_HASH_FOR_TIMING_PROTECTION,
  );

  if (!adminUser || !passwordIsValid) {
    return reply.status(401).send(GENERIC_ERROR);
  }

  // ---------------------------------------------------------------------------
  // PASSO 4: Geração do JWT com role "superadmin"
  // ---------------------------------------------------------------------------
  // O token carrega o role "superadmin" que o adminMiddleware verifica.
  // Expiração de 8h é adequada para uma sessão de trabalho administrativa.
  //
  // POR QUE tenantId: "system"?
  //   O payload do JWT exige o campo tenantId (definido em fastify.d.ts).
  //   Admins não pertencem a nenhum tenant, então usamos "system" como
  //   valor semântico para indicar que é um token de sistema.
  //   O adminMiddleware ignora tenantId — só verifica o role.
  // ---------------------------------------------------------------------------
  const access_token = request.server.jwt.sign(
    {
      sub: adminUser.id,
      tenantId: "system",
      role: "superadmin",
    },
    { expiresIn: "8h" },
  );

  return reply.status(200).send({
    access_token,
    token_type: "Bearer",
    expires_in: 28800, // 8 horas em segundos
    usuario: {
      id: adminUser.id,
      email: adminUser.email,
      name: adminUser.name,
      role: adminUser.role,
    },
  });
}
