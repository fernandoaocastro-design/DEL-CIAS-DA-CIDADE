const DashboardModule = {
    charts: {}, // Armazena instâncias
    state: { filterDate: new Date().toISOString().slice(0, 7), tasks: [] }, // Padrão: Mês atual

    init: () => {
        DashboardModule.renderLayout();
        DashboardModule.loadData();
    },

    renderLayout: () => {
        // Tenta encontrar o container principal (suporta dashboard.html ou index.html genérico)
        const container = document.getElementById('dashboard-content') || document.getElementById('app-content');
        if (!container) {
            console.error('Erro: Container do Dashboard não encontrado.');
            return;
        }

        container.innerHTML = `
            <div id="dashboard-filters"></div>
            
            <!-- 1. RESUMO DO DIA (Cards Principais) -->
            <div id="daily-summary-section" class="mb-6"></div>

            <!-- NOVO: Quadro de Aniversariantes -->
            <div id="birthday-section" class="mb-6"></div>

            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                <!-- 2. LISTA DE PRODUÇÃO (Central) -->
                <div id="production-section" class="lg:col-span-2 space-y-6"></div>
                
                <!-- 3. ESTOQUE RÁPIDO & 4. RECEBIMENTOS -->
                <div class="space-y-6">
                    <div id="stock-section"></div>
                    <div id="receiving-section"></div>
                </div>
            </div>

            <!-- 5. EVENTOS & PEDIDOS -->
            <div id="events-orders-section" class="mb-6"></div>

            <!-- 6. FINANÇAS -->
            <div id="finance-section" class="mb-6"></div>

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <!-- 7. DESPERDÍCIO -->
                <div id="waste-section"></div>
                <!-- 8. RH -->
                <div id="rh-section"></div>
            </div>

            <!-- 9. ML PAIN -->
            <div id="mlpain-section" class="mb-6"></div>

            <!-- 10. GRÁFICOS -->
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                <div class="bg-white p-4 rounded shadow">
                    <h4 class="font-bold text-gray-700 mb-4 border-b pb-2">Vendas por Categoria</h4>
                    <div class="h-64"><canvas id="chartAtendimento"></canvas></div>
                </div>
                <div class="bg-white p-4 rounded shadow lg:col-span-2">
                    <h4 class="font-bold text-gray-700 mb-4 border-b pb-2">Lucratividade Anual</h4>
                    <div class="h-64"><canvas id="chartLucratividade"></canvas></div>
                </div>
            </div>
            <div id="charts-section" class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <div class="bg-white p-4 rounded shadow">
                    <h4 class="font-bold text-gray-700 mb-4 border-b pb-2">Fluxo Financeiro</h4>
                    <div class="h-64"><canvas id="chartFinanceiro"></canvas></div>
                </div>
                <div class="bg-white p-4 rounded shadow">
                    <h4 class="font-bold text-gray-700 mb-4 border-b pb-2">Refeições Servidas</h4>
                    <div class="h-64"><canvas id="chartRefeicoes"></canvas></div>
                </div>
            </div>
            
            <!-- 11. ALERTAS & AVISOS -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div id="alerts-section"></div>
                <div id="quadro-avisos-section"></div>
            </div>
            
            <div id="tarefas-section" class="mt-6"></div>
        `;
    },

    loadData: async () => {
        try {
            DashboardModule.renderFilters(); // Renderiza o filtro antes de carregar
            const data = await Utils.api('getDashboardStats', null, { filterDate: DashboardModule.state.filterDate });
            
            if (data.monitoramento) DashboardModule.renderDailySummary(data.monitoramento);
            if (data.monitoramento) DashboardModule.renderBirthdayBoard(data.monitoramento);
            if (data.monitoramento) DashboardModule.renderProductionList(data.monitoramento);
            if (data.monitoramento) DashboardModule.renderStockQuick(data.monitoramento);
            if (data.monitoramento) DashboardModule.renderReceiving(data.monitoramento);
            if (data.monitoramento) DashboardModule.renderEventsOrders(data.monitoramento);
            if (data.kpis && data.dre) DashboardModule.renderFinance(data.kpis, data.dre, data.monitoramento);
            if (data.monitoramento) DashboardModule.renderWaste(data.monitoramento);
            if (data.monitoramento && data.kpis) DashboardModule.renderRH(data.monitoramento, data.kpis);
            if (data.monitoramento) DashboardModule.renderMLPain(data.monitoramento);
            if (data.monitoramento) DashboardModule.renderAlerts(data.monitoramento);
            if (data.monitoramento) DashboardModule.renderQuadroAvisos(data.monitoramento.avisos);
            DashboardModule.loadTarefas(); // Carrega tarefas separadamente
            DashboardModule.renderCharts(data.charts);
            // Roda automacoes somente para administrador e com throttle.
            const user = Utils.getUser();
            if (user.Cargo === 'Administrador') {
                const throttleMs = 30 * 60 * 1000;
                const now = Date.now();
                const lastRun = Number(localStorage.getItem('dashboard_automation_last_run') || 0);

                if (!lastRun || (now - lastRun) > throttleMs) {
                    localStorage.setItem('dashboard_automation_last_run', String(now));
                    Utils.api('checkBirthdayEmails').then(res => { if(res.sent > 0) console.log(`${res.sent} e-mails de aniversario enviados.`); });
                    Utils.api('checkFinancialAlerts').then(res => { if(res.alertsGenerated > 0) console.log(`${res.alertsGenerated} alertas financeiros gerados.`); });
                }
            }
        } catch (e) {
            console.error(e);
            Utils.toast("Erro ao carregar dashboard.");
        }
    },

    renderFilters: () => {
        let filterDiv = document.getElementById('dashboard-filters');
        if (!filterDiv) return;
        
        filterDiv.className = 'flex flex-col md:flex-row justify-between items-center mb-6 bg-white p-3 rounded shadow-sm border border-gray-100';

        // Gera opções de meses (Últimos 12 meses + Futuro próximo)
        let options = `<option value="all">📅 Todo o Período</option>`;
        const date = new Date();
        date.setMonth(date.getMonth() + 1); // Começa do mês que vem (para ver previsões se houver)
        
        for (let i = 0; i < 18; i++) {
            const val = date.toISOString().slice(0, 7);
            const label = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
            const selected = DashboardModule.state.filterDate === val ? 'selected' : '';
            options += `<option value="${val}" ${selected}>${label.charAt(0).toUpperCase() + label.slice(1)}</option>`;
            date.setMonth(date.getMonth() - 1);
        }

        filterDiv.innerHTML = `
            <h2 class="text-xl font-bold text-gray-800 flex items-center gap-2"><i class="fas fa-chart-pie text-indigo-600"></i> Visão Geral</h2>
            <div class="flex items-center gap-2">
                <label class="text-sm font-bold text-gray-600">Período:</label>
                <select id="dashboard-filter-date" onchange="DashboardModule.state.filterDate = this.value; DashboardModule.loadData()" class="border border-gray-300 p-2 rounded text-sm bg-gray-50 focus:ring-2 focus:ring-indigo-500 outline-none">
                    ${options}
                </select>
                <button onclick="DashboardModule.loadData()" class="bg-indigo-600 text-white px-4 py-2 rounded shadow hover:bg-indigo-700 transition flex items-center gap-2">
                    <i class="fas fa-sync-alt"></i> Atualizar
                </button>
            </div>
        `;
    },

    renderDailySummary: (mon) => {
        const container = document.getElementById('daily-summary-section');
        if (!container) return;

        const today = new Date().toISOString().split('T')[0];
        
        // Cálculos
        const pedidosHoje = (mon.productionPlans.length) + (mon.eventos.filter(e => e.Data === today).length);
        
        // Itens nas listas de produção
        const listaAlmoco = mon.listasDia.find(l => l.Categoria === 'Almoço');
        const itensAlmoco = listaAlmoco && listaAlmoco.ItensJSON ? listaAlmoco.ItensJSON.length : 0;
        
        const listaJantar = mon.listasDia.find(l => l.Categoria === 'Jantar');
        const itensJantar = listaJantar && listaJantar.ItensJSON ? listaJantar.ItensJSON.length : 0;

        const estoqueCritico = mon.estoqueBaixo ? mon.estoqueBaixo.length : 0;
        
        // Refeições Planejadas vs Servidas
        let refeicoesPlanejadas = 0;
        mon.productionPlans.forEach(p => {
            refeicoesPlanejadas += (p.staff_count_day || 0) + (p.staff_count_night || 0) + (p.patient_solid || 0) + (p.patient_liquid || 0);
        });
        mon.eventos.filter(e => e.Data === today).forEach(e => refeicoesPlanejadas += (e.Pessoas || 0));

        const equipePresente = mon.frequencia.filter(f => f.Status === 'Presente').length;

        container.innerHTML = `
            <div class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <div class="bg-gray-800 text-white px-6 py-3 flex justify-between items-center">
                    <h3 class="font-bold text-lg flex items-center gap-2"><i class="fas fa-tachometer-alt text-yellow-400"></i> RESUMO DO DIA</h3>
                    <span class="text-xs bg-gray-700 px-3 py-1 rounded-full">${Utils.formatDate(today)}</span>
                </div>
                <div class="p-6">
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <!-- Tabela Resumo -->
                        <div class="col-span-1 md:col-span-2">
                            <h4 class="text-sm font-bold text-gray-500 uppercase mb-3">Indicadores Operacionais</h4>
                            <table class="w-full text-sm border-collapse">
                                <tr class="border-b"><td class="py-2 text-gray-600">Pedidos Hoje</td><td class="py-2 text-right font-bold text-gray-800">${pedidosHoje}</td></tr>
                                <tr class="border-b"><td class="py-2 text-gray-600">Produção Almoço</td><td class="py-2 text-right font-bold text-blue-600">${itensAlmoco} itens</td></tr>
                                <tr class="border-b"><td class="py-2 text-gray-600">Produção Jantar</td><td class="py-2 text-right font-bold text-indigo-600">${itensJantar} itens</td></tr>
                                <tr><td class="py-2 text-gray-600">Estoque Crítico</td><td class="py-2 text-right font-bold text-red-600">${estoqueCritico} produtos</td></tr>
                            </table>
                        </div>

                        <!-- Cards de Destaque -->
                        <div class="bg-orange-50 rounded-lg p-4 border border-orange-100 flex flex-col justify-center items-center text-center">
                            <span class="text-orange-600 text-3xl font-bold">${refeicoesPlanejadas}</span>
                            <span class="text-xs text-orange-800 font-bold uppercase mt-1">Refeições em Produção</span>
                            <span class="text-[10px] text-orange-600 mt-1">Servidas: ${mon.refeicoesHoje}</span>
                        </div>

                        <div class="bg-blue-50 rounded-lg p-4 border border-blue-100 flex flex-col justify-center items-center text-center">
                            <span class="text-blue-600 text-3xl font-bold">${equipePresente}</span>
                            <span class="text-xs text-blue-800 font-bold uppercase mt-1">Equipe Presente</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    // NOVO: QUADRO DE ANIVERSARIANTES
    renderBirthdayBoard: (mon) => {
        const container = document.getElementById('birthday-section');
        if (!container) return;

        const dia = mon.aniversariantes || [];
        const mes = mon.aniversariantesMes || [];
        const proximos = mon.aniversariantesProximos || [];
        const feriasMes = mon.feriasMes || [];
        const monthLabel = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

        // Se não houver nada relevante, esconde a seção para não poluir
        if (dia.length === 0 && mes.length === 0 && proximos.length === 0 && feriasMes.length === 0) {
            container.innerHTML = '';
            return;
        }

        container.innerHTML = `
            <div class="bg-white rounded-lg shadow-sm border border-pink-200 overflow-hidden">
                <div class="bg-pink-50 px-6 py-3 border-b border-pink-100 flex justify-between items-center">
                    <h3 class="font-bold text-lg text-pink-700 flex items-center gap-2"><i class="fas fa-birthday-cake"></i> Alertas de Pessoas</h3>
                    <span class="text-xs font-bold text-pink-700 bg-white px-2 py-1 rounded border border-pink-200">${monthLabel}</span>
                </div>
                <div class="p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                    <!-- Do Dia -->
                    <div class="bg-pink-100 rounded-lg p-4 border border-pink-200 text-center flex flex-col justify-center">
                        <h4 class="font-bold text-pink-800 mb-2 uppercase text-xs">🎉 Hoje!</h4>
                        ${dia.length > 0 ? dia.map(f => `<div class="font-bold text-lg text-pink-900">${f.Nome}</div><div class="text-xs text-pink-700">${f.Departamento || ''}</div>`).join('<hr class="border-pink-200 my-2">') : '<div class="text-sm text-pink-400 italic">Ninguém hoje</div>'}
                    </div>

                    <!-- Próximos 7 Dias -->
                    <div class="bg-white rounded-lg p-4 border border-gray-200">
                        <h4 class="font-bold text-gray-700 mb-3 uppercase text-xs border-b pb-1">⏳ Próximos 7 Dias</h4>
                        <div class="space-y-2">
                            ${proximos.length > 0 ? proximos.map(f => `
                                <div class="flex justify-between items-center text-sm">
                                    <span class="font-medium text-gray-800">${f.Nome}</span>
                                    <span class="text-xs font-bold bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">Faltam ${f.diasFaltam} dias</span>
                                </div>
                            `).join('') : '<div class="text-xs text-gray-400 italic">Nenhum próximo.</div>'}
                        </div>
                    </div>

                    <!-- Do Mês -->
                    <div class="bg-white rounded-lg p-4 border border-gray-200">
                        <h4 class="font-bold text-gray-700 mb-3 uppercase text-xs border-b pb-1">📅 Neste Mês</h4>
                        <div class="max-h-32 overflow-y-auto custom-scrollbar space-y-2">
                            ${mes.length > 0 ? mes.map(f => `
                                <div class="flex justify-between items-center text-sm">
                                    <span class="text-gray-600">${f.Nome}</span>
                                    <span class="text-xs text-gray-400">${new Date(f.Nascimento).getDate()}/${new Date(f.Nascimento).getMonth()+1}</span>
                                </div>
                            `).join('') : '<div class="text-xs text-gray-400 italic">Nenhum neste mês.</div>'}
                        </div>
                    </div>

                    <!-- Férias do Mês -->
                    <div class="bg-blue-50 rounded-lg p-4 border border-blue-200">
                        <h4 class="font-bold text-blue-800 mb-3 uppercase text-xs border-b border-blue-200 pb-1">🏖️ Entrarão de Férias</h4>
                        <div class="max-h-32 overflow-y-auto custom-scrollbar space-y-2">
                            ${feriasMes.length > 0 ? feriasMes.map(f => `
                                <div class="flex justify-between items-center text-sm">
                                    <span class="text-blue-900">${f.FuncionarioNome || f.Nome || 'Funcionário'}</span>
                                    <span class="text-xs text-blue-600 font-bold">${Utils.formatDate(f.DataInicio)}</span>
                                </div>
                            `).join('') : '<div class="text-xs text-blue-500 italic">Nenhuma entrada em férias neste mês.</div>'}
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    // 2. LISTA DE PRODUÇÃO DO DIA
    renderProductionList: (mon) => {
        const container = document.getElementById('production-section');
        if (!container) return;

        const renderList = (title, cat, color) => {
            const list = mon.listasDia.find(l => l.Categoria === cat);
            const items = list && list.ItensJSON ? list.ItensJSON : [];
            const status = list ? list.Status : 'Pendente';
            const statusBadge = status === 'Enviado' 
                ? `<span class="bg-green-100 text-green-800 text-xs px-2 py-1 rounded font-bold">Concluído</span>` 
                : `<span class="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded font-bold">Em andamento</span>`;

            return `
                <div class="bg-white rounded-lg shadow-sm border-t-4 border-${color}-500 overflow-hidden">
                    <div class="p-4 border-b flex justify-between items-center bg-gray-50">
                        <h4 class="font-bold text-gray-800 flex items-center gap-2"><i class="fas fa-utensils text-${color}-500"></i> ${title}</h4>
                        ${statusBadge}
                    </div>
                    <div class="max-h-64 overflow-y-auto">
                        <table class="w-full text-sm text-left">
                            <thead class="bg-gray-50 text-xs uppercase text-gray-500"><tr><th class="p-2 pl-4">Item</th><th class="p-2 text-center">Qtd</th><th class="p-2 text-center">Medida</th></tr></thead>
                            <tbody class="divide-y">
                                ${items.map(i => `
                                    <tr>
                                        <td class="p-2 pl-4 font-medium">${i.nome}</td>
                                        <td class="p-2 text-center font-bold">${i.qtd}</td>
                                        <td class="p-2 text-center text-xs text-gray-500">${i.unidade}</td>
                                    </tr>
                                `).join('')}
                                ${items.length === 0 ? '<tr><td colspan="3" class="p-4 text-center text-gray-400 italic">Nenhum item listado.</td></tr>' : ''}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        };

        container.innerHTML = `
            ${renderList('Produção do Almoço', 'Almoço', 'orange')}
            ${renderList('Produção do Jantar', 'Jantar', 'indigo')}
        `;
    },

    // 3. ESTOQUE RÁPIDO
    renderStockQuick: (mon) => {
        const container = document.getElementById('stock-section');
        if (!container) return;

        const criticos = mon.estoqueBaixo || [];
        const vencendo = mon.estoqueVencendo || [];

        container.innerHTML = `
            <div class="bg-white rounded-lg shadow-sm border border-red-100">
                <div class="p-3 border-b border-red-100 bg-red-50 flex justify-between items-center">
                    <h4 class="font-bold text-red-800 text-sm"><i class="fas fa-box-open mr-2"></i> Estoque Rápido</h4>
                    <span class="text-xs bg-white px-2 py-0.5 rounded border border-red-200 text-red-600 font-bold">${criticos.length + vencendo.length} alertas</span>
                </div>
                <div class="p-3 space-y-2 max-h-64 overflow-y-auto">
                    ${criticos.slice(0, 5).map(i => `
                        <div class="flex justify-between items-center text-sm">
                            <span class="text-gray-700"><i class="fas fa-exclamation-triangle text-red-500 mr-1"></i> ${i.Nome}</span>
                            <span class="font-bold text-red-600">${i.Quantidade} ${i.Unidade}</span>
                        </div>
                    `).join('')}
                    ${vencendo.slice(0, 3).map(i => {
                        const diff = Math.ceil((new Date(i.Validade) - new Date()) / (1000 * 60 * 60 * 24));
                        return `
                        <div class="flex justify-between items-center text-sm">
                            <span class="text-gray-700"><i class="fas fa-hourglass-half text-yellow-500 mr-1"></i> ${i.Nome}</span>
                            <span class="font-bold text-yellow-600 text-xs">Vence em ${diff} dias</span>
                        </div>`;
                    }).join('')}
                    ${(criticos.length === 0 && vencendo.length === 0) ? '<div class="text-center text-gray-400 text-xs">Estoque regular.</div>' : ''}
                </div>
            </div>
        `;
    },

    // 4. ITENS RECEBIDOS HOJE
    renderReceiving: (mon) => {
        const container = document.getElementById('receiving-section');
        if (!container) return;

        const entradas = mon.entradasHoje || [];

        container.innerHTML = `
            <div class="bg-white rounded-lg shadow-sm border border-green-100">
                <div class="p-3 border-b border-green-100 bg-green-50 flex justify-between items-center">
                    <h4 class="font-bold text-green-800 text-sm"><i class="fas fa-truck mr-2"></i> Recebidos Hoje</h4>
                    <span class="text-xs bg-white px-2 py-0.5 rounded border border-green-200 text-green-600 font-bold">${entradas.length} itens</span>
                </div>
                <div class="max-h-64 overflow-y-auto">
                    <table class="w-full text-xs text-left">
                        <tbody class="divide-y">
                            ${entradas.map(e => `
                                <tr>
                                    <td class="p-2">
                                        <div class="font-bold text-gray-700">${e.Estoque ? e.Estoque.Nome : 'Item'}</div>
                                        <div class="text-gray-500">${e.Estoque ? e.Estoque.Fornecedor : '-'}</div>
                                    </td>
                                    <td class="p-2 text-right font-bold text-green-700">+${e.Quantidade}</td>
                                </tr>
                            `).join('')}
                            ${entradas.length === 0 ? '<tr><td colspan="2" class="p-4 text-center text-gray-400">Nenhuma entrada hoje.</td></tr>' : ''}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    },

    // 5. EVENTOS & PEDIDOS
    renderEventsOrders: (mon) => {
        const container = document.getElementById('events-orders-section');
        if (!container) return;

        const pendentes = mon.pedidosCompra.length;
        const eventosHoje = mon.eventos.filter(e => e.Data === new Date().toISOString().split('T')[0]);
        const proximos = mon.eventos.filter(e => e.Data > new Date().toISOString().split('T')[0]);

        container.innerHTML = `
            <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <h3 class="font-bold text-gray-800 mb-4 flex items-center gap-2"><i class="fas fa-calendar-check text-purple-600"></i> Eventos & Pedidos</h3>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div class="bg-purple-50 p-3 rounded border border-purple-100 text-center">
                        <span class="block text-2xl font-bold text-purple-700">${pendentes}</span>
                        <span class="text-xs font-bold text-purple-800 uppercase">Pedidos Pendentes</span>
                    </div>
                    <div class="col-span-2">
                        <h5 class="text-xs font-bold text-gray-500 uppercase mb-2">Próximos Eventos</h5>
                        <div class="space-y-2">
                            ${[...eventosHoje, ...proximos].slice(0, 3).map(e => `
                                <div class="flex justify-between items-center text-sm border-b pb-1 last:border-0">
                                    <span class="font-medium text-gray-700">${e.Titulo}</span>
                                    <span class="text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-600">${Utils.formatDate(e.Data)}</span>
                                </div>
                            `).join('')}
                            ${(eventosHoje.length + proximos.length) === 0 ? '<div class="text-xs text-gray-400 italic">Nenhum evento próximo.</div>' : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    // 6. FINANÇAS
    renderFinance: (kpis, dre, mon) => {
        const container = document.getElementById('finance-section');
        if (!container) return;

        // Dados do dia (simulados ou reais se houver transações hoje)
        // Para "Receita Hoje" e "Custo Hoje", precisaríamos filtrar as transações do dia.
        // Como getDashboardStats já processa o mês, vamos usar os KPIs mensais e A Receber/Pagar Hoje.
        
        container.innerHTML = `
            <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div class="flex justify-between items-center mb-6">
                    <h3 class="font-bold text-gray-800 flex items-center gap-2"><i class="fas fa-coins text-green-600"></i> Finanças (Controle Diário)</h3>
                    <span class="text-xs bg-green-100 text-green-800 px-3 py-1 rounded-full font-bold">Mês Atual</span>
                </div>
                
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div class="p-3 bg-gray-50 rounded border">
                        <div class="text-xs text-gray-500 uppercase font-bold">Receita (Mês)</div>
                        <div class="text-lg font-bold text-green-600">${Utils.formatCurrency(kpis.receitaMensal)}</div>
                    </div>
                    <div class="p-3 bg-gray-50 rounded border">
                        <div class="text-xs text-gray-500 uppercase font-bold">Despesas (Mês)</div>
                        <div class="text-lg font-bold text-red-600">${Utils.formatCurrency(kpis.despesaMensal)}</div>
                    </div>
                    <div class="p-3 bg-gray-50 rounded border">
                        <div class="text-xs text-gray-500 uppercase font-bold">Lucro Líquido</div>
                        <div class="text-lg font-bold ${kpis.lucroLiquido >= 0 ? 'text-blue-600' : 'text-red-600'}">${Utils.formatCurrency(kpis.lucroLiquido)}</div>
                    </div>
                    <div class="p-3 bg-blue-50 rounded border border-blue-100">
                        <div class="text-xs text-blue-800 uppercase font-bold">A Receber (Hoje)</div>
                        <div class="text-lg font-bold text-blue-700">${Utils.formatCurrency(kpis.aReceberHoje)}</div>
                    </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm border-t pt-4">
                    <div class="flex justify-between"><span>📉 Custo Produção (Est.):</span> <span class="font-bold text-gray-700">${Utils.formatCurrency(dre.cmv)}</span></div>
                    <div class="flex justify-between"><span>📈 Receita Bruta:</span> <span class="font-bold text-gray-700">${Utils.formatCurrency(dre.receitaBruta)}</span></div>
                    <div class="flex justify-between"><span>💵 Lucro Estimado:</span> <span class="font-bold text-green-600">${Utils.formatCurrency(dre.lucroBruto)}</span></div>
                </div>
            </div>
        `;
    },

    // 7. DESPERDÍCIO
    renderWaste: (mon) => {
        const container = document.getElementById('waste-section');
        if (!container) return;

        const today = new Date().toISOString().split('T')[0];
        const wasteToday = mon.desperdicio.filter(d => d.Data.startsWith(today));
        const totalWaste = wasteToday.reduce((acc, d) => acc + Number(d.Quantidade), 0);

        container.innerHTML = `
            <div class="bg-white rounded-lg shadow-sm border border-red-100 p-4 h-full">
                <h3 class="font-bold text-gray-800 mb-4 flex items-center gap-2"><i class="fas fa-trash-alt text-red-500"></i> Desperdício Hoje</h3>
                <div class="flex items-center justify-between mb-4">
                    <div class="text-3xl font-bold text-red-600">${totalWaste} <span class="text-sm text-gray-500 font-normal">itens</span></div>
                    <div class="text-xs text-right text-gray-500">Reduza perdas para<br>aumentar o lucro.</div>
                </div>
                <div class="space-y-2 max-h-40 overflow-y-auto">
                    ${wasteToday.map(w => `
                        <div class="flex justify-between text-xs border-b pb-1">
                            <span>${w.Item}</span>
                            <span class="text-red-500 font-bold">${w.Quantidade} (${w.Motivo})</span>
                        </div>
                    `).join('')}
                    ${wasteToday.length === 0 ? '<div class="text-center text-green-600 text-xs font-bold py-2">Zero desperdício hoje! 👏</div>' : ''}
                </div>
            </div>
        `;
    },

    // 8. RH
    renderRH: (mon, kpis) => {
        const container = document.getElementById('rh-section');
        if (!container) return;

        const presentes = mon.frequencia.filter(f => f.Status === 'Presente').length;
        const ferias = mon.ferias.length;
        const total = kpis.totalFuncionarios;

        container.innerHTML = `
            <div class="bg-white rounded-lg shadow-sm border border-blue-100 p-4 h-full">
                <h3 class="font-bold text-gray-800 mb-4 flex items-center gap-2"><i class="fas fa-users text-blue-600"></i> RH — Equipe Hoje</h3>
                <div class="grid grid-cols-3 gap-2 mb-4 text-center">
                    <div class="bg-gray-50 p-2 rounded">
                        <div class="text-xl font-bold text-gray-700">${total}</div>
                        <div class="text-[10px] text-gray-500 uppercase">Cadastrados</div>
                    </div>
                    <div class="bg-yellow-50 p-2 rounded">
                        <div class="text-xl font-bold text-yellow-700">${ferias}</div>
                        <div class="text-[10px] text-yellow-600 uppercase">Férias</div>
                    </div>
                    <div class="bg-green-50 p-2 rounded">
                        <div class="text-xl font-bold text-green-700">${presentes}</div>
                        <div class="text-[10px] text-green-600 uppercase">Presentes</div>
                    </div>
                </div>
                <div class="text-xs text-gray-500">
                    <p>Turno Manhã: <span class="font-bold text-gray-700">${mon.frequencia.filter(f => f.Entrada && f.Entrada < '12:00').length}</span></p>
                    <p>Turno Noite: <span class="font-bold text-gray-700">${mon.frequencia.filter(f => f.Entrada && f.Entrada >= '12:00').length}</span></p>
                </div>
            </div>
        `;
    },

    // 9. ML PAIN
    renderMLPain: (mon) => {
        const container = document.getElementById('mlpain-section');
        if (!container) return;

        const diets = mon.dietasHoje || [];
        const totalDiets = diets.reduce((acc, d) => acc + Number(d.Quantidade), 0);
        const special = diets.filter(d => d.Subtipo !== 'Geral').reduce((acc, d) => acc + Number(d.Quantidade), 0);

        container.innerHTML = `
            <div class="bg-white rounded-lg shadow-sm border border-green-200 p-4 flex justify-between items-center">
                <div>
                    <h3 class="font-bold text-gray-800 flex items-center gap-2"><i class="fas fa-heartbeat text-green-600"></i> M.L. Pain — Dietas</h3>
                    <p class="text-xs text-gray-500">Controle de Pacientes e Dietas</p>
                </div>
                <div class="flex gap-6 text-center">
                    <div><span class="block text-xl font-bold text-gray-800">${totalDiets}</span><span class="text-xs text-gray-500 uppercase">Dietas Hoje</span></div>
                    <div><span class="block text-xl font-bold text-red-600">${special}</span><span class="text-xs text-gray-500 uppercase">Especiais</span></div>
                </div>
            </div>
        `;
    },

    // 11. ALERTAS
    renderAlerts: (mon) => {
        const container = document.getElementById('alerts-section');
        if (!container) return;

        const alerts = [];
        if (mon.estoqueBaixo.length > 0) alerts.push({ icon: 'fa-box', text: `${mon.estoqueBaixo.length} produtos com estoque crítico`, color: 'red' });
        if (mon.estoqueVencendo && mon.estoqueVencendo.length > 0) alerts.push({ icon: 'fa-hourglass-end', text: `${mon.estoqueVencendo.length} produtos vencendo`, color: 'yellow' });
        if (mon.pedidosCompra.length > 0) alerts.push({ icon: 'fa-shopping-cart', text: `${mon.pedidosCompra.length} pedidos de compra pendentes`, color: 'yellow' });

        const aniversariantesMes = mon.aniversariantesMes || [];
        const aniversariantesProximos = mon.aniversariantesProximos || [];
        if (aniversariantesMes.length > 0) {
            const proximoNiver = aniversariantesProximos[0];
            const detalheProximo = proximoNiver ? ` • Próximo: ${proximoNiver.Nome} em ${proximoNiver.diasFaltam} dia(s)` : '';
            alerts.push({
                icon: 'fa-birthday-cake',
                text: `${aniversariantesMes.length} aniversariantes neste mês${detalheProximo}`,
                color: 'pink',
                ctaRhRelatorios: true
            });
        }

        const feriasMes = (mon.feriasMes || []).slice().sort((a, b) => new Date(a.DataInicio) - new Date(b.DataInicio));
        if (feriasMes.length > 0) {
            const proximaFerias = feriasMes[0];
            const nome = proximaFerias.FuncionarioNome || proximaFerias.Nome || 'Funcionário';
            const detalheProximo = proximaFerias.DataInicio ? ` • Próxima: ${nome} (${Utils.formatDate(proximaFerias.DataInicio)})` : '';
            alerts.push({
                icon: 'fa-umbrella-beach',
                text: `${feriasMes.length} colaboradores entrarão de férias neste mês${detalheProximo}`,
                color: 'blue',
                ctaRhRelatorios: true
            });
        }
        
        // Check for absent employees
        const faltas = mon.frequencia.filter(f => f.Status === 'Falta').length;
        if (faltas > 0) alerts.push({ icon: 'fa-user-times', text: `${faltas} funcionários ausentes hoje`, color: 'red' });

        container.innerHTML = `
            <div class="bg-white rounded-lg shadow-sm border border-red-100 h-full">
                <div class="p-3 border-b border-red-100 bg-red-50">
                    <h3 class="font-bold text-red-800 flex items-center gap-2"><i class="fas fa-bell"></i> Alertas Automáticos</h3>
                </div>
                <div class="p-4 space-y-3">
                    ${alerts.map(a => `
                        <div class="flex items-start gap-3 text-sm text-gray-700">
                            <div class="w-8 h-8 rounded-full bg-${a.color}-100 flex items-center justify-center text-${a.color}-600"><i class="fas ${a.icon}"></i></div>
                            <div class="flex-1">
                                <div>${a.text}</div>
                                ${a.ctaRhRelatorios ? `<button onclick="DashboardModule.goToRHReports()" class="mt-1 text-xs font-bold text-blue-600 hover:text-blue-800">Abrir RH Relatórios</button>` : ''}
                            </div>
                        </div>
                    `).join('')}
                    ${alerts.length === 0 ? '<div class="text-center text-gray-400 text-sm">Nenhum alerta crítico.</div>' : ''}
                </div>
            </div>
        `;
    },

    goToRHReports: () => {
        window.location.href = 'rh.html?tab=relatorios';
    },

    renderQuadroAvisos: (avisos) => {
        if (!avisos) avisos = []; // Garante array vazio se nulo

        let section = document.getElementById('quadro-avisos-section');
        if (!section) return;
        section.className = 'mb-6';

        const canCreate = Utils.checkPermission('Dashboard', 'criar') || Utils.getUser().Cargo === 'Administrador';

        let html = `
            <div class="bg-white rounded-lg shadow-sm border border-blue-100 overflow-hidden">
                <div class="bg-blue-50 px-4 py-3 border-b border-blue-100 flex justify-between items-center">
                    <h3 class="font-bold text-blue-800 flex items-center gap-2"><i class="fas fa-bullhorn"></i> Quadro de Avisos da Equipe</h3>
                    ${canCreate ? `<button onclick="DashboardModule.modalAviso()" class="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 transition">+ Novo Aviso</button>` : ''}
                </div>
                <div class="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        `;

        if (avisos && avisos.length > 0) {
            avisos.forEach(a => {
                const isHigh = a.Prioridade === 'Alta';
                html += `
                    <div class="border rounded-lg p-3 relative ${isHigh ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}">
                        ${isHigh ? '<span class="absolute top-2 right-2 text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full">URGENTE</span>' : ''}
                        <h4 class="font-bold text-gray-800 mb-1 pr-16">${a.Titulo}</h4>
                        <p class="text-sm text-gray-600 mb-3 whitespace-pre-wrap">${a.Mensagem || ''}</p>
                        
                        ${a.Anexo ? `<div class="mb-3">
                            ${a.Anexo.startsWith('data:image') 
                                ? `<img src="${a.Anexo}" class="h-20 w-auto rounded border cursor-pointer" onclick="Utils.openModal('Anexo', '<img src=\\'${a.Anexo}\\' class=\\'max-w-full\\'>')">` 
                                : `<a href="${a.Anexo}" download="anexo_aviso" class="text-xs text-blue-600 hover:underline"><i class="fas fa-paperclip"></i> Baixar Anexo</a>`}
                        </div>` : ''}

                        <div class="flex justify-between items-end text-xs text-gray-400 border-t pt-2 ${isHigh ? 'border-red-200' : 'border-gray-200'}">
                            <span>Por: <b>${a.Autor}</b></span>
                            <span>${Utils.formatDate(a.CriadoEm)}</span>
                        </div>
                        ${canCreate ? `<button onclick="DashboardModule.deleteAviso('${a.ID}')" class="absolute bottom-2 right-2 text-gray-400 hover:text-red-500"><i class="fas fa-trash"></i></button>` : ''}
                    </div>
                `;
            });
        } else {
            html += `<div class="col-span-3 text-center text-gray-400 py-4 italic">Nenhum aviso recente.</div>`;
        }

        html += `
                </div>
            </div>
        `;
        section.innerHTML = html;
    },

    // --- TAREFAS DA EQUIPE ---
    loadTarefas: async () => {
        try {
            const tarefas = await Utils.api('getTasks');
            DashboardModule.state.tasks = tarefas || [];
            DashboardModule.renderTarefas(DashboardModule.state.tasks);
        } catch (e) { console.error('Erro ao carregar tarefas', e); }
    },

    renderTarefas: (tarefas) => {
        let section = document.getElementById('tarefas-section');
        if (!section) return;
        section.className = 'mb-6 grid grid-cols-1 lg:grid-cols-3 gap-6';

        const canCreate = Utils.checkPermission('Dashboard', 'criar') || true; // Aberto para equipe

        const renderList = (list, title, color) => `
            <div class="bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col h-96">
                <div class="p-3 border-b border-gray-100 flex justify-between items-center bg-${color}-50">
                    <h4 class="font-bold text-${color}-700 text-sm uppercase">${title} (${list.length})</h4>
                    ${title === 'Pendentes' && canCreate ? `<button onclick="DashboardModule.modalTarefa()" class="text-xs bg-${color}-600 text-white px-2 py-1 rounded hover:opacity-90"><i class="fas fa-plus"></i></button>` : ''}
                </div>
                <div class="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
                    ${list.map(t => {
                        const priorityColor = t.Prioridade === 'Alta' ? 'text-red-600 bg-red-50' : (t.Prioridade === 'Média' ? 'text-yellow-600 bg-yellow-50' : 'text-green-600 bg-green-50');
                        return `
                        <div class="bg-white border rounded p-2 hover:shadow-md transition group relative">
                            <div class="flex justify-between items-start mb-1">
                                <span class="text-xs font-bold px-1.5 py-0.5 rounded ${priorityColor}">${t.Prioridade}</span>
                                <span class="text-[10px] text-gray-400">${t.Prazo ? Utils.formatDate(t.Prazo) : 'Sem prazo'}</span>
                            </div>
                            <p class="text-sm font-bold text-gray-800 leading-tight mb-1">${t.Titulo}</p>
                            <p class="text-xs text-gray-500 mb-2">${t.Responsavel || 'Equipe'}</p>
                            
                            <div class="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition">
                                ${t.Status !== 'Concluída' ? `<button onclick="DashboardModule.moveTarefa('${t.ID}', '${t.Status === 'Pendente' ? 'Em Andamento' : 'Concluída'}')" class="text-green-600 hover:text-green-800" title="Avançar"><i class="fas fa-arrow-right"></i></button>` : ''}
                                <button onclick="DashboardModule.modalTarefa('${t.ID}')" class="text-blue-600 hover:text-blue-800"><i class="fas fa-edit"></i></button>
                                <button onclick="DashboardModule.deleteTarefa('${t.ID}')" class="text-red-500 hover:text-red-700"><i class="fas fa-trash"></i></button>
                            </div>
                        </div>
                        `;
                    }).join('')}
                    ${list.length === 0 ? '<div class="text-center text-gray-400 text-xs py-4">Vazio</div>' : ''}
                </div>
            </div>
        `;

        const pendentes = tarefas.filter(t => t.Status === 'Pendente');
        const andamento = tarefas.filter(t => t.Status === 'Em Andamento');
        const concluidas = tarefas.filter(t => t.Status === 'Concluída');

        section.innerHTML = `
            ${renderList(pendentes, 'Pendentes', 'gray')}
            ${renderList(andamento, 'Em Andamento', 'blue')}
            ${renderList(concluidas, 'Concluídas', 'green')}
        `;
    },

    modalTarefa: async (id = null) => {
        let tarefa = {};
        if (id) {
            if (!DashboardModule.state.tasks || DashboardModule.state.tasks.length === 0) {
                DashboardModule.state.tasks = await Utils.api('getTasks') || [];
            }
            tarefa = (DashboardModule.state.tasks || []).find(t => t.ID === id) || {};
        }
        const user = Utils.getUser();

        Utils.openModal(id ? 'Editar Tarefa' : 'Nova Tarefa', `
            <form onsubmit="DashboardModule.saveTarefa(event)">
                <input type="hidden" name="ID" value="${tarefa.ID || ''}">
                <input type="hidden" name="Status" value="${tarefa.Status || 'Pendente'}">
                <div class="mb-3">
                    <label class="text-xs font-bold">Título</label>
                    <input name="Titulo" value="${tarefa.Titulo || ''}" class="border p-2 rounded w-full" required>
                </div>
                <div class="grid grid-cols-2 gap-3 mb-3">
                    <div><label class="text-xs font-bold">Responsável</label><input name="Responsavel" value="${tarefa.Responsavel || user.Nome}" class="border p-2 rounded w-full"></div>
                    <div><label class="text-xs font-bold">Prazo</label><input type="date" name="Prazo" value="${tarefa.Prazo || ''}" class="border p-2 rounded w-full"></div>
                </div>
                <div class="mb-3">
                    <label class="text-xs font-bold">Prioridade</label>
                    <select name="Prioridade" class="border p-2 rounded w-full">
                        <option ${tarefa.Prioridade === 'Baixa' ? 'selected' : ''}>Baixa</option>
                        <option ${tarefa.Prioridade === 'Média' ? 'selected' : ''}>Média</option>
                        <option ${tarefa.Prioridade === 'Alta' ? 'selected' : ''}>Alta</option>
                    </select>
                </div>
                <div class="mb-3">
                    <label class="text-xs font-bold">Descrição</label>
                    <textarea name="Descricao" class="border p-2 rounded w-full h-20">${tarefa.Descricao || ''}</textarea>
                </div>
                <button class="w-full bg-blue-600 text-white py-2 rounded font-bold">Salvar Tarefa</button>
            </form>
        `);
    },

    renderCharts: (charts) => {
        if (!charts) return;

        // Destruir gráficos anteriores
        if (DashboardModule.charts.financeiro) DashboardModule.charts.financeiro.destroy();

        DashboardModule.charts.financeiro = new Chart(document.getElementById('chartFinanceiro'), {
            type: 'line',
            data: {
                labels: charts.financeiro.labels,
                datasets: [
                    { label: 'Receitas', data: charts.financeiro.receitas, borderColor: '#10B981', tension: 0.1, backgroundColor: 'rgba(16, 185, 129, 0.1)', fill: true },
                    { label: 'Despesas', data: charts.financeiro.despesas, borderColor: '#EF4444', tension: 0.1, backgroundColor: 'rgba(239, 68, 68, 0.1)', fill: true }
                ]
            }
        });

        if (DashboardModule.charts.lucratividade) DashboardModule.charts.lucratividade.destroy();

        // Gráfico de Lucratividade
        if (charts.lucratividade && document.getElementById('chartLucratividade')) {
            DashboardModule.charts.lucratividade = new Chart(document.getElementById('chartLucratividade'), {
                type: 'bar',
                data: {
                    labels: charts.lucratividade.labels,
                    datasets: [{
                        label: 'Lucro Líquido',
                        data: charts.lucratividade.data,
                        backgroundColor: charts.lucratividade.data.map(v => v >= 0 ? '#10B981' : '#EF4444'),
                        borderRadius: 4
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
            });
        }

        if (DashboardModule.charts.atendimento) DashboardModule.charts.atendimento.destroy();

        // Gráfico Atendimento (Categorias)
        if (charts.pratos && document.getElementById('chartAtendimento')) {
            DashboardModule.charts.atendimento = new Chart(document.getElementById('chartAtendimento'), {
                type: 'doughnut',
                data: {
                    labels: charts.pratos.labels,
                    datasets: [{
                        data: charts.pratos.data,
                        backgroundColor: ['#F59E0B', '#3B82F6', '#10B981', '#6366F1', '#8B5CF6']
                    }]
                }
            });
        }

        if (DashboardModule.charts.refeicoes) DashboardModule.charts.refeicoes.destroy();

        // Gráfico Refeições (Barras)
        if (charts.refeicoes && document.getElementById('chartRefeicoes')) {
            DashboardModule.charts.refeicoes = new Chart(document.getElementById('chartRefeicoes'), {
                type: 'bar',
                data: {
                    labels: charts.refeicoes.labels,
                    datasets: [{
                        label: 'Refeições Servidas',
                        data: charts.refeicoes.data,
                        backgroundColor: '#F59E0B',
                        borderRadius: 4
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
            });
        }

        // Gráfico Departamentos (Novo)
        if (charts.departamentos && document.getElementById('chartDepartamentos')) {
            if (DashboardModule.charts.departamentos) DashboardModule.charts.departamentos.destroy();
            DashboardModule.charts.departamentos = new Chart(document.getElementById('chartDepartamentos'), {
                type: 'pie',
                data: {
                    labels: charts.departamentos.labels,
                    datasets: [{ data: charts.departamentos.data, backgroundColor: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'] }]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } }
            });
        }
    },

    modalAviso: () => {
        Utils.openModal('Novo Aviso', `
            <form onsubmit="DashboardModule.saveAviso(event)">
                <div class="mb-3">
                    <label class="block text-xs font-bold mb-1">Título</label>
                    <input name="Titulo" class="border p-2 rounded w-full" required placeholder="Ex: Reunião Geral">
                </div>
                <div class="mb-3">
                    <label class="block text-xs font-bold mb-1">Mensagem</label>
                    <textarea name="Mensagem" class="border p-2 rounded w-full h-24" required></textarea>
                </div>
                <div class="grid grid-cols-2 gap-3 mb-3">
                    <div>
                        <label class="block text-xs font-bold mb-1">Prioridade</label>
                        <select name="Prioridade" class="border p-2 rounded w-full">
                            <option>Normal</option>
                            <option>Alta</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-xs font-bold mb-1">Anexo (Opcional)</label>
                        <input type="file" id="aviso-file" class="border p-1 rounded w-full text-xs">
                    </div>
                </div>
                <button class="w-full bg-blue-600 text-white py-2 rounded font-bold">Publicar Aviso</button>
            </form>
        `);
    },

    saveAviso: async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target).entries());
        const user = Utils.getUser();
        data.Autor = user.Nome;

        const fileInput = document.getElementById('aviso-file');
        if (fileInput.files.length > 0) {
            const reader = new FileReader();
            reader.readAsDataURL(fileInput.files[0]);
            reader.onload = async () => {
                data.Anexo = reader.result;
                await DashboardModule.submitAviso(data);
            };
        } else {
            await DashboardModule.submitAviso(data);
        }
    },

    submitAviso: async (data) => {
        try {
            await Utils.api('save', 'QuadroAvisos', data);
            Utils.toast('Aviso publicado!', 'success');
            Utils.closeModal();
            DashboardModule.loadData();
        } catch (err) { Utils.toast('Erro ao publicar.', 'error'); }
    },

    deleteAviso: async (id) => {
        if(confirm('Remover este aviso?')) {
            try {
                await Utils.api('delete', 'QuadroAvisos', null, id);
                DashboardModule.loadData();
            } catch (e) { Utils.toast('Erro ao remover.', 'error'); }
        }
    },

    saveTarefa: async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target).entries());
        try {
            await Utils.api('save', 'Tarefas', data);
            Utils.toast('Tarefa salva!', 'success'); Utils.closeModal(); DashboardModule.loadTarefas();
        } catch (err) { Utils.toast('Erro ao salvar.', 'error'); }
    },

    moveTarefa: async (id, status) => {
        try {
            await Utils.api('save', 'Tarefas', { ID: id, Status: status });
            DashboardModule.loadTarefas();
        } catch (e) { Utils.toast('Erro ao mover.', 'error'); }
    },

    deleteTarefa: async (id) => {
        if(confirm('Excluir tarefa?')) { try { await Utils.api('delete', 'Tarefas', null, id); DashboardModule.loadTarefas(); } catch(e) { Utils.toast('Erro.', 'error'); } }
    }
};

document.addEventListener('DOMContentLoaded', DashboardModule.init);

