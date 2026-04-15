// =============================================================================
// src/admin/admin.users.repository.ts
// =============================================================================
// O QUE FAZ:
//   Camada de acesso a dados para gestão de usuários de tenant pelo painel admin.
//   Diferente do admin.repository.ts (que acessa apenas o schema `public`),
//   este arquivo usa `withTenantSchema()` para operar na tabela `users`
//   de um schema de tenant específico (ex: tenant_tv_corp.users).
//
// POR QUE USAR RAW SQL (queryRawUnsafe) E NÃO PRISMA ORM AQUI?
//   O Prisma ORM só conhece o schema `public` (definido no schema.prisma).
//   A tabela `users` de cada tenant está nos schemas isolados (tenant_slug),
//   que o Prisma não mapeia diretamente. Por isso usamos $queryRawUnsafe
//   com troca dinâmica de search_path via withTenantSchema().
//
// SEGURANÇA CONTRA SQL INJECTION:
//   Todos os valores variáveis são passados como parâmetros ($1, $2, ...),
//   NUNCA interpolados diretamente na string SQL. O PostgreSQL trata os
//   parâmetros como dados — jamais como código SQL executável.
//   ❌ ERRADO:  `WHERE email = '${email}'`   ← SQL injection
//   ✅ CORRETO: `WHERE email = $1`, email   ← seguro
//
// RESPONSABILIDADES:
//   ✅ Listar usuários de um tenant
//   ✅ Criar usuário (com hash já gerado pelo controller)
//   ✅ Atualizar nome, role, is_active
//   ✅ Trocar senha (hash já gerado pelo controller)
//   ✅ Deletar usuário (remoção física — admin pode tudo)
// =============================================================================

import { withTenantSchema } from "../core/database/prisma";

// =============================================================================
// TIPO: TenantUser
// =============================================================================
// Representa um usuário dentro de um schema de tenant.
// NÃO inclui password_hash — nunca expor hash de senha em respostas HTTP.
// =============================================================================
export interface TenantUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

// =============================================================================
// FUNÇÃO: listTenantUsers
// =============================================================================
// O QUE FAZ:
//   Retorna todos os usuários de um tenant específico.
//   Ordenados por created_at DESC (mais recentes primeiro).
//   NÃO retorna password_hash — segurança por design.
// =============================================================================
export async function listTenantUsers(
  schemaName: string,
): Promise<TenantUser[]> {
  return withTenantSchema(schemaName, async (tx) => {
    return tx.$queryRawUnsafe<TenantUser[]>(
      `SELECT id, email, name, role, is_active, created_at, updated_at
       FROM users
       ORDER BY created_at DESC`,
    );
  });
}

// =============================================================================
// FUNÇÃO: findTenantUserById
// =============================================================================
// O QUE FAZ:
//   Busca um único usuário pelo ID. Usado para verificar existência antes
//   de atualizar ou deletar.
// =============================================================================
export async function findTenantUserById(
  schemaName: string,
  userId: string,
): Promise<TenantUser | null> {
  const rows = await withTenantSchema(schemaName, async (tx) => {
    return tx.$queryRawUnsafe<TenantUser[]>(
      `SELECT id, email, name, role, is_active, created_at, updated_at
       FROM users
       WHERE id = $1::uuid
       LIMIT 1`,
      userId,
    );
  });
  return rows[0] ?? null;
}

// =============================================================================
// FUNÇÃO: findTenantUserByEmail
// =============================================================================
// O QUE FAZ:
//   Verifica se um e-mail já está em uso antes de criar um novo usuário.
//   Evita duplicatas (unique constraint do banco também protege, mas uma
//   verificação prévia = mensagem de erro mais amigável).
// =============================================================================
export async function findTenantUserByEmail(
  schemaName: string,
  email: string,
): Promise<{ id: string } | null> {
  const rows = await withTenantSchema(schemaName, async (tx) => {
    return tx.$queryRawUnsafe<{ id: string }[]>(
      `SELECT id FROM users WHERE email = $1 LIMIT 1`,
      email,
    );
  });
  return rows[0] ?? null;
}

// =============================================================================
// FUNÇÃO: createTenantUser
// =============================================================================
// O QUE FAZ:
//   Insere um novo usuário no schema do tenant.
//   O password_hash já chegou gerado pelo controller (bcrypt, custo 12).
//   Esta função apenas persiste — não faz hash, SOLID.
//
// RETORNO:
//   O usuário criado (sem password_hash).
// =============================================================================
export async function createTenantUser(
  schemaName: string,
  data: {
    email: string;
    name: string;
    passwordHash: string;
    role: string;
  },
): Promise<TenantUser> {
  const rows = await withTenantSchema(schemaName, async (tx) => {
    return tx.$queryRawUnsafe<TenantUser[]>(
      `INSERT INTO users (email, name, password_hash, role, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, true, NOW(), NOW())
       RETURNING id, email, name, role, is_active, created_at, updated_at`,
      data.email,
      data.name,
      data.passwordHash,
      data.role,
    );
  });

  // INSERT com RETURNING sempre retorna exatamente 1 linha
  return rows[0];
}

// =============================================================================
// FUNÇÃO: updateTenantUser
// =============================================================================
// O QUE FAZ:
//   Atualiza nome, role e/ou status ativo de um usuário.
//   Campos undefined não são alterados (patch parcial).
//   Sempre atualiza updated_at para rastreabilidade.
// =============================================================================
export async function updateTenantUser(
  schemaName: string,
  userId: string,
  data: {
    name?: string;
    role?: string;
    isActive?: boolean;
  },
): Promise<TenantUser> {
  // Monta dinamicamente apenas os campos que foram enviados
  // POR QUÊ: evita sobrescrever campos não enviados com undefined/null
  const setClauses: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (data.name !== undefined) {
    setClauses.push(`name = $${paramIndex++}`);
    values.push(data.name);
  }
  if (data.role !== undefined) {
    setClauses.push(`role = $${paramIndex++}`);
    values.push(data.role);
  }
  if (data.isActive !== undefined) {
    setClauses.push(`is_active = $${paramIndex++}`);
    values.push(data.isActive);
  }

  // Sempre atualiza o updated_at
  setClauses.push(`updated_at = NOW()`);

  // O WHERE usa o próximo índice de parâmetro
  values.push(userId);

  const rows = await withTenantSchema(schemaName, async (tx) => {
    return tx.$queryRawUnsafe<TenantUser[]>(
      `UPDATE users
       SET ${setClauses.join(", ")}
       WHERE id = $${paramIndex}::uuid
       RETURNING id, email, name, role, is_active, created_at, updated_at`,
      ...values,
    );
  });

  return rows[0];
}

// =============================================================================
// FUNÇÃO: resetTenantUserPassword
// =============================================================================
// O QUE FAZ:
//   Substitui o password_hash de um usuário.
//   A nova senha já chegou como hash (bcrypt gerado no controller).
//   Esta operação é exclusiva do admin — sem verificação da senha antiga.
//
// SEGURANÇA:
//   Rota de reset protegida pelo adminMiddleware (role = superadmin).
//   O evento é logado pelo controller para auditoria.
// =============================================================================
export async function resetTenantUserPassword(
  schemaName: string,
  userId: string,
  newPasswordHash: string,
): Promise<void> {
  await withTenantSchema(schemaName, async (tx) => {
    await tx.$queryRawUnsafe(
      `UPDATE users
       SET password_hash = $1, updated_at = NOW()
       WHERE id = $2::uuid`,
      newPasswordHash,
      userId,
    );
  });
}

// =============================================================================
// FUNÇÃO: deleteTenantUser
// =============================================================================
// O QUE FAZ:
//   Remove fisicamente um usuário do schema do tenant.
//   Operação irreversível — usada apenas pelo admin via painel.
//
// POR QUE REMOÇÃO FÍSICA E NÃO SOFT-DELETE?
//   Soft-delete (is_deleted = true) teria mais flexibilidade, mas adiciona
//   complexidade nas queries (WHERE NOT is_deleted em todo lugar).
//   Para o painel admin, remoção física é suficiente e mais simples.
//   Em produção, considere soft-delete + período de graça de 30 dias.
// =============================================================================
export async function deleteTenantUser(
  schemaName: string,
  userId: string,
): Promise<void> {
  await withTenantSchema(schemaName, async (tx) => {
    await tx.$queryRawUnsafe(`DELETE FROM users WHERE id = $1::uuid`, userId);
  });
}
