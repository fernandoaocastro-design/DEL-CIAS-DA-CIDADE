console.log('🚀 Carregando DailyListModule...');

const DailyListModule = {
    state: {
        selectedDate: new Date().toISOString().split('T')[0],
        lists: [], // Armazena as 4 listas do dia
        inventory: [], // Cache de produtos para o select
        recipes: [], // Cache de pratos favoritos (Fichas Técnicas)
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

        // Carrega inventário e receitas para os selects
        try {
            const [inventory, recipes] = await Promise.all([
                Utils.api('getAll', 'Estoque'),
                Utils.api('getAll', 'FichasTecnicas')
            ]);
            DailyListModule.state.inventory = inventory || [];
            DailyListModule.state.recipes = recipes || [];
        } catch (e) { 
            console.error('Erro ao carregar dados auxiliares', e); 
            Utils.toast('Aviso: Não foi possível carregar dados auxiliares.', 'warning');
            DailyListModule.state.inventory = [];
            DailyListModule.state.recipes = [];
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
            <div class="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <h2 class="text-2xl font-bold text-gray-800">Produção Diária</h2>
                <div class="flex items-center gap-3">
                    <button onclick="DailyListModule.printDailyOverview()" class="bg-gray-800 text-white px-4 py-2 rounded shadow hover:bg-gray-900 text-sm font-bold flex items-center gap-2 transition transform hover:scale-105">
                        <i class="fas fa-print"></i> Imprimir Dia
                    </button>
                    <button onclick="DailyListModule.printShoppingList()" class="bg-purple-600 text-white px-4 py-2 rounded shadow hover:bg-purple-700 text-sm font-bold flex items-center gap-2 transition transform hover:scale-105">
                        <i class="fas fa-shopping-cart"></i> Gerar Lista de Compras
                    </button>
                    <div class="flex items-center gap-2 bg-white p-2 rounded shadow-sm border">
                    <label class="text-sm font-bold text-gray-600"><i class="fas fa-calendar-alt mr-1"></i> Data:</label>
                    <input type="date" id="daily-list-date" class="border p-1 rounded text-sm outline-none focus:border-blue-500" value="${DailyListModule.state.selectedDate}" onchange="DailyListModule.fetchLists()">
                </div>
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

        // Injeta datalist de receitas para autocompletar
        const recipesList = DailyListModule.state.recipes || [];
        const datalistHtml = `<datalist id="recipes-list">${recipesList.map(r => `<option value="${r.Nome}">`).join('')}</datalist>`;
        container.insertAdjacentHTML('beforeend', datalistHtml);

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
                    
                    <div class="px-4 pt-4">
                        <label class="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Prato Principal / Refeição</label>
                        <input type="text" 
                            value="${listData.Prato || ''}" 
                            list="recipes-list"
                            placeholder="Ex: Feijoada, Grelhados..." 
                            class="w-full border-b-2 border-gray-200 focus:border-${cat.color}-500 outline-none py-1 text-gray-700 font-bold bg-transparent transition-colors"
                            onchange="DailyListModule.updatePrato('${cat.id}', this.value)"
                            ${isSent ? 'readonly' : ''}
                        >
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
                                        <td class="py-2">
                                            ${item.nome}
                                            ${item.obs ? `<div class="text-xs text-gray-500 italic">${item.obs}</div>` : ''}
                                        </td>
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
                            <button onclick="DailyListModule.printList('${cat.id}')" class="px-3 bg-gray-200 text-gray-700 py-2 rounded hover:bg-gray-300 text-sm font-bold" title="Imprimir Rascunho">
                                <i class="fas fa-print"></i>
                            </button>
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

    updatePrato: async (catId, value) => {
        let list = DailyListModule.state.lists.find(l => l.Categoria === catId);
        if (!list) {
            list = { Categoria: catId, Data: DailyListModule.state.selectedDate, ItensJSON: [], Status: 'Rascunho' };
            DailyListModule.state.lists.push(list);
        }
        list.Prato = value;

        // Auto-add ingredients from recipe
        const recipe = (DailyListModule.state.recipes || []).find(r => r.Nome.trim().toLowerCase() === value.trim().toLowerCase());
        
        if (recipe && recipe.IngredientesJSON && Array.isArray(recipe.IngredientesJSON) && recipe.IngredientesJSON.length > 0) {
            if (confirm(`Encontrei a ficha técnica de "${recipe.Nome}". Deseja adicionar os ingredientes automaticamente à lista?`)) {
                if (!list.ItensJSON) list.ItensJSON = [];
                
                recipe.IngredientesJSON.forEach(ing => {
                    const prod = DailyListModule.state.inventory.find(p => p.ID === ing.id);
                    if (prod) {
                        list.ItensJSON.push({
                            id: prod.ID,
                            nome: prod.Nome,
                            qtd: ing.quantidade,
                            unidade: prod.Unidade,
                            obs: 'Ficha Técnica'
                        });
                    }
                });
                DailyListModule.renderLists();
            }
        }

        try {
            const saved = await Utils.api('saveDailyProductionList', null, list);
            if (saved && saved.length > 0) list.ID = saved[0].ID;
        } catch (err) { Utils.toast('Erro ao salvar prato.', 'error'); }
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
                <div class="mb-4">
                    <label class="block text-sm font-bold mb-1">Observação (Opcional)</label>
                    <input name="obs" class="w-full border p-2 rounded" placeholder="Ex: Sem sal, Cortar fino...">
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
            unidade: formData.get('unidade_produto'),
            obs: formData.get('obs')
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
            console.error(err);
            Utils.toast('Erro ao salvar: ' + (err.message || 'Tente novamente'), 'error');
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
                    ${list.Prato ? `<span><strong>Prato:</strong> ${list.Prato}</span>` : ''}
                </div>

                <table class="w-full border-collapse border border-gray-300 text-sm">
                    <thead class="bg-gray-100"><tr><th class="border p-2 text-left">Produto</th><th class="border p-2 text-center">Qtd</th><th class="border p-2 text-center">Unidade</th><th class="border p-2 text-center">Check</th></tr></thead>
                    <tbody>
                        ${list.ItensJSON.map(i => `<tr><td class="border p-2">${i.nome}${i.obs ? ` <div class="text-xs italic text-gray-500">${i.obs}</div>` : ''}</td><td class="border p-2 text-center font-bold">${i.qtd}</td><td class="border p-2 text-center">${i.unidade}</td><td class="border p-2"></td></tr>`).join('')}
                    </tbody>
                </table>
            </div>
        `;
        Utils.printNative(html);
    },

    printDailyOverview: () => {
        const date = DailyListModule.state.selectedDate;
        const lists = DailyListModule.state.lists;
        const categories = DailyListModule.state.categories;
        
        let html = `
            <div class="p-8 font-sans">
                <div class="text-center border-b-2 border-gray-800 pb-4 mb-6">
                    <h1 class="text-2xl font-bold uppercase">Relatório de Produção Diária</h1>
                    <p class="text-sm text-gray-600">Data: ${Utils.formatDate(date)}</p>
                </div>
        `;

        let hasItems = false;

        categories.forEach(cat => {
            const listData = lists.find(l => l.Categoria === cat.id);
            if (listData && listData.ItensJSON && listData.ItensJSON.length > 0) {
                hasItems = true;
                html += `
                    <div class="mb-6 break-inside-avoid">
                        <div class="flex justify-between items-center bg-gray-100 p-2 border-l-4 border-gray-600 mb-2">
                            <h3 class="font-bold text-gray-800">${cat.label}</h3>
                            <span class="text-xs font-bold px-2 py-1 rounded border border-gray-300 bg-white">${listData.Status.toUpperCase()}</span>
                        </div>
                        ${listData.Prato ? `<div class="mb-2 px-2 text-sm"><strong>Prato Principal:</strong> ${listData.Prato}</div>` : ''}
                        <table class="w-full text-sm border-collapse border border-gray-300">
                            <thead class="bg-gray-50">
                                <tr>
                                    <th class="border p-2 text-left">Item</th>
                                    <th class="border p-2 text-center w-24">Qtd</th>
                                    <th class="border p-2 text-center w-20">Un</th>
                                    <th class="border p-2 text-center w-20">Check</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${listData.ItensJSON.map(item => `
                                    <tr>
                                        <td class="border p-2">
                                            ${item.nome}
                                            ${item.obs ? `<div class="text-xs italic text-gray-500">${item.obs}</div>` : ''}
                                        </td>
                                        <td class="border p-2 text-center font-bold">${item.qtd}</td>
                                        <td class="border p-2 text-center text-xs">${item.unidade}</td>
                                        <td class="border p-2"></td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                `;
            }
        });

        if (!hasItems) {
            html += `<p class="text-center text-gray-500 italic py-8">Nenhum item registrado para esta data.</p>`;
        }

        html += `
                <div class="mt-8 border-t border-gray-800 pt-2 text-center text-xs text-gray-500">
                    Gerado em ${new Date().toLocaleString()}
                </div>
            </div>
        `;

        Utils.printNative(html);
    },

    printShoppingList: () => {
        const lists = DailyListModule.state.lists;
        const inventory = DailyListModule.state.inventory;
        
        if (!inventory || inventory.length === 0) {
            return Utils.toast('⚠️ O estoque não foi carregado corretamente. Recarregue a página.', 'warning');
        }
        
        const shoppingList = {};

        // 1. Consolidar demandas de todas as listas do dia
        lists.forEach(list => {
            if (list.ItensJSON && Array.isArray(list.ItensJSON)) {
                list.ItensJSON.forEach(item => {
                    if (!item.id) return;
                    if (!shoppingList[item.id]) {
                        // Busca dados do estoque atual
                        const prod = inventory.find(p => p.ID === item.id);
                        shoppingList[item.id] = {
                            id: item.id,
                            name: item.nome || (prod ? prod.Nome : 'Item Desconhecido'),
                            unit: item.unidade || (prod ? prod.Unidade : 'un'),
                            required: 0,
                            stock: prod ? Number(prod.Quantidade || 0) : 0
                        };
                    }
                    shoppingList[item.id].required += Number(item.qtd || 0);
                });
            }
        });

        // 2. Filtrar apenas o que falta (Necessário > Estoque)
        const toBuy = Object.values(shoppingList)
            .filter(i => i.required > i.stock)
            .map(i => ({ ...i, missing: i.required - i.stock }))
            .sort((a, b) => a.name.localeCompare(b.name));

        if (toBuy.length === 0) {
            return Utils.toast('✅ Estoque suficiente para a produção do dia!', 'success');
        }

        // 3. Mostrar Modal com Opções
        const dateStr = Utils.formatDate(DailyListModule.state.selectedDate);
        
        // Salva temporariamente para uso no botão de salvar
        DailyListModule.tempShoppingList = toBuy;

        const htmlTable = `
            <table class="w-full border-collapse border border-gray-300 text-sm mb-4">
                <thead class="bg-gray-100"><tr><th class="border p-2 text-left">Produto</th><th class="border p-2 text-center">Necessário</th><th class="border p-2 text-center">Estoque</th><th class="border p-2 text-center font-bold">Comprar</th></tr></thead>
                <tbody>
                    ${toBuy.map(i => `<tr><td class="border p-2">${i.name}</td><td class="border p-2 text-center text-gray-500">${i.required.toFixed(2)}</td><td class="border p-2 text-center text-gray-500">${i.stock.toFixed(2)}</td><td class="border p-2 text-center font-bold text-red-600 bg-red-50">${i.missing.toFixed(2)} ${i.unit}</td></tr>`).join('')}
                </tbody>
            </table>
        `;

        Utils.openModal('Lista de Compras Sugerida', `
            <div class="text-center mb-4">
                <p class="text-gray-600">Itens faltantes para a produção de <b>${dateStr}</b>.</p>
            </div>
            ${htmlTable}
            <div class="flex gap-3 mt-4">
                <button onclick="Utils.printNative('${htmlTable.replace(/"/g, '&quot;')}')" class="flex-1 bg-gray-600 text-white py-2 rounded hover:bg-gray-700"><i class="fas fa-print"></i> Imprimir</button>
                <button onclick="DailyListModule.saveShoppingOrder()" class="flex-1 bg-green-600 text-white py-2 rounded hover:bg-green-700 font-bold"><i class="fas fa-save"></i> Salvar Pedido</button>
            </div>
        `);
    },

    saveShoppingOrder: async () => {
        const items = DailyListModule.tempShoppingList;
        if (!items || items.length === 0) return;

        const payload = {
            Solicitante: 'Produção (Automático)',
            ValorTotal: 0, // Pode ser calculado se tiver custo
            Status: 'Pendente',
            Itens: items.map(i => ({
                id: i.id,
                name: i.name,
                qty: i.missing,
                price: 0, // Pega do cadastro se quiser
                total: 0,
                obs: 'Gerado via Lista do Dia'
            }))
        };

        try {
            await Utils.api('savePurchaseOrder', null, payload);
            Utils.toast('✅ Pedido de Compra criado! Vá em Estoque para receber.', 'success');
            Utils.closeModal();
        } catch (e) {
            Utils.toast('Erro ao criar pedido: ' + e.message, 'error');
        }
    }
};

// Expor globalmente
window.DailyListModule = DailyListModule;
console.log('✅ DailyListModule carregado com sucesso.');