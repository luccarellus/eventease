import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const email = 'lucassantos.-@outlook.com';
  const rawPassword = 'presidente123'; // Senha padrão recomendada
  const hashedPassword = await bcrypt.hash(rawPassword, 10);

  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (!existingUser) {
    await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        fullName: 'Lucas Santos',
        role: 'admin',
      },
    });
    console.log(`✅ Usuário administrador criado com sucesso:`);
    console.log(`- E-mail: ${email}`);
    console.log(`- Senha: ${rawPassword}`);
  } else {
    // Garante que o usuário existente tenha a role admin
    await prisma.user.update({
      where: { email },
      data: { role: 'admin' },
    });
    console.log(`ℹ️ O usuário administrador ${email} já existe. A role foi atualizada para 'admin'.`);
  }
}

main()
  .catch((e) => {
    console.error('Erro ao executar o seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
