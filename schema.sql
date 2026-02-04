
-- 2. TABELAS DE CONFIGURAÇÃO E ACESSO
CREATE TABLE "Usuarios" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "Nome" VARCHAR(255) NOT NULL,
    "Email" VARCHAR(255) UNIQUE NOT NULL,
    "Senha" VARCHAR(255) NOT NULL,
    "Cargo" VARCHAR(100),
    "Assinatura" TEXT,
    "Permissoes" JSONB,
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
    "SaldoFerias" DECIMAL(10,2),
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
    "ComprovativoURL" TEXT,
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

CREATE TABLE "Notificacoes" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "UsuarioID" UUID, -- Opcional, se for para um user especifico
    "Mensagem" TEXT NOT NULL,
    "Lida" BOOLEAN DEFAULT FALSE,
    "CriadoEm" TIMESTAMP DEFAULT NOW()
);

-- 8. MÓDULO M.L. PAIN (COZINHA HOSPITALAR)
CREATE TABLE "MLPain_Areas" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "Nome" VARCHAR(100) NOT NULL,
    "Ordem" INTEGER DEFAULT 0,
    "MetaDiaria" INTEGER DEFAULT 0,
    "Tipo" VARCHAR(50) DEFAULT 'Sólido',
    "Ativo" BOOLEAN DEFAULT TRUE,
    "CriadoEm" TIMESTAMP DEFAULT NOW()
);

CREATE TABLE "MLPain_Registros" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "Data" DATE NOT NULL,
    "Turno" VARCHAR(50), -- Manhã, Tarde, Noite
    "AreaID" UUID REFERENCES "MLPain_Areas"("ID"),
    "AreaNome" VARCHAR(100), -- Redundância para facilitar relatórios históricos
    "Tipo" VARCHAR(50), -- Sólido, Líquido
    "Subtipo" VARCHAR(50), -- Geral (Sólido), Sopa, Chá
    "Quantidade" INTEGER DEFAULT 0,
    "Responsavel" VARCHAR(255),
    "ResponsavelEntrega" VARCHAR(255),
    "Prato" VARCHAR(255),
    "Observacoes" TEXT,
    "CriadoEm" TIMESTAMP DEFAULT NOW()
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
    "Marca" VARCHAR(100),
    "Modelo" VARCHAR(100),
    "Localizacao" VARCHAR(100),
    "FotoURL" TEXT,
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

-- 7. MÓDULO CONFIGURAÇÕES (NOVAS TABELAS)

-- A. Instituição e Preferências
CREATE TABLE "InstituicaoConfig" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "NomeCompleto" VARCHAR(255),
    "NomeFantasia" VARCHAR(255),
    "TipoUnidade" VARCHAR(100),
    "LogotipoURL" TEXT,
    "Endereco" TEXT,
    "Telefone" VARCHAR(50),
    "Email" VARCHAR(100),
    "Website" VARCHAR(100),
    "Moeda" VARCHAR(10) DEFAULT 'Kz',
    "FusoHorario" VARCHAR(50) DEFAULT 'Africa/Luanda',
    "ExibirLogoRelatorios" BOOLEAN DEFAULT FALSE,
    "CorRelatorios" VARCHAR(20) DEFAULT '#3B82F6',
    "SubsidioFeriasPorcentagem" DECIMAL(5,2) DEFAULT 50.00
);

-- B. Estrutura Organizacional
CREATE TABLE "Departamentos" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "Nome" VARCHAR(100) NOT NULL,
    "Responsavel" VARCHAR(255),
    "CriadoEm" TIMESTAMP DEFAULT NOW()
);

CREATE TABLE "Cargos" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "Nome" VARCHAR(100) NOT NULL,
    "DepartamentoID" UUID REFERENCES "Departamentos"("ID"),
    "CriadoEm" TIMESTAMP DEFAULT NOW()
);

-- C. Parâmetros Gerais (Tabelas Auxiliares)
-- Usaremos uma tabela genérica para listas simples ou tabelas especificas conforme necessidade
CREATE TABLE "ParametrosRH" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "Tipo" VARCHAR(50), -- 'TipoContrato', 'Turno', 'Regime'
    "Valor" VARCHAR(100),
    "Ativo" BOOLEAN DEFAULT TRUE
);

CREATE TABLE "ParametrosCozinha" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "Tipo" VARCHAR(50), -- 'TipoRefeicao', 'AreaProducao', 'UnidadeMedida'
    "Valor" VARCHAR(100)
);

CREATE TABLE "ParametrosEstoque" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "Tipo" VARCHAR(50), -- 'CategoriaProduto', 'MotivoPerda'
    "Valor" VARCHAR(100)
);

CREATE TABLE "ParametrosPatrimonio" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "Tipo" VARCHAR(50), -- 'CategoriaBem', 'EstadoBem'
    "Valor" VARCHAR(100)
);

CREATE TABLE "ParametrosFinanceiro" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "Tipo" VARCHAR(50), -- 'FormaPagamento', 'Banco', 'Beneficio'
    "Valor" VARCHAR(100)
);

-- D. Logs de Auditoria
CREATE TABLE "LogsAuditoria" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "DataHora" TIMESTAMP DEFAULT NOW(),
    "UsuarioID" UUID,
    "UsuarioNome" VARCHAR(255),
    "Modulo" VARCHAR(50),
    "Acao" VARCHAR(50), -- CRIAR, EDITAR, EXCLUIR
    "Descricao" TEXT,
    "DetalhesJSON" JSONB
);

-- 9. MÓDULO GESTÃO DE PRODUÇÃO (REFORMULADO)

-- 2️⃣ Fichas Técnicas de Preparação
CREATE TABLE "FichasTecnicas" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "Nome" VARCHAR(255) NOT NULL,
    "Categoria" VARCHAR(100), -- Prato principal, guarnição, sobremesa
    "ModoPreparo" TEXT,
    "Rendimento" DECIMAL(10,2), -- Nº de porções
    "TempoPreparo" VARCHAR(50),
    "CustoPorPorcao" DECIMAL(12,2),
    "ValorNutricional" JSONB, -- {kcal, proteinas, gorduras...}
    "IngredientesJSON" JSONB, -- [{nome, quantidade, unidade, custo}, ...]
    "Status" VARCHAR(50) DEFAULT 'Ativo',
    "CriadoEm" TIMESTAMP DEFAULT NOW()
);

-- 1️⃣ Planejamento de Produção
CREATE TABLE "PlanejamentoProducao" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "DataProducao" DATE NOT NULL,
    "TipoRefeicao" VARCHAR(50), -- Café, Almoço, Jantar
    "Setor" VARCHAR(100), -- Clínica médica, Pediatria...
    "QtdPacientes" INTEGER,
    "ReceitaID" UUID REFERENCES "FichasTecnicas"("ID"),
    "ReceitaNome" VARCHAR(255), -- Redundância para facilitar leitura
    "QtdPlanejada" DECIMAL(12,2), -- kg ou porções
    "ResponsavelTecnico" VARCHAR(255),
    "Observacoes" TEXT,
    "Status" VARCHAR(50) DEFAULT 'Planejado', -- Planejado, Em Produção, Concluído
    "CriadoEm" TIMESTAMP DEFAULT NOW()
);

-- 3️⃣ Ordem de Produção
CREATE TABLE "OrdensProducao" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "Codigo" SERIAL, -- Nº da Ordem
    "PlanejamentoID" UUID REFERENCES "PlanejamentoProducao"("ID"),
    "Data" DATE,
    "Turno" VARCHAR(50),
    "Responsavel" VARCHAR(255), -- Cozinheiro
    "QtdProduzida" DECIMAL(12,2),
    "Inicio" TIME,
    "Fim" TIME,
    "Observacoes" TEXT,
    "Status" VARCHAR(50) DEFAULT 'Aberta',
    "CriadoEm" TIMESTAMP DEFAULT NOW()
);

-- 4️⃣ Controle de Ingredientes (Baixa de Estoque vinculada à Ordem)
CREATE TABLE "ConsumoIngredientes" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "OrdemID" UUID REFERENCES "OrdensProducao"("ID"),
    "ProdutoID" UUID REFERENCES "Estoque"("ID"), -- Código do Ingrediente
    "ProdutoNome" VARCHAR(255),
    "Quantidade" DECIMAL(12,2),
    "Lote" VARCHAR(50),
    "Responsavel" VARCHAR(255), -- Estoquista
    "DataRetirada" TIMESTAMP DEFAULT NOW()
);

-- 6️⃣ Controle de Desperdício e Sobras
CREATE TABLE "ControleDesperdicio" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "Data" DATE,
    "TipoRefeicao" VARCHAR(50),
    "SobraLimpa" DECIMAL(10,2), -- kg
    "SobraSuja" DECIMAL(10,2), -- kg
    "Motivo" TEXT,
    "Responsavel" VARCHAR(255),
    "Observacoes" TEXT,
    "CriadoEm" TIMESTAMP DEFAULT NOW()
);

-- 10. MÓDULO PEDIDOS DE COMPRA (HISTÓRICO)
CREATE TABLE "PedidosCompra" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "Codigo" SERIAL,
    "Solicitante" VARCHAR(255),
    "DataSolicitacao" DATE DEFAULT CURRENT_DATE,
    "ValorTotal" DECIMAL(12,2),
    "Status" VARCHAR(50) DEFAULT 'Pendente', -- Pendente, Aprovado, Comprado, Cancelado
    "CriadoEm" TIMESTAMP DEFAULT NOW()
);

CREATE TABLE "ItensPedidoCompra" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "PedidoID" UUID REFERENCES "PedidosCompra"("ID"),
    "ProdutoNome" VARCHAR(255),
    "Quantidade" DECIMAL(12,2),
    "CustoUnitario" DECIMAL(12,2),
    "Subtotal" DECIMAL(12,2),
    "Observacao" TEXT
);

-- 5. SEGURANÇA E DADOS INICIAIS
INSERT INTO "Usuarios" ("Nome", "Email", "Senha", "Cargo")
VALUES ('Admin Sistema', 'admin@deliciadacidade.com', '123456', 'Administrador');
INSERT INTO "Usuarios" ("Nome", "Email", "Senha", "Cargo")
VALUES ('Fernando', 'fernando.ao.castro@gmail.com', 'Admin123', 'Administrador');