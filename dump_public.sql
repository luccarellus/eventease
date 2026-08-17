--
-- PostgreSQL database dump
--

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.5

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

DROP POLICY IF EXISTS "Permitir leitura pública de eventos publicados" ON public.eventos;
DROP POLICY IF EXISTS "Permitir inscricao pública em eventos" ON public.inscricoes_evento;
DROP POLICY IF EXISTS "Permitir cadastro público" ON public.participantes;
DROP POLICY IF EXISTS "Admin: Controle total de refresh_tokens" ON public.refresh_tokens;
DROP POLICY IF EXISTS "Admin: Controle total de participantes" ON public.participantes;
DROP POLICY IF EXISTS "Admin: Controle total de inscricoes" ON public.inscricoes_evento;
DROP POLICY IF EXISTS "Admin: Controle total de eventos" ON public.eventos;
DROP POLICY IF EXISTS "Admin: Controle total de admin_users" ON public.admin_users;
ALTER TABLE IF EXISTS ONLY public.inscricoes_evento DROP CONSTRAINT IF EXISTS inscricoes_evento_participante_id_fkey;
ALTER TABLE IF EXISTS ONLY public.inscricoes_evento DROP CONSTRAINT IF EXISTS inscricoes_evento_evento_id_fkey;
DROP INDEX IF EXISTS public.participantes_email_idx;
DROP INDEX IF EXISTS public.participantes_codigo_key;
DROP INDEX IF EXISTS public.participantes_codigo_idx;
DROP INDEX IF EXISTS public.inscricoes_evento_participante_id_idx;
DROP INDEX IF EXISTS public.inscricoes_evento_evento_id_participante_id_key;
DROP INDEX IF EXISTS public.inscricoes_evento_evento_id_idx;
DROP INDEX IF EXISTS public.idx_refresh_tokens_user_id;
DROP INDEX IF EXISTS public.idx_refresh_tokens_token_hash;
DROP INDEX IF EXISTS public.idx_participantes_email;
DROP INDEX IF EXISTS public.idx_participantes_codigo;
DROP INDEX IF EXISTS public.idx_inscricoes_evento_participante_id;
DROP INDEX IF EXISTS public.idx_inscricoes_evento_evento_id;
DROP INDEX IF EXISTS public.idx_eventos_publicado;
DROP INDEX IF EXISTS public.eventos_publicado_idx;
ALTER TABLE IF EXISTS ONLY public.refresh_tokens DROP CONSTRAINT IF EXISTS refresh_tokens_token_hash_key;
ALTER TABLE IF EXISTS ONLY public.refresh_tokens DROP CONSTRAINT IF EXISTS refresh_tokens_pkey;
ALTER TABLE IF EXISTS ONLY public.participantes DROP CONSTRAINT IF EXISTS participantes_pkey;
ALTER TABLE IF EXISTS ONLY public.inscricoes_evento DROP CONSTRAINT IF EXISTS inscricoes_evento_pkey;
ALTER TABLE IF EXISTS ONLY public.eventos DROP CONSTRAINT IF EXISTS eventos_pkey;
ALTER TABLE IF EXISTS ONLY public.admin_users DROP CONSTRAINT IF EXISTS admin_users_pkey;
ALTER TABLE IF EXISTS ONLY public.admin_users DROP CONSTRAINT IF EXISTS admin_users_email_key;
DROP TABLE IF EXISTS public.refresh_tokens;
DROP TABLE IF EXISTS public.participantes;
DROP TABLE IF EXISTS public.inscricoes_evento;
DROP TABLE IF EXISTS public.eventos;
DROP TABLE IF EXISTS public.admin_users;
DROP FUNCTION IF EXISTS public.sync_admin_user_delete();
DROP FUNCTION IF EXISTS public.rls_auto_enable();
DROP FUNCTION IF EXISTS public.get_participant_by_email(p_email text);
DROP FUNCTION IF EXISTS public.get_participant_by_code(p_code text);
DROP FUNCTION IF EXISTS public.check_event_registration(p_event_id uuid, p_participant_id uuid);
DROP SCHEMA IF EXISTS public;
--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: check_event_registration(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_event_registration(p_event_id uuid, p_participant_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: get_participant_by_code(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_participant_by_code(p_code text) RETURNS TABLE(id uuid, nome text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.nome
  FROM participantes p
  WHERE UPPER(p.codigo) = UPPER(TRIM(p_code));
END;
$$;


--
-- Name: get_participant_by_email(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_participant_by_email(p_email text) RETURNS TABLE(nome text, codigo text, registrado boolean)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT p.nome, p.codigo, true as registrado
  FROM participantes p
  WHERE LOWER(p.email) = LOWER(TRIM(p_email));
END;
$$;


--
-- Name: rls_auto_enable(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rls_auto_enable() RETURNS event_trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


--
-- Name: sync_admin_user_delete(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_admin_user_delete() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  DELETE FROM public.admin_users WHERE id = OLD.id;
  RETURN OLD;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: admin_users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_users (
    id uuid NOT NULL,
    email text NOT NULL,
    full_name text,
    role text DEFAULT 'admin'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: eventos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.eventos (
    id uuid NOT NULL,
    titulo text NOT NULL,
    descricao text,
    data timestamp with time zone NOT NULL,
    local text NOT NULL,
    publicado boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    data_inicio_inscricao timestamp with time zone,
    data_fim_inscricao timestamp with time zone,
    cidade text
);


--
-- Name: inscricoes_evento; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inscricoes_evento (
    id uuid NOT NULL,
    evento_id uuid NOT NULL,
    participante_id uuid NOT NULL,
    presente boolean DEFAULT false NOT NULL,
    confirmado_em timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: participantes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.participantes (
    id uuid NOT NULL,
    nome text NOT NULL,
    email text NOT NULL,
    telefone text NOT NULL,
    empresa text,
    cidade text NOT NULL,
    escola text NOT NULL,
    gremio text,
    codigo text NOT NULL,
    aceitou_termos boolean DEFAULT false NOT NULL,
    termos_aceitos_em timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: refresh_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.refresh_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    token_hash text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    revoked_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Data for Name: admin_users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.admin_users (id, email, full_name, role, created_at, updated_at) FROM stdin;
1d7128e7-98a1-4664-beb1-8f14a0396438	presidente@olharjovem.org	\N	admin	2026-07-31 12:51:42.144082+00	2026-08-04 12:23:06.708+00
ac3f396f-6ee5-4110-8e8e-f98a43228b67	luccarellus@gmail.com	\N	admin	2026-07-08 18:01:12.856915+00	2026-08-14 18:35:58.846+00
50b1825c-344d-41b5-ac59-500d6f0667bc	gustavodasilvasantos19@gmail.com	\N	admin	2026-08-03 13:34:00.919791+00	2026-08-03 13:36:01.458+00
\.


--
-- Data for Name: eventos; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.eventos (id, titulo, descricao, data, local, publicado, created_at, data_inicio_inscricao, data_fim_inscricao, cidade) FROM stdin;
9b471d0f-427d-4d6f-a248-bb6211210180	No Enem Vou Aprovar – Imperatriz 🚀	Mais uma edição de um dos eventos mais aguardados pelos estudantes que sonham alto e querem chegar preparados para o ENEM. O No Enem Vou Aprovar – Imperatriz reúne revisão estratégica, orientação prática e muita motivação para quem está focado em conquistar uma grande nota e garantir a vaga na universidade.\n\nCom uma metodologia dinâmica e direcionada, o evento traz os principais conteúdos cobrados no exame, técnicas de resolução de questões, dicas valiosas para a redação e estratégias que ajudam os alunos a estudar com mais eficiência e confiança.\n\nUma oportunidade para reforçar conhecimentos, tirar dúvidas e entrar no clima da reta final com foco total na aprovação.\n\n📍 Imperatriz – MA\n📚 Revisão intensiva\n✍️ Estratégias para redação\n🎯 Técnicas para o ENEM\n🔥 Energia, aprendizado e preparação\n\nPorque quem se prepara com estratégia chega mais longe.	2026-08-22 12:00:00+00	Auditório da Facimp	t	2026-06-25 14:23:49.586+00	2026-08-15 03:00:00+00	2026-08-22 02:59:00+00	Imperatriz
db5361fd-bdfd-4c95-ba52-3a128ee4991e	No Enem Vou Aprovar - São Luís🚀	Mais uma edição de um dos eventos mais aguardados pelos estudantes que sonham alto e querem chegar preparados para o ENEM. O No Enem Vou Aprovar – São Luís reúne revisão estratégica, orientação prática e muita motivação para quem está focado em conquistar uma grande nota e garantir a vaga na universidade.\n\nCom uma metodologia dinâmica e direcionada, o evento traz os principais conteúdos cobrados no exame, técnicas de resolução de questões, dicas valiosas para a redação e estratégias que ajudam os alunos a estudar com mais eficiência e confiança.\n\nUma oportunidade para reforçar conhecimentos, tirar dúvidas e entrar no clima da reta final com foco total na aprovação.\n\n📍 São Luís – MA\n📚 Revisão intensiva\n✍️ Estratégias para redação\n🎯 Técnicas para o ENEM\n🔥 Energia, aprendizado e preparação\n\nPorque quem se prepara com estratégia chega mais longe.	2026-08-29 12:00:00+00	Auditório Municipal	t	2026-07-31 12:59:28.23+00	2026-08-15 03:00:00+00	2026-08-24 02:59:00+00	São Luís
\.


--
-- Data for Name: inscricoes_evento; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.inscricoes_evento (id, evento_id, participante_id, presente, confirmado_em, created_at) FROM stdin;
\.


--
-- Data for Name: participantes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.participantes (id, nome, email, telefone, empresa, cidade, escola, gremio, codigo, aceitou_termos, termos_aceitos_em, created_at) FROM stdin;
\.


--
-- Data for Name: refresh_tokens; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.refresh_tokens (id, user_id, token_hash, expires_at, revoked_at, created_at) FROM stdin;
ff410446-e310-49d1-a5ba-0e0ed7a57473	1d7128e7-98a1-4664-beb1-8f14a0396438	b014347c103cfc0ef7f132d173ff3e2f83e68fa97c266942de282d1f150050ce	2026-08-16 11:50:41.903+00	\N	2026-08-09 11:50:42.145+00
12335cf8-2d0b-4c26-bdfc-eb96f3cf46f2	ac3f396f-6ee5-4110-8e8e-f98a43228b67	741dd5b7a3e2c70db0191d33ba9d9fbacf731b44854e443405d92ee182c03ce9	2026-08-17 13:35:28.095+00	\N	2026-08-10 13:35:28.336+00
afbedbb2-bf59-4e62-8465-bb057cca95ce	ac3f396f-6ee5-4110-8e8e-f98a43228b67	6cfe58e827c464935c7ec3db29874e7e699174a71a77e6dace2aee78be2b7d5b	2026-08-21 18:35:59.204+00	2026-08-14 19:03:22.223+00	2026-08-14 18:35:59.208+00
5927d1bf-de24-4418-9af4-7d1ce17c4d71	ac3f396f-6ee5-4110-8e8e-f98a43228b67	8194a28abebda05ed574321842b72e62c880b6b9dd686b41d0e32f7af80b8fe5	2026-08-21 19:03:22.223+00	\N	2026-08-14 19:03:22.472+00
\.


--
-- Name: admin_users admin_users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_users
    ADD CONSTRAINT admin_users_email_key UNIQUE (email);


--
-- Name: admin_users admin_users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_users
    ADD CONSTRAINT admin_users_pkey PRIMARY KEY (id);


--
-- Name: eventos eventos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eventos
    ADD CONSTRAINT eventos_pkey PRIMARY KEY (id);


--
-- Name: inscricoes_evento inscricoes_evento_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inscricoes_evento
    ADD CONSTRAINT inscricoes_evento_pkey PRIMARY KEY (id);


--
-- Name: participantes participantes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.participantes
    ADD CONSTRAINT participantes_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_token_hash_key UNIQUE (token_hash);


--
-- Name: eventos_publicado_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX eventos_publicado_idx ON public.eventos USING btree (publicado);


--
-- Name: idx_eventos_publicado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_eventos_publicado ON public.eventos USING btree (publicado);


--
-- Name: idx_inscricoes_evento_evento_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inscricoes_evento_evento_id ON public.inscricoes_evento USING btree (evento_id);


--
-- Name: idx_inscricoes_evento_participante_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inscricoes_evento_participante_id ON public.inscricoes_evento USING btree (participante_id);


--
-- Name: idx_participantes_codigo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_participantes_codigo ON public.participantes USING btree (codigo);


--
-- Name: idx_participantes_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_participantes_email ON public.participantes USING btree (email);


--
-- Name: idx_refresh_tokens_token_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_refresh_tokens_token_hash ON public.refresh_tokens USING btree (token_hash);


--
-- Name: idx_refresh_tokens_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_refresh_tokens_user_id ON public.refresh_tokens USING btree (user_id);


--
-- Name: inscricoes_evento_evento_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inscricoes_evento_evento_id_idx ON public.inscricoes_evento USING btree (evento_id);


--
-- Name: inscricoes_evento_evento_id_participante_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX inscricoes_evento_evento_id_participante_id_key ON public.inscricoes_evento USING btree (evento_id, participante_id);


--
-- Name: inscricoes_evento_participante_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inscricoes_evento_participante_id_idx ON public.inscricoes_evento USING btree (participante_id);


--
-- Name: participantes_codigo_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX participantes_codigo_idx ON public.participantes USING btree (codigo);


--
-- Name: participantes_codigo_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX participantes_codigo_key ON public.participantes USING btree (codigo);


--
-- Name: participantes_email_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX participantes_email_idx ON public.participantes USING btree (email);


--
-- Name: inscricoes_evento inscricoes_evento_evento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inscricoes_evento
    ADD CONSTRAINT inscricoes_evento_evento_id_fkey FOREIGN KEY (evento_id) REFERENCES public.eventos(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: inscricoes_evento inscricoes_evento_participante_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inscricoes_evento
    ADD CONSTRAINT inscricoes_evento_participante_id_fkey FOREIGN KEY (participante_id) REFERENCES public.participantes(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: admin_users Admin: Controle total de admin_users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin: Controle total de admin_users" ON public.admin_users TO authenticated USING ((((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text)) WITH CHECK ((((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text));


--
-- Name: eventos Admin: Controle total de eventos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin: Controle total de eventos" ON public.eventos TO authenticated USING ((((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text)) WITH CHECK ((((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text));


--
-- Name: inscricoes_evento Admin: Controle total de inscricoes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin: Controle total de inscricoes" ON public.inscricoes_evento TO authenticated USING ((((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text)) WITH CHECK ((((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text));


--
-- Name: participantes Admin: Controle total de participantes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin: Controle total de participantes" ON public.participantes TO authenticated USING ((((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text)) WITH CHECK ((((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text));


--
-- Name: refresh_tokens Admin: Controle total de refresh_tokens; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin: Controle total de refresh_tokens" ON public.refresh_tokens TO authenticated USING ((((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text)) WITH CHECK ((((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text));


--
-- Name: participantes Permitir cadastro público; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Permitir cadastro público" ON public.participantes FOR INSERT WITH CHECK (true);


--
-- Name: inscricoes_evento Permitir inscricao pública em eventos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Permitir inscricao pública em eventos" ON public.inscricoes_evento FOR INSERT WITH CHECK ((presente = false));


--
-- Name: eventos Permitir leitura pública de eventos publicados; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Permitir leitura pública de eventos publicados" ON public.eventos FOR SELECT USING (((publicado = true) OR ((auth.role() = 'authenticated'::text) AND (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text))));


--
-- Name: admin_users; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

--
-- Name: eventos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.eventos ENABLE ROW LEVEL SECURITY;

--
-- Name: inscricoes_evento; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inscricoes_evento ENABLE ROW LEVEL SECURITY;

--
-- Name: participantes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.participantes ENABLE ROW LEVEL SECURITY;

--
-- Name: refresh_tokens; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.refresh_tokens ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

