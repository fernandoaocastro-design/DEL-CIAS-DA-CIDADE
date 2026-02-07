const ProducaoModule = {
    state: {
        activeTab: 'planejamento',
        fichas: [],
        planejamento: [],
        ordens: [],
        desperdicio: [],
        estoque: [], // Necessário para ingredientes
        consumo: [],
        charts: {},
        instituicao: [],
        productionPlans: [],
        checklistDate: new Date().toISOString().split('T')[0]
    },

    init: () => {
        ProducaoModule.fetchData();
    },

    fetchData: async () => {
        try {
            const [fichas, plan, ordens, desp, estoque, consumo, inst, prodPlans] = await Promise.all([
                Utils.api('getAll', 'FichasTecnicas'),
                Utils.api('getAll', 'PlanejamentoProducao'),
                Utils.api('getAll', 'OrdensProducao'),
                Utils.api('getAll', 'ControleDesperdicio'),
                Utils.api('getAll', 'Estoque'),
                Utils.api('getAll', 'ConsumoIngredientes'),
                Utils.api('getAll', 'InstituicaoConfig'),
                Utils.api('getAll', 'production_plans')
            ]);
            
            ProducaoModule.state.fichas = fichas || [];
            ProducaoModule.state.planejamento = plan || [];
            ProducaoModule.state.ordens = ordens || [];
            ProducaoModule.state.desperdicio = desp || [];
            ProducaoModule.state.estoque = estoque || [];
            ProducaoModule.state.consumo = consumo || [];
            ProducaoModule.state.instituicao = inst || [];
            ProducaoModule.state.productionPlans = prodPlans || [];
            
            ProducaoModule.render();
        } catch (e) {
            console.error(e);
            Utils.toast("Erro ao carregar dados de produção.", 'error');
        }
    },

    setTab: (tab) => {
        ProducaoModule.state.activeTab = tab;
        
        // Atualiza visual das abas
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.className = 'tab-btn px-4 py-2 text-gray-500 hover:text-gray-700 transition whitespace-nowrap';
            btn.style.borderBottom = 'none';
        });
        const activeBtn = document.getElementById(`tab-${tab}`);
        if(activeBtn) {
            activeBtn.className = 'tab-btn px-4 py-2 font-bold text-orange-600 border-b-2 border-orange-500 transition whitespace-nowrap';
        }
        ProducaoModule.render();
    },

    render: () => {
        const container = document.getElementById('producao-content');
        const tab = ProducaoModule.state.activeTab;

        if (tab === 'planejamento') ProducaoModule.renderPlanejamento(container);
        else if (tab === 'visao-geral') ProducaoModule.renderVisaoGeralAgendamento(container);
        else if (tab === 'novo') ProducaoModule.renderNovoPlanejamento(container);
        else if (tab === 'fichas') ProducaoModule.renderFichas(container);
        else if (tab === 'ordens') ProducaoModule.renderOrdens(container);
        else if (tab === 'ingredientes') ProducaoModule.renderIngredientes(container);
        else if (tab === 'desperdicio') ProducaoModule.renderDesperdicio(container);
        else if (tab === 'custos') ProducaoModule.renderCustos(container);
        else if (tab === 'relatorios') ProducaoModule.renderRelatorios(container);
        else if (tab === 'limpeza') ProducaoModule.renderLimpeza(container);
    },

    // 📅 NOVO MÓDULO: AGENDAMENTO DE PRODUÇÃO
    renderVisaoGeralAgendamento: (container) => {
        const plans = ProducaoModule.state.productionPlans || [];
        container.innerHTML = `
            <div class="flex justify-between mb-4">
                <h3 class="text-xl font-bold text-gray-800">Visão Geral do Agendamento</h3>
                <button onclick="ProducaoModule.setTab('novo')" class="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700">
                    <i class="fas fa-plus"></i> Novo Planejamento
                </button>
            </div>
            <div class="bg-white rounded shadow overflow-x-auto">
                <table class="w-full text-sm text-left">
                    <thead class="bg-gray-100 text-gray-600 uppercase">
                        <tr><th>Data</th><th>Staff (Dia/Noite)</th><th>Pacientes (Sól/Liq)</th><th>Meta Sólida</th><th>Ações</th></tr>
                    </thead>
                    <tbody class="divide-y">
                        ${plans.map(p => `
                            <tr class="hover:bg-gray-50">
                                <td class="p-3 font-bold">${Utils.formatDate(p.planning_date)}</td>
                                <td class="p-3">${p.staff_count_day} / ${p.staff_count_night}</td>
                                <td class="p-3">${p.patient_solid} / ${p.patient_liquid}</td>
                                <td class="p-3 font-bold text-blue-600">${p.meta_solid}</td>
                                <td class="p-3">
                                    <button onclick="ProducaoModule.printProductionPlan('${p.id}')" class="text-red-600 hover:text-red-800 bg-red-50 p-2 rounded transition" title="Imprimir Ficha de Produção"><i class="fas fa-file-pdf"></i> Ficha do Dia</button>
                                </td>
                            </tr>
                        `).join('')}
                        ${plans.length === 0 ? '<tr><td colspan="5" class="p-4 text-center text-gray-500">Nenhum planejamento encontrado.</td></tr>' : ''}
                    </tbody>
                </table>
            </div>
        `;
    },

    renderNovoPlanejamento: (container) => {
        container.innerHTML = `
            <div class="max-w-5xl mx-auto">
                <h2 class="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                    <i class="fas fa-calendar-plus text-blue-600"></i> Novo Planejamento de Produção
                </h2>

                <form onsubmit="ProducaoModule.saveProductionPlan(event)">
                    <!-- SEÇÃO 1: CÁLCULO DE PESSOAS / META -->
                    <div class="bg-white p-6 rounded-lg shadow mb-6 border-l-4 border-blue-500">
                        <h3 class="font-bold text-gray-700 mb-4 border-b pb-2">1. Definição de Metas (Pessoas)</h3>
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Data do Planejamento</label>
                                <input type="date" name="planning_date" class="border p-2 rounded w-full" required>
                            </div>
                            <div class="bg-gray-50 p-3 rounded">
                                <label class="block text-xs font-bold text-blue-600 uppercase mb-2">Funcionários (Staff)</label>
                                <div class="grid grid-cols-2 gap-2">
                                    <input type="number" name="staff_count_day" placeholder="Dia" class="border p-2 rounded text-sm" min="0">
                                    <input type="number" name="staff_count_night" placeholder="Noite" class="border p-2 rounded text-sm" min="0">
                                </div>
                            </div>
                            <div class="bg-gray-50 p-3 rounded">
                                <label class="block text-xs font-bold text-green-600 uppercase mb-2">Pacientes</label>
                                <div class="grid grid-cols-2 gap-2">
                                    <input type="number" name="patient_solid" placeholder="Sólida" class="border p-2 rounded text-sm" min="0">
                                    <input type="number" name="patient_liquid" placeholder="Líquida" class="border p-2 rounded text-sm" min="0">
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- SEÇÃO 2: FICHA TÉCNICA (CARTÕES) -->
                    <h3 class="font-bold text-gray-700 mb-4 flex items-center gap-2">
                        <i class="fas fa-clipboard-list"></i> Ficha Técnica de Produção
                    </h3>
                    
                    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                        
                        <!-- CARTÃO 1: SÓLIDOS -->
                        <div class="bg-white rounded-lg shadow overflow-hidden flex flex-col h-full">
                            <div class="bg-green-600 text-white p-3 font-bold text-center">🍽️ SÓLIDOS (Prato Principal)</div>
                            <div class="p-4 flex-1">
                                <div class="mb-4">
                                    <label class="block text-xs font-bold text-gray-500 mb-1">Nome do Prato</label>
                                    <input type="text" id="solid-dish-name" class="border p-2 rounded w-full font-bold text-gray-700" placeholder="Ex: Frango Grelhado">
                                </div>
                                <label class="block text-xs font-bold text-gray-500 mb-1">Ingredientes</label>
                                <div id="solid-ingredients-list" class="space-y-2 mb-4 max-h-64 overflow-y-auto pr-1"></div>
                                <button type="button" onclick="ProducaoModule.addIngredienteRow()" class="w-full py-2 border-2 border-dashed border-gray-300 text-gray-500 rounded hover:bg-gray-50 hover:border-green-500 hover:text-green-600 transition text-sm font-bold">+ Adicionar Ingrediente</button>
                            </div>
                        </div>

                        <!-- CARTÃO 2: SOPA -->
                        <div class="bg-white rounded-lg shadow overflow-hidden flex flex-col h-full">
                            <div class="bg-yellow-500 text-white p-3 font-bold text-center">🥣 SOPA (Base & Legumes)</div>
                            <div class="p-4 flex-1 space-y-4">
                                <div class="grid grid-cols-2 gap-3">
                                    <div><label class="text-xs font-bold text-gray-500">Fuba (g/Kg)</label><input type="number" step="0.1" id="soup-fuba" class="border p-2 rounded w-full"></div>
                                    <div><label class="text-xs font-bold text-gray-500">Batata Rena</label><input type="number" step="0.1" id="soup-potato" class="border p-2 rounded w-full"></div>
                                    <div><label class="text-xs font-bold text-gray-500">Massa (Pct)</label><input type="number" step="1" id="soup-pasta" class="border p-2 rounded w-full"></div>
                                    <div><label class="text-xs font-bold text-gray-500">Cebola (Kg)</label><input type="number" step="0.1" id="soup-onion" class="border p-2 rounded w-full"></div>
                                </div>
                                <div class="border-t pt-3">
                                    <label class="block text-xs font-bold text-gray-500 mb-2">Seleção de Legumes</label>
                                    <div class="grid grid-cols-2 gap-2 text-sm">
                                        ${['Cenoura', 'Abóbora', 'Couve', 'Repolho', 'Beringela', 'Quiabo'].map(v => `<label class="flex items-center gap-2"><input type="checkbox" class="soup-veg" value="${v}"> ${v}</label>`).join('')}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- CARTÃO 3: CHÁ -->
                        <div class="bg-white rounded-lg shadow overflow-hidden flex flex-col h-full">
                            <div class="bg-orange-500 text-white p-3 font-bold text-center">☕ CHÁ (Matinal/Noturno)</div>
                            <div class="p-4 flex-1">
                                <div class="space-y-4">
                                    <div><label class="block text-xs font-bold text-gray-500 mb-1">Erva / Chá (Qtd)</label><input type="number" step="0.1" id="tea-herb" class="border p-2 rounded w-full" placeholder="Ex: 5"></div>
                                    <div><label class="block text-xs font-bold text-gray-500 mb-1">Açúcar (Kg)</label><input type="number" step="0.1" id="tea-sugar" class="border p-2 rounded w-full" placeholder="Ex: 2"></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="flex justify-end gap-3">
                        <button type="button" onclick="ProducaoModule.setTab('visao-geral')" class="px-6 py-3 rounded border text-gray-600 hover:bg-gray-100">Cancelar</button>
                        <button type="submit" class="px-6 py-3 rounded bg-blue-600 text-white font-bold hover:bg-blue-700 shadow-lg flex items-center gap-2"><i class="fas fa-save"></i> Salvar Planejamento</button>
                    </div>
                </form>
            </div>
        `;
        ProducaoModule.addIngredienteRow();
    },

    addIngredienteRow: () => {
        const container = document.getElementById('solid-ingredients-list');
        if (!container) return;
        const div = document.createElement('div');
        div.className = 'flex gap-2 items-center ingredient-row';
        div.innerHTML = `<input type="text" placeholder="Item (ex: Arroz)" class="border p-2 rounded w-full text-sm ing-name"><input type="text" placeholder="Qtd" class="border p-2 rounded w-24 text-sm ing-qty"><button type="button" onclick="this.parentElement.remove()" class="text-red-500 hover:text-red-700 px-2"><i class="fas fa-times"></i></button>`;
        container.appendChild(div);
    },

    saveProductionPlan: async (e) => {
        e.preventDefault();
        const form = e.target;
        const formData = new FormData(form);
        const baseData = { planning_date: formData.get('planning_date'), staff_count_day: Number(formData.get('staff_count_day')||0), staff_count_night: Number(formData.get('staff_count_night')||0), patient_solid: Number(formData.get('patient_solid')||0), patient_liquid: Number(formData.get('patient_liquid')||0) };
        
        const solidIngredients = [];
        document.querySelectorAll('.ingredient-row').forEach(row => { const name = row.querySelector('.ing-name').value; const qty = row.querySelector('.ing-qty').value; if (name) solidIngredients.push({ item: name, qtd: qty }); });
        const soupVegs = [];
        document.querySelectorAll('.soup-veg:checked').forEach(cb => soupVegs.push(cb.value));

        const productionDetails = { solidos: { prato: document.getElementById('solid-dish-name').value, ingredientes: solidIngredients }, sopa: { fuba: document.getElementById('soup-fuba').value, batata: document.getElementById('soup-potato').value, massa: document.getElementById('soup-pasta').value, cebola: document.getElementById('soup-onion').value, legumes: soupVegs }, cha: { erva: document.getElementById('tea-herb').value, acucar: document.getElementById('tea-sugar').value } };
        
        try { await Utils.api('save', 'production_plans', { ...baseData, production_details: productionDetails }); Utils.toast('Planejamento salvo!', 'success'); ProducaoModule.fetchData(); ProducaoModule.setTab('visao-geral'); } catch (err) { Utils.toast('Erro: ' + err.message, 'error'); }
    },

    printProductionPlan: (id) => {
        const plan = ProducaoModule.state.productionPlans.find(p => p.id === id);
        if (!plan) return Utils.toast('Planejamento não encontrado.', 'error');

        const details = plan.production_details || {};
        const solidos = details.solidos || {};
        const sopa = details.sopa || {};
        const cha = details.cha || {};
        const inst = ProducaoModule.state.instituicao[0] || {};
        const showLogo = inst.ExibirLogoRelatorios;

        // Elemento temporário
        const printDiv = document.createElement('div');
        printDiv.id = 'print-production-plan';
        printDiv.style.position = 'absolute';
        printDiv.style.left = '-9999px';
        printDiv.style.top = '0';
        printDiv.style.width = '210mm'; // A4 Portrait
        printDiv.style.background = 'white';

        // Helper para formatar ingredientes
        const renderIngredientes = (list) => {
            if (!list || list.length === 0) return '<div class="text-xs text-gray-500 italic">Nenhum ingrediente listado.</div>';
            return `<ul class="list-disc pl-4 text-sm">${list.map(i => `<li><b>${i.item}</b>: ${i.qtd}</li>`).join('')}</ul>`;
        };

        // Helper para legumes (array de strings)
        const renderLegumes = (list) => {
             if (!list || list.length === 0) return '-';
             return list.join(', ');
        };

        printDiv.innerHTML = `
            <div class="p-8 font-sans text-gray-900">
                <!-- Cabeçalho -->
                <div class="flex items-center justify-between border-b-2 border-gray-800 pb-4 mb-6">
                    <div class="${showLogo && inst.LogotipoURL ? 'flex items-center gap-4' : ''}">
                        ${showLogo && inst.LogotipoURL ? `<img src="${inst.LogotipoURL}" class="h-16 w-auto object-contain">` : ''}
                        <div>
                            <h1 class="text-xl font-bold uppercase">${inst.NomeFantasia || 'Delícia da Cidade'}</h1>
                            <p class="text-sm text-gray-600">Ficha de Produção Diária</p>
                        </div>
                    </div>
                    <div class="text-right">
                        <h2 class="text-2xl font-bold text-gray-800">${Utils.formatDate(plan.planning_date)}</h2>
                        <p class="text-xs text-gray-500">Gerado em: ${new Date().toLocaleString()}</p>
                    </div>
                </div>

                <!-- 1. Metas de Produção -->
                <div class="mb-6 bg-gray-50 p-4 rounded border border-gray-200">
                    <h3 class="font-bold text-gray-800 border-b border-gray-300 mb-3 pb-1 uppercase text-sm">1. Metas de Produção</h3>
                    <div class="grid grid-cols-3 gap-4 text-center">
                        <div>
                            <p class="text-xs text-gray-500 uppercase font-bold">Sólidos (Total)</p>
                            <p class="text-2xl font-bold text-blue-700">${plan.meta_solid}</p>
                            <p class="text-xs text-gray-400">Staff: ${plan.staff_count_day + plan.staff_count_night} | Pacientes: ${plan.patient_solid}</p>
                        </div>
                        <div>
                            <p class="text-xs text-gray-500 uppercase font-bold">Sopa (Líquida)</p>
                            <p class="text-2xl font-bold text-yellow-600">${plan.meta_soup}</p>
                            <p class="text-xs text-gray-400">Pacientes: ${plan.patient_liquid}</p>
                        </div>
                        <div>
                            <p class="text-xs text-gray-500 uppercase font-bold">Chá</p>
                            <p class="text-2xl font-bold text-orange-600">${plan.meta_tea}</p>
                            <p class="text-xs text-gray-400">Pacientes: ${plan.patient_liquid}</p>
                        </div>
                    </div>
                </div>

                <!-- 2. Prato Principal (Sólidos) -->
                <div class="mb-6">
                    <h3 class="font-bold text-white bg-green-700 p-2 mb-3 uppercase text-sm rounded-t">2. Sólidos - Prato Principal</h3>
                    <div class="border border-green-200 rounded-b p-4">
                        <div class="mb-3">
                            <span class="text-xs font-bold text-gray-500 uppercase block">Nome do Prato</span>
                            <span class="text-lg font-bold">${solidos.prato || 'Não definido'}</span>
                        </div>
                        <div>
                            <span class="text-xs font-bold text-gray-500 uppercase block mb-1">Ingredientes / Insumos</span>
                            ${renderIngredientes(solidos.ingredientes)}
                        </div>
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-6">
                    <!-- 3. Sopa -->
                    <div class="mb-6">
                        <h3 class="font-bold text-white bg-yellow-600 p-2 mb-3 uppercase text-sm rounded-t">3. Sopa</h3>
                        <div class="border border-yellow-200 rounded-b p-4 text-sm">
                            <div class="grid grid-cols-2 gap-2 mb-3">
                                <div><span class="font-bold block text-xs text-gray-500">Fuba</span>${sopa.fuba || '-'} g/Kg</div>
                                <div><span class="font-bold block text-xs text-gray-500">Batata Rena</span>${sopa.batata || '-'} g/Kg</div>
                                <div><span class="font-bold block text-xs text-gray-500">Massa</span>${sopa.massa || '-'} Pct</div>
                                <div><span class="font-bold block text-xs text-gray-500">Cebola</span>${sopa.cebola || '-'} Kg</div>
                            </div>
                            <div class="border-t pt-2 mt-2">
                                <span class="font-bold block text-xs text-gray-500 mb-1">Legumes Selecionados</span>
                                <p>${renderLegumes(sopa.legumes)}</p>
                            </div>
                        </div>
                    </div>

                    <!-- 4. Chá -->
                    <div class="mb-6">
                        <h3 class="font-bold text-white bg-orange-600 p-2 mb-3 uppercase text-sm rounded-t">4. Chá</h3>
                        <div class="border border-orange-200 rounded-b p-4 text-sm">
                            <div class="mb-3">
                                <span class="font-bold block text-xs text-gray-500">Erva / Chá</span>
                                <span class="text-lg">${cha.erva || '-'} <span class="text-xs font-normal">Qtd</span></span>
                            </div>
                            <div>
                                <span class="font-bold block text-xs text-gray-500">Açúcar</span>
                                <span class="text-lg">${cha.acucar || '-'} <span class="text-xs font-normal">Kg</span></span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Assinaturas -->
                <div class="mt-12 grid grid-cols-2 gap-12 text-center">
                    <div class="border-t border-gray-400 pt-2">
                        <p class="font-bold text-sm">Responsável Cozinha</p>
                    </div>
                    <div class="border-t border-gray-400 pt-2">
                        <p class="font-bold text-sm">Nutricionista / Supervisor</p>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(printDiv);

        const opt = {
            margin: 10,
            filename: `ficha-producao-${plan.planning_date}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        html2pdf().set(opt).from(printDiv).save().then(() => {
            document.body.removeChild(printDiv);
        });
    },

    // 🍽️ 1️⃣ Planejamento de Produção
    renderPlanejamento: (container) => {
        const data = ProducaoModule.state.planejamento;
        const canCreate = Utils.checkPermission('Producao', 'criar');
        container.innerHTML = `
            <div class="flex justify-between mb-4">
                <h3 class="text-xl font-bold text-gray-800">Planejamento de Produção</h3>
                ${canCreate ? `<button onclick="ProducaoModule.modalPlanejamento()" class="bg-orange-600 text-white px-4 py-2 rounded shadow hover:bg-orange-700">
                    <i class="fas fa-plus"></i> Novo Planejamento
                </button>` : ''}
            </div>
            <div class="bg-white rounded shadow overflow-x-auto">
                <table class="w-full text-sm text-left">
                    <thead class="bg-gray-100 text-gray-600 uppercase">
                        <tr><th>Data</th><th>Refeição</th><th>Setor</th><th>Receita</th><th>Qtd Plan.</th><th>Status</th><th>Ações</th></tr>
                    </thead>
                    <tbody class="divide-y">
                        ${data.map(p => `
                            <tr class="hover:bg-gray-50">
                                <td class="p-3">${Utils.formatDate(p.DataProducao)}</td>
                                <td class="p-3">${p.TipoRefeicao}</td>
                                <td class="p-3">${p.Setor}</td>
                                <td class="p-3 font-bold">${p.ReceitaNome}</td>
                                <td class="p-3">${p.QtdPlanejada}</td>
                                <td class="p-3"><span class="px-2 py-1 rounded text-xs bg-blue-100 text-blue-800">${p.Status}</span></td>
                                <td class="p-3">
                                    ${canCreate ? `<button onclick="ProducaoModule.gerarOrdem('${p.ID}')" class="text-green-600 hover:text-green-800" title="Gerar Ordem"><i class="fas fa-file-signature"></i></button>` : ''}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },

    modalPlanejamento: () => {
        const receitas = ProducaoModule.state.fichas;
        Utils.openModal('Novo Planejamento', `
            <form onsubmit="ProducaoModule.save(event, 'PlanejamentoProducao')">
                <div class="grid grid-cols-2 gap-3 mb-3">
                    <div><label class="text-xs font-bold">Data Produção</label><input type="date" name="DataProducao" class="border p-2 rounded w-full" required></div>
                    <div><label class="text-xs font-bold">Tipo Refeição</label>
                        <select name="TipoRefeicao" class="border p-2 rounded w-full">
                            <option>Café da Manhã</option><option>Almoço</option><option>Jantar</option><option>Ceia</option>
                        </select>
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-3 mb-3">
                    <div><label class="text-xs font-bold">Setor / Unidade</label><input name="Setor" class="border p-2 rounded w-full" placeholder="Ex: Pediatria"></div>
                    <div><label class="text-xs font-bold">Nº Pacientes</label><input type="number" name="QtdPacientes" class="border p-2 rounded w-full"></div>
                </div>
                <div class="mb-3">
                    <label class="text-xs font-bold">Receita Planejada</label>
                    <select name="ReceitaID" class="border p-2 rounded w-full" onchange="this.form.ReceitaNome.value = this.options[this.selectedIndex].text">
                        <option value="">Selecione...</option>
                        ${receitas.map(r => `<option value="${r.ID}">${r.Nome}</option>`).join('')}
                    </select>
                    <input type="hidden" name="ReceitaNome">
                </div>
                <div class="grid grid-cols-2 gap-3 mb-3">
                    <div><label class="text-xs font-bold">Qtd Planejada (Kg/Porções)</label><input type="number" name="QtdPlanejada" class="border p-2 rounded w-full"></div>
                    <div><label class="text-xs font-bold">Resp. Técnico</label><input name="ResponsavelTecnico" class="border p-2 rounded w-full"></div>
                </div>
                <div class="mb-3"><label class="text-xs font-bold">Observações</label><textarea name="Observacoes" class="border p-2 rounded w-full"></textarea></div>
                <button class="w-full bg-orange-600 text-white py-2 rounded font-bold">Salvar Planejamento</button>
            </form>
        `);
    },

    // 🧑‍🍳 2️⃣ Fichas Técnicas
    renderFichas: (container) => {
        const data = ProducaoModule.state.fichas;
        const canCreate = Utils.checkPermission('Producao', 'criar');
        const canEdit = Utils.checkPermission('Producao', 'editar');
        const canDelete = Utils.checkPermission('Producao', 'excluir');
        container.innerHTML = `
            <div class="flex justify-between mb-4">
                <h3 class="text-xl font-bold text-gray-800">Fichas Técnicas</h3>
                ${canCreate ? `<button onclick="ProducaoModule.modalFicha()" class="bg-orange-600 text-white px-4 py-2 rounded shadow hover:bg-orange-700">
                    <i class="fas fa-plus"></i> Nova Ficha
                </button>` : ''}
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                ${data.map(f => `
                    <div class="bg-white p-4 rounded shadow border-l-4 border-orange-400">
                        <h4 class="font-bold text-lg">${f.Nome}</h4>
                        <p class="text-xs text-gray-500 mb-2">${f.Categoria || 'Geral'}</p>
                        <div class="text-sm mb-2">
                            <div>⏱️ ${f.TempoPreparo || '-'}</div>
                            <div>🥘 Rendimento: ${f.Rendimento || 0} porções</div>
                            <div class="font-bold text-green-600">💰 Custo: ${Utils.formatCurrency(f.CustoPorPorcao)}</div>
                        </div>
                        <div class="flex gap-3 mt-2">
                            ${canEdit ? `<button onclick="ProducaoModule.modalFicha('${f.ID}')" class="text-blue-600 text-sm hover:underline">Editar</button>` : ''}
                            ${canCreate ? `<button onclick="ProducaoModule.duplicarFicha('${f.ID}')" class="text-gray-600 text-sm hover:text-gray-800" title="Duplicar"><i class="fas fa-copy"></i> Duplicar</button>` : ''}
                            ${canDelete ? `<button onclick="ProducaoModule.deleteFicha('${f.ID}')" class="text-red-500 text-sm hover:text-red-700 ml-auto" title="Excluir"><i class="fas fa-trash"></i></button>` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    },

    duplicarFicha: async (id) => {
        if(!confirm('Deseja duplicar esta ficha técnica?')) return;
        const original = ProducaoModule.state.fichas.find(f => f.ID === id);
        if(!original) return;

        const copia = { ...original };
        delete copia.ID;
        delete copia.CriadoEm;
        copia.Nome = copia.Nome + ' (Cópia)';

        try {
            await Utils.api('save', 'FichasTecnicas', copia);
            Utils.toast('Ficha duplicada com sucesso!', 'success');
            ProducaoModule.fetchData();
        } catch (err) { Utils.toast('Erro ao duplicar: ' + err.message, 'error'); }
    },

    modalFicha: (id = null) => {
        const ficha = id ? ProducaoModule.state.fichas.find(f => f.ID === id) : {};
        const estoque = ProducaoModule.state.estoque || [];
        const ingredientes = ficha.IngredientesJSON || [];

        // Função para adicionar linha de ingrediente
        window.addIngrediente = () => {
            const container = document.getElementById('lista-ingredientes');
            // Usa timestamp para garantir ID único e evitar conflito ao excluir/adicionar linhas
            const index = Date.now() + Math.floor(Math.random() * 1000);
            const div = document.createElement('div');
            div.className = 'grid grid-cols-12 gap-2 mb-2 items-center ingrediente-row';
            div.innerHTML = `
                <div class="col-span-6">
                    <select name="ingrediente_id_${index}" class="border p-2 rounded w-full text-sm" onchange="updateCusto(this)">
                        <option value="">Selecione...</option>
                        ${estoque.map(e => `<option value="${e.ID}" data-custo="${e.CustoUnitario}" data-unidade="${e.Unidade}">${e.Nome} (${e.Unidade})</option>`).join('')}
                    </select>
                </div>
                <div class="col-span-3">
                    <input type="number" step="0.001" name="ingrediente_qtd_${index}" class="border p-2 rounded w-full text-sm" placeholder="Qtd" oninput="calcCustoTotal()">
                </div>
                <div class="col-span-2">
                    <input type="text" readonly class="border p-2 rounded w-full text-sm bg-gray-100 text-right custo-parcial" value="0.00">
                </div>
                <div class="col-span-1 text-center">
                    <button type="button" onclick="this.parentElement.parentElement.remove(); calcCustoTotal()" class="text-red-500"><i class="fas fa-times"></i></button>
                </div>
            `;
            container.appendChild(div);
        };

        Utils.openModal(id ? 'Editar Ficha Técnica' : 'Nova Ficha Técnica', `
            <form onsubmit="ProducaoModule.save(event, 'FichasTecnicas')">
                <input type="hidden" name="ID" value="${ficha.ID || ''}">
                <div class="mb-3"><label class="text-xs font-bold">Nome da Preparação</label><input name="Nome" value="${ficha.Nome || ''}" class="border p-2 rounded w-full" required></div>
                <div class="grid grid-cols-2 gap-3 mb-3">
                    <div><label class="text-xs font-bold">Categoria</label><select name="Categoria" class="border p-2 rounded w-full"><option>Prato Principal</option><option>Guarnição</option><option>Sobremesa</option><option>Salada</option></select></div>
                    <div><label class="text-xs font-bold">Tempo Preparo</label><input name="TempoPreparo" value="${ficha.TempoPreparo || ''}" class="border p-2 rounded w-full"></div>
                </div>
                <div class="grid grid-cols-2 gap-3 mb-3">
                    <div><label class="text-xs font-bold">Rendimento (Porções)</label><input type="number" name="Rendimento" value="${ficha.Rendimento || ''}" class="border p-2 rounded w-full"></div>
                    <div><label class="text-xs font-bold">Custo Total (Kz)</label><input type="number" step="0.01" id="custo-total" name="CustoPorPorcao" value="${ficha.CustoPorPorcao || ''}" class="border p-2 rounded w-full bg-gray-100" readonly></div>
                </div>
                
                <h4 class="font-bold text-gray-700 mb-2 border-b mt-4">Ingredientes</h4>
                <div id="lista-ingredientes" class="mb-2"></div>
                <button type="button" onclick="addIngrediente()" class="text-sm text-blue-600 hover:underline mb-4">+ Adicionar Ingrediente</button>

                <div class="mb-3"><label class="text-xs font-bold">Modo de Preparo</label><textarea name="ModoPreparo" class="border p-2 rounded w-full h-24">${ficha.ModoPreparo || ''}</textarea></div>
                <button class="w-full bg-orange-600 text-white py-2 rounded font-bold">Salvar Ficha</button>
            </form>
        `);

        // Funções globais para o modal
        window.updateCusto = (select) => {
            calcCustoTotal();
        };

        window.calcCustoTotal = () => {
            let total = 0;
            document.querySelectorAll('.ingrediente-row').forEach(row => {
                const select = row.querySelector('select');
                const qtdInput = row.querySelector('input[type="number"]');
                const custoInput = row.querySelector('.custo-parcial');
                
                if (select.selectedIndex > 0) {
                    const option = select.options[select.selectedIndex];
                    const custoUnit = parseFloat(option.getAttribute('data-custo')) || 0;
                    const qtd = parseFloat(qtdInput.value) || 0;
                    const parcial = custoUnit * qtd;
                    
                    custoInput.value = parcial.toFixed(2);
                    total += parcial;
                }
            });
            document.getElementById('custo-total').value = total.toFixed(2);
        };

        // Carregar ingredientes existentes
        if (ingredientes && ingredientes.length > 0) {
            ingredientes.forEach((ing, i) => {
                addIngrediente();
                const rows = document.querySelectorAll('.ingrediente-row');
                const lastRow = rows[rows.length - 1];
                const select = lastRow.querySelector('select');
                const qtdInput = lastRow.querySelector('input[type="number"]');
                
                select.value = ing.id;
                qtdInput.value = ing.quantidade;
            });
            calcCustoTotal();
        }
    },

    // 🧾 3️⃣ Ordem de Produção
    renderOrdens: (container) => {
        const data = ProducaoModule.state.ordens;
        const planejamento = ProducaoModule.state.planejamento;
        const canEdit = Utils.checkPermission('Producao', 'editar');
        container.innerHTML = `
            <div class="flex justify-between mb-4">
                <h3 class="text-xl font-bold text-gray-800">Ordens de Produção</h3>
            </div>
            <div class="bg-white rounded shadow overflow-x-auto">
                <table class="w-full text-sm text-left">
                    <thead class="bg-gray-100 text-gray-600 uppercase">
                        <tr><th>Nº</th><th>Data</th><th>Turno</th><th>Responsável</th><th>Qtd Prod.</th><th>Status</th><th>Ações</th></tr>
                    </thead>
                    <tbody class="divide-y">
                        ${data.map(o => {
                            // Lógica de Alerta de Divergência
                            const plan = planejamento.find(p => p.ID === o.PlanejamentoID);
                            const qtdPlan = plan ? Number(plan.QtdPlanejada) : 0;
                            const qtdProd = Number(o.QtdProduzida) || 0;
                            let alertHtml = '';
                            
                            if (o.Status === 'Concluída' && qtdPlan > 0) {
                                const diff = Math.abs(qtdProd - qtdPlan);
                                const percent = (diff / qtdPlan) * 100;
                                if (percent > 10) { // Alerta se diferença > 10%
                                    alertHtml = `<span class="ml-2 text-red-500 cursor-help" title="Divergência: ${percent.toFixed(1)}% (Plan: ${qtdPlan})"><i class="fas fa-exclamation-triangle"></i></span>`;
                                }
                            }

                            return `
                            <tr class="hover:bg-gray-50">
                                <td class="p-3 font-bold">#${o.Codigo}</td>
                                <td class="p-3">${Utils.formatDate(o.Data)}</td>
                                <td class="p-3">${o.Turno || '-'}</td>
                                <td class="p-3">${o.Responsavel || '-'}</td>
                                <td class="p-3">${o.QtdProduzida || 0} ${alertHtml}</td>
                                <td class="p-3"><span class="px-2 py-1 rounded text-xs ${o.Status === 'Concluída' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}">${o.Status}</span></td>
                                <td class="p-3 flex gap-2">
                                    ${canEdit ? `<button onclick="ProducaoModule.modalOrdem('${o.ID}')" class="text-blue-600 hover:text-blue-800"><i class="fas fa-edit"></i></button>` : ''}
                                    <button onclick="ProducaoModule.printOrdem('${o.ID}')" class="text-gray-600 hover:text-gray-800" title="Imprimir Ficha"><i class="fas fa-print"></i></button>
                                    ${o.Status !== 'Concluída' && canEdit ? `<button onclick="ProducaoModule.concluirOrdem('${o.ID}')" class="text-green-600 hover:text-green-800 ml-2" title="Concluir e Baixar Estoque"><i class="fas fa-check-circle"></i></button>` : ''}
                                </td>
                            </tr>
                        `}).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },

    printOrdem: (id) => {
        const ordem = ProducaoModule.state.ordens.find(o => o.ID === id);
        if(!ordem) return;
        
        const plan = ProducaoModule.state.planejamento.find(p => p.ID === ordem.PlanejamentoID) || {};
        const ficha = ProducaoModule.state.fichas.find(f => f.ID === plan.ReceitaID) || {};
        const ingredientes = ficha.IngredientesJSON || [];
        const estoque = ProducaoModule.state.estoque || [];
        const inst = ProducaoModule.state.instituicao[0] || {};
        const showLogo = inst.ExibirLogoRelatorios;

        const element = document.getElementById('print-area-producao');
        const header = document.getElementById('pdf-header');
        const content = document.getElementById('pdf-content');

        // Cabeçalho
        header.innerHTML = `
            <div class="flex justify-between items-center">
                <div class="${showLogo && inst.LogotipoURL ? 'flex items-center gap-4' : ''}">
                    ${showLogo && inst.LogotipoURL ? `<img src="${inst.LogotipoURL}" class="h-16 w-auto object-contain">` : ''}
                    <div>
                        <h1 class="text-xl font-bold text-gray-800">${inst.NomeFantasia || 'Ordem de Produção'}</h1>
                        <p class="text-xs text-gray-500">OP #${ordem.Codigo} | Emitido em: ${new Date().toLocaleString()}</p>
                    </div>
                </div>
                <div class="text-right">
                    <div class="text-2xl font-bold text-gray-800">OP #${ordem.Codigo}</div>
                    <div class="text-sm font-bold ${ordem.Status === 'Concluída' ? 'text-green-600' : 'text-yellow-600'}">${ordem.Status.toUpperCase()}</div>
                </div>
            </div>
        `;

        // Conteúdo
        content.innerHTML = `
            <div class="grid grid-cols-2 gap-4 mb-6 border p-4 rounded bg-gray-50">
                <div>
                    <p class="text-xs text-gray-500 uppercase font-bold">Data / Turno</p>
                    <p class="font-bold">${Utils.formatDate(ordem.Data)} - ${ordem.Turno || '-'}</p>
                </div>
                <div>
                    <p class="text-xs text-gray-500 uppercase font-bold">Responsável</p>
                    <p class="font-bold">${ordem.Responsavel || 'Não definido'}</p>
                </div>
                <div>
                    <p class="text-xs text-gray-500 uppercase font-bold">Receita</p>
                    <p class="font-bold text-lg">${ficha.Nome || 'N/A'}</p>
                </div>
                <div>
                    <p class="text-xs text-gray-500 uppercase font-bold">Quantidade Planejada</p>
                    <p class="font-bold text-lg">${plan.QtdPlanejada || 0} <span class="text-sm font-normal text-gray-500">porções/kg</span></p>
                </div>
            </div>

            <h4 class="font-bold text-gray-700 mb-2 border-b pb-1">Checklist de Ingredientes</h4>
            <table class="w-full text-sm mb-6 border">
                <thead class="bg-gray-100">
                    <tr>
                        <th class="p-2 border text-center w-10">OK</th>
                        <th class="p-2 border text-left">Ingrediente</th>
                        <th class="p-2 border text-right">Qtd. Unitária</th>
                        <th class="p-2 border text-right">Qtd. Total Est.</th>
                    </tr>
                </thead>
                <tbody>
                    ${ingredientes.map(ing => {
                        const itemEstoque = estoque.find(e => e.ID === ing.id);
                        const nome = itemEstoque ? `${itemEstoque.Nome} (${itemEstoque.Unidade})` : 'Item desconhecido';
                        const qtdTotal = (Number(ing.quantidade) * (Number(plan.QtdPlanejada) / (Number(ficha.Rendimento)||1))).toFixed(2);
                        return `
                        <tr>
                            <td class="p-2 border text-center"><div class="w-4 h-4 border border-gray-400 rounded mx-auto"></div></td>
                            <td class="p-2 border">${nome}</td>
                            <td class="p-2 border text-right">${ing.quantidade}</td>
                            <td class="p-2 border text-right font-bold">${qtdTotal}</td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>

            <div class="mb-6">
                <h4 class="font-bold text-gray-700 mb-2 border-b pb-1">Modo de Preparo (Resumo)</h4>
                <div class="text-sm text-gray-600 p-2 bg-gray-50 rounded border min-h-[60px]">
                    ${ficha.ModoPreparo || 'Consultar Ficha Técnica completa.'}
                </div>
            </div>

            <div class="grid grid-cols-2 gap-8 mt-12">
                <div class="border-t border-gray-400 pt-2 text-center text-xs">
                    <p class="font-bold">Responsável pela Produção</p>
                    <p>Assinatura</p>
                </div>
                <div class="border-t border-gray-400 pt-2 text-center text-xs">
                    <p class="font-bold">Controle de Qualidade</p>
                    <p>Visto</p>
                </div>
            </div>
        `;

        element.classList.remove('hidden');
        
        const opt = {
            margin: 10,
            filename: `OP-${ordem.Codigo}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        html2pdf().set(opt).from(element).save().then(() => {
            element.classList.add('hidden');
        });
    },

    modalOrdem: (id) => {
        const ordem = ProducaoModule.state.ordens.find(o => o.ID === id);
        if(!ordem) return;

        Utils.openModal('Editar Ordem de Produção', `
            <form onsubmit="ProducaoModule.save(event, 'OrdensProducao')">
                <input type="hidden" name="ID" value="${ordem.ID}">
                <div class="grid grid-cols-2 gap-3 mb-3">
                    <div><label class="text-xs font-bold">Responsável / Cozinheiro</label><input name="Responsavel" value="${ordem.Responsavel || ''}" class="border p-2 rounded w-full"></div>
                    <div><label class="text-xs font-bold">Qtd Produzida</label><input type="number" name="QtdProduzida" value="${ordem.QtdProduzida || ''}" class="border p-2 rounded w-full"></div>
                </div>
                <div class="grid grid-cols-2 gap-3 mb-3">
                    <div><label class="text-xs font-bold">Início</label><input type="time" name="Inicio" value="${ordem.Inicio || ''}" class="border p-2 rounded w-full"></div>
                    <div><label class="text-xs font-bold">Fim</label><input type="time" name="Fim" value="${ordem.Fim || ''}" class="border p-2 rounded w-full"></div>
                </div>
                <div class="mb-3"><label class="text-xs font-bold">Observações</label><textarea name="Observacoes" class="border p-2 rounded w-full">${ordem.Observacoes || ''}</textarea></div>
                <div class="mb-3"><label class="text-xs font-bold">Status</label>
                    <select name="Status" class="border p-2 rounded w-full">
                        <option ${ordem.Status === 'Aberta' ? 'selected' : ''}>Aberta</option>
                        <option ${ordem.Status === 'Em Produção' ? 'selected' : ''}>Em Produção</option>
                        <option ${ordem.Status === 'Concluída' ? 'selected' : ''}>Concluída</option>
                    </select>
                </div>
                <button class="w-full bg-blue-600 text-white py-2 rounded font-bold">Atualizar Ordem</button>
            </form>
        `);
    },

    concluirOrdem: async (id) => {
        if(!confirm('Confirma a conclusão da produção? Isso irá baixar os ingredientes do estoque automaticamente com base na quantidade produzida.')) return;
        try {
            await Utils.api('completeProductionOrder', null, { id });
            Utils.toast('Produção concluída e estoque atualizado!', 'success');
            ProducaoModule.fetchData();
        } catch (err) { Utils.toast('Erro: ' + err.message, 'error'); }
    },

    gerarOrdem: async (planejamentoId) => {
        if(!confirm('Gerar Ordem de Produção para este planejamento?')) return;
        const plan = ProducaoModule.state.planejamento.find(p => p.ID === planejamentoId);
        
        const novaOrdem = {
            PlanejamentoID: plan.ID,
            Data: plan.DataProducao,
            Status: 'Aberta',
            Observacoes: `Gerado a partir do planejamento de ${plan.TipoRefeicao}`
        };

        try {
            await Utils.api('save', 'OrdensProducao', novaOrdem);
            Utils.toast('Ordem gerada com sucesso!', 'success');
            ProducaoModule.fetchData();
            ProducaoModule.setTab('ordens');
        } catch (err) { Utils.toast('Erro: ' + err.message, 'error'); }
    },

    // ♻️ 6️⃣ Controle de Desperdício
    renderDesperdicio: (container) => {
        const data = ProducaoModule.state.desperdicio;
        const canCreate = Utils.checkPermission('Producao', 'criar');
        const canEdit = Utils.checkPermission('Producao', 'editar');
        const canDelete = Utils.checkPermission('Producao', 'excluir');
        container.innerHTML = `
            <div class="flex justify-between mb-4">
                <h3 class="text-xl font-bold text-gray-800">Controle de Desperdício</h3>
                ${canCreate ? `<button onclick="ProducaoModule.modalDesperdicio()" class="bg-red-600 text-white px-4 py-2 rounded shadow hover:bg-red-700">
                    <i class="fas fa-trash-alt"></i> Registrar Perda
                </button>` : ''}
            </div>
            <div class="bg-white rounded shadow overflow-x-auto">
                <table class="w-full text-sm text-left">
                    <thead class="bg-gray-100 text-gray-600 uppercase">
                        <tr><th>Data</th><th>Refeição</th><th>Sobra Limpa (kg)</th><th>Sobra Suja (kg)</th><th>Motivo</th><th>Resp.</th><th>Ações</th></tr>
                    </thead>
                    <tbody class="divide-y">
                        ${data.map(d => `
                            <tr class="hover:bg-gray-50">
                                <td class="p-3">${Utils.formatDate(d.Data)}</td>
                                <td class="p-3">${d.TipoRefeicao}</td>
                                <td class="p-3 text-yellow-600 font-bold">${d.SobraLimpa || 0}</td>
                                <td class="p-3 text-red-600 font-bold">${d.SobraSuja || 0}</td>
                                <td class="p-3">${d.Motivo}</td>
                                <td class="p-3">${d.Responsavel}</td>
                                <td class="p-3 flex gap-2">
                                    ${canEdit ? `<button onclick="ProducaoModule.modalDesperdicio('${d.ID}')" class="text-blue-600 hover:text-blue-800"><i class="fas fa-edit"></i></button>` : ''}
                                    ${canDelete ? `<button onclick="ProducaoModule.deleteDesperdicio('${d.ID}')" class="text-red-500 hover:text-red-700"><i class="fas fa-trash"></i></button>` : ''}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },

    modalDesperdicio: (id = null) => {
        const item = id ? ProducaoModule.state.desperdicio.find(d => d.ID === id) : {};
        
        Utils.openModal(id ? 'Editar Desperdício' : 'Registrar Desperdício', `
            <form onsubmit="ProducaoModule.save(event, 'ControleDesperdicio')">
                <input type="hidden" name="ID" value="${item.ID || ''}">
                <div class="grid grid-cols-2 gap-3 mb-3">
                    <div><label class="text-xs font-bold">Data</label><input type="date" name="Data" value="${item.Data || ''}" class="border p-2 rounded w-full" required></div>
                    <div><label class="text-xs font-bold">Tipo Refeição</label>
                        <select name="TipoRefeicao" class="border p-2 rounded w-full">
                            <option ${item.TipoRefeicao === 'Almoço' ? 'selected' : ''}>Almoço</option>
                            <option ${item.TipoRefeicao === 'Jantar' ? 'selected' : ''}>Jantar</option>
                        </select>
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-3 mb-3">
                    <div><label class="text-xs font-bold">Sobra Limpa (kg)</label><input type="number" step="0.01" name="SobraLimpa" value="${item.SobraLimpa || ''}" class="border p-2 rounded w-full"></div>
                    <div><label class="text-xs font-bold">Sobra Suja (kg)</label><input type="number" step="0.01" name="SobraSuja" value="${item.SobraSuja || ''}" class="border p-2 rounded w-full"></div>
                </div>
                <div class="mb-3"><label class="text-xs font-bold">Motivo</label><input name="Motivo" value="${item.Motivo || ''}" class="border p-2 rounded w-full" placeholder="Ex: Excesso de produção"></div>
                <div class="mb-3"><label class="text-xs font-bold">Responsável</label><input name="Responsavel" value="${item.Responsavel || ''}" class="border p-2 rounded w-full"></div>
                <button class="w-full bg-red-600 text-white py-2 rounded font-bold">Salvar Registro</button>
            </form>
        `);
    },

    // 🧂 4️⃣ Ingredientes (Controle e Baixa Manual)
    renderIngredientes: (container) => {
        const consumo = ProducaoModule.state.consumo || [];
        const ordens = ProducaoModule.state.ordens || [];
        const canCreate = Utils.checkPermission('Producao', 'criar');

        // Ordenar por data decrescente
        consumo.sort((a, b) => new Date(b.DataRetirada) - new Date(a.DataRetirada));

        container.innerHTML = `
            <div class="flex justify-between mb-4">
                <h3 class="text-xl font-bold text-gray-800">Histórico de Consumo de Ingredientes</h3>
                ${canCreate ? `<button onclick="ProducaoModule.modalBaixaIngrediente()" class="bg-green-600 text-white px-4 py-2 rounded shadow hover:bg-green-700">
                    <i class="fas fa-arrow-down"></i> Baixar Estoque Manual
                </button>` : ''}
            </div>

            <div class="bg-white rounded shadow overflow-x-auto">
                <table class="w-full text-sm text-left">
                    <thead class="bg-gray-100 text-gray-600 uppercase">
                        <tr>
                            <th class="p-3">Data</th>
                            <th class="p-3">Ingrediente</th>
                            <th class="p-3">Qtd</th>
                            <th class="p-3">Ordem (OP)</th>
                            <th class="p-3">Responsável</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y">
                        ${consumo.map(c => {
                            const ordem = ordens.find(o => o.ID === c.OrdemID);
                            const opCode = ordem ? `#${ordem.Codigo}` : 'Avulso';
                            return `
                            <tr class="hover:bg-gray-50">
                                <td class="p-3">${Utils.formatDate(c.DataRetirada)}</td>
                                <td class="p-3 font-bold">${c.ProdutoNome}</td>
                                <td class="p-3">${c.Quantidade}</td>
                                <td class="p-3"><span class="bg-gray-100 px-2 py-1 rounded text-xs">${opCode}</span></td>
                                <td class="p-3 text-xs text-gray-500">${c.Responsavel || '-'}</td>
                            </tr>
                        `}).join('')}
                        ${consumo.length === 0 ? '<tr><td colspan="5" class="p-4 text-center text-gray-500">Nenhum registro de consumo.</td></tr>' : ''}
                    </tbody>
                </table>
            </div>
        `;
    },

    modalBaixaIngrediente: () => {
        const estoque = ProducaoModule.state.estoque;
        const ordensAbertas = ProducaoModule.state.ordens.filter(o => o.Status !== 'Concluída');

        Utils.openModal('Baixa Manual de Ingrediente', `
            <form onsubmit="ProducaoModule.saveBaixaIngrediente(event)">
                <div class="mb-3">
                    <label class="text-xs font-bold">Ingrediente (Estoque)</label>
                    <select name="ProdutoID" class="border p-2 rounded w-full" required onchange="this.form.ProdutoNome.value = this.options[this.selectedIndex].text">
                        <option value="">Selecione...</option>
                        ${estoque.map(e => `<option value="${e.ID}">${e.Nome} (Atual: ${e.Quantidade} ${e.Unidade})</option>`).join('')}
                    </select>
                    <input type="hidden" name="ProdutoNome">
                </div>
                <div class="grid grid-cols-2 gap-3 mb-3">
                    <div><label class="text-xs font-bold">Quantidade</label><input type="number" step="0.01" name="Quantidade" class="border p-2 rounded w-full" required></div>
                    <div><label class="text-xs font-bold">Vincular a Ordem (Opcional)</label>
                        <select name="OrdemID" class="border p-2 rounded w-full">
                            <option value="">Sem Ordem (Avulso)</option>
                            ${ordensAbertas.map(o => `<option value="${o.ID}">OP #${o.Codigo} - ${o.Responsavel}</option>`).join('')}
                        </select>
                    </div>
                </div>
                <div class="mb-3"><label class="text-xs font-bold">Responsável</label><input name="Responsavel" class="border p-2 rounded w-full" required></div>
                <button class="w-full bg-green-600 text-white py-2 rounded font-bold">Confirmar Baixa</button>
            </form>
        `);
    },

    saveBaixaIngrediente: async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target).entries());
        
        if (Number(data.Quantidade) <= 0) return Utils.toast('Quantidade inválida.', 'error');

        try {
            await Utils.api('saveIngredientConsumption', null, data);
            Utils.toast('Baixa realizada com sucesso!', 'success');
            Utils.closeModal();
            ProducaoModule.fetchData();
        } catch (err) { Utils.toast('Erro: ' + err.message, 'error'); }
    },

    // 🧮 7️⃣ Custos (Placeholder visual)
    renderCustos: (container) => {
        const ordens = ProducaoModule.state.ordens.filter(o => o.Status === 'Concluída');
        const planejamento = ProducaoModule.state.planejamento;
        const fichas = ProducaoModule.state.fichas;
        const consumo = ProducaoModule.state.consumo;
        const estoque = ProducaoModule.state.estoque;

        // Construir dados do relatório
        const relatorio = ordens.map(ordem => {
            const plan = planejamento.find(p => p.ID === ordem.PlanejamentoID);
            const ficha = plan ? fichas.find(f => f.ID === plan.ReceitaID) : null;
            
            if (!ficha) return null;

            // Custo Planejado (Unitário da Ficha)
            const custoPlanUnit = Number(ficha.CustoPorPorcao || 0);

            // Custo Real (Baseado no consumo de ingredientes vinculado à ordem)
            const ingredientesConsumidos = consumo.filter(c => c.OrdemID === ordem.ID);
            const custoRealTotal = ingredientesConsumidos.reduce((acc, item) => {
                const prod = estoque.find(e => e.ID === item.ProdutoID);
                const custoItem = prod ? Number(prod.CustoUnitario || 0) : 0;
                return acc + (Number(item.Quantidade || 0) * custoItem);
            }, 0);

            const qtdProduzida = Number(ordem.QtdProduzida || 1);
            const custoRealUnit = qtdProduzida > 0 ? custoRealTotal / qtdProduzida : 0;

            const variacao = custoPlanUnit > 0 ? ((custoRealUnit - custoPlanUnit) / custoPlanUnit) * 100 : 0;

            return {
                data: ordem.Data,
                ordem: ordem.Codigo,
                receita: ficha.Nome,
                qtd: qtdProduzida,
                custoPlan: custoPlanUnit,
                custoReal: custoRealUnit,
                variacao: variacao
            };
        }).filter(i => i !== null);

        container.innerHTML = `
            <div class="flex justify-between mb-4">
                <h3 class="text-xl font-bold text-gray-800">Relatório de Custos (Planejado vs Real)</h3>
                <button onclick="window.print()" class="bg-gray-600 text-white px-4 py-2 rounded shadow hover:bg-gray-700">
                    <i class="fas fa-print"></i> Imprimir
                </button>
            </div>
            
            <div class="bg-white p-4 rounded shadow mb-6">
                <h4 class="font-bold text-gray-700 mb-4">Variação de Custo por Receita (%)</h4>
                <div class="h-64"><canvas id="chartCustos"></canvas></div>
            </div>

            <div class="bg-white rounded shadow overflow-x-auto">
                <table class="w-full text-sm text-left">
                    <thead class="bg-gray-100 text-gray-600 uppercase">
                        <tr>
                            <th class="p-3">Data</th>
                            <th class="p-3">Ordem</th>
                            <th class="p-3">Receita</th>
                            <th class="p-3 text-center">Qtd Prod.</th>
                            <th class="p-3 text-right">Custo Plan. (Un)</th>
                            <th class="p-3 text-right">Custo Real (Un)</th>
                            <th class="p-3 text-center">Variação</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y">
                        ${relatorio.map(r => {
                            const varClass = r.variacao > 0 ? 'text-red-600' : (r.variacao < 0 ? 'text-green-600' : 'text-gray-600');
                            const varIcon = r.variacao > 0 ? '▲' : (r.variacao < 0 ? '▼' : '-');
                            return `
                            <tr class="hover:bg-gray-50">
                                <td class="p-3">${Utils.formatDate(r.data)}</td>
                                <td class="p-3 font-bold">#${r.ordem}</td>
                                <td class="p-3">${r.receita}</td>
                                <td class="p-3 text-center">${r.qtd}</td>
                                <td class="p-3 text-right">${Utils.formatCurrency(r.custoPlan)}</td>
                                <td class="p-3 text-right font-bold">${Utils.formatCurrency(r.custoReal)}</td>
                                <td class="p-3 text-center font-bold ${varClass}">
                                    ${varIcon} ${Math.abs(r.variacao).toFixed(1)}%
                                </td>
                            </tr>
                        `}).join('')}
                        ${relatorio.length === 0 ? '<tr><td colspan="7" class="p-4 text-center text-gray-500">Nenhuma ordem concluída com dados de custo.</td></tr>' : ''}
                    </tbody>
                </table>
            </div>
        `;

        // Renderizar Gráfico
        if (relatorio.length > 0) {
            if (ProducaoModule.state.charts.custos) ProducaoModule.state.charts.custos.destroy();

            const labels = relatorio.map(r => `#${r.ordem} ${r.receita}`);
            const data = relatorio.map(r => r.variacao);
            const colors = relatorio.map(r => r.variacao > 0 ? '#EF4444' : '#10B981'); // Vermelho se aumentou custo, Verde se economizou

            ProducaoModule.state.charts.custos = new Chart(document.getElementById('chartCustos'), {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Variação (%)',
                        data: data,
                        backgroundColor: colors,
                        borderRadius: 4
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
            });
        }
    },

    // 🧹 8️⃣ Checklist de Limpeza
    renderLimpeza: async (container) => {
        const date = ProducaoModule.state.checklistDate;
        
        // Itens padrão do checklist
        const standardItems = [
            { area: 'Cozinha', item: 'Higienização das Bancadas' },
            { area: 'Cozinha', item: 'Limpeza do Chão e Ralos' },
            { area: 'Cozinha', item: 'Limpeza da Coifa/Exaustor' },
            { area: 'Cozinha', item: 'Descarte de Lixo Orgânico' },
            { area: 'Cozinha', item: 'Limpeza de Fogões e Fornos' },
            { area: 'Copa', item: 'Organização de Louças' },
            { area: 'Copa', item: 'Limpeza de Pias e Torneiras' },
            { area: 'Estoque', item: 'Verificação de Validade (Visual)' },
            { area: 'Estoque', item: 'Organização de Prateleiras' },
            { area: 'Geral', item: 'Limpeza de Maçanetas e Interruptores' }
        ];

        let savedItems = [];
        try {
            savedItems = await Utils.api('getChecklist', null, { date });
        } catch (e) { console.error(e); }

        // Mesclar itens padrão com salvos
        const checklist = standardItems.map(std => {
            const saved = savedItems.find(s => s.Item === std.item && s.Area === std.area);
            return saved || { ...std, Status: 'Pendente', Data: date, Observacao: '' };
        });

        container.innerHTML = `
            <div class="flex justify-between items-center mb-6">
                <h3 class="text-xl font-bold text-gray-800">Checklist de Limpeza e Higiene</h3>
                <div class="flex gap-2">
                    <input type="date" value="${date}" class="border p-2 rounded" onchange="ProducaoModule.state.checklistDate = this.value; ProducaoModule.renderLimpeza(document.getElementById('producao-content'))">
                    <button onclick="ProducaoModule.saveChecklist()" class="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700"><i class="fas fa-save"></i> Salvar</button>
                </div>
            </div>

            <div class="bg-white rounded shadow overflow-hidden">
                <table class="w-full text-sm text-left">
                    <thead class="bg-gray-100 text-gray-600 uppercase">
                        <tr>
                            <th class="p-3">Área</th>
                            <th class="p-3">Item de Verificação</th>
                            <th class="p-3 text-center">Status</th>
                            <th class="p-3">Observação</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y" id="checklist-body">
                        ${checklist.map((item, idx) => `
                            <tr class="hover:bg-gray-50 checklist-row" data-area="${item.area}" data-item="${item.item}">
                                <td class="p-3 font-bold text-gray-500">${item.area}</td>
                                <td class="p-3">${item.item}</td>
                                <td class="p-3 text-center">
                                    <select class="border p-1 rounded text-xs status-select ${item.Status === 'OK' ? 'bg-green-100 text-green-800' : (item.Status === 'Atenção' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100')}" onchange="this.className = 'border p-1 rounded text-xs status-select ' + (this.value === 'OK' ? 'bg-green-100 text-green-800' : (this.value === 'Atenção' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100'))">
                                        <option ${item.Status === 'Pendente' ? 'selected' : ''}>Pendente</option>
                                        <option ${item.Status === 'OK' ? 'selected' : ''}>OK</option>
                                        <option ${item.Status === 'Atenção' ? 'selected' : ''}>Atenção</option>
                                        <option ${item.Status === 'Não Realizado' ? 'selected' : ''}>Não Realizado</option>
                                    </select>
                                </td>
                                <td class="p-3"><input type="text" class="border p-1 rounded w-full text-xs obs-input" value="${item.Observacao || ''}" placeholder="Obs..."></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },

    saveChecklist: async () => {
        const rows = document.querySelectorAll('.checklist-row');
        const items = Array.from(rows).map(row => ({
            Data: ProducaoModule.state.checklistDate,
            Area: row.dataset.area,
            Item: row.dataset.item,
            Status: row.querySelector('.status-select').value,
            Observacao: row.querySelector('.obs-input').value,
            Responsavel: Utils.getUser().Nome
        }));

        try {
            await Utils.api('saveChecklist', null, { items });
            Utils.toast('Checklist salvo com sucesso!', 'success');
        } catch (e) { Utils.toast('Erro ao salvar.', 'error'); }
    },

    // 📊 5️⃣ Relatórios (Placeholder visual)
    renderRelatorios: (container) => {
        container.innerHTML = `
            <div class="text-center py-10 bg-white rounded shadow">
                <i class="fas fa-chart-bar text-4xl text-purple-500 mb-4"></i>
                <h3 class="text-xl font-bold text-gray-800">Relatórios de Eficiência</h3>
                <p class="text-gray-500">Indicadores de desperdício e rendimento.</p>
            </div>
        `;
    },

    save: async (e, table) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target).entries());
        
        // Validações básicas
        if (table === 'FichasTecnicas' && !data.Nome) return Utils.toast('Nome é obrigatório.', 'error');
        if (table === 'PlanejamentoProducao' && !data.DataProducao) return Utils.toast('Data é obrigatória.', 'error');

        // Processar Ingredientes (Fichas Técnicas)
        if (table === 'FichasTecnicas') {
            const ingredientes = [];
            const formData = new FormData(e.target);
            for (const [key, value] of formData.entries()) {
                if (key.startsWith('ingrediente_id_') && value) {
                    const index = key.split('_')[2];
                    const qtd = formData.get(`ingrediente_qtd_${index}`);
                    if (qtd) {
                        ingredientes.push({
                            id: value,
                            quantidade: Number(qtd)
                        });
                    }
                }
                // Remove campos temporários do objeto data para não quebrar o salvamento no banco
                if (key.startsWith('ingrediente_')) {
                    delete data[key];
                }
            }
            data.IngredientesJSON = ingredientes;
            if (ingredientes.length === 0) return Utils.toast('⚠️ É obrigatório adicionar pelo menos um ingrediente à ficha técnica.', 'warning');
        }

        try {
            await Utils.api('save', table, data);
            Utils.toast('Salvo com sucesso!', 'success'); 
            Utils.closeModal(); 
            ProducaoModule.fetchData();
        } catch (err) { Utils.toast('Erro: ' + err.message, 'error'); }
    },

    deleteFicha: async (id) => {
        if(confirm('Tem certeza que deseja excluir?')) { 
            try {
                await Utils.api('delete', 'FichasTecnicas', null, id); 
                ProducaoModule.fetchData(); 
            } catch (e) { Utils.toast('Erro ao apagar', 'error'); }
        }
    },

    deleteDesperdicio: async (id) => {
        if(confirm('Tem certeza que deseja excluir este registro de desperdício?')) { 
            try {
                await Utils.api('delete', 'ControleDesperdicio', null, id); 
                ProducaoModule.fetchData(); 
            } catch (e) { Utils.toast('Erro ao apagar', 'error'); }
        }
    }
};

document.addEventListener('DOMContentLoaded', ProducaoModule.init);