// =============================================================================
// src/modules/fleet/dto/vehicle.dto.ts
// =============================================================================
// O QUE FAZ:
//   Define e valida com Zod todos os dados de entrada relacionados a veículos.
//   Inclui schemas para criação, atualização e filtros de listagem.
// =============================================================================

import { z } from "zod";

// =============================================================================
// SCHEMA: Criar Veículo
// =============================================================================
export const CreateVehicleSchema = z.object({
  plate: z
    .string({ required_error: "Placa é obrigatória" })
    .min(5, "Placa inválida")
    .max(20, "Placa muito longa")
    .trim()
    .toUpperCase(),

  brand: z.string().max(100).trim().optional(),
  model: z.string().max(100).trim().optional(),
  year: z
    .number()
    .int()
    .min(1900)
    .max(new Date().getFullYear() + 1)
    .optional(),
  color: z.string().max(50).trim().optional(),

  // IDs externos nos engines (preenchidos após registro nos engines)
  traccar_device_id: z.number().int().positive().optional().nullable(),
  fleetbase_asset_id: z.string().max(255).optional().nullable(),
  fleetms_vehicle_id: z.string().max(255).optional().nullable(),

  status: z
    .enum(["active", "inactive", "maintenance", "decommissioned"])
    .default("active"),
});

// =============================================================================
// SCHEMA: Atualizar Veículo (todos os campos opcionais)
// =============================================================================
export const UpdateVehicleSchema = CreateVehicleSchema.partial().omit({
  plate: true,
});

// =============================================================================
// SCHEMA: Parâmetros de rota (/:id)
// =============================================================================
export const VehicleParamsSchema = z.object({
  id: z.string().uuid("ID de veículo inválido"),
});

// =============================================================================
// SCHEMA: Filtros de listagem
// =============================================================================
export const ListVehiclesQuerySchema = z.object({
  status: z
    .enum(["active", "inactive", "maintenance", "decommissioned"])
    .optional(),
  busca: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// =============================================================================
// TIPOS INFERIDOS
// =============================================================================
export type CreateVehicleInput = z.infer<typeof CreateVehicleSchema>;
export type UpdateVehicleInput = z.infer<typeof UpdateVehicleSchema>;
export type VehicleParams = z.infer<typeof VehicleParamsSchema>;
export type ListVehiclesQuery = z.infer<typeof ListVehiclesQuerySchema>;
