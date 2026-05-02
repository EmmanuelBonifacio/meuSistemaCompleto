// =============================================================================
// prisma/seed.ts
// =============================================================================
// O QUE FAZ:
//   Popula o banco de dados com os dados INICIAIS necessários para o sistema
//   funcionar. Este script é executado com `npm run db:seed`.
//
// POR QUE TER UM SEED?
//   Alguns dados são fixos e precisam existir antes de qualquer funcionalidade:
//   - O catálogo de módulos disponíveis (estoque, financeiro, etc.)
//   - Um usuário administrador padrão
//   Sem esses dados, o sistema não funciona. O seed garante que qualquer
//   novo ambiente (dev, staging, produção) comece com o estado correto.
//
// IMPORTANTE: Este script usa 'upsert' em vez de 'create' para ser idempotente,
//   ou seja, pode ser executado múltiplas vezes sem duplicar dados.
// =============================================================================

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Iniciando seed do banco de dados...");

  // ---------------------------------------------------------------------------
  // SEED: Catálogo de Módulos
  // ---------------------------------------------------------------------------
  // Aqui definimos TODOS os módulos que nosso sistema oferece.
  // Para adicionar um novo módulo ao sistema, basta adicionar uma entrada aqui
  // e criar a pasta correspondente em /src/modules/.
  // ---------------------------------------------------------------------------
  const modules = [
    {
      name: "estoque",
      displayName: "Gestão de Estoque",
      description:
        "Controle de produtos, categorias, entradas e saídas de estoque.",
    },
    {
      name: "financeiro",
      displayName: "Módulo Financeiro",
      description:
        "Gestão de contas a pagar, contas a receber e fluxo de caixa.",
    },
    {
      name: "vendas",
      displayName: "VendasWhats",
      description:
        "Catálogo de vendas público com checkout direto via WhatsApp.",
    },
    {
      name: "rh",
      displayName: "Recursos Humanos",
      description:
        "Gestão de funcionários, folha de pagamento e ponto eletrônico.",
    },
    {
      name: "tv",
      displayName: "Controle de Telas",
      description:
        "Digital Signage: gerenciar Smart TVs e monitores da rede, enviar conteúdo via UPnP/DIAL.",
    },
    {
      name: "fleet",
      displayName: "Gestão de Frota",
      description:
        "Rastreamento GPS em tempo real, despacho de motoristas e controle de manutenção de veículos.",
    },
  ];

  console.log("📦 Criando módulos do catálogo...");

  for (const module of modules) {
    // upsert = "insert or update"
    // Se o módulo já existe (baseado no 'name'), apenas atualiza.
    // Se não existe, cria. Isso torna o seed seguro para executar várias vezes.
    await prisma.module.upsert({
      where: { name: module.name },
      update: {
        displayName: module.displayName,
        description: module.description,
      },
      create: module,
    });
    console.log(`  ✅ Módulo '${module.displayName}' configurado.`);
  }

  // ---------------------------------------------------------------------------
  // SEED: Usuário Admin Padrão
  // ---------------------------------------------------------------------------
  // Cria o primeiro usuário administrador para acessar o painel /admin.
  // ATENÇÃO: Em produção, ALTERE a senha imediatamente após o primeiro deploy!
  // ---------------------------------------------------------------------------
  console.log("👤 Criando usuário administrador padrão...");

  // Hash bcrypt da senha com custo 12 (padrão OWASP recomendado).
  // O bcrypt é um algoritmo projetado para ser LENTO, dificultando ataques
  // de força bruta. Diferente do SHA-256, o bcrypt inclui salt automático.
  const defaultPasswordHash = await bcrypt.hash(
    "admin123_TROQUE_EM_PRODUCAO",
    12,
  );

  await prisma.adminUser.upsert({
    where: { email: "admin@sistema.com" },
    // IMPORTANTE: atualizamos o hash sempre que o seed roda.
    // Isso garante que se trocarmos o hash de SHA-256 para bcrypt,
    // o banco será atualizado na próxima execução do seed.
    update: { passwordHash: defaultPasswordHash },
    create: {
      email: "admin@sistema.com",
      passwordHash: defaultPasswordHash,
      name: "Administrador do Sistema",
      role: "superadmin",
    },
  });
  console.log("  ✅ Admin criado: admin@sistema.com");

  console.log("\n✨ Seed concluído com sucesso!");
  console.log("⚠️  LEMBRE-SE: Altere a senha do admin em produção!");
}

main()
  .catch((error) => {
    console.error("❌ Erro durante o seed:", error);
    process.exit(1);
  })
  .finally(async () => {
    // Sempre desconecta o Prisma ao final, independente de sucesso ou erro.
    await prisma.$disconnect();
  });
