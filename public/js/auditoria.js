const AuditoriaModule = {
    state: {
        logs: [],
        filters: { startDate: '', endDate: '', module: '', user: '' }
    },

    init: () => {
        AuditoriaModule.fetchData();
    },

    fetchData: async () => {
        try {
            const data = await Utils.api('getAuditLogs', null, AuditoriaModule.state.filters);
            AuditoriaModule.state.logs = data || [];
            AuditoriaModule.render();
        } catch (e) {
            console.error("Erro ao carregar auditoria:", e);
            Utils.toast("Erro ao carregar logs.", "error");
        }
    },

    render: () => {
        const container = document.getElementById('auditoria-content');
        if (!container) return;

        const logs = AuditoriaModule.state.logs;

        let html = `
            <div class="bg-white p-4 rounded shadow mb-6">
                <h4 class="font-bold text-gray-700 mb-2">Filtros de Busca</h4>
                <div class="flex flex-wrap gap-4 items-end">
                    <div><label class="block text-xs font-bold text-gray-500">De</label><input type="date" id="audit-start" class="border p-2 rounded text-sm" value="${AuditoriaModule.state.filters.startDate}"></div>
                    <div><label class="block text-xs font-bold text-gray-500">Até</label><input type="date" id="audit-end" class="border p-2 rounded text-sm" value="${AuditoriaModule.state.filters.endDate}"></div>
                    <div><label class="block text-xs font-bold text-gray-500">Módulo</label>
                        <select id="audit-module" class="border p-2 rounded text-sm">
                            <option value="">Todos</option>
                            <option value="Funcionarios">RH</option>
                            <option value="Estoque">Estoque</option>
                            <option value="Financas">Financeiro</option>
                            <option value="Usuarios">Usuários</option>
                            <option value="Inventario">Patrimônio</option>
                        </select>
                    </div>
                    <div><label class="block text-xs font-bold text-gray-500">Usuário</label><input type="text" id="audit-user" placeholder="Nome..." class="border p-2 rounded text-sm" value="${AuditoriaModule.state.filters.user}"></div>
                    <button onclick="AuditoriaModule.applyFilters()" class="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700"><i class="fas fa-search"></i> Buscar</button>
                </div>
            </div>

            <div class="bg-white rounded shadow overflow-hidden">
                <table class="w-full text-sm text-left">
                    <thead class="bg-gray-100 text-gray-600 uppercase">
                        <tr>
                            <th class="p-3">Data/Hora</th>
                            <th class="p-3">Usuário</th>
                            <th class="p-3">Módulo</th>
                            <th class="p-3">Ação</th>
                            <th class="p-3">Descrição</th>
                            <th class="p-3 text-center">Detalhes</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y">
                        ${logs.map(log => `
                            <tr class="hover:bg-gray-50">
                                <td class="p-3 text-gray-500 text-xs">${new Date(log.DataHora).toLocaleString()}</td>
                                <td class="p-3 font-bold">${log.UsuarioNome || 'Sistema'}</td>
                                <td class="p-3"><span class="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs">${log.Modulo || '-'}</span></td>
                                <td class="p-3 font-bold ${log.Acao === 'EXCLUIR' ? 'text-red-600' : (log.Acao === 'CRIAR' ? 'text-green-600' : 'text-blue-600')}">${log.Acao}</td>
                                <td class="p-3 text-gray-700">${log.Descricao}</td>
                                <td class="p-3 text-center">
                                    ${log.DetalhesJSON ? `<button onclick="AuditoriaModule.viewDetails('${log.ID}')" class="text-blue-500 hover:text-blue-700"><i class="fas fa-eye"></i></button>` : '-'}
                                </td>
                            </tr>
                        `).join('')}
                        ${logs.length === 0 ? '<tr><td colspan="6" class="p-8 text-center text-gray-500">Nenhum registro encontrado.</td></tr>' : ''}
                    </tbody>
                </table>
            </div>
        `;
        container.innerHTML = html;
        
        // Restaurar valor do select
        document.getElementById('audit-module').value = AuditoriaModule.state.filters.module;
    },

    applyFilters: () => {
        AuditoriaModule.state.filters.startDate = document.getElementById('audit-start').value;
        AuditoriaModule.state.filters.endDate = document.getElementById('audit-end').value;
        AuditoriaModule.state.filters.module = document.getElementById('audit-module').value;
        AuditoriaModule.state.filters.user = document.getElementById('audit-user').value;
        AuditoriaModule.fetchData();
    },

    viewDetails: (id) => {
        const log = AuditoriaModule.state.logs.find(l => l.ID === id);
        if(log && log.DetalhesJSON) {
            Utils.openModal('Detalhes da Ação', `<pre class="bg-gray-800 text-green-400 p-4 rounded text-xs overflow-auto max-h-96">${JSON.stringify(log.DetalhesJSON, null, 2)}</pre>`);
        }
    }
};

document.addEventListener('DOMContentLoaded', AuditoriaModule.init);