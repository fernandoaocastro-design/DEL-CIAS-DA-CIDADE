const MLPainModule = {
    state: {
        activeTab: 'visao-geral',
        areas: [],
        registros: [],
        pratos: [],
        funcionarios: [],
        filterMonth: new Date().toISOString().slice(0, 7),
        instituicao: [],
        lastEntryDate: null,
        lastEntryTurno: null,
        lastEntryResp: null
    },

    init: () => {
        MLPainModule.fetchData();
    },

    fetchData: async () => {
        try {
            const [areas, registros, inst, pratos, funcionarios] = await Promise.all([
                MLPainModule.api('getAll', 'MLPain_Areas'),
                MLPainModule.api('getAll', 'MLPain_Registros'),
                MLPainModule.api('getAll', 'InstituicaoConfig'),
                MLPainModule.api('getAll', 'Pratos'),
                MLPainModule.api('getAll', 'Funcionarios')
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

    api: async (action, table, data = null, id = null) => {
        const res = await fetch('/.netlify/functions/business', {
            method: 'POST',
            body: JSON.stringify({ action, table, data, id })
        });
        const json = await res.json();
        if (json.success) return json.data;
        throw new Error(json.message || 'Erro na API');
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
        } else if (tab === 'tabela') {
            MLPainModule.renderTabela(container);
        } else if (tab === 'areas') {
            MLPainModule.renderAreas(container);
        }
    },

    // --- 1. VISÃO GERAL ---
    renderVisaoGeral: (container) => {
        const today = new Date().toISOString().split('T')[0];
        const recs = MLPainModule.state.registros.filter(r => r.Data === today);
        
        const totalSolidos = recs.filter(r => r.Tipo === 'Sólido').reduce((acc, r) => acc + Number(r.Quantidade), 0);
        const totalSopa = recs.filter(r => r.Subtipo === 'Sopa').reduce((acc, r) => acc + Number(r.Quantidade), 0);
        const totalCha = recs.filter(r => r.Subtipo === 'Chá').reduce((acc, r) => acc + Number(r.Quantidade), 0);

        // Dados para o Gráfico de Metas
        const areasAtivas = MLPainModule.state.areas.filter(a => a.Ativo);
        const labels = areasAtivas.map(a => a.Nome);
        const metas = areasAtivas.map(a => Number(a.MetaDiaria || 0));
        const realizados = areasAtivas.map(a => {
            return recs
                .filter(r => r.AreaID === a.ID || r.AreaNome === a.Nome)
                .reduce((acc, r) => acc + Number(r.Quantidade), 0);
        });

        container.innerHTML = `
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <div class="bg-white p-4 rounded shadow border-l-4 border-blue-500">
                    <div class="text-gray-500 text-sm">Refeições Hoje</div>
                    <div class="text-2xl font-bold">${totalSolidos + totalSopa + totalCha}</div>
                </div>
                <div class="bg-white p-4 rounded shadow border-l-4 border-green-500">
                    <div class="text-gray-500 text-sm">Sólidos (Geral)</div>
                    <div class="text-2xl font-bold text-green-600">${totalSolidos}</div>
                </div>
                <div class="bg-white p-4 rounded shadow border-l-4 border-yellow-500">
                    <div class="text-gray-500 text-sm">Sopas</div>
                    <div class="text-2xl font-bold text-yellow-600">${totalSopa}</div>
                </div>
                <div class="bg-white p-4 rounded shadow border-l-4 border-orange-500">
                    <div class="text-gray-500 text-sm">Chás</div>
                    <div class="text-2xl font-bold text-orange-600">${totalCha}</div>
                </div>
            </div>
            
            <div class="bg-white p-6 rounded shadow mb-8">
                <h3 class="text-lg font-bold text-gray-700 mb-4">Consumo Diário por Área vs Meta</h3>
                <div class="h-64"><canvas id="chartMetas"></canvas></div>
            </div>

            <div class="bg-white p-6 rounded shadow text-center">
                <h3 class="text-lg font-bold text-gray-700 mb-4">Acesso Rápido</h3>
                <button onclick="MLPainModule.setTab('lancamento')" class="bg-indigo-600 text-white px-6 py-3 rounded shadow hover:bg-indigo-700 transition">
                    <i class="fas fa-plus-circle mr-2"></i> Novo Lançamento de Refeições
                </button>
            </div>
        `;

        // Renderizar Gráfico de Metas (Misto: Barra + Linha)
        new Chart(document.getElementById('chartMetas'), {
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
    },

    // --- 2. LANÇAMENTO (FORMULÁRIO DINÂMICO) ---
    renderLancamento: (container) => {
        const areas = MLPainModule.state.areas.filter(a => a.Ativo);
        const pratos = MLPainModule.state.pratos.filter(p => p.Status === 'Ativo');
        const funcionarios = MLPainModule.state.funcionarios || [];
        
        const today = new Date().toISOString().split('T')[0];
        const defaultDate = MLPainModule.state.lastEntryDate || today;
        const defaultTurno = MLPainModule.state.lastEntryTurno || 'Manhã';
        const defaultResp = MLPainModule.state.lastEntryResp || '';

        container.innerHTML = `
            <div class="bg-white p-6 rounded shadow max-w-4xl mx-auto">
                <h3 class="text-xl font-bold text-gray-800 mb-6 border-b pb-2">Lançamento Diário de Refeições</h3>
                
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
                                <input type="radio" name="TipoRefeicao" value="Sólido" checked onchange="MLPainModule.toggleFormType('Sólido')">
                                <span class="font-bold text-blue-800">🍽️ Sólidos (Geral)</span>
                            </label>
                            <label class="flex items-center gap-2 cursor-pointer bg-orange-50 px-4 py-2 rounded border border-orange-200">
                                <input type="radio" name="TipoRefeicao" value="Líquido" onchange="MLPainModule.toggleFormType('Líquido')">
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

                    <button type="submit" class="w-full bg-green-600 text-white py-3 rounded font-bold hover:bg-green-700 transition shadow">
                        Adicionar Lançamento
                    </button>
                </form>
            </div>
        `;

        // Armazena pratos no estado global para acesso no toggle
        MLPainModule.tempPratos = pratos;
        MLPainModule.toggleFormType('Sólido'); // Inicializa com Sólido
    },

    toggleFormType: (type) => {
        const container = document.getElementById('dynamic-fields');
        const pratos = MLPainModule.tempPratos || [];
        const funcionarios = MLPainModule.state.funcionarios || [];

        // Atualizar Dropdown de Áreas conforme o Tipo selecionado
        const areaSelect = document.querySelector('select[name="AreaID"]');
        if (areaSelect) {
            const areasFiltradas = MLPainModule.state.areas.filter(a => a.Ativo && (a.Tipo === type || (!a.Tipo && type === 'Sólido')));
            areaSelect.innerHTML = '<option value="">Selecione a Área...</option>' + 
                areasFiltradas.map(a => `<option value="${a.ID}">${a.Nome}</option>`).join('');
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
                promises.push(MLPainModule.api('save', 'MLPain_Registros', {
                    ...commonData, Tipo: 'Sólido', Subtipo: 'Geral', Quantidade: qtd, Prato: prato
                }));
            }
        } else {
            const qtdSopa = formData.get('QtdSopa');
            const qtdCha = formData.get('QtdCha');
            
            if (qtdSopa && Number(qtdSopa) > 0) {
                promises.push(MLPainModule.api('save', 'MLPain_Registros', {
                    ...commonData, Tipo: 'Líquido', Subtipo: 'Sopa', Quantidade: qtdSopa
                }));
            }
            if (qtdCha && Number(qtdCha) > 0) {
                promises.push(MLPainModule.api('save', 'MLPain_Registros', {
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
        const recs = MLPainModule.state.registros.filter(r => r.Data.startsWith(month));
        
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
            if (!areaStats[area]) areaStats[area] = { Solido: 0, Liquido: 0 };
            if (r.Tipo === 'Sólido') areaStats[area].Solido += Number(r.Quantidade);
            else areaStats[area].Liquido += Number(r.Quantidade);
        });
        const areaLabels = Object.keys(areaStats);
        const dataSolido = areaLabels.map(a => areaStats[a].Solido);
        const dataLiquido = areaLabels.map(a => areaStats[a].Liquido);

        // --- PREPARAÇÃO DA MATRIZ (DIAS x ÁREAS) ---
        const [year, monthNum] = month.split('-');
        const daysInMonth = new Date(year, monthNum, 0).getDate();
        const days = Array.from({length: daysInMonth}, (_, i) => i + 1);
        const areas = MLPainModule.state.areas.filter(a => a.Ativo);
        const solidAreas = areas.filter(a => !a.Tipo || a.Tipo === 'Sólido');
        const liquidAreas = areas.filter(a => a.Tipo === 'Líquido');
        const weekDays = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

        // Inicializa Matriz
        const matrix = {};
        areas.forEach(a => {
            matrix[a.ID] = {};
            days.forEach(d => {
                matrix[a.ID][d] = { Solido: 0, Sopa: 0, Cha: 0 };
            });
        });

        // Preenche Matriz
        recs.forEach(r => {
            const d = new Date(r.Data).getDate();
            if (matrix[r.AreaID] && matrix[r.AreaID][d]) {
                const qtd = Number(r.Quantidade);
                if (r.Tipo === 'Sólido') matrix[r.AreaID][d].Solido += qtd;
                else if (r.Subtipo === 'Sopa') matrix[r.AreaID][d].Sopa += qtd;
                else if (r.Subtipo === 'Chá') matrix[r.AreaID][d].Cha += qtd;
            }
        });

        // Função auxiliar para gerar cada tabela matricial
        const renderMatrixTable = (title, typeKey, headerColorClass, badgeColorClass, areasToRender) => {
            return `
            <div class="mb-8 bg-white rounded shadow overflow-x-auto">
                <h4 class="font-bold text-gray-700 p-4 border-b ${headerColorClass}">${title}</h4>
                <table class="w-full text-xs text-center border-collapse min-w-max">
                    <thead>
                        <tr>
                            <th class="p-2 border bg-gray-100 text-left sticky left-0 z-10 min-w-[150px]">Área / Dia</th>
                            ${days.map(d => {
                                const date = new Date(year, monthNum - 1, d);
                                const dayIndex = date.getDay();
                                const wd = weekDays[dayIndex];
                                const isWeekend = dayIndex === 0 || dayIndex === 6;
                                const bgClass = isWeekend ? 'bg-orange-100 text-orange-800' : 'bg-gray-50 text-gray-500';
                                return `<th class="p-1 border ${bgClass} min-w-[35px]">
                                    <div class="text-[9px] uppercase">${wd}</div>
                                    <div>${d}</div>
                                </th>`;
                            }).join('')}
                            <th class="p-2 border bg-gray-200 font-bold min-w-[50px]">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${areasToRender.map(a => {
                            let rowTotal = 0;
                            const cells = days.map(d => {
                                const date = new Date(year, monthNum - 1, d);
                                const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                                const bgClass = isWeekend ? 'bg-orange-50' : '';
                                const val = matrix[a.ID][d][typeKey];
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
                </table>
            </div>`;
        };

        container.innerHTML = `
            <div class="flex justify-between items-center mb-6">
                <h3 class="text-xl font-bold text-gray-800">Relatório Mensal</h3>
                <div class="flex gap-2">
                    <input type="month" value="${month}" class="border p-2 rounded" onchange="MLPainModule.state.filterMonth = this.value; MLPainModule.renderTabela(document.getElementById('mlpain-content'))">
                    <button onclick="MLPainModule.exportPDF()" class="bg-red-600 text-white px-4 py-2 rounded shadow hover:bg-red-700 transition">
                        <i class="fas fa-file-pdf mr-2"></i> Exportar PDF
                    </button>
                </div>
            </div>

            <div id="print-area-mlpain" class="p-2 bg-white">
                <div id="pdf-header" class="hidden mb-6 border-b pb-4"></div>
                <h4 class="text-center font-bold text-gray-500 mb-4 hidden" id="pdf-title">Relatório de Refeições - ${month}</h4>

            <!-- GRÁFICOS (Dentro da área de impressão) -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
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

            <!-- TABELAS MATRICIAIS SEPARADAS -->
            ${renderMatrixTable('Mapa de Dietas Sólidas', 'Solido', 'text-green-700', 'bg-green-500', solidAreas)}
            ${renderMatrixTable('Mapa de Dietas Líquidas - Sopa', 'Sopa', 'text-yellow-700', 'bg-yellow-500', liquidAreas)}
            ${renderMatrixTable('Mapa de Dietas Líquidas - Chá', 'Cha', 'text-red-700', 'bg-red-500', liquidAreas)}

            <!-- TABELA DETALHADA -->
            <div class="bg-white rounded shadow overflow-hidden">
                <h4 class="font-bold text-gray-700 p-4 border-b">Detalhamento dos Lançamentos</h4>
                <table class="w-full text-sm text-left">
                    <thead class="bg-gray-100 text-gray-600 uppercase">
                        <tr><th>Data</th><th>Turno</th><th>Área</th><th>Tipo</th><th>Detalhe</th><th class="text-right">Qtd</th><th>Resp.</th></tr>
                    </thead>
                    <tbody class="divide-y">
                        ${recs.sort((a,b) => new Date(b.Data) - new Date(a.Data)).map(r => `
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
            
            <div id="pdf-footer" class="hidden mt-10 pt-4 border-t text-center"></div>
            </div>
        `;

        // Renderizar Gráfico
        new Chart(document.getElementById('chartGeral'), {
            type: 'doughnut',
            data: {
                labels: ['Sólidos', 'Sopa', 'Chá'],
                datasets: [{ data: [totals.Solido, totals.Sopa, totals.Cha], backgroundColor: ['#10B981', '#F59E0B', '#F97316'] }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
        });

        // Renderizar Gráfico Comparativo
        new Chart(document.getElementById('chartComparativo'), {
            type: 'bar',
            data: {
                labels: areaLabels,
                datasets: [
                    { label: 'Sólidos', data: dataSolido, backgroundColor: '#10B981' },
                    { label: 'Líquidos', data: dataLiquido, backgroundColor: '#F97316' }
                ]
            },
            options: { responsive: true, maintainAspectRatio: false, scales: { x: { stacked: true }, y: { stacked: true } } }
        });
    },

    exportPDF: () => {
        const element = document.getElementById('print-area-mlpain');
        const header = document.getElementById('pdf-header');
        const footer = document.getElementById('pdf-footer');
        const title = document.getElementById('pdf-title');
        const inst = MLPainModule.state.instituicao[0] || {};
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        
        // Configura Cabeçalho
        header.innerHTML = `
            <div class="flex items-center gap-4 border-b pb-2 mb-4">
                ${inst.LogotipoURL ? `<img src="${inst.LogotipoURL}" class="h-10 w-auto object-contain">` : ''}
                <div>
                    <h1 class="text-xl font-bold text-gray-800">${inst.NomeFantasia || 'Relatório M.L. Pain'}</h1>
                    <p class="text-xs text-gray-500">${inst.Endereco || ''} | ${inst.Telefone || ''}</p>
                </div>
            </div>
        `;
        header.classList.remove('hidden');
        title.classList.remove('hidden');

        // Configura Rodapé
        footer.innerHTML = `<p class="text-[10px] text-gray-400 text-right mt-4 border-t pt-2">Gerado por ${user.Nome} em ${new Date().toLocaleString()}</p>`;
        footer.classList.remove('hidden');
        
        const opt = {
            margin: [10, 10, 10, 10],
            filename: `relatorio-mlpain-${MLPainModule.state.filterMonth}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, scrollY: 0 },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
            pagebreak: { mode: 'avoid-all' }
        };
        
        html2pdf().set(opt).from(element).save().then(() => {
            header.classList.add('hidden'); title.classList.add('hidden'); footer.classList.add('hidden');
        });
    },

    // --- 4. GESTÃO DE ÁREAS ---
    renderAreas: (container) => {
        const areas = MLPainModule.state.areas;
        const solidas = areas.filter(a => !a.Tipo || a.Tipo === 'Sólido');
        const liquidas = areas.filter(a => a.Tipo === 'Líquido');
        const canDelete = Utils.checkPermission('MLPain', 'excluir');

        const renderTable = (list, title, type, colorClass) => `
            <div class="mb-8">
                <div class="flex justify-between items-center mb-4">
                    <h4 class="text-lg font-bold ${colorClass}">${title}</h4>
                    <button onclick="MLPainModule.modalArea('${type}')" class="${colorClass.replace('text-', 'bg-').replace('700', '600')} text-white px-4 py-2 rounded shadow hover:opacity-90">+ Nova Área ${type}</button>
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
                                        <button onclick="MLPainModule.modalArea('${type}', '${a.ID}')" class="text-blue-500 hover:text-blue-700 mr-2"><i class="fas fa-edit"></i></button>
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
            await MLPainModule.api('save', 'MLPain_Areas', data);
            Utils.toast('✅ Área salva!'); Utils.closeModal(); MLPainModule.fetchData();
        } catch (err) { Utils.toast('Erro ao salvar'); }
    },

    deleteArea: async (id) => {
        if(confirm('Remover esta área?')) {
            await MLPainModule.api('delete', 'MLPain_Areas', null, id);
            MLPainModule.fetchData();
        }
    }
};

document.addEventListener('DOMContentLoaded', MLPainModule.init);