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
            const data = await Utils.api('getAll', 'InstituicaoConfig');
            const dados = (data && data[0]) ? data[0] : {};
            ConfigModule.state.instituicao = dados;

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
                    
                    <h4 class="font-bold text-gray-700 mb-2 border-b pb-1 mt-4">Personalização de Relatórios</h4>
                    <div class="grid grid-cols-2 gap-4 mb-4 bg-gray-50 p-3 rounded border">
                        <div class="flex items-center gap-2">
                            <input type="checkbox" name="ExibirLogoRelatorios" ${dados.ExibirLogoRelatorios ? 'checked' : ''} class="rounded text-blue-600 focus:ring-blue-500 h-5 w-5">
                            <span class="text-sm font-bold text-gray-700">Exibir Logotipo</span>
                        </div>
                        <div>
                            <label class="text-sm font-bold mr-2">Cor Principal:</label>
                            <input type="color" name="CorRelatorios" value="${dados.CorRelatorios || '#3B82F6'}" class="border p-1 rounded h-8 w-20 align-middle cursor-pointer">
                        </div>
                        <div class="col-span-2 mt-2">
                            <label class="text-sm font-bold mr-2">Porcentagem do Subsídio de Férias (%):</label>
                            <input type="number" name="SubsidioFeriasPorcentagem" value="${dados.SubsidioFeriasPorcentagem || 50}" class="border p-2 rounded w-24" min="0" max="100" step="0.1">
                        </div>
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
        data.ExibirLogoRelatorios = !!formData.get('ExibirLogoRelatorios');
        
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
            const canCreate = Utils.checkPermission('Configuracoes', 'criar');
            const canDelete = Utils.checkPermission('Configuracoes', 'excluir');

            let html = `<h3 class="text-2xl font-bold text-gray-800 mb-6">Parâmetros: ${table.replace('Parametros', '')}</h3>`;
            html += `<div class="grid grid-cols-1 md:grid-cols-2 gap-6">`;

            types.forEach(type => {
                const filtered = items.filter(i => i.Tipo === type);
                html += `
                    <div class="bg-white p-4 rounded shadow">
                        <div class="flex justify-between items-center mb-3 border-b pb-2">
                            <h4 class="font-bold text-gray-700">${type.replace(/([A-Z])/g, ' $1').trim()}</h4>
                            ${canCreate ? `<button onclick="ConfigModule.modalParam('${table}', '${type}')" class="text-blue-600 text-sm hover:underline">+ Adicionar</button>` : ''}
                        </div>
                        <ul class="space-y-2">
                            ${filtered.length ? filtered.map(item => `
                                <li class="flex justify-between items-center bg-gray-50 p-2 rounded text-sm">
                                    <span>${item.Valor}</span>
                                    <button onclick="ConfigModule.deleteParam('${table}', '${item.ID}')" class="text-red-500 hover:text-red-700"><i class="fas fa-trash"></i></button>
                                </li>
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
        if(!confirm('Remover este item?')) return;
        try {
            await Utils.api('delete', table, null, id);
            ConfigModule.setTab(ConfigModule.state.activeTab);
        } catch (e) { Utils.toast('Erro ao remover.', 'error'); }
    },

    // --- 3. USUÁRIOS ---
    renderUsuarios: async (container) => {
        try {
            const users = await Utils.api('getAll', 'Usuarios') || [];
            const canCreate = Utils.checkPermission('Configuracoes', 'criar');
            const canEdit = Utils.checkPermission('Configuracoes', 'editar');
            const canDelete = Utils.checkPermission('Configuracoes', 'excluir');

            container.innerHTML = `
                <div class="flex justify-between items-center mb-6">
                    <h3 class="text-2xl font-bold text-gray-800">Gestão de Usuários</h3>
                    ${canCreate ? `<button onclick="ConfigModule.modalUsuario()" class="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700 transition">
                        <i class="fas fa-user-plus mr-2"></i> Novo Usuário
                    </button>` : ''}
                </div>

                <div class="bg-white rounded shadow overflow-hidden">
                    <table class="w-full text-sm text-left">
                        <thead class="bg-gray-100 text-gray-600 uppercase">
                            <tr>
                                <th class="p-3">Nome</th>
                                <th class="p-3">Email</th>
                                <th class="p-3">Cargo</th>
                                <th class="p-3">Status</th>
                                <th class="p-3 text-center">Ações</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y">
                            ${users.map(u => `
                                <tr class="hover:bg-gray-50">
                                    <td class="p-3 font-bold">${u.Nome}</td>
                                    <td class="p-3">${u.Email}</td>
                                    <td class="p-3">${u.Cargo || '-'}</td>
                                    <td class="p-3"><span class="px-2 py-1 rounded text-xs ${u.Status === 'Ativo' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">${u.Status}</span></td>
                                    <td class="p-3 text-center">
                                        ${canEdit ? `<button onclick="ConfigModule.modalUsuario('${u.ID}')" class="text-blue-500 hover:text-blue-700 mr-2"><i class="fas fa-edit"></i></button>` : ''}
                                        ${canDelete ? `<button onclick="ConfigModule.deleteUsuario('${u.ID}')" class="text-red-500 hover:text-red-700"><i class="fas fa-trash"></i></button>` : ''}
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        } catch (e) { container.innerHTML = '<p class="text-red-500">Erro ao carregar usuários.</p>'; }
    },

    modalUsuario: async (id = null) => {
        let user = {};
        if (id) {
            const users = await Utils.api('getAll', 'Usuarios');
            user = users.find(u => u.ID === id) || {};
        }

        // Geração da Tabela de Permissões
        const modules = ['Dashboard', 'RH', 'Estoque', 'Producao', 'Eventos', 'MLPain', 'Financas', 'Inventario', 'Configuracoes'];
        const actions = ['ver', 'criar', 'editar', 'excluir'];
        const perms = user.Permissoes || {};

        let permsHtml = '<div class="mt-4 border-t pt-4"><h5 class="font-bold text-gray-700 mb-2">Permissões de Acesso</h5><div class="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-60 overflow-y-auto border p-2 rounded bg-gray-50">';
        
        modules.forEach(mod => {
            permsHtml += `<div class="bg-white p-2 rounded border shadow-sm">
                <div class="font-bold text-xs mb-1 border-b pb-1 text-gray-600">${mod}</div>
                <div class="flex flex-wrap gap-2">`;
            
            actions.forEach(act => {
                const isChecked = (perms[mod] && perms[mod][act]) ? 'checked' : '';
                permsHtml += `<label class="flex items-center gap-1 text-[10px] cursor-pointer hover:bg-gray-100 px-1 rounded select-none">
                    <input type="checkbox" name="perm_${mod}_${act}" ${isChecked} class="rounded text-blue-600 focus:ring-blue-500"> ${act.charAt(0).toUpperCase() + act.slice(1)}
                </label>`;
            });
            
            permsHtml += `</div></div>`;
        });
        permsHtml += '</div></div>';

        Utils.openModal(id ? 'Editar Usuário' : 'Novo Usuário', `
            <form onsubmit="ConfigModule.saveUsuario(event)">
                <input type="hidden" name="ID" value="${user.ID || ''}">
                <div class="mb-3">
                    <label class="text-xs font-bold">Nome Completo</label>
                    <input name="Nome" value="${user.Nome || ''}" class="border p-2 rounded w-full" required>
                </div>
                <div class="mb-3">
                    <label class="text-xs font-bold">Email</label>
                    <input type="email" name="Email" value="${user.Email || ''}" class="border p-2 rounded w-full" required>
                </div>
                <div class="grid grid-cols-2 gap-3 mb-3">
                    <div>
                        <label class="text-xs font-bold">Cargo</label>
                        <select name="Cargo" class="border p-2 rounded w-full">
                            <option ${user.Cargo === 'Administrador' ? 'selected' : ''}>Administrador</option>
                            <option ${user.Cargo === 'Gerente' ? 'selected' : ''}>Gerente</option>
                            <option ${user.Cargo === 'Operador' ? 'selected' : ''}>Operador</option>
                        </select>
                    </div>
                    <div>
                        <label class="text-xs font-bold">Status</label>
                        <select name="Status" class="border p-2 rounded w-full">
                            <option ${user.Status === 'Ativo' ? 'selected' : ''}>Ativo</option>
                            <option ${user.Status === 'Inativo' ? 'selected' : ''}>Inativo</option>
                        </select>
                    </div>
                </div>
                <div class="mb-4">
                    <label class="text-xs font-bold">Senha ${id ? '(Deixe em branco para manter)' : '*'}</label>
                    <input type="password" name="Senha" class="border p-2 rounded w-full" ${id ? '' : 'required'}>
                </div>
                
                ${permsHtml}

                <button class="w-full bg-blue-600 text-white py-2 rounded font-bold mt-4">Salvar Usuário</button>
            </form>
        `);
    },

    saveUsuario: async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData.entries());
        
        // Processar Permissões
        const permissoes = {};
        const modules = ['Dashboard', 'RH', 'Estoque', 'Producao', 'Eventos', 'MLPain', 'Financas', 'Inventario', 'Configuracoes'];
        const actions = ['ver', 'criar', 'editar', 'excluir'];

        modules.forEach(mod => {
            permissoes[mod] = {};
            actions.forEach(act => {
                if (data[`perm_${mod}_${act}`] === 'on') {
                    permissoes[mod][act] = true;
                }
                delete data[`perm_${mod}_${act}`];
            });
        });
        data.Permissoes = permissoes;

        if (data.ID && !data.Senha) delete data.Senha;

        try {
            await Utils.api('save', 'Usuarios', data);
            Utils.toast('Usuário salvo com sucesso!', 'success');
            Utils.closeModal();
            ConfigModule.renderUsuarios(document.getElementById('config-content'));
        } catch (err) { Utils.toast('Erro ao salvar: ' + err.message, 'error'); }
    },

    deleteUsuario: async (id) => {
        if(!confirm('Tem certeza que deseja excluir este usuário?')) return;
        try {
            await Utils.api('delete', 'Usuarios', null, id);
            ConfigModule.renderUsuarios(document.getElementById('config-content'));
        } catch (e) { Utils.toast('Erro ao excluir.', 'error'); }
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