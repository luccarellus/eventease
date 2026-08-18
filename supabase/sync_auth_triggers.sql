-- ============================================================
-- TRIGGERS SEGUROS — Sincronização auth.users → admin_users
-- Aplicar no Supabase SQL Editor (Dashboard → SQL Editor).
-- ============================================================
-- Substitui os triggers antigos removidos em fix_admin_triggers.sql.
-- DIFERENÇA SEGURANÇA:
--   • role padrão = 'user' (nunca 'admin')
--   • Promoção SÓ pelo endpoint /auth/set-role
--   • Não mexe em raw_app_meta_data
-- ============================================================

-- 0. Garantir que as funções antigas não existem
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.sync_admin_user() CASCADE;
DROP FUNCTION IF EXISTS public.sync_admin_user_update() CASCADE;

-- ============================================================
-- 1. Função: ao criar usuário no auth.users → cria em admin_users
-- ============================================================
CREATE OR REPLACE FUNCTION public.sync_admin_user_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.admin_users (id, email, full_name, role, password_hash, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name'),
    'user',
    NEW.encrypted_password,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    password_hash = EXCLUDED.password_hash,
    updated_at = NOW();

  RETURN NEW;
END;
$$;

-- ============================================================
-- 2. Função: ao atualizar auth.users → atualiza admin_users
-- ============================================================
CREATE OR REPLACE FUNCTION public.sync_admin_user_on_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.admin_users
  SET
    email = NEW.email,
    full_name = COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', full_name),
    password_hash = NEW.encrypted_password,
    updated_at = NOW()
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

-- ============================================================
-- 3. Função: ao deletar auth.users → remove de admin_users
-- ============================================================
CREATE OR REPLACE FUNCTION public.sync_admin_user_on_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.admin_users WHERE id = OLD.id;
  RETURN OLD;
END;
$$;

-- ============================================================
-- 4. Criar os triggers
-- ============================================================
DROP TRIGGER IF EXISTS on_auth_user_created_sync ON auth.users;
CREATE TRIGGER on_auth_user_created_sync
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_admin_user_on_insert();

DROP TRIGGER IF EXISTS on_auth_user_updated_sync ON auth.users;
CREATE TRIGGER on_auth_user_updated_sync
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_admin_user_on_update();

DROP TRIGGER IF EXISTS on_auth_user_deleted_sync ON auth.users;
CREATE TRIGGER on_auth_user_deleted_sync
  AFTER DELETE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_admin_user_on_delete();

-- ============================================================
-- 5. Backfill: sincronizar usuários existentes do auth.users
--    que ainda não estão em admin_users
-- ============================================================
INSERT INTO public.admin_users (id, email, full_name, role, password_hash, created_at, updated_at)
SELECT
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data ->> 'full_name', au.raw_user_meta_data ->> 'name'),
  'user',
  au.encrypted_password,
  au.created_at,
  au.updated_at
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM public.admin_users adm WHERE adm.id = au.id
)
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  password_hash = EXCLUDED.password_hash,
  updated_at = NOW();

-- ============================================================
-- 6. Verificar resultado
-- ============================================================
SELECT id, email, full_name, role, 
       CASE WHEN password_hash IS NOT NULL THEN '✅ definida' ELSE '❌ NULL' END AS senha_status
FROM public.admin_users 
ORDER BY role DESC, email;
