// =============================================================================
// prisma/migrate-tenant-tv-plan.ts
// =============================================================================
// Migração MANUAL por tenant: cria tenant_tv_plan, adiciona device_role em
// tv_devices e insere linha default (CUSTOM / SELF / max_client_tvs=5).
//
// QUANDO: uma vez após deploy desta alteração, para tenants já existentes.
// COMO:   npm run db:migrate:tv-plan   (ou npx tsx prisma/migrate-tenant-tv-plan.ts)
// =============================================================================

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  log: ["error"],
});

function validateSchemaName(schemaName: string): void {
  const SAFE_SCHEMA_REGEX = /^[a-z_][a-z0-9_]*$/;
  if (!SAFE_SCHEMA_REGEX.test(schemaName)) {
    throw new Error(
      `[SEGURANÇA] Nome de schema inválido: "${schemaName}". ` +
        `Apenas letras minúsculas, números e underscores são permitidos.`,
    );
  }
}

function buildTenantTvPlanMigrationSql(schemaName: string): string[] {
  return [
    `CREATE TABLE IF NOT EXISTS "${schemaName}".tenant_tv_plan (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      plan_tier VARCHAR(10) NOT NULL
        CONSTRAINT tenant_tv_plan_tier_check
        CHECK (plan_tier IN ('THREE','FIVE','TEN','CUSTOM')),
      plan_mode VARCHAR(20) NOT NULL
        CONSTRAINT tenant_tv_plan_mode_check
        CHECK (plan_mode IN ('SELF','PARTNERSHIP','OWNER_PLACED')),
      max_client_tvs INTEGER NOT NULL DEFAULT 5,
      platform_screen_share_percent INTEGER DEFAULT 0,
      platform_profit_share_percent INTEGER DEFAULT 0,
      platform_reserved_tv_count INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )`,

    `ALTER TABLE "${schemaName}".tv_devices
      ADD COLUMN IF NOT EXISTS device_role VARCHAR(20) NOT NULL DEFAULT 'CLIENT'
      CHECK (device_role IN ('CLIENT','PLATFORM_ADS'))`,

    `INSERT INTO "${schemaName}".tenant_tv_plan (
      plan_tier, plan_mode, max_client_tvs,
      platform_screen_share_percent, platform_profit_share_percent, platform_reserved_tv_count
    )
    SELECT 'CUSTOM', 'SELF', 5, 0, 0, 0
    WHERE NOT EXISTS (SELECT 1 FROM "${schemaName}".tenant_tv_plan LIMIT 1)`,
  ];
}

async function migrateTenant(
  schemaName: string,
  tenantName: string,
): Promise<void> {
  validateSchemaName(schemaName);

  const statements = buildTenantTvPlanMigrationSql(schemaName);

  await prisma.$transaction(async (tx) => {
    for (const sql of statements) {
      await tx.$executeRawUnsafe(sql);
    }
  });

  console.log(
    `  ✅ "${tenantName}" (${schemaName}) → tenant_tv_plan + tv_devices.device_role`,
  );
}

async function main() {
  console.log("=".repeat(65));
  console.log("  MIGRAÇÃO: tenant_tv_plan e device_role (todos os tenants)   ");
  console.log("=".repeat(65));
  console.log("");

  const tenants = await prisma.tenant.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      schemaName: true,
    },
    orderBy: { name: "asc" },
  });

  if (tenants.length === 0) {
    console.log("⚠️  Nenhum tenant encontrado.");
    return;
  }

  console.log(`📋 ${tenants.length} tenant(s):\n`);
  tenants.forEach((t, i) =>
    console.log(`   ${i + 1}. ${t.name} → ${t.schemaName}`),
  );
  console.log("");
  console.log("🔄 Executando migração...\n");

  const results = {
    success: [] as string[],
    failed: [] as { name: string; error: string }[],
  };

  for (const tenant of tenants) {
    try {
      await migrateTenant(tenant.schemaName, tenant.name);
      results.success.push(tenant.name);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        `  ❌ "${tenant.name}" (${tenant.schemaName}) → ${message}`,
      );
      results.failed.push({ name: tenant.name, error: message });
    }
  }

  console.log("");
  console.log("=".repeat(65));
  console.log(`  ✅ Sucesso: ${results.success.length}`);
  console.log(`  ❌ Falha:   ${results.failed.length}`);
  if (results.failed.length > 0) {
    results.failed.forEach((f) =>
      console.log(`    - ${f.name}: ${f.error}`),
    );
    process.exit(1);
  }
  console.log("🎉 Migração concluída.");
  console.log("");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
