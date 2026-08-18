-- ============================================================
-- CORREÇÃO DE MIGRAÇÃO — 2026-08-18
-- Problema: Erro 500 no POST /api/auth/login
--   "The column admin_users.password_hash does not exist"
--   A migration Prisma 20260817000000 nunca foi aplicada ao
--   banco de produção no Supabase.
-- ============================================================
-- Execute este script no Supabase SQL Editor:
--   Dashboard → SQL Editor → New Query → Colar → Run
-- ============================================================

-- 1. Adicionar coluna password_hash em admin_users (idempotente)
ALTER TABLE "admin_users" ADD COLUMN IF NOT EXISTS "password_hash" TEXT;

-- 2. Colunas que a migration 0_init não criou mas o schema Prisma espera
--    em eventos (caso não existam no banco):
ALTER TABLE "eventos" ADD COLUMN IF NOT EXISTS "cidade" TEXT;
ALTER TABLE "eventos" ADD COLUMN IF NOT EXISTS "data_inicio_inscricao" TIMESTAMPTZ;
ALTER TABLE "eventos" ADD COLUMN IF NOT EXISTS "data_fim_inscricao" TIMESTAMPTZ;

-- 3. Tabela refresh_tokens (não está na 0_init mas é usada pelo auth)
CREATE TABLE IF NOT EXISTS "refresh_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "revoked_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- 4. Índices para refresh_tokens (idempotente)
CREATE INDEX IF NOT EXISTS "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");
CREATE INDEX IF NOT EXISTS "refresh_tokens_token_hash_idx" ON "refresh_tokens"("token_hash");

-- ============================================================
-- 5. Verificação: este SELECT deve mostrar 1 row com password_hash = TEXT
-- ============================================================
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'admin_users'
  AND column_name = 'password_hash';

-- ============================================================
-- PRÓXIMO PASSO: Após executar este SQL, faça um novo deploy
-- na Vercel (ou limpe o cache do serverless function) para que
-- o NestJS reconecte ao banco com a coluna correta.
-- ============================================================
