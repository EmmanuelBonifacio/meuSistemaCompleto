// Script para adicionar coluna logo_url ao tenant existente loja-teste
import { prisma } from "../src/core/database/prisma";

async function main() {
  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE tenant_loja_teste.venda_config ADD COLUMN IF NOT EXISTS logo_url VARCHAR(500)`,
    );
    console.log(
      "✅ Coluna logo_url adicionada à tenant_loja_teste.venda_config",
    );
  } catch (e) {
    console.error("❌ Erro:", (e as Error).message);
  }
}

main().finally(() => prisma.$disconnect());
