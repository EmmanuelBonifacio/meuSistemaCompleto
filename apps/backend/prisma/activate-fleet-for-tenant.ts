// Script: ativa o módulo fleet para o tenant informado via argumento
// Uso: npx tsx prisma/activate-fleet-for-tenant.ts teste-frota

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const tenantSlug = process.argv[2];

async function main() {
  if (!tenantSlug) {
    console.error(
      "❌ Informe o slug do tenant: npx tsx prisma/activate-fleet-for-tenant.ts <slug>",
    );
    process.exit(1);
  }

  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
  });
  if (!tenant) {
    console.error(`❌ Tenant '${tenantSlug}' não encontrado.`);
    process.exit(1);
  }

  const module = await prisma.module.findUnique({ where: { name: "fleet" } });
  if (!module) {
    console.error(
      "❌ Módulo 'fleet' não encontrado no banco. Execute add-fleet-module.ts primeiro.",
    );
    process.exit(1);
  }

  await prisma.tenantModule.upsert({
    where: { tenantId_moduleId: { tenantId: tenant.id, moduleId: module.id } },
    update: { isEnabled: true },
    create: { tenantId: tenant.id, moduleId: module.id, isEnabled: true },
  });

  console.log(
    `✅ Módulo 'fleet' ativado para tenant '${tenantSlug}' (ID: ${tenant.id})`,
  );
}

main()
  .catch((e) => {
    console.error("❌ Erro:", e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
