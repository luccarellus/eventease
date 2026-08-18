-- AlterTable: autenticação local (sem Supabase Auth)
-- Adiciona coluna password_hash para suporte a login com bcrypt.
ALTER TABLE "admin_users" ADD COLUMN IF NOT EXISTS "password_hash" TEXT;
