-- ==============================================================================
-- ATUALIZAÇÃO: CAMPO STATUS NA FREQUÊNCIA
-- ==============================================================================

ALTER TABLE "Frequencia" ADD COLUMN IF NOT EXISTS "Status" VARCHAR(50);

-- Atualiza cache
NOTIFY pgrst, 'reload config';