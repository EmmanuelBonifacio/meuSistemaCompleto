// =============================================================================
// src/services/auth.service.ts
// =============================================================================
// O QUE FAZ:
//   Gerencia todo o fluxo de autenticação com o Backend:
//   - Login: obtém o JWT e armazena localmente
//   - Logout: remove o JWT e limpa o estado local
//   - Me: busca dados do usuário logado (/me endpoint)
//   - Token dev: gera token de teste (APENAS em desenvolvimento)
//
// FLUXO DE AUTENTICAÇÃO NO FRONTEND:
//   1. Usuário preenche o formulário de login
//   2. authService.login() chama o Backend
//   3. Backend valida credenciais e retorna JWT
//   4. Frontend armazena JWT no localStorage
//   5. Todas as requisições futuras incluem o JWT automaticamente
//      (via interceptador em api.ts)
//
// EM PRODUÇÃO:
//   Este service deveria chamar POST /auth/login com { email, password }.
//   Por ora, usamos /dev/token que é fornecido pelo Backend para testes.
//   O comentário EM PRODUÇÃO indica onde/como mudar quando houver auth real.
// =============================================================================

import api, { TOKEN_KEY, TENANT_SLUG_KEY } from "./api";
import { decodeJwt, isJwtExpired } from "@/lib/utils";
import type { MeResponse, DevTokenResponse, JwtPayload } from "@/types/api";

// =============================================================================
// TIPO: Credenciais de Login
// =============================================================================
// Interface amigável para as páginas de login (email + senha).
// Internamente o endpoint /dev/token usa tenantId + userId, então
// usamos email como userId e ignoramos a senha no modo dev.
// EM PRODUÇÃO: o backend deve ter um endpoint /auth/login real.
export interface LoginCredentials {
  email: string;
  password: string;
  // Permite sobrescrever o role no ambiente de dev (ex: 'superadmin')
  // Em produção, o role deve vir SEMPRE do backend após validação.
  _devRole?: "user" | "admin" | "superadmin";
}

// =============================================================================
// FUNÇÃO: login
// =============================================================================
// O QUE FAZ:
//   Solicita um JWT ao Backend usando as credenciais fornecidas.
//   Armazena o JWT no localStorage e guarda o slug do tenant.
//
// RETORNA: O payload decodificado do JWT para acesso imediato.
//
// EM PRODUÇÃO: Troque /dev/token por /auth/login e ajuste o body.
// =============================================================================
export async function login(
  credentials: LoginCredentials,
  tenantSlug: string,
): Promise<JwtPayload> {
  // Chama o endpoint real de autenticação do backend.
  // POST /auth/login valida o slug + email + senha via bcrypt e retorna
  // um JWT com o UUID real do tenant — necessário para o tenantMiddleware
  // localizar o tenant corretamente em todas as requisições subsequentes.
  const response = await api.post<{ access_token: string; refresh_token: string; token_type: string; expires_in: number }>(
    "/auth/login",
    {
      slug: tenantSlug,
      email: credentials.email,
      password: credentials.password,
    },
  );

  const token = response.data.access_token;

  // Armazena no localStorage para que os interceptadores do Axios possam usar
  localStorage.setItem(TOKEN_KEY, token);

  // Armazena o slug para que o interceptador de 401 saiba para onde redirecionar
  localStorage.setItem(TENANT_SLUG_KEY, tenantSlug);

  // Limpa o cache de módulos para que o novo token seja usado na descoberta.
  // Sem isso, o cache vazio/antigo do login anterior seria reutilizado.
  localStorage.removeItem("@saas/active-modules");

  // Decodifica o JWT para retornar os dados do usuário imediatamente,
  // sem precisar fazer outra chamada GET /me
  const payload = decodeJwt<JwtPayload>(token);
  if (!payload) {
    throw new Error("Token recebido do servidor é inválido.");
  }

  return payload;
}

// =============================================================================
// FUNÇÃO: adminLogin
// =============================================================================
// O QUE FAZ:
//   Autentica o administrador do sistema via POST /admin/login.
//   Ao contrário de login() (que usa /dev/token), esta função chama uma
//   rota real com verificação de credenciais via bcrypt no backend.
//
// DIFERENÇA DE login() (tenant):
//   - login()      → autentica usuários de TENANT (POST /auth/login, requer slug)
//   - adminLogin() → autentica o ADMIN DO SISTEMA (POST /admin/login, sem slug)
//
// RETORNA:
//   O payload decodificado do JWT para acesso imediato ao role e id do admin.
// =============================================================================
export async function adminLogin(credentials: {
  email: string;
  password: string;
}): Promise<JwtPayload> {
  // Chama POST /admin/login com email + senha — sem slug, pois o admin
  // não pertence a nenhum tenant específico.
  const response = await api.post<{ access_token: string }>("/admin/login", {
    email: credentials.email,
    password: credentials.password,
  });

  const { access_token } = response.data;

  // Armazena o token no localStorage para os interceptadores do Axios
  localStorage.setItem(TOKEN_KEY, access_token);

  // Decodifica o JWT para retornar os dados do admin imediatamente
  const payload = decodeJwt<JwtPayload>(access_token);
  if (!payload) {
    throw new Error("Token recebido do servidor é inválido.");
  }

  return payload;
}

// =============================================================================
// FUNÇÃO: logout
// =============================================================================
// O QUE FAZ:
//   Remove todos os dados de sessão do localStorage.
//   Após isso, o interceptador do Axios parará de incluir o header Authorization,
//   e qualquer rota protegida retornará 401 e redirecionará para o login.
// =============================================================================
export function logout(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TENANT_SLUG_KEY);
}

// =============================================================================
// FUNÇÃO: getMe
// =============================================================================
// O QUE FAZ:
//   Busca os dados do usuário autenticado no Backend.
//   O Backend valida o JWT e retorna informações do tenant e usuário.
//   Útil para verificar se a sessão ainda é válida após um refresh de página.
// =============================================================================
export async function getMe(): Promise<MeResponse> {
  const response = await api.get<MeResponse>("/me");
  return response.data;
}

// =============================================================================
// FUNÇÃO: getStoredToken
// =============================================================================
// O QUE FAZ:
//   Retorna o token armazenado, ou null se não houver sessão ativa.
//   Também verifica se o token ainda é válido (não expirado).
// =============================================================================
export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null; // SSR safety
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return null;
  if (isJwtExpired(token)) {
    // Token expirado — limpamos para evitar tentativas futuras desnecessárias
    localStorage.removeItem(TOKEN_KEY);
    return null;
  }
  return token;
}

// =============================================================================
// FUNÇÃO: getStoredPayload
// =============================================================================
// O QUE FAZ:
//   Decodifica e retorna o payload do JWT armazenado sem fazer chamada ao servidor.
//   Útil para inicializar o estado de autenticação na carga da página.
//
// ATENÇÃO: Não confie nestes dados para decisões de segurança!
//   Apenas para renderização de UI (ex: mostrar nome do usuário).
//   A segurança real sempre começa no Backend validando o JWT.
// =============================================================================
export function getStoredPayload(): JwtPayload | null {
  const token = getStoredToken();
  if (!token) return null;
  return decodeJwt<JwtPayload>(token);
}

// =============================================================================
// FUNÇÃO: isAuthenticated
// =============================================================================
// Retorna true se o usuário tem um token válido (não expirado) armazenado.
// =============================================================================
export function isAuthenticated(): boolean {
  return getStoredToken() !== null;
}
