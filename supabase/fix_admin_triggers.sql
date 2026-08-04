-- ============================================================
-- CORREÇÃO DE SEGURANÇA — Escalação de privilégio (role admin)
-- Aplicar UMA VEZ no banco do projeto Supabase (SQL Editor).
-- ============================================================
-- Problema: triggers antigos promoviam QUALQUER usuário a 'admin':
--   1. handle_new_user (BEFORE INSERT)  -> forçava role admin no metadata
--   2. sync_admin_user (AFTER INSERT)   -> criava admin_users com role admin
--   3. sync_admin_user_update (AFTER UPDATE) -> reescrevia role='admin' a
--      cada login (last_sign_in_at) e desfazia rebaixamentos via set-role.
-- Impacto: qualquer usuário registrado virava admin no banco; o RLS que
-- checa app_metadata role='admin' também era liberado para todos.
-- ============================================================

-- 1. Remover os triggers inseguros
DROP TRIGGER IF EXISTS on_auth_user_created       ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_sync  ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_updated_sync  ON auth.users;

-- Opcional: manter a sincronização de exclusão (remove órfãos de admin_users)
-- DROP TRIGGER IF EXISTS on_auth_user_deleted_sync ON auth.users;

-- 2. Remover as funções, se ainda existirem
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.sync_admin_user();
DROP FUNCTION IF EXISTS public.sync_admin_user_update();

-- ============================================================
-- 3. AUDITORIA — NÃO executa alterações, apenas mostra o estado atual
-- ============================================================
-- Usuários atualmente com role 'admin' em app_metadata (revise e rebaixe
-- quem não deveria ser admin):
-- SELECT id, email, raw_app_meta_data->>'role' AS role
-- FROM auth.users
-- WHERE raw_app_meta_data->>'role' = 'admin';

-- Registros atuais de admin_users (revise e rebaixe quem não deveria):
-- SELECT id, email, role FROM public.admin_users ORDER BY role, email;

-- ============================================================
-- 4. REBAIXAR TODOS os usuários para 'user' (seguro) — descomente
--    somente após a auditoria, e então promova manualmente os admins
--    via POST /auth/set-role (ou updateUserById com app_metadata.role).
-- ============================================================
-- UPDATE auth.users SET raw_app_meta_data =
--   jsonb_set(COALESCE(raw_app_meta_data, '{}'::jsonb), '{role}', '"user"');
-- UPDATE public.admin_users SET role = 'user' WHERE role <> 'user';

-- ============================================================
-- 5. IMPORTANTE — regras daqui em diante
-- ============================================================
-- * Novos usuários nascem com role 'user' (backend define via app_metadata).
-- * Promoção/rebaixamento SÓ pelo endpoint admin /auth/set-role.
-- * Se o RLS for usado por clientes Supabase diretos, mantenha as políticas
--   existentes (elas continuam corretas com o metadata corrigido).
