<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Model que representa um módulo externo ativado por um tenant.
 *
 * Campos principais:
 *  - user_id         → dono/responsável da assinatura do módulo
 *  - tenant_id       → identificador do tenant (empresa)
 *  - module_name     → slug do módulo (ex: "erpnext")
 *  - instance_url    → URL base da instância ERPNext (ex: https://financeiro.app.test)
 *  - api_key         → chave da API do ERPNext para comunicação server-to-server
 *  - api_secret      → segredo da API (armazenado criptografado via Laravel Encryption)
 *  - status          → active | inactive | provisioning | error
 *  - provisioned_at  → quando o site ERPNext foi criado com sucesso
 */
class TenantExternalModule extends Model
{
    use HasFactory;
    use SoftDeletes;

    protected $table = 'tenant_external_modules';

    protected $fillable = [
        'user_id',
        'tenant_id',
        'module_name',
        'instance_url',
        'api_key',
        'api_secret',
        'status',
        'meta',
        'provisioned_at',
    ];

    protected $hidden = [
        'api_key',
        'api_secret',
    ];

    /**
     * Colunas que são automaticamente cast.
     *
     * api_secret usa 'encrypted' → o Laravel serializa + criptografa com APP_KEY.
     * meta usa 'array' → armazena JSON flexível (ex: versão do ERPNext, admin_email).
     */
    protected function casts(): array
    {
        return [
            'api_secret'     => 'encrypted',
            'meta'           => 'array',
            'provisioned_at' => 'datetime',
        ];
    }

    // =========================================================================
    // RELACIONAMENTOS
    // =========================================================================

    public function user(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    // =========================================================================
    // SCOPES
    // =========================================================================

    /**
     * Filtra apenas módulos com status "active".
     */
    public function scopeActive(
        \Illuminate\Database\Eloquent\Builder $query
    ): \Illuminate\Database\Eloquent\Builder {
        return $query->where('status', 'active');
    }

    /**
     * Filtra módulos de um tenant específico.
     */
    public function scopeForTenant(
        \Illuminate\Database\Eloquent\Builder $query,
        string $tenantId
    ): \Illuminate\Database\Eloquent\Builder {
        return $query->where('tenant_id', $tenantId);
    }

    // =========================================================================
    // HELPERS
    // =========================================================================

    public function isActive(): bool
    {
        return $this->status === 'active';
    }

    public function isProvisioning(): bool
    {
        return $this->status === 'provisioning';
    }
}
