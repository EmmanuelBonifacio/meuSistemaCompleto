-- AlterTable
ALTER TABLE "tenant_erp_parcelas" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- CreateTable
CREATE TABLE "fleet_tenant_configs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "traccar_user" TEXT,
    "traccar_password" TEXT,
    "fleetbase_api_key" TEXT,
    "fleetms_token" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fleet_tenant_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fleet_tenant_configs_tenant_id_key" ON "fleet_tenant_configs"("tenant_id");

-- AddForeignKey
ALTER TABLE "fleet_tenant_configs" ADD CONSTRAINT "fleet_tenant_configs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
