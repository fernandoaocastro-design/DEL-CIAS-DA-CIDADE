-- EXECUTE ESTE SCRIPT NO "SQL EDITOR" DO SUPABASE
-- Este script cria as tabelas de parâmetros que estão faltando e configura as permissões.

-- 1. Criar Tabelas (Se não existirem)
CREATE TABLE IF NOT EXISTS "ParametrosCozinha" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "Tipo" VARCHAR(50),
    "Valor" VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS "ParametrosEstoque" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "Tipo" VARCHAR(50),
    "Valor" VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS "ParametrosFinanceiro" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "Tipo" VARCHAR(50),
    "Valor" VARCHAR(100)
);

-- 2. Configurar Segurança (RLS)
-- Garante que as tabelas tenham políticas de acesso, evitando erro de permissão
ALTER TABLE "ParametrosCozinha" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ParametrosEstoque" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ParametrosFinanceiro" ENABLE ROW LEVEL SECURITY;

-- 3. Criar Políticas de Acesso (Liberar para a API)
DROP POLICY IF EXISTS "Acesso API ParametrosCozinha" ON "ParametrosCozinha";
CREATE POLICY "Acesso API ParametrosCozinha" ON "ParametrosCozinha" FOR ALL USING (true);

DROP POLICY IF EXISTS "Acesso API ParametrosEstoque" ON "ParametrosEstoque";
CREATE POLICY "Acesso API ParametrosEstoque" ON "ParametrosEstoque" FOR ALL USING (true);

DROP POLICY IF EXISTS "Acesso API ParametrosFinanceiro" ON "ParametrosFinanceiro";
CREATE POLICY "Acesso API ParametrosFinanceiro" ON "ParametrosFinanceiro" FOR ALL USING (true);

-- 4. Atualizar Cache do Supabase
NOTIFY pgrst, 'reload config';