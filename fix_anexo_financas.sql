-- ==============================================================================
-- CORREÇÃO: ADICIONAR COLUNA ANEXO NA TABELA FINANÇAS
-- ==============================================================================

ALTER TABLE "Financas" ADD COLUMN IF NOT EXISTS "Anexo" TEXT;

-- Força a atualização do cache do Supabase para reconhecer a nova coluna
NOTIFY pgrst, 'reload config';