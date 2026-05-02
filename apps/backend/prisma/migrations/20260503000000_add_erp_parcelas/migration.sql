-- =============================================================================
-- Migration: 20260503000000_add_erp_parcelas
-- Adiciona tabela de parcelas do plano ERP e colunas de contrato na config.
-- =============================================================================

-- CreateTable: tenant_erp_parcelas
-- Parcelas geradas pelo admin para controlar o pagamento do plano ERP
CREATE TABLE "tenant_erp_parcelas" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "total_parcelas" INTEGER NOT NULL,
    "vencimento" DATE NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pendente',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "tenant_erp_parcelas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tenant_erp_parcelas_tenant_id_idx" ON "tenant_erp_parcelas"("tenant_id");

-- AddForeignKey
ALTER TABLE "tenant_erp_parcelas" ADD CONSTRAINT "tenant_erp_parcelas_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: tenant_erp_config — adicionar colunas de contrato
ALTER TABLE "tenant_erp_config"
    ADD COLUMN IF NOT EXISTS "data_inicio_contrato" DATE,
    ADD COLUMN IF NOT EXISTS "data_fim_contrato"    DATE,
    ADD COLUMN IF NOT EXISTS "valor_parcela"        DECIMAL(10,2);
