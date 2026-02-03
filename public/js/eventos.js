const EventosModule = {
    state: {
        currentDate: new Date(),
        events: [],
        filter: '',
        stockItems: [],
        purchaseOrders: [],
        view: 'calendar', // 'calendar' or 'list'
        instituicao: []
    },

    init: () => {
        EventosModule.fetchData();
    },

    fetchData: async () => {
        try {
            const [events, inst, stock, orders] = await Promise.all([
                Utils.api('getAll', 'Eventos'),
                Utils.api('getAll', 'InstituicaoConfig'),
                Utils.api('getAll', 'Estoque'),
                Utils.api('getAll', 'PedidosCompra')
            ]);
            EventosModule.state.events = events || [];
            EventosModule.state.instituicao = inst || [];
            EventosModule.state.stockItems = stock || [];
            EventosModule.state.purchaseOrders = orders || [];
        } catch (e) {
            console.log("Erro ao carregar dados.");
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
        
        // Reset classes
        [btnCal, btnList, btnPurch, btnHist].forEach(btn => {
            if(btn) btn.className = 'px-4 py-2 rounded text-sm font-bold text-gray-600 hover:bg-gray-100 transition';
        });

        document.getElementById('calendar-view').classList.add('hidden');
        document.getElementById('list-view').classList.add('hidden');
        document.getElementById('purchase-view').classList.add('hidden');
        document.getElementById('history-view').classList.add('hidden');

        if(view === 'calendar') {
            btnCal.className = 'px-4 py-2 rounded text-sm font-bold bg-indigo-100 text-indigo-700 transition';
            document.getElementById('calendar-view').classList.remove('hidden');
        } else if (view === 'list') {
            btnList.className = 'px-4 py-2 rounded text-sm font-bold bg-indigo-100 text-indigo-700 transition';
            document.getElementById('list-view').classList.remove('hidden');
        } else if (view === 'purchase') {
            btnPurch.className = 'px-4 py-2 rounded text-sm font-bold bg-indigo-100 text-indigo-700 transition';
            document.getElementById('purchase-view').classList.remove('hidden');
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
        else if (EventosModule.state.view === 'list') EventosModule.renderList();
        else if (EventosModule.state.view === 'purchase') EventosModule.renderPurchaseOrders();
        
        if (EventosModule.state.view !== 'purchase') EventosModule.renderCharts();
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
        
        Utils.openModal('Novo Evento / Pedido', `
            <form onsubmit="EventosModule.save(event)">
                <div class="mb-3"><label class="text-xs font-bold">Título do Evento</label><input name="Titulo" class="border p-2 rounded w-full" required placeholder="Ex: Aniversário, Coffee Break..."></div>
                <div class="grid grid-cols-2 gap-3 mb-3">
                    <div><label class="text-xs font-bold">Data</label><input type="date" name="Data" value="${dateStr}" class="border p-2 rounded w-full" required></div>
                    <div><label class="text-xs font-bold">Horário</label><input type="time" name="Hora" class="border p-2 rounded w-full"></div>
                </div>
                <div class="mb-3"><label class="text-xs font-bold">Cliente / Solicitante</label><input name="Cliente" class="border p-2 rounded w-full"></div>
                <div class="mb-3"><label class="text-xs font-bold">Descrição / Itens</label><textarea name="Descricao" class="border p-2 rounded w-full h-20"></textarea></div>
                <button class="w-full bg-indigo-600 text-white py-2 rounded font-bold">Salvar Evento</button>
            </form>
        `);
    },

    renderPurchaseOrders: () => {
        const container = document.getElementById('purchase-view');
        const items = EventosModule.state.stockItems || [];
        const canCreate = Utils.checkPermission('Eventos', 'criar');
        
        // Ordenar itens por nome
        items.sort((a, b) => {
            const nomeA = a.Nome || a.Item || '';
            const nomeB = b.Nome || b.Item || '';
            return nomeA.localeCompare(nomeB);
        });

        container.innerHTML = `
            <div class="flex justify-between items-center mb-6">
                <h3 class="text-xl font-bold text-gray-800">Gerar Pedido de Compra</h3>
                ${canCreate ? `<button onclick="EventosModule.savePurchaseOrder()" class="bg-green-600 text-white px-4 py-2 rounded shadow hover:bg-green-700 transition mr-2">
                    <i class="fas fa-save mr-2"></i> Salvar Pedido
                </button>` : ''}
                <button onclick="EventosModule.printPurchaseOrder()" class="bg-indigo-600 text-white px-4 py-2 rounded shadow hover:bg-indigo-700 transition">
                    <i class="fas fa-print mr-2"></i> Imprimir Pedido
                </button>
            </div>

            <div class="overflow-x-auto">
                <table class="w-full text-sm text-left" id="purchase-table">
                    <thead class="bg-gray-100 text-gray-600 uppercase">
                        <tr>
                            <th class="p-3">Produto</th>
                            <th class="p-3 text-right">Custo Unit. (Kz)</th>
                            <th class="p-3 text-center w-32">Quantidade</th>
                            <th class="p-3 text-left">Observação</th>
                            <th class="p-3 text-right">Subtotal (Kz)</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y">
                        ${items.map(item => {
                            const nome = item.Nome || item.Item || 'Produto sem nome';
                            return `
                            <tr class="hover:bg-gray-50">
                                <td class="p-3 font-medium">${nome} <span class="text-xs text-gray-400">(${item.Unidade || '-'})</span></td>
                                <td class="p-3 text-right" data-price="${item.CustoUnitario || 0}">${Utils.formatCurrency(item.CustoUnitario)}</td>
                                <td class="p-3 text-center">
                                    <input type="number" min="0" step="0.01" class="border p-1 rounded w-24 text-center purchase-qty" 
                                        data-id="${item.ID}" oninput="EventosModule.calcPurchaseTotal(this)">
                                </td>
                                <td class="p-3">
                                    <input type="text" class="border p-1 rounded w-full text-sm purchase-obs" placeholder="Obs...">
                                </td>
                                <td class="p-3 text-right font-bold text-gray-700 purchase-subtotal">0,00</td>
                            </tr>
                        `}).join('')}
                    </tbody>
                    <tfoot>
                        <tr class="bg-gray-100 font-bold text-lg">
                            <td colspan="3" class="p-3 text-right">TOTAL ESTIMADO:</td>
                            <td class="p-3 text-right text-indigo-700" id="purchase-total">Kz 0,00</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        `;
    },

    calcPurchaseTotal: (input) => {
        const row = input.closest('tr');
        const price = parseFloat(row.querySelector('[data-price]').getAttribute('data-price')) || 0;
        const qty = parseFloat(input.value) || 0;
        const subtotal = price * qty;
        
        row.querySelector('.purchase-subtotal').innerText = Utils.formatCurrency(subtotal);
        
        // Atualiza Total Geral
        let total = 0;
        document.querySelectorAll('.purchase-qty').forEach(inp => {
            const r = inp.closest('tr');
            const p = parseFloat(r.querySelector('[data-price]').getAttribute('data-price')) || 0;
            const q = parseFloat(inp.value) || 0;
            total += p * q;
        });
        
        document.getElementById('purchase-total').innerText = Utils.formatCurrency(total);
    },

    getPurchaseItems: () => {
        const itemsToBuy = [];
        document.querySelectorAll('.purchase-qty').forEach(inp => {
            const qty = parseFloat(inp.value) || 0;
            if (qty > 0) {
                const row = inp.closest('tr');
                // Ajuste para pegar apenas o nome do produto, removendo a unidade que está num span
                const name = row.querySelector('td:first-child').childNodes[0].textContent.trim();
                const price = parseFloat(row.querySelector('[data-price]').getAttribute('data-price')) || 0;
                const obs = row.querySelector('.purchase-obs').value;
                itemsToBuy.push({ name, price, qty, obs, total: price * qty });
            }
        });

        return itemsToBuy;
    },

    savePurchaseOrder: async () => {
        const items = EventosModule.getPurchaseItems();
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
            // Opcional: Limpar campos ou recarregar
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
        const itemsToBuy = EventosModule.getPurchaseItems();

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