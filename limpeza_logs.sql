-- ==============================================================================
-- ROTINA DE LIMPEZA AUTOMÁTICA DE LOGS ANTIGOS
-- ==============================================================================
-- Execute este script no SQL Editor do Supabase.
-- Ele cria uma função que remove dados históricos desnecessários e agenda
-- para rodar automaticamente todo domingo às 04:00 da manhã.

CREATE OR REPLACE FUNCTION limpeza_logs_antigos() RETURNS void AS $$
DECLARE
    rows_deleted int;
BEGIN
    -- 1. Logs de Auditoria (Manter últimos 6 meses)
    -- Importante para segurança, então mantemos por mais tempo.
    DELETE FROM "LogsAuditoria" WHERE "DataHora" < NOW() - INTERVAL '6 months';
    
    -- 2. Notificações (Manter últimos 90 dias)
    -- Notificações antigas geralmente não são mais relevantes.
    DELETE FROM "Notificacoes" WHERE "CriadoEm" < NOW() - INTERVAL '90 days';

    -- 3. Histórico de Chat (Manter últimos 6 meses)
    DELETE FROM "ChatMessages" WHERE "Timestamp" < NOW() - INTERVAL '6 months';

    -- 4. Logs de Sistema/Debug (Manter últimos 30 dias)
    -- Se existir a tabela de logs técnicos, limpa com mais frequência.
    DELETE FROM "SYSTEM_LOGS_DB" WHERE "DataHora" < NOW() - INTERVAL '30 days';

    -- 5. Logs de Envio de E-mail (Manter últimos 1 ano)
    -- Útil para saber se o funcionário recebeu parabéns ano passado.
    DELETE FROM "EmailLogs" WHERE "DataEnvio" < NOW() - INTERVAL '1 year';

    -- Opcional: Registrar que a limpeza ocorreu (no próprio log do Postgres)
    RAISE NOTICE 'Limpeza de logs antigos concluída com sucesso.';
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- AGENDAMENTO (Requer extensão pg_cron ativa)
-- ==============================================================================

-- Remove agendamento anterior se existir para evitar duplicidade
-- SELECT cron.unschedule('limpeza_semanal_logs');

-- Agenda para todo Domingo (0) às 04:00 da manhã
SELECT cron.schedule('limpeza_semanal_logs', '0 4 * * 0', 'SELECT limpeza_logs_antigos()');

-- Para rodar manualmente agora mesmo, execute: SELECT limpeza_logs_antigos();