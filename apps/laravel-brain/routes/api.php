<?php

/**
 * routes/api.php — Rotas da integração ERPNext
 *
 * Registrar no RouteServiceProvider ou no bootstrap/app.php do Laravel 11:
 *   ->withRouting(api: __DIR__.'/../routes/api.php')
 */

use App\Http\Controllers\Auth\AuthController;
use App\Http\Controllers\ErpNext\ErpNextController;
use App\Http\Middleware\ErpNextModuleAccess;
use Illuminate\Support\Facades\Route;

// ---- Autenticação ----
Route::post('/auth/register', [AuthController::class, 'register'])->name('auth.register');
Route::post('/auth/login',    [AuthController::class, 'login'])->name('auth.login');
Route::middleware('auth:sanctum')->post('/auth/logout', [AuthController::class, 'logout'])->name('auth.logout');

Route::middleware('auth:sanctum')->prefix('modules/erpnext')->group(function () {

    // Status do módulo (não exige módulo ativo — útil para exibir badge na UI)
    Route::get('/status', [ErpNextController::class, 'status'])
        ->name('erpnext.status');

    // Ativar o módulo "Controle de Operações Financeiras" para o tenant
    Route::post('/activate', [ErpNextController::class, 'activate'])
        ->name('erpnext.activate');

    // Desativar o módulo (soft — mantém histórico)
    Route::delete('/deactivate', [ErpNextController::class, 'deactivate'])
        ->name('erpnext.deactivate');

    // Redirecionamento SSO — exige módulo ativo (middleware ErpNextModuleAccess)
    Route::get('/access', [ErpNextController::class, 'redirectToErpNext'])
        ->middleware(ErpNextModuleAccess::class)
        ->name('erpnext.access');

    // Health check da instância
    Route::get('/ping', [ErpNextController::class, 'ping'])
        ->middleware(ErpNextModuleAccess::class)
        ->name('erpnext.ping');
});
