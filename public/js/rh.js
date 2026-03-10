const RHModule = {
    state: {
        cache: { allFuncionarios: [], funcionarios: [], ferias: [], frequencia: null, avaliacoes: null, treinamentos: null, licencas: null, folha: null, escala: null, parametros: [], cargos: [], departamentos: [], instituicao: [] },
        activeTab: 'visao-geral',
        filterTerm: '',
        filterVencidas: false,
        filterFrequenciaStart: '',
        filterFrequenciaEnd: '',
        filterFrequenciaTurno: '',
        filterDateVisaoGeral: new Date().toISOString().split('T')[0],
        filterTurnoVisaoGeral: '',
        pagination: {
            currentPage: 1,
            rowsPerPage: 15,
            totalRows: 0
        }
    },

    init: () => {
        RHModule.renderLayout();
        RHModule.fetchData();
        RHModule.updateHeaderPhoto();
    },

    fetchData: async () => {
        try {
            // Carregamento Otimizado: Lista leve para dropdowns + Dados auxiliares
            const [allFuncs, ferias, params, cargos, deptos, inst, escalaConfig] = await Promise.all([
                Utils.api('getEmployeesList', null),
                Utils.api('getAll', 'Ferias'),
                Utils.api('getAll', 'ParametrosRH'),
                Utils.api('getAll', 'Cargos'),
                Utils.api('getAll', 'Departamentos'),
                Utils.api('getAll', 'InstituicaoConfig'),
                Utils.api('getAll', 'EscalaConfig')   // ← carrega assignments logo no início
            ]);

            // Popula assignments no escalaState imediatamente
            const assignments = {};
            (escalaConfig || []).forEach(r => {
                assignments[r.FuncionarioID] = {
                    id: r.ID,
                    tipo: r.Tipo,
                    folgaFixa: r.FolgaFixa || null,
                    fdsAlterna: r.FdsAlterna !== false && r.FdsAlterna !== 'false',
                    fdsTrabalhaS1: r.FdsTrabalhaS1 !== false && r.FdsTrabalhaS1 !== 'false'
                };
            });
            RHModule.escalaState.assignments = assignments;
            
            RHModule.state.cache = {
                allFuncionarios: allFuncs || [], // Usado em dropdowns e validações
                funcionarios: [], // Será preenchido pelo loadEmployees (Paginado)
                ferias: ferias || [],
                parametros: params || [],
                cargos: cargos || [],
                departamentos: deptos || [],
                instituicao: inst || [],
                // Dados sob demanda (Lazy Loading) - Inicializam como null
                frequencia: null, avaliacoes: null, treinamentos: null, licencas: null, folha: null, escala: null
            };
            await RHModule.loadEmployees(); // Carrega dados da equipe em background
            RHModule.renderCurrentTab(); // Regressa à aba que estava activa
        } catch (e) { 
            console.error("Erro crítico ao carregar dados do servidor:", e);
            Utils.toast("Erro de Conexão: Verifique se o backend está online.", 'error');
            document.getElementById('rh-content').innerHTML = `
                <div class="flex flex-col items-center justify-center h-64 text-red-600">
                    <i class="fas fa-server text-4xl mb-4"></i>
                    <h3 class="text-xl font-bold">Erro de Conexão</h3>
                    <p>Não foi possível carregar os dados reais do sistema.</p>
                </div>
            `;
        }
    },

    loadEmployees: async () => {
        try {
            const { currentPage, rowsPerPage } = RHModule.state.pagination;
            const term = RHModule.state.filterTerm;

            // Se filtro de vencidas estiver ativo, usamos lógica client-side na lista leve
            if (RHModule.state.filterVencidas) {
                RHModule.renderFuncionarios();
                return;
            }

            const response = await Utils.api('getEmployees', null, { 
                page: currentPage, 
                limit: rowsPerPage, 
                term: term 
            });

            RHModule.state.cache.funcionarios = response.data || [];
            RHModule.state.pagination.totalRows = response.total || 0;
            
            RHModule.renderFuncionarios();
        } catch (e) { console.error(e); Utils.toast("Erro ao atualizar lista.", 'error'); }
    },

    updateHeaderPhoto: () => {
        // Atualiza a foto do usuário logado no cabeçalho (Header)
        const user = JSON.parse(localStorage.getItem('user'));
        // IMPORTANTE: Verifique se a imagem do perfil no seu HTML (dashboard.html) tem o id="user-photo"
        const img = document.getElementById('user-photo'); 
        if (user && user.FotoURL && img) {
            img.src = user.FotoURL;
        }
    },

    renderLayout: () => {
        // Menu de Abas - Estilo Enterprise Minimalista (Underline)
        document.getElementById('rh-content').innerHTML = `
            <div class="border-b border-gray-200 mb-8">
                <nav class="-mb-px flex space-x-8 overflow-x-auto" aria-label="Tabs">
                    <button id="tab-visao-geral" onclick="RHModule.renderVisaoGeral()" class="tab-btn whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200">Visão Geral</button>
                    <button id="tab-funcionarios" onclick="RHModule.renderFuncionarios()" class="tab-btn whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200">Equipe</button>
                    <button id="tab-frequencia" onclick="RHModule.renderFrequencia()" class="tab-btn whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200">Frequência</button>
                    <button id="tab-ferias" onclick="RHModule.renderFerias()" class="tab-btn whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200">Férias</button>
                    <button id="tab-avaliacoes" onclick="RHModule.renderAvaliacoes()" class="tab-btn whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200">Avaliação</button>
                    <button id="tab-treinamento" onclick="RHModule.renderTreinamento()" class="tab-btn whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200">Treinamento</button>
                    <button id="tab-folha" onclick="RHModule.renderFolha()" class="tab-btn whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200">Folha</button>
                    <button id="tab-licencas" onclick="RHModule.renderLicencas()" class="tab-btn whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200">Licenças</button>
                    <button id="tab-relatorios" onclick="RHModule.renderRelatorios()" class="tab-btn whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200">Relatórios</button>
                    <button id="tab-escala" onclick="RHModule.renderEscalaMensal()" class="tab-btn whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200">📅 Escala Mensal</button>
                </nav>
            </div>
            <div id="tab-content">
                <div class="flex flex-col items-center justify-center h-64 text-blue-600">
                    <i class="fas fa-spinner fa-spin text-5xl mb-4"></i>
                    <p class="text-xl font-medium animate-pulse">Carregando dados do RH...</p>
                </div>
            </div>
        `;
    },

    highlightTab: (id) => {
        // Guarda a aba activa (ex: 'tab-ferias' → 'ferias')
        RHModule.state.activeTab = id.replace('tab-', '');
        document.querySelectorAll('.tab-btn').forEach(b => {
            b.classList.remove('border-orange-500', 'text-orange-600');
            b.classList.add('border-transparent', 'text-gray-500', 'hover:text-gray-700', 'hover:border-gray-300');
        });
        const btn = document.getElementById(id);
        if(btn) {
            btn.classList.remove('border-transparent', 'text-gray-500', 'hover:text-gray-700', 'hover:border-gray-300');
            btn.classList.add('border-orange-500', 'text-orange-600');
        }
    },

    // Regressa à aba que estava activa antes do save/refresh
    renderCurrentTab: () => {
        const tabMap = {
            'visao-geral':   () => RHModule.renderVisaoGeral(),
            'funcionarios':  () => RHModule.renderFuncionarios(),
            'frequencia':    () => RHModule.renderFrequencia(),
            'ferias':        () => RHModule.renderFerias(),
            'avaliacoes':    () => RHModule.renderAvaliacoes(),
            'treinamento':   () => RHModule.renderTreinamento(),
            'folha':         () => RHModule.renderFolha(),
            'licencas':      () => RHModule.renderLicencas(),
            'relatorios':    () => RHModule.renderRelatorios(),
            'escala':        () => RHModule.renderEscalaMensal(),
        };
        const render = tabMap[RHModule.state.activeTab] || tabMap['visao-geral'];
        render();
    },

    // --- HELPER: Cabeçalho padrão para todos os PDFs ---
    buildPDFHeader: (inst, title, subtitle) => {
        const showLogo = inst.ExibirLogoRelatorios;
        const contactLine = [
            inst.Telefone ? `Tel: ${inst.Telefone}` : '',
            inst.Email    ? `Email: ${inst.Email}`   : ''
        ].filter(Boolean).join(' | ');

        return `
            <div class="flex items-center justify-between border-b-2 border-gray-800 pb-4 mb-6">
                <div class="${showLogo && inst.LogotipoURL ? 'flex items-center gap-4' : ''}">
                    ${showLogo && inst.LogotipoURL ? `<img src="${inst.LogotipoURL}" class="h-16 w-auto object-contain" crossorigin="anonymous">` : ''}
                    <div>
                        <h1 class="text-2xl font-bold uppercase">${inst.NomeFantasia || 'Empresa'}</h1>
                        ${inst.NomeCompleto ? `<p class="text-sm text-gray-600">${inst.NomeCompleto}</p>` : ''}
                        ${inst.Endereco    ? `<p class="text-sm text-gray-600">${inst.Endereco}</p>`    : ''}
                        ${contactLine      ? `<p class="text-sm text-gray-600">${contactLine}</p>`      : ''}
                    </div>
                </div>
                <div class="text-right">
                    <h2 class="text-xl font-bold">${title}</h2>
                    ${subtitle ? `<p class="text-sm text-gray-500">${subtitle}</p>` : ''}
                    <p class="text-xs text-gray-400">Gerado em: ${new Date().toLocaleDateString('pt-BR')}</p>
                </div>
            </div>
        `;
    },

    // --- 0. ABA VISÃO GERAL ---
    renderVisaoGeral: async () => {
        RHModule.highlightTab('tab-visao-geral');

        // Carrega dados necessários se não existirem (Lazy Loading)
        if (!RHModule.state.cache.frequencia) {
            document.getElementById('tab-content').innerHTML = '<div class="text-center p-10"><i class="fas fa-spinner fa-spin text-4xl text-blue-600"></i><p class="mt-2">Carregando dados...</p></div>';
            try {
                RHModule.state.cache.frequencia = await Utils.api('getAll', 'Frequencia');
            } catch (e) { 
                Utils.toast('Erro ao carregar frequência.', 'error');
                document.getElementById('tab-content').innerHTML = '<div class="text-center p-10 text-red-500"><i class="fas fa-exclamation-circle text-4xl mb-2"></i><p>Erro ao carregar dados.</p><button onclick="RHModule.renderVisaoGeral()" class="mt-2 text-blue-600 underline font-bold">Tentar novamente</button></div>';
                return;
            }
        }
        if (!RHModule.state.cache.escala) {
             try {
                RHModule.state.cache.escala = await Utils.api('getAll', 'Escala');
            } catch (e) { RHModule.state.cache.escala = []; }
        }

        // --- DASHBOARD METRICS (HOJE) ---
        const targetDate = RHModule.state.filterDateVisaoGeral || new Date().toISOString().split('T')[0];
        const targetTurno = RHModule.state.filterTurnoVisaoGeral || '';

        let allFuncs = RHModule.state.cache.allFuncionarios || [];
        
        // Filtra funcionários pelo turno selecionado
        if (targetTurno) {
            allFuncs = allFuncs.filter(f => f.Turno === targetTurno);
        }
        const validFuncIds = new Set(allFuncs.map(f => f.ID));

        const ferias = RHModule.state.cache.ferias || [];
        const escala = RHModule.state.cache.escala || [];
        let frequencia = RHModule.state.cache.frequencia || [];

        // Filtra registros de frequência apenas dos funcionários do turno selecionado
        if (targetTurno) frequencia = frequencia.filter(r => validFuncIds.has(r.FuncionarioID));

        const presentesHoje = frequencia.filter(r => r.Data === targetDate && (r.Status === 'Presente' || r.Entrada)).length;
        const faltasHoje = frequencia.filter(r => r.Data === targetDate && r.Status === 'Falta').length;
        const atrasosHoje = frequencia.filter(r => r.Data === targetDate && r.Status === 'Atraso').length;
        const emFeriasHoje = ferias.filter(f => f.Status === 'Aprovado' && f.DataInicio <= targetDate && f.DataFim >= targetDate && validFuncIds.has(f.FuncionarioID)).length;
        const totalAtivos = allFuncs.filter(f => f.Status === 'Ativo').length;

        // Cálculo de Escalados Hoje
        const dObj = new Date(targetDate + 'T00:00:00');
        const jsDay = dObj.getDay();
        const appDay = jsDay === 0 ? 7 : jsDay; // 1=Seg ... 7=Dom
        let escaladosHoje = 0;
        
        allFuncs.filter(f => f.Status === 'Ativo').forEach(f => {
            const config = escala.find(e => e.FuncionarioID === f.ID && e.DiaSemana === appDay);
            let isWorking = false;
            if (config) {
                if (config.Tipo === 'Trabalho') isWorking = true;
            } else {
                if (f.Turno === 'Diarista' && appDay <= 5) isWorking = true;
            }
            if (isWorking) escaladosHoje++;
        });

        // --- GRÁFICO DE PONTUALIDADE SEMANAL ---
        const last7Days = [];
        const dataPresentes = [];
        const dataAtrasos = [];
        const dataFaltas = [];

        for (let i = 6; i >= 0; i--) {
            const d = new Date(targetDate + 'T00:00:00');
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            const dayLabel = d.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric' });
            
            last7Days.push(dayLabel);

            const recs = frequencia.filter(r => r.Data === dateStr);
            
            let p = 0, a = 0, f = 0;
            recs.forEach(r => {
                if (r.Status === 'Presente' || (r.Entrada && r.Status !== 'Atraso' && r.Status !== 'Falta')) p++;
                else if (r.Status === 'Atraso') a++;
                else if (r.Status === 'Falta' || r.Status === 'Falta Justificada') f++;
            });
            
            dataPresentes.push(p);
            dataAtrasos.push(a);
            dataFaltas.push(f);
        }

        // --- GRÁFICO DE TURNOS (DADOS GLOBAIS ATIVOS) ---
        const turnoMap = {};
        (RHModule.state.cache.allFuncionarios || []).filter(f => f.Status === 'Ativo').forEach(f => {
            const t = f.Turno || 'Não Definido';
            turnoMap[t] = (turnoMap[t] || 0) + 1;
        });
        const turnoLabels = Object.keys(turnoMap);
        const turnoData = Object.values(turnoMap);

        document.getElementById('tab-content').innerHTML = `
            <div class="flex justify-between items-center mb-6">
                <h3 class="text-2xl font-bold text-gray-800">Visão Geral do RH</h3>
                <div class="flex gap-2 items-center">
                    <label class="text-sm font-bold text-gray-600">Turno:</label>
                    <select class="border p-2 rounded shadow-sm text-sm" onchange="RHModule.state.filterTurnoVisaoGeral = this.value; RHModule.renderVisaoGeral()">
                        <option value="">Todos</option>
                        <option value="Diarista" ${targetTurno === 'Diarista' ? 'selected' : ''}>Diarista</option>
                        <option value="Regime de Turno" ${targetTurno === 'Regime de Turno' ? 'selected' : ''}>Regime de Turno</option>
                    </select>
                    <label class="text-sm font-bold text-gray-600">Data:</label>
                    <input type="date" value="${targetDate}" class="border p-2 rounded shadow-sm text-sm" onchange="RHModule.state.filterDateVisaoGeral = this.value; RHModule.renderVisaoGeral()">
                    <button onclick="RHModule.exportVisaoGeralPDF()" class="bg-red-600 text-white px-4 py-2 rounded shadow hover:bg-red-700 transition flex items-center gap-2">
                        <i class="fas fa-file-pdf"></i> Exportar Resumo
                    </button>
                </div>
            </div>
            
            <!-- DASHBOARD DE PRESENÇA -->
            <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
                <div class="bg-white p-3 rounded shadow border-l-4 border-blue-500">
                    <div class="text-xs text-gray-500 font-bold uppercase">Total Equipe</div>
                    <div class="text-xl font-bold text-gray-800">${totalAtivos}</div>
                </div>
                <div class="bg-white p-3 rounded shadow border-l-4 border-indigo-500">
                    <div class="text-xs text-gray-500 font-bold uppercase">Escalados Hoje</div>
                    <div class="text-xl font-bold text-indigo-600">${escaladosHoje}</div>
                </div>
                <div class="bg-white p-3 rounded shadow border-l-4 border-green-500">
                    <div class="text-xs text-gray-500 font-bold uppercase">Presentes</div>
                    <div class="text-xl font-bold text-green-600">${presentesHoje}</div>
                </div>
                <div class="bg-white p-3 rounded shadow border-l-4 border-red-500">
                    <div class="text-xs text-gray-500 font-bold uppercase">Faltas</div>
                    <div class="text-xl font-bold text-red-600">${faltasHoje}</div>
                </div>
                <div class="bg-white p-3 rounded shadow border-l-4 border-yellow-500">
                    <div class="text-xs text-gray-500 font-bold uppercase">Atrasos</div>
                    <div class="text-xl font-bold text-yellow-600">${atrasosHoje}</div>
                </div>
                <div class="bg-white p-3 rounded shadow border-l-4 border-purple-500">
                    <div class="text-xs text-gray-500 font-bold uppercase">Em Férias</div>
                    <div class="text-xl font-bold text-purple-600">${emFeriasHoje}</div>
                </div>
            </div>
            
            <!-- GRÁFICO -->
            <div class="bg-white p-6 rounded shadow mb-6">
                <h4 class="font-bold text-gray-700 mb-4 border-b pb-2">Pontualidade Semanal (Até ${new Date(targetDate + 'T00:00:00').toLocaleDateString('pt-BR')})</h4>
                <div class="h-64"><canvas id="chartPontualidade"></canvas></div>
            <!-- GRÁFICOS -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <div class="bg-white p-6 rounded shadow">
                    <h4 class="font-bold text-gray-700 mb-4 border-b pb-2">Pontualidade Semanal (Até ${new Date(targetDate + 'T00:00:00').toLocaleDateString('pt-BR')})</h4>
                    <div class="h-64"><canvas id="chartPontualidade"></canvas></div>
                </div>
                <div class="bg-white p-6 rounded shadow">
                    <h4 class="font-bold text-gray-700 mb-4 border-b pb-2">Distribuição por Turno (Ativos)</h4>
                    <div class="h-64"><canvas id="chartTurnos"></canvas></div>
                </div>
            </div>
            
            <div class="bg-blue-50 p-4 rounded border border-blue-100 text-center text-blue-800">
                <p>Utilize as abas acima para gerenciar a equipe, frequência e pagamentos.</p>
            </div>
        `;

        // Renderizar Gráfico
        if (typeof Chart !== 'undefined') {
            new Chart(document.getElementById('chartPontualidade'), {
                type: 'bar',
                data: {
                    labels: last7Days,
                    datasets: [
                        { label: 'Presentes', data: dataPresentes, backgroundColor: '#10B981' },
                        { label: 'Atrasos', data: dataAtrasos, backgroundColor: '#F59E0B' },
                        { label: 'Faltas', data: dataFaltas, backgroundColor: '#EF4444' }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: { stacked: true },
                        y: { stacked: true, beginAtZero: true }
                    }
                }
            });

            new Chart(document.getElementById('chartTurnos'), {
                type: 'pie',
                data: {
                    labels: turnoLabels,
                    datasets: [{
                        data: turnoData,
                        backgroundColor: ['#3B82F6', '#F59E0B', '#10B981', '#EF4444', '#8B5CF6']
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'right' }
                    }
                }
            });
        }
    },

    exportVisaoGeralPDF: () => {
        const inst = RHModule.state.cache.instituicao[0] || {};
        const showLogo = inst.ExibirLogoRelatorios;
        const user = Utils.getUser();
        const targetDate = RHModule.state.filterDateVisaoGeral || new Date().toISOString().split('T')[0];
        const targetTurno = RHModule.state.filterTurnoVisaoGeral || '';

        // Recalcular métricas para o PDF (mesma lógica da tela)
        let allFuncs = RHModule.state.cache.allFuncionarios || [];
        
        if (targetTurno) {
            allFuncs = allFuncs.filter(f => f.Turno === targetTurno);
        }
        const validFuncIds = new Set(allFuncs.map(f => f.ID));

        const ferias = RHModule.state.cache.ferias || [];
        const escala = RHModule.state.cache.escala || [];
        let frequencia = RHModule.state.cache.frequencia || [];

        if (targetTurno) frequencia = frequencia.filter(r => validFuncIds.has(r.FuncionarioID));

        const presentesHoje = frequencia.filter(r => r.Data === targetDate && (r.Status === 'Presente' || r.Entrada)).length;
        const faltasHoje = frequencia.filter(r => r.Data === targetDate && r.Status === 'Falta').length;
        const atrasosHoje = frequencia.filter(r => r.Data === targetDate && r.Status === 'Atraso').length;
        const emFeriasHoje = ferias.filter(f => f.Status === 'Aprovado' && f.DataInicio <= targetDate && f.DataFim >= targetDate && validFuncIds.has(f.FuncionarioID)).length;
        const totalAtivos = allFuncs.filter(f => f.Status === 'Ativo').length;

        const dObj = new Date(targetDate + 'T00:00:00');
        const jsDay = dObj.getDay();
        const appDay = jsDay === 0 ? 7 : jsDay;
        let escaladosHoje = 0;
        
        allFuncs.filter(f => f.Status === 'Ativo').forEach(f => {
            const config = escala.find(e => e.FuncionarioID === f.ID && e.DiaSemana === appDay);
            let isWorking = false;
            if (config) {
                if (config.Tipo === 'Trabalho') isWorking = true;
            } else {
                if (f.Turno === 'Diarista' && appDay <= 5) isWorking = true;
            }
            if (isWorking) escaladosHoje++;
        });

        // --- PREPARAÇÃO DA TABELA DETALHADA (PRESENÇA DO DIA) ---
        const records = frequencia.filter(r => r.Data === targetDate);
        
        // Ordenar por nome
        records.sort((a, b) => {
            const fa = allFuncs.find(f => f.ID === a.FuncionarioID);
            const fb = allFuncs.find(f => f.ID === b.FuncionarioID);
            const na = fa ? fa.Nome : (a.FuncionarioNome || '');
            const nb = fb ? fb.Nome : (b.FuncionarioNome || '');
            return na.localeCompare(nb);
        });

        const tableRows = records.map(r => {
            const f = allFuncs.find(func => func.ID === r.FuncionarioID) || {};
            
            let atraso = '-';
            let extra = '-';
            
            // Cálculo de Atraso (Considerando 08:00 como padrão se não for turno)
            if (r.Entrada && f.Turno !== 'Regime de Turno') {
                const [h, m] = String(r.Entrada).split(':').map(Number);
                const entryMins = h * 60 + m;
                const limitMins = 8 * 60 + 15; // 08:15 tolerância
                if (entryMins > limitMins) {
                    const diff = entryMins - (8 * 60); // Calcula atraso base 08:00
                    const hh = Math.floor(diff / 60);
                    const mm = diff % 60;
                    atraso = `${hh}h${mm}m`;
                }
            } else if (r.Status === 'Atraso') {
                atraso = 'Sim';
            }

            // Cálculo de Hora Extra
            if (r.Entrada && r.Saida) {
                const [h1, m1] = String(r.Entrada).split(':').map(Number);
                const [h2, m2] = String(r.Saida).split(':').map(Number);
                let diff = (h2 * 60 + m2) - (h1 * 60 + m1);
                if (diff < 0) diff += 24 * 60;
                
                const hoursWorked = diff / 60;
                const standard = f.Turno === 'Regime de Turno' ? 24 : 8;
                
                if (hoursWorked > standard) {
                    const extraMins = Math.round((hoursWorked - standard) * 60);
                    const hh = Math.floor(extraMins / 60);
                    const mm = extraMins % 60;
                    extra = `${hh}h${mm}m`;
                }
            }

            return `
                <tr>
                    <td class="border p-2">${f.Nome || r.FuncionarioNome || 'Desconhecido'}</td>
                    <td class="border p-2">${f.Cargo || '-'}</td>
                    <td class="border p-2">${f.Departamento || '-'}</td>
                    <td class="border p-2 text-center">${r.Entrada || '--:--'} / ${r.Saida || '--:--'}</td>
                    <td class="border p-2 text-center ${atraso !== '-' ? 'text-red-600 font-bold' : ''}">${atraso}</td>
                    <td class="border p-2 text-center ${extra !== '-' ? 'text-green-600 font-bold' : ''}">${extra}</td>
                    <td class="border p-2 text-center">${r.Status || '-'}</td>
                </tr>
            `;
        }).join('');

        const html = `
            <div class="p-8 font-sans text-gray-900 bg-white">
                ${RHModule.buildPDFHeader(inst, 'VISÃO GERAL', 'Data: ' + new Date(targetDate + 'T00:00:00').toLocaleDateString('pt-BR') + (targetTurno ? ' (' + targetTurno + ')' : ''))}

                <div class="grid grid-cols-2 gap-4 mb-8">
                    <div class="p-4 bg-gray-50 border rounded">
                        <h3 class="font-bold text-gray-700 mb-2 border-b pb-1">Efetivo</h3>
                        <div class="flex justify-between mb-1"><span>Total Equipe:</span> <strong>${totalAtivos}</strong></div>
                        <div class="flex justify-between"><span>Escalados Hoje:</span> <strong>${escaladosHoje}</strong></div>
                    </div>
                    <div class="p-4 bg-gray-50 border rounded">
                        <h3 class="font-bold text-gray-700 mb-2 border-b pb-1">Ausências</h3>
                        <div class="flex justify-between mb-1"><span>Faltas:</span> <strong class="text-red-600">${faltasHoje}</strong></div>
                        <div class="flex justify-between"><span>Em Férias:</span> <strong class="text-purple-600">${emFeriasHoje}</strong></div>
                    </div>
                </div>

                <div class="mb-8">
                    <h3 class="font-bold text-gray-800 mb-4 border-b pb-2">Presença do Dia</h3>
                    <div class="flex justify-around text-center">
                        <div class="p-4 border rounded w-1/3 mx-2 bg-green-50">
                            <div class="text-3xl font-bold text-green-600">${presentesHoje}</div>
                            <div class="text-xs uppercase font-bold text-green-800">Presentes</div>
                        </div>
                        <div class="p-4 border rounded w-1/3 mx-2 bg-yellow-50">
                            <div class="text-3xl font-bold text-yellow-600">${atrasosHoje}</div>
                            <div class="text-xs uppercase font-bold text-yellow-800">Atrasos</div>
                        </div>
                    </div>
                </div>

                <div class="mt-8">
                    <h3 class="font-bold text-gray-800 mb-4 border-b pb-2">Detalhamento de Presença</h3>
                    <table class="w-full text-sm border-collapse border border-gray-300">
                        <thead class="bg-gray-100">
                            <tr>
                                <th class="border p-2 text-left">Funcionário</th>
                                <th class="border p-2 text-left">Cargo</th>
                                <th class="border p-2 text-left">Departamento</th>
                                <th class="border p-2 text-center">Entrada/Saída</th>
                                <th class="border p-2 text-center">Atraso</th>
                                <th class="border p-2 text-center">H. Extra</th>
                                <th class="border p-2 text-center">Status/Falta</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${tableRows || '<tr><td colspan="7" class="border p-4 text-center text-gray-500">Nenhum registro encontrado para esta data.</td></tr>'}
                        </tbody>
                    </table>
                </div>

                <div class="mt-12 text-center text-xs text-gray-400 border-t pt-2">
                    &copy; 2026 Delícia da Cidade. Todos os direitos reservados. | Gerado por ${user.Nome || 'Sistema'}
                </div>
            </div>
        `;

        Utils.printNative(html, 'landscape');
    },

    // --- 1. ABA FUNCIONÁRIOS ---
    renderFuncionarios: () => {
        RHModule.highlightTab('tab-funcionarios');
        
        let displayData = [];
        let totalRows = 0;
        const { currentPage, rowsPerPage } = RHModule.state.pagination;

        const ferias = RHModule.state.cache.ferias || [];
        const canCreate = Utils.checkPermission('RH', 'criar');
        const canEdit = Utils.checkPermission('RH', 'editar');
        const canDelete = Utils.checkPermission('RH', 'excluir');

        // MODO 1: Filtro de Férias Vencidas (Client-Side com lista leve)
        if (RHModule.state.filterVencidas) {
            const hoje = new Date();
            // Filtra na lista completa (leve)
            let filtered = RHModule.state.cache.allFuncionarios.filter(f => {
                if (!f.Admissao) return false;
                const adm = new Date(f.Admissao);
                const diffTime = Math.abs(hoje - adm);
                const diffYears = diffTime / (1000 * 60 * 60 * 24 * 365.25);
                const direito = Math.floor(diffYears) * 22; // Base: 22 dias úteis
                
                const taken = ferias
                    .filter(r => r.FuncionarioID === f.ID && r.Status === 'Aprovado')
                    .reduce((acc, r) => acc + (Number(r.Dias) || 0), 0);
                
                return (direito - taken) > 22;
            });

            // Aplica filtro de texto também se houver
            if (RHModule.state.filterTerm) {
                const term = RHModule.state.filterTerm.toLowerCase();
                filtered = filtered.filter(f => f.Nome.toLowerCase().includes(term));
            }

            totalRows = filtered.length;
            const startIndex = (currentPage - 1) * rowsPerPage;
            displayData = filtered.slice(startIndex, startIndex + rowsPerPage);
        } 
        // MODO 2: Paginação no Servidor (Padrão)
        else {
            displayData = RHModule.state.cache.funcionarios || [];
            totalRows = RHModule.state.pagination.totalRows || 0;
        }

        const totalPages = Math.ceil(totalRows / rowsPerPage) || 1;
        const startIndex = (currentPage - 1) * rowsPerPage;
        const endIndex = startIndex + displayData.length;

        // Gera o HTML da tabela separadamente
        const tableHTML = `
            <div class="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden" id="rh-table-container">
                <div class="overflow-x-auto">
                    <table class="w-full text-left border-collapse" data-total-rows="${totalRows}">
                        <thead class="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th scope="col" class="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">ID</th>
                                <th scope="col" class="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Colaborador</th>
                                <th scope="col" class="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Cargo / Depto</th>
                                <th scope="col" class="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Salário Base</th>
                                <th scope="col" class="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Contato</th>
                                <th scope="col" class="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status Férias</th>
                                <th scope="col" class="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-200 bg-white">
                        ${displayData.map(f => {
                            // Cálculo de Saldo de Férias
                            let saldo = '-';
                            let badgeClass = 'bg-gray-100 text-gray-600';
                            let statusText = 'Regular';
                            
                            if (f.Admissao) {
                                const adm = new Date(f.Admissao);
                                const hoje = new Date();
                                const diffTime = Math.abs(hoje - adm);
                                const diffYears = diffTime / (1000 * 60 * 60 * 24 * 365.25); 
                                const direito = Math.floor(diffYears) * 22; // Base: 22 dias úteis
                                
                                const taken = ferias
                                    .filter(r => r.FuncionarioID === f.ID && r.Status === 'Aprovado')
                                    .reduce((acc, r) => acc + (Number(r.Dias) || 0), 0);
                                    
                                const valSaldo = direito - taken;
                                
                                // Se houver saldo manual cadastrado, usa ele. Senão, usa o calculado.
                                if (f.SaldoFerias !== null && f.SaldoFerias !== undefined && f.SaldoFerias !== '') {
                                    saldo = f.SaldoFerias;
                                } else {
                                    saldo = valSaldo;
                                }
                                
                                if (valSaldo > 22) {
                                    badgeClass = 'bg-red-100 text-red-700';
                                    statusText = 'Vencidas';
                                } else if (valSaldo > 0) {
                                    badgeClass = 'bg-green-100 text-green-700';
                                    statusText = 'Disponível';
                                }
                            }

                            return `
                            <tr class="group hover:bg-gray-50 transition-colors duration-150">
                                <td class="px-6 py-4 whitespace-nowrap">
                                    <span class="font-mono text-xs text-gray-400">${f.ID.length > 10 ? '...' + f.ID.slice(-4) : f.ID}</span>
                                    <span class="font-mono text-sm font-bold text-gray-700">${f.Codigo || '-'}</span>
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap">
                                    <div class="flex items-center">
                                        <div class="h-9 w-9 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-xs font-bold overflow-hidden border border-gray-300">
                                            <img src="${f.FotoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(f.Nome)}&background=random&color=fff&size=128`}" class="h-full w-full object-cover">
                                        </div>
                                        <div class="ml-4">
                                            <div class="text-sm font-medium text-gray-900">${f.Nome}</div>
                                            <div class="text-xs text-gray-500">Admissão: ${Utils.formatDate(f.Admissao)}</div>
                                        </div>
                                    </div>
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap">
                                    <div class="text-sm text-gray-900">${f.Cargo}</div>
                                    <div class="text-xs text-gray-500">${f.Departamento || 'Geral'}</div>
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-700">
                                    ${Utils.formatCurrency(f.Salario)}
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    <div>${f.Telefone || '-'}</div>
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap">
                                    <span class="px-2.5 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${badgeClass}">
                                        ${saldo} dias (${statusText})
                                    </span>
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <div class="flex justify-end gap-3 opacity-60 group-hover:opacity-100 transition-opacity">
                                        <button onclick="RHModule.printFuncionarioProfile('${f.ID}')" class="text-gray-400 hover:text-gray-600 transition-colors" title="Perfil">
                                            <i class="fas fa-id-card"></i>
                                        </button>
                                        <button onclick="RHModule.modalEscala('${f.ID}')" class="text-gray-400 hover:text-purple-600 transition-colors" title="Escala">
                                            <i class="fas fa-calendar-alt"></i>
                                        </button>
                                        ${canEdit ? `<button onclick="RHModule.modalFuncionario('${f.ID}')" class="text-gray-400 hover:text-blue-600 transition-colors" title="Editar">
                                            <i class="fas fa-pen"></i>
                                        </button>` : ''}
                                        ${canDelete ? `<button onclick="RHModule.delete('Funcionarios', '${f.ID}')" class="text-gray-400 hover:text-red-600 transition-colors" title="Excluir">
                                            <i class="fas fa-trash"></i>
                                        </button>` : ''}
                                    </div>
                                </td>
                            </tr>
                        `}).join('')}
                    </tbody>
                </table>
                </div>
                
                <!-- Footer da Tabela / Paginação -->
                <div class="bg-gray-50 px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                    <span class="text-sm text-gray-500">
                        Mostrando <span class="font-medium">${Math.min(startIndex + 1, totalRows)}</span> a <span class="font-medium">${Math.min(endIndex, totalRows)}</span> de <span class="font-medium">${totalRows}</span> resultados
                    </span>
                    <div class="flex gap-1">
                        <button onclick="RHModule.changePage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''} class="px-3 py-1 border border-gray-300 rounded-md bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                            Anterior
                        </button>
                        <button onclick="RHModule.changePage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''} class="px-3 py-1 border border-gray-300 rounded-md bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                            Próxima
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Verifica se a tabela já existe para atualizar apenas ela (preservando o foco do input)
        const existingTable = document.getElementById('rh-table-container');
        if (existingTable) {
            existingTable.outerHTML = tableHTML;
        } else {
            // Se não existe, renderiza tudo (Header + Tabela)
            document.getElementById('tab-content').innerHTML = `
            <!-- Header da Seção -->
            <div class="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                <div>
                    <h3 class="text-2xl font-bold text-gray-900 tracking-tight">Gestão de Equipe</h3>
                    <p class="text-sm text-gray-500 mt-1">Gerencie colaboradores, cargos e departamentos.</p>
                </div>
                
                <div class="flex flex-wrap items-center gap-3">
                    <!-- Busca Moderna -->
                    <div class="relative group">
                        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <i class="fas fa-search text-gray-400 group-focus-within:text-orange-500 transition-colors"></i>
                        </div>
                        <input type="text" 
                            class="bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent block w-64 pl-10 p-2.5 transition-all" 
                            placeholder="Buscar colaborador..." 
                            value="${RHModule.state.filterTerm}" 
                            oninput="RHModule.updateFilter(this.value)">
                    </div>

                    <!-- Filtro Toggle -->
                    <label class="flex items-center gap-2 text-sm cursor-pointer bg-white px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors select-none">
                        <input type="checkbox" class="rounded text-orange-600 focus:ring-orange-500 border-gray-300" ${RHModule.state.filterVencidas ? 'checked' : ''} onchange="RHModule.toggleVencidas(this.checked)">
                        <span class="text-gray-600 font-medium">Férias Vencidas</span>
                    </label>

                    <!-- Botões Secundários -->
                    <div class="flex items-center border-l border-gray-300 pl-3 gap-2">
                        <button onclick="RHModule.printTabPDF('funcionarios')" class="text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 hover:text-gray-800 font-medium rounded-lg text-sm px-4 py-2.5 text-center inline-flex items-center transition-all">
                            <i class="fas fa-file-export mr-2"></i> Exportar
                        </button>
                        <button onclick="RHModule.printEscalaGeral()" class="text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 hover:text-gray-800 font-medium rounded-lg text-sm px-4 py-2.5 text-center inline-flex items-center transition-all">
                            <i class="fas fa-calendar-alt mr-2"></i> Escala
                        </button>
                    </div>

                    <!-- Botão Primário -->
                    ${canCreate ? `<button onclick="RHModule.modalFuncionario()" class="text-white bg-orange-600 hover:bg-orange-700 focus:ring-4 focus:ring-orange-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center inline-flex items-center shadow-md transition-all transform hover:-translate-y-0.5">
                        <i class="fas fa-plus mr-2"></i> Novo Colaborador
                    </button>` : ''}
                </div>
            </div>
            ${tableHTML}
            `;
        }
    },

    updateFilter: (term) => {
        RHModule.state.filterTerm = term;
        RHModule.state.pagination.currentPage = 1; // Reseta para a primeira página ao filtrar
        
        // Debounce para não chamar API a cada tecla
        if (RHModule.filterTimeout) clearTimeout(RHModule.filterTimeout);
        RHModule.filterTimeout = setTimeout(() => {
            RHModule.loadEmployees();
        }, 500);
    },

    toggleVencidas: (checked) => {
        RHModule.state.filterVencidas = checked;
        RHModule.state.pagination.currentPage = 1;
        RHModule.renderFuncionarios();
    },

    changePage: (page) => {
        // Validação básica feita no botão, mas reforçada aqui
        if (page < 1) return;

        RHModule.state.pagination.currentPage = page;
        RHModule.loadEmployees();
    },

    // --- MÁSCARAS DE INPUT ---
    maskPhone: (el) => {
        let v = el.value.replace(/\D/g, ""); // Remove tudo que não é dígito
        if (v.startsWith("244")) v = v.substring(3); // Remove prefixo se já existir para evitar duplicação
        if (v.length > 9) v = v.substring(0, 9); // Limita a 9 dígitos locais
        
        // Formata: 9XX XXX XXX
        if (v.length > 6) v = v.replace(/^(\d{3})(\d{3})(\d{0,3})/, "$1 $2 $3");
        else if (v.length > 3) v = v.replace(/^(\d{3})(\d{0,3})/, "$1 $2");
        
        el.value = "+244 " + v;
    },

    maskCurrency: (el) => {
        let v = el.value.replace(/\D/g, "");
        v = (Number(v) / 100).toFixed(2) + ""; // Divide por 100 para centavos
        v = v.replace(".", ",");
        v = v.replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1."); // Milhares
        el.value = "Kz " + v;
    },

    modalFuncionario: async (id = null) => {
        let f = {};
        if (id) {
            // Busca dados completos do servidor para edição segura (incluindo FotoURL que não vem na lista leve)
            try {
                f = await Utils.api('getEmployee', null, { id });
            } catch (e) {
                Utils.toast('Erro ao carregar detalhes do funcionário.', 'error');
                return;
            }
        }

        const tiposContrato = RHModule.state.cache.parametros.filter(p => p.Tipo === 'TipoContrato');
        const cargosList = RHModule.state.cache.cargos || [];
        
        // Lógica de Departamento Automático
        const updateDept = (select) => {
            const cargoNome = select.value;
            const cargos = RHModule.state.cache.cargos || [];
            const deptos = RHModule.state.cache.departamentos || [];
            
            const cargo = cargos.find(c => c.Nome === cargoNome);
            let deptNome = 'Outros';

            if (cargo && cargo.DepartamentoID) {
                const dept = deptos.find(d => d.ID === cargo.DepartamentoID);
                if (dept) deptNome = dept.Nome;
            } else {
                // Fallback (Mapa antigo caso o banco esteja vazio)
                const map = { 'Gerente Geral': 'Administração', 'Cozinheiro': 'Cozinha', 'Garçon': 'Salão', 'Limpeza': 'Serviços Gerais' };
                deptNome = map[cargoNome] || 'Outros';
            }
            
            const deptInput = document.getElementById('input-dept');
            if(deptInput) deptInput.value = deptNome;
        };

        // Gera opções de cargo (Do banco ou Padrão)
        const optionsCargos = cargosList.length > 0
            ? cargosList.map(c => `<option ${f.Cargo===c.Nome?'selected':''}>${c.Nome}</option>`).join('')
            : ['Gerente Geral','Gestor','Supervisor','Cozinheiro Chefe','Cozinheiro','Auxiliar de Cozinha','Garçon','Recepcionista','Auxiliar administrativo','Limpeza','Auxiliar de limpeza','Segurança'].map(c => `<option ${f.Cargo===c?'selected':''}>${c}</option>`).join('');

        Utils.openModal(id ? 'Editar' : 'Novo Funcionário', `
            <form onsubmit="RHModule.save(event, 'Funcionarios')">
                <input type="hidden" name="ID" value="${f.ID || ''}" id="func-id">
                
                <!-- WIZARD STEPPER -->
                <div class="flex items-center justify-between mb-8 px-4">
                    <div class="flex flex-col items-center cursor-pointer" onclick="RHModule.setWizardStep(1)">
                        <div id="step-indicator-1" class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold bg-orange-600 text-white transition-colors">1</div>
                        <span class="text-xs mt-1 font-medium text-gray-700">Pessoal</span>
                    </div>
                    <div class="flex-1 h-1 bg-gray-200 mx-2 rounded"><div id="progress-1" class="h-full bg-orange-600 rounded w-full transition-all duration-500"></div></div>
                    
                    <div class="flex flex-col items-center cursor-pointer" onclick="RHModule.setWizardStep(2)">
                        <div id="step-indicator-2" class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold bg-gray-200 text-gray-500 transition-colors">2</div>
                        <span class="text-xs mt-1 font-medium text-gray-500">Contrato</span>
                    </div>
                    <div class="flex-1 h-1 bg-gray-200 mx-2 rounded"><div id="progress-2" class="h-full bg-orange-600 rounded w-0 transition-all duration-500"></div></div>
                    
                    <div class="flex flex-col items-center cursor-pointer" onclick="RHModule.setWizardStep(3)">
                        <div id="step-indicator-3" class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold bg-gray-200 text-gray-500 transition-colors">3</div>
                        <span class="text-xs mt-1 font-medium text-gray-500">Financeiro</span>
                    </div>
                </div>

                <!-- STEP 1: DADOS PESSOAIS -->
                <div id="step-content-1" class="wizard-step space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Nome Completo</label>
                        <input name="Nome" value="${f.Nome || ''}" class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-orange-500 focus:border-orange-500 block w-full p-2.5" required>
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Data de Nascimento</label>
                            <input type="date" name="Nascimento" value="${f.Nascimento || ''}" class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-orange-500 focus:border-orange-500 block w-full p-2.5">
                        </div>
                        <div class="grid grid-cols-2 gap-2">
                            <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">BI / Identidade</label>
                            <input name="BI" value="${f.BI || ''}" placeholder="000123LA012" class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-orange-500 focus:border-orange-500 block w-full p-2.5">
                            </div>
                            <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Validade BI</label>
                            <input type="date" name="ValidadeBI" value="${f.ValidadeBI || ''}" class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-orange-500 focus:border-orange-500 block w-full p-2.5">
                            </div>
                        </div>
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
                            <input name="Telefone" value="${f.Telefone || '+244 '}" oninput="RHModule.maskPhone(this)" class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-orange-500 focus:border-orange-500 block w-full p-2.5" placeholder="+244 9XX XXX XXX">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
                            <input type="email" name="Email" value="${f.Email || ''}" placeholder="nome@exemplo.com" class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-orange-500 focus:border-orange-500 block w-full p-2.5">
                        </div>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Foto do Perfil</label>
                        <div class="flex gap-2 items-center">
                            <input type="file" id="foto-file" accept="image/*" class="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100">
                            <span class="text-xs text-gray-400">OU</span>
                            <input name="FotoURL" value="${f.FotoURL || ''}" placeholder="Cole uma URL..." class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-orange-500 focus:border-orange-500 block w-1/3 p-2.5">
                        </div>
                    </div>
                </div>

                <!-- STEP 2: CONTRATO & CARGO -->
                <div id="step-content-2" class="wizard-step hidden space-y-4">
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Cargo</label>
                            <select name="Cargo" class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-orange-500 focus:border-orange-500 block w-full p-2.5" onchange="(${updateDept})(this)" required>
                                <option value="">Selecione...</option>
                                ${optionsCargos}
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Departamento</label>
                            <input id="input-dept" name="Departamento" value="${f.Departamento || ''}" class="bg-gray-100 border border-gray-300 text-gray-500 text-sm rounded-lg block w-full p-2.5 cursor-not-allowed" readonly>
                        </div>
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Salário Base (Kz)</label>
                            <input name="Salario" type="text" value="${f.Salario ? Utils.formatCurrency(f.Salario) : ''}" oninput="RHModule.maskCurrency(this)" class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-orange-500 focus:border-orange-500 block w-full p-2.5" required placeholder="Kz 0,00">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Data de Admissão</label>
                            <input type="date" name="Admissao" value="${f.Admissao || ''}" class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-orange-500 focus:border-orange-500 block w-full p-2.5">
                        </div>
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Tipo de Contrato</label>
                            <select name="TipoContrato" class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-orange-500 focus:border-orange-500 block w-full p-2.5">
                                ${tiposContrato.length 
                                    ? tiposContrato.map(t => `<option ${f.TipoContrato===t.Valor?'selected':''}>${t.Valor}</option>`).join('')
                                    : '<option>CLT</option><option>Temporário</option><option>Estagiário</option>'}
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Regime de Turno</label>
                            <select name="Turno" class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-orange-500 focus:border-orange-500 block w-full p-2.5">
                                <option ${f.Turno==='Diarista'?'selected':''}>Diarista</option>
                                <option ${f.Turno==='Regime de Turno'?'selected':''}>Regime de Turno</option>
                            </select>
                        </div>
                    </div>
                </div>

                <!-- STEP 3: FINANCEIRO & STATUS -->
                <div id="step-content-3" class="wizard-step hidden space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">IBAN</label>
                        <input name="Iban" value="${f.Iban || 'AO06 '}" placeholder="AO06..." class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-orange-500 focus:border-orange-500 block w-full p-2.5">
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Status</label>
                            <select name="Status" class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-orange-500 focus:border-orange-500 block w-full p-2.5">
                                <option ${f.Status==='Ativo'?'selected':''}>Ativo</option>
                                <option ${f.Status==='Afastado'?'selected':''}>Afastado</option>
                                <option ${f.Status==='Demitido'?'selected':''}>Demitido</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Saldo Férias (Manual)</label>
                            <input type="number" name="SaldoFerias" value="${f.SaldoFerias || ''}" placeholder="Auto" class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-orange-500 focus:border-orange-500 block w-full p-2.5">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Banco de Horas (Saldo)</label>
                            <input type="number" step="0.01" name="BancoHoras" value="${f.BancoHoras || '0'}" placeholder="Horas acumuladas" class="bg-blue-50 border border-blue-300 text-blue-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 font-bold">
                        </div>
                    </div>
                </div>

                <!-- FOOTER NAVIGATION -->
                <div class="flex justify-between mt-8 pt-4 border-t border-gray-100">
                    <button type="button" id="btn-prev" onclick="RHModule.setWizardStep(currentStep - 1)" class="hidden px-5 py-2.5 text-sm font-medium text-gray-900 bg-white rounded-lg border border-gray-200 hover:bg-gray-100 hover:text-blue-700 focus:z-10 focus:ring-2 focus:ring-blue-700 focus:text-blue-700">
                        <i class="fas fa-arrow-left mr-2"></i> Anterior
                    </button>
                    <div class="flex-1"></div> <!-- Spacer -->
                    <button type="button" id="btn-next" onclick="RHModule.setWizardStep(currentStep + 1)" class="text-white bg-orange-600 hover:bg-orange-700 focus:ring-4 focus:ring-orange-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center">
                        Próximo <i class="fas fa-arrow-right ml-2"></i>
                    </button>
                    <button type="submit" id="btn-save" class="hidden text-white bg-green-600 hover:bg-green-700 focus:ring-4 focus:ring-green-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center">
                        <i class="fas fa-check mr-2"></i> Salvar Colaborador
                    </button>
                </div>
            </form>
            <script>
                var currentStep = 1;
            </script>
        `);
    },

    setWizardStep: (step) => {
        if (step < 1 || step > 3) return;
        
        // --- VALIDAÇÃO ANTES DE AVANÇAR ---
        let currentVisible = 1;
        for(let i=1; i<=3; i++) {
            const el = document.getElementById(`step-content-${i}`);
            if (el && !el.classList.contains('hidden')) {
                currentVisible = i;
                break;
            }
        }

        // Se estiver avançando (step > currentVisible), valida os campos do passo atual
        if (step > currentVisible) {
            const container = document.getElementById(`step-content-${currentVisible}`);
            if (container) {
                const requireds = container.querySelectorAll('[required]');
                let invalid = false;
                requireds.forEach(el => {
                    if (!el.value || el.value.trim() === '') {
                        invalid = true;
                        el.classList.add('border-red-500', 'ring-1', 'ring-red-500');
                        el.addEventListener('input', function() {
                            this.classList.remove('border-red-500', 'ring-1', 'ring-red-500');
                        }, {once: true});
                    }
                });
                if (invalid) return Utils.toast('⚠️ Preencha os campos obrigatórios para continuar.', 'warning');
            }
        }

        // Atualiza variável global do script injetado
        // Nota: Como o script roda no escopo global após injeção, precisamos acessar a variável ou passar o estado.
        // Uma abordagem melhor é controlar o estado visualmente aqui.
        const form = document.querySelector('#modal-body form');
        if(!form) return;
        
        // Esconde todos os passos
        document.querySelectorAll('.wizard-step').forEach(el => el.classList.add('hidden'));
        // Mostra o passo atual
        document.getElementById(`step-content-${step}`).classList.remove('hidden');
        
        // Atualiza Stepper (Bolinhas e Barras)
        for(let i=1; i<=3; i++) {
            const indicator = document.getElementById(`step-indicator-${i}`);
            const progress = document.getElementById(`progress-${i-1}`); // Barra anterior
            
            if (i <= step) {
                indicator.classList.remove('bg-gray-200', 'text-gray-500');
                indicator.classList.add('bg-orange-600', 'text-white');
                if(progress) progress.classList.replace('w-0', 'w-full');
            } else {
                indicator.classList.remove('bg-orange-600', 'text-white');
                indicator.classList.add('bg-gray-200', 'text-gray-500');
                if(progress) progress.classList.replace('w-full', 'w-0');
            }
        }

        // Atualiza Botões
        const btnPrev = document.getElementById('btn-prev');
        const btnNext = document.getElementById('btn-next');
        const btnSave = document.getElementById('btn-save');

        if (step === 1) btnPrev.classList.add('hidden');
        else btnPrev.classList.remove('hidden');

        if (step === 3) {
            btnNext.classList.add('hidden');
            btnSave.classList.remove('hidden');
        } else {
            btnNext.classList.remove('hidden');
            btnSave.classList.add('hidden');
        }
        
        // Atualiza variável de controle para os botões inline onclick
        // Hack: Atualiza a variável global criada dentro do modal
        try { window.currentStep = step; } catch(e){}
    },

    modalEscala: async (id) => {
        // Garante que os assignments estão carregados
        if (Object.keys(RHModule.escalaState.assignments).length === 0) {
            await RHModule.escalaCarregarAssignments();
        }
        // Usa directamente o modal de configuração da Escala Mensal
        RHModule.escalaConfigurarFuncionario(id);
    },

    printEscalaGeral: async () => {
        // Garante que os assignments estão carregados
        if (Object.keys(RHModule.escalaState.assignments).length === 0) {
            await RHModule.escalaCarregarAssignments();
        }

        const funcs = RHModule.state.cache.allFuncionarios.filter(f => f.Status === 'Ativo').sort((a, b) => a.Nome.localeCompare(b.Nome));
        const assignments = RHModule.escalaState.assignments;
        const inst = RHModule.state.cache.instituicao[0] || {};
        const days = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
        const grupoCores = { A: '#7c3aed', B: '#059669', C: '#2563eb', diarista: '#ea580c' };

        const getTipoLabel = (funcId) => {
            const a = assignments[funcId];
            if (!a || !a.tipo) return { label: 'Não atribuído', color: '#9ca3af' };
            if (a.tipo === 'diarista') return { label: 'Diarista (8h)', color: grupoCores.diarista };
            return { label: `Grupo ${a.tipo} (24h/48h)`, color: grupoCores[a.tipo] };
        };

        // Calcula o padrão semanal de cada funcionário com base na lógica da Escala Mensal
        const getPatternSemanal = (funcId) => {
            const a = assignments[funcId];
            if (!a || !a.tipo) return days.map(() => ({ label: '—', style: 'color:#9ca3af;' }));

            if (a.tipo === 'diarista') {
                const diasSemana = ['—','Segunda','Terça','Quarta','Quinta','Sexta','Sábado','Domingo'];
                return days.map((_, i) => {
                    const diaNum = i + 1; // 1=Seg
                    const isWeekend = diaNum >= 6;
                    let trabalha = false;
                    if (isWeekend) {
                        trabalha = a.fdsAlterna !== false; // Alternado = pode trabalhar
                    } else {
                        trabalha = !(a.folgaFixa && a.folgaFixa === diaNum);
                    }
                    if (isWeekend && a.fdsAlterna === false) return { label: 'Folga', style: 'background:#f3f4f6;color:#9ca3af;' };
                    if (isWeekend && a.fdsAlterna !== false) return { label: 'Alternado', style: 'background:#fff7ed;color:#ea580c;font-weight:bold;' };
                    return trabalha
                        ? { label: '08:00 - 17:00', style: '' }
                        : { label: `Folga${a.folgaFixa ? ' ('+diasSemana[a.folgaFixa]+')' : ''}`, style: 'background:#f3f4f6;color:#9ca3af;' };
                });
            } else {
                // Grupos A/B/C — regime 24h seguido de 48h de folga (rotação)
                return days.map(() => ({ label: `Turno 24h\n(Grupo ${a.tipo})`, style: `background:#eff6ff;color:#1e40af;font-weight:bold;` }));
            }
        };

        let rows = '';
        funcs.forEach(f => {
            const { label: tipoLabel, color } = getTipoLabel(f.ID);
            const pattern = getPatternSemanal(f.ID);
            rows += `<tr>
                <td class="border p-2 font-bold">${f.Nome}</td>
                <td class="border p-2 text-xs text-gray-600">${f.Cargo || '-'}</td>
                <td class="border p-2 text-xs font-bold text-center" style="color:${color};">${tipoLabel}</td>
                ${pattern.map(p => `<td class="border p-1 text-center text-xs" style="${p.style}">${p.label}</td>`).join('')}
            </tr>`;
        });

        const html = `
            <div class="p-8 font-sans text-gray-900 bg-white">
                ${RHModule.buildPDFHeader(inst, 'ESCALA DE TRABALHO', '')}
                <table class="w-full text-sm border-collapse border border-gray-300">
                    <thead>
                        <tr class="bg-gray-100">
                            <th class="border p-2 text-left">Funcionário</th>
                            <th class="border p-2 text-left">Cargo</th>
                            <th class="border p-2 text-center">Regime</th>
                            ${days.map(d => `<th class="border p-2 text-center w-24">${d}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
                <div class="mt-4 flex gap-6 text-xs text-gray-500 border-t pt-3">
                    <span><span style="color:#ea580c;font-weight:bold;">■</span> Diarista (8h/dia, Seg-Sex)</span>
                    <span><span style="color:#7c3aed;font-weight:bold;">■</span> Grupo A · <span style="color:#059669;font-weight:bold;">■</span> Grupo B · <span style="color:#2563eb;font-weight:bold;">■</span> Grupo C (24h/48h folga)</span>
                </div>
                <div class="mt-4 text-center text-xs text-gray-400">&copy; 2026 ${inst.NomeFantasia || ''}. Documento de uso interno.</div>
            </div>
        `;

        Utils.printNative(html, 'landscape');
    },

    shareEscalaGeral: async () => {
        // Garante que os assignments estão carregados
        if (Object.keys(RHModule.escalaState.assignments).length === 0) {
            await RHModule.escalaCarregarAssignments();
        }

        const funcs = RHModule.state.cache.allFuncionarios.filter(f => f.Status === 'Ativo').sort((a, b) => a.Nome.localeCompare(b.Nome));
        const assignments = RHModule.escalaState.assignments;
        const days = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

        let msg = `*📅 ESCALA DE TRABALHO*\n_Delícia da Cidade_\n\n`;

        const diaristas = funcs.filter(f => assignments[f.ID] && assignments[f.ID].tipo === 'diarista');
        const grupoA = funcs.filter(f => assignments[f.ID] && assignments[f.ID].tipo === 'A');
        const grupoB = funcs.filter(f => assignments[f.ID] && assignments[f.ID].tipo === 'B');
        const grupoC = funcs.filter(f => assignments[f.ID] && assignments[f.ID].tipo === 'C');
        const naoAtrib = funcs.filter(f => !assignments[f.ID] || !assignments[f.ID].tipo);

        if (diaristas.length) msg += `*☀ DIARISTAS (8h Seg-Sex)*\n${diaristas.map(f => `• ${f.Nome}`).join('\n')}\n\n`;
        if (grupoA.length) msg += `*🟣 GRUPO A (24h/48h folga)*\n${grupoA.map(f => `• ${f.Nome}`).join('\n')}\n\n`;
        if (grupoB.length) msg += `*🟢 GRUPO B (24h/48h folga)*\n${grupoB.map(f => `• ${f.Nome}`).join('\n')}\n\n`;
        if (grupoC.length) msg += `*🔵 GRUPO C (24h/48h folga)*\n${grupoC.map(f => `• ${f.Nome}`).join('\n')}\n\n`;
        if (naoAtrib.length) msg += `*⚠ SEM REGIME ATRIBUÍDO*\n${naoAtrib.map(f => `• ${f.Nome}`).join('\n')}\n\n`;

        msg += `_Gerado em ${new Date().toLocaleDateString()}_`;

        const encodedMsg = encodeURIComponent(msg);

        Utils.openModal('Compartilhar Escala', `
            <div class="text-center">
                <i class="fab fa-whatsapp text-4xl text-green-500 mb-4"></i>
                <p class="text-gray-600 mb-6">A escala foi convertida para texto. Envie para o grupo da empresa.</p>
                
                <a href="https://wa.me/?text=${encodedMsg}" target="_blank" class="block w-full bg-green-500 text-white py-3 rounded font-bold hover:bg-green-600 flex items-center justify-center gap-2 transition mb-3 shadow">
                    Enviar para WhatsApp
                </a>
                
                <button onclick="navigator.clipboard.writeText(document.getElementById('msg-preview').innerText).then(() => Utils.toast('Texto copiado!'))" class="block w-full bg-gray-100 text-gray-700 py-3 rounded font-bold hover:bg-gray-200 flex items-center justify-center gap-2 transition">
                    <i class="fas fa-copy"></i> Copiar Texto
                </button>
                
                <div class="mt-4 text-left bg-gray-50 p-3 rounded border text-xs max-h-48 overflow-y-auto whitespace-pre-wrap font-mono text-gray-600" id="msg-preview">${msg}</div>
            </div>
        `);
    },

    printFuncionarioProfile: async (id) => {
        const f = await Utils.api('getEmployee', null, { id }); // Busca completa para perfil
        if (!f) return Utils.toast('Funcionário não encontrado.', 'error');

        // Carrega histórico financeiro se necessário
        if (!RHModule.state.cache.folha) {
             try {
                RHModule.state.cache.folha = await Utils.api('getAll', 'Folha');
            } catch (e) { RHModule.state.cache.folha = []; }
        }
        const historico = (RHModule.state.cache.folha || []).filter(r => r.FuncionarioID === id).sort((a,b) => a.Periodo.localeCompare(b.Periodo)).slice(-12);

        const inst = RHModule.state.cache.instituicao[0] || {};
        const showLogo = inst.ExibirLogoRelatorios;

        let html = `
            <div class="font-sans text-gray-900">
                <!-- Cabeçalho -->
                ${RHModule.buildPDFHeader(inst, 'FICHA DE FUNCIONÁRIO', '')}

                <div class="flex gap-6 mb-8">
                    <div class="w-32 h-32 bg-gray-200 border border-gray-300 flex items-center justify-center rounded overflow-hidden">
                        <img src="${f.FotoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(f.Nome)}&background=random&color=fff&size=256`}" class="w-full h-full object-cover">
                    </div>
                    <div class="flex-1">
                        <h3 class="text-2xl font-bold text-gray-800 mb-1">${f.Nome}</h3>
                        <p class="text-lg text-gray-600 mb-4">${f.Cargo} - ${f.Departamento || 'Geral'}</p>
                        <div class="grid grid-cols-2 gap-4 text-sm">
                            <div><span class="font-bold text-gray-700">ID:</span> ${f.ID}</div>
                            <div><span class="font-bold text-gray-700">Matrícula:</span> ${f.Codigo || f.ID.slice(0,8)}</div>
                            <div><span class="font-bold text-gray-700">Status:</span> <span class="px-2 py-0.5 rounded ${f.Status === 'Ativo' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'} text-xs font-bold">${f.Status}</span></div>
                            <div><span class="font-bold text-gray-700">Admissão:</span> ${Utils.formatDate(f.Admissao)}</div>
                            <div><span class="font-bold text-gray-700">Turno:</span> ${f.Turno || '-'}</div>
                        </div>
                    </div>
                </div>

                <div class="mb-6">
                    <h4 class="font-bold text-gray-800 border-b border-gray-300 mb-3 pb-1 uppercase text-sm">Informações Pessoais</h4>
                    <div class="grid grid-cols-3 gap-4 text-sm">
                        <div><span class="font-bold block text-gray-500 text-xs">Data de Nascimento</span>${Utils.formatDate(f.Nascimento)}</div>
                        <div><span class="font-bold block text-gray-500 text-xs">BI / Identidade</span>${f.BI || '-'}</div>
                        <div><span class="font-bold block text-gray-500 text-xs">Telefone</span>${f.Telefone || '-'}</div>
                        <div class="col-span-2"><span class="font-bold block text-gray-500 text-xs">Email</span>${f.Email || '-'}</div>
                    </div>
                </div>

                <div class="mb-6">
                    <h4 class="font-bold text-gray-800 border-b border-gray-300 mb-3 pb-1 uppercase text-sm">Evolução Salarial (Últimos 12 Meses)</h4>
                    <div class="h-48 w-full border border-gray-200 rounded p-2">
                        <canvas id="chart-profile-evolution"></canvas>
                    </div>
                </div>

                <div class="mb-6">
                    <h4 class="font-bold text-gray-800 border-b border-gray-300 mb-3 pb-1 uppercase text-sm">Dados Contratuais & Financeiros</h4>
                    <div class="grid grid-cols-3 gap-4 text-sm">
                        <div><span class="font-bold block text-gray-500 text-xs">Tipo de Contrato</span>${f.TipoContrato || '-'}</div>
                        <div><span class="font-bold block text-gray-500 text-xs">Salário Base</span>${Utils.formatCurrency(f.Salario)}</div>
                        <div><span class="font-bold block text-gray-500 text-xs">IBAN</span>${f.Iban || '-'}</div>
                        <div><span class="font-bold block text-gray-500 text-xs">Saldo de Férias</span>${f.SaldoFerias ? f.SaldoFerias + ' dias' : '-'}</div>
                    </div>
                </div>
            </div>
        `;
        
        // Script para renderizar o gráfico dentro do iframe de impressão
        let chartScript = '';
        if (historico.length > 0 && typeof Chart !== 'undefined') {
            const labels = JSON.stringify(historico.map(h => h.Periodo));
            const data = JSON.stringify(historico.map(h => h.SalarioLiquido));
            
            html += `
                <script>
                    new Chart(document.getElementById('chart-profile-evolution'), {
                        type: 'line',
                        data: {
                            labels: ${labels},
                            datasets: [{
                                label: 'Salário Líquido (Kz)',
                                data: ${data},
                                borderColor: '#10B981',
                                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                                borderWidth: 2,
                                fill: true,
                                tension: 0.3
                            }]
                        },
                        options: { animation: false, responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
                    });
                </script>
            `;
        }

        Utils.printNative(html, 'landscape');
    },

    // --- 2. ABA FREQUÊNCIA ---
    renderFrequencia: async () => {
        RHModule.highlightTab('tab-frequencia');
        
        if (!RHModule.state.cache.frequencia) {
            document.getElementById('tab-content').innerHTML = '<div class="text-center p-10"><i class="fas fa-spinner fa-spin text-4xl text-blue-600"></i><p class="mt-2">Carregando frequência...</p></div>';
            try {
                RHModule.state.cache.frequencia = await Utils.api('getAll', 'Frequencia');
            } catch (e) { 
                Utils.toast('Erro ao carregar dados.', 'error');
                document.getElementById('tab-content').innerHTML = '<div class="text-center p-10 text-red-500"><i class="fas fa-exclamation-circle text-4xl mb-2"></i><p>Erro ao carregar dados.</p><button onclick="RHModule.renderFrequencia()" class="mt-2 text-blue-600 underline font-bold">Tentar novamente</button></div>';
                return;
            }
        }

        let data = RHModule.state.cache.frequencia || [];
        const canCreate = Utils.checkPermission('RH', 'criar');
        const canEdit = Utils.checkPermission('RH', 'editar');
        const canDelete = Utils.checkPermission('RH', 'excluir');
        
        // Função auxiliar para calcular horas
        const calcHours = (start, end, is24h) => {
            if(!start || !end) return 0;
            const [h1, m1] = start.split(':').map(Number);
            const [h2, m2] = end.split(':').map(Number);
            let diff = (h2*60+m2) - (h1*60+m1);
            // Ajuste para virada de dia (Se sair no dia seguinte ou mesmo horário = 24h)
            if (diff <= 0) diff += 24 * 60; 
            // Lógica Inteligente para 24h: Se a diferença for positiva mas pequena (< 4h), assume dia seguinte
            else if (is24h && diff < 240) diff += 24 * 60;
            return diff / 60;
        };

        // Aplicar filtro de data
        const { filterFrequenciaStart, filterFrequenciaEnd, filterFrequenciaTurno } = RHModule.state;
        if (filterFrequenciaStart) {
            data = data.filter(r => r.Data >= filterFrequenciaStart);
        }
        if (filterFrequenciaEnd) {
            data = data.filter(r => r.Data <= filterFrequenciaEnd);
        }
        // Filtro de Turno
        if (filterFrequenciaTurno) {
            data = data.filter(r => {
                const func = RHModule.state.cache.allFuncionarios.find(f => f.ID === r.FuncionarioID);
                return func && func.Turno === filterFrequenciaTurno;
            });
        }

        document.getElementById('tab-content').innerHTML = `
            <div class="flex justify-between items-center mb-4">
                <div class="flex gap-2 items-center bg-gray-50 p-2 rounded border">
                    <label class="text-sm font-bold text-gray-600">Filtros:</label>
                    <select id="freq-turno" class="border p-1 rounded text-sm">
                        <option value="">Todos os Turnos</option>
                        <option value="Diarista" ${filterFrequenciaTurno === 'Diarista' ? 'selected' : ''}>Diarista</option>
                        <option value="Regime de Turno" ${filterFrequenciaTurno === 'Regime de Turno' ? 'selected' : ''}>Regime de Turno</option>
                    </select>
                    <span class="text-gray-400">|</span>
                    <label class="text-sm font-bold text-gray-600">Data:</label>
                    <input type="date" id="freq-start-date" class="border p-1 rounded text-sm" value="${filterFrequenciaStart || ''}">
                    <span class="text-gray-500">até</span>
                    <input type="date" id="freq-end-date" class="border p-1 rounded text-sm" value="${filterFrequenciaEnd || ''}">
                    <button onclick="RHModule.applyFrequenciaFilter()" class="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700" title="Aplicar Filtro"><i class="fas fa-filter"></i></button>
                    <button onclick="RHModule.clearFrequenciaFilter()" class="text-gray-500 px-2 text-sm hover:text-red-500" title="Limpar Filtro"><i class="fas fa-times"></i></button>
                </div>
                <div class="flex gap-2">
                    <button onclick="RHModule.printTabPDF('frequencia')" class="bg-red-600 text-white px-4 py-2 rounded shadow hover:bg-red-700"><i class="fas fa-file-pdf"></i> PDF</button>
                    ${canCreate ? `<button onclick="RHModule.modalFrequencia()" class="bg-blue-600 text-white px-4 py-2 rounded">+ Registrar Ponto</button>` : ''}
                </div>
            </div>
            <table class="w-full bg-white rounded shadow text-sm">
                <thead class="bg-gray-100">
                    <tr>
                        <th class="p-3 text-left">Data</th>
                        <th class="p-3 text-left">Funcionário</th>
                        <th class="p-3 text-center">Entrada</th>
                        <th class="p-3 text-center">Saída</th>
                        <th class="p-3 text-center">Horas Trab.</th>
                        <th class="p-3 text-center">Saldo Dia</th>
                        <th class="p-3 text-center">Status</th>
                        <th class="p-3 text-left">Observação</th>
                        <th class="p-3 text-center">Ações</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.map(r => {
                        // Busca funcionário para saber o turno
                        const func = RHModule.state.cache.allFuncionarios.find(f => f.ID === r.FuncionarioID);
                        const is24h = func && func.Turno === 'Regime de Turno';
                        const jornadaPadrao = is24h ? 24 : 8;

                        // Cálculo de Horas Trabalhadas
                        let horasTrab = 0;
                        let saldoDia = 0;
                        let saldoClass = 'text-gray-400';
                        let horasTexto = '-';
                        let saldoTexto = '-';

                        if (r.Entrada && r.Saida) {
                            horasTrab = calcHours(r.Entrada, r.Saida, is24h);
                            saldoDia = horasTrab - jornadaPadrao;
                            
                            const h = Math.floor(horasTrab);
                            const m = Math.round((horasTrab - h) * 60);
                            horasTexto = `${h}h ${m > 0 ? m + 'm' : ''}`;
                            
                            saldoTexto = saldoDia > 0 ? `+${saldoDia.toFixed(2)}h` : `${saldoDia.toFixed(2)}h`;
                            saldoClass = saldoDia >= 0 ? 'text-green-600 font-bold' : 'text-red-500 font-bold';
                        }
                        
                        // Lógica de Status (Prioridade: Manual > Calculado)
                        let status = r.Status || 'Presente';
                        let statusClass = 'bg-green-100 text-green-800';
                        
                        // Cores baseadas no status
                        if (status.includes('Falta') || status === 'Suspensão') statusClass = 'bg-red-100 text-red-800';
                        else if (status === 'Atraso' || status === 'Saída Antecipada') statusClass = 'bg-yellow-100 text-yellow-800';
                        else if (status === 'Licença' || status === 'Férias') statusClass = 'bg-blue-100 text-blue-800';
                        
                        // Se não tiver status manual mas não tiver horários, sugere Falta (visual apenas)
                        if (!r.Status && !r.Entrada && !r.Saida) {
                             status = 'Falta (Sem registro)';
                             statusClass = 'bg-red-50 text-red-500 border border-red-200';
                        }
                        
                        return `
                        <tr class="border-t">
                            <td class="p-3">${Utils.formatDate(r.Data)}</td>
                            <td class="p-3 font-medium">
                                ${r.FuncionarioNome}
                                <div class="text-xs text-gray-500">${func ? func.Turno : ''}</div>
                            </td>
                            <td class="p-3 text-center">${r.Entrada || '—'}</td>
                            <td class="p-3 text-center">${r.Saida || '—'}</td>
                            <td class="p-3 text-center font-mono text-xs">${horasTexto}</td>
                            <td class="p-3 text-center font-mono text-xs ${saldoClass}">${saldoTexto}</td>
                            <td class="p-3 text-center"><span class="px-2 py-1 rounded text-xs font-bold ${statusClass}">${status}</span></td>
                            <td class="p-3 text-sm text-gray-600">${r.Observacoes || '—'}</td>
                            <td class="p-3 text-center">
                                <button onclick="RHModule.printIndividualFrequency('${r.FuncionarioID}')" class="text-gray-600 hover:text-gray-900 mr-2" title="Imprimir Folha Mensal"><i class="fas fa-print"></i></button>
                                ${canEdit ? `<button onclick="RHModule.modalFrequencia('${r.ID}')" class="text-blue-500 mr-2"><i class="fas fa-edit"></i></button>` : ''}
                                ${canDelete ? `<button onclick="RHModule.delete('Frequencia', '${r.ID}')" class="text-red-500"><i class="fas fa-trash"></i></button>` : ''}
                            </td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
        `;
    },

    getEscaladosDoDia: (dateStr) => {
        const allFuncs = RHModule.state.cache.allFuncionarios || [];
        const es = RHModule.escalaState;
        const ativos = allFuncs.filter(f => f.Status === 'Ativo');

        // Se assignments ainda não carregou, devolve todos os activos (loading state)
        if (!es || !es.assignments || Object.keys(es.assignments).length === 0) {
            return ativos;
        }

        const dd = RHModule.getDayData(dateStr);
        const escaladosNomes = new Set();

        // Turnistas: membros do grupo que trabalha hoje
        (RHModule.escalaGetGrupos()[dd.grupoEfetivo] || []).forEach(n => escaladosNomes.add(n.trim().toUpperCase()));

        // Diaristas: apenas quem tem status "trabalho"
        dd.diaristas.filter(d => d.status === 'trabalho').forEach(d => escaladosNomes.add(d.nome.trim().toUpperCase()));

        // Se nenhum escalado calculado, significa dia sem ninguém (ex: feriado/folga geral)
        if (escaladosNomes.size === 0) return [];

        // Filtra allFuncionarios pelos nomes escalados
        return ativos.filter(f => {
            const nomeSistema = (f.Nome || '').trim().toUpperCase();
            return [...escaladosNomes].some(n => nomeSistema === n || nomeSistema.startsWith(n) || n.startsWith(nomeSistema));
        });
    },

    atualizarDropdownEscalados: (dateStr, selectedId = '') => {
        const select = document.getElementById('freq-funcionario-select');
        const badge = document.getElementById('freq-escala-badge');
        if (!select) return;

        const escalados = RHModule.getEscaladosDoDia(dateStr);
        const es = RHModule.escalaState;
        const dd = RHModule.getDayData(dateStr);
        const grupoCores = { A: '#7c3aed', B: '#059669', C: '#2563eb' };

        select.innerHTML = `<option value="">Selecione o funcionário...</option>` +
            escalados.map(f => `<option value="${f.ID}" ${f.ID === selectedId ? 'selected' : ''}>${f.Nome}${f.Turno ? ' · ' + (f.Turno === 'Regime de Turno' ? '🔄 Turno' : '☀ Diarista') : ''}</option>`).join('');

        if (badge) {
            const cor = grupoCores[dd.grupoEfetivo] || '#ea580c';
            badge.innerHTML = `
                <span style="background:${cor}22; color:${cor}; border:1px solid ${cor}44; padding:3px 10px; border-radius:20px; font-size:11px; font-weight:700;">
                    🔄 Grupo ${dd.grupoEfetivo} em serviço
                </span>
                <span style="background:#ea580c22; color:#ea580c; border:1px solid #ea580c44; padding:3px 10px; border-radius:20px; font-size:11px; font-weight:700; margin-left:6px;">
                    ☀ ${dd.diaristas.filter(d => d.status === 'trabalho').length} diaristas
                </span>
                <span style="font-size:11px; color:#9ca3af; margin-left:8px;">${escalados.length} funcionário(s) escalado(s)</span>
            `;
        }
    },

    modalFrequencia: (id = null) => {
        const today = new Date().toISOString().split('T')[0];
        const record = id ? RHModule.state.cache.frequencia.find(r => r.ID === id) : {};
        const title = id ? 'Editar Frequência' : 'Registrar Ponto';
        const dataInicial = record.Data || today;

        // Função para calcular status em tempo real no modal
        window.calcStatusPresenca = () => {
            const entrada = document.querySelector('input[name="Entrada"]').value;
            const statusSelect = document.querySelector('select[name="Status"]');
            if (entrada) {
                if (entrada > "08:15") statusSelect.value = "Atraso";
                else statusSelect.value = "Presente";
            }
        };

        // Ao mudar a data, recarrega o dropdown com os escalados desse dia
        window.onFreqDataChange = (val) => {
            RHModule.atualizarDropdownEscalados(val);
        };

        Utils.openModal(title, `
            <form onsubmit="RHModule.save(event, 'Frequencia')">
                <input type="hidden" name="ID" value="${record.ID || ''}">

                <div class="mb-3">
                    <label class="text-xs font-bold text-gray-600 uppercase tracking-wide">📅 Data</label>
                    <input type="date" name="Data" id="freq-data-input" value="${dataInicial}"
                        class="border p-2 rounded w-full mt-1" required
                        onchange="onFreqDataChange(this.value)">
                </div>

                <div class="mb-1">
                    <label class="text-xs font-bold text-gray-600 uppercase tracking-wide">👤 Funcionário Escalado</label>
                    <div id="freq-escala-badge" class="mt-1 mb-2 flex flex-wrap items-center gap-1"></div>
                    <select id="freq-funcionario-select" name="FuncionarioID"
                        class="border p-2 rounded w-full"
                        onchange="document.querySelector('[name=FuncionarioNome]').value = this.options[this.selectedIndex].text.split(' · ')[0]"
                        required>
                        <option value="">A carregar escalados...</option>
                    </select>
                    <input type="hidden" name="FuncionarioNome" value="${record.FuncionarioNome || ''}">
                    <p class="text-xs text-gray-400 mt-1">⚡ Apenas funcionários escalados para esta data são apresentados.</p>
                </div>

                <div class="grid grid-cols-2 gap-4 mb-4 mt-4">
                    <div>
                        <label class="text-xs font-bold">Entrada (Limite 08:15)</label>
                        <div class="flex gap-1">
                            <input type="time" name="Entrada" value="${record.Entrada || ''}" class="border p-2 rounded w-full" onchange="calcStatusPresenca()">
                            <button type="button" onclick="RHModule.setCurrentTime('Entrada');calcStatusPresenca()" class="bg-gray-200 px-2 rounded hover:bg-gray-300" title="Agora"><i class="fas fa-clock"></i></button>
                        </div>
                    </div>
                    <div>
                        <label class="text-xs font-bold">Saída</label>
                        <div class="flex gap-1">
                            <input type="time" name="Saida" value="${record.Saida || ''}" class="border p-2 rounded w-full">
                            <button type="button" onclick="RHModule.setCurrentTime('Saida')" class="bg-gray-200 px-2 rounded hover:bg-gray-300" title="Agora"><i class="fas fa-clock"></i></button>
                        </div>
                    </div>
                </div>

                <div class="mb-4">
                    <label class="text-xs font-bold">Status (Calculado)</label>
                    <select name="Status" class="border p-2 rounded w-full bg-gray-50">
                        <option value="Presente" ${record.Status === 'Presente' ? 'selected' : ''}>Presente</option>
                        <option value="Atraso" ${record.Status === 'Atraso' ? 'selected' : ''}>Atraso</option>
                        <option value="Saída Antecipada" ${record.Status === 'Saída Antecipada' ? 'selected' : ''}>Saída Antecipada</option>
                        <option value="Falta" ${record.Status === 'Falta' ? 'selected' : ''}>Falta</option>
                        <option value="Falta Justificada" ${record.Status === 'Falta Justificada' ? 'selected' : ''}>Falta Justificada</option>
                        <option value="Licença" ${record.Status === 'Licença' ? 'selected' : ''}>Licença</option>
                        <option value="Férias" ${record.Status === 'Férias' ? 'selected' : ''}>Férias</option>
                        <option value="Suspensão" ${record.Status === 'Suspensão' ? 'selected' : ''}>Suspensão</option>
                    </select>
                </div>
                <div class="mb-4">
                    <input name="Assinatura" value="${record.Assinatura || ''}" placeholder="Assinatura Digital (Texto)" class="border p-2 rounded w-full bg-gray-50">
                </div>
                <div class="mb-4">
                    <textarea name="Observacoes" placeholder="Observações (Atrasos, Justificativas...)" class="border p-2 rounded w-full h-20">${record.Observacoes || ''}</textarea>
                </div>
                <button class="w-full bg-blue-600 text-white py-2 rounded font-bold">Registrar Ponto</button>
            </form>
        `);

        // Carrega o dropdown logo após o modal abrir
        setTimeout(() => RHModule.atualizarDropdownEscalados(dataInicial, record.FuncionarioID || ''), 50);
    },

    setCurrentTime: (field) => {
        const now = new Date();
        const time = now.toTimeString().slice(0, 5);
        const input = document.querySelector(`input[name="${field}"]`);
        if(input) input.value = time;
    },

    applyFrequenciaFilter: () => {
        RHModule.state.filterFrequenciaStart = document.getElementById('freq-start-date').value;
        RHModule.state.filterFrequenciaEnd = document.getElementById('freq-end-date').value;
        RHModule.state.filterFrequenciaTurno = document.getElementById('freq-turno').value;
        RHModule.renderFrequencia();
    },

    clearFrequenciaFilter: () => {
        RHModule.state.filterFrequenciaStart = '';
        RHModule.state.filterFrequenciaEnd = '';
        RHModule.state.filterFrequenciaTurno = '';
        // Não precisa limpar os inputs manualmente, o re-render já fará isso
        // ao ler o estado vazio.
        RHModule.renderFrequencia();
    },

    // --- 3. ABA FÉRIAS ---
    renderFerias: () => {
        RHModule.highlightTab('tab-ferias');
        const data = RHModule.state.cache.ferias || [];
        const allFuncs = RHModule.state.cache.allFuncionarios || [];
        const canCreate = Utils.checkPermission('RH', 'criar');
        const canDelete = Utils.checkPermission('RH', 'excluir');
        document.getElementById('tab-content').innerHTML = `
            <div class="flex justify-end gap-2 mb-4">
                <button onclick="RHModule.printTabPDF('ferias')" class="bg-red-600 text-white px-4 py-2 rounded shadow hover:bg-red-700"><i class="fas fa-file-pdf"></i> PDF</button>
                ${canCreate ? `<button onclick="RHModule.modalFerias()" class="bg-blue-600 text-white px-4 py-2 rounded">+ Solicitar Férias</button>` : ''}
            </div>
            <table class="w-full bg-white rounded shadow text-sm">
                <thead class="bg-gray-100"><tr><th class="p-3 text-left">Matrícula</th><th>Nome</th><th>Início</th><th>Retorno</th><th>Dias</th><th>Subsídio de Férias</th><th>Status</th><th>Ações</th></tr></thead>
                <tbody>
                    ${data.map(r => {
                        const func = allFuncs.find(f => f.ID === r.FuncionarioID) || {};
                        const matricula = func.Codigo || func.ID?.slice(0,8) || r.Codigo || r.ID.slice(0,8);
                        return `
                        <tr class="border-t">
                            <td class="p-3 font-bold text-gray-700 font-mono">${matricula}</td>
                            <td class="p-3">${r.FuncionarioNome || '-'}</td>
                            <td class="p-3 text-center">${Utils.formatDate(r.DataInicio)}</td>
                            <td class="p-3 text-center">${Utils.formatDate(r.DataFim)}</td>
                            <td class="p-3 text-center">${r.Dias}</td>
                            <td class="p-3 text-center">${r.Pagamento13 === 'Sim' ? '✅' : '❌'}</td>
                            <td class="p-3 text-center"><span class="px-2 py-1 rounded ${r.Status==='Aprovado'?'bg-green-100 text-green-700':'bg-yellow-100 text-yellow-700'}">${r.Status}</span></td>
                            <td class="p-3 text-center flex justify-center gap-2">
                                <button onclick="RHModule.printGuiaFerias('${r.ID}')" class="text-gray-600 hover:text-gray-900" title="Imprimir Guia"><i class="fas fa-print"></i></button>
                                <button onclick="RHModule.shareGuiaFerias('${r.ID}')" class="text-blue-600 hover:text-blue-800" title="Enviar por Email/WhatsApp"><i class="fas fa-share-alt"></i></button>
                                ${r.ComprovativoURL ? `<button onclick="RHModule.viewComprovativo('${r.ID}')" class="text-green-600 hover:text-green-800" title="Ver Comprovativo"><i class="fas fa-receipt"></i></button>` : ''}
                                ${canDelete ? `<button onclick="RHModule.delete('Ferias', '${r.ID}')" class="text-red-500 hover:text-red-700"><i class="fas fa-trash"></i></button>` : ''}
                            </td>
                        </tr>
                    `}).join('')}
                </tbody>
            </table>
        `;
    },

    updateSubsidioFerias: () => {
        const funcId = document.querySelector('select[name="FuncionarioID"]').value;
        const dias = Number(document.querySelector('input[name="Dias"]').value || 0);
        const f = RHModule.state.cache.allFuncionarios.find(x => x.ID === funcId);
        const inst = RHModule.state.cache.instituicao[0] || {};
        const percentual = Number(inst.SubsidioFeriasPorcentagem || 50) / 100;
        
        if(f) {
            // Preencher dados básicos se chamado pelo select
            if (window.event && window.event.target.name === 'FuncionarioID') {
                document.querySelector('input[name="FuncionarioNome"]').value = f.Nome;
                document.getElementById('f-cargo').value = f.Cargo;
                document.getElementById('f-dept').value = f.Departamento || '';
                document.getElementById('f-adm').value = f.Admissao || '';
            }

            // Cálculo do Subsídio (Baseado na configuração global)
            const valorDiario = Number(f.Salario || 0) / 30;
            const subsidio = (valorDiario * dias) * percentual;
            document.getElementById('f-subsidio').value = Utils.formatCurrency(subsidio);
        }
    },

    modalFerias: () => {
        const funcs = RHModule.state.cache.allFuncionarios;
        
        Utils.openModal('Solicitar Férias', `
            <form onsubmit="RHModule.save(event, 'Ferias')">
                <h3 class="text-lg font-bold text-gray-800 mb-4 border-b pb-2">Controle de Férias / Observações (Opcional)</h3>
                
                <div class="mb-4">
                    <label class="block text-sm font-bold mb-1">Nome do Funcionario</label>
                    <select name="FuncionarioID" class="border p-2 rounded w-full mb-2" onchange="RHModule.updateSubsidioFerias()" required>
                        <option value="">Selecione...</option>
                        ${funcs.map(f => `<option value="${f.ID}">${f.Nome}</option>`).join('')}
                    </select>
                    <input type="hidden" name="FuncionarioNome">
                    <div class="grid grid-cols-3 gap-2 text-xs">
                        <input id="f-cargo" placeholder="CARGO" class="border p-2 bg-gray-100 rounded" readonly>
                        <input id="f-dept" placeholder="DEPARTAMENTO" class="border p-2 bg-gray-100 rounded" readonly>
                        <input id="f-adm" placeholder="DATA DE ADMISSÃO" class="border p-2 bg-gray-100 rounded" readonly>
                    </div>
                </div>

                <h4 class="font-bold text-gray-700 mb-2 border-b">1. PERIODO</h4>
                <div class="grid grid-cols-3 gap-2 mb-3">
                    <div><label class="text-xs font-bold">DATA DE INICIO DAS FERIAS</label><input type="date" name="DataInicio" class="border p-2 rounded w-full" required></div>
                    <div><label class="text-xs font-bold">DATA DE RETORNO</label><input type="date" name="DataFim" class="border p-2 rounded w-full" required></div>
                    <div><label class="text-xs font-bold">TOTAL DE DIAS</label><input type="number" name="Dias" class="border p-2 rounded w-full" required oninput="RHModule.updateSubsidioFerias()"></div>
                </div>

                <h4 class="font-bold text-gray-700 mb-2 border-b">2. FRACCIONAMENTO</h4>
                <div class="mb-3">
                    <label class="text-xs font-bold block">FÉRIAS FRACIONADAS (SIM/NÃO)</label>
                    <select name="Fracionadas" class="border p-2 rounded w-full"><option>Não</option><option>Sim</option></select>
                </div>

                <h4 class="font-bold text-gray-700 mb-2 border-b">3. PAGAMENTOS</h4>
                <div class="grid grid-cols-3 gap-2 mb-3">
                    <div><label class="text-xs font-bold block">PAGAMENTO COM 1/3 CONSTITUCIONAL</label><select name="Pagamento13" class="border p-2 rounded w-full"><option>Não</option><option>Sim</option></select></div>
                    <div><label class="text-xs font-bold block">ADIANTAMENTO DE 13º SLÁRIO</label><select name="Adiantamento13" class="border p-2 rounded w-full"><option>Não</option><option>Sim</option></select></div>
                    <div><label class="text-xs font-bold block">DATA DE PAGAMENTO</label><input type="date" name="DataPagamento" class="border p-2 rounded w-full"></div>
                    <div class="col-span-3 mt-2"><label class="text-xs font-bold block text-green-700">SUBSÍDIO ESTIMADO</label><input id="f-subsidio" class="border p-2 rounded w-full bg-green-50 font-bold text-green-800" readonly></div>
                </div>
                <div class="mb-3">
                    <label class="text-xs font-bold block">COMPROVATIVO DE PAGAMENTO (ANEXO)</label>
                    <input type="file" id="file-comprovativo" class="border p-2 rounded w-full text-xs bg-gray-50">
                </div>

                <div class="mb-4">
                    <label class="text-xs font-bold block">OBSERVAÇÕES</label>
                    <textarea name="Observacoes" class="border p-2 rounded w-full h-16"></textarea>
                </div>
                
                <div class="grid grid-cols-2 gap-4 mb-4">
                    <input name="AssinaturaFunc" placeholder="ASSINATURA DO FUNCIONARIO" class="border p-2 rounded bg-gray-50 text-xs">
                    <input name="AssinaturaRH" placeholder="ASSINATURA DO SUPERVISOR/ RH" class="border p-2 rounded bg-gray-50 text-xs">
                </div>

                <select name="Status" class="border p-2 rounded w-full mb-4 bg-yellow-50">
                    <option>Solicitado</option>
                    <option>Aprovado</option>
                </select>

                <button class="w-full bg-blue-600 text-white py-2 rounded">Salvar</button>
            </form>
        `);
    },

    printGuiaFerias: (id) => {
        const ferias = RHModule.state.cache.ferias.find(f => f.ID === id);
        if (!ferias) return Utils.toast('Registro não encontrado.', 'error');

        const func = RHModule.state.cache.allFuncionarios.find(f => f.ID === ferias.FuncionarioID) || {};
        const inst = RHModule.state.cache.instituicao[0] || {};
        const showLogo = inst.ExibirLogoRelatorios;

        // Cálculos Auxiliares
        // 1. Data de Retorno (Dia seguinte ao fim)
        const dataFim = new Date(ferias.DataFim);
        const dataRetorno = new Date(dataFim);
        dataRetorno.setDate(dataRetorno.getDate() + 1);

        // 2. Saldo de Férias (Estimativa simples: 30 - dias gozados no ano atual)
        const anoAtual = new Date().getFullYear();
        const feriasAno = RHModule.state.cache.ferias.filter(f => 
            f.FuncionarioID === ferias.FuncionarioID && 
            f.Status === 'Aprovado' && 
            new Date(f.DataInicio).getFullYear() === anoAtual
        );
        const diasGozados = feriasAno.reduce((acc, cur) => acc + Number(cur.Dias), 0);
        const saldoRestante = 22 - diasGozados; // Base: 22 dias úteis

        const html = `
            <div class="border-2 border-gray-800 p-8 max-w-3xl mx-auto font-serif text-gray-900">
                <!-- Cabeçalho -->
                ${RHModule.buildPDFHeader(inst, 'GUIA DE FÉRIAS', 'Ref: ' + (ferias.Codigo || ferias.ID.slice(0,8)))}

                <!-- Dados do Colaborador -->
                <div class="mb-6 bg-gray-50 p-4 rounded border border-gray-200">
                    <h3 class="font-bold border-b border-gray-300 mb-2 uppercase text-sm">Dados do Colaborador</h3>
                    <div class="grid grid-cols-2 gap-4">
                        <div><span class="font-bold text-sm">Nome:</span> <span class="text-lg block">${func.Nome || ferias.FuncionarioNome}</span></div>
                        <div><span class="font-bold text-sm">Cargo/Função:</span> <span class="text-lg block">${func.Cargo || '-'}</span></div>
                        <div><span class="font-bold text-sm">Departamento:</span> <span class="block">${func.Departamento || '-'}</span></div>
                        <div><span class="font-bold text-sm">Matrícula:</span> <span class="block font-mono">${func.Codigo || func.ID?.slice(0,8) || '-'}</span></div>
                    </div>
                </div>

                <!-- Detalhes das Férias -->
                <div class="mb-8">
                    <h3 class="font-bold border-b border-gray-800 mb-4 uppercase text-sm">Detalhamento do Período</h3>
                    <table class="w-full text-left border-collapse border border-gray-300">
                        <tr class="bg-gray-100"><th class="border p-2">Início das Férias</th><th class="border p-2">Término das Férias</th><th class="border p-2">Dias de Gozo</th></tr>
                        <tr>
                            <td class="border p-3 text-lg">${Utils.formatDate(ferias.DataInicio)}</td>
                            <td class="border p-3 text-lg">${Utils.formatDate(ferias.DataFim)}</td>
                            <td class="border p-3 text-lg font-bold text-center">${ferias.Dias}</td>
                        </tr>
                    </table>
                    <div class="mt-4 grid grid-cols-2 gap-4">
                        <div class="p-3 border bg-blue-50"><span class="font-bold">Data de Retorno ao Trabalho:</span> <br> ${dataRetorno.toLocaleDateString('pt-BR')}</div>
                        <div class="p-3 border bg-gray-50"><span class="font-bold">Saldo Restante (Estimado):</span> <br> ${saldoRestante > 0 ? saldoRestante : 0} dias</div>
                    </div>
                </div>

                <!-- Assinaturas -->
                <div class="mt-16 grid grid-cols-2 gap-16 text-center">
                    <div class="border-t border-gray-800 pt-2">
                        <p class="font-bold">${func.Nome}</p>
                        <p class="text-xs">Assinatura do Colaborador</p>
                    </div>
                    <div class="border-t border-gray-800 pt-2">
                        <p class="font-bold">Recursos Humanos / Gestão</p>
                        <p class="text-xs">Autorizado por</p>
                    </div>
                </div>
                <div class="mt-8 text-center text-xs text-gray-400">Documento gerado eletronicamente em ${new Date().toLocaleString()}</div>
            </div>
        `;

        Utils.printNative(html, 'landscape');
    },

    shareGuiaFerias: (id) => {
        const ferias = RHModule.state.cache.ferias.find(f => f.ID === id);
        if (!ferias) return Utils.toast('Registro não encontrado.', 'error');

        const func = RHModule.state.cache.allFuncionarios.find(f => f.ID === ferias.FuncionarioID) || {};
        
        // Prepara a Mensagem
        const dataInicio = Utils.formatDate(ferias.DataInicio);
        const dataFim = Utils.formatDate(ferias.DataFim);
        const retorno = new Date(ferias.DataFim);
        retorno.setDate(retorno.getDate() + 1);
        const dataRetorno = Utils.formatDate(retorno.toISOString().split('T')[0]);
        
        const msg = `*GUIA DE FÉRIAS - DELÍCIA DA CIDADE*\n\n` +
            `Olá *${func.Nome}*,\n` +
            `Seguem os detalhes das suas férias:\n\n` +
            `📅 *Período:* ${dataInicio} a ${dataFim}\n` +
            `🏖️ *Dias:* ${ferias.Dias}\n` +
            `🔙 *Retorno:* ${dataRetorno}\n\n` +
            `Bom descanso!`;

        const encodedMsg = encodeURIComponent(msg);
        
        // Limpeza do telefone (remove caracteres não numéricos)
        let phone = func.Telefone || '';
        phone = phone.replace(/\D/g, ''); 
        
        const email = func.Email || '';

        Utils.openModal('Enviar Guia de Férias', `
            <div class="text-center space-y-4">
                <p class="text-gray-600">Escolha como deseja enviar as informações para <b>${func.Nome}</b>:</p>
                
                <div class="grid grid-cols-1 gap-3">
                    <a href="https://wa.me/${phone}?text=${encodedMsg}" target="_blank" class="block w-full bg-green-500 text-white py-3 rounded font-bold hover:bg-green-600 flex items-center justify-center gap-2 transition">
                        <i class="fab fa-whatsapp text-xl"></i> Enviar por WhatsApp
                    </a>
                    
                    <a href="mailto:${email}?subject=Guia de Férias - ${func.Nome}&body=${encodedMsg}" class="block w-full bg-blue-600 text-white py-3 rounded font-bold hover:bg-blue-700 flex items-center justify-center gap-2 transition">
                        <i class="fas fa-envelope text-xl"></i> Enviar por E-mail
                    </a>
                </div>
                
                <div class="text-xs text-gray-400 mt-4 border-t pt-2">
                    <p>Telefone cadastrado: ${func.Telefone || 'Não informado'}</p>
                    <p>E-mail cadastrado: ${func.Email || 'Não informado'}</p>
                </div>
            </div>
        `);
    },

    viewComprovativo: (id) => {
        const r = RHModule.state.cache.ferias.find(x => x.ID === id);
        if(r && r.ComprovativoURL) {
            Utils.openModal('Comprovativo de Pagamento', `
                <div class="text-center">
                    <img src="${r.ComprovativoURL}" class="max-w-full max-h-[70vh] mx-auto border rounded shadow">
                    <a href="${r.ComprovativoURL}" download="comprovativo-${r.FuncionarioNome}.png" class="inline-block mt-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Baixar Imagem</a>
                </div>
            `);
        }
    },

    // --- 4. ABA AVALIAÇÃO ---
    renderAvaliacoes: async () => {
        RHModule.highlightTab('tab-avaliacoes');

        if (!RHModule.state.cache.avaliacoes) {
            document.getElementById('tab-content').innerHTML = '<div class="text-center p-10"><i class="fas fa-spinner fa-spin text-4xl text-blue-600"></i><p class="mt-2">Carregando avaliações...</p></div>';
            try {
                RHModule.state.cache.avaliacoes = await Utils.api('getAll', 'Avaliacoes');
            } catch (e) { return Utils.toast('Erro ao carregar dados.', 'error'); }
        }

        const data = RHModule.state.cache.avaliacoes || [];
        const allFuncs = RHModule.state.cache.allFuncionarios || [];
        const canCreate = Utils.checkPermission('RH', 'criar');
        const canEdit = Utils.checkPermission('RH', 'editar');
        const canDelete = Utils.checkPermission('RH', 'excluir');
        document.getElementById('tab-content').innerHTML = `
            <div class="flex justify-end gap-2 mb-4">
                <button onclick="RHModule.printTabPDF('avaliacoes')" class="bg-red-600 text-white px-4 py-2 rounded shadow hover:bg-red-700"><i class="fas fa-file-pdf"></i> PDF</button>
                ${canCreate ? `<button onclick="RHModule.modalAvaliacao()" class="bg-blue-600 text-white px-4 py-2 rounded">+ Nova Avaliação</button>` : ''}
            </div>
            <table class="w-full bg-white rounded shadow text-sm">
                <thead class="bg-gray-100"><tr><th class="p-3 text-left">Matrícula</th><th>Funcionário</th><th>Data</th><th>Média (0-10)</th><th>Conclusão</th><th>Ações</th></tr></thead>
                <tbody>
                    ${data.map(r => {
                        const func = allFuncs.find(f => f.ID === r.FuncionarioID) || {};
                        const matricula = func.Codigo || func.ID?.slice(0,8) || r.Codigo || r.ID.slice(0,8);
                        return `
                        <tr class="border-t">
                            <td class="p-3 font-bold text-gray-700 font-mono">${matricula}</td>
                            <td class="p-3">${r.FuncionarioNome}</td>
                            <td class="p-3 text-center">${Utils.formatDate(r.DataAvaliacao)}</td>
                            <td class="p-3 text-center font-bold">${r.MediaFinal}</td>
                            <td class="p-3 text-center"><span class="px-2 py-1 rounded bg-gray-100 text-xs">${r.Conclusao || '-'}</span></td>
                            <td class="p-3 text-center flex justify-center gap-2">
                                <button onclick="RHModule.printAvaliacaoIndividual('${r.ID}')" class="text-gray-600 hover:text-gray-900" title="Imprimir"><i class="fas fa-print"></i></button>
                                <button onclick="RHModule.shareAvaliacao('${r.ID}')" class="text-blue-600 hover:text-blue-800" title="Compartilhar"><i class="fas fa-share-alt"></i></button>
                                ${canEdit ? `<button onclick="RHModule.modalAvaliacao('${r.ID}')" class="text-blue-600 hover:text-blue-800" title="Editar"><i class="fas fa-edit"></i></button>` : ''}
                                ${canDelete ? `<button onclick="RHModule.delete('Avaliacoes', '${r.ID}')" class="text-red-500 hover:text-red-700" title="Excluir"><i class="fas fa-trash"></i></button>` : ''}
                            </td>
                        </tr>
                    `}).join('')}
                </tbody>
            </table>
        `;
    },

    modalAvaliacao: (id = null) => {
        const funcs = RHModule.state.cache.allFuncionarios;
        const av = id ? RHModule.state.cache.avaliacoes.find(a => a.ID === id) : {};
        const details = av.DetalhesJSON || {};
        const title = id ? 'Editar Avaliação' : 'Avaliação de Desempenho';
        
        // Script para preencher dados
        const fillData = (select) => {
            const f = RHModule.state.cache.allFuncionarios.find(x => x.ID === select.value);
            if(f) {
                select.form.FuncionarioNome.value = f.Nome;
                document.getElementById('av-cargo').value = f.Cargo;
                document.getElementById('av-dept').value = f.Departamento || '';
            }
        };

        // Script para calcular média
        const calcMedia = () => {
            const inputs = document.querySelectorAll('.nota-input');
            let sum = 0;
            inputs.forEach(i => sum += Number(i.value || 0));
            const avg = (sum / inputs.length).toFixed(1);
            document.getElementById('media-final').value = avg;
            
            let conc = 'Insatisfatório';
            if(avg >= 9) conc = 'Excelente';
            else if(avg >= 7) conc = 'Aprovado';
            else if(avg >= 5) conc = 'Requer Melhorias';
            document.getElementById('conclusao').value = conc;
        };

        // Helper para pegar valor (do nível superior ou detalhes)
        const getVal = (key) => av[key] !== undefined ? av[key] : (details[key] || '');

        // Preencher cargo/dept se editando
        let initialCargo = '', initialDept = '';
        if (av.FuncionarioID) {
            const f = funcs.find(x => x.ID === av.FuncionarioID);
            if(f) { initialCargo = f.Cargo; initialDept = f.Departamento; }
        }

        Utils.openModal(title, `
            <form onsubmit="RHModule.save(event, 'Avaliacoes')">
                <input type="hidden" name="ID" value="${av.ID || ''}">
                <h4 class="font-bold text-gray-700 mb-2 border-b">1 AVALIAÇÃO DE DESEMPENHO</h4>
                <div class="mb-3">
                    <label class="block text-xs font-bold">NOME DO FUNCIONARIO</label>
                    <select name="FuncionarioID" class="border p-2 rounded w-full mb-2" onchange="(${fillData})(this)" required>
                        <option value="">Selecione...</option>
                        ${funcs.map(f => `<option value="${f.ID}" ${av.FuncionarioID === f.ID ? 'selected' : ''}>${f.Nome}</option>`).join('')}
                    </select>
                    <input type="hidden" name="FuncionarioNome">
                    <div class="grid grid-cols-2 gap-2 text-xs mb-2">
                        <input id="av-cargo" placeholder="CARGO/FUNÇÃO" class="border p-2 bg-gray-100 rounded" readonly value="${initialCargo}">
                        <input id="av-dept" placeholder="DEPARTAMENTO/SETOR" class="border p-2 bg-gray-100 rounded" readonly value="${initialDept}">
                    </div>
                    <div class="grid grid-cols-2 gap-2">
                        <div><label class="text-xs font-bold">DATA DE AVALIAÇÃO</label><input type="date" name="DataAvaliacao" class="border p-2 rounded w-full" required value="${av.DataAvaliacao || ''}"></div>
                        <div><label class="text-xs font-bold">NOME DO AVALIADOR</label><input name="Avaliador" class="border p-2 rounded w-full" value="${av.Avaliador || ''}"></div>
                    </div>
                </div>
                
                <h4 class="font-bold text-gray-700 mb-2 border-b">2 CRITERIOS DE AVALIAÇÃO (ESCALA 1-10)</h4>
                <div class="grid grid-cols-3 gap-2 mb-3 text-sm" oninput="(${calcMedia})()">
                    <input type="number" name="N1" placeholder="PONTUALIDADE" min="0" max="10" class="nota-input border p-2 rounded" value="${getVal('N1')}">
                    <input type="number" name="N2" placeholder="ASSIDUIDADE" min="0" max="10" class="nota-input border p-2 rounded" value="${getVal('N2')}">
                    <input type="number" name="N3" placeholder="CUMPRIMENTO DE TAREFAS" min="0" max="10" class="nota-input border p-2 rounded" value="${getVal('N3')}">
                    <input type="number" name="N4" placeholder="PRODUTIVIDADE" min="0" max="10" class="nota-input border p-2 rounded" value="${getVal('N4')}">
                    <input type="number" name="N5" placeholder="QUALIDADE DO TRABALHO" min="0" max="10" class="nota-input border p-2 rounded" value="${getVal('N5')}">
                    <input type="number" name="N6" placeholder="TRABALHO EM EQUIPE" min="0" max="10" class="nota-input border p-2 rounded" value="${getVal('N6')}">
                    <input type="number" name="N7" placeholder="RESPONSABILIDADE" min="0" max="10" class="nota-input border p-2 rounded" value="${getVal('N7')}">
                    <input type="number" name="N8" placeholder="COMPROMETIMENTO" min="0" max="10" class="nota-input border p-2 rounded" value="${getVal('N8')}">
                    <input type="number" name="N9" placeholder="COMUNICAÇÃO" min="0" max="10" class="nota-input border p-2 rounded" value="${getVal('N9')}">
                </div>

                <h4 class="font-bold text-gray-700 mb-2 border-b">3 AVALIAÇÃO QUALITATIVA</h4>
                <div class="grid grid-cols-2 gap-2 mb-3">
                    <textarea name="PontosFortes" placeholder="PONTOS FORTES" class="border p-2 rounded h-16 text-xs">${getVal('PontosFortes')}</textarea>
                    <textarea name="PontosMelhorar" placeholder="PONTOS A MELHORAR" class="border p-2 rounded h-16 text-xs">${getVal('PontosMelhorar')}</textarea>
                </div>
                <div class="mb-3">
                    <textarea name="Comentarios" placeholder="COMENTARIOS DO AVALIADOR" class="border p-2 rounded w-full h-16 text-xs">${getVal('Comentarios')}</textarea>
                </div>

                <h4 class="font-bold text-gray-700 mb-2 border-b">4 RESULTADO</h4>
                <div class="flex gap-2 mb-4">
                    <input id="media-final" name="MediaFinal" placeholder="NOTA FINAL/MÉDIA GERAL" class="border p-2 rounded w-1/2 font-bold text-center bg-gray-100" readonly value="${av.MediaFinal || ''}">
                    <input id="conclusao" name="Conclusao" placeholder="CONCLUSÃO" class="border p-2 rounded w-1/2 font-bold bg-gray-100" readonly value="${av.Conclusao || ''}">
                </div>

                <button class="w-full bg-blue-600 text-white py-2 rounded">Calcular & Salvar</button>
            </form>
        `);
    },

    printAvaliacaoIndividual: (id) => {
        const av = RHModule.state.cache.avaliacoes.find(a => a.ID === id);
        if (!av) return Utils.toast('Avaliação não encontrada.', 'error');
        
        const func = RHModule.state.cache.allFuncionarios.find(f => f.ID === av.FuncionarioID) || {};
        const inst = RHModule.state.cache.instituicao[0] || {};
        const showLogo = inst.ExibirLogoRelatorios;
        const details = av.DetalhesJSON || {};
        const getVal = (key) => av[key] !== undefined ? av[key] : (details[key] || '-');

        const html = `
            <div class="p-8 font-sans text-gray-900 bg-white max-w-4xl mx-auto border border-gray-200">
                <!-- CABEÇALHO -->
                ${RHModule.buildPDFHeader(inst, 'AVALIAÇÃO DE DESEMPENHO', 'Ref: ' + (av.Codigo || av.ID.slice(0,8)) + ' | Data: ' + Utils.formatDate(av.DataAvaliacao))}

                <!-- DADOS -->
                <div class="bg-gray-50 p-4 rounded border border-gray-200 mb-6">
                    <div class="grid grid-cols-2 gap-4 text-sm">
                        <div><span class="font-bold">Funcionário:</span> ${func.Nome || av.FuncionarioNome}</div>
                        <div><span class="font-bold">Cargo:</span> ${func.Cargo || '-'}</div>
                        <div><span class="font-bold">Departamento:</span> ${func.Departamento || '-'}</div>
                        <div><span class="font-bold">Avaliador:</span> ${av.Avaliador || '-'}</div>
                    </div>
                </div>

                <!-- NOTAS -->
                <div class="mb-6">
                    <h3 class="font-bold border-b border-gray-300 mb-2 uppercase text-sm">Critérios de Avaliação</h3>
                    <table class="w-full text-sm border-collapse border border-gray-300">
                        <tr class="bg-gray-100"><th class="border p-2 text-left">Critério</th><th class="border p-2 text-center w-20">Nota</th></tr>
                        <tr><td class="border p-2">Pontualidade</td><td class="border p-2 text-center">${getVal('N1')}</td></tr>
                        <tr><td class="border p-2">Assiduidade</td><td class="border p-2 text-center">${getVal('N2')}</td></tr>
                        <tr><td class="border p-2">Cumprimento de Tarefas</td><td class="border p-2 text-center">${getVal('N3')}</td></tr>
                        <tr><td class="border p-2">Produtividade</td><td class="border p-2 text-center">${getVal('N4')}</td></tr>
                        <tr><td class="border p-2">Qualidade do Trabalho</td><td class="border p-2 text-center">${getVal('N5')}</td></tr>
                        <tr><td class="border p-2">Trabalho em Equipe</td><td class="border p-2 text-center">${getVal('N6')}</td></tr>
                        <tr><td class="border p-2">Responsabilidade</td><td class="border p-2 text-center">${getVal('N7')}</td></tr>
                        <tr><td class="border p-2">Comprometimento</td><td class="border p-2 text-center">${getVal('N8')}</td></tr>
                        <tr><td class="border p-2">Comunicação</td><td class="border p-2 text-center">${getVal('N9')}</td></tr>
                        <tr class="bg-gray-100 font-bold"><td class="border p-2 text-right">MÉDIA FINAL</td><td class="border p-2 text-center text-lg">${av.MediaFinal}</td></tr>
                    </table>
                </div>

                <!-- QUALITATIVO -->
                <div class="grid grid-cols-2 gap-6 mb-6">
                    <div class="border p-3 rounded">
                        <h4 class="font-bold text-green-700 text-sm mb-2">Pontos Fortes</h4>
                        <p class="text-sm text-gray-700">${getVal('PontosFortes') || '-'}</p>
                    </div>
                    <div class="border p-3 rounded">
                        <h4 class="font-bold text-red-700 text-sm mb-2">Pontos a Melhorar</h4>
                        <p class="text-sm text-gray-700">${getVal('PontosMelhorar') || '-'}</p>
                    </div>
                </div>
                <div class="mb-6 border p-3 rounded">
                    <h4 class="font-bold text-gray-700 text-sm mb-2">Comentários Gerais</h4>
                    <p class="text-sm text-gray-700">${getVal('Comentarios') || '-'}</p>
                </div>

                <!-- RESULTADO -->
                <div class="text-center mb-12">
                    <span class="text-sm font-bold uppercase text-gray-500">Conclusão Final</span>
                    <div class="text-2xl font-bold text-blue-800 border-2 border-blue-800 inline-block px-6 py-2 rounded mt-1">${av.Conclusao}</div>
                </div>

                <!-- ASSINATURAS -->
                <div class="grid grid-cols-2 gap-16 text-center">
                    <div class="border-t border-gray-400 pt-2"><p class="font-bold text-sm">Avaliador</p></div>
                    <div class="border-t border-gray-400 pt-2"><p class="font-bold text-sm">Funcionário (Ciente)</p></div>
                </div>
                
                <div class="mt-8 text-center text-xs text-gray-400 border-t pt-2">
                    &copy; 2026 Delícia da Cidade. Todos os direitos reservados. | Versão 1.0.0
                </div>
            </div>
        `;
        Utils.printNative(html, 'landscape');
    },

    shareAvaliacao: (id) => {
        const av = RHModule.state.cache.avaliacoes.find(a => a.ID === id);
        if (!av) return Utils.toast('Avaliação não encontrada.', 'error');
        const func = RHModule.state.cache.allFuncionarios.find(f => f.ID === av.FuncionarioID) || {};
        
        const msg = `*AVALIAÇÃO DE DESEMPENHO*\n` +
            `Funcionário: ${func.Nome}\n` +
            `Data: ${Utils.formatDate(av.DataAvaliacao)}\n` +
            `Média Final: *${av.MediaFinal}*\n` +
            `Conclusão: *${av.Conclusao}*\n\n` +
            `Acesse o sistema para ver os detalhes completos.`;
            
        const encodedMsg = encodeURIComponent(msg);
        let phone = func.Telefone || '';
        phone = phone.replace(/\D/g, '');
        const email = func.Email || '';

        Utils.openModal('Compartilhar Avaliação', `
            <div class="text-center space-y-4">
                <p class="text-gray-600">Enviar resumo para <b>${func.Nome}</b>:</p>
                <div class="grid grid-cols-1 gap-3">
                    <a href="https://wa.me/${phone}?text=${encodedMsg}" target="_blank" class="block w-full bg-green-500 text-white py-3 rounded font-bold hover:bg-green-600 flex items-center justify-center gap-2 transition">
                        <i class="fab fa-whatsapp text-xl"></i> WhatsApp
                    </a>
                    <a href="mailto:${email}?subject=Avaliação de Desempenho&body=${encodedMsg}" class="block w-full bg-blue-600 text-white py-3 rounded font-bold hover:bg-blue-700 flex items-center justify-center gap-2 transition">
                        <i class="fas fa-envelope text-xl"></i> E-mail
                    </a>
                </div>
            </div>
        `);
    },

    // --- 5. ABA TREINAMENTO ---
    renderTreinamento: async () => {
        RHModule.highlightTab('tab-treinamento');

        if (!RHModule.state.cache.treinamentos) {
            document.getElementById('tab-content').innerHTML = '<div class="text-center p-10"><i class="fas fa-spinner fa-spin text-4xl text-blue-600"></i><p class="mt-2">Carregando treinamentos...</p></div>';
            try {
                RHModule.state.cache.treinamentos = await Utils.api('getAll', 'Treinamentos');
            } catch (e) { return Utils.toast('Erro ao carregar dados.', 'error'); }
        }

        const data = RHModule.state.cache.treinamentos || [];
        const canCreate = Utils.checkPermission('RH', 'criar');
        const canDelete = Utils.checkPermission('RH', 'excluir');
        document.getElementById('tab-content').innerHTML = `
            <div class="flex justify-end gap-2 mb-4">
                <button onclick="RHModule.printTabPDF('treinamento')" class="bg-red-600 text-white px-4 py-2 rounded shadow hover:bg-red-700"><i class="fas fa-file-pdf"></i> PDF</button>
                ${canCreate ? `<button onclick="RHModule.modalTreinamento()" class="bg-blue-600 text-white px-4 py-2 rounded">+ Novo Treinamento</button>` : ''}
            </div>
            <table class="w-full bg-white rounded shadow text-sm">
                <thead class="bg-gray-100"><tr><th class="p-3 text-left">ID</th><th>Nome</th><th>Título</th><th>Tipo</th><th>Início</th><th>Término</th><th>Status</th><th>Ações</th></tr></thead>
                <tbody>
                    ${data.map(r => `
                        <tr class="border-t">
                            <td class="p-3">${r.ID}</td>
                            <td class="p-3">${r.FuncionarioNome}</td>
                            <td class="p-3 font-bold">${r.Titulo}</td>
                            <td class="p-3">${r.Tipo}</td>
                            <td class="p-3 text-center">${Utils.formatDate(r.Inicio)}</td>
                            <td class="p-3 text-center">${Utils.formatDate(r.Termino)}</td>
                            <td class="p-3 text-center"><span class="px-2 py-1 rounded bg-blue-100 text-blue-800 text-xs">${r.Status}</span></td>
                            <td class="p-3 text-center">${canDelete ? `<button onclick="RHModule.delete('Treinamentos', '${r.ID}')" class="text-red-500"><i class="fas fa-trash"></i></button>` : ''}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    },

    modalTreinamento: () => {
        const funcs = RHModule.state.cache.allFuncionarios;
        Utils.openModal('Registro de Treinamento', `
            <form onsubmit="RHModule.save(event, 'Treinamentos')">
                <div class="mb-3">
                    <label class="block text-sm font-bold">Participante</label>
                    <select name="FuncionarioID" class="border p-2 rounded w-full" onchange="this.form.FuncionarioNome.value = this.options[this.selectedIndex].text">
                        <option value="Todos">Todos os Funcionários</option>
                        ${funcs.map(f => `<option value="${f.ID}">${f.Nome}</option>`).join('')}
                    </select>
                    <input type="hidden" name="FuncionarioNome" value="Todos">
                </div>
                
                <h4 class="font-bold text-gray-700 mb-2 border-b">Detalhes</h4>
                <div class="grid grid-cols-2 gap-3 mb-3">
                    <input name="Titulo" placeholder="Título do Treinamento" class="border p-2 rounded w-full col-span-2" required>
                    <select name="Tipo" class="border p-2 rounded w-full">
                        <option>Interno</option><option>Externo</option><option>Online</option><option>Presencial</option>
                    </select>
                    <input name="Instrutor" placeholder="Instrutor/Responsável" class="border p-2 rounded w-full">
                    <input name="Local" placeholder="Local" class="border p-2 rounded w-full col-span-2">
                </div>

                <h4 class="font-bold text-gray-700 mb-2 border-b">Datas & Status</h4>
                <div class="grid grid-cols-3 gap-2 mb-3">
                    <div><label class="text-xs">Início</label><input type="date" name="Inicio" class="border p-1 rounded w-full"></div>
                    <div><label class="text-xs">Término</label><input type="date" name="Termino" class="border p-1 rounded w-full"></div>
                    <div><label class="text-xs">Carga (h)</label><input type="number" name="Carga" class="border p-1 rounded w-full"></div>
                </div>
                <select name="Status" class="border p-2 rounded w-full mb-4">
                    <option>Pendente</option><option>Em Andamento</option><option>Concluído</option><option>Futuro</option>
                </select>

                <button class="w-full bg-blue-600 text-white py-2 rounded">Salvar</button>
            </form>
        `);
    },

    // --- 6. ABA FOLHA DE PAGAMENTO ---
    renderFolha: async () => {
        RHModule.highlightTab('tab-folha');

        if (!RHModule.state.cache.folha) {
            document.getElementById('tab-content').innerHTML = '<div class="text-center p-10"><i class="fas fa-spinner fa-spin text-4xl text-blue-600"></i><p class="mt-2">Carregando folha de pagamento...</p></div>';
            try {
                RHModule.state.cache.folha = await Utils.api('getAll', 'Folha');
            } catch (e) { return Utils.toast('Erro ao carregar dados.', 'error'); }
        }

        const data = RHModule.state.cache.folha || [];
        const allFuncs = RHModule.state.cache.allFuncionarios || [];
        const canCreate = Utils.checkPermission('RH', 'criar');
        const canEdit = Utils.checkPermission('RH', 'editar');
        const canDelete = Utils.checkPermission('RH', 'excluir');
        
        document.getElementById('tab-content').innerHTML = `
            <div class="flex justify-end gap-2 mb-4">
                <button onclick="RHModule.printTabPDF('folha')" class="bg-red-600 text-white px-4 py-2 rounded shadow hover:bg-red-700"><i class="fas fa-file-pdf"></i> PDF</button>
                ${canCreate ? `<button onclick="RHModule.modalFolha()" class="bg-indigo-600 text-white px-4 py-2 rounded">+ Lançar Pagamento</button>` : ''}
            </div>
            <table class="w-full bg-white rounded shadow text-sm">
                <thead class="bg-gray-100"><tr><th class="p-3 text-left">Matrícula</th><th>Nome</th><th class="text-right">Salário Base</th><th class="text-right">Vencimentos</th><th class="text-right">Descontos</th><th class="text-right">Líquido</th><th>Banco/IBAN</th><th>Ações</th></tr></thead>
                <tbody>
                    ${data.map(r => {
                        const func = allFuncs.find(f => f.ID === r.FuncionarioID) || {};
                        const matricula = func.Codigo || func.ID?.slice(0,8) || r.ID.slice(0,8);
                        return `
                        <tr class="border-t">
                            <td class="p-3 font-bold text-gray-700 font-mono">${matricula}</td>
                            <td class="p-3 font-bold">${r.FuncionarioNome}</td>
                            <td class="p-3 text-right">${Utils.formatCurrency(r.SalarioBase)}</td>
                            <td class="p-3 text-right text-blue-600">${Utils.formatCurrency(r.TotalVencimentos)}</td>
                            <td class="p-3 text-right text-red-500">${Utils.formatCurrency(r.TotalDescontos)}</td>
                            <td class="p-3 text-right font-bold text-green-700">${Utils.formatCurrency(r.SalarioLiquido)}</td>
                            <td class="p-3 text-xs">${r.Banco || '-'} <br> ${r.Iban || '-'}</td>
                            <td class="p-3 text-center flex justify-center gap-2">
                                <button onclick="RHModule.printPayslip('${r.ID}')" class="text-gray-600 hover:text-gray-900" title="Imprimir Recibo"><i class="fas fa-print"></i></button>
                                ${canEdit ? `<button onclick="RHModule.modalFolha('${r.ID}')" class="text-blue-600 hover:text-blue-800" title="Editar"><i class="fas fa-edit"></i></button>` : ''}
                                ${canDelete ? `<button onclick="RHModule.delete('Folha', '${r.ID}')" class="text-red-500 hover:text-red-700"><i class="fas fa-trash"></i></button>` : ''}
                            </td>
                        </tr>
                    `}).join('')}
                </tbody>
            </table>
        `;
    },

    modalFolha: (id = null) => {
        const funcs = RHModule.state.cache.allFuncionarios;
        const folha = id ? RHModule.state.cache.folha.find(f => f.ID === id) : {};
        const title = id ? 'Editar Folha' : 'Lançamento de Folha';
        
        // Preencher dados e Salário Base
        const fillData = (select) => {
            const f = RHModule.state.cache.allFuncionarios.find(x => x.ID === select.value);
            if(f) {
                select.form.FuncionarioNome.value = f.Nome;
                document.getElementById('folha-cargo').value = f.Cargo;
                document.getElementById('folha-base').value = f.Salario;
                document.getElementById('folha-iban').value = f.Iban || 'AO06';
                
                // Sugestão de valor por dia (Salário / 30)
                const valDia = f.Salario ? (f.Salario / 30).toFixed(2) : '';
                const inputValFalta = document.getElementById('val-falta');
                if(inputValFalta) inputValFalta.value = valDia;

                calcFolha();
            }
        };

        // Função para calcular descontos automaticamente baseado na frequência
        window.calcDescontosAuto = () => {
            const funcId = document.querySelector('select[name="FuncionarioID"]').value;
            const periodo = document.querySelector('input[name="Periodo"]').value; // YYYY-MM
            const salario = Number(document.getElementById('folha-base').value || 0);
            
            if (!funcId || !periodo) return Utils.toast('Selecione funcionário e período.', 'warning');

            const freq = RHModule.state.cache.frequencia || [];
            const recs = freq.filter(r => r.FuncionarioID === funcId && r.Data.startsWith(periodo));
            
            const faltas = recs.filter(r => r.Status === 'Falta').length;
            const atrasos = recs.filter(r => r.Status === 'Atraso').length;
            
            // Regra: 1 Falta = 1 dia, 1 Atraso = 0.5 dia
            const diasDesconto = faltas + (atrasos * 0.5);
            const valorDia = salario / 30;
            const totalDesconto = Math.round(diasDesconto * valorDia);
            
            document.getElementById('qtd-faltas').value = diasDesconto;
            document.getElementById('val-falta').value = valorDia.toFixed(2);
            document.getElementById('total-faltas').value = totalDesconto;
            
            // Recalcula totais
            const event = new Event('input', { bubbles: true });
            document.querySelector('form').dispatchEvent(event);
            
            Utils.toast(`Detectado: ${faltas} faltas e ${atrasos} atrasos.`, 'info');
        };

        // Cálculo em tempo real
        const calcFolha = (event) => {
            const base = Number(document.getElementById('folha-base').value || 0);
            
            // Vencimentos
            const heVal = Number(document.querySelector('[name="ValorHoraExtra"]').value || 0);
            const heQtd = Number(document.querySelector('[name="QtdHoraExtra"]').value || 0);
            const bonus = Number(document.querySelector('[name="Bonus"]').value || 0);
            const outrosV = Number(document.querySelector('[name="OutrosVencimentos"]').value || 0);
            const totalV = base + (heVal * heQtd) + bonus + outrosV;

            // Cálculo de Faltas (Novo)
            const qtdFaltas = Number(document.getElementById('qtd-faltas').value || 0);
            const valFalta = Number(document.getElementById('val-falta').value || 0);
            const inputFaltas = document.getElementById('total-faltas');
            
            // Atualiza total se estiver editando os componentes
            // FIX: Usa event.target para garantir que o cálculo só ocorre ao mexer nestes campos
            if (inputFaltas && event && event.target && (event.target.id === 'qtd-faltas' || event.target.id === 'val-falta')) {
                 inputFaltas.value = (qtdFaltas * valFalta);
            }

            // Descontos
            const inss = Number(document.querySelector('[name="INSS"]').value || 0);
            const irt = Number(document.querySelector('[name="IRT"]').value || 0);
            const faltas = inputFaltas ? Number(inputFaltas.value || 0) : 0;
            const outrosD = Number(document.querySelector('[name="OutrosDescontos"]').value || 0);
            const totalD = inss + irt + faltas + outrosD;

            document.getElementById('total-venc').value = totalV;
            document.getElementById('total-desc').value = totalD;
            document.getElementById('liquido').value = totalV - totalD;
        };

        // Obter cargo para exibição inicial se estiver editando
        let initialCargo = '';
        if (id && folha.FuncionarioID) {
            const f = funcs.find(x => x.ID === folha.FuncionarioID);
            if (f) initialCargo = f.Cargo;
        }

        Utils.openModal(title, `
            <form onsubmit="RHModule.save(event, 'Folha')" oninput="(${calcFolha})(event)">
                <input type="hidden" name="ID" value="${folha.ID || ''}">
                <h4 class="font-bold text-gray-700 mb-2 border-b">1. Identificação</h4>
                <div class="grid grid-cols-2 gap-3 mb-3">
                    <select name="FuncionarioID" class="border p-2 rounded w-full col-span-2" onchange="(${fillData})(this)" required>
                        <option value="">Selecione...</option>
                        ${funcs.map(f => `<option value="${f.ID}" ${folha.FuncionarioID === f.ID ? 'selected' : ''}>${f.Nome}</option>`).join('')}
                    </select>
                    <input type="hidden" name="FuncionarioNome" value="${folha.FuncionarioNome || ''}">
                    <input id="folha-cargo" placeholder="Cargo" class="border p-2 bg-gray-100" readonly value="${initialCargo}">
                    <input type="month" name="Periodo" class="border p-2 rounded w-full" required value="${folha.Periodo || ''}">
                </div>

                <h4 class="font-bold text-gray-700 mb-2 border-b text-green-700">2. Vencimentos (Créditos)</h4>
                <div class="grid grid-cols-2 gap-2 mb-3 text-sm">
                    <input id="folha-base" name="SalarioBase" placeholder="Salário Base" class="border p-2 bg-gray-50" readonly value="${folha.SalarioBase || ''}">
                    <input name="Bonus" placeholder="Bônus/Prêmios" type="number" class="border p-2" value="${folha.Bonus || ''}">
                    <div class="flex gap-1">
                        <input name="QtdHoraExtra" placeholder="Qtd HE" type="number" class="border p-2 w-1/2" value="${folha.QtdHoraExtra || ''}">
                        <input name="ValorHoraExtra" placeholder="Vlr HE" type="number" class="border p-2 w-1/2" value="${folha.ValorHoraExtra || ''}">
                    </div>
                    <input name="OutrosVencimentos" placeholder="Outros (Comissões...)" type="number" class="border p-2" value="${folha.OutrosVencimentos || ''}">
                </div>

                <h4 class="font-bold text-gray-700 mb-2 border-b text-red-700">3. Descontos</h4>
                <div class="grid grid-cols-2 gap-2 mb-3 text-sm">
                    <input name="INSS" placeholder="INSS (3%)" type="number" class="border p-2" value="${folha.INSS || ''}">
                    <input name="IRT" placeholder="IRT" type="number" class="border p-2" value="${folha.IRT || ''}">
                    
                    <div class="col-span-2 grid grid-cols-3 gap-2 bg-red-50 p-2 rounded border border-red-100">
                        <div>
                            <label class="text-[10px] font-bold text-red-800 block mb-1 cursor-pointer hover:underline" onclick="calcDescontosAuto()" title="Clique para calcular automático">Qtd. Faltas (Auto ↻)</label>
                            <input type="number" id="qtd-faltas" placeholder="Dias/Horas" class="border p-2 w-full bg-white text-xs">
                        </div>
                        <div>
                            <label class="text-[10px] font-bold text-red-800 block mb-1">Valor Unit.</label>
                            <input type="number" id="val-falta" placeholder="Kz" class="border p-2 w-full bg-white text-xs">
                        </div>
                        <div>
                            <label class="text-[10px] font-bold text-red-800 block mb-1">Total Desconto</label>
                            <input id="total-faltas" name="Faltas" placeholder="Total" type="number" class="border p-2 w-full bg-white font-bold text-red-600 text-xs" value="${folha.Faltas || ''}">
                        </div>
                    </div>

                    <input name="OutrosDescontos" placeholder="Outros (Vales...)" type="number" class="border p-2 col-span-2" value="${folha.OutrosDescontos || ''}">
                </div>

                <h4 class="font-bold text-gray-700 mb-2 border-b">4. Totais & Banco</h4>
                <div class="grid grid-cols-3 gap-2 mb-3 font-bold">
                    <input id="total-venc" name="TotalVencimentos" class="border p-2 bg-green-50 text-green-700" readonly value="${folha.TotalVencimentos || ''}">
                    <input id="total-desc" name="TotalDescontos" class="border p-2 bg-red-50 text-red-700" readonly value="${folha.TotalDescontos || ''}">
                    <input id="liquido" name="SalarioLiquido" class="border p-2 bg-blue-50 text-blue-700" readonly value="${folha.SalarioLiquido || ''}">
                </div>
                <div class="grid grid-cols-2 gap-2 mb-4 text-sm">
                    <input name="Banco" placeholder="Banco" class="border p-2" value="${folha.Banco || ''}">
                    <input id="folha-iban" name="Iban" placeholder="IBAN" class="border p-2" value="${folha.Iban || ''}">
                </div>

                <button class="w-full bg-green-600 text-white py-2 rounded">Confirmar Pagamento</button>
            </form>
        `);
    },

    printPayslip: (id) => {
        const folha = RHModule.state.cache.folha.find(f => f.ID === id);
        if (!folha) return Utils.toast('Recibo não encontrado.', 'error');

        const func = RHModule.state.cache.allFuncionarios.find(f => f.ID === folha.FuncionarioID) || {};
        const inst = RHModule.state.cache.instituicao[0] || {};
        const showLogo = inst.ExibirLogoRelatorios;

        // Helper for currency
        const kz = (val) => Utils.formatCurrency(val);

        const html = `
            <div class="p-8 font-sans text-gray-900 bg-white max-w-4xl mx-auto border border-gray-200">
                <!-- 1. CABEÇALHO EMPRESA -->
                ${RHModule.buildPDFHeader(inst, 'RECIBO DE VENCIMENTO', 'Ref: ' + folha.Periodo)}
                </div>

                <!-- 2. DADOS DO FUNCIONÁRIO & 3. PERÍODO -->
                <div class="bg-gray-50 p-4 rounded border border-gray-200 mb-6">
                    <div class="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                        <div><span class="font-bold text-gray-600">Funcionário:</span> ${func.Nome}</div>
                        <div><span class="font-bold text-gray-600">Cargo:</span> ${func.Cargo || '-'}</div>
                        <div><span class="font-bold text-gray-600">Matrícula:</span> <span class="font-mono">${func.Codigo || func.ID?.slice(0,8) || '-'}</span></div>
                        <div><span class="font-bold text-gray-600">Departamento:</span> ${func.Departamento || '-'}</div>
                        <div><span class="font-bold text-gray-600">Admissão:</span> ${Utils.formatDate(func.Admissao)}</div>
                        <div><span class="font-bold text-gray-600">NIF/BI:</span> ${func.BI || '-'}</div>
                        <div><span class="font-bold text-gray-600">Banco/IBAN:</span> ${folha.Banco || func.Banco || '-'} / ${folha.Iban || func.Iban || '-'}</div>
                        <div class="col-span-2 border-t border-gray-300 mt-2 pt-2 flex justify-between">
                            <span><span class="font-bold text-gray-600">Período:</span> ${folha.Periodo}</span>
                            <span><span class="font-bold text-gray-600">Processamento:</span> ${Utils.formatDate(folha.CriadoEm)}</span>
                        </div>
                    </div>
                </div>

                <!-- 4. PROVENTOS & 5. DESCONTOS -->
                <div class="mb-6">
                    <table class="w-full text-sm border-collapse border border-gray-300">
                        <thead class="bg-gray-100">
                            <tr>
                                <th class="border border-gray-300 p-2 text-left w-1/2">Descrição</th>
                                <th class="border border-gray-300 p-2 text-right w-1/4 text-green-700">Proventos (+)</th>
                                <th class="border border-gray-300 p-2 text-right w-1/4 text-red-700">Descontos (-)</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr><td class="border border-gray-300 p-2">Salário Base</td><td class="border border-gray-300 p-2 text-right">${kz(folha.SalarioBase)}</td><td class="border border-gray-300 p-2 text-right"></td></tr>
                            ${Number(folha.QtdHoraExtra) > 0 ? `<tr><td class="border border-gray-300 p-2">Horas Extras (${folha.QtdHoraExtra}h)</td><td class="border border-gray-300 p-2 text-right">${kz(Number(folha.QtdHoraExtra) * Number(folha.ValorHoraExtra))}</td><td class="border border-gray-300 p-2 text-right"></td></tr>` : ''}
                            ${Number(folha.Bonus) > 0 ? `<tr><td class="border border-gray-300 p-2">Bónus / Comissões</td><td class="border border-gray-300 p-2 text-right">${kz(folha.Bonus)}</td><td class="border border-gray-300 p-2 text-right"></td></tr>` : ''}
                            ${Number(folha.OutrosVencimentos) > 0 ? `<tr><td class="border border-gray-300 p-2">Outros Proventos</td><td class="border border-gray-300 p-2 text-right">${kz(folha.OutrosVencimentos)}</td><td class="border border-gray-300 p-2 text-right"></td></tr>` : ''}
                            
                            ${Number(folha.INSS) > 0 ? `<tr><td class="border border-gray-300 p-2">Segurança Social (INSS)</td><td class="border border-gray-300 p-2 text-right"></td><td class="border border-gray-300 p-2 text-right">${kz(folha.INSS)}</td></tr>` : ''}
                            ${Number(folha.IRT) > 0 ? `<tr><td class="border border-gray-300 p-2">Imposto s/ Rendimento (IRT)</td><td class="border border-gray-300 p-2 text-right"></td><td class="border border-gray-300 p-2 text-right">${kz(folha.IRT)}</td></tr>` : ''}
                            ${Number(folha.Faltas) > 0 ? `<tr><td class="border border-gray-300 p-2">Faltas / Atrasos</td><td class="border border-gray-300 p-2 text-right"></td><td class="border border-gray-300 p-2 text-right">${kz(folha.Faltas)}</td></tr>` : ''}
                            ${Number(folha.OutrosDescontos) > 0 ? `<tr><td class="border border-gray-300 p-2">Outros Descontos</td><td class="border border-gray-300 p-2 text-right"></td><td class="border border-gray-300 p-2 text-right">${kz(folha.OutrosDescontos)}</td></tr>` : ''}
                            
                            <tr class="bg-gray-50 font-bold">
                                <td class="border border-gray-300 p-2 text-right">TOTAIS</td>
                                <td class="border border-gray-300 p-2 text-right text-green-800">${kz(folha.TotalVencimentos)}</td>
                                <td class="border border-gray-300 p-2 text-right text-red-800">${kz(folha.TotalDescontos)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <!-- 6. RESULTADO FINAL -->
                <div class="flex justify-end mb-8">
                    <div class="bg-gray-100 border border-gray-300 p-4 rounded w-1/3">
                        <div class="flex justify-between mb-2 text-sm">
                            <span>Total Bruto:</span>
                            <span>${kz(folha.TotalVencimentos)}</span>
                        </div>
                        <div class="flex justify-between mb-2 text-sm text-red-600">
                            <span>Total Descontos:</span>
                            <span>- ${kz(folha.TotalDescontos)}</span>
                        </div>
                        <div class="flex justify-between border-t border-gray-300 pt-2 font-bold text-lg text-blue-800">
                            <span>Líquido a Receber:</span>
                            <span>${kz(folha.SalarioLiquido)}</span>
                        </div>
                    </div>
                </div>

                <!-- 8. ASSINATURAS -->
                <div class="grid grid-cols-2 gap-16 mt-12 pt-8">
                    <div class="text-center">
                        <div class="border-t border-gray-400 w-3/4 mx-auto mb-2"></div>
                        <p class="font-bold text-sm text-gray-700">O Empregador</p>
                        <p class="text-xs text-gray-500">(Assinatura e Carimbo)</p>
                    </div>
                    <div class="text-center">
                        <div class="border-t border-gray-400 w-3/4 mx-auto mb-2"></div>
                        <p class="font-bold text-sm text-gray-700">O Funcionário</p>
                        <p class="text-xs text-gray-500">${func.Nome}</p>
                    </div>
                </div>

                <div class="mt-12 text-center text-[10px] text-gray-400 border-t pt-2">
                    &copy; 2026 Delícia da Cidade. Todos os direitos reservados. | Versão 1.0.0
                </div>
            </div>
        `;

        Utils.printNative(html, 'landscape');
    },

    // --- 7. ABA LICENÇAS E AUSÊNCIAS ---
    renderLicencas: async () => {
        RHModule.highlightTab('tab-licencas');

        if (!RHModule.state.cache.licencas) {
            document.getElementById('tab-content').innerHTML = '<div class="text-center p-10"><i class="fas fa-spinner fa-spin text-4xl text-blue-600"></i><p class="mt-2">Carregando licenças...</p></div>';
            try {
                RHModule.state.cache.licencas = await Utils.api('getAll', 'Licencas');
            } catch (e) { return Utils.toast('Erro ao carregar dados.', 'error'); }
        }

        const data = RHModule.state.cache.licencas || [];
        const allFuncs = RHModule.state.cache.allFuncionarios || [];
        const canCreate = Utils.checkPermission('RH', 'criar');
        const canDelete = Utils.checkPermission('RH', 'excluir');
        document.getElementById('tab-content').innerHTML = `
            <div class="flex justify-end gap-2 mb-4">
                <button onclick="RHModule.printTabPDF('licencas')" class="bg-red-600 text-white px-4 py-2 rounded shadow hover:bg-red-700"><i class="fas fa-file-pdf"></i> PDF</button>
                ${canCreate ? `<button onclick="RHModule.modalLicencas()" class="bg-blue-600 text-white px-4 py-2 rounded">+ Nova Licença/Ausência</button>` : ''}
            </div>
            <table class="w-full bg-white rounded shadow text-sm">
                <thead class="bg-gray-100"><tr><th class="p-3 text-left">Matrícula</th><th>Funcionário</th><th>Tipo</th><th>Início</th><th>Retorno</th><th>Ações</th></tr></thead>
                <tbody>
                    ${data.map(r => {
                        const func = allFuncs.find(f => f.ID === r.FuncionarioID) || {};
                        const matricula = func.Codigo || func.ID?.slice(0,8) || r.ID.slice(0,8);
                        return `
                        <tr class="border-t">
                            <td class="p-3 font-bold text-gray-700 font-mono">${matricula}</td>
                            <td class="p-3">${r.FuncionarioNome}</td>
                            <td class="p-3 font-bold">${r.Tipo}</td>
                            <td class="p-3 text-center">${Utils.formatDate(r.Inicio)}</td>
                            <td class="p-3 text-center">${Utils.formatDate(r.Retorno)}</td>
                            <td class="p-3 text-center">${canDelete ? `<button onclick="RHModule.delete('Licencas', '${r.ID}')" class="text-red-500"><i class="fas fa-trash"></i></button>` : ''}</td>
                        </tr>
                    `}).join('')}
                </tbody>
            </table>
        `;
    },

    modalLicencas: () => {
        const funcs = RHModule.state.cache.allFuncionarios;
        
        // Lógica Dinâmica de Exibição
        const toggleForm = (select) => {
            const val = select.value;
            document.querySelectorAll('.dynamic-form').forEach(d => d.classList.add('hidden'));
            
            if(val === 'Licença Médica') document.getElementById('form-medica').classList.remove('hidden');
            else if(val === 'Licença Maternidade') document.getElementById('form-maternidade').classList.remove('hidden');
            else if(val === 'Licença Paternidade') document.getElementById('form-paternidade').classList.remove('hidden');
            else if(val === 'Licença Casamento') document.getElementById('form-casamento').classList.remove('hidden');
            else if(val === 'Ausência Justificada') document.getElementById('form-justificada').classList.remove('hidden');
            else if(val === 'Ausência Não Justificada') document.getElementById('form-nao-justificada').classList.remove('hidden');
        };

        Utils.openModal('Gestão de Ausências', `
            <form onsubmit="RHModule.save(event, 'Licencas')">
                <div class="mb-4">
                    <label class="block text-sm font-bold">Tipo de Licença</label>
                    <select name="Tipo" class="border p-2 rounded w-full bg-blue-50" onchange="(${toggleForm})(this)" required>
                        <option value="">[Selecione]</option>
                        <option>Licença Médica</option>
                        <option>Licença Maternidade</option>
                        <option>Licença Paternidade</option>
                        <option>Licença Casamento</option>
                        <option>Ausência Justificada</option>
                        <option>Ausência Não Justificada</option>
                    </select>
                </div>

                <div class="mb-3">
                    <select name="FuncionarioID" class="border p-2 rounded w-full" onchange="this.form.FuncionarioNome.value = this.options[this.selectedIndex].text" required>
                        <option value="">Selecione o Funcionário...</option>
                        ${funcs.map(f => `<option value="${f.ID}">${f.Nome}</option>`).join('')}
                    </select>
                    <input type="hidden" name="FuncionarioNome">
                </div>

                <!-- FORMULÁRIOS DINÂMICOS -->
                <div id="form-medica" class="dynamic-form hidden space-y-3 border-l-4 border-blue-500 pl-3">
                    <h5 class="font-bold text-blue-600">🩺 Licença Médica</h5>
                    <div class="grid grid-cols-2 gap-2">
                        <input type="date" name="Inicio" class="border p-2 w-full">
                        <input type="date" name="Retorno" class="border p-2 w-full">
                    </div>
                    <input name="Medico" placeholder="Nome do Médico" class="border p-2 w-full">
                    <label class="block text-xs">Anexo Atestado</label>
                    <input type="file" class="border p-1 w-full text-xs">
                </div>

                <div id="form-maternidade" class="dynamic-form hidden space-y-3 border-l-4 border-pink-500 pl-3">
                    <h5 class="font-bold text-pink-600">🤰 Licença Maternidade</h5>
                    <div class="grid grid-cols-2 gap-2">
                        <input type="date" name="InicioMat" class="border p-2 w-full">
                        <input type="date" name="TerminoMat" class="border p-2 w-full">
                    </div>
                    <label class="block text-xs">Certidão Nascimento (Opcional)</label>
                    <input type="file" class="border p-1 w-full text-xs">
                </div>

                <div id="form-paternidade" class="dynamic-form hidden space-y-3 border-l-4 border-blue-800 pl-3">
                    <h5 class="font-bold text-blue-800">👨‍🍼 Licença Paternidade</h5>
                    <div class="grid grid-cols-2 gap-2">
                        <input type="date" name="InicioPat" class="border p-2 w-full">
                        <input type="date" name="TerminoPat" class="border p-2 w-full">
                    </div>
                </div>

                <div id="form-casamento" class="dynamic-form hidden space-y-3 border-l-4 border-purple-500 pl-3">
                    <h5 class="font-bold text-purple-600">💍 Licença Casamento</h5>
                    <input type="date" name="DataCasamento" class="border p-2 w-full">
                    <input type="number" name="DiasLicenca" placeholder="Dias de Licença (3-5)" class="border p-2 w-full">
                </div>

                <div id="form-justificada" class="dynamic-form hidden space-y-3 border-l-4 border-green-500 pl-3">
                    <h5 class="font-bold text-green-600">🚫 Ausência Justificada</h5>
                    <input type="date" name="DataAusencia" class="border p-2 w-full">
                    <input name="Motivo" placeholder="Motivo" class="border p-2 w-full">
                    <textarea name="Justificativa" placeholder="Detalhes..." class="border p-2 w-full h-16"></textarea>
                </div>

                <div id="form-nao-justificada" class="dynamic-form hidden space-y-3 border-l-4 border-red-500 pl-3">
                    <h5 class="font-bold text-red-600">❌ Ausência Não Justificada</h5>
                    <input type="date" name="DataFalta" class="border p-2 w-full">
                    <textarea name="ObsFalta" placeholder="Observações..." class="border p-2 w-full h-16"></textarea>
                </div>

                <button class="w-full bg-blue-600 text-white py-2 rounded mt-4">Salvar Registro</button>
            </form>
        `);
    },

    // --- 8. ABA RELATÓRIOS ---
    renderRelatorios: async () => {
        RHModule.highlightTab('tab-relatorios');
        
        // Relatórios dependem de Frequência (para atrasos). Carregar se necessário.
        if (!RHModule.state.cache.frequencia) {
            document.getElementById('tab-content').innerHTML = '<div class="text-center p-10"><i class="fas fa-spinner fa-spin text-4xl text-blue-600"></i><p class="mt-2">Carregando dados para relatórios...</p></div>';
            try {
                RHModule.state.cache.frequencia = await Utils.api('getAll', 'Frequencia');
            } catch (e) { return Utils.toast('Erro ao carregar dados.', 'error'); }
        }
        
        document.getElementById('tab-content').innerHTML = `
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-xl font-bold">Relatórios de RH</h3>
                <button onclick="RHModule.exportPDF()" class="bg-red-600 text-white px-4 py-2 rounded shadow hover:bg-red-700 transition">
                    <i class="fas fa-file-pdf mr-2"></i> Exportar PDF
                </button>
            </div>
            
            <div class="bg-white p-4 rounded shadow mb-6">
                <h4 class="font-bold text-gray-700 mb-2">Filtros (Período de Admissão)</h4>
                <div class="flex gap-4 items-end">
                    <div><label class="block text-xs font-bold text-gray-500">De</label><input type="date" id="rel-inicio" class="border p-2 rounded"></div>
                    <div><label class="block text-xs font-bold text-gray-500">Até</label><input type="date" id="rel-fim" class="border p-2 rounded"></div>
                    <button onclick="RHModule.updateRelatorios()" class="bg-blue-600 text-white px-4 py-2 rounded"><i class="fas fa-filter"></i> Filtrar</button>
                    <button onclick="document.getElementById('rel-inicio').value='';document.getElementById('rel-fim').value='';RHModule.updateRelatorios()" class="text-gray-500 px-4 py-2 hover:text-gray-700">Limpar</button>
                    <button onclick="RHModule.renderComissoes()" class="bg-green-600 text-white px-4 py-2 rounded ml-auto"><i class="fas fa-dollar-sign"></i> Comissões</button>
                </div>
            </div>

            <div id="print-area" class="p-4 bg-white rounded">
                <div id="pdf-header" class="hidden mb-6 border-b pb-4"></div>
                <div id="relatorio-results"></div>
                <div id="pdf-footer" class="hidden mt-10 pt-4 border-t text-center"></div>
            </div>
        `;
        
        RHModule.updateRelatorios();
    },

    renderComissoes: async () => {
        const start = document.getElementById('rel-inicio').value;
        const end = document.getElementById('rel-fim').value;
        
        if (!start || !end) return Utils.toast('Selecione um período (De/Até) para calcular comissões.', 'warning');

        document.getElementById('relatorio-results').innerHTML = '<div class="text-center p-10"><i class="fas fa-spinner fa-spin text-4xl text-green-600"></i><p>Calculando vendas...</p></div>';

        try {
            const data = await Utils.api('getWaiterSales', null, { startDate: start, endDate: end });
            
            let html = `
                <h4 class="text-lg font-bold text-green-700 mb-4 border-b border-green-200 pb-2">💰 Relatório de Vendas e Comissões (${Utils.formatDate(start)} a ${Utils.formatDate(end)})</h4>
                <div class="bg-white rounded shadow overflow-hidden">
                    <table class="w-full text-sm text-left">
                        <thead class="bg-green-50 text-green-800">
                            <tr>
                                <th class="p-3">Funcionário / Garçom</th>
                                <th class="p-3 text-center">Qtd Eventos</th>
                                <th class="p-3 text-right">Total Vendas</th>
                                <th class="p-3 text-right">Comissão (10%)</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y">
                            ${data.map(r => `
                                <tr class="hover:bg-green-50">
                                    <td class="p-3 font-bold">${r.name}</td>
                                    <td class="p-3 text-center">${r.count}</td>
                                    <td class="p-3 text-right">${Utils.formatCurrency(r.total)}</td>
                                    <td class="p-3 text-right font-bold text-green-600">${Utils.formatCurrency(r.commission)}</td>
                                </tr>
                            `).join('')}
                            ${data.length === 0 ? '<tr><td colspan="4" class="p-4 text-center text-gray-500">Nenhuma venda registrada com responsável neste período.</td></tr>' : ''}
                        </tbody>
                    </table>
                </div>
            `;
            document.getElementById('relatorio-results').innerHTML = html;
        } catch (e) { Utils.toast('Erro ao calcular comissões.', 'error'); }
    },

    updateRelatorios: () => {
        const start = document.getElementById('rel-inicio').value;
        const end = document.getElementById('rel-fim').value;
        const mesAniversario = document.getElementById('rel-mes-aniversario') ? document.getElementById('rel-mes-aniversario').value : (new Date().getMonth() + 1);
        let funcs = RHModule.state.cache.allFuncionarios || []; // Relatórios usam lista completa
        const ferias = RHModule.state.cache.ferias || [];
        const frequencia = RHModule.state.cache.frequencia || [];

        // --- ANIVERSARIANTES DO MÊS ---
        // --- ALERTA DE 1 ANO DE CASA ---
        // --- RELATÓRIO DE FÉRIAS VENCIDAS ---
        const vencidas = [];
        const hoje = new Date();
        
        funcs.forEach(f => {
            if(!f.Admissao) return;
            const adm = new Date(f.Admissao);
            // Cálculo aproximado de anos de casa
            const diffTime = Math.abs(hoje - adm);
            const diffYears = diffTime / (1000 * 60 * 60 * 24 * 365.25); 
            
            // Alerta de 1 ano exato (com margem de 1 mês)
            if (diffYears >= 1 && diffYears < 1.1) {
                Utils.toast(`🎉 ${f.Nome} completou 1 ano de casa! Direito a férias adquirido.`, 'info');
            }
            const direito = Math.floor(diffYears) * 30; // 30 dias por ano
            
            const taken = ferias
                .filter(r => r.FuncionarioID === f.ID && r.Status === 'Aprovado')
                .reduce((acc, r) => acc + (Number(r.Dias) || 0), 0);
                
            const saldo = direito - taken;
            
            if(saldo > 30) vencidas.push({ nome: f.Nome, saldo: Math.floor(saldo), dept: f.Departamento });
        });

        // --- ANIVERSARIANTES DO MÊS ---
        const mesSelecionado = Number(mesAniversario);
        const aniversariantes = funcs.filter(f => {
            if (!f.Nascimento) return false;
            const d = new Date(f.Nascimento);
            return (d.getMonth() + 1) === mesSelecionado;
        }).sort((a, b) => new Date(a.Nascimento).getDate() - new Date(b.Nascimento).getDate());


        // --- RELATÓRIO DE PONTUALIDADE (ATRASOS) ---
        const atrasosMap = {};
        const evolutionMap = {}; // Para o gráfico de linha
        const tempoCasaMap = { '< 1 Ano': 0, '1-3 Anos': 0, '> 3 Anos': 0 };

        frequencia.forEach(r => {
            if (start && r.Data < start) return;
            if (end && r.Data > end) return;
            
            // Regra: Entrada após 08:15 é considerada atraso (Tolerância de 15min)
            if (r.Entrada && r.Entrada > '08:15') {
                atrasosMap[r.FuncionarioNome] = (atrasosMap[r.FuncionarioNome] || 0) + 1;
                
                const month = r.Data.substring(0, 7); // YYYY-MM
                evolutionMap[month] = (evolutionMap[month] || 0) + 1;
            }
        });

        const rankingAtrasos = Object.entries(atrasosMap)
            .map(([nome, qtd]) => ({ nome, qtd }))
            .sort((a, b) => b.qtd - a.qtd)
            .slice(0, 5); // Top 5
            
        const sortedMonths = Object.keys(evolutionMap).sort();
        const evoLabels = sortedMonths.map(m => {
            const [y, mo] = m.split('-');
            return `${mo}/${y}`;
        });
        const evoData = sortedMonths.map(m => evolutionMap[m]);

        // Filtragem por Data de Admissão
        if (start) funcs = funcs.filter(f => f.Admissao >= start);
        if (end) funcs = funcs.filter(f => f.Admissao <= end);

        // Agrupar por Departamento
        const deptMap = {};
        const salaryMap = {};

        // Cálculo de Tempo de Casa para Gráfico
        funcs.forEach(f => {
            if(!f.Admissao) return;
            const anos = (hoje - new Date(f.Admissao)) / (1000 * 60 * 60 * 24 * 365.25);
            if (anos < 1) tempoCasaMap['< 1 Ano']++;
            else if (anos <= 3) tempoCasaMap['1-3 Anos']++;
            else tempoCasaMap['> 3 Anos']++;
        });

        funcs.forEach(f => {
            const dept = f.Departamento || 'Sem Departamento';
            deptMap[dept] = (deptMap[dept] || 0) + 1;
            
            if(!salaryMap[dept]) salaryMap[dept] = { total: 0, count: 0 };
            salaryMap[dept].total += Number(f.Salario || 0);
            salaryMap[dept].count++;
        });

        const reportData = Object.entries(deptMap)
            .map(([dept, count]) => ({ dept, count }))
            .sort((a, b) => b.count - a.count);

        const salaryData = Object.entries(salaryMap).map(([dept, val]) => ({
            dept,
            avg: val.count ? val.total / val.count : 0
        })).sort((a,b) => b.avg - a.avg);

        const total = funcs.length;

        const htmlAniversariantes = `
            <div class="mt-8 mb-8">
                <h4 class="text-lg font-bold text-blue-700 mb-4 border-b border-blue-200 pb-2">🎂 Aniversariantes</h4>
                <div class="mb-2 flex items-center gap-2"><label class="text-xs font-bold text-gray-500 mr-2">Filtrar Mês:</label><select id="rel-mes-aniversario" onchange="RHModule.updateRelatorios()" class="border p-1 rounded text-sm"><option value="1" ${mesSelecionado===1?'selected':''}>Janeiro</option><option value="2" ${mesSelecionado===2?'selected':''}>Fevereiro</option><option value="3" ${mesSelecionado===3?'selected':''}>Março</option><option value="4" ${mesSelecionado===4?'selected':''}>Abril</option><option value="5" ${mesSelecionado===5?'selected':''}>Maio</option><option value="6" ${mesSelecionado===6?'selected':''}>Junho</option><option value="7" ${mesSelecionado===7?'selected':''}>Julho</option><option value="8" ${mesSelecionado===8?'selected':''}>Agosto</option><option value="9" ${mesSelecionado===9?'selected':''}>Setembro</option><option value="10" ${mesSelecionado===10?'selected':''}>Outubro</option><option value="11" ${mesSelecionado===11?'selected':''}>Novembro</option><option value="12" ${mesSelecionado===12?'selected':''}>Dezembro</option></select> <button onclick="RHModule.printAniversariantesFestivo()" class="text-xs bg-pink-500 text-white px-2 py-1 rounded hover:bg-pink-600"><i class="fas fa-birthday-cake"></i> PDF Festivo</button></div>
                <div class="bg-white p-4 border rounded shadow overflow-x-auto">
                    <table class="w-full text-sm">
                        <thead class="bg-blue-50 text-blue-800">
                            <tr><th class="p-2 text-left">Dia</th><th class="p-2 text-left">Funcionário</th><th class="p-2 text-left">Departamento</th></tr>
                        </thead>
                        <tbody>
                            ${aniversariantes.map(a => `<tr class="border-b"><td class="p-2 font-bold">${new Date(a.Nascimento).getDate()}</td><td class="p-2">${a.Nome}</td><td class="p-2">${a.Departamento || '-'}</td></tr>`).join('')}
                            ${aniversariantes.length === 0 ? '<tr><td colspan="3" class="p-4 text-center text-gray-500">Nenhum aniversariante neste mês.</td></tr>' : ''}
                        </tbody>
                    </table>
                </div>
            </div>`;

        const htmlVencidas = `
            <div class="mt-8 mb-8">
                <h4 class="text-lg font-bold text-red-700 mb-4 border-b border-red-200 pb-2">⚠️ Funcionários com Férias Vencidas (>30 dias)</h4>
                <div class="bg-white p-4 border rounded shadow overflow-x-auto">
                    <table class="w-full text-sm">
                        <thead class="bg-red-50 text-red-800">
                            <tr><th class="p-2 text-left">Funcionário</th><th class="p-2 text-left">Departamento</th><th class="p-2 text-right">Saldo (Dias)</th></tr>
                        </thead>
                        <tbody>
                            ${vencidas.map(v => `<tr class="border-b"><td class="p-2 font-bold">${v.nome}</td><td class="p-2">${v.dept || '-'}</td><td class="p-2 text-right font-bold text-red-600">${v.saldo}</td></tr>`).join('')}
                            ${vencidas.length === 0 ? '<tr><td colspan="3" class="p-4 text-center text-gray-500">Nenhuma pendência encontrada.</td></tr>' : ''}
                        </tbody>
                    </table>
                </div>
            </div>`;
            
        const htmlAtrasos = `
            <div class="mt-6 bg-white p-4 border rounded shadow">
                <h4 class="font-bold text-gray-700 mb-4 border-b pb-2">🕒 Ranking de Atrasos (Entrada após 08:15)</h4>
                <table class="w-full text-sm">
                    <thead class="bg-orange-50 text-orange-800">
                        <tr><th class="p-2 text-left">Funcionário</th><th class="p-2 text-right">Qtd. Atrasos</th></tr>
                    </thead>
                    <tbody>
                        ${rankingAtrasos.map(r => `<tr class="border-b"><td class="p-2 font-medium">${r.nome}</td><td class="p-2 text-right font-bold text-orange-600">${r.qtd}</td></tr>`).join('')}
                        ${rankingAtrasos.length === 0 ? '<tr><td colspan="2" class="p-4 text-center text-gray-500">Nenhum atraso registrado no período.</td></tr>' : ''}
                    </tbody>
                </table>
            </div>`;

        const html = `
            <h4 class="text-lg font-bold text-gray-700 mb-4">Lotação por Departamento ${start || end ? '(Filtrado)' : '(Geral)'}</h4>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="bg-white p-4 border rounded">
                    <table class="w-full text-sm">
                        <thead class="bg-gray-100">
                            <tr><th class="p-2 text-left">Departamento</th><th class="p-2 text-right">Funcionários</th><th class="p-2 text-right">%</th></tr>
                        </thead>
                        <tbody>
                            ${reportData.map(r => {
                                const pct = total > 0 ? ((r.count / total) * 100).toFixed(1) : 0;
                                return `<tr class="border-b"><td class="p-2 font-medium">${r.dept}</td><td class="p-2 text-right font-bold">${r.count}</td><td class="p-2 text-right text-gray-500">${pct}%</td></tr>`;
                            }).join('')}
                            <tr class="bg-gray-50 font-bold"><td class="p-2">TOTAL</td><td class="p-2 text-right">${total}</td><td class="p-2 text-right">100%</td></tr>
                        </tbody>
                    </table>
                </div>
                <div class="bg-white p-4 border rounded flex flex-col items-center justify-center">
                     <div class="w-full h-64"><canvas id="chartRelatorioRH"></canvas></div>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                <div class="bg-white p-4 border rounded shadow">
                    <h4 class="font-bold text-gray-700 mb-4">Média Salarial por Departamento (Kz)</h4>
                    <div class="h-64"><canvas id="chartSalarios"></canvas></div>
                </div>
                <div class="bg-white p-4 border rounded shadow">
                    <h4 class="font-bold text-gray-700 mb-4">Evolução de Atrasos</h4>
                    <div class="h-64"><canvas id="chartEvolucaoAtrasos"></canvas></div>
                </div>
                <div class="bg-white p-4 border rounded shadow">
                    <h4 class="font-bold text-gray-700 mb-4">Tempo de Casa</h4>
                    <div class="h-64"><canvas id="chartTempoCasa"></canvas></div>
                </div>
            </div>
        ` + htmlAniversariantes + htmlVencidas + htmlAtrasos;

        document.getElementById('relatorio-results').innerHTML = html;

        if(typeof Chart !== 'undefined' && reportData.length > 0) {
            new Chart(document.getElementById('chartRelatorioRH'), {
                type: 'doughnut',
                data: { labels: reportData.map(r => r.dept), datasets: [{ data: reportData.map(r => r.count), backgroundColor: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#6B7280', '#EC4899', '#14B8A6'] }] },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } }
            });
            
            new Chart(document.getElementById('chartSalarios'), {
                type: 'bar',
                data: { 
                    labels: salaryData.map(d => d.dept), 
                    datasets: [{ 
                        label: 'Média Salarial', 
                        data: salaryData.map(d => d.avg), 
                        backgroundColor: '#10B981',
                        borderRadius: 4
                    }] 
                },
                options: { 
                    responsive: true, 
                    maintainAspectRatio: false, 
                    plugins: { legend: { display: false } },
                    scales: { y: { beginAtZero: true, ticks: { callback: (v) => Utils.formatCurrency(v) } } }
                }
            });

            new Chart(document.getElementById('chartEvolucaoAtrasos'), {
                type: 'line',
                data: {
                    labels: evoLabels,
                    datasets: [{
                        label: 'Atrasos',
                        data: evoData,
                        borderColor: '#F97316',
                        backgroundColor: 'rgba(249, 115, 22, 0.1)',
                        fill: true,
                        tension: 0.3
                    }]
                },
                options: { 
                    responsive: true, 
                    maintainAspectRatio: false,
                    scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
                }
            });

            new Chart(document.getElementById('chartTempoCasa'), {
                type: 'bar',
                data: {
                    labels: Object.keys(tempoCasaMap),
                    datasets: [{
                        label: 'Funcionários',
                        data: Object.values(tempoCasaMap),
                        backgroundColor: ['#60A5FA', '#34D399', '#FBBF24']
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
            });
        } else if (total === 0) {
            document.getElementById('relatorio-results').innerHTML = '<p class="text-center text-gray-500 py-10">Nenhum funcionário encontrado neste período.</p>';
        }
    },

    exportPDF: () => {
        const inst = RHModule.state.cache.instituicao[0] || {};
        const user = Utils.getUser();
        const showLogo = inst.ExibirLogoRelatorios;
        
        // Captura o conteúdo atual do relatório
        const content = document.getElementById('relatorio-results').innerHTML;
        
        const html = `
            <div class="p-8 font-sans text-gray-900 bg-white">
            ${RHModule.buildPDFHeader(inst, 'RELATÓRIO', '')}
            
            ${content}
            
            <div class="mt-10 pt-4 border-t text-center">
                <p class="font-bold text-gray-800">${user.Nome}</p>
                <p class="text-sm text-gray-600">${user.Assinatura || ''}</p>
                <p class="text-xs text-gray-400 mt-1">&copy; 2026 Delícia da Cidade. Todos os direitos reservados. | Versão 1.0.0</p>
            </div>
        `;
        
        Utils.printNative(html, 'landscape');
    },

    printAniversariantesFestivo: () => {
        const mesSelect = document.getElementById('rel-mes-aniversario');
        const mes = Number(mesSelect.value);
        const mesNome = mesSelect.options[mesSelect.selectedIndex].text;
        
        const funcs = RHModule.state.cache.allFuncionarios.filter(f => {
            if (!f.Nascimento) return false;
            const d = new Date(f.Nascimento);
            return (d.getMonth() + 1) === mes;
        }).sort((a, b) => new Date(a.Nascimento).getDate() - new Date(b.Nascimento).getDate());

        if (funcs.length === 0) return Utils.toast('Nenhum aniversariante neste mês.', 'warning');

        const html = `
            <div style="font-family: 'Comic Sans MS', 'Chalkboard SE', sans-serif; padding: 20px; border: 5px double #FF69B4; border-radius: 15px; background-color: #FFF0F5; text-align: center;">
                <h1 style="color: #FF1493; font-size: 32px; margin-bottom: 5px;">🎉 Feliz Aniversário! 🎉</h1>
                <h2 style="color: #C71585; font-size: 24px; margin-top: 0;">Aniversariantes de ${mesNome}</h2>
                <p style="color: #555; font-style: italic;">"A vida é um presente, e cada aniversário é um novo começo."</p>
                
                <div style="margin-top: 30px; display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px;">
                    ${funcs.map(f => {
                        const dia = new Date(f.Nascimento).getDate();
                        return `
                        <div style="background: white; padding: 15px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); border: 2px solid #FFB6C1; display: flex; align-items: center; gap: 15px;">
                            <div style="background: #FF69B4; color: white; width: 50px; height: 50px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 20px;">
                                ${dia}
                            </div>
                            <div style="text-align: left;">
                                <div style="font-weight: bold; font-size: 18px; color: #333;">${f.Nome}</div>
                                <div style="color: #666; font-size: 14px;">${f.Departamento || 'Equipe'}</div>
                            </div>
                        </div>
                        `;
                    }).join('')}
                </div>

                <div style="margin-top: 40px; font-size: 12px; color: #888;">
                    🎈 Desejamos muitas felicidades, saúde e sucesso a todos! 🎈
                </div>
            </div>
            <style>
                @media print {
                    body { -webkit-print-color-adjust: exact; }
                    @page { margin: 10mm; }
                }
            </style>
        `;

        Utils.printNative(html, 'landscape');
    },

    printIndividualFrequency: async (funcId) => {
        const func = RHModule.state.cache.allFuncionarios.find(f => f.ID === funcId);
        if (!func) return Utils.toast('Funcionário não encontrado.', 'error');

        // Garante que a escala esteja carregada para mostrar o "Previsto"
        if (!RHModule.state.cache.escala) {
             try {
                RHModule.state.cache.escala = await Utils.api('getAll', 'Escala');
            } catch (e) { RHModule.state.cache.escala = []; }
        }
        const escalaFunc = RHModule.state.cache.escala.filter(e => e.FuncionarioID === funcId);

        // Determinar o mês do relatório (baseado no filtro ou mês atual)
        let targetMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
        if (RHModule.state.filterFrequenciaStart) {
            targetMonth = RHModule.state.filterFrequenciaStart.slice(0, 7);
        }

        const [year, month] = targetMonth.split('-');
        const daysInMonth = new Date(year, month, 0).getDate();
        
        // Filtrar registros do funcionário no mês
        const records = RHModule.state.cache.frequencia.filter(r => 
            r.FuncionarioID === funcId && r.Data.startsWith(targetMonth)
        );

        // Cálculos do Resumo
        let presencas = 0;
        let faltas = 0;
        let atrasos = 0;
        let totalHoras = 0;
        let diasEscalados = 0;

        // Mapa de registros por dia para preencher a tabela completa
        const mapRecords = {};
        records.forEach(r => mapRecords[r.Data] = r);

        // Gerar linhas da tabela (1 a 31)
        let rowsHtml = '';
        const daysOfWeek = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

        for (let i = 1; i <= daysInMonth; i++) {
            const dayStr = `${year}-${month}-${String(i).padStart(2, '0')}`;
            const dateObj = new Date(dayStr);
            const jsDay = dateObj.getDay(); // 0=Dom, 1=Seg...
            const dbDay = jsDay === 0 ? 7 : jsDay; // 1=Seg... 7=Dom
            
            // Lógica de Escala (Previsto)
            const configEscala = escalaFunc.find(e => e.DiaSemana === dbDay);
            let isWorkingDay = false;
            let horarioPrevisto = 'Folga';

            if (configEscala) {
                if (configEscala.Tipo === 'Trabalho') {
                    isWorkingDay = true;
                    horarioPrevisto = '08:00 - 16:00'; // Padrão Diarista
                } else if (configEscala.Tipo === 'Turno') {
                    isWorkingDay = true;
                    horarioPrevisto = 'Plantão 24h';
                }
            } else {
                // Fallback se não tiver escala configurada
                if (func.Turno === 'Diarista' && dbDay <= 5) {
                    isWorkingDay = true;
                    horarioPrevisto = '08:00 - 16:00';
                } else if (func.Turno === 'Regime de Turno') {
                    horarioPrevisto = 'Escala'; 
                }
            }

            if (isWorkingDay) diasEscalados++;

            const r = mapRecords[dayStr] || {};
            const entrada = r.Entrada || '';
            const saida = r.Saida || '';
            let status = r.Status || '';
            const obs = r.Observacoes || '';
            
            // Se não tem registro mas era dia de trabalho e já passou a data
            if (!r.ID && isWorkingDay && dateObj < new Date()) {
                status = 'Falta (N/C)'; // Não compareceu / Não cadastrado
            } else if (!status && !isWorkingDay) {
                status = 'Folga';
            }

            // Contadores
            if (status === 'Presente' || (entrada && status !== 'Falta' && status !== 'Atraso')) presencas++;
            if (status === 'Falta' || status === 'Falta (N/C)') faltas++;
            if (status === 'Atraso') atrasos++;

            let horasDia = '';
            if (entrada && saida) {
                const [h1, m1] = String(entrada).split(':').map(Number);
                const [h2, m2] = String(saida).split(':').map(Number);
                let diff = (h2 * 60 + m2) - (h1 * 60 + m1);
                if (diff < 0) diff += 24 * 60;
                const h = Math.floor(diff / 60);
                const m = diff % 60;
                horasDia = `${h}:${String(m).padStart(2,'0')}`;
                totalHoras += diff / 60;
            }

            // Estilização
            let rowClass = '';
            if (status.includes('Falta')) rowClass = 'bg-red-50 text-red-800';
            else if (status === 'Atraso') rowClass = 'bg-yellow-50 text-yellow-800';
            else if (status === 'Folga') rowClass = 'bg-gray-50 text-gray-400';

            rowsHtml += `
                <tr class="${rowClass} border-b border-gray-200">
                    <td class="border-r p-1 text-center">${String(i).padStart(2, '0')}/${month}</td>
                    <td class="border-r p-1 text-center text-xs">${daysOfWeek[jsDay].slice(0,3)}</td>
                    <td class="border-r p-1 text-center text-xs">${horarioPrevisto}</td>
                    <td class="border-r p-1 text-center font-mono">${entrada || '--:--'}</td>
                    <td class="border-r p-1 text-center font-mono">${saida || '--:--'}</td>
                    <td class="border-r p-1 text-center font-mono">${horasDia}</td>
                    <td class="border-r p-1 text-center text-xs font-bold">${status}</td>
                    <td class="p-1 text-xs truncate max-w-[150px]">${obs}</td>
                </tr>
            `;
        }

        const inst = RHModule.state.cache.instituicao[0] || {};
        const showLogo = inst.ExibirLogoRelatorios;

        const html = `
            <div class="p-8 font-sans text-gray-900 bg-white">
                <!-- Header -->
                ${RHModule.buildPDFHeader(inst, 'ESPELHO DE PONTO', 'Período: ' + month + '/' + year)}

                <!-- Info Funcionário -->
                <div class="mb-6 bg-gray-50 p-3 rounded border border-gray-200 text-sm">
                    <div class="flex justify-between mb-2">
                        <div><span class="font-bold">Funcionário:</span> ${func.Nome}</div>
                        <div><span class="font-bold">ID:</span> ${func.ID}</div>
                        <div><span class="font-bold">Matrícula:</span> ${func.Codigo || func.ID.slice(0,8)}</div>
                    </div>
                    <div class="flex justify-between">
                        <div><span class="font-bold">Cargo:</span> ${func.Cargo || '-'}</div>
                        <div><span class="font-bold">Departamento:</span> ${func.Departamento || '-'}</div>
                    </div>
                </div>

                <!-- Tabela -->
                <table class="w-full text-sm border-collapse border border-gray-300 mb-6">
                    <thead class="bg-gray-100">
                        <tr>
                            <th class="border p-2 w-16">Data</th>
                            <th class="border p-2 w-12">Dia</th>
                            <th class="border p-2">Escala</th>
                            <th class="border p-2">Entrada</th>
                            <th class="border p-2">Saída</th>
                            <th class="border p-2">Horas</th>
                            <th class="border p-2">Status</th>
                            <th class="border p-2">Obs</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                </table>

                <!-- Resumo -->
                <div class="flex gap-4 mb-8 text-sm">
                    <div class="border rounded p-2 flex-1 bg-gray-50">
                        <div class="font-bold border-b pb-1 mb-1">Resumo de Dias</div>
                        <div class="flex justify-between"><span>Dias Escalados:</span> <strong>${diasEscalados}</strong></div>
                        <div class="flex justify-between"><span>Presenças:</span> <strong>${presencas}</strong></div>
                    </div>
                    <div class="border rounded p-2 flex-1 bg-red-50 border-red-100">
                        <div class="font-bold border-b pb-1 mb-1 text-red-800">Ocorrências</div>
                        <div class="flex justify-between"><span>Faltas:</span> <strong class="text-red-600">${faltas}</strong></div>
                        <div class="flex justify-between"><span>Atrasos:</span> <strong class="text-yellow-600">${atrasos}</strong></div>
                    </div>
                    <div class="border rounded p-2 flex-1 bg-blue-50 border-blue-100">
                        <div class="font-bold border-b pb-1 mb-1 text-blue-800">Banco de Horas</div>
                        <div class="flex justify-between"><span>Horas Trabalhadas:</span> <strong>${totalHoras.toFixed(2)}h</strong></div>
                    </div>
                </div>

                <!-- Assinaturas -->
                <div class="mt-12 grid grid-cols-2 gap-16 text-center text-xs">
                    <div>
                        <div class="border-t border-gray-400 w-3/4 mx-auto mb-1"></div>
                        <p class="font-bold">Responsável RH</p>
                    </div>
                    <div>
                        <div class="border-t border-gray-400 w-3/4 mx-auto mb-1"></div>
                        <p class="font-bold">Funcionário</p>
                        <p class="text-gray-500">Declaro que recebi o espelho de ponto e conferi os lançamentos.</p>
                    </div>
                </div>
            </div>
        `;

        Utils.printNative(html, 'landscape');
    },

    printTabPDF: (type) => {
        const inst = RHModule.state.cache.instituicao[0] || {};
        const showLogo = inst.ExibirLogoRelatorios;
        const user = Utils.getUser();
        let title = '';
        let filename = '';
        let content = '';
        let orientation = 'portrait';

        // Helper para construir tabela
        const buildTable = (headers, rows) => `
            <table class="w-full text-sm border-collapse border border-gray-300">
                <thead class="bg-gray-100">
                    <tr>${headers.map(h => `<th class="border p-2 text-left">${h}</th>`).join('')}</tr>
                </thead>
                <tbody>
                    ${rows.map(row => `<tr>${row.map(cell => `<td class="border p-2">${cell || '-'}</td>`).join('')}</tr>`).join('')}
                </tbody>
            </table>
        `;

        if (type === 'funcionarios') {
            title = 'Lista de Funcionários';
            filename = 'funcionarios.pdf';
            orientation = 'landscape';
            let data = RHModule.state.cache.allFuncionarios || []; // Exportar todos, não só a página
            
            // Aplicar filtros atuais
            if (RHModule.state.filterTerm) {
                const term = RHModule.state.filterTerm.toLowerCase();
                data = data.filter(f => 
                    (f.Nome && f.Nome.toLowerCase().includes(term)) || 
                    (f.BI && f.BI.toLowerCase().includes(term)) ||
                    (f.Departamento && f.Departamento.toLowerCase().includes(term))
                );
            }
            data.sort((a, b) => a.Nome.localeCompare(b.Nome));

            const headers = ['Matrícula', 'Nome', 'Cargo', 'Departamento', 'Turno', 'Telefone', 'Admissão', 'Status'];
            const rows = data.map(f => [f.Codigo || '-', f.Nome, f.Cargo, f.Departamento || '-', f.Turno || '-', f.Telefone || '-', Utils.formatDate(f.Admissao), f.Status]);
            content = buildTable(headers, rows);
        }
        else if (type === 'frequencia') {
            title = 'Relatório de Frequência';
            filename = 'frequencia.pdf';
            let data = RHModule.state.cache.frequencia || [];

            // Aplicar filtro de data também no PDF
            const { filterFrequenciaStart, filterFrequenciaEnd } = RHModule.state;
            if (filterFrequenciaStart) {
                data = data.filter(r => r.Data >= filterFrequenciaStart);
            }
            if (filterFrequenciaEnd) {
                data = data.filter(r => r.Data <= filterFrequenciaEnd);
            }

            data.sort((a,b) => new Date(b.Data) - new Date(a.Data));
            
            const headers = ['Matrícula', 'Nome', 'Data', 'Entrada', 'Saída', 'Total', 'Status'];
            const rows = data.map(r => {
                const func = RHModule.state.cache.allFuncionarios.find(f => f.ID === r.FuncionarioID);
                const is24h = func && func.Turno === 'Regime de Turno';
                const refHours = is24h ? 24 : 8;
                
                const calcHours = (start, end, is24h) => {
                    if(!start || !end) return 0;
                    const [h1, m1] = start.split(':').map(Number);
                    const [h2, m2] = end.split(':').map(Number);
                    let diff = (h2*60+m2) - (h1*60+m1);
                    if (diff <= 0) diff += 24 * 60; 
                    else if (is24h && diff < 240) diff += 24 * 60;
                    return diff / 60;
                };
                
                const total = calcHours(r.Entrada, r.Saida, is24h);
                const diff = total - refHours;
                
                let statusText = 'Normal';
                if (total === 0) statusText = '1 Falta';
                else if (diff < 0) statusText = `Meia Falta (${diff.toFixed(1)}h)`;
                else if (diff > 0) statusText = `Extra: +${diff.toFixed(1)}h`;
                
                return [func ? (func.Codigo || '-') : '-', r.FuncionarioNome, Utils.formatDate(r.Data), r.Entrada, r.Saida, total.toFixed(2)+'h', statusText];
            });
            content = buildTable(headers, rows);
        } 
        else if (type === 'ferias') {
            title = 'Relatório de Férias';
            filename = 'ferias.pdf';
            const data = RHModule.state.cache.ferias || [];
            const allFuncs = RHModule.state.cache.allFuncionarios || [];
            const headers = ['Matrícula', 'Nome', 'Início', 'Retorno', 'Dias', 'Status'];
            const rows = data.map(r => {
                const func = allFuncs.find(f => f.ID === r.FuncionarioID) || {};
                const matricula = func.Codigo || func.ID?.slice(0,8) || r.Codigo || '-';
                return [matricula, r.FuncionarioNome, Utils.formatDate(r.DataInicio), Utils.formatDate(r.DataFim), r.Dias, r.Status];
            });
            content = buildTable(headers, rows);
        }
        else if (type === 'avaliacoes') {
            if (!RHModule.state.cache.avaliacoes) return Utils.toast('⚠️ Abra a aba "Avaliação" primeiro para carregar os dados.', 'error');
            title = 'Relatório de Avaliações';
            filename = 'avaliacoes.pdf';
            const data = RHModule.state.cache.avaliacoes || [];
            const allFuncs = RHModule.state.cache.allFuncionarios || [];
            const headers = ['Matrícula', 'Funcionário', 'Data', 'Média', 'Conclusão'];
            const rows = data.map(r => {
                const func = allFuncs.find(f => f.ID === r.FuncionarioID) || {};
                const matricula = func.Codigo || func.ID?.slice(0,8) || r.Codigo || '-';
                return [matricula, r.FuncionarioNome, Utils.formatDate(r.DataAvaliacao), r.MediaFinal, r.Conclusao];
            });
            content = buildTable(headers, rows);
        }
        else if (type === 'treinamento') {
            if (!RHModule.state.cache.treinamentos) return Utils.toast('⚠️ Abra a aba "Treinamento" primeiro para carregar os dados.', 'error');
            title = 'Relatório de Treinamentos';
            filename = 'treinamentos.pdf';
            orientation = 'landscape';
            const data = RHModule.state.cache.treinamentos || [];
            const allFuncs = RHModule.state.cache.allFuncionarios || [];
            const headers = ['Matrícula', 'Nome', 'Título', 'Tipo', 'Início', 'Término', 'Status'];
            const rows = data.map(r => {
                const func = allFuncs.find(f => f.ID === r.FuncionarioID) || {};
                const matricula = func.Codigo || func.ID?.slice(0,8) || r.ID;
                return [matricula, r.FuncionarioNome, r.Titulo, r.Tipo, Utils.formatDate(r.Inicio), Utils.formatDate(r.Termino), r.Status];
            });
            content = buildTable(headers, rows);
        }
        else if (type === 'folha') {
            if (!RHModule.state.cache.folha) return Utils.toast('⚠️ Abra a aba "Folha" primeiro para carregar os dados.', 'error');
            title = 'Folha de Pagamento';
            filename = 'folha.pdf';
            orientation = 'landscape';
            const data = RHModule.state.cache.folha || [];
            const allFuncs = RHModule.state.cache.allFuncionarios || [];
            const headers = ['Matrícula', 'Nome', 'Período', 'Base', 'Vencimentos', 'Descontos', 'Líquido', 'Banco'];
            const rows = data.map(r => {
                const func = allFuncs.find(f => f.ID === r.FuncionarioID) || {};
                const matricula = func.Codigo || func.ID?.slice(0,8) || r.ID;
                return [matricula, r.FuncionarioNome, r.Periodo, Utils.formatCurrency(r.SalarioBase), Utils.formatCurrency(r.TotalVencimentos), Utils.formatCurrency(r.TotalDescontos), Utils.formatCurrency(r.SalarioLiquido), r.Banco];
            });
            content = buildTable(headers, rows);
        }
        else if (type === 'licencas') {
            if (!RHModule.state.cache.licencas) return Utils.toast('⚠️ Abra a aba "Licenças" primeiro para carregar os dados.', 'error');
            title = 'Relatório de Licenças';
            filename = 'licencas.pdf';
            const data = RHModule.state.cache.licencas || [];
            const allFuncs = RHModule.state.cache.allFuncionarios || [];
            const headers = ['Matrícula', 'Funcionário', 'Tipo', 'Início', 'Retorno'];
            const rows = data.map(r => {
                const func = allFuncs.find(f => f.ID === r.FuncionarioID) || {};
                const matricula = func.Codigo || func.ID?.slice(0,8) || r.ID;
                return [matricula, r.FuncionarioNome, r.Tipo, Utils.formatDate(r.Inicio), Utils.formatDate(r.Retorno)];
            });
            content = buildTable(headers, rows);
        }

        const html = `
            <div class="p-8 font-sans text-gray-900 bg-white">
                ${RHModule.buildPDFHeader(inst, title.toUpperCase(), 'Por: ' + user.Nome)}
                ${content}
                <div class="mt-8 text-center text-xs text-gray-400">&copy; 2026 ${inst.NomeFantasia || 'Empresa'}. Todos os direitos reservados.</div>
            </div>
        `;

        Utils.printNative(html, 'landscape');
    },

    // Função auxiliar para gerar ID de Funcionário (Iniciais + Sequencial)
    generateEmployeeId: (nomeCompleto, listaIdsExistentes) => {
        const parts = nomeCompleto.trim().split(/\s+/).filter(p => p.length > 0);
        if (parts.length === 0) return 'FUNC-01';
        
        const first = parts[0][0].toUpperCase();
        // Se tiver apenas um nome, repete a inicial (ex: "Maria" -> "MM")
        const last = parts.length > 1 ? parts[parts.length - 1][0].toUpperCase() : first;
        const prefix = first + last;

        let seq = 1;
        let newId = `${prefix}-${String(seq).padStart(2, '0')}`;

        while (listaIdsExistentes.includes(newId)) {
            seq++;
            newId = `${prefix}-${String(seq).padStart(2, '0')}`;
        }
        return newId;
    },

    // Função para gerar ID de Férias (Iniciais + Sequencial)
    gerarIdFuncionario: (nomeCompleto, idsExistentes) => {
        const partes = nomeCompleto.trim().split(" ");
        const primeira = partes[0][0].toUpperCase();
        const ultima = partes[partes.length - 1][0].toUpperCase();

        const base = `${primeira}${ultima}`;

        let contador = 1;
        let novoId = `${base}-${String(contador).padStart(2, "0")}`;

        while (idsExistentes.includes(novoId)) {
            contador++;
            novoId = `${base}-${String(contador).padStart(2, "0")}`;
        }

        return novoId;
    },

    // ============================================================
    // === MÓDULO: ESCALA MENSAL ===================================
    // ============================================================

    escalaState: {
        year: new Date().getFullYear(),
        month: new Date().getMonth(),
        subTab: 'calendario',
        overrides: {},
        assignments: {},
        grupoInicialDia1: 'B'
    },

    // Carrega todos os assignments da tabela EscalaConfig no Supabase
    escalaCarregarAssignments: async () => {
        try {
            const rows = await Utils.api('getAll', 'EscalaConfig');
            const assignments = {};
            (rows || []).forEach(r => {
                assignments[r.FuncionarioID] = {
                    id: r.ID,           // ID do registo no Supabase (necessário para update)
                    tipo: r.Tipo,       // 'diarista' | 'A' | 'B' | 'C'
                    folgaFixa: r.FolgaFixa || null,
                    fdsAlterna: r.FdsAlterna !== false && r.FdsAlterna !== 'false',
                    fdsTrabalhaS1: r.FdsTrabalhaS1 !== false && r.FdsTrabalhaS1 !== 'false'
                };
            });
            RHModule.escalaState.assignments = assignments;
        } catch(e) {
            console.warn('EscalaConfig: usando cache local como fallback', e);
            // Fallback para localStorage se BD não responder
            try {
                const saved = localStorage.getItem('escala_assignments');
                if (saved) RHModule.escalaState.assignments = JSON.parse(saved);
            } catch(e2) { RHModule.escalaState.assignments = {}; }
        }
    },

    // Grava/actualiza um assignment individual na tabela EscalaConfig
    escalaSalvarAssignments: async (funcId, cfg) => {
        const assignments = RHModule.escalaState.assignments;
        try {
            if (!cfg || !cfg.tipo) {
                // REMOVER: apaga registo da BD se existir
                const existing = assignments[funcId];
                if (existing && existing.id) {
                    await Utils.api('delete', 'EscalaConfig', null, existing.id);
                }
                delete assignments[funcId];
            } else {
                // UPSERT: cria ou actualiza o registo
                const payload = {
                    FuncionarioID:  funcId,
                    Tipo:           cfg.tipo,
                    FolgaFixa:      cfg.folgaFixa || null,
                    FdsAlterna:     cfg.fdsAlterna !== false,
                    FdsTrabalhaS1:  cfg.fdsTrabalhaS1 !== false
                };
                const existing = assignments[funcId];
                if (existing && existing.id) payload.ID = existing.id; // UPDATE
                const result = await Utils.api('save', 'EscalaConfig', payload);
                // Guarda o ID retornado para futuras actualizações
                assignments[funcId] = { ...cfg, id: result?.ID || payload.ID };
            }
            // Fallback: mantém cópia local sincronizada
            localStorage.setItem('escala_assignments', JSON.stringify(assignments));
        } catch(e) {
            console.error('Erro ao gravar EscalaConfig:', e);
            Utils.toast('Erro ao guardar na base de dados: ' + e.message, 'error');
            throw e;
        }
    },

    escalaGetDiaristas: () => {
        const allFuncs = RHModule.state.cache.allFuncionarios || [];
        const assignments = RHModule.escalaState.assignments;
        return allFuncs
            .filter(f => f.Status === 'Ativo' && assignments[f.ID] && assignments[f.ID].tipo === 'diarista')
            .map(f => ({
                id: f.ID,
                nome: f.Nome,
                folgaFixa: assignments[f.ID].folgaFixa || null,
                fdsAlterna: assignments[f.ID].fdsAlterna !== false,
                fdsTrabalhaS1: assignments[f.ID].fdsTrabalhaS1 !== false
            }));
    },

    escalaGetGrupos: () => {
        const allFuncs = RHModule.state.cache.allFuncionarios || [];
        const assignments = RHModule.escalaState.assignments;
        const grupos = { A: [], B: [], C: [] };
        allFuncs.filter(f => f.Status === 'Ativo').forEach(f => {
            const tipo = assignments[f.ID] && assignments[f.ID].tipo;
            if (tipo === 'A' || tipo === 'B' || tipo === 'C') grupos[tipo].push(f.Nome);
        });
        return grupos;
    },

    escalaGetNaoAtribuidos: () => {
        const allFuncs = RHModule.state.cache.allFuncionarios || [];
        const assignments = RHModule.escalaState.assignments;
        return allFuncs.filter(f => f.Status === 'Ativo' && (!assignments[f.ID] || !assignments[f.ID].tipo));
    },

    getGrupoTurnistaParaData: (date) => {
        const es = RHModule.escalaState;
        const dia1 = new Date(date.getFullYear(), date.getMonth(), 1);
        const seq = ['B', 'C', 'A'];
        const startIdx = seq.indexOf(es.grupoInicialDia1 || 'B');
        const diffDays = Math.floor((date - dia1) / (1000 * 60 * 60 * 24));
        const cyclePos = ((diffDays % 3) + 3) % 3;
        return seq[(startIdx + cyclePos) % 3];
    },

    getDiaristaStatusAuto: (d, date) => {
        const jsDay = date.getDay();
        const isWeekend = jsDay === 0 || jsDay === 6;
        const weekdayNum = jsDay === 0 ? 7 : jsDay;

        if (!d.fdsAlterna) {
            if (isWeekend) return 'folga';
            if (d.folgaFixa && weekdayNum === d.folgaFixa) return 'folga';
            return 'trabalho';
        }

        if (isWeekend) {
            const dayOfMonth = date.getDate();
            const firstDayOfWeek = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
            const weekNum = Math.floor((dayOfMonth - 1 + firstDayOfWeek) / 7);
            const trabalha = weekNum % 2 === 0 ? d.fdsTrabalhaS1 : !d.fdsTrabalhaS1;
            return trabalha ? 'trabalho' : 'folga';
        }

        if (d.folgaFixa && weekdayNum === d.folgaFixa) return 'folga';
        return 'trabalho';
    },

    getDayData: (dateStr) => {
        const es = RHModule.escalaState;
        const [y, m, d] = dateStr.split('-').map(Number);
        const date = new Date(y, m - 1, d);
        const override = es.overrides[dateStr] || {};

        const grupoAuto = RHModule.getGrupoTurnistaParaData(date);
        const grupoEfetivo = override.grupoTurnista || grupoAuto;

        // Usa helper dinâmico — lê do cadastro RH
        const diaristas = RHModule.escalaGetDiaristas().map(di => {
            const autoStatus = RHModule.getDiaristaStatusAuto(di, date);
            const ov = override.diaristas && override.diaristas[di.nome];
            let efetivo;
            if (ov === undefined)        efetivo = autoStatus;
            else if (ov === 'ferias')    efetivo = 'ferias';
            else if (ov === true)        efetivo = 'trabalho';
            else                         efetivo = 'folga';
            return { ...di, status: efetivo, auto: autoStatus, isOverridden: ov !== undefined };
        });

        const hasOverride = !!(override.grupoTurnista || Object.keys(override.diaristas || {}).length > 0);
        return { grupoAuto, grupoEfetivo, diaristas, hasOverride };
    },

    renderEscalaMensal: async () => {
        RHModule.highlightTab('tab-escala');
        // Mostra loading enquanto carrega da BD
        document.getElementById('tab-content').innerHTML = '<div style="text-align:center;padding:60px;color:#f0a500;"><span style="font-size:32px;">⏳</span><p style="margin-top:10px;font-size:14px;color:#94a3b8;">A carregar configurações da escala...</p></div>';
        await RHModule.escalaCarregarAssignments();
        const es = RHModule.escalaState;
        const monthNames = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
        const mesAno = `${monthNames[es.month]} ${es.year}`;
        const daysInMonth = new Date(es.year, es.month + 1, 0).getDate();

        let diasUteis = 0, fimDeSemana = 0;
        for (let d = 1; d <= daysInMonth; d++) {
            const dow = new Date(es.year, es.month, d).getDay();
            (dow === 0 || dow === 6) ? fimDeSemana++ : diasUteis++;
        }

        const prefix = `${es.year}-${String(es.month + 1).padStart(2, '0')}`;
        const editCount = Object.keys(es.overrides).filter(k => k.startsWith(prefix)).length;

        const subTabs = [
            { id: 'calendario', label: '📅 Calendário' },
            { id: 'semanas',    label: '📋 Semanas' },
            { id: 'equipa',     label: '👥 Equipa' },
            { id: 'configuracoes', label: '⚙ Configurações' }
        ];

        document.getElementById('tab-content').innerHTML = `
            <div style="background:#0c0e16; min-height:calc(100vh - 200px); border-radius:12px; padding:20px; color:#e2e8f0; font-family:'Barlow',sans-serif;">

                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; flex-wrap:wrap; gap:10px;">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <button onclick="RHModule.escalaNavMes(-1)" style="background:#1e2130; border:1px solid #2d3348; color:#f0a500; width:36px; height:36px; border-radius:8px; font-size:18px; cursor:pointer; line-height:1;">◀</button>
                        <h2 style="font-family:'Barlow Condensed',sans-serif; font-size:22px; font-weight:700; color:#f0a500; margin:0; letter-spacing:1px;">${mesAno}</h2>
                        <button onclick="RHModule.escalaNavMes(1)" style="background:#1e2130; border:1px solid #2d3348; color:#f0a500; width:36px; height:36px; border-radius:8px; font-size:18px; cursor:pointer; line-height:1;">▶</button>
                    </div>
                    <div style="display:flex; gap:8px;">
                        <button onclick="RHModule.escalaReporMes()" style="background:#7f1d1d; color:#fca5a5; border:none; padding:8px 14px; border-radius:8px; cursor:pointer; font-size:13px; font-weight:600;">↺ Repor Mês</button>
                        <button onclick="RHModule.escalaImprimirPDF()" style="background:#1e2130; border:1px solid #2d3348; color:#94a3b8; padding:8px 14px; border-radius:8px; cursor:pointer; font-size:13px;">🖨 Imprimir PDF</button>
                    </div>
                </div>

                <div style="background:#141720; border:1px solid #1e2130; border-radius:10px; padding:10px 16px; margin-bottom:16px; display:flex; gap:20px; flex-wrap:wrap; font-size:13px; color:#94a3b8;">
                    <span>📅 <strong style="color:#f0a500">${mesAno}</strong></span>
                    <span>💼 Dias úteis: <strong style="color:#34d399">${diasUteis}</strong></span>
                    <span>🏖 Fins de semana: <strong style="color:#60a5fa">${fimDeSemana}</strong></span>
                    <span>✏️ Editados: <strong style="color:#fb923c">${editCount}</strong></span>
                    <span>🔄 Grupo Dia 1: <strong style="color:#a78bfa">${es.grupoInicialDia1}</strong></span>
                    <span style="color:#64748b; font-size:11px;">Sequência: B→C→A→B→C→A…</span>
                </div>

                <div style="display:flex; gap:4px; margin-bottom:20px; background:#141720; padding:4px; border-radius:10px; width:fit-content; flex-wrap:wrap;">
                    ${subTabs.map(t => {
                        const active = es.subTab === t.id;
                        return `<button onclick="RHModule.escalaState.subTab='${t.id}'; RHModule.renderEscalaMensal()" style="padding:8px 16px; border-radius:7px; border:none; cursor:pointer; font-size:13px; font-weight:600; transition:all 0.2s; ${active ? 'background:#f0a500; color:#0c0e16;' : 'background:transparent; color:#64748b;'}">${t.label}</button>`;
                    }).join('')}
                </div>

                <div id="escala-sub-content"></div>
            </div>
        `;

        if (es.subTab === 'calendario')     RHModule.renderEscalaCalendario();
        else if (es.subTab === 'semanas')   RHModule.renderEscalaSemanas();
        else if (es.subTab === 'equipa')    RHModule.renderEscalaEquipa();
        else if (es.subTab === 'configuracoes') RHModule.renderEscalaConfiguracoes();
    },

    escalaNavMes: (dir) => {
        const es = RHModule.escalaState;
        es.month += dir;
        if (es.month > 11) { es.month = 0; es.year++; }
        if (es.month < 0)  { es.month = 11; es.year--; }
        RHModule.renderEscalaMensal();
    },

    escalaReporMes: () => {
        if (!confirm('Repor todos os overrides deste mês?')) return;
        const es = RHModule.escalaState;
        const prefix = `${es.year}-${String(es.month + 1).padStart(2, '0')}`;
        Object.keys(es.overrides).forEach(k => { if (k.startsWith(prefix)) delete es.overrides[k]; });
        RHModule.renderEscalaMensal();
    },

    escalaImprimirPDF: () => {
        const es = RHModule.escalaState;
        const inst = RHModule.state.cache.instituicao[0] || {};
        const user = Utils.getUser();
        const mesAno = new Date(es.year, es.month, 1)
            .toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

        const escalaContent = document.getElementById('escala-sub-content');
        const contentHTML = escalaContent ? escalaContent.innerHTML : '<p>Sem dados para imprimir.</p>';

        const contactLine = [
            inst.Telefone ? `Tel: ${inst.Telefone}` : '',
            inst.Email    ? `Email: ${inst.Email}`   : ''
        ].filter(Boolean).join(' | ');

        const html = `
            <div style="font-family: sans-serif; padding: 32px; color: #111; background: #fff;">
                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 2px solid #111; padding-bottom: 16px; margin-bottom: 24px;">
                    <div style="display:flex; align-items:center; gap:16px;">
                        ${inst.ExibirLogoRelatorios && inst.LogotipoURL ? `<img src="${inst.LogotipoURL}" style="height:64px; width:auto; object-fit:contain;" crossorigin="anonymous">` : ''}
                        <div>
                            <h1 style="margin:0; font-size:22px; text-transform:uppercase; font-weight:bold;">${inst.NomeFantasia || 'Empresa'}</h1>
                            ${inst.NomeCompleto ? `<p style="margin:2px 0 0; font-size:13px; color:#444;">${inst.NomeCompleto}</p>` : ''}
                            ${inst.Endereco    ? `<p style="margin:2px 0 0; font-size:12px; color:#555;">${inst.Endereco}</p>`    : ''}
                            ${contactLine      ? `<p style="margin:2px 0 0; font-size:12px; color:#555;">${contactLine}</p>`      : ''}
                        </div>
                    </div>
                    <div style="text-align:right;">
                        <h2 style="margin:0; font-size:18px; font-weight:bold;">ESCALA MENSAL</h2>
                        <p style="margin:4px 0 0; font-size:13px;">${mesAno}</p>
                        <p style="margin:2px 0 0; font-size:11px; color:#888;">Gerado em: ${new Date().toLocaleDateString('pt-BR')}</p>
                        <p style="margin:2px 0 0; font-size:11px; color:#888;">Por: ${user?.Nome || 'Sistema'}</p>
                    </div>
                </div>
                ${contentHTML}
                <div style="margin-top:40px; text-align:center; font-size:11px; color:#aaa; border-top: 1px solid #ddd; padding-top:8px;">
                    &copy; 2026 ${inst.NomeFantasia || ''}. Todos os direitos reservados.
                </div>
            </div>
        `;
        Utils.printNative(html, 'landscape');
    },

    renderEscalaCalendario: () => {
        const es = RHModule.escalaState;
        const grupos = RHModule.escalaGetGrupos();
        const daysInMonth = new Date(es.year, es.month + 1, 0).getDate();
        const firstDow = new Date(es.year, es.month, 1).getDay();
        const grupoCores = { A: '#a78bfa', B: '#34d399', C: '#60a5fa' };
        const dayNames = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

        let html = `
        <div style="overflow-x:auto;">
        <div style="display:grid; grid-template-columns:repeat(7,1fr); gap:6px; min-width:840px;">
            ${dayNames.map(n => `<div style="text-align:center; font-weight:700; font-size:11px; color:#475569; padding:6px 0; text-transform:uppercase; letter-spacing:1px;">${n}</div>`).join('')}
        `;

        for (let i = 0; i < firstDow; i++) html += `<div></div>`;

        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${es.year}-${String(es.month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
            const dd = RHModule.getDayData(dateStr);
            const isWeekend = [0, 6].includes(new Date(es.year, es.month, day).getDay());
            const cor = grupoCores[dd.grupoEfetivo];

            html += `
            <div onclick="RHModule.escalaAbrirModalDia('${dateStr}')"
                style="background:#141720; border:1px solid ${dd.hasOverride ? '#f0a500' : (isWeekend ? '#1e3a5f' : '#1e2130')}; border-radius:10px; padding:8px 6px; cursor:pointer; min-height:150px; position:relative; overflow:hidden; transition:border-color 0.15s;"
                onmouseover="this.style.borderColor='#f0a500'; this.style.background='#1a1e2e'"
                onmouseout="this.style.borderColor='${dd.hasOverride ? '#f0a500' : (isWeekend ? '#1e3a5f' : '#1e2130')}'; this.style.background='#141720'">

                ${dd.hasOverride ? `<div style="position:absolute;top:5px;right:5px;width:7px;height:7px;background:#f0a500;border-radius:50%;"></div>` : ''}

                <div style="font-weight:700; font-size:15px; color:${isWeekend ? '#60a5fa' : '#e2e8f0'}; margin-bottom:5px;">${day}</div>

                <div style="font-size:9px; font-weight:700; color:${cor}; letter-spacing:0.5px; margin-bottom:3px;">▶ GRUPO ${dd.grupoEfetivo}</div>
                ${(grupos[dd.grupoEfetivo]||[]).map(m => `<div style="font-size:9px; color:${cor}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${m}</div>`).join('')}
                ${['A','B','C'].filter(g => g !== dd.grupoEfetivo).map(g =>
                    (grupos[g]||[]).map(m => `<div style="font-size:9px; color:#2d3348; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${m.split(' ')[0]} <span style="color:#1e2130;">FOLGA</span></div>`).join('')
                ).join('')}

                <div style="border-top:1px solid #1e2130; margin:4px 0 3px;"></div>

                ${dd.diaristas.map(di => `
                    <div style="font-size:9px; color:${di.status==='trabalho' ? '#fb923c' : di.status==='ferias' ? '#a78bfa' : '#2d3348'}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; ${di.isOverridden?'text-decoration:underline dotted #f0a500;':''}">
                        ${di.nome.split(' ')[0]}${di.status==='folga' ? ' <span style="color:#1e2130;">FOLGA</span>' : di.status==='ferias' ? ' <span style="color:#7c3aed;">🏖</span>' : ''}
                    </div>
                `).join('')}
            </div>`;
        }

        html += `</div></div>
        <div style="margin-top:14px; display:flex; gap:16px; flex-wrap:wrap; font-size:12px; color:#94a3b8;">
            <span><span style="display:inline-block;width:10px;height:10px;background:#a78bfa;border-radius:2px;margin-right:4px;"></span>Grupo A</span>
            <span><span style="display:inline-block;width:10px;height:10px;background:#34d399;border-radius:2px;margin-right:4px;"></span>Grupo B</span>
            <span><span style="display:inline-block;width:10px;height:10px;background:#60a5fa;border-radius:2px;margin-right:4px;"></span>Grupo C</span>
            <span><span style="display:inline-block;width:10px;height:10px;background:#fb923c;border-radius:2px;margin-right:4px;"></span>Diaristas</span>
            <span><span style="display:inline-block;width:7px;height:7px;background:#f0a500;border-radius:50%;margin-right:4px;"></span>Edição manual</span>
        </div>`;

        document.getElementById('escala-sub-content').innerHTML = html;
    },

    renderEscalaSemanas: () => {
        const es = RHModule.escalaState;
        const grupos = RHModule.escalaGetGrupos();
        const daysInMonth = new Date(es.year, es.month + 1, 0).getDate();
        const grupoCores = { A: '#a78bfa', B: '#34d399', C: '#60a5fa' };
        const dayNames = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

        // Semana começa no Domingo (0) e termina no Sábado (6)
        // Preenchemos dias vazios no início da 1ª semana e no fim da última
        const firstDow = new Date(es.year, es.month, 1).getDay(); // 0=Dom
        let allCells = [];
        // Células vazias antes do dia 1
        for (let i = 0; i < firstDow; i++) allCells.push(null);
        for (let d = 1; d <= daysInMonth; d++) {
            const dow = new Date(es.year, es.month, d).getDay();
            allCells.push({ day: d, dow });
        }
        // Completar última semana até Sábado
        while (allCells.length % 7 !== 0) allCells.push(null);

        let weeks = [];
        for (let i = 0; i < allCells.length; i += 7) {
            const w = allCells.slice(i, i + 7).filter(Boolean);
            if (w.length > 0) weeks.push(w);
        }

        let html = '';
        weeks.forEach((w, wi) => {
            html += `
            <div style="background:#141720; border:1px solid #1e2130; border-radius:12px; margin-bottom:16px; overflow:hidden;">
                <div style="background:#1e2130; padding:9px 16px; font-weight:700; color:#f0a500; font-size:13px; letter-spacing:1px;">SEMANA ${wi + 1}</div>
                <div style="overflow-x:auto;">
                <table style="width:100%; border-collapse:collapse; min-width:560px;">
                    <thead>
                        <tr>
                            ${w.map(({day, dow}) => {
                                const dateStr = `${es.year}-${String(es.month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                                const isW = dow===0||dow===6;
                                const hasOv = !!es.overrides[dateStr];
                                return `<th style="padding:8px 10px; text-align:center; border-bottom:1px solid #2d3348; font-size:11px; color:${isW?'#60a5fa':'#64748b'}; cursor:pointer;" onclick="RHModule.escalaAbrirModalDia('${dateStr}')">
                                    <span style="display:block;">${dayNames[dow]}</span>
                                    <span style="font-size:17px; font-weight:700; color:${hasOv?'#f0a500':(isW?'#60a5fa':'#e2e8f0')};">${day}${hasOv?' ●':''}</span>
                                </th>`;
                            }).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        <tr style="background:#0f1117;">
                            <td colspan="${w.length}" style="padding:4px 10px; font-size:10px; color:#475569; font-weight:700; letter-spacing:1px; text-transform:uppercase; border-bottom:1px solid #1a1e2e;">TURNISTAS</td>
                        </tr>
                        <tr>
                            ${w.map(({day}) => {
                                const dateStr = `${es.year}-${String(es.month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                                const dd = RHModule.getDayData(dateStr);
                                const cor = grupoCores[dd.grupoEfetivo];
                                return `<td style="padding:6px 8px; border-right:1px solid #1e2130; vertical-align:top; font-size:11px;">
                                    <div style="font-weight:700; color:${cor}; margin-bottom:3px;">Grupo ${dd.grupoEfetivo}</div>
                                    ${(grupos[dd.grupoEfetivo]||[]).map(m => `<div style="color:${cor};">${m}</div>`).join('')}
                                    ${['A','B','C'].filter(g=>g!==dd.grupoEfetivo).map(g =>
                                        (grupos[g]||[]).map(m => `<div style="color:#2d3348;">&middot; ${m.split(' ')[0]}</div>`).join('')
                                    ).join('')}
                                </td>`;
                            }).join('')}
                        </tr>
                        <tr style="background:#0f1117;">
                            <td colspan="${w.length}" style="padding:4px 10px; font-size:10px; color:#475569; font-weight:700; letter-spacing:1px; text-transform:uppercase; border-bottom:1px solid #1a1e2e; border-top:1px solid #1e2130;">DIARISTAS</td>
                        </tr>
                        <tr>
                            ${w.map(({day}) => {
                                const dateStr = `${es.year}-${String(es.month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                                const dd = RHModule.getDayData(dateStr);
                                return `<td style="padding:6px 8px; border-right:1px solid #1e2130; vertical-align:top; font-size:11px;">
                                    ${dd.diaristas.map(di => `
                                        <div style="color:${di.status==='trabalho'?'#fb923c': di.status==='ferias'?'#a78bfa':'#334155'}; ${di.isOverridden?'text-decoration:underline dotted #f0a500;':''}">
                                            ${di.status==='trabalho'?'✓': di.status==='ferias'?'🏖':'·'} ${di.nome.split(' ')[0]} ${di.status==='folga'?'<span style="font-size:10px;color:#2d3348;">FOLGA</span>': di.status==='ferias'?'<span style="font-size:10px;color:#7c3aed;">FÉRIAS</span>':''}
                                        </div>
                                    `).join('')}
                                </td>`;
                            }).join('')}
                        </tr>
                    </tbody>
                </table>
                </div>
            </div>`;
        });

        document.getElementById('escala-sub-content').innerHTML = html;
    },

    renderEscalaEquipa: () => {
        const es = RHModule.escalaState;
        const allFuncs = RHModule.state.cache.allFuncionarios || [];
        const ativos = allFuncs.filter(f => f.Status === 'Ativo');
        const assignments = es.assignments;
        const grupoCores = { A: '#a78bfa', B: '#34d399', C: '#60a5fa' };
        const diasSemana = ['—','Segunda','Terça','Quarta','Quinta','Sexta'];

        const naoAtrib = ativos.filter(f => !assignments[f.ID] || !assignments[f.ID].tipo);
        const diaristas = ativos.filter(f => assignments[f.ID] && assignments[f.ID].tipo === 'diarista');
        const grupoA = ativos.filter(f => assignments[f.ID] && assignments[f.ID].tipo === 'A');
        const grupoB = ativos.filter(f => assignments[f.ID] && assignments[f.ID].tipo === 'B');
        const grupoC = ativos.filter(f => assignments[f.ID] && assignments[f.ID].tipo === 'C');

        const renderFunc = (f, tipo) => {
            const a = assignments[f.ID] || {};
            const cor = tipo === 'diarista' ? '#fb923c' : (grupoCores[tipo] || '#64748b');
            const infoExtra = tipo === 'diarista'
                ? `<div style="font-size:10px;color:#475569;">${a.folgaFixa ? 'Folga: '+diasSemana[a.folgaFixa] : 'Sem folga fixa'} · FDS: ${a.fdsAlterna!==false ? 'Alternado' : 'Nunca'}</div>`
                : `<div style="font-size:10px;color:#475569;">Regime 24h/48h folga</div>`;
            return `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;background:#0c0e16;border-radius:8px;margin-bottom:5px;border:1px solid #1e2130;">
                <div>
                    <div style="font-size:13px;font-weight:600;color:${cor};">${f.Nome}</div>
                    ${infoExtra}
                </div>
                <button onclick="RHModule.escalaConfigurarFuncionario('${f.ID}')"
                    style="background:#1e2130;color:#94a3b8;border:1px solid #2d3348;padding:5px 10px;border-radius:6px;cursor:pointer;font-size:12px;">⚙ Config</button>
            </div>`;
        };

        let html = `
        <div style="max-width:1000px;">

            ${naoAtrib.length > 0 ? `
            <div style="background:#141720;border:2px dashed #334155;border-radius:12px;padding:16px;margin-bottom:18px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                    <h3 style="color:#64748b;font-weight:700;margin:0;font-size:14px;">⚠ Não Atribuídos (${naoAtrib.length})</h3>
                    <span style="font-size:11px;color:#475569;">Clique em ⚙ Config para atribuir regime</span>
                </div>
                ${naoAtrib.map(f => `
                <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;background:#0c0e16;border-radius:8px;margin-bottom:5px;">
                    <div>
                        <div style="font-size:13px;font-weight:600;color:#94a3b8;">${f.Nome}</div>
                        <div style="font-size:10px;color:#475569;">${f.Cargo||''} · ${f.Turno||'Turno não definido'}</div>
                    </div>
                    <button onclick="RHModule.escalaConfigurarFuncionario('${f.ID}')"
                        style="background:#f0a50022;color:#f0a500;border:1px solid #f0a50044;padding:5px 12px;border-radius:6px;cursor:pointer;font-weight:700;font-size:12px;">⚙ Atribuir</button>
                </div>
                `).join('')}
            </div>` : ''}

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">

                <div style="background:#141720;border:1px solid #1e2130;border-radius:12px;padding:16px;">
                    <h3 style="color:#fb923c;font-weight:700;margin:0 0 12px;font-size:14px;">🟠 Diaristas (8h) — ${diaristas.length}</h3>
                    ${diaristas.length ? diaristas.map(f => renderFunc(f, 'diarista')).join('') : '<p style="color:#334155;font-size:12px;text-align:center;padding:10px;">Nenhum atribuído</p>'}
                </div>

                <div>
                    ${['A','B','C'].map((g, gi) => {
                        const membros = [grupoA,grupoB,grupoC][gi];
                        return `
                        <div style="background:#141720;border:1px solid #1e2130;border-radius:12px;padding:14px;margin-bottom:12px;">
                            <h3 style="color:${grupoCores[g]};font-weight:700;margin:0 0 10px;font-size:14px;">Grupo ${g} — 24h/48h folga · ${membros.length}</h3>
                            ${membros.length ? membros.map(f => renderFunc(f, g)).join('') : '<p style="color:#334155;font-size:12px;text-align:center;padding:8px;">Nenhum atribuído</p>'}
                        </div>`;
                    }).join('')}
                </div>
            </div>
        </div>`;

        document.getElementById('escala-sub-content').innerHTML = html;
    },

    escalaConfigurarFuncionario: (funcId) => {
        const allFuncs = RHModule.state.cache.allFuncionarios || [];
        const f = allFuncs.find(x => x.ID === funcId);
        if (!f) return;
        const a = RHModule.escalaState.assignments[funcId] || {};
        const diasSemana = ['—','Segunda','Terça','Quarta','Quinta','Sexta'];
        const grupoCores = { A: '#a78bfa', B: '#34d399', C: '#60a5fa' };
        const tipoAtual = a.tipo || '';

        Utils.openModal(`⚙ Configurar Escala: ${f.Nome}`, `
        <div style="font-family:'Barlow',sans-serif;min-width:380px;">

            <div style="background:#0c0e16;border-radius:10px;padding:14px;margin-bottom:14px;">
                <label style="display:block;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">Regime de Trabalho</label>
                <div style="display:flex;flex-wrap:wrap;gap:8px;">
                    <button onclick="RHModule.escalaSetTipo('${funcId}','diarista')"
                        id="tipo-diarista"
                        style="padding:8px 14px;border-radius:8px;border:2px solid ${tipoAtual==='diarista'?'#fb923c':'#2d3348'};background:${tipoAtual==='diarista'?'#fb923c22':'transparent'};color:${tipoAtual==='diarista'?'#fb923c':'#475569'};cursor:pointer;font-weight:700;font-size:13px;">☀ Diarista (8h)</button>
                    ${['A','B','C'].map(g => `
                    <button onclick="RHModule.escalaSetTipo('${funcId}','${g}')"
                        id="tipo-${g}"
                        style="padding:8px 14px;border-radius:8px;border:2px solid ${tipoAtual===g?grupoCores[g]:'#2d3348'};background:${tipoAtual===g?grupoCores[g]+'22':'transparent'};color:${tipoAtual===g?grupoCores[g]:'#475569'};cursor:pointer;font-weight:700;font-size:13px;">🔄 Grupo ${g}</button>
                    `).join('')}
                    <button onclick="RHModule.escalaSetTipo('${funcId}',null)"
                        style="padding:8px 14px;border-radius:8px;border:2px solid #7f1d1d;background:transparent;color:#fca5a5;cursor:pointer;font-weight:700;font-size:13px;">✕ Remover</button>
                </div>
            </div>

            <div id="escala-config-diarista" style="display:${tipoAtual==='diarista'?'block':'none'};">
                <div style="background:#0c0e16;border-radius:10px;padding:14px;margin-bottom:12px;">
                    <label style="display:block;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;margin-bottom:8px;">Folga Fixa Semanal</label>
                    <select id="cfg-folga" style="width:100%;padding:9px;background:#141720;border:1px solid #2d3348;border-radius:7px;color:#e2e8f0;font-size:13px;">
                        <option value="" ${!a.folgaFixa?'selected':''}>Nenhuma</option>
                        ${[1,2,3,4,5].map(n => `<option value="${n}" ${a.folgaFixa===n?'selected':''}>${diasSemana[n]}</option>`).join('')}
                    </select>
                </div>
                <div style="background:#0c0e16;border-radius:10px;padding:14px;margin-bottom:12px;">
                    <label style="display:block;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;margin-bottom:8px;">Fins de Semana</label>
                    <div style="display:flex;gap:8px;">
                        <button onclick="document.getElementById('cfg-fds-alterna').value='true'; this.style.background='#34d39922'; document.getElementById('cfg-fds-nunca').style.background='transparent';"
                            id="cfg-fds-alterna-btn"
                            style="flex:1;padding:9px;border-radius:7px;border:1px solid #2d3348;cursor:pointer;font-weight:700;font-size:13px;background:${a.fdsAlterna!==false?'#34d39922':'transparent'};color:${a.fdsAlterna!==false?'#34d399':'#475569'};">🔄 Alternado</button>
                        <button onclick="document.getElementById('cfg-fds-alterna').value='false'; this.style.background='#ef444422'; document.getElementById('cfg-fds-alterna-btn').style.background='transparent';"
                            id="cfg-fds-nunca"
                            style="flex:1;padding:9px;border-radius:7px;border:1px solid #2d3348;cursor:pointer;font-weight:700;font-size:13px;background:${a.fdsAlterna===false?'#ef444422':'transparent'};color:${a.fdsAlterna===false?'#ef4444':'#475569'};">✕ Nunca</button>
                        <input type="hidden" id="cfg-fds-alterna" value="${a.fdsAlterna!==false?'true':'false'}">
                    </div>
                </div>
                <div style="background:#0c0e16;border-radius:10px;padding:14px;margin-bottom:14px;">
                    <label style="display:block;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;margin-bottom:8px;">1.º Fim de Semana do Mês</label>
                    <div style="display:flex;gap:8px;">
                        <button onclick="document.getElementById('cfg-s1').value='true'; this.style.background='#34d39922'; document.getElementById('cfg-s1-folga').style.background='transparent';"
                            style="flex:1;padding:9px;border-radius:7px;border:1px solid #2d3348;cursor:pointer;font-weight:700;font-size:13px;background:${a.fdsTrabalhaS1!==false?'#34d39922':'transparent'};color:${a.fdsTrabalhaS1!==false?'#34d399':'#475569'};">✓ Trabalha</button>
                        <button onclick="document.getElementById('cfg-s1').value='false'; this.style.background='#ef444422'; this.previousElementSibling.style.background='transparent';"
                            id="cfg-s1-folga"
                            style="flex:1;padding:9px;border-radius:7px;border:1px solid #2d3348;cursor:pointer;font-weight:700;font-size:13px;background:${a.fdsTrabalhaS1===false?'#ef444422':'transparent'};color:${a.fdsTrabalhaS1===false?'#ef4444':'#475569'};">✕ Folga</button>
                        <input type="hidden" id="cfg-s1" value="${a.fdsTrabalhaS1!==false?'true':'false'}">
                    </div>
                </div>
            </div>

            <button onclick="RHModule.escalaSalvarConfig('${funcId}')"
                style="width:100%;padding:12px;background:#f0a500;border:none;color:#0c0e16;border-radius:9px;cursor:pointer;font-weight:800;font-size:14px;">💾 Guardar Configuração</button>
        </div>`);
    },

    escalaSetTipo: (funcId, tipo) => {
        const grupoCores = { A: '#a78bfa', B: '#34d399', C: '#60a5fa' };
        // Update button styles
        ['diarista','A','B','C'].forEach(t => {
            const btn = document.getElementById('tipo-' + t);
            if (!btn) return;
            const cor = t === 'diarista' ? '#fb923c' : grupoCores[t];
            const active = t === tipo;
            btn.style.borderColor = active ? cor : '#2d3348';
            btn.style.background = active ? cor + '22' : 'transparent';
            btn.style.color = active ? cor : '#475569';
        });
        // Show/hide diarista config panel
        const panel = document.getElementById('escala-config-diarista');
        if (panel) panel.style.display = tipo === 'diarista' ? 'block' : 'none';
        // Store pending tipo
        document.getElementById('tipo-diarista').dataset.pendingTipo = tipo || '';
    },

    escalaSalvarConfig: async (funcId) => {
        const tipoBtn = document.getElementById('tipo-diarista');
        const tipo = tipoBtn ? tipoBtn.dataset.pendingTipo : '';

        const cfg = tipo ? { tipo } : null;
        if (tipo === 'diarista') {
            cfg.folgaFixa = Number(document.getElementById('cfg-folga').value) || null;
            cfg.fdsAlterna = document.getElementById('cfg-fds-alterna').value !== 'false';
            cfg.fdsTrabalhaS1 = document.getElementById('cfg-s1').value !== 'false';
        }

        // Feedback visual no botão
        const btn = document.querySelector('[onclick*="escalaSalvarConfig"]');
        if (btn) { btn.disabled = true; btn.textContent = '💾 A guardar...'; }

        try {
            await RHModule.escalaSalvarAssignments(funcId, cfg);
            Utils.closeModal();
            Utils.toast('✅ Configuração guardada na base de dados!');
            RHModule.renderEscalaMensal();
        } catch(e) {
            if (btn) { btn.disabled = false; btn.textContent = '💾 Guardar Configuração'; }
        }
    },

    renderEscalaConfiguracoes: () => {
        const es = RHModule.escalaState;
        const grupoCores = { A: '#a78bfa', B: '#34d399', C: '#60a5fa' };

        const html = `
        <div style="max-width:580px;">
            <div style="background:#141720; border:1px solid #1e2130; border-radius:12px; padding:20px; margin-bottom:18px;">
                <h3 style="color:#f0a500; font-weight:700; margin-bottom:6px; font-size:15px;">🔄 Rotação Turnistas</h3>
                <p style="font-size:12px; color:#475569; margin-bottom:14px;">Grupo que trabalha no Dia 1 do mês seleccionado. Sequência: B→C→A→B→C→A…</p>
                <div style="display:flex; gap:10px;">
                    ${['A','B','C'].map(g => {
                        const active = es.grupoInicialDia1 === g;
                        return `<button onclick="RHModule.escalaState.grupoInicialDia1='${g}'; RHModule.renderEscalaMensal()"
                            style="padding:12px 28px; border-radius:8px; border:2px solid ${active ? grupoCores[g] : '#2d3348'}; background:${active ? grupoCores[g]+'22' : 'transparent'}; color:${active ? grupoCores[g] : '#475569'}; font-weight:700; font-size:16px; cursor:pointer; transition:all 0.2s;">Grupo ${g}</button>`;
                    }).join('')}
                </div>
            </div>

            <div style="background:#141720; border:1px solid #1e2130; border-radius:12px; padding:20px;">
                <h3 style="color:#f0a500; font-weight:700; margin-bottom:6px; font-size:15px;">📅 Alternância de Fins de Semana</h3>
                <p style="font-size:12px; color:#475569; margin-bottom:14px;">Define o estado do diarista no 1.º fim de semana do mês (controla toda a alternância do mês).</p>
                ${RHModule.escalaGetDiaristas().filter(d => d.fdsAlterna).map(d => {
                    const a = RHModule.escalaState.assignments[d.id] || {};
                    return `
                    <div style="display:flex; justify-content:space-between; align-items:center; padding:9px 12px; background:#0c0e16; border-radius:8px; margin-bottom:6px;">
                        <span style="font-size:13px; color:#fb923c; font-weight:600;">${d.nome}</span>
                        <div style="display:flex; gap:8px;">
                            <button onclick="RHModule.escalaState.assignments['${d.id}'].fdsTrabalhaS1=true; RHModule.escalaSalvarAssignments('${d.id}', RHModule.escalaState.assignments['${d.id}']).then(()=>RHModule.renderEscalaMensal())"
                                style="padding:5px 14px; border-radius:6px; border:none; cursor:pointer; font-size:12px; font-weight:700; background:${d.fdsTrabalhaS1 ? '#34d399' : '#1e2130'}; color:${d.fdsTrabalhaS1 ? '#0c0e16' : '#475569'}; transition:all 0.2s;">✓ Trabalha</button>
                            <button onclick="RHModule.escalaState.assignments['${d.id}'].fdsTrabalhaS1=false; RHModule.escalaSalvarAssignments('${d.id}', RHModule.escalaState.assignments['${d.id}']).then(()=>RHModule.renderEscalaMensal())"
                                style="padding:5px 14px; border-radius:6px; border:none; cursor:pointer; font-size:12px; font-weight:700; background:${!d.fdsTrabalhaS1 ? '#ef4444' : '#1e2130'}; color:${!d.fdsTrabalhaS1 ? 'white' : '#475569'}; transition:all 0.2s;">✕ Folga</button>
                        </div>
                    </div>`;
                }).join('')}
            </div>
        </div>`;

        document.getElementById('escala-sub-content').innerHTML = html;
    },

    escalaAbrirModalDia: (dateStr) => {
        const es = RHModule.escalaState;
        const [y, m, d] = dateStr.split('-').map(Number);
        const date = new Date(y, m - 1, d);
        const dayNames = ['Domingo','Segunda-Feira','Terça-Feira','Quarta-Feira','Quinta-Feira','Sexta-Feira','Sábado'];
        const monthNames = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
        const dd = RHModule.getDayData(dateStr);
        const override = es.overrides[dateStr] || {};
        const grupoCores = { A: '#a78bfa', B: '#34d399', C: '#60a5fa' };

        const html = `
        <div style="font-family:'Barlow',sans-serif; min-width:420px; max-width:520px;">
            <p style="color:#f0a500; font-size:15px; font-weight:700; margin:0 0 14px;">${dayNames[date.getDay()]}, ${d} de ${monthNames[m-1]} de ${y}</p>

            <div style="background:#0c0e16; border-radius:10px; padding:14px; margin-bottom:14px; border:1px solid #1e2130;">
                <h4 style="font-size:11px; color:#64748b; font-weight:700; text-transform:uppercase; letter-spacing:1px; margin:0 0 10px;">Grupo Turnista (24h/48h)</h4>
                <p style="font-size:11px; color:#475569; margin:0 0 10px;">Automático: <strong style="color:${grupoCores[dd.grupoAuto]}">Grupo ${dd.grupoAuto}</strong></p>
                <div style="display:flex; gap:8px; flex-wrap:wrap;">
                    <button onclick="RHModule.escalaSetGrupoOverride('${dateStr}', null)"
                        style="padding:7px 14px; border-radius:7px; border:2px solid ${!override.grupoTurnista ? '#f0a500' : '#2d3348'}; background:${!override.grupoTurnista ? '#f0a50022' : 'transparent'}; color:${!override.grupoTurnista ? '#f0a500' : '#475569'}; cursor:pointer; font-size:12px; font-weight:700;">Auto</button>
                    ${['A','B','C'].map(g => `
                        <button onclick="RHModule.escalaSetGrupoOverride('${dateStr}', '${g}')"
                            style="padding:7px 16px; border-radius:7px; border:2px solid ${override.grupoTurnista===g ? grupoCores[g] : '#2d3348'}; background:${override.grupoTurnista===g ? grupoCores[g]+'22' : 'transparent'}; color:${override.grupoTurnista===g ? grupoCores[g] : '#475569'}; cursor:pointer; font-size:13px; font-weight:700;">G-${g}</button>
                    `).join('')}
                </div>
            </div>

            <div style="background:#0c0e16; border-radius:10px; padding:14px; margin-bottom:14px; border:1px solid #1e2130;">
                <h4 style="font-size:11px; color:#64748b; font-weight:700; text-transform:uppercase; letter-spacing:1px; margin:0 0 10px;">Diaristas</h4>
                ${dd.diaristas.map(di => `
                    <div style="display:flex; justify-content:space-between; align-items:center; padding:7px 0; border-bottom:1px solid #141720;">
                        <span style="font-size:13px; color:${di.isOverridden ? '#f0a500' : '#e2e8f0'};">${di.nome} ${di.isOverridden ? '<span style="font-size:10px; color:#f0a500;">✏</span>' : ''}</span>
                        <div style="display:flex; gap:5px;">
                            <button onclick="RHModule.escalaSetDiaristaOverride('${dateStr}', '${di.nome}', null)"
                                style="padding:4px 9px; border-radius:5px; border:1px solid ${!di.isOverridden ? '#f0a500' : '#2d3348'}; background:transparent; color:${!di.isOverridden ? '#f0a500' : '#334155'}; cursor:pointer; font-size:11px; font-weight:600;">Auto</button>
                            <button onclick="RHModule.escalaSetDiaristaOverride('${dateStr}', '${di.nome}', true)"
                                style="padding:4px 9px; border-radius:5px; border:none; background:${di.status==='trabalho'&&di.isOverridden ? '#fb923c' : '#1e2130'}; color:${di.status==='trabalho'&&di.isOverridden ? '#0c0e16' : '#fb923c'}; cursor:pointer; font-size:11px; font-weight:700;">Trabalho</button>
                            <button onclick="RHModule.escalaSetDiaristaOverride('${dateStr}', '${di.nome}', false)"
                                style="padding:4px 9px; border-radius:5px; border:none; background:${di.status==='folga'&&di.isOverridden ? '#475569' : '#1e2130'}; color:${di.status==='folga'&&di.isOverridden ? 'white' : '#475569'}; cursor:pointer; font-size:11px; font-weight:700;">Folga</button>
                            <button onclick="RHModule.escalaSetDiaristaOverride('${dateStr}', '${di.nome}', 'ferias')"
                                style="padding:4px 9px; border-radius:5px; border:none; background:${di.status==='ferias' ? '#7c3aed' : '#1e2130'}; color:${di.status==='ferias' ? 'white' : '#7c3aed'}; cursor:pointer; font-size:11px; font-weight:700;">🏖 Férias</button>
                        </div>
                    </div>
                `).join('')}
            </div>

            <div style="display:flex; gap:10px;">
                <button onclick="RHModule.escalaReporDia('${dateStr}')" style="flex:1; padding:10px; background:#1e2130; border:1px solid #2d3348; color:#94a3b8; border-radius:8px; cursor:pointer; font-weight:600; font-size:13px;">↺ Repor Padrão</button>
                <button onclick="Utils.closeModal()" style="flex:1; padding:10px; background:#f0a500; border:none; color:#0c0e16; border-radius:8px; cursor:pointer; font-weight:700; font-size:13px;">✓ Fechar</button>
            </div>
        </div>`;

        Utils.openModal(`Editar Dia — ${d}/${m}/${y}`, html);
    },

    escalaSetGrupoOverride: (dateStr, grupo) => {
        const es = RHModule.escalaState;
        if (!es.overrides[dateStr]) es.overrides[dateStr] = {};
        if (grupo === null) delete es.overrides[dateStr].grupoTurnista;
        else es.overrides[dateStr].grupoTurnista = grupo;
        RHModule.escalaAbrirModalDia(dateStr);
        setTimeout(() => {
            if (es.subTab === 'calendario') RHModule.renderEscalaCalendario();
            else if (es.subTab === 'semanas') RHModule.renderEscalaSemanas();
        }, 50);
    },

    escalaSetDiaristaOverride: (dateStr, nome, value) => {
        const es = RHModule.escalaState;
        if (!es.overrides[dateStr]) es.overrides[dateStr] = {};
        if (!es.overrides[dateStr].diaristas) es.overrides[dateStr].diaristas = {};
        if (value === null) delete es.overrides[dateStr].diaristas[nome];
        else es.overrides[dateStr].diaristas[nome] = value;
        RHModule.escalaAbrirModalDia(dateStr);
        setTimeout(() => {
            if (es.subTab === 'calendario') RHModule.renderEscalaCalendario();
            else if (es.subTab === 'semanas') RHModule.renderEscalaSemanas();
        }, 50);
    },

    escalaReporDia: (dateStr) => {
        delete RHModule.escalaState.overrides[dateStr];
        RHModule.escalaAbrirModalDia(dateStr);
        const es = RHModule.escalaState;
        setTimeout(() => {
            if (es.subTab === 'calendario') RHModule.renderEscalaCalendario();
            else if (es.subTab === 'semanas') RHModule.renderEscalaSemanas();
        }, 50);
    },


    escalaAddDiarista: () => { Utils.toast('Use a aba Equipa → ⚙ Config para atribuir funcionários.', 'info'); },
    escalaConfirmAddDiarista: () => {},
    escalaEditDiarista: () => { Utils.toast('Use a aba Equipa → ⚙ Config para editar.', 'info'); },
    escalaConfirmEditDiarista: () => {},
    escalaRemoveDiarista: () => { Utils.toast('Use a aba Equipa → ⚙ Config para remover.', 'info'); },
    escalaAddTurnista: () => { Utils.toast('Use a aba Equipa → ⚙ Config para atribuir grupo.', 'info'); },
    escalaConfirmAddTurnista: () => {},
    escalaRemoveTurnista: () => { Utils.toast('Use a aba Equipa → ⚙ Config para remover.', 'info'); },

    // ============================================================
    // === FIM MÓDULO ESCALA MENSAL ================================
    // ============================================================

    // --- GENÉRICOS ---
    save: async (e, table) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target).entries());

        // Limpeza de Máscaras (Salário)
        if (table === 'Funcionarios' && data.Salario) {
            // Remove 'Kz', espaços e pontos de milhar, troca vírgula decimal por ponto
            // Ex: "Kz 1.500,00" -> "1500.00"
            data.Salario = parseFloat(data.Salario.replace(/[^0-9,]/g, '').replace(',', '.')) || 0;
        }

        // --- VALIDAÇÃO DE DUPLICIDADE (BI/NIF) ---
        if (table === 'Funcionarios') {
            const bi = data.BI ? data.BI.trim().toUpperCase() : '';
            if (bi) {
                const duplicado = RHModule.state.cache.allFuncionarios.find(f => 
                    f.BI && f.BI.trim().toUpperCase() === bi && f.ID !== data.ID
                );
                if (duplicado) {
                    return Utils.toast(`⚠️ O BI/NIF ${bi} já está cadastrado para: ${duplicado.Nome}`, 'error');
                }
            }
            
            // Validação de Nome Duplicado
            const nome = data.Nome ? data.Nome.trim() : '';
            if (nome) {
                const duplicadoNome = RHModule.state.cache.allFuncionarios.find(f => 
                    f.Nome && f.Nome.trim().toLowerCase() === nome.toLowerCase() && f.ID !== data.ID
                );
                if (duplicadoNome) {
                    return Utils.toast(`⚠️ O funcionário "${nome}" já está cadastrado.`, 'error');
                }
            }
        }


        // Geração Automática de ID para Funcionários
        if (table === 'Funcionarios' && !data.ID) {
            const existingIds = RHModule.state.cache.allFuncionarios.map(f => f.ID);
            data.ID = RHModule.generateEmployeeId(data.Nome, existingIds);
            const existingCodes = RHModule.state.cache.allFuncionarios.map(f => f.Codigo);
            data.Codigo = RHModule.generateEmployeeId(data.Nome, existingCodes);
        }

        // Geração Automática de ID para Férias (Novo Padrão)
        if (table === 'Ferias' && !data.ID) {
            const existingCodes = RHModule.state.cache.ferias.map(f => f.Codigo).filter(c => c);
            const nome = data.FuncionarioNome || 'Funcionario Desconhecido';
            data.Codigo = RHModule.gerarIdFuncionario(nome, existingCodes);
        }

        // Geração Automática de ID para Avaliações (Novo Padrão)
        if (table === 'Avaliacoes' && !data.ID) {
            const existingCodes = RHModule.state.cache.avaliacoes.map(a => a.Codigo).filter(c => c);
            const nome = data.FuncionarioNome || 'Funcionario Desconhecido';
            data.Codigo = RHModule.gerarIdFuncionario(nome, existingCodes);
        }

        // Lógica de Upload de Foto (Funcionários)
        if (table === 'Funcionarios') {
            const fileInput = document.getElementById('foto-file');
            if (fileInput && fileInput.files[0]) {
                try {
                    const toBase64 = file => new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.readAsDataURL(file);
                        reader.onload = () => resolve(reader.result);
                        reader.onerror = error => reject(error);
                    });
                    data.FotoURL = await toBase64(fileInput.files[0]);
                } catch (err) { return Utils.toast('Erro ao processar foto: ' + err.message); }
            }
        }

        // Lógica de Upload de Arquivo (Férias)
        if (table === 'Ferias') {
            const fileInput = document.getElementById('file-comprovativo');
            if (fileInput && fileInput.files[0]) {
                try {
                    const toBase64 = file => new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.readAsDataURL(file);
                        reader.onload = () => resolve(reader.result);
                        reader.onerror = error => reject(error);
                    });
                    data.ComprovativoURL = await toBase64(fileInput.files[0]);
                } catch (err) {
                    return Utils.toast('Erro ao processar arquivo: ' + err.message);
                }
            }
        }

        // VALIDAÇÕES DE REGRAS DE NEGÓCIO
        if (table === 'Frequencia') {
            if (!data.FuncionarioID) return Utils.toast('⚠️ Erro: Selecione um funcionário.');
            if (!data.Data) return Utils.toast('⚠️ Erro: A data é obrigatória.');
            // Validação removida para permitir turnos de 24h ou noturnos (que viram o dia)
            // if (data.Saida && data.Entrada && data.Saida <= data.Entrada) return Utils.toast('⚠️ Erro: A hora de saída deve ser posterior à entrada.');
        }
        if (table === 'Ferias') {
            if (!data.FuncionarioID) return Utils.toast('⚠️ Erro: Selecione um funcionário.');
            if (new Date(data.DataFim) <= new Date(data.DataInicio)) return Utils.toast('⚠️ Erro: A data de retorno deve ser posterior ao início.');
            if (Number(data.Dias) <= 0) return Utils.toast('⚠️ Erro: A quantidade de dias deve ser positiva.');
        }
        if (table === 'Treinamentos') {
            if (!data.Titulo) return Utils.toast('⚠️ Erro: O título do treinamento é obrigatório.');
            if (data.Inicio && data.Termino && new Date(data.Termino) < new Date(data.Inicio)) return Utils.toast('⚠️ Erro: A data de término não pode ser anterior ao início.');
        }
        if (table === 'Avaliacoes') {
            if (!data.FuncionarioID) return Utils.toast('⚠️ Erro: Selecione um funcionário.');
            if (Object.keys(data).filter(k => k.startsWith('N')).some(k => Number(data[k]) < 0 || Number(data[k]) > 10)) return Utils.toast('⚠️ Erro: As notas devem ser entre 0 e 10.');
            
            // Pack details into DetalhesJSON
            const detalhes = {};
            ['N1', 'N2', 'N3', 'N4', 'N5', 'N6', 'N7', 'N8', 'N9', 'PontosFortes', 'PontosMelhorar', 'Comentarios'].forEach(k => {
                if (data[k] !== undefined) {
                    detalhes[k] = data[k];
                    delete data[k]; // Remove from top level to avoid column error if strict
                }
            });
            data.DetalhesJSON = detalhes;
        }
        if (table === 'Folha') {
            if (!data.FuncionarioID) return Utils.toast('⚠️ Erro: Selecione um funcionário.');
            if (!data.Periodo) return Utils.toast('⚠️ Erro: O período de referência é obrigatório.');
            if (Number(data.SalarioLiquido) < 0) return Utils.toast('⚠️ Erro: O salário líquido não pode ser negativo. Revise os descontos.');
        }

        try {
            await Utils.api('save', table, data);
            Utils.toast('✅ Registro salvo com sucesso!');
            Utils.closeModal();

            // Atualiza só o cache da tabela afectada sem mudar de aba
            const cacheMap = {
                'Funcionarios':   async () => { RHModule.state.cache.allFuncionarios = await Utils.api('getEmployeesList', null) || []; await RHModule.loadEmployees(); },
                'Ferias':         async () => { RHModule.state.cache.ferias         = await Utils.api('getAll', 'Ferias')         || []; },
                'Frequencia':     async () => { RHModule.state.cache.frequencia     = await Utils.api('getAll', 'Frequencia')     || []; },
                'Avaliacoes':     async () => { RHModule.state.cache.avaliacoes     = await Utils.api('getAll', 'Avaliacoes')     || []; },
                'Treinamentos':   async () => { RHModule.state.cache.treinamentos   = await Utils.api('getAll', 'Treinamentos')   || []; },
                'Folha':          async () => { RHModule.state.cache.folha          = await Utils.api('getAll', 'Folha')          || []; },
                'Licencas':       async () => { RHModule.state.cache.licencas       = await Utils.api('getAll', 'Licencas')       || []; },
                'ParametrosRH':   async () => { RHModule.state.cache.parametros     = await Utils.api('getAll', 'ParametrosRH')   || []; },
                'Cargos':         async () => { RHModule.state.cache.cargos         = await Utils.api('getAll', 'Cargos')         || []; },
                'Departamentos':  async () => { RHModule.state.cache.departamentos  = await Utils.api('getAll', 'Departamentos')  || []; },
                'InstituicaoConfig': async () => { RHModule.state.cache.instituicao = await Utils.api('getAll', 'InstituicaoConfig') || []; },
                'EscalaConfig':   async () => { await RHModule.escalaCarregarAssignments(); }, // ← sincroniza assignments
            };

            const refreshFn = cacheMap[table];
            if (refreshFn) await refreshFn();

            RHModule.renderCurrentTab(); // Fica na mesma aba
        } catch (err) {
            console.error("Erro ao salvar:", err);
            Utils.toast('❌ Erro ao salvar: ' + err.message);
        }
    },

    delete: async (table, id) => {
        if(confirm('Tem certeza?')) {
            await Utils.api('delete', table, null, id);
            RHModule.fetchData();
        }
    }
};

document.addEventListener('DOMContentLoaded', RHModule.init);