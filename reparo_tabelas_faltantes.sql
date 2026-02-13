-- ==============================================================================
-- SCRIPT DE REPARO - CRIAÇÃO DE TABELAS FALTANTES (RH E OUTROS)
-- ==============================================================================
-- Este script cria todas as tabelas que os módulos tentam carregar.
-- Se alguma delas não existir, o sistema retorna erro 500 (Erro de Conexão).

-- 1. TABELAS DO MÓDULO DE RH
CREATE TABLE IF NOT EXISTS "ParametrosRH" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "Tipo" VARCHAR(50),
    "Valor" VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS "Cargos" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "Nome" VARCHAR(100) NOT NULL,
    "DepartamentoID" UUID,
    "Descricao" TEXT
);

CREATE TABLE IF NOT EXISTS "Departamentos" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "Nome" VARCHAR(100) NOT NULL,
    "Responsavel" VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS "Ferias" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "FuncionarioID" UUID,
    "FuncionarioNome" VARCHAR(255),
    "DataInicio" DATE,
    "DataFim" DATE,
    "Dias" INTEGER,
    "Status" VARCHAR(50) DEFAULT 'Solicitado',
    "Pagamento13" VARCHAR(3) DEFAULT 'Não',
    "Adiantamento13" VARCHAR(3) DEFAULT 'Não',
    "DataPagamento" DATE,
    "ComprovativoURL" TEXT,
    "Observacoes" TEXT,
    "CriadoEm" TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "Frequencia" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "FuncionarioID" UUID,
    "FuncionarioNome" VARCHAR(255),
    "Data" DATE NOT NULL,
    "Entrada" TIME,
    "Saida" TIME,
    "Assinatura" TEXT,
    "Observacoes" TEXT,
    "CriadoEm" TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "Avaliacoes" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "FuncionarioID" UUID,
    "FuncionarioNome" VARCHAR(255),
    "DataAvaliacao" DATE,
    "Avaliador" VARCHAR(100),
    "MediaFinal" DECIMAL(4,2),
    "Conclusao" VARCHAR(100),
    "DetalhesJSON" JSONB, -- Para guardar as notas individuais (N1, N2...)
    "CriadoEm" TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "Treinamentos" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "FuncionarioID" UUID, -- Pode ser NULL se for para todos
    "FuncionarioNome" VARCHAR(255),
    "Titulo" VARCHAR(255),
    "Tipo" VARCHAR(50),
    "Instrutor" VARCHAR(100),
    "Local" VARCHAR(100),
    "Inicio" DATE,
    "Termino" DATE,
    "Carga" INTEGER,
    "Status" VARCHAR(50),
    "CriadoEm" TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "Licencas" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "FuncionarioID" UUID,
    "FuncionarioNome" VARCHAR(255),
    "Tipo" VARCHAR(100),
    "Inicio" DATE,
    "Retorno" DATE,
    "Motivo" TEXT,
    "AnexoURL" TEXT,
    "CriadoEm" TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "Folha" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "FuncionarioID" UUID,
    "FuncionarioNome" VARCHAR(255),
    "Periodo" VARCHAR(7), -- YYYY-MM
    "SalarioBase" DECIMAL(12,2),
    "TotalVencimentos" DECIMAL(12,2),
    "TotalDescontos" DECIMAL(12,2),
    "SalarioLiquido" DECIMAL(12,2),
    "Banco" VARCHAR(100),
    "Iban" VARCHAR(100),
    "Status" VARCHAR(50) DEFAULT 'Pendente',
    "CriadoEm" TIMESTAMP DEFAULT NOW()
);

-- 2. TABELAS DE CONFIGURAÇÃO E OUTROS
CREATE TABLE IF NOT EXISTS "InstituicaoConfig" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "NomeCompleto" VARCHAR(255),
    "NomeFantasia" VARCHAR(255),
    "TipoUnidade" VARCHAR(100),
    "Endereco" TEXT,
    "Telefone" VARCHAR(50),
    "Email" VARCHAR(100),
    "Website" VARCHAR(100),
    "LogotipoURL" TEXT,
    "ExibirLogoRelatorios" BOOLEAN DEFAULT TRUE,
    "CorRelatorios" VARCHAR(20) DEFAULT '#3B82F6',
    "SubsidioFeriasPorcentagem" DECIMAL(5,2) DEFAULT 50.00
);

CREATE TABLE IF NOT EXISTS "PedidosCompra" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "Codigo" SERIAL,
    "Solicitante" VARCHAR(100),
    "DataSolicitacao" TIMESTAMP DEFAULT NOW(),
    "ValorTotal" DECIMAL(12,2),
    "Status" VARCHAR(50) DEFAULT 'Pendente',
    "CriadoEm" TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "ItensPedidoCompra" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "PedidoID" UUID,
    "ProdutoNome" VARCHAR(255),
    "Quantidade" DECIMAL(10,2),
    "CustoUnitario" DECIMAL(12,2),
    "Subtotal" DECIMAL(12,2),
    "Observacao" TEXT
);

-- 3. HABILITAR RLS PARA TODAS (Segurança)
ALTER TABLE "ParametrosRH" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Cargos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Departamentos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Ferias" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Frequencia" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Avaliacoes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Treinamentos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Licencas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Folha" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InstituicaoConfig" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PedidosCompra" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ItensPedidoCompra" ENABLE ROW LEVEL SECURITY;

-- 4. CRIAR POLÍTICAS DE ACESSO (Permitir API ler/escrever)
CREATE POLICY "Acesso Total API ParametrosRH" ON "ParametrosRH" FOR ALL USING (true);
CREATE POLICY "Acesso Total API Cargos" ON "Cargos" FOR ALL USING (true);
CREATE POLICY "Acesso Total API Departamentos" ON "Departamentos" FOR ALL USING (true);
CREATE POLICY "Acesso Total API Ferias" ON "Ferias" FOR ALL USING (true);
CREATE POLICY "Acesso Total API Frequencia" ON "Frequencia" FOR ALL USING (true);
CREATE POLICY "Acesso Total API Avaliacoes" ON "Avaliacoes" FOR ALL USING (true);
CREATE POLICY "Acesso Total API Treinamentos" ON "Treinamentos" FOR ALL USING (true);
CREATE POLICY "Acesso Total API Licencas" ON "Licencas" FOR ALL USING (true);
CREATE POLICY "Acesso Total API Folha" ON "Folha" FOR ALL USING (true);
CREATE POLICY "Acesso Total API InstituicaoConfig" ON "InstituicaoConfig" FOR ALL USING (true);
CREATE POLICY "Acesso Total API PedidosCompra" ON "PedidosCompra" FOR ALL USING (true);
CREATE POLICY "Acesso Total API ItensPedidoCompra" ON "ItensPedidoCompra" FOR ALL USING (true);

-- Atualiza cache do esquema
NOTIFY pgrst, 'reload config';