-- =============================================================================
-- Migration: 20260502000000_add_crm_erp
-- Adiciona tabelas administrativas de CRM e ERP no schema public.
-- Estas tabelas armazenam dados do painel admin — não dados dos tenants.
-- =============================================================================

-- CreateTable: tenant_crm
-- Dados de contato e observações do cliente (admin view)
CREATE TABLE "tenant_crm" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "nome" TEXT,
    "telefone" TEXT,
    "email" TEXT,
    "cpf_cnpj" TEXT,
    "observacoes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_crm_pkey" PRIMARY KEY ("id")
);

-- CreateTable: tenant_crm_pagamentos
-- Lançamentos financeiros do tenant (mensalidades, etc.)
CREATE TABLE "tenant_crm_pagamentos" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "data_pagamento" DATE NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "forma" TEXT NOT NULL,
    "referencia" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pendente',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_crm_pagamentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable: tenant_erp_config
-- Configuração do módulo ERP por tenant
CREATE TABLE "tenant_erp_config" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT false,
    "plano" TEXT,
    "limite_skus" INTEGER NOT NULL DEFAULT 1000,
    "modulos" JSONB NOT NULL DEFAULT '[]',
    "certificado_nfe" TEXT,
    "ambiente_nfe" TEXT NOT NULL DEFAULT 'homologacao',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_erp_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable: tenant_crm_arquivos
-- Arquivos e contratos enviados pelo admin para o tenant
CREATE TABLE "tenant_crm_arquivos" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "nome_original" TEXT NOT NULL,
    "caminho" TEXT NOT NULL,
    "mime_type" TEXT,
    "tamanho_bytes" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_crm_arquivos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenant_crm_tenant_id_key" ON "tenant_crm"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_erp_config_tenant_id_key" ON "tenant_erp_config"("tenant_id");

-- CreateIndex
CREATE INDEX "tenant_crm_pagamentos_tenant_id_idx" ON "tenant_crm_pagamentos"("tenant_id");

-- CreateIndex
CREATE INDEX "tenant_crm_arquivos_tenant_id_idx" ON "tenant_crm_arquivos"("tenant_id");

-- AddForeignKey
ALTER TABLE "tenant_crm" ADD CONSTRAINT "tenant_crm_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_crm_pagamentos" ADD CONSTRAINT "tenant_crm_pagamentos_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_erp_config" ADD CONSTRAINT "tenant_erp_config_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_crm_arquivos" ADD CONSTRAINT "tenant_crm_arquivos_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
