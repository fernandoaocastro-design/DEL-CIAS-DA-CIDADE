const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

let supabase;

// Inicialização segura: Só cria o cliente se as chaves existirem
if (supabaseUrl && supabaseKey) {
    supabase = createClient(supabaseUrl, supabaseKey);
} else {
    console.error('ERRO CRÍTICO: Variáveis de ambiente SUPABASE_URL ou SUPABASE_KEY estão faltando.');
}

exports.handler = async (event) => {
    // Se o Supabase não foi iniciado, retorna erro amigável em vez de crashar (502)
    if (!supabase) {
        return {
            statusCode: 500,
            body: JSON.stringify({ success: false, message: 'Configuração do Servidor incompleta: Chaves do Supabase não encontradas.' })
        };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { action, table, data, id } = JSON.parse(event.body);
        let result;
        let error;

        if (action === 'getAll') {
            ({ data: result, error } = await supabase.from(table).select('*'));
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
            
            result = user;
        } else if (action === 'save') {
            const payload = { ...data };
            // Remove ID vazio para permitir inserção (Auto-Increment/UUID)
            if (!payload.ID) delete payload.ID;
            
            if (payload.ID) {
                ({ data: result, error } = await supabase.from(table).update(payload).eq('ID', payload.ID).select());
            } else {
                ({ data: result, error } = await supabase.from(table).insert(payload).select());
            }

            // --- NOTIFICAÇÃO AUTOMÁTICA (ESTOQUE) ---
            if (!error && table === 'Estoque' && result && result.length > 0) {
                const item = result[0];
                if (Number(item.Quantidade) <= Number(item.Minimo)) {
                    await supabase.from('Notificacoes').insert({
                        Mensagem: `⚠️ Estoque Baixo: ${item.Item} atingiu ${item.Quantidade} ${item.Unidade} (Mínimo: ${item.Minimo})`
                    });
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
                ProdutoID: produtoId, Tipo: tipo, Quantidade: qtdMov, Responsavel: responsavel, Observacoes: observacoes, DetalhesJSON: detalhes
            });
            if (errMov) throw new Error('Erro ao registrar histórico.');

            result = { success: true };
        } else if (action === 'settleAccount') {
            // BAIXAR CONTA (Integração Contas -> Fluxo de Caixa)
            const { id, table, dataPagamento, valorPago, metodo } = data;
            const isReceber = table === 'ContasReceber';
            
            // 1. Buscar a conta original
            const { data: conta, error: errConta } = await supabase.from(table).select('*').eq('ID', id).single();
            if (errConta || !conta) throw new Error('Conta não encontrada.');

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
                
                const { data: newBem, error: errIns } = await supabase.from('Inventario').insert(payload).select().single();
                if (errIns) throw errIns;
                bemID = newBem.ID;

                await supabase.from('HistoricoInventario').insert({
                    BemID: bemID, TipoAcao: 'Cadastro', Descricao: 'Bem registrado no sistema', ResponsavelAcao: userAction
                });
            }
            result = { success: true };
        } else if (action === 'updateProfile') {
            const { id, nome, email, senhaAtual, novaSenha } = data;
            
            // Verifica senha atual
            const { data: user, error: errUser } = await supabase.from('Usuarios').select('*').eq('ID', id).single();
            if (errUser || !user) throw new Error('Usuário não encontrado.');
            if (user.Senha !== senhaAtual) throw new Error('Senha atual incorreta.');

            const updates = { Nome: nome, Email: email };
            if (novaSenha) updates.Senha = novaSenha;

            ({ data: result, error } = await supabase.from('Usuarios').update(updates).eq('ID', id).select());

        } else if (action === 'getDashboardStats') {
            // Agregação de dados para o Dashboard Principal
            const today = new Date().toISOString().split('T')[0];
            const startOfMonth = new Date().toISOString().slice(0, 7) + '-01';

            // Consultas Paralelas
            const [
                resClientes,
                resPratosData,
                resFuncionarios,
                resFinancas,
                resAniversariantes,
                resFerias,
                resEstoque
            ] = await Promise.all([
                supabase.from('Usuarios').select('*', { count: 'exact', head: true }), // Simulando Clientes com Usuarios por enquanto ou criar tabela Clientes
                supabase.from('Pratos').select('Categoria', { count: 'exact' }),
                supabase.from('Funcionarios').select('*', { count: 'exact', head: true }),
                supabase.from('Financas').select('*'), // Trazer tudo para calcular no JS (idealmente filtrar por data no SQL)
                supabase.from('Funcionarios').select('Nome, Nascimento'), // Para filtrar aniversariantes
                supabase.from('Ferias').select('*').eq('Status', 'Aprovado'),
                supabase.from('Estoque').select('Item, Quantidade, Minimo')
            ]);

            // Extração segura de dados (evita crash se houver erro no banco)
            const totalClientes = resClientes.count || 0;
            const totalProdutos = resPratosData.count || 0;
            const totalFuncionarios = resFuncionarios.count || 0;
            const financas = resFinancas.data || [];
            const aniversariantes = resAniversariantes.data || [];
            const ferias = resFerias.data || [];
            const estoqueBaixo = resEstoque.data || [];
            const pratos = resPratosData.data || [];

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

            result = {
                kpis: {
                    receitaMensal, despesaMensal, lucroLiquido: receitaMensal - despesaMensal,
                    aReceberHoje, aPagarHoje,
                    totalProdutos, totalClientes, totalFuncionarios
                },
                dre: {
                    receitaBruta, impostos, receitaLiquida: receitaBruta - impostos,
                    cmv, despOp, lucroBruto: (receitaBruta - impostos) - cmv,
                    lucroFinal: receitaMensal - despesaMensal
                },
                monitoramento: {
                    aniversariantes: aniversariantesDia,
                    ferias: ferias.filter(f => f.DataInicio <= today && f.DataFim >= today),
                    estoqueBaixo: estoqueCritico
                },
                charts: {
                    financeiro: chartFin,
                    pratos: {
                        labels: Object.keys(catMap),
                        data: Object.values(catMap)
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
        } else {
            return { statusCode: 400, body: JSON.stringify({ success: false, message: 'Ação inválida' }) };
        }

        if (error) throw error;

        return {
            statusCode: 200,
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