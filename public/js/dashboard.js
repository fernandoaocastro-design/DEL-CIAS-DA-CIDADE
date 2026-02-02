const DashboardModule = {
    init: () => {
        DashboardModule.loadData();
    },

    loadData: async () => {
        try {
            const res = await fetch('/.netlify/functions/business', {
                method: 'POST',
                body: JSON.stringify({ action: 'getDashboardStats' })
            });
            const json = await res.json();
            
            if (json.success) {
                DashboardModule.renderKPIs(json.data.kpis);
                DashboardModule.renderDRE(json.data.dre);
                DashboardModule.renderMonitoramento(json.data.monitoramento);
                DashboardModule.renderCharts(json.data.charts);
            }
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

        // Gráfico Financeiro
        new Chart(document.getElementById('chartFinanceiro'), {
            type: 'line',
            data: {
                labels: charts.financeiro.labels,
                datasets: [
                    { label: 'Receitas', data: charts.financeiro.receitas, borderColor: '#10B981', tension: 0.1, backgroundColor: 'rgba(16, 185, 129, 0.1)', fill: true },
                    { label: 'Despesas', data: charts.financeiro.despesas, borderColor: '#EF4444', tension: 0.1, backgroundColor: 'rgba(239, 68, 68, 0.1)', fill: true }
                ]
            }
        });

        // Gráfico Atendimento (Categorias)
        new Chart(document.getElementById('chartAtendimento'), {
            type: 'doughnut',
            data: {
                labels: charts.pratos.labels,
                datasets: [{
                    data: charts.pratos.data,
                    backgroundColor: ['#F59E0B', '#3B82F6', '#10B981', '#6366F1', '#8B5CF6']
                }]
            }
        });

        // Gráfico Refeições (Barras)
        if (charts.refeicoes && document.getElementById('chartRefeicoes')) {
            new Chart(document.getElementById('chartRefeicoes'), {
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