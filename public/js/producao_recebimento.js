const ProductionReceiptModule = {
    state: {
        startDate: new Date(Date.now() - (7 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        lists: []
    },

    async init() {
        this.renderLayout();
        await this.fetchData();
    },

    renderLayout() {
        const container = document.getElementById('producao-content');
        if (!container) return;

        container.innerHTML = `
            <div class="bg-white rounded-lg shadow border p-5">
                <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-5">
                    <div>
                        <h3 class="text-2xl font-bold text-gray-800"><i class="fas fa-clipboard-check text-green-600 mr-2"></i>Itens Recebidos da Produção</h3>
                        <p class="text-sm text-gray-500">Histórico de listas finalizadas e enviadas para a cozinha.</p>
                    </div>
                    <div class="flex items-center gap-2">
                        <input type="date" id="pr-filter-start" class="border p-2 rounded text-sm" value="${this.state.startDate}">
                        <span class="text-gray-400 text-sm">até</span>
                        <input type="date" id="pr-filter-end" class="border p-2 rounded text-sm" value="${this.state.endDate}">
                        <button onclick="ProductionReceiptModule.updateFilters()" class="bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700 text-sm">
                            <i class="fas fa-search"></i>
                        </button>
                        <button onclick="ProductionReceiptModule.backToProduction()" class="bg-gray-100 text-gray-700 px-3 py-2 rounded hover:bg-gray-200 text-sm">
                            <i class="fas fa-arrow-left mr-1"></i>Voltar
                        </button>
                    </div>
                </div>
                <div id="production-received-list" class="space-y-3">
                    <div class="text-center py-10 text-gray-500"><i class="fas fa-spinner fa-spin text-2xl"></i></div>
                </div>
            </div>
        `;
    },

    async updateFilters() {
        this.state.startDate = document.getElementById('pr-filter-start')?.value || this.state.startDate;
        this.state.endDate = document.getElementById('pr-filter-end')?.value || this.state.endDate;
        await this.fetchData();
    },

    async fetchData() {
        try {
            const rows = await Utils.api('getProductionHistory', null, {
                startDate: this.state.startDate,
                endDate: this.state.endDate
            });
            this.state.lists = rows || [];
            this.renderList();
        } catch (err) {
            const el = document.getElementById('production-received-list');
            if (el) el.innerHTML = `<div class="p-4 text-red-600 text-center">Erro ao carregar histórico: ${err.message}</div>`;
        }
    },

    renderList() {
        const el = document.getElementById('production-received-list');
        if (!el) return;

        if (!this.state.lists.length) {
            el.innerHTML = `<div class="bg-gray-50 rounded border p-6 text-center text-gray-500">Nenhum item recebido no período selecionado.</div>`;
            return;
        }

        el.innerHTML = this.state.lists.map(list => {
            const itens = Array.isArray(list.ItensJSON) ? list.ItensJSON : [];
            return `
                <details class="bg-gray-50 rounded border p-4">
                    <summary class="cursor-pointer list-none flex items-center justify-between">
                        <div>
                            <div class="font-bold text-gray-800">${list.Categoria || '-'}</div>
                            <div class="text-xs text-gray-500">${Utils.formatDate(list.Data)} • ${itens.length} itens</div>
                        </div>
                        <span class="px-2 py-1 text-xs rounded bg-green-100 text-green-700 font-bold">ENVIADO</span>
                    </summary>
                    <div class="mt-3 overflow-x-auto">
                        <table class="w-full text-sm">
                            <thead class="text-gray-500 text-left border-b">
                                <tr><th class="py-2">Produto</th><th class="py-2 text-center">Qtd</th><th class="py-2 text-center">Unidade</th></tr>
                            </thead>
                            <tbody>
                                ${itens.map(item => `
                                    <tr class="border-b last:border-0">
                                        <td class="py-2">${item.nome || '-'}</td>
                                        <td class="py-2 text-center font-bold">${item.qtd || 0}</td>
                                        <td class="py-2 text-center">${item.unidade || '-'}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </details>
            `;
        }).join('');
    },

    backToProduction() {
        if (typeof ProducaoModule !== 'undefined' && ProducaoModule.render) {
            ProducaoModule.render();
            return;
        }
        window.location.href = 'producao.html';
    }
};

window.ProductionReceiptModule = ProductionReceiptModule;
