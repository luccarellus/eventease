-- =============================================================================
-- EventEase — Script de criação do banco de dados
-- Executar no pgAdmin conectado à VPS (porta 5433)
-- =============================================================================
-- INSTRUÇÕES:
--   1. No pgAdmin, crie um banco de dados chamado "eventease"
--      (botão direito em Databases > Create > Database > Name: eventease)
--   2. Abra uma Query Tool no banco "eventease"
--   3. Cole e execute este script completo
--   4. O Prisma (npx prisma db push) vai sincronizar o schema depois
-- =============================================================================


-- =============================================================================
-- EXTENSÃO UUID
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- =============================================================================
-- TABELA: users
-- Usuários do painel administrativo (autenticação local, sem Supabase)
-- =============================================================================
CREATE TABLE IF NOT EXISTS users (
    id              TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    email           TEXT        NOT NULL UNIQUE,
    password        TEXT        NOT NULL,
    "fullName"      TEXT,
    role            TEXT        NOT NULL DEFAULT 'user',

    -- LGPD
    "acceptedTerms"    BOOLEAN     NOT NULL DEFAULT false,
    "termsAcceptedAt"  TIMESTAMPTZ,
    "dataConsent"      BOOLEAN     NOT NULL DEFAULT false,

    "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger para atualizar updatedAt automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_users_updated_at ON users;
CREATE TRIGGER set_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- =============================================================================
-- TABELA: participantes
-- Participantes dos eventos (cadastro público)
-- =============================================================================
CREATE TABLE IF NOT EXISTS participantes (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    nome            TEXT        NOT NULL,
    email           TEXT        NOT NULL,
    telefone        TEXT        NOT NULL,
    empresa         TEXT,                               -- Usado como 'Instituição' no UI
    cidade          TEXT        NOT NULL,
    escola          TEXT        NOT NULL,
    gremio          TEXT,
    codigo          TEXT        NOT NULL UNIQUE,
    aceitou_termos  BOOLEAN     NOT NULL DEFAULT false,
    termos_aceitos_em TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices de performance
CREATE INDEX IF NOT EXISTS idx_participantes_codigo ON participantes(codigo);
CREATE INDEX IF NOT EXISTS idx_participantes_email  ON participantes(email);


-- =============================================================================
-- TABELA: eventos
-- Eventos gerenciados pelo painel administrativo
-- =============================================================================
CREATE TABLE IF NOT EXISTS eventos (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    titulo      TEXT        NOT NULL,
    descricao   TEXT,
    data        TIMESTAMPTZ NOT NULL,
    local       TEXT        NOT NULL,
    publicado   BOOLEAN     NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índice para busca por eventos publicados
CREATE INDEX IF NOT EXISTS idx_eventos_publicado ON eventos(publicado);


-- =============================================================================
-- TABELA: inscricoes_evento
-- Relação muitos-para-muitos entre participantes e eventos
-- =============================================================================
CREATE TABLE IF NOT EXISTS inscricoes_evento (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    evento_id       UUID        NOT NULL REFERENCES eventos(id)      ON DELETE CASCADE,
    participante_id UUID        NOT NULL REFERENCES participantes(id) ON DELETE CASCADE,
    presente        BOOLEAN     NOT NULL DEFAULT false,
    confirmado_em   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_evento_participante UNIQUE (evento_id, participante_id)
);

-- Índices de performance
CREATE INDEX IF NOT EXISTS idx_inscricoes_evento_evento_id      ON inscricoes_evento(evento_id);
CREATE INDEX IF NOT EXISTS idx_inscricoes_evento_participante_id ON inscricoes_evento(participante_id);


-- =============================================================================
-- FUNÇÕES AUXILIARES
-- Usadas pelo backend para operações específicas sem expor dados desnecessários
-- =============================================================================

-- 1. Buscar participante por e-mail (para recuperação de credencial)
CREATE OR REPLACE FUNCTION get_participant_by_email(p_email TEXT)
RETURNS TABLE (nome TEXT, codigo TEXT, registrado BOOLEAN)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT p.nome, p.codigo, true AS registrado
    FROM participantes p
    WHERE LOWER(p.email) = LOWER(TRIM(p_email));
END;
$$;

-- 2. Buscar participante por código (para check-in)
CREATE OR REPLACE FUNCTION get_participant_by_code(p_code TEXT)
RETURNS TABLE (id UUID, nome TEXT)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT p.id, p.nome
    FROM participantes p
    WHERE UPPER(p.codigo) = UPPER(TRIM(p_code));
END;
$$;

-- 3. Verificar se inscrição em evento já existe
CREATE OR REPLACE FUNCTION check_event_registration(p_event_id UUID, p_participant_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
    v_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM inscricoes_evento
        WHERE evento_id = p_event_id AND participante_id = p_participant_id
    ) INTO v_exists;
    RETURN v_exists;
END;
$$;


-- =============================================================================
-- USUÁRIO ADMINISTRADOR PADRÃO
-- Substitua a senha pelo hash gerado pelo bcrypt (12 rounds)
-- Para gerar o hash, use: node -e "require('bcrypt').hash('SUA_SENHA', 12).then(console.log)"
-- OU deixe em branco e crie o admin via API após o deploy
-- =============================================================================

-- Exemplo de inserção do admin (DESCOMENTE e substitua o hash abaixo):
-- INSERT INTO users (email, password, "fullName", role)
-- VALUES (
--     'seu-email@exemplo.com',
--     '$2b$12$HASH_GERADO_PELO_BCRYPT_AQUI',
--     'Administrador',
--     'admin'
-- )
-- ON CONFLICT (email) DO NOTHING;


-- =============================================================================
-- VERIFICAÇÃO FINAL
-- =============================================================================
SELECT
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns c WHERE c.table_name = t.table_name AND c.table_schema = 'public') AS colunas
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;
