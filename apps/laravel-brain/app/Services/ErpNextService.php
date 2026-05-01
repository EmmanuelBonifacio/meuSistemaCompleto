<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\TenantExternalModule;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

/**
 * ErpNextService — Orquestrador da integração com ERPNext.
 *
 * Responsabilidades:
 *   1. Gerar token JWT temporário para SSO (Single Sign-On)
 *   2. Provisionar novo site ERPNext via API do Frappe (bench new-site)
 *   3. Criar/atualizar usuário no ERPNext com permissões totais
 *   4. Validar conectividade com uma instância ERPNext
 *
 * Fluxo de SSO:
 *   Usuário clica no módulo (Laravel)
 *     → Este service gera JWT assinado com APP_KEY (TTL: 60s)
 *     → Laravel redireciona para: {instance_url}/api/method/brain_sso.auth.login?token={jwt}
 *     → Custom App Frappe valida JWT → frappe.set_user() → usuário está logado
 */
class ErpNextService
{
    /**
     * Tempo de vida do token SSO em segundos.
     * 60 segundos é suficiente para o redirect HTTP sem janela de replay longa.
     */
    private const SSO_TOKEN_TTL = 60;

    // =========================================================================
    // SSO — Single Sign-On
    // =========================================================================

    /**
     * Gera um JWT temporário (one-time use) para autenticação silenciosa no ERPNext.
     *
     * Compatível com o validador _validate_and_decode_jwt() do brain_sso/auth.py.
     *
     * Payload:
     *   - sub  → email do usuário (identificador no ERPNext)
     *   - tid  → tenant_id
     *   - iat  → issued at (Unix timestamp)
     *   - exp  → expira em SSO_TOKEN_TTL segundos
     *   - jti  → UUID único (previne replay)
     *
     * Algoritmo: HS256 (HMAC-SHA256) com APP_KEY como segredo.
     * O segredo deve ser idêntico ao brain_sso_secret configurado no Frappe.
     *
     * @param  string  $userEmail  Email do usuário (deve existir no ERPNext)
     * @param  string  $tenantId   UUID do tenant
     * @return string              JWT assinado no formato header.payload.signature
     */
    public function generateSsoToken(string $userEmail, string $tenantId): string
    {
        $now = now()->timestamp;

        // Base64Url encode (sem padding, substituindo + e /)
        $b64url = static fn (string $data): string =>
            rtrim(strtr(base64_encode($data), '+/', '-_'), '=');

        $header  = $b64url(json_encode(['alg' => 'HS256', 'typ' => 'JWT'], JSON_UNESCAPED_UNICODE));
        $payload = $b64url(json_encode([
            'sub' => $userEmail,
            'tid' => $tenantId,
            'iat' => $now,
            'exp' => $now + self::SSO_TOKEN_TTL,
            'jti' => Str::uuid()->toString(),
        ], JSON_UNESCAPED_UNICODE));

        // O segredo SSO é separado do APP_KEY para isolamento de responsabilidade.
        // Configure ERPNEXT_SSO_SECRET no .env e brain_sso_secret no site_config.json do Frappe.
        $secret    = config('services.erpnext.sso_secret') ?? config('app.key');
        $signature = $b64url(hash_hmac('sha256', "{$header}.{$payload}", $secret, true));

        return "{$header}.{$payload}.{$signature}";
    }

    /**
     * Monta a URL de redirecionamento SSO completa para o ERPNext.
     *
     * Exemplo de saída:
     *   https://financeiro.app.test/api/method/brain_sso.auth.login?token=xxx
     *
     * @param  TenantExternalModule  $module    Instância do módulo ativo
     * @param  string                $userEmail Email do usuário autenticado
     * @param  string                $tenantId  UUID do tenant
     * @return string                URL completa para redirect
     */
    public function buildSsoRedirectUrl(
        TenantExternalModule $module,
        string $userEmail,
        string $tenantId
    ): string {
        $token = $this->generateSsoToken($userEmail, $tenantId);

        return rtrim($module->instance_url, '/') .
               '/api/method/brain_sso.auth.login?' .
               http_build_query(['token' => $token]);
    }

    // =========================================================================
    // PROVISIONAMENTO
    // =========================================================================

    /**
     * Cria um novo site no ERPNext via API administrativa do Frappe.
     *
     * Esta operação é ASSÍNCRONA no mundo real: criação de site demora ~2-5 min.
     * Em produção, deve ser executada via Laravel Job (Queue).
     *
     * @param  string  $siteName    ex: "financeiro-tenant123.app.test"
     * @param  string  $adminEmail  Email do admin do novo site
     * @param  string  $adminPass   Senha gerada para o admin
     * @return array{success: bool, message: string, data: mixed}
     */
    public function provisionSite(
        string $siteName,
        string $adminEmail,
        string $adminPass
    ): array {
        // TODO Fase 3: Implementar chamada real ao endpoint de provisionamento.
        // O Frappe não tem uma API HTTP pública para bench new-site.
        // Estratégias possíveis:
        //   a) SSH + bench new-site (via spatie/ssh)
        //   b) Container sidecar que expõe endpoint REST de provisionamento
        //   c) Frappe Cloud API (se usar Frappe Cloud)
        //
        // Por ora retorna stub para validar o fluxo na Fase 1.

        return [
            'success' => false,
            'message' => 'Provisionamento não implementado — aguardando Fase 3.',
            'data'    => compact('siteName', 'adminEmail'),
        ];
    }

    /**
     * Cria ou atualiza usuário no ERPNext com todas as roles atribuídas.
     *
     * Usa a REST API padrão do Frappe: POST /api/resource/User
     *
     * @param  TenantExternalModule  $module     Módulo com credenciais da instância
     * @param  string                $email      Email do usuário a criar/atualizar
     * @param  string                $firstName  Primeiro nome
     * @return array{success: bool, message: string}
     */
    public function provisionUser(
        TenantExternalModule $module,
        string $email,
        string $firstName
    ): array {
        // TODO Fase 3: As roles abaixo são as padrão do ERPNext para "All Access".
        // Ajustar conforme módulos instalados na instância.
        $roles = [
            ['role' => 'System Manager'],
            ['role' => 'Accounts Manager'],
            ['role' => 'Stock Manager'],
            ['role' => 'Purchase Manager'],
            ['role' => 'Sales Manager'],
            ['role' => 'HR Manager'],
        ];

        $response = Http::withHeaders([
            'Authorization' => 'token ' . $module->api_key . ':' . $module->api_secret,
            'Content-Type'  => 'application/json',
        ])->post(rtrim($module->instance_url, '/') . '/api/resource/User', [
            'email'      => $email,
            'first_name' => $firstName,
            'send_welcome_email' => 0,
            'roles'      => $roles,
        ]);

        if ($response->successful()) {
            return ['success' => true, 'message' => "Usuário {$email} provisionado com sucesso."];
        }

        return [
            'success' => false,
            'message' => "Falha ao provisionar usuário: " . $response->body(),
        ];
    }

    // =========================================================================
    // UTILITÁRIOS
    // =========================================================================

    /**
     * Verifica se uma instância ERPNext está acessível e autenticada corretamente.
     * Usa o endpoint /api/method/frappe.auth.get_logged_user para health check.
     */
    public function ping(TenantExternalModule $module): bool
    {
        try {
            $response = Http::timeout(5)
                ->withHeaders([
                    'Authorization' => 'token ' . $module->api_key . ':' . $module->api_secret,
                ])
                ->get(rtrim($module->instance_url, '/') . '/api/method/frappe.auth.get_logged_user');

            return $response->successful();
        } catch (\Throwable) {
            return false;
        }
    }
}
