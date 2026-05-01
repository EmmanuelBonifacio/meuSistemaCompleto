<?php

declare(strict_types=1);

/**
 * config/services.php — Credenciais de serviços externos.
 *
 * Adicionar ao .env:
 *   ERPNEXT_SSO_SECRET=seu_segredo_compartilhado_com_frappe
 *   ERPNEXT_DEFAULT_URL=http://financeiro.test
 *
 * No Frappe (bench), configurar o mesmo segredo:
 *   bench --site financeiro.test set-config brain_sso_secret "seu_segredo_compartilhado_com_frappe"
 */

return [

    // =========================================================================
    // Serviços padrão Laravel (manter para compatibilidade com pacotes)
    // =========================================================================
    'mailgun'  => ['domain' => env('MAILGUN_DOMAIN'), 'secret' => env('MAILGUN_SECRET'), 'endpoint' => env('MAILGUN_ENDPOINT', 'api.mailgun.net')],
    'postmark' => ['token' => env('POSTMARK_TOKEN')],
    'ses'      => ['key' => env('AWS_ACCESS_KEY_ID'), 'secret' => env('AWS_SECRET_ACCESS_KEY'), 'region' => env('AWS_DEFAULT_REGION', 'us-east-1')],

    // =========================================================================
    // ERPNext — Módulo: Controle de Operações Financeiras
    // =========================================================================
    'erpnext' => [
        /**
         * Segredo compartilhado para assinatura dos tokens SSO.
         * DEVE ser idêntico ao brain_sso_secret no site_config.json do Frappe.
         * Mínimo recomendado: 32 caracteres aleatórios.
         */
        'sso_secret'   => env('ERPNEXT_SSO_SECRET'),

        /**
         * URL padrão da instância ERPNext (usada como fallback em testes).
         */
        'default_url'  => env('ERPNEXT_DEFAULT_URL', 'http://financeiro.test'),

        /**
         * TTL do token SSO em segundos (sobrescreve a constante do Service se necessário).
         */
        'sso_token_ttl' => (int) env('ERPNEXT_SSO_TOKEN_TTL', 60),
    ],

];
