<?php

declare(strict_types=1);

namespace Tests\Unit\Services;

use App\Models\TenantExternalModule;
use App\Services\ErpNextService;
use PHPUnit\Framework\TestCase;

/**
 * Testes unitários do ErpNextService — Fase 2
 *
 * Validam:
 *   1. Estrutura do JWT gerado (3 partes, header/payload válidos)
 *   2. Payload contém os campos obrigatórios (sub, tid, exp, jti)
 *   3. Expiração correta (SSO_TOKEN_TTL = 60s)
 *   4. Construção correta da URL de redirect SSO
 *
 * Executar: php artisan test --filter ErpNextServiceTest
 */
class ErpNextServiceTest extends TestCase
{
    private ErpNextService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = new ErpNextService();
    }

    public function test_jwt_has_three_parts(): void
    {
        $token  = $this->service->generateSsoToken('user@test.com', 'tenant-uuid-123');
        $parts  = explode('.', $token);

        $this->assertCount(3, $parts, 'JWT deve ter exatamente 3 partes separadas por ponto.');
    }

    public function test_jwt_payload_contains_required_fields(): void
    {
        $email    = 'financeiro@empresa.com';
        $tenantId = 'abc-123-def';

        $token   = $this->service->generateSsoToken($email, $tenantId);
        $parts   = explode('.', $token);

        // Base64Url decode do payload (segunda parte)
        $padding = 4 - strlen($parts[1]) % 4;
        $payload = json_decode(base64_decode(strtr($parts[1], '-_', '+/') . str_repeat('=', $padding)), true);

        $this->assertSame($email,    $payload['sub'], 'Campo sub deve ser o email.');
        $this->assertSame($tenantId, $payload['tid'], 'Campo tid deve ser o tenant_id.');
        $this->assertArrayHasKey('exp', $payload, 'Payload deve ter campo exp.');
        $this->assertArrayHasKey('iat', $payload, 'Payload deve ter campo iat.');
        $this->assertArrayHasKey('jti', $payload, 'Payload deve ter campo jti (anti-replay).');
    }

    public function test_jwt_expires_in_60_seconds(): void
    {
        $before = time();
        $token  = $this->service->generateSsoToken('u@t.com', 'tid');
        $after  = time();

        $parts   = explode('.', $token);
        $padding = 4 - strlen($parts[1]) % 4;
        $payload = json_decode(base64_decode(strtr($parts[1], '-_', '+/') . str_repeat('=', $padding)), true);

        $this->assertGreaterThanOrEqual($before + 60, $payload['exp']);
        $this->assertLessThanOrEqual($after + 60,     $payload['exp']);
    }

    public function test_sso_redirect_url_is_correctly_built(): void
    {
        $module = new TenantExternalModule();
        $module->instance_url = 'http://financeiro.test';

        $url = $this->service->buildSsoRedirectUrl(
            module: $module,
            userEmail: 'admin@empresa.com',
            tenantId: 'tenant-999',
        );

        $this->assertStringStartsWith(
            'http://financeiro.test/api/method/brain_sso.auth.login?token=',
            $url
        );
    }

    public function test_two_tokens_for_same_user_are_different(): void
    {
        $token1 = $this->service->generateSsoToken('u@t.com', 'tid');
        $token2 = $this->service->generateSsoToken('u@t.com', 'tid');

        $this->assertNotSame($token1, $token2, 'Cada token deve ter JTI único.');
    }
}
