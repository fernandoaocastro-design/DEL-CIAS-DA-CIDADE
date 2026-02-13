-- ==============================================================================
-- CORREÇÃO: ADICIONAR COLUNA SUBCATEGORIA EM CONTAS A RECEBER E PAGAR
-- ==============================================================================

-- Garante que a coluna existe na tabela ContasReceber
ALTER TABLE "ContasReceber" ADD COLUMN IF NOT EXISTS "Subcategoria" VARCHAR(100);

-- Garante que a coluna existe na tabela ContasPagar (por precaução)
ALTER TABLE "ContasPagar" ADD COLUMN IF NOT EXISTS "Subcategoria" VARCHAR(100);

-- Atualiza o cache do esquema do Supabase para reconhecer as novas colunas imediatamente
NOTIFY pgrst, 'reload config';