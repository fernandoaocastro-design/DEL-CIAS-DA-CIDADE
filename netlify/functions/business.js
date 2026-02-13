import { supabase } from './supabase.js';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
const SECRET = process.env.JWT_SECRET || 'segredo-super-secreto-dev-change-me';

export const handler = async (event) => {
    // Headers para CORS (Permitir acesso do frontend) - Definidos no início para usar em todos os retornos
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    };

    // 1. TRATAMENTO DE PREFLIGHT (OPTIONS)
    // O navegador pergunta "posso conectar?" antes de enviar dados. Precisamos responder SIM (200).
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: 'Method Not Allowed' };
    }

    try {
        const { action, table, data, id } = JSON.parse(event.body);
        let result;
        let error;
        let userSession = null;

        // Agora verifica se o banco está conectado (para todas as outras ações)
        if (!supabase) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ success: false, message: 'Erro Crítico: Banco de Dados desconectado (Verifique SUPABASE_URL).' })
            };
        }

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

        } else if (action === 'searchEmployees') {
            // BUSCA AVANÇADA DE FUNCIONÁRIOS (RH)
            const { term } = data;
            const searchTerm = term ? term.trim() : '';

            let query = supabase.from('Funcionarios').select('*').order('Nome');

            if (searchTerm) {
                // Busca por Nome, Cargo ou Email (Case Insensitive)
                query = query.or(`Nome.ilike.%${searchTerm}%,Cargo.ilike.%${searchTerm}%,Email.ilike.%${searchTerm}%`);
            }

            ({ data: result, error } = await query);

        } else if (action === 'getMovimentacoesEstoque') {
            // PAGINAÇÃO OTIMIZADA COM FILTRO DE SUBTIPO (JOIN)
            const { page, limit, subtipo, term } = data;
            const from = (page - 1) * limit;
            const to = from + limit - 1;

            let query = supabase
                .from('MovimentacoesEstoque')
                .select('*, Estoque!inner(Nome, Subtipo, CustoUnitario)', { count: 'exact' })
                .order('Data', { ascending: false })
                .range(from, to);

            // Aplica filtro no lado do servidor (Performance)
            if (subtipo) {
                query = query.eq('Estoque.Subtipo', subtipo);
            }
            if (term) {
                query = query.ilike('Estoque.Nome', `%${term}%`);
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

            // --- VALIDAÇÃO DE DUPLICIDADE (CLIENTES) ---
            if (table === 'Clientes') {
                const nome = payload.Nome ? payload.Nome.trim() : '';
                if (nome) {
                    // Verifica se já existe alguém com esse nome (Case Insensitive)
                    let query = supabase
                        .from('Clientes')
                        .select('ID')
                        .ilike('Nome', nome);
                    
                    // Se for edição, exclui o próprio ID da verificação
                    if (payload.ID) query = query.neq('ID', payload.ID);
                    
                    const { data: existing } = await query.maybeSingle();
                    if (existing) throw new Error(`O cliente "${nome}" já está cadastrado.`);
                }
            }
            
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
                Subcategoria: conta.Subcategoria || 'Baixa de Conta', // Herda subcategoria se existir
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
            const { id, nome, email, senhaAtual, novaSenha, assinatura, fotoURL } = data;
            
            // Verifica senha atual
            const { data: user, error: errUser } = await supabase.from('Usuarios').select('*').eq('ID', id).single();
            if (errUser || !user) throw new Error('Usuário não encontrado.');
            if (user.Senha !== senhaAtual) throw new Error('Senha atual incorreta.');

            // VERIFICAÇÃO DE E-MAIL DUPLICADO
            if (email && email.trim().toLowerCase() !== user.Email.trim().toLowerCase()) {
                const { data: existing } = await supabase
                    .from('Usuarios')
                    .select('ID')
                    .ilike('Email', email.trim())
                    .maybeSingle();
                
                if (existing) throw new Error('Este e-mail já está sendo usado por outro usuário.');
            }

            const updates = { Nome: nome, Email: email, Assinatura: assinatura, Permissoes: user.Permissoes }; // Mantém permissões antigas ao editar perfil próprio
            if (novaSenha) updates.Senha = novaSenha;
            if (fotoURL !== undefined) updates.FotoURL = fotoURL;

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

        } else if (action === 'updateProductionStatus') {
            // 7. CONTROLE DE ESTOQUE AUTOMÁTICO
            const { id, status, detalhes } = data;
            
            // 1. Atualizar Status da Ordem
            const { error: errOp } = await supabase.from('OrdensProducao').update({ Status: status, DetalhesProducao: detalhes }).eq('ID', id);
            if (errOp) throw new Error('Erro ao atualizar ordem: ' + errOp.message);

            // 2. Lógica de Estoque
            if (status === 'Em Produção') {
                // ✅ RESERVAR INGREDIENTES
                if (detalhes && detalhes.ingredientes) {
                    for (const ing of detalhes.ingredientes) {
                        if (!ing.id) continue;
                        // Incrementa reserva (opcional, para visualização futura)
                        const { data: item } = await supabase.from('Estoque').select('QuantidadeReservada').eq('ID', ing.id).single();
                        if (item) {
                            const novaReserva = Number(item.QuantidadeReservada || 0) + Number(ing.qtdNecessaria);
                            await supabase.from('Estoque').update({ QuantidadeReservada: novaReserva }).eq('ID', ing.id);
                        }
                    }
                }
            } else if (status === 'Concluída') {
                // ✅ BAIXAR ESTOQUE (Consumo Real)
                if (detalhes && detalhes.ingredientes) {
                    for (const ing of detalhes.ingredientes) {
                        if (!ing.id) continue;
                        
                        const { data: item } = await supabase.from('Estoque').select('Quantidade, QuantidadeReservada').eq('ID', ing.id).single();
                        if (item) {
                            const novaQtd = Number(item.Quantidade) - Number(ing.qtdNecessaria);
                            const novaReserva = Math.max(0, Number(item.QuantidadeReservada || 0) - Number(ing.qtdNecessaria)); // Libera reserva
                            
                            await supabase.from('Estoque').update({ Quantidade: novaQtd, QuantidadeReservada: novaReserva }).eq('ID', ing.id);
                            
                            // Registrar Movimentação
                            await supabase.from('MovimentacoesEstoque').insert({
                                ProdutoID: ing.id, Tipo: 'Saida', Quantidade: Number(ing.qtdNecessaria),
                                Responsavel: 'Sistema (Produção)', Observacoes: `Consumo Automático OP #${id}`, Data: new Date()
                            });
                        }
                    }
                }
            }
            result = { success: true };

        } else if (action === 'savePurchaseOrder') {
            const { Solicitante, ValorTotal, Status, Itens } = data;

            // 1. Criar Pedido
            const { data: pedido, error: errPedido } = await supabase.from('PedidosCompra').insert({
                Solicitante, ValorTotal, Status
            }).select().single();

            if (errPedido) throw new Error('Erro ao criar pedido: ' + errPedido.message);

            // 2. Inserir Itens
            if (Itens && Itens.length > 0) {
                const itensParaInserir = Itens.map(item => ({
                    PedidoID: pedido.ID,
                    ProdutoNome: item.name,
                    Quantidade: item.qty,
                    CustoUnitario: item.price,
                    Subtotal: item.total,
                    Observacao: item.obs
                }));
                const { error: errItens } = await supabase.from('ItensPedidoCompra').insert(itensParaInserir);
                if (errItens) throw new Error('Erro ao salvar itens: ' + errItens.message);
            }
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
                // FIX: Calcular último dia usando getDate() para evitar problemas de fuso horário com toISOString()
                const lastDay = new Date(y, m, 0).getDate();
                end = `${month}-${String(lastDay).padStart(2, '0')}`;
            } else if (startDate && endDate) {
                start = startDate;
                end = endDate;
            } else {
                throw new Error('Parâmetros insuficientes para getMLPainRecords. Forneça "month" ou "startDate" e "endDate".');
            }
            
            // FIX: Garantir que o filtro pegue até o último milissegundo do dia final
            const endDateTime = `${end} 23:59:59.999`;

            ({ data: result, error } = await supabase
                .from('MLPain_Registros')
                .select('*')
                .gte('Data', start)
                .lte('Data', endDateTime)
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
            
            // Inicializa todos os dias do período com 0
            let currDate = new Date(start);
            const lastDate = new Date(end);
            while (currDate <= lastDate) {
                const dayStr = currDate.toISOString().split('T')[0];
                fluxoDiario[dayStr] = { receita: 0, despesa: 0, saldo: 0 };
                currDate.setDate(currDate.getDate() + 1);
            }

            financas.forEach(f => {
                const val = Number(f.Valor || 0);
                const dia = f.Data.split('T')[0];

                if (fluxoDiario[dia]) {
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
                }
            });

            // Processamento de Contas (KPIs de Liquidez)
            const hoje = new Date().toISOString().split('T')[0];
            const aPagarTotal = contasPagar.reduce((acc, c) => acc + Number(c.ValorTotal), 0);
            const aReceberTotal = contasReceber.reduce((acc, c) => acc + Number(c.ValorTotal), 0);
            
            const aPagarAtrasado = contasPagar.filter(c => c.Vencimento < hoje).reduce((acc, c) => acc + Number(c.ValorTotal), 0);
            const aReceberAtrasado = contasReceber.filter(c => c.Vencimento < hoje).reduce((acc, c) => acc + Number(c.ValorTotal), 0);

            result = {
                periodo: { start, end },
                transacoes: financas,
                listas: { contasPagar, contasReceber },
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
            
            // OTIMIZAÇÃO: Lógica movida para o Banco de Dados (RPC)
            const { data: deadStock, error } = await supabase.rpc('get_estoque_parado', { dias_param: days });
            
            if (error) throw error;

            const totalValue = deadStock.reduce((acc, i) => acc + Number(i.ValorTotal || 0), 0);

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

            const clientMap = {};
            let totalRevenue = 0;

            eventos.forEach(e => {
                const name = e.Cliente ? e.Cliente.trim() : 'Desconhecido';
                if (!name) return;
                if (!clientMap[name]) clientMap[name] = 0;
                const val = Number(e.Valor || 0);
                clientMap[name] += val;
                totalRevenue += val;
            });

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
                    const dayIdx = d.getDay();
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
            // OTIMIZAÇÃO: Processamento em lote via SQL
            const { error } = await supabase.rpc('recalcular_fidelidade');
            if (error) throw error;
            
            result = { success: true };

        } else if (action === 'getTasks') {
            ({ data: result, error } = await supabase.from('Tarefas').select('*').order('Status', { ascending: false }).order('Prazo', { ascending: true }));
        } else if (action === 'getChatMessages') {
            ({ data: result, error } = await supabase.from('ChatMessages').select('*').order('Timestamp', { ascending: false }).limit(50));
        } else if (action === 'sendChatMessage') {
            ({ data: result, error } = await supabase.from('ChatMessages').insert(data));
        } else if (action === 'getDashboardStats') {
            const { filterDate } = data || {}; // Formato: 'YYYY-MM' ou 'all'

            // Agregação de dados para o Dashboard Principal
            const today = new Date().toISOString().split('T')[0];
            
            // Definição do Período de Análise
            let startOfPeriod, endOfPeriod;
            
            if (filterDate && filterDate === 'all') {
                startOfPeriod = '2000-01-01'; // Início dos tempos
                endOfPeriod = '2099-12-31';
            } else if (filterDate) {
                startOfPeriod = filterDate + '-01';
                const [y, m] = filterDate.split('-');
                endOfPeriod = new Date(y, m, 0).toISOString().split('T')[0]; // Último dia do mês selecionado
            } else {
                // Padrão: Mês Atual
                startOfPeriod = new Date().toISOString().slice(0, 7) + '-01';
                endOfPeriod = today;
            }

            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
            const strSevenDaysAgo = sevenDaysAgo.toISOString().split('T')[0];
            
            // Otimização: Buscar apenas finanças dos últimos 12 meses para não pesar o sistema
            // Se o filtro for 'all' ou um mês antigo, precisamos garantir que a busca pegue esses dados
            const d = new Date();
            d.setMonth(d.getMonth() - 11);
            d.setDate(1);
            let startOfFinanceData = d.toISOString().split('T')[0];
            
            if (startOfPeriod < startOfFinanceData) {
                startOfFinanceData = startOfPeriod; // Estende a busca se o filtro for antigo
            }

            // Consultas Paralelas
            // Usa Promise.allSettled para que uma falha não derrube todo o dashboard
            const queries = [
                supabase.from('Usuarios').select('*', { count: 'exact', head: true }), // Simulando Clientes com Usuarios por enquanto ou criar tabela Clientes
                supabase.from('FichasTecnicas').select('Categoria', { count: 'exact' }),
                supabase.from('Funcionarios').select('*', { count: 'exact', head: true }).eq('Status', 'Ativo'),
                supabase.from('Fornecedores').select('*', { count: 'exact', head: true }).eq('Status', 'Ativo'),
                supabase.from('Financas').select('*').gte('Data', startOfFinanceData),
                supabase.from('Funcionarios').select('Nome, Nascimento, Admissao, ValidadeBI, Departamento').eq('Status', 'Ativo'), // Adicionado Departamento
                supabase.from('Ferias').select('*').eq('Status', 'Aprovado'),
                supabase.from('Estoque').select('Nome, Quantidade, Minimo'),
                supabase.from('Eventos').select('*').gte('Data', today).neq('Status', 'Cancelado').order('Data', { ascending: true }).limit(5),
                supabase.rpc('get_refeicoes_grafico', { data_inicio: strSevenDaysAgo }),
                supabase.rpc('get_total_refeicoes_mes', { data_inicio: startOfPeriod }), // Usa o filtro
                supabase.from('OrdensProducao').select('Codigo, Status, Responsavel').neq('Status', 'Concluída'),
                supabase.from('QuadroAvisos').select('*').order('CriadoEm', { ascending: false }).limit(5)
            ];

            const results = await Promise.allSettled(queries);

            // Helper para extrair dados com segurança (Ignora erros e retorna padrão)
            const getVal = (idx, defaultVal = []) => {
                const res = results[idx];
                if (res.status === 'fulfilled' && !res.value.error) return res.value.data || defaultVal;
                return defaultVal;
            };
            
            const getCount = (idx) => {
                const res = results[idx];
                return (res.status === 'fulfilled' && !res.value.error) ? (res.value.count || 0) : 0;
            };

            const totalClientes = getCount(0);
            const totalProdutos = getCount(1);
            const totalFuncionarios = getCount(2);
            const totalFornecedores = getCount(3);
            const financas = getVal(4);
            const aniversariantes = getVal(5);
            const ferias = getVal(6);
            const estoqueBaixo = getVal(7);
            const eventosProximos = getVal(8);
            const refeicoesData = getVal(9);
            // RPC retorna valor escalar em 'data', não array
            const totalRefeicoes = (results[10].status === 'fulfilled' && !results[10].value.error) ? (results[10].value.data || 0) : 0;
            const ordensPendentes = getVal(11);
            const quadroAvisos = getVal(12);
            const pratos = getVal(1); // CORREÇÃO: Definindo a variável pratos que estava faltando

            // Processamento Financeiro (DRE e KPIs)
            let receitaMensal = 0, despesaMensal = 0, aReceberHoje = 0, aPagarHoje = 0;
            let receitaBruta = 0, impostos = 0, cmv = 0, despOp = 0;
            const despesasMap = {};

            financas.forEach(f => {
                const val = Number(f.Valor);
                // Correção: Compara apenas a data (YYYY-MM-DD) ignorando hora
                let dataTransacao = '';
                try { 
                    if(f.Data) dataTransacao = new Date(f.Data).toISOString().split('T')[0]; 
                } catch(e) {}
                
                const isMonth = dataTransacao >= startOfPeriod && dataTransacao <= endOfPeriod;
                const isToday = dataTransacao === today;

                if (f.Tipo === 'Receita') {
                    if (isMonth) { receitaMensal += val; receitaBruta += val; }
                    if (isToday && f.Status === 'Pendente') aReceberHoje += val;
                } else if (f.Tipo === 'Despesa') {
                    if (isMonth) { despesaMensal += val; }
                    if (isToday && f.Status === 'Pendente') aPagarHoje += val;
                    
                    if (isMonth) {
                        const cat = f.Categoria || 'Outros';
                        despesasMap[cat] = (despesasMap[cat] || 0) + val;
                    }
                    
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

            const validadeBI = aniversariantes.filter(f => {
                if(!f.ValidadeBI) return false;
                const val = new Date(f.ValidadeBI);
                const now = new Date();
                const diff = Math.ceil((val - now) / (1000 * 60 * 60 * 24));
                return diff <= 30; // Vencendo em 30 dias ou vencido
            }).map(f => ({ ...f, Dias: Math.ceil((new Date(f.ValidadeBI) - new Date()) / (1000 * 60 * 60 * 24)) }));

            const estoqueCritico = estoqueBaixo.filter(e => e.Quantidade <= e.Minimo);

            // Dados para Gráfico de Departamentos (RH)
            const deptMap = {};
            aniversariantes.forEach(f => { // 'aniversariantes' contém a lista completa de ativos buscada acima
                const dept = f.Departamento || 'Sem Departamento';
                deptMap[dept] = (deptMap[dept] || 0) + 1;
            });

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

            // 1.1 Fluxo de Caixa Diário (Mês Selecionado ou Atual)
            const dailyFlow = {};
            let targetYear, targetMonth, daysInTargetMonth;

            if (filterDate && filterDate !== 'all') {
                const [y, m] = filterDate.split('-').map(Number);
                targetYear = y;
                targetMonth = m - 1;
                daysInTargetMonth = new Date(y, m, 0).getDate();
            } else {
                const now = new Date();
                targetYear = now.getFullYear();
                targetMonth = now.getMonth();
                daysInTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
            }

            // Inicializa todos os dias com 0
            for(let i=1; i<=daysInTargetMonth; i++) dailyFlow[i] = { r: 0, d: 0 };

            financas.forEach(f => {
                if (!f.Data) return;
                const [y, m, d] = f.Data.split('T')[0].split('-').map(Number);
                
                if (y === targetYear && (m - 1) === targetMonth) {
                    if(dailyFlow[d]) {
                        if(f.Tipo === 'Receita') dailyFlow[d].r += Number(f.Valor);
                        else dailyFlow[d].d += Number(f.Valor);
                    }
                }
            });
            
            // Decisão do Gráfico Principal: Diário (se mês selecionado) ou Mensal (se Geral)
            let chartFin;
            if (filterDate && filterDate !== 'all') {
                chartFin = {
                    labels: Object.keys(dailyFlow),
                    receitas: Object.values(dailyFlow).map(v => v.r),
                    despesas: Object.values(dailyFlow).map(v => v.d)
                };
            } else {
                const sortedKeys = Object.keys(finMap).sort().slice(-6);
                chartFin = {
                    labels: sortedKeys.map(k => months[parseInt(k.split('-')[1]) - 1]),
                    receitas: sortedKeys.map(k => finMap[k].r),
                    despesas: sortedKeys.map(k => finMap[k].d)
                };
            }

            // 1.2 Lucratividade Anual (Últimos 12 meses)
            const sortedKeys12 = Object.keys(finMap).sort().slice(-12);
            const chartLucratividade = {
                labels: sortedKeys12.map(k => months[parseInt(k.split('-')[1]) - 1]),
                data: sortedKeys12.map(k => finMap[k].r - finMap[k].d)
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
                    validadeBI: validadeBI,
                    ferias: ferias.filter(f => f.DataInicio <= today && f.DataFim >= today),
                    estoqueBaixo: estoqueCritico,
                    eventos: eventosProximos,
                    ordensProducao: ordensPendentes,
                    avisos: quadroAvisos
                },
                charts: {
                    financeiro: chartFin,
                    lucratividade: chartLucratividade,
                    fluxoDiario: {
                        labels: Object.keys(dailyFlow),
                        receitas: Object.values(dailyFlow).map(v => v.r),
                        despesas: Object.values(dailyFlow).map(v => v.d)
                    },
                    pratos: {
                        labels: Object.keys(catMap),
                        data: Object.values(catMap)
                    },
                    despesas: {
                        labels: Object.keys(despesasMap),
                        data: Object.values(despesasMap)
                    },
                    refeicoes: {
                        labels: Object.keys(refMap).map(d => d.split('-').slice(1).reverse().join('/')), // DD/MM
                        data: Object.values(refMap)
                    },
                    departamentos: {
                        labels: Object.keys(deptMap),
                        data: Object.values(deptMap)
                    }
                }
            };
        } else if (action === 'getNotifications') {
            ({ data: result, error } = await supabase
                .from('Notificacoes')
                .select('*')
                .order('CriadoEm', { ascending: false })
                .limit(10));
        } else if (action === 'checkBirthdayEmails') {
            // --- ROTINA DE E-MAILS DE ANIVERSÁRIO ---
            const today = new Date();
            const month = today.getMonth() + 1;
            const day = today.getDate();
            const year = today.getFullYear();

            // 1. Buscar aniversariantes do dia
            const { data: employees } = await supabase.from('Funcionarios').select('ID, Nome, Email, Nascimento').eq('Status', 'Ativo');
            
            const birthdays = employees.filter(e => {
                if(!e.Nascimento) return false;
                const d = new Date(e.Nascimento);
                return (d.getMonth() + 1) === month && (d.getDate()) === day;
            });

            let sentCount = 0;

            for (const emp of birthdays) {
                if (!emp.Email) continue; // Pula se não tiver e-mail

                // 2. Verificar se já enviou este ano (Evita duplicidade)
                const { data: logs } = await supabase.from('EmailLogs').select('*').eq('DestinatarioID', emp.ID).eq('Tipo', 'Aniversario').eq('Ano', year);
                if (logs && logs.length > 0) continue;

                // 3. Enviar E-mail (Simulação - Aqui entraria o Nodemailer/SendGrid)
                console.log(`📧 [EMAIL AUTOMÁTICO] Enviando parabéns para: ${emp.Nome} (${emp.Email})`);
                // TODO: Integrar API de e-mail real aqui.
                
                // 4. Registrar envio
                await supabase.from('EmailLogs').insert({
                    DestinatarioID: emp.ID, Tipo: 'Aniversario', Ano: year
                });
                sentCount++;
            }
            result = { sent: sentCount };
        } else if (action === 'markNotificationRead') {
             ({ data: result, error } = await supabase
                .from('Notificacoes')
                .update({ Lida: true })
                .eq('ID', data.id));

        } else if (action === 'saveFinancialGoal') {
            const { Mes, ReceitaEsperada, DespesaMaxima } = data;
            const { error } = await supabase
                .from('MetasFinanceiras')
                .upsert({ Mes, ReceitaEsperada, DespesaMaxima }, { onConflict: 'Mes' });
            
            if (error) throw error;
            result = { success: true };

        } else if (action === 'getSystemBackups') {
            // Lista todos os backups disponíveis
            const { data: backups, error } = await supabase.rpc('get_system_backups');
            if (error) throw error;
            result = backups;

        } else if (action === 'cleanOldBackups') {
            // Limpa backups antigos manualmente (mantém últimos 30 dias por padrão)
            const { error } = await supabase.rpc('limpar_backups_antigos', { dias_retencao: 30 });
            if (error) throw error;
            result = { success: true };

        } else if (action === 'getBackupData') {
            // Busca dados de um backup para exportação
            // Nota: Limitado a 5000 linhas para não estourar memória no browser/lambda
            const { data: rows, error } = await supabase.from(data.tableName).select('*').limit(5000);
            if (error) throw error;
            result = rows;

        } else if (action === 'getAuditLogs') {
            // Busca logs de auditoria com filtros
            const { startDate, endDate, module, user } = data || {};
            
            let query = supabase
                .from('LogsAuditoria')
                .select('*')
                .order('DataHora', { ascending: false })
                .limit(200); // Limite de segurança

            if (startDate) query = query.gte('DataHora', startDate);
            if (endDate) query = query.lte('DataHora', endDate + ' 23:59:59');
            if (module) query = query.eq('Modulo', module);
            if (user) query = query.ilike('UsuarioNome', `%${user}%`);

            ({ data: result, error } = await query);

        } else if (action === 'restoreSystemBackup') {
            // Restaura um backup específico
            const { table, backupTable } = data;
            const { error } = await supabase.rpc('admin_restaurar_backup', {
                tabela_destino: table,
                tabela_backup: backupTable
            });
            if (error) throw error;
            result = { success: true };

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

        } else if (action === 'getDailyProductionLists') {
            // Busca as 4 listas de um dia específico
            const { date } = data;
            const { data: lists, error } = await supabase.from('ListasProducaoDia').select('*').eq('Data', date);
            if (error) throw error;
            result = lists;

        } else if (action === 'saveDailyProductionList') {
            // Salva ou Atualiza uma lista (Rascunho)
            const { Data, Categoria, ItensJSON } = data;
            const { data: saved, error } = await supabase
                .from('ListasProducaoDia')
                .upsert({ Data, Categoria, ItensJSON, Status: 'Rascunho' }, { onConflict: 'Data,Categoria' })
                .select();
            if (error) throw error;
            result = saved;

        } else if (action === 'finalizeDailyProductionList') {
            // Envia para produção e dá baixa no estoque
            const { id } = data;
            
            // 1. Buscar a lista
            const { data: list, error: errList } = await supabase.from('ListasProducaoDia').select('*').eq('ID', id).single();
            if (errList || !list) throw new Error('Lista não encontrada.');
            if (list.Status === 'Enviado') throw new Error('Esta lista já foi enviada para produção.');

            const itens = list.ItensJSON || [];
            
            // 1.1 VALIDAÇÃO DE ESTOQUE (Antes de baixar qualquer coisa)
            for (const item of itens) {
                if (!item.id) continue;
                const { data: stockItem } = await supabase.from('Estoque').select('Quantidade, Nome, Unidade').eq('ID', item.id).single();
                
                if (!stockItem) throw new Error(`Produto não encontrado no estoque: ${item.nome}`);
                
                if (Number(stockItem.Quantidade) < Number(item.qtd)) {
                    throw new Error(`Estoque insuficiente para "${stockItem.Nome}". Disponível: ${stockItem.Quantidade} ${stockItem.Unidade}. Solicitado: ${item.qtd}`);
                }
            }

            // 2. Processar Baixa de Estoque
            for (const item of itens) {
                if (!item.id) continue;
                
                const qtdBaixa = Number(item.qtd);
                
                // Chama a procedure de baixa ou atualiza direto (aqui atualizando direto para manter padrão do arquivo)
                // Nota: Em produção ideal, usar RPC para atomicidade. Aqui segue o padrão do registerStockMovement.
                const { data: stockItem } = await supabase.from('Estoque').select('Quantidade').eq('ID', item.id).single();
                
                if (stockItem) {
                    const novaQtd = Number(stockItem.Quantidade) - qtdBaixa;
                    await supabase.from('Estoque').update({ Quantidade: novaQtd }).eq('ID', item.id);
                    await supabase.from('MovimentacoesEstoque').insert({ ProdutoID: item.id, Tipo: 'Saida', Quantidade: qtdBaixa, Responsavel: userSession ? userSession.nome : 'Sistema', Observacoes: `Envio Produção: ${list.Categoria}`, Data: new Date() });
                }
            }

            // 3. Atualizar Status
            const { error: errUpdate } = await supabase.from('ListasProducaoDia').update({ Status: 'Enviado' }).eq('ID', id);
            if (errUpdate) throw errUpdate;
            result = { success: true };

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
            headers, // Garante que o erro chegue ao frontend sem bloqueio de CORS
            body: JSON.stringify({ success: false, message: err.message || 'Erro interno' })
        };
    }
};