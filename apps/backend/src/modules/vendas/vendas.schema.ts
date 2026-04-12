// =============================================================================
// src/modules/vendas/vendas.schema.ts
// =============================================================================
// O QUE FAZ:
//   Define e valida com Zod todos os dados de entrada do módulo de Vendas WPP.
//   Cobre produtos de venda, pedidos via WhatsApp e filtros de listagem.
//
// PRINCÍPIO SOLID (Single Responsibility):
//   A validação fica AQUI. Controllers e repositories não precisam saber
//   como validar — eles recebem dados já limpos e tipados.
// =============================================================================

import { z } from "zod";

// =============================================================================
// SCHEMA: Categorias disponíveis de produto
// =============================================================================
// Edite esta lista para adicionar/remover categorias no sistema.
// Lançamentos é a categoria especial que sempre aparece primeiro no catálogo.
export const CATEGORIAS_VENDA = [
  "lancamentos", // Primeira fileira — destaque especial
  "mais-vendidos",
  "promocoes",
  "eletronicos",
  "vestuario",
  "acessorios",
  "servicos",
] as const;

export type CategoriaVenda = (typeof CATEGORIAS_VENDA)[number];

// =============================================================================
// SCHEMA: Criação de Produto de Venda
// =============================================================================
export const CriarProdutoVendaSchema = z.object({
  nome: z
    .string({ required_error: "Nome é obrigatório" })
    .min(2, "Nome precisa ter no mínimo 2 caracteres")
    .max(255, "Nome pode ter no máximo 255 caracteres")
    .trim(),

  descricao: z
    .string()
    .max(2000, "Descrição pode ter no máximo 2000 caracteres")
    .optional(),

  preco: z
    .number({ required_error: "Preço é obrigatório" })
    .min(0, "Preço não pode ser negativo"),

  preco_promocional: z
    .number()
    .min(0, "Preço promocional não pode ser negativo")
    .optional()
    .nullable(),

  // Categoria define em qual fileira o produto aparece no catálogo
  categoria: z.enum(CATEGORIAS_VENDA, {
    required_error: "Categoria é obrigatória",
    invalid_type_error: "Categoria inválida",
  }),

  // URL da imagem — preenchida após o upload
  foto_url: z.string().url("URL de foto inválida").optional().nullable(),

  ativo: z.boolean().default(true),

  // Controla se o produto aparece na lista de "Lançamentos"
  destaque: z.boolean().default(false),

  // Ordem de exibição dentro da categoria (menor = primeiro)
  ordem: z.number().int().min(0).default(0),
});

// =============================================================================
// SCHEMA: Atualização de Produto (todos os campos opcionais — padrão PATCH)
// =============================================================================
export const AtualizarProdutoVendaSchema = CriarProdutoVendaSchema.partial();

// =============================================================================
// SCHEMA: Parâmetros de rota (:id)
// =============================================================================
export const ProdutoVendaParamsSchema = z.object({
  id: z.string().uuid("ID de produto inválido (deve ser UUID)"),
});

// =============================================================================
// SCHEMA: Query string para listagem do catálogo (rota pública)
// =============================================================================
export const ListarProdutosVendaQuerySchema = z.object({
  categoria: z.enum(CATEGORIAS_VENDA).optional(),

  busca: z.string().max(100).optional(),

  page: z
    .string()
    .transform(Number)
    .pipe(z.number().int().min(1))
    .optional()
    .default("1"),

  limit: z
    .string()
    .transform(Number)
    .pipe(z.number().int().min(1).max(500))
    .optional()
    .default("50"),

  // slug é consumido pelo publicTenantResolver antes do handler; ignorado aqui
  slug: z.string().optional(),
});

// =============================================================================
// SCHEMA: Item de pedido (produto + quantidade no carrinho)
// =============================================================================
export const ItemPedidoSchema = z.object({
  produto_id: z.string().uuid("ID de produto inválido"),
  nome: z.string().min(1),
  preco: z.number().min(0),
  quantidade: z.number().int().min(1, "Quantidade mínima é 1"),
});

// =============================================================================
// SCHEMA: Criação de Pedido via WhatsApp
// =============================================================================
// Salva o pedido quando o visitante clica em "Finalizar no WhatsApp".
// O backend registra o pedido para que o admin acompanhe no painel.
export const CriarPedidoSchema = z.object({
  // Número do WhatsApp do comprador (preenchido pelo link wa.me — opcional)
  numero_whatsapp: z.string().max(20).optional().nullable(),

  // Array JSON dos itens do carrinho
  itens: z
    .array(ItemPedidoSchema)
    .min(1, "O pedido deve ter pelo menos 1 item"),

  // Total calculado no frontend (validado contra a soma dos itens no backend)
  total: z.number().min(0),
});

// =============================================================================
// SCHEMA: Atualização de Status do Pedido (pelo admin)
// =============================================================================
export const AtualizarPedidoSchema = z.object({
  id: z.string().uuid("ID de pedido inválido"),

  status: z
    .enum(["pendente", "pago", "enviado", "finalizado", "cancelado"], {
      invalid_type_error: "Status inválido",
    })
    .optional(),

  // Notas do admin sobre entrega, pagamento, etc.
  notas: z.string().max(1000).optional().nullable(),
});

// =============================================================================
// SCHEMA: Parâmetros de rota para pedidos (:id)
// =============================================================================
export const PedidoParamsSchema = z.object({
  id: z.string().uuid("ID de pedido inválido (deve ser UUID)"),
});

// =============================================================================
// TIPOS INFERIDOS — evita repetir a mesma estrutura em TS
// =============================================================================
export type CriarProdutoVendaInput = z.infer<typeof CriarProdutoVendaSchema>;
export type AtualizarProdutoVendaInput = z.infer<
  typeof AtualizarProdutoVendaSchema
>;
export type ListarProdutosVendaQuery = z.infer<
  typeof ListarProdutosVendaQuerySchema
>;
export type CriarPedidoInput = z.infer<typeof CriarPedidoSchema>;
export type AtualizarPedidoInput = z.infer<typeof AtualizarPedidoSchema>;
export type ItemPedido = z.infer<typeof ItemPedidoSchema>;

// =============================================================================
// SCHEMA: Filtro de listagem de pedidos (rota admin)
// =============================================================================
export const ListarPedidosQuerySchema = z.object({
  status: z
    .enum(["pendente", "pago", "enviado", "finalizado", "cancelado"])
    .optional(),
});

// =============================================================================
// SCHEMA: Atualização das configurações do módulo
// =============================================================================
export const AtualizarVendasConfigSchema = z.object({
  whatsapp_number: z
    .string()
    .max(20, "Número WhatsApp deve ter no máximo 20 caracteres")
    .regex(/^\d+$/, "Número WhatsApp deve conter apenas dígitos")
    .optional()
    .nullable(),

  nome_loja: z
    .string()
    .max(255, "Nome da loja deve ter no máximo 255 caracteres")
    .trim()
    .optional()
    .nullable(),
});

export type AtualizarVendasConfigInput = z.infer<typeof AtualizarVendasConfigSchema>;
