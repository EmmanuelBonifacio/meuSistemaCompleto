import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.module.upsert({
    where: { name: "fleet" },
    update: {
      displayName: "Gestão de Frota",
      description:
        "Rastreamento GPS em tempo real, despacho de motoristas e controle de manutenção de veículos.",
    },
    create: {
      name: "fleet",
      displayName: "Gestão de Frota",
      description:
        "Rastreamento GPS em tempo real, despacho de motoristas e controle de manutenção de veículos.",
    },
  });
  console.log("✅ Módulo fleet inserido com ID:", result.id);
}

main()
  .catch((e) => {
    console.error("❌ Erro:", e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
