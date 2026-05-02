// =============================================================================
// src/modules/fleet/dto/dispatch.dto.ts
// =============================================================================
// O QUE FAZ:
//   Define e valida com Zod todos os dados de entrada relacionados a
//   despacho de veículos e ordens de serviço (via Fleetbase).
// =============================================================================

import { z } from "zod";

// =============================================================================
// SCHEMA: Criar Despacho / Ordem de Serviço
// =============================================================================
export const CreateDispatchSchema = z.object({
  driver_id: z.string().uuid("ID de motorista inválido"),
  vehicle_id: z.string().uuid("ID de veículo inválido"),

  // Endereço de origem
  origin_address: z
    .string({ required_error: "Endereço de origem é obrigatório" })
    .min(5)
    .max(500)
    .trim(),

  origin_lat: z.number().min(-90).max(90).optional(),
  origin_lng: z.number().min(-180).max(180).optional(),

  // Endereço de destino
  destination_address: z
    .string({ required_error: "Endereço de destino é obrigatório" })
    .min(5)
    .max(500)
    .trim(),

  destination_lat: z.number().min(-90).max(90).optional(),
  destination_lng: z.number().min(-180).max(180).optional(),

  // Detalhes da carga/serviço
  description: z.string().max(1000).trim().optional(),
  scheduled_at: z.string().datetime().optional().nullable(),

  priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),

  // ID externo no Fleetbase
  fleetbase_order_id: z.string().max(255).optional().nullable(),
});

// =============================================================================
// SCHEMA: Atualizar status do despacho
// =============================================================================
export const UpdateDispatchStatusSchema = z.object({
  status: z.enum([
    "pending",
    "assigned",
    "dispatched",
    "in_transit",
    "arrived",
    "completed",
    "cancelled",
  ]),
  notes: z.string().max(500).optional(),
});

// =============================================================================
// SCHEMA: Parâmetros de rota
// =============================================================================
export const DispatchParamsSchema = z.object({
  id: z.string().uuid("ID de despacho inválido"),
});

// =============================================================================
// SCHEMA: Filtros de listagem
// =============================================================================
export const ListDispatchQuerySchema = z.object({
  driver_id: z.string().uuid().optional(),
  vehicle_id: z.string().uuid().optional(),
  status: z
    .enum([
      "pending",
      "assigned",
      "dispatched",
      "in_transit",
      "arrived",
      "completed",
      "cancelled",
    ])
    .optional(),
  priority: z.enum(["low", "medium", "high", "critical"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// =============================================================================
// TIPOS INFERIDOS
// =============================================================================
export type CreateDispatchInput = z.infer<typeof CreateDispatchSchema>;
export type UpdateDispatchStatusInput = z.infer<
  typeof UpdateDispatchStatusSchema
>;
export type DispatchParams = z.infer<typeof DispatchParamsSchema>;
export type ListDispatchQuery = z.infer<typeof ListDispatchQuerySchema>;
