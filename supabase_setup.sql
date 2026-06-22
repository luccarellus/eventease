-- Tabela de participantes
CREATE TABLE IF NOT EXISTS participantes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  telefone TEXT NOT NULL,
  empresa TEXT, -- Mantido por compatibilidade, mas usado como 'Instituição' no UI
  cidade TEXT NOT NULL,
  escola TEXT NOT NULL,
  gremio TEXT,
  codigo TEXT NOT NULL UNIQUE,
  aceitou_termos BOOLEAN DEFAULT false,
  termos_aceitos_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Script de migração para bases já existentes:
-- ALTER TABLE participantes ADD COLUMN IF NOT EXISTS aceitou_termos BOOLEAN DEFAULT false;
-- ALTER TABLE participantes ADD COLUMN IF NOT EXISTS termos_aceitos_em TIMESTAMPTZ;
-- ALTER TABLE participantes DROP COLUMN IF EXISTS presente;
-- ALTER TABLE participantes DROP COLUMN IF EXISTS confirmado_em;

-- Habilitar RLS
ALTER TABLE participantes ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas
DROP POLICY IF EXISTS "Permitir leitura por código para check-in" ON participantes;
DROP POLICY IF EXISTS "Permitir confirmar presença por código" ON participantes;
DROP POLICY IF EXISTS "Admin: Controle total" ON participantes;
DROP POLICY IF EXISTS "Permitir cadastro público" ON participantes;

-- Políticas de Segurança (RLS) para participantes
-- 1. Público: Permitir inserção (cadastro)
CREATE POLICY "Permitir cadastro público" 
ON participantes FOR INSERT 
WITH CHECK (true);

-- 2. Admin: Controle total via autenticação e claim 'admin'
CREATE POLICY "Admin: Controle total de participantes" 
ON participantes 
FOR ALL 
TO authenticated 
USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_participantes_codigo ON participantes(codigo);
CREATE INDEX IF NOT EXISTS idx_participantes_email ON participantes(email);

-- =========================================================================
-- MULTI-EVENT SYSTEM EXTENSION
-- =========================================================================

-- Tabela de eventos
CREATE TABLE IF NOT EXISTS eventos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  descricao TEXT,
  data TIMESTAMPTZ NOT NULL,
  local TEXT NOT NULL,
  publicado BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de inscrições de eventos
CREATE TABLE IF NOT EXISTS inscricoes_evento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id UUID REFERENCES eventos(id) ON DELETE CASCADE NOT NULL,
  participante_id UUID REFERENCES participantes(id) ON DELETE CASCADE NOT NULL,
  presente BOOLEAN DEFAULT false,
  confirmado_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_evento_participante UNIQUE (evento_id, participante_id)
);

-- Habilitar RLS
ALTER TABLE eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE inscricoes_evento ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas
DROP POLICY IF EXISTS "Permitir leitura pública de eventos publicados" ON eventos;
DROP POLICY IF EXISTS "Admin: Controle total de eventos" ON eventos;
DROP POLICY IF EXISTS "Permitir leitura pública de inscricoes" ON inscricoes_evento;
DROP POLICY IF EXISTS "Permitir inscricao pública em eventos" ON inscricoes_evento;
DROP POLICY IF EXISTS "Permitir confirmar presenca em evento por codigo" ON inscricoes_evento;
DROP POLICY IF EXISTS "Admin: Controle total de inscricoes" ON inscricoes_evento;

-- Políticas para Eventos
CREATE POLICY "Permitir leitura pública de eventos publicados" 
ON eventos FOR SELECT 
USING (publicado = true OR (auth.role() = 'authenticated' AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'));

CREATE POLICY "Admin: Controle total de eventos" 
ON eventos FOR ALL 
TO authenticated 
USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Políticas para Inscrições de Eventos
CREATE POLICY "Permitir inscricao pública em eventos" 
ON inscricoes_evento FOR INSERT 
WITH CHECK (presente = false);

CREATE POLICY "Admin: Controle total de inscricoes" 
ON inscricoes_evento FOR ALL 
TO authenticated 
USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Índices
CREATE INDEX IF NOT EXISTS idx_inscricoes_evento_evento_id ON inscricoes_evento(evento_id);
CREATE INDEX IF NOT EXISTS idx_inscricoes_evento_participante_id ON inscricoes_evento(participante_id);
CREATE INDEX IF NOT EXISTS idx_eventos_publicado ON eventos(publicado);

-- =========================================================================
-- FUNÇÕES RPC SEGURAS (SECURITY DEFINER) PARA ACESSO ANÔNIMO SELETIVO
-- =========================================================================

-- 1. Obter participante por e-mail (retorna nome, código da credencial para recuperação e se está registrado)
CREATE OR REPLACE FUNCTION get_participant_by_email(p_email text)
RETURNS TABLE (nome text, codigo text, registrado boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT p.nome, p.codigo, true as registrado
  FROM participantes p
  WHERE LOWER(p.email) = LOWER(TRIM(p_email));
END;
$$;


-- 2. Obter participante por código (retorna apenas ID e nome)
CREATE OR REPLACE FUNCTION get_participant_by_code(p_code text)
RETURNS TABLE (id uuid, nome text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.nome
  FROM participantes p
  WHERE UPPER(p.codigo) = UPPER(TRIM(p_code));
END;
$$;

-- 3. Verificar se inscrição no evento já existe
CREATE OR REPLACE FUNCTION check_event_registration(p_event_id uuid, p_participant_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM inscricoes_evento
    WHERE evento_id = p_event_id AND participante_id = p_participant_id
  ) INTO v_exists;
  RETURN v_exists;
END;
$$;

-- Trigger para definir automaticamente a role 'admin' em raw_app_meta_data para novos usuários
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- Define role padrão como 'user' em vez de 'admin'
  NEW.raw_app_meta_data := COALESCE(NEW.raw_app_meta_data, '{}'::jsonb) || '{"role": "user"}'::jsonb;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Promover retroativamente o usuário administrador principal
UPDATE auth.users
SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
WHERE email = 'lucassantos.-@outlook.com';

-- ADMIN USERS (Sincronizado com Supabase Auth)

-- Recriar a tabela admin_users garantindo o nome correto das colunas
DROP TABLE IF EXISTS admin_users CASCADE;

CREATE TABLE admin_users (
  id UUID PRIMARY KEY, -- Sem foreign key direta com auth.users para evitar restrição cross-schema do Prisma
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  role TEXT DEFAULT 'admin',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Políticas
DROP POLICY IF EXISTS "Admin: Controle total de admin_users" ON admin_users;
CREATE POLICY "Admin: Controle total de admin_users" 
ON admin_users FOR ALL 
TO authenticated 
USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- 1. Trigger para sincronizar INSERSÕES no auth.users com admin_users
CREATE OR REPLACE FUNCTION public.sync_admin_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.admin_users (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    COALESCE(NEW.raw_app_meta_data->>'role', 'admin')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created_sync ON auth.users;
CREATE TRIGGER on_auth_user_created_sync
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_admin_user();

-- 2. Trigger para sincronizar ATUALIZAÇÕES no auth.users com admin_users
CREATE OR REPLACE FUNCTION public.sync_admin_user_update()
RETURNS trigger AS $$
BEGIN
  UPDATE public.admin_users
  SET 
    email = NEW.email,
    full_name = NEW.raw_user_meta_data->>'full_name',
    role = COALESCE(NEW.raw_app_meta_data->>'role', 'admin'),
    updated_at = now()
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_updated_sync ON auth.users;
CREATE TRIGGER on_auth_user_updated_sync
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_admin_user_update();

-- 3. Trigger para sincronizar EXCLUSÕES no auth.users com admin_users (Simulando ON DELETE CASCADE)
CREATE OR REPLACE FUNCTION public.sync_admin_user_delete()
RETURNS trigger AS $$
BEGIN
  DELETE FROM public.admin_users WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_deleted_sync ON auth.users;
CREATE TRIGGER on_auth_user_deleted_sync
  AFTER DELETE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_admin_user_delete();

-- 4. Sincronizar retroativamente os usuários já existentes no Supabase Auth
INSERT INTO public.admin_users (id, email, full_name, role)
SELECT 
  id, 
  email, 
  raw_user_meta_data->>'full_name', 
  COALESCE(raw_app_meta_data->>'role', 'admin')
FROM auth.users
ON CONFLICT (id) DO NOTHING;


