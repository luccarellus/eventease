-- ============================================================
-- Migration: Adicionar Multi-Tenancy e RBAC
-- Esta migration sincroniza o banco de dados com o schema
-- atual do Prisma, que inclui suporte a multi-tenancy,
-- refresh tokens para rotação de JWT e colunas adicionais.
-- ============================================================

-- 1. Criar tabela "tenants" (organizações)
CREATE TABLE "tenants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "domain" TEXT,
    "logo_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- Criar tenant padrão (usado como fallback pelo TenantMiddleware)
INSERT INTO "tenants" ("id", "name", "slug", "is_active", "created_at", "updated_at")
VALUES ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Instituto Olhar Jovem', 'olhar-jovem', true, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- Unique constraints na tabela tenants
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");
CREATE UNIQUE INDEX "tenants_domain_key" ON "tenants"("domain") WHERE "domain" IS NOT NULL;

-- 2. Adicionar tenant_id em "admin_users" (nullable inicialmente para migração segura)
ALTER TABLE "admin_users" ADD COLUMN "tenant_id" UUID;
UPDATE "admin_users" SET "tenant_id" = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
ALTER TABLE "admin_users" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "admin_users" ADD CONSTRAINT "admin_users_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "admin_users_tenant_id_idx" ON "admin_users"("tenant_id");

-- 3. Adicionar tenant_id em "participantes"
ALTER TABLE "participantes" ADD COLUMN "tenant_id" UUID;
UPDATE "participantes" SET "tenant_id" = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
ALTER TABLE "participantes" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "participantes" ADD CONSTRAINT "participantes_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "participantes_tenant_id_idx" ON "participantes"("tenant_id");

-- Ajustar constraints únicas em "participantes" para o novo modelo multi-tenant
-- Remover constraints antigas (single-column) e recriar como compostas
ALTER TABLE "participantes" DROP CONSTRAINT IF EXISTS "participantes_email_key";
ALTER TABLE "participantes" DROP CONSTRAINT IF EXISTS "participantes_codigo_key";
ALTER TABLE "participantes" ADD CONSTRAINT "unique_tenant_email" UNIQUE ("tenant_id", "email");
ALTER TABLE "participantes" ADD CONSTRAINT "unique_tenant_codigo" UNIQUE ("tenant_id", "codigo");

-- 4. Adicionar tenant_id, cidade, data_inicio_inscricao, data_fim_inscricao em "eventos"
ALTER TABLE "eventos" ADD COLUMN "tenant_id" UUID;
ALTER TABLE "eventos" ADD COLUMN "cidade" TEXT;
ALTER TABLE "eventos" ADD COLUMN "data_inicio_inscricao" TIMESTAMPTZ;
ALTER TABLE "eventos" ADD COLUMN "data_fim_inscricao" TIMESTAMPTZ;
UPDATE "eventos" SET "tenant_id" = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
ALTER TABLE "eventos" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "eventos" ADD CONSTRAINT "eventos_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "eventos_tenant_id_idx" ON "eventos"("tenant_id");

-- 5. Adicionar tenant_id em "inscricoes_evento"
ALTER TABLE "inscricoes_evento" ADD COLUMN "tenant_id" UUID;
UPDATE "inscricoes_evento" SET "tenant_id" = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
ALTER TABLE "inscricoes_evento" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "inscricoes_evento" ADD CONSTRAINT "inscricoes_evento_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "inscricoes_evento_tenant_id_idx" ON "inscricoes_evento"("tenant_id");

-- 6. Criar tabela "refresh_tokens" para rotação de JWT
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "revoked_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");
CREATE INDEX "refresh_tokens_token_hash_idx" ON "refresh_tokens"("token_hash");
