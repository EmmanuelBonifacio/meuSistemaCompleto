// =============================================================================
// src/modules/fleet/dto/driver.dto.ts
// =============================================================================
// O QUE FAZ:
//   Define e valida com Zod todos os dados de entrada relacionados a motoristas.
// =============================================================================

import { z } from "zod";

// =============================================================================
// SCHEMA: Criar Motorista
// =============================================================================
export const CreateDriverSchema = z.object({
  name: z
    .string({ required_error: "Nome é obrigatório" })
    .min(2, "Nome precisa ter no mínimo 2 caracteres")
    .max(255)
    .trim(),

  cpf: z
    .string()
    .regex(/^\d{11}$/, "CPF deve ter 11 dígitos numéricos")
    .optional(),

  cnh: z.string().max(20).trim().optional(),
  cnh_category: z
    .enum(["A", "B", "C", "D", "E", "AB", "AC", "AD", "AE"])
    .optional(),
  cnh_expiry: z.string().datetime().optional().nullable(),

  phone: z.string().max(20).trim().optional(),
  email: z.string().email("E-mail inválido").optional().nullable(),

  // ID externo no Fleetbase
  fleetbase_driver_id: z.string().max(255).optional().nullable(),

  status: z.enum(["active", "inactive", "on_leave"]).default("active"),
});

// =============================================================================
// SCHEMA: Atualizar Motorista
// =============================================================================
export const UpdateDriverSchema = CreateDriverSchema.partial();

// =============================================================================
// SCHEMA: Parâmetros de rota
// =============================================================================
export const DriverParamsSchema = z.object({
  id: z.string().uuid("ID de motorista inválido"),
});

// =============================================================================
// SCHEMA: Filtros de listagem
// =============================================================================
export const ListDriversQuerySchema = z.object({
  status: z.enum(["active", "inactive", "on_leave"]).optional(),
  busca: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// =============================================================================
// TIPOS INFERIDOS
// =============================================================================
export type CreateDriverInput = z.infer<typeof CreateDriverSchema>;
export type UpdateDriverInput = z.infer<typeof UpdateDriverSchema>;
export type DriverParams = z.infer<typeof DriverParamsSchema>;
export type ListDriversQuery = z.infer<typeof ListDriversQuerySchema>;
