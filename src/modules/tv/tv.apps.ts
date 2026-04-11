// =============================================================================
// src/modules/tv/tv.apps.ts
// =============================================================================
// O QUE FAZ:
//   Catálogo estático de apps de Digital Signage disponíveis no sistema.
//   Cada app é um arquivo HTML servido pelo @fastify/static em /static/apps/.
//
// POR QUE CATÁLOGO ESTÁTICO E NÃO TABELA NO BANCO?
//   Os apps do sistema são fixos — são funcionalidades do produto, não dados
//   do tenant. Mudar um app exige deploy de código, não inserção no banco.
//   Catálogo em código: type-safe, sem query ao banco, sem cache necessário.
//   FUTURAMENTE: adicionar tabela `tenant_apps` para apps personalizados
//   por tenant (ex: cardápio com dados do banco do próprio tenant).
//
// COMO ADICIONAR UM NOVO APP:
//   1. Crie o arquivo HTML em /public/apps/{slug}.html
//   2. Adicione a entrada no array TV_APPS abaixo
//   Nenhuma outra alteração é necessária — as rotas listam este array.
// =============================================================================

// =============================================================================
// TIPO: TvApp
// =============================================================================
// Estrutura que descreve cada app disponível para ser enviado a uma TV.
// `slug` é usado para construir a URL do app: /static/apps/{slug}.html
// =============================================================================
export interface TvApp {
  id: string; // Identificador único (= slug)
  name: string; // Nome exibido na interface
  description: string; // Descrição curta do que o app faz
  icon: string; // Nome do ícone Lucide (usado no frontend)
  url: string; // URL completa para enviar ao receiver.html via cast:web
  category: string; // Categoria para agrupamento na UI
}

// =============================================================================
// CATÁLOGO: TV_APPS
// =============================================================================
// Lista de todos os apps disponíveis para envio às TVs.
// A URL de cada app usa o prefixo /static/apps/ (servido pelo Fastify Static).
//
// PARÂMETROS DE URL:
//   Os apps aceitam parâmetros via query string, ex:
//   /static/apps/timer.html?duracao=300&label=Fila+de+Atendimento
//   O receiver.html envia esses params junto com o cast:web.
// =============================================================================
export const TV_APPS: TvApp[] = [
  {
    id: "timer",
    name: "Cronômetro Regressivo",
    description:
      "Exibe um timer em contagem regressiva em tela cheia. Ideal para controle de tempo em apresentações, filas ou eventos.",
    icon: "Timer",
    url: "/static/apps/timer.html",
    category: "utilidades",
  },
  {
    id: "slides",
    name: "Apresentação de Slides",
    description:
      "Exibe uma sequência de imagens em loop automático. Configure o intervalo e as URLs das imagens.",
    icon: "GalleryHorizontal",
    url: "/static/apps/slides.html",
    category: "conteudo",
  },
  {
    id: "fila",
    name: "Painel de Fila",
    description:
      "Painel de chamada de senhas ou atendimento. Atualização em tempo real via WebSocket.",
    icon: "ListOrdered",
    url: "/static/apps/fila.html",
    category: "utilidades",
  },
  {
    id: "mensagem",
    name: "Mensagem Personalizada",
    description:
      "Exibe um texto grande em tela cheia com cor de fundo configurável. Ideal para avisos e comunicados.",
    icon: "MessageSquare",
    url: "/static/apps/mensagem.html",
    category: "conteudo",
  },
  {
    id: "relogio",
    name: "Relógio Digital",
    description:
      "Relógio em tempo real com data e hora. Ideal para recepções e salas de espera.",
    icon: "Clock",
    url: "/static/apps/relogio.html",
    category: "utilidades",
  },
];

// =============================================================================
// HANDLER: listApps
// GET /tv/apps
// =============================================================================
// O QUE FAZ:
//   Retorna o catálogo completo de apps disponíveis.
//   Não requer acesso ao banco — resposta pura do código.
//
// POR QUE NÃO FILTRAR POR TENANT?
//   Todos os tenants têm acesso a todos os apps do sistema.
//   O controle granular pode ser adicionado via tabela tenant_app_permissions
//   no futuro, quando necessário.
// =============================================================================
import { FastifyRequest, FastifyReply } from "fastify";

export async function listApps(_request: FastifyRequest, reply: FastifyReply) {
  return reply.send({
    apps: TV_APPS,
    total: TV_APPS.length,
  });
}
