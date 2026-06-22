import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';

const prisma = new PrismaClient();

// Usamos a Service Role Key para poder ignorar confirmação de e-mail e criar a conta diretamente
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const email = 'lucassantos.-@outlook.com';
  const rawPassword = 'presidente123'; // Senha padrão recomendada

  // 1. Verificar se já existe na tabela de admin_users
  const existingUser = await prisma.adminUser.findUnique({
    where: { email },
  });

  if (!existingUser) {
    console.log(`Criando usuário administrador no Supabase Auth...`);
    
    // Criar o usuário no Supabase Auth usando o admin API
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password: rawPassword,
      email_confirm: true,
      user_metadata: {
        full_name: 'Lucas Santos',
      },
      app_metadata: {
        role: 'admin',
      }
    });

    if (error) {
      console.error('❌ Erro ao criar usuário no Supabase Auth:', error.message);
      return;
    }

    console.log(`✅ Usuário administrador criado com sucesso no Supabase Auth:`);
    console.log(`- E-mail: ${email}`);
    console.log(`- Senha: ${rawPassword}`);
  } else {
    // Garante que o usuário existente tenha a role admin
    await prisma.adminUser.update({
      where: { email },
      data: { role: 'admin' },
    });
    console.log(`ℹ️ O usuário administrador ${email} já existe na tabela admin_users. A role foi atualizada para 'admin'.`);
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

