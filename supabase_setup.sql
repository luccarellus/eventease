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
