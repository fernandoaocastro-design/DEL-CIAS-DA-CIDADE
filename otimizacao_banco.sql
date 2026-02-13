-- ==============================================================================
-- OTIMIZAÇÃO DE PERFORMANCE - LÓGICA NO BANCO DE DADOS
-- ==============================================================================
-- Execute este script no SQL Editor do Supabase para criar as funções otimizadas.

-- 1. OTIMIZAÇÃO: CÁLCULO DE FIDELIDADE
-- Substitui o loop lento no JavaScript por uma única atualização em massa no SQL.
CREATE OR REPLACE FUNCTION recalcular_fidelidade()
RETURNS void AS $$
BEGIN
    -- Atualiza a tabela de Clientes com base na soma dos Eventos (Vendas)
    UPDATE "Clientes" c
    SET
        "Pontos" = sub.pontos,
        "TotalGasto" = sub.total_gasto,
        "UltimaCompra" = sub.ultima_compra
    FROM (
        SELECT
            "Cliente",
            SUM("Valor") as total_gasto,
            FLOOR(SUM("Valor") / 1000) as pontos, -- Regra: 1 ponto a cada 1000 Kz
            MAX("Data") as ultima_compra
        FROM "Eventos"
        WHERE "Status" != 'Cancelado' AND "Cliente" IS NOT NULL
        GROUP BY "Cliente"
    ) sub
    WHERE LOWER(TRIM(c."Nome")) = LOWER(TRIM(sub."Cliente"));
END;
$$ LANGUAGE plpgsql;

-- 2. OTIMIZAÇÃO: ESTOQUE PARADO (DEAD STOCK)
-- Substitui a filtragem de arrays no JavaScript por um LEFT JOIN eficiente.
CREATE OR REPLACE FUNCTION get_estoque_parado(dias_param int)
RETURNS TABLE (
    "ID" uuid,
    "Nome" text,
    "Quantidade" numeric,
    "Unidade" text,
    "CustoUnitario" numeric,
    "UltimaAtualizacao" timestamptz,
    "ValorTotal" numeric
) AS $$
DECLARE
    data_corte timestamptz := now() - (dias_param || ' days')::interval;
BEGIN
    RETURN QUERY
    SELECT
        e."ID",
        e."Nome"::text,
        e."Quantidade",
        e."Unidade"::text,
        e."CustoUnitario",
        e."UltimaAtualizacao",
        (e."Quantidade" * COALESCE(e."CustoUnitario", 0)) as "ValorTotal"
    FROM "Estoque" e
    WHERE e."Quantidade" > 0
    AND NOT EXISTS (
        SELECT 1
        FROM "MovimentacoesEstoque" m
        WHERE m."ProdutoID" = e."ID"
        AND m."Tipo" = 'Saida'
        AND m."Data" >= data_corte
    );
END;
$$ LANGUAGE plpgsql;