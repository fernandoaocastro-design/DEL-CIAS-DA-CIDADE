const { supabase } = require('./supabase');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const SECRET = process.env.JWT_SECRET || 'segredo-super-secreto-dev-change-me';

exports.handler = async (event) => {
    // Se o Supabase não foi iniciado, retorna erro amigável em vez de crashar (502)
    if (!supabase) {
        return {
            statusCode: 500,
            body: JSON.stringify({ success: false, message: 'Erro de Configuração do Banco de Dados.' })
        };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        // Headers para CORS (Permitir acesso do frontend)
        const headers = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        };

        const { action, table, data, id } = JSON.parse(event.body);
        let result;
        let error;
        let userSession = null;

        // --- 1. VERIFICAÇÃO DE SEGURANÇA (JWT) ---
        if (action !== 'login') {
            const token = event.headers.authorization ? event.headers.authorization.split(' ')[1] : null;
            if (!token) {
                return { statusCode: 401, headers, body: JSON.stringify({ success: false, message: 'Acesso Negado: Token não fornecido.' }) };
            }
            try {
                userSession = jwt.verify(token, SECRET);
            } catch (err) {
                return { statusCode: 401, headers, body: JSON.stringify({ success: false, message: 'Sessão Expirada. Faça login novamente.' }) };
            }
        }

        if (action === 'getAll') {
            // getAll genérico mantido para tabelas simples
            ({ data: result, error } = await supabase.from(table).select('*'));

        } else if (action === 'getMovimentacoesEstoque') {
            // PAGINAÇÃO OTIMIZADA COM FILTRO DE SUBTIPO (JOIN)
            const { page, limit, subtipo } = data;
            const from = (page - 1) * limit;
            const to = from + limit - 1;

            let query = supabase
                .from('MovimentacoesEstoque')
                .select('*, Estoque!inner(Nome, Subtipo)', { count: 'exact' })
                .order('Data', { ascending: false })
                .range(from, to);

            // Aplica filtro no lado do servidor (Performance)
            if (subtipo) {
                query = query.eq('Estoque.Subtipo', subtipo);
            }

            const { data: rows, count, error: err } = await query;
            if (err) throw err;
            result = { data: rows, total: count };

        } else if (action === 'getMovimentacoesStats') {
            // DADOS LEVES PARA O GRÁFICO (Últimos 6 meses)
            const sixMonthsAgo = new Date();
            sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
            
            const { data: stats, error: err } = await supabase
                .from('MovimentacoesEstoque')
                .select('Tipo, Quantidade, Data')
                .gte('Data', sixMonthsAgo.toISOString());
                
            if (err) throw err;
            result = stats;

        } else if (action === 'login') {
            const email = data.email ? data.email.trim() : '';
            const password = data.password ? data.password.trim() : '';

            // 1. Busca usuário pelo Email
            const { data: user, error: err } = await supabase
                .from('Usuarios')
                .select('*')
                .eq('Email', email) // O banco diferencia maiúsculas/minúsculas dependendo da configuração
                .maybeSingle(); // Usa maybeSingle para não dar erro se não achar ninguém
            
            if (err) {
                console.error('Erro Supabase:', err);
                throw new Error(`Erro no Banco: ${err.message}`);
            }
            
            // 2. Verifica se usuário existe e se a senha bate
            if (!user) throw new Error('Usuário não encontrado com este email.');
            if (user.Senha !== password) throw new Error('Senha incorreta.');
            
            // Segurança: Remover senha do objeto retornado
            delete user.Senha;
            
            // Gerar Token JWT
            const token = jwt.sign({ id: user.ID, email: user.Email, nome: user.Nome, cargo: user.Cargo }, SECRET, { expiresIn: '12h' });
            user.token = token; // Envia o token junto com os dados do usuário
            result = user;
        } else if (action === 'save') {
            const payload = { ...data };
            // Remove ID vazio para permitir inserção (Auto-Increment/UUID)
            if (!payload.ID) delete payload.ID;
            
            // Converte strings vazias para NULL (evita erro em campos de Data/Número)
            Object.keys(payload).forEach(key => {
                if (payload[key] === '') payload[key] = null;
            });
            
            // --- CÁLCULO AUTOMÁTICO DE FOLHA ---
            if (table === 'Folha') {
                const base = Number(payload.SalarioBase || 0);
                const bonus = Number(payload.Bonus || 0);
                const qtdHE = Number(payload.QtdHoraExtra || 0);
                const valHE = Number(payload.ValorHoraExtra || 0);
                const outrosV = Number(payload.OutrosVencimentos || 0);
                
                payload.TotalVencimentos = base + bonus + (qtdHE * valHE) + outrosV;

                const inss = Number(payload.INSS || 0);
                const irt = Number(payload.IRT || 0);
                const faltas = Number(payload.Faltas || 0);
                const outrosD = Number(payload.OutrosDescontos || 0);

                payload.TotalDescontos = inss + irt + faltas + outrosD;
                payload.SalarioLiquido = payload.TotalVencimentos - payload.TotalDescontos;
            }

            if (payload.ID) {
                ({ data: result, error } = await supabase.from(table).update(payload).eq('ID', payload.ID).select());
            } else {
                ({ data: result, error } = await supabase.from(table).insert(payload).select());
            }

            // --- LOG DE AUDITORIA ---
            if (!error && userSession) {
                await supabase.from('LogsAuditoria').insert({
                    UsuarioID: userSession.id,
                    UsuarioNome: userSession.nome,
                    Modulo: table,
                    Acao: payload.ID ? 'EDITAR' : 'CRIAR',
                    Descricao: `Registro ${payload.ID ? 'atualizado' : 'criado'} na tabela ${table}`,
                    DetalhesJSON: payload
                });
            }

            // --- NOTIFICAÇÃO AUTOMÁTICA (ESTOQUE) ---
            if (!error && table === 'Estoque' && result && result.length > 0) {
                const item = result[0];
                if (Number(item.Quantidade) <= Number(item.Minimo)) {
                    await supabase.from('Notificacoes').insert({
                        Mensagem: `⚠️ Estoque Baixo: ${item.Nome} atingiu ${item.Quantidade} ${item.Unidade} (Mínimo: ${item.Minimo})`
                    });
                }
                
                // Validade Crítica (Ao Salvar/Editar)
                if (item.Validade) {
                    const val = new Date(item.Validade);
                    const now = new Date();
                    const diff = Math.ceil((val - now) / (1000 * 60 * 60 * 24));
                    if (diff <= 30) {
                         await supabase.from('Notificacoes').insert({
                            Mensagem: `📅 Validade: ${item.Nome} vence em ${diff} dias (${item.Validade.split('T')[0]}).`,
                            Lida: false,
                            CriadoEm: new Date()
                        });
                    }
                }
            }
        } else if (action === 'registerStockMovement') {
            const { produtoId, tipo, quantidade, custo, responsavel, observacoes, detalhes } = data;
            
            // 1. Buscar produto atual
            const { data: produto, error: errProd } = await supabase.from('Estoque').select('*').eq('ID', produtoId).single();
            if (errProd || !produto) throw new Error('Produto não encontrado.');

            const qtdAtual = Number(produto.Quantidade || 0);
            const qtdMov = Number(quantidade);
            let novaQtd = qtdAtual;
            let novoCusto = Number(produto.CustoUnitario || 0);

            if (tipo === 'Entrada') {
                novaQtd += qtdMov;
                // Cálculo de Custo Médio Ponderado
                if (custo && Number(custo) > 0) {
                    const valorTotalAtual = qtdAtual * novoCusto;
                    const valorEntrada = qtdMov * Number(custo);
                    novoCusto = (valorTotalAtual + valorEntrada) / novaQtd;
                }
            } else if (tipo === 'Saida' || tipo === 'Perda') {
                if (qtdAtual < qtdMov) throw new Error('Estoque insuficiente para esta saída.');
                novaQtd -= qtdMov;
            }

            // 2. Atualizar Estoque
            const { error: errUpdate } = await supabase.from('Estoque').update({ 
                Quantidade: novaQtd, 
                CustoUnitario: novoCusto,
                UltimaAtualizacao: new Date()
            }).eq('ID', produtoId);
            if (errUpdate) throw new Error('Erro ao atualizar estoque.');

            // 3. Registrar Movimentação
            const { error: errMov } = await supabase.from('MovimentacoesEstoque').insert({
                ProdutoID: produtoId, Tipo: tipo, Quantidade: qtdMov, Responsavel: responsavel, Observacoes: observacoes, DetalhesJSON: detalhes,
                Data: new Date()
            });
            if (errMov) throw new Error('Erro ao registrar histórico.');

            // --- NOTIFICAÇÃO DE ESTOQUE BAIXO (REAL-TIME) ---
            if (novaQtd <= Number(produto.Minimo)) {
                await supabase.from('Notificacoes').insert({
                    Mensagem: `⚠️ Estoque Baixo: ${produto.Nome} atingiu ${novaQtd} ${produto.Unidade} (Mínimo: ${produto.Minimo})`,
                    Lida: false,
                    CriadoEm: new Date()
                });
            }

            result = { success: true };
        } else if (action === 'settleAccount') {
            // BAIXAR CONTA (Integração Contas -> Fluxo de Caixa)
            const { id, table, dataPagamento, valorPago, metodo } = data;
            const isReceber = table === 'ContasReceber';
            
            // 1. Buscar a conta original
            const { data: conta, error: errConta } = await supabase.from(table).select('*').eq('ID', id).single();
            if (errConta || !conta) throw new Error('Conta não encontrada.');

            // Validação: Impede pagamento duplicado
            if (conta.Status === 'Pago' || conta.Status === 'Recebido') {
                throw new Error('Esta conta já foi liquidada anteriormente.');
            }

            // 2. Atualizar status da conta para Pago/Recebido
            const novoStatus = isReceber ? 'Recebido' : 'Pago';
            const { error: errUpdate } = await supabase.from(table).update({ 
                Status: novoStatus,
                // Poderíamos salvar data de pagamento real na tabela de contas também se quisesse
            }).eq('ID', id);
            if (errUpdate) throw new Error('Erro ao atualizar status da conta.');

            // 3. Lançar no Fluxo de Caixa (Financas)
            const lancamento = {
                Data: dataPagamento || new Date(),
                Tipo: isReceber ? 'Receita' : 'Despesa',
                Valor: valorPago || conta.ValorTotal,
                Categoria: conta.Categoria, // Herda a categoria
                Subcategoria: 'Baixa de Conta',
                Descricao: `${isReceber ? 'Recebimento' : 'Pagamento'}: ${conta.Descricao} (${conta.Cliente || conta.Fornecedor})`,
                Status: 'Pago', // No fluxo de caixa já entra como realizado
                MetodoPagamento: metodo || conta.FormaPagamento,
                ReferenciaID: id
            };

            const { error: errFin } = await supabase.from('Financas').insert(lancamento);
            if (errFin) throw new Error('Erro ao lançar no fluxo de caixa.');

            result = { success: true };
        } else if (action === 'saveInventario') {
            // Salvar Bem Patrimonial com Histórico
            const payload = { ...data };
            const userAction = payload.UserAction || 'Sistema'; // Quem está operando
            delete payload.UserAction;
            
            let bemID;
            
            if (payload.ID) {
                // Edição
                bemID = payload.ID;
                const { error: errUp } = await supabase.from('Inventario').update(payload).eq('ID', bemID);
                if (errUp) throw errUp;
                
                // Registrar Histórico
                await supabase.from('HistoricoInventario').insert({
                    BemID: bemID, TipoAcao: 'Edição', Descricao: 'Atualização de dados do bem', ResponsavelAcao: userAction, DetalhesJSON: payload
                });
            } else {
                // Novo Cadastro
                // Gerar Código Automático se não vier (Simples: Timestamp ou Serial no banco seria melhor, aqui via JS)
                if(!payload.Codigo) payload.Codigo = `INV-${Date.now().toString().slice(-6)}`;
                
                // CORREÇÃO DEFINITIVA: Gerar UUID manualmente se não vier, garantindo que nunca seja NULL
                if (!payload.ID) {
                    payload.ID = crypto.randomUUID();
                }

                const { data: newBem, error: errIns } = await supabase.from('Inventario').insert(payload).select().single();
                if (errIns) throw errIns;
                bemID = newBem.ID;

                await supabase.from('HistoricoInventario').insert({
                    BemID: bemID, TipoAcao: 'Cadastro', Descricao: 'Bem registrado no sistema', ResponsavelAcao: userAction
                });
            }
            result = { success: true };
        } else if (action === 'updateProfile') {
            const { id, nome, email, senhaAtual, novaSenha, assinatura } = data;
            
            // Verifica senha atual
            const { data: user, error: errUser } = await supabase.from('Usuarios').select('*').eq('ID', id).single();
            if (errUser || !user) throw new Error('Usuário não encontrado.');
            if (user.Senha !== senhaAtual) throw new Error('Senha atual incorreta.');

            const updates = { Nome: nome, Email: email, Assinatura: assinatura, Permissoes: user.Permissoes }; // Mantém permissões antigas ao editar perfil próprio
            if (novaSenha) updates.Senha = novaSenha;

            ({ data: result, error } = await supabase.from('Usuarios').update(updates).eq('ID', id).select());

        } else if (action === 'completeProductionOrder') {
            const { id } = data; // ID da Ordem
            
            // OTIMIZAÇÃO: Chama a Stored Procedure no banco para processar tudo de uma vez (Performance N+1 resolvida)
            // Isso substitui as dezenas de chamadas de leitura e escrita por uma única transação atômica.
            const { error } = await supabase.rpc('complete_production_order', { p_order_id: id });
            
            if (error) throw new Error(error.message);

            result = { success: true };

        } else if (action === 'saveIngredientConsumption') {
            const { ProdutoID, ProdutoNome, Quantidade, OrdemID, Responsavel } = data;
            const qtd = Number(Quantidade);

            if (qtd <= 0) throw new Error('Quantidade deve ser maior que zero.');

            // 1. Verificar Estoque
            const { data: itemEstoque, error: errEstoque } = await supabase.from('Estoque').select('*').eq('ID', ProdutoID).single();
            if (errEstoque || !itemEstoque) throw new Error('Produto não encontrado no estoque.');

            if (Number(itemEstoque.Quantidade) < qtd) {
                throw new Error(`Estoque insuficiente. Disponível: ${itemEstoque.Quantidade}`);
            }

            // 2. Baixar Estoque
            const novaQtd = Number(itemEstoque.Quantidade) - qtd;
            const { error: errUpdate } = await supabase.from('Estoque').update({ Quantidade: novaQtd }).eq('ID', ProdutoID);
            if (errUpdate) throw new Error('Erro ao atualizar estoque.');

            // 3. Registrar Movimentação (Saída)
            await supabase.from('MovimentacoesEstoque').insert({
                ProdutoID: ProdutoID,
                Tipo: 'Saida',
                Quantidade: qtd,
                Responsavel: Responsavel || 'Sistema',
                Observacoes: OrdemID ? `Consumo Manual OP` : 'Consumo Manual Produção',
                DetalhesJSON: { OrdemID: OrdemID },
                Data: new Date()
            });

            // 4. Registrar ConsumoIngredientes
            const { error: errConsumo } = await supabase.from('ConsumoIngredientes').insert({
                OrdemID: OrdemID || null,
                ProdutoID: ProdutoID,
                ProdutoNome: ProdutoNome || itemEstoque.Nome,
                Quantidade: qtd,
                Responsavel: Responsavel
            });
            if (errConsumo) throw new Error('Erro ao registrar consumo.');

            result = { success: true };

        } else if (action === 'savePurchaseOrder') {
            const { Solicitante, ValorTotal, Status, Itens } = data;

            // 1. Criar o Pedido
            const { data: pedido, error: errPedido } = await supabase.from('PedidosCompra').insert({
                Solicitante, ValorTotal, Status
            }).select().single();

            if (errPedido) throw new Error('Erro ao criar pedido: ' + errPedido.message);

            // 2. Inserir Itens
            const itensParaInserir = Itens.map(item => ({
                PedidoID: pedido.ID,
                ProdutoNome: item.name,
                Quantidade: item.qty,
                CustoUnitario: item.price,
                Subtotal: item.total,
                Observacao: item.obs
            }));

            const { error: errItens } = await supabase.from('ItensPedidoCompra').insert(itensParaInserir);
            if (errItens) throw new Error('Erro ao salvar itens do pedido: ' + errItens.message);

            result = { success: true, pedidoId: pedido.ID };

        } else if (action === 'getPurchaseOrderDetails') {
            const { id } = data;
            const { data: itens, error } = await supabase.from('ItensPedidoCompra').select('*').eq('PedidoID', id);
            if (error) throw error;
            result = itens;

        } else if (action === 'getMLPainRecords') {
            // Otimização Frontend: Baixa apenas o mês selecionado
            const { month, startDate, endDate } = data;
            let start, end;

            if (month) { // Formato 'YYYY-MM'
                start = `${month}-01`;
                const [y, m] = month.split('-');
                end = new Date(y, m, 0).toISOString().split('T')[0]; // Último dia do mês
            } else if (startDate && endDate) {
                start = startDate;
                end = endDate;
            } else {
                throw new Error('Parâmetros insuficientes para getMLPainRecords. Forneça "month" ou "startDate" e "endDate".');
            }
            
            ({ data: result, error } = await supabase
                .from('MLPain_Registros')
                .select('*')
                .gte('Data', start)
                .lte('Data', end)
                .order('Data', { ascending: true }));

        } else if (action === 'getDietStats') {
            const date = (data && data.date) ? data.date : new Date().toISOString().split('T')[0];
            
            // Otimização: Processamento via RPC no Banco de Dados
            const { data: stats, error: err } = await supabase
                .rpc('get_estatisticas_dietas', { data_consulta: date });
            
            if (err) throw err;
            result = stats;

        } else if (action === 'getProductHistory') {
            const { id } = data;
            
            // 1. Movimentações de Estoque (Físico: Entradas/Saídas)
            const { data: movs, error: errMov } = await supabase
                .from('MovimentacoesEstoque')
                .select('*')
                .eq('ProdutoID', id)
                .order('Data', { ascending: false })
                .limit(50);
                
            if (errMov) throw errMov;

            // 2. Logs de Auditoria (Sistema: Edições de Cadastro)
            const { data: logs, error: errLog } = await supabase
                .from('LogsAuditoria')
                .select('*')
                .eq('Modulo', 'Estoque')
                .contains('DetalhesJSON', { ID: id }) // Filtra logs onde o JSON contém o ID do produto
                .order('CriadoEm', { ascending: false })
                .limit(20);

            if (errLog) throw errLog;

            result = { movs, logs };

        } else if (action === 'checkExpirationAlerts') {
            // AÇÃO AUTOMÁTICA: Verifica produtos vencendo em 30 dias
            const today = new Date();
            const thirtyDaysFromNow = new Date();
            thirtyDaysFromNow.setDate(today.getDate() + 30);
            
            // Busca itens com validade definida e próxima
            const { data: items, error } = await supabase
                .from('Estoque')
                .select('ID, Nome, Validade, Lote')
                .not('Validade', 'is', null)
                .lte('Validade', thirtyDaysFromNow.toISOString());

            if (error) throw error;

            let count = 0;
            for (const item of items) {
                // Verifica se já existe notificação NÃO LIDA para este item (evita spam)
                const { data: existing } = await supabase
                    .from('Notificacoes')
                    .select('ID')
                    .ilike('Mensagem', `%${item.Nome}%`)
                    .ilike('Mensagem', '%validade%')
                    .eq('Lida', false)
                    .limit(1);

                if (!existing || existing.length === 0) {
                    const days = Math.ceil((new Date(item.Validade) - today) / (1000 * 60 * 60 * 24));
                    const status = days < 0 ? 'VENCIDO' : 'Vencendo';
                    
                    await supabase.from('Notificacoes').insert({
                        Mensagem: `📅 Validade: ${item.Nome} (Lote: ${item.Lote || '-'}) está ${status} em ${days} dias.`,
                        Lida: false,
                        CriadoEm: new Date()
                    });
                    count++;
                }
            }
            result = { success: true, alertsGenerated: count };

        } else if (action === 'getFinancialDashboard') {
            const { startDate, endDate } = data || {};
            
            // Define período (Padrão: Mês atual)
            const now = new Date();
            const start = startDate || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
            const end = endDate || new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

            // 1. Buscar Transações (Receitas e Despesas)
            const { data: financas, error: errFin } = await supabase
                .from('Financas')
                .select('*')
                .gte('Data', start)
                .lte('Data', end)
                .order('Data', { ascending: true });

            if (errFin) throw errFin;

            // 2. Buscar Contas Pendentes (Global, para análise de fluxo futuro/atrasado)
            const { data: contasPagar, error: errCP } = await supabase.from('ContasPagar').select('*').neq('Status', 'Pago');
            const { data: contasReceber, error: errCR } = await supabase.from('ContasReceber').select('*').neq('Status', 'Recebido');

            // 3. Buscar Metas do Mês
            const monthKey = start.substring(0, 7); // Extrai YYYY-MM
            const { data: meta } = await supabase.from('MetasFinanceiras').select('*').eq('Mes', monthKey).maybeSingle();

            if (errCP || errCR) throw new Error('Erro ao buscar contas pendentes.');

            // Processamento dos Dados
            let receitaTotal = 0;
            let despesaTotal = 0;
            const despesasPorCategoria = {};
            const fluxoDiario = {};

            financas.forEach(f => {
                const val = Number(f.Valor || 0);
                const dia = f.Data.split('T')[0];

                if (!fluxoDiario[dia]) fluxoDiario[dia] = { receita: 0, despesa: 0, saldo: 0 };

                if (f.Tipo === 'Receita') {
                    receitaTotal += val;
                    fluxoDiario[dia].receita += val;
                } else {
                    despesaTotal += val;
                    fluxoDiario[dia].despesa += val;
                    
                    // Categorização
                    const cat = f.Categoria || 'Outros';
                    despesasPorCategoria[cat] = (despesasPorCategoria[cat] || 0) + val;
                }
                fluxoDiario[dia].saldo = fluxoDiario[dia].receita - fluxoDiario[dia].despesa;
            });

            // Processamento de Contas (KPIs de Liquidez)
            const hoje = new Date().toISOString().split('T')[0];
            const aPagarTotal = contasPagar.reduce((acc, c) => acc + Number(c.ValorTotal), 0);
            const aReceberTotal = contasReceber.reduce((acc, c) => acc + Number(c.ValorTotal), 0);
            
            const aPagarAtrasado = contasPagar.filter(c => c.Vencimento < hoje).reduce((acc, c) => acc + Number(c.ValorTotal), 0);
            const aReceberAtrasado = contasReceber.filter(c => c.Vencimento < hoje).reduce((acc, c) => acc + Number(c.ValorTotal), 0);

            result = {
                periodo: { start, end },
                resumo: {
                    receita: receitaTotal,
                    despesa: despesaTotal,
                    saldo: receitaTotal - despesaTotal,
                    lucratividade: receitaTotal > 0 ? ((receitaTotal - despesaTotal) / receitaTotal) * 100 : 0,
                    meta: {
                        receitaEsperada: meta ? Number(meta.ReceitaEsperada) : 0,
                        despesaMaxima: meta ? Number(meta.DespesaMaxima) : 0,
                        atingido: meta && Number(meta.ReceitaEsperada) > 0 ? (receitaTotal / Number(meta.ReceitaEsperada)) * 100 : 0
                    }
                },
                pendencias: {
                    aPagar: aPagarTotal,
                    aReceber: aReceberTotal,
                    aPagarAtrasado,
                    aReceberAtrasado
                },
                graficos: {
                    fluxoDiario: Object.entries(fluxoDiario).map(([date, vals]) => ({ date, ...vals })).sort((a, b) => a.date.localeCompare(b.date)),
                    despesasCategoria: Object.entries(despesasPorCategoria).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
                }
            };

        } else if (action === 'getDRE') {
            const { startDate, endDate } = data;
            
            // Busca todas as transações do período
            const { data: financas, error } = await supabase
                .from('Financas')
                .select('*')
                .gte('Data', startDate)
                .lte('Data', endDate);
            
            if (error) throw error;

            // Estrutura do DRE
            const dre = {
                receitaBruta: 0,
                impostos: 0, // Deduções
                custosVariaveis: 0, // CMV / Insumos
                despesasPessoal: 0,
                despesasAdministrativas: 0,
                despesasFinanceiras: 0,
                outrasReceitas: 0
            };

            financas.forEach(f => {
                const val = Number(f.Valor || 0);
                const cat = (f.Categoria || '').toLowerCase();
                const tipo = f.Tipo;

                if (tipo === 'Receita') {
                    // Classificação simples baseada em palavras-chave se não houver plano de contas estrito
                    if (cat.includes('venda') || cat.includes('serviço') || cat.includes('evento')) dre.receitaBruta += val;
                    else dre.outrasReceitas += val;
                } else {
                    // Despesas
                    if (cat.includes('imposto') || cat.includes('taxa') || cat.includes('tributo')) dre.impostos += val;
                    else if (cat.includes('fornecedor') || cat.includes('estoque') || cat.includes('insumo') || cat.includes('cmv') || cat.includes('compra')) dre.custosVariaveis += val;
                    else if (cat.includes('salário') || cat.includes('folha') || cat.includes('pessoal') || cat.includes('benefício') || cat.includes('funcionário')) dre.despesasPessoal += val;
                    else if (cat.includes('juros') || cat.includes('banco') || cat.includes('multa') || cat.includes('financeir')) dre.despesasFinanceiras += val;
                    else dre.despesasAdministrativas += val; // Restante (Aluguel, Energia, Água, etc)
                }
            });
            
            result = dre;

        } else if (action === 'getProjectedCashFlow') {
            const { startDate, endDate } = data;
            
            // 1. Saldo Atual Real (Caixa + Bancos)
            const { data: allFinancas, error: errFin } = await supabase.from('Financas').select('Tipo, Valor');
            if (errFin) throw errFin;

            let saldoAtual = 0;
            allFinancas.forEach(f => {
                saldoAtual += f.Tipo === 'Receita' ? Number(f.Valor) : -Number(f.Valor);
            });

            // 2. Buscar Previsões (Contas Abertas)
            const { data: aReceber } = await supabase.from('ContasReceber')
                .select('DataVencimento, ValorTotal, Cliente')
                .neq('Status', 'Recebido')
                .gte('DataVencimento', startDate)
                .lte('DataVencimento', endDate);

            const { data: aPagar } = await supabase.from('ContasPagar')
                .select('DataVencimento, ValorTotal, Fornecedor')
                .neq('Status', 'Pago')
                .gte('DataVencimento', startDate)
                .lte('DataVencimento', endDate);

            // 3. Construir Projeção
            const mapDia = {};
            const add = (date, val, type) => {
                const d = date.split('T')[0];
                if (!mapDia[d]) mapDia[d] = { entradas: 0, saidas: 0 };
                if (type === 'R') mapDia[d].entradas += val;
                else mapDia[d].saidas += val;
            };

            (aReceber || []).forEach(r => add(r.DataVencimento, Number(r.ValorTotal), 'R'));
            (aPagar || []).forEach(p => add(p.DataVencimento, Number(p.ValorTotal), 'P'));

            const sortedDates = Object.keys(mapDia).sort();
            const projection = [];
            let saldoAcumulado = saldoAtual;

            // Adiciona o dia inicial (hoje)
            projection.push({ data: new Date().toISOString().split('T')[0], saldo: saldoAtual, entradas: 0, saidas: 0 });

            sortedDates.forEach(date => {
                const day = mapDia[date];
                saldoAcumulado += (day.entradas - day.saidas);
                projection.push({ data: date, saldo: saldoAcumulado, entradas: day.entradas, saidas: day.saidas });
            });

            result = { saldoAtual, projection };

        } else if (action === 'getABCCurve') {
            // 1. Buscar Movimentações de Saída (Consumo) dos últimos 90 dias
            const ninetyDaysAgo = new Date();
            ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
            
            const { data: movs, error: errMov } = await supabase
                .from('MovimentacoesEstoque')
                .select('ProdutoID, Quantidade')
                .eq('Tipo', 'Saida')
                .gte('Data', ninetyDaysAgo.toISOString());
            
            if (errMov) throw errMov;

            // 2. Buscar Dados Atuais dos Produtos (Custo)
            const { data: produtos, error: errProd } = await supabase
                .from('Estoque')
                .select('ID, Nome, CustoUnitario, Unidade');
            
            if (errProd) throw errProd;

            // 3. Calcular Consumo Total por Produto
            const consumoMap = {};
            movs.forEach(m => {
                if (!consumoMap[m.ProdutoID]) consumoMap[m.ProdutoID] = 0;
                consumoMap[m.ProdutoID] += Number(m.Quantidade);
            });

            // 4. Calcular Valor Total e Classificar
            let lista = [];
            let valorTotalGeral = 0;

            produtos.forEach(p => {
                const qtd = consumoMap[p.ID] || 0;
                const valor = qtd * Number(p.CustoUnitario || 0);
                if (valor > 0) {
                    lista.push({ ...p, consumoQtd: qtd, valorTotal: valor });
                    valorTotalGeral += valor;
                }
            });

            // Ordenar do maior valor para o menor
            lista.sort((a, b) => b.valorTotal - a.valorTotal);

            // Classificação ABC
            let acumulado = 0;
            lista = lista.map(item => {
                acumulado += item.valorTotal;
                const percent = (acumulado / valorTotalGeral) * 100;
                let classe = 'C';
                if (percent <= 80) classe = 'A';
                else if (percent <= 95) classe = 'B';
                
                return { ...item, classe, percentAcumulado: percent };
            });

            result = { lista, valorTotalGeral };

        } else if (action === 'getDeadStock') {
            // RELATÓRIO DE ESTOQUE PARADO (SEM GIRO)
            const days = data.days || 90;
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - days);

            // 1. Buscar itens com saldo em estoque
            const { data: items, error: errItems } = await supabase
                .from('Estoque')
                .select('ID, Nome, Quantidade, Unidade, CustoUnitario, UltimaAtualizacao')
                .gt('Quantidade', 0);

            if (errItems) throw errItems;

            // 2. Buscar movimentações de SAÍDA no período
            const { data: movs, error: errMovs } = await supabase
                .from('MovimentacoesEstoque')
                .select('ProdutoID')
                .eq('Tipo', 'Saida')
                .gte('Data', cutoffDate.toISOString());

            if (errMovs) throw errMovs;

            const activeProductIds = new Set(movs.map(m => m.ProdutoID));

            // 3. Filtrar itens que NÃO tiveram saída
            const deadStock = items.filter(i => !activeProductIds.has(i.ID));
            const totalValue = deadStock.reduce((acc, i) => acc + (Number(i.Quantidade) * Number(i.CustoUnitario)), 0);

            result = { items: deadStock, totalValue, count: deadStock.length, days };

        } else if (action === 'getPurchaseForecast') {
            // PREVISÃO DE COMPRAS (Baseada em Consumo Médio)
            const daysAnalysis = 30; // Analisa últimos 30 dias
            const daysSafety = 15;   // Margem de segurança desejada (dias de estoque)
            
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysAnalysis);

            // 1. Buscar Estoque Atual
            const { data: items, error: errItems } = await supabase.from('Estoque').select('ID, Nome, Quantidade, Unidade, Minimo, Fornecedor');
            if (errItems) throw errItems;

            // 2. Buscar Consumo (Saídas)
            const { data: movs, error: errMovs } = await supabase
                .from('MovimentacoesEstoque')
                .select('ProdutoID, Quantidade')
                .eq('Tipo', 'Saida')
                .gte('Data', cutoffDate.toISOString());
            if (errMovs) throw errMovs;

            // 3. Calcular Médias e Sugestões
            const consumptionMap = {};
            movs.forEach(m => consumptionMap[m.ProdutoID] = (consumptionMap[m.ProdutoID] || 0) + Number(m.Quantidade));

            const forecast = items.map(item => {
                const totalConsumed = consumptionMap[item.ID] || 0;
                const avgDaily = totalConsumed / daysAnalysis;
                const currentStock = Number(item.Quantidade || 0);
                
                // Dias que o estoque atual dura
                const daysRemaining = avgDaily > 0 ? currentStock / avgDaily : (currentStock > 0 ? 999 : 0);
                
                // Sugestão: Se durar menos que a margem de segurança, sugere compra para completar 30 dias
                let suggestedQty = 0;
                if (daysRemaining < daysSafety || currentStock <= Number(item.Minimo)) {
                    suggestedQty = (avgDaily * 30) - currentStock;
                    if (suggestedQty < 0) suggestedQty = 0;
                }

                return {
                    ...item,
                    avgDaily,
                    daysRemaining,
                    suggestedQty: Math.ceil(suggestedQty)
                };
            }).filter(i => i.suggestedQty > 0).sort((a,b) => a.daysRemaining - b.daysRemaining);

            result = forecast;

        } else if (action === 'getClientABC') {
            // CURVA ABC DE CLIENTES (Baseado em Eventos)
            const { data: eventos, error } = await supabase
                .from('Eventos')
                .select('Cliente, Valor')
                .neq('Status', 'Cancelado')
                .not('Cliente', 'is', null);

            if (error) throw error;

            // Agrupar por Cliente
            const clientMap = {};
            let totalRevenue = 0;

            eventos.forEach(e => {
                const name = e.Cliente.trim();
                if (!name) return;
                if (!clientMap[name]) clientMap[name] = 0;
                const val = Number(e.Valor || 0);
                clientMap[name] += val;
                totalRevenue += val;
            });

            // Converter para Array e Ordenar
            let clients = Object.entries(clientMap).map(([name, value]) => ({ name, value }));
            clients.sort((a, b) => b.value - a.value);

            // Classificação ABC
            let accumulated = 0;
            clients = clients.map(c => {
                accumulated += c.value;
                const percent = totalRevenue > 0 ? (accumulated / totalRevenue) * 100 : 0;
                let classe = 'C';
                if (percent <= 80) classe = 'A';
                else if (percent <= 95) classe = 'B';
                return { ...c, classe, percent: (c.value / totalRevenue) * 100 };
            });

            result = { clients, totalRevenue };

        } else if (action === 'getSalesByDayOfWeek') {
            // VENDAS POR DIA DA SEMANA (Baseado em Eventos)
            const { data: eventos, error } = await supabase
                .from('Eventos')
                .select('Data, Valor')
                .neq('Status', 'Cancelado');

            if (error) throw error;

            const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
            const totals = new Array(7).fill(0);
            const counts = new Array(7).fill(0);

            eventos.forEach(e => {
                if (e.Data) {
                    const d = new Date(e.Data);
                    const dayIdx = d.getUTCDay(); // 0 (Domingo) - 6 (Sábado)
                    totals[dayIdx] += Number(e.Valor || 0);
                    counts[dayIdx]++;
                }
            });

            result = days.map((name, i) => ({ day: name, total: totals[i], count: counts[i] }));

        } else if (action === 'getWaiterSales') {
            // RELATÓRIO DE VENDAS POR GARÇOM (COMISSÕES)
            const { startDate, endDate } = data;
            
            const { data: eventos, error } = await supabase
                .from('Eventos')
                .select('Responsavel, Valor, Data, Titulo')
                .neq('Status', 'Cancelado')
                .gte('Data', startDate)
                .lte('Data', endDate)
                .not('Responsavel', 'is', null);

            if (error) throw error;

            const salesMap = {};
            eventos.forEach(e => {
                const resp = e.Responsavel;
                if (!salesMap[resp]) salesMap[resp] = { total: 0, count: 0, events: [] };
                salesMap[resp].total += Number(e.Valor || 0);
                salesMap[resp].count++;
                salesMap[resp].events.push(e);
            });

            result = Object.entries(salesMap).map(([name, stats]) => ({
                name,
                total: stats.total,
                count: stats.count,
                commission: stats.total * 0.10 // 10% padrão (pode ser parametrizado depois)
            })).sort((a, b) => b.total - a.total);

        } else if (action === 'getChecklist') {
            const { date } = data;
            const { data: items, error } = await supabase
                .from('ChecklistLimpeza')
                .select('*')
                .eq('Data', date);
            if (error) throw error;
            result = items;

        } else if (action === 'saveChecklist') {
            // Salva múltiplos itens de uma vez
            const { items } = data;
            if (items && items.length > 0) {
                const { error } = await supabase.from('ChecklistLimpeza').upsert(items);
                if (error) throw error;
            }
            result = { success: true };

        } else if (action === 'recalculateLoyalty') {
            // 1. Buscar todos os clientes
            const { data: clients, error: errClients } = await supabase.from('Clientes').select('*');
            if (errClients) throw errClients;

            // 2. Buscar todos os eventos (vendas)
            const { data: events, error: errEvents } = await supabase.from('Eventos').select('Cliente, Valor, Data').neq('Status', 'Cancelado');
            if (errEvents) throw errEvents;

            // 3. Processar Pontos (1 Ponto a cada 1000 Kz)
            for (const client of clients) {
                const clientEvents = events.filter(e => e.Cliente && e.Cliente.toLowerCase().trim() === client.Nome.toLowerCase().trim());
                
                const totalGasto = clientEvents.reduce((acc, e) => acc + Number(e.Valor || 0), 0);
                const pontos = Math.floor(totalGasto / 1000); 
                
                // Encontrar última compra
                let lastDate = null;
                if (clientEvents.length > 0) {
                    clientEvents.sort((a,b) => new Date(b.Data) - new Date(a.Data));
                    lastDate = clientEvents[0].Data;
                }

                await supabase.from('Clientes').update({
                    Pontos: pontos,
                    TotalGasto: totalGasto,
                    UltimaCompra: lastDate
                }).eq('ID', client.ID);
            }
            result = { success: true };

        } else if (action === 'getTasks') {
            ({ data: result, error } = await supabase.from('Tarefas').select('*').order('Status', { ascending: false }).order('Prazo', { ascending: true }));
        } else if (action === 'getChatMessages') {
            ({ data: result, error } = await supabase.from('ChatMessages').select('*').order('Timestamp', { ascending: false }).limit(50));
        } else if (action === 'sendChatMessage') {
            ({ data: result, error } = await supabase.from('ChatMessages').insert(data));
        } else if (action === 'getDashboardStats') {
            // Agregação de dados para o Dashboard Principal
            const today = new Date().toISOString().split('T')[0];
            const startOfMonth = new Date().toISOString().slice(0, 7) + '-01';
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
            const strSevenDaysAgo = sevenDaysAgo.toISOString().split('T')[0];
            
            // Otimização: Buscar apenas finanças dos últimos 12 meses para não pesar o sistema
            const d = new Date();
            d.setMonth(d.getMonth() - 11);
            d.setDate(1);
            const startOfFinanceData = d.toISOString().split('T')[0];

            // Consultas Paralelas
            const [
                resClientes,
                resPratosData,
                resFuncionarios,
                resFornecedores,
                resFinancas,
                resAniversariantes,
                resFerias,
                resEstoque,
                resEventos,
                resRefeicoes,
                resRefeicoesMes,
                resOrdensAbertas
            ] = await Promise.all([
                supabase.from('Usuarios').select('*', { count: 'exact', head: true }), // Simulando Clientes com Usuarios por enquanto ou criar tabela Clientes
                supabase.from('FichasTecnicas').select('Categoria', { count: 'exact' }),
                supabase.from('Funcionarios').select('*', { count: 'exact', head: true }).eq('Status', 'Ativo'),
                supabase.from('Fornecedores').select('*', { count: 'exact', head: true }).eq('Status', 'Ativo'),
                supabase.from('Financas').select('*').gte('Data', startOfFinanceData),
                supabase.from('Funcionarios').select('Nome, Nascimento, Admissao'), // Para filtrar aniversariantes e jubileu
                supabase.from('Ferias').select('*').eq('Status', 'Aprovado'),
                supabase.from('Estoque').select('Nome, Quantidade, Minimo'),
                supabase.from('Eventos').select('*').gte('Data', today).neq('Status', 'Cancelado').order('Data', { ascending: true }).limit(5),
                supabase.rpc('get_refeicoes_grafico', { data_inicio: strSevenDaysAgo }),
                supabase.rpc('get_total_refeicoes_mes', { data_inicio: startOfMonth }),
                supabase.from('OrdensProducao').select('Codigo, Status, Responsavel').neq('Status', 'Concluída'),
                supabase.from('QuadroAvisos').select('*').order('CriadoEm', { ascending: false }).limit(5)
            ]);

            // Extração segura de dados (evita crash se houver erro no banco)
            const totalClientes = resClientes.count || 0;
            const totalProdutos = resPratosData.count || 0;
            const totalFuncionarios = resFuncionarios.count || 0;
            const totalFornecedores = resFornecedores.count || 0;
            const totalRefeicoes = resRefeicoesMes.data || 0;
            const financas = resFinancas.data || [];
            const aniversariantes = resAniversariantes.data || [];
            const ferias = resFerias.data || [];
            const estoqueBaixo = resEstoque.data || [];
            const pratos = resPratosData.data || [];
            const eventosProximos = resEventos.data || [];
            const refeicoesData = resRefeicoes.data || [];
            const ordensPendentes = resOrdensAbertas.data || [];
            const avisos = resOrdensAbertas.data ? (await resOrdensAbertas) : []; // Correção: O Promise.all retorna array, o índice 12 é o novo
            const quadroAvisos = (await supabase.from('QuadroAvisos').select('*').order('CriadoEm', { ascending: false }).limit(5)).data || [];

            // Processamento Financeiro (DRE e KPIs)
            let receitaMensal = 0, despesaMensal = 0, aReceberHoje = 0, aPagarHoje = 0;
            let receitaBruta = 0, impostos = 0, cmv = 0, despOp = 0;

            financas.forEach(f => {
                const val = Number(f.Valor);
                const isMonth = f.Data >= startOfMonth;
                const isToday = f.Data === today;

                if (f.Tipo === 'Receita') {
                    if (isMonth) { receitaMensal += val; receitaBruta += val; }
                    if (isToday && f.Status === 'Pendente') aReceberHoje += val;
                } else if (f.Tipo === 'Despesa') {
                    if (isMonth) { despesaMensal += val; }
                    if (isToday && f.Status === 'Pendente') aPagarHoje += val;
                    
                    // Categorização simplificada para DRE
                    if (f.Categoria === 'Impostos') impostos += val;
                    else if (f.Categoria === 'CMV' || f.Categoria === 'Estoque') cmv += val;
                    else despOp += val;
                }
            });

            // Filtros de Monitoramento
            const month = new Date().getMonth() + 1;
            const day = new Date().getDate();
            const aniversariantesDia = aniversariantes.filter(f => {
                if(!f.Nascimento) return false;
                const d = new Date(f.Nascimento);
                return (d.getMonth() + 1) === month && (d.getDate()) === day;
            });
            
            const jubileuDia = aniversariantes.filter(f => {
                if(!f.Admissao) return false;
                const d = new Date(f.Admissao);
                // Verifica se é o mesmo dia e mês, mas ano diferente
                return (d.getMonth() + 1) === month && (d.getDate()) === day && d.getFullYear() < new Date().getFullYear();
            }).map(f => ({ ...f, Anos: new Date().getFullYear() - new Date(f.Admissao).getFullYear() }));

            const estoqueCritico = estoqueBaixo.filter(e => e.Quantidade <= e.Minimo);

            // Dados para Gráficos
            // 1. Tendência Financeira (Últimos 6 meses)
            const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
            const finMap = {};
            financas.forEach(f => {
                if (!f.Data) return;
                const d = new Date(f.Data);
                const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                if(!finMap[key]) finMap[key] = { r: 0, d: 0 };
                if(f.Tipo === 'Receita') finMap[key].r += Number(f.Valor);
                else finMap[key].d += Number(f.Valor);
            });

            // 1.1 Fluxo de Caixa Diário (Mês Atual)
            const dailyFlow = {};
            const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
            for(let i=1; i<=daysInMonth; i++) dailyFlow[i] = { r: 0, d: 0 };

            financas.forEach(f => {
                if (f.Data >= startOfMonth && f.Data <= today) {
                    const d = new Date(f.Data).getDate();
                    if(dailyFlow[d]) {
                        if(f.Tipo === 'Receita') dailyFlow[d].r += Number(f.Valor);
                        else dailyFlow[d].d += Number(f.Valor);
                    }
                }
            });
            
            const sortedKeys = Object.keys(finMap).sort().slice(-6);
            const chartFin = {
                labels: sortedKeys.map(k => months[parseInt(k.split('-')[1]) - 1]),
                receitas: sortedKeys.map(k => finMap[k].r),
                despesas: sortedKeys.map(k => finMap[k].d)
            };

            // 2. Pratos por Categoria
            const catMap = {};
            pratos.forEach(p => {
                const c = p.Categoria || 'Outros';
                catMap[c] = (catMap[c] || 0) + 1;
            });

            // 3. Refeições Servidas (Últimos 7 dias)
            const refMap = {};
            // Inicializa os últimos 7 dias com 0
            for(let i=6; i>=0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const s = d.toISOString().split('T')[0];
                refMap[s] = 0;
            }
            refeicoesData.forEach(r => {
                const d = r.Data; // RPC já retorna data formatada ou objeto Date dependendo do driver, mas string ISO é padrão
                if(refMap[d] !== undefined) refMap[d] += Number(r.Quantidade);
            });

            result = {
                kpis: {
                    receitaMensal, despesaMensal, lucroLiquido: receitaMensal - despesaMensal,
                    aReceberHoje, aPagarHoje,
                    totalProdutos, totalClientes, totalFuncionarios, totalFornecedores, totalRefeicoes
                },
                dre: {
                    receitaBruta, impostos, receitaLiquida: receitaBruta - impostos,
                    cmv, despOp, lucroBruto: (receitaBruta - impostos) - cmv,
                    lucroFinal: receitaMensal - despesaMensal
                },
                monitoramento: {
                    aniversariantes: aniversariantesDia,
                    jubileu: jubileuDia,
                    ferias: ferias.filter(f => f.DataInicio <= today && f.DataFim >= today),
                    estoqueBaixo: estoqueCritico,
                    eventos: eventosProximos,
                    ordensProducao: ordensPendentes,
                    avisos: quadroAvisos
                },
                charts: {
                    financeiro: chartFin,
                    fluxoDiario: {
                        labels: Object.keys(dailyFlow),
                        receitas: Object.values(dailyFlow).map(v => v.r),
                        despesas: Object.values(dailyFlow).map(v => v.d)
                    },
                    pratos: {
                        labels: Object.keys(catMap),
                        data: Object.values(catMap)
                    },
                    refeicoes: {
                        labels: Object.keys(refMap).map(d => d.split('-').slice(1).reverse().join('/')), // DD/MM
                        data: Object.values(refMap)
                    }
                }
            };
        } else if (action === 'getNotifications') {
            ({ data: result, error } = await supabase
                .from('Notificacoes')
                .select('*')
                .order('CriadoEm', { ascending: false })
                .limit(10));
        } else if (action === 'markNotificationRead') {
             ({ data: result, error } = await supabase
                .from('Notificacoes')
                .update({ Lida: true })
                .eq('ID', data.id));
        } else if (action === 'delete') {
            ({ data: result, error } = await supabase.from(table).delete().eq('ID', id));
            
            // --- LOG DE AUDITORIA (DELETE) ---
            if (!error && userSession) {
                await supabase.from('LogsAuditoria').insert({
                    UsuarioID: userSession.id,
                    UsuarioNome: userSession.nome,
                    Modulo: table,
                    Acao: 'EXCLUIR',
                    Descricao: `Registro ID ${id} excluído da tabela ${table}`
                });
            }
        } else {
            return { statusCode: 400, body: JSON.stringify({ success: false, message: 'Ação inválida' }) };
        }

        if (error) throw error;

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, data: result })
        };
    } catch (err) {
        console.error('Erro na Function:', err);
        return {
            statusCode: 500,
            body: JSON.stringify({ success: false, message: err.message || 'Erro interno' })
        };
    }
};