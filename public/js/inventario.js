const InventarioModule = {
    state: { bens: [] },

    init: () => {
        InventarioModule.fetchData();
    },

    fetchData: async () => {
        try {
            const data = await Utils.api('getAll', 'Inventario');
            InventarioModule.state.bens = data;
            InventarioModule.render();
        } catch (e) { Utils.toast("Erro ao carregar inventário."); }
    },

    render: () => {
        const data = InventarioModule.state.bens || [];
        const tbody = document.getElementById('tabela-inventario');
        
        // KPIs
        const totalValor = data.reduce((acc, b) => acc + Number(b.ValorAquisicao || 0), 0);
        const emManutencao = data.filter(b => b.EstadoConservacao === 'Em Manutenção').length;
        const deptos = new Set(data.map(b => b.Departamento)).size;

        document.getElementById('kpi-total').innerText = data.length;
        document.getElementById('kpi-valor').innerText = Utils.formatCurrency(totalValor);
        document.getElementById('kpi-manutencao').innerText = emManutencao;
        document.getElementById('kpi-deptos').innerText = deptos;

        // Tabela
        tbody.innerHTML = data.map(b => {
            let statusColor = 'bg-green-100 text-green-800';
            if(b.EstadoConservacao === 'Ruim') statusColor = 'bg-red-100 text-red-800';
            if(b.EstadoConservacao === 'Em Manutenção') statusColor = 'bg-yellow-100 text-yellow-800';

            return `
                <tr class="border-t hover:bg-gray-50">
                    <td class="p-3 font-mono text-xs font-bold text-purple-700">${b.Codigo}</td>
                    <td class="p-3 font-bold">
                        ${b.Nome} <span class="ml-1 text-xs bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded">Qtd: ${b.Quantidade || 1}</span>
                        <div class="text-xs text-gray-400 font-normal">${b.Responsavel || 'Sem responsável'}</div>
                    </td>
                    <td class="p-3 text-sm">${b.Categoria}</td>
                    <td class="p-3 text-sm">${b.Departamento}</td>
                    <td class="p-3 text-center"><span class="px-2 py-1 rounded text-xs ${statusColor}">${b.EstadoConservacao}</span></td>
                    <td class="p-3 text-right font-bold text-gray-700">${Utils.formatCurrency(b.ValorAquisicao)}</td>
                    <td class="p-3 text-center">
                        <button onclick="InventarioModule.detalhes('${b.ID}')" class="text-blue-600 hover:bg-blue-50 p-2 rounded" title="Detalhes/QR Code"><i class="fas fa-eye"></i></button>
                        <button onclick="InventarioModule.modalBem('${b.ID}')" class="text-gray-600 hover:bg-gray-100 p-2 rounded" title="Editar"><i class="fas fa-edit"></i></button>
                    </td>
                </tr>
            `;
        }).join('');
    },

    modalBem: (id = null) => {
        const bem = id ? InventarioModule.state.bens.find(b => b.ID === id) : {};
        const title = id ? 'Editar Bem Patrimonial' : 'Cadastrar Novo Bem';

        Utils.openModal(title, `
            <form onsubmit="InventarioModule.save(event)">
                <input type="hidden" name="ID" value="${bem.ID || ''}">
                
                <h4 class="font-bold text-gray-700 mb-2 border-b">1. Identificação</h4>
                <div class="grid grid-cols-12 gap-3 mb-3">
                    <div class="col-span-6"><label class="text-xs font-bold">Nome do Bem</label><input name="Nome" value="${bem.Nome || ''}" class="border p-2 rounded w-full" required></div>
                    <div class="col-span-3"><label class="text-xs font-bold">Quantidade</label><input type="number" name="Quantidade" value="${bem.Quantidade || '1'}" class="border p-2 rounded w-full" min="1"></div>
                    <div class="col-span-3"><label class="text-xs font-bold">Código (Auto)</label><input name="Codigo" value="${bem.Codigo || ''}" placeholder="Ex: INV-001" class="border p-2 rounded w-full bg-gray-50"></div>
                </div>
                <div class="grid grid-cols-2 gap-3 mb-3">
                    <div><label class="text-xs font-bold">Categoria</label><select name="Categoria" class="border p-2 rounded w-full"><option>TI</option><option>Mobiliário</option><option>Veículos</option><option>Produção</option><option>Ferramentas</option></select></div>
                    <div><label class="text-xs font-bold">Nº Série</label><input name="NumeroSerie" value="${bem.NumeroSerie || ''}" class="border p-2 rounded w-full"></div>
                </div>

                <h4 class="font-bold text-gray-700 mb-2 border-b mt-4">2. Localização & Responsável</h4>
                <div class="grid grid-cols-2 gap-3 mb-3">
                    <div><label class="text-xs font-bold">Departamento</label><select name="Departamento" class="border p-2 rounded w-full"><option>Administração</option><option>RH</option><option>TI</option><option>Produção</option><option>Cozinha</option></select></div>
                    <div><label class="text-xs font-bold">Responsável</label><input name="Responsavel" value="${bem.Responsavel || ''}" class="border p-2 rounded w-full"></div>
                </div>

                <h4 class="font-bold text-gray-700 mb-2 border-b mt-4">3. Detalhes Financeiros & Estado</h4>
                <div class="grid grid-cols-3 gap-3 mb-3">
                    <div><label class="text-xs font-bold">Data Aquisição</label><input type="date" name="DataAquisicao" value="${bem.DataAquisicao || ''}" class="border p-2 rounded w-full"></div>
                    <div><label class="text-xs font-bold">Valor (Kz)</label><input type="number" step="0.01" name="ValorAquisicao" value="${bem.ValorAquisicao || ''}" class="border p-2 rounded w-full"></div>
                    <div><label class="text-xs font-bold">Estado</label><select name="EstadoConservacao" class="border p-2 rounded w-full"><option>Novo</option><option>Bom</option><option>Regular</option><option>Ruim</option><option>Em Manutenção</option></select></div>
                </div>

                <div class="mb-4"><label class="text-xs font-bold">Observações</label><textarea name="Observacoes" class="border p-2 rounded w-full h-16">${bem.Observacoes || ''}</textarea></div>
                
                <button class="w-full bg-purple-600 text-white py-3 rounded font-bold">Salvar Bem</button>
            </form>
        `);
        
        // Pre-select dropdowns if editing
        if(id) {
            document.querySelector('[name="Categoria"]').value = bem.Categoria;
            document.querySelector('[name="Departamento"]').value = bem.Departamento;
            document.querySelector('[name="EstadoConservacao"]').value = bem.EstadoConservacao;
        }
    },

    save: async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target).entries());
        
        // Validações de Segurança e Integridade
        if (!data.Nome.trim()) return Utils.toast('⚠️ Erro: O nome do bem é obrigatório.');
        if (!data.Categoria) return Utils.toast('⚠️ Erro: A categoria é obrigatória.');
        if (data.ValorAquisicao && Number(data.ValorAquisicao) < 0) return Utils.toast('⚠️ Erro: O valor não pode ser negativo.');

        const user = JSON.parse(localStorage.getItem('user') || '{}');
        data.UserAction = user.Nome || 'Admin';

        try {
            await Utils.api('saveInventario', null, data);
            Utils.toast('Bem salvo com sucesso!', 'success'); Utils.closeModal(); InventarioModule.fetchData();
        } catch (err) { Utils.toast('Erro: ' + err.message, 'error'); }
    },

    detalhes: (id) => {
        const bem = InventarioModule.state.bens.find(b => b.ID === id);
        Utils.openModal('Detalhes do Bem', `
            <div class="flex gap-6">
                <div class="w-1/3 flex flex-col items-center justify-center bg-gray-50 p-4 rounded border">
                    <div id="qrcode" class="mb-2"></div>
                    <div class="text-xs font-mono font-bold text-gray-600">${bem.Codigo}</div>
                    <div class="text-xs text-center text-gray-400 mt-2">Escaneie para inventário físico</div>
                </div>
                <div class="w-2/3 space-y-2">
                    <h3 class="text-xl font-bold text-gray-800">${bem.Nome}</h3>
                    <div class="grid grid-cols-2 gap-2 text-sm">
                        <div><span class="font-bold">Categoria:</span> ${bem.Categoria}</div>
                        <div><span class="font-bold">Quantidade:</span> ${bem.Quantidade || 1}</div>
                        <div><span class="font-bold">Local:</span> ${bem.Departamento}</div>
                        <div><span class="font-bold">Responsável:</span> ${bem.Responsavel}</div>
                        <div><span class="font-bold">Estado:</span> ${bem.EstadoConservacao}</div>
                        <div><span class="font-bold">Valor:</span> ${Utils.formatCurrency(bem.ValorAquisicao)}</div>
                        <div><span class="font-bold">Aquisição:</span> ${Utils.formatDate(bem.DataAquisicao)}</div>
                    </div>
                    <div class="mt-4 pt-4 border-t">
                        <h5 class="font-bold text-gray-700 mb-2">Ações Rápidas</h5>
                        <div class="flex gap-2">
                            <button class="bg-yellow-500 text-white px-3 py-1 rounded text-sm"><i class="fas fa-exchange-alt"></i> Transferir</button>
                            <button class="bg-blue-500 text-white px-3 py-1 rounded text-sm"><i class="fas fa-tools"></i> Manutenção</button>
                            <button class="bg-red-500 text-white px-3 py-1 rounded text-sm"><i class="fas fa-times-circle"></i> Baixar</button>
                        </div>
                    </div>
                </div>
            </div>
        `);
        
        // Gerar QR Code
        new QRCode(document.getElementById("qrcode"), { text: `INV:${bem.Codigo}`, width: 100, height: 100 });
    },

    filtrar: () => { /* TODO: Implementar filtro local */ }
};

document.addEventListener('DOMContentLoaded', InventarioModule.init);