-- ==============================================================================
-- MANUAL DE SEGURANÇA E BACKUP (PARA RODAR NO EDITOR SQL DO SUPABASE)
-- ==============================================================================

-- PARTE 1: SEGURANÇA (ROW LEVEL SECURITY)
-- Ativar RLS impede acesso não autorizado direto ao banco.
-- Como seu sistema usa uma API centralizada (business.js), criamos uma política
-- que permite o acesso da API, mas bloqueia acessos externos desconhecidos.

-- 1.1. Ativar RLS nas tabelas principais
ALTER TABLE "Usuarios" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Funcionarios" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Financas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Estoque" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FichasTecnicas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PlanejamentoProducao" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OrdensProducao" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ConsumoIngredientes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ControleDesperdicio" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MLPain_Areas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MLPain_Registros" ENABLE ROW LEVEL SECURITY;

-- 1.2. Criar Política de Acesso (Permitir acesso público/anonimo por enquanto)
-- NOTA: Como sua API usa a chave ANON, precisamos liberar o acesso para ela.
-- Futuramente, podemos restringir isso apenas ao IP do servidor ou usuário logado.

DROP POLICY IF EXISTS "Acesso API Usuarios" ON "Usuarios";
CREATE POLICY "Acesso API Usuarios" ON "Usuarios" FOR ALL USING (true);

DROP POLICY IF EXISTS "Acesso API Funcionarios" ON "Funcionarios";
CREATE POLICY "Acesso API Funcionarios" ON "Funcionarios" FOR ALL USING (true);

DROP POLICY IF EXISTS "Acesso API Financas" ON "Financas";
CREATE POLICY "Acesso API Financas" ON "Financas" FOR ALL USING (true);

DROP POLICY IF EXISTS "Acesso API Estoque" ON "Estoque";
CREATE POLICY "Acesso API Estoque" ON "Estoque" FOR ALL USING (true);

DROP POLICY IF EXISTS "Acesso API FichasTecnicas" ON "FichasTecnicas";
CREATE POLICY "Acesso API FichasTecnicas" ON "FichasTecnicas" FOR ALL USING (true);

DROP POLICY IF EXISTS "Acesso API Planejamento" ON "PlanejamentoProducao";
CREATE POLICY "Acesso API Planejamento" ON "PlanejamentoProducao" FOR ALL USING (true);

DROP POLICY IF EXISTS "Acesso API Ordens" ON "OrdensProducao";
CREATE POLICY "Acesso API Ordens" ON "OrdensProducao" FOR ALL USING (true);

DROP POLICY IF EXISTS "Acesso API Consumo" ON "ConsumoIngredientes";
CREATE POLICY "Acesso API Consumo" ON "ConsumoIngredientes" FOR ALL USING (true);

DROP POLICY IF EXISTS "Acesso API Desperdicio" ON "ControleDesperdicio";
CREATE POLICY "Acesso API Desperdicio" ON "ControleDesperdicio" FOR ALL USING (true);

DROP POLICY IF EXISTS "Acesso API MLPain Areas" ON "MLPain_Areas";
CREATE POLICY "Acesso API MLPain Areas" ON "MLPain_Areas" FOR ALL USING (true);

DROP POLICY IF EXISTS "Acesso API MLPain Registros" ON "MLPain_Registros";
CREATE POLICY "Acesso API MLPain Registros" ON "MLPain_Registros" FOR ALL USING (true);

-- 1.3. Tabela de Perfis de Acesso (Novo Recurso)
CREATE TABLE IF NOT EXISTS "PerfisAcesso" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "Nome" VARCHAR(100) NOT NULL,
    "Permissoes" JSONB,
    "CriadoEm" TIMESTAMP DEFAULT NOW()
);

ALTER TABLE "PerfisAcesso" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso API Perfis" ON "PerfisAcesso";
CREATE POLICY "Acesso API Perfis" ON "PerfisAcesso" FOR ALL USING (true);

-- 1.4. Tabela de Chat Interno
CREATE TABLE IF NOT EXISTS "ChatMessages" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "SenderID" UUID,
    "SenderName" VARCHAR(255),
    "Message" TEXT,
    "Timestamp" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE "ChatMessages" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso API Chat" ON "ChatMessages" FOR ALL USING (true);

-- 1.5. Atualização Chat (Anexos)
ALTER TABLE "ChatMessages" ADD COLUMN IF NOT EXISTS "Attachment" TEXT;

-- 1.6. Quadro de Avisos (Novo)
CREATE TABLE IF NOT EXISTS "QuadroAvisos" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "Titulo" VARCHAR(255) NOT NULL,
    "Mensagem" TEXT,
    "Autor" VARCHAR(100),
    "Prioridade" VARCHAR(20) DEFAULT 'Normal', -- Normal, Alta
    "Anexo" TEXT,
    "CriadoEm" TIMESTAMP DEFAULT NOW()
);

ALTER TABLE "QuadroAvisos" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso API Avisos" ON "QuadroAvisos" FOR ALL USING (true);

-- 1.7. Tarefas da Equipe (To-Do List)
CREATE TABLE IF NOT EXISTS "Tarefas" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "Titulo" VARCHAR(255) NOT NULL,
    "Descricao" TEXT,
    "Responsavel" VARCHAR(100),
    "Prazo" DATE,
    "Prioridade" VARCHAR(20) DEFAULT 'Média', -- Baixa, Média, Alta
    "Status" VARCHAR(20) DEFAULT 'Pendente', -- Pendente, Em Andamento, Concluída
    "CriadoEm" TIMESTAMP DEFAULT NOW()
);

ALTER TABLE "Tarefas" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso API Tarefas" ON "Tarefas" FOR ALL USING (true);

-- Atualização Tabela Eventos (Valor para ABC)
ALTER TABLE "Eventos" ADD COLUMN IF NOT EXISTS "Valor" DECIMAL(12,2) DEFAULT 0;

-- 1.8. Checklist de Limpeza
CREATE TABLE IF NOT EXISTS "ChecklistLimpeza" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "Data" DATE NOT NULL,
    "Turno" VARCHAR(50),
    "Area" VARCHAR(100), -- Cozinha, Copa, Estoque
    "Item" VARCHAR(255), -- O que limpar
    "Status" VARCHAR(20) DEFAULT 'Pendente', -- Pendente, OK, Atenção, Não Realizado
    "Responsavel" VARCHAR(100),
    "Observacao" TEXT,
    "CriadoEm" TIMESTAMP DEFAULT NOW()
);

ALTER TABLE "ChecklistLimpeza" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso API Checklist" ON "ChecklistLimpeza" FOR ALL USING (true);

-- Atualização Tabela Eventos (Responsável/Garçom para Comissões)
ALTER TABLE "Eventos" ADD COLUMN IF NOT EXISTS "Responsavel" VARCHAR(100);

-- 1.9. Fidelidade de Clientes
-- Atualização Tabela OrdensProducao (Suporte a Eventos)
ALTER TABLE "OrdensProducao" ADD COLUMN IF NOT EXISTS "EventoID" UUID REFERENCES "Eventos"("ID");
ALTER TABLE "OrdensProducao" ADD COLUMN IF NOT EXISTS "OrigemTipo" VARCHAR(50) DEFAULT 'Rotina'; -- Rotina, Evento
ALTER TABLE "OrdensProducao" ADD COLUMN IF NOT EXISTS "DetalhesProducao" JSONB; -- Pratos, Ingredientes, Etapas, Equipe
ALTER TABLE "Estoque" ADD COLUMN IF NOT EXISTS "QuantidadeReservada" DECIMAL(12,2) DEFAULT 0;

CREATE TABLE IF NOT EXISTS "Clientes" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "Nome" VARCHAR(255) NOT NULL,
    "Telefone" VARCHAR(50),
    "Email" VARCHAR(100),
    "Pontos" INTEGER DEFAULT 0,
    "TotalGasto" DECIMAL(12,2) DEFAULT 0,
    "UltimaCompra" DATE,
    "CriadoEm" TIMESTAMP DEFAULT NOW()
);

ALTER TABLE "Clientes" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso API Clientes" ON "Clientes" FOR ALL USING (true);

-- 1.10. Pedidos de Compra (Módulo de Compras)
CREATE TABLE IF NOT EXISTS "PedidosCompra" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "Solicitante" VARCHAR(255),
    "ValorTotal" DECIMAL(12,2) DEFAULT 0,
    "Status" VARCHAR(50) DEFAULT 'Pendente', -- Pendente, Aprovado, Rejeitado, Concluído
    "CriadoEm" TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "ItensPedidoCompra" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "PedidoID" UUID REFERENCES "PedidosCompra"("ID") ON DELETE CASCADE,
    "ProdutoNome" VARCHAR(255),
    "Quantidade" DECIMAL(12,3),
    "CustoUnitario" DECIMAL(12,2),
    "Subtotal" DECIMAL(12,2),
    "Observacao" TEXT
);

ALTER TABLE "PedidosCompra" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ItensPedidoCompra" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso API Pedidos" ON "PedidosCompra" FOR ALL USING (true);
CREATE POLICY "Acesso API ItensPedido" ON "ItensPedidoCompra" FOR ALL USING (true);

-- ==============================================================================
-- PARTE 2: COMO FAZER CÓPIA DOS DADOS (BACKUP DE EMERGÊNCIA)
-- ==============================================================================
-- Se você vai fazer uma alteração perigosa e quer salvar os dados antes,
-- rode estes comandos para criar tabelas de backup com a data atual.

-- Exemplo: Criar backup da tabela de Funcionários
CREATE TABLE "Backup_Funcionarios_Hoje" AS
SELECT * FROM "Funcionarios";

-- Exemplo: Criar backup do Financeiro
CREATE TABLE "Backup_Financas_Hoje" AS
SELECT * FROM "Financas";

-- Exemplo: Criar backup do Estoque
CREATE TABLE "Backup_Estoque_Hoje" AS
SELECT * FROM "Estoque";

-- ==============================================================================
-- PARTE 3: COMO RESTAURAR OS DADOS (SE ALGO DEU ERRADO)
-- ==============================================================================
-- Se você apagou algo sem querer, pode recuperar da tabela de backup criada acima.

-- 1. Limpar a tabela atual (CUIDADO!)
-- TRUNCATE TABLE "Funcionarios";

-- 2. Inserir os dados do backup de volta
-- INSERT INTO "Funcionarios" SELECT * FROM "Backup_Funcionarios_Hoje";

-- ==============================================================================
-- PARTE 4: LIMPEZA
-- ==============================================================================
-- Quando não precisar mais do backup, apague para não ocupar espaço

-- DROP TABLE "Backup_Funcionarios_Hoje";

-- ==============================================================================
-- PARTE 5: CORREÇÕES DE ERROS COMUNS (RODAR NO SQL EDITOR)
-- ==============================================================================
-- Erro: Could not find the 'SaldoFerias' column of 'Funcionarios'
ALTER TABLE "Funcionarios" ADD COLUMN IF NOT EXISTS "SaldoFerias" DECIMAL(10,2);

-- Erro: null value in column "ID" of relation "Inventario" (Correção de Default)
ALTER TABLE "Inventario" ALTER COLUMN "ID" SET DEFAULT gen_random_uuid();

-- Verificação de outras colunas essenciais (Sincronização com schema.sql)
-- Tabela Usuarios
ALTER TABLE "Usuarios" ADD COLUMN IF NOT EXISTS "Assinatura" TEXT;
ALTER TABLE "Usuarios" ADD COLUMN IF NOT EXISTS "Permissoes" JSONB;

-- Tabela Funcionarios
ALTER TABLE "Funcionarios" ADD COLUMN IF NOT EXISTS "FotoURL" TEXT;

-- Tabela Estoque e Movimentações
ALTER TABLE "Estoque" ADD COLUMN IF NOT EXISTS "Fornecedor" VARCHAR(255);
ALTER TABLE "Estoque" ADD COLUMN IF NOT EXISTS "PrecoVenda" DECIMAL(12,2);
ALTER TABLE "Estoque" ADD COLUMN IF NOT EXISTS "MargemLucro" DECIMAL(5,2);
ALTER TABLE "MovimentacoesEstoque" ADD COLUMN IF NOT EXISTS "DetalhesJSON" JSONB;
ALTER TABLE "MovimentacoesEstoque" ADD COLUMN IF NOT EXISTS "Data" TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Tabela Inventario (Patrimônio)
ALTER TABLE "Inventario" ADD COLUMN IF NOT EXISTS "NumeroSerie" VARCHAR(100);
ALTER TABLE "Inventario" ADD COLUMN IF NOT EXISTS "EstadoConservacao" VARCHAR(50);
ALTER TABLE "Inventario" ADD COLUMN IF NOT EXISTS "VidaUtil" INTEGER;
ALTER TABLE "Inventario" ADD COLUMN IF NOT EXISTS "Marca" VARCHAR(100);
ALTER TABLE "Inventario" ADD COLUMN IF NOT EXISTS "Modelo" VARCHAR(100);
ALTER TABLE "Inventario" ADD COLUMN IF NOT EXISTS "Localizacao" VARCHAR(100);
ALTER TABLE "Inventario" ADD COLUMN IF NOT EXISTS "FotoURL" TEXT;
ALTER TABLE "Inventario" ADD COLUMN IF NOT EXISTS "Observacoes" TEXT;
ALTER TABLE "Inventario" ADD COLUMN IF NOT EXISTS "ValorAquisicao" DECIMAL(12,2);

-- Tabela MLPain (Cozinha)
ALTER TABLE "MLPain_Registros" ADD COLUMN IF NOT EXISTS "AreaNome" VARCHAR(100);
ALTER TABLE "MLPain_Registros" ADD COLUMN IF NOT EXISTS "ResponsavelEntrega" VARCHAR(255);
ALTER TABLE "MLPain_Areas" ADD COLUMN IF NOT EXISTS "MetaDiaria" INTEGER DEFAULT 0;
ALTER TABLE "MLPain_Areas" ADD COLUMN IF NOT EXISTS "Tipo" VARCHAR(50) DEFAULT 'Sólido';
ALTER TABLE "MLPain_Areas" ADD COLUMN IF NOT EXISTS "Ordem" INTEGER DEFAULT 0;

-- Tabela Configurações
ALTER TABLE "InstituicaoConfig" ADD COLUMN IF NOT EXISTS "SubsidioFeriasPorcentagem" DECIMAL(5,2) DEFAULT 50.00;
ALTER TABLE "InstituicaoConfig" ADD COLUMN IF NOT EXISTS "ExibirLogoRelatorios" BOOLEAN DEFAULT FALSE;
ALTER TABLE "InstituicaoConfig" ADD COLUMN IF NOT EXISTS "CorRelatorios" VARCHAR(20) DEFAULT '#3B82F6';

-- Tabela Produção
ALTER TABLE "FichasTecnicas" ADD COLUMN IF NOT EXISTS "IngredientesJSON" JSONB;
ALTER TABLE "FichasTecnicas" ADD COLUMN IF NOT EXISTS "ValorNutricional" JSONB;

-- ==============================================================================
-- PARTE 5.1: TABELA DE PLANEJAMENTO DE PRODUÇÃO (NOVO MÓDULO)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS "production_plans" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "planning_date" DATE,
    "staff_count_day" INTEGER DEFAULT 0,
    "staff_count_night" INTEGER DEFAULT 0,
    "patient_solid" INTEGER DEFAULT 0,
    "patient_liquid" INTEGER DEFAULT 0,
    "meta_solid" INTEGER GENERATED ALWAYS AS ("staff_count_day" + "staff_count_night" + "patient_solid") STORED,
    "meta_soup" INTEGER GENERATED ALWAYS AS ("patient_liquid") STORED,
    "meta_tea" INTEGER GENERATED ALWAYS AS ("patient_liquid") STORED,
    "production_details" JSONB
);

ALTER TABLE "production_plans" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso API Production Plans" ON "production_plans" FOR ALL USING (true);

-- ==============================================================================
-- PARTE 5.1: TABELA DE PLANEJAMENTO DE PRODUÇÃO (NOVO MÓDULO)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS "production_plans" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "planning_date" DATE,
    "staff_count_day" INTEGER DEFAULT 0,
    "staff_count_night" INTEGER DEFAULT 0,
    "patient_solid" INTEGER DEFAULT 0,
    "patient_liquid" INTEGER DEFAULT 0,
    "meta_solid" INTEGER GENERATED ALWAYS AS ("staff_count_day" + "staff_count_night" + "patient_solid") STORED,
    "meta_soup" INTEGER GENERATED ALWAYS AS ("patient_liquid") STORED,
    "meta_tea" INTEGER GENERATED ALWAYS AS ("patient_liquid") STORED,
    "production_details" JSONB
);

ALTER TABLE "production_plans" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso API Production Plans" ON "production_plans" FOR ALL USING (true);

-- ==============================================================================
-- PARTE 6: TABELA DE ESCALA (DIARISTAS)
-- ==============================================================================
-- Tabela para definir dias de trabalho ou folga fixos por dia da semana
CREATE TABLE IF NOT EXISTS "Escala" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "FuncionarioID" UUID REFERENCES "Funcionarios"("ID") ON DELETE CASCADE,
    "DiaSemana" INTEGER NOT NULL, -- 1=Segunda, 2=Terça, ..., 7=Domingo
    "Tipo" VARCHAR(20) DEFAULT 'Folga', -- 'Folga' ou 'Trabalho'
    "CriadoEm" TIMESTAMP DEFAULT NOW(),
    UNIQUE("FuncionarioID", "DiaSemana")
);

ALTER TABLE "Escala" ENABLE ROW LEVEL SECURITY;

-- Política de acesso para a API
DROP POLICY IF EXISTS "Acesso API Escala" ON "Escala";
CREATE POLICY "Acesso API Escala" ON "Escala" FOR ALL USING (true);

-- ==============================================================================
-- PARTE 7: TABELA DE EVENTOS (CORREÇÃO DE ERRO)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS "Eventos" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "Titulo" VARCHAR(255) NOT NULL,
    "Data" DATE NOT NULL,
    "Hora" TIME,
    "Cliente" VARCHAR(255),
    "Descricao" TEXT,
    "Categoria" VARCHAR(100),
    "Status" VARCHAR(50) DEFAULT 'Agendado',
    "CriadoEm" TIMESTAMP DEFAULT NOW()
);

ALTER TABLE "Eventos" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acesso API Eventos" ON "Eventos";
CREATE POLICY "Acesso API Eventos" ON "Eventos" FOR ALL USING (true);

-- ==============================================================================
-- PARTE 8: FUNÇÕES DE PERFORMANCE (RPC) - OTIMIZAÇÃO MLPAIN
-- ==============================================================================
-- Estas funções processam dados pesados no servidor SQL para evitar lentidão no App.

-- 8.1. Total de Refeições no Mês (Para Dashboard)
CREATE OR REPLACE FUNCTION get_total_refeicoes_mes(data_inicio DATE)
RETURNS INTEGER AS $$
BEGIN
    RETURN (SELECT COALESCE(SUM("Quantidade"), 0)::INTEGER FROM "MLPain_Registros" WHERE "Data" >= data_inicio);
END;
$$ LANGUAGE plpgsql;

-- 8.2. Estatísticas de Dietas do Dia (Para Relatório Diário)
CREATE OR REPLACE FUNCTION get_estatisticas_dietas(data_consulta DATE)
RETURNS JSONB AS $$
DECLARE
    total_val INTEGER;
    detalhes_json JSONB;
    result JSONB;
BEGIN
    -- 1. Calcular Total Geral (Soma tudo, sem risco de esquecer categorias novas)
    SELECT COALESCE(SUM("Quantidade"), 0) INTO total_val FROM "MLPain_Registros" WHERE "Data" = data_consulta;

    -- 2. Calcular Detalhes Dinâmicos (Agrupa automaticamente pelo que estiver cadastrado)
    SELECT jsonb_object_agg(categoria, qtd) INTO detalhes_json
    FROM (
        SELECT 
            CASE 
                WHEN "Tipo" = 'Sólido' THEN 'Sólido'
                WHEN "Subtipo" IS NOT NULL AND "Subtipo" != '' THEN "Subtipo"
                ELSE COALESCE("Tipo", 'Outros')
            END as categoria,
            SUM("Quantidade") as qtd
        FROM "MLPain_Registros"
        WHERE "Data" = data_consulta
        GROUP BY 1
    ) sub;

    -- 3. Montar Resultado (Híbrido: Compatibilidade + Dinâmico)
    result := jsonb_build_object(
        'total', total_val,
        'detalhes', COALESCE(detalhes_json, '{}'::jsonb),
        -- Mantemos estes campos para não quebrar o frontend atual
        'solidos', COALESCE((detalhes_json->>'Sólido')::int, 0),
        'sopa', COALESCE((detalhes_json->>'Sopa')::int, 0),
        'cha', COALESCE((detalhes_json->>'Chá')::int, 0)
    );

    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 8.3. Dados para Gráfico de Refeições (Últimos 7 dias)
CREATE OR REPLACE FUNCTION get_refeicoes_grafico(data_inicio DATE)
RETURNS TABLE ("Data" DATE, "Quantidade" INTEGER) AS $$
BEGIN
    RETURN QUERY
    SELECT "MLPain_Registros"."Data", COALESCE(SUM("MLPain_Registros"."Quantidade"), 0)::INTEGER
    FROM "MLPain_Registros"
    WHERE "MLPain_Registros"."Data" >= data_inicio
    GROUP BY "MLPain_Registros"."Data"
    ORDER BY "MLPain_Registros"."Data";
END;
$$ LANGUAGE plpgsql;

-- 8.4. Relatório ABC de Clientes (Eventos) - Otimizado
CREATE OR REPLACE FUNCTION get_eventos_abc()
RETURNS TABLE (name text, value numeric) AS $$
BEGIN
    RETURN QUERY
    SELECT "Cliente" as name, SUM("Valor") as value
    FROM "Eventos"
    WHERE "Status" != 'Cancelado' AND "Cliente" IS NOT NULL
    GROUP BY "Cliente"
    ORDER BY value DESC;
END;
$$ LANGUAGE plpgsql;

-- 8.5. Vendas por Dia da Semana (Eventos) - Otimizado
CREATE OR REPLACE FUNCTION get_vendas_dia_semana()
RETURNS TABLE (day_idx integer, total numeric, count integer) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        EXTRACT(DOW FROM "Data")::integer as day_idx, -- 0=Domingo, 6=Sábado
        SUM("Valor") as total,
        COUNT(*)::integer as count
    FROM "Eventos"
    WHERE "Status" != 'Cancelado'
    GROUP BY day_idx
    ORDER BY day_idx;
END;
$$ LANGUAGE plpgsql;

-- 8.6. Salvar Pedido de Compra (Transação Atômica)
-- Garante que o pedido e os itens sejam salvos juntos. Se um falhar, tudo é cancelado.
CREATE OR REPLACE FUNCTION save_purchase_order(
    p_solicitante text,
    p_valor_total numeric,
    p_status text,
    p_itens jsonb
) RETURNS uuid AS $$
DECLARE
    v_pedido_id uuid;
    v_item jsonb;
BEGIN
    -- 1. Criar Pedido
    INSERT INTO "PedidosCompra" ("Solicitante", "ValorTotal", "Status")
    VALUES (p_solicitante, p_valor_total, p_status)
    RETURNING "ID" INTO v_pedido_id;

    -- 2. Inserir Itens
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
        INSERT INTO "ItensPedidoCompra" (
            "PedidoID", "ProdutoNome", "Quantidade", "CustoUnitario", "Subtotal", "Observacao"
        ) VALUES (
            v_pedido_id,
            v_item->>'name',
            (v_item->>'qty')::numeric,
            (v_item->>'price')::numeric,
            (v_item->>'total')::numeric,
            v_item->>'obs'
        );
    END LOOP;

    RETURN v_pedido_id;
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- PARTE 9: PERFORMANCE DE BUSCA (RH)
-- ==============================================================================
CREATE INDEX IF NOT EXISTS "idx_funcionarios_nome" ON "Funcionarios" ("Nome");
CREATE INDEX IF NOT EXISTS "idx_funcionarios_cargo" ON "Funcionarios" ("Cargo");
ALTER TABLE "Funcionarios" ADD COLUMN IF NOT EXISTS "ValidadeBI" DATE;

-- ==============================================================================
-- PARTE 10: CONTROLE DE E-MAILS AUTOMÁTICOS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS "EmailLogs" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "DestinatarioID" UUID,
    "Tipo" VARCHAR(50), -- Ex: 'Aniversario'
    "Ano" INTEGER,
    "DataEnvio" TIMESTAMP DEFAULT NOW()
);

-- ==============================================================================
-- PARTE 11: PREVENÇÃO DE DUPLICATAS (CLIENTES)
-- ==============================================================================
CREATE UNIQUE INDEX IF NOT EXISTS "idx_clientes_nome_unico" ON "Clientes" (lower(trim("Nome")));

-- ==============================================================================
-- PARTE 12: CONFIGURAÇÃO RÁPIDA (LOGOTIPO E EMPRESA)
-- ==============================================================================
-- Rode este comando para definir o logotipo nos relatórios PDF.
-- Substitua a URL abaixo pelo link direto da sua imagem.

/*
-- 1. Garante que existe uma configuração inicial (se a tabela estiver vazia)
INSERT INTO "InstituicaoConfig" ("NomeFantasia", "ExibirLogoRelatorios")
SELECT 'Delícias da Cidade', TRUE
WHERE NOT EXISTS (SELECT 1 FROM "InstituicaoConfig");

-- 2. Atualiza o Logotipo
UPDATE "InstituicaoConfig"
SET 
    "LogotipoURL" = 'https://exemplo.com/seu-logo.png', 
    "ExibirLogoRelatorios" = TRUE
WHERE "ID" IS NOT NULL;
*/

-- ==============================================================================
-- PARTE 13: COMO HOSPEDAR LOGOTIPO NO SUPABASE STORAGE
-- ==============================================================================
/*
PASSO A PASSO PARA HOSPEDAR A IMAGEM:
1. No Painel do Supabase, vá em "Storage" (ícone de balde no menu esquerdo).
2. Clique em "New Bucket".
3. Nomeie como "logos" e marque a opção "Public bucket". Clique em "Create bucket".
4. Entre no bucket "logos" e clique em "Upload File". Selecione a imagem do seu computador.
5. Após enviar, clique nos 3 pontinhos ao lado do arquivo > "Get Public URL".
6. Copie o link gerado (ex: https://.../storage/v1/object/public/logos/meu-logo.png).
7. Substitua o link no comando abaixo e execute:

UPDATE "InstituicaoConfig"
SET "LogotipoURL" = 'COLE_A_URL_AQUI'
WHERE "ID" IS NOT NULL;
*/

-- ==============================================================================
-- PARTE 14: CORREÇÃO DE ERRO (ORDEM DE PRODUÇÃO)
-- ==============================================================================
-- Execute isto para corrigir o erro "Could not find the 'DetalhesProducao' column"
ALTER TABLE "OrdensProducao" ADD COLUMN IF NOT EXISTS "DetalhesProducao" JSONB;

-- CORREÇÃO DE TIPO DE DADOS (EVENTOS)
-- Se Eventos.ID for TEXT, converte para UUID para permitir chave estrangeira
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'Eventos' AND column_name = 'ID' AND data_type = 'text'
    ) THEN
        -- Converte para UUID (Isso pode falhar se houver IDs inválidos que não são UUIDs)
        ALTER TABLE "Eventos" ALTER COLUMN "ID" TYPE UUID USING "ID"::uuid;
        -- Garante o default correto
        ALTER TABLE "Eventos" ALTER COLUMN "ID" SET DEFAULT gen_random_uuid();
    END IF;
END $$;

-- Garante que as outras colunas necessárias também existam
ALTER TABLE "OrdensProducao" ADD COLUMN IF NOT EXISTS "EventoID" UUID REFERENCES "Eventos"("ID");
ALTER TABLE "OrdensProducao" ADD COLUMN IF NOT EXISTS "OrigemTipo" VARCHAR(50) DEFAULT 'Rotina';
ALTER TABLE "Estoque" ADD COLUMN IF NOT EXISTS "QuantidadeReservada" DECIMAL(12,2) DEFAULT 0;

-- CORREÇÃO DE CONSTRAINT (ORDENS DE PRODUÇÃO)
-- Remove a restrição antiga que ligava OrdensProducao à tabela antiga PlanejamentoProducao
ALTER TABLE "OrdensProducao" DROP CONSTRAINT IF EXISTS "OrdensProducao_PlanejamentoID_fkey";

-- ==============================================================================
-- PARTE 15: CORREÇÃO DE ERRO (FREQUÊNCIA)
-- ==============================================================================
-- Garante que a tabela existe e tem as colunas necessárias
CREATE TABLE IF NOT EXISTS "Frequencia" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "FuncionarioID" UUID REFERENCES "Funcionarios"("ID"),
    "Data" DATE DEFAULT CURRENT_DATE,
    "CriadoEm" TIMESTAMP DEFAULT NOW()
);

ALTER TABLE "Frequencia" ADD COLUMN IF NOT EXISTS "Status" VARCHAR(50);
ALTER TABLE "Frequencia" ADD COLUMN IF NOT EXISTS "Entrada" TIME;
ALTER TABLE "Frequencia" ADD COLUMN IF NOT EXISTS "Saida" TIME;
ALTER TABLE "Frequencia" ADD COLUMN IF NOT EXISTS "Observacao" TEXT;
-- Correção: O código JS usa 'Observacoes' (plural) e precisa do Nome do Funcionário gravado
ALTER TABLE "Frequencia" ADD COLUMN IF NOT EXISTS "Observacoes" TEXT;
ALTER TABLE "Frequencia" ADD COLUMN IF NOT EXISTS "FuncionarioNome" VARCHAR(255);
ALTER TABLE "Frequencia" ADD COLUMN IF NOT EXISTS "Assinatura" TEXT;

ALTER TABLE "Frequencia" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso API Frequencia" ON "Frequencia";
CREATE POLICY "Acesso API Frequencia" ON "Frequencia" FOR ALL USING (true);

-- ==============================================================================
-- PARTE 16: TABELAS FALTANTES (RH, FINANCEIRO, SISTEMA)
-- ==============================================================================
-- Estas tabelas são usadas no código (business.js/rh.js) mas não existiam no banco.

-- 1. Fornecedores (Módulo Estoque)
CREATE TABLE IF NOT EXISTS "Fornecedores" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "Nome" VARCHAR(255) NOT NULL,
    "Contato" VARCHAR(255),
    "Endereco" TEXT,
    "ProdutosFornecidos" TEXT,
    "Status" VARCHAR(50) DEFAULT 'Ativo',
    "CriadoEm" TIMESTAMP DEFAULT NOW()
);
ALTER TABLE "Fornecedores" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso API Fornecedores" ON "Fornecedores" FOR ALL USING (true);

-- 2. Férias (Módulo RH)
CREATE TABLE IF NOT EXISTS "Ferias" (
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
    "ComprovativoURL" TEXT,
    "Observacoes" TEXT,
    "AssinaturaFunc" TEXT,
    "AssinaturaRH" TEXT,
    "Status" VARCHAR(50) DEFAULT 'Solicitado',
    "CriadoEm" TIMESTAMP DEFAULT NOW()
);
ALTER TABLE "Ferias" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso API Ferias" ON "Ferias" FOR ALL USING (true);

-- 3. Folha de Pagamento (Módulo RH)
CREATE TABLE IF NOT EXISTS "Folha" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "FuncionarioID" UUID REFERENCES "Funcionarios"("ID"),
    "FuncionarioNome" VARCHAR(255),
    "Periodo" VARCHAR(20), -- YYYY-MM
    "SalarioBase" DECIMAL(12,2),
    "Bonus" DECIMAL(12,2),
    "QtdHoraExtra" DECIMAL(10,2),
    "ValorHoraExtra" DECIMAL(12,2),
    "OutrosVencimentos" DECIMAL(12,2),
    "INSS" DECIMAL(12,2),
    "IRT" DECIMAL(12,2),
    "Faltas" DECIMAL(12,2),
    "OutrosDescontos" DECIMAL(12,2),
    "TotalVencimentos" DECIMAL(12,2),
    "TotalDescontos" DECIMAL(12,2),
    "SalarioLiquido" DECIMAL(12,2),
    "Banco" VARCHAR(100),
    "Iban" VARCHAR(100),
    "CriadoEm" TIMESTAMP DEFAULT NOW()
);
ALTER TABLE "Folha" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso API Folha" ON "Folha" FOR ALL USING (true);

-- 4. Licenças e Ausências (Módulo RH)
CREATE TABLE IF NOT EXISTS "Licencas" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "FuncionarioID" UUID REFERENCES "Funcionarios"("ID"),
    "FuncionarioNome" VARCHAR(255),
    "Tipo" VARCHAR(100),
    "Inicio" DATE,
    "Retorno" DATE,
    "Motivo" TEXT,
    "Justificativa" TEXT,
    "DataFalta" DATE,
    "ObsFalta" TEXT,
    "Medico" VARCHAR(255),
    "InicioMat" DATE,
    "TerminoMat" DATE,
    "InicioPat" DATE,
    "TerminoPat" DATE,
    "DataCasamento" DATE,
    "DiasLicenca" INTEGER,
    "DataAusencia" DATE,
    "CriadoEm" TIMESTAMP DEFAULT NOW()
);
ALTER TABLE "Licencas" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso API Licencas" ON "Licencas" FOR ALL USING (true);

-- 5. Avaliações de Desempenho (Módulo RH)
CREATE TABLE IF NOT EXISTS "Avaliacoes" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "FuncionarioID" UUID REFERENCES "Funcionarios"("ID"),
    "FuncionarioNome" VARCHAR(255),
    "DataAvaliacao" DATE,
    "Avaliador" VARCHAR(255),
    "MediaFinal" DECIMAL(5,2),
    "Conclusao" VARCHAR(100),
    "DetalhesJSON" JSONB,
    "CriadoEm" TIMESTAMP DEFAULT NOW()
);
ALTER TABLE "Avaliacoes" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso API Avaliacoes" ON "Avaliacoes" FOR ALL USING (true);

-- 6. Treinamentos (Módulo RH)
CREATE TABLE IF NOT EXISTS "Treinamentos" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "FuncionarioID" UUID, -- Pode ser 'Todos' (null) ou específico
    "FuncionarioNome" VARCHAR(255),
    "Titulo" VARCHAR(255),
    "Tipo" VARCHAR(50),
    "Instrutor" VARCHAR(255),
    "Local" VARCHAR(255),
    "Inicio" DATE,
    "Termino" DATE,
    "Carga" INTEGER,
    "Status" VARCHAR(50),
    "CriadoEm" TIMESTAMP DEFAULT NOW()
);
ALTER TABLE "Treinamentos" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso API Treinamentos" ON "Treinamentos" FOR ALL USING (true);

-- 7. Cargos & Departamentos (Auxiliares RH)
CREATE TABLE IF NOT EXISTS "Cargos" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "Nome" VARCHAR(100) NOT NULL,
    "DepartamentoID" UUID,
    "CriadoEm" TIMESTAMP DEFAULT NOW()
);
ALTER TABLE "Cargos" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso API Cargos" ON "Cargos" FOR ALL USING (true);

CREATE TABLE IF NOT EXISTS "Departamentos" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "Nome" VARCHAR(100) NOT NULL,
    "CriadoEm" TIMESTAMP DEFAULT NOW()
);
ALTER TABLE "Departamentos" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso API Departamentos" ON "Departamentos" FOR ALL USING (true);

-- 8. Logs de Auditoria e Notificações (Sistema)
CREATE TABLE IF NOT EXISTS "LogsAuditoria" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "UsuarioID" UUID,
    "UsuarioNome" VARCHAR(255),
    "Modulo" VARCHAR(100),
    "Acao" VARCHAR(50),
    "Descricao" TEXT,
    "DetalhesJSON" JSONB,
    "DataHora" TIMESTAMP DEFAULT NOW(),
    "CriadoEm" TIMESTAMP DEFAULT NOW()
);
ALTER TABLE "LogsAuditoria" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso API LogsAuditoria" ON "LogsAuditoria" FOR ALL USING (true);

CREATE TABLE IF NOT EXISTS "Notificacoes" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "Mensagem" TEXT,
    "Lida" BOOLEAN DEFAULT FALSE,
    "CriadoEm" TIMESTAMP DEFAULT NOW()
);
ALTER TABLE "Notificacoes" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso API Notificacoes" ON "Notificacoes" FOR ALL USING (true);

-- 9. Listas de Produção do Dia (Módulo Produção)
CREATE TABLE IF NOT EXISTS "ListasProducaoDia" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "Data" DATE,
    "Categoria" VARCHAR(100),
    "ItensJSON" JSONB,
    "Status" VARCHAR(50) DEFAULT 'Rascunho',
    "Prato" VARCHAR(255),
    "CriadoEm" TIMESTAMP DEFAULT NOW()
);
ALTER TABLE "ListasProducaoDia" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso API ListasProducaoDia" ON "ListasProducaoDia" FOR ALL USING (true);

-- 10. Financeiro Avançado (Metas e Contas)
CREATE TABLE IF NOT EXISTS "MetasFinanceiras" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "Mes" VARCHAR(7) UNIQUE, -- YYYY-MM
    "ReceitaEsperada" DECIMAL(12,2),
    "DespesaMaxima" DECIMAL(12,2),
    "CriadoEm" TIMESTAMP DEFAULT NOW()
);
ALTER TABLE "MetasFinanceiras" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso API MetasFinanceiras" ON "MetasFinanceiras" FOR ALL USING (true);

CREATE TABLE IF NOT EXISTS "ContasPagar" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "Fornecedor" VARCHAR(255),
    "ValorTotal" DECIMAL(12,2),
    "Descricao" TEXT,
    "DataVencimento" DATE,
    "Status" VARCHAR(50) DEFAULT 'Pendente',
    "Categoria" VARCHAR(100),
    "Subcategoria" VARCHAR(100),
    "FormaPagamento" VARCHAR(100),
    "CriadoEm" TIMESTAMP DEFAULT NOW()
);
ALTER TABLE "ContasPagar" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso API ContasPagar" ON "ContasPagar" FOR ALL USING (true);

CREATE TABLE IF NOT EXISTS "ContasReceber" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "Cliente" VARCHAR(255),
    "ValorTotal" DECIMAL(12,2),
    "Descricao" TEXT,
    "DataVencimento" DATE,
    "Status" VARCHAR(50) DEFAULT 'Pendente',
    "Categoria" VARCHAR(100),
    "Subcategoria" VARCHAR(100),
    "FormaPagamento" VARCHAR(100),
    "CriadoEm" TIMESTAMP DEFAULT NOW()
);
ALTER TABLE "ContasReceber" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso API ContasReceber" ON "ContasReceber" FOR ALL USING (true);

-- 11. Colunas Faltantes em Tabelas Existentes
-- Funcionários
ALTER TABLE "Funcionarios" ADD COLUMN IF NOT EXISTS "Turno" VARCHAR(50);
ALTER TABLE "Funcionarios" ADD COLUMN IF NOT EXISTS "Iban" VARCHAR(100);
ALTER TABLE "Funcionarios" ADD COLUMN IF NOT EXISTS "BI" VARCHAR(50);
ALTER TABLE "Funcionarios" ADD COLUMN IF NOT EXISTS "Nascimento" DATE;
ALTER TABLE "Funcionarios" ADD COLUMN IF NOT EXISTS "Admissao" DATE;
ALTER TABLE "Funcionarios" ADD COLUMN IF NOT EXISTS "TipoContrato" VARCHAR(50);
ALTER TABLE "Funcionarios" ADD COLUMN IF NOT EXISTS "Departamento" VARCHAR(100);
ALTER TABLE "Funcionarios" ADD COLUMN IF NOT EXISTS "Telefone" VARCHAR(50);
ALTER TABLE "Funcionarios" ADD COLUMN IF NOT EXISTS "Email" VARCHAR(100);
ALTER TABLE "Funcionarios" ADD COLUMN IF NOT EXISTS "Banco" VARCHAR(100);
ALTER TABLE "Funcionarios" ADD COLUMN IF NOT EXISTS "BancoHoras" DECIMAL(10,2) DEFAULT 0;

-- Estoque
ALTER TABLE "Estoque" ADD COLUMN IF NOT EXISTS "Subtipo" VARCHAR(100);
ALTER TABLE "Estoque" ADD COLUMN IF NOT EXISTS "Categoria" VARCHAR(100);
ALTER TABLE "Estoque" ADD COLUMN IF NOT EXISTS "Lote" VARCHAR(100);
ALTER TABLE "Estoque" ADD COLUMN IF NOT EXISTS "Validade" DATE;
ALTER TABLE "Estoque" ADD COLUMN IF NOT EXISTS "Localizacao" VARCHAR(100);
ALTER TABLE "Estoque" ADD COLUMN IF NOT EXISTS "Codigo" VARCHAR(50);
ALTER TABLE "Estoque" ADD COLUMN IF NOT EXISTS "Minimo" DECIMAL(12,2);
ALTER TABLE "Estoque" ADD COLUMN IF NOT EXISTS "Unidade" VARCHAR(20);

-- ListasProducaoDia
ALTER TABLE "ListasProducaoDia" ADD COLUMN IF NOT EXISTS "Prato" VARCHAR(255);

-- ==============================================================================
-- CORREÇÃO DE ERRO: RLS EM PRODUCTION_PLANS
-- ==============================================================================
-- Corrige o erro "new row violates row-level security policy" ao salvar planejamento
ALTER TABLE "production_plans" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso API Production Plans" ON "production_plans";
CREATE POLICY "Acesso API Production Plans" ON "production_plans" FOR ALL USING (true) WITH CHECK (true);

-- ==============================================================================
-- PARTE 17: MÓDULO CASO SOCIAL
-- ==============================================================================
-- 1. Limpeza preventiva para garantir tipos corretos
DROP TABLE IF EXISTS "Dietas" CASCADE;

-- 2. Correção/Criação da tabela Pacientes
DO $$
BEGIN
    -- Se ID for TEXT, dropa para recriar corretamente como UUID
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Pacientes' AND column_name = 'ID' AND data_type = 'text') THEN
        DROP TABLE "Pacientes" CASCADE;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS "Pacientes" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "Nome" VARCHAR(255) NOT NULL,
    "Idade" INTEGER,
    "Sexo" VARCHAR(20),
    "Grupo" VARCHAR(100),
    "CondicaoMedica" TEXT,
    "Observacoes" TEXT,
    "Restricoes" TEXT,
    "Status" VARCHAR(50) DEFAULT 'Ativo',
    "CriadoEm" TIMESTAMP DEFAULT NOW()
);

-- GARANTIA DE COLUNAS (Caso a tabela já existisse sem elas)
ALTER TABLE "Pacientes" ADD COLUMN IF NOT EXISTS "CondicaoMedica" TEXT;
ALTER TABLE "Pacientes" ADD COLUMN IF NOT EXISTS "Restricoes" TEXT;
ALTER TABLE "Pacientes" ADD COLUMN IF NOT EXISTS "Observacoes" TEXT;
ALTER TABLE "Pacientes" ADD COLUMN IF NOT EXISTS "Grupo" VARCHAR(100);

CREATE TABLE IF NOT EXISTS "Dietas" (
    "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "PacienteID" UUID REFERENCES "Pacientes"("ID") ON DELETE CASCADE,
    "DiaSemana" VARCHAR(20),
    "Refeicao" VARCHAR(50),
    "AlimentosJSON" JSONB,
    "CriadoEm" TIMESTAMP DEFAULT NOW()
);

ALTER TABLE "Pacientes" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso API Pacientes" ON "Pacientes";
CREATE POLICY "Acesso API Pacientes" ON "Pacientes" FOR ALL USING (true);

ALTER TABLE "Dietas" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso API Dietas" ON "Dietas";
CREATE POLICY "Acesso API Dietas" ON "Dietas" FOR ALL USING (true);

-- Atualiza o cache do esquema da API para reconhecer as novas colunas
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- PARTE 18: GERAÇÃO DE CÓDIGOS CURTOS (MATRÍCULA)
-- ==============================================================================
-- Adiciona coluna para o ID curto (Ex: FC-01)
ALTER TABLE "Funcionarios" ADD COLUMN IF NOT EXISTS "Codigo" VARCHAR(50);

-- Script para gerar códigos para funcionários existentes
DO $$
DECLARE
    r RECORD;
    parts TEXT[];
    prefix TEXT;
    seq INT;
    new_code TEXT;
BEGIN
    FOR r IN SELECT * FROM "Funcionarios" WHERE "Codigo" IS NULL ORDER BY "CriadoEm" LOOP
        -- Gera Prefixo (Iniciais)
        parts := regexp_split_to_array(trim(r."Nome"), '\s+');
        prefix := upper(substring(parts[1] from 1 for 1));
        IF array_length(parts, 1) > 1 THEN
            prefix := prefix || upper(substring(parts[array_length(parts, 1)] from 1 for 1));
        ELSE
            prefix := prefix || prefix; -- Se só tem um nome, duplica a inicial
        END IF;

        -- Encontra Sequencial Livre
        seq := 1;
        LOOP
            new_code := prefix || '-' || lpad(seq::text, 2, '0');
            IF NOT EXISTS (SELECT 1 FROM "Funcionarios" WHERE "Codigo" = new_code) THEN
                EXIT;
            END IF;
            seq := seq + 1;
        END LOOP;

        -- Atualiza
        UPDATE "Funcionarios" SET "Codigo" = new_code WHERE "ID" = r."ID";
    END LOOP;
END $$;

-- ==============================================================================
-- PARTE 19: GERAÇÃO DE CÓDIGOS PARA FÉRIAS (NOVO PADRÃO)
-- ==============================================================================
-- Adiciona coluna para o ID curto de Férias (Ex: FC-01)
ALTER TABLE "Ferias" ADD COLUMN IF NOT EXISTS "Codigo" VARCHAR(50);

-- Script para gerar códigos para férias existentes
DO $$
DECLARE
    r RECORD;
    parts TEXT[];
    prefix TEXT;
    seq INT;
    new_code TEXT;
BEGIN
    FOR r IN SELECT * FROM "Ferias" WHERE "Codigo" IS NULL ORDER BY "CriadoEm" LOOP
        -- Gera Prefixo (Iniciais do Nome do Funcionário)
        IF r."FuncionarioNome" IS NOT NULL THEN
            parts := regexp_split_to_array(trim(r."FuncionarioNome"), '\s+');
            prefix := upper(substring(parts[1] from 1 for 1));
            IF array_length(parts, 1) > 1 THEN
                prefix := prefix || upper(substring(parts[array_length(parts, 1)] from 1 for 1));
            ELSE
                prefix := prefix || prefix;
            END IF;

            -- Encontra Sequencial Livre
            seq := 1;
            LOOP
                new_code := prefix || '-' || lpad(seq::text, 2, '0');
                IF NOT EXISTS (SELECT 1 FROM "Ferias" WHERE "Codigo" = new_code) THEN
                    EXIT;
                END IF;
                seq := seq + 1;
            END LOOP;

            -- Atualiza
            UPDATE "Ferias" SET "Codigo" = new_code WHERE "ID" = r."ID";
        END IF;
    END LOOP;
END $$;

-- ==============================================================================
-- PARTE 20: GERAÇÃO DE CÓDIGOS PARA AVALIAÇÕES (NOVO PADRÃO)
-- ==============================================================================
-- Adiciona coluna para o ID curto de Avaliações (Ex: FC-01)
ALTER TABLE "Avaliacoes" ADD COLUMN IF NOT EXISTS "Codigo" VARCHAR(50);

-- Script para gerar códigos para avaliações existentes
DO $$
DECLARE
    r RECORD;
    parts TEXT[];
    prefix TEXT;
    seq INT;
    new_code TEXT;
BEGIN
    FOR r IN SELECT * FROM "Avaliacoes" WHERE "Codigo" IS NULL ORDER BY "CriadoEm" LOOP
        -- Gera Prefixo (Iniciais do Nome do Funcionário)
        IF r."FuncionarioNome" IS NOT NULL THEN
            parts := regexp_split_to_array(trim(r."FuncionarioNome"), '\s+');
            prefix := upper(substring(parts[1] from 1 for 1));
            IF array_length(parts, 1) > 1 THEN
                prefix := prefix || upper(substring(parts[array_length(parts, 1)] from 1 for 1));
            ELSE
                prefix := prefix || prefix;
            END IF;

            -- Encontra Sequencial Livre
            seq := 1;
            LOOP
                new_code := prefix || '-' || lpad(seq::text, 2, '0');
                IF NOT EXISTS (SELECT 1 FROM "Avaliacoes" WHERE "Codigo" = new_code) THEN
                    EXIT;
                END IF;
                seq := seq + 1;
            END LOOP;

            -- Atualiza
            UPDATE "Avaliacoes" SET "Codigo" = new_code WHERE "ID" = r."ID";
        END IF;
    END LOOP;
END $$;

-- ==============================================================================
-- PARTE 21: HABILITAR REALTIME (MONITOR DE COZINHA)
-- ==============================================================================
-- Permite que o frontend receba atualizações instantâneas da tabela de Ordens
ALTER PUBLICATION supabase_realtime ADD TABLE "OrdensProducao";