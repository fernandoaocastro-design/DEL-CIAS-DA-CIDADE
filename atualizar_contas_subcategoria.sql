-- ==============================================================================
-- ATUALIZAÇÃO: SUBCATEGORIAS EM CONTAS A PAGAR/RECEBER
-- ==============================================================================

ALTER TABLE "ContasPagar" ADD COLUMN IF NOT EXISTS "Subcategoria" VARCHAR(100);
ALTER TABLE "ContasReceber" ADD COLUMN IF NOT EXISTS "Subcategoria" VARCHAR(100);

-- Atualiza cache do esquema
NOTIFY pgrst, 'reload config';