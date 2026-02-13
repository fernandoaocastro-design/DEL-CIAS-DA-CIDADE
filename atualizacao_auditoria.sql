-- ==============================================================================
-- ATUALIZAÇÃO: AUDITORIA E FOTO DE PERFIL
-- ==============================================================================

-- 1. Adicionar campo de Foto na tabela de Usuários
ALTER TABLE "Usuarios" ADD COLUMN IF NOT EXISTS "FotoURL" TEXT;

-- 2. Garantir tabela de Auditoria (caso não exista)
CREATE TABLE IF NOT EXISTS "LogsAuditoria" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "DataHora" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "UsuarioID" UUID,
    "UsuarioNome" VARCHAR(255),
    "Modulo" VARCHAR(50),
    "Acao" VARCHAR(50),
    "Descricao" TEXT,
    "DetalhesJSON" JSONB
);

-- 3. Habilitar acesso para a API
ALTER TABLE "LogsAuditoria" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso API Auditoria" ON "LogsAuditoria";
CREATE POLICY "Acesso API Auditoria" ON "LogsAuditoria" FOR ALL USING (true);

-- Atualizar cache do esquema
NOTIFY pgrst, 'reload config';