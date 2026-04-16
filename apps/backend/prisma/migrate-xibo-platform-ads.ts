// =============================================================================
// prisma/migrate-xibo-platform-ads.ts
// =============================================================================
// Cria xibo_platform_ads em todos os schemas de tenant existentes.
// COMO: npm run db:migrate:xibo-ads
// =============================================================================

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({ log: ["error"] });

function validateSchemaName(schemaName: string): void {
  const SAFE_SCHEMA_REGEX = /^[a-z_][a-z0-9_]*$/;
  if (!SAFE_SCHEMA_REGEX.test(schemaName)) {
    throw new Error(`[SEGURANÇA] Nome de schema inválido: "${schemaName}"`);
  }
}

function buildSql(schemaName: string): string[] {
  return [
    `CREATE TABLE IF NOT EXISTS "${schemaName}".xibo_platform_ads (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      titulo VARCHAR(255) NOT NULL,
      video_url TEXT NOT NULL,
      duracao_segundos INTEGER NOT NULL DEFAULT 30
        CONSTRAINT xibo_platform_ads_duration_check
        CHECK (duracao_segundos > 0 AND duracao_segundos <= 86400),
      thumb_url TEXT,
      ativo BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_xibo_platform_ads_ativo
      ON "${schemaName}".xibo_platform_ads (ativo)
      WHERE ativo = true`,
  ];
}

async function migrateTenant(schemaName: string, name: string): Promise<void> {
  validateSchemaName(schemaName);
  const statements = buildSql(schemaName);
  await prisma.$transaction(async (tx) => {
    for (const sql of statements) {
      await tx.$executeRawUnsafe(sql);
    }
  });
  console.log(`  ✅ "${name}" (${schemaName}) → xibo_platform_ads`);
}

async function main() {
  console.log("MIGRAÇÃO: xibo_platform_ads em todos os tenants\n");
  const tenants = await prisma.tenant.findMany({
    select: { id: true, name: true, schemaName: true },
    orderBy: { name: "asc" },
  });
  if (tenants.length === 0) {
    console.log("Nenhum tenant.");
    return;
  }
  for (const t of tenants) {
    try {
      await migrateTenant(t.schemaName, t.name);
    } catch (e) {
      console.error(`  ❌ ${t.name}:`, e);
      process.exit(1);
    }
  }
  console.log("\nConcluído.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
