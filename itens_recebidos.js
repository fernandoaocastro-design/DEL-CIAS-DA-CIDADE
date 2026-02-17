const ReceivedItemsModule = {
    state: {
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        lists: []
    },

    init: function() {
        console.log('📦 Módulo Itens Recebidos iniciado');
        this.renderLayout();
        this.fetchData();
    },

    renderLayout: function() {
        const container = document.getElementById('estoque-content');
        if (!container) return;

        container.innerHTML = `
            <div class="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <div>
                    <h2 class="text-2xl font-bold text-gray-800"><i class="fas fa-check-double text-green-600 mr-2"></i>Itens Recebidos pela Produção</h2>
                    <p class="text-gray-500 text-sm">Histórico de insumos enviados do estoque para a cozinha.</p>
                </div>
                <div class="flex items-center gap-2 bg-white p-2 rounded shadow-sm border">
                    <input type="date" id="filter-start" class="border p-1 rounded text-sm" value="${this.state.startDate}">
                    <span class="text-gray-400">até</span>
                    <input type="date" id="filter-end" class="border p-1 rounded text-sm" value="${this.state.endDate}">
                    <button onclick="ReceivedItemsModule.updateFilters()" class="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 text-sm"><i class="fas fa-search"></i></button>
                </div>
            </div>

            <div id="received-list-container" class="space-y-4">
                <div class="text-center py-8"><i class="fas fa-spinner fa-spin text-3xl text-blue-500"></i></div>
            </div>
        `;
    },

    updateFilters: function() {
        this.state.startDate = document.getElementById('filter-start').value;
        this.state.endDate = document.getElementById('filter-end').value;
        this.fetchData();
    },

    fetchData: async function() {
        try {
            const data = await Utils.api('getProductionHistory', null, {
                startDate: this.state.startDate,
                endDate: this.state.endDate
            });
            this.state.lists = data || [];
            this.renderList();
        } catch (err) {
            const container = document.getElementById('received-list-container');
            if(container) container.innerHTML = `<div class="text-red-500 text-center">Erro ao carregar: ${err.message}</div>`;
        }
    },

    renderList: function() {
        const container = document.getElementById('received-list-container');
        if (!container) return;
        
        if (this.state.lists.length === 0) {
            container.innerHTML = `<div class="bg-white p-8 rounded-lg shadow text-center text-gray-500">Nenhum registro encontrado neste período.</div>`;
            return;
        }

        container.innerHTML = this.state.lists.map(list => {
            const totalItens = list.ItensJSON ? list.ItensJSON.length : 0;
            const dateFmt = Utils.formatDate(list.Data);
            
            // Define cor baseada na categoria
            let colorClass = 'border-l-4 border-gray-400';
            if (list.Categoria.includes('Almoço')) colorClass = 'border-l-4 border-orange-500';
            else if (list.Categoria.includes('Jantar')) colorClass = 'border-l-4 border-indigo-500';
            else if (list.Categoria.includes('Sopa')) colorClass = 'border-l-4 border-green-500';

            return `
                <div class="bg-white rounded-lg shadow-sm border ${colorClass} overflow-hidden">
                    <div class="p-4 flex justify-between items-center cursor-pointer hover:bg-gray-50 transition" onclick="ReceivedItemsModule.toggleDetails('${list.ID}')">
                        <div class="flex items-center gap-4">
                            <div class="text-center">
                                <div class="text-xs text-gray-500 uppercase font-bold">Data</div>
                                <div class="font-bold text-gray-800">${dateFmt}</div>
                            </div>
                            <div>
                                <h4 class="font-bold text-lg text-gray-800">${this.formatCategory(list.Categoria)}</h4>
                                <p class="text-xs text-gray-500">${totalItens} itens entregues</p>
                            </div>
                        </div>
                        <div class="flex items-center gap-3">
                            <span class="px-2 py-1 bg-green-100 text-green-700 text-xs font-bold rounded">RECEBIDO</span>
                            <i class="fas fa-chevron-down text-gray-400 transition-transform" id="icon-${list.ID}"></i>
                        </div>
                    </div>
                    <div id="details-${list.ID}" class="hidden bg-gray-50 border-t p-4">
                        <table class="w-full text-sm">
                            <thead class="text-gray-500 text-left"><tr><th class="pb-2">Produto</th><th class="pb-2 text-center">Qtd</th><th class="pb-2 text-center">Un</th></tr></thead>
                            <tbody>
                                ${list.ItensJSON.map(item => `
                                    <tr class="border-b last:border-0 border-gray-200">
                                        <td class="py-2 text-gray-700">${item.nome}</td>
                                        <td class="py-2 text-center font-bold text-gray-800">${item.qtd}</td>
                                        <td class="py-2 text-center text-gray-500 text-xs">${item.unidade}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        }).join('');
    },

    toggleDetails: function(id) {
        document.getElementById(`details-${id}`).classList.toggle('hidden');
        document.getElementById(`icon-${id}`).classList.toggle('rotate-180');
    },

    formatCategory: (cat) => cat.replace('SopaCha', 'Sopa & Chá - ')
};