const EstoqueModule = {
    state: { items: [], movimentacoes: [], activeTab: 'dashboard', filterMovSubtipo: '', charts: {}, pagination: { page: 1, limit: 20, total: 0 } },
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
        EstoqueModule.fetchData();
    },

    fetchData: async () => {
        try {
            const [data, inst] = await Promise.all([
                Utils.api('getAll', 'Estoque'),
                Utils.api('getAll', 'InstituicaoConfig')
            ]);
            EstoqueModule.state.items = data;
            EstoqueModule.state.instituicao = inst || [];
            
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
            const response = await Utils.api('getAll', 'MovimentacoesEstoque', { page, limit });
            EstoqueModule.state.movimentacoes = response.data || [];
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
        activeBtn.className = 'tab-btn px-4 py-2 font-bold text-yellow-600 transition';
        activeBtn.style.borderBottom = '2px solid #EAB308';

        if (tab === 'movimentacoes') EstoqueModule.fetchMovimentacoes().then(EstoqueModule.render);
        else if (tab === 'dashboard') Promise.all([EstoqueModule.fetchData(), EstoqueModule.fetchMovimentacoes()]).then(EstoqueModule.render);
        else EstoqueModule.render();
    },

    render: () => {
        if (EstoqueModule.state.activeTab === 'dashboard') {
            EstoqueModule.renderDashboard();
            return;
        }
        else if (EstoqueModule.state.activeTab === 'movimentacoes') {
            EstoqueModule.renderMovimentacoes();
            return;
        }
        // --- RENDERIZAÇÃO DA ABA PRODUTOS (Padrão) ---

        let data = EstoqueModule.state.items || [];        

        if (EstoqueModule.state.filterTerm) {
            const term = EstoqueModule.state.filterTerm.toLowerCase();
            data = data.filter(i => (i.Nome && i.Nome.toLowerCase().includes(term)) || (i.Codigo && i.Codigo.toLowerCase().includes(term)));
        }

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
                    <input type="text" placeholder="🔍 Buscar..." class="border p-2 rounded text-sm w-64" value="${EstoqueModule.state.filterTerm || ''}" oninput="EstoqueModule.updateFilter(this.value)">
                    <button onclick="EstoqueModule.exportPDF()" class="bg-gray-800 hover:bg-gray-900 text-white px-4 py-2 rounded shadow transition"><i class="fas fa-file-pdf"></i> PDF</button>
                    ${canCreate ? `<button onclick="EstoqueModule.modalEntrada()" class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded shadow transition"><i class="fas fa-arrow-down"></i> Entrada</button>
                    <button onclick="EstoqueModule.modalSaida()" class="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded shadow transition"><i class="fas fa-arrow-up"></i> Saída</button>
                    <button onclick="EstoqueModule.modalItem()" class="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded shadow transition">
                        <i class="fas fa-plus"></i> Novo Produto
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
                        ${data.map(i => {
                            const qtd = Number(i.Quantidade);
                            const min = Number(i.Minimo);
                            const custo = Number(i.CustoUnitario);
                            const isLow = qtd <= min;
                            const total = qtd * custo;
                            const nome = i.Nome || i.Item; // Compatibilidade com dados antigos
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
                                    ${canEdit ? `<button onclick="EstoqueModule.modalItem('${i.ID}')" class="text-blue-500 hover:text-blue-700 mr-2"><i class="fas fa-edit"></i></button>` : ''}
                                    ${canDelete ? `<button onclick="EstoqueModule.delete('${i.ID}')" class="text-red-500 hover:text-red-700"><i class="fas fa-trash"></i></button>` : ''}
                                </td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
                <div id="pdf-footer" class="hidden p-4 border-t text-center text-xs text-gray-400"></div>
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

            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                <!-- Ações Rápidas -->
                <div class="bg-white p-6 rounded shadow">
                    <h4 class="font-bold text-gray-700 mb-4 border-b pb-2">Ações Rápidas</h4>
                    <div class="grid grid-cols-2 gap-3">
                        <button onclick="EstoqueModule.setTab('produtos')" class="bg-gray-50 text-gray-700 p-3 rounded hover:bg-gray-100 text-sm font-bold flex flex-col items-center gap-2">
                            <i class="fas fa-boxes text-xl"></i> Ver Produtos
                        </button>
                    </div>
                </div>

                <!-- Gráfico de Consumo -->
                <div class="bg-white p-6 rounded shadow lg:col-span-2">
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
        new Chart(document.getElementById('chartConsumo'), {
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

    renderMovimentacoes: () => {
        let movs = EstoqueModule.state.movimentacoes || [];
        const items = EstoqueModule.state.items || [];
        
        // Obter Subtipos únicos para o filtro
        const subtipos = [...new Set(items.map(i => i.Subtipo).filter(Boolean))].sort();

        // Filtrar por Subtipo se selecionado
        if (EstoqueModule.state.filterMovSubtipo) {
            movs = movs.filter(m => {
                const prod = items.find(i => i.ID === m.ProdutoID);
                return prod && prod.Subtipo === EstoqueModule.state.filterMovSubtipo;
            });
        }

        // Ordenar por data (mais recente primeiro)
        movs.sort((a, b) => new Date(b.Data) - new Date(a.Data));

        // Dados para o Gráfico de Movimentações (Últimos 6 meses)
        const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        const movMap = {};
        
        movs.forEach(m => {
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
                            <th class="p-4 font-semibold">Responsável</th>
                            <th class="p-4 font-semibold">Obs</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100">
                        ${movs.map(m => {
                            const prod = EstoqueModule.state.items.find(i => i.ID === m.ProdutoID);
                            const nomeProd = prod ? prod.Nome : 'Item Excluído';
                            const subtipo = prod ? prod.Subtipo : '-';
                            const color = m.Tipo === 'Entrada' ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50';
                            const tipoIcon = m.Tipo === 'Entrada' ? 'fa-arrow-down' : 'fa-arrow-up';
                            
                            return `<tr class="hover:bg-yellow-50 transition-colors duration-150">
                                <td class="p-4 whitespace-nowrap text-gray-500">${new Date(m.Data).toLocaleString()}</td>
                                <td class="p-4">
                                    <span class="px-2 py-1 rounded-full text-xs font-bold ${color} inline-flex items-center gap-1">
                                        <i class="fas ${tipoIcon}"></i> ${m.Tipo}
                                    </span>
                                </td>
                                <td class="p-4 font-medium text-gray-800">${nomeProd}</td>
                                <td class="p-4 text-xs text-gray-500">
                                    <span class="bg-gray-100 px-2 py-1 rounded border border-gray-200">${subtipo}</span>
                                </td>
                                <td class="p-4 text-center font-bold text-gray-700">${m.Quantidade}</td>
                                <td class="p-4 text-sm text-gray-600">${m.Responsavel || '-'}</td>
                                <td class="p-4 text-xs text-gray-400 italic max-w-xs truncate" title="${m.Observacoes || ''}">${m.Observacoes || '-'}</td>
                            </tr>`;
                        }).join('')}
                        ${movs.length === 0 ? '<tr><td colspan="7" class="p-10 text-center text-gray-400 flex flex-col items-center"><i class="fas fa-search text-3xl mb-2 text-gray-300"></i>Nenhuma movimentação encontrada para este filtro.</td></tr>' : ''}
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

    modalItem: (id = null) => {
        const item = id ? EstoqueModule.state.items.find(i => i.ID === id) : {};
        
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
                    <div><label class="text-xs font-bold">Fornecedor</label><input name="Fornecedor" value="${item.Fornecedor || ''}" class="border p-2 rounded w-full"></div>
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
        EstoqueModule.render();
    },

    exportPDF: () => {
        const element = document.getElementById('print-area-estoque');
        const header = document.getElementById('pdf-header');
        const footer = document.getElementById('pdf-footer');
        const inst = EstoqueModule.state.instituicao[0] || {};
        const user = Utils.getUser();
        const showLogo = inst.ExibirLogoRelatorios;

        header.innerHTML = `
            <div class="mb-4 border-b pb-2 ${showLogo && inst.LogotipoURL ? 'flex items-center gap-4' : ''}">
                ${showLogo && inst.LogotipoURL ? `<img src="${inst.LogotipoURL}" class="h-16 w-auto object-contain">` : ''}
                <div>
                    <h1 class="text-2xl font-bold text-gray-800">${inst.NomeFantasia || 'Relatório de Estoque'}</h1>
                    <p class="text-sm text-gray-500">${inst.Endereco || ''}</p>
                </div>
            </div>
            <div class="mt-4 text-right text-xs text-gray-500">Data: ${new Date().toLocaleDateString()}</div>
        `;
        header.classList.remove('hidden');
        
        footer.innerHTML = `Gerado por ${user.Nome} em ${new Date().toLocaleString()}`;
        footer.classList.remove('hidden');

        const opt = {
            margin: 10,
            filename: 'relatorio-estoque.pdf',
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        html2pdf().set(opt).from(element).save().then(() => {
            header.classList.add('hidden');
            footer.classList.add('hidden');
        });
    },

    setMovFilter: (subtipo) => {
        EstoqueModule.state.filterMovSubtipo = subtipo;
        EstoqueModule.renderMovimentacoes();
    },

    exportMovimentacoesPDF: () => {
        const element = document.getElementById('print-area-movimentacoes');
        const header = document.getElementById('pdf-header-mov');
        const footer = document.getElementById('pdf-footer-mov');
        const inst = EstoqueModule.state.instituicao[0] || {};
        const user = Utils.getUser();
        const showLogo = inst.ExibirLogoRelatorios;
        const subtipo = EstoqueModule.state.filterMovSubtipo || 'Geral';

        header.innerHTML = `
            <div class="mb-4 border-b pb-2 ${showLogo && inst.LogotipoURL ? 'flex items-center gap-4' : ''}">
                ${showLogo && inst.LogotipoURL ? `<img src="${inst.LogotipoURL}" class="h-16 w-auto object-contain">` : ''}
                <div>
                    <h1 class="text-2xl font-bold text-gray-800">${inst.NomeFantasia || 'Relatório de Movimentações'}</h1>
                    <p class="text-sm text-gray-500">${inst.Endereco || ''}</p>
                    <p class="text-xs font-bold text-yellow-600 mt-1 uppercase">Filtro: ${subtipo}</p>
                </div>
            </div>
            <div class="mt-4 text-right text-xs text-gray-500">Data: ${new Date().toLocaleDateString()}</div>
        `;
        header.classList.remove('hidden');
        
        footer.innerHTML = `Gerado por ${user.Nome} em ${new Date().toLocaleString()}`;
        footer.classList.remove('hidden');

        const opt = {
            margin: 10,
            filename: `movimentacoes-${subtipo.toLowerCase().replace(/\s+/g, '-')}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        html2pdf().set(opt).from(element).save().then(() => {
            header.classList.add('hidden');
            footer.classList.add('hidden');
        });
    }
};

document.addEventListener('DOMContentLoaded', EstoqueModule.init);