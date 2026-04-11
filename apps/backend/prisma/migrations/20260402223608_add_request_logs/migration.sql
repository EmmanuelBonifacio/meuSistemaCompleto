-- CreateTable
CREATE TABLE "request_logs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "status_code" INTEGER NOT NULL,
    "duration_ms" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "request_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "request_logs_tenant_id_created_at_idx" ON "request_logs"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "request_logs_tenant_id_module_idx" ON "request_logs"("tenant_id", "module");

-- AddForeignKey
ALTER TABLE "request_logs" ADD CONSTRAINT "request_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
