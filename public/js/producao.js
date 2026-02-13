// c:\Users\USER\OneDrive\EMPRESAS\DELÍCIAS DA CIDADE\DELICIA DA CIDADE\public\js\producao.js

const ProducaoModule = {
    state: {
        activeTab: 'pedidos_dia', // pedidos_dia, cardapios, estoque, eventos
        
        // Dados Carregados
        pedidosDia: [],      // PlanejamentoProducao / production_plans
        cardapios: [],       // FichasTecnicas
        estoque: [],         // Estoque
        eventos: [],         // Eventos (Confirmados)
        ordens: [],          // Ordens de Produção (Status)
        filterOrdensStatus: '', // Filtro de status para Ordens
        desperdicio: [],     // Controle de Desperdício
        instituicao: [],     // Configurações da Instituição (Logo, Nome)
        charts: {},          // Gráficos
        
        // Auxiliares de UI
        isLoading: false,
        filterDate: new Date().toISOString().split('T')[0]
    },

    init: () => {
        ProducaoModule.renderLayout();
        ProducaoModule.fetchData();
    },

    fetchData: async () => {
        ProducaoModule.state.isLoading = true;
        ProducaoModule.render(); 

        try {
            const [plans, fichas, estoque, eventos, ordens, desp, inst] = await Promise.all([
                Utils.api('getAll', 'production_plans'),
                Utils.api('getAll', 'FichasTecnicas'),
                Utils.api('getAll', 'Estoque'),
                Utils.api('getAll', 'Eventos'),
                Utils.api('getAll', 'OrdensProducao'),
                Utils.api('getAll', 'ControleDesperdicio'),
                Utils.api('getAll', 'InstituicaoConfig')
            ]);
            
            ProducaoModule.state.pedidosDia = plans || [];
            ProducaoModule.state.cardapios = fichas || [];
            ProducaoModule.state.estoque = estoque || [];
            ProducaoModule.state.eventos = (eventos || []).filter(e => e.Status === 'Confirmado' || e.Status === 'Em Execução');
            ProducaoModule.state.ordens = ordens || [];
            ProducaoModule.state.desperdicio = desp || [];
            ProducaoModule.state.instituicao = inst || [];

        } catch (e) {
            console.error(e);
            Utils.toast('Erro ao carregar dados de produção.', 'error');
        } finally {
            ProducaoModule.state.isLoading = false;
            ProducaoModule.render();
        }
    },

    renderLayout: () => {
        const container = document.getElementById('producao-content');
        if (!container) return;

        container.innerHTML = `
            <!-- Cabeçalho do Módulo de Cozinha -->
            <div class="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6">
                <div class="flex flex-col md:flex-row justify-between items-center gap-4">
                    <div>
                        <h2 class="text-2xl font-bold text-gray-800 flex items-center gap-2">
                            <i class="fas fa-fire-burner text-orange-600"></i> Produção & Cozinha
                        </h2>
                        <p class="text-sm text-gray-500">Gestão operacional da cozinha industrial</p>
                    </div>
                    
                    <!-- Navegação Principal (4 Submenus) -->
                    <div class="flex bg-gray-100 p-1 rounded-lg overflow-x-auto">
                        <button onclick="ProducaoModule.setTab('pedidos_dia')" id="btn-pedidos_dia" class="px-4 py-2 text-sm font-medium rounded-md transition-all whitespace-nowrap">
                            <i class="fas fa-utensils mr-2"></i>Pedidos do Dia
                        </button>
                        <button onclick="ProducaoModule.setTab('ordens')" id="btn-ordens" class="px-4 py-2 text-sm font-medium rounded-md transition-all whitespace-nowrap">
                            <i class="fas fa-clipboard-list mr-2"></i>Ordens (OP)
                        </button>
                        <button onclick="ProducaoModule.setTab('cardapios')" id="btn-cardapios" class="px-4 py-2 text-sm font-medium rounded-md transition-all whitespace-nowrap">
                            <i class="fas fa-book-open mr-2"></i>Receitas
                        </button>
                        <button onclick="ProducaoModule.setTab('estoque')" id="btn-estoque" class="px-4 py-2 text-sm font-medium rounded-md transition-all whitespace-nowrap">
                            <i class="fas fa-boxes mr-2"></i>Ingredientes
                        </button>
                        <button onclick="ProducaoModule.setTab('eventos')" id="btn-eventos" class="px-4 py-2 text-sm font-medium rounded-md transition-all whitespace-nowrap">
                            <i class="fas fa-calendar-check mr-2"></i>Eventos
                        </button>
                        <button onclick="ProducaoModule.setTab('relatorios')" id="btn-relatorios" class="px-4 py-2 text-sm font-medium rounded-md transition-all whitespace-nowrap">
                            <i class="fas fa-chart-pie mr-2"></i>Relatórios
                        </button>
                    </div>
                </div>
            </div>

            <!-- Área de Conteúdo -->
            <div id="tab-content"></div>
        `;
    },

    setTab: (tab) => {
        ProducaoModule.state.activeTab = tab;
        ProducaoModule.render();
    },

    render: () => {
        // Atualiza botões ativos
        const tab = ProducaoModule.state.activeTab;
        const buttons = ['pedidos_dia', 'ordens', 'cardapios', 'estoque', 'eventos', 'relatorios'];
        
        buttons.forEach(btn => {
            const el = document.getElementById(`btn-${btn}`);
            if (el) {
                if (btn === tab) {
                    el.className = 'px-4 py-2 text-sm font-bold rounded-md transition-all bg-white text-orange-600 shadow-sm';
                } else {
                    el.className = 'px-4 py-2 text-sm font-medium rounded-md transition-all text-gray-500 hover:text-gray-700 hover:bg-gray-200';
                }
            }
        });

        // Renderiza Conteúdo
        const container = document.getElementById('tab-content');
        if (tab === 'pedidos_dia') ProducaoModule.renderPedidosDia(container);
        else if (tab === 'ordens') ProducaoModule.renderOrdens(container);
        else if (tab === 'cardapios') ProducaoModule.renderCardapios(container);
        else if (tab === 'estoque') ProducaoModule.renderEstoque(container);
        else if (tab === 'eventos') ProducaoModule.renderEventos(container);
        else if (tab === 'relatorios') ProducaoModule.renderRelatorios(container);
    },

    // -------------------------------------------------------------------------
    // 1. PEDIDOS DO DIA (Refeições Normais)
    // -------------------------------------------------------------------------
    renderPedidosDia: (container) => {
        const date = ProducaoModule.state.filterDate;
        const plans = ProducaoModule.state.pedidosDia.filter(p => p.planning_date === date);
        const eventos = ProducaoModule.state.eventos.filter(e => e.Data.startsWith(date));
        const ordens = ProducaoModule.state.ordens || [];
        
        const hasPlan = plans.length > 0;
        const plan = hasPlan ? plans[0] : null;

        // --- 1. CONSTRUÇÃO DA TABELA UNIFICADA (DASHBOARD) ---
        const dashboardRows = [];

        // Adiciona Pedido de Rotina (Se houver)
        if (plan) {
            const ordem = ordens.find(o => o.PlanejamentoID === plan.id || (o.DetalhesJSON && o.DetalhesJSON.PlanejamentoID === plan.id));
            const status = ordem ? ordem.Status : 'Planejado';
            const totalPessoas = (plan.staff_count_day || 0) + (plan.staff_count_night || 0) + (plan.patient_solid || 0) + (plan.patient_liquid || 0);
            
            dashboardRows.push({
                tipo: 'Pedido (Rotina)',
                cliente: 'Hospital / Staff',
                pessoas: `${totalPessoas} refeições`,
                status: status,
                id: plan.id,
                isEvent: false
            });
        }

        // Adiciona Eventos do Dia
        eventos.forEach(e => {
            const ordem = ordens.find(o => o.EventoID === e.ID);
            const status = ordem ? ordem.Status : (e.Status === 'Confirmado' ? 'Aguardando OP' : e.Status);
            
            dashboardRows.push({
                tipo: 'Evento',
                cliente: e.Titulo,
                pessoas: `${e.Pessoas || 0} pessoas`,
                status: status,
                id: e.ID,
                isEvent: true
            });
        });

        let contentHtml = `
            <div class="bg-white rounded-lg shadow overflow-hidden mb-8 border border-gray-200">
                <div class="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                    <h3 class="font-bold text-gray-800 flex items-center gap-2"><i class="fas fa-list-alt text-orange-600"></i> Produção Hoje – ${Utils.formatDate(date)}</h3>
                    <button onclick="ProducaoModule.modalPlanejamento(null, '${date}')" class="bg-orange-600 text-white px-3 py-1 rounded text-xs font-bold hover:bg-orange-700 transition shadow">
                        <i class="fas fa-plus mr-1"></i> Novo Pedido
                    </button>
                </div>
                <table class="w-full text-sm text-left">
                    <thead class="bg-gray-100 text-gray-600 uppercase">
                        <tr>
                            <th class="p-3">Tipo</th>
                            <th class="p-3">Cliente / Evento</th>
                            <th class="p-3 text-center">Pessoas / Qtd</th>
                            <th class="p-3 text-center">Status</th>
                            <th class="p-3 text-center">Ações</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y">
                        ${dashboardRows.map(row => {
                            let statusColor = 'bg-gray-100 text-gray-800';
                            if (row.status === 'Em Produção' || row.status === 'Em Execução') statusColor = 'bg-yellow-100 text-yellow-800';
                            if (row.status === 'Concluída' || row.status === 'Pronto') statusColor = 'bg-green-100 text-green-800';
                            
                            return `
                            <tr class="hover:bg-gray-50">
                                <td class="p-3"><span class="font-bold ${row.isEvent ? 'text-purple-600' : 'text-blue-600'}">${row.tipo}</span></td>
                                <td class="p-3 font-medium">${row.cliente}</td>
                                <td class="p-3 text-center">${row.pessoas}</td>
                                <td class="p-3 text-center"><span class="px-2 py-1 rounded text-xs font-bold ${statusColor}">${row.status}</span></td>
                                <td class="p-3 text-center">
                                    ${!row.isEvent ? `<button onclick="ProducaoModule.printProductionPlan('${row.id}')" class="text-gray-500 hover:text-gray-800 bg-gray-100 p-1.5 rounded" title="Ver Ficha"><i class="fas fa-eye"></i></button>` : ''}
                                    <button onclick="ProducaoModule.modalOrdemProducao('${row.isEvent ? 'evento' : 'rotina'}', '${row.id}')" class="text-blue-600 hover:text-blue-800 bg-blue-50 p-1.5 rounded font-bold text-xs border border-blue-200" title="Ordem de Produção">Ver OP</button>
                                </td>
                            </tr>
                            `;
                        }).join('')}
                        ${dashboardRows.length === 0 ? '<tr><td colspan="5" class="p-8 text-center text-gray-500 italic">Nenhuma produção agendada para hoje.</td></tr>' : ''}
                    </tbody>
                </table>
                ${!plan ? `<div class="p-3 bg-gray-50 border-t text-center"><button onclick="ProducaoModule.modalPlanejamento(null, '${date}')" class="text-sm text-orange-600 hover:underline font-bold">+ Criar Planejamento de Rotina</button></div>` : ''}
            </div>
        `;

        // --- 2. DETALHES DO PEDIDO DE ROTINA (CARDS) ---
        if (plan) {
            const details = plan.production_details || {};
            const solidos = details.solidos || {};
            const sopa = details.sopa || {};
            const cha = details.cha || {};

            contentHtml += `
                <h3 class="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><i class="fas fa-info-circle text-blue-600"></i> Detalhes da Produção de Rotina</h3>
                <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <!-- Resumo de Metas -->
                    <div class="lg:col-span-3 bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex flex-wrap justify-between items-center gap-4">
                        <div>
                            <h3 class="font-bold text-gray-800 text-lg">Produção de ${Utils.formatDate(date)}</h3>
                            <p class="text-xs text-gray-500">Planejamento #${plan.id.slice(0,8)}</p>
                        </div>
                        <div class="flex gap-4 text-center">
                            <div class="px-4 py-2 bg-blue-50 rounded-lg border border-blue-100">
                                <div class="text-xs text-blue-600 font-bold uppercase">Sólidos</div>
                                <div class="text-xl font-bold text-blue-800">${plan.meta_solid}</div>
                            </div>
                            <div class="px-4 py-2 bg-yellow-50 rounded-lg border border-yellow-100">
                                <div class="text-xs text-yellow-600 font-bold uppercase">Sopa</div>
                                <div class="text-xl font-bold text-yellow-800">${plan.meta_soup}</div>
                            </div>
                            <div class="px-4 py-2 bg-green-50 rounded-lg border border-green-100">
                                <div class="text-xs text-green-600 font-bold uppercase">Chá</div>
                                <div class="text-xl font-bold text-green-800">${plan.meta_tea}</div>
                            </div>
                        </div>
                        <div>
                            <button onclick="ProducaoModule.modalPlanejamento('${plan.id}')" class="text-blue-600 hover:text-blue-800 border border-blue-200 px-3 py-2 rounded bg-blue-50 mr-2 font-bold text-xs">
                                <i class="fas fa-edit"></i> Editar
                            </button>
                            <button onclick="ProducaoModule.printProductionPlan('${plan.id}')" class="text-gray-600 hover:text-gray-800 border border-gray-300 px-3 py-2 rounded bg-white text-xs font-bold">
                                <i class="fas fa-print"></i> Imprimir Ficha
                            </button>
                        </div>
                    </div>

                    <!-- Cartão Sólidos -->
                    <div class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                        <div class="bg-blue-600 text-white p-3 font-bold flex justify-between items-center">
                            <span>🍽️ Prato Principal</span>
                            <span class="text-xs bg-blue-700 px-2 py-1 rounded">Meta: ${plan.meta_solid}</span>
                        </div>
                        <div class="p-4">
                            <h4 class="font-bold text-lg text-gray-800 mb-2">${solidos.prato || 'Não definido'}</h4>
                            <div class="space-y-2">
                                <p class="text-xs font-bold text-gray-500 uppercase border-b pb-1">Ingredientes</p>
                                <ul class="text-sm text-gray-600 space-y-1">
                                    ${(solidos.ingredientes || []).map(i => `
                                        <li class="flex justify-between">
                                            <span>${i.item}</span>
                                            <span class="font-bold">${i.qtd}</span>
                                        </li>
                                    `).join('')}
                                    ${(!solidos.ingredientes || solidos.ingredientes.length === 0) ? '<li class="italic text-gray-400">Sem ingredientes listados</li>' : ''}
                                </ul>
                            </div>
                        </div>
                    </div>

                    <!-- Cartão Sopa -->
                    <div class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                        <div class="bg-yellow-500 text-white p-3 font-bold flex justify-between items-center">
                            <span>🥣 Sopa / Dieta</span>
                            <span class="text-xs bg-yellow-600 px-2 py-1 rounded">Meta: ${plan.meta_soup}</span>
                        </div>
                        <div class="p-4">
                            <div class="grid grid-cols-2 gap-4 mb-4">
                                <div><span class="block text-xs text-gray-500">Fuba</span><span class="font-bold">${sopa.fuba || '-'}</span></div>
                                <div><span class="block text-xs text-gray-500">Batata Rena</span><span class="font-bold">${sopa.batata || '-'}</span></div>
                                <div><span class="block text-xs text-gray-500">Massa</span><span class="font-bold">${sopa.massa || '-'}</span></div>
                                <div><span class="block text-xs text-gray-500">Cebola</span><span class="font-bold">${sopa.cebola || '-'}</span></div>
                                ${sopa.carne_seca ? `<div><span class="block text-xs text-gray-500">Carne Seca</span><span class="font-bold">${sopa.carne_seca}</span></div>` : ''}
                                ${sopa.costelinha ? `<div><span class="block text-xs text-gray-500">Costelinha</span><span class="font-bold">${sopa.costelinha}</span></div>` : ''}
                                ${sopa.paio ? `<div><span class="block text-xs text-gray-500">Paio</span><span class="font-bold">${sopa.paio}</span></div>` : ''}
                                ${sopa.calabresa ? `<div><span class="block text-xs text-gray-500">Calabresa</span><span class="font-bold">${sopa.calabresa}</span></div>` : ''}
                            </div>
                            <div>
                                <p class="text-xs font-bold text-gray-500 uppercase border-b pb-1 mb-2">Legumes</p>
                                <div class="flex flex-wrap gap-2">
                                    ${(sopa.legumes || []).map(l => `<span class="bg-yellow-50 text-yellow-800 text-xs px-2 py-1 rounded border border-yellow-100">${l}</span>`).join('')}
                                    ${(!sopa.legumes || sopa.legumes.length === 0) ? '<span class="text-xs text-gray-400 italic">Nenhum</span>' : ''}
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Cartão Chá -->
                    <div class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                        <div class="bg-green-600 text-white p-3 font-bold flex justify-between items-center">
                            <span>☕ Chá</span>
                            <span class="text-xs bg-green-700 px-2 py-1 rounded">Meta: ${plan.meta_tea}</span>
                        </div>
                        <div class="p-4">
                            <div class="space-y-4">
                                <div class="flex justify-between items-center border-b pb-2">
                                    <span class="text-gray-600">Erva / Chá</span>
                                    <span class="font-bold text-lg">${cha.erva || '-'}</span>
                                </div>
                                <div class="flex justify-between items-center border-b pb-2">
                                    <span class="text-gray-600">Açúcar (Kg)</span>
                                    <span class="font-bold text-lg">${cha.acucar || '-'}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        container.innerHTML = `
            <div class="mb-6 flex items-center gap-4">
                <label class="text-sm font-bold text-gray-600">Data de Produção:</label>
                <input type="date" value="${date}" class="border border-gray-300 p-2 rounded-lg shadow-sm focus:ring-2 focus:ring-orange-500 outline-none" onchange="ProducaoModule.state.filterDate = this.value; ProducaoModule.render();">
            </div>
            ${contentHtml}
        `;
    },

    // -------------------------------------------------------------------------
    // 2. ORDENS DE PRODUÇÃO (Lista Geral)
    // -------------------------------------------------------------------------
    renderOrdens: (container) => {
        let ordens = ProducaoModule.state.ordens || [];
        const filter = ProducaoModule.state.filterOrdensStatus;

        if (filter) {
            ordens = ordens.filter(o => o.Status === filter);
        }

        // Ordenar por data decrescente
        ordens.sort((a, b) => new Date(b.Data) - new Date(a.Data));

        container.innerHTML = `
            <div class="bg-white rounded shadow overflow-hidden">
                <div class="p-4 border-b border-gray-200 flex justify-between items-center">
                    <h3 class="font-bold text-gray-800">Histórico de Ordens de Produção</h3>
                    <select onchange="ProducaoModule.state.filterOrdensStatus = this.value; ProducaoModule.renderOrdens(document.getElementById('tab-content'))" class="border p-2 rounded text-sm bg-gray-50">
                        <option value="">Todos os Status</option>
                        <option value="Pendente" ${filter === 'Pendente' ? 'selected' : ''}>Pendente</option>
                        <option value="Em Produção" ${filter === 'Em Produção' ? 'selected' : ''}>Em Produção</option>
                        <option value="Concluída" ${filter === 'Concluída' ? 'selected' : ''}>Concluída</option>
                    </select>
                </div>
                <table class="w-full text-sm text-left">
                    <thead class="bg-gray-50 text-gray-600 uppercase">
                        <tr>
                            <th class="p-3">OP Nº</th>
                            <th class="p-3">Data</th>
                            <th class="p-3">Origem</th>
                            <th class="p-3">Responsável</th>
                            <th class="p-3 text-center">Status</th>
                            <th class="p-3 text-center">Ações</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y">
                        ${ordens.map(o => `
                            <tr class="hover:bg-gray-50">
                                <td class="p-3 font-mono font-bold">#${String(o.Codigo).padStart(5,'0')}</td>
                                <td class="p-3">${Utils.formatDate(o.Data)}</td>
                                <td class="p-3">${o.OrigemTipo || 'Rotina'}</td>
                                <td class="p-3">${o.Responsavel || '-'}</td>
                                <td class="p-3 text-center"><span class="px-2 py-1 rounded text-xs font-bold ${o.Status === 'Concluída' ? 'bg-green-100 text-green-800' : (o.Status === 'Em Produção' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800')}">${o.Status}</span></td>
                                <td class="p-3 text-center">
                                    <button onclick="ProducaoModule.modalOrdemProducao('${o.OrigemTipo === 'Evento' ? 'evento' : 'rotina'}', '${o.OrigemTipo === 'Evento' ? o.EventoID : o.PlanejamentoID}')" class="text-blue-600 hover:text-blue-800"><i class="fas fa-eye"></i></button>
                                </td>
                            </tr>
                        `).join('')}
                        ${ordens.length === 0 ? '<tr><td colspan="6" class="p-4 text-center text-gray-500">Nenhuma ordem registrada.</td></tr>' : ''}
                    </tbody>
                </table>
            </div>
        `;
    },

    // -------------------------------------------------------------------------
    // 3. RECEITAS E PORÇÕES (Fichas Técnicas)
    // -------------------------------------------------------------------------
    renderCardapios: (container) => {
        const fichas = ProducaoModule.state.cardapios || [];
        
        // Ordenar por custo (Top 10 mais caros para o gráfico)
        const topCost = [...fichas].sort((a,b) => Number(b.CustoPorPorcao) - Number(a.CustoPorPorcao)).slice(0, 10);

        container.innerHTML = `
            <div class="bg-white rounded shadow overflow-hidden">
                <div class="p-4 border-b border-gray-200 flex justify-between items-center">
                    <h3 class="font-bold text-gray-800">Fichas Técnicas (Cardápios)</h3>
                    <button onclick="ProducaoModule.modalFicha()" class="bg-blue-600 text-white px-3 py-1 rounded text-xs hover:bg-blue-700 font-bold"><i class="fas fa-plus mr-1"></i> Nova Ficha</button>
                </div>
                
                <!-- Gráfico de Custos -->
                <div class="p-6 border-b border-gray-100 bg-gray-50">
                    <h4 class="text-sm font-bold text-gray-600 mb-4 uppercase">Top 10 Pratos por Custo Unitário</h4>
                    <div class="h-64 w-full"><canvas id="chartCustosPratos"></canvas></div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
                    ${fichas.map(f => `
                        <div class="border rounded p-3 hover:shadow-md transition cursor-pointer bg-gray-50" onclick="ProducaoModule.modalFicha('${f.ID}')">
                            <div class="flex justify-between items-start mb-2">
                                <h4 class="font-bold text-gray-800">${f.Nome}</h4>
                                <span class="text-xs bg-white border px-2 py-1 rounded text-gray-600">${f.Categoria || 'Geral'}</span>
                            </div>
                            <div class="text-xs text-gray-500 space-y-1">
                                <p><i class="fas fa-clock w-4 text-center"></i> ${f.TempoPreparo || '-'}</p>
                                <p><i class="fas fa-utensils w-4 text-center"></i> Rendimento: ${f.Rendimento || 0}</p>
                                <p><i class="fas fa-coins w-4 text-center"></i> Custo: ${Utils.formatCurrency(f.CustoPorPorcao)}</p>
                            </div>
                        </div>
                    `).join('')}
                    ${fichas.length === 0 ? '<div class="col-span-3 text-center text-gray-500 py-8">Nenhuma ficha técnica cadastrada.</div>' : ''}
                </div>
            </div>
        `;

        // Renderizar Gráfico
        if (document.getElementById('chartCustosPratos')) {
            if (ProducaoModule.state.charts.custos) ProducaoModule.state.charts.custos.destroy();
            
            ProducaoModule.state.charts.custos = new Chart(document.getElementById('chartCustosPratos'), {
                type: 'bar',
                data: {
                    labels: topCost.map(f => f.Nome),
                    datasets: [{
                        label: 'Custo por Porção (Kz)',
                        data: topCost.map(f => Number(f.CustoPorPorcao)),
                        backgroundColor: '#F59E0B',
                        borderRadius: 4
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
            });
        }
    },

    // -------------------------------------------------------------------------
    // 4. INGREDIENTES NECESSÁRIOS (Estoque)
    // -------------------------------------------------------------------------
    renderEstoque: (container) => {
        const estoque = ProducaoModule.state.estoque || [];
        // Filtra apenas itens relevantes para a cozinha
        const items = estoque.filter(i => i.Tipo === 'Alimentos' || i.Tipo === 'Bebidas' || i.Tipo === 'Insumos');
        const lowStockCount = items.filter(i => Number(i.Quantidade) <= Number(i.Minimo)).length;
        
        container.innerHTML = `
            <div class="bg-white rounded shadow overflow-hidden">
                <div class="p-4 border-b border-gray-200 flex justify-between items-center">
                    <div>
                        <h3 class="font-bold text-gray-800">Estoque da Cozinha</h3>
                        <span class="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">${items.length} itens</span>
                        ${lowStockCount > 0 ? `<span class="text-xs bg-red-100 text-red-800 px-2 py-1 rounded ml-2 font-bold">⚠️ ${lowStockCount} Baixos</span>` : ''}
                    </div>
                    <button onclick="ProducaoModule.printShoppingList()" class="bg-orange-600 text-white px-3 py-1 rounded text-xs hover:bg-orange-700 font-bold shadow">
                        <i class="fas fa-print mr-1"></i> Lista de Compras
                    </button>
                </div>
                <table class="w-full text-sm text-left">
                    <thead class="bg-gray-50 text-gray-600 uppercase">
                        <tr>
                            <th class="p-3">Item</th>
                            <th class="p-3">Categoria</th>
                            <th class="p-3 text-center">Qtd</th>
                            <th class="p-3 text-center">Validade</th>
                            <th class="p-3 text-center">Status</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y">
                        ${items.map(i => {
                            const qtd = Number(i.Quantidade || 0);
                            const min = Number(i.Minimo || 0);
                            const status = qtd <= min ? 'Baixo' : 'OK';
                            const statusClass = qtd <= min ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800';
                            
                            return `
                            <tr class="hover:bg-gray-50">
                                <td class="p-3 font-bold">${i.Nome}</td>
                                <td class="p-3 text-xs text-gray-500">${i.Categoria || '-'}</td>
                                <td class="p-3 text-center font-bold">${qtd} ${i.Unidade}</td>
                                <td class="p-3 text-center text-xs">${Utils.formatDate(i.Validade)}</td>
                                <td class="p-3 text-center"><span class="px-2 py-1 rounded text-xs ${statusClass}">${status}</span></td>
                            </tr>
                        `}).join('')}
                        ${items.length === 0 ? '<tr><td colspan="5" class="p-4 text-center text-gray-500">Nenhum item de cozinha no estoque.</td></tr>' : ''}
                    </tbody>
                </table>
            </div>
        `;
    },

    printShoppingList: () => {
        const estoque = ProducaoModule.state.estoque || [];
        // Filtra itens de cozinha com estoque baixo
        const lowStock = estoque.filter(i => 
            (i.Tipo === 'Alimentos' || i.Tipo === 'Bebidas' || i.Tipo === 'Insumos') && 
            Number(i.Quantidade) <= Number(i.Minimo)
        );
        
        if (lowStock.length === 0) return Utils.toast('Nenhum item com estoque baixo.', 'info');

        const inst = ProducaoModule.state.instituicao[0] || {};
        const showLogo = inst.ExibirLogoRelatorios;

        const html = `
            <div class="p-8 font-sans text-gray-900 bg-white">
                <div class="flex items-center justify-between border-b-2 border-gray-800 pb-4 mb-6">
                    <div class="${showLogo && inst.LogotipoURL ? 'flex items-center gap-4' : ''}">
                        ${showLogo && inst.LogotipoURL ? `<img src="${inst.LogotipoURL}" class="h-16 w-auto object-contain">` : ''}
                        <div>
                            <h1 class="text-xl font-bold text-gray-800">${inst.NomeFantasia || 'Delícia da Cidade'}</h1>
                            <p class="text-sm text-gray-500">Lista de Reposição (Cozinha)</p>
                        </div>
                    </div>
                    <div class="text-right">
                        <h2 class="text-xl font-bold">LISTA DE COMPRAS</h2>
                        <p class="text-sm text-gray-500">Data: ${new Date().toLocaleDateString()}</p>
                    </div>
                </div>

                <table class="w-full text-sm border-collapse border border-gray-300">
                    <thead class="bg-gray-100">
                        <tr>
                            <th class="border p-2 text-left">Produto</th>
                            <th class="border p-2 text-center">Atual</th>
                            <th class="border p-2 text-center">Mínimo</th>
                            <th class="border p-2 text-center w-24">Comprar</th>
                            <th class="border p-2 text-left">Obs</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${lowStock.map(i => `
                            <tr>
                                <td class="border p-2 font-bold">${i.Nome}</td>
                                <td class="border p-2 text-center text-red-600 font-bold">${i.Quantidade} ${i.Unidade}</td>
                                <td class="border p-2 text-center">${i.Minimo} ${i.Unidade}</td>
                                <td class="border p-2 text-center border-b-2 border-black"></td>
                                <td class="border p-2"></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                
                <div class="mt-8 text-center text-xs text-gray-400">
                    Documento gerado automaticamente pelo sistema.
                </div>
            </div>
        `;
        
        Utils.printNative(html);
    },

    // -------------------------------------------------------------------------
    // 5. EVENTOS AGENDADOS
    // -------------------------------------------------------------------------
    renderEventos: (container) => {
        const eventos = ProducaoModule.state.eventos;
        container.innerHTML = `
            <div class="bg-white rounded shadow overflow-hidden">
                <div class="p-4 border-b border-gray-200 flex justify-between items-center">
                    <h3 class="font-bold text-gray-800">Eventos Confirmados (Cozinha)</h3>
                </div>
                <table class="w-full text-sm text-left">
                    <thead class="bg-gray-50 text-gray-600 uppercase">
                        <tr>
                            <th class="p-3">Data</th>
                            <th class="p-3">Evento</th>
                            <th class="p-3">Pessoas</th>
                            <th class="p-3">Cardápio</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y">
                        ${eventos.map(e => {
                            const detalhes = e.DetalhesJSON || {};
                            const menu = detalhes.menu || [];
                            const menuStr = menu.map(m => m.name).join(', ') || 'A definir';
                            return `
                            <tr class="hover:bg-gray-50">
                                <td class="p-3 font-bold">${Utils.formatDate(e.Data)}</td>
                                <td class="p-3">${e.Titulo}</td>
                                <td class="p-3">${e.Pessoas || 0}</td>
                                <td class="p-3 text-xs text-gray-500 truncate max-w-xs" title="${menuStr}">${menuStr}</td>
                            </tr>
                        `}).join('')}
                        ${eventos.length === 0 ? '<tr><td colspan="4" class="p-4 text-center text-gray-500">Nenhum evento confirmado próximo.</td></tr>' : ''}
                    </tbody>
                </table>
            </div>
        `;
    },

    // -------------------------------------------------------------------------
    // 6. RELATÓRIOS DE PRODUÇÃO
    // -------------------------------------------------------------------------
    renderRelatorios: (container) => {
        const ordens = ProducaoModule.state.ordens.filter(o => o.Status === 'Concluída');
        const eventos = ProducaoModule.state.eventos.filter(e => e.Status === 'Finalizado' || e.Status === 'Confirmado');
        const desperdicio = ProducaoModule.state.desperdicio || [];
        const fichas = ProducaoModule.state.cardapios || [];
        const estoque = ProducaoModule.state.estoque || [];

        // 1. Total de Refeições no Mês (Baseado em OPs concluídas)
        const currentMonth = new Date().getMonth();
        const mealsThisMonth = ordens.filter(o => new Date(o.Data).getMonth() === currentMonth).length; // Simplificado: conta OPs, idealmente somaria pessoas

        // 2. Eventos Mais Lucrativos
        const eventosLucrativos = eventos.map(e => {
            const custos = e.DetalhesJSON && e.DetalhesJSON.custos ? 
                (Number(e.DetalhesJSON.custos.ingredientes||0) + Number(e.DetalhesJSON.custos.equipe||0) + Number(e.DetalhesJSON.custos.transporte||0) + Number(e.DetalhesJSON.custos.outros||0)) : 0;
            const lucro = Number(e.Valor || 0) - custos;
            return { nome: e.Titulo, lucro: lucro, data: e.Data };
        }).sort((a,b) => b.lucro - a.lucro).slice(0, 5);

        // 3. Custos por Prato (Top 5 mais caros)
        const pratosCaros = [...fichas].sort((a,b) => Number(b.CustoPorPorcao) - Number(a.CustoPorPorcao)).slice(0, 5);

        // 4. Custos Reais das OPs (Baseado no estoque consumido)
        const custosOPs = ordens.map(op => {
            let total = 0;
            if (op.DetalhesProducao && op.DetalhesProducao.ingredientes) {
                op.DetalhesProducao.ingredientes.forEach(ing => {
                    const item = estoque.find(i => i.ID === ing.id);
                    if (item) total += (Number(ing.qtdNecessaria) * Number(item.CustoUnitario || 0));
                });
            }
            return { ...op, custoReal: total };
        }).sort((a,b) => new Date(b.Data) - new Date(a.Data)).slice(0, 10);

        container.innerHTML = `
            <div class="flex justify-between items-center mb-6">
                <h3 class="text-xl font-bold text-gray-800">Relatórios de Produção</h3>
                <button onclick="ProducaoModule.exportRelatoriosPDF()" class="bg-red-600 text-white px-4 py-2 rounded shadow hover:bg-red-700 transition">
                    <i class="fas fa-file-pdf mr-2"></i> Exportar PDF
                </button>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div class="bg-white p-6 rounded shadow border-l-4 border-blue-500">
                    <div class="text-gray-500 text-sm font-bold uppercase">Ordens Concluídas (Mês)</div>
                    <div class="text-3xl font-bold text-blue-600 mt-1">${mealsThisMonth}</div>
                </div>
                <div class="bg-white p-6 rounded shadow border-l-4 border-red-500">
                    <div class="text-gray-500 text-sm font-bold uppercase">Registros de Desperdício</div>
                    <div class="text-3xl font-bold text-red-600 mt-1">${desperdicio.length}</div>
                </div>
                <div class="bg-white p-6 rounded shadow border-l-4 border-green-500">
                    <div class="text-gray-500 text-sm font-bold uppercase">Eventos Realizados</div>
                    <div class="text-3xl font-bold text-green-600 mt-1">${eventos.length}</div>
                </div>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <!-- Eventos Mais Lucrativos -->
                <div class="bg-white p-4 rounded shadow">
                    <h4 class="font-bold text-gray-700 mb-4 border-b pb-2">🏆 Eventos Mais Lucrativos</h4>
                    <table class="w-full text-sm text-left">
                        <thead class="bg-gray-50 text-xs uppercase"><tr><th>Evento</th><th class="text-right">Data</th><th class="text-right">Lucro Est.</th></tr></thead>
                        <tbody class="divide-y">
                            ${eventosLucrativos.map(e => `
                                <tr>
                                    <td class="p-2 font-medium">${e.nome}</td>
                                    <td class="p-2 text-right text-gray-500">${Utils.formatDate(e.data)}</td>
                                    <td class="p-2 text-right font-bold text-green-600">${Utils.formatCurrency(e.lucro)}</td>
                                </tr>
                            `).join('')}
                            ${eventosLucrativos.length === 0 ? '<tr><td colspan="3" class="p-4 text-center text-gray-500">Sem dados suficientes.</td></tr>' : ''}
                        </tbody>
                    </table>
                </div>

                <!-- Custos por Prato -->
                <div class="bg-white p-4 rounded shadow">
                    <h4 class="font-bold text-gray-700 mb-4 border-b pb-2">💰 Top 5 Pratos Mais Caros (Custo)</h4>
                    <table class="w-full text-sm text-left">
                        <thead class="bg-gray-50 text-xs uppercase"><tr><th>Prato</th><th class="text-right">Custo/Porção</th></tr></thead>
                        <tbody class="divide-y">
                            ${pratosCaros.map(p => `
                                <tr>
                                    <td class="p-2 font-medium">${p.Nome}</td>
                                    <td class="p-2 text-right font-bold text-red-600">${Utils.formatCurrency(p.CustoPorPorcao)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>

                <!-- Custos Reais de Produção -->
                <div class="bg-white p-4 rounded shadow lg:col-span-2">
                    <h4 class="font-bold text-gray-700 mb-4 border-b pb-2">💸 Custos Reais de Produção (Últimas OPs Concluídas)</h4>
                    <table class="w-full text-sm text-left">
                        <thead class="bg-gray-50 text-xs uppercase"><tr><th>OP</th><th>Data</th><th>Origem</th><th class="text-right">Custo Total</th></tr></thead>
                        <tbody class="divide-y">
                            ${custosOPs.map(op => `
                                <tr>
                                    <td class="p-2 font-bold">#${String(op.Codigo).padStart(5,'0')}</td>
                                    <td class="p-2 text-gray-500">${Utils.formatDate(op.Data)}</td>
                                    <td class="p-2">${op.OrigemTipo || 'Rotina'}</td>
                                    <td class="p-2 text-right font-bold text-red-600">${Utils.formatCurrency(op.custoReal)}</td>
                                </tr>
                            `).join('')}
                            ${custosOPs.length === 0 ? '<tr><td colspan="4" class="p-4 text-center text-gray-500">Nenhuma ordem concluída.</td></tr>' : ''}
                        </tbody>
                    </table>
                </div>

                <!-- Gráfico de Desperdício -->
                <div class="bg-white p-4 rounded shadow lg:col-span-2">
                    <h4 class="font-bold text-gray-700 mb-4 border-b pb-2">Análise de Desperdício (Motivos)</h4>
                    <div class="h-64"><canvas id="chartDesperdicioProducao"></canvas></div>
                </div>
            </div>
        `;

        // Renderizar Gráfico de Desperdício
        if (ProducaoModule.state.charts.desperdicio) ProducaoModule.state.charts.desperdicio.destroy();
        
        const wasteMap = {};
        desperdicio.forEach(d => {
            const motivo = d.Motivo || 'Outros';
            wasteMap[motivo] = (wasteMap[motivo] || 0) + 1;
        });

        if (document.getElementById('chartDesperdicioProducao')) {
            ProducaoModule.state.charts.desperdicio = new Chart(document.getElementById('chartDesperdicioProducao'), {
                type: 'bar',
                data: { labels: Object.keys(wasteMap), datasets: [{ label: 'Ocorrências', data: Object.values(wasteMap), backgroundColor: '#EF4444', borderRadius: 4 }] },
                options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
            });
        }
    },

    exportRelatoriosPDF: () => {
        const ordens = ProducaoModule.state.ordens.filter(o => o.Status === 'Concluída');
        const eventos = ProducaoModule.state.eventos.filter(e => e.Status === 'Finalizado' || e.Status === 'Confirmado');
        const desperdicio = ProducaoModule.state.desperdicio || [];
        const fichas = ProducaoModule.state.cardapios || [];
        const estoque = ProducaoModule.state.estoque || [];
        const inst = ProducaoModule.state.instituicao[0] || {};
        const showLogo = inst.ExibirLogoRelatorios;

        // KPIs
        const currentMonth = new Date().getMonth();
        const mealsThisMonth = ordens.filter(o => new Date(o.Data).getMonth() === currentMonth).length;

        // Eventos Lucrativos
        const eventosLucrativos = eventos.map(e => {
            const custos = e.DetalhesJSON && e.DetalhesJSON.custos ? 
                (Number(e.DetalhesJSON.custos.ingredientes||0) + Number(e.DetalhesJSON.custos.equipe||0) + Number(e.DetalhesJSON.custos.transporte||0) + Number(e.DetalhesJSON.custos.outros||0)) : 0;
            const lucro = Number(e.Valor || 0) - custos;
            return { nome: e.Titulo, lucro: lucro, data: e.Data };
        }).sort((a,b) => b.lucro - a.lucro).slice(0, 5);

        // Pratos Caros
        const pratosCaros = [...fichas].sort((a,b) => Number(b.CustoPorPorcao) - Number(a.CustoPorPorcao)).slice(0, 5);

        // Custos OPs
        const custosOPs = ordens.map(op => {
            let total = 0;
            if (op.DetalhesProducao && op.DetalhesProducao.ingredientes) {
                op.DetalhesProducao.ingredientes.forEach(ing => {
                    const item = estoque.find(i => i.ID === ing.id);
                    if (item) total += (Number(ing.qtdNecessaria) * Number(item.CustoUnitario || 0));
                });
            }
            return { ...op, custoReal: total };
        }).sort((a,b) => new Date(b.Data) - new Date(a.Data)).slice(0, 10);

        // Desperdício
        const wasteMap = {};
        desperdicio.forEach(d => {
            const motivo = d.Motivo || 'Outros';
            wasteMap[motivo] = (wasteMap[motivo] || 0) + 1;
        });

        const html = `
            <div class="p-8 font-sans text-gray-900 bg-white">
                <div class="flex items-center justify-between border-b-2 border-gray-800 pb-4 mb-6">
                    <div class="${showLogo && inst.LogotipoURL ? 'flex items-center gap-4' : ''}">
                        ${showLogo && inst.LogotipoURL ? `<img src="${inst.LogotipoURL}" class="h-16 w-auto object-contain">` : ''}
                        <div>
                            <h1 class="text-xl font-bold text-gray-800">${inst.NomeFantasia || 'Relatório de Produção'}</h1>
                            <p class="text-sm text-gray-500">${inst.Endereco || ''}</p>
                        </div>
                    </div>
                    <div class="text-right">
                        <h2 class="text-xl font-bold">RELATÓRIO GERAL</h2>
                        <p class="text-sm text-gray-500">Gerado em: ${new Date().toLocaleDateString()}</p>
                    </div>
                </div>

                <div class="grid grid-cols-3 gap-4 mb-8 text-center">
                    <div class="p-4 bg-gray-50 border rounded">
                        <div class="text-xs font-bold text-gray-500 uppercase">Ordens (Mês)</div>
                        <div class="text-xl font-bold text-blue-600">${mealsThisMonth}</div>
                    </div>
                    <div class="p-4 bg-gray-50 border rounded">
                        <div class="text-xs font-bold text-gray-500 uppercase">Desperdícios</div>
                        <div class="text-xl font-bold text-red-600">${desperdicio.length}</div>
                    </div>
                    <div class="p-4 bg-gray-50 border rounded">
                        <div class="text-xs font-bold text-gray-500 uppercase">Eventos</div>
                        <div class="text-xl font-bold text-green-600">${eventos.length}</div>
                    </div>
                </div>

                <h3 class="font-bold text-gray-800 mb-2 border-b pb-1 text-sm uppercase">Eventos Mais Lucrativos</h3>
                <table class="w-full text-sm mb-6 border-collapse border border-gray-300">
                    <thead class="bg-gray-100"><tr><th class="border p-2 text-left">Evento</th><th class="border p-2 text-right">Data</th><th class="border p-2 text-right">Lucro Est.</th></tr></thead>
                    <tbody>
                        ${eventosLucrativos.map(e => `<tr><td class="border p-2">${e.nome}</td><td class="border p-2 text-right">${Utils.formatDate(e.data)}</td><td class="border p-2 text-right font-bold text-green-600">${Utils.formatCurrency(e.lucro)}</td></tr>`).join('')}
                    </tbody>
                </table>

                <h3 class="font-bold text-gray-800 mb-2 border-b pb-1 text-sm uppercase">Top 5 Pratos (Custo)</h3>
                <table class="w-full text-sm mb-6 border-collapse border border-gray-300">
                    <thead class="bg-gray-100"><tr><th class="border p-2 text-left">Prato</th><th class="border p-2 text-right">Custo/Porção</th></tr></thead>
                    <tbody>
                        ${pratosCaros.map(p => `<tr><td class="border p-2">${p.Nome}</td><td class="border p-2 text-right font-bold text-red-600">${Utils.formatCurrency(p.CustoPorPorcao)}</td></tr>`).join('')}
                    </tbody>
                </table>

                <h3 class="font-bold text-gray-800 mb-2 border-b pb-1 text-sm uppercase">Custos de Produção (Últimas OPs)</h3>
                <table class="w-full text-sm mb-6 border-collapse border border-gray-300">
                    <thead class="bg-gray-100"><tr><th class="border p-2 text-left">OP</th><th class="border p-2 text-left">Origem</th><th class="border p-2 text-right">Custo Total</th></tr></thead>
                    <tbody>
                        ${custosOPs.map(op => `<tr><td class="border p-2">#${String(op.Codigo).padStart(5,'0')}</td><td class="border p-2">${op.OrigemTipo || 'Rotina'}</td><td class="border p-2 text-right font-bold text-red-600">${Utils.formatCurrency(op.custoReal)}</td></tr>`).join('')}
                    </tbody>
                </table>

                <h3 class="font-bold text-gray-800 mb-2 border-b pb-1 text-sm uppercase">Desperdício por Motivo</h3>
                <table class="w-full text-sm mb-6 border-collapse border border-gray-300">
                    <thead class="bg-gray-100"><tr><th class="border p-2 text-left">Motivo</th><th class="border p-2 text-right">Ocorrências</th></tr></thead>
                    <tbody>
                        ${Object.entries(wasteMap).map(([k,v]) => `<tr><td class="border p-2">${k}</td><td class="border p-2 text-right">${v}</td></tr>`).join('')}
                    </tbody>
                </table>

                <div class="mt-8 text-center text-xs text-gray-400">
                    &copy; 2026 Delícia da Cidade. Todos os direitos reservados.
                </div>
            </div>
        `;
        
        Utils.printNative(html);
    },

    // 🧾 ORDEM DE PRODUÇÃO (OP)
    modalOrdemProducao: (type, id) => {
        let source, op;
        let origemTexto = '';
        let dataOp = '';
        let pessoas = 0;
        let responsavel = '';
        let detalhes = { pratos: [], ingredientes: [], etapas: [], equipe: [] };

        if (type === 'rotina') {
            source = ProducaoModule.state.pedidosDia.find(p => p.id === id);
            if (!source) return Utils.toast('Planejamento não encontrado.', 'error');
            
            // Tenta encontrar OP existente
            op = ProducaoModule.state.ordens.find(o => o.PlanejamentoID === id);
            
            origemTexto = 'Pedido (Rotina)';
            dataOp = source.planning_date;
            pessoas = (source.staff_count_day || 0) + (source.staff_count_night || 0) + (source.patient_solid || 0) + (source.patient_liquid || 0);
            responsavel = op ? op.Responsavel : 'Chefe de Cozinha'; // Default
        } else {
            source = ProducaoModule.state.eventos.find(e => e.ID === id);
            if (!source) return Utils.toast('Evento não encontrado.', 'error');
            
            op = ProducaoModule.state.ordens.find(o => o.EventoID === id);
            
            origemTexto = `Evento: ${source.Titulo}`;
            dataOp = source.Data;
            pessoas = source.Pessoas || 0;
            responsavel = op ? op.Responsavel : (source.Responsavel || 'Chefe de Cozinha');
        }

        if (op && op.DetalhesProducao) {
            detalhes = op.DetalhesProducao;
        } else {
            // Inicialização Padrão se for nova OP
            // 1. Pratos (Tenta extrair do planejamento ou evento)
            if (type === 'rotina' && source.production_details) {
                const d = source.production_details;
                if (d.solidos && d.solidos.prato) detalhes.pratos.push({ nome: d.solidos.prato, porcoes: pessoas, receitaId: '' });
                if (d.sopa) detalhes.pratos.push({ nome: 'Sopa do Dia', porcoes: source.patient_liquid || 0, receitaId: '' });
            } else if (type === 'evento' && source.DetalhesJSON && source.DetalhesJSON.menu) {
                source.DetalhesJSON.menu.forEach(m => {
                    detalhes.pratos.push({ nome: m.name, porcoes: pessoas, receitaId: '' });
                });
            }

            // 2. Etapas Padrão
            detalhes.etapas = [
                { nome: 'Pré-preparo (Cortes/Temperos)', status: 'Pendente' },
                { nome: 'Cozimento', status: 'Pendente' },
                { nome: 'Montagem/Embalagem', status: 'Pendente' },
                { nome: 'Finalização/Qualidade', status: 'Pendente' },
                { nome: 'Pronto para Entrega', status: 'Pendente' }
            ];
        }
        
        const qual = detalhes.qualidade || {};
        const entrega = detalhes.entrega || {};

        const opCodigo = op ? String(op.Codigo).padStart(5, '0') : 'NOVA';
        const status = op ? op.Status : 'Pendente';

        // --- FUNÇÕES AUXILIARES DO MODAL ---
        window.switchOPTab = (tabId) => {
            document.querySelectorAll('.op-tab-content').forEach(el => el.classList.add('hidden'));
            document.getElementById(tabId).classList.remove('hidden');
            document.querySelectorAll('.op-tab-btn').forEach(el => {
                el.classList.remove('border-orange-600', 'text-orange-600');
                el.classList.add('border-transparent', 'text-gray-500');
            });
            document.getElementById('btn-' + tabId).classList.remove('border-transparent', 'text-gray-500');
            document.getElementById('btn-' + tabId).classList.add('border-orange-600', 'text-orange-600');
        };

        window.calcIngredients = () => {
            const tbody = document.getElementById('ingredientes-body');
            tbody.innerHTML = '';
            const stock = ProducaoModule.state.estoque || [];
            const fichas = ProducaoModule.state.cardapios || [];
            
            // Coleta ingredientes de todos os pratos vinculados a receitas
            const needed = {};
            
            // Itera sobre os inputs de pratos
            document.querySelectorAll('.prato-row').forEach(row => {
                const receitaId = row.querySelector('.receita-select').value;
                const porcoes = Number(row.querySelector('.porcoes-input').value || 0);
                
                if (receitaId) {
                    const ficha = fichas.find(f => f.ID === receitaId);
                    if (ficha && ficha.IngredientesJSON) {
                        const rendimento = Number(ficha.Rendimento || 1);
                        const fator = porcoes / rendimento;
                        
                        ficha.IngredientesJSON.forEach(ing => {
                            if (!needed[ing.id]) needed[ing.id] = 0;
                            needed[ing.id] += (Number(ing.quantidade) * fator);
                        });
                    }
                }
            });

            // Renderiza Tabela
            let hasMissing = false;
            Object.keys(needed).forEach(ingId => {
                const item = stock.find(i => i.ID === ingId);
                const qtdNeed = needed[ingId];
                const qtdStock = item ? Number(item.Quantidade || 0) : 0;
                const missing = qtdNeed > qtdStock;
                if (missing) hasMissing = true;
                
                const row = `
                    <tr class="border-b text-sm">
                        <td class="p-2">${item ? item.Nome : 'Item Desconhecido'}</td>
                        <td class="p-2 text-center font-bold">${qtdNeed.toFixed(2)} ${item ? item.Unidade : ''}</td>
                        <td class="p-2 text-center ${missing ? 'text-red-600' : 'text-green-600'}">${qtdStock.toFixed(2)}</td>
                        <td class="p-2 text-center">
                            ${missing ? `<span class="bg-red-100 text-red-800 px-2 py-1 rounded text-xs font-bold">⚠️ Falta ${(qtdNeed - qtdStock).toFixed(2)}</span>` : '<span class="text-green-600">✅ Ok</span>'}
                        </td>
                    </tr>
                `;
                tbody.insertAdjacentHTML('beforeend', row);
            });
            
            if (Object.keys(needed).length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-gray-500">Vincule receitas aos pratos para calcular.</td></tr>';
            }
            
            const btnCompra = document.getElementById('btn-gerar-compra');
            if(btnCompra) btnCompra.style.display = hasMissing ? 'inline-block' : 'none';
        };

        Utils.openModal(`Ordem de Produção`, `
            <div class="bg-white p-4 rounded-lg border border-gray-200 mb-4">
                <div class="flex justify-between items-center mb-4 border-b pb-2">
                    <h3 class="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <i class="fas fa-file-invoice text-orange-600"></i> OP Nº ${opCodigo}
                    </h3>
                    <span class="px-3 py-1 rounded-full text-xs font-bold ${status === 'Concluída' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}">${status.toUpperCase()}</span>
                </div>

                <form onsubmit="ProducaoModule.saveOrdemProducao(event)" id="form-op">
                    <input type="hidden" name="ID" value="${op ? op.ID : ''}">
                    <input type="hidden" name="OrigemTipo" value="${type === 'rotina' ? 'Rotina' : 'Evento'}">
                    <input type="hidden" name="RefID" value="${id}">
                    <input type="hidden" name="Data" value="${dataOp}">

                    <!-- ABAS -->
                    <div class="flex border-b border-gray-200 mb-4 overflow-x-auto">
                        <button type="button" id="btn-tab-resumo" onclick="switchOPTab('tab-resumo')" class="op-tab-btn px-4 py-2 text-sm font-medium border-b-2 border-orange-600 text-orange-600 whitespace-nowrap">Resumo</button>
                        <button type="button" id="btn-tab-pratos" onclick="switchOPTab('tab-pratos')" class="op-tab-btn px-4 py-2 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700 whitespace-nowrap">3. Receitas</button>
                        <button type="button" id="btn-tab-ingredientes" onclick="switchOPTab('tab-ingredientes'); calcIngredients()" class="op-tab-btn px-4 py-2 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700 whitespace-nowrap">4. Ingredientes</button>
                        <button type="button" id="btn-tab-etapas" onclick="switchOPTab('tab-etapas')" class="op-tab-btn px-4 py-2 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700 whitespace-nowrap">5. Etapas</button>
                        <button type="button" id="btn-tab-equipe" onclick="switchOPTab('tab-equipe')" class="op-tab-btn px-4 py-2 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700 whitespace-nowrap">6. Equipe</button>
                        <button type="button" id="btn-tab-qualidade" onclick="switchOPTab('tab-qualidade')" class="op-tab-btn px-4 py-2 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700 whitespace-nowrap">7. Qualidade</button>
                        <button type="button" id="btn-tab-entrega" onclick="switchOPTab('tab-entrega')" class="op-tab-btn px-4 py-2 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700 whitespace-nowrap">8. Entrega</button>
                    </div>

                    <!-- TAB 1: RESUMO -->
                    <div id="tab-resumo" class="op-tab-content">
                        <div class="grid grid-cols-2 gap-4 text-sm mb-4">
                        <div class="p-2 bg-gray-50 rounded border">
                            <span class="block text-xs font-bold text-gray-500 uppercase">Origem</span>
                            <span class="font-medium text-gray-800">${origemTexto}</span>
                        </div>
                        <div class="p-2 bg-gray-50 rounded border">
                            <span class="block text-xs font-bold text-gray-500 uppercase">Data</span>
                            <span class="font-medium text-gray-800">${Utils.formatDate(dataOp)}</span>
                        </div>
                        <div class="p-2 bg-gray-50 rounded border">
                            <span class="block text-xs font-bold text-gray-500 uppercase">Pessoas</span>
                            <span class="font-medium text-gray-800">${pessoas}</span>
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Responsável</label>
                            <input name="Responsavel" value="${responsavel}" class="border p-1 rounded w-full text-sm" required>
                        </div>
                        </div>
                        <div class="mb-4">
                            <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Status da Produção</label>
                            <select name="Status" class="border p-2 rounded w-full text-sm font-bold">
                                <option ${status === 'Pendente' ? 'selected' : ''}>Pendente</option>
                                <option ${status === 'Em Produção' ? 'selected' : ''}>Em Produção (Reserva Estoque)</option>
                                <option ${status === 'Concluída' ? 'selected' : ''}>Concluída (Baixa Estoque)</option>
                            </select>
                        </div>
                    </div>

                    <!-- TAB 2: PRATOS / RECEITAS -->
                    <div id="tab-pratos" class="op-tab-content hidden">
                        <table class="w-full text-sm text-left mb-2">
                            <thead class="bg-gray-50 text-xs uppercase"><tr><th>Prato</th><th class="w-24">Porções</th><th>Receita Padrão</th></tr></thead>
                            <tbody id="pratos-list">
                                ${detalhes.pratos.map((p, idx) => `
                                    <tr class="prato-row border-b">
                                        <td class="p-2"><input type="text" name="prato_nome_${idx}" value="${p.nome}" class="border p-1 rounded w-full text-sm"></td>
                                        <td class="p-2"><input type="number" name="prato_porcoes_${idx}" value="${p.porcoes}" class="porcoes-input border p-1 rounded w-full text-sm text-center" onchange="calcIngredients()"></td>
                                        <td class="p-2">
                                            <select name="prato_receita_${idx}" class="receita-select border p-1 rounded w-full text-sm" onchange="calcIngredients()">
                                                <option value="">Sem Receita</option>
                                                ${ProducaoModule.state.cardapios.map(f => `<option value="${f.ID}" ${p.receitaId === f.ID ? 'selected' : ''}>${f.Nome}</option>`).join('')}
                                            </select>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                        <button type="button" onclick="ProducaoModule.addPratoRow()" class="text-xs text-blue-600 hover:underline">+ Adicionar Prato</button>
                    </div>

                    <!-- TAB 3: INGREDIENTES (AUTOMÁTICO) -->
                    <div id="tab-ingredientes" class="op-tab-content hidden">
                        <div class="bg-yellow-50 p-2 rounded text-xs text-yellow-800 mb-2 border border-yellow-200">
                            <i class="fas fa-info-circle"></i> O cálculo é baseado nas receitas vinculadas na aba anterior.
                        </div>
                        <table class="w-full text-sm text-left border">
                            <thead class="bg-gray-100"><tr><th>Ingrediente</th><th class="text-center">Necessário</th><th class="text-center">Estoque</th><th class="text-center">Status</th></tr></thead>
                            <tbody id="ingredientes-body">
                                <!-- Preenchido via JS -->
                            </tbody>
                        </table>
                        <div class="mt-2 text-right">
                            <button type="button" id="btn-gerar-compra" style="display:none" onclick="Utils.toast('Funcionalidade de Pedido Automático em breve!')" class="bg-red-600 text-white px-3 py-1 rounded text-xs shadow hover:bg-red-700">
                                <i class="fas fa-shopping-cart"></i> Gerar Pedido de Compra
                            </button>
                        </div>
                    </div>

                    <!-- TAB 4: ETAPAS -->
                    <div id="tab-etapas" class="op-tab-content hidden">
                        <table class="w-full text-sm text-left">
                            <thead class="bg-gray-50"><tr><th>Etapa</th><th>Status</th></tr></thead>
                            <tbody>
                                ${detalhes.etapas.map((e, idx) => `
                                    <tr class="border-b">
                                        <td class="p-2 font-medium"><input type="hidden" name="etapa_nome_${idx}" value="${e.nome}">${e.nome}</td>
                                        <td class="p-2">
                                            <select name="etapa_status_${idx}" class="border p-1 rounded text-xs ${e.status === 'Concluído' ? 'bg-green-100 text-green-800' : 'bg-gray-100'}">
                                                <option ${e.status === 'Pendente' ? 'selected' : ''}>Pendente</option>
                                                <option ${e.status === 'Em Andamento' ? 'selected' : ''}>Em Andamento</option>
                                                <option ${e.status === 'Concluído' ? 'selected' : ''}>Concluído</option>
                                            </select>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>

                    <!-- TAB 5: EQUIPE -->
                    <div id="tab-equipe" class="op-tab-content hidden">
                        <table class="w-full text-sm text-left mb-2">
                            <thead class="bg-gray-50"><tr><th>Funcionário</th><th>Tarefa</th><th>Horário</th><th></th></tr></thead>
                            <tbody id="equipe-list">
                                ${detalhes.equipe.map((eq, idx) => `
                                    <tr class="equipe-row border-b">
                                        <td class="p-2"><input name="equipe_func_${idx}" value="${eq.funcionario}" class="border p-1 rounded w-full" placeholder="Nome"></td>
                                        <td class="p-2"><input name="equipe_tarefa_${idx}" value="${eq.tarefa}" class="border p-1 rounded w-full" placeholder="Ex: Cortar legumes"></td>
                                        <td class="p-2"><input name="equipe_hora_${idx}" value="${eq.horario}" class="border p-1 rounded w-full" placeholder="08h-10h"></td>
                                        <td class="p-2 text-center"><button type="button" onclick="this.closest('tr').remove()" class="text-red-500"><i class="fas fa-times"></i></button></td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                        <button type="button" onclick="ProducaoModule.addEquipeRow()" class="text-xs text-blue-600 hover:underline">+ Adicionar Membro</button>
                    </div>

                    <!-- TAB 7: CONTROLE DE QUALIDADE -->
                    <div id="tab-qualidade" class="op-tab-content hidden">
                        <div class="bg-green-50 p-4 rounded border border-green-200 mb-4">
                            <h4 class="font-bold text-green-800 mb-3 text-sm uppercase flex items-center gap-2"><i class="fas fa-clipboard-check"></i> Inspeção Final</h4>
                            
                            <div class="grid grid-cols-2 gap-4 mb-3">
                                <div>
                                    <label class="block text-xs font-bold text-gray-600 mb-1">Temperatura (°C)</label>
                                    <input name="qualidade_temperatura" value="${qual.temperatura || ''}" class="border p-2 rounded w-full" placeholder="Ex: 65°C">
                                </div>
                                <div>
                                    <label class="block text-xs font-bold text-gray-600 mb-1">Higiene / Apresentação</label>
                                    <select name="qualidade_higiene" class="border p-2 rounded w-full">
                                        <option value="Aprovado" ${qual.higiene === 'Aprovado' ? 'selected' : ''}>✔ Aprovado</option>
                                        <option value="Reprovado" ${qual.higiene === 'Reprovado' ? 'selected' : ''}>❌ Reprovado</option>
                                        <option value="Com Ressalvas" ${qual.higiene === 'Com Ressalvas' ? 'selected' : ''}>⚠️ Com Ressalvas</option>
                                    </select>
                                </div>
                                <div>
                                    <label class="block text-xs font-bold text-gray-600 mb-1">Embalagem</label>
                                    <select name="qualidade_embalagem" class="border p-2 rounded w-full">
                                        <option value="Adequada" ${qual.embalagem === 'Adequada' ? 'selected' : ''}>✔ Adequada</option>
                                        <option value="Inadequada" ${qual.embalagem === 'Inadequada' ? 'selected' : ''}>❌ Inadequada</option>
                                    </select>
                                </div>
                                <div>
                                    <label class="block text-xs font-bold text-gray-600 mb-1">Responsável Inspeção</label>
                                    <input name="qualidade_responsavel" value="${qual.responsavel || ''}" class="border p-2 rounded w-full" placeholder="Nome do Inspetor">
                                </div>
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-600 mb-1">Observações de Qualidade</label>
                                <textarea name="qualidade_observacoes" class="border p-2 rounded w-full h-16" placeholder="Ex: Ajustar sal na próxima remessa...">${qual.observacoes || ''}</textarea>
                            </div>
                        </div>
                    </div>

                    <!-- TAB 8: ENTREGA / DISTRIBUIÇÃO -->
                    <div id="tab-entrega" class="op-tab-content hidden">
                        <div class="bg-blue-50 p-4 rounded border border-blue-200 mb-4">
                            <h4 class="font-bold text-blue-800 mb-3 text-sm uppercase flex items-center gap-2"><i class="fas fa-truck"></i> Logística de Entrega</h4>
                            
                            <div class="grid grid-cols-2 gap-4 mb-3">
                                <div>
                                    <label class="block text-xs font-bold text-gray-600 mb-1">Destino / Local</label>
                                    <input name="entrega_destino" value="${entrega.destino || ''}" class="border p-2 rounded w-full" placeholder="Ex: Hospital Ala A">
                                </div>
                                <div>
                                    <label class="block text-xs font-bold text-gray-600 mb-1">Horário de Saída</label>
                                    <input type="time" name="entrega_horario" value="${entrega.horario || ''}" class="border p-2 rounded w-full">
                                </div>
                                <div>
                                    <label class="block text-xs font-bold text-gray-600 mb-1">Responsável Transporte</label>
                                    <input name="entrega_responsavel" value="${entrega.responsavel || ''}" class="border p-2 rounded w-full">
                                </div>
                                <div>
                                    <label class="block text-xs font-bold text-gray-600 mb-1">Status da Entrega</label>
                                    <select name="entrega_status" class="border p-2 rounded w-full">
                                        <option value="Pendente" ${entrega.status === 'Pendente' ? 'selected' : ''}>Pendente</option>
                                        <option value="Em Transporte" ${entrega.status === 'Em Transporte' ? 'selected' : ''}>Em Transporte</option>
                                        <option value="Entregue" ${entrega.status === 'Entregue' ? 'selected' : ''}>Entregue</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-600 mb-1">Observações de Entrega</label>
                                <textarea name="entrega_observacoes" class="border p-2 rounded w-full h-16" placeholder="Ex: Entregar na recepção...">${entrega.observacoes || ''}</textarea>
                            </div>
                        </div>
                    </div>

                    <div class="flex justify-between items-center mt-6 pt-4 border-t">
                        ${op ? `<button type="button" onclick="ProducaoModule.printOrdem('${op.ID}')" class="bg-gray-600 text-white px-4 py-2 rounded shadow hover:bg-gray-700"><i class="fas fa-print"></i> Imprimir</button>` : ''}
                        <div class="flex gap-2">
                            <button type="button" onclick="Utils.closeModal()" class="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Cancelar</button>
                            <button type="submit" class="bg-blue-600 text-white px-6 py-2 rounded shadow hover:bg-blue-700 font-bold">
                                ${op ? 'Salvar Alterações' : 'Gerar OP'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        `);
    },

    saveOrdemProducao: async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        
        // Processar Dados Complexos (Arrays)
        const pratos = [];
        const etapas = [];
        const equipe = [];
        
        // Extrair Pratos
        for (const [key, value] of formData.entries()) {
            if (key.startsWith('prato_nome_')) {
                const idx = key.split('_')[2];
                pratos.push({
                    nome: value,
                    porcoes: formData.get(`prato_porcoes_${idx}`),
                    receitaId: formData.get(`prato_receita_${idx}`)
                });
            }
        }

        // Extrair Etapas
        for (const [key, value] of formData.entries()) {
            if (key.startsWith('etapa_nome_')) {
                const idx = key.split('_')[2];
                etapas.push({
                    nome: value,
                    status: formData.get(`etapa_status_${idx}`)
                });
            }
        }

        // Extrair Equipe
        for (const [key, value] of formData.entries()) {
            if (key.startsWith('equipe_func_')) {
                const idx = key.split('_')[2];
                equipe.push({
                    funcionario: value,
                    tarefa: formData.get(`equipe_tarefa_${idx}`),
                    horario: formData.get(`equipe_hora_${idx}`)
                });
            }
        }

        // Recalcular Ingredientes para salvar no JSON (Snapshot)
        const ingredientes = [];
        // (Lógica simplificada: idealmente recalcularia baseado nos pratos salvos)
        // Aqui vamos confiar que o backend ou o próximo load recalcula, 
        // mas para o recurso de "Baixa de Estoque" funcionar no backend, precisamos enviar a lista de ingredientes calculada.
        // Vou adicionar uma lógica rápida aqui para reconstruir a lista de ingredientes necessários.
        const fichas = ProducaoModule.state.cardapios || [];
        pratos.forEach(p => {
            const ficha = fichas.find(f => f.ID === p.receitaId);
            if (ficha && ficha.IngredientesJSON) {
                const fator = Number(p.porcoes) / (Number(ficha.Rendimento) || 1);
                ficha.IngredientesJSON.forEach(ing => {
                    ingredientes.push({ id: ing.id, qtdNecessaria: Number(ing.quantidade) * fator });
                });
            }
        });

        // Extrair Qualidade
        const qualidade = {
            temperatura: formData.get('qualidade_temperatura'),
            higiene: formData.get('qualidade_higiene'),
            embalagem: formData.get('qualidade_embalagem'),
            responsavel: formData.get('qualidade_responsavel'),
            observacoes: formData.get('qualidade_observacoes')
        };

        // Extrair Entrega
        const entrega = {
            destino: formData.get('entrega_destino'),
            horario: formData.get('entrega_horario'),
            responsavel: formData.get('entrega_responsavel'),
            status: formData.get('entrega_status'),
            observacoes: formData.get('entrega_observacoes')
        };

        const payload = {
            Data: formData.get('Data'),
            Responsavel: formData.get('Responsavel'),
            Status: formData.get('Status'),
            OrigemTipo: formData.get('OrigemTipo'),
            DetalhesProducao: { pratos, etapas, equipe, ingredientes, qualidade, entrega }
        };

        const id = formData.get('ID');
        if (id) {
            payload.ID = id;
        } else {
            // Novo registro
            if (payload.OrigemTipo === 'Rotina') {
                payload.PlanejamentoID = formData.get('RefID');
            } else {
                payload.EventoID = formData.get('RefID');
            }
        }

        try {
            if (id) {
                // Edição: Atualiza status e estoque (já tem ID)
                await Utils.api('updateProductionStatus', null, { 
                    id: payload.ID, 
                    status: payload.Status, 
                    detalhes: payload.DetalhesProducao 
                });
            } else {
                // Criação: Salva primeiro para gerar o ID
                const res = await Utils.api('save', 'OrdensProducao', payload);
                
                // Se o status inicial já for 'Em Produção' ou 'Concluída', aciona a lógica de estoque com o novo ID
                if (payload.Status !== 'Pendente' && res && res.length > 0) {
                    await Utils.api('updateProductionStatus', null, { 
                        id: res[0].ID, 
                        status: payload.Status, 
                        detalhes: payload.DetalhesProducao 
                    });
                }
            }

            Utils.toast('Ordem de Produção atualizada!', 'success');
            Utils.closeModal();
            ProducaoModule.fetchData();
        } catch (err) {
            Utils.toast('Erro ao salvar OP: ' + err.message, 'error');
        }
    },

    addPratoRow: () => {
        const idx = Date.now();
        const html = `
            <tr class="prato-row border-b">
                <td class="p-2"><input type="text" name="prato_nome_${idx}" class="border p-1 rounded w-full text-sm"></td>
                <td class="p-2"><input type="number" name="prato_porcoes_${idx}" class="porcoes-input border p-1 rounded w-full text-sm text-center" onchange="calcIngredients()"></td>
                <td class="p-2">
                    <select name="prato_receita_${idx}" class="receita-select border p-1 rounded w-full text-sm" onchange="calcIngredients()">
                        <option value="">Sem Receita</option>
                        ${ProducaoModule.state.cardapios.map(f => `<option value="${f.ID}">${f.Nome}</option>`).join('')}
                    </select>
                </td>
            </tr>`;
        document.getElementById('pratos-list').insertAdjacentHTML('beforeend', html);
    },

    addEquipeRow: () => {
        const idx = Date.now();
        const html = `
            <tr class="equipe-row border-b">
                <td class="p-2"><input name="equipe_func_${idx}" class="border p-1 rounded w-full" placeholder="Nome"></td>
                <td class="p-2"><input name="equipe_tarefa_${idx}" class="border p-1 rounded w-full" placeholder="Tarefa"></td>
                <td class="p-2"><input name="equipe_hora_${idx}" class="border p-1 rounded w-full" placeholder="Horário"></td>
                <td class="p-2 text-center"><button type="button" onclick="this.closest('tr').remove()" class="text-red-500"><i class="fas fa-times"></i></button></td>
            </tr>`;
        document.getElementById('equipe-list').insertAdjacentHTML('beforeend', html);
    },

    printOrdem: (id) => {
        const op = ProducaoModule.state.ordens.find(o => o.ID === id);
        if (!op) return;
        
        let origem = 'Desconhecida';
        if (op.OrigemTipo === 'Evento' || op.EventoID) {
            const evt = ProducaoModule.state.eventos.find(e => e.ID === op.EventoID);
            origem = evt ? `Evento: ${evt.Titulo}` : 'Evento';
        } else {
            origem = 'Pedido (Rotina)';
        }
        
        const entrega = (op.DetalhesProducao && op.DetalhesProducao.entrega) ? op.DetalhesProducao.entrega : null;

        const html = `
            <div class="p-8 font-sans text-gray-900 bg-white border-2 border-gray-800 max-w-2xl mx-auto">
                <div class="text-center border-b-2 border-gray-800 pb-4 mb-6">
                    <h1 class="text-2xl font-bold uppercase">Ordem de Produção</h1>
                    <h2 class="text-xl font-mono mt-2">OP Nº ${String(op.Codigo).padStart(5, '0')}</h2>
                </div>
                
                <table class="w-full text-sm mb-6">
                    <tr><td class="py-2 font-bold w-1/3">Origem:</td><td>${origem}</td></tr>
                    <tr><td class="py-2 font-bold">Data:</td><td>${Utils.formatDate(op.Data)}</td></tr>
                    <tr><td class="py-2 font-bold">Responsável:</td><td>${op.Responsavel}</td></tr>
                    <tr><td class="py-2 font-bold">Status:</td><td>${op.Status}</td></tr>
                </table>

                ${entrega ? `
                <div class="mt-6 border-t border-gray-800 pt-4">
                    <h3 class="font-bold text-sm uppercase mb-2">Logística de Entrega</h3>
                    <table class="w-full text-sm">
                        <tr><td class="py-1 font-bold w-1/3">Destino:</td><td>${entrega.destino || '-'}</td></tr>
                        <tr><td class="py-1 font-bold">Horário:</td><td>${entrega.horario || '-'}</td></tr>
                        <tr><td class="py-1 font-bold">Status:</td><td>${entrega.status || '-'}</td></tr>
                        <tr><td class="py-1 font-bold">Responsável:</td><td>${entrega.responsavel || '-'}</td></tr>
                    </table>
                </div>
                ` : ''}

                <div class="mt-12 border-t border-gray-800 pt-2 text-center text-xs text-gray-500">
                    Assinatura do Responsável
                </div>
            </div>
        `;
        Utils.printNative(html);
    },

    // --- MODAIS E AÇÕES ---

    modalPlanejamento: (id = null, date = null) => {
        const plan = id ? ProducaoModule.state.pedidosDia.find(p => p.id === id) : {};
        const d = date || plan.planning_date || new Date().toISOString().split('T')[0];
        
        const details = plan.production_details || {};
        const solidos = details.solidos || {};
        const sopa = details.sopa || {};
        const cha = details.cha || {};

        Utils.openModal(id ? 'Editar Planejamento' : 'Novo Planejamento de Produção', `
            <form onsubmit="ProducaoModule.saveProductionPlan(event)">
                <input type="hidden" name="id" value="${plan.id || ''}">
                <div class="bg-blue-50 p-4 rounded mb-4 border border-blue-100">
                    <h4 class="font-bold text-blue-800 mb-2 text-sm uppercase">1. Metas (Pessoas)</h4>
                    <div class="grid grid-cols-3 gap-4">
                        <div><label class="text-xs font-bold block">Data</label><input type="date" name="planning_date" value="${d}" class="border p-2 rounded w-full" required></div>
                        <div><label class="text-xs font-bold block">Staff (Dia/Noite)</label><div class="flex gap-1"><input type="number" name="staff_count_day" value="${plan.staff_count_day || ''}" placeholder="D" class="border p-2 w-full"><input type="number" name="staff_count_night" value="${plan.staff_count_night || ''}" placeholder="N" class="border p-2 w-full"></div></div>
                        <div><label class="text-xs font-bold block">Pacientes (Sól/Liq)</label><div class="flex gap-1"><input type="number" name="patient_solid" value="${plan.patient_solid || ''}" placeholder="S" class="border p-2 w-full"><input type="number" name="patient_liquid" value="${plan.patient_liquid || ''}" placeholder="L" class="border p-2 w-full"></div></div>
                    </div>
                </div>

                <div class="mb-4">
                    <h4 class="font-bold text-gray-700 mb-2 text-sm uppercase border-b">2. Prato Principal</h4>
                    <input id="solid-dish-name" value="${solidos.prato || ''}" class="border p-2 rounded w-full mb-2 font-bold" placeholder="Nome do Prato (Ex: Frango Grelhado)">
                    <div id="solid-ingredients-list" class="space-y-2 mb-2"></div>
                    <button type="button" onclick="ProducaoModule.addIngredienteRow()" class="text-xs text-blue-600 hover:underline font-bold">+ Add Ingrediente</button>
                </div>

                <div class="grid grid-cols-2 gap-4 mb-4">
                    <div>
                        <h4 class="font-bold text-gray-700 mb-2 text-sm uppercase border-b">3. Sopa</h4>
                        <div class="grid grid-cols-2 gap-2 text-xs">
                            <input type="number" step="0.1" id="soup-fuba" value="${sopa.fuba || ''}" placeholder="Fuba" class="border p-1 rounded">
                            <input type="number" step="0.1" id="soup-potato" value="${sopa.batata || ''}" placeholder="Batata Rena" class="border p-1 rounded">
                            <input type="number" step="0.1" id="soup-pasta" value="${sopa.massa || ''}" placeholder="Massa" class="border p-1 rounded">
                            <input type="number" step="0.1" id="soup-onion" value="${sopa.cebola || ''}" placeholder="Cebola" class="border p-1 rounded">
                            <input type="number" step="0.1" id="soup-carne-seca" value="${sopa.carne_seca || ''}" placeholder="Carne Seca" class="border p-1 rounded">
                            <input type="number" step="0.1" id="soup-costelinha" value="${sopa.costelinha || ''}" placeholder="Costelinha" class="border p-1 rounded">
                            <input type="number" step="0.1" id="soup-paio" value="${sopa.paio || ''}" placeholder="Paio" class="border p-1 rounded">
                            <input type="number" step="0.1" id="soup-calabresa" value="${sopa.calabresa || ''}" placeholder="Linguiça Calabresa" class="border p-1 rounded">
                        </div>
                        <div class="mt-2 text-xs">
                            ${['Cenoura', 'Abóbora', 'Couve', 'Repolho'].map(v => {
                                const checked = (sopa.legumes || []).includes(v) ? 'checked' : '';
                                return `<label class="inline-flex items-center mr-2"><input type="checkbox" class="soup-veg" value="${v}" ${checked}> ${v}</label>`;
                            }).join('')}
                        </div>
                    </div>
                    <div>
                        <h4 class="font-bold text-gray-700 mb-2 text-sm uppercase border-b">4. Chá</h4>
                        <div class="space-y-2">
                            <input type="number" step="0.1" id="tea-herb" value="${cha.erva || ''}" placeholder="Erva (Qtd)" class="border p-2 rounded w-full text-sm">
                            <input type="number" step="0.1" id="tea-sugar" value="${cha.acucar || ''}" placeholder="Açúcar (Kg)" class="border p-2 rounded w-full text-sm">
                        </div>
                    </div>
                </div>

                <button class="w-full bg-green-600 text-white py-3 rounded font-bold shadow hover:bg-green-700">Salvar Planejamento</button>
            </form>
        `);
        
        // Preencher ingredientes
        const ingredientsList = solidos.ingredientes || [];
        if (ingredientsList.length > 0) {
            ingredientsList.forEach(ing => {
                ProducaoModule.addIngredienteRow(ing.item, ing.qtd);
            });
        } else {
            ProducaoModule.addIngredienteRow();
        }
    },

    addIngredienteRow: (item = '', qtd = '') => {
        const container = document.getElementById('solid-ingredients-list');
        if (!container) return;
        const div = document.createElement('div');
        div.className = 'flex gap-2 items-center ingredient-row';
        div.innerHTML = `<input type="text" value="${item}" placeholder="Item" class="border p-1 rounded w-full text-sm ing-name"><input type="text" value="${qtd}" placeholder="Qtd" class="border p-1 rounded w-20 text-sm ing-qty"><button type="button" onclick="this.parentElement.remove()" class="text-red-500"><i class="fas fa-times"></i></button>`;
        container.appendChild(div);
    },

    saveProductionPlan: async (e) => {
        e.preventDefault();
        const form = e.target;
        const formData = new FormData(form);
        const id = formData.get('id');
        
        const baseData = { 
            planning_date: formData.get('planning_date'), 
            staff_count_day: Number(formData.get('staff_count_day')||0), 
            staff_count_night: Number(formData.get('staff_count_night')||0), 
            patient_solid: Number(formData.get('patient_solid')||0), 
            patient_liquid: Number(formData.get('patient_liquid')||0) 
        };
        
        if (id) baseData.id = id;
        
        const solidIngredients = [];
        document.querySelectorAll('.ingredient-row').forEach(row => { 
            const name = row.querySelector('.ing-name').value; 
            const qty = row.querySelector('.ing-qty').value; 
            if (name) solidIngredients.push({ item: name, qtd: qty }); 
        });
        
        const soupVegs = [];
        document.querySelectorAll('.soup-veg:checked').forEach(cb => soupVegs.push(cb.value));

        const productionDetails = { 
            solidos: { prato: document.getElementById('solid-dish-name').value, ingredientes: solidIngredients }, 
            sopa: { 
                fuba: document.getElementById('soup-fuba').value, 
                batata: document.getElementById('soup-potato').value, 
                massa: document.getElementById('soup-pasta').value, 
                cebola: document.getElementById('soup-onion').value, 
                carne_seca: document.getElementById('soup-carne-seca').value, 
                costelinha: document.getElementById('soup-costelinha').value, 
                paio: document.getElementById('soup-paio').value, 
                calabresa: document.getElementById('soup-calabresa').value, 
                legumes: soupVegs 
            }, 
            cha: { erva: document.getElementById('tea-herb').value, acucar: document.getElementById('tea-sugar').value } 
        };
        
        try { 
            await Utils.api('save', 'production_plans', { ...baseData, production_details: productionDetails }); 
            Utils.toast('Planejamento salvo!', 'success'); 
            Utils.closeModal();
            ProducaoModule.fetchData(); 
        } catch (err) { Utils.toast('Erro: ' + err.message, 'error'); }
    },

    printProductionPlan: (id) => {
        const plan = ProducaoModule.state.pedidosDia.find(p => p.id === id);
        if (!plan) return;

        const op = ProducaoModule.state.ordens.find(o => o.PlanejamentoID === id);
        
        const details = plan.production_details || {};
        const solidos = details.solidos || {};
        const qual = (op && op.DetalhesProducao && op.DetalhesProducao.qualidade) ? op.DetalhesProducao.qualidade : null;
        
        const html = `
            <div class="p-8 bg-white text-black font-sans">
                <h1 class="text-2xl font-bold mb-4">Ficha de Produção - ${Utils.formatDate(plan.planning_date)}</h1>
                <div class="mb-4 border p-4">
                    <h2 class="font-bold">Metas</h2>
                    <p>Sólidos: ${plan.meta_solid} | Sopa: ${plan.meta_soup} | Chá: ${plan.meta_tea}</p>
                </div>
                <div class="mb-4 border p-4">
                    <h2 class="font-bold">Prato Principal: ${solidos.prato || '-'}</h2>
                    <ul>${(solidos.ingredientes||[]).map(i => `<li>${i.item}: ${i.qtd}</li>`).join('')}</ul>
                </div>
                
                ${qual ? `
                <div class="mb-4 border p-4 bg-gray-50">
                    <h2 class="font-bold border-b mb-2">Controle de Qualidade</h2>
                    <p><b>Temperatura:</b> ${qual.temperatura || '-'}</p>
                    <p><b>Higiene:</b> ${qual.higiene || '-'}</p>
                    <p><b>Embalagem:</b> ${qual.embalagem || '-'}</p>
                    <p><b>Inspetor:</b> ${qual.responsavel || '-'}</p>
                    <p><b>Obs:</b> ${qual.observacoes || '-'}</p>
                </div>
                ` : ''}

            </div>
        `;
        Utils.printNative(html);
    },

    modalFicha: (id = null) => {
        const ficha = id ? ProducaoModule.state.cardapios.find(f => f.ID === id) : {};
        Utils.openModal(id ? 'Editar Ficha Técnica' : 'Nova Ficha Técnica', `
            <form onsubmit="ProducaoModule.saveFicha(event)">
                <input type="hidden" name="ID" value="${ficha.ID || ''}">
                <div class="mb-3"><label class="text-xs font-bold">Nome da Preparação</label><input name="Nome" value="${ficha.Nome || ''}" class="border p-2 rounded w-full" required></div>
                <div class="grid grid-cols-2 gap-3 mb-3">
                    <div><label class="text-xs font-bold">Categoria</label><select name="Categoria" class="border p-2 rounded w-full"><option>Prato Principal</option><option>Guarnição</option><option>Sobremesa</option><option>Salada</option></select></div>
                    <div><label class="text-xs font-bold">Tempo Preparo</label><input name="TempoPreparo" value="${ficha.TempoPreparo || ''}" class="border p-2 rounded w-full"></div>
                </div>
                <div class="grid grid-cols-2 gap-3 mb-3">
                    <div><label class="text-xs font-bold">Rendimento (Porções)</label><input type="number" name="Rendimento" value="${ficha.Rendimento || ''}" class="border p-2 rounded w-full"></div>
                    <div><label class="text-xs font-bold">Custo Total (Kz)</label><input type="number" step="0.01" name="CustoPorPorcao" value="${ficha.CustoPorPorcao || ''}" class="border p-2 rounded w-full"></div>
                </div>
                <button class="w-full bg-blue-600 text-white py-2 rounded font-bold">Salvar Ficha</button>
            </form>
        `);
    },

    saveFicha: async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target).entries());
        try {
            await Utils.api('save', 'FichasTecnicas', data);
            Utils.toast('Ficha salva!', 'success');
            Utils.closeModal();
            ProducaoModule.fetchData();
        } catch (err) { Utils.toast('Erro: ' + err.message, 'error'); }
    }
};

document.addEventListener('DOMContentLoaded', ProducaoModule.init);
