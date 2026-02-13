-- ==============================================================================
-- FUNÇÃO PARA LISTAR BACKUPS (PARA O FRONTEND)
-- ==============================================================================
-- Esta função permite que o sistema visualize quais backups existem no banco.

CREATE OR REPLACE FUNCTION get_system_backups()
RETURNS TABLE (
    nome_tabela text,
    data_estimada text,
    tamanho text,
    tamanho_bytes bigint
) AS $func$
BEGIN
    RETURN QUERY
    SELECT 
        table_name::text,
        substring(table_name from '\d{4}_\d{2}_\d{2}.*')::text as data_estimada,
        pg_size_pretty(pg_total_relation_size(quote_ident(table_schema) || '.' || quote_ident(table_name)))::text,
        pg_total_relation_size(quote_ident(table_schema) || '.' || quote_ident(table_name))
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name LIKE 'Backup_%'
    ORDER BY table_name DESC;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;