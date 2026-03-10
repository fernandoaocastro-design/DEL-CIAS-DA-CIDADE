const EventosModule = {
    state: {
        activeTab: 'visao-geral', // visao-geral, eventos, compras
        activeSubTab: 'dashboard', // Variável conforme a aba principal
        currentDate: new Date(),
        events: [],
        filter: '',
        stockItems: [],
        purchaseOrders: [],
        instituicao: [],
        fichasTecnicas: [], // Para selecionar pratos no menu
        purchaseCart: [], // Carrinho de compras para pedidos
        purchaseCatalogFilter: '',
        purchaseCatalogSupplier: '',
        charts: {},
        clients: []
    },

    init: () => {
        const params = new URLSearchParams(window.location.search);
        const tab = params.get('tab');
        const subTab = params.get('subtab');

        // Permite abrir diretamente a lista de pedidos via URL:
        // eventos.html?tab=compras&subtab=lista
        if (tab === 'compras') {
            EventosModule.state.activeTab = 'compras';
            if (subTab === 'lista' || subTab === 'novo-pedido') {
                EventosModule.state.activeSubTab = subTab;
            }
        } else if (subTab === 'lista' || subTab === 'novo-pedido') {
            EventosModule.state.activeTab = 'compras';
            EventosModule.state.activeSubTab = subTab;
        }

        EventosModule.renderLayout();
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
                Utils.api('getAll', 'Clientes'),
                Utils.api('getAll', 'FichasTecnicas')
            ]);
            
            const [resEvents, resInst, resStock, resOrders, resClients, resFichas] = results;

            EventosModule.state.events = resEvents.status === 'fulfilled' ? resEvents.value : [];
            EventosModule.state.instituicao = resInst.status === 'fulfilled' ? resInst.value : [];
            EventosModule.state.stockItems = resStock.status === 'fulfilled' ? resStock.value : [];
            EventosModule.state.purchaseOrders = resOrders.status === 'fulfilled' ? resOrders.value : [];
            EventosModule.state.clients = resClients.status === 'fulfilled' ? resClients.value : [];
            EventosModule.state.fichasTecnicas = resFichas.status === 'fulfilled' ? resFichas.value : [];

            if (resEvents.status === 'rejected') console.warn('Erro ao carregar Eventos (Tabela inexistente?):', resEvents.reason);
            if (resStock.status === 'rejected') Utils.toast('Erro ao carregar Estoque.', 'error');

        } catch (e) {
            console.log("Erro ao carregar dados.");
            Utils.toast("Erro ao carregar dados de eventos e estoque.", "error");
        }
        EventosModule.render();
    },

    renderLayout: () => {
        const container = document.getElementById('eventos-content');
        if (!container) return;
        
        container.innerHTML = `
            <div class="border-b border-gray-200 mb-6">
                <nav class="-mb-px flex space-x-8" aria-label="Tabs">
                    <button id="tab-visao-geral" onclick="EventosModule.setTab('visao-geral')" class="tab-btn whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200">
                        <i class="fas fa-chart-pie mr-2"></i>Visão Geral
                    </button>
                    <button id="tab-eventos" onclick="EventosModule.setTab('eventos')" class="tab-btn whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200">
                        <i class="fas fa-calendar-alt mr-2"></i>Eventos & Serviço
                    </button>
                    <button id="tab-compras" onclick="EventosModule.setTab('compras')" class="tab-btn whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200">
                        <i class="fas fa-shopping-cart mr-2"></i>Pedidos de Compras
                    </button>
                </nav>
            </div>
            
            <!-- Submenu Container -->
            <div id="submenu-container" class="mb-6 hidden">
                <div class="flex space-x-2 bg-gray-50 p-1 rounded-lg inline-flex" id="submenu-buttons">
                    <!-- Injetado via JS -->
                </div>
            </div>

            <div id="tab-content"></div>
        `;
    },

    setTab: (tab) => {
        EventosModule.state.activeTab = tab;
        
        // Define sub-aba padrão ao trocar de aba principal
        if (tab === 'visao-geral') EventosModule.state.activeSubTab = 'dashboard';
        else if (tab === 'eventos') EventosModule.state.activeSubTab = 'calendario';
        else if (tab === 'compras') EventosModule.state.activeSubTab = 'novo-pedido';

        EventosModule.render();
    },

    setSubTab: (subTab) => {
        EventosModule.state.activeSubTab = subTab;
        EventosModule.render();
    },

    render: () => {
        // Atualiza estilo das abas principais
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('border-indigo-500', 'text-indigo-600');
            btn.classList.add('border-transparent', 'text-gray-500', 'hover:text-gray-700', 'hover:border-gray-300');
        });
        const activeBtn = document.getElementById(`tab-${EventosModule.state.activeTab}`);
        if(activeBtn) {
            activeBtn.classList.remove('border-transparent', 'text-gray-500', 'hover:text-gray-700', 'hover:border-gray-300');
            activeBtn.classList.add('border-indigo-500', 'text-indigo-600');
        }

        // Renderiza Submenus e Conteúdo
        const submenuContainer = document.getElementById('submenu-container');
        const submenuButtons = document.getElementById('submenu-buttons');
        const contentContainer = document.getElementById('tab-content');
        
        if (!contentContainer) return;

        const tab = EventosModule.state.activeTab;
        const subTab = EventosModule.state.activeSubTab;

        // Helper para botões de submenu
        const renderSubBtn = (id, label) => `
            <button onclick="EventosModule.setSubTab('${id}')" class="px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${subTab === id ? 'bg-white text-gray-900 shadow' : 'text-gray-500 hover:text-gray-900'}">
                ${label}
            </button>
        `;

        if (tab === 'visao-geral') {
            submenuContainer.classList.remove('hidden');
            submenuButtons.innerHTML = renderSubBtn('dashboard', 'Relatórios & ABC') + renderSubBtn('fidelidade', 'Fidelidade');
            
            if (subTab === 'dashboard') EventosModule.renderClientABC(contentContainer);
            else if (subTab === 'fidelidade') EventosModule.renderLoyalty(contentContainer);

        } else if (tab === 'eventos') {
            submenuContainer.classList.remove('hidden');
            submenuButtons.innerHTML = 
                renderSubBtn('calendario', 'Calendário') + 
                renderSubBtn('cardapio', 'Cardápio Planejado') + 
                renderSubBtn('equipe', 'Equipe Envolvida');

            if (subTab === 'calendario') EventosModule.renderCalendar(contentContainer);
            else if (subTab === 'cardapio') contentContainer.innerHTML = '<div class="p-10 text-center text-gray-500"><i class="fas fa-utensils text-4xl mb-2"></i><br>Módulo de Cardápio Planejado em desenvolvimento.</div>';
            else if (subTab === 'equipe') contentContainer.innerHTML = '<div class="p-10 text-center text-gray-500"><i class="fas fa-users text-4xl mb-2"></i><br>Módulo de Equipe Envolvida em desenvolvimento.</div>';

        } else if (tab === 'compras') {
            submenuContainer.classList.remove('hidden');
            submenuButtons.innerHTML = renderSubBtn('novo-pedido', 'Novo Pedido') + renderSubBtn('lista', 'Histórico de Pedidos');

            if (subTab === 'novo-pedido') EventosModule.renderPurchaseOrders(contentContainer);
            else if (subTab === 'lista') EventosModule.renderPurchaseHistory(contentContainer);
        }
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

    renderCalendar: (container) => {
        const date = EventosModule.state.currentDate;
        const year = date.getFullYear();
        const month = date.getMonth();
        const holidays = EventosModule.getHolidays(year);
        const canCreate = Utils.checkPermission('Eventos', 'criar');

        // Atualiza Cabeçalho
        const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];        

        container.innerHTML = `
            <div class="flex justify-between items-center mb-4">
                <div class="flex items-center gap-4">
                    <button onclick="EventosModule.changeMonth(-1)" class="text-gray-600 hover:text-indigo-600"><i class="fas fa-chevron-left fa-lg"></i></button>
                    <h2 class="text-xl font-bold text-gray-800 w-48 text-center" id="calendar-month-year">${monthNames[month]} ${year}</h2>
                    <button onclick="EventosModule.changeMonth(1)" class="text-gray-600 hover:text-indigo-600"><i class="fas fa-chevron-right fa-lg"></i></button>
                </div>
                ${canCreate ? `<button onclick="EventosModule.modalEvento()" class="bg-indigo-600 text-white px-4 py-2 rounded shadow hover:bg-indigo-700"><i class="fas fa-plus"></i> Novo Evento</button>` : ''}
            </div>
            <div class="grid grid-cols-7 border-l border-b border-gray-200 bg-white shadow rounded-lg overflow-hidden" id="calendar-grid">
                <!-- Grid injetado abaixo -->
            </div>
        `;
        
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
                        ${canCreate ? `<button onclick="EventosModule.modalEvento(null, '${currentDayStr}')" class="opacity-0 group-hover:opacity-100 text-indigo-600 hover:text-indigo-800 transition"><i class="fas fa-plus-circle"></i></button>` : ''}
                    </div>
                    <div class="mt-1 space-y-1 overflow-y-auto custom-scrollbar flex-1">
                        ${dayEvents.map(e => `
                            <div onclick="EventosModule.modalEvento('${e.ID}')" class="text-xs ${e.Status === 'Confirmado' ? 'bg-green-100 text-green-800' : 'bg-indigo-100 text-indigo-800'} p-1 rounded truncate cursor-pointer hover:opacity-80" title="${e.Titulo}">
                                ${e.Hora ? e.Hora.slice(0,5) : ''} ${e.Titulo}
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        document.getElementById('calendar-grid').innerHTML = html;
    },

    modalEvento: (id = null, date = null) => {
        const event = id ? EventosModule.state.events.find(e => e.ID === id) : {};
        const d = date ? new Date(date) : (event.Data ? new Date(event.Data) : new Date());
        const dateStr = d.toISOString().split('T')[0];
        
        const detalhes = event.DetalhesJSON || {};
        const menu = detalhes.menu || [];
        const custos = detalhes.custos || { ingredientes: 0, equipe: 0, transporte: 0, outros: 0 };
        const equipe = detalhes.equipe || '';
        const checklist = detalhes.checklist || '';

        // Função para alternar abas no modal
        window.switchEventTab = (tabId) => {
            document.querySelectorAll('.evt-tab-content').forEach(el => el.classList.add('hidden'));
            document.getElementById(tabId).classList.remove('hidden');
            document.querySelectorAll('.evt-tab-btn').forEach(el => {
                el.classList.remove('border-indigo-600', 'text-indigo-600');
                el.classList.add('border-transparent', 'text-gray-500');
            });
            document.getElementById('btn-' + tabId).classList.remove('border-transparent', 'text-gray-500');
            document.getElementById('btn-' + tabId).classList.add('border-indigo-600', 'text-indigo-600');
        };

        // Função para adicionar item ao menu
        window.addMenuItem = () => {
            const container = document.getElementById('menu-items-container');
            const idx = Date.now();
            const html = `
                <div class="grid grid-cols-12 gap-2 mb-2 items-center menu-row" id="menu-row-${idx}">
                    <div class="col-span-3">
                        <select name="menu_cat_${idx}" class="border p-2 rounded w-full text-sm">
                            <option>Entrada</option><option>Principal</option><option>Sobremesa</option><option>Bebidas</option><option>Cocktail</option>
                        </select>
                    </div>
                    <div class="col-span-6">
                        <input name="menu_item_${idx}" class="border p-2 rounded w-full text-sm" placeholder="Ex: Risoto de Camarão">
                    </div>
                    <div class="col-span-2">
                        <input type="number" name="menu_qtd_${idx}" class="border p-2 rounded w-full text-sm" placeholder="Qtd">
                    </div>
                    <div class="col-span-1 text-center">
                        <button type="button" onclick="document.getElementById('menu-row-${idx}').remove()" class="text-red-500"><i class="fas fa-times"></i></button>
                    </div>
                </div>
            `;
            container.insertAdjacentHTML('beforeend', html);
        };

        // Função para calcular lucro
        window.calcEventProfit = () => {
            const ing = Number(document.querySelector('[name="custo_ingredientes"]').value || 0);
            const eq = Number(document.querySelector('[name="custo_equipe"]').value || 0);
            const trans = Number(document.querySelector('[name="custo_transporte"]').value || 0);
            const out = Number(document.querySelector('[name="custo_outros"]').value || 0);
            const totalCusto = ing + eq + trans + out;
            
            const contrato = Number(document.querySelector('[name="Valor"]').value || 0);
            const lucro = contrato - totalCusto;
            
            document.getElementById('display-total-custo').innerText = Utils.formatCurrency(totalCusto);
            document.getElementById('display-lucro').innerText = Utils.formatCurrency(lucro);
            
            const lucroEl = document.getElementById('display-lucro');
            if(lucro < 0) lucroEl.className = 'text-xl font-bold text-red-600';
            else lucroEl.className = 'text-xl font-bold text-green-600';
        };

        Utils.openModal(id ? 'Ficha do Evento' : 'Novo Evento', `
            <form onsubmit="EventosModule.save(event)">
                <input type="hidden" name="ID" value="${event.ID || ''}">
                
                <!-- Abas -->
                <div class="flex border-b border-gray-200 mb-4">
                    <button type="button" id="btn-tab-dados" onclick="switchEventTab('tab-dados')" class="evt-tab-btn flex-1 py-2 px-4 text-sm font-medium text-center border-b-2 border-indigo-600 text-indigo-600">Dados Gerais</button>
                    <button type="button" id="btn-tab-menu" onclick="switchEventTab('tab-menu')" class="evt-tab-btn flex-1 py-2 px-4 text-sm font-medium text-center border-b-2 border-transparent text-gray-500 hover:text-gray-700">Cardápio</button>
                    <button type="button" id="btn-tab-custos" onclick="switchEventTab('tab-custos')" class="evt-tab-btn flex-1 py-2 px-4 text-sm font-medium text-center border-b-2 border-transparent text-gray-500 hover:text-gray-700">Custos</button>
                    <button type="button" id="btn-tab-equipe" onclick="switchEventTab('tab-equipe')" class="evt-tab-btn flex-1 py-2 px-4 text-sm font-medium text-center border-b-2 border-transparent text-gray-500 hover:text-gray-700">Equipe</button>
                </div>

                <!-- TAB 1: DADOS -->
                <div id="tab-dados" class="evt-tab-content">
                    <div class="grid grid-cols-2 gap-3 mb-3">
                        <div class="col-span-2"><label class="text-xs font-bold">Nome do Evento</label><input name="Titulo" value="${event.Titulo || ''}" class="border p-2 rounded w-full" required placeholder="Ex: Casamento João & Maria"></div>
                        <div><label class="text-xs font-bold">Tipo de Evento</label>
                            <select name="Categoria" class="border p-2 rounded w-full">
                                <option ${event.Categoria === 'Casamento' ? 'selected' : ''}>Casamento</option>
                                <option ${event.Categoria === 'Cocktail' ? 'selected' : ''}>Cocktail</option>
                                <option ${event.Categoria === 'Aniversário' ? 'selected' : ''}>Aniversário</option>
                                <option ${event.Categoria === 'Corporativo' ? 'selected' : ''}>Corporativo</option>
                                <option ${event.Categoria === 'Outro' ? 'selected' : ''}>Outro</option>
                            </select>
                        </div>
                        <div><label class="text-xs font-bold">Cliente</label><input name="Cliente" value="${event.Cliente || ''}" class="border p-2 rounded w-full"></div>
                    </div>
                    <div class="grid grid-cols-3 gap-3 mb-3">
                        <div><label class="text-xs font-bold">Data</label><input type="date" name="Data" value="${dateStr}" class="border p-2 rounded w-full" required></div>
                        <div><label class="text-xs font-bold">Hora</label><input type="time" name="Hora" value="${event.Hora || ''}" class="border p-2 rounded w-full"></div>
                        <div><label class="text-xs font-bold">Nº Pessoas</label><input type="number" name="Pessoas" value="${event.Pessoas || ''}" class="border p-2 rounded w-full"></div>
                    </div>
                    <div class="grid grid-cols-2 gap-3 mb-3">
                        <div><label class="text-xs font-bold">Local</label><input name="Local" value="${event.Local || ''}" class="border p-2 rounded w-full" placeholder="Salão..."></div>
                        <div><label class="text-xs font-bold">Responsável (Chef)</label><input name="Responsavel" value="${event.Responsavel || ''}" class="border p-2 rounded w-full"></div>
                    </div>
                    <div class="mb-3">
                        <label class="text-xs font-bold">Status</label>
                        <select name="Status" class="border p-2 rounded w-full bg-gray-50">
                            <option ${event.Status === 'Planejado' ? 'selected' : ''}>Planejado</option>
                            <option ${event.Status === 'Orçamento Enviado' ? 'selected' : ''}>Orçamento Enviado</option>
                            <option ${event.Status === 'Confirmado' ? 'selected' : ''}>Confirmado</option>
                            <option ${event.Status === 'Em Execução' ? 'selected' : ''}>Em Execução</option>
                            <option ${event.Status === 'Finalizado' ? 'selected' : ''}>Finalizado</option>
                            <option ${event.Status === 'Cancelado' ? 'selected' : ''}>Cancelado</option>
                        </select>
                    </div>
                </div>

                <!-- TAB 2: CARDÁPIO -->
                <div id="tab-menu" class="evt-tab-content hidden">
                    <div class="flex justify-between items-center mb-2">
                        <h5 class="font-bold text-gray-700 text-sm">Itens do Menu</h5>
                        <button type="button" onclick="addMenuItem()" class="text-xs bg-green-100 text-green-700 px-2 py-1 rounded hover:bg-green-200">+ Adicionar Prato</button>
                    </div>
                    <div id="menu-items-container" class="max-h-64 overflow-y-auto pr-1">
                        ${menu.map((item, idx) => `
                            <div class="grid grid-cols-12 gap-2 mb-2 items-center menu-row" id="menu-row-exist-${idx}">
                                <div class="col-span-3">
                                    <select name="menu_cat_exist_${idx}" class="border p-2 rounded w-full text-sm">
                                        <option ${item.cat === 'Entrada' ? 'selected' : ''}>Entrada</option>
                                        <option ${item.cat === 'Principal' ? 'selected' : ''}>Principal</option>
                                        <option ${item.cat === 'Sobremesa' ? 'selected' : ''}>Sobremesa</option>
                                        <option ${item.cat === 'Bebidas' ? 'selected' : ''}>Bebidas</option>
                                        <option ${item.cat === 'Cocktail' ? 'selected' : ''}>Cocktail</option>
                                    </select>
                                </div>
                                <div class="col-span-6">
                                    <input name="menu_item_exist_${idx}" value="${item.name}" class="border p-2 rounded w-full text-sm">
                                </div>
                                <div class="col-span-2">
                                    <input type="number" name="menu_qtd_exist_${idx}" value="${item.qtd}" class="border p-2 rounded w-full text-sm">
                                </div>
                                <div class="col-span-1 text-center">
                                    <button type="button" onclick="document.getElementById('menu-row-exist-${idx}').remove()" class="text-red-500"><i class="fas fa-times"></i></button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <!-- TAB 3: CUSTOS -->
                <div id="tab-custos" class="evt-tab-content hidden">
                    <div class="bg-gray-50 p-4 rounded border mb-4" oninput="calcEventProfit()">
                        <div class="grid grid-cols-2 gap-4 mb-2">
                            <div><label class="text-xs font-bold">Ingredientes (Kz)</label><input type="number" name="custo_ingredientes" value="${custos.ingredientes}" class="border p-2 rounded w-full"></div>
                            <div><label class="text-xs font-bold">Equipe Extra (Kz)</label><input type="number" name="custo_equipe" value="${custos.equipe}" class="border p-2 rounded w-full"></div>
                        </div>
                        <div class="grid grid-cols-2 gap-4 mb-2">
                            <div><label class="text-xs font-bold">Transporte (Kz)</label><input type="number" name="custo_transporte" value="${custos.transporte}" class="border p-2 rounded w-full"></div>
                            <div><label class="text-xs font-bold">Outros (Kz)</label><input type="number" name="custo_outros" value="${custos.outros}" class="border p-2 rounded w-full"></div>
                        </div>
                        <div class="border-t pt-2 mt-2">
                            <label class="text-sm font-bold text-blue-800">Valor do Contrato (Cobrado)</label>
                            <input type="number" name="Valor" value="${event.Valor || ''}" class="border p-2 rounded w-full font-bold text-blue-800 text-lg">
                        </div>
                    </div>
                    <div class="flex justify-between items-center bg-white p-3 rounded shadow-sm border">
                        <div>
                            <div class="text-xs text-gray-500">Custo Total</div>
                            <div class="text-lg font-bold text-gray-700" id="display-total-custo">Kz 0,00</div>
                        </div>
                        <div class="text-right">
                            <div class="text-xs text-gray-500">Lucro Estimado</div>
                            <div class="text-xl font-bold text-green-600" id="display-lucro">Kz 0,00</div>
                        </div>
                    </div>
                </div>

                <!-- TAB 4: EQUIPE -->
                <div id="tab-equipe" class="evt-tab-content hidden">
                    <div class="mb-3">
                        <label class="text-xs font-bold">Equipe Envolvida</label>
                        <textarea name="equipe_texto" class="border p-2 rounded w-full h-24" placeholder="Cozinheiros, Garçons, Motoristas...">${equipe}</textarea>
                    </div>
                    <div class="mb-3">
                        <label class="text-xs font-bold">Checklist de Logística</label>
                        <textarea name="checklist_texto" class="border p-2 rounded w-full h-24" placeholder="- Mesas\n- Pratos\n- Fornos...">${checklist}</textarea>
                    </div>
                </div>

                <div class="flex justify-between mt-6 pt-4 border-t">
                    ${id ? `<button type="button" onclick="EventosModule.printEventSheet('${id}')" class="text-gray-600 hover:text-gray-800"><i class="fas fa-print"></i> Imprimir Ficha</button>` : '<div></div>'}
                    <button class="bg-indigo-600 text-white px-6 py-2 rounded font-bold shadow hover:bg-indigo-700">Salvar Evento</button>
                </div>
            </form>
        `);
        
        // Inicializa cálculos
        setTimeout(calcEventProfit, 100);
    },

    renderPurchaseOrders: (container) => {
        const items = EventosModule.state.stockItems || [];
        const cart = EventosModule.state.purchaseCart || [];
        const filterTerm = String(EventosModule.state.purchaseCatalogFilter || '').trim().toLowerCase();
        const supplierFilter = String(EventosModule.state.purchaseCatalogSupplier || '').trim();
        const canCreate = Utils.checkPermission('Eventos', 'criar');
        const suppliers = [...new Set(
            items
                .map(i => String(i.Fornecedor || '').trim())
                .filter(Boolean)
        )].sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
        const catalogItems = items
            .filter(i => {
                const fornecedorRaw = String(i.Fornecedor || '').trim();
                if (supplierFilter && fornecedorRaw !== supplierFilter) return false;
                if (!filterTerm) return true;
                const nome = String(i.Nome || i.Item || '').toLowerCase();
                const fornecedor = fornecedorRaw.toLowerCase();
                const codigo = String(i.Codigo || '').toLowerCase();
                return nome.includes(filterTerm) || fornecedor.includes(filterTerm) || codigo.includes(filterTerm);
            })
            .sort((a, b) => String(a.Nome || a.Item || '').localeCompare(String(b.Nome || b.Item || ''), 'pt-BR', { sensitivity: 'base' }));

        // Calcular Total do Carrinho
        const totalGeral = cart.reduce((acc, item) => acc + (item.qty * item.price), 0);

        container.innerHTML = `
            <div class="flex justify-between items-center mb-6">
                <h3 class="text-xl font-bold text-gray-800">Gerar Pedido de Compra</h3>
                <div>
                    <button onclick="EventosModule.goToStock()" class="bg-slate-700 text-white px-4 py-2 rounded shadow hover:bg-slate-800 transition mr-2">
                        <i class="fas fa-boxes mr-2"></i> Ir para Estoque
                    </button>
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

            <div class="bg-gray-50 p-4 rounded mb-6 border border-gray-200 shadow-sm">
                <div class="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-3">
                    <div>
                        <h4 class="font-bold text-gray-700 text-sm uppercase">Catalogo do Estoque</h4>
                        <p class="text-xs text-gray-500">Adicione produtos ao carrinho informando a quantidade de compra.</p>
                    </div>
                    <div class="w-full md:w-auto grid grid-cols-1 md:grid-cols-2 gap-3 md:min-w-[580px]">
                        <div>
                            <label class="block text-xs font-bold text-gray-500 mb-1">Buscar Produto / Fornecedor</label>
                            <input type="text" value="${EventosModule.state.purchaseCatalogFilter || ''}" oninput="EventosModule.setPurchaseCatalogFilter(this.value)" class="border p-2 rounded w-full bg-white" placeholder="Ex: arroz, fornecedor...">
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-500 mb-1">Filtrar por Fornecedor</label>
                            <select onchange="EventosModule.setPurchaseSupplierFilter(this.value)" class="border p-2 rounded w-full bg-white">
                                <option value="">Todos os fornecedores</option>
                                ${suppliers.map(f => `<option value="${f}" ${EventosModule.state.purchaseCatalogSupplier === f ? 'selected' : ''}>${f}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                </div>
                <div class="overflow-x-auto">
                    <table class="w-full text-sm">
                        <thead class="bg-white border-b">
                            <tr class="text-gray-600 uppercase text-xs">
                                <th class="p-2 text-left">Produto</th>
                                <th class="p-2 text-left">Fornecedor</th>
                                <th class="p-2 text-right">Preco Unit.</th>
                                <th class="p-2 text-center">Estoque Atual</th>
                                <th class="p-2 text-center w-36">Qtd Comprar</th>
                                <th class="p-2 text-center">Acao</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y">
                            ${catalogItems.map((i, idx) => `
                                <tr class="bg-white hover:bg-gray-50">
                                    <td class="p-2 font-medium text-gray-800">${i.Nome || i.Item || 'Produto sem nome'}</td>
                                    <td class="p-2 text-gray-600">${i.Fornecedor || '-'}</td>
                                    <td class="p-2 text-right font-bold">${Utils.formatCurrency(i.CustoUnitario || 0)}</td>
                                    <td class="p-2 text-center">${Number(i.Quantidade || 0)} ${i.Unidade || ''}</td>
                                    <td class="p-2 text-center">
                                        <input id="purchase-catalog-qty-${idx}" type="number" min="0.01" step="0.01" value="1" class="border p-1.5 rounded w-24 text-center">
                                    </td>
                                    <td class="p-2 text-center">
                                        <button onclick="EventosModule.addToCartFromStock('${i.ID}', 'purchase-catalog-qty-${idx}')" class="bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 font-bold text-xs">+ Carrinho</button>
                                    </td>
                                </tr>
                            `).join('')}
                            ${catalogItems.length === 0 ? '<tr><td colspan="6" class="p-4 text-center text-gray-400 italic">Nenhum produto encontrado no estoque para este filtro.</td></tr>' : ''}
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Tabela de Itens Selecionados -->
            <div class="overflow-x-auto">
                <table class="w-full text-sm text-left" id="purchase-table">
                    <thead class="bg-gray-100 text-gray-600 uppercase">
                        <tr>
                            <th class="p-3">Produto</th>
                            <th class="p-3">Fornecedor</th>
                            <th class="p-3 text-right">Custo Unit. (Kz)</th>
                            <th class="p-3 text-center w-32">Quantidade</th>
                            <th class="p-3 text-left">Observacao</th>
                            <th class="p-3 text-right">Subtotal (Kz)</th>
                            <th class="p-3 text-center">Acoes</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y">
                        ${cart.map((item, index) => `
                            <tr>
                                <td class="p-3 font-medium">${item.name}</td>
                                <td class="p-3 text-gray-600">${item.supplier || '-'}</td>
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
                        ${cart.length === 0 ? '<tr><td colspan="7" class="p-8 text-center text-gray-400 italic">Nenhum item no carrinho. Adicione produtos do catalogo acima.</td></tr>' : ''}
                    </tbody>
                    <tfoot>
                        <tr class="bg-gray-100 font-bold text-lg">
                            <td colspan="5" class="p-3 text-right">TOTAL ESTIMADO:</td>
                            <td class="p-3 text-right text-indigo-700">${Utils.formatCurrency(totalGeral)}</td>
                            <td></td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            <!-- Area de Impressao Oculta (Injetada para o PDF funcionar) -->
            <div id="print-area-eventos" class="hidden bg-white p-8">
                <div id="pdf-header"></div>
                <div id="pdf-content" class="mt-6"></div>
            </div>
        `;
    },

    setPurchaseCatalogFilter: (term) => {
        EventosModule.state.purchaseCatalogFilter = term;
        EventosModule.render();
    },

    setPurchaseSupplierFilter: (supplier) => {
        EventosModule.state.purchaseCatalogSupplier = supplier;
        EventosModule.render();
    },

    addToCartFromStock: (id, qtyInputId) => {
        const qtyInput = document.getElementById(qtyInputId);
        const qty = parseFloat(qtyInput ? qtyInput.value : '0');

        if (!id) return Utils.toast('Selecione um produto.', 'warning');
        if (!qty || qty <= 0) return Utils.toast('Quantidade invalida.', 'warning');

        const item = EventosModule.state.stockItems.find(i => i.ID === id);
        if (!item) return;

        const existing = EventosModule.state.purchaseCart.find(i => i.id === id);
        if (existing) {
            existing.qty += qty;
        } else {
            EventosModule.state.purchaseCart.push({
                id: item.ID,
                name: item.Nome || item.Item,
                supplier: item.Fornecedor || '',
                price: Number(item.CustoUnitario || 0),
                qty: qty,
                obs: ''
            });
        }

        if (qtyInput) qtyInput.value = 1;
        EventosModule.render();
    },

    // Compatibilidade: fluxo antigo por select foi substituido pelo catalogo.
    addToCart: () => {
        Utils.toast('Use o catalogo de estoque para adicionar itens ao carrinho.', 'info');
    },

    removeFromCart: (index) => {
        EventosModule.state.purchaseCart.splice(index, 1);
        EventosModule.render();
    },

    updateCartItem: (index, field, value) => {
        if (field === 'qty') {
            const val = parseFloat(value);
            if (val > 0) EventosModule.state.purchaseCart[index].qty = val;
        } else if (field === 'obs') {
            EventosModule.state.purchaseCart[index].obs = value;
        }
        EventosModule.render();
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
        const user = Utils.getUser() || {};

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
            id: i.id,
            name: i.name,
            supplier: i.supplier,
            price: i.price,
            qty: i.qty,
            obs: i.obs,
            total: i.qty * i.price
        }));

        if (items.length === 0) return Utils.toast('Selecione pelo menos um item.', 'warning');

        if(!confirm('Deseja salvar este pedido de compra no histórico?')) return;

        const totalGeral = items.reduce((acc, i) => acc + i.total, 0);
        const user = Utils.getUser() || {};

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
            EventosModule.render();
        } catch (err) {
            Utils.toast('Erro ao salvar pedido: ' + err.message, 'error');
        }
    },

    goToStock: () => {
        window.location.href = 'estoque.html';
    },

    renderPurchaseHistory: (container) => {
        const orders = EventosModule.state.purchaseOrders || [];
        
        // Ordenar por data (mais recente primeiro)
        orders.sort((a, b) => new Date(b.CriadoEm) - new Date(a.CriadoEm));

        container.innerHTML = `
            <div class="flex justify-between items-center mb-6 gap-3">
                <h3 class="text-xl font-bold text-gray-800">Histórico de Pedidos de Compra</h3>
                <button onclick="EventosModule.goToStock()" class="bg-slate-700 text-white px-4 py-2 rounded shadow hover:bg-slate-800 transition">
                    <i class="fas fa-boxes mr-2"></i> Ir para Estoque
                </button>
            </div>
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

    renderClientABC: async (container) => {
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

    renderLoyalty: (container) => {
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
            supplier: i.supplier || '',
            price: i.price,
            qty: i.qty,
            obs: i.obs,
            total: i.qty * i.price
        }));

        if (itemsToBuy.length === 0) return Utils.toast('Selecione pelo menos um item.', 'warning');

        const totalGeral = itemsToBuy.reduce((acc, i) => acc + i.total, 0);
        const inst = EventosModule.state.instituicao[0] || {};
        const user = Utils.getUser() || {};
        const showLogo = inst.ExibirLogoRelatorios;

        const element = document.getElementById('print-area-eventos');
        const header = document.getElementById('pdf-header');
        const content = document.getElementById('pdf-content');

        header.innerHTML = `
            <div class="flex items-center justify-between border-b-2 border-gray-800 pb-4 mb-6">
                <div class="${showLogo && inst.LogotipoURL ? 'flex items-center gap-4' : ''}">
                    ${showLogo && inst.LogotipoURL ? `<img src="${inst.LogotipoURL}" class="h-16 w-auto object-contain" crossorigin="anonymous">` : ''}
                    <div>
                        <h1 class="text-2xl font-bold text-gray-800">${inst.NomeFantasia || 'Pedido de Compra'}</h1>
                        <p class="text-sm text-gray-500">${inst.Endereco || ''}</p>
                    </div>
                </div>
                <div class="text-right">
                    <h2 class="text-xl font-bold">PEDIDO DE COMPRA</h2>
                    <p class="text-sm text-gray-500">Data: ${new Date().toLocaleDateString()}</p>
                    <p class="text-sm text-gray-500">Solicitante: ${user.Nome || 'Sistema'}</p>
                </div>
            </div>
        `;

        content.innerHTML = `
            <div class="overflow-x-auto bg-white rounded shadow">
                <table class="w-full text-sm">
                    <thead class="bg-gray-100">
                        <tr>
                            <th class="p-3 text-left">Produto</th>
                            <th class="p-3 text-left">Fornecedor</th>
                            <th class="p-3 text-right">Custo Unitário</th>
                            <th class="p-3 text-center">Qtd</th>
                            <th class="p-3 text-right">Subtotal</th>
                            <th class="p-3 text-left">Observação</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsToBuy.map(i => `
                            <tr class="border-t">
                                <td class="p-3 font-bold">${i.name}</td>
                                <td class="p-3 text-xs text-gray-600">${i.supplier || '-'}</td>
                                <td class="p-3 text-right">${Utils.formatCurrency(i.price)}</td>
                                <td class="p-3 text-center font-bold">${i.qty}</td>
                                <td class="p-3 text-right font-bold text-green-700">${Utils.formatCurrency(i.total)}</td>
                                <td class="p-3 text-xs text-gray-500">${i.obs || '-'}</td>
                            </tr>
                        `).join('')}
                        <tr class="border-t bg-gray-50 font-bold">
                            <td colspan="4" class="p-3 text-right">TOTAL ESTIMADO</td>
                            <td class="p-3 text-right text-green-700">${Utils.formatCurrency(totalGeral)}</td>
                            <td class="p-3 text-xs text-gray-500">Pedido gerado no módulo Eventos.</td>
                        </tr>
                    </tbody>
                </table>
                <div class="p-4 border-t text-center text-xs text-gray-400">
                    &copy; 2026 Delicia da Cidade. Todos os direitos reservados. | Versao 1.0.0
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
        
        // Fallback opcional para impressão nativa se necessário
        // const html = element.innerHTML;
        // Utils.printNative(html);
    },

    save: async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData.entries());
        
        // Validação
        if (!data.Titulo || data.Titulo.trim() === '') return Utils.toast('⚠️ O título do evento é obrigatório.');
        if (!data.Data) return Utils.toast('⚠️ A data do evento é obrigatória.');

        // Processar Menu (Itens Dinâmicos)
        const menu = [];
        for (const [key, value] of formData.entries()) {
            if (key.startsWith('menu_item_')) {
                const suffix = key.replace('menu_item_', '');
                const cat = formData.get(`menu_cat_${suffix}`);
                const qtd = formData.get(`menu_qtd_${suffix}`);
                if (value) menu.push({ cat, name: value, qtd });
            }
        }

        // Processar Custos e Detalhes
        const detalhes = {
            menu: menu,
            custos: {
                ingredientes: Number(data.custo_ingredientes || 0),
                equipe: Number(data.custo_equipe || 0),
                transporte: Number(data.custo_transporte || 0),
                outros: Number(data.custo_outros || 0)
            },
            equipe: data.equipe_texto,
            checklist: data.checklist_texto
        };

        // Limpar campos auxiliares do objeto principal
        Object.keys(data).forEach(k => {
            if (k.startsWith('menu_') || k.startsWith('custo_') || k.endsWith('_texto')) delete data[k];
        });

        data.DetalhesJSON = detalhes;

        try {
            await Utils.api('save', 'Eventos', data);
            Utils.toast('Evento salvo!', 'success'); Utils.closeModal(); EventosModule.fetchData();
        } catch (err) { Utils.toast('Erro ao salvar: ' + err.message, 'error'); }
    },

    printEventSheet: (id) => {
        const event = EventosModule.state.events.find(e => e.ID === id);
        if (!event) return;

        const detalhes = event.DetalhesJSON || {};
        const menu = detalhes.menu || [];
        const inst = EventosModule.state.instituicao[0] || {};
        const showLogo = inst.ExibirLogoRelatorios;

        const html = `
            <div class="p-8 font-sans text-gray-900 bg-white border-2 border-gray-800 max-w-3xl mx-auto">
                <div class="flex justify-between items-center border-b-2 border-gray-800 pb-4 mb-6">
                    <div class="flex items-center gap-4">
                        ${showLogo && inst.LogotipoURL ? `<img src="${inst.LogotipoURL}" class="h-16 w-auto object-contain">` : ''}
                        <div>
                            <h1 class="text-2xl font-bold uppercase">${inst.NomeFantasia || 'Delícia da Cidade'}</h1>
                            <p class="text-sm">FICHA DE EVENTO / ORDEM DE SERVIÇO</p>
                        </div>
                    </div>
                    <div class="text-right">
                        <h2 class="text-xl font-bold">EVT-${event.ID.slice(0,6).toUpperCase()}</h2>
                        <p class="text-sm font-bold ${event.Status === 'Confirmado' ? 'text-green-700' : 'text-gray-500'}">${event.Status.toUpperCase()}</p>
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-6 mb-6 bg-gray-50 p-4 rounded border">
                    <div><span class="font-bold block text-xs text-gray-500 uppercase">Evento</span> ${event.Titulo}</div>
                    <div><span class="font-bold block text-xs text-gray-500 uppercase">Cliente</span> ${event.Cliente || '-'}</div>
                    <div><span class="font-bold block text-xs text-gray-500 uppercase">Data & Hora</span> ${Utils.formatDate(event.Data)} às ${event.Hora || '-'}</div>
                    <div><span class="font-bold block text-xs text-gray-500 uppercase">Local</span> ${event.Local || '-'}</div>
                    <div><span class="font-bold block text-xs text-gray-500 uppercase">Nº Pessoas</span> ${event.Pessoas || 0}</div>
                    <div><span class="font-bold block text-xs text-gray-500 uppercase">Responsável</span> ${event.Responsavel || '-'}</div>
                </div>

                <h3 class="font-bold text-gray-800 border-b border-gray-400 mb-2 uppercase text-sm">Cardápio Selecionado</h3>
                <table class="w-full text-sm mb-6 border-collapse border border-gray-300">
                    <thead class="bg-gray-100"><tr><th class="border p-2 text-left">Categoria</th><th class="border p-2 text-left">Prato / Item</th><th class="border p-2 text-center">Qtd</th></tr></thead>
                    <tbody>
                        ${menu.map(m => `<tr><td class="border p-2 font-bold text-gray-600">${m.cat}</td><td class="border p-2">${m.name}</td><td class="border p-2 text-center">${m.qtd || '-'}</td></tr>`).join('')}
                    </tbody>
                </table>

                <div class="grid grid-cols-2 gap-8 mb-8">
                    <div>
                        <h3 class="font-bold text-gray-800 border-b border-gray-400 mb-2 uppercase text-sm">Equipe & Staff</h3>
                        <p class="text-sm whitespace-pre-wrap">${detalhes.equipe || 'Não definido'}</p>
                    </div>
                    <div>
                        <h3 class="font-bold text-gray-800 border-b border-gray-400 mb-2 uppercase text-sm">Logística & Obs</h3>
                        <p class="text-sm whitespace-pre-wrap">${detalhes.checklist || 'Sem observações'}</p>
                    </div>
                </div>

                <div class="mt-12 border-t border-gray-800 pt-2 flex justify-between text-xs text-gray-500">
                    <span>Gerado em ${new Date().toLocaleString()}</span>
                    <span>Assinatura do Responsável: __________________________</span>
                </div>
            </div>
        `;
        Utils.printNative(html);
    }
};

document.addEventListener('DOMContentLoaded', EventosModule.init);

