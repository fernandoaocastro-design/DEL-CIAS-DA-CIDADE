-- ==============================================================================
-- SCRIPT DE BACKUP MANUAL COMPLETO (SNAPSHOT)
-- ==============================================================================
-- Execute este script no SQL Editor do Supabase.
-- Ele cria uma cópia exata de TODAS as tabelas do sistema com a data e hora atual.

-- Envolvendo em uma função para evitar erros de execução parcial
CREATE OR REPLACE FUNCTION executar_backup_manual() RETURNS void AS $$
DECLARE
    r RECORD;
    nome_backup text;
    -- Formata a data para o nome da tabela (Ex: 2023_10_25_14_30)
    timestamp_backup text := to_char(now(), 'YYYY_MM_DD_HH24_MI');
BEGIN
    -- Loop otimizado: Busca apenas as tabelas que existem no esquema public
    FOR r IN 
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN (
            'Usuarios', 'Funcionarios', 'Financas', 'Estoque', 'MovimentacoesEstoque',
            'Inventario', 'HistoricoInventario', 'Clientes', 'Eventos', 'OrdensProducao',
            'FichasTecnicas', 'PlanejamentoProducao', 'ConsumoIngredientes', 'ControleDesperdicio',
            'MLPain_Areas', 'MLPain_Registros', 'PerfisAcesso', 'ChatMessages', 'QuadroAvisos',
            'Tarefas', 'ChecklistLimpeza', 'ParametrosRH', 'Cargos', 'Departamentos',
            'Ferias', 'Frequencia', 'Avaliacoes', 'Treinamentos', 'Licencas', 'Folha',
            'InstituicaoConfig', 'PedidosCompra', 'ItensPedidoCompra', 'Escala', 'EmailLogs',
            'Notificacoes', 'ContasPagar', 'ContasReceber', 'MetasFinanceiras'
        )
    LOOP
        nome_backup := 'Backup_' || r.table_name || '_' || timestamp_backup;
        
        -- Cria a tabela de backup copiando os dados
        EXECUTE format('CREATE TABLE %I AS SELECT * FROM %I', nome_backup, r.table_name);
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Executa a função
SELECT executar_backup_manual();