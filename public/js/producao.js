const ProducaoModule = {
    state: { pratos: [] },

    init: () => {
        ProducaoModule.fetchData();
    },

    fetchData: async () => {
        try {
            const data = await Utils.api('getAll', 'Pratos');
            ProducaoModule.state.pratos = data;
            ProducaoModule.render();
        } catch (e) {
            console.error(e);
            Utils.toast("Erro ao carregar pratos.", 'error');
        }
    },

    render: () => {
        const data = ProducaoModule.state.pratos || [];
        const canDelete = Utils.checkPermission('Producao', 'excluir');

        document.getElementById('producao-content').innerHTML = `
            <div class="flex justify-between mb-4">
                <h3 class="text-xl font-bold">Menu de Pratos</h3>
                <button onclick="ProducaoModule.modalPrato()" class="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded shadow transition">
                    <i class="fas fa-plus"></i> Novo Prato
                </button>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                ${data.map(p => `
                    <div class="bg-white p-4 rounded shadow border-l-4 border-orange-400 relative">
                        <div class="flex justify-between items-start">
                            <div>
                                <h4 class="font-bold text-lg text-gray-800">${p.Nome}</h4>
                                <span class="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">${p.Categoria || 'Geral'}</span>
                            </div>
                            <div class="text-right">
                                <div class="font-bold text-green-600">${Utils.formatCurrency(p.Preco)}</div>
                                <div class="text-xs text-gray-400">${p.TempoPreparo || '-'}</div>
                            </div>
                        </div>
                        <p class="text-sm text-gray-500 mt-2 mb-4 line-clamp-2">${p.Descricao || 'Sem descrição.'}</p>
                        <div class="flex justify-end gap-2 border-t pt-2">
                            ${canDelete ? `<button onclick="ProducaoModule.delete('${p.ID}')" class="text-red-500 hover:text-red-700 text-sm"><i class="fas fa-trash"></i> Excluir</button>` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    },

    modalPrato: () => {
        Utils.openModal('Novo Prato', `
            <form onsubmit="ProducaoModule.save(event)">
                <div class="mb-3"><label class="text-xs font-bold">Nome do Prato</label><input name="Nome" class="border p-2 rounded w-full" required></div>
                <div class="grid grid-cols-2 gap-3 mb-3">
                    <div><label class="text-xs font-bold">Categoria</label><select name="Categoria" class="border p-2 rounded w-full"><option>Entrada</option><option>Prato Principal</option><option>Sobremesa</option><option>Bebida</option></select></div>
                    <div><label class="text-xs font-bold">Preço de Venda</label><input type="number" step="0.01" name="Preco" class="border p-2 rounded w-full" required></div>
                </div>
                <div class="mb-3"><label class="text-xs font-bold">Tempo de Preparo</label><input name="TempoPreparo" placeholder="Ex: 30 min" class="border p-2 rounded w-full"></div>
                <div class="mb-4"><label class="text-xs font-bold">Descrição</label><textarea name="Descricao" class="border p-2 rounded w-full h-20"></textarea></div>
                <button class="w-full bg-orange-500 text-white py-2 rounded font-bold">Salvar Prato</button>
            </form>
        `);
    },

    save: async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target).entries());
        
        // Validações
        if (!data.Nome.trim()) return Utils.toast('⚠️ Erro: O nome do prato é obrigatório.');
        if (Number(data.Preco) < 0) return Utils.toast('⚠️ Erro: O preço não pode ser negativo.');

        try {
            await Utils.api('save', 'Pratos', data);
            Utils.toast('Prato salvo!', 'success'); Utils.closeModal(); ProducaoModule.fetchData();
        } catch (err) { Utils.toast('Erro: ' + err.message, 'error'); }
    },

    delete: async (id) => {
        if(confirm('Apagar este prato?')) { 
            try {
                await Utils.api('delete', 'Pratos', null, id); 
                ProducaoModule.fetchData(); 
            } catch (e) { Utils.toast('Erro ao apagar', 'error'); }
        }
    }
};

document.addEventListener('DOMContentLoaded', ProducaoModule.init);