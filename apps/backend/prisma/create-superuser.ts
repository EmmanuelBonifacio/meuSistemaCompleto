import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const p = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash("EmanuelAdmin2014", 12);

  const user = await p.adminUser.upsert({
    where: { email: "emmanuel@admin.com" },
    update: { passwordHash: hash, name: "Emmanuel", role: "superadmin" },
    create: {
      email: "emmanuel@admin.com",
      passwordHash: hash,
      name: "Emmanuel",
      role: "superadmin",
    },
  });

  console.log("✅ Superusuário criado:", user.email, "| role:", user.role);
}

main().finally(() => p.$disconnect());
