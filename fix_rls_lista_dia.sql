-- ==============================================================================
-- CORREÇÃO DE SEGURANÇA (RLS) - LISTA DO DIA
-- ==============================================================================
-- Este script corrige o erro "new row violates row-level security policy"
-- liberando permissões de leitura e escrita na tabela ListasProducaoDia.

-- 1. Garante que RLS está ativo
ALTER TABLE "ListasProducaoDia" ENABLE ROW LEVEL SECURITY;

-- 2. Remove políticas antigas que podem estar bloqueando
DROP POLICY IF EXISTS "Acesso API ListasProducaoDia" ON "ListasProducaoDia";
DROP POLICY IF EXISTS "Acesso Total ListasProducaoDia" ON "ListasProducaoDia";

-- 3. Cria uma nova política permissiva para todas as operações (SELECT, INSERT, UPDATE, DELETE)
CREATE POLICY "Acesso Total ListasProducaoDia"
ON "ListasProducaoDia"
FOR ALL
USING (true)
WITH CHECK (true);

-- 4. Atualiza o cache de permissões do banco
NOTIFY pgrst, 'reload config';