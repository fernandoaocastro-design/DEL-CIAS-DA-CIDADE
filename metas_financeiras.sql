-- ==============================================================================
-- TABELA DE METAS FINANCEIRAS
-- ==============================================================================

CREATE TABLE IF NOT EXISTS "MetasFinanceiras" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "Mes" VARCHAR(7) NOT NULL, -- Formato: YYYY-MM
    "ReceitaEsperada" DECIMAL(12,2) DEFAULT 0,
    "DespesaMaxima" DECIMAL(12,2) DEFAULT 0,
    "CriadoEm" TIMESTAMP DEFAULT NOW(),
    UNIQUE("Mes") -- Garante apenas uma meta por mês
);

ALTER TABLE "MetasFinanceiras" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso API Metas" ON "MetasFinanceiras" FOR ALL USING (true);

-- Atualiza cache
NOTIFY pgrst, 'reload config';