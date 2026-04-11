// =============================================================================
// prisma/migrate-add-auth-tables.ts
// =============================================================================
// O QUE FAZ:
//   Script de migração MANUAL para tenants que foram provisionados ANTES
//   do módulo de autenticação ser adicionado ao sistema.
//
//   Adiciona as tabelas 'users' e 'refresh_tokens' a TODOS os schemas de
//   tenant existentes no banco, de forma segura e idempotente.
//
// QUANDO EXECUTAR:
//   Uma única vez, após atualizar o código com o módulo de auth.
//   Pode ser executado múltiplas vezes sem risco (IF NOT EXISTS garante isso).
//
// COMO EXECUTAR:
//   npx tsx prisma/migrate-add-auth-tables.ts
//
// SEGURANÇA:
//   - Usa CREATE TABLE IF NOT EXISTS → idempotente (seguro de rodar várias vezes)
//   - Valida o schemaName antes de usar em SQL (regex whitelist)
//   - Executa dentro de uma transação por tenant (falha em um não afeta outros)
//   - Exibe relatório detalhado de sucesso/falha por tenant
// =============================================================================

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  log: ["error"],
});

// =============================================================================
// VALIDAÇÃO DE SEGURANÇA — Igual ao prisma.ts principal
// =============================================================================
// Previne SQL injection ao usar o schemaName diretamente em strings SQL.
// =============================================================================
function validateSchemaName(schemaName: string): void {
  const SAFE_SCHEMA_REGEX = /^[a-z_][a-z0-9_]*$/;
  if (!SAFE_SCHEMA_REGEX.test(schemaName)) {
    throw new Error(
      `[SEGURANÇA] Nome de schema inválido: "${schemaName}". ` +
        `Apenas letras minúsculas, números e underscores são permitidos.`,
    );
  }
}

// =============================================================================
// SQL DAS NOVAS TABELAS — Espelho exato do tenant.provisioner.ts
// =============================================================================
// Mantemos o SQL aqui (duplicado) para que este script seja AUTOSSUFICIENTE.
// Se o provisioner mudar, este script precisa ser atualizado manualmente.
// =============================================================================
function buildAuthTablesSql(schemaName: string): string[] {
  return [
    // -----------------------------------------------------------------
    // TABELA: users
    // -----------------------------------------------------------------
    `CREATE TABLE IF NOT EXISTS "${schemaName}".users (
      id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      email         VARCHAR(255) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      name          VARCHAR(100),
      role          VARCHAR(50)  NOT NULL DEFAULT 'user',
      is_active     BOOLEAN      NOT NULL DEFAULT true,
      created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      CONSTRAINT users_email_unique UNIQUE (email)
    )`,

    `CREATE INDEX IF NOT EXISTS idx_users_email
      ON "${schemaName}".users (email)`,

    `CREATE INDEX IF NOT EXISTS idx_users_active
      ON "${schemaName}".users (is_active)
      WHERE is_active = true`,

    // -----------------------------------------------------------------
    // TABELA: refresh_tokens
    // -----------------------------------------------------------------
    `CREATE TABLE IF NOT EXISTS "${schemaName}".refresh_tokens (
      id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id     UUID         NOT NULL,
      token_hash  VARCHAR(64)  NOT NULL,
      expires_at  TIMESTAMPTZ  NOT NULL,
      is_revoked  BOOLEAN      NOT NULL DEFAULT false,
      ip_address  VARCHAR(45),
      user_agent  TEXT,
      created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      CONSTRAINT refresh_tokens_token_hash_unique UNIQUE (token_hash),
      CONSTRAINT refresh_tokens_user_fk
        FOREIGN KEY (user_id) REFERENCES "${schemaName}".users(id)
        ON DELETE CASCADE
    )`,

    `CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash
      ON "${schemaName}".refresh_tokens (token_hash)`,

    `CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user
      ON "${schemaName}".refresh_tokens (user_id)`,
  ];
}

// =============================================================================
// FUNÇÃO PRINCIPAL: migrateTenant
// =============================================================================
// Executa a migração para UM tenant dentro de uma transação isolada.
// Se falhar, apenas este tenant é afetado. Os outros continuam.
// =============================================================================
async function migrateTenant(
  schemaName: string,
  tenantName: string,
): Promise<void> {
  validateSchemaName(schemaName);

  const statements = buildAuthTablesSql(schemaName);

  await prisma.$transaction(async (tx) => {
    for (const sql of statements) {
      await tx.$executeRawUnsafe(sql);
    }
  });

  console.log(
    `  ✅ "${tenantName}" (${schemaName}) → tabelas users e refresh_tokens criadas/verificadas`,
  );
}

// =============================================================================
// EXECUÇÃO PRINCIPAL
// =============================================================================
async function main() {
  console.log("=".repeat(65));
  console.log("  MIGRAÇÃO: Adicionando tabelas de autenticação aos tenants  ");
  console.log("=".repeat(65));
  console.log("");

  // Busca todos os tenants cadastrados no banco (schema public)
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
    console.log("⚠️  Nenhum tenant encontrado no banco de dados.");
    console.log(
      "   Execute o seed e provisione tenants antes de rodar esta migração.",
    );
    return;
  }

  console.log(`📋 ${tenants.length} tenant(s) encontrado(s):\n`);
  tenants.forEach((t, i) =>
    console.log(`   ${i + 1}. ${t.name} → schema: ${t.schemaName}`),
  );
  console.log("");
  console.log("🔄 Iniciando migração...\n");

  // Resultado da migração por tenant
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
        `  ❌ "${tenant.name}" (${tenant.schemaName}) → FALHA: ${message}`,
      );
      results.failed.push({ name: tenant.name, error: message });
    }
  }

  // Relatório final
  console.log("");
  console.log("=".repeat(65));
  console.log("  RELATÓRIO FINAL");
  console.log("=".repeat(65));
  console.log(`  ✅ Sucesso: ${results.success.length} tenant(s)`);
  console.log(`  ❌ Falha:   ${results.failed.length} tenant(s)`);

  if (results.failed.length > 0) {
    console.log("\n  Tenants com falha:");
    results.failed.forEach((f) => console.log(`    - ${f.name}: ${f.error}`));
  }

  console.log("");

  if (results.failed.length === 0) {
    console.log(
      "🎉 Migração concluída com sucesso! Todos os tenants têm as novas tabelas.",
    );
    console.log(
      "   Próximo passo: crie um usuário inicial com o script de seed de usuários.",
    );
  } else {
    console.log(
      "⚠️  Migração concluída com erros. Verifique os tenants acima.",
    );
    process.exit(1);
  }
}

// =============================================================================
// PONTO DE ENTRADA
// =============================================================================
main()
  .catch((err) => {
    console.error("\n💥 Erro fatal na migração:");
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
