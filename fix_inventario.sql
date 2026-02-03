-- EXECUTE ESTE SCRIPT NO "SQL EDITOR" DO SUPABASE

-- Garante que as colunas novas do Inventário existam
ALTER TABLE "Inventario" ADD COLUMN IF NOT EXISTS "Observacoes" TEXT;
ALTER TABLE "Inventario" ADD COLUMN IF NOT EXISTS "NumeroSerie" VARCHAR(100);
ALTER TABLE "Inventario" ADD COLUMN IF NOT EXISTS "EstadoConservacao" VARCHAR(50);
ALTER TABLE "Inventario" ADD COLUMN IF NOT EXISTS "VidaUtil" INTEGER;

-- Colunas adicionais preventivas (Comuns em Patrimônio)
ALTER TABLE "Inventario" ADD COLUMN IF NOT EXISTS "Marca" VARCHAR(100);
ALTER TABLE "Inventario" ADD COLUMN IF NOT EXISTS "Modelo" VARCHAR(100);
ALTER TABLE "Inventario" ADD COLUMN IF NOT EXISTS "Localizacao" VARCHAR(100);
ALTER TABLE "Inventario" ADD COLUMN IF NOT EXISTS "FotoURL" TEXT;

-- Força o Supabase a atualizar o cache do esquema (Essencial para o erro sumir)
NOTIFY pgrst, 'reload config';