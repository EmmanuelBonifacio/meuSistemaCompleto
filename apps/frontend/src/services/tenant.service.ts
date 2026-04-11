// =============================================================================
// src/services/tenant.service.ts
// =============================================================================
// O QUE FAZ:
//   Serviço responsável por obter informações do Tenant e seus módulos ativos.
//   Esta é a peça chave do "Menu Dinâmico Lego": a Sidebar só mostrará
//   os módulos que este service confirmar como ativos para o tenant logado.
//
// ESTRATÉGIA DE DESCOBERTA DE MÓDULOS:
//   O Backend não tem um endpoint público para listar módulos do tenant logado.
//   Existem duas estratégias possíveis:
//
//   1. CHAMADA À API ADMIN (se role === 'admin'):
//      GET /admin/tenants/:tenantId retorna os módulos com status.
//      Funciona apenas para usuários com role='admin'.
//
//   2. MÓDULO DISCOVERY (para usuários comuns):
//      Tentamos chamar o endpoint principal de cada módulo.
//      - Se retornar 200 → módulo ativo ✅
//      - Se retornar 403 → módulo inativo ❌
//      Armazenamos o resultado em cache (localStorage) para evitar
//      múltiplas chamadas a cada navegação de página.
//
//   Esta estratégia é usada em SaaS reais (o Notion, Slack, etc. fazem isso).
// =============================================================================

import api from "./api";
import type { Tenant, Module } from "@/types/api";

// Chave de cache no localStorage para os módulos ativos do tenant
const ACTIVE_MODULES_KEY = "@saas/active-modules";
const MODULES_CACHE_TTL = 5 * 60 * 1000; // 5 minutos em milissegundos

// Todos os módulos que o sistema suporta — lista de possibilidades
const ALL_MODULES: Module[] = [
  {
    id: "estoque",
    name: "estoque",
    displayName: "Gestão de Estoque",
    description: "Gerencie produtos, quantidades e preços",
  },
  {
    id: "financeiro",
    name: "financeiro",
    displayName: "Financeiro",
    description: "Controle receitas, despesas e saldo",
  },
  {
    id: "tv",
    name: "tv",
    displayName: "Controle de TVs",
    description: "Gerencie telas e envie conteúdo remotamente",
  },
];

// =============================================================================
// TIPO: Módulos em cache com timestamp
// =============================================================================
interface CachedModules {
  modules: Module[];
  cachedAt: number; // Unix timestamp (ms)
}

// =============================================================================
// FUNÇÃO: discoverActiveModules
// =============================================================================
// O QUE FAZ:
//   Descobre quais módulos estão ativos para o tenant logado fazendo
//   chamadas rápidas (HEAD/GET) para cada módulo e verificando a resposta.
//
// POR QUE CACHEAR?
//   Esta função faz 3 requisições paralelas. Sem cache, repetiria isso
//   A CADA troca de página, sobrecarregando o Backend desnecessariamente.
//   Com cache de 5 minutos, a lista de módulos é consultada uma vez
//   por sessão e reutilizada nas navegações seguintes.
// =============================================================================
export async function discoverActiveModules(): Promise<Module[]> {
  // 1. Verificar se temos cache válido
  const cached = getModulesFromCache();
  if (cached) {
    return cached;
  }

  // 2. Testar cada módulo em paralelo (Promise.allSettled garante que
  //    mesmo que um falhe, os outros são avaliados)
  const results = await Promise.allSettled([
    api.get("/estoque/produtos?limit=1"),
    api.get("/financeiro/transacoes?limit=1"),
    api.get("/tv/devices"),
  ]);

  // 3. Mapear resultados: fulfilled (200) = ativo, rejected (403) = inativo
  const activeModules = ALL_MODULES.filter((_, index) => {
    const result = results[index];
    // 'fulfilled' significa que a chamada retornou 2xx (módulo ativo)
    // 'rejected' com status 403 significa que o módulo está desativado
    // 'rejected' com status 401 significa que não está logado (outro problema)
    if (result.status === "fulfilled") return true;
    if (result.status === "rejected") {
      const error = result.reason as Error;
      // Se for "403 Forbidden", o módulo está inativo mas o usuário está logado
      // Se for outro erro, não incluímos o módulo (comportamento seguro)
      return false;
    }
    return false;
  });

  // 4. Guardar no cache para as próximas 5 páginas que o usuário visitar
  saveModulesToCache(activeModules);

  return activeModules;
}

// =============================================================================
// FUNÇÃO: getTenantInfoFromAdmin
// =============================================================================
// O QUE FAZ:
//   Busca os dados completos do tenant incluindo módulos, via API Admin.
//   Só funciona para usuários com role 'admin' ou 'superadmin'.
//   Retorna null se a chamada falhar (ex: usuário não tem permissão).
// =============================================================================
export async function getTenantInfoFromAdmin(
  tenantId: string,
): Promise<Tenant | null> {
  try {
    const response = await api.get<Tenant>(`/admin/tenants/${tenantId}`);
    return response.data;
  } catch {
    // Silenciamos o erro — se não tem permissão, retornamos null
    // e o sistema usa a estratégia de discovery em vez desta
    return null;
  }
}

// =============================================================================
// FUNÇÃO: clearModulesCache
// =============================================================================
// O QUE FAZ:
//   Remove o cache de módulos, forçando nova descoberta na próxima chamada.
//   Útil quando um admin muda as permissões do tenant e quer que o usuário
//   veja as mudanças imediatamente (sem esperar os 5 minutos do TTL).
// =============================================================================
export function clearModulesCache(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(ACTIVE_MODULES_KEY);
  }
}

// =============================================================================
// FUNÇÕES AUXILIARES: Cache
// =============================================================================

function getModulesFromCache(): Module[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(ACTIVE_MODULES_KEY);
    if (!raw) return null;
    const cached: CachedModules = JSON.parse(raw);
    // Verifica se o cache expirou
    if (Date.now() - cached.cachedAt > MODULES_CACHE_TTL) {
      localStorage.removeItem(ACTIVE_MODULES_KEY);
      return null;
    }
    return cached.modules;
  } catch {
    return null;
  }
}

function saveModulesToCache(modules: Module[]): void {
  if (typeof window === "undefined") return;
  const cache: CachedModules = {
    modules,
    cachedAt: Date.now(),
  };
  localStorage.setItem(ACTIVE_MODULES_KEY, JSON.stringify(cache));
}
