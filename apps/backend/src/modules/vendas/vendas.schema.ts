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
// SCHEMA: Categorias padrão (fallback quando o tenant não definiu as suas)
// =============================================================================
export const CATEGORIAS_VENDA_PADRAO = [
  "lancamentos",
  "mais-vendidos",
  "promocoes",
  "eletronicos",
  "vestuario",
  "acessorios",
  "servicos",
] as const;

// Categoria é string livre — o tenant define as suas no painel de Configurações.
export type CategoriaVenda = string;

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

  // Categoria define em qual fileira o produto aparece no catálogo.
  // Aceita qualquer string — o tenant define as suas no painel.
  categoria: z
    .string({ required_error: "Categoria é obrigatória" })
    .min(1, "Categoria não pode ser vazia")
    .max(60, "Categoria deve ter no máximo 60 caracteres")
    .trim(),

  // URL da imagem — preenchida após o upload (string vazia vira null; omitido fica undefined)
  foto_url: z.preprocess(
    (v) => {
      if (v === undefined) return undefined;
      if (v === "" || v === null) return null;
      return v;
    },
    z.union([z.string().url("URL de foto inválida"), z.null()]).optional(),
  ),

  ativo: z.boolean().default(true),

  // Controla se o produto aparece na lista de "Lançamentos"
  destaque: z.boolean().default(false),

  // Ordem de exibição dentro da categoria (menor = primeiro)
  ordem: z.number().int().min(0).default(0),

  // Se true, preço e preço promocional são por 1 kg (venda por peso)
  vendido_por_peso: z.boolean().default(false),
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
// Helpers: query do Fastify pode vir string | string[]; vazio/ inválido quebra Zod
// e gerava 500. Normalizamos antes de validar.
// =============================================================================
function primeiroQuery(
  v: unknown,
): string | number | boolean | null | undefined {
  if (v === undefined || v === null) return undefined;
  if (Array.isArray(v)) return v[0] as string | number | boolean | undefined;
  return v as string | number | boolean;
}

function intPositivoComDefault(
  v: unknown,
  padrao: number,
  max: number,
): number {
  const raw = primeiroQuery(v);
  if (raw === undefined || raw === null || raw === "")
    return padrao;
  const n =
    typeof raw === "number" ? raw : parseInt(String(raw).trim(), 10);
  if (!Number.isFinite(n) || n < 1) return padrao;
  return Math.min(max, n);
}

/** Slug a partir de `request.query` (string | string[] do Fastify). */
export function slugFromQueryValue(v: unknown): string | undefined {
  const x = primeiroQuery(v);
  if (x === undefined || x === null) return undefined;
  const s = String(x).trim();
  return s || undefined;
}

/** Slug público na query (?slug=) — alinhado ao que o Prisma/tenant usam, evita lixo na pesquisa. */
const TENANT_SLUG_QUERY_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_TENANT_SLUG_LENGTH = 100;

export function isValidPublicTenantSlug(slug: string): boolean {
  return (
    slug.length > 0 &&
    slug.length <= MAX_TENANT_SLUG_LENGTH &&
    TENANT_SLUG_QUERY_REGEX.test(slug)
  );
}

// =============================================================================
// SCHEMA: Query string para listagem do catálogo (rota pública)
// =============================================================================
export const ListarProdutosVendaQuerySchema = z.object({
  categoria: z.preprocess(
    (v) => {
      const x = primeiroQuery(v);
      if (x === undefined || x === null) return undefined;
      return String(x).trim() || undefined;
    },
    z.string().max(50).optional(),
  ),

  busca: z.preprocess(
    (v) => {
      const x = primeiroQuery(v);
      if (x === undefined || x === null) return undefined;
      return String(x).trim() || undefined;
    },
    z.string().max(100).optional(),
  ),

  page: z.preprocess(
    (v) => intPositivoComDefault(v, 1, 1_000_000),
    z.number().int().min(1),
  ),

  limit: z.preprocess(
    (v) => intPositivoComDefault(v, 50, 500),
    z.number().int().min(1).max(500),
  ),

  // slug é consumido pelo publicTenantResolver antes do handler; ignorado aqui
  slug: z.preprocess(
    (v) => {
      const x = primeiroQuery(v);
      if (x === undefined || x === null) return undefined;
      return String(x) || undefined;
    },
    z.string().optional(),
  ),
});

// =============================================================================
// SCHEMA: Item de pedido (produto + quantidade no carrinho)
// =============================================================================
export const ItemPedidoSchema = z
  .object({
    produto_id: z.string().uuid("ID de produto inválido"),
    nome: z.string().min(1),
    preco: z.number().min(0),
    quantidade: z.number().positive("Quantidade deve ser positiva"),
    vendido_por_peso: z.boolean().default(false),
  })
  .superRefine((data, ctx) => {
    if (data.vendido_por_peso) {
      if (data.quantidade < 0.05) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["quantidade"],
          message: "Peso mínimo é 0,05 kg",
        });
      }
      if (data.quantidade > 99) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["quantidade"],
          message: "Peso máximo é 99 kg",
        });
      }
      const r = Math.round(data.quantidade * 100) / 100;
      if (Math.abs(r - data.quantidade) > 0.0001) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["quantidade"],
          message: "Peso: no máximo 2 casas decimais",
        });
      }
    } else {
      if (!Number.isInteger(data.quantidade)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["quantidade"],
          message: "Quantidade deve ser um número inteiro",
        });
      } else if (data.quantidade < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["quantidade"],
          message: "Quantidade mínima é 1",
        });
      }
    }
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
  status: z.preprocess(
    (v) => {
      const x = primeiroQuery(v);
      if (x === undefined || x === null || x === "") return undefined;
      return String(x);
    },
    z
      .enum(["pendente", "pago", "enviado", "finalizado", "cancelado"], {
        invalid_type_error: "Status de filtro inválido",
      })
      .optional(),
  ),
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

  // Categorias personalizadas definidas pelo tenant no painel admin.
  // Armazenadas como JSON no banco. Ex: ["Roupas", "Calçados", "Acessórios"]
  categorias: z
    .array(z.string().min(1).max(50).trim())
    .max(20, "Máximo de 20 categorias")
    .optional()
    .nullable(),
});

export type AtualizarVendasConfigInput = z.infer<
  typeof AtualizarVendasConfigSchema
>;
