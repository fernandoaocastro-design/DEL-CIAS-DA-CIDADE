-- ==============================================================================
-- ATUALIZAÇÃO: CAMPO PRATO DO DIA
-- ==============================================================================

ALTER TABLE "ListasProducaoDia" ADD COLUMN IF NOT EXISTS "Prato" TEXT;

NOTIFY pgrst, 'reload config';