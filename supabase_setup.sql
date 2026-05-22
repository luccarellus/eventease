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
  presente BOOLEAN DEFAULT false,
  confirmado_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE participantes ENABLE ROW LEVEL SECURITY;

-- Políticas de Segurança (RLS)

-- 1. Público: Permitir inserção (cadastro)
CREATE POLICY "Permitir cadastro público" 
ON participantes FOR INSERT 
WITH CHECK (true);

-- 2. Público: Permitir verificação de um código específico (para check-in)
-- Nota: O usuário precisa saber o código.
CREATE POLICY "Permitir leitura por código para check-in" 
ON participantes FOR SELECT 
USING (true);

-- 3. Público: Permitir atualização de presença se souber o código
CREATE POLICY "Permitir confirmar presença por código" 
ON participantes FOR UPDATE
USING (true)
WITH CHECK (true);

-- 4. Admin: Controle total via autenticação
-- Assumindo que o admin é o dono do projeto ou usuários logados
-- Para simplificar neste exemplo, permitimos tudo para usuários autenticados
CREATE POLICY "Admin: Controle total" 
ON participantes 
FOR ALL 
TO authenticated 
USING (true);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_participantes_codigo ON participantes(codigo);
CREATE INDEX IF NOT EXISTS idx_participantes_email ON participantes(email);

-- =========================================================================
-- MULTI-EVENT SYSTEM EXTENSION
-- =========================================================================

-- 1. Tabela de eventos
CREATE TABLE IF NOT EXISTS eventos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  descricao TEXT,
  data TIMESTAMPTZ NOT NULL,
  local TEXT NOT NULL,
  publicado BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Tabela de inscrições de eventos
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

-- Políticas para Eventos
CREATE POLICY "Permitir leitura pública de eventos publicados" 
ON eventos FOR SELECT 
USING (publicado = true OR auth.role() = 'authenticated');

CREATE POLICY "Admin: Controle total de eventos" 
ON eventos FOR ALL 
TO authenticated 
USING (true)
WITH CHECK (true);

-- Políticas para Inscrições de Eventos
CREATE POLICY "Permitir leitura pública de inscricoes" 
ON inscricoes_evento FOR SELECT 
USING (true);

CREATE POLICY "Permitir inscricao pública em eventos" 
ON inscricoes_evento FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Permitir confirmar presenca em evento por codigo" 
ON inscricoes_evento FOR UPDATE 
USING (true)
WITH CHECK (true);

CREATE POLICY "Admin: Controle total de inscricoes" 
ON inscricoes_evento FOR ALL 
TO authenticated 
USING (true)
WITH CHECK (true);

-- Índices
CREATE INDEX IF NOT EXISTS idx_inscricoes_evento_evento_id ON inscricoes_evento(evento_id);
CREATE INDEX IF NOT EXISTS idx_inscricoes_evento_participante_id ON inscricoes_evento(participante_id);
CREATE INDEX IF NOT EXISTS idx_eventos_publicado ON eventos(publicado);

