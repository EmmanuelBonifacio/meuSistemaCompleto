<?php

declare(strict_types=1);

namespace App\Http\Controllers\ErpNext;

use App\Http\Controllers\Controller;
use App\Models\TenantExternalModule;
use App\Services\ErpNextService;
use Illuminate\Http\Request;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;

/**
 * ErpNextController — Módulo: Controle de Operações Financeiras
 *
 * Rotas (routes/api.php):
 *   GET    /api/modules/erpnext/access     → SSO redirect (middleware: auth, erpnext.access)
 *   GET    /api/modules/erpnext/status     → status do módulo do tenant
 *   POST   /api/modules/erpnext/activate   → ativa/conecta o módulo (Fase 2)
 *   DELETE /api/modules/erpnext/deactivate → desativa o módulo
 *   GET    /api/modules/erpnext/ping       → health check da instância
 */
class ErpNextController extends Controller
{
    public function __construct(
        private readonly ErpNextService $erpNextService
    ) {}

    // =========================================================================
    // SSO — Redireciona o usuário logado diretamente para o ERPNext
    // =========================================================================

    /**
     * Gera o token SSO e redireciona para o dashboard do ERPNext.
     * O middleware ErpNextModuleAccess já garantiu que o módulo está ativo
     * e injetou a instância em $request->erpnext_module.
     */
    public function redirectToErpNext(Request $request): RedirectResponse
    {
        /** @var \App\Models\User $user */
        $user = $request->user();

        /** @var TenantExternalModule $module */
        $module = $request->get('erpnext_module');

        Log::channel('single')->info('SSO ERPNext redirect', [
            'user_id'      => $user->id,
            'tenant_id'    => $user->tenant_id,
            'instance_url' => $module->instance_url,
            'ip'           => $request->ip(),
        ]);

        $ssoUrl = $this->erpNextService->buildSsoRedirectUrl(
            module: $module,
            userEmail: $user->email,
            tenantId: $user->tenant_id,
        );

        return redirect()->away($ssoUrl);
    }

    // =========================================================================
    // STATUS — Retorna informações do módulo sem expor credenciais
    // =========================================================================

    /**
     * Retorna o status atual do módulo ERPNext do tenant.
     * Não requer middleware de acesso ativo — útil para exibir badge na UI.
     */
    public function status(Request $request): JsonResponse
    {
        /** @var \App\Models\User $user */
        $user = $request->user();

        $module = TenantExternalModule::query()
            ->forTenant($user->tenant_id)
            ->where('module_name', 'erpnext')
            ->first(['id', 'status', 'instance_url', 'provisioned_at', 'created_at']);

        if (! $module) {
            return response()->json(['status' => 'not_configured'], 200);
        }

        return response()->json([
            'status'         => $module->status,
            'instance_url'   => $module->instance_url,
            'provisioned_at' => $module->provisioned_at,
        ]);
    }

    // =========================================================================
    // ATIVAR MÓDULO — Fase 2
    // =========================================================================

    /**
     * Ativa o módulo "Controle de Operações Financeiras" para o tenant.
     *
     * Body JSON:
     * {
     *   "instance_url": "http://financeiro.test",
     *   "api_key":      "abc123",
     *   "api_secret":   "xyz789"
     * }
     */
    public function activate(Request $request): JsonResponse
    {
        /** @var \App\Models\User $user */
        $user = $request->user();

        $validated = $request->validate([
            'instance_url' => ['required', 'url', 'max:512'],
            'api_key'      => ['required', 'string', 'max:255'],
            'api_secret'   => ['required', 'string', 'max:255'],
        ]);

        $exists = TenantExternalModule::query()
            ->forTenant($user->tenant_id)
            ->where('module_name', 'erpnext')
            ->exists();

        if ($exists) {
            return response()->json([
                'message' => 'Módulo já está configurado para este tenant. Use PATCH para atualizar.',
            ], 409);
        }

        $module = TenantExternalModule::create([
            'user_id'        => $user->id,
            'tenant_id'      => $user->tenant_id,
            'module_name'    => 'erpnext',
            'instance_url'   => $validated['instance_url'],
            'api_key'        => $validated['api_key'],
            'api_secret'     => $validated['api_secret'],
            'status'         => 'active',
            'provisioned_at' => now(),
            'meta'           => [
                'module_display_name' => 'Controle de Operações Financeiras',
                'activated_by'        => $user->email,
                'activated_at'        => now()->toIso8601String(),
            ],
        ]);

        $provision = $this->erpNextService->provisionUser(
            module: $module,
            email: $user->email,
            firstName: $user->name,
        );

        return response()->json([
            'message'      => 'Módulo Controle de Operações Financeiras ativado com sucesso.',
            'status'       => $module->status,
            'instance_url' => $module->instance_url,
            'user_sync'    => $provision,
        ], 201);
    }

    // =========================================================================
    // DESATIVAR MÓDULO
    // =========================================================================

    public function deactivate(Request $request): JsonResponse
    {
        /** @var \App\Models\User $user */
        $user = $request->user();

        $module = TenantExternalModule::query()
            ->forTenant($user->tenant_id)
            ->where('module_name', 'erpnext')
            ->firstOrFail();

        $module->update(['status' => 'inactive']);

        return response()->json(['message' => 'Módulo desativado com sucesso.']);
    }

    // =========================================================================
    // PING — Health check da instância
    // =========================================================================

    public function ping(Request $request): JsonResponse
    {
        /** @var \App\Models\User $user */
        $user = $request->user();

        $module = TenantExternalModule::query()
            ->forTenant($user->tenant_id)
            ->where('module_name', 'erpnext')
            ->active()
            ->firstOrFail();

        $alive = $this->erpNextService->ping($module);

        return response()->json([
            'online'  => $alive,
            'checked' => now()->toIso8601String(),
        ]);
    }
}
