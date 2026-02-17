-- ==============================================================================
-- REPARO: MÓDULO LISTA DO DIA (ListasProducaoDia)
-- ==============================================================================
-- Cria a tabela necessária para o funcionamento da Lista do Dia.

CREATE TABLE IF NOT EXISTS "ListasProducaoDia" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "Data" DATE NOT NULL,
    "Categoria" VARCHAR(50), -- Ex: Manhã, Tarde, Noite, Evento
    "ItensJSON" JSONB,
    "Status" VARCHAR(20) DEFAULT 'Rascunho', -- Rascunho, Enviado
    "CriadoEm" TIMESTAMP DEFAULT NOW(),
    UNIQUE("Data", "Categoria")
);

-- Habilitar Segurança (RLS)
ALTER TABLE "ListasProducaoDia" ENABLE ROW LEVEL SECURITY;

-- Criar Política de Acesso para a API
DROP POLICY IF EXISTS "Acesso API ListasProducaoDia" ON "ListasProducaoDia";
CREATE POLICY "Acesso API ListasProducaoDia" ON "ListasProducaoDia" FOR ALL USING (true);

-- Atualizar cache do esquema
NOTIFY pgrst, 'reload config';