<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Migration: tenant_external_modules
 *
 * Finalidade:
 *   Armazena as instâncias de módulos externos (como ERPNext) ativadas
 *   por cada tenant. Cada linha representa "tenant X ativou o módulo Y
 *   e sua instância está em instance_url".
 *
 * Design Decisions:
 *   - tenant_id é UUID string, compatível com sistemas multitenant que
 *     não usam FK direta para a tabela de usuários.
 *   - api_secret NÃO é armazenado em texto puro: o Model usa o cast
 *     'encrypted' do Laravel (AES-256-CBC via APP_KEY).
 *   - status usa ENUM para garantir integridade no nível do banco.
 *   - meta é JSON flexível para dados que variam por módulo.
 *   - softDeletes: desativar um módulo não apaga o histórico.
 */
return new class () extends Migration {
    public function up(): void
    {
        Schema::create('tenant_external_modules', function (Blueprint $table): void {
            // ----------------------------------------------------------------
            // Identificação
            // ----------------------------------------------------------------
            $table->id();

            $table->foreignId('user_id')
                ->constrained('users')
                ->cascadeOnDelete()
                ->comment('Usuário dono/responsável pelo módulo');

            $table->string('tenant_id', 36)
                ->index()
                ->comment('UUID do tenant – chave de isolamento multitenant');

            // ----------------------------------------------------------------
            // Módulo
            // ----------------------------------------------------------------
            $table->string('module_name', 64)
                ->comment('Slug do módulo externo: erpnext, omie, etc.');

            $table->string('instance_url', 512)
                ->comment('URL base da instância (ex: https://financeiro.app.test)');

            // ----------------------------------------------------------------
            // Credenciais de API (server-to-server)
            // ----------------------------------------------------------------
            $table->string('api_key', 255)
                ->nullable()
                ->comment('API Key pública do ERPNext para comunicação server-to-server');

            $table->text('api_secret')
                ->nullable()
                ->comment('API Secret criptografado via APP_KEY (cast encrypted no Model)');

            // ----------------------------------------------------------------
            // Status do ciclo de vida
            // ----------------------------------------------------------------
            $table->enum('status', ['provisioning', 'active', 'inactive', 'error'])
                ->default('provisioning')
                ->index()
                ->comment('Estado atual do módulo');

            // ----------------------------------------------------------------
            // Metadados flexíveis
            // ----------------------------------------------------------------
            $table->json('meta')
                ->nullable()
                ->comment('Dados extras em JSON: versão ERPNext, admin_email, etc.');

            $table->timestamp('provisioned_at')
                ->nullable()
                ->comment('Quando o provisionamento foi concluído com sucesso');

            // ----------------------------------------------------------------
            // Timestamps padrão Laravel + Soft Delete
            // ----------------------------------------------------------------
            $table->timestamps();
            $table->softDeletes();

            // ----------------------------------------------------------------
            // Índice único: um tenant não pode ter o mesmo módulo duplicado
            // ----------------------------------------------------------------
            $table->unique(['tenant_id', 'module_name'], 'uq_tenant_module');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tenant_external_modules');
    }
};
