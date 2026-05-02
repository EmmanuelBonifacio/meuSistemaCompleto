/*
  Warnings:

  - You are about to drop the `fleet_tenant_configs` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "fleet_tenant_configs" DROP CONSTRAINT "fleet_tenant_configs_tenant_id_fkey";

-- DropTable
DROP TABLE "fleet_tenant_configs";
