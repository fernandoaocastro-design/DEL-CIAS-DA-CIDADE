-- ==============================================================================
-- AGENDAMENTO DE BACKUP AUTOMÁTICO (VIA PG_CRON NO SUPABASE)
-- ==============================================================================
-- Este script configura o banco de dados para criar cópias automáticas das tabelas
-- todos os dias. Isso é útil para ter um histórico acessível via SQL.

-- PRÉ-REQUISITO:
-- Vá no Painel do Supabase > Database > Extensions e ative a extensão "pg_cron".

-- 1. Habilitar a extensão (caso não tenha feito pelo painel)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Criar a Função de Backup
-- Esta função cria tabelas novas com a data do dia (Ex: Backup_Estoque_2023_10_25)
CREATE OR REPLACE FUNCTION backup_rotina_diaria() RETURNS void AS $$
DECLARE
    data_txt text := to_char(now(), 'YYYY_MM_DD');
BEGIN
    -- Adicione aqui as tabelas que deseja salvar
    EXECUTE format('CREATE TABLE IF NOT EXISTS "Backup_Estoque_%s" AS SELECT * FROM "Estoque"', data_txt);
    EXECUTE format('CREATE TABLE IF NOT EXISTS "Backup_Financas_%s" AS SELECT * FROM "Financas"', data_txt);
    EXECUTE format('CREATE TABLE IF NOT EXISTS "Backup_Funcionarios_%s" AS SELECT * FROM "Funcionarios"', data_txt);
    EXECUTE format('CREATE TABLE IF NOT EXISTS "Backup_Ordens_%s" AS SELECT * FROM "OrdensProducao"', data_txt);
END;
$$ LANGUAGE plpgsql;

-- 3. Agendar a Tarefa
-- Formato Cron: minuto hora dia mes dia_semana
-- Exemplo: '0 3 * * *' = Todo dia às 03:00 da manhã (Horário UTC)
SELECT cron.schedule('backup_diario_delicia', '0 3 * * *', 'SELECT backup_rotina_diaria()');

-- COMANDOS ÚTEIS:
-- Ver agendamentos: SELECT * FROM cron.job;
-- Remover agendamento: SELECT cron.unschedule('backup_diario_delicia');