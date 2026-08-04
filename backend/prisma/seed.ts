import * as dotenv from 'dotenv';
import * as path from 'path';
import { randomBytes } from 'crypto';
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { createClient } from '@supabase/supabase-js';

const connectionString = process.env.DATABASE_URL;
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ADMIN_EMAIL = process.env.ADMIN_SEED_EMAIL || 'lucassantos.-@outlook.com';
const ADMIN_PASSWORD = process.env.ADMIN_SEED_PASSWORD;

function generateSecurePassword(length = 32): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  const bytes = randomBytes(length);
  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset[bytes[i] % charset.length];
  }
  return password;
}

async function main() {
  const email = ADMIN_EMAIL;

  const existingUser = await prisma.adminUser.findUnique({
    where: { email },
  });

  if (!existingUser) {
    const rawPassword = ADMIN_PASSWORD || generateSecurePassword();
    const generated = !ADMIN_PASSWORD;

    console.log(`Criando usuário administrador no Supabase Auth (${email})...`);

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password: rawPassword,
      email_confirm: true,
      user_metadata: {
        full_name: 'Administrador',
      },
      app_metadata: {
        role: 'admin',
      },
    });

    if (error) {
      console.error('❌ Erro ao criar usuário no Supabase Auth:', error.message);
      return;
    }

    console.log(`✅ Usuário administrador criado com sucesso no Supabase Auth: ${data.user?.id}`);
    if (generated) {
      // Nunca logar a senha. Defina ADMIN_SEED_PASSWORD no ambiente e rode o seed de novo
      // se precisar de uma senha conhecida.
      console.log('ℹ️  A senha foi gerada aleatoriamente e NÃO é exibida por segurança.');
      console.log('ℹ️  Para definir uma senha conhecida, configure ADMIN_SEED_PASSWORD antes de rodar o seed.');
      console.log('ℹ️  Você pode redefinir a senha via painel do Supabase Auth.');
    }
  } else {
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
