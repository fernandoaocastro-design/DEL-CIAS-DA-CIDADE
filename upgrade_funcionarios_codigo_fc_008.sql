-- Migracao: padronizar matricula de funcionarios no formato INICIAIS-### (ex: FC-008)
-- Execute no SQL Editor do Supabase.

BEGIN;

ALTER TABLE "Funcionarios"
ADD COLUMN IF NOT EXISTS "Codigo" VARCHAR(50);

DO $$
DECLARE
    r RECORD;
    idx INT := 0;
    parts TEXT[];
    prefix TEXT;
    new_code TEXT;
BEGIN
    FOR r IN
        SELECT "ID", "Nome"
          FROM "Funcionarios"
         ORDER BY COALESCE("CriadoEm", NOW()), "Nome", "ID"
    LOOP
        idx := idx + 1;

        parts := regexp_split_to_array(trim(COALESCE(r."Nome", '')), '\s+');
        IF array_length(parts, 1) IS NULL THEN
            prefix := 'FN';
        ELSE
            prefix := upper(substring(parts[1] from 1 for 1));
            IF array_length(parts, 1) > 1 THEN
                prefix := prefix || upper(substring(parts[array_length(parts, 1)] from 1 for 1));
            ELSE
                prefix := prefix || prefix;
            END IF;
        END IF;

        new_code := prefix || '-' || lpad(idx::text, 3, '0');

        UPDATE "Funcionarios"
           SET "Codigo" = new_code
         WHERE "ID" = r."ID";
    END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "idx_funcionarios_codigo_unique"
ON "Funcionarios" ("Codigo");

COMMIT;
