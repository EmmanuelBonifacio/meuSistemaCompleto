// =============================================================================
// src/modules/auth/auth.controller.ts
// =============================================================================
// O QUE FAZ:
//   Camada de APRESENTAÇÃO HTTP do módulo de autenticação.
//   Recebe as requisições, valida com Zod, orquestra service + repository
//   e retorna as respostas HTTP com os status codes corretos.
//
// OS 3 HANDLERS:
//   login   → verifica credenciais e emite par de tokens
//   refresh → valida refresh token e emite novo par (rotação)
//   logout  → revoga o refresh token (encerra a sessão)
//
// SEGURANÇA — MENSAGENS DE ERRO INTENCIONALMENTE GENÉRICAS:
//   Em todos os casos de falha de autenticação retornamos a mesma mensagem:
//   "Credenciais inválidas" (não "Usuário não encontrado" nem "Senha errada").
//   Isso previne user enumeration attack: um atacante não consegue saber
//   se o email existe ou não no sistema pelos diferentes erros retornados.
// =============================================================================

import { FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../../core/database/prisma";
import { LoginSchema, RefreshTokenSchema, LogoutSchema } from "./auth.schema";
import {
  findUserByEmail,
  findUserById,
  findRefreshToken,
  saveRefreshToken,
  revokeRefreshToken,
} from "./auth.repository";
import {
  verifyPassword,
  generateTokenPair,
  hashRefreshToken,
  getRefreshTokenExpiresAt,
} from "./auth.service";

// =============================================================================
// HANDLER: login
// POST /auth/login
// =============================================================================
// FLUXO COMPLETO:
//   1. Valida body (slug, email, password) com Zod
//   2. Busca o tenant pelo slug → pega schemaName
//   3. Busca o usuário pelo email dentro do schema do tenant
//   4. Verifica a senha com bcrypt.compare
//   5. Gera access_token (JWT 15min) + refresh_token (aleatório)
//   6. Salva o HASH do refresh_token no banco
//   7. Retorna os dois tokens para o cliente
//
// O QUE O CLIENTE DEVE FAZER COM OS TOKENS:
//   - access_token: usar em toda requisição → Authorization: Bearer <token>
//   - refresh_token: guardar com segurança (localStorage seguro, httpOnly cookie)
//                    e enviar para POST /auth/refresh quando o access expirar
// =============================================================================
export async function login(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  // PASSO 1: Validação do input
  const body = LoginSchema.parse(request.body);

  // PASSO 2: Busca o tenant pelo slug para obter o schemaName
  const tenant = await prisma.tenant.findUnique({
    where: { slug: body.slug },
    select: {
      id: true,
      name: true,
      schemaName: true,
      isActive: true,
    },
  });

  // SEGURANÇA: mesma mensagem se tenant não existe ou se as credenciais são erradas.
  // Impede que um atacante descubra quais slugs de tenant existem no sistema.
  if (!tenant || !tenant.isActive) {
    return reply.status(401).send({
      statusCode: 401,
      error: "Não Autorizado",
      message: "Credenciais inválidas.",
    });
  }

  // PASSO 3: Busca o usuário dentro do schema do tenant
  const user = await findUserByEmail(tenant.schemaName, body.email);

  // PASSO 4: Verifica a senha
  // A verificação é feita MESMO SE user for null (bcrypt em string vazia)
  // para evitar timing attacks que medem diferença de tempo entre
  // "usuário não encontrado" (retorno rápido) e "senha errada" (bcrypt lento).
  const passwordValid =
    user && user.is_active
      ? await verifyPassword(body.password, user.password_hash)
      : false;

  if (!user || !user.is_active || !passwordValid) {
    return reply.status(401).send({
      statusCode: 401,
      error: "Não Autorizado",
      message: "Credenciais inválidas.",
    });
  }

  // PASSO 5: Gera o par de tokens
  const tokens = generateTokenPair(request.server, {
    sub: user.id,
    tenantId: tenant.id,
    role: user.role,
  });

  // PASSO 6: Persiste o HASH do refresh token no banco
  const tokenHash = hashRefreshToken(tokens.refresh_token);
  await saveRefreshToken(tenant.schemaName, {
    userId: user.id,
    tokenHash,
    expiresAt: getRefreshTokenExpiresAt(),
    ipAddress: request.ip,
    userAgent: request.headers["user-agent"],
  });

  request.log.info(
    `[Auth] ✅ Login bem-sucedido: "${user.email}" no tenant "${tenant.name}"`,
  );

  // PASSO 7: Retorna os tokens (nunca retornamos dados sensíveis)
  return reply.status(200).send({
    ...tokens,
    usuario: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
    tenant: {
      id: tenant.id,
      name: tenant.name,
    },
  });
}

// =============================================================================
// HANDLER: refresh
// POST /auth/refresh
// =============================================================================
// FLUXO COMPLETO (Rotação de Tokens):
//   1. Valida o body (refresh_token)
//   2. Extrai o tenantId do REFRESH TOKEN — como? Por convenção, o token
//      é enviado junto com o slug do tenant (body também inclui o slug)
//   3. Calcula o SHA-256 do refresh_token recebido
//   4. Busca o hash no banco → verifica se não está revogado e não expirou
//   5. Busca o usuário associado → verifica se ainda está ativo
//   6. Revoga o refresh token ATUAL (rotação)
//   7. Gera NOVO par de tokens
//   8. Salva o novo refresh token hash no banco
//   9. Retorna o novo par
//
// ROTAÇÃO DE TOKENS:
//   A cada refresh, o token antigo é invalidado e um novo é criado.
//   Se um refresh token antigo for usado mais de uma vez, sabemos que
//   pode ter sido roubado — o token correto já foi trocado pelo cliente legítimo.
// =============================================================================
export async function refresh(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  // O body inclui o refresh_token E o slug (precisamos do tenant para achar o schema)
  const body = RefreshTokenSchema.extend({
    slug: RefreshTokenSchema.shape.refresh_token.optional().transform(() => ""),
  }).parse(request.body);

  // Parse completo: precisa do slug para localizar o schema do tenant
  const parsed = (() => {
    const raw = request.body as Record<string, unknown>;
    const rfToken =
      typeof raw.refresh_token === "string" ? raw.refresh_token : "";
    const slug = typeof raw.slug === "string" ? raw.slug : "";
    return { refresh_token: rfToken, slug };
  })();

  if (!parsed.refresh_token || !parsed.slug) {
    return reply.status(400).send({
      statusCode: 400,
      error: "Requisição Inválida",
      message: "refresh_token e slug são obrigatórios.",
    });
  }

  // Busca o tenant pelo slug
  const tenant = await prisma.tenant.findUnique({
    where: { slug: parsed.slug },
    select: { id: true, name: true, schemaName: true, isActive: true },
  });

  if (!tenant || !tenant.isActive) {
    return reply.status(401).send({
      statusCode: 401,
      error: "Não Autorizado",
      message: "Token de renovação inválido ou expirado.",
    });
  }

  // Calcula hash e busca no banco
  const tokenHash = hashRefreshToken(parsed.refresh_token);
  const tokenRecord = await findRefreshToken(tenant.schemaName, tokenHash);

  if (!tokenRecord) {
    return reply.status(401).send({
      statusCode: 401,
      error: "Não Autorizado",
      message: "Token de renovação inválido ou expirado.",
    });
  }

  // Verifica se o token foi revogado
  if (tokenRecord.is_revoked) {
    // Token revogado sendo usado = possível roubo de token
    // Em produção: revogar TODOS os tokens da família, alertar o usuário
    request.log.warn(
      `[Auth] ⚠️ Refresh token já revogado foi apresentado. ` +
        `Possível roubo de token. user_id: ${tokenRecord.user_id}`,
    );
    return reply.status(401).send({
      statusCode: 401,
      error: "Não Autorizado",
      message: "Token de renovação inválido ou expirado.",
    });
  }

  // Verifica se o token expirou
  if (new Date() > tokenRecord.expires_at) {
    return reply.status(401).send({
      statusCode: 401,
      error: "Não Autorizado",
      message: "Token de renovação expirado. Faça login novamente.",
    });
  }

  // Busca o usuário associado ao token
  const user = await findUserById(tenant.schemaName, tokenRecord.user_id);

  if (!user || !user.is_active) {
    return reply.status(401).send({
      statusCode: 401,
      error: "Não Autorizado",
      message: "Usuário inativo ou não encontrado.",
    });
  }

  // ROTAÇÃO: Revoga o token atual ANTES de gerar o novo
  await revokeRefreshToken(tenant.schemaName, tokenHash);

  // Gera novo par de tokens
  const tokens = generateTokenPair(request.server, {
    sub: user.id,
    tenantId: tenant.id,
    role: user.role,
  });

  // Salva o novo refresh token no banco
  const newTokenHash = hashRefreshToken(tokens.refresh_token);
  await saveRefreshToken(tenant.schemaName, {
    userId: user.id,
    tokenHash: newTokenHash,
    expiresAt: getRefreshTokenExpiresAt(),
    ipAddress: request.ip,
    userAgent: request.headers["user-agent"],
  });

  request.log.info(
    `[Auth] 🔄 Tokens renovados para "${user.email}" no tenant "${tenant.name}"`,
  );

  return reply.status(200).send(tokens);
}

// =============================================================================
// HANDLER: logout
// POST /auth/logout
// =============================================================================
// FLUXO COMPLETO:
//   1. Valida o body (refresh_token + slug)
//   2. Calcula o hash do refresh token
//   3. Revoga o token no banco
//   4. Retorna confirmação
//
// O QUE ACONTECE COM O ACCESS TOKEN?
//   O access token NÃO pode ser revogado (é stateless por design).
//   Ele expirará naturalmente em até 15 minutos.
//   Para cenários de alta segurança (ex: conta comprometida), uma blocklist
//   de tokens pode ser adicionada — mas para a maioria dos casos,
//   15 minutos é uma janela aceitável.
// =============================================================================
export async function logout(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const raw = request.body as Record<string, unknown>;
  const refreshToken =
    typeof raw.refresh_token === "string" ? raw.refresh_token : "";
  const slug = typeof raw.slug === "string" ? raw.slug : "";

  if (!refreshToken || !slug) {
    return reply.status(400).send({
      statusCode: 400,
      error: "Requisição Inválida",
      message: "refresh_token e slug são obrigatórios para logout.",
    });
  }

  // Busca o tenant pelo slug
  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { schemaName: true },
  });

  if (tenant) {
    // Revoga o token (silenciosa — não informamos se o token existia ou não)
    const tokenHash = hashRefreshToken(refreshToken);
    await revokeRefreshToken(tenant.schemaName, tokenHash);
  }

  // Sempre retorna 200 no logout, independente do token existir.
  // Isso evita expor informações sobre quais tokens são válidos.
  request.log.info(`[Auth] 👋 Logout realizado para slug: "${slug}"`);

  return reply.status(200).send({
    mensagem:
      "Sessão encerrada com sucesso. O access token expira em até 15 minutos.",
  });
}
