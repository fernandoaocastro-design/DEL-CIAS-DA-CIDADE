const EventosModule = {
    state: {
        currentDate: new Date(),
        events: [],
        filter: '',
        stockItems: [],
        purchaseOrders: [],
        view: 'calendar', // 'calendar' or 'list'
        instituicao: [],
        purchaseCart: [], // Carrinho de compras para pedidos
        charts: {},
        clients: []
    },

    init: () => {
        EventosModule.fetchData();
    },

    fetchData: async () => {
        try {
            // Usando allSettled para que falha em Eventos não impeça carregamento do Estoque
            const results = await Promise.allSettled([
                Utils.api('getAll', 'Eventos'),
                Utils.api('getAll', 'InstituicaoConfig'),
                Utils.api('getAll', 'Estoque'),
                Utils.api('getAll', 'PedidosCompra'),
                Utils.api('getAll', 'Clientes')
            ]);
            
            const [resEvents, resInst, resStock, resOrders, resClients] = results;

            EventosModule.state.events = resEvents.status === 'fulfilled' ? resEvents.value : [];
            EventosModule.state.instituicao = resInst.status === 'fulfilled' ? resInst.value : [];
            EventosModule.state.stockItems = resStock.status === 'fulfilled' ? resStock.value : [];
            EventosModule.state.purchaseOrders = resOrders.status === 'fulfilled' ? resOrders.value : [];
            EventosModule.state.clients = resClients.status === 'fulfilled' ? resClients.value : [];

            if (resEvents.status === 'rejected') console.warn('Erro ao carregar Eventos (Tabela inexistente?):', resEvents.reason);
            if (resStock.status === 'rejected') Utils.toast('Erro ao carregar Estoque.', 'error');

        } catch (e) {
            console.log("Erro ao carregar dados.");
            Utils.toast("Erro ao carregar dados de eventos e estoque.", "error");
        }
        EventosModule.render();
    },

    setView: (view) => {
        EventosModule.state.view = view;
        
        // Atualiza botões
        const btnCal = document.getElementById('btn-view-calendar');
        const btnList = document.getElementById('btn-view-list');
        const btnPurch = document.getElementById('btn-view-purchase');
        const btnHist = document.getElementById('btn-view-history');
        const btnABC = document.getElementById('btn-view-abc');
        
        // Injeta botão Fidelidade se não existir
        let btnLoyalty = document.getElementById('btn-view-loyalty');
        if (!btnLoyalty && btnABC && btnABC.parentElement) {
            btnLoyalty = document.createElement('button');
            btnLoyalty.id = 'btn-view-loyalty';
            btnLoyalty.innerText = 'Fidelidade';
            btnLoyalty.onclick = () => EventosModule.setView('loyalty');
            btnLoyalty.className = 'px-4 py-2 rounded text-sm font-bold text-gray-600 hover:bg-gray-100 transition';
            btnABC.parentElement.appendChild(btnLoyalty);
        }
        
        // Reset classes
        [btnCal, btnList, btnPurch, btnHist, btnABC, btnLoyalty].forEach(btn => {
            if(btn) btn.className = 'px-4 py-2 rounded text-sm font-bold text-gray-600 hover:bg-gray-100 transition';
        });

        document.getElementById('calendar-view').classList.add('hidden');
        document.getElementById('list-view').classList.add('hidden');
        document.getElementById('purchase-view').classList.add('hidden');
        document.getElementById('history-view').classList.add('hidden');
        const abcView = document.getElementById('abc-view');
        if(abcView) abcView.classList.add('hidden');
        
        // Cria container Fidelidade se não existir
        let loyaltyView = document.getElementById('loyalty-view');
        if (!loyaltyView) {
            loyaltyView = document.createElement('div');
            loyaltyView.id = 'loyalty-view';
            loyaltyView.className = 'hidden';
            document.getElementById('calendar-view').parentElement.appendChild(loyaltyView);
        }
        loyaltyView.classList.add('hidden');

        if(view === 'calendar') {
            btnCal.className = 'px-4 py-2 rounded text-sm font-bold bg-indigo-100 text-indigo-700 transition';
            document.getElementById('calendar-view').classList.remove('hidden');
        } else if (view === 'list') {
            btnList.className = 'px-4 py-2 rounded text-sm font-bold bg-indigo-100 text-indigo-700 transition';
            document.getElementById('list-view').classList.remove('hidden');
        } else if (view === 'purchase') {
            btnPurch.className = 'px-4 py-2 rounded text-sm font-bold bg-indigo-100 text-indigo-700 transition';
            document.getElementById('purchase-view').classList.remove('hidden');
        } else if (view === 'history') {
            if(btnHist) btnHist.className = 'px-4 py-2 rounded text-sm font-bold bg-indigo-100 text-indigo-700 transition';
            document.getElementById('history-view').classList.remove('hidden');
        } else if (view === 'abc') {
            if(btnABC) btnABC.className = 'px-4 py-2 rounded text-sm font-bold bg-indigo-100 text-indigo-700 transition';
            if(abcView) abcView.classList.remove('hidden');
            EventosModule.renderClientABC();
        } else if (view === 'loyalty') {
            if(btnLoyalty) btnLoyalty.className = 'px-4 py-2 rounded text-sm font-bold bg-indigo-100 text-indigo-700 transition';
            loyaltyView.classList.remove('hidden');
            EventosModule.renderLoyalty();
        }
        EventosModule.render();
    },

    setFilter: (category) => {
        EventosModule.state.filter = category;
        EventosModule.render();
    },

    getHolidays: (year) => {
        return {
            [`${year}-01-01`]: 'Ano Novo',
            [`${year}-02-04`]: 'Início da Luta Armada',
            [`${year}-03-08`]: 'Dia da Mulher',
            [`${year}-03-23`]: 'Libertação da África Austral',
            [`${year}-04-04`]: 'Dia da Paz',
            [`${year}-05-01`]: 'Dia do Trabalhador',
            [`${year}-09-17`]: 'Dia do Herói Nacional',
            [`${year}-11-02`]: 'Dia dos Finados',
            [`${year}-11-11`]: 'Independência',
            [`${year}-12-25`]: 'Natal'
        };
    },

    changeMonth: (offset) => {
        const date = EventosModule.state.currentDate;
        date.setMonth(date.getMonth() + offset);
        EventosModule.state.currentDate = new Date(date);
        EventosModule.render();
    },

    render: () => {
        if (EventosModule.state.view === 'calendar') EventosModule.renderCalendar();
        // else if (EventosModule.state.view === 'list') EventosModule.renderList(); // Função não implementada
        else if (EventosModule.state.view === 'purchase') EventosModule.renderPurchaseOrders();
        else if (EventosModule.state.view === 'history') EventosModule.renderPurchaseHistory();
        // abc view is rendered on setView
        // loyalty view is rendered on setView
    },

    renderCalendar: () => {
        const date = EventosModule.state.currentDate;
        const year = date.getFullYear();
        const month = date.getMonth();
        const holidays = EventosModule.getHolidays(year);
        const canCreate = Utils.checkPermission('Eventos', 'criar');

        // Atualiza Cabeçalho
        const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
        document.getElementById('calendar-month-year').innerText = `${monthNames[month]} ${year}`;

        const grid = document.getElementById('calendar-grid');
        
        // Cabeçalho dos Dias
        let html = `
            <div class="bg-gray-50 p-2 text-center text-xs font-bold text-gray-500">DOM</div>
            <div class="bg-gray-50 p-2 text-center text-xs font-bold text-gray-500">SEG</div>
            <div class="bg-gray-50 p-2 text-center text-xs font-bold text-gray-500">TER</div>
            <div class="bg-gray-50 p-2 text-center text-xs font-bold text-gray-500">QUA</div>
            <div class="bg-gray-50 p-2 text-center text-xs font-bold text-gray-500">QUI</div>
            <div class="bg-gray-50 p-2 text-center text-xs font-bold text-gray-500">SEX</div>
            <div class="bg-gray-50 p-2 text-center text-xs font-bold text-gray-500">SÁB</div>
        `;

        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        // Células vazias do mês anterior
        for (let i = 0; i < firstDay; i++) {
            html += `<div class="bg-white h-32 border-t border-r bg-gray-50/30"></div>`;
        }

        // Dias do mês
        for (let day = 1; day <= daysInMonth; day++) {
            const currentDayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const isToday = new Date().toISOString().split('T')[0] === currentDayStr;
            const holidayName = holidays[currentDayStr];
            
            // Filtra eventos do dia
            let dayEvents = EventosModule.state.events.filter(e => e.Data && e.Data.startsWith(currentDayStr));
            
            // Aplica filtro de categoria
            if (EventosModule.state.filter) {
                dayEvents = dayEvents.filter(e => e.Categoria === EventosModule.state.filter);
            }

            html += `
                <div class="bg-white h-32 p-2 border-t border-r relative hover:bg-gray-50 transition group flex flex-col">
                    <div class="flex justify-between items-start">
                        <span class="text-sm font-bold ${isToday ? 'bg-indigo-600 text-white w-6 h-6 rounded-full flex items-center justify-center' : 'text-gray-700'}">${day}</span>
                        ${holidayName ? `<span class="text-[10px] text-red-500 font-bold truncate ml-2" title="${holidayName}">${holidayName}</span>` : ''}
                        ${canCreate ? `<button onclick="EventosModule.modalEvento('${currentDayStr}')" class="opacity-0 group-hover:opacity-100 text-indigo-600 hover:text-indigo-800 transition"><i class="fas fa-plus-circle"></i></button>` : ''}
                    </div>
                    <div class="mt-1 space-y-1 overflow-y-auto custom-scrollbar flex-1">
                        ${dayEvents.map(e => `
                            <div class="text-xs bg-indigo-100 text-indigo-800 p-1 rounded truncate cursor-pointer hover:bg-indigo-200" title="${e.Titulo}">
                                ${e.Hora ? e.Hora.slice(0,5) : ''} ${e.Titulo}
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        grid.innerHTML = html;
    },

    modalEvento: (date = null) => {
        const d = date ? new Date(date) : new Date();
        const dateStr = d.toISOString().split('T')[0];
        
        // Busca funcionários para o select de responsável (Garçom)
        // Idealmente isso viria do cache global ou de uma chamada específica, 
        // mas vamos tentar pegar do RHModule se disponível ou fazer uma chamada rápida
        // Para simplificar, faremos um input texto com sugestão ou select se tivermos dados
        // Assumindo que podemos pegar do localStorage se o RH já carregou, ou deixar texto livre por enquanto.
        // Melhor: input texto simples para não depender de outro módulo carregado.
        
        Utils.openModal('Novo Evento / Pedido', `
            <form onsubmit="EventosModule.save(event)">
                <div class="mb-3"><label class="text-xs font-bold">Título do Evento</label><input name="Titulo" class="border p-2 rounded w-full" required placeholder="Ex: Aniversário, Coffee Break..."></div>
                <div class="grid grid-cols-2 gap-3 mb-3">
                    <div><label class="text-xs font-bold">Data</label><input type="date" name="Data" value="${dateStr}" class="border p-2 rounded w-full" required></div>
                    <div><label class="text-xs font-bold">Horário</label><input type="time" name="Hora" class="border p-2 rounded w-full"></div>
                </div>
                <div class="grid grid-cols-2 gap-3 mb-3">
                    <div><label class="text-xs font-bold">Cliente</label><input name="Cliente" class="border p-2 rounded w-full"></div>
                    <div><label class="text-xs font-bold">Valor Estimado (Kz)</label><input type="number" step="0.01" name="Valor" class="border p-2 rounded w-full"></div>
                    <div class="col-span-2"><label class="text-xs font-bold">Responsável / Garçom</label><input name="Responsavel" class="border p-2 rounded w-full" placeholder="Quem atendeu?"></div>
                </div>
                <div class="mb-3"><label class="text-xs font-bold">Descrição / Itens</label><textarea name="Descricao" class="border p-2 rounded w-full h-20"></textarea></div>
                <button class="w-full bg-indigo-600 text-white py-2 rounded font-bold">Salvar Evento</button>
            </form>
        `);
    },

    renderPurchaseOrders: () => {
        const container = document.getElementById('purchase-view');
        const items = EventosModule.state.stockItems || [];
        const cart = EventosModule.state.purchaseCart || [];
        const canCreate = Utils.checkPermission('Eventos', 'criar');
        
        // Calcular Total do Carrinho
        const totalGeral = cart.reduce((acc, item) => acc + (item.qty * item.price), 0);

        container.innerHTML = `
            <div class="flex justify-between items-center mb-6">
                <h3 class="text-xl font-bold text-gray-800">Gerar Pedido de Compra</h3>
                <div>
                    ${canCreate ? `<button onclick="EventosModule.savePurchaseOrder()" class="bg-green-600 text-white px-4 py-2 rounded shadow hover:bg-green-700 transition mr-2">
                        <i class="fas fa-save mr-2"></i> Salvar Pedido
                    </button>` : ''}
                    <button onclick="EventosModule.sharePurchaseOrderWhatsApp()" class="bg-green-500 text-white px-4 py-2 rounded shadow hover:bg-green-600 transition mr-2">
                        <i class="fab fa-whatsapp mr-2"></i> WhatsApp
                    </button>
                    <button onclick="EventosModule.printPurchaseOrder()" class="bg-indigo-600 text-white px-4 py-2 rounded shadow hover:bg-indigo-700 transition">
                        <i class="fas fa-print mr-2"></i> Imprimir Pedido
                    </button>
                </div>
            </div>

            <!-- Área de Seleção (Adicionar Item) -->
            <div class="bg-gray-50 p-4 rounded mb-6 border border-gray-200 shadow-sm">
                <h4 class="font-bold text-gray-700 mb-2 text-sm uppercase">Adicionar Item ao Pedido</h4>
                <div class="flex flex-col md:flex-row gap-2 items-end">
                    <div class="flex-1 w-full">
                        <label class="block text-xs font-bold text-gray-500 mb-1">Produto (Estoque)</label>
                        <select id="purchase-product-select" class="border p-2 rounded w-full bg-white">
                            <option value="">Selecione um produto...</option>
                            ${items.sort((a,b) => (a.Nome||'').localeCompare(b.Nome||'')).map(i => 
                                `<option value="${i.ID}">${i.Nome} (Atual: ${i.Quantidade} ${i.Unidade}) - Custo: ${Utils.formatCurrency(i.CustoUnitario)}</option>`
                            ).join('')}
                        </select>
                    </div>
                    <div class="w-full md:w-32">
                        <label class="block text-xs font-bold text-gray-500 mb-1">Quantidade</label>
                        <input type="number" id="purchase-qty-input" class="border p-2 rounded w-full text-center" min="1" value="1">
                    </div>
                    <button onclick="EventosModule.addToCart()" class="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 h-10 font-bold w-full md:w-auto">
                        <i class="fas fa-plus"></i> Adicionar
                    </button>
                </div>
            </div>

            <!-- Tabela de Itens Selecionados -->
            <div class="overflow-x-auto">
                <table class="w-full text-sm text-left" id="purchase-table">
                    <thead class="bg-gray-100 text-gray-600 uppercase">
                        <tr>
                            <th class="p-3">Produto</th>
                            <th class="p-3 text-right">Custo Unit. (Kz)</th>
                            <th class="p-3 text-center w-32">Quantidade</th>
                            <th class="p-3 text-left">Observação</th>
                            <th class="p-3 text-right">Subtotal (Kz)</th>
                            <th class="p-3 text-center">Ações</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y">
                        ${cart.map((item, index) => `
                            <tr>
                                <td class="p-3 font-medium">${item.name}</td>
                                <td class="p-3 text-right">${Utils.formatCurrency(item.price)}</td>
                                <td class="p-3 text-center">
                                    <input type="number" class="border p-1 rounded w-20 text-center" value="${item.qty}" 
                                        onchange="EventosModule.updateCartItem(${index}, 'qty', this.value)">
                                </td>
                                <td class="p-3">
                                    <input type="text" class="border p-1 rounded w-full text-xs" value="${item.obs}" placeholder="Obs..." 
                                        onchange="EventosModule.updateCartItem(${index}, 'obs', this.value)">
                                </td>
                                <td class="p-3 text-right font-bold text-gray-700">${Utils.formatCurrency(item.qty * item.price)}</td>
                                <td class="p-3 text-center">
                                    <button onclick="EventosModule.removeFromCart(${index})" class="text-red-500 hover:text-red-700"><i class="fas fa-trash"></i></button>
                                </td>
                            </tr>
                        `).join('')}
                        ${cart.length === 0 ? '<tr><td colspan="6" class="p-8 text-center text-gray-400 italic">Nenhum item adicionado ao pedido. Selecione acima.</td></tr>' : ''}
                    </tbody>
                    <tfoot>
                        <tr class="bg-gray-100 font-bold text-lg">
                            <td colspan="4" class="p-3 text-right">TOTAL ESTIMADO:</td>
                            <td class="p-3 text-right text-indigo-700">${Utils.formatCurrency(totalGeral)}</td>
                            <td></td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            <!-- Área de Impressão Oculta (Injetada para o PDF funcionar) -->
            <div id="print-area-eventos" class="hidden bg-white p-8">
                <div id="pdf-header"></div>
                <div id="pdf-content" class="mt-6"></div>
            </div>
        `;
    },

    addToCart: () => {
        const select = document.getElementById('purchase-product-select');
        const qtyInput = document.getElementById('purchase-qty-input');
        const id = select.value;
        const qty = parseFloat(qtyInput.value);

        if (!id) return Utils.toast('Selecione um produto.', 'warning');
        if (!qty || qty <= 0) return Utils.toast('Quantidade inválida.', 'warning');

        const item = EventosModule.state.stockItems.find(i => i.ID === id);
        if (!item) return;

        // Verifica se já existe no carrinho
        const existing = EventosModule.state.purchaseCart.find(i => i.id === id);
        if (existing) {
            existing.qty += qty;
        } else {
            EventosModule.state.purchaseCart.push({
                id: item.ID,
                name: item.Nome || item.Item,
                price: Number(item.CustoUnitario || 0),
                qty: qty,
                obs: ''
            });
        }
        
        // Resetar campos
        select.value = '';
        qtyInput.value = 1;
        
        EventosModule.renderPurchaseOrders();
    },

    removeFromCart: (index) => {
        EventosModule.state.purchaseCart.splice(index, 1);
        EventosModule.renderPurchaseOrders();
    },

    updateCartItem: (index, field, value) => {
        if (field === 'qty') {
            const val = parseFloat(value);
            if (val > 0) EventosModule.state.purchaseCart[index].qty = val;
        } else if (field === 'obs') {
            EventosModule.state.purchaseCart[index].obs = value;
        }
        EventosModule.renderPurchaseOrders();
    },

    sharePurchaseOrderWhatsApp: () => {
        const itemsToBuy = EventosModule.state.purchaseCart.map(i => ({
            name: i.name,
            price: i.price,
            qty: i.qty,
            obs: i.obs,
            total: i.qty * i.price
        }));

        if (itemsToBuy.length === 0) return Utils.toast('Selecione pelo menos um item.', 'warning');

        const totalGeral = itemsToBuy.reduce((acc, i) => acc + i.total, 0);
        const user = Utils.getUser();

        let msg = `*🛒 PEDIDO DE COMPRA*\n`;
        msg += `_Solicitante: ${user.Nome || 'Sistema'}_\n`;
        msg += `_Data: ${new Date().toLocaleDateString()}_\n\n`;
        
        msg += `*ITENS DO PEDIDO:*\n`;
        itemsToBuy.forEach(i => {
            msg += `▪️ *${i.name}*\n`;
            msg += `   Qtd: ${i.qty} | Unit: ${Utils.formatCurrency(i.price)}\n`;
            if(i.obs) msg += `   Obs: ${i.obs}\n`;
            msg += `   Subtotal: ${Utils.formatCurrency(i.total)}\n`;
        });
        
        msg += `\n*💰 TOTAL ESTIMADO: ${Utils.formatCurrency(totalGeral)}*`;

        const encodedMsg = encodeURIComponent(msg);

        Utils.openModal('Enviar Pedido por WhatsApp', `
            <div class="text-center">
                <i class="fab fa-whatsapp text-4xl text-green-500 mb-4"></i>
                <p class="text-gray-600 mb-6">O pedido foi gerado. Envie para o fornecedor.</p>
                
                <a href="https://wa.me/?text=${encodedMsg}" target="_blank" class="block w-full bg-green-500 text-white py-3 rounded font-bold hover:bg-green-600 flex items-center justify-center gap-2 transition mb-3 shadow">
                    Enviar para WhatsApp
                </a>
                
                <button onclick="navigator.clipboard.writeText(document.getElementById('msg-preview-pedido').innerText).then(() => Utils.toast('Texto copiado!'))" class="block w-full bg-gray-100 text-gray-700 py-3 rounded font-bold hover:bg-gray-200 flex items-center justify-center gap-2 transition">
                    <i class="fas fa-copy"></i> Copiar Texto
                </button>
                
                <div class="mt-4 text-left bg-gray-50 p-3 rounded border text-xs max-h-48 overflow-y-auto whitespace-pre-wrap font-mono text-gray-600" id="msg-preview-pedido">${msg}</div>
            </div>
        `);
    },

    savePurchaseOrder: async () => {
        const items = EventosModule.state.purchaseCart.map(i => ({
            name: i.name,
            price: i.price,
            qty: i.qty,
            obs: i.obs,
            total: i.qty * i.price
        }));

        if (items.length === 0) return Utils.toast('Selecione pelo menos um item.', 'warning');

        if(!confirm('Deseja salvar este pedido de compra no histórico?')) return;

        const totalGeral = items.reduce((acc, i) => acc + i.total, 0);
        const user = Utils.getUser();

        const pedido = {
            Solicitante: user.Nome || 'Sistema',
            ValorTotal: totalGeral,
            Status: 'Pendente',
            Itens: items
        };

        try {
            await Utils.api('savePurchaseOrder', null, pedido);
            Utils.toast('Pedido de compra salvo com sucesso!', 'success');
            EventosModule.state.purchaseCart = []; // Limpar carrinho
            EventosModule.renderPurchaseOrders();
        } catch (err) {
            Utils.toast('Erro ao salvar pedido: ' + err.message, 'error');
        }
    },

    renderPurchaseHistory: () => {
        const container = document.getElementById('history-view');
        const orders = EventosModule.state.purchaseOrders || [];
        
        // Ordenar por data (mais recente primeiro)
        orders.sort((a, b) => new Date(b.CriadoEm) - new Date(a.CriadoEm));

        container.innerHTML = `
            <h3 class="text-xl font-bold text-gray-800 mb-6">Histórico de Pedidos de Compra</h3>
            <div class="overflow-x-auto">
                <table class="w-full text-sm text-left">
                    <thead class="bg-gray-100 text-gray-600 uppercase">
                        <tr>
                            <th class="p-3">Código</th>
                            <th class="p-3">Data</th>
                            <th class="p-3">Solicitante</th>
                            <th class="p-3 text-right">Valor Total</th>
                            <th class="p-3 text-center">Status</th>
                            <th class="p-3 text-center">Ações</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y">
                        ${orders.map(o => `
                            <tr class="hover:bg-gray-50">
                                <td class="p-3 font-bold">#${o.Codigo}</td>
                                <td class="p-3">${Utils.formatDate(o.DataSolicitacao)}</td>
                                <td class="p-3">${o.Solicitante}</td>
                                <td class="p-3 text-right font-bold">${Utils.formatCurrency(o.ValorTotal)}</td>
                                <td class="p-3 text-center"><span class="px-2 py-1 rounded text-xs bg-yellow-100 text-yellow-800">${o.Status}</span></td>
                                <td class="p-3 text-center">
                                    <button onclick="EventosModule.viewOrderDetails('${o.ID}')" class="text-blue-600 hover:text-blue-800"><i class="fas fa-eye"></i> Detalhes</button>
                                </td>
                            </tr>
                        `).join('')}
                        ${orders.length === 0 ? '<tr><td colspan="6" class="p-4 text-center text-gray-500">Nenhum pedido encontrado.</td></tr>' : ''}
                    </tbody>
                </table>
            </div>
        `;
    },

    renderClientABC: async () => {
        const container = document.getElementById('abc-view');
        container.innerHTML = '<div class="text-center p-10"><i class="fas fa-spinner fa-spin text-4xl text-indigo-600"></i><p class="mt-2">Carregando relatórios...</p></div>';

        try {
            const [abcData, salesData] = await Promise.all([
                Utils.api('getClientABC'),
                Utils.api('getSalesByDayOfWeek')
            ]);
            
            const { clients, totalRevenue } = abcData;
            
            const countA = clients.filter(c => c.classe === 'A').length;
            const countB = clients.filter(c => c.classe === 'B').length;
            const countC = clients.filter(c => c.classe === 'C').length;

            container.innerHTML = `
                <h3 class="text-xl font-bold text-gray-800 mb-6">Relatórios de Eventos</h3>
                
                <h4 class="font-bold text-gray-700 mb-4 border-b pb-2">Curva ABC de Clientes</h4>
                
                <div class="grid grid-cols-3 gap-4 mb-6 text-center">
                    <div class="p-4 bg-green-100 rounded border border-green-200">
                        <div class="text-2xl font-bold text-green-700">Classe A</div>
                        <div class="text-sm text-green-800">${countA} clientes (80% da Receita)</div>
                    </div>
                    <div class="p-4 bg-blue-100 rounded border border-blue-200">
                        <div class="text-2xl font-bold text-blue-700">Classe B</div>
                        <div class="text-sm text-blue-800">${countB} clientes (15% da Receita)</div>
                    </div>
                    <div class="p-4 bg-gray-100 rounded border border-gray-200">
                        <div class="text-2xl font-bold text-gray-700">Classe C</div>
                        <div class="text-sm text-gray-800">${countC} clientes (5% da Receita)</div>
                    </div>
                </div>

                <div class="bg-white rounded shadow overflow-hidden mb-8">
                    <table class="w-full text-sm text-left">
                        <thead class="bg-gray-100 text-gray-600 uppercase">
                            <tr><th class="p-3">Classe</th><th class="p-3">Cliente</th><th class="p-3 text-right">Valor Total</th><th class="p-3 text-right">% Repr.</th></tr>
                        </thead>
                        <tbody class="divide-y">
                            ${clients.map(c => `
                                <tr class="hover:bg-gray-50">
                                    <td class="p-3 font-bold text-center ${c.classe === 'A' ? 'text-green-600 bg-green-50' : (c.classe === 'B' ? 'text-blue-600 bg-blue-50' : 'text-gray-500')}">${c.classe}</td>
                                    <td class="p-3 font-bold">${c.name}</td>
                                    <td class="p-3 text-right">${Utils.formatCurrency(c.value)}</td>
                                    <td class="p-3 text-right text-xs text-gray-500">${c.percent.toFixed(1)}%</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>

                <div class="bg-white p-6 rounded shadow">
                    <h4 class="font-bold text-gray-700 mb-4 border-b pb-2">Vendas por Dia da Semana</h4>
                    <div class="h-64"><canvas id="chartSalesDay"></canvas></div>
                </div>
            `;

            // Renderizar Gráfico
            if (EventosModule.state.charts.salesDay) EventosModule.state.charts.salesDay.destroy();

            EventosModule.state.charts.salesDay = new Chart(document.getElementById('chartSalesDay'), {
                type: 'bar',
                data: {
                    labels: salesData.map(d => d.day),
                    datasets: [{
                        label: 'Total Vendas (Kz)',
                        data: salesData.map(d => d.total),
                        backgroundColor: '#4F46E5',
                        borderRadius: 4,
                        yAxisID: 'y'
                    }, {
                        label: 'Qtd Eventos',
                        data: salesData.map(d => d.count),
                        backgroundColor: '#F59E0B',
                        type: 'line',
                        yAxisID: 'y1'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: { type: 'linear', display: true, position: 'left', beginAtZero: true },
                        y1: { type: 'linear', display: true, position: 'right', beginAtZero: true, grid: { drawOnChartArea: false } }
                    }
                }
            });

        } catch (e) { container.innerHTML = '<p class="text-red-500">Erro ao carregar relatório.</p>'; }
    },

    renderLoyalty: () => {
        const container = document.getElementById('loyalty-view');
        const clients = EventosModule.state.clients || [];
        
        container.innerHTML = `
            <div class="flex justify-between items-center mb-6">
                <h3 class="text-xl font-bold text-gray-800">Programa de Fidelidade</h3>
                <div class="flex gap-2">
                    <button onclick="EventosModule.recalculateLoyalty()" class="bg-yellow-500 text-white px-4 py-2 rounded shadow hover:bg-yellow-600 transition">
                        <i class="fas fa-sync-alt mr-2"></i> Recalcular Pontos
                    </button>
                    <button onclick="EventosModule.modalClient()" class="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700 transition">
                        <i class="fas fa-user-plus mr-2"></i> Novo Cliente
                    </button>
                </div>
            </div>

            <div class="bg-white rounded shadow overflow-hidden">
                <table class="w-full text-sm text-left">
                    <thead class="bg-gray-100 text-gray-600 uppercase">
                        <tr>
                            <th class="p-3">Cliente</th>
                            <th class="p-3">Contato</th>
                            <th class="p-3 text-right">Total Gasto</th>
                            <th class="p-3 text-center">Pontos</th>
                            <th class="p-3 text-center">Última Compra</th>
                            <th class="p-3 text-center">Ações</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y">
                        ${clients.map(c => `
                            <tr class="hover:bg-gray-50">
                                <td class="p-3 font-bold">${c.Nome}</td>
                                <td class="p-3 text-xs">${c.Telefone || '-'} <br> ${c.Email || '-'}</td>
                                <td class="p-3 text-right">${Utils.formatCurrency(c.TotalGasto)}</td>
                                <td class="p-3 text-center">
                                    <span class="bg-purple-100 text-purple-800 px-2 py-1 rounded font-bold">${c.Pontos || 0}</span>
                                </td>
                                <td class="p-3 text-center text-xs">${Utils.formatDate(c.UltimaCompra)}</td>
                                <td class="p-3 text-center">
                                    <button onclick="EventosModule.modalClient('${c.ID}')" class="text-blue-600 hover:text-blue-800 mr-2"><i class="fas fa-edit"></i></button>
                                    <button onclick="EventosModule.deleteClient('${c.ID}')" class="text-red-500 hover:text-red-700"><i class="fas fa-trash"></i></button>
                                </td>
                            </tr>
                        `).join('')}
                        ${clients.length === 0 ? '<tr><td colspan="6" class="p-6 text-center text-gray-500">Nenhum cliente cadastrado.</td></tr>' : ''}
                    </tbody>
                </table>
            </div>
        `;
    },

    modalClient: (id = null) => {
        const client = id ? EventosModule.state.clients.find(c => c.ID === id) : {};
        Utils.openModal(id ? 'Editar Cliente' : 'Novo Cliente', `
            <form onsubmit="EventosModule.saveClient(event)">
                <input type="hidden" name="ID" value="${client.ID || ''}">
                <div class="mb-3"><label class="text-xs font-bold">Nome</label><input name="Nome" value="${client.Nome || ''}" class="border p-2 rounded w-full" required></div>
                <div class="grid grid-cols-2 gap-3 mb-3">
                    <div><label class="text-xs font-bold">Telefone</label><input name="Telefone" value="${client.Telefone || ''}" class="border p-2 rounded w-full"></div>
                    <div><label class="text-xs font-bold">Email</label><input name="Email" value="${client.Email || ''}" class="border p-2 rounded w-full"></div>
                </div>
                <button class="w-full bg-blue-600 text-white py-2 rounded font-bold">Salvar</button>
            </form>
        `);
    },

    saveClient: async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target).entries());
        try { await Utils.api('save', 'Clientes', data); Utils.toast('Cliente salvo!'); Utils.closeModal(); EventosModule.fetchData(); } catch(e) { Utils.toast('Erro.', 'error'); }
    },

    deleteClient: async (id) => {
        if(confirm('Excluir cliente?')) { try { await Utils.api('delete', 'Clientes', null, id); EventosModule.fetchData(); } catch(e) { Utils.toast('Erro.', 'error'); } }
    },

    recalculateLoyalty: async () => {
        try { await Utils.api('recalculateLoyalty'); Utils.toast('Pontos atualizados com sucesso!', 'success'); EventosModule.fetchData(); } catch(e) { Utils.toast('Erro ao recalcular.', 'error'); }
    },

    viewOrderDetails: async (id) => {
        try {
            const items = await Utils.api('getPurchaseOrderDetails', null, { id });
            const order = EventosModule.state.purchaseOrders.find(o => o.ID === id);
            
            let html = `
                <div class="mb-4 grid grid-cols-2 gap-4 text-sm">
                    <div><b>Código:</b> #${order.Codigo}</div>
                    <div><b>Data:</b> ${Utils.formatDate(order.DataSolicitacao)}</div>
                    <div><b>Solicitante:</b> ${order.Solicitante}</div>
                    <div><b>Status:</b> ${order.Status}</div>
                </div>
                <table class="w-full text-sm text-left border">
                    <thead class="bg-gray-100">
                        <tr>
                            <th class="p-2 border">Produto</th>
                            <th class="p-2 border text-center">Qtd</th>
                            <th class="p-2 border text-right">Unit.</th>
                            <th class="p-2 border text-right">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${items.map(i => `
                            <tr>
                                <td class="p-2 border">${i.ProdutoNome} <br> <span class="text-xs text-gray-500">${i.Observacao || ''}</span></td>
                                <td class="p-2 border text-center">${i.Quantidade}</td>
                                <td class="p-2 border text-right">${Utils.formatCurrency(i.CustoUnitario)}</td>
                                <td class="p-2 border text-right font-bold">${Utils.formatCurrency(i.Subtotal)}</td>
                            </tr>
                        `).join('')}
                        <tr class="bg-gray-50 font-bold">
                            <td colspan="3" class="p-2 border text-right">TOTAL</td>
                            <td class="p-2 border text-right">${Utils.formatCurrency(order.ValorTotal)}</td>
                        </tr>
                    </tbody>
                </table>
            `;
            
            Utils.openModal('Detalhes do Pedido', html);
        } catch (e) {
            Utils.toast('Erro ao carregar detalhes: ' + e.message, 'error');
        }
    },

    printPurchaseOrder: () => {
        const itemsToBuy = EventosModule.state.purchaseCart.map(i => ({
            name: i.name,
            price: i.price,
            qty: i.qty,
            obs: i.obs,
            total: i.qty * i.price
        }));

        if (itemsToBuy.length === 0) return Utils.toast('Selecione pelo menos um item.', 'warning');

        const totalGeral = itemsToBuy.reduce((acc, i) => acc + i.total, 0);
        const inst = EventosModule.state.instituicao[0] || {};
        const user = Utils.getUser();

        const element = document.getElementById('print-area-eventos');
        const header = document.getElementById('pdf-header');
        const content = document.getElementById('pdf-content');

        header.innerHTML = `
            <div class="flex items-center gap-4 border-b pb-4 mb-4">
                ${inst.LogotipoURL ? `<img src="${inst.LogotipoURL}" class="h-16 w-auto object-contain">` : ''}
                <div>
                    <h1 class="text-xl font-bold text-gray-800">${inst.NomeFantasia || 'Pedido de Compra'}</h1>
                    <p class="text-xs text-gray-500">${inst.Endereco || ''}</p>
                </div>
            </div>
            <div class="flex justify-between items-end mb-6">
                <div>
                    <h2 class="text-2xl font-bold text-gray-800">PEDIDO DE COMPRA</h2>
                    <p class="text-sm text-gray-500">Data: ${new Date().toLocaleDateString()}</p>
                </div>
                <div class="text-right">
                    <p class="text-sm font-bold">Solicitante:</p>
                    <p class="text-sm">${user.Nome}</p>
                </div>
            </div>
        `;

        content.innerHTML = `
            <table class="w-full text-sm text-left border-collapse">
                <thead class="bg-gray-100 uppercase text-xs">
                    <tr>
                        <th class="p-2 border">Produto</th>
                        <th class="p-2 border text-right">Custo Unit.</th>
                        <th class="p-2 border text-center">Qtd</th>
                        <th class="p-2 border text-left">Obs</th>
                        <th class="p-2 border text-right">Subtotal</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsToBuy.map(i => `
                        <tr>
                            <td class="p-2 border">${i.name}</td>
                            <td class="p-2 border text-right">${Utils.formatCurrency(i.price)}</td>
                            <td class="p-2 border text-center">${i.qty}</td>
                            <td class="p-2 border text-xs text-gray-500">${i.obs || '-'}</td>
                            <td class="p-2 border text-right font-bold">${Utils.formatCurrency(i.total)}</td>
                        </tr>
                    `).join('')}
                    <tr class="bg-gray-50 font-bold">
                        <td colspan="3" class="p-2 border text-right">TOTAL ESTIMADO</td>
                        <td class="p-2 border text-right text-lg">${Utils.formatCurrency(totalGeral)}</td>
                    </tr>
                </tbody>
            </table>
            
            <div class="mt-12 grid grid-cols-2 gap-10">
                <div class="border-t border-black pt-2 text-center text-xs">
                    <p class="font-bold">Aprovado por</p>
                </div>
                <div class="border-t border-black pt-2 text-center text-xs">
                    <p class="font-bold">Recebido por</p>
                </div>
            </div>
        `;

        element.classList.remove('hidden');
        
        const opt = {
            margin: 10,
            filename: `pedido-compra-${new Date().toISOString().split('T')[0]}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        html2pdf().set(opt).from(element).save().then(() => {
            element.classList.add('hidden');
        });
    },

    save: async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target).entries());
        
        // Validação
        if (!data.Titulo || data.Titulo.trim() === '') return Utils.toast('⚠️ O título do evento é obrigatório.');
        if (!data.Data) return Utils.toast('⚠️ A data do evento é obrigatória.');

        try {
            await Utils.api('save', 'Eventos', data);
            Utils.toast('Evento salvo!', 'success'); Utils.closeModal(); EventosModule.fetchData();
        } catch (err) { Utils.toast('Erro ao salvar: ' + err.message, 'error'); }
    }
};

document.addEventListener('DOMContentLoaded', EventosModule.init);