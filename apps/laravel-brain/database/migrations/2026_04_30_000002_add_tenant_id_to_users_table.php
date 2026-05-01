<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Adiciona tenant_id à tabela users padrão do Laravel.
 *
 * Necessário para o isolamento multitenant: todos os models
 * que usam scopeForTenant() dependem desta coluna.
 *
 * tenant_id é nullable para permitir usuários "super-admin"
 * sem tenant associado (ex: administrador da plataforma).
 */
return new class () extends Migration {
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->string('tenant_id', 36)
                ->nullable()
                ->after('id')
                ->index()
                ->comment('UUID do tenant do usuário — null para super-admins');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->dropColumn('tenant_id');
        });
    }
};
