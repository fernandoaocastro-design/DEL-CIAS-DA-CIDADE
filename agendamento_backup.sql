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
    data_txt text := to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYY_MM_DD');
    tabela text;
    -- Lista completa de tabelas para backup diário
    tabelas text[] := ARRAY[
        'Usuarios', 'Funcionarios', 'Financas', 'Estoque', 'MovimentacoesEstoque',
        'Inventario', 'HistoricoInventario', 'Clientes', 'Eventos', 'OrdensProducao',
        'FichasTecnicas', 'PlanejamentoProducao', 'ConsumoIngredientes', 'ControleDesperdicio',
        'MLPain_Registros', 'Tarefas', 'ChecklistLimpeza', 'Ferias', 'Frequencia', 
        'Folha', 'PedidosCompra', 'ItensPedidoCompra', 'ContasPagar', 'ContasReceber'
    ];
    -- Variáveis para limpeza de backups antigos
    r record;
    data_backup date;
    data_limite date := current_date - 7; -- Mantém apenas os últimos 7 dias
BEGIN
    -- 1. CRIAR NOVOS BACKUPS
    FOREACH tabela IN ARRAY tabelas LOOP
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = tabela AND table_schema = 'public') THEN
            EXECUTE format('CREATE TABLE IF NOT EXISTS %I AS SELECT * FROM %I', 'Backup_' || tabela || '_' || data_txt, tabela);
        END IF;
    END LOOP;

    -- 2. LIMPAR BACKUPS ANTIGOS (Rotina de Retenção)
    FOR r IN 
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name LIKE 'Backup_%'
    LOOP
        BEGIN
            -- Tenta extrair a data do nome da tabela (formato esperado: ..._YYYY_MM_DD)
            data_backup := to_date(right(r.table_name, 10), 'YYYY_MM_DD');
            
            -- Se a data do backup for mais antiga que o limite, apaga a tabela
            IF data_backup < data_limite THEN
                EXECUTE format('DROP TABLE IF EXISTS %I', r.table_name);
            END IF;
        EXCEPTION WHEN OTHERS THEN
            -- Ignora tabelas que não tenham data no nome ou formato inválido
            CONTINUE;
        END;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 3. Agendar a Tarefa
-- Formato Cron: minuto hora dia mes dia_semana
-- Ajustado para 04:00 UTC (01:00 Horário de Brasília) para garantir que o dia acabou
SELECT cron.schedule('backup_diario_delicia', '0 4 * * *', 'SELECT backup_rotina_diaria()');

-- COMANDOS ÚTEIS:
-- Ver agendamentos: SELECT * FROM cron.job;
-- Remover agendamento: SELECT cron.unschedule('backup_diario_delicia');

-- ==============================================================================
-- PARTE 2: PROCESSAMENTO DE PRESENÇA (ERP REAL)
-- ==============================================================================
-- Esta função roda diariamente para calcular o status final do dia anterior.
-- Regras:
-- 1. Verifica se estava escalado.
-- 2. Se não bateu ponto e não tem justificativa/férias -> FALTA.
-- 3. Se bateu ponto > 08:15 -> ATRASO.

CREATE OR REPLACE FUNCTION processar_presenca_diaria() RETURNS void AS $$
DECLARE
    func record;
    escala_item record;
    freq_item record;
    data_proc date := (now() AT TIME ZONE 'America/Sao_Paulo')::date - 1; -- Processa o dia de ontem
    dia_semana int;
    semana_mes int;
    esta_escalado boolean;
    horario_limite time := '08:15:00'; -- 08:00 + 15min tolerância
BEGIN
    -- 1=Segunda ... 7=Domingo (ISO)
    dia_semana := EXTRACT(ISODOW FROM data_proc);
    semana_mes := LEAST(4, FLOOR((EXTRACT(DAY FROM data_proc) - 1) / 7)::int + 1);

    FOR func IN SELECT * FROM "Funcionarios" WHERE "Status" = 'Ativo' LOOP
        esta_escalado := false;

        -- 1. VERIFICAR SE ESTAVA ESCALADO
        SELECT *
          INTO escala_item
          FROM "Escala"
         WHERE "FuncionarioID" = func."ID"
           AND "DiaSemana" = dia_semana
           AND COALESCE("Semana", 1) = semana_mes
         LIMIT 1;

        -- Compatibilidade: se não encontrar para a semana atual, tenta semana 1.
        IF NOT FOUND THEN
            SELECT *
              INTO escala_item
              FROM "Escala"
             WHERE "FuncionarioID" = func."ID"
               AND "DiaSemana" = dia_semana
               AND COALESCE("Semana", 1) = 1
             LIMIT 1;
        END IF;
        
        IF FOUND THEN
            IF escala_item."Tipo" = 'Trabalho' OR escala_item."Tipo" = 'Turno' THEN
                esta_escalado := true;
            END IF;
        ELSE
            -- Fallback: Se não tem escala específica, assume Diarista (Seg-Sex)
            IF func."Turno" = 'Diarista' AND dia_semana BETWEEN 1 AND 5 THEN
                esta_escalado := true;
            END IF;
        END IF;

        -- Se não estava escalado, ignora (Folga)
        IF NOT esta_escalado THEN CONTINUE; END IF;

        -- 2. VERIFICAR SE ESTÁ EM FÉRIAS OU LICENÇA (Exceções)
        PERFORM 1 FROM "Ferias" WHERE "FuncionarioID" = func."ID" AND "Status" = 'Aprovado' AND data_proc BETWEEN "DataInicio" AND "DataFim";
        IF FOUND THEN CONTINUE; END IF;

        PERFORM 1 FROM "Licencas" WHERE "FuncionarioID" = func."ID" AND (data_proc = "DataFalta" OR data_proc BETWEEN "Inicio" AND "Retorno");
        IF FOUND THEN CONTINUE; END IF;

        -- 3. VERIFICAR REGISTRO DE PONTO
        SELECT * INTO freq_item FROM "Frequencia" WHERE "FuncionarioID" = func."ID" AND "Data" = data_proc;
        
        IF FOUND THEN
            -- Se registrou entrada, verifica atraso (se status ainda não foi definido manualmente)
            IF freq_item."Entrada" IS NOT NULL AND (freq_item."Status" IS NULL OR freq_item."Status" = 'Presente') THEN
                IF freq_item."Entrada" > horario_limite THEN
                    UPDATE "Frequencia" SET "Status" = 'Atraso' WHERE "ID" = freq_item."ID";
                ELSE
                    UPDATE "Frequencia" SET "Status" = 'Presente' WHERE "ID" = freq_item."ID";
                END IF;
            END IF;
        ELSE
            -- Não registrou ponto e estava escalado -> FALTA
            INSERT INTO "Frequencia" ("FuncionarioID", "FuncionarioNome", "Data", "Status", "Observacoes")
            VALUES (func."ID", func."Nome", data_proc, 'Falta', 'Falta automática (Não compareceu)');
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Agendar para rodar todo dia à 01:00 da manhã
SELECT cron.schedule('rotina_presenca_erp', '0 4 * * *', 'SELECT processar_presenca_diaria()');
