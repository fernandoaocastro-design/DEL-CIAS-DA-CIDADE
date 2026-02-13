const DashboardModule = {
    charts: {}, // Armazena instâncias
    state: { filterDate: new Date().toISOString().slice(0, 7) }, // Padrão: Mês atual

    init: () => {
        DashboardModule.renderLayout();
        DashboardModule.loadData();
    },

    loadData: async () => {
        try {
            DashboardModule.renderFilters(); // Renderiza o filtro antes de carregar
            const data = await Utils.api('getDashboardStats', null, { filterDate: DashboardModule.state.filterDate });
            
            if (data.kpis) DashboardModule.renderKPIs(data.kpis);
            if (data.dre) DashboardModule.renderDRE(data.dre);
            if (data.monitoramento) DashboardModule.renderQuadroAvisos(data.monitoramento.avisos);
            if (data.monitoramento) DashboardModule.renderMonitoramento(data.monitoramento);
            DashboardModule.loadTarefas(); // Carrega tarefas separadamente
            DashboardModule.fetchWeather();
            DashboardModule.renderCharts(data.charts);
            
            // Verifica aniversariantes e envia e-mail (Silenciosamente)
            Utils.api('checkBirthdayEmails').then(res => { if(res.sent > 0) console.log(`${res.sent} e-mails de aniversário enviados.`); });
        } catch (e) {
            console.error(e);
            Utils.toast("Erro ao carregar dashboard.");
        }
    },

    renderFilters: () => {
        const container = document.getElementById('dashboard-content');
        let filterDiv = document.getElementById('dashboard-filters');
        
        // Cria o container do filtro se não existir
        if (!filterDiv) {
            filterDiv = document.createElement('div');
            filterDiv.id = 'dashboard-filters';
            filterDiv.className = 'flex flex-col md:flex-row justify-between items-center mb-6 bg-white p-3 rounded shadow-sm border border-gray-100';
            container.insertBefore(filterDiv, container.firstChild);
        }

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

    renderQuadroAvisos: (avisos) => {
        if (!avisos) avisos = []; // Garante array vazio se nulo

        const container = document.getElementById('dashboard-content'); // Assumindo que existe um container principal ou injetamos no topo
        // Verifica se já existe a seção para não duplicar
        let section = document.getElementById('quadro-avisos-section');
        
        if (!section) {
            section = document.createElement('div');
            section.id = 'quadro-avisos-section';
            section.className = 'mb-6';
            // Insere logo no início do dashboard
            const firstChild = container.firstElementChild;
            container.insertBefore(section, firstChild);
        }

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
            DashboardModule.renderTarefas(tarefas || []);
        } catch (e) { console.error('Erro ao carregar tarefas', e); }
    },

    renderTarefas: (tarefas) => {
        const container = document.getElementById('dashboard-content');
        let section = document.getElementById('tarefas-section');
        
        if (!section) {
            section = document.createElement('div');
            section.id = 'tarefas-section';
            section.className = 'mb-6 grid grid-cols-1 lg:grid-cols-3 gap-6';
            // Insere após o quadro de avisos
            const avisos = document.getElementById('quadro-avisos-section');
            if (avisos) avisos.insertAdjacentElement('afterend', section);
            else container.insertBefore(section, container.firstElementChild);
        }

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
            const tarefas = await Utils.api('getTasks'); // Idealmente buscaria só uma, mas cache local seria melhor
            tarefa = tarefas.find(t => t.ID === id) || {};
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

    renderKPIs: (kpis) => {
        if (!kpis) return;

        // Atualiza labels para refletir o filtro (opcional, mas bom para UX)
        const labelPeriodo = DashboardModule.state.filterDate === 'all' ? 'Total Acumulado' : 'Neste Mês';
        
        document.getElementById('kpi-receita').innerText = Utils.formatCurrency(kpis.receitaMensal);
        document.getElementById('kpi-despesa').innerText = Utils.formatCurrency(kpis.despesaMensal);
        document.getElementById('kpi-lucro').innerText = Utils.formatCurrency(kpis.lucroLiquido);

        if(document.getElementById('kpi-funcionarios')) document.getElementById('kpi-funcionarios').innerText = kpis.totalFuncionarios;
        if(document.getElementById('kpi-fornecedores')) document.getElementById('kpi-fornecedores').innerText = kpis.totalFornecedores;
        if(document.getElementById('kpi-refeicoes')) document.getElementById('kpi-refeicoes').innerText = kpis.totalRefeicoes;
    },

    renderDRE: (dre) => {
        if (!dre) return;

        document.getElementById('dre-bruta').innerText = Utils.formatCurrency(dre.receitaBruta);
        document.getElementById('dre-impostos').innerText = Utils.formatCurrency(dre.impostos);
        document.getElementById('dre-liquida').innerText = Utils.formatCurrency(dre.receitaLiquida);
        document.getElementById('dre-cmv').innerText = Utils.formatCurrency(dre.cmv);
        document.getElementById('dre-desp').innerText = Utils.formatCurrency(dre.despOp);
        document.getElementById('dre-lucro-bruto').innerText = Utils.formatCurrency(dre.lucroBruto);
        document.getElementById('dre-final').innerText = Utils.formatCurrency(dre.lucroFinal);
    },

    renderMonitoramento: (mon) => {
        if (!mon) return;

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

        // Injeta container para Lucratividade se não existir
        if (!document.getElementById('chartLucratividade')) {
            const container = document.getElementById('dashboard-content');
            const div = document.createElement('div');
            div.className = 'bg-white p-4 rounded shadow mb-6 border border-gray-100';
            div.innerHTML = `
                <h4 class="font-bold text-gray-700 mb-4 border-b pb-2">Lucratividade Anual (Últimos 12 Meses)</h4>
                <div class="h-64"><canvas id="chartLucratividade"></canvas></div>
            `;
            // Insere antes das tarefas (se existirem) ou no final
            const tarefas = document.getElementById('tarefas-section');
            if (tarefas) container.insertBefore(div, tarefas);
            else container.appendChild(div);
        }

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
        if (charts.lucratividade) {
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