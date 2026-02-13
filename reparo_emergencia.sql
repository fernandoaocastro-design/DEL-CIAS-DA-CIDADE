-- ==============================================================================
-- SCRIPT DE REPARO DE EMERGÊNCIA - DELÍCIAS DA CIDADE
-- ==============================================================================
-- Execute este script para corrigir erros de carregamento nos módulos.

-- 1. GARANTIR QUE O USUÁRIO ADMIN EXISTE (Para Login)
-- Insere o admin apenas se não existir ninguém com esse email.
INSERT INTO "Usuarios" ("Nome", "Email", "Senha", "Cargo", "Status")
SELECT 'Administrador', 'admin@deliciadacidade.com', '123456', 'Administrador', 'Ativo'
WHERE NOT EXISTS (
    SELECT 1 FROM "Usuarios" WHERE "Email" = 'admin@deliciadacidade.com'
);

-- 2. CORRIGIR PERMISSÕES DE SEGURANÇA (RLS)
-- Libera o acesso para a API (necessário para o sistema funcionar)
ALTER TABLE "Usuarios" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso Total API Usuarios" ON "Usuarios";
CREATE POLICY "Acesso Total API Usuarios" ON "Usuarios" FOR ALL USING (true);

ALTER TABLE "Financas" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso Total API Financas" ON "Financas";
CREATE POLICY "Acesso Total API Financas" ON "Financas" FOR ALL USING (true);

ALTER TABLE "Estoque" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso Total API Estoque" ON "Estoque";
CREATE POLICY "Acesso Total API Estoque" ON "Estoque" FOR ALL USING (true);

ALTER TABLE "Funcionarios" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso Total API Funcionarios" ON "Funcionarios";
CREATE POLICY "Acesso Total API Funcionarios" ON "Funcionarios" FOR ALL USING (true);

-- 3. RECRIAR FUNÇÕES DE OTIMIZAÇÃO (RPCs)
-- Necessárias para o Dashboard, Estoque e Fidelidade funcionarem.

-- 3.1. Total de Refeições (Dashboard)
CREATE OR REPLACE FUNCTION get_total_refeicoes_mes(data_inicio DATE)
RETURNS INTEGER AS $$
BEGIN
    RETURN (SELECT COALESCE(SUM("Quantidade"), 0)::INTEGER FROM "MLPain_Registros" WHERE "Data" >= data_inicio);
END;
$$ LANGUAGE plpgsql;

-- 3.2. Gráfico de Refeições (Dashboard)
CREATE OR REPLACE FUNCTION get_refeicoes_grafico(data_inicio DATE)
RETURNS TABLE ("Data" DATE, "Quantidade" INTEGER) AS $$
BEGIN
    RETURN QUERY
    SELECT "MLPain_Registros"."Data", COALESCE(SUM("MLPain_Registros"."Quantidade"), 0)::INTEGER
    FROM "MLPain_Registros"
    WHERE "MLPain_Registros"."Data" >= data_inicio
    GROUP BY "MLPain_Registros"."Data"
    ORDER BY "MLPain_Registros"."Data";
END;
$$ LANGUAGE plpgsql;

-- 3.3. Estoque Parado (Relatório de Estoque)
CREATE OR REPLACE FUNCTION get_estoque_parado(dias_param int)
RETURNS TABLE (
    "ID" uuid, "Nome" text, "Quantidade" numeric, "Unidade" text,
    "CustoUnitario" numeric, "UltimaAtualizacao" timestamptz, "ValorTotal" numeric
) AS $$
DECLARE
    data_corte timestamptz := now() - (dias_param || ' days')::interval;
BEGIN
    RETURN QUERY
    SELECT
        e."ID", e."Nome"::text, e."Quantidade", e."Unidade"::text,
        e."CustoUnitario", e."UltimaAtualizacao",
        (e."Quantidade" * COALESCE(e."CustoUnitario", 0)) as "ValorTotal"
    FROM "Estoque" e
    WHERE e."Quantidade" > 0
    AND NOT EXISTS (
        SELECT 1 FROM "MovimentacoesEstoque" m
        WHERE m."ProdutoID" = e."ID" AND m."Tipo" = 'Saida' AND m."Data" >= data_corte
    );
END;
$$ LANGUAGE plpgsql;

-- 3.4. Recalcular Fidelidade (Clientes)
CREATE OR REPLACE FUNCTION recalcular_fidelidade()
RETURNS void AS $$
BEGIN
    UPDATE "Clientes" c
    SET "Pontos" = sub.pontos, "TotalGasto" = sub.total_gasto, "UltimaCompra" = sub.ultima_compra
    FROM (
        SELECT "Cliente", SUM("Valor") as total_gasto, FLOOR(SUM("Valor") / 1000) as pontos, MAX("Data") as ultima_compra
        FROM "Eventos" WHERE "Status" != 'Cancelado' AND "Cliente" IS NOT NULL GROUP BY "Cliente"
    ) sub
    WHERE LOWER(TRIM(c."Nome")) = LOWER(TRIM(sub."Cliente"));
END;
$$ LANGUAGE plpgsql;

-- 4. CORREÇÃO DE TABELAS FALTANTES
-- Cria tabelas que podem estar faltando e quebrando o carregamento inicial
CREATE TABLE IF NOT EXISTS "ParametrosCozinha" ("ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(), "Tipo" VARCHAR(50), "Valor" VARCHAR(100));
CREATE TABLE IF NOT EXISTS "ParametrosEstoque" ("ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(), "Tipo" VARCHAR(50), "Valor" VARCHAR(100));
CREATE TABLE IF NOT EXISTS "ParametrosFinanceiro" ("ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(), "Tipo" VARCHAR(50), "Valor" VARCHAR(100));

-- Atualiza cache do esquema
NOTIFY pgrst, 'reload config';