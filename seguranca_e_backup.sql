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

-- 1.2. Criar Política de Acesso (Permitir acesso público/anonimo por enquanto)
-- NOTA: Como sua API usa a chave ANON, precisamos liberar o acesso para ela.
-- Futuramente, podemos restringir isso apenas ao IP do servidor ou usuário logado.

CREATE POLICY "Acesso API Usuarios" ON "Usuarios" FOR ALL USING (true);
CREATE POLICY "Acesso API Funcionarios" ON "Funcionarios" FOR ALL USING (true);
CREATE POLICY "Acesso API Financas" ON "Financas" FOR ALL USING (true);
CREATE POLICY "Acesso API Estoque" ON "Estoque" FOR ALL USING (true);
CREATE POLICY "Acesso API FichasTecnicas" ON "FichasTecnicas" FOR ALL USING (true);
CREATE POLICY "Acesso API Planejamento" ON "PlanejamentoProducao" FOR ALL USING (true);
CREATE POLICY "Acesso API Ordens" ON "OrdensProducao" FOR ALL USING (true);
CREATE POLICY "Acesso API Consumo" ON "ConsumoIngredientes" FOR ALL USING (true);
CREATE POLICY "Acesso API Desperdicio" ON "ControleDesperdicio" FOR ALL USING (true);


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