// =============================================================================
// src/modules/fleet/fleet.middleware.ts
// =============================================================================
// O QUE FAZ:
//   Verifica se o módulo 'fleet' está ativo no plano do tenant.
//   É um alias semântico de requireModule('fleet') — usado nas rotas do módulo.
//
// COMO USAR:
//   import { fleetModuleGuard } from './fleet.middleware';
//   fastify.get('/fleet/algo', { preHandler: fleetModuleGuard }, handler);
//
// FLUXO:
//   Request → tenantMiddleware (identifica tenant) → fleetModuleGuard (verifica módulo) → handler
// =============================================================================

import { tenantMiddleware } from "../../core/middleware/tenant.middleware";
import { requireModule } from "../../core/middleware/module.middleware";

/**
 * Array de preHandlers que toda rota do módulo Fleet deve usar.
 * Garante que:
 * 1. O tenant está autenticado (tenantMiddleware)
 * 2. O módulo 'fleet' está ativo no plano do tenant (requireModule)
 */
export const fleetModuleGuard = [
  tenantMiddleware,
  requireModule("fleet"),
] as const;
