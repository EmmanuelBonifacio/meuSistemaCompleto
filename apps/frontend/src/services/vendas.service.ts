// =============================================================================
// src/services/vendas.service.ts
// =============================================================================
// O QUE FAZ:
//   Camada de comunicação com todos os endpoints do módulo SalesWpp.
//   Usa a instância Axios configurada em api.ts (com interceptors de JWT).
//
// MAPEAMENTO DE ROTAS (vendas.routes.ts no Backend):
//   GET    /vendas/produtos          → listProdutosCatalogo()  (público)
//   GET    /vendas/produtos/admin    → listProdutosAdmin()     (protegida)
//   POST   /vendas/produtos          → createProduto()         (protegida)
//   PATCH  /vendas/produtos/:id      → updateProduto()         (protegida)
//   DELETE /vendas/produtos/:id      → deleteProduto()         (protegida)
//   POST   /vendas/produtos/:id/foto → uploadFotoProduto()     (protegida)
//   POST   /vendas/pedidos           → createPedido()          (público)
//   GET    /vendas/pedidos           → listPedidos()           (protegida)
//   PATCH  /vendas/pedidos/:id       → updatePedido()          (protegida)
//   GET    /vendas/resumo            → getResumo()             (protegida)
// =============================================================================

import api from "./api";
import type {
  ProdutoVenda,
  ProdutoVendaListResponse,
  ProdutoVendaInput,
  PedidoVenda,
  ResumoVendas,
  ItemCarrinho,
} from "@/types/vendas.types";

// =============================================================================
// PRODUTOS — rotas públicas (catálogo)
// =============================================================================

/**
 * Lista produtos do catálogo público (apenas ativos).
 * Usada na página de vendas visível ao visitante.
 */
export async function listProdutosCatalogo(params?: {
  categoria?: string;
  busca?: string;
  page?: number;
  limit?: number;
  slug?: string;
}): Promise<ProdutoVendaListResponse> {
  const response = await api.get<ProdutoVendaListResponse>("/vendas/produtos", {
    params: { ...params, limit: params?.limit ?? 100 },
  });
  return response.data;
}

// =============================================================================
// PRODUTOS — rotas protegidas (admin)
// =============================================================================

/**
 * Lista todos os produtos (incluindo inativos) para o painel admin.
 */
export async function listProdutosAdmin(params?: {
  categoria?: string;
  busca?: string;
}): Promise<ProdutoVendaListResponse> {
  const response = await api.get<ProdutoVendaListResponse>(
    "/vendas/produtos/admin",
    { params },
  );
  return response.data;
}

/**
 * Cria um novo produto de venda.
 */
export async function createProduto(
  data: ProdutoVendaInput,
): Promise<{ mensagem: string; produto: ProdutoVenda }> {
  const response = await api.post<{ mensagem: string; produto: ProdutoVenda }>(
    "/vendas/produtos",
    data,
  );
  return response.data;
}

/**
 * Atualiza parcialmente um produto (PATCH — apenas os campos enviados).
 */
export async function updateProduto(
  id: string,
  data: Partial<ProdutoVendaInput>,
): Promise<{ mensagem: string; produto: ProdutoVenda }> {
  const response = await api.patch<{ mensagem: string; produto: ProdutoVenda }>(
    `/vendas/produtos/${id}`,
    data,
  );
  return response.data;
}

/**
 * Remove um produto permanentemente.
 */
export async function deleteProduto(
  id: string,
): Promise<{ mensagem: string; produto: ProdutoVenda }> {
  const response = await api.delete<{
    mensagem: string;
    produto: ProdutoVenda;
  }>(`/vendas/produtos/${id}`);
  return response.data;
}

/**
 * Faz upload da foto de um produto.
 * Envia como multipart/form-data — o backend salva em /uploads/vendas/.
 *
 * @param id     - UUID do produto
 * @param arquivo - File object do input type="file"
 */
export async function uploadFotoProduto(
  id: string,
  arquivo: File,
): Promise<{ mensagem: string; foto_url: string; produto: ProdutoVenda }> {
  const formData = new FormData();
  formData.append("file", arquivo);

  const response = await api.post<{
    mensagem: string;
    foto_url: string;
    produto: ProdutoVenda;
  }>(`/vendas/produtos/${id}/foto`, formData);
  return response.data;
}

// =============================================================================
// PEDIDOS
// =============================================================================

/**
 * Registra um pedido quando o visitante clica em "Finalizar no WhatsApp".
 * Chamado de forma silenciosa — o visitante nem sabe que o pedido foi salvo.
 */
export async function createPedido(dados: {
  itens: ItemCarrinho[];
  total: number;
  numero_whatsapp?: string | null;
  slug?: string;
}): Promise<{ mensagem: string; pedido: PedidoVenda }> {
  const response = await api.post<{ mensagem: string; pedido: PedidoVenda }>(
    "/vendas/pedidos",
    {
      itens: dados.itens.map((item) => ({
        produto_id: item.produto_id,
        nome: item.nome,
        preco: item.preco,
        quantidade: item.quantidade,
        vendido_por_peso: item.vendido_por_peso ?? false,
      })),
      total: dados.total,
      numero_whatsapp: dados.numero_whatsapp ?? null,
    },
    { params: dados.slug ? { slug: dados.slug } : undefined },
  );
  return response.data;
}

/**
 * Lista todos os pedidos do tenant (admin).
 */
export async function listPedidos(
  status?: string,
): Promise<{ pedidos: PedidoVenda[] }> {
  const response = await api.get<{ pedidos: PedidoVenda[] }>(
    "/vendas/pedidos",
    {
      params: status ? { status } : undefined,
    },
  );
  return response.data;
}

/**
 * Atualiza status e/ou notas de um pedido (ação do admin).
 */
export async function updatePedido(
  id: string,
  data: { status?: string; notas?: string | null },
): Promise<{ mensagem: string; pedido: PedidoVenda }> {
  const response = await api.patch<{ mensagem: string; pedido: PedidoVenda }>(
    `/vendas/pedidos/${id}`,
    data,
  );
  return response.data;
}

/**
 * Retorna métricas para o dashboard admin.
 */
export async function getResumo(): Promise<ResumoVendas> {
  const response = await api.get<ResumoVendas>("/vendas/resumo");
  return response.data;
}

// =============================================================================
// CONFIGURAÇÕES DA LOJA
// =============================================================================

/**
 * Obtém as configurações da loja.
 * - Com slug (catálogo público): chama GET /vendas/config?slug=... sem JWT
 * - Sem slug (painel admin):     chama GET /vendas/config com JWT do tenant
 */
export async function getVendasConfig(slug?: string): Promise<{
  whatsapp_number: string | null;
  nome_loja: string | null;
  logo_url: string | null;
  tenant_name: string | null;
  categorias: string[] | null;
}> {
  const response = await api.get<{
    whatsapp_number: string | null;
    nome_loja: string | null;
    logo_url: string | null;
    tenant_name: string | null;
    categorias: string[] | null;
  }>("/vendas/config", { params: slug ? { slug } : undefined });
  return response.data;
}

/**
 * Atualiza as configurações de texto da loja (apenas admin do tenant).
 */
export async function updateVendasConfig(data: {
  whatsapp_number?: string;
  nome_loja?: string;
  categorias?: string[];
}): Promise<{ mensagem: string }> {
  const response = await api.put<{ mensagem: string }>("/vendas/config", data);
  return response.data;
}

/**
 * Faz upload da logo da loja.
 * Envia como multipart/form-data.
 */
export async function uploadLogoVendas(
  arquivo: File,
): Promise<{ mensagem: string; logo_url: string }> {
  const formData = new FormData();
  formData.append("file", arquivo);
  const response = await api.post<{ mensagem: string; logo_url: string }>(
    "/vendas/config/logo",
    formData,
  );
  return response.data;
}

/**
 * Remove a logo da loja.
 */
export async function removeLogoVendas(): Promise<{ mensagem: string }> {
  const response = await api.delete<{ mensagem: string }>(
    "/vendas/config/logo",
  );
  return response.data;
}
