"use client";
// =============================================================================
// src/hooks/useModules.ts
// =============================================================================
// O QUE FAZ:
//   Hook React que descobre e expõe a lista de módulos ativos para o tenant
//   logado. É a ponte entre o "módulo discovery" do tenant.service.ts
//   e os componentes visuais como a Sidebar.
//
// O CONCEITO "LEGO" NA PRÁTICA:
//   Este hook é o responsável pelo "Menu Dinâmico Lego".
//   Diferente de um menu estático codificado na mão, este hook:
//   1. Chama o Backend para descobrir quais módulos estão ativos
//   2. Retorna apenas esses módulos
//   3. A Sidebar renderiza dinamicamente com base nesta lista
//   4. Se o admin desativar um módulo no painel, na próxima carga
//      ele simplesmente não aparecerá no menu — sem alterar código!
//
// COMO USAR:
//   const { modules, isLoading } = useModules()
//   // modules = [{ name: 'estoque', displayName: 'Gestão de Estoque' }, ...]
// =============================================================================

import { useState, useEffect } from "react";
import { discoverActiveModules } from "@/services/tenant.service";
import type { Module } from "@/types/api";

interface UseModulesResult {
  modules: Module[]; // Lista de módulos ativos para o tenant
  isLoading: boolean; // true enquanto está buscando os módulos
  error: string | null; // Mensagem de erro, se houver
  refresh: () => void; // Força nova verificação (invalidando cache)
}

// =============================================================================
// HOOK: useModules
// =============================================================================
export function useModules(): UseModulesResult {
  const [modules, setModules] = useState<Module[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  // 'refreshKey' é um truque simples: ao incrementar este número,
  // o useEffect é acionado novamente, forçando um re-fetch dos módulos.
  const [refreshKey, setRefreshKey] = useState<number>(0);

  useEffect(() => {
    // Variável de controle para evitar atualizar estado em componentes desmontados.
    // Sem isso, se o usuário navegar para outra página enquanto a chamada
    // está em andamento, tentaríamos atualizar estado de um componente
    // que não existe mais — causando um warning de memory leak.
    let isMounted = true;

    async function fetchModules() {
      setIsLoading(true);
      setError(null);

      try {
        const activeModules = await discoverActiveModules();
        // Só atualiza o estado se o componente ainda estiver montado
        if (isMounted) {
          setModules(activeModules);
        }
      } catch (err) {
        if (isMounted) {
          const message =
            err instanceof Error
              ? err.message
              : "Erro ao carregar módulos do sistema.";
          setError(message);
          // Em caso de erro, exibimos array vazio (sidebar sem itens)
          setModules([]);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    fetchModules();

    // Função de cleanup: chamada quando o componente desmontar
    // ou quando refreshKey mudar (antes do próximo efeito rodar)
    return () => {
      isMounted = false;
    };
  }, [refreshKey]); // Re-executa quando refreshKey mudar

  // Força nova descoberta de módulos (limpa o cache e re-busca)
  function refresh() {
    // Importamos clearModulesCache dentro da função para evitar
    // dependências circulares no import
    import("@/services/tenant.service").then(({ clearModulesCache }) => {
      clearModulesCache();
      setRefreshKey((prev) => prev + 1);
    });
  }

  return { modules, isLoading, error, refresh };
}
