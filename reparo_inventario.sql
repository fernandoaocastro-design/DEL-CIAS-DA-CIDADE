-- ==============================================================================
-- SCRIPT DE REPARO - MÓDULO INVENTÁRIO
-- ==============================================================================
-- Este script cria a tabela de histórico que está faltando e causando o erro
-- "Erro ao carregar inventário", além de garantir que a tabela principal esteja correta.

-- 1. CRIAR TABELA DE HISTÓRICO (A causa provável do erro)
CREATE TABLE IF NOT EXISTS "HistoricoInventario" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "BemID" UUID, -- ID do item no Inventário
    "TipoAcao" VARCHAR(50), -- Ex: Cadastro, Edição, Baixa
    "Descricao" TEXT,
    "ResponsavelAcao" VARCHAR(100),
    "DetalhesJSON" JSONB,
    "CriadoEm" TIMESTAMP DEFAULT NOW()
);

-- 2. GARANTIR ESTRUTURA DA TABELA INVENTÁRIO
-- Cria a tabela se não existir e adiciona colunas que podem estar faltando
CREATE TABLE IF NOT EXISTS "Inventario" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "Codigo" VARCHAR(50),
    "Nome" VARCHAR(255),
    "Status" VARCHAR(50) DEFAULT 'Ativo',
    "CriadoEm" TIMESTAMP DEFAULT NOW()
);

-- Adiciona colunas extras caso tenham sido esquecidas anteriormente
ALTER TABLE "Inventario" ADD COLUMN IF NOT EXISTS "Categoria" VARCHAR(100);
ALTER TABLE "Inventario" ADD COLUMN IF NOT EXISTS "Descricao" TEXT;
ALTER TABLE "Inventario" ADD COLUMN IF NOT EXISTS "DataAquisicao" DATE;
ALTER TABLE "Inventario" ADD COLUMN IF NOT EXISTS "ValorAquisicao" DECIMAL(12,2);
ALTER TABLE "Inventario" ADD COLUMN IF NOT EXISTS "VidaUtil" INTEGER;
ALTER TABLE "Inventario" ADD COLUMN IF NOT EXISTS "EstadoConservacao" VARCHAR(50);
ALTER TABLE "Inventario" ADD COLUMN IF NOT EXISTS "Localizacao" VARCHAR(100);
ALTER TABLE "Inventario" ADD COLUMN IF NOT EXISTS "Responsavel" VARCHAR(100);
ALTER TABLE "Inventario" ADD COLUMN IF NOT EXISTS "NumeroSerie" VARCHAR(100);
ALTER TABLE "Inventario" ADD COLUMN IF NOT EXISTS "Marca" VARCHAR(100);
ALTER TABLE "Inventario" ADD COLUMN IF NOT EXISTS "Modelo" VARCHAR(100);
ALTER TABLE "Inventario" ADD COLUMN IF NOT EXISTS "FotoURL" TEXT;
ALTER TABLE "Inventario" ADD COLUMN IF NOT EXISTS "Observacoes" TEXT;

-- 3. LIBERAR ACESSO (RLS)
-- Permite que o sistema leia e grave nessas tabelas
ALTER TABLE "Inventario" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso API Inventario" ON "Inventario" FOR ALL USING (true);

ALTER TABLE "HistoricoInventario" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso API HistoricoInventario" ON "HistoricoInventario" FOR ALL USING (true);

-- Atualiza cache do esquema
NOTIFY pgrst, 'reload config';