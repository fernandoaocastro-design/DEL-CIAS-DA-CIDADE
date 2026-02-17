console.log('🚀 Carregando DailyListModule...');

const DailyListModule = {
    state: {
        selectedDate: new Date().toISOString().split('T')[0],
        lists: [], // Armazena as 4 listas do dia
        inventory: [], // Cache de produtos para o select
        categories: [
            { id: 'Almoço', label: '🍛 Produção do Dia - Almoço', color: 'orange' },
            { id: 'Jantar', label: '🌙 Produção da Noite - Jantar', color: 'indigo' },
            { id: 'SopaChaDia', label: '🍵 Sopa & Chá - Dia', color: 'green' },
            { id: 'SopaChaNoite', label: '🌙 Sopa & Chá - Noite', color: 'purple' }
        ]
    },

    init: async () => {
        console.log('DailyListModule.init() chamado');
        DailyListModule.renderLayout(); // Renderiza a tela IMEDIATAMENTE

        // Carrega inventário para os selects
        try {
            const result = await Utils.api('getAll', 'Estoque');
            DailyListModule.state.inventory = result || [];
        } catch (e) { 
            console.error('Erro ao carregar estoque', e); 
            Utils.toast('Aviso: Não foi possível carregar o estoque.', 'warning');
            DailyListModule.state.inventory = [];
        }
        
        DailyListModule.fetchLists();
    },

    fetchLists: async () => {
        try {
            const dateEl = document.getElementById('daily-list-date');
            const date = dateEl ? dateEl.value : DailyListModule.state.selectedDate;
            
            DailyListModule.state.selectedDate = date;
            DailyListModule.state.lists = await Utils.api('getDailyProductionLists', null, { date });
            DailyListModule.renderLists();
        } catch (e) {
            console.error(e);
            Utils.toast('Erro ao carregar listas.', 'error');
        }
    },

    renderLayout: () => {
        const container = document.getElementById('estoque-content') || document.getElementById('app-content'); // Fallback
        if(!container) return;

        container.innerHTML = `
            <div class="flex justify-end items-center mb-6">
                <div class="flex items-center gap-2 bg-white p-2 rounded shadow-sm border">
                    <label class="text-sm font-bold text-gray-600"><i class="fas fa-calendar-alt mr-1"></i> Data:</label>
                    <input type="date" id="daily-list-date" class="border p-1 rounded text-sm outline-none focus:border-blue-500" value="${DailyListModule.state.selectedDate}" onchange="DailyListModule.fetchLists()">
                </div>
            </div>
            <div id="daily-lists-container" class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <!-- Listas serão renderizadas aqui -->
            </div>
        `;
    },

    renderLists: () => {
        const container = document.getElementById('daily-lists-container');
        if(!container) return;
        container.innerHTML = '';

        DailyListModule.state.categories.forEach(cat => {
            // Encontra a lista salva ou cria objeto vazio
            const listData = DailyListModule.state.lists.find(l => l.Categoria === cat.id) || { ItensJSON: [], Status: 'Rascunho' };
            const isSent = listData.Status === 'Enviado';
            const items = listData.ItensJSON || [];

            const html = `
                <div class="bg-white rounded-lg shadow border-t-4 border-${cat.color}-500 flex flex-col h-full">
                    <div class="p-4 border-b flex justify-between items-center bg-${cat.color}-50">
                        <h3 class="font-bold text-${cat.color}-800">${cat.label}</h3>
                        <span class="px-2 py-1 rounded text-xs font-bold ${isSent ? 'bg-green-200 text-green-800' : 'bg-yellow-200 text-yellow-800'}">
                            ${isSent ? 'ENVIADO' : 'RASCUNHO'}
                        </span>
                    </div>
                    
                    <div class="p-4 flex-1 overflow-y-auto max-h-96">
                        <table class="w-full text-sm">
                            <thead class="text-gray-500 border-b">
                                <tr>
                                    <th class="text-left pb-2">Item</th>
                                    <th class="text-center pb-2 w-20">Qtd</th>
                                    <th class="text-center pb-2 w-16">Un</th>
                                    ${!isSent ? '<th class="w-8"></th>' : ''}
                                </tr>
                            </thead>
                            <tbody id="tbody-${cat.id}">
                                ${items.map((item, idx) => `
                                    <tr class="border-b last:border-0">
                                        <td class="py-2">${item.nome}</td>
                                        <td class="py-2 text-center font-bold">${item.qtd}</td>
                                        <td class="py-2 text-center text-xs text-gray-500">${item.unidade}</td>
                                        ${!isSent ? `
                                        <td class="text-right">
                                            <button onclick="DailyListModule.removeItem('${cat.id}', ${idx})" class="text-red-400 hover:text-red-600">
                                                <i class="fas fa-times"></i>
                                            </button>
                                        </td>` : ''}
                                    </tr>
                                `).join('')}
                                ${items.length === 0 ? '<tr><td colspan="4" class="py-4 text-center text-gray-400 italic">Nenhum item adicionado</td></tr>' : ''}
                            </tbody>
                        </table>
                    </div>

                    <div class="p-4 border-t bg-gray-50 mt-auto">
                        ${!isSent ? `
                        <div class="flex gap-2 mb-3">
                            <button onclick="DailyListModule.modalAddItem('${cat.id}')" class="flex-1 bg-white border border-gray-300 text-gray-700 py-2 rounded hover:bg-gray-100 text-sm font-bold">
                                <i class="fas fa-plus mr-1"></i> Adicionar Item
                            </button>
                        </div>
                        <div class="flex gap-2">
                            <button onclick="DailyListModule.sendList('${cat.id}', '${listData.ID || ''}')" class="flex-1 bg-${cat.color}-600 text-white py-2 rounded hover:bg-${cat.color}-700 text-sm font-bold shadow">
                                <i class="fas fa-paper-plane mr-1"></i> Enviar para Produção
                            </button>
                        </div>
                        ` : `
                        <button onclick="DailyListModule.printList('${cat.id}')" class="w-full bg-gray-700 text-white py-2 rounded hover:bg-gray-800 text-sm font-bold">
                            <i class="fas fa-print mr-1"></i> Imprimir PDF
                        </button>
                        `}
                    </div>
                </div>
            `;
            container.innerHTML += html;
        });
    },

    modalAddItem: (catId) => {
        const inventory = DailyListModule.state.inventory.filter(i => i.Status === 'Ativo').sort((a,b) => a.Nome.localeCompare(b.Nome));
        
        if (inventory.length === 0) {
            return Utils.toast('⚠️ O Estoque está vazio ou não carregou. Cadastre produtos primeiro.', 'warning');
        }

        Utils.openModal('Adicionar Item à Lista', `
            <form onsubmit="DailyListModule.addItem(event, '${catId}')">
                <div class="mb-4">
                    <label class="block text-sm font-bold mb-1">Produto</label>
                    <select name="produto" class="w-full border p-2 rounded" required onchange="DailyListModule.updateUnit(this)">
                        <option value="">Selecione...</option>
                        ${inventory.map(i => `<option value="${i.ID}" data-unit="${i.Unidade}" data-name="${i.Nome}">${i.Nome} (Disp: ${i.Quantidade} ${i.Unidade})</option>`).join('')}
                    </select>
                    <input type="hidden" name="nome_produto">
                    <input type="hidden" name="unidade_produto">
                </div>
                <div class="grid grid-cols-2 gap-4 mb-4">
                    <div>
                        <label class="block text-sm font-bold mb-1">Quantidade</label>
                        <input type="number" name="qtd" step="0.01" class="w-full border p-2 rounded" required>
                    </div>
                    <div>
                        <label class="block text-sm font-bold mb-1">Medida</label>
                        <input name="medida_display" class="w-full border p-2 rounded bg-gray-100" readonly>
                    </div>
                </div>
                <button class="w-full bg-blue-600 text-white py-2 rounded font-bold">Adicionar</button>
            </form>
        `);
    },

    updateUnit: (select) => {
        const opt = select.options[select.selectedIndex];
        const unit = opt.getAttribute('data-unit');
        const name = opt.getAttribute('data-name');
        
        select.form.medida_display.value = unit || '';
        select.form.unidade_produto.value = unit || '';
        select.form.nome_produto.value = name || '';
    },

    addItem: async (e, catId) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const item = {
            id: formData.get('produto'),
            nome: formData.get('nome_produto'),
            qtd: formData.get('qtd'),
            unidade: formData.get('unidade_produto')
        };

        // Atualiza estado local
        let list = DailyListModule.state.lists.find(l => l.Categoria === catId);
        if (!list) {
            list = { Categoria: catId, Data: DailyListModule.state.selectedDate, ItensJSON: [], Status: 'Rascunho' };
            DailyListModule.state.lists.push(list);
        }
        
        if(!list.ItensJSON) list.ItensJSON = [];
        list.ItensJSON.push(item);

        // Salva no backend (Rascunho)
        try {
            const saved = await Utils.api('saveDailyProductionList', null, list);
            if (saved && saved.length > 0) list.ID = saved[0].ID; // Atualiza ID para permitir envio imediato

            Utils.closeModal();
            DailyListModule.renderLists();
        } catch (err) {
            Utils.toast('Erro ao salvar item.', 'error');
        }
    },

    removeItem: async (catId, idx) => {
        if(!confirm('Remover este item?')) return;
        
        const list = DailyListModule.state.lists.find(l => l.Categoria === catId);
        if(list && list.ItensJSON) {
            list.ItensJSON.splice(idx, 1);
            try {
                await Utils.api('saveDailyProductionList', null, list);
                DailyListModule.renderLists();
            } catch (err) { Utils.toast('Erro ao remover.', 'error'); }
        }
    },

    sendList: async (catId, listId) => {
        if(!listId) return Utils.toast('Adicione itens antes de enviar.', 'warning');
        if(!confirm('Confirma o envio para a produção? Isso dará baixa no estoque automaticamente.')) return;

        try {
            await Utils.api('finalizeDailyProductionList', null, { id: listId });
            Utils.toast('✅ Lista enviada com sucesso!');
            DailyListModule.fetchLists(); // Recarrega para atualizar status
        } catch (err) {
            Utils.toast('Erro ao enviar: ' + err.message, 'error');
        }
    },

    printList: (catId) => {
        const list = DailyListModule.state.lists.find(l => l.Categoria === catId);
        const cat = DailyListModule.state.categories.find(c => c.id === catId);
        
        if(!list) return;

        const html = `
            <div class="p-8 font-sans">
                <h1 class="text-2xl font-bold text-center mb-2">LISTA DE PRODUÇÃO</h1>
                <h2 class="text-xl text-center mb-6 border-b pb-4">${cat.label}</h2>
                
                <div class="flex justify-between mb-6 text-sm">
                    <span><strong>Data:</strong> ${Utils.formatDate(list.Data)}</span>
                    <span><strong>Status:</strong> ${list.Status.toUpperCase()}</span>
                </div>

                <table class="w-full border-collapse border border-gray-300 text-sm">
                    <thead class="bg-gray-100"><tr><th class="border p-2 text-left">Produto</th><th class="border p-2 text-center">Qtd</th><th class="border p-2 text-center">Unidade</th><th class="border p-2 text-center">Check</th></tr></thead>
                    <tbody>
                        ${list.ItensJSON.map(i => `<tr><td class="border p-2">${i.nome}</td><td class="border p-2 text-center font-bold">${i.qtd}</td><td class="border p-2 text-center">${i.unidade}</td><td class="border p-2"></td></tr>`).join('')}
                    </tbody>
                </table>
            </div>
        `;
        Utils.printNative(html);
    }
};

// Expor globalmente
window.DailyListModule = DailyListModule;
console.log('✅ DailyListModule carregado com sucesso.');