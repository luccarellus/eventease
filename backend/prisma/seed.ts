import * as dotenv from 'dotenv';
import * as path from 'path';
import { randomBytes } from 'crypto';
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import * as bcrypt from 'bcrypt';

const connectionString = process.env.DATABASE_URL;
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

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
  console.log('🌱 Inicializando seed com Multi-Tenancy e RBAC...');

  // 1. Garantir existência do Tenant padrão ("Instituto Olhar Jovem")
  let defaultTenant = await prisma.tenant.findFirst({
    where: { OR: [{ slug: 'default' }, { slug: 'olhar-jovem' }] },
  });

  if (!defaultTenant) {
    console.log('🏢 Criando organização principal (Instituto Olhar Jovem)...');
    defaultTenant = await prisma.tenant.create({
      data: {
        name: 'Instituto Olhar Jovem',
        slug: 'olhar-jovem',
        isActive: true,
      },
    });
    console.log(`✅ Organização principal criada: ${defaultTenant.id} (${defaultTenant.name})`);
  } else {
    console.log(`ℹ️ Organização principal existente: ${defaultTenant.id} (${defaultTenant.name})`);
  }

  // 2. Garantir usuário Super Administrador
  const email = ADMIN_EMAIL;
  const existingUser = await prisma.adminUser.findUnique({
    where: { email },
  });

  if (!existingUser) {
    const rawPassword = ADMIN_PASSWORD || generateSecurePassword();
    const generated = !ADMIN_PASSWORD;
    const passwordHash = await bcrypt.hash(rawPassword, 10);

    console.log(`Criando usuário super administrador (${email})...`);

    const user = await prisma.adminUser.create({
      data: {
        id: crypto.randomUUID(),
        email,
        fullName: 'Super Administrador',
        role: 'super_admin',
        tenantId: defaultTenant.id,
        passwordHash,
      },
    });

    console.log(`✅ Super Administrador criado com sucesso: ${user.id}`);
    if (generated) {
      console.log('ℹ️  A senha foi gerada aleatoriamente e NÃO é exibida por segurança.');
      console.log('ℹ️  Para definir uma senha conhecida, configure ADMIN_SEED_PASSWORD antes de rodar o seed.');
    }
  } else {
    await prisma.adminUser.update({
      where: { email },
      data: {
        role: 'super_admin',
        tenantId: defaultTenant.id,
        ...(ADMIN_PASSWORD
          ? { passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 10) }
          : {}),
      },
    });
    console.log(`ℹ️ O usuário administrador ${email} foi atualizado para 'super_admin' vinculado à organização principal.`);
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
