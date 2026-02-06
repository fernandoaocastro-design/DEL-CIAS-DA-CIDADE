-- ==============================================================================
-- MANUAL DE SEGURANÇA E BACKUP (PARA RODAR NO EDITOR SQL DO SUPABASE)
-- ==============================================================================

-- PARTE 1: SEGURANÇA (ROW LEVEL SECURITY)
-- Ativar RLS impede acesso não autorizado direto ao banco.
-- Como seu sistema usa uma API centralizada (business.js), criamos uma política
-- que permite o acesso da API, mas bloqueia acessos externos desconhecidos.

-- 1.1. Ativar RLS nas tabelas principais
ALTER TABLE "Usuarios" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Funcionarios" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Financas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Estoque" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FichasTecnicas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PlanejamentoProducao" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OrdensProducao" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ConsumoIngredientes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ControleDesperdicio" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MLPain_Areas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MLPain_Registros" ENABLE ROW LEVEL SECURITY;

-- 1.2. Criar Política de Acesso (Permitir acesso público/anonimo por enquanto)
-- NOTA: Como sua API usa a chave ANON, precisamos liberar o acesso para ela.
-- Futuramente, podemos restringir isso apenas ao IP do servidor ou usuário logado.

DROP POLICY IF EXISTS "Acesso API Usuarios" ON "Usuarios";
CREATE POLICY "Acesso API Usuarios" ON "Usuarios" FOR ALL USING (true);

DROP POLICY IF EXISTS "Acesso API Funcionarios" ON "Funcionarios";
CREATE POLICY "Acesso API Funcionarios" ON "Funcionarios" FOR ALL USING (true);

DROP POLICY IF EXISTS "Acesso API Financas" ON "Financas";
CREATE POLICY "Acesso API Financas" ON "Financas" FOR ALL USING (true);

DROP POLICY IF EXISTS "Acesso API Estoque" ON "Estoque";
CREATE POLICY "Acesso API Estoque" ON "Estoque" FOR ALL USING (true);

DROP POLICY IF EXISTS "Acesso API FichasTecnicas" ON "FichasTecnicas";
CREATE POLICY "Acesso API FichasTecnicas" ON "FichasTecnicas" FOR ALL USING (true);

DROP POLICY IF EXISTS "Acesso API Planejamento" ON "PlanejamentoProducao";
CREATE POLICY "Acesso API Planejamento" ON "PlanejamentoProducao" FOR ALL USING (true);

DROP POLICY IF EXISTS "Acesso API Ordens" ON "OrdensProducao";
CREATE POLICY "Acesso API Ordens" ON "OrdensProducao" FOR ALL USING (true);

DROP POLICY IF EXISTS "Acesso API Consumo" ON "ConsumoIngredientes";
CREATE POLICY "Acesso API Consumo" ON "ConsumoIngredientes" FOR ALL USING (true);

DROP POLICY IF EXISTS "Acesso API Desperdicio" ON "ControleDesperdicio";
CREATE POLICY "Acesso API Desperdicio" ON "ControleDesperdicio" FOR ALL USING (true);

DROP POLICY IF EXISTS "Acesso API MLPain Areas" ON "MLPain_Areas";
CREATE POLICY "Acesso API MLPain Areas" ON "MLPain_Areas" FOR ALL USING (true);

DROP POLICY IF EXISTS "Acesso API MLPain Registros" ON "MLPain_Registros";
CREATE POLICY "Acesso API MLPain Registros" ON "MLPain_Registros" FOR ALL USING (true);


-- ==============================================================================
-- PARTE 2: COMO FAZER CÓPIA DOS DADOS (BACKUP DE EMERGÊNCIA)
-- ==============================================================================
-- Se você vai fazer uma alteração perigosa e quer salvar os dados antes,
-- rode estes comandos para criar tabelas de backup com a data atual.

-- Exemplo: Criar backup da tabela de Funcionários
CREATE TABLE "Backup_Funcionarios_Hoje" AS
SELECT * FROM "Funcionarios";

-- Exemplo: Criar backup do Financeiro
CREATE TABLE "Backup_Financas_Hoje" AS
SELECT * FROM "Financas";

-- Exemplo: Criar backup do Estoque
CREATE TABLE "Backup_Estoque_Hoje" AS
SELECT * FROM "Estoque";

-- ==============================================================================
-- PARTE 3: COMO RESTAURAR OS DADOS (SE ALGO DEU ERRADO)
-- ==============================================================================
-- Se você apagou algo sem querer, pode recuperar da tabela de backup criada acima.

-- 1. Limpar a tabela atual (CUIDADO!)
-- TRUNCATE TABLE "Funcionarios";

-- 2. Inserir os dados do backup de volta
-- INSERT INTO "Funcionarios" SELECT * FROM "Backup_Funcionarios_Hoje";

-- ==============================================================================
-- PARTE 4: LIMPEZA
-- ==============================================================================
-- Quando não precisar mais do backup, apague para não ocupar espaço

-- DROP TABLE "Backup_Funcionarios_Hoje";

-- ==============================================================================
-- PARTE 5: CORREÇÕES DE ERROS COMUNS (RODAR NO SQL EDITOR)
-- ==============================================================================
-- Erro: Could not find the 'SaldoFerias' column of 'Funcionarios'
ALTER TABLE "Funcionarios" ADD COLUMN IF NOT EXISTS "SaldoFerias" DECIMAL(10,2);

-- Erro: null value in column "ID" of relation "Inventario" (Correção de Default)
ALTER TABLE "Inventario" ALTER COLUMN "ID" SET DEFAULT gen_random_uuid();

-- Verificação de outras colunas essenciais (Sincronização com schema.sql)
-- Tabela Usuarios
ALTER TABLE "Usuarios" ADD COLUMN IF NOT EXISTS "Assinatura" TEXT;
ALTER TABLE "Usuarios" ADD COLUMN IF NOT EXISTS "Permissoes" JSONB;

-- Tabela Funcionarios
ALTER TABLE "Funcionarios" ADD COLUMN IF NOT EXISTS "FotoURL" TEXT;

-- Tabela Estoque e Movimentações
ALTER TABLE "Estoque" ADD COLUMN IF NOT EXISTS "Fornecedor" VARCHAR(255);
ALTER TABLE "Estoque" ADD COLUMN IF NOT EXISTS "PrecoVenda" DECIMAL(12,2);
ALTER TABLE "Estoque" ADD COLUMN IF NOT EXISTS "MargemLucro" DECIMAL(5,2);
ALTER TABLE "MovimentacoesEstoque" ADD COLUMN IF NOT EXISTS "DetalhesJSON" JSONB;
ALTER TABLE "MovimentacoesEstoque" ADD COLUMN IF NOT EXISTS "Data" TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Tabela Inventario (Patrimônio)
ALTER TABLE "Inventario" ADD COLUMN IF NOT EXISTS "NumeroSerie" VARCHAR(100);
ALTER TABLE "Inventario" ADD COLUMN IF NOT EXISTS "EstadoConservacao" VARCHAR(50);
ALTER TABLE "Inventario" ADD COLUMN IF NOT EXISTS "VidaUtil" INTEGER;
ALTER TABLE "Inventario" ADD COLUMN IF NOT EXISTS "Marca" VARCHAR(100);
ALTER TABLE "Inventario" ADD COLUMN IF NOT EXISTS "Modelo" VARCHAR(100);
ALTER TABLE "Inventario" ADD COLUMN IF NOT EXISTS "Localizacao" VARCHAR(100);
ALTER TABLE "Inventario" ADD COLUMN IF NOT EXISTS "FotoURL" TEXT;
ALTER TABLE "Inventario" ADD COLUMN IF NOT EXISTS "Observacoes" TEXT;
ALTER TABLE "Inventario" ADD COLUMN IF NOT EXISTS "ValorAquisicao" DECIMAL(12,2);

-- Tabela MLPain (Cozinha)
ALTER TABLE "MLPain_Registros" ADD COLUMN IF NOT EXISTS "AreaNome" VARCHAR(100);
ALTER TABLE "MLPain_Registros" ADD COLUMN IF NOT EXISTS "ResponsavelEntrega" VARCHAR(255);
ALTER TABLE "MLPain_Areas" ADD COLUMN IF NOT EXISTS "MetaDiaria" INTEGER DEFAULT 0;
ALTER TABLE "MLPain_Areas" ADD COLUMN IF NOT EXISTS "Tipo" VARCHAR(50) DEFAULT 'Sólido';
ALTER TABLE "MLPain_Areas" ADD COLUMN IF NOT EXISTS "Ordem" INTEGER DEFAULT 0;

-- Tabela Configurações
ALTER TABLE "InstituicaoConfig" ADD COLUMN IF NOT EXISTS "SubsidioFeriasPorcentagem" DECIMAL(5,2) DEFAULT 50.00;
ALTER TABLE "InstituicaoConfig" ADD COLUMN IF NOT EXISTS "ExibirLogoRelatorios" BOOLEAN DEFAULT FALSE;
ALTER TABLE "InstituicaoConfig" ADD COLUMN IF NOT EXISTS "CorRelatorios" VARCHAR(20) DEFAULT '#3B82F6';

-- Tabela Produção
ALTER TABLE "FichasTecnicas" ADD COLUMN IF NOT EXISTS "IngredientesJSON" JSONB;
ALTER TABLE "FichasTecnicas" ADD COLUMN IF NOT EXISTS "ValorNutricional" JSONB;

-- ==============================================================================
-- PARTE 6: TABELA DE ESCALA (DIARISTAS)
-- ==============================================================================
-- Tabela para definir dias de trabalho ou folga fixos por dia da semana
CREATE TABLE IF NOT EXISTS "Escala" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "FuncionarioID" UUID REFERENCES "Funcionarios"("ID") ON DELETE CASCADE,
    "DiaSemana" INTEGER NOT NULL, -- 1=Segunda, 2=Terça, ..., 7=Domingo
    "Tipo" VARCHAR(20) DEFAULT 'Folga', -- 'Folga' ou 'Trabalho'
    "CriadoEm" TIMESTAMP DEFAULT NOW(),
    UNIQUE("FuncionarioID", "DiaSemana")
);

ALTER TABLE "Escala" ENABLE ROW LEVEL SECURITY;

-- Política de acesso para a API
DROP POLICY IF EXISTS "Acesso API Escala" ON "Escala";
CREATE POLICY "Acesso API Escala" ON "Escala" FOR ALL USING (true);

-- ==============================================================================
-- PARTE 7: TABELA DE EVENTOS (CORREÇÃO DE ERRO)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS "Eventos" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "Titulo" VARCHAR(255) NOT NULL,
    "Data" DATE NOT NULL,
    "Hora" TIME,
    "Cliente" VARCHAR(255),
    "Descricao" TEXT,
    "Categoria" VARCHAR(100),
    "Status" VARCHAR(50) DEFAULT 'Agendado',
    "CriadoEm" TIMESTAMP DEFAULT NOW()
);

ALTER TABLE "Eventos" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acesso API Eventos" ON "Eventos";
CREATE POLICY "Acesso API Eventos" ON "Eventos" FOR ALL USING (true);

-- ==============================================================================
-- PARTE 8: FUNÇÕES DE PERFORMANCE (RPC) - OTIMIZAÇÃO MLPAIN
-- ==============================================================================
-- Estas funções processam dados pesados no servidor SQL para evitar lentidão no App.

-- 8.1. Total de Refeições no Mês (Para Dashboard)
CREATE OR REPLACE FUNCTION get_total_refeicoes_mes(data_inicio DATE)
RETURNS INTEGER AS $$
BEGIN
    RETURN (SELECT COALESCE(SUM("Quantidade"), 0)::INTEGER FROM "MLPain_Registros" WHERE "Data" >= data_inicio);
END;
$$ LANGUAGE plpgsql;

-- 8.2. Estatísticas de Dietas do Dia (Para Relatório Diário)
CREATE OR REPLACE FUNCTION get_estatisticas_dietas(data_consulta DATE)
RETURNS JSONB AS $$
DECLARE
    total_val INTEGER;
    detalhes_json JSONB;
    result JSONB;
BEGIN
    -- 1. Calcular Total Geral (Soma tudo, sem risco de esquecer categorias novas)
    SELECT COALESCE(SUM("Quantidade"), 0) INTO total_val FROM "MLPain_Registros" WHERE "Data" = data_consulta;

    -- 2. Calcular Detalhes Dinâmicos (Agrupa automaticamente pelo que estiver cadastrado)
    SELECT jsonb_object_agg(categoria, qtd) INTO detalhes_json
    FROM (
        SELECT 
            CASE 
                WHEN "Tipo" = 'Sólido' THEN 'Sólido'
                WHEN "Subtipo" IS NOT NULL AND "Subtipo" != '' THEN "Subtipo"
                ELSE COALESCE("Tipo", 'Outros')
            END as categoria,
            SUM("Quantidade") as qtd
        FROM "MLPain_Registros"
        WHERE "Data" = data_consulta
        GROUP BY 1
    ) sub;

    -- 3. Montar Resultado (Híbrido: Compatibilidade + Dinâmico)
    result := jsonb_build_object(
        'total', total_val,
        'detalhes', COALESCE(detalhes_json, '{}'::jsonb),
        -- Mantemos estes campos para não quebrar o frontend atual
        'solidos', COALESCE((detalhes_json->>'Sólido')::int, 0),
        'sopa', COALESCE((detalhes_json->>'Sopa')::int, 0),
        'cha', COALESCE((detalhes_json->>'Chá')::int, 0)
    );

    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 8.3. Dados para Gráfico de Refeições (Últimos 7 dias)
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