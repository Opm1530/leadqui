import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function seed() {
  console.log("🍈 Criando usuário Admin do Pequi Digital...\n");

  const email = process.env.ADMIN_EMAIL || "admin@pequidigital.com.br";
  const password = process.env.ADMIN_PASSWORD || "Admin@123";
  const name = process.env.ADMIN_NAME || "Administrador";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`⚠️  Usuário ${email} já existe. Pulando seed.`);
    await prisma.$disconnect();
    return;
  }

  const password_hash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: { name, email, password_hash, role: "ADMIN" },
  });

  console.log("✅ Admin criado com sucesso!");
  console.log(`   Nome: ${user.name}`);
  console.log(`   E-mail: ${user.email}`);
  console.log(`   Senha: ${password}`);
  console.log("\n⚠️  IMPORTANTE: Troque a senha após o primeiro login!\n");

  await prisma.$disconnect();
}

seed().catch((e) => {
  console.error("❌ Erro no seed:", e);
  process.exit(1);
});
