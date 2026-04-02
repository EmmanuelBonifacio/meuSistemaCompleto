// =============================================================================
// prisma/seed-user.ts
// =============================================================================
// O QUE FAZ:
//   Cria o primeiro usuário dentro do schema de um tenant específico.
//   Necessário para poder testar o POST /auth/login, pois a tabela
//   `users` começa vazia após o provisionamento do tenant.
//
// COMO USAR:
//   npm run db:seed:user
//
// COMO PERSONALIZAR:
//   Edite as constantes da seção "CONFIGURAÇÃO" abaixo antes de rodar.
//   Mude o TENANT_SLUG para o slug do tenant que você quer criar o usuário.
//   Mude o USER_EMAIL e USER_PASSWORD conforme necessário.
//
// O QUE ESTE SCRIPT FAZ:
//   1. Busca o tenant pelo slug na tabela public.tenants
//   2. Verifica se o usuário já existe (idempotente: não duplica)
//   3. Gera o hash bcrypt da senha informada
//   4. Insere o usuário na tabela `users` do schema do tenant
//   5. Imprime as credenciais de teste no console
// =============================================================================

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import { withTenantSchema } from "../src/core/database/prisma";

const prisma = new PrismaClient();

// =============================================================================
// ⚙️ CONFIGURAÇÃO — edite aqui antes de rodar
// =============================================================================

/** Slug do tenant onde o usuário será criado.
 *  Deve ser um tenant já existente no banco (criado via POST /admin/tenants
 *  ou via POST /dev/provisionar-tenant).
 *  Exemplo: "tv-corp", "academia-do-joao", "loja-exemplo"
 */
const TENANT_SLUG = "tv-corp";

/** E-mail do usuário a ser criado */
const USER_EMAIL = "admin@tv-corp.com";

/** Senha em texto puro — será convertida em bcrypt hash antes de salvar */
const USER_PASSWORD = "minhasenha123";

/** Nome de exibição do usuário */
const USER_NAME = "Administrador TV Corp";

/** Role do usuário dentro do tenant: "admin" ou "user" */
const USER_ROLE = "admin";

// =============================================================================
// SCRIPT PRINCIPAL
// =============================================================================

async function main() {
  console.log("👤 Script de criação de usuário de tenant\n");
  console.log(`🏢 Tenant: ${TENANT_SLUG}`);
  console.log(`📧 E-mail: ${USER_EMAIL}`);
  console.log(`🔑 Role:   ${USER_ROLE}\n`);

  // ---------------------------------------------------------------------------
  // PASSO 1: Buscar o tenant pelo slug
  // ---------------------------------------------------------------------------
  // O slug identifica de forma única o tenant. Precisamos do `schemaName`
  // para saber em qual schema PostgreSQL inserir o usuário.
  // ---------------------------------------------------------------------------
  const tenant = await prisma.tenant.findUnique({
    where: { slug: TENANT_SLUG },
    select: { id: true, name: true, schemaName: true, isActive: true },
  });

  if (!tenant) {
    console.error(`❌ Tenant com slug "${TENANT_SLUG}" não encontrado.`);
    console.error(
      "   Verifique se o tenant foi criado via POST /admin/tenants ou POST /dev/provisionar-tenant.",
    );
    process.exit(1);
  }

  console.log(
    `✅ Tenant encontrado: "${tenant.name}" (schema: ${tenant.schemaName})`,
  );

  if (!tenant.isActive) {
    console.warn(`⚠️  Atenção: o tenant "${tenant.name}" está SUSPENSO.`);
    console.warn(
      "   O login funcionará, mas o acesso às rotas de módulo será bloqueado.",
    );
  }

  // ---------------------------------------------------------------------------
  // PASSO 2: Verificar se o usuário já existe (idempotência)
  // ---------------------------------------------------------------------------
  // Se rodar o script duas vezes, não queremos duplicar o usuário.
  // Checamos antes de inserir e simplesmente informamos se já existe.
  // ---------------------------------------------------------------------------
  const existingRows = await withTenantSchema(tenant.schemaName, async (tx) => {
    return tx.$queryRawUnsafe<Array<{ id: string; email: string }>>(
      `SELECT id, email FROM users WHERE email = $1 LIMIT 1`,
      USER_EMAIL,
    );
  });

  if (existingRows.length > 0) {
    console.log(`\nℹ️  Usuário "${USER_EMAIL}" já existe neste tenant.`);
    console.log("   Nenhuma alteração foi feita.\n");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🔐 Credenciais para testar o login:");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`   Slug:  ${TENANT_SLUG}`);
    console.log(`   Email: ${USER_EMAIL}`);
    console.log(`   Senha: ${USER_PASSWORD}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    return;
  }

  // ---------------------------------------------------------------------------
  // PASSO 3: Gerar hash bcrypt da senha
  // ---------------------------------------------------------------------------
  // BCrypt com custo 12 é o padrão recomendado pelo OWASP.
  // O hash resultante é único mesmo para a mesma senha (salt aleatório).
  // Nunca salvamos a senha em texto puro no banco.
  // ---------------------------------------------------------------------------
  console.log("🔒 Gerando hash bcrypt da senha (custo 12)...");
  const passwordHash = await bcrypt.hash(USER_PASSWORD, 12);

  // ---------------------------------------------------------------------------
  // PASSO 4: Inserir o usuário no schema do tenant
  // ---------------------------------------------------------------------------
  // withTenantSchema garante que o INSERT vai para o schema correto:
  //   SET LOCAL search_path TO <schemaName>
  //   INSERT INTO users ...
  // Assim isolamos completamente os dados entre tenants.
  // ---------------------------------------------------------------------------
  const newUser = await withTenantSchema(tenant.schemaName, async (tx) => {
    const rows = await tx.$queryRawUnsafe<
      Array<{ id: string; email: string; role: string }>
    >(
      `INSERT INTO users (email, password_hash, name, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, role`,
      USER_EMAIL,
      passwordHash,
      USER_NAME,
      USER_ROLE,
    );
    return rows[0];
  });

  // ---------------------------------------------------------------------------
  // PASSO 5: Imprimir resultado e credenciais de teste
  // ---------------------------------------------------------------------------
  console.log(`\n✅ Usuário criado com sucesso!`);
  console.log(`   ID:    ${newUser.id}`);
  console.log(`   Email: ${newUser.email}`);
  console.log(`   Role:  ${newUser.role}`);

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🔐 Credenciais para testar o login:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`   Slug:  ${TENANT_SLUG}`);
  console.log(`   Email: ${USER_EMAIL}`);
  console.log(`   Senha: ${USER_PASSWORD}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("\n📋 Comando curl para testar:");
  console.log(`
curl.exe -s -X POST http://localhost:3000/auth/login \`
  -H "Content-Type: application/json" \`
  -d '{"slug":"${TENANT_SLUG}","email":"${USER_EMAIL}","password":"${USER_PASSWORD}"}'
`);
}

main()
  .catch((error) => {
    console.error("❌ Erro ao criar usuário:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
