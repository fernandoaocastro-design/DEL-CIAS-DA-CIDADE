-- Migração: Escala mensal (4 semanas)
-- Execute no SQL Editor do Supabase.

BEGIN;

-- 1) Garante coluna Semana.
ALTER TABLE "Escala"
ADD COLUMN IF NOT EXISTS "Semana" INTEGER;

UPDATE "Escala"
SET "Semana" = 1
WHERE "Semana" IS NULL;

ALTER TABLE "Escala"
ALTER COLUMN "Semana" SET DEFAULT 1;

ALTER TABLE "Escala"
ALTER COLUMN "Semana" SET NOT NULL;

-- 2) Regra de domínio de Semana (1..4).
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'escala_semana_check'
          AND conrelid = '"Escala"'::regclass
    ) THEN
        ALTER TABLE "Escala"
        ADD CONSTRAINT escala_semana_check
        CHECK ("Semana" BETWEEN 1 AND 4);
    END IF;
END $$;

-- 3) Remove unicidade antiga (FuncionarioID + DiaSemana).
ALTER TABLE "Escala"
DROP CONSTRAINT IF EXISTS "Escala_FuncionarioID_DiaSemana_key";

ALTER TABLE "Escala"
DROP CONSTRAINT IF EXISTS "Escala_funcionarioid_diasemana_key";

-- 4) Aplica nova unicidade (FuncionarioID + Semana + DiaSemana).
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'escala_funcionario_semana_dia_key'
          AND conrelid = '"Escala"'::regclass
    ) THEN
        ALTER TABLE "Escala"
        ADD CONSTRAINT escala_funcionario_semana_dia_key
        UNIQUE ("FuncionarioID", "Semana", "DiaSemana");
    END IF;
END $$;

-- 5) Atualiza rotina automática de presença para considerar a semana do mês.
CREATE OR REPLACE FUNCTION processar_presenca_diaria() RETURNS void AS $func$
DECLARE
    func record;
    escala_item record;
    freq_item record;
    data_proc date := (now() AT TIME ZONE 'America/Sao_Paulo')::date - 1;
    dia_semana int;
    semana_mes int;
    esta_escalado boolean;
    horario_limite time := '08:15:00';
BEGIN
    dia_semana := EXTRACT(ISODOW FROM data_proc);
    semana_mes := LEAST(4, FLOOR((EXTRACT(DAY FROM data_proc) - 1) / 7)::int + 1);

    FOR func IN SELECT * FROM "Funcionarios" WHERE "Status" = 'Ativo' LOOP
        esta_escalado := false;

        SELECT *
          INTO escala_item
          FROM "Escala"
         WHERE "FuncionarioID" = func."ID"
           AND "DiaSemana" = dia_semana
           AND COALESCE("Semana", 1) = semana_mes
         LIMIT 1;

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
            IF func."Turno" = 'Diarista' AND dia_semana BETWEEN 1 AND 5 THEN
                esta_escalado := true;
            END IF;
        END IF;

        IF NOT esta_escalado THEN
            CONTINUE;
        END IF;

        PERFORM 1
          FROM "Ferias"
         WHERE "FuncionarioID" = func."ID"
           AND "Status" = 'Aprovado'
           AND data_proc BETWEEN "DataInicio" AND "DataFim";
        IF FOUND THEN
            CONTINUE;
        END IF;

        PERFORM 1
          FROM "Licencas"
         WHERE "FuncionarioID" = func."ID"
           AND (data_proc = "DataFalta" OR data_proc BETWEEN "Inicio" AND "Retorno");
        IF FOUND THEN
            CONTINUE;
        END IF;

        SELECT *
          INTO freq_item
          FROM "Frequencia"
         WHERE "FuncionarioID" = func."ID"
           AND "Data" = data_proc;

        IF FOUND THEN
            IF freq_item."Entrada" IS NOT NULL
               AND (freq_item."Status" IS NULL OR freq_item."Status" = 'Presente') THEN
                IF freq_item."Entrada" > horario_limite THEN
                    UPDATE "Frequencia"
                    SET "Status" = 'Atraso'
                    WHERE "ID" = freq_item."ID";
                ELSE
                    UPDATE "Frequencia"
                    SET "Status" = 'Presente'
                    WHERE "ID" = freq_item."ID";
                END IF;
            END IF;
        ELSE
            INSERT INTO "Frequencia" ("FuncionarioID", "FuncionarioNome", "Data", "Status", "Observacoes")
            VALUES (func."ID", func."Nome", data_proc, 'Falta', 'Falta automática (Não compareceu)');
        END IF;
    END LOOP;
END;
$func$ LANGUAGE plpgsql;

COMMIT;
