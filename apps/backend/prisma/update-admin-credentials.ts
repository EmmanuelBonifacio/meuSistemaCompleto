import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({ log: ["error"] });

const TARGET_EMAIL = process.env.ADMIN_EMAIL;
const TARGET_PASSWORD = process.env.ADMIN_PASSWORD;

function assertEnv() {
  if (!TARGET_EMAIL || !TARGET_PASSWORD) {
    throw new Error(
      "Defina ADMIN_EMAIL e ADMIN_PASSWORD para atualizar o superadmin.",
    );
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(TARGET_EMAIL)) {
    throw new Error("ADMIN_EMAIL inválido.");
  }

  if (TARGET_PASSWORD.length < 8) {
    throw new Error("ADMIN_PASSWORD deve ter no mínimo 8 caracteres.");
  }
}

async function main() {
  assertEnv();

  const passwordHash = await bcrypt.hash(TARGET_PASSWORD!, 12);

  // Atualiza o superadmin existente (mantém mesmo ID e mesmas permissões).
  const currentSuperadmin = await prisma.adminUser.findFirst({
    where: { role: "superadmin" },
    orderBy: { createdAt: "asc" },
  });

  if (currentSuperadmin) {
    await prisma.adminUser.update({
      where: { id: currentSuperadmin.id },
      data: {
        email: TARGET_EMAIL!,
        passwordHash,
        name: "Administrador do Sistema",
        role: "superadmin",
      },
    });
    console.log(`✅ Superadmin atualizado para: ${TARGET_EMAIL}`);
    return;
  }

  await prisma.adminUser.create({
    data: {
      email: TARGET_EMAIL!,
      passwordHash,
      name: "Administrador do Sistema",
      role: "superadmin",
    },
  });
  console.log(`✅ Superadmin criado com e-mail: ${TARGET_EMAIL}`);
}

main()
  .catch((error) => {
    console.error("❌ Erro ao atualizar credenciais do superadmin:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
