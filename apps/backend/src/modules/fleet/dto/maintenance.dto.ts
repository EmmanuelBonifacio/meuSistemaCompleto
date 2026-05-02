// =============================================================================
// src/modules/fleet/dto/maintenance.dto.ts
// =============================================================================
// O QUE FAZ:
//   Define e valida com Zod todos os dados de entrada relacionados a
//   manutenção de veículos (ordens de serviço, documentos, combustível).
// =============================================================================

import { z } from "zod";

// =============================================================================
// SCHEMA: Criar Ordem de Manutenção
// =============================================================================
export const CreateMaintenanceSchema = z.object({
  vehicle_id: z.string().uuid("ID de veículo inválido"),

  type: z.enum([
    "preventive", // Manutenção preventiva agendada
    "corrective", // Manutenção corretiva (quebra)
    "inspection", // Inspeção periódica
    "fuel", // Abastecimento
    "document", // Vencimento de documento (CRLV, seguro, etc.)
  ]),

  description: z
    .string({ required_error: "Descrição é obrigatória" })
    .min(5)
    .max(1000)
    .trim(),

  scheduled_date: z.string().datetime().optional().nullable(),
  completed_date: z.string().datetime().optional().nullable(),

  cost: z.number().min(0, "Custo não pode ser negativo").optional().nullable(),

  odometer_km: z.number().int().min(0).optional().nullable(),

  // ID externo no Fleetms
  fleetms_record_id: z.string().max(255).optional().nullable(),

  status: z
    .enum(["scheduled", "in_progress", "completed", "cancelled"])
    .default("scheduled"),

  notes: z.string().max(2000).trim().optional(),
});

// =============================================================================
// SCHEMA: Atualizar Manutenção
// =============================================================================
export const UpdateMaintenanceSchema = CreateMaintenanceSchema.partial().omit({
  vehicle_id: true,
});

// =============================================================================
// SCHEMA: Parâmetros de rota
// =============================================================================
export const MaintenanceParamsSchema = z.object({
  id: z.string().uuid("ID de manutenção inválido"),
});

// =============================================================================
// SCHEMA: Filtros de listagem
// =============================================================================
export const ListMaintenanceQuerySchema = z.object({
  vehicle_id: z.string().uuid().optional(),
  status: z
    .enum(["scheduled", "in_progress", "completed", "cancelled"])
    .optional(),
  type: z
    .enum(["preventive", "corrective", "inspection", "fuel", "document"])
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// =============================================================================
// TIPOS INFERIDOS
// =============================================================================
export type CreateMaintenanceInput = z.infer<typeof CreateMaintenanceSchema>;
export type UpdateMaintenanceInput = z.infer<typeof UpdateMaintenanceSchema>;
export type MaintenanceParams = z.infer<typeof MaintenanceParamsSchema>;
export type ListMaintenanceQuery = z.infer<typeof ListMaintenanceQuerySchema>;
