const ConfigModule = {
    state: {
        activeTab: 'geral',
        instituicao: {},
        parametros: []
    },

    init: () => {
        ConfigModule.setTab('geral');
    },

    setTab: (tab) => {
        ConfigModule.state.activeTab = tab;
        
        // Atualiza UI dos botões
        document.querySelectorAll('.config-btn').forEach(btn => {
            btn.className = 'config-btn w-full text-left px-4 py-2 rounded text-sm font-medium text-gray-700 hover:bg-gray-100 mb-1';
        });
        const activeBtn = document.getElementById(`btn-${tab}`);
        if(activeBtn) {
            activeBtn.className = 'config-btn w-full text-left px-4 py-2 rounded text-sm font-medium mb-1 bg-blue-50 text-blue-700 border-l-4 border-blue-500';
        }

        // Renderiza conteúdo
        const container = document.getElementById('config-content');
        container.innerHTML = '<div class="text-center py-10"><i class="fas fa-spinner fa-spin text-2xl text-blue-600"></i></div>';

        setTimeout(() => {
            if (tab === 'geral') ConfigModule.renderGeral(container);
            else if (tab === 'usuarios') ConfigModule.renderUsuarios(container);
            else if (tab === 'logs') ConfigModule.renderLogs(container);
            else if (tab === 'rh') ConfigModule.renderParametros(container, 'ParametrosRH', ['TipoContrato', 'Turno', 'Regime', 'SituacaoFuncional']);
            else if (tab === 'cozinha') ConfigModule.renderParametros(container, 'ParametrosCozinha', ['TipoRefeicao', 'AreaProducao', 'UnidadeMedida']);
            else if (tab === 'estoque') ConfigModule.renderParametros(container, 'ParametrosEstoque', ['CategoriaProduto', 'TipoMovimentacao', 'MotivoPerda']);
            else if (tab === 'financeiro') ConfigModule.renderParametros(container, 'ParametrosFinanceiro', ['FormaPagamento', 'Banco', 'Beneficio', 'Desconto']);
        }, 100);
    },

    // --- 1. GERAL (INSTITUIÇÃO & LOGO) ---
    renderGeral: async (container) => {
        try {
            const   = (dat 
            container.innerHTML = `
                <h3 class="text-2xl font-bold text-gray-800 mb-6">🏢 Dados da Instituição</h3>
                <form onsubmit="ConfigModule.saveInstituicao(event)" class="bg-white p-6 rounded shadow max-w-3xl">
                    <input type="hidden" name="ID" value="${dados.ID || ''}">
                    
                    <!-- UPLOAD DE LOGO -->
                    <div class="flex items-center gap-6 mb-6 border-b pb-6">
                        <div class="w-24 h-24 border rounded bg-gray-50 flex items-center justify-center overflow-hidden relative">
                            ${dados.LogotipoURL 
                                ? `<img src="${dados.LogotipoURL}" class="w-full h-full object-contain" id="preview-logo">` 
                                : `<i class="fas fa-image text-3xl text-gray-300" id="icon-logo"></i>`
                            }
                        </div>
                        <div class="flex-1">
                            <label class="block text-sm font-bold text-gray-700 mb-1">Logotipo da Empresa</label>
                            <input type="file" id="logo-input" name="LogoFile" accept="image/*" class="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100">
                            <p class="text-xs text-gray-400 mt-1">Será exibido em relatórios e no topo do sistema.</p>
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-4 mb-4">
                        <div class="col-span-2"><label class="text-sm font-bold">Nome Completo (Razão Social)</label><input name="NomeCompleto" value="${dados.NomeCompleto || ''}" class="border p-2 rounded w-full" required></div>
                        <div><label class="text-sm font-bold">Nome Fantasia</label><input name="NomeFantasia" value="${dados.NomeFantasia || ''}" class="border p-2 rounded w-full"></div>
                        <div><label class="text-sm font-bold">Tipo de Unidade</label>
                            <select name="TipoUnidade" class="border p-2 rounded w-full">
                                <option ${dados.TipoUnidade === 'Cozinha Industrial' ? 'selected' : ''}>Cozinha Industrial</option>
                                <option ${dados.TipoUnidade === 'Restaurante' ? 'selected' : ''}>Restaurante</option>
                                <option ${dados.TipoUnidade === 'Hospital' ? 'selected' : ''}>Hospital</option>
                            </select>
                        </div>
                    </div>
                    <div class="mb-4"><label class="text-sm font-bold">Endereço Completo</label><input name="Endereco" value="${dados.Endereco || ''}" class="border p-2 rounded w-full"></div>
                    <div class="grid grid-cols-3 gap-4 mb-4">
                        <div><label class="text-sm font-bold">Telefone</label><input name="Telefone" value="${dados.Telefone || ''}" class="border p-2 rounded w-full"></div>
                        <div><label class="text-sm font-bold">Email</label><input name="Email" value="${dados.Email || ''}" class="border p-2 rounded w-full"></div>
                        <div><label class="text-sm font-bold">Website</label><input name="Website" value="${dados.Website || ''}" class="border p-2 rounded w-full"></div>
                    </div>
                    <button class="mt-4 bg-blue-600 text-white px-6 py-2 rounded font-bold hover:bg-blue-700 w-full md:w-auto">Salvar Configurações</button>
                </form>
            `;
        } catch (e) { container.innerHTML = '<p class="text-red-500">Erro ao carregar dados.</p>'; }
    },

    saveInstituicao: async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData.entries());
        
        const fileInput = document.getElementById('logo-input');
        
        // Função auxiliar para enviar
        const send = async (payload) => {
            try {
                await Utils.api('save', 'InstituicaoConfig', payload);
                Utils.toast('Dados salvos com sucesso!', 'success');
                ConfigModule.setTab('geral'); // Recarrega para mostrar o logo novo
            } catch (err) { Utils.toast('Erro ao salvar: ' + err.message, 'error'); }
        };

        // Se houver arquivo, converte para Base64
        if (fileInput && fileInput.files[0]) {
            const reader = new FileReader();
            reader.onload = function(evt) {
                data.LogotipoURL = evt.target.result; // Salva a imagem como texto
                delete data.LogoFile; // Remove o objeto arquivo
                send(data);
            };
            reader.readAsDataURL(fileInput.files[0]);
        } else {
            delete data.LogoFile;
            send(data);
        }
    },

    // --- 2. PARÂMETROS GENÉRICOS ---
    renderParametros: async (container, table, types) => {
        try {
            const items = await Utils.api('getAll', table) || [];
            const canDelete = Utils.checkPermission('Configuracoes', 'excluir');

            let html = `<h3 class="text-2xl font-bold text-gray-800 mb-6">Parâmetros: ${table.replace('Parametros', '')}</h3>`;
            html += `<div class="grid grid-cols-1 md:grid-cols-2 gap-6">`;

            types.yp=sfiltered bg-white p-4 rounded shadow">
                        <div class="flex justify-between items-center mb-3 border-b pb-2">
                            <h4 class="font-bold text-gray-700">${type.replace(/([A-Z])/g, ' $1').trim()}</h4>
                            <button onclick="ConfigModule.modalParam('${table}', '${type}')" class="text-blue-600 text-sm hover:underline">+ Adicionar</button>
                        </div>
                        <ul class="space-y-2">
                            ${filtered.length ? filtered.map(item => `
                                <li class="flex justify-between items-center bg-gray-50 p-2 rounded text-sm">
                                    <span>${item.Valor}</span>
                                    >
                            `).join('') : '<li class="text-gray-400 text-xs italic">Nenhum item cadastrado.</li>'}
                        </ul>
                    </div>
                `;
            });
            html += `</div>`;
            container.innerHTML = html;
        } catch (e) { container.innerHTML = '<p class="text-red-500">Erro ao carregar parâmetros.</p>'; }
    },

    modalParam: (table, type) => {
        Utils.openModal(`Novo ${type}`, `
            <form onsubmit="ConfigModule.saveParam(event, '${table}', '${type}')">
                <div class="mb-4">
                    <label class="block text-sm font-bold mb-1">Valor / Nome</label>
                    <input name="Valor" class="border p-2 rounded w-full" required placeholder="Ex: CLT, Manhã, Kg...">
                </div>
                <button class="w-full bg-green-600 text-white py-2 rounded font-bold">Adicionar</button>
            </form>
        `);
    },

    saveParam: async (e, table, type) => {
        e.preventDefault();
        const data = { Tipo: type, Valor: e.target.Valor.value };
        try {
            await Utils.api('save', table, data);
            Utils.toast('Adicionado!', 'success');
            Utils.closeModal();
            ConfigModule.setTab(ConfigModule.state.activeTab);
        } catch (err) { Utils.toast('Erro ao salvar.', 'error'); }
    },

    deleteParam: async (table, id) => {
        ifle, null, id);
            ConfigModule.setTab(ConfigModule.state.activeTab);
        } catch (e) { Utils.toast('Erro ao remover.', 'error'); }
    },

    renderLogs: async (container) => {
        try {
            const logs = await Utils.api('getAll', 'LogsAuditoria') || [];
            logs.sort((a,b) => new Date(b.DataHora) - new Date(a.DataHora));

            container.innerHTML = `
                <h3 class="text-2xl font-bold text-gray-800 mb-6">Logs de Auditoria</h3>
                <div class="bg-white rounded shadow overflow-hidden">
                    <table class="w-full text-sm text-left">
                        <thead class="bg-gray-100 text-gray-600 uppercase"><tr><th class="p-3">Data</th><th class="p-3">Usuário</th><th class="p-3">Ação</th><th class="p-3">Detalhes</th></tr></thead>
                        <tbody class="divide-y">
                            ${logs.slice(0, 50).map(l => `<tr class="hover:bg-gray-50"><td class="p-3 text-xs">${new Date(l.DataHora).toLocaleString()}</td><td class="p-3 font-bold">${l.UsuarioNome || 'Sistema'}</td><td class="p-3"><span class="px-2 py-1 rounded text-xs bg-gray-200">${l.Acao}</span></td><td class="p-3 text-xs text-gray-500">${l.Descricao}</td></tr>`).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        } catch (e) { container.innerHTML = '<p class="text-red-500">Erro ao carregar logs.</p>'; }
    }
};

document.addEventListener('DOMContentLoaded', ConfigModule.init);