const FinancasModule = {
    state: {
        data: null,
        config: null,
        filterDate: new Date().toISOString().slice(0, 7), // YYYY-MM
        charts: {},
        activeTab: 'dashboard',
        categories: {
            'Receita': {
                'Vendas a Prazo (Clientes)': ['Faturas emitidas e não pagas', 'Pagamentos parcelados', 'Vendas no crédito', 'Encomendas com pagamento futuro'],
                'Serviços Prestados': ['Mensalidades', 'Contratos de manutenção', 'Consultorias', 'Projetos em andamento', 'Serviços recorrentes'],
                'Assinaturas e Planos Mensais': ['Planos mensais', 'Pagamento de alunos', 'Clientes fixos', 'Subscrições'],
                'Parcelas Pendentes': ['Entrada + parcelas', 'Credário interno', 'Pagamentos divididos'],
                'Recebimentos de Convênios e Parceiros': ['Convênios empresariais', 'Parcerias comerciais', 'Programas governamentais', 'Subsídios'],
                'Pagamentos via Multicaixa / Transferência pendente': ['Transferência agendada', 'Depósito em análise', 'Pagamento via referência'],
                'Outros Valores a Receber': ['Reembolsos', 'Ajustes financeiros', 'Créditos pendentes', 'Indenizações']
            },
            'Despesa': {
                'Despesas Operacionais': ['Internet', 'Plano boss/ telefone', 'Limpeza e manutenção'],
                'Despesas com Funcionários': ['Salários', 'Subsídios (alimentação, transporte)', 'INSS / Segurança Social', 'Férias e 13º', 'Bónus e comissões', 'Formação profissional'],
                'Compras e Fornecedores': ['Matéria-prima', 'Mercadorias para Produção', 'Material de escritório', 'Equipamentos (computadores, máquinas)', 'Produtos de limpeza', 'Uniformes'],
                'Logística e Transporte': ['Combustível', 'Manutenção de viaturas', 'Manutenção de motociclo', 'Seguro automóvel', 'Transporte de mercadorias', 'Fretes e entregas'],
                'Manutenção e Reparos': ['Reparação de equipamentos', 'Manutenção predial', 'Troca de peças', 'Serviços técnicos'],
                'Marketing e Publicidade': ['Anúncios no Facebook/Instagram', 'Impressão de cartazes e panfletos', 'Branding e design', 'Agência de marketing', 'Produção de vídeos'],
                'Impostos e Obrigações Legais': ['IVA', 'Imposto Industrial', 'Taxas municipais', 'Licenças e alvarás', 'Contabilidade e auditoria'],
                'Tecnologia e Sistemas': ['Hospedagem do sistema', 'Domínio do site', 'Licenças de software (Office, ERP)', 'Serviços cloud (Supabase, AWS)', 'Equipamentos de TI'],
                'Saúde, Seguros e Benefícios': ['Seguro de saúde', 'Seguro empresarial', 'Seguro contra incêndios', 'Benefícios aos funcionários'],
                'Outras Despesas Gerais': ['Viagens e estadias', 'Eventos e reuniões', 'Consultorias', 'Despesas imprevistas']
            }
        }
    },

    init: () => {
        FinancasModule.renderLayout();
        FinancasModule.fetchData();
    },

    fetchData: async () => {
        try {
            const [finData, configData] = await Promise.all([
                Utils.api('getFinancialDashboard', null, { 
                    startDate: FinancasModule.state.filterDate + '-01',
                    endDate: new Date(FinancasModule.state.filterDate.split('-')[0], FinancasModule.state.filterDate.split('-')[1], 0).toISOString().split('T')[0]
                }),
                Utils.api('getAll', 'InstituicaoConfig')
            ]);

            FinancasModule.state.data = finData;
            FinancasModule.state.config = configData[0] || {};
            
            // Renderiza a aba ativa
            if (FinancasModule.state.activeTab === 'dashboard') FinancasModule.renderDashboard();
            else if (FinancasModule.state.activeTab === 'fluxo') FinancasModule.renderFluxo();
            else if (FinancasModule.state.activeTab === 'pagar') FinancasModule.renderContas('pagar');
            else if (FinancasModule.state.activeTab === 'receber') FinancasModule.renderContas('receber');

        } catch (e) {
            console.error(e);
            Utils.toast("Erro ao carregar finanças.", "error");
        }
    },

    renderLayout: () => {
        document.getElementById('financas-content').innerHTML = `
            <div class="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <div class="flex bg-white rounded-lg shadow overflow-hidden">
                    <button onclick="FinancasModule.switchTab('dashboard')" id="tab-dashboard" class="px-4 py-2 text-sm font-medium bg-blue-50 text-blue-600 border-r hover:bg-gray-50 transition">Dashboard</button>
                    <button onclick="FinancasModule.switchTab('fluxo')" id="tab-fluxo" class="px-4 py-2 text-sm font-medium text-gray-600 border-r hover:bg-gray-50 transition">Fluxo de Caixa</button>
                    <button onclick="FinancasModule.switchTab('pagar')" id="tab-pagar" class="px-4 py-2 text-sm font-medium text-gray-600 border-r hover:bg-gray-50 transition">A Pagar</button>
                    <button onclick="FinancasModule.switchTab('receber')" id="tab-receber" class="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition">A Receber</button>
                </div>
                
                <div class="flex items-center gap-2">
                    <label class="font-bold text-gray-700 text-sm">Período:</label>
                    <input type="month" value="${FinancasModule.state.filterDate}" 
                        onchange="FinancasModule.changeDate(this.value)"
                        class="border p-1.5 rounded shadow-sm text-sm">
                    <button onclick="FinancasModule.fetchData()" class="bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700"><i class="fas fa-sync-alt"></i></button>
                </div>
            </div>
            <div id="tab-content"></div>
        `;
    },

    switchTab: (tab) => {
        FinancasModule.state.activeTab = tab;
        
        // Atualiza estilo dos botões
        document.querySelectorAll('[id^="tab-"]').forEach(btn => {
            btn.className = 'px-4 py-2 text-sm font-medium text-gray-600 border-r hover:bg-gray-50 transition';
        });
        const activeBtn = document.getElementById(`tab-${tab}`);
        if(activeBtn) activeBtn.className = 'px-4 py-2 text-sm font-medium bg-blue-50 text-blue-600 border-r border-b-2 border-b-blue-600 transition';

        // Renderiza conteúdo
        if (tab === 'dashboard') FinancasModule.renderDashboard();
        else if (tab === 'fluxo') FinancasModule.renderFluxo();
        else if (tab === 'pagar') FinancasModule.renderContas('pagar');
        else if (tab === 'receber') FinancasModule.renderContas('receber');
    },

    renderDashboard: () => {
        const container = document.getElementById('tab-content');
        if (!container || !FinancasModule.state.data) return;

        const { resumo, graficos, pendencias, listas } = FinancasModule.state.data;
        const meta = resumo.meta || { receitaEsperada: 0, despesaMaxima: 0 };

        const pctReceita = meta.receitaEsperada > 0 ? (resumo.receita / meta.receitaEsperada) * 100 : 0;
        const pctDespesa = meta.despesaMaxima > 0 ? (resumo.despesa / meta.despesaMaxima) * 100 : 0;
        let colorDespesa = 'bg-green-500';
        if (pctDespesa > 100) colorDespesa = 'bg-red-500';
        else if (pctDespesa > 80) colorDespesa = 'bg-yellow-500';

        container.innerHTML = `
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div class="bg-white p-6 rounded-lg shadow border-l-4 border-green-500">
                    <div class="text-gray-500 text-sm font-bold uppercase">Receita Total</div>
                    <div class="text-3xl font-bold text-green-600 mt-1">${Utils.formatCurrency(resumo.receita)}</div>
                </div>
                <div class="bg-white p-6 rounded-lg shadow border-l-4 border-red-500">
                    <div class="text-gray-500 text-sm font-bold uppercase">Despesa Total</div>
                    <div class="text-3xl font-bold text-red-600 mt-1">${Utils.formatCurrency(resumo.despesa)}</div>
                </div>
                <div class="bg-white p-6 rounded-lg shadow border-l-4 border-blue-500">
                    <div class="text-gray-500 text-sm font-bold uppercase">Saldo Líquido</div>
                    <div class="text-3xl font-bold ${resumo.saldo >= 0 ? 'text-blue-600' : 'text-red-600'} mt-1">${Utils.formatCurrency(resumo.saldo)}</div>
                </div>
            </div>

            <!-- Novos Cards de Pendências -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div class="bg-white p-6 rounded-lg shadow border-l-4 border-blue-400">
                    <div class="flex justify-between items-start">
                        <div>
                            <div class="text-gray-500 text-sm font-bold uppercase">Contas a Receber (Pendente)</div>
                            <div class="text-3xl font-bold text-blue-600 mt-1">${Utils.formatCurrency(pendencias.aReceber)}</div>
                        </div>
                        <div class="text-right">
                            <div class="text-xs text-gray-500">Atrasado</div>
                            <div class="text-sm font-bold text-red-500">${Utils.formatCurrency(pendencias.aReceberAtrasado)}</div>
                        </div>
                    </div>
                </div>
                <div class="bg-white p-6 rounded-lg shadow border-l-4 border-red-400">
                    <div class="flex justify-between items-start">
                        <div>
                            <div class="text-gray-500 text-sm font-bold uppercase">Contas a Pagar (Pendente)</div>
                            <div class="text-3xl font-bold text-red-600 mt-1">${Utils.formatCurrency(pendencias.aPagar)}</div>
                        </div>
                        <div class="text-right">
                            <div class="text-xs text-gray-500">Atrasado</div>
                            <div class="text-sm font-bold text-red-500">${Utils.formatCurrency(pendencias.aPagarAtrasado)}</div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div class="bg-white p-4 rounded shadow">
                    <h4 class="font-bold text-gray-700 mb-4 border-b pb-2">Fluxo de Caixa Diário</h4>
                    <div class="h-64"><canvas id="chartFluxo"></canvas></div>
                </div>
                <div class="bg-white p-4 rounded shadow">
                    <h4 class="font-bold text-gray-700 mb-4 border-b pb-2">Despesas por Categoria</h4>
                    <div class="h-64"><canvas id="chartDespesas"></canvas></div>
                </div>
                <div class="bg-white p-4 rounded shadow">
                    <h4 class="font-bold text-gray-700 mb-4 border-b pb-2">Contas a Receber por Categoria</h4>
                    <div class="h-64"><canvas id="chartReceberCategoria"></canvas></div>
                </div>
                <div class="bg-white p-4 rounded shadow">
                    <h4 class="font-bold text-gray-700 mb-4 border-b pb-2">Contas a Pagar por Categoria</h4>
                    <div class="h-64"><canvas id="chartPagarCategoria"></canvas></div>
                </div>
            </div>
            
            <div class="mt-6 flex justify-end gap-2">
                <button onclick="FinancasModule.modalMetas()" class="text-purple-600 hover:text-purple-800 text-sm font-bold"><i class="fas fa-bullseye"></i> Configurar Metas</button>
                <button onclick="FinancasModule.generatePDF()" class="text-red-600 hover:text-red-800 text-sm font-bold"><i class="fas fa-file-pdf"></i> Relatório PDF</button>
            </div>

            <div id="print-area-financas" class="hidden bg-white p-8"></div>
        `;

        FinancasModule.renderCharts(graficos, listas.contasReceber, listas.contasPagar);
    },

    renderFluxo: () => {
        const container = document.getElementById('tab-content');
        const transacoes = FinancasModule.state.data.transacoes || [];

        container.innerHTML = `
            <div class="bg-white rounded shadow overflow-hidden">
                <div class="p-4 border-b flex justify-between items-center bg-gray-50">
                    <h3 class="font-bold text-gray-700">Histórico de Transações</h3>
                    <button onclick="FinancasModule.modalLancamento()" class="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 text-sm font-bold">+ Novo Lançamento</button>
                </div>
                <div class="overflow-x-auto">
                    <table class="w-full text-sm text-left">
                        <thead class="bg-gray-100 text-gray-600 uppercase">
                            <tr>
                                <th class="p-3">Data</th>
                                <th class="p-3">Descrição</th>
                                <th class="p-3">Categoria</th>
                                <th class="p-3 text-right">Valor</th>
                                <th class="p-3 text-center">Ações</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y">
                            ${transacoes.map(t => `
                                <tr class="hover:bg-gray-50">
                                    <td class="p-3">${Utils.formatDate(t.Data)}</td>
                                    <td class="p-3 font-medium">${t.Descricao}</td>
                                    <td class="p-3"><span class="bg-gray-100 px-2 py-1 rounded text-xs">${t.Categoria}</span></td>
                                    <td class="p-3 text-right font-bold ${t.Tipo === 'Receita' ? 'text-green-600' : 'text-red-600'}">
                                        ${t.Tipo === 'Receita' ? '+' : '-'}${Utils.formatCurrency(t.Valor)}
                                    </td>
                                    <td class="p-3 text-center">
                                        ${t.Anexo ? `<button onclick="FinancasModule.viewAnexo('${t.ID}')" class="text-blue-500 hover:text-blue-700 mr-2" title="Ver Anexo"><i class="fas fa-paperclip"></i></button>` : ''}
                                        <button onclick="FinancasModule.delete('Financas', '${t.ID}')" class="text-red-500 hover:text-red-700"><i class="fas fa-trash"></i></button>
                                    </td>
                                </tr>
                            `).join('')}
                            ${transacoes.length === 0 ? '<tr><td colspan="5" class="p-6 text-center text-gray-500">Nenhum lançamento neste período.</td></tr>' : ''}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    },

    renderContas: (tipo) => {
        const container = document.getElementById('tab-content');
        const lista = tipo === 'pagar' ? FinancasModule.state.data.listas.contasPagar : FinancasModule.state.data.listas.contasReceber;
        const titulo = tipo === 'pagar' ? 'Contas a Pagar' : 'Contas a Receber';
        const tabela = tipo === 'pagar' ? 'ContasPagar' : 'ContasReceber';
        const cor = tipo === 'pagar' ? 'red' : 'blue';

        // Gráfico para Contas a Receber OU Pagar
        let chartHTML = '';
        if (lista.length > 0) {
            const chartTitle = tipo === 'pagar' ? 'Contas a Pagar por Categoria' : 'Receita Pendente por Categoria';
            const chartId = tipo === 'pagar' ? 'chartContasPagar' : 'chartContasReceber';
            chartHTML = `
                <div class="bg-white p-4 rounded shadow mb-6">
                    <h4 class="font-bold text-gray-700 mb-4 border-b pb-2">${chartTitle}</h4>
                    <div class="h-64"><canvas id="${chartId}"></canvas></div>
                </div>
            `;
        }

        container.innerHTML = `
            ${chartHTML}
            <div class="bg-white rounded shadow overflow-hidden">
                <div class="p-4 border-b flex justify-between items-center bg-gray-50">
                    <h3 class="font-bold text-gray-700">${titulo} (Pendentes)</h3>
                    <button onclick="FinancasModule.modalConta('${tabela}')" class="bg-${cor}-600 text-white px-4 py-2 rounded hover:bg-${cor}-700 text-sm font-bold">+ Nova Conta</button>
                </div>
                <div class="overflow-x-auto">
                    <table class="w-full text-sm text-left">
                        <thead class="bg-gray-100 text-gray-600 uppercase">
                            <tr>
                                <th class="p-3">Vencimento</th>
                                <th class="p-3">${tipo === 'pagar' ? 'Fornecedor' : 'Cliente'}</th>
                                <th class="p-3">Descrição</th>
                                <th class="p-3">Categoria</th>
                                <th class="p-3 text-right">Valor</th>
                                <th class="p-3 text-center">Ações</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y">
                            ${lista.map(c => {
                                const today = new Date();
                                const venc = new Date(c.DataVencimento);
                                const vencido = venc < today;
                                
                                // Cálculo de dias de atraso
                                let diffDays = 0;
                                if (vencido) {
                                    const diffTime = today - venc;
                                    diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                }
                                const isCritical = vencido && diffDays > 5;

                                return `
                                <tr class="hover:bg-gray-50 ${isCritical ? 'bg-red-50 border-l-4 border-red-500' : ''}">
                                    <td class="p-3">
                                        <div class="${vencido ? 'text-red-600 font-bold' : ''}">${Utils.formatDate(c.DataVencimento)}</div>
                                        ${isCritical ? `<span class="text-[10px] bg-red-100 text-red-800 px-1 rounded font-bold">Atraso: ${diffDays} dias</span>` : (vencido ? '<span class="text-xs text-red-500">(Vencido)</span>' : '')}
                                    </td>
                                    <td class="p-3">${tipo === 'pagar' ? (c.Fornecedor || '-') : (c.Cliente || '-')}</td>
                                    <td class="p-3">
                                        ${c.Descricao}
                                        ${c.Subcategoria ? `<div class="text-xs text-gray-400">${c.Subcategoria}</div>` : ''}
                                    </td>
                                    <td class="p-3"><span class="bg-gray-100 px-2 py-1 rounded text-xs">${c.Categoria || '-'}</span></td>
                                    <td class="p-3 text-right font-bold">${Utils.formatCurrency(c.ValorTotal)}</td>
                                    <td class="p-3 text-center flex justify-center gap-2">
                                        <button onclick="FinancasModule.baixarConta('${tabela}', '${c.ID}', '${c.ValorTotal}')" class="bg-green-100 text-green-700 px-2 py-1 rounded hover:bg-green-200 text-xs font-bold" title="Baixar/Pagar"><i class="fas fa-check"></i></button>
                                        <button onclick="FinancasModule.delete('${tabela}', '${c.ID}')" class="text-red-500 hover:text-red-700"><i class="fas fa-trash"></i></button>
                                    </td>
                                </tr>
                            `}).join('')}
                            ${lista.length === 0 ? `<tr><td colspan="6" class="p-6 text-center text-gray-500">Nenhuma conta pendente.</td></tr>` : ''}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        // Renderizar Gráfico se houver dados
        if (lista.length > 0) {
            const catMap = {};
            lista.forEach(c => {
                const cat = c.Categoria || 'Outros';
                catMap[cat] = (catMap[cat] || 0) + Number(c.ValorTotal);
            });

            const chartKey = tipo === 'pagar' ? 'contasPagar' : 'contasReceber';
            const chartId = tipo === 'pagar' ? 'chartContasPagar' : 'chartContasReceber';
            const barColor = tipo === 'pagar' ? '#EF4444' : '#3B82F6';

            if (FinancasModule.state.charts[chartKey]) FinancasModule.state.charts[chartKey].destroy();

            const ctx = document.getElementById(chartId);
            if (ctx) {
                FinancasModule.state.charts[chartKey] = new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: Object.keys(catMap),
                        datasets: [{
                            label: tipo === 'pagar' ? 'Valor a Pagar (Kz)' : 'Valor a Receber (Kz)',
                            data: Object.values(catMap),
                            backgroundColor: barColor,
                            borderRadius: 4
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: { y: { beginAtZero: true } }
                    }
                });
            }
        }
    },

    renderCharts: (data, contasReceber, contasPagar) => {
        if (FinancasModule.state.charts.fluxo) FinancasModule.state.charts.fluxo.destroy();
        if (FinancasModule.state.charts.despesas) FinancasModule.state.charts.despesas.destroy();
        if (FinancasModule.state.charts.receberCategoria) FinancasModule.state.charts.receberCategoria.destroy();
        if (FinancasModule.state.charts.pagarCategoria) FinancasModule.state.charts.pagarCategoria.destroy();

        const ctxFluxo = document.getElementById('chartFluxo');
        if (ctxFluxo) {
            FinancasModule.state.charts.fluxo = new Chart(ctxFluxo, {
                type: 'line',
                data: {
                    labels: data.fluxoDiario.map(d => d.date.split('-')[2]),
                    datasets: [
                        { label: 'Receitas', data: data.fluxoDiario.map(d => d.receita), borderColor: '#10B981', backgroundColor: 'rgba(16, 185, 129, 0.1)', fill: true },
                        { label: 'Despesas', data: data.fluxoDiario.map(d => d.despesa), borderColor: '#EF4444', backgroundColor: 'rgba(239, 68, 68, 0.1)', fill: true }
                    ]
                },
                options: { responsive: true, maintainAspectRatio: false }
            });
        }

        const ctxDesp = document.getElementById('chartDespesas');
        if (ctxDesp) {
            FinancasModule.state.charts.despesas = new Chart(ctxDesp, {
                type: 'doughnut',
                data: {
                    labels: data.despesasCategoria.map(d => d.name),
                    datasets: [{
                        data: data.despesasCategoria.map(d => d.value),
                        backgroundColor: ['#EF4444', '#F59E0B', '#3B82F6', '#8B5CF6', '#6B7280']
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } }
            });
        }

        // Novo Gráfico: Contas a Receber por Categoria
        const ctxReceber = document.getElementById('chartReceberCategoria');
        if (ctxReceber && contasReceber) {
            const catMap = {};
            contasReceber.forEach(c => {
                const cat = c.Categoria || 'Outros';
                catMap[cat] = (catMap[cat] || 0) + Number(c.ValorTotal);
            });

            const sortedCats = Object.entries(catMap).sort((a, b) => b[1] - a[1]);

            FinancasModule.state.charts.receberCategoria = new Chart(ctxReceber, {
                type: 'bar',
                data: {
                    labels: sortedCats.map(c => c[0]),
                    datasets: [{
                        label: 'Valor a Receber (Kz)',
                        data: sortedCats.map(c => c[1]),
                        backgroundColor: '#3B82F6',
                        borderRadius: 4
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
            });
        }

        // Novo Gráfico: Contas a Pagar por Categoria
        const ctxPagar = document.getElementById('chartPagarCategoria');
        if (ctxPagar && contasPagar) {
            const catMap = {};
            contasPagar.forEach(c => {
                const cat = c.Categoria || 'Outros';
                catMap[cat] = (catMap[cat] || 0) + Number(c.ValorTotal);
            });

            const sortedCats = Object.entries(catMap).sort((a, b) => b[1] - a[1]);

            FinancasModule.state.charts.pagarCategoria = new Chart(ctxPagar, {
                type: 'bar',
                data: {
                    labels: sortedCats.map(c => c[0]),
                    datasets: [{
                        label: 'Valor a Pagar (Kz)',
                        data: sortedCats.map(c => c[1]),
                        backgroundColor: '#EF4444',
                        borderRadius: 4
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
            });
        }
    },

    changeDate: (val) => {
        FinancasModule.state.filterDate = val;
        FinancasModule.fetchData();
    },

    modalLancamento: () => {
        Utils.openModal('Novo Lançamento', `
            <form onsubmit="FinancasModule.save(event, 'Financas')">
                <div class="grid grid-cols-2 gap-4 mb-4">
                    <div>
                        <label class="text-xs font-bold">Tipo</label>
                        <select name="Tipo" id="tipo-select" class="border p-2 rounded w-full" onchange="FinancasModule.updateModalCategories()">
                            <option value="Receita">Receita</option>
                            <option value="Despesa" selected>Despesa</option>
                        </select>
                    </div>
                    <div><label class="text-xs font-bold">Data</label><input type="date" name="Data" value="${new Date().toISOString().split('T')[0]}" class="border p-2 rounded w-full" required></div>
                </div>
                
                <div class="grid grid-cols-2 gap-4 mb-4">
                    <div>
                        <label class="text-xs font-bold">Categoria</label>
                        <select name="Categoria" id="categoria-select" class="border p-2 rounded w-full" onchange="FinancasModule.updateModalSubcategories()" required>
                            <option value="">Selecione...</option>
                        </select>
                    </div>
                    <div>
                        <label class="text-xs font-bold">Item / Subcategoria</label>
                        <select name="Subcategoria" id="subcategoria-select" class="border p-2 rounded w-full">
                            <option value="">Selecione...</option>
                        </select>
                    </div>
                </div>

                <div class="mb-4"><label class="text-xs font-bold">Descrição</label><input name="Descricao" class="border p-2 rounded w-full" required></div>
                
                <div class="mb-4">
                    <label class="text-xs font-bold">Valor</label>
                    <input type="number" step="0.01" name="Valor" class="border p-2 rounded w-full" required>
                </div>
                
                <div class="mb-4">
                    <label class="text-xs font-bold">Anexo (Recibo/Foto)</label>
                    <input type="file" id="file-anexo" accept="image/*,application/pdf" class="border p-2 rounded w-full text-xs bg-gray-50">
                </div>
                
                <button class="w-full bg-green-600 text-white py-2 rounded font-bold">Salvar</button>
            </form>
        `);
        
        // Inicializa as categorias (já que Despesa vem selecionado por padrão)
        FinancasModule.updateModalCategories();
    },

    updateModalCategories: () => {
        const tipo = document.getElementById('tipo-select').value;
        const catSelect = document.getElementById('categoria-select');
        const subSelect = document.getElementById('subcategoria-select');
        
        catSelect.innerHTML = '<option value="">Selecione...</option>';
        subSelect.innerHTML = '<option value="">Selecione...</option>';
        
        const cats = FinancasModule.state.categories[tipo];
        if (cats) {
            Object.keys(cats).forEach(c => {
                catSelect.innerHTML += `<option value="${c}">${c}</option>`;
            });
        }
    },

    updateModalSubcategories: () => {
        const tipo = document.getElementById('tipo-select').value;
        const cat = document.getElementById('categoria-select').value;
        const subSelect = document.getElementById('subcategoria-select');
        
        subSelect.innerHTML = '<option value="">Selecione...</option>';
        
        if (FinancasModule.state.categories[tipo] && FinancasModule.state.categories[tipo][cat]) {
            FinancasModule.state.categories[tipo][cat].forEach(s => {
                subSelect.innerHTML += `<option value="${s}">${s}</option>`;
            });
        }
    },

    viewAnexo: (id) => {
        const t = FinancasModule.state.data.transacoes.find(x => x.ID === id);
        if (!t || !t.Anexo) return Utils.toast('Anexo não encontrado.', 'warning');
        
        let content;
        let downloadName = `anexo-${t.Data.split('T')[0]}`;
        
        if (t.Anexo.startsWith('data:application/pdf')) {
             content = `<iframe src="${t.Anexo}" style="width:100%; height:500px;" frameborder="0"></iframe>`;
             downloadName += '.pdf';
        } else {
             content = `<img src="${t.Anexo}" class="max-w-full max-h-[70vh] mx-auto border rounded shadow">`;
             downloadName += '.png';
        }
        
        Utils.openModal('Visualizar Anexo', `
            <div class="text-center">
                ${content}
                <div class="mt-4">
                    <a href="${t.Anexo}" download="${downloadName}" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm font-bold"><i class="fas fa-download mr-2"></i> Baixar Arquivo</a>
                </div>
            </div>
        `);
    },

    modalConta: (table) => {
        const label = table === 'ContasPagar' ? 'Fornecedor' : 'Cliente';
        const type = table === 'ContasPagar' ? 'Despesa' : 'Receita';
        
        Utils.openModal(table === 'ContasPagar' ? 'Nova Conta a Pagar' : 'Nova Conta a Receber', `
            <form onsubmit="FinancasModule.save(event, '${table}')">
                <div class="mb-4"><label class="text-xs font-bold">${label}</label><input name="${label}" class="border p-2 rounded w-full" required></div>
                
                <div class="grid grid-cols-2 gap-4 mb-4">
                    <div>
                        <label class="text-xs font-bold">Categoria</label>
                        <select name="Categoria" id="cat-conta" class="border p-2 rounded w-full" onchange="FinancasModule.updateAccountSubcategories('${type}')" required>
                            <option value="">Selecione...</option>
                        </select>
                    </div>
                    <div>
                        <label class="text-xs font-bold">Item / Subcategoria</label>
                        <select name="Subcategoria" id="sub-conta" class="border p-2 rounded w-full">
                            <option value="">Selecione...</option>
                        </select>
                    </div>
                </div>

                <div class="mb-4"><label class="text-xs font-bold">Descrição</label><input name="Descricao" class="border p-2 rounded w-full" required></div>
                <div class="grid grid-cols-2 gap-4 mb-4">
                    <div><label class="text-xs font-bold">Valor Total</label><input type="number" step="0.01" name="ValorTotal" class="border p-2 rounded w-full" required></div>
                    <div><label class="text-xs font-bold">Vencimento</label><input type="date" name="DataVencimento" class="border p-2 rounded w-full" required></div>
                </div>
                <button class="w-full bg-blue-600 text-white py-2 rounded font-bold">Salvar Conta</button>
            </form>
        `);
        
        // Inicializa as categorias
        FinancasModule.initAccountCategories(type);
    },

    initAccountCategories: (type) => {
        const catSelect = document.getElementById('cat-conta');
        if(!catSelect) return;
        
        const cats = FinancasModule.state.categories[type];
        if (cats) {
            Object.keys(cats).forEach(c => {
                catSelect.innerHTML += `<option value="${c}">${c}</option>`;
            });
        }
    },

    updateAccountSubcategories: (type) => {
        const cat = document.getElementById('cat-conta').value;
        const subSelect = document.getElementById('sub-conta');
        
        subSelect.innerHTML = '<option value="">Selecione...</option>';
        
        if (FinancasModule.state.categories[type] && FinancasModule.state.categories[type][cat]) {
            FinancasModule.state.categories[type][cat].forEach(s => {
                subSelect.innerHTML += `<option value="${s}">${s}</option>`;
            });
        }
    },

    save: async (e, table) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target).entries());

        // Lógica de Anexo (Se houver input de arquivo)
        const fileInput = document.getElementById('file-anexo');
        if (fileInput && fileInput.files[0]) {
            const file = fileInput.files[0];
            if (file.size > 2 * 1024 * 1024) return Utils.toast('⚠️ O arquivo é muito grande (Máx 2MB).', 'warning');
            
            try {
                const toBase64 = file => new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.readAsDataURL(file);
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = error => reject(error);
                });
                data.Anexo = await toBase64(file);
            } catch (err) { return Utils.toast('Erro ao processar anexo: ' + err.message, 'error'); }
        }

        try {
            await Utils.api('save', table, data);
            Utils.toast('Salvo com sucesso!', 'success');
            Utils.closeModal();
            FinancasModule.fetchData();
        } catch (err) { Utils.toast('Erro: ' + err.message, 'error'); }
    },

    baixarConta: async (table, id, valor) => {
        if(confirm('Confirmar baixa desta conta? Isso lançará o valor no Fluxo de Caixa.')) {
            try {
                await Utils.api('settleAccount', null, { id, table, valorPago: valor });
                Utils.toast('Conta baixada com sucesso!', 'success');
                FinancasModule.fetchData();
            } catch (err) { Utils.toast('Erro: ' + err.message, 'error'); }
        }
    },

    delete: async (table, id) => {
        if(confirm('Tem certeza que deseja excluir?')) {
            try {
                await Utils.api('delete', table, null, id);
                FinancasModule.fetchData();
            } catch (err) { Utils.toast('Erro ao excluir.', 'error'); }
        }
    },

    modalMetas: () => {
        const { resumo } = FinancasModule.state.data;
        const meta = resumo.meta || {};
        
        Utils.openModal('Definir Metas Financeiras', `
            <form onsubmit="FinancasModule.saveMetas(event)">
                <input type="hidden" name="Mes" value="${FinancasModule.state.filterDate}">
                <div class="mb-4 text-center bg-blue-50 p-2 rounded text-blue-800 font-bold">
                    Mês de Referência: ${FinancasModule.state.filterDate}
                </div>
                <div class="mb-4">
                    <label class="block text-sm font-bold mb-1">Receita Esperada (Meta)</label>
                    <input type="number" step="0.01" name="ReceitaEsperada" value="${meta.receitaEsperada || ''}" class="border p-2 rounded w-full" required>
                </div>
                <div class="mb-4">
                    <label class="block text-sm font-bold mb-1">Limite de Despesas (Orçamento)</label>
                    <input type="number" step="0.01" name="DespesaMaxima" value="${meta.despesaMaxima || ''}" class="border p-2 rounded w-full" required>
                </div>
                <button class="w-full bg-purple-600 text-white py-2 rounded font-bold hover:bg-purple-700">Salvar Metas</button>
            </form>
        `);
    },

    saveMetas: async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target).entries());
        try {
            await Utils.api('saveFinancialGoal', null, data);
            Utils.toast('Metas atualizadas com sucesso!', 'success');
            Utils.closeModal();
            FinancasModule.fetchData();
        } catch (err) {
            Utils.toast('Erro ao salvar metas: ' + err.message, 'error');
        }
    },

    generatePDF: () => {
        const { config, data, filterDate } = FinancasModule.state;
        const { resumo, transacoes } = data;
        const user = Utils.getUser();
        const element = document.getElementById('print-area-financas');
        
        // Processar dados para a tabela (Agrupar por Categoria > Subcategoria)
        const expenseMap = {};
        (transacoes || []).filter(t => t.Tipo === 'Despesa').forEach(t => {
            const cat = t.Categoria || 'Outros';
            const sub = t.Subcategoria || '-';
            const key = `${cat}###${sub}`;
            expenseMap[key] = (expenseMap[key] || 0) + Number(t.Valor);
        });

        const sortedExpenses = Object.entries(expenseMap)
            .map(([key, val]) => {
                const [cat, sub] = key.split('###');
                return { cat, sub, val };
            })
            .sort((a, b) => b.val - a.val);

        const totalReceita = resumo.receita || 1; // Evita divisão por zero

        // Data e Hora para o rodapé
        const now = new Date();
        const dateStr = now.toLocaleDateString('pt-AO', { day: 'numeric', month: 'long', year: 'numeric' });
        const timeStr = now.toLocaleTimeString('pt-AO', { hour: '2-digit', minute: '2-digit' });

        element.innerHTML = `
            <div class="flex justify-between items-start border-b-2 border-gray-800 pb-4 mb-6">
                <!-- Lado Esquerdo -->
                <div class="flex items-center gap-3">
                    ${config.LogotipoURL ? `<img src="${config.LogotipoURL}" class="h-12 w-auto object-contain">` : ''}
                    <span class="font-bold text-xl text-gray-800 tracking-wide">DELÍCIA DA CIDADE</span>
                </div>
                <!-- Lado Direito -->
                <div class="text-right">
                    <h2 class="text-xl font-bold text-gray-800">RELATÓRIO MENSAL</h2>
                    <p class="text-sm text-gray-600">Receitas, Despesas e Pendências</p>
                    <p class="text-xs text-gray-500 mt-1">Gerado em: ${new Date().toLocaleDateString()}</p>
                    <p class="text-xs text-gray-500">Por: ${user.Nome || 'Sistema'}</p>
                </div>
            </div>

            <!-- 3 Cards -->
            <div class="grid grid-cols-3 gap-4 mb-8 text-center">
                <div class="p-4 bg-gray-50 rounded border border-gray-200">
                    <div class="text-xs text-gray-500 font-bold uppercase tracking-wider">Receita</div>
                    <div class="text-xl font-bold text-green-600">${Utils.formatCurrency(resumo.receita)}</div>
                </div>
                <div class="p-4 bg-gray-50 rounded border border-gray-200">
                    <div class="text-xs text-gray-500 font-bold uppercase tracking-wider">Despesa</div>
                    <div class="text-xl font-bold text-red-600">${Utils.formatCurrency(resumo.despesa)}</div>
                </div>
                <div class="p-4 bg-gray-50 rounded border border-gray-200">
                    <div class="text-xs text-gray-500 font-bold uppercase tracking-wider">Saldo Atual</div>
                    <div class="text-xl font-bold ${resumo.saldo >= 0 ? 'text-blue-600' : 'text-red-600'}">${Utils.formatCurrency(resumo.saldo)}</div>
                </div>
            </div>

            <!-- Tabela Detalhada -->
            <h3 class="font-bold text-gray-800 mb-2 border-b pb-1 text-sm uppercase">Detalhamento de Despesas</h3>
            <table class="w-full text-xs text-left border-collapse mb-8">
                <thead class="bg-gray-100 text-gray-700">
                    <tr>
                        <th class="border p-2">Categoria</th>
                        <th class="border p-2">Subcategoria</th>
                        <th class="border p-2 text-right">Valor</th>
                        <th class="border p-2 text-right">% da Receita</th>
                    </tr>
                </thead>
                <tbody>
                    ${sortedExpenses.map(d => `
                        <tr>
                            <td class="border p-2 font-medium">${d.cat}</td>
                            <td class="border p-2 text-gray-600">${d.sub}</td>
                            <td class="border p-2 text-right">${Utils.formatCurrency(d.val)}</td>
                            <td class="border p-2 text-right">${((d.val / totalReceita) * 100).toFixed(2)}%</td>
                        </tr>
                    `).join('')}
                    <tr class="bg-gray-50 font-bold">
                        <td class="border p-2" colspan="2">TOTAL DESPESAS</td>
                        <td class="border p-2 text-right">${Utils.formatCurrency(resumo.despesa)}</td>
                        <td class="border p-2 text-right">${((resumo.despesa / totalReceita) * 100).toFixed(2)}%</td>
                    </tr>
                </tbody>
            </table>

            <div class="mt-8 text-center text-[10px] text-gray-400 border-t pt-2">
                &copy; 2026 Delícia da Cidade. Todos os direitos reservados. | Versão 1.0.0
            </div>
        `;

        element.classList.remove('hidden');

        const opt = {
            margin: 10,
            filename: `relatorio-financeiro-${filterDate}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        html2pdf().set(opt).from(element).save().then(() => {
            element.classList.add('hidden');
        });
    }
};

document.addEventListener('DOMContentLoaded', FinancasModule.init);