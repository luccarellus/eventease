-- =============================================================================
-- EventEase - Database Dump & Migration Script
-- Gerado em: 2026-08-14T20:39:10.107Z
-- Compatibilidade: PostgreSQL 14, 15, 16, 17+ (VPS, Docker, Local, Cloud)
-- =============================================================================

SET statement_timeout = 0;
SET lock_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET client_min_messages = warning;
SET row_security = off;

-- 1. Extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- 2. Estrutura das Tabelas (Schema: public)
-- =============================================================================

-- Tabela: admin_users
CREATE TABLE IF NOT EXISTS public.admin_users (
    id UUID PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT,
    role TEXT DEFAULT 'admin',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela: eventos
CREATE TABLE IF NOT EXISTS public.eventos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    titulo TEXT NOT NULL,
    descricao TEXT,
    data TIMESTAMPTZ NOT NULL,
    local TEXT NOT NULL,
    cidade TEXT,
    publicado BOOLEAN DEFAULT false NOT NULL,
    data_inicio_inscricao TIMESTAMPTZ,
    data_fim_inscricao TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Tabela: participantes
CREATE TABLE IF NOT EXISTS public.participantes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    telefone TEXT NOT NULL,
    empresa TEXT,
    cidade TEXT NOT NULL,
    escola TEXT NOT NULL,
    gremio TEXT,
    codigo TEXT NOT NULL UNIQUE,
    aceitou_termos BOOLEAN DEFAULT false NOT NULL,
    termos_aceitos_em TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Tabela: inscricoes_evento
CREATE TABLE IF NOT EXISTS public.inscricoes_evento (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evento_id UUID NOT NULL REFERENCES public.eventos(id) ON DELETE CASCADE ON UPDATE CASCADE,
    participante_id UUID NOT NULL REFERENCES public.participantes(id) ON DELETE CASCADE ON UPDATE CASCADE,
    presente BOOLEAN DEFAULT false NOT NULL,
    confirmado_em TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT unique_evento_participante UNIQUE (evento_id, participante_id)
);

-- Tabela: refresh_tokens
CREATE TABLE IF NOT EXISTS public.refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Tabela Auxiliar de Backup de Credenciais (Supabase Auth Users)
-- Permite preservar os hashes bcrypt das senhas dos administradores ao sair do Supabase
CREATE TABLE IF NOT EXISTS public.supabase_auth_users_backup (
    id UUID PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    encrypted_password TEXT,
    email_confirmed_at TIMESTAMPTZ,
    raw_app_meta_data JSONB,
    raw_user_meta_data JSONB,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
);

-- =============================================================================
-- 3. Índices de Otimização e Busca
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_participantes_codigo ON public.participantes(codigo);
CREATE INDEX IF NOT EXISTS idx_participantes_email ON public.participantes(email);
CREATE INDEX IF NOT EXISTS idx_eventos_publicado ON public.eventos(publicado);
CREATE INDEX IF NOT EXISTS idx_inscricoes_evento_evento_id ON public.inscricoes_evento(evento_id);
CREATE INDEX IF NOT EXISTS idx_inscricoes_evento_participante_id ON public.inscricoes_evento(participante_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON public.refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash ON public.refresh_tokens(token_hash);

-- =============================================================================
-- 4. Funções RPC e Helpers
-- =============================================================================

-- Função: Obter participante por e-mail
CREATE OR REPLACE FUNCTION public.get_participant_by_email(p_email TEXT)
RETURNS TABLE (nome TEXT, codigo TEXT, registrado BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT p.nome, p.codigo, true as registrado
  FROM public.participantes p
  WHERE LOWER(p.email) = LOWER(TRIM(p_email));
END;
$$;

-- Função: Obter participante por código
CREATE OR REPLACE FUNCTION public.get_participant_by_code(p_code TEXT)
RETURNS TABLE (id UUID, nome TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.nome
  FROM public.participantes p
  WHERE UPPER(p.codigo) = UPPER(TRIM(p_code));
END;
$$;

-- Função: Verificar inscrição no evento
CREATE OR REPLACE FUNCTION public.check_event_registration(p_event_id UUID, p_participant_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.inscricoes_evento
    WHERE evento_id = p_event_id AND participante_id = p_participant_id
  ) INTO v_exists;
  RETURN v_exists;
END;
$$;

-- =============================================================================
-- 5. Carga de Dados Existentes (INSERT Statements)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Dados: admin_users (3 registros)
-- -----------------------------------------------------------------------------
INSERT INTO public.admin_users (id, email, full_name, role, created_at, updated_at) VALUES ('ac3f396f-6ee5-4110-8e8e-f98a43228b67', 'luccarellus@gmail.com', NULL, 'admin', '2026-07-08T18:01:12.856Z'::timestamptz, '2026-08-14T18:35:58.846Z'::timestamptz) ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, full_name = EXCLUDED.full_name, role = EXCLUDED.role, updated_at = EXCLUDED.updated_at;
INSERT INTO public.admin_users (id, email, full_name, role, created_at, updated_at) VALUES ('1d7128e7-98a1-4664-beb1-8f14a0396438', 'presidente@olharjovem.org', NULL, 'admin', '2026-07-31T12:51:42.144Z'::timestamptz, '2026-08-04T12:23:06.708Z'::timestamptz) ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, full_name = EXCLUDED.full_name, role = EXCLUDED.role, updated_at = EXCLUDED.updated_at;
INSERT INTO public.admin_users (id, email, full_name, role, created_at, updated_at) VALUES ('50b1825c-344d-41b5-ac59-500d6f0667bc', 'gustavodasilvasantos19@gmail.com', NULL, 'admin', '2026-08-03T13:34:00.919Z'::timestamptz, '2026-08-03T13:36:01.458Z'::timestamptz) ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, full_name = EXCLUDED.full_name, role = EXCLUDED.role, updated_at = EXCLUDED.updated_at;

-- -----------------------------------------------------------------------------
-- Dados: supabase_auth_users_backup (3 registros com hashes de senhas)
-- -----------------------------------------------------------------------------
INSERT INTO public.supabase_auth_users_backup (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) VALUES ('ac3f396f-6ee5-4110-8e8e-f98a43228b67', 'luccarellus@gmail.com', '$2a$10$MLsQYPTzKr1PE/F8HIVtF.NfdX0V0hR8mEyu89NmYw5krRt0EZj9m', '2026-07-08T18:01:12.875Z'::timestamptz, '{"role":"admin","provider":"email","providers":["email"]}'::jsonb, '{"email_verified":true}'::jsonb, '2026-07-08T18:01:12.856Z'::timestamptz, '2026-08-14T18:35:58.129Z'::timestamptz) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.supabase_auth_users_backup (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) VALUES ('1d7128e7-98a1-4664-beb1-8f14a0396438', 'presidente@olharjovem.org', '$2a$10$EpAcXLD4F/kSXovxP6ykLuAtspSmN2yfwljY1bn3auC5IB02HNcBC', '2026-07-31T12:51:42.162Z'::timestamptz, '{"role":"admin","provider":"email","providers":["email"]}'::jsonb, '{"email_verified":true}'::jsonb, '2026-07-31T12:51:42.144Z'::timestamptz, '2026-08-04T12:23:06.047Z'::timestamptz) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.supabase_auth_users_backup (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) VALUES ('50b1825c-344d-41b5-ac59-500d6f0667bc', 'gustavodasilvasantos19@gmail.com', '$2a$10$cPM3xIv5/XsGPwlgmgz3LOMYad.twJXNHVe653sCeKdjyt0AsZklm', '2026-08-03T13:34:00.934Z'::timestamptz, '{"role":"admin","provider":"email","providers":["email"]}'::jsonb, '{"email_verified":true}'::jsonb, '2026-08-03T13:34:00.919Z'::timestamptz, '2026-08-03T13:36:00.618Z'::timestamptz) ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- Dados: eventos (2 registros)
-- -----------------------------------------------------------------------------
INSERT INTO public.eventos (id, titulo, descricao, data, local, cidade, publicado, data_inicio_inscricao, data_fim_inscricao, created_at) VALUES ('9b471d0f-427d-4d6f-a248-bb6211210180', 'No Enem Vou Aprovar – Imperatriz 🚀', 'Mais uma edição de um dos eventos mais aguardados pelos estudantes que sonham alto e querem chegar preparados para o ENEM. O No Enem Vou Aprovar – Imperatriz reúne revisão estratégica, orientação prática e muita motivação para quem está focado em conquistar uma grande nota e garantir a vaga na universidade.

Com uma metodologia dinâmica e direcionada, o evento traz os principais conteúdos cobrados no exame, técnicas de resolução de questões, dicas valiosas para a redação e estratégias que ajudam os alunos a estudar com mais eficiência e confiança.

Uma oportunidade para reforçar conhecimentos, tirar dúvidas e entrar no clima da reta final com foco total na aprovação.

📍 Imperatriz – MA
📚 Revisão intensiva
✍️ Estratégias para redação
🎯 Técnicas para o ENEM
🔥 Energia, aprendizado e preparação

Porque quem se prepara com estratégia chega mais longe.', '2026-08-22T12:00:00.000Z'::timestamptz, 'Auditório da Facimp', 'Imperatriz', TRUE, '2026-08-15T03:00:00.000Z'::timestamptz, '2026-08-22T02:59:00.000Z'::timestamptz, '2026-06-25T14:23:49.586Z'::timestamptz) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.eventos (id, titulo, descricao, data, local, cidade, publicado, data_inicio_inscricao, data_fim_inscricao, created_at) VALUES ('db5361fd-bdfd-4c95-ba52-3a128ee4991e', 'No Enem Vou Aprovar - São Luís🚀', 'Mais uma edição de um dos eventos mais aguardados pelos estudantes que sonham alto e querem chegar preparados para o ENEM. O No Enem Vou Aprovar – São Luís reúne revisão estratégica, orientação prática e muita motivação para quem está focado em conquistar uma grande nota e garantir a vaga na universidade.

Com uma metodologia dinâmica e direcionada, o evento traz os principais conteúdos cobrados no exame, técnicas de resolução de questões, dicas valiosas para a redação e estratégias que ajudam os alunos a estudar com mais eficiência e confiança.

Uma oportunidade para reforçar conhecimentos, tirar dúvidas e entrar no clima da reta final com foco total na aprovação.

📍 São Luís – MA
📚 Revisão intensiva
✍️ Estratégias para redação
🎯 Técnicas para o ENEM
🔥 Energia, aprendizado e preparação

Porque quem se prepara com estratégia chega mais longe.', '2026-08-29T12:00:00.000Z'::timestamptz, 'Auditório Municipal', 'São Luís', TRUE, '2026-08-15T03:00:00.000Z'::timestamptz, '2026-08-24T02:59:00.000Z'::timestamptz, '2026-07-31T12:59:28.230Z'::timestamptz) ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- Dados: refresh_tokens (4 registros)
-- -----------------------------------------------------------------------------
INSERT INTO public.refresh_tokens (id, user_id, token_hash, expires_at, revoked_at, created_at) VALUES ('ff410446-e310-49d1-a5ba-0e0ed7a57473', '1d7128e7-98a1-4664-beb1-8f14a0396438', 'b014347c103cfc0ef7f132d173ff3e2f83e68fa97c266942de282d1f150050ce', '2026-08-16T11:50:41.903Z'::timestamptz, NULL, '2026-08-09T11:50:42.145Z'::timestamptz) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.refresh_tokens (id, user_id, token_hash, expires_at, revoked_at, created_at) VALUES ('12335cf8-2d0b-4c26-bdfc-eb96f3cf46f2', 'ac3f396f-6ee5-4110-8e8e-f98a43228b67', '741dd5b7a3e2c70db0191d33ba9d9fbacf731b44854e443405d92ee182c03ce9', '2026-08-17T13:35:28.095Z'::timestamptz, NULL, '2026-08-10T13:35:28.336Z'::timestamptz) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.refresh_tokens (id, user_id, token_hash, expires_at, revoked_at, created_at) VALUES ('afbedbb2-bf59-4e62-8465-bb057cca95ce', 'ac3f396f-6ee5-4110-8e8e-f98a43228b67', '6cfe58e827c464935c7ec3db29874e7e699174a71a77e6dace2aee78be2b7d5b', '2026-08-21T18:35:59.204Z'::timestamptz, '2026-08-14T19:03:22.223Z'::timestamptz, '2026-08-14T18:35:59.208Z'::timestamptz) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.refresh_tokens (id, user_id, token_hash, expires_at, revoked_at, created_at) VALUES ('5927d1bf-de24-4418-9af4-7d1ce17c4d71', 'ac3f396f-6ee5-4110-8e8e-f98a43228b67', '8194a28abebda05ed574321842b72e62c880b6b9dd686b41d0e32f7af80b8fe5', '2026-08-21T19:03:22.223Z'::timestamptz, NULL, '2026-08-14T19:03:22.472Z'::timestamptz) ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- Fim do Dump
-- =============================================================================
