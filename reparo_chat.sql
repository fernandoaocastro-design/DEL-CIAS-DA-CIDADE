-- ==============================================================================
-- REPARO: MÓDULO DE CHAT (ChatMessages)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS "ChatMessages" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "SenderID" UUID,
    "SenderName" VARCHAR(255),
    "Message" TEXT,
    "Timestamp" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "Attachment" TEXT
);

ALTER TABLE "ChatMessages" ENABLE ROW LEVEL SECURITY;

-- Política de acesso para a API (Permitir tudo para usuários autenticados/anonimos conforme sua config)
DROP POLICY IF EXISTS "Acesso API Chat" ON "ChatMessages";
CREATE POLICY "Acesso API Chat" ON "ChatMessages" FOR ALL USING (true);

-- Atualizar cache do esquema
NOTIFY pgrst, 'reload config';