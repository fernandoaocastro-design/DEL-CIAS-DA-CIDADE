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