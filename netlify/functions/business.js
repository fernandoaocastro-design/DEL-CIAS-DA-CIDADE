const { supabase } = require('./supabase');
const jwt = require('jsonwebtoken');
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
            }
        } else if (action === 'calculatePayroll') {
            const { SalarioBase, Bonus, QtdHoraExtra, ValorHoraExtra, OutrosVencimentos, INSS, IRT, Faltas, OutrosDescontos } = data;
            
            const base = Number(SalarioBase || 0);
            const totalVencimentos = base 
                + Number(Bonus || 0) 
                + (Number(QtdHoraExtra || 0) * Number(ValorHoraExtra || 0)) 
                + Number(OutrosVencimentos || 0);
            
            const totalDescontos = Number(INSS || 0) 
                + Number(IRT || 0) 
                + Number(Faltas || 0) 
                + Number(OutrosDescontos || 0);
            
            result = {
                TotalVencimentos: totalVencimentos,
                TotalDescontos: totalDescontos,
                SalarioLiquido: totalVencimentos - totalDescontos
            };
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
            const { id, nome, email, senhaAtual, novaSenha, assinatura } = data;
            
            // Verifica senha atual
            const { data: user, error: errUser } = await supabase.from('Usuarios').select('*').eq('ID', id).single();
            if (errUser || !user) throw new Error('Usuário não encontrado.');
            if (user.Senha !== senhaAtual) throw new Error('Senha atual incorreta.');

            const updates = { Nome: nome, Email: email, Assinatura: assinatura, Permissoes: user.Permissoes }; // Mantém permissões antigas ao editar perfil próprio
            if (novaSenha) updates.Senha = novaSenha;

            ({ data: result, error } = await supabase.from('Usuarios').update(updates).eq('ID', id).select());

        } else if (action === 'backupDatabase') {
            // Lista de todas as tabelas do sistema para backup
            const tables = [
                'Usuarios', 'Funcionarios', 'Frequencia', 'Ferias', 'Avaliacoes', 'Treinamentos', 'Licencas', 'Folha',
                'Financas', 'ContasReceber', 'ContasPagar', 'Estoque', 'Fornecedores', 'MovimentacoesEstoque',
                'Pratos', 'Notificacoes', 'MLPain_Areas', 'MLPain_Registros', 'Inventario', 'HistoricoInventario',
                'InstituicaoConfig', 'Departamentos', 'Cargos', 'ParametrosRH', 'ParametrosCozinha',
                'ParametrosEstoque', 'ParametrosPatrimonio', 'ParametrosFinanceiro', 'LogsAuditoria'
            ];

            const backupData = {};
            
            // Busca dados de todas as tabelas em paralelo
            await Promise.all(tables.map(async (t) => {
                const { data: tableData } = await supabase.from(t).select('*');
                if (tableData) backupData[t] = tableData;
            }));

            result = { generatedAt: new Date(), version: '1.0', data: backupData };

        } else if (action === 'restoreDatabase') {
            // ATENÇÃO: Esta ação deve ser usada com cuidado em produção
            const backupData = data; // O payload é o JSON completo
            
            if (!backupData || typeof backupData !== 'object') throw new Error('Arquivo de backup inválido.');

            // Itera sobre as tabelas do backup e insere/atualiza os dados
            const tables = Object.keys(backupData);
            
            for (const t of tables) {
                const rows = backupData[t];
                if (Array.isArray(rows) && rows.length > 0) {
                    // Upsert (Insere ou Atualiza se o ID já existir)
                    const { error } = await supabase.from(t).upsert(rows);
                    if (error) console.error(`Erro ao restaurar tabela ${t}:`, error.message);
                }
            }

            result = { success: true, message: 'Restauração concluída.' };

        } else if (action === 'completeProductionOrder') {
            const { id } = data; // ID da Ordem

            // 1. Buscar Ordem
            const { data: ordem, error: errOrdem } = await supabase.from('OrdensProducao').select('*').eq('ID', id).single();
            if (errOrdem || !ordem) throw new Error('Ordem de produção não encontrada.');
            
            if (ordem.Status === 'Concluída') throw new Error('Esta ordem já foi concluída.');

            // 2. Buscar Planejamento para pegar a Receita
            const { data: plan, error: errPlan } = await supabase.from('PlanejamentoProducao').select('*').eq('ID', ordem.PlanejamentoID).single();
            if (errPlan || !plan) throw new Error('Planejamento não encontrado.');

            // 3. Buscar Ficha Técnica
            const { data: ficha, error: errFicha } = await supabase.from('FichasTecnicas').select('*').eq('ID', plan.ReceitaID).single();
            if (errFicha || !ficha) throw new Error('Ficha técnica não encontrada.');

            const ingredientes = ficha.IngredientesJSON || [];
            if (ingredientes.length === 0) throw new Error('Ficha técnica sem ingredientes definidos.');

            // 4. Calcular Fator de Proporção
            const rendimentoFicha = Number(ficha.Rendimento) || 1;
            const qtdProduzida = Number(ordem.QtdProduzida) || 0;
            
            if (qtdProduzida <= 0) throw new Error('Quantidade produzida inválida. Atualize a ordem com a quantidade real antes de concluir.');

            const factor = qtdProduzida / rendimentoFicha;

            // 5. Processar Ingredientes
            for (const ing of ingredientes) {
                const qtdConsumo = Number(ing.quantidade) * factor;
                
                // Buscar item atual no estoque
                const { data: itemEstoque } = await supabase.from('Estoque').select('*').eq('ID', ing.id).single();
                
                if (itemEstoque) {
                    // Baixar Estoque
                    const novaQtd = Number(itemEstoque.Quantidade) - qtdConsumo;
                    
                    await supabase.from('Estoque').update({ Quantidade: novaQtd }).eq('ID', ing.id);

                    // Registrar Movimentação
                    await supabase.from('MovimentacoesEstoque').insert({
                        ProdutoID: ing.id,
                        Tipo: 'Saida',
                        Quantidade: qtdConsumo,
                        Responsavel: ordem.Responsavel || 'Sistema',
                        Observacoes: `Produção Ordem #${ordem.Codigo}`,
                        DetalhesJSON: { OrdemID: ordem.ID }
                    });

                    // Registrar Consumo Específico da Ordem
                    await supabase.from('ConsumoIngredientes').insert({
                        OrdemID: ordem.ID,
                        ProdutoID: ing.id,
                        ProdutoNome: itemEstoque.Nome,
                        Quantidade: qtdConsumo,
                        Responsavel: ordem.Responsavel || 'Sistema'
                    });
                }
            }

            // 6. Atualizar Status da Ordem
            const { error: errUpdate } = await supabase.from('OrdensProducao').update({ Status: 'Concluída' }).eq('ID', id);
            if (errUpdate) throw errUpdate;

            result = { success: true };

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
                resFinancas,
                resAniversariantes,
                resFerias,
                resEstoque,
                resEventos,
                resRefeicoes
            ] = await Promise.all([
                supabase.from('Usuarios').select('*', { count: 'exact', head: true }), // Simulando Clientes com Usuarios por enquanto ou criar tabela Clientes
                supabase.from('Pratos').select('Categoria', { count: 'exact' }),
                supabase.from('Funcionarios').select('*', { count: 'exact', head: true }),
                supabase.from('Financas').select('*').gte('Data', startOfFinanceData),
                supabase.from('Funcionarios').select('Nome, Nascimento'), // Para filtrar aniversariantes
                supabase.from('Ferias').select('*').eq('Status', 'Aprovado'),
                supabase.from('Estoque').select('Nome, Quantidade, Minimo'),
                supabase.from('Eventos').select('*').gte('Data', today).neq('Status', 'Cancelado').order('Data', { ascending: true }).limit(5),
                supabase.from('MLPain_Registros').select('Data, Quantidade').gte('Data', strSevenDaysAgo)
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
            const eventosProximos = resEventos.data || [];
            const refeicoesData = resRefeicoes.data || [];

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
                const d = r.Data.split('T')[0];
                if(refMap[d] !== undefined) refMap[d] += Number(r.Quantidade);
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
                    estoqueBaixo: estoqueCritico,
                    eventos: eventosProximos
                },
                charts: {
                    financeiro: chartFin,
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