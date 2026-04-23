// =============================================================================
// src/types/vendas.types.ts
// =============================================================================
// O QUE FAZ:
//   Interfaces TypeScript que espelham as entidades do módulo SalesWpp.
//   Garantem type-safety entre o frontend e o backend.
//
// COMO USAR:
//   import type { ProdutoVenda, PedidoVenda, ItemCarrinho } from '@/types/vendas.types'
// =============================================================================

// =============================================================================
// TIPOS: Categorias disponíveis
// =============================================================================
// Mapa de labels para as categorias padrão. Categorias customizadas do tenant
// usam o próprio nome digitado como label (exibido diretamente).
export const CATEGORIAS_LABEL: Record<string, string> = {
  lancamentos: "Lançamentos",
  "mais-vendidos": "Mais Vendidos",
  promocoes: "Promoções",
  eletronicos: "Eletrônicos",
  vestuario: "Vestuário",
  acessorios: "Acessórios",
  servicos: "Serviços",
};

// Categoria é string livre — o tenant define as suas no painel de Configurações.
export type CategoriaVenda = string;

// =============================================================================
// INTERFACE: ProdutoVenda — produto exibido no catálogo de vendas
// =============================================================================
export interface ProdutoVenda {
  id: string;
  nome: string;
  descricao: string | null;
  preco: number;
  preco_promocional: number | null;
  categoria: CategoriaVenda;
  foto_url: string | null;
  ativo: boolean;
  destaque: boolean;
  ordem: number;
  /** true = preço é por 1 kg */
  vendido_por_peso: boolean;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// INTERFACE: Resposta paginada da listagem de produtos
// =============================================================================
export interface ProdutoVendaListResponse {
  data: ProdutoVenda[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// =============================================================================
// INTERFACE: Input para criar ou editar produto (formulário admin)
// =============================================================================
export interface ProdutoVendaInput {
  nome: string;
  descricao?: string;
  preco: number;
  preco_promocional?: number | null;
  categoria: CategoriaVenda;
  ativo?: boolean;
  destaque?: boolean;
  ordem?: number;
  vendido_por_peso?: boolean;
}

// =============================================================================
// INTERFACE: Item do carrinho de compras
// =============================================================================
export interface ItemCarrinho {
  produto_id: string;
  nome: string;
  preco: number;
  /** Unidades (inteiro) ou kg (decimal) se vendido_por_peso */
  quantidade: number;
  foto_url: string | null;
  vendido_por_peso: boolean;
}

// =============================================================================
// INTERFACE: Status possíveis de um pedido
// =============================================================================
export type StatusPedido =
  | "pendente"
  | "pago"
  | "enviado"
  | "finalizado"
  | "cancelado";

export const STATUS_PEDIDO_LABEL: Record<StatusPedido, string> = {
  pendente: "Pendente",
  pago: "Pago",
  enviado: "Enviado",
  finalizado: "Finalizado",
  cancelado: "Cancelado",
};

export const STATUS_PEDIDO_COR: Record<StatusPedido, string> = {
  pendente: "bg-yellow-100 text-yellow-800",
  pago: "bg-green-100 text-green-800",
  enviado: "bg-blue-100 text-blue-800",
  finalizado: "bg-gray-100 text-gray-800",
  cancelado: "bg-red-100 text-red-800",
};

// =============================================================================
// INTERFACE: Pedido via WhatsApp
// =============================================================================
export interface PedidoVenda {
  id: string;
  numero_whatsapp: string | null;
  itens_json: ItemCarrinho[];
  total: number;
  status: StatusPedido;
  notas: string | null;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// INTERFACE: Resumo para o dashboard do admin
// =============================================================================
export interface ResumoVendas {
  totalPedidos: number;
  totalValor: number;
  porStatus: Record<string, number>;
}

// =============================================================================
// INTERFACE: Mensagem do chat fake
// =============================================================================
export interface MensagemChat {
  id: string;
  autor: "visitante" | "atendente";
  texto: string;
  timestamp: Date;
}
