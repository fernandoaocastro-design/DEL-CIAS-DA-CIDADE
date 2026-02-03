const DashboardModule = {
    charts: {}, // Armazena instâncias
    init: () => {
        DashboardModule.loadData();
    },

    loadData: async () => {
        try {
            const data = await Utils.api('getDashboardStats');
            
            DashboardModule.renderKPIs(data.kpis);
            DashboardModule.renderDRE(data.dre);
            DashboardModule.renderMonitoramento(data.monitoramento);
            DashboardModule.renderCharts(data.charts);
        } catch (e) {
            console.error(e);
            Utils.toast("Erro ao carregar dashboard.");
        }
    },

    renderKPIs: (kpis) => {
        document.getElementById('kpi-receita').innerText = Utils.formatCurrency(kpis.receitaMensal);
        document.getElementById('kpi-despesa').innerText = Utils.formatCurrency(kpis.despesaMensal);
        document.getElementById('kpi-lucro').innerText = Utils.formatCurrency(kpis.lucroLiquido);
        document.getElementById('kpi-receber').innerText = Utils.formatCurrency(kpis.aReceberHoje);

        // Injeta novos KPIs se não existirem (Funcionários, Fornecedores, Refeições)
        const kpiContainer = document.getElementById('kpi-receita')?.closest('.grid');
        if (kpiContainer && !document.getElementById('kpi-funcionarios')) {
            const newCardsHTML = `
                <div class="bg-white p-4 rounded shadow border-l-4 border-indigo-500">
                    <div class="text-gray-500 text-sm">Funcionários Ativos</div>
                    <div class="text-2xl font-bold text-indigo-600" id="kpi-funcionarios">-</div>
                </div>
                <div class="bg-white p-4 rounded shadow border-l-4 border-orange-500">
                    <div class="text-gray-500 text-sm">Fornecedores Ativos</div>
                    <div class="text-2xl font-bold text-orange-600" id="kpi-fornecedores">-</div>
                </div>
                <div class="bg-white p-4 rounded shadow border-l-4 border-teal-500">
                    <div class="text-gray-500 text-sm">Refeições (Mês)</div>
                    <div class="text-2xl font-bold text-teal-600" id="kpi-refeicoes">-</div>
                </div>
            `;
            kpiContainer.insertAdjacentHTML('beforeend', newCardsHTML);
            
            // Ajusta o grid para acomodar mais itens se necessário (opcional, depende do CSS original)
            kpiContainer.classList.add('md:grid-cols-4', 'lg:grid-cols-4');
        }

        if(document.getElementById('kpi-funcionarios')) document.getElementById('kpi-funcionarios').innerText = kpis.totalFuncionarios;
        if(document.getElementById('kpi-fornecedores')) document.getElementById('kpi-fornecedores').innerText = kpis.totalFornecedores;
        if(document.getElementById('kpi-refeicoes')) document.getElementById('kpi-refeicoes').innerText = kpis.totalRefeicoes;
    },

    renderDRE: (dre) => {
        document.getElementById('dre-bruta').innerText = Utils.formatCurrency(dre.receitaBruta);
        document.getElementById('dre-impostos').innerText = Utils.formatCurrency(dre.impostos);
        document.getElementById('dre-liquida').innerText = Utils.formatCurrency(dre.receitaLiquida);
        document.getElementById('dre-cmv').innerText = Utils.formatCurrency(dre.cmv);
        document.getElementById('dre-desp').innerText = Utils.formatCurrency(dre.despOp);
        document.getElementById('dre-lucro-bruto').innerText = Utils.formatCurrency(dre.lucroBruto);
        document.getElementById('dre-final').innerText = Utils.formatCurrency(dre.lucroFinal);
    },

    renderMonitoramento: (mon) => {
        const list = document.getElementById('monitoramento-list');
        let html = '';

        if (mon.eventos && mon.eventos.length > 0) {
            html += `<div class="p-3 bg-indigo-50 rounded border-l-4 border-indigo-500">
                <div class="font-bold text-indigo-700">📅 Próximos Eventos</div>
                ${mon.eventos.map(e => `<div class="text-sm flex justify-between"><span>${e.Titulo}</span> <span class="text-xs text-gray-500">${Utils.formatDate(e.Data)}</span></div>`).join('')}
            </div>`;
        }

        if (mon.aniversariantes.length > 0) {
            html += `<div class="p-3 bg-blue-50 rounded border-l-4 border-blue-500">
                <div class="font-bold text-blue-700">🎂 Aniversariantes do Dia</div>
                ${mon.aniversariantes.map(a => `<div class="text-sm">${a.Nome}</div>`).join('')}
            </div>`;
        }

        if (mon.jubileu && mon.jubileu.length > 0) {
            html += `<div class="p-3 bg-purple-50 rounded border-l-4 border-purple-500">
                <div class="font-bold text-purple-700">🎉 Jubileu de Casa (Hoje)</div>
                ${mon.jubileu.map(j => `<div class="text-sm">${j.Nome} (${j.Anos} anos)</div>`).join('')}
            </div>`;
        }

        if (mon.estoqueBaixo.length > 0) {
            html += `<div class="p-3 bg-red-50 rounded border-l-4 border-red-500">
                <div class="font-bold text-red-700">⚠️ Estoque Baixo</div>
                ${mon.estoqueBaixo.map(e => `<div class="text-sm">${e.Nome} (${e.Quantidade})</div>`).join('')}
            </div>`;
        }

        if (mon.ferias.length > 0) {
            html += `<div class="p-3 bg-yellow-50 rounded border-l-4 border-yellow-500">
                <div class="font-bold text-yellow-700">🏖️ Em Férias</div>
                ${mon.ferias.map(f => `<div class="text-sm">${f.FuncionarioNome}</div>`).join('')}
            </div>`;
        }

        if (html === '') html = '<div class="text-gray-500 text-center py-4">Nenhum aviso importante hoje.</div>';
        list.innerHTML = html;
    },

    renderCharts: (charts) => {
        if (!charts) return;

        // Destruir gráficos anteriores
        if (DashboardModule.charts.financeiro) DashboardModule.charts.financeiro.destroy();

        // Gráfico Financeiro
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

        if (DashboardModule.charts.atendimento) DashboardModule.charts.atendimento.destroy();

        // Gráfico Atendimento (Categorias)
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
    }
};

document.addEventListener('DOMContentLoaded', DashboardModule.init);