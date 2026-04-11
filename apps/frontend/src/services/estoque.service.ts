// =============================================================================
// src/services/estoque.service.ts
// =============================================================================
// O QUE FAZ:
//   Camada de comunicação com os endpoints do módulo de Estoque.
//   Segue o mesmo padrão do tv.service.ts — separação de responsabilidades.
//
// MAPEAMENTO DE ROTAS (estoque.routes.ts no Backend):
//   GET    /estoque/produtos         → listProducts()
//   GET    /estoque/produtos/:id     → getProduct()
//   POST   /estoque/produtos         → createProduct()
//   PATCH  /estoque/produtos/:id     → updateProduct()
//   DELETE /estoque/produtos/:id     → deleteProduct()
// =============================================================================

import api from "./api";
import type { Produto, ProdutoListResponse, ProdutoInput } from "@/types/api";

// Parâmetros de busca/filtro para a listagem de produtos
export interface ListProductsParams {
  page?: number;
  limit?: number;
  search?: string;
  onlyActive?: boolean;
}

// =============================================================================
// FUNÇÃO: listProducts
// =============================================================================
// Busca a lista de produtos com paginação e filtros opcionais.
// =============================================================================
export async function listProducts(
  params: ListProductsParams = {},
): Promise<ProdutoListResponse> {
  const response = await api.get<ProdutoListResponse>("/estoque/produtos", {
    params: {
      page: params.page ?? 1,
      limit: params.limit ?? 20,
      search: params.search,
      onlyActive: params.onlyActive ?? true,
    },
  });
  return response.data;
}

// =============================================================================
// FUNÇÃO: getProduct
// =============================================================================
export async function getProduct(id: string): Promise<Produto> {
  const response = await api.get<Produto>(`/estoque/produtos/${id}`);
  return response.data;
}

// =============================================================================
// FUNÇÃO: createProduct
// =============================================================================
export async function createProduct(
  data: ProdutoInput,
): Promise<{ mensagem: string; produto: Produto }> {
  const response = await api.post<{ mensagem: string; produto: Produto }>(
    "/estoque/produtos",
    data,
  );
  return response.data;
}

// =============================================================================
// FUNÇÃO: updateProduct
// =============================================================================
export async function updateProduct(
  id: string,
  data: Partial<ProdutoInput>,
): Promise<{ mensagem: string; produto: Produto }> {
  const response = await api.patch<{ mensagem: string; produto: Produto }>(
    `/estoque/produtos/${id}`,
    data,
  );
  return response.data;
}

// =============================================================================
// FUNÇÃO: deleteProduct
// =============================================================================
// Desativa o produto (soft delete — o registro permanece no banco).
// =============================================================================
export async function deleteProduct(id: string): Promise<void> {
  await api.delete(`/estoque/produtos/${id}`);
}
