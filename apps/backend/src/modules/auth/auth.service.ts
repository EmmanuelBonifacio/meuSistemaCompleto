// =============================================================================
// src/modules/auth/auth.service.ts
// =============================================================================
// O QUE FAZ:
//   Camada de LÓGICA DE NEGÓCIO do módulo de autenticação.
//   Concentra tudo que envolve bcrypt, tokens e criptografia.
//   O controller chama este service; este service chama o repository.
//
// RESPONSABILIDADES DESTE ARQUIVO:
//   ✅ Hash de senha com bcrypt (custo 12)
//   ✅ Verificação de senha com bcrypt.compare
//   ✅ Geração de access token JWT (15 minutos)
//   ✅ Geração de refresh token (string aleatória segura)
//   ✅ Hash do refresh token com SHA-256 para persistência no banco
//
// NÃO É RESPONSABILIDADE DESTE ARQUIVO:
//   ❌ Queries no banco (isso é do auth.repository.ts)
//   ❌ Registrar rotas ou receber requests (isso é do auth.routes.ts)
//
// POR QUE SEPARAR SERVICE DE REPOSITORY?
//   Seguindo o SOLID (SRP): cada arquivo tem uma razão para mudar.
//   Se trocarmos bcrypt por argon2 → mudamos só o service.
//   Se trocarmos PostgreSQL por outro banco → mudamos só o repository.
// =============================================================================

import bcrypt from "bcrypt";
import crypto from "node:crypto";
import { FastifyInstance } from "fastify";

// =============================================================================
// CONSTANTES DE CONFIGURAÇÃO
// =============================================================================

/**
 * Custo do bcrypt (salt rounds).
 * Custo 12 é o equilíbrio recomendado entre segurança e performance (OWASP 2023).
 * Cada incremento de 1 dobra o tempo de processamento:
 *   10 → ~100ms | 12 → ~400ms | 14 → ~1.5s
 * 400ms é aceitável para login, inviável para brute force em escala.
 */
const BCRYPT_SALT_ROUNDS = 12;

/**
 * Duração do access token JWT.
 * Curto o suficiente para limitar a janela de exposição se roubado.
 * O refresh token renova automaticamente antes de expirar.
 */
const ACCESS_TOKEN_EXPIRATION = "15m";

/**
 * Duração do refresh token (em dias).
 * O valor é usado para calcular a data de expiração antes de salvar no banco.
 */
const REFRESH_TOKEN_EXPIRATION_DAYS = 30;

// =============================================================================
// TIPO: TokenPair
// =============================================================================
// Par de tokens retornados após login bem-sucedido ou após um refresh.
// =============================================================================
export interface TokenPair {
  access_token: string;
  refresh_token: string;
  /** Tipo do token — padrão HTTP Authorization header */
  token_type: "Bearer";
  /** Duração do access token em segundos (900 = 15 minutos) */
  expires_in: number;
}

// =============================================================================
// FUNÇÃO: hashPassword
// =============================================================================
// O QUE FAZ:
//   Transforma uma senha em texto puro em um hash bcrypt seguro.
//   O hash inclui o salt automaticamente — cada chamada gera um hash diferente
//   para a mesma senha, o que impede ataques de rainbow table.
//
// POR QUE BCRYPT E NÃO SHA-256 PARA SENHAS?
//   SHA-256 é rápido — bom para dados, péssimo para senhas.
//   Rápido = fácil de iterar bilhões de tentativas por segundo (brute force).
//   Bcrypt é propositalmente lento (custo configurável) + tem salt embutido.
//   É o padrão recomendado pelo OWASP para hash de senhas.
// =============================================================================
export async function hashPassword(plainPassword: string): Promise<string> {
  return bcrypt.hash(plainPassword, BCRYPT_SALT_ROUNDS);
}

// =============================================================================
// FUNÇÃO: verifyPassword
// =============================================================================
// O QUE FAZ:
//   Compara uma senha em texto puro com um hash bcrypt.
//   O bcrypt extrai o salt do próprio hash para fazer a comparação.
//
// POR QUE NÃO COMPARAR OS HASHES DIRETAMENTE?
//   Bcrypt gera um hash diferente a CADA chamada (mesmo salt randômico).
//   A única forma de verificar é usando bcrypt.compare() que internamente
//   extrai o salt do hash salvo e re-hash a senha para comparar.
//
// TIMING ATTACK PROTECTION:
//   bcrypt.compare() usa comparação de tempo constante (constant-time).
//   Isso previne ataques que medem o tempo de resposta para adivinhar senhas.
// =============================================================================
export async function verifyPassword(
  plainPassword: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plainPassword, hash);
}

// =============================================================================
// FUNÇÃO: generateTokenPair
// =============================================================================
// O QUE FAZ:
//   Gera o par completo de tokens (access + refresh) após autenticação.
//
// COMO FUNCIONA:
//   1. Access token: JWT assinado com JWT_SECRET, expira em 15 minutos.
//      Payload: { sub, tenantId, role } — compatível com o tenantMiddleware existente.
//
//   2. Refresh token: 64 bytes aleatórios em hex (128 caracteres).
//      Enviado ao cliente. No banco, salvamos apenas o SHA-256 desse token.
//
// POR QUE 64 BYTES PARA O REFRESH TOKEN?
//   128 bits (16 bytes) já seria seguro contra brute force.
//   64 bytes (512 bits) é margem generosa — o custo é mínimo (string de 128 chars).
// =============================================================================
export function generateTokenPair(
  fastify: FastifyInstance,
  payload: { sub: string; tenantId: string; role: string },
): TokenPair {
  // Access token: JWT de curta duração
  const access_token = fastify.jwt.sign(
    {
      sub: payload.sub,
      tenantId: payload.tenantId,
      role: payload.role,
    },
    { expiresIn: ACCESS_TOKEN_EXPIRATION },
  );

  // Refresh token: string aleatória criptograficamente segura
  const refresh_token = crypto.randomBytes(64).toString("hex");

  return {
    access_token,
    refresh_token,
    token_type: "Bearer",
    expires_in: 15 * 60, // 900 segundos = 15 minutos
  };
}

// =============================================================================
// FUNÇÃO: hashRefreshToken
// =============================================================================
// O QUE FAZ:
//   Gera o SHA-256 do refresh token para persistência segura no banco.
//
// POR QUE SHA-256 E NÃO BCRYPT PARA O REFRESH TOKEN?
//   O refresh token já é uma string aleatória longa (512 bits de entropia).
//   Não é uma senha escolhida por humano — não precisa de salt bcrypt.
//   SHA-256 é determinístico (mesmo input = mesmo output) e muito rápido,
//   o que permite buscar o token no banco sem bcrypt.compare().
//
// FLUXO:
//   Cliente guarda: refresh_token (hex 128 chars)
//   Banco guarda:   SHA-256(refresh_token) (hex 64 chars)
//   Verificação:    SHA-256(token_enviado) == token_hash_no_banco
// =============================================================================
export function hashRefreshToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// =============================================================================
// FUNÇÃO: getRefreshTokenExpiresAt
// =============================================================================
// Retorna a data de expiração do refresh token (hoje + REFRESH_TOKEN_EXPIRATION_DAYS).
// =============================================================================
export function getRefreshTokenExpiresAt(): Date {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRATION_DAYS);
  return expiresAt;
}
