-- ==============================================================================
-- FUNÇÃO PARA RESTAURAR BACKUP (ADMINISTRAÇÃO)
-- ==============================================================================

CREATE OR REPLACE FUNCTION admin_restaurar_backup(tabela_destino text, tabela_backup text)
RETURNS void AS $$
BEGIN
    -- 1. Validação de Segurança: O backup deve começar com "Backup_"
    IF tabela_backup NOT LIKE 'Backup_%' THEN
        RAISE EXCEPTION 'Tabela de origem inválida. Deve ser um backup.';
    END IF;

    -- 2. Validação: As tabelas devem existir
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = tabela_backup) THEN
         RAISE EXCEPTION 'Backup não encontrado: %', tabela_backup;
    END IF;

    -- 3. Executa a restauração
    -- TRUNCATE CASCADE limpa a tabela atual e permite a inserção limpa
    EXECUTE format('TRUNCATE TABLE %I CASCADE', tabela_destino);
    EXECUTE format('INSERT INTO %I SELECT * FROM %I', tabela_destino, tabela_backup);
END;
$$ LANGUAGE plpgsql;