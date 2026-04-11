// =============================================================================
// src/services/api.ts
// =============================================================================
// O QUE FAZ:
//   Cria e configura a instância global do Axios — o cliente HTTP que toda
//   a aplicação usa para se comunicar com o Backend Node.js/Fastify.
//
// POR QUE AXIOS E NÃO FETCH NATIVO?
//   O Axios oferece vantagens importantes para este projeto:
//   1. Interceptadores (interceptors): lógica centralizada para adicionar
//      o JWT em TODA requisição sem repetir código em cada service.
//   2. Tratamento de erro automático: qualquer status >= 400 lança exceção.
//   3. JSON automático: serializa/desserializa JSON sem necessidade de
//      `.json()` manual como no fetch.
//   4. Cancelamento: facilita cancelar requisições em andamento.
//
// FLUXO DE CADA REQUISIÇÃO:
//   1. Service chama `api.get('/estoque/produtos')`
//   2. Interceptador 'request' adiciona: `Authorization: Bearer <token>`
//   3. Axios envia a requisição para o Backend
//   4. Se 200-299: interceptador 'response' retorna os dados
//   5. Se 401: interceptador tenta refresh do token ou redireciona para login
//   6. Se outro erro: lança ApiError para o componente tratar
//
// ONDE O TOKEN É ARMAZENADO?
//   Em localStorage com a chave '@saas/token'. Alternativa mais segura
//   em produção: cookie httpOnly (imune a XSS), mas requer configuração
//   de servidor. Para este estudo, localStorage é mais simples e didático.
// =============================================================================

import axios, {
  AxiosError,
  AxiosInstance,
  InternalAxiosRequestConfig,
} from "axios";
import type { ApiError } from "@/types/api";

// Chave usada para armazenar o JWT no localStorage do browser.
// Prefixo '@saas/' evita colisão com outras libs que possam usar 'token'.
export const TOKEN_KEY = "@saas/token";
export const TENANT_SLUG_KEY = "@saas/tenant-slug";

// =============================================================================
// CRIAÇÃO DA INSTÂNCIA AXIOS
// =============================================================================
// `baseURL` é a URL raiz do Backend — todas as chamadas partem daqui.
// Ex: apiInstance.get('/estoque/produtos') → GET http://localhost:3000/estoque/produtos
// =============================================================================
const apiInstance: AxiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000",

  // Timeout de 15 segundos: se o Backend não responder, lança erro.
  // Evita que a aplicação "trave" esperando infinitamente.
  timeout: 15_000,

  headers: {
    "Content-Type": "application/json",
    // O Accept diz ao servidor que esperamos JSON de volta:
    Accept: "application/json",
  },
});

// =============================================================================
// INTERCEPTADOR DE REQUISIÇÃO (Request Interceptor)
// =============================================================================
// O QUE FAZ:
//   Antes de CADA requisição sair do browser, este interceptador:
//   1. Lê o JWT do localStorage
//   2. Se encontrar, adiciona ao header Authorization
//   3. Passa a requisição adiante
//
// POR QUE AQUI E NÃO EM CADA CHAMADA?
//   DRY (Don't Repeat Yourself). Se você tivesse 50 chamadas de API e
//   precisasse mudar onde o token é guardado, teria 50 lugares para alterar.
//   Aqui, muda em 1 lugar e todos os services se beneficiam.
// =============================================================================
apiInstance.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // typeof window !== 'undefined' garante que este código só roda no browser,
    // não durante o SSR (Server-Side Rendering) do Next.js, onde localStorage
    // não existe.
    if (typeof window !== "undefined") {
      const token = localStorage.getItem(TOKEN_KEY);
      if (token) {
        // Padrão Bearer: "Bearer <token>" conforme RFC 6750
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  // Em caso de erro ao montar a própria requisição:
  (error) => Promise.reject(error),
);

// =============================================================================
// INTERCEPTADOR DE RESPOSTA (Response Interceptor)
// =============================================================================
// O QUE FAZ:
//   Após CADA resposta chegar do Backend, este interceptador:
//   - Sucesso (2xx): passa os dados adiante sem modificação
//   - Erro 401: remove o token inválido e redireciona para login
//   - Outros erros: formata e relança a exceção de forma padronizada
//
// POR QUE TRATAR 401 AQUI?
//   401 (Unauthorized) significa que o JWT expirou ou é inválido.
//   O comportamento correto é limpar o token e mandar o usuário fazer login.
//   Sem este tratamento, o usuário ficaria em um loop de 401s sem saber o que fazer.
// =============================================================================
apiInstance.interceptors.response.use(
  // Resposta com sucesso (status 2xx): retorna sem modificação
  (response) => response,

  // Resposta com erro (status >= 400):
  (error: AxiosError<ApiError>) => {
    const status = error.response?.status;

    if (status === 401) {
      // Token expirado ou inválido — limpar sessão e redirecionar para login
      if (typeof window !== "undefined") {
        const slug = localStorage.getItem(TENANT_SLUG_KEY);
        localStorage.removeItem(TOKEN_KEY);

        // Redireciona para a página de login do tenant atual
        const loginPath = slug ? `/${slug}/login` : "/";
        window.location.href = loginPath;
      }
    }

    // Se o Backend retornou um corpo de erro padronizado, use a mensagem dele.
    // Caso contrário, use mensagem genérica.
    const errorMessage =
      error.response?.data?.message ??
      error.message ??
      "Erro de comunicação com o servidor. Tente novamente.";

    // Relança como Error comum para que os componentes possam fazer try/catch
    return Promise.reject(new Error(errorMessage));
  },
);

export default apiInstance;
