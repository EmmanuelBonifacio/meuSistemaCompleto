-- CreateTable
CREATE TABLE IF NOT EXISTS "fleet_tenant_configs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" TEXT NOT NULL,
    "traccar_user" TEXT,
    "traccar_password" TEXT,
    "fleetbase_api_key" TEXT,
    "fleetms_token" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "fleet_tenant_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "fleet_tenant_configs_tenant_id_key" ON "fleet_tenant_configs"("tenant_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_fleet_tenant_configs_tenant_id" ON "fleet_tenant_configs"("tenant_id");

-- AddForeignKey
ALTER TABLE "fleet_tenant_configs"
    ADD CONSTRAINT "fleet_tenant_configs_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE;
