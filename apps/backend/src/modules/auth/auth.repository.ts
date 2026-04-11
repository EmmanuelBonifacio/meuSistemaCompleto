// =============================================================================
// src/modules/auth/auth.repository.ts
// =============================================================================
// O QUE FAZ:
//   Camada de ACESSO A DADOS do módulo de autenticação.
//   Toda query nas tabelas `users` e `refresh_tokens` dos schemas de tenant
//   passa por aqui. O service e o controller não tocam no banco diretamente.
//
// PRINCÍPIO SOLID (SRP):
//   Este arquivo tem UMA responsabilidade: operações de banco de dados
//   relacionadas à autenticação. Lógica de hash, geração de token e
//   regras de negócio ficam no auth.service.ts.
//
// SOBRE O withTenantSchema:
//   Todas as funções recebem `schemaName` e usam `withTenantSchema()`.
//   Isso garante que cada query vai para o schema correto do tenant
//   (ex: tenant_academia.users — não mistura dados entre tenants).
// =============================================================================

import { withTenantSchema } from "../../core/database/prisma";

// =============================================================================
// TIPOS: Estruturas retornadas pelas queries
// =============================================================================

export interface AuthUser {
  id: string;
  email: string;
  password_hash: string;
  name: string | null;
  role: string;
  is_active: boolean;
}

export interface RefreshTokenRecord {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  is_revoked: boolean;
}

// =============================================================================
// FUNÇÃO: findUserByEmail
// =============================================================================
// O QUE FAZ:
//   Busca um usuário pelo email dentro do schema do tenant.
//   Chamada no início do login para verificar se o email existe.
//
// RETORNO:
//   AuthUser (com password_hash) | null
//   Retornamos o hash para que o service possa comparar com bcrypt.
//   NÃO retornamos o hash depois do login — apenas durante a autenticação.
// =============================================================================
export async function findUserByEmail(
  schemaName: string,
  email: string,
): Promise<AuthUser | null> {
  const rows = await withTenantSchema(schemaName, async (tx) => {
    return tx.$queryRawUnsafe<AuthUser[]>(
      `SELECT id, email, password_hash, name, role, is_active
       FROM users
       WHERE email = $1
       LIMIT 1`,
      email,
    );
  });

  return rows[0] ?? null;
}

// =============================================================================
// FUNÇÃO: findUserById
// =============================================================================
// O QUE FAZ:
//   Busca usuário pelo ID. Usado no /auth/refresh para confirmar que o
//   usuário associado ao refresh token ainda existe e está ativo.
// =============================================================================
export async function findUserById(
  schemaName: string,
  userId: string,
): Promise<AuthUser | null> {
  const rows = await withTenantSchema(schemaName, async (tx) => {
    return tx.$queryRawUnsafe<AuthUser[]>(
      `SELECT id, email, password_hash, name, role, is_active
       FROM users
       WHERE id = $1::uuid
       LIMIT 1`,
      userId,
    );
  });

  return rows[0] ?? null;
}

// =============================================================================
// FUNÇÃO: saveRefreshToken
// =============================================================================
// O QUE FAZ:
//   Persiste o hash do refresh token no banco após um login bem-sucedido.
//   Salva o HASH (SHA-256), nunca o token original.
//
// POR QUE HASH E NÃO O TOKEN ORIGINAL?
//   Se o banco for comprometido, um atacante com os hashes NÃO consegue
//   usar os refresh tokens — o hash não é reversível.
//   É o mesmo princípio do bcrypt para senhas.
// =============================================================================
export async function saveRefreshToken(
  schemaName: string,
  data: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    ipAddress?: string;
    userAgent?: string;
  },
): Promise<void> {
  await withTenantSchema(schemaName, async (tx) => {
    await tx.$executeRawUnsafe(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, ip_address, user_agent)
       VALUES ($1::uuid, $2, $3, $4, $5)`,
      data.userId,
      data.tokenHash,
      data.expiresAt,
      data.ipAddress ?? null,
      data.userAgent ?? null,
    );
  });
}

// =============================================================================
// FUNÇÃO: findRefreshToken
// =============================================================================
// O QUE FAZ:
//   Busca um refresh token pelo hash. Chamada em /auth/refresh e /auth/logout.
//
// O cliente envia o token original → service calcula o SHA-256 → aqui buscamos.
// =============================================================================
export async function findRefreshToken(
  schemaName: string,
  tokenHash: string,
): Promise<RefreshTokenRecord | null> {
  const rows = await withTenantSchema(schemaName, async (tx) => {
    return tx.$queryRawUnsafe<RefreshTokenRecord[]>(
      `SELECT id, user_id, token_hash, expires_at, is_revoked
       FROM refresh_tokens
       WHERE token_hash = $1
       LIMIT 1`,
      tokenHash,
    );
  });

  return rows[0] ?? null;
}

// =============================================================================
// FUNÇÃO: revokeRefreshToken
// =============================================================================
// O QUE FAZ:
//   Marca um refresh token como revogado (is_revoked = true).
//   Chamada em dois cenários:
//   1. /auth/refresh → revoga o token antigo antes de emitir o novo par
//   2. /auth/logout  → revoga o token para encerrar a sessão
//
// POR QUE NÃO DELETAR O REGISTRO?
//   Manter os tokens revogados permite auditoria (saber quando e de onde
//   uma sessão foi encerrada). Em produção, um job periódico pode limpar
//   tokens expirados há mais de X dias.
// =============================================================================
export async function revokeRefreshToken(
  schemaName: string,
  tokenHash: string,
): Promise<void> {
  await withTenantSchema(schemaName, async (tx) => {
    await tx.$executeRawUnsafe(
      `UPDATE refresh_tokens
       SET is_revoked = true
       WHERE token_hash = $1`,
      tokenHash,
    );
  });
}

// =============================================================================
// FUNÇÃO: createUser
// =============================================================================
// O QUE FAZ:
//   Insere um novo usuário no schema do tenant.
//   Chamado pelo script de seed para criação do primeiro usuário admin.
//   (Em produção, a criação de usuários seria via painel admin do tenant.)
//
// IMPORTANTE: O password_hash deve ser gerado pelo auth.service ANTES
//   de chamar esta função. O repository nunca faz hash — só persiste.
// =============================================================================
export async function createUser(
  schemaName: string,
  data: {
    email: string;
    passwordHash: string;
    name?: string;
    role?: string;
  },
): Promise<AuthUser> {
  const rows = await withTenantSchema(schemaName, async (tx) => {
    return tx.$queryRawUnsafe<AuthUser[]>(
      `INSERT INTO users (email, password_hash, name, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, password_hash, name, role, is_active`,
      data.email,
      data.passwordHash,
      data.name ?? null,
      data.role ?? "user",
    );
  });

  return rows[0];
}
