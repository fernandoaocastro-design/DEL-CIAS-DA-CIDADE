// =============================================================================
// INVENTARIOMODULE — Gestão de Património Empresarial
// Versão Atualizada — FernaGest 2026
// =============================================================================

const InventarioModule = {

    // -------------------------------------------------------------------------
    // ESTADO
    // -------------------------------------------------------------------------
    state: {
        bens: [],
        filteredBens: null,
        manutencoes: [],
        transferencias: [],
        instituicao: [],
        filterTerm: '',
        filterDept: '',
        filterCategoria: '',
        filterEstado: '',
        charts: {},
        pagination: { page: 1, limit: 15, total: 0 },
        activeTab: 'lista'   // 'lista' | 'manutencoes' | 'transferencias' | 'relatorio'
    },

    categorias: [
        'TI / Informática', 'Mobiliário', 'Electrodomésticos', 'Veículos',
        'Cozinha / Produção', 'Ferramentas', 'Equipamento de Escritório',
        'Equipamento de Segurança', 'Instalações', 'Outros'
    ],

    estadosConservacao: ['Novo', 'Bom', 'Regular', 'Ruim', 'Em Manutenção', 'Baixado'],

    departamentos: [
        'Administração', 'Cozinha', 'Salão', 'RH', 'Financeiro',
        'TI', 'Segurança', 'Limpeza', 'Armazém', 'Direcção'
    ],

    // -------------------------------------------------------------------------
    // INICIALIZAÇÃO
    // -------------------------------------------------------------------------
    init: () => {
        InventarioModule.fetchData();
        InventarioModule.updateHeaderPhoto();
    },

    updateHeaderPhoto: () => {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const img = document.getElementById('user-photo');
        if (user && user.FotoURL && img) img.src = user.FotoURL;
    },

    fetchData: async () => {
        const container = document.getElementById('inventario-content');
        if (container) container.innerHTML = `
            <div class="flex flex-col items-center justify-center h-64 text-purple-600">
                <i class="fas fa-spinner fa-spin text-5xl mb-4"></i>
                <p class="text-xl font-medium animate-pulse">Carregando Património...</p>
            </div>`;
        try {
            const [bens, manut, transf, inst] = await Promise.all([
                Utils.api('getAll', 'Inventario'),
                Utils.api('getAll', 'InventarioManutencoes').catch(() => []),
                Utils.api('getAll', 'InventarioTransferencias').catch(() => []),
                Utils.api('getAll', 'InstituicaoConfig')
            ]);

            // Normalizar IDs — Supabase pode devolver 'id' minúsculo
            const normalizar = (arr) => (arr || []).map(r => ({
                ...r,
                ID: r.ID || r.id || ''
            }));

            InventarioModule.state.bens = normalizar(bens);
            InventarioModule.state.manutencoes = normalizar(manut);
            InventarioModule.state.transferencias = normalizar(transf);
            InventarioModule.state.instituicao = inst || [];
            InventarioModule.render();
        } catch (e) {
            console.error('Erro no Inventário:', e);
            if (container) container.innerHTML = `
                <div class="flex flex-col items-center justify-center h-64 text-red-600">
                    <i class="fas fa-exclamation-circle text-5xl mb-4"></i>
                    <p class="text-xl font-bold">Erro ao carregar dados</p>
                    <button onclick="InventarioModule.fetchData()" class="mt-4 bg-red-600 text-white px-4 py-2 rounded">Tentar novamente</button>
                </div>`;
        }
    },

    // -------------------------------------------------------------------------
    // RENDER PRINCIPAL
    // -------------------------------------------------------------------------
    render: () => {
        const container = document.getElementById('inventario-content');
        if (!container) return;

        let data = InventarioModule._applyFilters(InventarioModule.state.bens);
        InventarioModule.state.filteredBens = data;

        // KPIs
        const totalValor = data.reduce((acc, b) => acc + Number(b.ValorAquisicao || 0), 0);
        const emManutencao = data.filter(b => b.EstadoConservacao === 'Em Manutenção').length;
        const deptos = new Set(data.map(b => b.Departamento).filter(Boolean)).size;
        const valorDepreciado = data.reduce((acc, b) => acc + InventarioModule._calcDepreciacao(b), 0);

        // Filtros únicos
        const deptsUnique = [...new Set(InventarioModule.state.bens.map(b => b.Departamento).filter(Boolean))].sort();
        const catsUnique = [...new Set(InventarioModule.state.bens.map(b => b.Categoria).filter(Boolean))].sort();

        const canEdit = Utils.checkPermission('Inventario', 'editar');
        const canCreate = Utils.checkPermission('Inventario', 'criar');
        const canDelete = Utils.checkPermission('Inventario', 'excluir');

        // Paginação
        InventarioModule.state.pagination.total = data.length;
        const { page, limit } = InventarioModule.state.pagination;
        const totalPages = Math.ceil(data.length / limit) || 1;
        const paginatedData = data.slice((page - 1) * limit, page * limit);

        // Gráfico dados
        const statusMap = {};
        data.forEach(b => {
            const s = b.EstadoConservacao || 'Não Definido';
            statusMap[s] = (statusMap[s] || 0) + 1;
        });

        const activeTab = InventarioModule.state.activeTab;

        container.innerHTML = `
            <!-- TABS -->
            <div class="border-b border-gray-200 mb-6">
                <nav class="-mb-px flex space-x-6 overflow-x-auto">
                    ${[
                        { id: 'lista',          icon: 'fa-boxes',          label: 'Bens Patrimoniais' },
                        { id: 'manutencoes',    icon: 'fa-tools',          label: 'Manutenções' },
                        { id: 'transferencias', icon: 'fa-exchange-alt',   label: 'Transferências' },
                        { id: 'relatorio',      icon: 'fa-chart-pie',      label: 'Relatório' },
                    ].map(t => `
                        <button onclick="InventarioModule._setTab('${t.id}')"
                            class="whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors
                            ${activeTab === t.id ? 'border-purple-500 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}">
                            <i class="fas ${t.icon} mr-1"></i> ${t.label}
                        </button>`).join('')}
                </nav>
            </div>

            <!-- KPIs -->
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div class="bg-white p-4 rounded-xl shadow-sm border-l-4 border-purple-500">
                    <div class="text-gray-500 text-xs font-bold uppercase">Total de Bens</div>
                    <div class="text-2xl font-bold text-gray-800">${data.length}</div>
                </div>
                <div class="bg-white p-4 rounded-xl shadow-sm border-l-4 border-green-500">
                    <div class="text-gray-500 text-xs font-bold uppercase">Valor Patrimonial</div>
                    <div class="text-xl font-bold text-green-600">${Utils.formatCurrency(totalValor)}</div>
                </div>
                <div class="bg-white p-4 rounded-xl shadow-sm border-l-4 border-yellow-500">
                    <div class="text-gray-500 text-xs font-bold uppercase">Em Manutenção</div>
                    <div class="text-2xl font-bold text-yellow-600">${emManutencao}</div>
                </div>
                <div class="bg-white p-4 rounded-xl shadow-sm border-l-4 border-red-400">
                    <div class="text-gray-500 text-xs font-bold uppercase">Depreciação Acum.</div>
                    <div class="text-xl font-bold text-red-500">- ${Utils.formatCurrency(valorDepreciado)}</div>
                </div>
            </div>

            <!-- CONTEÚDO POR TAB -->
            <div id="tab-body">
                ${activeTab === 'lista'          ? InventarioModule._renderLista(paginatedData, data, page, limit, totalPages, deptsUnique, catsUnique, statusMap, canEdit, canCreate, canDelete) : ''}
                ${activeTab === 'manutencoes'    ? InventarioModule._renderManutencoes(canCreate) : ''}
                ${activeTab === 'transferencias' ? InventarioModule._renderTransferencias(canCreate) : ''}
                ${activeTab === 'relatorio'      ? InventarioModule._renderRelatorio(data) : ''}
            </div>
        `;

        // Gráficos
        if (activeTab === 'lista') {
            if (InventarioModule.state.charts.estado) InventarioModule.state.charts.estado.destroy();
            const chartEl = document.getElementById('chartEstadoConservacao');
            if (typeof Chart !== 'undefined' && chartEl) {
                InventarioModule.state.charts.estado = new Chart(chartEl, {
                    type: 'doughnut',
                    data: {
                        labels: Object.keys(statusMap),
                        datasets: [{ data: Object.values(statusMap), backgroundColor: ['#10B981','#3B82F6','#F59E0B','#EF4444','#8B5CF6','#6B7280'] }]
                    },
                    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { boxWidth: 10, font: { size: 10 } } } } }
                });
            }
        }

        if (activeTab === 'relatorio') InventarioModule._initRelatorioCharts(data);
    },

    // -------------------------------------------------------------------------
    // RENDER: LISTA DE BENS
    // -------------------------------------------------------------------------
    _renderLista: (paginatedData, data, page, limit, totalPages, deptsUnique, catsUnique, statusMap, canEdit, canCreate, canDelete) => `
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <!-- Gráfico -->
            <div class="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <h4 class="font-bold text-gray-700 mb-3 text-sm">Estado de Conservação</h4>
                <div class="h-48"><canvas id="chartEstadoConservacao"></canvas></div>
            </div>
            <!-- Filtros e Toolbar -->
            <div class="lg:col-span-2 bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center gap-3">
                <div class="flex flex-wrap justify-between items-center gap-2">
                    <h3 class="text-lg font-bold text-gray-800"><i class="fas fa-building text-purple-500 mr-2"></i>Gestão de Património</h3>
                    <div class="flex flex-wrap gap-2">
                        ${canCreate ? `<button onclick="InventarioModule.modalBem()" class="bg-purple-600 text-white px-4 py-2 rounded-lg shadow hover:bg-purple-700 text-sm"><i class="fas fa-plus mr-1"></i> Novo Bem</button>` : ''}
                        <button onclick="InventarioModule.exportPDF()" class="bg-red-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-red-700"><i class="fas fa-file-pdf mr-1"></i> PDF</button>
                        <button onclick="InventarioModule.exportCSV()" class="bg-green-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-green-700"><i class="fas fa-file-csv mr-1"></i> Excel</button>
                    </div>
                </div>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <input type="text" placeholder="🔍 Buscar bem..." class="border p-2 rounded-lg text-sm col-span-2"
                        value="${InventarioModule.state.filterTerm}" oninput="InventarioModule.updateFilter(this.value)">
                    <select class="border p-2 rounded-lg text-sm" onchange="InventarioModule.updateDeptFilter(this.value)">
                        <option value="">🏢 Todos Deptos</option>
                        ${deptsUnique.map(d => `<option value="${d}" ${InventarioModule.state.filterDept === d ? 'selected' : ''}>${d}</option>`).join('')}
                    </select>
                    <select class="border p-2 rounded-lg text-sm" onchange="InventarioModule.updateCatFilter(this.value)">
                        <option value="">📦 Todas Categorias</option>
                        ${catsUnique.map(c => `<option value="${c}" ${InventarioModule.state.filterCategoria === c ? 'selected' : ''}>${c}</option>`).join('')}
                    </select>
                </div>
            </div>
        </div>

        <!-- Tabela -->
        <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
            <table class="w-full text-sm text-left">
                <thead class="bg-gray-50 border-b border-gray-200">
                    <tr>
                        <th class="px-4 py-3 text-xs font-bold text-gray-500 uppercase">Código</th>
                        <th class="px-4 py-3 text-xs font-bold text-gray-500 uppercase">Bem / Descrição</th>
                        <th class="px-4 py-3 text-xs font-bold text-gray-500 uppercase">Categoria</th>
                        <th class="px-4 py-3 text-xs font-bold text-gray-500 uppercase">Local</th>
                        <th class="px-4 py-3 text-xs font-bold text-gray-500 uppercase text-center">Estado</th>
                        <th class="px-4 py-3 text-xs font-bold text-gray-500 uppercase text-right">Valor Actual</th>
                        <th class="px-4 py-3 text-xs font-bold text-gray-500 uppercase text-center">Ações</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                    ${paginatedData.length === 0 ? `
                        <tr><td colspan="7" class="text-center p-10 text-gray-400">
                            <i class="fas fa-box-open text-4xl mb-3 block"></i>
                            Nenhum bem encontrado.
                        </td></tr>` :
                    paginatedData.map(b => {
                        const colorMap = { 'Novo': 'bg-blue-100 text-blue-800', 'Bom': 'bg-green-100 text-green-800', 'Regular': 'bg-yellow-100 text-yellow-800', 'Ruim': 'bg-red-100 text-red-800', 'Em Manutenção': 'bg-orange-100 text-orange-800', 'Baixado': 'bg-gray-100 text-gray-500' };
                        const chip = colorMap[b.EstadoConservacao] || 'bg-gray-100 text-gray-600';
                        const deprec = InventarioModule._calcDepreciacao(b);
                        const valorActual = Math.max(0, Number(b.ValorAquisicao || 0) - deprec);
                        return `
                        <tr class="group hover:bg-purple-50 transition-colors">
                            <td class="px-4 py-3 font-mono text-xs font-bold text-purple-700">${b.Codigo || '-'}</td>
                            <td class="px-4 py-3">
                                <div class="flex items-center gap-3">
                                    ${b.FotoURL
                                        ? `<img src="${b.FotoURL}" class="h-10 w-10 rounded-lg object-cover border bg-white flex-shrink-0">`
                                        : `<div class="h-10 w-10 rounded-lg bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-300 flex-shrink-0"><i class="fas fa-box"></i></div>`}
                                    <div>
                                        <div class="font-semibold text-gray-800">${b.Nome} <span class="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded ml-1">×${b.Quantidade || 1}</span></div>
                                        <div class="text-xs text-gray-400">${b.Responsavel || 'Sem responsável'} ${b.NumeroSerie ? '· S/N: '+b.NumeroSerie : ''}</div>
                                    </div>
                                </div>
                            </td>
                            <td class="px-4 py-3 text-sm text-gray-600">${b.Categoria || '-'}</td>
                            <td class="px-4 py-3 text-sm text-gray-600">${b.Departamento || '-'}</td>
                            <td class="px-4 py-3 text-center"><span class="px-2 py-1 rounded-full text-xs font-bold ${chip}">${b.EstadoConservacao || '-'}</span></td>
                            <td class="px-4 py-3 text-right">
                                <div class="font-bold text-gray-800">${Utils.formatCurrency(valorActual)}</div>
                                ${deprec > 0 ? `<div class="text-xs text-red-400">-${Utils.formatCurrency(deprec)} deprec.</div>` : ''}
                            </td>
                            <td class="px-4 py-3 text-center">
                                <div class="flex justify-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                    <button onclick="InventarioModule.detalhes('${b.ID}')" class="p-1.5 rounded hover:bg-blue-100 text-blue-600" title="Detalhes"><i class="fas fa-eye"></i></button>
                                    <button onclick="InventarioModule.modalManutencao('${b.ID}')" class="p-1.5 rounded hover:bg-yellow-100 text-yellow-600" title="Manutenção"><i class="fas fa-tools"></i></button>
                                    <button onclick="InventarioModule.modalTransferir('${b.ID}')" class="p-1.5 rounded hover:bg-green-100 text-green-600" title="Transferir"><i class="fas fa-exchange-alt"></i></button>
                                    ${canEdit ? `<button onclick="InventarioModule.modalBem('${b.ID}')" class="p-1.5 rounded hover:bg-gray-100 text-gray-600" title="Editar"><i class="fas fa-pen"></i></button>` : ''}
                                    ${canDelete ? `<button onclick="InventarioModule.modalBaixar('${b.ID}')" class="p-1.5 rounded hover:bg-red-100 text-red-500" title="Baixar Bem"><i class="fas fa-times-circle"></i></button>` : ''}
                                    ${canDelete ? `<button onclick="InventarioModule.confirmarEliminar('${b.ID}', '${b.Nome.replace(/'/g,"\\\'")}')" class="p-1.5 rounded hover:bg-red-200 text-red-700" title="Eliminar Definitivamente"><i class="fas fa-trash"></i></button>` : ''}
                                </div>
                            </td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
        </div>

        <!-- Paginação -->
        <div class="flex justify-between items-center mt-4 text-sm text-gray-600 bg-white p-3 rounded-xl border border-gray-100">
            <span>Mostrando <b>${Math.min((page-1)*limit+1, data.length)}</b> a <b>${Math.min(page*limit, data.length)}</b> de <b>${data.length}</b> itens</span>
            <div class="flex gap-2 items-center">
                <button onclick="InventarioModule.changePage(-1)" class="px-3 py-1 border rounded bg-white hover:bg-gray-50 disabled:opacity-40" ${page===1?'disabled':''}>‹ Anterior</button>
                <span class="px-2 font-bold text-purple-700">Página ${page} de ${totalPages}</span>
                <button onclick="InventarioModule.changePage(1)" class="px-3 py-1 border rounded bg-white hover:bg-gray-50 disabled:opacity-40" ${page>=totalPages?'disabled':''}>Próxima ›</button>
            </div>
        </div>
    `,

    // -------------------------------------------------------------------------
    // RENDER: MANUTENÇÕES
    // -------------------------------------------------------------------------
    _renderManutencoes: (canCreate) => {
        const data = InventarioModule.state.manutencoes || [];
        const bens = InventarioModule.state.bens || [];
        return `
        <div class="flex justify-between items-center mb-4">
            <h3 class="text-lg font-bold text-gray-800"><i class="fas fa-tools text-yellow-500 mr-2"></i>Registo de Manutenções</h3>
            <div class="flex gap-2">
                <button onclick="InventarioModule.exportManutencoesPDF()" class="bg-red-600 text-white px-3 py-2 rounded-lg text-sm"><i class="fas fa-file-pdf mr-1"></i> PDF</button>
                ${canCreate ? `<button onclick="InventarioModule.modalManutencao()" class="bg-yellow-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-yellow-600"><i class="fas fa-plus mr-1"></i> Nova Manutenção</button>` : ''}
            </div>
        </div>
        <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
            <table class="w-full text-sm">
                <thead class="bg-gray-50 border-b">
                    <tr>
                        <th class="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Bem</th>
                        <th class="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Tipo</th>
                        <th class="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Data</th>
                        <th class="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Técnico</th>
                        <th class="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase">Custo</th>
                        <th class="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase">Estado</th>
                        <th class="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Observações</th>
                        <th class="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase">Ações</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                    ${data.length === 0 ? `<tr><td colspan="8" class="text-center p-8 text-gray-400"><i class="fas fa-tools text-3xl mb-2 block"></i>Nenhuma manutenção registada.</td></tr>` :
                    data.map(m => {
                        const bem = bens.find(b => String(b.ID||b.id) === String(m.BemID)) || {};
                        const chips = { 'Preventiva': 'bg-blue-100 text-blue-700', 'Correctiva': 'bg-red-100 text-red-700', 'Concluída': 'bg-green-100 text-green-700', 'Pendente': 'bg-yellow-100 text-yellow-700' };
                        const chip = chips[m.Estado] || 'bg-gray-100 text-gray-600';
                        return `
                        <tr class="hover:bg-gray-50">
                            <td class="px-4 py-3 font-semibold">${bem.Nome || m.BemNome || '-'}<div class="text-xs text-purple-600 font-mono">${bem.Codigo || ''}</div></td>
                            <td class="px-4 py-3">${m.Tipo || '-'}</td>
                            <td class="px-4 py-3">${Utils.formatDate(m.Data)}</td>
                            <td class="px-4 py-3">${m.Tecnico || '-'}</td>
                            <td class="px-4 py-3 text-right font-bold">${Utils.formatCurrency(m.Custo || 0)}</td>
                            <td class="px-4 py-3 text-center"><span class="px-2 py-1 rounded-full text-xs font-bold ${chip}">${m.Estado || '-'}</span></td>
                            <td class="px-4 py-3 text-xs text-gray-500">${m.Observacoes || '-'}</td>
                            <td class="px-4 py-3 text-center">
                                <button onclick="InventarioModule.confirmarEliminarManutencao('${m.ID}', '${(m.BemNome || bem.Nome || 'esta manutenção').replace(/'/g,"\\'")}')" class="p-1.5 rounded hover:bg-red-100 text-red-600" title="Eliminar Manutenção"><i class="fas fa-trash"></i></button>
                            </td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
        </div>`;
    },

    // -------------------------------------------------------------------------
    // RENDER: TRANSFERÊNCIAS
    // -------------------------------------------------------------------------
    _renderTransferencias: (canCreate) => {
        const data = InventarioModule.state.transferencias || [];
        const bens = InventarioModule.state.bens || [];
        return `
        <div class="flex justify-between items-center mb-4">
            <h3 class="text-lg font-bold text-gray-800"><i class="fas fa-exchange-alt text-green-500 mr-2"></i>Transferências entre Departamentos</h3>
            ${canCreate ? `<button onclick="InventarioModule.modalTransferir()" class="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700"><i class="fas fa-plus mr-1"></i> Nova Transferência</button>` : ''}
        </div>
        <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
            <table class="w-full text-sm">
                <thead class="bg-gray-50 border-b">
                    <tr>
                        <th class="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Bem</th>
                        <th class="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">De</th>
                        <th class="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Para</th>
                        <th class="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Data</th>
                        <th class="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Autorizado por</th>
                        <th class="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Motivo</th>
                        <th class="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase">Ações</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                    ${data.length === 0 ? `<tr><td colspan="7" class="text-center p-8 text-gray-400"><i class="fas fa-exchange-alt text-3xl mb-2 block"></i>Nenhuma transferência registada.</td></tr>` :
                    data.map(t => {
                        const bem = bens.find(b => String(b.ID||b.id) === String(t.BemID)) || {};
                        return `
                        <tr class="hover:bg-gray-50">
                            <td class="px-4 py-3 font-semibold">${bem.Nome || t.BemNome || '-'}<div class="text-xs text-purple-600 font-mono">${bem.Codigo || ''}</div></td>
                            <td class="px-4 py-3 text-red-600"><i class="fas fa-arrow-right mr-1"></i>${t.DepartamentoOrigem || '-'}</td>
                            <td class="px-4 py-3 text-green-600 font-bold">${t.DepartamentoDestino || '-'}</td>
                            <td class="px-4 py-3">${Utils.formatDate(t.Data)}</td>
                            <td class="px-4 py-3">${t.AutorizadoPor || '-'}</td>
                            <td class="px-4 py-3 text-xs text-gray-500">${t.Motivo || '-'}</td>
                            <td class="px-4 py-3 text-center">
                                <button onclick="InventarioModule.confirmarEliminarTransferencia('${t.ID}', '${(t.BemNome || bem.Nome || 'esta transferência').replace(/'/g,"\\'")}')" class="p-1.5 rounded hover:bg-red-100 text-red-600" title="Eliminar Transferência"><i class="fas fa-trash"></i></button>
                            </td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
        </div>`;
    },

    // -------------------------------------------------------------------------
    // RENDER: RELATÓRIO
    // -------------------------------------------------------------------------
    _renderRelatorio: (data) => {
        const totalValor = data.reduce((acc, b) => acc + Number(b.ValorAquisicao || 0), 0);
        const totalDeprec = data.reduce((acc, b) => acc + InventarioModule._calcDepreciacao(b), 0);
        const valorActual = totalValor - totalDeprec;

        // Por categoria
        const catMap = {};
        data.forEach(b => {
            const c = b.Categoria || 'Outros';
            if (!catMap[c]) catMap[c] = { qtd: 0, valor: 0 };
            catMap[c].qtd += Number(b.Quantidade || 1);
            catMap[c].valor += Number(b.ValorAquisicao || 0);
        });

        // Por departamento
        const deptMap = {};
        data.forEach(b => {
            const d = b.Departamento || 'Sem Departamento';
            if (!deptMap[d]) deptMap[d] = { qtd: 0, valor: 0 };
            deptMap[d].qtd += Number(b.Quantidade || 1);
            deptMap[d].valor += Number(b.ValorAquisicao || 0);
        });

        return `
        <div class="flex justify-end gap-2 mb-4">
            <button onclick="InventarioModule.exportPDF()" class="bg-red-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-700"><i class="fas fa-file-pdf mr-1"></i> Exportar PDF</button>
        </div>

        <!-- Resumo financeiro -->
        <div class="grid grid-cols-3 gap-4 mb-6">
            <div class="bg-white p-4 rounded-xl border border-gray-100 text-center">
                <div class="text-xs text-gray-500 font-bold uppercase mb-1">Valor de Aquisição</div>
                <div class="text-xl font-bold text-gray-800">${Utils.formatCurrency(totalValor)}</div>
            </div>
            <div class="bg-white p-4 rounded-xl border border-red-100 text-center">
                <div class="text-xs text-red-400 font-bold uppercase mb-1">Depreciação Acumulada</div>
                <div class="text-xl font-bold text-red-500">- ${Utils.formatCurrency(totalDeprec)}</div>
            </div>
            <div class="bg-white p-4 rounded-xl border border-green-100 text-center">
                <div class="text-xs text-green-600 font-bold uppercase mb-1">Valor Actual Estimado</div>
                <div class="text-xl font-bold text-green-700">${Utils.formatCurrency(valorActual)}</div>
            </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div class="bg-white p-4 rounded-xl border border-gray-100">
                <h4 class="font-bold text-gray-700 mb-3 text-sm border-b pb-2">Por Categoria</h4>
                <div class="h-56"><canvas id="chartCategoria"></canvas></div>
            </div>
            <div class="bg-white p-4 rounded-xl border border-gray-100">
                <h4 class="font-bold text-gray-700 mb-3 text-sm border-b pb-2">Por Departamento</h4>
                <div class="h-56"><canvas id="chartDepartamento"></canvas></div>
            </div>
        </div>

        <!-- Tabela por categoria -->
        <div class="bg-white rounded-xl border border-gray-100 overflow-x-auto">
            <table class="w-full text-sm">
                <thead class="bg-gray-50 border-b">
                    <tr>
                        <th class="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Categoria</th>
                        <th class="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase">Qtd Bens</th>
                        <th class="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase">Valor Total</th>
                        <th class="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase">% do Total</th>
                    </tr>
                </thead>
                <tbody class="divide-y">
                    ${Object.entries(catMap).sort((a,b) => b[1].valor - a[1].valor).map(([cat, info]) => `
                    <tr class="hover:bg-gray-50">
                        <td class="px-4 py-2 font-medium">${cat}</td>
                        <td class="px-4 py-2 text-center">${info.qtd}</td>
                        <td class="px-4 py-2 text-right">${Utils.formatCurrency(info.valor)}</td>
                        <td class="px-4 py-2 text-right text-gray-400">${totalValor > 0 ? ((info.valor / totalValor) * 100).toFixed(1) + '%' : '-'}</td>
                    </tr>`).join('')}
                    <tr class="bg-gray-50 font-bold">
                        <td class="px-4 py-2">TOTAL</td>
                        <td class="px-4 py-2 text-center">${data.length}</td>
                        <td class="px-4 py-2 text-right">${Utils.formatCurrency(totalValor)}</td>
                        <td class="px-4 py-2 text-right">100%</td>
                    </tr>
                </tbody>
            </table>
        </div>`;
    },

    _initRelatorioCharts: (data) => {
        const catMap = {}, deptMap = {};
        data.forEach(b => {
            const c = b.Categoria || 'Outros';
            const d = b.Departamento || 'Sem Departamento';
            catMap[c] = (catMap[c] || 0) + 1;
            deptMap[d] = (deptMap[d] || 0) + Number(b.ValorAquisicao || 0);
        });
        const colors = ['#8B5CF6','#3B82F6','#10B981','#F59E0B','#EF4444','#EC4899','#14B8A6','#6366F1','#F97316','#84CC16'];
        if (typeof Chart === 'undefined') return;
        const c1 = document.getElementById('chartCategoria');
        if (c1) new Chart(c1, { type: 'pie', data: { labels: Object.keys(catMap), datasets: [{ data: Object.values(catMap), backgroundColor: colors }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { font: { size: 10 }, boxWidth: 12 } } } } });
        const c2 = document.getElementById('chartDepartamento');
        if (c2) new Chart(c2, { type: 'bar', data: { labels: Object.keys(deptMap), datasets: [{ label: 'Valor (Kz)', data: Object.values(deptMap), backgroundColor: '#8B5CF6', borderRadius: 4 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { callback: v => Utils.formatCurrency(v) } } } } });
    },

    // -------------------------------------------------------------------------
    // MODAL: CADASTRAR / EDITAR BEM
    // -------------------------------------------------------------------------
    // Helper para buscar bem por ID de forma robusta
    _findBem: (id) => {
        if (!id) return null;
        const bens = InventarioModule.state.bens || [];
        // Tenta ID maiúsculo, id minúsculo, e comparação flexível
        return bens.find(b =>
            (b.ID && String(b.ID) === String(id)) ||
            (b.id && String(b.id) === String(id))
        ) || null;
    },

    // Escapa caracteres especiais para uso seguro em atributos HTML (value="...")
    _escHtml: (str) => {
        if (!str && str !== 0) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    },

    modalBem: (id = null) => {
        const bem = id ? (InventarioModule._findBem(id) || {}) : {};
        const isEdit = id && bem && (bem.ID || bem.id);
        const title = isEdit ? 'Editar Bem Patrimonial' : 'Cadastrar Novo Bem';
        const catOptions = InventarioModule.categorias.map(c => `<option value="${c}" ${bem.Categoria === c ? 'selected' : ''}>${c}</option>`).join('');
        const estadoOptions = InventarioModule.estadosConservacao.map(e => `<option value="${e}" ${bem.EstadoConservacao === e ? 'selected' : ''}>${e}</option>`).join('');
        const deptOptions = InventarioModule.departamentos.map(d => `<option value="${d}" ${bem.Departamento === d ? 'selected' : ''}>${d}</option>`).join('');

        // Código automático baseado no nome
        const nextCodigo = bem.Codigo || InventarioModule._gerarCodigo(bem.Nome || '');

        Utils.openModal(title, `
            <form onsubmit="InventarioModule.save(event)">
                <input type="hidden" name="ID" value="${bem.ID || ''}">

                <h4 class="text-xs font-bold text-purple-700 uppercase tracking-widest mb-3 border-b border-purple-100 pb-1">1 — Identificação</h4>
                <div class="grid grid-cols-12 gap-3 mb-4">
                    <div class="col-span-6">
                        <label class="text-xs font-bold text-gray-700">Nome do Bem *</label>
                        <input name="Nome" value="${InventarioModule._escHtml(bem.Nome)}" class="border p-2 rounded-lg w-full mt-1" required
                            oninput="if(!this.form.querySelector('[name=ID]').value) { document.querySelector('[name=Codigo]').value = InventarioModule._gerarCodigo(this.value); }">
                    </div>
                    <div class="col-span-3">
                        <label class="text-xs font-bold text-gray-700">Quantidade</label>
                        <input type="number" name="Quantidade" value="${bem.Quantidade || 1}" min="1" class="border p-2 rounded-lg w-full mt-1">
                    </div>
                    <div class="col-span-3">
                        <label class="text-xs font-bold text-gray-700">Código</label>
                        <input name="Codigo" value="${nextCodigo}" class="border p-2 rounded-lg w-full mt-1 bg-purple-50 font-mono text-sm">
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-3 mb-4">
                    <div>
                        <label class="text-xs font-bold text-gray-700">Categoria *</label>
                        <select name="Categoria" class="border p-2 rounded-lg w-full mt-1" required>
                            <option value="">Selecione...</option>${catOptions}
                        </select>
                    </div>
                    <div>
                        <label class="text-xs font-bold text-gray-700">Nº de Série</label>
                        <input name="NumeroSerie" value="${InventarioModule._escHtml(bem.NumeroSerie)}" class="border p-2 rounded-lg w-full mt-1" placeholder="Ex: SN-123456">
                    </div>
                </div>

                <div class="mb-4">
                    <label class="text-xs font-bold text-gray-700">Foto do Bem</label>
                    <div class="flex items-center gap-3 mt-1">
                        <img id="preview-img" src="${bem.FotoURL || ''}" class="h-16 w-16 object-cover rounded-lg border ${bem.FotoURL ? '' : 'hidden'}">
                        <input type="file" id="foto-bem" accept="image/*" class="border p-2 rounded-lg w-full text-xs bg-gray-50" onchange="InventarioModule.previewImage(this)">
                    </div>
                </div>

                <h4 class="text-xs font-bold text-purple-700 uppercase tracking-widest mb-3 border-b border-purple-100 pb-1 mt-4">2 — Localização & Responsável</h4>
                <div class="grid grid-cols-2 gap-3 mb-4">
                    <div>
                        <label class="text-xs font-bold text-gray-700">Departamento</label>
                        <select name="Departamento" class="border p-2 rounded-lg w-full mt-1">
                            <option value="">Selecione...</option>${deptOptions}
                        </select>
                    </div>
                    <div>
                        <label class="text-xs font-bold text-gray-700">Responsável</label>
                        <input name="Responsavel" value="${InventarioModule._escHtml(bem.Responsavel)}" class="border p-2 rounded-lg w-full mt-1" placeholder="Nome do responsável">
                    </div>
                </div>

                <h4 class="text-xs font-bold text-purple-700 uppercase tracking-widest mb-3 border-b border-purple-100 pb-1 mt-4">3 — Detalhes Financeiros & Estado</h4>
                <div class="grid grid-cols-3 gap-3 mb-4">
                    <div>
                        <label class="text-xs font-bold text-gray-700">Data de Aquisição</label>
                        <input type="date" name="DataAquisicao" value="${InventarioModule._escHtml(bem.DataAquisicao)}" class="border p-2 rounded-lg w-full mt-1">
                    </div>
                    <div>
                        <label class="text-xs font-bold text-gray-700">Valor de Aquisição (Kz)</label>
                        <input type="number" step="0.01" name="ValorAquisicao" value="${InventarioModule._escHtml(bem.ValorAquisicao)}" class="border p-2 rounded-lg w-full mt-1">
                    </div>
                    <div>
                        <label class="text-xs font-bold text-gray-700">Vida Útil (anos)</label>
                        <input type="number" name="VidaUtil" value="${InventarioModule._escHtml(bem.VidaUtil) || 5}" min="1" class="border p-2 rounded-lg w-full mt-1">
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-3 mb-4">
                    <div>
                        <label class="text-xs font-bold text-gray-700">Estado de Conservação</label>
                        <select name="EstadoConservacao" class="border p-2 rounded-lg w-full mt-1">
                            ${estadoOptions}
                        </select>
                    </div>
                    <div>
                        <label class="text-xs font-bold text-gray-700">Fornecedor</label>
                        <input name="Fornecedor" value="${InventarioModule._escHtml(bem.Fornecedor)}" class="border p-2 rounded-lg w-full mt-1">
                    </div>
                </div>

                <div class="mb-4">
                    <label class="text-xs font-bold text-gray-700">Observações</label>
                    <textarea name="Observacoes" class="border p-2 rounded-lg w-full h-16 mt-1">${InventarioModule._escHtml(bem.Observacoes)}</textarea>
                </div>

                <button type="submit" class="w-full bg-purple-600 text-white py-3 rounded-lg font-bold hover:bg-purple-700">
                    <i class="fas fa-save mr-2"></i> Salvar Bem Patrimonial
                </button>
            </form>
        `);
    },

    // -------------------------------------------------------------------------
    // MODAL: MANUTENÇÃO
    // -------------------------------------------------------------------------
    modalManutencao: (bemId = null) => {
        const bens = InventarioModule.state.bens;
        const bemSelecionado = bemId ? bens.find(b => String(b.ID||b.id) === String(bemId)) : null;

        Utils.openModal('Registar Manutenção', `
            <form onsubmit="InventarioModule.saveManutencao(event)">
                <div class="mb-3">
                    <label class="text-xs font-bold text-gray-700">Bem Patrimonial *</label>
                    <select name="BemID" class="border p-2 rounded-lg w-full mt-1" required
                        onchange="this.form.BemNome.value = this.options[this.selectedIndex].text">
                        <option value="">Selecione o bem...</option>
                        ${bens.map(b => `<option value="${b.ID}" ${bemId === b.ID ? 'selected' : ''}>${b.Nome} (${b.Codigo || '-'})</option>`).join('')}
                    </select>
                    <input type="hidden" name="BemNome" value="${bemSelecionado ? bemSelecionado.Nome : ''}">
                </div>
                <div class="grid grid-cols-2 gap-3 mb-3">
                    <div>
                        <label class="text-xs font-bold text-gray-700">Tipo *</label>
                        <select name="Tipo" class="border p-2 rounded-lg w-full mt-1" required>
                            <option>Preventiva</option>
                            <option>Correctiva</option>
                            <option>Calibração</option>
                            <option>Limpeza / Higienização</option>
                            <option>Substituição de Peças</option>
                        </select>
                    </div>
                    <div>
                        <label class="text-xs font-bold text-gray-700">Data *</label>
                        <input type="date" name="Data" value="${new Date().toISOString().split('T')[0]}" class="border p-2 rounded-lg w-full mt-1" required>
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-3 mb-3">
                    <div>
                        <label class="text-xs font-bold text-gray-700">Técnico Responsável</label>
                        <input name="Tecnico" class="border p-2 rounded-lg w-full mt-1" placeholder="Nome do técnico">
                    </div>
                    <div>
                        <label class="text-xs font-bold text-gray-700">Custo (Kz)</label>
                        <input type="number" step="0.01" name="Custo" value="0" class="border p-2 rounded-lg w-full mt-1">
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-3 mb-3">
                    <div>
                        <label class="text-xs font-bold text-gray-700">Próxima Manutenção</label>
                        <input type="date" name="ProximaManutencao" class="border p-2 rounded-lg w-full mt-1">
                    </div>
                    <div>
                        <label class="text-xs font-bold text-gray-700">Estado</label>
                        <select name="Estado" class="border p-2 rounded-lg w-full mt-1">
                            <option>Pendente</option>
                            <option>Em Andamento</option>
                            <option>Concluída</option>
                        </select>
                    </div>
                </div>
                <div class="mb-4">
                    <label class="text-xs font-bold text-gray-700">Observações</label>
                    <textarea name="Observacoes" class="border p-2 rounded-lg w-full h-16 mt-1" placeholder="Descreva o serviço realizado..."></textarea>
                </div>
                <button type="submit" class="w-full bg-yellow-500 text-white py-3 rounded-lg font-bold hover:bg-yellow-600">
                    <i class="fas fa-tools mr-2"></i> Registar Manutenção
                </button>
            </form>
        `);
    },

    saveManutencao: async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target).entries());
        const user = Utils.getUser();
        data.RegistadoPor = user.Nome || 'Admin';
        try {
            await Utils.api('save', 'InventarioManutencoes', data);
            // Actualizar estado do bem para "Em Manutenção" se pendente
            if (data.Estado === 'Pendente' || data.Estado === 'Em Andamento') {
                const bem = InventarioModule.state.bens.find(b => String(b.ID||b.id) === String(data.BemID));
                if (bem) await Utils.api('saveInventario', null, { ...bem, EstadoConservacao: 'Em Manutenção' });
            }
            Utils.toast('Manutenção registada!', 'success');
            Utils.closeModal();
            InventarioModule.fetchData();
        } catch (err) { Utils.toast('Erro: ' + err.message, 'error'); }
    },

    // -------------------------------------------------------------------------
    // MODAL: TRANSFERÊNCIA
    // -------------------------------------------------------------------------
    modalTransferir: (bemId = null) => {
        const bens = InventarioModule.state.bens;
        const bemSelecionado = bemId ? bens.find(b => String(b.ID||b.id) === String(bemId)) : null;
        const deptOptions = InventarioModule.departamentos.map(d => `<option value="${d}">${d}</option>`).join('');

        Utils.openModal('Transferir Bem', `
            <form onsubmit="InventarioModule.saveTransferencia(event)">
                <div class="mb-3">
                    <label class="text-xs font-bold text-gray-700">Bem Patrimonial *</label>
                    <select name="BemID" id="transf-bem-select" class="border p-2 rounded-lg w-full mt-1" required
                        onchange="InventarioModule._fillOrigem(this)">
                        <option value="">Selecione o bem...</option>
                        ${bens.map(b => `<option value="${b.ID}" data-dept="${b.Departamento || ''}" ${bemId === b.ID ? 'selected' : ''}>${b.Nome} (${b.Codigo || '-'})</option>`).join('')}
                    </select>
                    <input type="hidden" name="BemNome">
                </div>
                <div class="grid grid-cols-2 gap-3 mb-3">
                    <div>
                        <label class="text-xs font-bold text-gray-700">Departamento Origem</label>
                        <input name="DepartamentoOrigem" id="transf-origem" class="border p-2 rounded-lg w-full mt-1 bg-gray-50" readonly
                            value="${bemSelecionado ? (bemSelecionado.Departamento || '') : ''}">
                    </div>
                    <div>
                        <label class="text-xs font-bold text-gray-700">Departamento Destino *</label>
                        <select name="DepartamentoDestino" class="border p-2 rounded-lg w-full mt-1" required>
                            <option value="">Selecione...</option>${deptOptions}
                        </select>
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-3 mb-3">
                    <div>
                        <label class="text-xs font-bold text-gray-700">Data</label>
                        <input type="date" name="Data" value="${new Date().toISOString().split('T')[0]}" class="border p-2 rounded-lg w-full mt-1">
                    </div>
                    <div>
                        <label class="text-xs font-bold text-gray-700">Autorizado por</label>
                        <input name="AutorizadoPor" class="border p-2 rounded-lg w-full mt-1" placeholder="Nome do autorizador">
                    </div>
                </div>
                <div class="mb-4">
                    <label class="text-xs font-bold text-gray-700">Motivo da Transferência</label>
                    <textarea name="Motivo" class="border p-2 rounded-lg w-full h-16 mt-1" placeholder="Justificação da transferência..."></textarea>
                </div>
                <button type="submit" class="w-full bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700">
                    <i class="fas fa-exchange-alt mr-2"></i> Confirmar Transferência
                </button>
            </form>
        `);

        if (bemSelecionado) {
            setTimeout(() => {
                const sel = document.getElementById('transf-bem-select');
                if (sel) sel.value = bemId;
            }, 50);
        }
    },

    _fillOrigem: (select) => {
        const opt = select.options[select.selectedIndex];
        const dept = opt ? opt.getAttribute('data-dept') : '';
        const origemInput = document.getElementById('transf-origem');
        if (origemInput) origemInput.value = dept;
        const nomeInput = select.form.BemNome;
        if (nomeInput) nomeInput.value = opt ? opt.text : '';
    },

    saveTransferencia: async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target).entries());
        if (data.DepartamentoOrigem === data.DepartamentoDestino) return Utils.toast('O destino deve ser diferente da origem.', 'warning');
        const user = Utils.getUser();
        data.RegistadoPor = user.Nome || 'Admin';
        try {
            await Utils.api('save', 'InventarioTransferencias', data);
            // Actualizar departamento do bem
            const bem = InventarioModule.state.bens.find(b => String(b.ID||b.id) === String(data.BemID));
            if (bem) await Utils.api('saveInventario', null, { ...bem, Departamento: data.DepartamentoDestino });
            Utils.toast('Transferência registada!', 'success');
            Utils.closeModal();
            InventarioModule.fetchData();
        } catch (err) { Utils.toast('Erro: ' + err.message, 'error'); }
    },

    // -------------------------------------------------------------------------
    // MODAL: BAIXAR BEM
    // -------------------------------------------------------------------------
    modalBaixar: (id) => {
        const bem = InventarioModule._findBem(id);
        if (!bem) return;
        Utils.openModal('Dar Baixa no Bem', `
            <div class="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <div class="flex items-center gap-3">
                    <i class="fas fa-exclamation-triangle text-red-500 text-2xl"></i>
                    <div>
                        <p class="font-bold text-red-800">Confirmar Baixa</p>
                        <p class="text-sm text-red-600">Esta acção marcará o bem como <b>Baixado</b> e não poderá ser revertida facilmente.</p>
                    </div>
                </div>
            </div>
            <div class="bg-white border rounded-lg p-3 mb-4 text-sm">
                <div class="font-bold text-gray-800">${bem.Nome}</div>
                <div class="text-gray-500">${bem.Codigo} · ${bem.Departamento || '-'}</div>
                <div class="text-gray-500">Valor: ${Utils.formatCurrency(bem.ValorAquisicao)}</div>
            </div>
            <form onsubmit="InventarioModule._confirmarBaixa(event, '${id}')">
                <div class="mb-3">
                    <label class="text-xs font-bold text-gray-700">Motivo da Baixa *</label>
                    <select name="MotivoBaixa" class="border p-2 rounded-lg w-full mt-1" required>
                        <option value="">Selecione...</option>
                        <option>Obsolescência</option>
                        <option>Avaria Irreparável</option>
                        <option>Furto / Roubo</option>
                        <option>Perda / Extravio</option>
                        <option>Venda</option>
                        <option>Doação</option>
                        <option>Sucata</option>
                    </select>
                </div>
                <div class="mb-4">
                    <label class="text-xs font-bold text-gray-700">Observações</label>
                    <textarea name="ObsBaixa" class="border p-2 rounded-lg w-full h-16 mt-1"></textarea>
                </div>
                <div class="flex gap-2">
                    <button type="button" onclick="Utils.closeModal()" class="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg">Cancelar</button>
                    <button type="submit" class="flex-1 bg-red-600 text-white py-2 rounded-lg font-bold hover:bg-red-700">
                        <i class="fas fa-times-circle mr-1"></i> Confirmar Baixa
                    </button>
                </div>
            </form>
        `);
    },

    _confirmarBaixa: async (e, id) => {
        e.preventDefault();
        const formData = Object.fromEntries(new FormData(e.target).entries());
        const bem = InventarioModule._findBem(id);
        if (!bem) return;
        try {
            await Utils.api('saveInventario', null, {
                ...bem,
                EstadoConservacao: 'Baixado',
                MotivoBaixa: formData.MotivoBaixa,
                ObsBaixa: formData.ObsBaixa,
                DataBaixa: new Date().toISOString().split('T')[0]
            });
            Utils.toast('Bem dado como baixado.', 'success');
            Utils.closeModal();
            InventarioModule.fetchData();
        } catch (err) { Utils.toast('Erro: ' + err.message, 'error'); }
    },

    // -------------------------------------------------------------------------
    // MODAL: DETALHES + QR CODE
    // -------------------------------------------------------------------------
    detalhes: (id) => {
        const bem = InventarioModule._findBem(id);
        if (!bem) return;
        const manut = (InventarioModule.state.manutencoes || []).filter(m => m.BemID === id);
        const deprec = InventarioModule._calcDepreciacao(bem);
        const valorActual = Math.max(0, Number(bem.ValorAquisicao || 0) - deprec);
        const colorMap = { 'Novo': 'bg-blue-100 text-blue-800', 'Bom': 'bg-green-100 text-green-800', 'Regular': 'bg-yellow-100 text-yellow-800', 'Ruim': 'bg-red-100 text-red-800', 'Em Manutenção': 'bg-orange-100 text-orange-800', 'Baixado': 'bg-gray-100 text-gray-500' };
        const chip = colorMap[bem.EstadoConservacao] || 'bg-gray-100 text-gray-600';

        Utils.openModal(`Ficha Patrimonial — ${bem.Nome}`, `
            <div class="grid grid-cols-3 gap-6">
                <!-- Coluna esquerda: foto + QR -->
                <div class="flex flex-col items-center gap-3 bg-gray-50 p-4 rounded-xl border">
                    ${bem.FotoURL
                        ? `<img src="${bem.FotoURL}" class="w-full h-32 object-cover rounded-lg border bg-white">`
                        : `<div class="w-full h-32 bg-white border rounded-lg flex items-center justify-center text-gray-300"><i class="fas fa-box text-5xl"></i></div>`}
                    <div id="qrcode" class="bg-white p-2 rounded-lg border"></div>
                    <div class="text-xs font-mono font-bold text-gray-600 text-center">${bem.Codigo || '-'}</div>
                    <div class="text-xs text-gray-400 text-center">Escaneie para inventário físico</div>
                    <button onclick="InventarioModule._printFicha('${id}')" class="w-full bg-purple-600 text-white py-2 rounded-lg text-sm hover:bg-purple-700 mt-1">
                        <i class="fas fa-print mr-1"></i> Imprimir Ficha
                    </button>
                </div>

                <!-- Coluna direita: detalhes -->
                <div class="col-span-2 space-y-4">
                    <div class="flex items-center justify-between">
                        <h3 class="text-lg font-bold text-gray-800">${bem.Nome}</h3>
                        <span class="px-3 py-1 rounded-full text-xs font-bold ${chip}">${bem.EstadoConservacao}</span>
                    </div>

                    <div class="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                        <div><span class="font-bold text-gray-500">Categoria:</span> ${bem.Categoria || '-'}</div>
                        <div><span class="font-bold text-gray-500">Quantidade:</span> ${bem.Quantidade || 1}</div>
                        <div><span class="font-bold text-gray-500">Nº Série:</span> ${bem.NumeroSerie || '-'}</div>
                        <div><span class="font-bold text-gray-500">Departamento:</span> ${bem.Departamento || '-'}</div>
                        <div><span class="font-bold text-gray-500">Responsável:</span> ${bem.Responsavel || '-'}</div>
                        <div><span class="font-bold text-gray-500">Fornecedor:</span> ${bem.Fornecedor || '-'}</div>
                        <div><span class="font-bold text-gray-500">Data Aquisição:</span> ${Utils.formatDate(bem.DataAquisicao)}</div>
                        <div><span class="font-bold text-gray-500">Vida Útil:</span> ${bem.VidaUtil || 5} anos</div>
                    </div>

                    <!-- Financeiro -->
                    <div class="bg-purple-50 rounded-lg p-3 text-sm grid grid-cols-3 gap-2">
                        <div class="text-center">
                            <div class="text-xs text-gray-500">Valor Aquisição</div>
                            <div class="font-bold">${Utils.formatCurrency(bem.ValorAquisicao)}</div>
                        </div>
                        <div class="text-center">
                            <div class="text-xs text-red-400">Depreciação</div>
                            <div class="font-bold text-red-500">- ${Utils.formatCurrency(deprec)}</div>
                        </div>
                        <div class="text-center">
                            <div class="text-xs text-green-600">Valor Actual</div>
                            <div class="font-bold text-green-700">${Utils.formatCurrency(valorActual)}</div>
                        </div>
                    </div>

                    <!-- Manutenções recentes -->
                    ${manut.length > 0 ? `
                    <div>
                        <h5 class="text-xs font-bold text-gray-500 uppercase mb-2">Últimas Manutenções</h5>
                        <div class="space-y-1 max-h-24 overflow-y-auto">
                            ${manut.slice(-3).reverse().map(m => `
                                <div class="flex justify-between text-xs bg-gray-50 px-2 py-1 rounded">
                                    <span>${Utils.formatDate(m.Data)} — ${m.Tipo}</span>
                                    <span class="font-bold">${Utils.formatCurrency(m.Custo || 0)}</span>
                                </div>`).join('')}
                        </div>
                    </div>` : ''}

                    <!-- Ações Rápidas -->
                    <div class="flex gap-2 pt-2 border-t">
                        <button onclick="Utils.closeModal(); InventarioModule.modalManutencao('${id}')" class="flex-1 bg-yellow-500 text-white py-2 rounded-lg text-sm hover:bg-yellow-600">
                            <i class="fas fa-tools mr-1"></i> Manutenção
                        </button>
                        <button onclick="Utils.closeModal(); InventarioModule.modalTransferir('${id}')" class="flex-1 bg-green-500 text-white py-2 rounded-lg text-sm hover:bg-green-600">
                            <i class="fas fa-exchange-alt mr-1"></i> Transferir
                        </button>
                        <button onclick="Utils.closeModal(); InventarioModule.modalBem('${id}')" class="flex-1 bg-blue-500 text-white py-2 rounded-lg text-sm hover:bg-blue-600">
                            <i class="fas fa-pen mr-1"></i> Editar
                        </button>
                    </div>
                </div>
            </div>
        `);

        // QR Code
        if (typeof QRCode !== 'undefined') {
            try {
                new QRCode(document.getElementById('qrcode'), {
                    text: `PATRIMONIO:${bem.Codigo}:${bem.Nome}`,
                    width: 100, height: 100
                });
            } catch(e) {}
        }
    },

    _printFicha: (id) => {
        const bem = InventarioModule._findBem(id);
        if (!bem) return;
        const inst = InventarioModule.state.instituicao[0] || {};
        const deprec = InventarioModule._calcDepreciacao(bem);
        const valorActual = Math.max(0, Number(bem.ValorAquisicao || 0) - deprec);
        const manut = (InventarioModule.state.manutencoes || []).filter(m => m.BemID === id);
        const html = `
            <div class="p-8 font-sans text-gray-900 bg-white max-w-3xl mx-auto border">
                <!-- CABEÇALHO COM LOGO -->
                <div class="flex justify-between items-center border-b-2 pb-4 mb-6">
                    <div class="flex items-center gap-3">
                        ${inst.LogotipoURL ? `<img src="${inst.LogotipoURL}" style="height:56px;width:auto;object-fit:contain;" crossorigin="anonymous">` : ''}
                        <div>
                            <h1 class="text-xl font-bold uppercase">${inst.NomeFantasia || 'Delícias da Cidade'}</h1>
                            <p class="text-sm text-gray-500">Ficha de Bem Patrimonial</p>
                        </div>
                    </div>
                    <div class="text-right">
                        <h2 class="text-lg font-bold font-mono text-purple-700">${bem.Codigo || '-'}</h2>
                        <p class="text-xs text-gray-400">Emitido: ${new Date().toLocaleDateString('pt-PT')}</p>
                    </div>
                </div>
                <div class="flex gap-6 mb-6">
                    ${bem.FotoURL ? `<img src="${bem.FotoURL}" class="w-28 h-28 object-cover rounded border">` : ''}
                    <div class="flex-1 grid grid-cols-2 gap-3 text-sm">
                        <div><b>Nome:</b> ${bem.Nome}</div>
                        <div><b>Categoria:</b> ${bem.Categoria}</div>
                        <div><b>Nº Série:</b> ${bem.NumeroSerie || '-'}</div>
                        <div><b>Quantidade:</b> ${bem.Quantidade || 1}</div>
                        <div><b>Departamento:</b> ${bem.Departamento}</div>
                        <div><b>Responsável:</b> ${bem.Responsavel || '-'}</div>
                        <div><b>Estado:</b> ${bem.EstadoConservacao}</div>
                        <div><b>Fornecedor:</b> ${bem.Fornecedor || '-'}</div>
                        <div><b>Data Aquisição:</b> ${Utils.formatDate(bem.DataAquisicao)}</div>
                        <div><b>Vida Útil:</b> ${bem.VidaUtil || 5} anos</div>
                        <div><b>Valor Aquisição:</b> ${Utils.formatCurrency(bem.ValorAquisicao)}</div>
                        <div><b>Valor Actual:</b> ${Utils.formatCurrency(valorActual)}</div>
                    </div>
                </div>
                ${manut.length > 0 ? `
                <h4 class="font-bold border-b mb-2 text-sm">Histórico de Manutenções</h4>
                <table class="w-full text-xs border-collapse">
                    <thead class="bg-gray-100"><tr><th class="border p-1">Data</th><th class="border p-1">Tipo</th><th class="border p-1">Técnico</th><th class="border p-1 text-right">Custo</th></tr></thead>
                    <tbody>${manut.map(m => `<tr><td class="border p-1">${Utils.formatDate(m.Data)}</td><td class="border p-1">${m.Tipo}</td><td class="border p-1">${m.Tecnico || '-'}</td><td class="border p-1 text-right">${Utils.formatCurrency(m.Custo || 0)}</td></tr>`).join('')}</tbody>
                </table>` : ''}
                <div class="mt-10 grid grid-cols-2 gap-12 text-center text-sm">
                    <div class="border-t pt-2"><p>Responsável</p></div>
                    <div class="border-t pt-2"><p>Direcção</p></div>
                </div>
                <!-- RODAPÉ COPYRIGHT -->
                <div class="mt-8 pt-4 border-t border-gray-200 text-center text-xs text-gray-400">
                    © ${new Date().getFullYear()} ${inst.NomeFantasia || 'DELÍCIAS DA CIDADE'}. Todos os direitos reservados.
                </div>
            </div>`;
        Utils.printNative(html);
    },

    // -------------------------------------------------------------------------
    // SAVE
    // -------------------------------------------------------------------------
    save: async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target).entries());
        if (!data.Nome.trim()) return Utils.toast('⚠️ O nome do bem é obrigatório.', 'warning');
        if (!data.Categoria) return Utils.toast('⚠️ A categoria é obrigatória.', 'warning');
        if (data.ValorAquisicao && Number(data.ValorAquisicao) < 0) return Utils.toast('⚠️ Valor inválido.', 'warning');

        // Auto-código se vazio
        if (!data.Codigo) data.Codigo = InventarioModule._gerarCodigo(data.Nome);

        // Upload foto
        const fileInput = document.getElementById('foto-bem');
        if (fileInput && fileInput.files[0]) {
            const file = fileInput.files[0];
            if (file.size > 2 * 1024 * 1024) return Utils.toast('⚠️ Imagem muito grande (Máx 2MB).', 'warning');
            data.FotoURL = await new Promise((res, rej) => {
                const r = new FileReader();
                r.onload = () => res(r.result);
                r.onerror = rej;
                r.readAsDataURL(file);
            });
        }

        data.UserAction = (Utils.getUser() || {}).Nome || 'Admin';

        try {
            await Utils.api('saveInventario', null, data);
            Utils.toast('Bem salvo com sucesso!', 'success');
            Utils.closeModal();
            InventarioModule.fetchData();
        } catch (err) { Utils.toast('Erro: ' + err.message, 'error'); }
    },

    previewImage: (input) => {
        if (input.files && input.files[0]) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = document.getElementById('preview-img');
                if (img) { img.src = e.target.result; img.classList.remove('hidden'); }
            };
            reader.readAsDataURL(input.files[0]);
        }
    },

    // -------------------------------------------------------------------------
    // EXPORTAR PDF COMPLETO
    // -------------------------------------------------------------------------
    exportPDF: () => {
        const data = InventarioModule.state.filteredBens || InventarioModule.state.bens || [];
        const inst = InventarioModule.state.instituicao[0] || {};
        const user = Utils.getUser() || {};
        const totalValor = data.reduce((acc, b) => acc + Number(b.ValorAquisicao || 0), 0);
        const totalDeprec = data.reduce((acc, b) => acc + InventarioModule._calcDepreciacao(b), 0);

        const html = `
        <div class="p-8 font-sans text-gray-900 bg-white">
            <!-- CABEÇALHO COM LOGO -->
            <div class="flex justify-between items-center border-b-2 border-gray-800 pb-4 mb-6">
                <div class="flex items-center gap-4">
                    ${inst.LogotipoURL ? `<img src="${inst.LogotipoURL}" style="height:64px;width:auto;object-fit:contain;" crossorigin="anonymous">` : ''}
                    <div>
                        <h1 class="text-2xl font-bold uppercase">${inst.NomeFantasia || 'Delícias da Cidade'}</h1>
                        <p class="text-sm text-gray-500">${inst.Endereco || ''}</p>
                    </div>
                </div>
                <div class="text-right">
                    <h2 class="text-xl font-bold">RELATÓRIO DE INVENTÁRIO</h2>
                    <p class="text-sm text-gray-500">Gerado em: ${new Date().toLocaleDateString('pt-PT')}</p>
                    <p class="text-xs text-gray-400">Por: ${user.Nome || 'Sistema'}</p>
                </div>
            </div>

            <!-- KPIs -->
            <div class="grid grid-cols-3 gap-4 mb-6">
                <div class="bg-gray-50 p-3 rounded border text-center"><div class="text-xs text-gray-500">Total de Bens</div><div class="text-xl font-bold">${data.length}</div></div>
                <div class="bg-gray-50 p-3 rounded border text-center"><div class="text-xs text-gray-500">Valor de Aquisição</div><div class="text-xl font-bold">${Utils.formatCurrency(totalValor)}</div></div>
                <div class="bg-gray-50 p-3 rounded border text-center"><div class="text-xs text-green-600">Valor Actual Estimado</div><div class="text-xl font-bold text-green-700">${Utils.formatCurrency(totalValor - totalDeprec)}</div></div>
            </div>

            <table class="w-full text-xs border-collapse border border-gray-300">
                <thead class="bg-gray-100">
                    <tr>
                        <th class="border p-2 text-left">Código</th>
                        <th class="border p-2 text-left">Bem</th>
                        <th class="border p-2 text-left">Categoria</th>
                        <th class="border p-2 text-left">Departamento</th>
                        <th class="border p-2 text-left">Responsável</th>
                        <th class="border p-2 text-center">Estado</th>
                        <th class="border p-2 text-right">Valor Aquisição</th>
                        <th class="border p-2 text-right">Valor Actual</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.map(b => {
                        const deprec = InventarioModule._calcDepreciacao(b);
                        const valorActual = Math.max(0, Number(b.ValorAquisicao || 0) - deprec);
                        return `<tr>
                            <td class="border p-1 font-mono">${b.Codigo || '-'}</td>
                            <td class="border p-1 font-semibold">${b.Nome}</td>
                            <td class="border p-1">${b.Categoria || '-'}</td>
                            <td class="border p-1">${b.Departamento || '-'}</td>
                            <td class="border p-1">${b.Responsavel || '-'}</td>
                            <td class="border p-1 text-center">${b.EstadoConservacao || '-'}</td>
                            <td class="border p-1 text-right">${Utils.formatCurrency(b.ValorAquisicao)}</td>
                            <td class="border p-1 text-right font-bold">${Utils.formatCurrency(valorActual)}</td>
                        </tr>`;
                    }).join('')}
                    <tr class="bg-gray-50 font-bold">
                        <td class="border p-2" colspan="6">TOTAIS</td>
                        <td class="border p-2 text-right">${Utils.formatCurrency(totalValor)}</td>
                        <td class="border p-2 text-right text-green-700">${Utils.formatCurrency(totalValor - totalDeprec)}</td>
                    </tr>
                </tbody>
            </table>
            <div class="mt-10 pt-4 border-t border-gray-200 text-center text-xs text-gray-400">
                © ${new Date().getFullYear()} ${inst.NomeFantasia || 'DELÍCIAS DA CIDADE'}. Todos os direitos reservados.
            </div>
        </div>`;

        Utils.printNative(html, 'landscape');
    },

    exportManutencoesPDF: () => {
        const data = InventarioModule.state.manutencoes || [];
        const bens = InventarioModule.state.bens || [];
        const inst = InventarioModule.state.instituicao[0] || {};
        const totalCusto = data.reduce((acc, m) => acc + Number(m.Custo || 0), 0);

        const html = `
        <div class="p-8 font-sans text-gray-900 bg-white">
            <div class="flex justify-between items-center border-b-2 pb-4 mb-6">
                <div class="flex items-center gap-3">
                    ${inst.LogotipoURL ? `<img src="${inst.LogotipoURL}" style="height:56px;width:auto;object-fit:contain;" crossorigin="anonymous">` : ''}
                    <div>
                        <h1 class="text-xl font-bold uppercase">${inst.NomeFantasia || 'Delícias da Cidade'}</h1>
                    </div>
                </div>
                <div class="text-right"><h2 class="text-lg font-bold">RELATÓRIO DE MANUTENÇÕES</h2><p class="text-sm text-gray-400">${new Date().toLocaleDateString('pt-PT')}</p></div>
            </div>
            <table class="w-full text-xs border-collapse border border-gray-300">
                <thead class="bg-gray-100">
                    <tr><th class="border p-2 text-left">Bem</th><th class="border p-2">Tipo</th><th class="border p-2">Data</th><th class="border p-2">Técnico</th><th class="border p-2 text-right">Custo</th><th class="border p-2">Estado</th></tr>
                </thead>
                <tbody>
                    ${data.map(m => {
                        const bem = bens.find(b => String(b.ID||b.id) === String(m.BemID)) || {};
                        return `<tr><td class="border p-1 font-semibold">${bem.Nome || m.BemNome || '-'}</td><td class="border p-1 text-center">${m.Tipo || '-'}</td><td class="border p-1 text-center">${Utils.formatDate(m.Data)}</td><td class="border p-1">${m.Tecnico || '-'}</td><td class="border p-1 text-right">${Utils.formatCurrency(m.Custo || 0)}</td><td class="border p-1 text-center">${m.Estado || '-'}</td></tr>`;
                    }).join('')}
                    <tr class="bg-gray-100 font-bold"><td colspan="4" class="border p-2 text-right">TOTAL</td><td class="border p-2 text-right">${Utils.formatCurrency(totalCusto)}</td><td class="border p-2"></td></tr>
                </tbody>
            </table>
            <div class="mt-8 pt-4 border-t border-gray-200 text-center text-xs text-gray-400">
                © ${new Date().getFullYear()} ${inst.NomeFantasia || 'DELÍCIAS DA CIDADE'}. Todos os direitos reservados.
            </div>
        </div>`;
        Utils.printNative(html);
    },

    exportCSV: () => {
        const data = InventarioModule.state.filteredBens || InventarioModule.state.bens || [];
        if (data.length === 0) return Utils.toast('Sem dados para exportar.', 'warning');
        const headers = ['Código','Nome','Categoria','Departamento','Responsável','Nº Série','Estado','Valor Aquisição','Valor Actual','Data Aquisição'];
        const esc = val => `"${String(val || '').replace(/"/g, '""')}"`;
        const csvContent = [
            headers.join(','),
            ...data.map(b => {
                const deprec = InventarioModule._calcDepreciacao(b);
                const va = Math.max(0, Number(b.ValorAquisicao || 0) - deprec);
                return [esc(b.Codigo), esc(b.Nome), esc(b.Categoria), esc(b.Departamento), esc(b.Responsavel), esc(b.NumeroSerie), esc(b.EstadoConservacao), b.ValorAquisicao || 0, va.toFixed(2), b.DataAquisicao || ''].join(',');
            })
        ].join('\n');

        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `inventario_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    },


    // -------------------------------------------------------------------------
    // ELIMINAR DEFINITIVAMENTE
    // -------------------------------------------------------------------------
    confirmarEliminar: (id, nome) => {
        Utils.openModal("Eliminar Bem", `
            <div class="bg-red-50 border-2 border-red-300 rounded-xl p-5 mb-4 text-center">
                <i class="fas fa-trash text-red-500 text-4xl mb-3 block"></i>
                <p class="font-bold text-red-800 text-lg">Tens a certeza?</p>
                <p class="text-red-600 text-sm mt-1">Vais eliminar permanentemente:</p>
                <p class="font-bold text-gray-800 text-base mt-2 bg-white px-3 py-2 rounded-lg border">${nome}</p>
                <p class="text-xs text-red-400 mt-3">Esta acção é irreversível. O bem será apagado.</p>
            </div>
            <div class="flex gap-3">
                <button onclick="Utils.closeModal()" class="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-lg font-medium hover:bg-gray-50">Cancelar</button>
                <button onclick="InventarioModule._eliminar('${id}')" class="flex-1 bg-red-600 text-white py-2.5 rounded-lg font-bold hover:bg-red-700"><i class="fas fa-trash mr-2"></i> Eliminar</button>
            </div>
        `);
    },

    confirmarEliminarManutencao: (id, nome) => {
        Utils.openModal("Eliminar Manutenção", `
            <div class="bg-red-50 border-2 border-red-300 rounded-xl p-5 mb-4 text-center">
                <i class="fas fa-trash text-red-500 text-4xl mb-3 block"></i>
                <p class="font-bold text-red-800 text-lg">Tens a certeza?</p>
                <p class="text-red-600 text-sm mt-1">Vais eliminar o registo de manutenção:</p>
                <p class="font-bold text-gray-800 text-base mt-2 bg-white px-3 py-2 rounded-lg border">${nome}</p>
                <p class="text-xs text-red-400 mt-3">Esta acção é irreversível.</p>
            </div>
            <div class="flex gap-3">
                <button onclick="Utils.closeModal()" class="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-lg font-medium hover:bg-gray-50">Cancelar</button>
                <button onclick="InventarioModule._eliminarManutencao('${id}')" class="flex-1 bg-red-600 text-white py-2.5 rounded-lg font-bold hover:bg-red-700"><i class="fas fa-trash mr-2"></i> Eliminar</button>
            </div>
        `);
    },

    _eliminarManutencao: async (id) => {
        try {
            await Utils.api('deleteManutencao', null, { ID: id });
            InventarioModule.state.manutencoes = InventarioModule.state.manutencoes.filter(m => String(m.ID) !== String(id));
            Utils.toast('Manutenção eliminada com sucesso.', 'success');
            Utils.closeModal();
            InventarioModule.render();
        } catch (err) {
            Utils.toast('Erro ao eliminar: ' + err.message, 'error');
        }
    },

    confirmarEliminarTransferencia: (id, nome) => {
        Utils.openModal("Eliminar Transferência", `
            <div class="bg-red-50 border-2 border-red-300 rounded-xl p-5 mb-4 text-center">
                <i class="fas fa-trash text-red-500 text-4xl mb-3 block"></i>
                <p class="font-bold text-red-800 text-lg">Tens a certeza?</p>
                <p class="text-red-600 text-sm mt-1">Vais eliminar o registo de transferência:</p>
                <p class="font-bold text-gray-800 text-base mt-2 bg-white px-3 py-2 rounded-lg border">${nome}</p>
                <p class="text-xs text-red-400 mt-3">Esta acção é irreversível.</p>
            </div>
            <div class="flex gap-3">
                <button onclick="Utils.closeModal()" class="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-lg font-medium hover:bg-gray-50">Cancelar</button>
                <button onclick="InventarioModule._eliminarTransferencia('${id}')" class="flex-1 bg-red-600 text-white py-2.5 rounded-lg font-bold hover:bg-red-700"><i class="fas fa-trash mr-2"></i> Eliminar</button>
            </div>
        `);
    },

    _eliminarTransferencia: async (id) => {
        try {
            await Utils.api('deleteTransferencia', null, { ID: id });
            InventarioModule.state.transferencias = InventarioModule.state.transferencias.filter(t => String(t.ID) !== String(id));
            Utils.toast('Transferência eliminada com sucesso.', 'success');
            Utils.closeModal();
            InventarioModule.render();
        } catch (err) {
            Utils.toast('Erro ao eliminar: ' + err.message, 'error');
        }
    },

    _eliminar: async (id) => {
        try {
            // Usa o mesmo padrão do saveInventario para garantir consistência com a BD
            await Utils.api('deleteInventario', null, { ID: id });

            // Remove localmente do estado imediatamente
            InventarioModule.state.bens = InventarioModule.state.bens.filter(b =>
                String(b.ID || b.id) !== String(id)
            );
            InventarioModule.state.manutencoes = InventarioModule.state.manutencoes.filter(m =>
                String(m.BemID) !== String(id)
            );
            InventarioModule.state.transferencias = InventarioModule.state.transferencias.filter(t =>
                String(t.BemID) !== String(id)
            );

            Utils.toast('Bem eliminado com sucesso.', 'success');
            Utils.closeModal();
            InventarioModule.render();
            InventarioModule.fetchData();
        } catch (err) {
            console.error('Erro ao eliminar:', err);
            Utils.toast('Erro ao eliminar: ' + err.message, 'error');
        }
    },

    // -------------------------------------------------------------------------
    // HELPERS
    // -------------------------------------------------------------------------
    _applyFilters: (data) => {
        let d = data || [];
        const { filterTerm, filterDept, filterCategoria, filterEstado } = InventarioModule.state;
        if (filterTerm) {
            const t = filterTerm.toLowerCase();
            d = d.filter(b =>
                (b.Nome || '').toLowerCase().includes(t) ||
                (b.Codigo || '').toLowerCase().includes(t) ||
                (b.Responsavel || '').toLowerCase().includes(t) ||
                (b.NumeroSerie || '').toLowerCase().includes(t)
            );
        }
        if (filterDept) d = d.filter(b => b.Departamento === filterDept);
        if (filterCategoria) d = d.filter(b => b.Categoria === filterCategoria);
        if (filterEstado) d = d.filter(b => b.EstadoConservacao === filterEstado);
        return d;
    },

    _calcDepreciacao: (bem) => {
        if (!bem.DataAquisicao || !bem.ValorAquisicao) return 0;
        const anos = Math.max(0, (Date.now() - new Date(bem.DataAquisicao).getTime()) / (1000 * 60 * 60 * 24 * 365.25));
        const vidaUtil = Number(bem.VidaUtil || 5);
        const taxaAnual = 1 / vidaUtil;
        const deprecAcum = Math.min(Number(bem.ValorAquisicao), Number(bem.ValorAquisicao) * taxaAnual * anos);
        return Math.round(deprecAcum);
    },

    _gerarCodigo: (nome) => {
        const bens = InventarioModule.state.bens || [];

        // --- Gerar prefixo a partir do nome ---
        // Ex: "Cuba Rasa"         → "CUBA-R"
        // Ex: "Computador Dell"   → "COMP-D"
        // Ex: "Mesa de Escritório"→ "MESA-E"
        // Ex: "Cadeira"           → "CADE"
        let prefixo = 'PAT';
        if (nome && nome.trim()) {
            const palavras = nome.trim().toUpperCase()
                .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos
                .replace(/[^A-Z0-9 ]/g, '')                       // remove especiais
                .split(/\s+/)
                .filter(Boolean);

            if (palavras.length === 1) {
                // Uma palavra: primeiras 4 letras
                prefixo = palavras[0].slice(0, 4);
            } else {
                // Duas ou mais palavras: primeiras 4 da 1ª + "-" + inicial da 2ª
                // Ignora palavras irrelevantes: DE, DA, DO, DAS, DOS, E
                const stopWords = new Set(['DE','DA','DO','DAS','DOS','E','A','O','AS','OS']);
                const p1 = palavras[0].slice(0, 4);
                const p2 = palavras.slice(1).find(p => !stopWords.has(p));
                prefixo = p2 ? `${p1}-${p2[0]}` : p1;
            }
        }

        // --- Contar bens existentes com o mesmo prefixo ---
        const existentes = bens.filter(b =>
            (b.Codigo || '').toUpperCase().startsWith(prefixo)
        );
        const numeros = existentes.map(b => {
            const m = (b.Codigo || '').match(/(\d{3})$/);
            return m ? Number(m[1]) : 0;
        });
        const maxNum = numeros.length > 0 ? Math.max(...numeros) : 0;

        return `${prefixo}${String(maxNum + 1).padStart(3, '0')}`;
    },

    _setTab: (tab) => {
        InventarioModule.state.activeTab = tab;
        InventarioModule.render();
    },

    updateFilter: (val) => {
        InventarioModule.state.filterTerm = val;
        InventarioModule.state.pagination.page = 1;
        InventarioModule.render();
    },

    updateDeptFilter: (val) => {
        InventarioModule.state.filterDept = val;
        InventarioModule.state.pagination.page = 1;
        InventarioModule.render();
    },

    updateCatFilter: (val) => {
        InventarioModule.state.filterCategoria = val;
        InventarioModule.state.pagination.page = 1;
        InventarioModule.render();
    },

    changePage: (offset) => {
        const { page, limit, total } = InventarioModule.state.pagination;
        const newPage = page + offset;
        const totalPages = Math.ceil(total / limit);
        if (newPage > 0 && newPage <= totalPages) {
            InventarioModule.state.pagination.page = newPage;
            InventarioModule.render();
        }
    },
};

document.addEventListener('DOMContentLoaded', InventarioModule.init);
