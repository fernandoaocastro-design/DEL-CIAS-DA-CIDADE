const EstoqueModule = {
    state: { items: [], movimentacoes: [], movStats: [], fornecedores: [], activeTab: 'dashboard', filterMovSubtipo: '', filterMovTerm: '', filterSubtype: '', charts: {}, pagination: { page: 1, limit: 20, total: 0 }, productPagination: { page: 1, limit: 15, total: 0 } },
    // Classificação Inteligente
    taxonomy: {
        'Alimentos': {
            'Frescos': ['Carne', 'Frango', 'Peixe', 'Ovos', 'Legumes', 'Frutas', 'Laticínios', 'Congelados'],
            'Secos': ['Arroz', 'Massa', 'Feijão', 'Açúcar', 'Óleo', 'Temperos', 'Enlatados', 'Cereais']
        },
        'Bebidas': {
            'Geral': ['Água', 'Refrigerantes', 'Sumos', 'Cervejas', 'Vinhos', 'Energéticos', 'Bebidas alcoólicas']
        },
        'Insumos': {
            'Materiais': ['Limpeza', 'Gás', 'Embalagens', 'Descartáveis', 'Equipamentos', 'Utensílios']
        }
    },

    init: () => {
        // Verifica se há uma view específica na URL (ex: Itens Recebidos)
        const params = new URLSearchParams(window.location.search);
        if (params.get('view') === 'recebidos') {
            EstoqueModule.state.activeTab = 'recebidos';
        }
        EstoqueModule.fetchData();
        EstoqueModule.updateHeaderPhoto();
    },

    updateHeaderPhoto: () => {
        const user = JSON.parse(localStorage.getItem('user'));
        const img = document.getElementById('user-photo'); 
        if (user && user.FotoURL && img) {
            img.src = user.FotoURL;
        }
    },

    fetchData: async () => {
        try {
            const [data, inst, fornecedores] = await Promise.all([
                Utils.api('getAll', 'Estoque'),
                Utils.api('getAll', 'InstituicaoConfig'),
                Utils.api('getAll', 'Fornecedores')
            ]);
            EstoqueModule.state.items = data || [];
            EstoqueModule.state.instituicao = inst || [];
            EstoqueModule.state.fornecedores = fornecedores || [];
            
            // Se estiver na aba de movimentações, busca o histórico também
            if(EstoqueModule.state.activeTab === 'movimentacoes' || EstoqueModule.state.activeTab === 'dashboard') await EstoqueModule.fetchMovimentacoes();
            
            EstoqueModule.render(); // Renderiza a aba atual
        } catch (e) {
            console.error(e);
            Utils.toast("Erro ao carregar estoque.", 'error');
        }
    },

    fetchMovimentacoes: async () => {
        try {
            const { page, limit } = EstoqueModule.state.pagination;
            const subtipo = EstoqueModule.state.filterMovSubtipo;
            const term = EstoqueModule.state.filterMovTerm;
            
            // Busca lista paginada e estatísticas para o gráfico em paralelo
            const [response, stats] = await Promise.all([
                Utils.api('getMovimentacoesEstoque', null, { page, limit, subtipo, term }),
                Utils.api('getMovimentacoesStats', null, {})
            ]);

            EstoqueModule.state.movimentacoes = response.data || [];
            EstoqueModule.state.movStats = stats || [];
            EstoqueModule.state.pagination.total = response.total || 0;
        } catch(e) { console.error(e); }
    },

    setTab: (tab) => {
        EstoqueModule.state.activeTab = tab;
        
        // Atualiza visual das abas
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.className = 'tab-btn px-4 py-2 text-gray-500 hover:text-gray-700 transition';
            btn.style.borderBottom = 'none';
        });
        const activeBtn = document.getElementById(`tab-${tab}`);
        if (activeBtn) {
            activeBtn.className = 'tab-btn px-4 py-2 font-bold text-yellow-600 transition';
            activeBtn.style.borderBottom = '2px solid #EAB308';
        }

        if (tab === 'movimentacoes') EstoqueModule.fetchMovimentacoes().then(EstoqueModule.render);
        else if (tab === 'dashboard') Promise.all([EstoqueModule.fetchData(), EstoqueModule.fetchMovimentacoes()]).then(EstoqueModule.render);
        else if (tab === 'lista-dia') {
            if (typeof DailyListModule !== 'undefined') {
                DailyListModule.init();
            } else {
                console.error('DailyListModule não encontrado. Verifique se o arquivo js/modules/lista_dia.js foi carregado.');
                Utils.toast('Erro: Módulo Lista do Dia não carregado.', 'error');
            }
        }
        else EstoqueModule.render();
    },

    render: () => {
        // Atualiza visual das abas (Garante estado correto no F5/Reload)
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.className = 'tab-btn px-4 py-2 text-gray-500 hover:text-gray-700 transition';
            btn.style.borderBottom = 'none';
        });
        const activeBtn = document.getElementById(`tab-${EstoqueModule.state.activeTab}`);
        if (activeBtn) {
            activeBtn.className = 'tab-btn px-4 py-2 font-bold text-yellow-600 transition';
            activeBtn.style.borderBottom = '2px solid #EAB308';
        }

        if (EstoqueModule.state.activeTab === 'dashboard') {
            EstoqueModule.renderDashboard();
            return;
        }
        else if (EstoqueModule.state.activeTab === 'movimentacoes') {
            EstoqueModule.renderMovimentacoes();
            return;
        }
        else if (EstoqueModule.state.activeTab === 'fornecedores') {
            EstoqueModule.renderFornecedores();
            return;
        }
        else if (EstoqueModule.state.activeTab === 'relatorios') {
            EstoqueModule.renderRelatorios();
            return;
        }
        else if (EstoqueModule.state.activeTab === 'lista-dia') {
            // Não faz nada, deixa o DailyListModule controlar a tela
            return;
        }
        else if (EstoqueModule.state.activeTab === 'recebidos') {
            if (typeof ReceivedItemsModule !== 'undefined') {
                ReceivedItemsModule.init();
            }
            return;
        }
        // --- RENDERIZAÇÃO DA ABA PRODUTOS (Padrão) ---

        let data = EstoqueModule.state.items || [];        

        if (EstoqueModule.state.filterSubtype) {
            data = data.filter(i => i.Subtipo === EstoqueModule.state.filterSubtype);
        }

        if (EstoqueModule.state.filterTerm) {
            const term = EstoqueModule.state.filterTerm.toLowerCase();
            data = data.filter(i => {
                const nome = i.Nome || i.Item || '';
                const codigo = i.Codigo || '';
                return nome.toLowerCase().includes(term) || codigo.toLowerCase().includes(term);
            });
        }

        // --- LÓGICA DE PAGINAÇÃO (CLIENT-SIDE) ---
        EstoqueModule.state.productPagination.total = data.length;
        const { page, limit } = EstoqueModule.state.productPagination;
        const totalPages = Math.ceil(data.length / limit) || 1;
        const paginatedData = data.slice((page - 1) * limit, page * limit);

        const totalValue = data.reduce((acc, item) => acc + (Number(item.Quantidade) * Number(item.CustoUnitario)), 0);
        const criticalItems = data.filter(i => Number(i.Quantidade) <= Number(i.Minimo)).length;
        const canCreate = Utils.checkPermission('Estoque', 'criar');
        const canEdit = Utils.checkPermission('Estoque', 'editar');
        const canDelete = Utils.checkPermission('Estoque', 'excluir');

        document.getElementById('estoque-content').innerHTML = `
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div class="bg-white p-4 rounded shadow border-l-4 border-blue-500">
                    <div class="text-gray-500 text-sm">Total de Itens</div>
                    <div class="text-2xl font-bold">${data.length}</div>
                </div>
                <div class="bg-white p-4 rounded shadow border-l-4 border-green-500">
                    <div class="text-gray-500 text-sm">Valor em Estoque</div>
                    <div class="text-2xl font-bold text-green-600">${Utils.formatCurrency(totalValue)}</div>
                </div>
                <div class="bg-white p-4 rounded shadow border-l-4 border-red-500">
                    <div class="text-gray-500 text-sm">Itens Críticos</div>
                    <div class="text-2xl font-bold text-red-600">${criticalItems}</div>
                </div>
            </div>

            <div class="flex flex-col md:flex-row justify-between items-center mb-4 gap-4">
                <h3 class="text-xl font-bold">Cadastro de Produtos</h3>
                <div class="flex flex-wrap gap-2">
                    <select onchange="EstoqueModule.updateSubtypeFilter(this.value)" class="border p-2 rounded text-sm">
                        <option value="">📂 Todos</option>
                        <option value="Frescos" ${EstoqueModule.state.filterSubtype === 'Frescos' ? 'selected' : ''}>🥦 Frescos</option>
                        <option value="Secos" ${EstoqueModule.state.filterSubtype === 'Secos' ? 'selected' : ''}>🌾 Secos</option>
                        <option value="Materiais" ${EstoqueModule.state.filterSubtype === 'Materiais' ? 'selected' : ''}>📦 Materiais</option>
                    </select>
                    <input type="text" placeholder="🔍 Buscar..." class="border p-2 rounded text-sm w-64" value="${EstoqueModule.state.filterTerm || ''}" oninput="EstoqueModule.updateFilter(this.value)">
                    <button onclick="EstoqueModule.exportPDF()" class="bg-gray-800 hover:bg-gray-900 text-white px-4 py-2 rounded shadow transition"><i class="fas fa-file-pdf"></i> PDF</button>
                    ${canCreate ? `<button onclick="EstoqueModule.modalEntrada()" class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded shadow transition"><i class="fas fa-arrow-down"></i> Entrada</button>
                    <button onclick="EstoqueModule.modalSaida()" class="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded shadow transition"><i class="fas fa-arrow-up"></i> Saída</button>
                    <button onclick="EstoqueModule.modalItem()" class="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded shadow transition">
                        <i class="fas fa-plus"></i> Novo Produto
                    </button>
                    <button onclick="EstoqueModule.modalReceberPedidos()" class="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded shadow transition">
                        <i class="fas fa-truck-loading"></i> Receber Pedidos
                    </button>` : ''}
                </div>
            </div>

            <div id="print-area-estoque" class="overflow-x-auto bg-white rounded shadow">
                <div id="pdf-header" class="hidden p-6 border-b"></div>
                <table class="w-full text-sm">
                    <thead class="bg-gray-100">
                        <tr>
                            <th class="p-3 text-left">Produto</th>
                            <th class="p-3 text-left">Tipo</th>
                            <th class="p-3 text-center">Local</th>
                            <th class="p-3 text-center">Qtd</th>
                            <th class="p-3 text-right">Custo Médio</th>
                            <th class="p-3 text-right">Total</th>
                            <th class="p-3 text-center">Validade</th>
                            <th class="p-3 text-center">Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${paginatedData.map(i => {
                            const qtd = Number(i.Quantidade);
                            const min = Number(i.Minimo);
                            const custo = Number(i.CustoUnitario);
                            const isLow = qtd <= min;
                            const total = qtd * custo;
                            const nome = i.Nome || i.Item || 'Produto sem nome'; // Compatibilidade com dados antigos
                            return `
                            <tr class="border-t hover:bg-gray-50 ${isLow ? 'bg-red-50' : ''}">
                                <td class="p-3 font-bold">
                                    ${nome} 
                                    <div class="text-xs text-gray-500">${i.Codigo || ''}</div>
                                </td>
                                <td class="p-3 text-xs">
                                    <span class="font-bold">${i.Tipo || '-'}</span><br>
                                    ${i.Subtipo || ''}
                                </td>
                                <td class="p-3 text-center text-xs">${i.Localizacao || '-'}</td>
                                <td class="p-3 text-center font-bold ${isLow ? 'text-red-600' : ''}">
                                    ${qtd} <span class="text-xs font-normal text-gray-500">${i.Unidade}</span>
                                </td>
                                <td class="p-3 text-right">${Utils.formatCurrency(custo)}</td>
                                <td class="p-3 text-right font-bold text-green-700">${Utils.formatCurrency(total)}</td>
                                <td class="p-3 text-center">${Utils.formatDate(i.Validade)}</td>
                                <td class="p-3 text-center">
                                    <button onclick="EstoqueModule.history('${i.ID}')" class="text-gray-500 hover:text-gray-700 mr-2" title="Histórico Completo"><i class="fas fa-history"></i></button>
                                    ${canEdit ? `<button onclick="EstoqueModule.modalItem('${i.ID}')" class="text-blue-500 hover:text-blue-700 mr-2"><i class="fas fa-edit"></i></button>` : ''}
                                    ${canDelete ? `<button onclick="EstoqueModule.delete('${i.ID}')" class="text-red-500 hover:text-red-700"><i class="fas fa-trash"></i></button>` : ''}
                                </td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
                <div id="pdf-footer" class="hidden p-4 border-t text-center text-xs text-gray-400"></div>
            </div>

            <!-- CONTROLES DE PAGINAÇÃO -->
            <div class="flex justify-between items-center mt-4 text-sm text-gray-600 bg-gray-50 p-3 rounded border">
                <span>Mostrando <b>${(page - 1) * limit + 1}</b> a <b>${Math.min(page * limit, data.length)}</b> de <b>${data.length}</b> produtos</span>
                <div class="flex gap-2 items-center">
                    <button onclick="EstoqueModule.changeProductPage(-1)" class="px-3 py-1 border rounded bg-white hover:bg-gray-100 disabled:opacity-50" ${page === 1 ? 'disabled' : ''}><i class="fas fa-chevron-left"></i> Anterior</button>
                    <span class="px-2 font-bold">Página ${page} de ${totalPages}</span>
                    <button onclick="EstoqueModule.changeProductPage(1)" class="px-3 py-1 border rounded bg-white hover:bg-gray-100 disabled:opacity-50" ${page >= totalPages ? 'disabled' : ''}>Próxima <i class="fas fa-chevron-right"></i></button>
                </div>
            </div>
        `;
    },

    renderDashboard: () => {
        const items = EstoqueModule.state.items || [];
        const movs = EstoqueModule.state.movimentacoes || [];
        
        // Cálculos
        const criticos = items.filter(i => Number(i.Quantidade) <= Number(i.Minimo));
        const vencendo = items.filter(i => {
            if(!i.Validade) return false;
            const val = new Date(i.Validade);
            const hoje = new Date();
            const diffTime = val - hoje;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
            return diffDays <= 30; // Vencendo em 30 dias ou já vencido
        });

        // Alerta Visual ao carregar Dashboard
        if (vencendo.length > 0) {
            Utils.toast(`⚠️ Atenção: ${vencendo.length} produtos com validade crítica ou vencidos!`, 'error');
        }

        // Consumo por Categoria (Saídas)
        const consumoMap = {};
        movs.filter(m => m.Tipo === 'Saida').forEach(m => {
            const prod = items.find(i => i.ID === m.ProdutoID);
            if(prod) {
                const cat = prod.Categoria || 'Outros';
                consumoMap[cat] = (consumoMap[cat] || 0) + Number(m.Quantidade);
            }
        });

        // Distribuição por Tipo
        const typeMap = {};
        items.forEach(i => {
            const t = i.Tipo || 'Outros';
            typeMap[t] = (typeMap[t] || 0) + 1;
        });

        const container = document.getElementById('estoque-content');
        container.innerHTML = `
            <!-- KPIs -->
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div class="bg-white p-4 rounded shadow border-l-4 border-blue-500">
                    <div class="text-gray-500 text-xs font-bold">Total em Estoque</div>
                    <div class="text-2xl font-bold">${items.length} Itens</div>
                </div>
                <div class="bg-white p-4 rounded shadow border-l-4 border-red-500">
                    <div class="text-gray-500 text-xs font-bold">Estoque Crítico</div>
                    <div class="text-2xl font-bold text-red-600">${criticos.length}</div>
                </div>
                <div class="bg-white p-4 rounded shadow border-l-4 border-yellow-500">
                    <div class="text-gray-500 text-xs font-bold">Vencendo (30d)</div>
                    <div class="text-2xl font-bold text-yellow-600">${vencendo.length}</div>
                </div>
                <div class="bg-white p-4 rounded shadow border-l-4 border-green-500">
                    <div class="text-gray-500 text-xs font-bold">Movimentações (Mês)</div>
                    <div class="text-2xl font-bold text-green-600">${movs.length}</div>
                </div>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6 items-start">
                <!-- Ações Rápidas -->
                <div class="bg-white p-6 rounded shadow">
                    <h4 class="font-bold text-gray-700 mb-4 border-b pb-2">Ações Rápidas</h4>
                    <div class="grid grid-cols-2 gap-3">
                        <button onclick="EstoqueModule.setTab('produtos')" class="bg-gray-50 text-gray-700 p-3 rounded hover:bg-gray-100 text-sm font-bold flex flex-col items-center gap-2">
                            <i class="fas fa-boxes text-xl"></i> Ver Produtos
                        </button>
                        <button onclick="EstoqueModule.setTab('fornecedores')" class="bg-gray-50 text-gray-700 p-3 rounded hover:bg-gray-100 text-sm font-bold flex flex-col items-center gap-2">
                            <i class="fas fa-industry text-xl"></i> Fornecedores
                        </button>
                    </div>
                </div>

                <!-- Gráfico de Distribuição -->
                <div class="bg-white p-6 rounded shadow">
                    <h4 class="font-bold text-gray-700 mb-4 border-b pb-2">Distribuição por Tipo</h4>
                    <div class="h-48"><canvas id="chartDistribuicao"></canvas></div>
                </div>

                <!-- Gráfico de Consumo -->
                <div class="bg-white p-6 rounded shadow">
                    <h4 class="font-bold text-gray-700 mb-4 border-b pb-2">Consumo por Categoria</h4>
                    <div class="h-48"><canvas id="chartConsumo"></canvas></div>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <!-- Alertas de Estoque Mínimo -->
                <div class="bg-white p-6 rounded shadow">
                    <h4 class="font-bold text-red-700 mb-4 border-b pb-2 flex justify-between">
                        <span>⚠️ Alertas de Reposição</span>
                        <span class="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">${criticos.length} itens</span>
                    </h4>
                    <div class="overflow-y-auto max-h-64">
                        <table class="w-full text-sm">
                            <thead class="bg-gray-50 text-xs text-gray-500"><tr><th class="p-2 text-left">Produto</th><th class="p-2 text-center">Atual</th><th class="p-2 text-center">Mínimo</th></tr></thead>
                            <tbody>
                                ${criticos.map(i => `
                                    <tr class="border-b">
                                        <td class="p-2 font-medium">${i.Nome}</td>
                                        <td class="p-2 text-center text-red-600 font-bold">${i.Quantidade}</td>
                                        <td class="p-2 text-center text-gray-500">${i.Minimo}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Validade e Lotes -->
                <div class="bg-white p-6 rounded shadow">
                    <h4 class="font-bold text-yellow-700 mb-4 border-b pb-2 flex justify-between">
                        <span>📅 Controle de Validade</span>
                        <span class="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">${vencendo.length} itens</span>
                    </h4>
                    <div class="overflow-y-auto max-h-64">
                        <table class="w-full text-sm">
                            <thead class="bg-gray-50 text-xs text-gray-500"><tr><th class="p-2 text-left">Produto</th><th class="p-2 text-center">Lote</th><th class="p-2 text-center">Validade</th></tr></thead>
                            <tbody>
                                ${vencendo.map(i => {
                                    const val = new Date(i.Validade);
                                    const hoje = new Date();
                                    const diffTime = val - hoje;
                                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                    const status = diffDays < 0 ? 'VENCIDO' : (diffDays === 0 ? 'HOJE' : `${diffDays} dias`);
                                    const colorClass = diffDays < 0 ? 'text-red-600' : 'text-yellow-600';
                                    return `
                                    <tr class="border-b">
                                        <td class="p-2 font-medium">${i.Nome}</td>
                                        <td class="p-2 text-center text-xs">${i.Lote || '-'}</td>
                                        <td class="p-2 text-center ${colorClass} font-bold">${Utils.formatDate(i.Validade)} <br> <span class="text-[10px] uppercase">${status}</span></td>
                                    </tr>
                                `}).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;

        // Render Chart
        if (EstoqueModule.state.charts.distribuicao) EstoqueModule.state.charts.distribuicao.destroy();
        EstoqueModule.state.charts.distribuicao = new Chart(document.getElementById('chartDistribuicao'), {
            type: 'doughnut',
            data: {
                labels: Object.keys(typeMap),
                datasets: [{ data: Object.values(typeMap), backgroundColor: ['#3B82F6', '#F59E0B', '#10B981', '#6366F1'] }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
        });

        if (EstoqueModule.state.charts.consumo) EstoqueModule.state.charts.consumo.destroy();
        EstoqueModule.state.charts.consumo = new Chart(document.getElementById('chartConsumo'), {
            type: 'bar',
            data: {
                labels: Object.keys(consumoMap),
                datasets: [{
                    label: 'Qtd Consumida',
                    data: Object.values(consumoMap),
                    backgroundColor: '#6366F1',
                    borderRadius: 4
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
        });
    },

    history: async (id) => {
        const item = EstoqueModule.state.items.find(i => i.ID === id);
        if(!item) return;

        Utils.openModal(`Histórico: ${item.Nome}`, '<div class="text-center p-8"><i class="fas fa-spinner fa-spin text-3xl text-blue-600"></i><p class="mt-2">Carregando histórico...</p></div>');

        try {
            const { movs, logs } = await Utils.api('getProductHistory', null, { id });
            
            let html = `
                <div class="flex gap-4 mb-4 border-b">
                    <button onclick="document.getElementById('tab-movs').classList.remove('hidden');document.getElementById('tab-logs').classList.add('hidden');this.classList.add('border-b-2','border-blue-500','font-bold','text-blue-600');this.nextElementSibling.classList.remove('border-b-2','border-blue-500','font-bold','text-blue-600');" class="px-4 py-2 border-b-2 border-blue-500 font-bold text-blue-600 transition">Movimentações</button>
                    <button onclick="document.getElementById('tab-logs').classList.remove('hidden');document.getElementById('tab-movs').classList.add('hidden');this.classList.add('border-b-2','border-blue-500','font-bold','text-blue-600');this.previousElementSibling.classList.remove('border-b-2','border-blue-500','font-bold','text-blue-600');" class="px-4 py-2 text-gray-500 hover:text-gray-700 transition">Auditoria (Edições)</button>
                </div>

                <div id="tab-movs" class="max-h-96 overflow-y-auto custom-scrollbar">
                    <table class="w-full text-sm text-left">
                        <thead class="bg-gray-100 sticky top-0"><tr><th class="p-2">Data</th><th class="p-2">Tipo</th><th class="p-2 text-center">Qtd</th><th class="p-2">Responsável</th><th class="p-2">Obs</th></tr></thead>
                        <tbody>
                            ${movs.map(m => `
                                <tr class="border-b hover:bg-gray-50">
                                    <td class="p-2 text-xs text-gray-500">${new Date(m.Data).toLocaleString()}</td>
                                    <td class="p-2"><span class="px-2 py-1 rounded text-xs font-bold ${m.Tipo === 'Entrada' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">${m.Tipo}</span></td>
                                    <td class="p-2 text-center font-bold">${m.Quantidade}</td>
                                    <td class="p-2 text-xs font-medium">${m.Responsavel || '-'}</td>
                                    <td class="p-2 text-xs text-gray-400 italic">${m.Observacoes || '-'}</td>
                                </tr>
                            `).join('')}
                            ${movs.length === 0 ? '<tr><td colspan="5" class="p-6 text-center text-gray-400">Nenhuma movimentação recente.</td></tr>' : ''}
                        </tbody>
                    </table>
                </div>

                <div id="tab-logs" class="hidden max-h-96 overflow-y-auto custom-scrollbar">
                    <table class="w-full text-sm text-left">
                        <thead class="bg-gray-100 sticky top-0"><tr><th class="p-2">Data</th><th class="p-2">Usuário (Sistema)</th><th class="p-2">Ação</th><th class="p-2">Detalhes</th></tr></thead>
                        <tbody>
                            ${logs.map(l => `
                                <tr class="border-b hover:bg-gray-50">
                                    <td class="p-2 text-xs text-gray-500">${new Date(l.CriadoEm).toLocaleString()}</td>
                                    <td class="p-2 text-xs font-bold text-blue-600">${l.UsuarioNome || 'Sistema'}</td>
                                    <td class="p-2 text-xs font-bold">${l.Acao}</td>
                                    <td class="p-2 text-xs text-gray-500">${l.Descricao}</td>
                                </tr>
                            `).join('')}
                            ${logs.length === 0 ? '<tr><td colspan="4" class="p-6 text-center text-gray-400">Nenhum registro de auditoria encontrado.</td></tr>' : ''}
                        </tbody>
                    </table>
                </div>
            `;
            
            Utils.openModal(`Histórico: ${item.Nome}`, html);
        } catch(e) {
            Utils.toast('Erro ao carregar histórico: ' + e.message, 'error');
        }
    },

    renderMovimentacoes: () => {
        let movs = EstoqueModule.state.movimentacoes || [];
        const stats = EstoqueModule.state.movStats || [];
        const items = EstoqueModule.state.items || [];
        
        // Obter Subtipos únicos para o filtro
        const subtipos = [...new Set(items.map(i => i.Subtipo).filter(Boolean))].sort();

        // Dados para o Gráfico (Usando stats leve, não a lista paginada)
        const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        const movMap = {};
        
        stats.forEach(m => {
            const d = new Date(m.Data);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            if (!movMap[key]) movMap[key] = { entrada: 0, saida: 0 };
            
            if (m.Tipo === 'Entrada') movMap[key].entrada += Number(m.Quantidade);
            else if (m.Tipo === 'Saida') movMap[key].saida += Number(m.Quantidade);
        });

        const sortedKeys = Object.keys(movMap).sort().slice(-6); // Últimos 6 meses com dados
        const labels = sortedKeys.map(k => months[parseInt(k.split('-')[1]) - 1]);
        const dataEntrada = sortedKeys.map(k => movMap[k].entrada);
        const dataSaida = sortedKeys.map(k => movMap[k].saida);

        document.getElementById('estoque-content').innerHTML = `
            <div class="bg-white p-4 rounded-lg shadow-sm mb-6 border border-gray-100">
                <div class="flex flex-col md:flex-row justify-between items-center gap-4">
                    <div>
                        <h3 class="text-xl font-bold text-gray-800 flex items-center gap-2">
                            <i class="fas fa-history text-yellow-500"></i> Histórico de Movimentações
                        </h3>
                        <p class="text-xs text-gray-500 mt-1">Visualize e filtre as entradas e saídas de estoque.</p>
                    </div>
                    
                    <div class="flex gap-3 items-center w-full md:w-auto">
                        <input type="text" placeholder="🔍 Buscar produto..." class="border p-2 rounded-lg text-sm w-48" value="${EstoqueModule.state.filterMovTerm || ''}" oninput="EstoqueModule.updateMovFilter(this.value)">
                        <div class="relative w-full md:w-64">
                            <select onchange="EstoqueModule.setMovFilter(this.value)" class="w-full appearance-none bg-gray-50 border border-gray-200 text-gray-700 py-2 px-4 pr-8 rounded-lg leading-tight focus:outline-none focus:bg-white focus:border-yellow-500 transition-all cursor-pointer shadow-sm hover:bg-gray-100">
                                <option value="">📂 Todos os Subtipos</option>
                                ${subtipos.map(s => `<option value="${s}" ${EstoqueModule.state.filterMovSubtipo === s ? 'selected' : ''}>🔹 ${s}</option>`).join('')}
                            </select>
                            <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                                <i class="fas fa-chevron-down text-xs"></i>
                            </div>
                        </div>
                        
                        <button onclick="EstoqueModule.exportMovimentacoesPDF()" class="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg shadow transition-all flex items-center gap-2 whitespace-nowrap transform hover:scale-105 active:scale-95">
                            <i class="fas fa-file-pdf"></i> <span class="hidden md:inline">Exportar PDF</span>
                        </button>
                        <button onclick="EstoqueModule.exportEntradasMesPDF()" class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg shadow transition-all flex items-center gap-2 whitespace-nowrap transform hover:scale-105 active:scale-95">
                            <i class="fas fa-file-invoice"></i> <span class="hidden md:inline">Entradas do Mês</span>
                        </button>
                    </div>
                </div>
            </div>

            <div class="bg-white p-6 rounded-lg shadow mb-6 border border-gray-100">
                <h4 class="font-bold text-gray-700 mb-4 border-b pb-2">Volume de Movimentações (Últimos Meses)</h4>
                <div class="h-64"><canvas id="chartMovimentacoes"></canvas></div>
            </div>

            <div id="print-area-movimentacoes" class="overflow-x-auto bg-white rounded-lg shadow border border-gray-100">
                <div id="pdf-header-mov" class="hidden p-6 border-b"></div>
                <table class="w-full text-sm text-left">
                    <thead class="bg-gray-50 text-gray-600 uppercase text-xs tracking-wider">
                        <tr>
                            <th class="p-4 font-semibold">Data</th>
                            <th class="p-4 font-semibold">Tipo</th>
                            <th class="p-4 font-semibold">Produto</th>
                            <th class="p-4 font-semibold">Subtipo</th>
                            <th class="p-4 text-center font-semibold">Qtd</th>
                            <th class="p-4 text-right font-semibold">Valor Total</th>
                            <th class="p-4 font-semibold">Responsável</th>
                            <th class="p-4 font-semibold">Obs</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100">
                        ${movs.map(m => {
                            // Usa dados do JOIN se disponível, ou fallback para items locais
                            const prodNome = m.Estoque ? m.Estoque.Nome : (EstoqueModule.state.items.find(i => i.ID === m.ProdutoID)?.Nome || 'Item Excluído');
                            const prodSubtipo = m.Estoque ? m.Estoque.Subtipo : '-';
                            const custo = m.Estoque ? Number(m.Estoque.CustoUnitario || 0) : 0;
                            const totalMov = Number(m.Quantidade) * custo;
                            
                            const color = m.Tipo === 'Entrada' ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50';
                            const tipoIcon = m.Tipo === 'Entrada' ? 'fa-arrow-down' : 'fa-arrow-up';
                            
                            return `<tr class="hover:bg-yellow-50 transition-colors duration-150">
                                <td class="p-4 whitespace-nowrap text-gray-500">${new Date(m.Data).toLocaleString()}</td>
                                <td class="p-4">
                                    <span class="px-2 py-1 rounded-full text-xs font-bold ${color} inline-flex items-center gap-1">
                                        <i class="fas ${tipoIcon}"></i> ${m.Tipo}
                                    </span>
                                </td>
                                <td class="p-4 font-medium text-gray-800">${prodNome}</td>
                                <td class="p-4 text-xs text-gray-500">
                                    <span class="bg-gray-100 px-2 py-1 rounded border border-gray-200">${prodSubtipo}</span>
                                </td>
                                <td class="p-4 text-center font-bold text-gray-700">${m.Quantidade}</td>
                                <td class="p-4 text-right font-bold text-gray-700">${Utils.formatCurrency(totalMov)}</td>
                                <td class="p-4 text-sm text-gray-600">${m.Responsavel || '-'}</td>
                                <td class="p-4 text-xs text-gray-400 italic max-w-xs truncate" title="${m.Observacoes || ''}">${m.Observacoes || '-'}</td>
                            </tr>`;
                        }).join('')}
                        ${movs.length === 0 ? '<tr><td colspan="8" class="p-10 text-center text-gray-400 flex flex-col items-center"><i class="fas fa-search text-3xl mb-2 text-gray-300"></i>Nenhuma movimentação encontrada para este filtro.</td></tr>' : ''}
                    </tbody>
                </table>
                <div id="pdf-footer-mov" class="hidden p-4 border-t text-center text-xs text-gray-400"></div>
            </div>
            
            <!-- Paginação -->
            <div class="flex justify-between items-center mt-4 text-sm text-gray-600">
                <span>Total: ${EstoqueModule.state.pagination.total} registros</span>
                <div class="flex gap-2">
                    <button onclick="EstoqueModule.changePage(-1)" class="px-3 py-1 border rounded hover:bg-gray-100" ${EstoqueModule.state.pagination.page === 1 ? 'disabled' : ''}>Anterior</button>
                    <span class="px-3 py-1">Página ${EstoqueModule.state.pagination.page}</span>
                    <button onclick="EstoqueModule.changePage(1)" class="px-3 py-1 border rounded hover:bg-gray-100" 
                        ${(EstoqueModule.state.pagination.page * EstoqueModule.state.pagination.limit) >= EstoqueModule.state.pagination.total ? 'disabled' : ''}>Próxima</button>
                </div>
            </div>
        `;

        // Renderizar Gráfico
        if (EstoqueModule.state.charts.movimentacoes) EstoqueModule.state.charts.movimentacoes.destroy();

        EstoqueModule.state.charts.movimentacoes = new Chart(document.getElementById('chartMovimentacoes'), {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    { label: 'Entradas', data: dataEntrada, backgroundColor: '#10B981', borderRadius: 4 },
                    { label: 'Saídas', data: dataSaida, backgroundColor: '#EF4444', borderRadius: 4 }
                ]
            },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
        });
    },

    changePage: (offset) => {
        EstoqueModule.state.pagination.page += offset;
        EstoqueModule.fetchMovimentacoes().then(EstoqueModule.renderMovimentacoes);
    },

    changeProductPage: (offset) => {
        const { page, limit, total } = EstoqueModule.state.productPagination;
        const newPage = page + offset;
        const totalPages = Math.ceil(total / limit);
        
        if (newPage > 0 && newPage <= totalPages) {
            EstoqueModule.state.productPagination.page = newPage;
            EstoqueModule.render();
        }
    },

    modalItem: (id = null) => {
        const item = id ? EstoqueModule.state.items.find(i => i.ID === id) : {};
        const fornecedores = EstoqueModule.state.fornecedores || [];
        
        // Função para atualizar subtipos dinamicamente
        window.updateSubtypes = (select) => {
            const type = select.value;
            const subSelect = document.getElementById('subtipo-select');
            const catSelect = document.getElementById('categoria-select');
            
            subSelect.innerHTML = '<option value="">Selecione...</option>';
            catSelect.innerHTML = '<option value="">Selecione...</option>';
            
            if (EstoqueModule.taxonomy[type]) {
                Object.keys(EstoqueModule.taxonomy[type]).forEach(sub => {
                    subSelect.innerHTML += `<option value="${sub}">${sub}</option>`;
                });
            }
        };

        window.updateCategories = (select) => {
            const type = document.getElementById('tipo-select').value;
            const sub = select.value;
            const catSelect = document.getElementById('categoria-select');
            
            catSelect.innerHTML = '<option value="">Selecione...</option>';
            
            if (EstoqueModule.taxonomy[type] && EstoqueModule.taxonomy[type][sub]) {
                EstoqueModule.taxonomy[type][sub].forEach(cat => {
                    catSelect.innerHTML += `<option value="${cat}">${cat}</option>`;
                });
            }
        };

        // Pré-carregar opções de Subtipo e Categoria se for edição
        let subOptions = '<option value="">Selecione...</option>';
        let catOptions = '<option value="">Selecione...</option>';

        if (item.Tipo && EstoqueModule.taxonomy[item.Tipo]) {
            Object.keys(EstoqueModule.taxonomy[item.Tipo]).forEach(sub => {
                subOptions += `<option value="${sub}" ${item.Subtipo === sub ? 'selected' : ''}>${sub}</option>`;
            });
        }

        if (item.Tipo && item.Subtipo && EstoqueModule.taxonomy[item.Tipo][item.Subtipo]) {
            EstoqueModule.taxonomy[item.Tipo][item.Subtipo].forEach(cat => {
                catOptions += `<option value="${cat}" ${item.Categoria === cat ? 'selected' : ''}>${cat}</option>`;
            });
        }

        Utils.openModal(id ? 'Editar Produto' : 'Cadastro de Produto', `
            <form onsubmit="EstoqueModule.save(event)">
                <input type="hidden" name="ID" value="${item.ID || ''}">
                <h4 class="font-bold text-gray-700 mb-2 border-b">1. Identificação & Classificação</h4>
                <div class="grid grid-cols-2 gap-3 mb-3">
                    <div><label class="text-xs font-bold">Código</label><input name="Codigo" value="${item.Codigo || ''}" placeholder="Ex: AL-001" class="border p-2 rounded w-full"></div>
                    <div><label class="text-xs font-bold">Nome do Produto</label><input name="Nome" value="${item.Nome || ''}" class="border p-2 rounded w-full" required></div>
                </div>
                <div class="grid grid-cols-3 gap-3 mb-3">
                    <div><label class="text-xs font-bold">Tipo</label><select id="tipo-select" name="Tipo" class="border p-2 rounded w-full" onchange="updateSubtypes(this)" required><option value="">Selecione...</option><option ${item.Tipo === 'Alimentos' ? 'selected' : ''}>Alimentos</option><option ${item.Tipo === 'Bebidas' ? 'selected' : ''}>Bebidas</option><option ${item.Tipo === 'Insumos' ? 'selected' : ''}>Insumos</option></select></div>
                    <div><label class="text-xs font-bold">Subtipo</label><select id="subtipo-select" name="Subtipo" class="border p-2 rounded w-full" onchange="updateCategories(this)">${subOptions}</select></div>
                    <div><label class="text-xs font-bold">Categoria</label><select id="categoria-select" name="Categoria" class="border p-2 rounded w-full">${catOptions}</select></div>
                </div>

                <h4 class="font-bold text-gray-700 mb-2 border-b mt-4">2. Controle de Estoque</h4>
                <div class="grid grid-cols-3 gap-3 mb-3">
                    <div><label class="text-xs font-bold">Localização</label><select name="Localizacao" class="border p-2 rounded w-full"><option ${item.Localizacao === 'Arca' ? 'selected' : ''}>Arca</option><option ${item.Localizacao === 'Câmara Fria' ? 'selected' : ''}>Câmara Fria</option><option ${item.Localizacao === 'Prateleira' ? 'selected' : ''}>Prateleira</option><option ${item.Localizacao === 'Despensa' ? 'selected' : ''}>Despensa</option><option ${item.Localizacao === 'Armazém' ? 'selected' : ''}>Armazém</option></select></div>
                    <div><label class="text-xs font-bold">Lote</label><input name="Lote" value="${item.Lote || ''}" class="border p-2 rounded w-full"></div>
                    <div><label class="text-xs font-bold">Validade</label><input type="date" name="Validade" value="${item.Validade ? item.Validade.split('T')[0] : ''}" class="border p-2 rounded w-full"></div>
                </div>
                <div class="grid grid-cols-3 gap-3 mb-3">
                    <div><label class="text-xs font-bold">Qtd Atual</label><input type="number" step="0.01" name="Quantidade" value="${item.Quantidade || ''}" class="border p-2 rounded w-full" required></div>
                    <div><label class="text-xs font-bold">Unidade</label><select name="Unidade" class="border p-2 rounded w-full"><option ${item.Unidade === 'Kg' ? 'selected' : ''}>Kg</option><option ${item.Unidade === 'L' ? 'selected' : ''}>L</option><option ${item.Unidade === 'Un' ? 'selected' : ''}>Un</option><option ${item.Unidade === 'Cx' ? 'selected' : ''}>Cx</option><option ${item.Unidade === 'Lata' ? 'selected' : ''}>Lata</option></select></div>
                    <div><label class="text-xs font-bold">Estoque Mínimo</label><input type="number" step="0.01" name="Minimo" value="${item.Minimo || ''}" class="border p-2 rounded w-full"></div>
                </div>

                <h4 class="font-bold text-gray-700 mb-2 border-b mt-4">3. Custos & Fornecedor</h4>
                <div class="grid grid-cols-2 gap-3 mb-3">
                    <div><label class="text-xs font-bold">Custo Unitário (Kz)</label><input type="number" step="0.01" name="CustoUnitario" value="${item.CustoUnitario || ''}" class="border p-2 rounded w-full"></div>
                    <div>
                        <label class="text-xs font-bold">Fornecedor Preferencial</label>
                        <select name="Fornecedor" class="border p-2 rounded w-full">
                            <option value="">Selecione...</option>
                            ${fornecedores.map(f => `<option value="${f.Nome}" ${item.Fornecedor === f.Nome ? 'selected' : ''}>${f.Nome}</option>`).join('')}
                        </select>
                    </div>
                </div>
                
                <button class="w-full bg-yellow-500 text-white py-3 rounded font-bold mt-2">Salvar Produto</button>
            </form>
        `);
    },

    modalEntrada: () => {
        const prods = EstoqueModule.state.items;
        Utils.openModal('Registrar Entrada (Compra)', `
            <form onsubmit="EstoqueModule.saveMovimentacao(event, 'Entrada')">
                <div class="mb-3">
                    <label class="text-xs font-bold">Produto</label>
                    <select name="produtoId" class="border p-2 rounded w-full" required>
                        <option value="">Selecione...</option>
                        ${prods.map(p => `<option value="${p.ID}">${p.Nome} (${p.Unidade})</option>`).join('')}
                    </select>
                </div>
                <div class="grid grid-cols-2 gap-3 mb-3">
                    <div><label class="text-xs font-bold">Quantidade Comprada</label><input type="number" step="0.01" name="quantidade" class="border p-2 rounded w-full" required></div>
                    <div><label class="text-xs font-bold">Preço Unitário (Novo)</label><input type="number" step="0.01" name="custo" class="border p-2 rounded w-full"></div>
                </div>
                <div class="mb-3"><label class="text-xs font-bold">Fornecedor / Mercado</label><input name="detalhes[fornecedor]" class="border p-2 rounded w-full"></div>
                <div class="mb-3"><label class="text-xs font-bold">Responsável (Recebimento)</label><input name="responsavel" class="border p-2 rounded w-full" required></div>
                <button class="w-full bg-green-600 text-white py-3 rounded font-bold">Confirmar Entrada</button>
            </form>
        `);
    },

    modalSaida: () => {
        const prods = EstoqueModule.state.items;
        Utils.openModal('Registrar Saída (Consumo)', `
            <form onsubmit="EstoqueModule.saveMovimentacao(event, 'Saida')">
                <div class="mb-3">
                    <label class="text-xs font-bold">Produto</label>
                    <select name="produtoId" class="border p-2 rounded w-full" required>
                        <option value="">Selecione...</option>
                        ${prods.map(p => `<option value="${p.ID}">${p.Nome} (Atual: ${p.Quantidade} ${p.Unidade})</option>`).join('')}
                    </select>
                </div>
                <div class="grid grid-cols-2 gap-3 mb-3">
                    <div><label class="text-xs font-bold">Quantidade Retirada</label><input type="number" step="0.01" name="quantidade" class="border p-2 rounded w-full" required></div>
                    <div><label class="text-xs font-bold">Finalidade</label>
                        <select name="detalhes[finalidade]" class="border p-2 rounded w-full">
                            <option>Cozinha</option><option>Bar</option><option>Venda</option><option>Evento</option><option>Quebra/Perda</option>
                        </select>
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-3 mb-3">
                    <div><label class="text-xs font-bold">Solicitado por</label><input name="detalhes[solicitante]" class="border p-2 rounded w-full"></div>
                    <div><label class="text-xs font-bold">Responsável Retirada</label><input name="responsavel" class="border p-2 rounded w-full" required></div>
                </div>
                <div class="mb-3"><label class="text-xs font-bold">Observações</label><textarea name="observacoes" class="border p-2 rounded w-full"></textarea></div>
                <button class="w-full bg-red-600 text-white py-3 rounded font-bold">Confirmar Saída</button>
            </form>
        `);
    },

    modalReceberPedidos: async (filter = 'Pendente') => {
        try {
            const pedidos = await Utils.api('getAll', 'PedidosCompra');
            const filtrados = pedidos.filter(p => p.Status === filter).sort((a,b) => new Date(b.CriadoEm) - new Date(a.CriadoEm));

            let html = `
                <div class="flex border-b mb-4">
                    <button onclick="EstoqueModule.modalReceberPedidos('Pendente')" class="flex-1 py-2 text-sm font-bold ${filter === 'Pendente' ? 'text-purple-600 border-b-2 border-purple-600' : 'text-gray-500 hover:text-gray-700'}">Pendentes</button>
                    <button onclick="EstoqueModule.modalReceberPedidos('Concluído')" class="flex-1 py-2 text-sm font-bold ${filter === 'Concluído' ? 'text-purple-600 border-b-2 border-purple-600' : 'text-gray-500 hover:text-gray-700'}">Histórico</button>
                </div>
            `;

            if (filtrados.length === 0) {
                html += `<div class="text-center py-8 text-gray-500">Nenhum pedido ${filter === 'Pendente' ? 'pendente' : 'no histórico'}.</div>`;
            } else {
                html += `<div class="space-y-3 max-h-96 overflow-y-auto">
                    ${filtrados.map(p => `
                        <div class="border p-3 rounded flex justify-between items-center bg-gray-50">
                            <div>
                                <div class="font-bold text-gray-800">Pedido #${p.Codigo || p.ID.slice(0,4)}</div>
                                <div class="text-xs text-gray-500">${Utils.formatDate(p.CriadoEm)} - ${p.Solicitante}</div>
                                ${filter === 'Concluído' ? `<div class="text-xs text-green-600 font-bold mt-1">Recebido</div>` : ''}
                            </div>
                            ${filter === 'Pendente' ? `
                            <button onclick="EstoqueModule.modalConferirPedido('${p.ID}')" class="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 shadow"><i class="fas fa-clipboard-check"></i> Conferir</button>` : `
                            <button onclick="EstoqueModule.verDetalhesPedido('${p.ID}')" class="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 shadow"><i class="fas fa-eye"></i> Ver Itens</button>`}
                        </div>
                    `).join('')}
                </div>`;
            }
            
            Utils.openModal('Gestão de Pedidos de Compra', html);
        } catch (e) { Utils.toast('Erro ao buscar pedidos.', 'error'); }
    },

    modalConferirPedido: async (id) => {
        try {
            const items = await Utils.api('getPurchaseOrderDetails', null, { id });
            
            const html = `
                <div class="mb-4 text-sm text-gray-600 bg-blue-50 p-3 rounded border border-blue-100">
                    <i class="fas fa-info-circle mr-1"></i> Confira as quantidades abaixo. Se recebeu menos do que o pedido, ajuste o valor na coluna "Qtd Recebida".
                </div>
                <form onsubmit="EstoqueModule.processarRecebimento(event, '${id}')">
                    <div class="max-h-96 overflow-y-auto border rounded mb-4">
                        <table class="w-full text-sm text-left">
                            <thead class="bg-gray-100 sticky top-0">
                                <tr>
                                    <th class="p-2">Produto</th>
                                    <th class="p-2 text-center w-24">Solicitado</th>
                                    <th class="p-2 text-center w-24">Recebido</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${items.map(i => `
                                    <tr class="border-b hover:bg-gray-50">
                                        <td class="p-2">
                                            <div class="font-bold text-gray-800">${i.ProdutoNome}</div>
                                            <div class="text-xs text-gray-500">${i.Observacao || ''}</div>
                                        </td>
                                        <td class="p-2 text-center text-gray-500">${i.Quantidade}</td>
                                        <td class="p-2 text-center">
                                            <input type="number" step="0.01" name="qtd_${i.ID}" value="${i.Quantidade}" class="border p-1 rounded w-20 text-center font-bold text-blue-600 focus:ring-2 focus:ring-blue-500 outline-none" min="0" required>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                    <div class="flex justify-end gap-2 pt-2 border-t">
                        <button type="button" onclick="EstoqueModule.printOrder('${id}')" class="px-4 py-2 bg-indigo-100 text-indigo-700 hover:bg-indigo-200 rounded transition font-bold"><i class="fas fa-print mr-1"></i> Imprimir</button>
                        <button type="button" onclick="EstoqueModule.modalReceberPedidos()" class="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded transition">Voltar</button>
                        <button class="bg-green-600 text-white px-4 py-2 rounded font-bold hover:bg-green-700 shadow transition"><i class="fas fa-check mr-1"></i> Confirmar Entrada</button>
                    </div>
                </form>
            `;
            Utils.openModal('Conferência de Recebimento', html);
        } catch (e) { Utils.toast('Erro ao carregar itens.', 'error'); }
    },

    processarRecebimento: async (e, id) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const items = [];
        
        for (const [key, value] of formData.entries()) {
            if (key.startsWith('qtd_')) {
                items.push({
                    id: key.replace('qtd_', ''),
                    qtd: parseFloat(value)
                });
            }
        }

        if(!confirm('Confirmar a entrada destes itens no estoque?')) return;

        try {
            await Utils.api('receivePurchaseOrder', null, { id, items });
            Utils.toast('✅ Estoque atualizado com sucesso!', 'success');
            Utils.closeModal();
            EstoqueModule.fetchData(); // Atualiza a tela
        } catch (e) { Utils.toast('Erro: ' + e.message, 'error'); }
    },

    verDetalhesPedido: async (id) => {
        try {
            const items = await Utils.api('getPurchaseOrderDetails', null, { id });
            
            const html = `
                <div class="max-h-96 overflow-y-auto border rounded mb-4">
                    <table class="w-full text-sm text-left">
                        <thead class="bg-gray-100 sticky top-0">
                            <tr><th class="p-2">Produto</th><th class="p-2 text-center">Qtd</th><th class="p-2 text-right">Custo Unit.</th></tr>
                        </thead>
                        <tbody>
                            ${items.map(i => `
                                <tr class="border-b hover:bg-gray-50">
                                    <td class="p-2"><div class="font-bold text-gray-800">${i.ProdutoNome}</div><div class="text-xs text-gray-500">${i.Observacao || ''}</div></td>
                                    <td class="p-2 text-center font-bold">${i.Quantidade}</td>
                                    <td class="p-2 text-right">${Utils.formatCurrency(i.CustoUnitario)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                <div class="flex justify-end gap-2">
                    <button onclick="EstoqueModule.printOrder('${id}')" class="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-sm font-bold shadow"><i class="fas fa-print mr-1"></i> Imprimir Requisição</button>
                    <button onclick="EstoqueModule.modalReceberPedidos('Concluído')" class="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 text-sm font-bold text-gray-700">Voltar</button>
                </div>
            `;
            Utils.openModal('Detalhes do Pedido Recebido', html);
        } catch (e) { Utils.toast('Erro ao carregar detalhes.', 'error'); }
    },

    printOrder: async (id) => {
        try {
            const orders = await Utils.api('getAll', 'PedidosCompra');
            const order = orders.find(o => o.ID === id);
            const items = await Utils.api('getPurchaseOrderDetails', null, { id });
            
            if (!order) return Utils.toast('Pedido não encontrado.', 'error');

            const inst = EstoqueModule.state.instituicao[0] || {};
            const showLogo = inst.ExibirLogoRelatorios;

            const html = `
                <div class="p-8 font-sans text-gray-900 bg-white border-2 border-gray-800 max-w-2xl mx-auto">
                    <div class="flex justify-between items-center border-b-2 border-gray-800 pb-4 mb-6">
                        <div class="${showLogo && inst.LogotipoURL ? 'flex items-center gap-4' : ''}">
                            ${showLogo && inst.LogotipoURL ? `<img src="${inst.LogotipoURL}" class="h-16 w-auto object-contain" crossorigin="anonymous">` : ''}
                            <div>
                                <h1 class="text-xl font-bold uppercase">${inst.NomeFantasia || 'Delícia da Cidade'}</h1>
                                <p class="text-sm">REQUISIÇÃO DE ESTOQUE / PEDIDO</p>
                            </div>
                        </div>
                        <div class="text-right">
                            <h2 class="text-xl font-bold">PEDIDO #${order.Codigo || order.ID.slice(0,4)}</h2>
                            <p class="text-sm font-bold ${order.Status === 'Concluído' ? 'text-green-700' : 'text-gray-500'}">${order.Status.toUpperCase()}</p>
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-6 mb-6 bg-gray-50 p-4 rounded border">
                        <div><span class="font-bold block text-xs text-gray-500 uppercase">Solicitante</span> ${order.Solicitante || '-'}</div>
                        <div><span class="font-bold block text-xs text-gray-500 uppercase">Data</span> ${Utils.formatDate(order.CriadoEm)}</div>
                    </div>

                    <table class="w-full text-sm mb-6 border-collapse border border-gray-300">
                        <thead class="bg-gray-100">
                            <tr>
                                <th class="border p-2 text-left">Produto</th>
                                <th class="border p-2 text-center">Qtd</th>
                                <th class="border p-2 text-left">Obs</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${items.map(i => `
                                <tr>
                                    <td class="border p-2 font-bold">${i.ProdutoNome}</td>
                                    <td class="border p-2 text-center">${i.Quantidade}</td>
                                    <td class="border p-2 text-xs text-gray-500">${i.Observacao || '-'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>

                    <div class="mt-12 border-t border-gray-800 pt-2 flex justify-between text-xs text-gray-500">
                        <div class="text-center w-1/3">
                            <br>__________________________<br>
                            Assinatura do Solicitante
                        </div>
                        <div class="text-center w-1/3">
                            <br>__________________________<br>
                            Visto do Estoque (Liberação)
                        </div>
                    </div>
                </div>
            `;
            Utils.printNative(html);

        } catch (e) {
            console.error(e);
            Utils.toast('Erro ao imprimir pedido.', 'error');
        }
    },

    save: async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target).entries());
        
        // Validações de Regra de Negócio
        if (!data.Nome.trim()) return Utils.toast('O nome do produto é obrigatório.', 'error');
        if (Number(data.Quantidade) < 0) return Utils.toast('A quantidade não pode ser negativa.', 'error');
        if (Number(data.CustoUnitario) < 0) return Utils.toast('O custo unitário não pode ser negativo.', 'error');
        if (Number(data.Minimo) < 0) return Utils.toast('O estoque mínimo não pode ser negativo.', 'error');

        try {
            await Utils.api('save', 'Estoque', data);
            Utils.toast('Item salvo!', 'success');
            Utils.closeModal();
            EstoqueModule.fetchData();
        } catch (err) {
            Utils.toast('Erro ao salvar: ' + err.message, 'error');
        }
    },

    saveMovimentacao: async (e, tipo) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData.entries());
        
        // Estruturar dados complexos (detalhes)
        data.tipo = tipo;
        data.detalhes = {};
        for (const [key, value] of formData.entries()) {
            if (key.startsWith('detalhes[')) {
                const realKey = key.match(/\[(.*?)\]/)[1];
                data.detalhes[realKey] = value;
            }
        }

        try {
            await Utils.api('registerStockMovement', null, data);
            Utils.toast('Movimentação registrada!', 'success'); 
            Utils.closeModal(); 
            EstoqueModule.fetchData();
            EstoqueModule.fetchMovimentacoes();
        } catch (err) { Utils.toast('Erro: ' + err.message, 'error'); }
    },

    delete: async (id) => {
        if(!confirm('Apagar este item?')) return;
        try {
            await Utils.api('delete', 'Estoque', null, id);
            EstoqueModule.fetchData();
        } catch (e) { Utils.toast('Erro ao apagar', 'error'); }
    },

    updateFilter: (term) => {
        EstoqueModule.state.filterTerm = term;
        EstoqueModule.state.productPagination.page = 1; // Reseta para a primeira página ao buscar
        EstoqueModule.render();
    },

    updateSubtypeFilter: (val) => {
        EstoqueModule.state.filterSubtype = val;
        EstoqueModule.state.productPagination.page = 1;
        EstoqueModule.render();
    },

    // --- FUNÇÃO DE IMPRESSÃO NATIVA (SUBSTITUI HTML2PDF) ---
    printNative: (htmlContent) => {
        let iframe = document.getElementById('print-iframe');
        if (!iframe) {
            iframe = document.createElement('iframe');
            iframe.id = 'print-iframe';
            iframe.style.position = 'fixed';
            iframe.style.right = '0';
            iframe.style.bottom = '0';
            iframe.style.width = '0';
            iframe.style.height = '0';
            iframe.style.border = '0';
            document.body.appendChild(iframe);
        }
        
        const doc = iframe.contentWindow.document;
        doc.open();
        doc.write(`
            <html>
            <head>
                <title>Imprimir Relatório</title>
                <script src="https://cdn.tailwindcss.com"></script>
                <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
                <style>
                    body { background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; font-family: sans-serif; }
                    @page { margin: 10mm; size: auto; }
                    table { width: 100%; border-collapse: collapse; }
                    th, td { border: 1px solid #e5e7eb; padding: 6px; text-align: left; font-size: 10px; }
                    th { background-color: #f3f4f6; font-weight: bold; }
                    /* Ocultar coluna de ações na impressão */
                    th:last-child, td:last-child { display: none; }
                </style>
            </head>
            <body>
                ${htmlContent}
                <script>
                    window.onload = () => {
                        setTimeout(() => {
                            window.print();
                        }, 1000);
                    };
                </script>
            </body>
            </html>
        `);
        doc.close();
    },

    exportPDF: () => {
        const inst = EstoqueModule.state.instituicao[0] || {};
        const user = Utils.getUser();
        const showLogo = inst.ExibirLogoRelatorios;

        // Captura o HTML da tabela atual
        const table = document.querySelector('#print-area-estoque table');
        const tableHtml = table ? table.outerHTML : '<p>Sem dados</p>';

        const html = `
            <div class="p-8 font-sans text-gray-900 bg-white">
                <div class="flex items-center justify-between border-b-2 border-gray-800 pb-4 mb-6">
                    <div class="${showLogo && inst.LogotipoURL ? 'flex items-center gap-4' : ''}">
                        ${showLogo && inst.LogotipoURL ? `<img src="${inst.LogotipoURL}" class="h-16 w-auto object-contain" crossorigin="anonymous">` : ''}
                        <div>
                            <h1 class="text-2xl font-bold text-gray-800">${inst.NomeFantasia || 'Relatório de Estoque'}</h1>
                            <p class="text-sm text-gray-500">${inst.Endereco || ''}</p>
                        </div>
                    </div>
                    <div class="text-right">
                        <h2 class="text-xl font-bold">POSIÇÃO DE ESTOQUE</h2>
                        <p class="text-sm text-gray-500">Data: ${new Date().toLocaleDateString()}</p>
                    </div>
                </div>
                
                ${tableHtml}
                
                <div class="mt-8 text-center text-xs text-gray-400">
                    &copy; 2026 Delícia da Cidade. Todos os direitos reservados. | Versão 1.0.0
                </div>
            </div>
        `;
        
        EstoqueModule.printNative(html);
    },

    exportEntradasMesPDF: async () => {
        try {
            Utils.toast('Baixando dados para o relatório...', 'info');
            // Busca todas as movimentações (sem paginação) para filtrar no front
            const allMovs = await Utils.api('getAll', 'MovimentacoesEstoque');
            
            const now = new Date();
            const currentMonth = now.getMonth();
            const currentYear = now.getFullYear();
            const monthName = now.toLocaleString('pt-BR', { month: 'long' });

            // Filtra apenas Entradas do mês atual
            const entradas = allMovs.filter(m => {
                if (m.Tipo !== 'Entrada') return false;
                if (!m.Data) return false;
                const d = new Date(m.Data);
                return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
            });

            if (entradas.length === 0) return Utils.toast('Nenhuma entrada registrada neste mês.', 'warning');

            // Ordena por data
            entradas.sort((a, b) => new Date(b.Data) - new Date(a.Data));

            const inst = EstoqueModule.state.instituicao[0] || {};
            const user = Utils.getUser();
            const showLogo = inst.ExibirLogoRelatorios;
            const totalQtd = entradas.reduce((acc, m) => acc + Number(m.Quantidade), 0);

            const html = `
                <div class="p-8 font-sans text-gray-900 bg-white">
                    <div class="flex items-center justify-between border-b-2 border-gray-800 pb-4 mb-6">
                        <div class="${showLogo && inst.LogotipoURL ? 'flex items-center gap-4' : ''}">
                            ${showLogo && inst.LogotipoURL ? `<img src="${inst.LogotipoURL}" class="h-16 w-auto object-contain" crossorigin="anonymous">` : ''}
                            <div>
                                <h1 class="text-2xl font-bold text-gray-800">${inst.NomeFantasia || 'Delícia da Cidade'}</h1>
                                <p class="text-sm text-gray-500">Relatório de Entradas de Estoque</p>
                            </div>
                        </div>
                        <div class="text-right">
                            <h2 class="text-xl font-bold uppercase">${monthName} / ${currentYear}</h2>
                            <p class="text-sm text-gray-500">Gerado em: ${new Date().toLocaleDateString()}</p>
                        </div>
                    </div>
                    <table class="w-full text-sm border-collapse">
                        <thead>
                            <tr class="bg-green-50 text-green-800">
                                <th class="p-2 border text-left">Data</th>
                                <th class="p-2 border text-left">Produto</th>
                                <th class="p-2 border text-center">Qtd</th>
                                <th class="p-2 border text-left">Responsável</th>
                                <th class="p-2 border text-left">Fornecedor/Detalhes</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${entradas.map((m, index) => {
                                const prod = EstoqueModule.state.items.find(i => i.ID === m.ProdutoID);
                                const nomeProd = prod ? prod.Nome : 'Item Desconhecido';
                                const detalhes = m.DetalhesJSON || {};
                                const fornecedor = detalhes.fornecedor || detalhes.Fornecedor || '-';
                                return `<tr class="${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}">
                                    <td class="p-2 border">${new Date(m.Data).toLocaleDateString()} ${new Date(m.Data).toLocaleTimeString().slice(0,5)}</td>
                                    <td class="p-2 border font-bold">${nomeProd}</td>
                                    <td class="p-2 border text-center font-bold text-green-700">${m.Quantidade}</td>
                                    <td class="p-2 border">${m.Responsavel || '-'}</td>
                                    <td class="p-2 border text-xs">${fornecedor}</td>
                                </tr>`;
                            }).join('')}
                        </tbody>
                        <tfoot>
                            <tr class="bg-green-50 font-bold">
                                <td colspan="2" class="p-2 border text-right">TOTAL DE ITENS:</td>
                                <td class="p-2 border text-center text-green-800">${totalQtd.toFixed(2)}</td>
                                <td colspan="2" class="p-2 border"></td>
                            </tr>
                        </tfoot>
                    </table>
                    <div class="mt-8 text-center text-xs text-gray-400">&copy; 2026 Delícia da Cidade. Todos os direitos reservados. | Versão 1.0.0</div>
                </div>`;

            EstoqueModule.printNative(html);
            Utils.toast('Relatório gerado com sucesso!', 'success');
        } catch (e) {
            console.error(e);
            Utils.toast('Erro ao gerar PDF: ' + e.message, 'error');
        }
    },

    setMovFilter: (subtipo) => {
        EstoqueModule.state.filterMovSubtipo = subtipo;
        EstoqueModule.state.pagination.page = 1; // Reseta para a primeira página
        EstoqueModule.fetchMovimentacoes().then(EstoqueModule.renderMovimentacoes);
    },

    updateMovFilter: (term) => {
        EstoqueModule.state.filterMovTerm = term;
        EstoqueModule.state.pagination.page = 1;
        if (EstoqueModule.movFilterTimeout) clearTimeout(EstoqueModule.movFilterTimeout);
        EstoqueModule.movFilterTimeout = setTimeout(() => {
            EstoqueModule.fetchMovimentacoes().then(EstoqueModule.renderMovimentacoes);
        }, 500);
    },

    exportMovimentacoesPDF: () => {
        const inst = EstoqueModule.state.instituicao[0] || {};
        const user = Utils.getUser();
        const showLogo = inst.ExibirLogoRelatorios;
        const subtipo = EstoqueModule.state.filterMovSubtipo || 'Geral';

        const table = document.querySelector('#print-area-movimentacoes table');
        const tableHtml = table ? table.outerHTML : '<p>Sem dados</p>';

        const html = `
            <style>
                /* A tabela de movimentações não tem coluna de Ações — exibe todas as colunas */
                th:last-child, td:last-child { display: table-cell !important; }
                /* Garante que a coluna Obs não fique truncada no PDF */
                td.truncate { overflow: visible !important; white-space: normal !important; text-overflow: unset !important; max-width: none !important; }
            </style>
            <div class="p-8 font-sans text-gray-900 bg-white">
                <div class="flex items-center justify-between border-b-2 border-gray-800 pb-4 mb-6">
                    <div class="${showLogo && inst.LogotipoURL ? 'flex items-center gap-4' : ''}">
                        ${showLogo && inst.LogotipoURL ? `<img src="${inst.LogotipoURL}" class="h-16 w-auto object-contain" crossorigin="anonymous">` : ''}
                        <div>
                            <h1 class="text-2xl font-bold text-gray-800">${inst.NomeFantasia || 'Relatório de Movimentações'}</h1>
                            <p class="text-sm text-gray-500">${inst.Endereco || ''}</p>
                            <p class="text-xs font-bold text-yellow-600 mt-1 uppercase">Filtro: ${subtipo}</p>
                        </div>
                    </div>
                    <div class="text-right">
                        <h2 class="text-xl font-bold">MOVIMENTAÇÕES</h2>
                        <p class="text-sm text-gray-500">Data: ${new Date().toLocaleDateString()}</p>
                    </div>
                </div>
                
                ${tableHtml}
                
                <div class="mt-8 text-center text-xs text-gray-400">
                    &copy; 2026 Delícia da Cidade. Todos os direitos reservados. | Versão 1.0.0
                </div>
            </div>
        `;

        EstoqueModule.printNative(html);
    },

    // --- GESTÃO DE FORNECEDORES ---
    renderFornecedores: () => {
        const fornecedores = EstoqueModule.state.fornecedores || [];
        const canCreate = Utils.checkPermission('Estoque', 'criar');
        const canEdit = Utils.checkPermission('Estoque', 'editar');
        const canDelete = Utils.checkPermission('Estoque', 'excluir');

        document.getElementById('estoque-content').innerHTML = `
            <div class="flex justify-between items-center mb-6">
                <h3 class="text-xl font-bold text-gray-800">Gestão de Fornecedores</h3>
                ${canCreate ? `<button onclick="EstoqueModule.modalFornecedor()" class="bg-green-600 text-white px-4 py-2 rounded shadow hover:bg-green-700 transition">
                    <i class="fas fa-plus mr-2"></i> Novo Fornecedor
                </button>` : ''}
            </div>

            <div class="bg-white rounded shadow overflow-hidden">
                <table class="w-full text-sm text-left">
                    <thead class="bg-gray-100 text-gray-600 uppercase">
                        <tr>
                            <th class="p-3">Nome</th>
                            <th class="p-3">Contato</th>
                            <th class="p-3">Endereço</th>
                            <th class="p-3">Produtos</th>
                            <th class="p-3 text-center">Status</th>
                            <th class="p-3 text-center">Ações</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y">
                        ${fornecedores.map(f => `
                            <tr class="hover:bg-gray-50">
                                <td class="p-3 font-bold">${f.Nome}</td>
                                <td class="p-3">${f.Contato || '-'}</td>
                                <td class="p-3 text-xs">${f.Endereco || '-'}</td>
                                <td class="p-3 text-xs">${f.ProdutosFornecidos || '-'}</td>
                                <td class="p-3 text-center"><span class="px-2 py-1 rounded text-xs ${f.Status === 'Ativo' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">${f.Status}</span></td>
                                <td class="p-3 text-center">
                                    ${canEdit ? `<button onclick="EstoqueModule.modalFornecedor('${f.ID}')" class="text-blue-500 hover:text-blue-700 mr-2"><i class="fas fa-edit"></i></button>` : ''}
                                    ${canDelete ? `<button onclick="EstoqueModule.deleteFornecedor('${f.ID}')" class="text-red-500 hover:text-red-700"><i class="fas fa-trash"></i></button>` : ''}
                                </td>
                            </tr>
                        `).join('')}
                        ${fornecedores.length === 0 ? '<tr><td colspan="6" class="p-4 text-center text-gray-500">Nenhum fornecedor cadastrado.</td></tr>' : ''}
                    </tbody>
                </table>
            </div>
        `;
    },

    modalFornecedor: (id = null) => {
        const f = id ? EstoqueModule.state.fornecedores.find(x => x.ID === id) : {};
        Utils.openModal(id ? 'Editar Fornecedor' : 'Novo Fornecedor', `
            <form onsubmit="EstoqueModule.saveFornecedor(event)">
                <input type="hidden" name="ID" value="${f.ID || ''}">
                <div class="mb-3"><label class="text-xs font-bold">Nome da Empresa</label><input name="Nome" value="${f.Nome || ''}" class="border p-2 rounded w-full" required></div>
                <div class="mb-3"><label class="text-xs font-bold">Contato (Tel/Email)</label><input name="Contato" value="${f.Contato || ''}" class="border p-2 rounded w-full"></div>
                <div class="mb-3"><label class="text-xs font-bold">Endereço</label><input name="Endereco" value="${f.Endereco || ''}" class="border p-2 rounded w-full"></div>
                <div class="mb-3"><label class="text-xs font-bold">Principais Produtos</label><textarea name="ProdutosFornecidos" class="border p-2 rounded w-full">${f.ProdutosFornecidos || ''}</textarea></div>
                <div class="mb-3"><label class="text-xs font-bold">Status</label>
                    <select name="Status" class="border p-2 rounded w-full">
                        <option ${f.Status === 'Ativo' ? 'selected' : ''}>Ativo</option>
                        <option ${f.Status === 'Inativo' ? 'selected' : ''}>Inativo</option>
                    </select>
                </div>
                <button class="w-full bg-blue-600 text-white py-2 rounded font-bold">Salvar</button>
            </form>
        `);
    },

    saveFornecedor: async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target).entries());
        try {
            await Utils.api('save', 'Fornecedores', data);
            Utils.toast('Fornecedor salvo!', 'success'); Utils.closeModal(); EstoqueModule.fetchData();
        } catch (err) { Utils.toast('Erro ao salvar: ' + err.message, 'error'); }
    },

    deleteFornecedor: async (id) => {
        if(!confirm('Remover este fornecedor?')) return;
        try {
            await Utils.api('delete', 'Fornecedores', null, id);
            EstoqueModule.fetchData();
        } catch (e) { Utils.toast('Erro ao remover.', 'error'); }
    }
    ,

    // --- RELATÓRIOS ---
    renderRelatorios: () => {
        const fornecedores = EstoqueModule.state.fornecedores || [];
        const container = document.getElementById('estoque-content');

        container.innerHTML = `
            <h3 class="text-xl font-bold text-gray-800 mb-6">Relatórios de Estoque</h3>
            
            <div class="bg-white p-6 rounded shadow">
                <h4 class="font-bold text-gray-700 mb-4 border-b pb-2">Produtos por Fornecedor</h4>
                <div class="flex items-end gap-4">
                    <div class="flex-1">
                        <label class="block text-xs font-bold text-gray-500 mb-1">Selecione o Fornecedor</label>
                        <select id="relatorio-fornecedor-select" class="border p-2 rounded w-full">
                            <option value="">Selecione um fornecedor...</option>
                            ${fornecedores.map(f => `<option value="${f.Nome}">${f.Nome}</option>`).join('')}
                        </select>
                    </div>
                    <button onclick="EstoqueModule.gerarRelatorioFornecedor()" class="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700">
                        <i class="fas fa-search"></i> Gerar
                    </button>
                    <button onclick="EstoqueModule.renderCurvaABC()" class="bg-purple-600 text-white px-4 py-2 rounded shadow hover:bg-purple-700 ml-4">
                        <i class="fas fa-chart-pie"></i> Curva ABC
                    </button>
                    <button onclick="EstoqueModule.renderPurchaseForecast()" class="bg-teal-600 text-white px-4 py-2 rounded shadow hover:bg-teal-700 ml-4">
                        <i class="fas fa-shopping-cart"></i> Previsão Compras
                    </button>
                </div>
                <div id="relatorio-fornecedor-resultado" class="mt-6"></div>
            </div>
        `;
    },

    gerarRelatorioFornecedor: () => {
        const select = document.getElementById('relatorio-fornecedor-select');
        const fornecedorNome = select.value;
        const resultadoDiv = document.getElementById('relatorio-fornecedor-resultado');

        if (!fornecedorNome) {
            resultadoDiv.innerHTML = '<p class="text-center text-gray-500 p-4">Selecione um fornecedor para gerar o relatório.</p>';
            return;
        }

        const produtos = EstoqueModule.state.items.filter(i => i.Fornecedor === fornecedorNome);

        if (produtos.length === 0) {
            resultadoDiv.innerHTML = '<p class="text-center text-gray-500 p-4">Nenhum produto encontrado para este fornecedor.</p>';
            return;
        }
        
        const totalValor = produtos.reduce((acc, item) => acc + (Number(item.Quantidade) * Number(item.CustoUnitario)), 0);

        resultadoDiv.innerHTML = `
            <div id="print-area-fornecedor">
                <div id="pdf-header-fornecedor" class="hidden p-6 border-b"></div>
                <h5 class="text-lg font-bold mb-2">Relatório de Produtos - Fornecedor: ${fornecedorNome}</h5>
                <table class="w-full text-sm">
                    <thead class="bg-gray-100">
                        <tr>
                            <th class="p-3 text-left">Produto</th>
                            <th class="p-3 text-center">Qtd</th>
                            <th class="p-3 text-right">Custo Unit.</th>
                            <th class="p-3 text-right">Valor Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${produtos.map(p => `
                            <tr class="border-t">
                                <td class="p-2 font-medium">${p.Nome}</td>
                                <td class="p-2 text-center">${p.Quantidade} ${p.Unidade}</td>
                                <td class="p-2 text-right">${Utils.formatCurrency(p.CustoUnitario)}</td>
                                <td class="p-2 text-right font-bold">${Utils.formatCurrency(p.Quantidade * p.CustoUnitario)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                    <tfoot>
                        <tr class="bg-gray-100 font-bold">
                            <td colspan="3" class="p-3 text-right">Total em Estoque deste Fornecedor:</td>
                            <td class="p-3 text-right">${Utils.formatCurrency(totalValor)}</td>
                        </tr>
                    </tfoot>
                </table>
                <div id="pdf-footer-fornecedor" class="hidden p-4 border-t text-center text-xs text-gray-400"></div>
            </div>
            <div class="text-right mt-4">
                <button onclick="EstoqueModule.printRelatorioFornecedor()" class="bg-red-600 text-white px-4 py-2 rounded shadow hover:bg-red-700">
                    <i class="fas fa-file-pdf"></i> Imprimir PDF
                </button>
            </div>
        `;
    },

    printRelatorioFornecedor: () => {
        const inst = EstoqueModule.state.instituicao[0] || {};
        const user = Utils.getUser();
        const showLogo = inst.ExibirLogoRelatorios;
        const fornecedorNome = document.getElementById('relatorio-fornecedor-select').value;

        const table = document.querySelector('#print-area-fornecedor table');
        const tableHtml = table ? table.outerHTML : '<p>Sem dados</p>';

        const html = `
            <div class="p-8 font-sans text-gray-900 bg-white">
                <div class="flex items-center justify-between border-b-2 border-gray-800 pb-4 mb-6">
                    <div class="${showLogo && inst.LogotipoURL ? 'flex items-center gap-4' : ''}">
                        ${showLogo && inst.LogotipoURL ? `<img src="${inst.LogotipoURL}" class="h-16 w-auto object-contain" crossorigin="anonymous">` : ''}
                        <div>
                            <h1 class="text-2xl font-bold text-gray-800">${inst.NomeFantasia || 'Relatório de Estoque'}</h1>
                            <p class="text-sm text-gray-500">Produtos do Fornecedor: <strong>${fornecedorNome}</strong></p>
                        </div>
                    </div>
                    <div class="text-right">
                        <h2 class="text-xl font-bold">RELATÓRIO POR FORNECEDOR</h2>
                        <p class="text-sm text-gray-500">Data: ${new Date().toLocaleDateString()}</p>
                    </div>
                </div>
                
                ${tableHtml}
                
                <div class="mt-8 text-center text-xs text-gray-400">
                    &copy; 2026 Delícia da Cidade. Todos os direitos reservados. | Versão 1.0.0
                </div>
            </div>
        `;

        EstoqueModule.printNative(html);
    },

    renderCurvaABC: async () => {
        const container = document.getElementById('relatorio-fornecedor-resultado');
        container.innerHTML = '<div class="text-center p-4"><i class="fas fa-spinner fa-spin text-2xl text-purple-600"></i><p>Calculando Curva ABC...</p></div>';

        try {
            const { lista, valorTotalGeral } = await Utils.api('getABCCurve');
            
            const countA = lista.filter(i => i.classe === 'A').length;
            const countB = lista.filter(i => i.classe === 'B').length;
            const countC = lista.filter(i => i.classe === 'C').length;

            container.innerHTML = `
                <div class="mt-6 border-t pt-6">
                    <h4 class="text-lg font-bold text-gray-800 mb-4">Curva ABC de Estoque (Consumo 90 dias)</h4>
                    
                    <div class="grid grid-cols-3 gap-4 mb-6 text-center">
                        <div class="p-3 bg-green-100 rounded border border-green-200">
                            <div class="text-2xl font-bold text-green-700">Classe A</div>
                            <div class="text-sm text-green-800">${countA} itens (80% do Valor)</div>
                            <div class="text-xs text-gray-500">Alta Importância</div>
                        </div>
                        <div class="p-3 bg-blue-100 rounded border border-blue-200">
                            <div class="text-2xl font-bold text-blue-700">Classe B</div>
                            <div class="text-sm text-blue-800">${countB} itens (15% do Valor)</div>
                            <div class="text-xs text-gray-500">Média Importância</div>
                        </div>
                        <div class="p-3 bg-gray-100 rounded border border-gray-200">
                            <div class="text-2xl font-bold text-gray-700">Classe C</div>
                            <div class="text-sm text-gray-800">${countC} itens (5% do Valor)</div>
                            <div class="text-xs text-gray-500">Baixa Importância</div>
                        </div>
                    </div>

                    <div class="overflow-x-auto max-h-96 custom-scrollbar border rounded">
                        <table class="w-full text-sm text-left">
                            <thead class="bg-gray-100 sticky top-0">
                                <tr>
                                    <th class="p-2">Classe</th>
                                    <th class="p-2">Produto</th>
                                    <th class="p-2 text-right">Consumo</th>
                                    <th class="p-2 text-right">Valor Total</th>
                                    <th class="p-2 text-right">% Acumulado</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y">
                                ${lista.map(i => `
                                    <tr class="hover:bg-gray-50">
                                        <td class="p-2 font-bold text-center ${i.classe === 'A' ? 'text-green-600 bg-green-50' : (i.classe === 'B' ? 'text-blue-600 bg-blue-50' : 'text-gray-500')}">${i.classe}</td>
                                        <td class="p-2 font-medium">${i.Nome}</td>
                                        <td class="p-2 text-right">${i.consumoQtd.toFixed(2)} ${i.Unidade}</td>
                                        <td class="p-2 text-right font-bold">${Utils.formatCurrency(i.valorTotal)}</td>
                                        <td class="p-2 text-right text-xs text-gray-500">${i.percentAcumulado.toFixed(1)}%</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        } catch (e) { container.innerHTML = '<p class="text-red-500">Erro ao gerar Curva ABC.</p>'; }
    },

    renderPurchaseForecast: async () => {
        const container = document.getElementById('relatorio-fornecedor-resultado');
        container.innerHTML = '<div class="text-center p-4"><i class="fas fa-spinner fa-spin text-2xl text-teal-600"></i><p>Calculando previsão de compras...</p></div>';

        try {
            const forecast = await Utils.api('getPurchaseForecast');

            container.innerHTML = `
                <div class="mt-6 border-t pt-6">
                    <div class="flex justify-between items-center mb-4">
                        <h4 class="text-lg font-bold text-gray-800">Previsão de Compras (Baseado no Consumo Médio)</h4>
                        <button onclick="EstoqueModule.printNative(document.getElementById('table-forecast').outerHTML)" class="text-gray-600 hover:text-gray-800"><i class="fas fa-print"></i></button>
                    </div>
                    
                    <div class="bg-teal-50 border-l-4 border-teal-400 p-4 mb-4">
                        <p class="text-sm text-teal-800">Sugestão de compra para itens com estoque abaixo de 15 dias de duração, visando cobrir 30 dias de operação.</p>
                    </div>

                    <div class="overflow-x-auto max-h-96 custom-scrollbar border rounded" id="table-forecast">
                        <table class="w-full text-sm text-left">
                            <thead class="bg-gray-100 sticky top-0">
                                <tr>
                                    <th class="p-2">Produto</th>
                                    <th class="p-2 text-center">Estoque Atual</th>
                                    <th class="p-2 text-center">Consumo Diário</th>
                                    <th class="p-2 text-center">Duração Est.</th>
                                    <th class="p-2 text-center bg-teal-100 text-teal-900">Sugestão Compra</th>
                                    <th class="p-2">Fornecedor</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y">
                                ${forecast.map(i => `
                                    <tr class="hover:bg-gray-50">
                                        <td class="p-2 font-medium">${i.Nome}</td>
                                        <td class="p-2 text-center">${i.Quantidade} ${i.Unidade}</td>
                                        <td class="p-2 text-center text-gray-500">${i.avgDaily.toFixed(2)}</td>
                                        <td class="p-2 text-center font-bold ${i.daysRemaining < 7 ? 'text-red-600' : 'text-yellow-600'}">${i.daysRemaining.toFixed(1)} dias</td>
                                        <td class="p-2 text-center font-bold bg-teal-50 text-teal-700">${i.suggestedQty} ${i.Unidade}</td>
                                        <td class="p-2 text-xs text-gray-500">${i.Fornecedor || '-'}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        } catch (e) { container.innerHTML = '<p class="text-red-500">Erro ao gerar previsão.</p>'; }
    }
};

// --- MÓDULO LISTA DO DIA (INTEGRADO) ---
const DailyListModule = {
    state: {
        lists: [],
        currentCategory: 'Manhã',
        date: new Date().toISOString().split('T')[0],
        editingItemIndex: null // Índice do item sendo editado
    },

    init: async () => {
        await DailyListModule.fetchLists();
        DailyListModule.render();
    },

    fetchLists: async () => {
        try {
            const lists = await Utils.api('getDailyProductionLists', null, { date: DailyListModule.state.date });
            DailyListModule.state.lists = lists || [];
        } catch (e) { console.error(e); }
    },

    render: () => {
        const categories = ['Manhã', 'Tarde', 'Noite', 'Eventos'];
        const currentList = DailyListModule.state.lists.find(l => l.Categoria === DailyListModule.state.currentCategory) || { ItensJSON: [] };
        const items = currentList.ItensJSON || [];
        const isEnviado = currentList.Status === 'Enviado';

        let html = `
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-xl font-bold text-gray-800">Lista de Produção do Dia</h3>
                <input type="date" value="${DailyListModule.state.date}" onchange="DailyListModule.state.date=this.value; DailyListModule.init()" class="border p-2 rounded">
            </div>

            <div class="flex border-b mb-4">
                ${categories.map(c => `
                    <button onclick="DailyListModule.state.currentCategory='${c}'; DailyListModule.render()" 
                        class="px-4 py-2 font-bold ${DailyListModule.state.currentCategory === c ? 'text-yellow-600 border-b-2 border-yellow-600' : 'text-gray-500 hover:text-gray-700'}">
                        ${c}
                    </button>
                `).join('')}
            </div>

            <div class="bg-white rounded shadow p-4">
                <div class="flex justify-between mb-4">
                    <div class="text-sm text-gray-600">
                        Status: <span class="font-bold ${isEnviado ? 'text-green-600' : 'text-yellow-600'}">${currentList.Status || 'Rascunho'}</span>
                        ${currentList.Prato ? `<span class="ml-4">Prato: <b>${currentList.Prato}</b></span>` : ''}
                    </div>
                    ${!isEnviado ? `
                        <div class="flex gap-2">
                            <button onclick="DailyListModule.modalPrato()" class="bg-gray-100 text-gray-700 px-3 py-1 rounded hover:bg-gray-200"><i class="fas fa-utensils"></i> Definir Prato</button>
                            <button onclick="DailyListModule.modalItem()" class="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"><i class="fas fa-plus"></i> Adicionar Item</button>
                        </div>
                    ` : ''}
                </div>

                <table class="w-full text-sm text-left">
                    <thead class="bg-gray-100">
                        <tr>
                            <th class="p-2">Produto</th>
                            <th class="p-2 text-center">Qtd</th>
                            <th class="p-2">Obs</th>
                            <th class="p-2 text-center">Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${items.map((item, idx) => `
                            <tr class="border-b hover:bg-gray-50">
                                <td class="p-2 font-medium">${item.nome}</td>
                                <td class="p-2 text-center">${item.qtd} ${item.unidade || ''}</td>
                                <td class="p-2 text-gray-500 text-xs">${item.obs || '-'}</td>
                                <td class="p-2 text-center">
                                    ${!isEnviado ? `
                                        <button onclick="DailyListModule.modalItem(${idx})" class="text-blue-500 hover:text-blue-700 mr-2" title="Editar"><i class="fas fa-edit"></i></button>
                                        <button onclick="DailyListModule.deleteItem(${idx})" class="text-red-500 hover:text-red-700" title="Remover"><i class="fas fa-trash"></i></button>
                                    ` : '<span class="text-gray-400"><i class="fas fa-lock"></i></span>'}
                                </td>
                            </tr>
                        `).join('')}
                        ${items.length === 0 ? '<tr><td colspan="4" class="p-4 text-center text-gray-400">Nenhum item na lista.</td></tr>' : ''}
                    </tbody>
                </table>

                ${!isEnviado && items.length > 0 ? `
                    <div class="mt-4 text-right">
                        <button onclick="DailyListModule.finalizeList('${currentList.ID}')" class="bg-green-600 text-white px-6 py-2 rounded font-bold hover:bg-green-700 shadow">
                            <i class="fas fa-check-double mr-2"></i> Finalizar e Enviar para Cozinha
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
        
        document.getElementById('estoque-content').innerHTML = html;
    },

    modalItem: (index = null) => {
        const currentList = DailyListModule.state.lists.find(l => l.Categoria === DailyListModule.state.currentCategory) || {};
        const items = currentList.ItensJSON || [];
        const item = index !== null ? items[index] : {};
        const products = EstoqueModule.state.items || [];

        // Define qual item está sendo editado
        DailyListModule.state.editingItemIndex = index;

        Utils.openModal(index !== null ? 'Editar Item' : 'Adicionar Item à Lista', `
            <form onsubmit="DailyListModule.saveItem(event)">
                <div class="mb-4">
                    <label class="block text-sm font-bold mb-1">Produto</label>
                    ${index !== null ? `
                        <input type="hidden" name="id" value="${item.id}">
                        <input type="hidden" name="nome" value="${item.nome}">
                        <input type="hidden" name="unidade" value="${item.unidade}">
                        <input class="border p-2 rounded w-full bg-gray-100" value="${item.nome}" readonly>
                    ` : `
                        <select name="id" class="border p-2 rounded w-full" required onchange="this.form.nome.value=this.options[this.selectedIndex].text.split(' (')[0]; this.form.unidade.value=this.options[this.selectedIndex].getAttribute('data-unit')">
                            <option value="">Selecione...</option>
                            ${products.map(p => `<option value="${p.ID}" data-unit="${p.Unidade}">${p.Nome} (${p.Unidade}) - Atual: ${p.Quantidade}</option>`).join('')}
                        </select>
                        <input type="hidden" name="nome">
                        <input type="hidden" name="unidade">
                    `}
                </div>
                <div class="grid grid-cols-2 gap-4 mb-4">
                    <div>
                        <label class="block text-sm font-bold mb-1">Quantidade</label>
                        <input type="number" step="0.01" name="qtd" value="${item.qtd || ''}" class="border p-2 rounded w-full" required>
                    </div>
                    <div>
                        <label class="block text-sm font-bold mb-1">Observação</label>
                        <input name="obs" value="${item.obs || ''}" class="border p-2 rounded w-full" placeholder="Ex: Sem sal">
                    </div>
                </div>
                <button class="w-full bg-blue-600 text-white py-2 rounded font-bold">Salvar Item</button>
            </form>
        `);
    },

    saveItem: async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target).entries());
        const cat = DailyListModule.state.currentCategory;
        const date = DailyListModule.state.date;
        
        let list = DailyListModule.state.lists.find(l => l.Categoria === cat);
        if (!list) {
            list = { Data: date, Categoria: cat, ItensJSON: [] };
            DailyListModule.state.lists.push(list);
        }
        
        const items = list.ItensJSON || [];
        
        if (DailyListModule.state.editingItemIndex !== null) {
            // Edição: Atualiza o item existente
            items[DailyListModule.state.editingItemIndex] = { ...items[DailyListModule.state.editingItemIndex], ...data };
        } else {
            // Novo: Adiciona ao final
            items.push(data);
        }
        
        list.ItensJSON = items;

        try {
            const saved = await Utils.api('saveDailyProductionList', null, list);
            // Atualiza estado local com dados salvos (para pegar ID se for novo)
            if(saved && saved.length > 0) {
                const idx = DailyListModule.state.lists.findIndex(l => l.Categoria === cat);
                DailyListModule.state.lists[idx] = saved[0];
            }
            Utils.toast('Lista atualizada!');
            Utils.closeModal();
            DailyListModule.render();
        } catch (err) { Utils.toast('Erro ao salvar: ' + err.message, 'error'); }
    },

    deleteItem: async (index) => {
        if(!confirm('Remover este item?')) return;
        const cat = DailyListModule.state.currentCategory;
        const list = DailyListModule.state.lists.find(l => l.Categoria === cat);
        if(list && list.ItensJSON) {
            list.ItensJSON.splice(index, 1);
            try {
                await Utils.api('saveDailyProductionList', null, list);
                Utils.toast('Item removido.');
                DailyListModule.render();
            } catch (err) { Utils.toast('Erro ao salvar.', 'error'); }
        }
    },

    modalPrato: () => {
        const cat = DailyListModule.state.currentCategory;
        const list = DailyListModule.state.lists.find(l => l.Categoria === cat) || {};
        Utils.openModal('Definir Prato do Dia', `
            <form onsubmit="DailyListModule.savePrato(event)">
                <div class="mb-4">
                    <label class="block text-sm font-bold mb-1">Nome do Prato / Refeição</label>
                    <input name="Prato" value="${list.Prato || ''}" class="border p-2 rounded w-full" placeholder="Ex: Feijoada Completa">
                </div>
                <button class="w-full bg-blue-600 text-white py-2 rounded font-bold">Salvar</button>
            </form>
        `);
    },

    savePrato: async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const prato = formData.get('Prato');
        const cat = DailyListModule.state.currentCategory;
        const date = DailyListModule.state.date;
        
        let list = DailyListModule.state.lists.find(l => l.Categoria === cat);
        if (!list) {
            list = { Data: date, Categoria: cat, ItensJSON: [] };
            DailyListModule.state.lists.push(list);
        }
        
        list.Prato = prato;

        try {
            await Utils.api('saveDailyProductionList', null, list);
            Utils.toast('Prato definido!');
            Utils.closeModal();
            DailyListModule.render();
        } catch (err) { Utils.toast('Erro ao salvar.', 'error'); }
    },

    finalizeList: async (id) => {
        if(!confirm('Confirma o envio para a cozinha? Isso irá baixar os itens do estoque.')) return;
        try {
            await Utils.api('finalizeDailyProductionList', null, { id });
            Utils.toast('Lista enviada com sucesso!', 'success');
            DailyListModule.init(); // Reload
        } catch (err) { Utils.toast('Erro: ' + err.message, 'error'); }
    }
};

document.addEventListener('DOMContentLoaded', EstoqueModule.init);
