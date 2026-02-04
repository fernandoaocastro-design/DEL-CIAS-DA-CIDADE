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


-- ==============================================================================
-- PARTE 2: AUTOMAÇÃO DE FALTAS (ROTINA INTELIGENTE)
-- ==============================================================================

-- Função que verifica quem faltou ontem e insere na tabela de Licenças/Ausências
CREATE OR REPLACE FUNCTION rotina_marcar_faltas() RETURNS void AS $$
DECLARE
    funcionario record;
    ultima_freq record;
    escala_dia record;
    data_ontem date := current_date - 1; -- Verifica sempre o dia anterior
    dias_desde_ultimo int;
    dia_semana int;
BEGIN
    -- Percorre todos os funcionários ativos
    FOR funcionario IN SELECT * FROM "Funcionarios" WHERE "Status" = 'Ativo' LOOP
        
        -- 1. Verifica se trabalhou ontem (Se tem registro em Frequencia)
        PERFORM 1 FROM "Frequencia" WHERE "FuncionarioID" = funcionario."ID" AND "Data" = data_ontem;
        
        -- Se NÃO achou registro de trabalho E NÃO tem licença/atestado cadastrado para a data
        IF NOT FOUND THEN
            PERFORM 1 FROM "Licencas" WHERE "FuncionarioID" = funcionario."ID" AND ("DataFalta" = data_ontem OR (data_ontem BETWEEN "Inicio" AND "Retorno"));
            
            IF NOT FOUND THEN
                dia_semana := extract(isodow from data_ontem); -- 1=Seg, 6=Sab, 7=Dom
                
                -- 3. Verifica Tabela de Escala (Prioridade Máxima)
                SELECT * INTO escala_dia FROM "Escala" WHERE "FuncionarioID" = funcionario."ID" AND "DiaSemana" = dia_semana;
                
                IF escala_dia."Tipo" IS NOT NULL THEN
                    -- Se tem escala definida explicitamente, segue a regra
                    IF escala_dia."Tipo" = 'Trabalho' THEN
                        INSERT INTO "Licencas" ("FuncionarioID", "FuncionarioNome", "Tipo", "DataFalta", "ObsFalta")
                        VALUES (funcionario."ID", funcionario."Nome", 'Ausência Não Justificada', data_ontem, 'Falta automática (Escala Definida)');
                    END IF;
                    -- Se for 'Folga', não faz nada.
                
                ELSE
                    -- 4. Fallback para Regras Padrão (Se não tiver escala definida)
                    
                    -- LÓGICA PARA DIARISTAS (Padrão Comercial Seg-Sex)
                    IF funcionario."Turno" = 'Diarista' THEN
                        -- Se for dia de semana (1 a 5), marca falta.
                        IF dia_semana BETWEEN 1 AND 5 THEN
                            INSERT INTO "Licencas" ("FuncionarioID", "FuncionarioNome", "Tipo", "DataFalta", "ObsFalta")
                            VALUES (funcionario."ID", funcionario."Nome", 'Ausência Não Justificada', data_ontem, 'Falta automática (Padrão Diarista)');
                        END IF;
                    
                    -- LÓGICA PARA TURNO 24H (Trabalha 1, Folga 2) -> Ciclo de 3 dias
                    ELSIF funcionario."Turno" = 'Regime de Turno' THEN
                        SELECT "Data" INTO ultima_freq FROM "Frequencia" WHERE "FuncionarioID" = funcionario."ID" ORDER BY "Data" DESC LIMIT 1;
                        
                        IF ultima_freq."Data" IS NOT NULL THEN
                            dias_desde_ultimo := data_ontem - ultima_freq."Data";
                            IF dias_desde_ultimo >= 3 THEN
                                 INSERT INTO "Licencas" ("FuncionarioID", "FuncionarioNome", "Tipo", "DataFalta", "ObsFalta")
                                 VALUES (funcionario."ID", funcionario."Nome", 'Ausência Não Justificada', data_ontem, 'Falta automática (Ciclo 24/48)');
                            END IF;
                        END IF;
                    END IF;
                END IF;
            END IF;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Agendar para rodar todo dia à 01:00 da manhã
SELECT cron.schedule('rotina_faltas_diaria', '0 1 * * *', 'SELECT rotina_marcar_faltas()');