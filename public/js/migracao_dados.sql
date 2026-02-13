-- ==============================================================================
-- SCRIPTS DE MIGRAÇÃO DE DADOS (SUPABASE / POSTGRESQL)
-- Copie e cole no SQL Editor do Supabase para executar.
-- ==============================================================================

-- 1. MIGRAÇÃO SIMPLES (INSERT INTO ... SELECT)
-- Copia dados de uma tabela origem para destino mapeando as colunas.
-- Exemplo: Copiar de 'Tabela_Antiga' para 'Funcionarios'

/*
INSERT INTO "Funcionarios" (
    "Nome", 
    "Email", 
    "Telefone", 
    "Cargo", 
    "Salario", 
    "Status"
)
SELECT 
    "nome_completo", 
    "email_contato", 
    "celular", 
    "funcao", 
    "pretensao_salarial", 
    'Ativo' -- Valor fixo
FROM "Candidatos_Banco_Talentos"; -- Tabela origem hipotética
*/

-- 2. MIGRAÇÃO COM "UPSERT" (INSERIR OU ATUALIZAR)
-- Útil para sincronizar tabelas sem gerar erro de chave duplicada.
-- Se o ID já existir, ele atualiza os campos; se não, cria novo.

/*
INSERT INTO "Estoque" ("ID", "Nome", "Quantidade", "CustoUnitario")
SELECT "id_produto", "descricao", "saldo_atual", "custo"
FROM "Importacao_Estoque_Excel"
ON CONFLICT ("ID") 
DO UPDATE SET
    "Quantidade" = EXCLUDED."Quantidade",
    "CustoUnitario" = EXCLUDED."CustoUnitario",
    "UltimaAtualizacao" = NOW();
*/

-- 3. MIGRAÇÃO COM TRANSFORMAÇÃO DE DADOS
-- Exemplo: Migrar dados e formatar texto ou calcular valores na hora.

/*
INSERT INTO "Clientes" ("Nome", "Telefone", "CriadoEm")
SELECT 
    INITCAP("nome_cliente"), -- Primeira letra maiúscula
    REGEXP_REPLACE("telefone", '\D', '', 'g'), -- Remove tudo que não for número
    NOW()
FROM "Leads_Marketing"
WHERE "interesse" = 'Alto';
*/

-- 4. MIGRAÇÃO EM LOTES (DO BLOCK)
-- Recomendado para lógicas complexas que o SQL simples não resolve.

/*
DO $$
DECLARE
    registro RECORD;
BEGIN
    FOR registro IN SELECT * FROM "Vendas_Legado" LOOP
        -- Exemplo: Só migra se o valor for maior que 0
        IF registro.valor > 0 THEN
            INSERT INTO "Financas" ("Descricao", "Valor", "Tipo", "Data", "Categoria")
            VALUES (
                'Venda Legado #' || registro.id,
                registro.valor,
                'Receita',
                registro.data_venda,
                'Vendas'
            );
        END IF;
    END LOOP;
END $$;
*/

-- 5. LIMPEZA DE DUPLICATAS (CLIENTES)
-- Função para remover clientes com mesmo nome, mantendo o cadastro mais antigo.
-- Útil se houver duplicidade na tabela de fidelidade.

/*
CREATE OR REPLACE FUNCTION limpar_clientes_duplicados() RETURNS text AS $$
DECLARE
    removidos INTEGER;
BEGIN
    WITH duplicatas AS (
        SELECT "ID",
               ROW_NUMBER() OVER (
                   PARTITION BY lower(trim("Nome")) 
                   ORDER BY "CriadoEm" ASC
               ) as rn
        FROM "Clientes"
    )
    DELETE FROM "Clientes"
    WHERE "ID" IN (SELECT "ID" FROM duplicatas WHERE rn > 1);
    
    GET DIAGNOSTICS removidos = ROW_COUNT;
    RETURN 'Limpeza concluída. Registros removidos: ' || removidos;
END;
$$ LANGUAGE plpgsql;

-- Para rodar: SELECT limpar_clientes_duplicados();

-- Opcional: Prevenir futuras duplicatas criando um índice único
CREATE UNIQUE INDEX IF NOT EXISTS "idx_clientes_nome_unico" ON "Clientes" (lower(trim("Nome")));
*/