// =============================================================================
// src/modules/estoque/estoque.schema.ts
// =============================================================================
// O QUE FAZ:
//   Define e valida os dados de entrada (request body, params) usando Zod.
//   Zod é uma biblioteca TypeScript-first de validação de esquemas.
//
// POR QUE ZOD E NÃO VALIDAÇÃO MANUAL?
//   1. Type-safety: Zod infere automaticamente os tipos TypeScript dos schemas.
//      `z.infer<typeof CreateProductSchema>` gera o tipo TypeScript correto.
//   2. Mensagens de erro claras: "price must be a positive number" em vez
//      de um stack trace genérico.
//   3. Transformações: pode converter strings para números, formatar dados, etc.
//   4. Reutilizável: o mesmo schema valida tanto a entrada HTTP quanto
//      chamadas internas (serviços, filas de mensagens).
//
// PRINCÍPIO SOLID (Single Responsibility):
//   A validação fica AQUI, isolada. O controller não precisa saber como
//   validar — ele apenas chama o schema e recebe o dado limpo ou o erro.
// =============================================================================

import { z } from "zod";

// =============================================================================
// SCHEMA: Criação de Produto
// =============================================================================
export const CreateProductSchema = z.object({
  name: z
    .string({ required_error: "Nome é obrigatório" })
    .min(2, "Nome precisa ter no mínimo 2 caracteres")
    .max(255, "Nome pode ter no máximo 255 caracteres")
    .trim(), // Remove espaços em branco nas extremidades

  description: z
    .string()
    .max(1000, "Descrição pode ter no máximo 1000 caracteres")
    .optional(),

  price: z
    .number({ required_error: "Preço é obrigatório" })
    .min(0, "Preço não pode ser negativo"),

  quantity: z
    .number()
    .int("Quantidade deve ser um número inteiro")
    .min(0, "Quantidade não pode ser negativa")
    .default(0),

  sku: z.string().max(100, "SKU pode ter no máximo 100 caracteres").optional(),
  // SKU (Stock Keeping Unit) = código único de identificação do produto
});

// =============================================================================
// SCHEMA: Atualização de Produto (todos os campos são opcionais)
// =============================================================================
// .partial() transforma todos os campos em opcionais.
// Isso implementa o padrão PATCH: envie apenas o que quer alterar.
// Ex: { "price": 29.90 } atualiza apenas o preço.
export const UpdateProductSchema = CreateProductSchema.partial();

// =============================================================================
// SCHEMA: Parâmetros de URL (ex: /estoque/produtos/:id)
// =============================================================================
export const ProductParamsSchema = z.object({
  id: z
    .string({ required_error: "ID é obrigatório" })
    .uuid("ID deve ser um UUID válido"),
});

// =============================================================================
// SCHEMA: Query params para listagem (ex: /estoque/produtos?page=1&limit=10)
// =============================================================================
export const ListProductsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  // .coerce converte string "1" para number 1 (query params chegam como string)
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  onlyActive: z.coerce.boolean().default(true),
});

// =============================================================================
// TIPOS INFERIDOS: TypeScript obtém os tipos automaticamente dos schemas Zod
// =============================================================================
// POR QUE EXPORTAR OS TIPOS?
//   Permite que controllers e services usem tipagem forte sem duplicar código.
//   `CreateProductInput` é inferido do schema — se o schema mudar, o tipo muda.
export type CreateProductInput = z.infer<typeof CreateProductSchema>;
export type UpdateProductInput = z.infer<typeof UpdateProductSchema>;
export type ProductParams = z.infer<typeof ProductParamsSchema>;
export type ListProductsQuery = z.infer<typeof ListProductsQuerySchema>;
