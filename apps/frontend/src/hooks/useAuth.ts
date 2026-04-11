"use client";
// =============================================================================
// src/hooks/useAuth.ts
// =============================================================================
// O QUE FAZ:
//   Hook React que gerencia TODO o estado de autenticação da aplicação.
//   Expõe: dados do usuário logado, funções de login/logout, e flag de loading.
//
// POR QUE CRIAR UM HOOK E NÃO CHAMAR O SERVICE DIRETAMENTE NOS COMPONENTES?
//   1. Reutilização: qualquer componente pode `useAuth()` e ter acesso
//      ao estado do usuário sem repetir lógica.
//   2. Estado centralizado: todos os componentes veem a MESMA informação.
//      Se o usuário fizer logout, TODOS os componentes que usam `useAuth()`
//      serão re-renderizados automaticamente.
//   3. Separação de responsabilidades: o componente só cuida da UI;
//      o hook cuida da lógica de estado.
//
// COMO USAR EM UM COMPONENTE:
//   const { user, isLoading, login, logout } = useAuth()
//   if (isLoading) return <Spinner />
//   if (!user) return <LoginForm />
//   return <Dashboard user={user} />
//
// IMPORTANTE: Este hook usa useState e useEffect — só funciona em
// Client Components (por isso o 'use client' no topo).
// =============================================================================

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import * as authService from "@/services/auth.service";
import type { JwtPayload } from "@/types/api";
import type { LoginCredentials } from "@/services/auth.service";
import { clearModulesCache } from "@/services/tenant.service";

// =============================================================================
// TIPO: Estado de autenticação (o que o hook expõe)
// =============================================================================
interface AuthState {
  // Dados do usuário logado (payload do JWT). Null se não está autenticado.
  user: JwtPayload | null;

  // true enquanto o hook está verificando se há uma sessão ativa (carga inicial)
  isLoading: boolean;

  // Mensagem de erro da última tentativa de login
  error: string | null;

  // Função para fazer login. Retorna true se bem-sucedido.
  login: (
    credentials: LoginCredentials,
    tenantSlug: string,
  ) => Promise<boolean>;

  // Função para fazer logout e redirecionar para o login
  logout: () => void;

  // Verifica se o usuário tem a role exigida
  hasRole: (role: JwtPayload["role"]) => boolean;
}

// =============================================================================
// HOOK: useAuth
// =============================================================================
export function useAuth(): AuthState {
  // Estado do usuário logado — começa como null (não autenticado)
  const [user, setUser] = useState<JwtPayload | null>(null);

  // Estado de carregamento inicial (verificando localStorage)
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Estado de erro (mensagem do Backend em caso de credenciais inválidas)
  const [error, setError] = useState<string | null>(null);

  // Router do Next.js para redirecionamentos programáticos
  const router = useRouter();

  // ==========================================================================
  // EFEITO: Verificação de sessão na carga inicial da página
  // ==========================================================================
  // O QUE FAZ:
  //   Quando a página carrega (ou este hook é montado), verificamos se
  //   existe um JWT válido no localStorage.
  //   Se existe: inicializa o estado `user` sem precisar fazer login novamente.
  //   Se não existe: `user` permanece null.
  //
  // POR QUE useEffect COM ARRAY VAZIO []?
  //   [] significa "rode apenas uma vez, quando o componente montar".
  //   É o equivalente ao componentDidMount de componentes de classe.
  //   Sem isso, rodaria em CADA re-render, causando loops infinitos.
  // ==========================================================================
  useEffect(() => {
    // Como estamos usando localStorage, só podemos acessar no browser
    // typeof window evita erros durante o SSR do Next.js
    const payload = authService.getStoredPayload();
    setUser(payload);
    setIsLoading(false);
  }, []); // Array vazio = roda apenas uma vez na montagem

  // ==========================================================================
  // FUNÇÃO: login
  // ==========================================================================
  // useCallback evita recriar a função em cada re-render.
  // A função só é recriada se as dependências do array mudarem.
  // Importante para performance quando passamos `login` como prop.
  // ==========================================================================
  const login = useCallback(
    async (
      credentials: LoginCredentials,
      tenantSlug: string,
    ): Promise<boolean> => {
      setError(null);
      setIsLoading(true);

      try {
        // Chama o service que faz a requisição ao Backend e armazena o token
        const payload = await authService.login(credentials, tenantSlug);

        // Atualiza o estado React — todos os componentes que usam useAuth()
        // serão re-renderizados com o novo usuário
        setUser(payload);
        return true;
      } catch (err) {
        // Captura a mensagem de erro formatada pelo interceptador do Axios
        const message =
          err instanceof Error
            ? err.message
            : "Falha na autenticação. Verifique os dados.";
        setError(message);
        return false;
      } finally {
        // Always remove loading state, even if threw error
        setIsLoading(false);
      }
    },
    [],
  );

  // ==========================================================================
  // FUNÇÃO: logout
  // ==========================================================================
  const logout = useCallback(() => {
    // Remove o token do localStorage
    authService.logout();

    // Remove o cache de módulos (o próximo usuário pode ter módulos diferentes)
    clearModulesCache();

    // Limpa o estado React (força todos os componentes a re-renderizar)
    setUser(null);

    // Redireciona para a home — cada tenant poderá redirecionar para seu login
    router.push("/");
  }, [router]);

  // ==========================================================================
  // FUNÇÃO: hasRole
  // ==========================================================================
  // Verifica hierarquia de permissões:
  //   superadmin → pode fazer tudo que admin e user podem
  //   admin      → pode fazer tudo que user pode
  //   user       → acesso básico apenas
  // ==========================================================================
  const hasRole = useCallback(
    (requiredRole: JwtPayload["role"]): boolean => {
      if (!user) return false;

      const hierarchy: Record<JwtPayload["role"], number> = {
        user: 1,
        admin: 2,
        superadmin: 3,
      };

      return hierarchy[user.role] >= hierarchy[requiredRole];
    },
    [user],
  );

  return { user, isLoading, error, login, logout, hasRole };
}
