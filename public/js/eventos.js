const EventosModule = {
    state: {
        currentDate: new Date(),
        events: [],
        filter: '',
        view: 'calendar', // 'calendar' or 'list'
        instituicao: []
    },

    init: () => {
        EventosModule.fetchData();
    },

    fetchData: async () => {
        try {
            const [events, inst] = await Promise.all([
                Utils.api('getAll', 'Eventos'),
                Utils.api('getAll', 'InstituicaoConfig')
            ]);
            EventosModule.state.events = events || [];
            EventosModule.state.instituicao = inst || [];
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
        
        if(view === 'calendar') {
            btnCal.className = 'px-4 py-2 rounded text-sm font-bold bg-indigo-100 text-indigo-700 transition';
            btnList.className = 'px-4 py-2 rounded text-sm font-bold text-gray-600 hover:bg-gray-100 transition';
            document.getElementById('calendar-view').classList.remove('hidden');
            document.getElementById('list-view').classList.add('hidden');
        } else {
            btnList.className = 'px-4 py-2 rounded text-sm font-bold bg-indigo-100 text-indigo-700 transition';
            btnCal.className = 'px-4 py-2 rounded text-sm font-bold text-gray-600 hover:bg-gray-100 transition';
            document.getElementById('list-view').classList.remove('hidden');
            document.getElementById('calendar-view').classList.add('hidden');
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
        else EventosModule.renderList();
        EventosModule.renderCharts();
    },

    renderCalendar: () => {
        const date = EventosModule.state.currentDate;
        const year = date.getFullYear();
        const month = date.getMonth();
        const holidays = EventosModule.getHolidays(year);

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
                        <button onclick="EventosModule.modalEvento('${currentDayStr}')" class="opacity-0 group-hover:opacity-100 text-indigo-600 hover:text-indigo-800 transition"><i class="fas fa-plus-circle"></i></button>
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