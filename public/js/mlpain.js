const MLPainModule = {
    state: {
        activeTab: 'visao-geral',
        areas: [],
        registros: [],
        pratos: [],
        funcionarios: [],
        filterMonth: new Date().toISOString().slice(0, 7),
        customFilterStart: '',
        customFilterEnd: '',
        filterDate: new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().split('T')[0],
        filterTurno: '', // Filtro de turno para detalhamento
        instituicao: [],
        charts: {}, // Armazena instâncias dos gráficos
        lastEntryDate: null,
        lastEntryTurno: null,
        lastEntryResp: null,
        lastEntryType: 'Sólido', // Padrão inicial
        lastEntryArea: null,
        pagination: { page: 1, limit: 20, total: 0 }
    },

    getLocalDate: () => {
        const now = new Date();
        return new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    },

    init: () => {
        MLPainModule.fetchData();
    },

    fetchData: async () => {
        try {
            const [areas, registros, inst, pratos, funcionarios] = await Promise.all([
                Utils.api('getAll', 'MLPain_Areas'),
                Utils.api('getAll', 'MLPain_Registros'),
                Utils.api('getAll', 'InstituicaoConfig'),
                Utils.api('getAll', 'FichasTecnicas'),
                Utils.api('getAll', 'Funcionarios')
            ]);
            
            // Ordenar áreas pela ordem definida ou nome
            MLPainModule.state.areas = (areas || []).sort((a, b) => (a.Ordem || 0) - (b.Ordem || 0));
            MLPainModule.state.registros = registros || [];
            MLPainModule.state.instituicao = inst || [];
            MLPainModule.state.pratos = pratos || [];
            MLPainModule.state.funcionarios = funcionarios || [];
            
            MLPainModule.render();
        } catch (e) {
            console.error(e);
            Utils.toast("Erro ao carregar dados do M.L. Pain.");
        }
    },

    setTab: (tab) => {
        MLPainModule.state.activeTab = tab;
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.className = 'tab-btn px-4 py-2 text-gray-500 hover:text-gray-700 transition whitespace-nowrap';
            btn.style.borderBottom = 'none';
        });
        const activeBtn = document.getElementById(`tab-${tab}`);
        if(activeBtn) {
            activeBtn.className = 'tab-btn px-4 py-2 font-bold text-indigo-600 transition whitespace-nowrap';
            activeBtn.style.borderBottom = '2px solid #4F46E5';
        }
        MLPainModule.render();
    },

    render: () => {
        const container = document.getElementById('mlpain-content');
        const tab = MLPainModule.state.activeTab;

        if (tab === 'visao-geral') {
            MLPainModule.renderVisaoGeral(container);
        } else if (tab === 'lancamento') {
            MLPainModule.renderLancamento(container);
        } else if (tab === 'tabela' || tab === 'relatorio') { // Restaura acesso caso o botão chame 'relatorio'
            MLPainModule.renderTabela(container);
        } else if (tab === 'detalhamento') {
            MLPainModule.renderDetalhamento(container);
        } else if (tab === 'areas') {
            MLPainModule.renderAreas(container);
        }
    },

    // --- 1. VISÃO GERAL ---
    renderVisaoGeral: async (container) => {
        const date = MLPainModule.state.filterDate || MLPainModule.getLocalDate();
        const recs = MLPainModule.state.registros.filter(r => r.Data === date);
        
        const canCreate = Utils.checkPermission('MLPain', 'criar');
        // Dados para o Gráfico de Metas
        const areasAtivas = MLPainModule.state.areas.filter(a => a.Ativo);
        const labels = areasAtivas.map(a => a.Nome);
        const metas = areasAtivas.map(a => Number(a.MetaDiaria || 0));
        const realizados = areasAtivas.map(a => {
            return recs
                .filter(r => r.AreaID === a.ID || r.AreaNome === a.Nome)
                .reduce((acc, r) => acc + Number(r.Quantidade), 0);
        });

        // Dados para Gráfico de Evolução (Últimos 30 dias)
        const last30Days = [];
        const dataSolidos30d = [];
        const dataLiquidos30d = [];
        
        for (let i = 29; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
            const label = `${d.getDate()}/${d.getMonth() + 1}`;
            last30Days.push(label);

            const dayRecs = MLPainModule.state.registros.filter(r => r.Data === dateStr);
            
            const solidos = dayRecs.filter(r => r.Tipo === 'Sólido').reduce((acc, r) => acc + Number(r.Quantidade), 0);
            const liquidos = dayRecs.filter(r => r.Tipo === 'Líquido').reduce((acc, r) => acc + Number(r.Quantidade), 0);
            
            dataSolidos30d.push(solidos);
            dataLiquidos30d.push(liquidos);
        }

        container.innerHTML = `
            <div class="flex justify-between items-center mb-6">
                <h3 class="text-xl font-bold text-gray-800">Visão Geral</h3>
                <div class="flex items-center gap-2 bg-white p-2 rounded shadow-sm">
                    <label class="text-sm font-bold text-gray-600">Data:</label>
                    <input type="date" value="${date}" class="border p-1 rounded text-sm" onchange="MLPainModule.state.filterDate = this.value; MLPainModule.renderVisaoGeral(document.getElementById('mlpain-content'))">
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <div class="bg-white p-4 rounded shadow border-l-4 border-blue-500">
                    <div class="text-gray-500 text-sm">Refeições (${Utils.formatDate(date)})</div>
                    <div class="text-2xl font-bold" id="card-total"><i class="fas fa-spinner fa-spin"></i></div>
                </div>
                <div class="bg-white p-4 rounded shadow border-l-4 border-green-500">
                    <div class="text-gray-500 text-sm">Sólidos (Geral)</div>
                    <div class="text-2xl font-bold text-green-600" id="card-solidos"><i class="fas fa-spinner fa-spin"></i></div>
                </div>
                <div class="bg-white p-4 rounded shadow border-l-4 border-yellow-500">
                    <div class="text-gray-500 text-sm">Sopas</div>
                    <div class="text-2xl font-bold text-yellow-600" id="card-sopa"><i class="fas fa-spinner fa-spin"></i></div>
                </div>
                <div class="bg-white p-4 rounded shadow border-l-4 border-orange-500">
                    <div class="text-gray-500 text-sm">Chás</div>
                    <div class="text-2xl font-bold text-orange-600" id="card-cha"><i class="fas fa-spinner fa-spin"></i></div>
                </div>
            </div>
            
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                <div class="bg-white p-6 rounded shadow">
                    <h3 class="text-lg font-bold text-gray-700 mb-4">Consumo Diário por Área vs Meta</h3>
                    <div class="h-64"><canvas id="chartMetas"></canvas></div>
                </div>
                <div class="bg-white p-6 rounded shadow">
                    <h3 class="text-lg font-bold text-gray-700 mb-4">Evolução de Consumo (30 Dias)</h3>
                    <div class="h-64"><canvas id="chartEvolucaoDietas"></canvas></div>
                </div>
            </div>

            <div class="bg-white p-6 rounded shadow text-center">
                <h3 class="text-lg font-bold text-gray-700 mb-4">Acesso Rápido</h3>
                ${canCreate ? `<button onclick="MLPainModule.setTab('lancamento')" class="bg-indigo-600 text-white px-6 py-3 rounded shadow hover:bg-indigo-700 transition">
                    <i class="fas fa-plus-circle mr-2"></i> Novo Lançamento de Refeições
                </button>` : ''}
            </div>
        `;

        // Destruir gráficos anteriores para evitar "piscar" e sobreposição
        if (MLPainModule.state.charts.metas) MLPainModule.state.charts.metas.destroy();
        if (MLPainModule.state.charts.evolucao) MLPainModule.state.charts.evolucao.destroy();

        // Renderizar Gráfico de Metas (Misto: Barra + Linha)
        MLPainModule.state.charts.metas = new Chart(document.getElementById('chartMetas'), {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    { type: 'line', label: 'Meta Diária', data: metas, borderColor: '#EF4444', borderWidth: 2, borderDash: [5, 5], pointRadius: 0, fill: false },
                    { type: 'bar', label: 'Realizado Hoje', data: realizados, backgroundColor: '#3B82F6', borderRadius: 4 }
                ]
            },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
        });

        // Renderizar Gráfico de Evolução
        MLPainModule.state.charts.evolucao = new Chart(document.getElementById('chartEvolucaoDietas'), {
            type: 'line',
            data: {
                labels: last30Days,
                datasets: [
                    { label: 'Sólidos', data: dataSolidos30d, borderColor: '#10B981', backgroundColor: 'rgba(16, 185, 129, 0.1)', fill: true, tension: 0.3 },
                    { label: 'Líquidos', data: dataLiquidos30d, borderColor: '#F97316', backgroundColor: 'rgba(249, 115, 22, 0.1)', fill: true, tension: 0.3 }
                ]
            },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
        });

        // Buscar dados atualizados do servidor para os cards
        try {
            const stats = await Utils.api('getDietStats', null, { date });
            if (document.getElementById('card-total')) {
                document.getElementById('card-total').innerText = stats.total;
                document.getElementById('card-solidos').innerText = stats.solidos;
                document.getElementById('card-sopa').innerText = stats.sopa;
                document.getElementById('card-cha').innerText = stats.cha;
            }
        } catch (e) {
            console.error("Erro ao carregar estatísticas de dieta:", e);
        }
    },

    // --- 2. LANÇAMENTO (FORMULÁRIO DINÂMICO) ---
    renderLancamento: (container) => {
        const areas = MLPainModule.state.areas.filter(a => a.Ativo);
        const pratos = MLPainModule.state.pratos.filter(p => p.Status === 'Ativo');
        const funcionarios = MLPainModule.state.funcionarios || [];
        
        const today = MLPainModule.getLocalDate();
        const defaultDate = MLPainModule.state.lastEntryDate || today;
        const defaultTurno = MLPainModule.state.lastEntryTurno || 'Manhã';
        const defaultResp = MLPainModule.state.lastEntryResp || '';
        const defaultType = MLPainModule.state.lastEntryType || 'Sólido';
        const defaultArea = MLPainModule.state.lastEntryArea || '';

        const canCreate = Utils.checkPermission('MLPain', 'criar');
        // Contagem de refeições lançadas hoje
        const totalToday = MLPainModule.state.registros
            .filter(r => r.Data === today)
            .reduce((acc, r) => acc + Number(r.Quantidade || 0), 0);

        container.innerHTML = `
            <div class="bg-white p-6 rounded shadow max-w-4xl mx-auto">
                <div class="flex justify-between items-center mb-6 border-b pb-2">
                    <h3 class="text-xl font-bold text-gray-800">Lançamento Diário de Refeições</h3>
                    <div class="bg-blue-50 px-4 py-2 rounded text-right border border-blue-100">
                        <span class="block text-[10px] text-blue-500 font-bold uppercase tracking-wider">Lançadas Hoje</span>
                        <span class="text-2xl font-bold text-blue-700 leading-none">${totalToday}</span>
                    </div>
                </div>
                
                <form onsubmit="MLPainModule.saveLancamento(event)">
                    <!-- Cabeçalho do Formulário -->
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 bg-gray-50 p-4 rounded">
                        <div>
                            <label class="block text-xs font-bold text-gray-600 uppercase mb-1">Data</label>
                            <input type="date" name="Data" value="${defaultDate}" class="border p-2 rounded w-full" required>
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-600 uppercase mb-1">Turno</label>
                            <select name="Turno" class="border p-2 rounded w-full">
                                <option ${defaultTurno === 'Manhã' ? 'selected' : ''}>Manhã</option>
                                <option ${defaultTurno === 'Tarde' ? 'selected' : ''}>Tarde</option>
                                <option ${defaultTurno === 'Noite' ? 'selected' : ''}>Noite</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-600 uppercase mb-1">Responsável do Turno</label>
                            <select name="Responsavel" class="border p-2 rounded w-full" required>
                                <option value="">Selecione...</option>
                                ${funcionarios.map(f => `<option value="${f.Nome}" ${defaultResp === f.Nome ? 'selected' : ''}>${f.Nome}</option>`).join('')}
                            </select>
                        </div>
                    </div>

                    <!-- Seleção de Tipo -->
                    <div class="mb-6">
                        <label class="block text-sm font-bold text-gray-700 mb-2">Tipo de Refeição:</label>
                        <div class="flex gap-4">
                            <label class="flex items-center gap-2 cursor-pointer bg-blue-50 px-4 py-2 rounded border border-blue-200">
                                <input type="radio" name="TipoRefeicao" value="Sólido" ${defaultType === 'Sólido' ? 'checked' : ''} onchange="MLPainModule.toggleFormType('Sólido')">
                                <span class="font-bold text-blue-800">🍽️ Sólidos (Geral)</span>
                            </label>
                            <label class="flex items-center gap-2 cursor-pointer bg-orange-50 px-4 py-2 rounded border border-orange-200">
                                <input type="radio" name="TipoRefeicao" value="Líquido" ${defaultType === 'Líquido' ? 'checked' : ''} onchange="MLPainModule.toggleFormType('Líquido')">
                                <span class="font-bold text-orange-800">🥣 Líquidos (Sopa/Chá)</span>
                            </label>
                        </div>
                    </div>

                    <!-- Campos Dinâmicos -->
                    <div class="bg-gray-50 p-4 rounded mb-6 border border-gray-200">
                        <div class="mb-4">
                            <label class="block text-xs font-bold text-gray-600 uppercase mb-1">Área / Enfermaria</label>
                            <select name="AreaID" class="border p-2 rounded w-full bg-white" required>
                                <!-- Preenchido dinamicamente pelo toggleFormType -->
                            </select>
                        </div>

                        <div id="dynamic-fields">
                            <!-- Injetado via JS -->
                        </div>
                    </div>

                    <div class="mb-4">
                        <label class="block text-xs font-bold text-gray-600 uppercase mb-1">Observações Gerais</label>
                        <textarea name="Observacoes" class="border p-2 rounded w-full h-16"></textarea>
                    </div>

                    ${canCreate ? `<button type="submit" class="w-full bg-green-600 text-white py-3 rounded font-bold hover:bg-green-700 transition shadow">
                        Adicionar Lançamento
                    </button>` : ''}
                </form>
            </div>
        `;

        // Armazena pratos no estado global para acesso no toggle
        MLPainModule.tempPratos = pratos;
        MLPainModule.toggleFormType(defaultType, defaultArea); // Inicializa com o tipo e área persistidos
    },

    toggleFormType: (type, selectedAreaId = null) => {
        const container = document.getElementById('dynamic-fields');
        const pratos = MLPainModule.tempPratos || [];
        const funcionarios = MLPainModule.state.funcionarios || [];

        // Atualizar Dropdown de Áreas conforme o Tipo selecionado
        const areaSelect = document.querySelector('select[name="AreaID"]');
        if (areaSelect) {
            const areasFiltradas = MLPainModule.state.areas.filter(a => a.Ativo && (a.Tipo === type || (!a.Tipo && type === 'Sólido')));
            areaSelect.innerHTML = '<option value="">Selecione a Área...</option>' + 
                areasFiltradas.map(a => `<option value="${a.ID}" ${selectedAreaId === a.ID ? 'selected' : ''}>${a.Nome}</option>`).join('');
        }
        
        if (type === 'Sólido') {
            container.innerHTML = `
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label class="block text-xs font-bold text-gray-600 uppercase mb-1">Prato</label>
                        <select name="Prato" class="border p-2 rounded w-full bg-white">
                            <option value="">Selecione o Prato...</option>
                            ${pratos.map(p => `<option value="${p.Nome}">${p.Nome}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-600 uppercase mb-1">Quantidade</label>
                        <input type="number" name="Quantidade" class="border p-2 rounded w-full font-bold text-blue-600" placeholder="0" min="1" required>
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-600 uppercase mb-1">Responsável Entrega</label>
                        <select name="ResponsavelEntrega" class="border p-2 rounded w-full">
                            <option value="">Selecione...</option>
                            ${funcionarios.map(f => `<option value="${f.Nome}">${f.Nome}</option>`).join('')}
                        </select>
                    </div>
                </div>
            `;
        } else {
            container.innerHTML = `
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label class="block text-xs font-bold text-yellow-600 uppercase mb-1">Qtd. Sopa</label>
                        <input type="number" name="QtdSopa" class="border p-2 rounded w-full font-bold bg-yellow-50" placeholder="0" min="0">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-orange-600 uppercase mb-1">Qtd. Chá</label>
                        <input type="number" name="QtdCha" class="border p-2 rounded w-full font-bold bg-orange-50" placeholder="0" min="0">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-600 uppercase mb-1">Responsável Entrega</label>
                        <select name="ResponsavelEntrega" class="border p-2 rounded w-full">
                            <option value="">Selecione...</option>
                            ${funcionarios.map(f => `<option value="${f.Nome}">${f.Nome}</option>`).join('')}
                        </select>
                    </div>
                </div>
            `;
        }
    },

    saveLancamento: async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);

        // Persistir contexto para próximos lançamentos em sequência
        MLPainModule.state.lastEntryDate = formData.get('Data');
        MLPainModule.state.lastEntryTurno = formData.get('Turno');
        MLPainModule.state.lastEntryResp = formData.get('Responsavel');
        MLPainModule.state.lastEntryType = formData.get('TipoRefeicao');
        MLPainModule.state.lastEntryArea = formData.get('AreaID');
        
        const areaId = formData.get('AreaID');
        const area = MLPainModule.state.areas.find(a => a.ID === areaId);
        
        if (!area) return Utils.toast('⚠️ Selecione uma área válida.');

        const commonData = {
            Data: formData.get('Data'),
            Turno: formData.get('Turno'),
            Responsavel: formData.get('Responsavel'),
            Observacoes: formData.get('Observacoes'),
            AreaID: area.ID,
            AreaNome: area.Nome,
            ResponsavelEntrega: formData.get('ResponsavelEntrega')
        };

        const type = formData.get('TipoRefeicao');
        const promises = [];

        if (type === 'Sólido') {
            const qtd = formData.get('Quantidade');
            const prato = formData.get('Prato');
            if (qtd && Number(qtd) > 0) {
                promises.push(Utils.api('save', 'MLPain_Registros', {
                    ...commonData, Tipo: 'Sólido', Subtipo: 'Geral', Quantidade: qtd, Prato: prato
                }));
            }
        } else {
            const qtdSopa = formData.get('QtdSopa');
            const qtdCha = formData.get('QtdCha');
            
            if (qtdSopa && Number(qtdSopa) > 0) {
                promises.push(Utils.api('save', 'MLPain_Registros', {
                    ...commonData, Tipo: 'Líquido', Subtipo: 'Sopa', Quantidade: qtdSopa
                }));
            }
            if (qtdCha && Number(qtdCha) > 0) {
                promises.push(Utils.api('save', 'MLPain_Registros', {
                    ...commonData, Tipo: 'Líquido', Subtipo: 'Chá', Quantidade: qtdCha
                }));
            }
        }

        if (promises.length === 0) return Utils.toast('⚠️ Nenhuma quantidade informada.');

        try {
            await Promise.all(promises);
            Utils.toast('✅ Lançamentos salvos com sucesso!');
            MLPainModule.fetchData();
            // Mantém na tela de lançamento para continuar inserindo
        } catch (err) { Utils.toast('Erro ao salvar: ' + err.message); }
    },

    // --- 3. TABELA E GRÁFICOS ---
    renderTabela: (container) => {
        const month = MLPainModule.state.filterMonth;
        const start = MLPainModule.state.customFilterStart;
        const end = MLPainModule.state.customFilterEnd;
        
        let recs = [];
        let daysToRender = [];
        let reportTitle = '';

        if (start && end) {
            recs = MLPainModule.state.registros.filter(r => r.Data >= start && r.Data <= end);
            reportTitle = `Relatório Personalizado: ${Utils.formatDate(start)} a ${Utils.formatDate(end)}`;
            
            const [sY, sM, sD] = start.split('-').map(Number);
            const [eY, eM, eD] = end.split('-').map(Number);
            let curr = new Date(sY, sM - 1, sD);
            const last = new Date(eY, eM - 1, eD);
            while (curr <= last) {
                daysToRender.push(new Date(curr));
                curr.setDate(curr.getDate() + 1);
            }
        } else {
            recs = MLPainModule.state.registros.filter(r => r.Data.startsWith(month));
            reportTitle = `Relatório de Refeições - ${month}`;
            const [year, monthNum] = month.split('-');
            const daysInMonth = new Date(year, monthNum, 0).getDate();
            for(let i=1; i<=daysInMonth; i++) {
                daysToRender.push(new Date(year, monthNum - 1, i));
            }
        }

        // Agrupamento para Gráficos
        const totals = { Solido: 0, Sopa: 0, Cha: 0 };
        recs.forEach(r => {
            if (r.Tipo === 'Sólido') totals.Solido += Number(r.Quantidade);
            else if (r.Subtipo === 'Sopa') totals.Sopa += Number(r.Quantidade);
            else if (r.Subtipo === 'Chá') totals.Cha += Number(r.Quantidade);
        });

        // Agrupamento por Área para o Gráfico Comparativo
        const areaStats = {};
        recs.forEach(r => {
            const area = r.AreaNome || 'Outros';
            if (!areaStats[area]) areaStats[area] = { Solido: 0, Sopa: 0, Cha: 0 };
            if (r.Tipo === 'Sólido') areaStats[area].Solido += Number(r.Quantidade);
            else if (r.Subtipo === 'Sopa') areaStats[area].Sopa += Number(r.Quantidade);
            else if (r.Subtipo === 'Chá') areaStats[area].Cha += Number(r.Quantidade);
        });
        const areaLabels = Object.keys(areaStats);
        const dataSolido = areaLabels.map(a => areaStats[a].Solido);
        const dataSopa = areaLabels.map(a => areaStats[a].Sopa);
        const dataCha = areaLabels.map(a => areaStats[a].Cha);

        // --- PREPARAÇÃO DA MATRIZ (DIAS x ÁREAS) ---
        const areas = MLPainModule.state.areas.filter(a => a.Ativo);
        const solidAreas = areas.filter(a => !a.Tipo || a.Tipo === 'Sólido');
        const liquidAreas = areas.filter(a => a.Tipo === 'Líquido');
        const weekDays = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

        // Inicializa Matriz
        const matrix = {};
        // CORREÇÃO: Gerar chaves de data usando componentes locais para evitar erro de fuso horário (Dia 1 sumindo)
        const dateKeys = daysToRender.map(d => {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
        });

        areas.forEach(a => {
            matrix[a.ID] = {};
            dateKeys.forEach(k => {
                matrix[a.ID][k] = { Solido: 0, Sopa: 0, Cha: 0 };
            });
        });

        // Preenche Matriz
        recs.forEach(r => {
            if (matrix[r.AreaID] && matrix[r.AreaID][r.Data]) {
                const qtd = Number(r.Quantidade);
                if (r.Tipo === 'Sólido') matrix[r.AreaID][r.Data].Solido += qtd;
                else if (r.Subtipo === 'Sopa') matrix[r.AreaID][r.Data].Sopa += qtd;
                else if (r.Subtipo === 'Chá') matrix[r.AreaID][r.Data].Cha += qtd;
            }
        });

        // Função auxiliar para gerar cada tabela matricial
        const renderMatrixTable = (title, typeKey, headerColorClass, badgeColorClass, areasToRender) => {
            // Calcular totais por coluna (dia)
            const colTotals = {};
            let grandTotal = 0;
            dateKeys.forEach(k => {
                colTotals[k] = 0;
                areasToRender.forEach(a => {
                    colTotals[k] += matrix[a.ID][k][typeKey] || 0;
                });
                grandTotal += colTotals[k];
            });

            return `
            <div class="mb-8 bg-white rounded shadow overflow-x-auto">
                <h4 class="font-bold text-gray-700 p-4 border-b ${headerColorClass}">${title}</h4>
                <table class="w-full text-xs text-center border-collapse min-w-max">
                    <thead>
                        <tr>
                            <th class="p-2 border bg-gray-100 text-left sticky left-0 z-10 min-w-[150px]">Área / Dia</th>
                            ${daysToRender.map(date => {
                                const dayIndex = date.getDay();
                                const wd = weekDays[dayIndex];
                                const isWeekend = dayIndex === 0 || dayIndex === 6;
                                const bgClass = isWeekend ? 'bg-orange-100 text-orange-800' : 'bg-gray-50 text-gray-500';
                                return `<th class="p-1 border ${bgClass} min-w-[35px]">
                                    <div class="text-[9px] uppercase">${wd}</div>
                                    <div>${date.getDate()}</div>
                                </th>`;
                            }).join('')}
                            <th class="p-2 border bg-gray-200 font-bold min-w-[50px]">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${areasToRender.map(a => {
                            let rowTotal = 0;
                            const cells = daysToRender.map(date => {
                                const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                                const bgClass = isWeekend ? 'bg-orange-50' : '';
                                
                                // CORREÇÃO CRÍTICA: Usar formatação local para encontrar a chave correta na matriz
                                const y = date.getFullYear();
                                const m = String(date.getMonth() + 1).padStart(2, '0');
                                const d = String(date.getDate()).padStart(2, '0');
                                const dateKey = `${y}-${m}-${d}`;
                                
                                const val = matrix[a.ID][dateKey] ? matrix[a.ID][dateKey][typeKey] : 0;
                                rowTotal += val;
                                return `<td class="p-1 border align-middle h-8 ${bgClass}">
                                    ${val > 0 ? `<span class="${badgeColorClass} text-white px-1.5 py-0.5 rounded-sm font-bold">${val}</span>` : ''}
                                </td>`;
                            }).join('');
                            
                            return `
                            <tr>
                                <td class="p-2 border font-bold text-left sticky left-0 bg-white z-10 shadow-sm">${a.Nome}</td>
                                ${cells}
                                <td class="p-2 border font-bold bg-gray-100">${rowTotal}</td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                    <tfoot>
                        <tr class="bg-gray-100 font-bold border-t-2 border-gray-300">
                            <td class="p-2 border text-left sticky left-0 bg-gray-100 z-10">TOTAL</td>
                            ${dateKeys.map(k => {
                                const val = colTotals[k];
                                return `<td class="p-1 border text-gray-800">${val > 0 ? val : ''}</td>`;
                            }).join('')}
                            <td class="p-2 border bg-gray-200 text-gray-900">${grandTotal}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>`;
        };

        container.innerHTML = `
            <div class="flex justify-between items-center mb-6">
                <h3 class="text-xl font-bold text-gray-800">Relatório Mensal</h3>
                <div class="flex gap-2 items-center">
                    <div class="flex items-center gap-1 bg-gray-50 p-1 rounded border mr-2">
                        <span class="text-xs font-bold text-gray-500 pl-1">Período:</span>
                        <input type="date" class="text-xs border rounded p-1" value="${MLPainModule.state.customFilterStart}" onchange="MLPainModule.state.customFilterStart=this.value">
                        <span class="text-xs">-</span>
                        <input type="date" class="text-xs border rounded p-1" value="${MLPainModule.state.customFilterEnd}" onchange="MLPainModule.state.customFilterEnd=this.value">
                        <button onclick="MLPainModule.renderTabela()" class="bg-blue-600 text-white px-2 py-1 rounded text-xs hover:bg-blue-700"><i class="fas fa-filter"></i></button>
                        <button onclick="MLPainModule.state.customFilterStart='';MLPainModule.state.customFilterEnd='';MLPainModule.renderTabela()" class="text-gray-500 px-2 text-xs hover:text-red-500" title="Limpar Filtro"><i class="fas fa-times"></i></button>
                    </div>
                    <input type="month" value="${month}" class="border p-2 rounded" onchange="MLPainModule.state.filterMonth = this.value; MLPainModule.state.customFilterStart=''; MLPainModule.state.customFilterEnd=''; MLPainModule.renderTabela(document.getElementById('mlpain-content'))">
                    <button onclick="MLPainModule.exportPDF()" class="bg-red-600 text-white px-4 py-2 rounded shadow hover:bg-red-700 transition">
                        <i class="fas fa-file-pdf mr-2"></i> Exportar PDF
                    </button>
                    <button onclick="MLPainModule.shareReportWhatsApp()" class="bg-green-500 text-white px-4 py-2 rounded shadow hover:bg-green-600 transition flex items-center gap-2">
                        <i class="fab fa-whatsapp"></i> WhatsApp
                    </button>
                </div>
            </div>

            <div id="print-area-mlpain" class="p-2 bg-white">
                <div id="pdf-header" class="hidden mb-6 border-b pb-4"></div>
                <h4 class="text-center font-bold text-gray-500 mb-4 hidden" id="pdf-title">${reportTitle}</h4>

            <!-- TABELAS MATRICIAIS SEPARADAS -->
            ${renderMatrixTable('Mapa de Dietas Sólidas', 'Solido', 'text-green-700', 'bg-green-500', solidAreas)}
            ${renderMatrixTable('Mapa de Dietas Líquidas - Sopa', 'Sopa', 'text-yellow-700', 'bg-yellow-500', liquidAreas)}
            ${renderMatrixTable('Mapa de Dietas Líquidas - Chá', 'Cha', 'text-red-700', 'bg-red-500', liquidAreas)}

            <!-- QUEBRA DE PÁGINA -->
            <div class="html2pdf__page-break"></div>

            <!-- GRÁFICOS (Dentro da área de impressão) -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 mt-8">
                <div class="bg-white p-4 rounded shadow text-center">
                    <h4 class="font-bold text-gray-600 mb-2">Distribuição Geral</h4>
                    <div class="h-48"><canvas id="chartGeral"></canvas></div>
                </div>
                <div class="bg-white p-4 rounded shadow col-span-2">
                    <div class="flex justify-between items-center mb-2">
                        <h4 class="font-bold text-gray-600">Comparativo por Área (Sólidos vs Líquidos)</h4>
                        <div class="text-xs font-bold text-gray-500">Total: ${totals.Solido + totals.Sopa + totals.Cha}</div>
                    </div>
                    <div class="h-48"><canvas id="chartComparativo"></canvas></div>
                </div>
            </div>

            <div id="pdf-footer" class="hidden mt-10 pt-4 border-t text-center"></div>
            </div>
        `;

        // Destruir gráficos anteriores
        if (MLPainModule.state.charts.geral) MLPainModule.state.charts.geral.destroy();
        if (MLPainModule.state.charts.comparativo) MLPainModule.state.charts.comparativo.destroy();

        // Renderizar Gráfico
        MLPainModule.state.charts.geral = new Chart(document.getElementById('chartGeral'), {
            type: 'doughnut',
            data: {
                labels: ['Sólidos', 'Sopa', 'Chá'],
                datasets: [{ data: [totals.Solido, totals.Sopa, totals.Cha], backgroundColor: ['#10B981', '#F59E0B', '#F97316'] }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
        });

        // Renderizar Gráfico Comparativo
        MLPainModule.state.charts.comparativo = new Chart(document.getElementById('chartComparativo'), {
            type: 'bar',
            data: {
                labels: areaLabels,
                datasets: [
                    { label: 'Sólidos', data: dataSolido, backgroundColor: '#10B981' },
                    { label: 'Sopa', data: dataSopa, backgroundColor: '#F59E0B' },
                    { label: 'Chá', data: dataCha, backgroundColor: '#F97316' }
                ]
            },
            options: { responsive: true, maintainAspectRatio: false, scales: { x: { stacked: true }, y: { stacked: true } } }
        });
    },

    // --- 3.1 DETALHAMENTO DOS LANÇAMENTOS ---
    renderDetalhamento: (container) => {
        if (!container) container = document.getElementById('mlpain-content');
        const month = MLPainModule.state.filterMonth;
        const turno = MLPainModule.state.filterTurno;
        
        let recs = MLPainModule.state.registros.filter(r => r.Data.startsWith(month));
        if (turno) {
            recs = recs.filter(r => r.Turno === turno);
        }

        // Paginação
        const { page, limit } = MLPainModule.state.pagination;
        const total = recs.length;
        const start = (page - 1) * limit;
        const end = start + limit;
        const paginatedRecs = recs.sort((a,b) => new Date(b.Data) - new Date(a.Data)).slice(start, end);

        container.innerHTML = `
            <div class="flex justify-between items-center mb-6">
                <h3 class="text-xl font-bold text-gray-800">Detalhamento dos Lançamentos</h3>
                <div class="flex gap-2">
                    <select class="border p-2 rounded text-sm" onchange="MLPainModule.state.filterTurno = this.value; MLPainModule.renderDetalhamento(document.getElementById('mlpain-content'))">
                        <option value="">Todos os Turnos</option>
                        <option ${turno === 'Manhã' ? 'selected' : ''}>Manhã</option>
                        <option ${turno === 'Tarde' ? 'selected' : ''}>Tarde</option>
                        <option ${turno === 'Noite' ? 'selected' : ''}>Noite</option>
                    </select>
                    <input type="month" value="${month}" class="border p-2 rounded" onchange="MLPainModule.state.filterMonth = this.value; MLPainModule.renderDetalhamento(document.getElementById('mlpain-content'))">
                    <button onclick="MLPainModule.exportDetalhamentoCSV()" class="bg-green-600 text-white px-4 py-2 rounded shadow hover:bg-green-700 transition flex items-center gap-2">
                        <i class="fas fa-file-csv"></i> CSV
                    </button>
                </div>
            </div>

            <div class="bg-white rounded shadow overflow-hidden">
                <table class="w-full text-sm text-left">
                    <thead class="bg-gray-100 text-gray-600 uppercase">
                        <tr><th>Data</th><th>Turno</th><th>Área</th><th>Tipo</th><th>Detalhe</th><th class="text-right">Qtd</th><th>Resp.</th></tr>
                    </thead>
                    <tbody class="divide-y">
                        ${paginatedRecs.map(r => `
                            <tr class="hover:bg-gray-50">
                                <td class="p-3">${Utils.formatDate(r.Data)}</td>
                                <td class="p-3">${r.Turno || '-'}</td>
                                <td class="p-3 font-medium">${r.AreaNome}</td>
                                <td class="p-3">
                                    <span class="px-2 py-1 rounded text-xs font-bold ${r.Tipo === 'Sólido' ? 'bg-green-100 text-green-800' : (r.Subtipo === 'Sopa' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800')}">
                                        ${r.Tipo === 'Sólido' ? 'Sólido' : r.Subtipo}
                                    </span>
                                </td>
                                <td class="p-3 text-xs text-gray-500">${r.Tipo === 'Sólido' ? (r.Prato || '-') : '-'}</td>
                                <td class="p-3 text-right font-bold">${r.Quantidade}</td>
                                <td class="p-3 text-xs text-gray-500">${r.Responsavel || '-'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                ${recs.length === 0 ? '<div class="p-4 text-center text-gray-500">Nenhum registro neste mês.</div>' : ''}
            </div>

            <!-- Paginação -->
            <div class="flex justify-between items-center mt-4 text-sm text-gray-600">
                <span>Mostrando ${Math.min(start + 1, total)}-${Math.min(end, total)} de ${total}</span>
                <div class="flex gap-2">
                    <button onclick="MLPainModule.changePage(-1)" class="px-3 py-1 border rounded hover:bg-gray-100" ${page === 1 ? 'disabled' : ''}>Anterior</button>
                    <span class="px-3 py-1">Página ${page}</span>
                    <button onclick="MLPainModule.changePage(1)" class="px-3 py-1 border rounded hover:bg-gray-100" ${end >= total ? 'disabled' : ''}>Próxima</button>
                </div>
            </div>
        `;
    },

    changePage: (offset) => {
        MLPainModule.state.pagination.page += offset;
        MLPainModule.renderDetalhamento();
    },

    exportDetalhamentoCSV: () => {
        const month = MLPainModule.state.filterMonth;
        const turno = MLPainModule.state.filterTurno;
        
        let recs = MLPainModule.state.registros.filter(r => r.Data.startsWith(month));
        if (turno) {
            recs = recs.filter(r => r.Turno === turno);
        }

        if (recs.length === 0) return Utils.toast('Nenhum registro para exportar.', 'info');

        const headers = ['Data', 'Turno', 'Area', 'Tipo', 'Subtipo', 'Detalhe', 'Quantidade', 'Responsavel'];
        const escapeCSV = (str) => (str === null || str === undefined) ? '' : `"${String(str).replace(/"/g, '""')}"`;

        const csvContent = [headers.join(','), ...recs.map(r => {
            return [r.Data, r.Turno, r.AreaNome, r.Tipo, r.Subtipo, r.Tipo === 'Sólido' ? r.Prato : '-', r.Quantidade, r.Responsavel].map(escapeCSV).join(',');
        })].join('\n');

        const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `detalhamento_mlpain_${month}${turno ? '_' + turno : ''}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    },

    exportPDF: () => {
        const { areas, registros, filterMonth, customFilterStart, customFilterEnd, instituicao } = MLPainModule.state;
        const inst = instituicao[0] || {};
        const showLogo = inst.ExibirLogoRelatorios;
        const user = Utils.getUser();
        
        console.log('Gerando PDF M.L. Pain:', { areas, registros });

        let recs = [];
        let daysToRender = [];
        let reportTitle = '';
        let periodStr = '';

        // Determinar Período e Dados
        if (customFilterStart && customFilterEnd) {
            recs = registros.filter(r => r.Data >= customFilterStart && r.Data <= customFilterEnd);
            reportTitle = `Relatório Personalizado`;
            periodStr = `${Utils.formatDate(customFilterStart)} a ${Utils.formatDate(customFilterEnd)}`;
            
            const [sY, sM, sD] = customFilterStart.split('-').map(Number);
            const [eY, eM, eD] = customFilterEnd.split('-').map(Number);
            let curr = new Date(sY, sM - 1, sD);
            const last = new Date(eY, eM - 1, eD);
            while (curr <= last) {
                daysToRender.push(new Date(curr));
                curr.setDate(curr.getDate() + 1);
            }
        } else {
            recs = registros.filter(r => r.Data.startsWith(filterMonth));
            reportTitle = `Relatório Mensal`;
            const [year, monthNum] = filterMonth.split('-');
            periodStr = new Date(year, monthNum - 1).toLocaleString('pt-AO', { month: 'long', year: 'numeric' }).toUpperCase();
            const daysInMonth = new Date(year, monthNum, 0).getDate();
            for(let i=1; i<=daysInMonth; i++) {
                daysToRender.push(new Date(year, monthNum - 1, i));
            }
        }

        // Filtrar Áreas
        const activeAreas = areas.filter(a => a.Ativo);
        const solidAreas = activeAreas.filter(a => !a.Tipo || a.Tipo === 'Sólido');
        const liquidAreas = activeAreas.filter(a => a.Tipo === 'Líquido');

        // Calcular Matriz de Dados
        const matrix = {};
        const dateKeys = daysToRender.map(d => {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
        });

        activeAreas.forEach(a => {
            matrix[a.ID] = {};
            dateKeys.forEach(k => {
                matrix[a.ID][k] = { Solido: 0, Sopa: 0, Cha: 0 };
            });
        });

        recs.forEach(r => {
            if (matrix[r.AreaID] && matrix[r.AreaID][r.Data]) {
                const qtd = Number(r.Quantidade);
                if (r.Tipo === 'Sólido') matrix[r.AreaID][r.Data].Solido += qtd;
                else if (r.Subtipo === 'Sopa') matrix[r.AreaID][r.Data].Sopa += qtd;
                else if (r.Subtipo === 'Chá') matrix[r.AreaID][r.Data].Cha += qtd;
            }
        });

        // Função para Gerar HTML de Tabela
        const generateTableHtml = (title, typeKey, areasList) => {
            if (areasList.length === 0) return '';
            
            let headerRow = `<tr><th class="col-area">ÁREA / DIA</th>`;
            daysToRender.forEach(d => {
                headerRow += `<th class="col-day">${d.getDate()}</th>`;
            });
            headerRow += `<th class="col-total">TOTAL</th></tr>`;

            let bodyRows = '';
            let grandTotal = 0;
            const colTotals = new Array(daysToRender.length).fill(0);

            areasList.forEach(a => {
                let rowHtml = `<tr><td class="col-area text-left">${a.Nome}</td>`;
                let rowTotal = 0;
                
                daysToRender.forEach((d, idx) => {
                    const y = d.getFullYear();
                    const m = String(d.getMonth() + 1).padStart(2, '0');
                    const day = String(d.getDate()).padStart(2, '0');
                    const k = `${y}-${m}-${day}`;
                    
                    const val = matrix[a.ID][k] ? matrix[a.ID][k][typeKey] : 0;
                    rowTotal += val;
                    colTotals[idx] += val;
                    rowHtml += `<td>${val > 0 ? val : ''}</td>`;
                });
                grandTotal += rowTotal;
                rowHtml += `<td class="col-total">${rowTotal}</td></tr>`;
                bodyRows += rowHtml;
            });

            // Linha de Totais
            let footerRow = `<tr class="total-row"><td class="col-area text-right">TOTAL</td>`;
            colTotals.forEach(t => footerRow += `<td>${t > 0 ? t : ''}</td>`);
            footerRow += `<td class="col-total">${grandTotal}</td></tr>`;

            return `
                <div class="table-section">
                    <h3 class="table-title">${title}</h3>
                    <table>
                        <thead>${headerRow}</thead>
                        <tbody>${bodyRows}${footerRow}</tbody>
                    </table>
                </div>
            `;
        };

        // Criar Container Temporário
        const container = document.createElement('div');
        container.id = 'print-mlpain-pdf';
        
        // CSS Profissional para A4 Paisagem
        const styles = `
            <style>
                /* Ajustes para Impressão e PDF */
                @media print {
                    * {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    body, html {
                        height: auto !important;
                        overflow: visible !important;
                    }
                    /* Ocultar elementos de UI na impressão nativa */
                    nav, header, .sidebar, button, .no-print {
                        display: none !important;
                    }
                }

                #print-mlpain-pdf {
                    width: 285mm; /* Largura segura para A4 Paisagem */
                    background-color: white;
                    padding: 5mm;
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    color: #1f2937;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                }
                .pdf-header {
                    display: flex; justify-content: space-between; align-items: center;
                    border-bottom: 2px solid #1f2937; padding-bottom: 10px; margin-bottom: 10px;
                }
                .pdf-logo-text h1 { font-size: 18px; font-weight: bold; text-transform: uppercase; margin: 0; }
                .pdf-logo-text p { font-size: 10px; color: #6b7280; margin: 0; }
                .pdf-info { text-align: right; }
                .pdf-info h2 { font-size: 14px; font-weight: bold; margin: 0; color: #374151; }
                .pdf-info p { font-size: 10px; margin: 0; }
                
                .table-section { margin-bottom: 15px; page-break-inside: avoid; }
                .table-title { font-size: 10px; font-weight: bold; margin-bottom: 4px; color: #374151; border-bottom: 1px solid #e5e7eb; padding-bottom: 2px; }
                
                table {
                    width: 100%; border-collapse: collapse; font-size: 8px;
                    table-layout: fixed; /* Garante colunas iguais */
                }
                th, td {
                    border: 1px solid #d1d5db; padding: 2px 1px;
                    text-align: center; vertical-align: middle;
                    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                }
                th { background-color: #f3f4f6; font-weight: bold; color: #111827; font-size: 7px; }
                
                .col-area { width: 12%; text-align: left; padding-left: 4px; font-weight: bold; white-space: normal; }
                .col-day { width: auto; }
                .col-total { width: 5%; font-weight: bold; background-color: #f9fafb; }
                
                tr:nth-child(even) { background-color: #f9fafb; }
                .total-row { background-color: #e5e7eb; font-weight: bold; }
                .text-left { text-align: left; }
                .text-right { text-align: right; }
            </style>
        `;

        const headerHtml = `
            <div class="pdf-header">
                <div class="pdf-logo-text">
                    ${showLogo && inst.LogotipoURL ? `<img src="${inst.LogotipoURL}" style="height: 30px; margin-bottom: 5px;">` : ''}
                    <h1>${inst.NomeFantasia || 'Delícia da Cidade'}</h1>
                    <p>Relatório de Controle - M.L. Pain</p>
                </div>
                <div class="pdf-info">
                    <h2>${reportTitle.toUpperCase()}</h2>
                    <p>${periodStr}</p>
                    <p>Gerado por: ${user.Nome || 'Sistema'}</p>
                </div>
            </div>
        `;

        const tablesHtml = 
            generateTableHtml('MAPA DE DIETAS SÓLIDAS', 'Solido', solidAreas) +
            generateTableHtml('MAPA DE DIETAS LÍQUIDAS - SOPA', 'Sopa', liquidAreas) +
            generateTableHtml('MAPA DE DIETAS LÍQUIDAS - CHÁ', 'Cha', liquidAreas);

        container.innerHTML = styles + headerHtml + tablesHtml;

        // Renderização Oculta (Correção para evitar PDF em branco)
        container.style.position = 'absolute'; 
        container.style.top = '0';
        container.style.left = '0';
        container.style.opacity = '0'; // Invisível mas renderizável
        container.style.zIndex = '-1'; // Atrás de tudo
        document.body.appendChild(container);

        const opt = { 
            margin: 5, 
            filename: `mlpain-relatorio-${filterMonth}.pdf`, 
            image: { type: 'jpeg', quality: 0.98 }, 
            html2canvas: { scale: 2, useCORS: true }, 
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' } 
        };
        
        // Pequeno delay para garantir renderização do DOM
        setTimeout(() => {
            html2pdf().set(opt).from(container).save().then(() => {
                document.body.removeChild(container);
            });
        }, 100);
    },

    shareReportWhatsApp: () => {
        const start = MLPainModule.state.customFilterStart;
        const end = MLPainModule.state.customFilterEnd;
        let recs = [];
        let periodText = `🗓️ Mês: ${MLPainModule.state.filterMonth}`;

        if (start && end) {
            recs = MLPainModule.state.registros.filter(r => r.Data >= start && r.Data <= end);
            periodText = `🗓️ Período: ${Utils.formatDate(start)} a ${Utils.formatDate(end)}`;
        } else {
            recs = MLPainModule.state.registros.filter(r => r.Data.startsWith(MLPainModule.state.filterMonth));
        }
        
        if (recs.length === 0) return Utils.toast('Sem dados para compartilhar.', 'info');

        // Totais
        const totals = { Solido: 0, Sopa: 0, Cha: 0 };
        recs.forEach(r => {
            if (r.Tipo === 'Sólido') totals.Solido += Number(r.Quantidade);
            else if (r.Subtipo === 'Sopa') totals.Sopa += Number(r.Quantidade);
            else if (r.Subtipo === 'Chá') totals.Cha += Number(r.Quantidade);
        });
        const totalGeral = totals.Solido + totals.Sopa + totals.Cha;

        // Por Área
        const areaStats = {};
        recs.forEach(r => {
            const area = r.AreaNome || 'Outros';
            if (!areaStats[area]) areaStats[area] = { Solido: 0, Sopa: 0, Cha: 0 };
            if (r.Tipo === 'Sólido') areaStats[area].Solido += Number(r.Quantidade);
            else if (r.Subtipo === 'Sopa') areaStats[area].Sopa += Number(r.Quantidade);
            else if (r.Subtipo === 'Chá') areaStats[area].Cha += Number(r.Quantidade);
        });

        let msg = `*📊 RELATÓRIO MENSAL - M.L. PAIN*\n`;
        msg += `${periodText}\n\n`;
        
        msg += `*RESUMO GERAL*\n`;
        msg += `🍽️ Sólidos: ${totals.Solido}\n`;
        msg += `🥣 Sopa: ${totals.Sopa}\n`;
        msg += `☕ Chá: ${totals.Cha}\n`;
        msg += `*TOTAL: ${totalGeral}*\n\n`;
        
        msg += `*DETALHE POR ÁREA*\n`;
        Object.keys(areaStats).sort().forEach(area => {
            const s = areaStats[area];
            const t = s.Solido + s.Sopa + s.Cha;
            if (t > 0) {
                msg += `🏥 *${area}*: ${t} (Sól:${s.Solido} Liq:${s.Sopa + s.Cha})\n`;
            }
        });

        msg += `\n_Gerado em ${new Date().toLocaleDateString()}_`;
        
        const encodedMsg = encodeURIComponent(msg);
        
        Utils.openModal('Compartilhar Relatório', `
            <div class="text-center">
                <i class="fab fa-whatsapp text-4xl text-green-500 mb-4"></i>
                <p class="text-gray-600 mb-6">O resumo do relatório foi gerado. Envie para a administração.</p>
                
                <a href="https://wa.me/?text=${encodedMsg}" target="_blank" class="block w-full bg-green-500 text-white py-3 rounded font-bold hover:bg-green-600 flex items-center justify-center gap-2 transition mb-3 shadow">
                    Enviar para WhatsApp
                </a>
                
                <button onclick="navigator.clipboard.writeText(document.getElementById('msg-preview-mlpain').innerText).then(() => Utils.toast('Texto copiado!'))" class="block w-full bg-gray-100 text-gray-700 py-3 rounded font-bold hover:bg-gray-200 flex items-center justify-center gap-2 transition">
                    <i class="fas fa-copy"></i> Copiar Texto
                </button>
                
                <div class="mt-4 text-left bg-gray-50 p-3 rounded border text-xs max-h-48 overflow-y-auto whitespace-pre-wrap font-mono text-gray-600" id="msg-preview-mlpain">${msg}</div>
            </div>
        `);
    },

    // --- 4. GESTÃO DE ÁREAS ---
    renderAreas: (container) => {
        const areas = MLPainModule.state.areas;
        const solidas = areas.filter(a => !a.Tipo || a.Tipo === 'Sólido');
        const liquidas = areas.filter(a => a.Tipo === 'Líquido');
        const canCreate = Utils.checkPermission('MLPain', 'criar');
        const canEdit = Utils.checkPermission('MLPain', 'editar');
        const canDelete = Utils.checkPermission('MLPain', 'excluir');

        const renderTable = (list, title, type, colorClass) => `
            <div class="mb-8">
                <div class="flex justify-between items-center mb-4">
                    <h4 class="text-lg font-bold ${colorClass}">${title}</h4>
                    ${canCreate ? `<button onclick="MLPainModule.modalArea('${type}')" class="${colorClass.replace('text-', 'bg-').replace('700', '600')} text-white px-4 py-2 rounded shadow hover:opacity-90">+ Nova Área ${type}</button>` : ''}
                </div>
                <div class="bg-white rounded shadow overflow-hidden">
                    <table class="w-full text-sm text-left">
                        <thead class="bg-gray-100"><tr><th class="p-3">Ordem</th><th class="p-3">Nome da Área</th><th class="p-3 text-center">Meta Diária</th><th class="p-3">Status</th><th class="p-3 text-center">Ações</th></tr></thead>
                        <tbody class="divide-y">
                            ${list.map(a => `
                                <tr class="hover:bg-gray-50">
                                    <td class="p-3 text-gray-500">${a.Ordem || 0}</td>
                                    <td class="p-3 font-bold">${a.Nome}</td>
                                    <td class="p-3 text-center font-mono text-blue-600">${a.MetaDiaria || 0}</td>
                                    <td class="p-3"><span class="px-2 py-1 rounded text-xs ${a.Ativo ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">${a.Ativo ? 'Ativo' : 'Inativo'}</span></td>
                                    <td class="p-3 text-center">
                                        ${canEdit ? `<button onclick="MLPainModule.modalArea('${type}', '${a.ID}')" class="text-blue-500 hover:text-blue-700 mr-2"><i class="fas fa-edit"></i></button>` : ''}
                                        ${canDelete ? `<button onclick="MLPainModule.deleteArea('${a.ID}')" class="text-red-500 hover:text-red-700"><i class="fas fa-trash"></i></button>` : ''}
                                    </td>
                                </tr>
                            `).join('')}
                            ${list.length === 0 ? '<tr><td colspan="5" class="p-4 text-center text-gray-500">Nenhuma área cadastrada.</td></tr>' : ''}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        container.innerHTML = `
            <h3 class="text-xl font-bold mb-6">Gestão de Áreas Hospitalares</h3>
            
            ${renderTable(solidas, '🍽️ Áreas - Dieta Sólida', 'Sólido', 'text-blue-700')}
            
            ${renderTable(liquidas, '🥣 Áreas - Dieta Líquida', 'Líquido', 'text-orange-700')}
        `;
    },

    modalArea: (type = 'Sólido', id = null) => {
        const area = id ? MLPainModule.state.areas.find(a => a.ID === id) : {};
        const title = id ? `Editar Área (${type})` : `Nova Área (${type})`;

        Utils.openModal(title, `
            <form onsubmit="MLPainModule.saveArea(event)">
                <input type="hidden" name="ID" value="${area.ID || ''}">
                <input type="hidden" name="Tipo" value="${type}">
                <div class="mb-3"><label class="text-xs font-bold">Nome da Área</label><input name="Nome" value="${area.Nome || ''}" class="border p-2 rounded w-full" required placeholder="Ex: Pediatria, UTI..."></div>
                <div class="mb-3"><label class="text-xs font-bold">Ordem de Exibição</label><input type="number" name="Ordem" value="${area.Ordem || 0}" class="border p-2 rounded w-full"></div>
                <div class="mb-3"><label class="text-xs font-bold">Meta Diária de Refeições</label><input type="number" name="MetaDiaria" value="${area.MetaDiaria || 0}" class="border p-2 rounded w-full" placeholder="Opcional"></div>
                <button class="w-full bg-blue-600 text-white py-2 rounded font-bold">Salvar</button>
            </form>
        `);
    },

    saveArea: async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target).entries());
        try {
            await Utils.api('save', 'MLPain_Areas', data);
            Utils.toast('✅ Área salva!'); Utils.closeModal(); MLPainModule.fetchData();
        } catch (err) { Utils.toast('Erro ao salvar'); }
    },

    deleteArea: async (id) => {
        if(confirm('Remover esta área?')) {
            await Utils.api('delete', 'MLPain_Areas', null, id);
            MLPainModule.fetchData();
        }
    }
};

document.addEventListener('DOMContentLoaded', MLPainModule.init);