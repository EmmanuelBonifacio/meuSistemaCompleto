<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Models\TenantExternalModule;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Middleware: ErpNextModuleAccess
 *
 * Responsabilidade:
 *   Garante que o usuário autenticado tem o módulo ERPNext com status "active"
 *   antes de permitir o redirecionamento SSO.
 *
 * Uso nas rotas:
 *   Route::get('/modules/erpnext/access', ...)->middleware('erpnext.access');
 *
 * Rejeita com 403 se:
 *   - Módulo não existe para o tenant
 *   - Status não é "active" (ex: provisioning, inactive, error)
 */
class ErpNextModuleAccess
{
    public function handle(Request $request, Closure $next): Response
    {
        /** @var \App\Models\User $user */
        $user = $request->user();

        $tenantId = $user->tenant_id ?? null;

        if (! $tenantId) {
            return response()->json([
                'message' => 'Usuário não está associado a um tenant.',
            ], Response::HTTP_FORBIDDEN);
        }

        $module = TenantExternalModule::query()
            ->forTenant($tenantId)
            ->where('module_name', 'erpnext')
            ->first();

        if (! $module) {
            return response()->json([
                'message' => 'Módulo ERPNext não encontrado para este tenant.',
            ], Response::HTTP_FORBIDDEN);
        }

        if (! $module->isActive()) {
            return response()->json([
                'message' => "Módulo ERPNext não está ativo. Status atual: {$module->status}.",
            ], Response::HTTP_FORBIDDEN);
        }

        // Injeta o módulo na request para uso no controller sem nova query.
        $request->merge(['erpnext_module' => $module]);

        return $next($request);
    }
}
