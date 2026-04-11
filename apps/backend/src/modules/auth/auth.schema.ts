// =============================================================================
// src/modules/auth/auth.schema.ts
// =============================================================================
// O QUE FAZ:
//   Define os schemas de validação Zod para todas as entradas do módulo
//   de autenticação. Cada rota valida seu input antes de tocar no banco.
//
// POR QUE ZOD?
//   Uma única fonte de verdade: o schema valida E gera tipos TypeScript.
//   Erros de validação são retornados em formato estruturado.
//   Sem Zod, precisaríamos de if/else manual para cada campo — propenso a bugs.
// =============================================================================

import { z } from "zod";

// =============================================================================
// SCHEMA: Login
// =============================================================================
// Usado em: POST /auth/login
//
// POR QUE INCLUIR O SLUG?
//   Os usuários ficam DENTRO do schema de cada tenant (ex: tenant_academia.users).
//   Sem saber qual tenant, não temos como saber em qual schema buscar o usuário.
//   O slug identifica o tenant de forma URL-friendly.
//
// POR QUE NÃO ACEITAR SENHA VAZIA?
//   min(8) é o mínimo aceitável de segurança. Senhas curtas são facilmente
//   descobertas por brute force. Em produção, considere exigir complexidade.
// =============================================================================
export const LoginSchema = z.object({
  slug: z
    .string({ required_error: "Slug do tenant é obrigatório" })
    .min(2, "Slug inválido")
    .toLowerCase()
    .trim(),
  // Identifica qual tenant o usuário pertence.
  // Ex: "academia-do-joao", "restaurante-bom-gosto"

  email: z
    .string({ required_error: "E-mail é obrigatório" })
    .email("E-mail inválido")
    .toLowerCase()
    .trim(),

  password: z
    .string({ required_error: "Senha é obrigatória" })
    .min(8, "Senha deve ter no mínimo 8 caracteres"),
});

export type LoginInput = z.infer<typeof LoginSchema>;

// =============================================================================
// SCHEMA: Refresh Token
// =============================================================================
// Usado em: POST /auth/refresh
//
// O refresh_token é enviado pelo cliente para renovar o access_token expirado.
// Validamos apenas que é uma string não vazia — o formato (hex 128 chars) é
// verificado no service ao buscar no banco.
// =============================================================================
export const RefreshTokenSchema = z.object({
  refresh_token: z
    .string({ required_error: "refresh_token é obrigatório" })
    .min(20, "refresh_token inválido"),
});

export type RefreshTokenInput = z.infer<typeof RefreshTokenSchema>;

// =============================================================================
// SCHEMA: Logout
// =============================================================================
// Usado em: POST /auth/logout
//
// Reutiliza o mesmo schema do refresh — o corpo é idêntico.
// Separado como alias para deixar o código mais legível no controller.
// =============================================================================
export const LogoutSchema = RefreshTokenSchema;
export type LogoutInput = z.infer<typeof LogoutSchema>;
