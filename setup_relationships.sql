-- ==============================================================================
-- CONFIGURAÇÃO DE RELACIONAMENTOS (FOREIGN KEYS)
-- ==============================================================================
-- Necessário para que a API consiga fazer JOINs (ex: Movimentacoes + Estoque)

-- 1. Vincular Movimentações ao Estoque
-- Se a constraint já existir, o comando falhará silenciosamente ou pode ser ignorado.
ALTER TABLE "MovimentacoesEstoque" 
DROP CONSTRAINT IF EXISTS "MovimentacoesEstoque_ProdutoID_fkey";

ALTER TABLE "MovimentacoesEstoque"
ADD CONSTRAINT "MovimentacoesEstoque_ProdutoID_fkey"
FOREIGN KEY ("ProdutoID") REFERENCES "Estoque"("ID") ON DELETE CASCADE;

-- Atualizar cache do esquema para a API reconhecer a relação
NOTIFY pgrst, 'reload config';