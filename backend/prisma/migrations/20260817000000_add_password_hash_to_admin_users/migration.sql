-- AlterTable: autenticação local (sem Supabase Auth)
ALTER TABLE "admin_users" ADD COLUMN "password_hash" TEXT;

-- Copiar os hashes bcrypt preservados do Supabase Auth (tabela criada pelo dump.sql).
-- Executar APÓS importar o dump.sql no novo PostgreSQL.
UPDATE "admin_users" AS au
SET "password_hash" = b.encrypted_password
FROM "supabase_auth_users_backup" AS b
WHERE b.id = au.id
  AND au."password_hash" IS NULL;
