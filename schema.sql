-- 1. LIMPEZA TOTAL (Cuidado: Apaga dados antigos para recriar a estrutura correta)
-- DROP TABLE IF EXISTS "SYSTEM_LOGS_DB" CASCADE;
-- DROP TABLE IF EXISTS "Avaliacoes" CASCADE;
-- DROP TABLE IF EXISTS "Frequencia" CASCADE;
-- DROP TABLE IF EXISTS "Ferias" CASCADE;
-- DROP TABLE IF EXISTS "Treinamentos" CASCADE;
-- DROP TABLE IF EXISTS "Treinamento" CASCADE;
-- DROP TABLE IF EXISTS "Licencas" CASCADE;
-- DROP TABLE IF EXISTS "Folha" CASCADE;
-- DROP TABLE IF EXISTS "Funcionarios" CASCADE;
-- DROP TABLE IF EXISTS "MLPAIN_DB" CASCADE;
-- DROP TABLE IF EXISTS "Estoque" CASCADE;
-- DROP TABLE IF EXISTS "Financas" CASCADE;
-- DROP TABLE IF EXISTS "Usuarios" CASCADE;
-- DROP TABLE IF EXISTS "Pratos" CASCADE;
-- DROP TABLE IF EXISTS "Notificacoes" CASCADE;
-- DROP TABLE IF EXISTS "Fornecedores" CASCADE;
-- DROP TABLE IF EXISTS "MovimentacoesEstoque" CASCADE;
-- DROP TABLE IF EXISTS "Inventario" CASCADE;
-- DROP TABLE IF EXISTS "HistoricoInventario" CASCADE;

-- 2. TABELAS DE CONFIGURAÇÃO E ACESSO
CREATE TABLE "Usuarios" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "Nome" VARCHAR(255) NOT NULL,
    "Email" VARCHAR(255) UNIQUE NOT NULL,
    "Senha" VARCHAR(255) NOT NULL,
    "Cargo" VARCHAR(100),
    "Status" VARCHAR(50) DEFAULT 'Ativo',
    "UltimoAcesso" TIMESTAMP,
    "CriadoEm" TIMESTAMP DEFAULT NOW()
);

-- 3. TABELAS DE RH (Estrutura alinhada com rh.js)
CREATE TABLE "Funcionarios" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "Nome" VARCHAR(255) NOT NULL,
    "Nascimento" DATE,
    "BI" VARCHAR(50),
    "Telefone" VARCHAR(50),
    "Email" VARCHAR(255),
    "Cargo" VARCHAR(100),
    "Departamento" VARCHAR(100),
    "Turno" VARCHAR(50),
    "Salario" DECIMAL(12,2),
    "TipoContrato" VARCHAR(50),
    "Admissao" DATE,
    "Iban" VARCHAR(100),
    "Status" VARCHAR(50) DEFAULT 'Ativo',
    "FotoURL" TEXT,
    "CriadoEm" TIMESTAMP DEFAULT NOW()
);

CREATE TABLE "Frequencia" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "FuncionarioID" UUID REFERENCES "Funcionarios"("ID"),
    "FuncionarioNome" VARCHAR(255),
    "Data" DATE NOT NULL,
    "Entrada" TIME,
    "Saida" TIME,
    "Assinatura" TEXT,
    "Observacoes" TEXT,
    "CriadoEm" TIMESTAMP DEFAULT NOW()
);

CREATE TABLE "Ferias" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "FuncionarioID" UUID REFERENCES "Funcionarios"("ID"),
    "FuncionarioNome" VARCHAR(255),
    "DataInicio" DATE,
    "DataFim" DATE,
    "Dias" INTEGER,
    "Fracionadas" VARCHAR(10),
    "Pagamento13" VARCHAR(10),
    "Adiantamento13" VARCHAR(10),
    "DataPagamento" DATE,
    "Observacoes" TEXT,
    "AssinaturaFunc" TEXT,
    "AssinaturaRH" TEXT,
    "Status" VARCHAR(50) DEFAULT 'Solicitado'
);

CREATE TABLE "Avaliacoes" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "FuncionarioID" UUID REFERENCES "Funcionarios"("ID"),
    "FuncionarioNome" VARCHAR(255),
    "DataAvaliacao" DATE,
    "Avaliador" VARCHAR(255),
    "N1" DECIMAL(4,2), "N2" DECIMAL(4,2), "N3" DECIMAL(4,2),
    "N4" DECIMAL(4,2), "N5" DECIMAL(4,2), "N6" DECIMAL(4,2),
    "N7" DECIMAL(4,2), "N8" DECIMAL(4,2), "N9" DECIMAL(4,2),
    "PontosFortes" TEXT,
    "PontosMelhorar" TEXT,
    "Comentarios" TEXT,
    "MediaFinal" DECIMAL(4,2),
    "Conclusao" VARCHAR(100)
);

CREATE TABLE "Treinamentos" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "FuncionarioID" VARCHAR(255),
    "FuncionarioNome" VARCHAR(255),
    "Titulo" VARCHAR(255),
    "Tipo" VARCHAR(50),
    "Instrutor" VARCHAR(255),
    "Local" VARCHAR(255),
    "Inicio" DATE,
    "Termino" DATE,
    "Carga" INTEGER,
    "Status" VARCHAR(50)
);

CREATE TABLE "Licencas" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "FuncionarioID" UUID REFERENCES "Funcionarios"("ID"),
    "FuncionarioNome" VARCHAR(255),
    "Tipo" VARCHAR(100),
    "Inicio" DATE,
    "Retorno" DATE,
    "InicioMat" DATE, "TerminoMat" DATE,
    "InicioPat" DATE, "TerminoPat" DATE,
    "DataCasamento" DATE, "DiasLicenca" INTEGER,
    "DataAusencia" DATE, "DataFalta" DATE,
    "Motivo" VARCHAR(255),
    "Justificativa" TEXT,
    "ObsFalta" TEXT,
    "Medico" VARCHAR(255),
    "CriadoEm" TIMESTAMP DEFAULT NOW()
);

CREATE TABLE "Folha" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "FuncionarioID" UUID REFERENCES "Funcionarios"("ID"),
    "FuncionarioNome" VARCHAR(255),
    "Periodo" VARCHAR(20),
    "SalarioBase" DECIMAL(12,2),
    "Bonus" DECIMAL(12,2),
    "QtdHoraExtra" DECIMAL(12,2),
    "ValorHoraExtra" DECIMAL(12,2),
    "OutrosVencimentos" DECIMAL(12,2),
    "TotalVencimentos" DECIMAL(12,2),
    "INSS" DECIMAL(12,2),
    "IRT" DECIMAL(12,2),
    "Faltas" DECIMAL(12,2),
    "OutrosDescontos" DECIMAL(12,2),
    "TotalDescontos" DECIMAL(12,2),
    "SalarioLiquido" DECIMAL(12,2),
    "Banco" VARCHAR(100),
    "Iban" VARCHAR(100),
    "CriadoEm" TIMESTAMP DEFAULT NOW()
);

-- 4. OUTRAS TABELAS ESSENCIAIS
CREATE TABLE "Financas" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "Data" DATE,
    "Tipo" VARCHAR(50),
    "Valor" DECIMAL(12,2),
    "Categoria" VARCHAR(100), -- Ex: Receitas Operacionais, RH
    "Subcategoria" VARCHAR(100), -- Ex: Salários, Venda de Produtos
    "CentroCusto" VARCHAR(100), -- RH, TI, Produção...
    "MetodoPagamento" VARCHAR(50), -- Dinheiro, Transferência...
    "Descricao" TEXT,
    "Status" VARCHAR(50),
    "ReferenciaID" UUID, -- ID da Conta a Pagar/Receber original (se houver)
    "CriadoEm" TIMESTAMP DEFAULT NOW()
);

CREATE TABLE "ContasReceber" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "Codigo" SERIAL, -- Auto-incremento para CR-001 (usar to_char no front)
    "Cliente" VARCHAR(255),
    "Descricao" TEXT,
    "Categoria" VARCHAR(100),
    "ValorTotal" DECIMAL(12,2),
    "DataEmissao" DATE,
    "DataVencimento" DATE,
    "FormaPagamento" VARCHAR(50),
    "Status" VARCHAR(50) DEFAULT 'Em Aberto', -- Em Aberto, Recebido, Atrasado
    "Observacoes" TEXT,
    "CriadoEm" TIMESTAMP DEFAULT NOW()
);

CREATE TABLE "ContasPagar" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "Codigo" SERIAL,
    "Fornecedor" VARCHAR(255),
    "Descricao" TEXT,
    "Categoria" VARCHAR(100),
    "ValorTotal" DECIMAL(12,2),
    "DataEmissao" DATE,
    "DataVencimento" DATE,
    "FormaPagamento" VARCHAR(50),
    "Status" VARCHAR(50) DEFAULT 'Em Aberto', -- Em Aberto, Pago, Atrasado
    "Observacoes" TEXT,
    "CriadoEm" TIMESTAMP DEFAULT NOW()
);

CREATE TABLE "Estoque" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "Codigo" VARCHAR(50),
    "Nome" VARCHAR(255) NOT NULL, -- Antigo Item
    "Tipo" VARCHAR(50), -- Alimentos, Bebidas, Insumos
    "Subtipo" VARCHAR(50), -- Frescos, Secos, etc.
    "Categoria" VARCHAR(50), -- Carne, Laticínios, etc.
    "Quantidade" DECIMAL(12,2),
    "Unidade" VARCHAR(20),
    "Descricao" TEXT,
    "Localizacao" VARCHAR(100), -- Arca, Prateleira...
    "Lote" VARCHAR(50),
    "Validade" DATE,
    "Status" VARCHAR(50) DEFAULT 'Ativo',
    "Minimo" DECIMAL(12,2),
    "Maximo" DECIMAL(12,2),
    "CustoUnitario" DECIMAL(12,2),
    "PrecoVenda" DECIMAL(12,2),
    "MargemLucro" DECIMAL(5,2),
    "Fornecedor" VARCHAR(255), -- Nome do fornecedor principal
    "UltimaAtualizacao" TIMESTAMP DEFAULT NOW()
);

CREATE TABLE "Fornecedores" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "Nome" VARCHAR(255) NOT NULL,
    "Contato" VARCHAR(100),
    "Endereco" TEXT,
    "ProdutosFornecidos" TEXT,
    "UltimaCompra" DATE,
    "Avaliacao" INTEGER, -- 1 a 5
    "Status" VARCHAR(50) DEFAULT 'Ativo',
    "CriadoEm" TIMESTAMP DEFAULT NOW()
);

CREATE TABLE "MovimentacoesEstoque" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "ProdutoID" UUID REFERENCES "Estoque"("ID"),
    "Tipo" VARCHAR(50), -- Entrada, Saida, Ajuste, Perda
    "Quantidade" DECIMAL(12,2),
    "Data" TIMESTAMP DEFAULT NOW(),
    "Responsavel" VARCHAR(255),
    "Observacoes" TEXT,
    "DetalhesJSON" JSONB -- Para dados extras (Nº Fatura, Destino, etc)
);

CREATE TABLE "Pratos" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "Nome" VARCHAR(255) NOT NULL,
    "Categoria" VARCHAR(100),
    "Preco" DECIMAL(12,2),
    "TempoPreparo" VARCHAR(50),
    "Descricao" TEXT,
    "Status" VARCHAR(50) DEFAULT 'Ativo',
    "CriadoEm" TIMESTAMP DEFAULT NOW()
);

CREATE TABLE "Notificacoes" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "UsuarioID" UUID, -- Opcional, se for para um user especifico
    "Mensagem" TEXT NOT NULL,
    "Lida" BOOLEAN DEFAULT FALSE,
    "CriadoEm" TIMESTAMP DEFAULT NOW()
);

CREATE TABLE "MLPAIN_DB" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "Data" DATE,
    "Refeicao" VARCHAR(255),
    "QtdPlanejada" DECIMAL(12,2),
    "QtdProduzida" DECIMAL(12,2),
    "Status" VARCHAR(50)
);

CREATE TABLE "SYSTEM_LOGS_DB" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "DataHora" TIMESTAMP DEFAULT NOW(),
    "Usuario" VARCHAR(255),
    "Acao" VARCHAR(255),
    "Detalhes" TEXT
);

-- 6. MÓDULO INVENTÁRIO (PATRIMÔNIO)
CREATE TABLE "Inventario" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "Codigo" VARCHAR(50) UNIQUE NOT NULL, -- Ex: INV-001
    "Nome" VARCHAR(255) NOT NULL,
    "Categoria" VARCHAR(100), -- TI, Mobiliário, Veículos...
    "Quantidade" INTEGER DEFAULT 1,
    "Descricao" TEXT,
    "Departamento" VARCHAR(100), -- RH, TI, Produção...
    "Responsavel" VARCHAR(255), -- Nome do colaborador
    "DataAquisicao" DATE,
    "ValorAquisicao" DECIMAL(12,2),
    "Fornecedor" VARCHAR(255),
    "NumeroSerie" VARCHAR(100),
    "EstadoConservacao" VARCHAR(50), -- Novo, Bom, Regular, Ruim, Em Manutenção
    "VidaUtil" INTEGER, -- Anos
    "Observacoes" TEXT,
    "Status" VARCHAR(50) DEFAULT 'Ativo', -- Ativo, Inativo, Baixado
    "CriadoEm" TIMESTAMP DEFAULT NOW()
);

CREATE TABLE "HistoricoInventario" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "BemID" UUID REFERENCES "Inventario"("ID"),
    "TipoAcao" VARCHAR(50), -- Cadastro, Edição, Transferência, Manutenção, Baixa
    "Descricao" TEXT,
    "ResponsavelAcao" VARCHAR(255), -- Quem fez a alteração no sistema
    "Data" TIMESTAMP DEFAULT NOW(),
    "DetalhesJSON" JSONB -- Dados anteriores/novos
);

-- 5. SEGURANÇA E DADOS INICIAIS
INSERT INTO "Usuarios" ("Nome", "Email", "Senha", "Cargo")
VALUES ('Admin Sistema', 'admin@deliciadacidade.com', '123456', 'Administrador');