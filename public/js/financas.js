const FinancasModule = {
    state: {
        activeTab: 'fluxo',
        fluxo: [],
        receber: [],
        pagar: []
    },

    init: () => {
        FinancasModule.fetchData();
    },

    fetchData: async () => {
        try {
            // Busca dados das 3 tabelas em paralelo
            const [fluxo, receber, pagar] = await Promise.all([
                FinancasModule.api('getAll', 'Financas'),
                FinancasModule.api('getAll', 'ContasReceber'),
                FinancasModule.api('getAll', 'ContasPagar')
            ]);
            
            FinancasModule.state.fluxo = fluxo || [];
            FinancasModule.state.receber = receber || [];
            FinancasModule.state.pagar = pagar || [];
            
            FinancasModule.render();
        } catch (e) {
            console.error(e);
            Utils.toast("Erro ao carregar dados financeiros.");
        }
    },

    api: async (action, table, data = null, id = null) => {
        const res = await fetch('/.netlify/functions/business', {
            method: 'POST',
            body: JSON.stringify({ action, table, data, id })
        });
        const json = await res.json();
        if (json.success) return json.data;
        throw new Error(json.message || 'Erro na API');
    },

    setTab: (tab) => {
        FinancasModule.state.activeTab = tab;
        // Atualiza visual das abas
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.className = 'tab-btn px-4 py-2 text-gray-500 hover:text-gray-700 transition whitespace-nowrap';
            btn.style.borderBottom = 'none';
        });
        const activeBtn = document.getElementById(`tab-${tab}`);
        if(activeBtn) {
            activeBtn.className = 'tab-btn px-4 py-2 font-bold text-indigo-600 transition whitespace-nowrap';
            activeBtn.style.borderBottom = '2px solid #4F46E5';
        }
        FinancasModule.render();
    },

    render: () => {
        const tab = FinancasModule.state.activeTab;
        const container = document.getElementById('tab-content');
        
        if (tab === 'fluxo') FinancasModule.renderFluxo(container);
        else if (tab === 'receber') FinancasModule.renderContas(container, 'ContasReceber');
        else if (tab === 'pagar') FinancasModule.renderContas(container, 'ContasPagar');
    },

    renderFluxo: (container) => {
        const data = FinancasModule.state.fluxo.sort((a,b) => new Date(b.Data) - new Date(a.Data));
        
        container.innerHTML = `
            <div class="bg-white rounded shadow overflow-x-auto">
                <table class="w-full text-sm text-left">
                    <thead class="bg-gray-100 text-gray-600 uppercase text-xs">
                        <tr>
                            <th class="p-3">Data</th>
                            <th class="p-3">Descrição</th>
                            <th class="p-3">Categoria</th>
                            <th class="p-3 text-right">Valor</th>
                            <th class="p-3 text-center">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.map(item => {
                            const isReceita = item.Tipo === 'Receita';
                            const color = isReceita ? 'text-green-600' : 'text-red-600';
                            const sign = isReceita ? '+' : '-';
                            return `
                                <tr class="border-b hover:bg-gray-50">
                                    <td class="p-3">${Utils.formatDate(item.Data)}</td>
                                    <td class="p-3 font-medium">${item.Descricao}</td>
                                    <td class="p-3 text-xs text-gray-500">${item.Categoria} <br> ${item.Subcategoria || ''}</td>
                                    <td class="p-3 text-right font-bold ${color}">${sign} ${Utils.formatCurrency(item.Valor)}</td>
                                    <td class="p-3 text-center"><span class="px-2 py-1 rounded text-xs bg-gray-100 text-gray-600">${item.Status}</span></td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },

    renderContas: (container, table) => {
        const isReceber = table === 'ContasReceber';
        const data = isReceber ? FinancasModule.state.receber : FinancasModule.state.pagar;
        const title = isReceber ? 'Contas a Receber' : 'Contas a Pagar';
        const btnColor = isReceber ? 'bg-green-600' : 'bg-red-600';
        
        container.innerHTML = `
            <div class="flex justify-between mb-4">
                <h3 class="text-xl font-bold text-gray-700">${title}</h3>
                <button onclick="FinancasModule.modalConta('${table}')" class="${btnColor} text-white px-4 py-2 rounded shadow hover:opacity-90 transition">
                    + Nova Conta
                </button>
            </div>
            <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                ${data.map(item => {
                    const isPaid = item.Status === 'Pago' || item.Status === 'Recebido';
                    const statusColor = isPaid ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800';
                    
                    return `
                        <div class="bg-white p-4 rounded shadow border-l-4 ${isReceber ? 'border-green-500' : 'border-red-500'} relative">
                            <div class="flex justify-between items-start mb-2">
                                <span class="text-xs font-bold text-gray-400">#${item.Codigo || '---'}</span>
                                <span class="px-2 py-0.5 rounded text-xs font-bold ${statusColor}">${item.Status}</span>
                            </div>
                            <h4 class="font-bold text-gray-800">${item.Descricao}</h4>
                            <div class="text-sm text-gray-600 mb-2">${isReceber ? item.Cliente : item.Fornecedor}</div>
                            
                            <div class="flex justify-between items-end mt-4">
                                <div>
                                    <div class="text-xs text-gray-500">Vencimento</div>
                                    <div class="font-medium ${new Date(item.DataVencimento) < new Date() && !isPaid ? 'text-red-600' : ''}">
                                        ${Utils.formatDate(item.DataVencimento)}
                                    </div>
                                </div>
                                <div class="text-right">
                                    <div class="text-xs text-gray-500">Valor</div>
                                    <div class="text-lg font-bold text-gray-800">${Utils.formatCurrency(item.ValorTotal)}</div>
                                </div>
                            </div>
                            
                            ${!isPaid ? `
                                <div class="mt-4 pt-3 border-t flex gap-2">
                                    <button onclick="FinancasModule.modalBaixa('${item.ID}', '${table}')" class="flex-1 bg-indigo-50 text-indigo-700 py-1 rounded text-sm font-bold hover:bg-indigo-100">
                                        <i class="fas fa-check"></i> ${isReceber ? 'Receber' : 'Pagar'}
                                    </button>
                                    <button onclick="FinancasModule.delete('${table}', '${item.ID}')" class="px-3 text-red-400 hover:text-red-600"><i class="fas fa-trash"></i></button>
                                </div>
                            ` : ''}
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    },

    modalConta: (table) => {
        const isReceber = table === 'ContasReceber';
        Utils.openModal(isReceber ? 'Nova Conta a Receber' : 'Nova Conta a Pagar', `
            <form onsubmit="FinancasModule.save(event, '${table}')">
                <div class="mb-3">
                    <label class="text-xs font-bold">${isReceber ? 'Cliente' : 'Fornecedor'}</label>
                    <input name="${isReceber ? 'Cliente' : 'Fornecedor'}" class="border p-2 rounded w-full" required>
                </div>
                <div class="mb-3">
                    <label class="text-xs font-bold">Descrição</label>
                    <input name="Descricao" class="border p-2 rounded w-full" required>
                </div>
                <div class="grid grid-cols-2 gap-3 mb-3">
                    <div><label class="text-xs font-bold">Valor</label><input type="number" step="0.01" name="ValorTotal" class="border p-2 rounded w-full" required></div>
                    <div><label class="text-xs font-bold">Categoria</label><input name="Categoria" class="border p-2 rounded w-full"></div>
                </div>
                <div class="grid grid-cols-2 gap-3 mb-3">
                    <div><label class="text-xs font-bold">Emissão</label><input type="date" name="DataEmissao" class="border p-2 rounded w-full" value="${new Date().toISOString().split('T')[0]}"></div>
                    <div><label class="text-xs font-bold">Vencimento</label><input type="date" name="DataVencimento" class="border p-2 rounded w-full" required></div>
                </div>
                <button class="w-full ${isReceber ? 'bg-green-600' : 'bg-red-600'} text-white py-2 rounded font-bold">Salvar</button>
            </form>
        `);
    },

    modalBaixa: (id, table) => {
        const isReceber = table === 'ContasReceber';
        Utils.openModal(isReceber ? 'Confirmar Recebimento' : 'Confirmar Pagamento', `
            <form onsubmit="FinancasModule.settle(event, '${id}', '${table}')">
                <p class="text-sm text-gray-600 mb-4">Isso atualizará o status da conta e lançará o valor no Fluxo de Caixa.</p>
                <div class="mb-3">
                    <label class="text-xs font-bold">Data do Pagamento</label>
                    <input type="date" name="dataPagamento" class="border p-2 rounded w-full" value="${new Date().toISOString().split('T')[0]}" required>
                </div>
                <div class="mb-3">
                    <label class="text-xs font-bold">Valor Pago (Kz)</label>
                    <input type="number" step="0.01" name="valorPago" class="border p-2 rounded w-full" required>
                </div>
                <div class="mb-4">
                    <label class="text-xs font-bold">Método</label>
                    <select name="metodo" class="border p-2 rounded w-full">
                        <option>Dinheiro</option><option>Transferência</option><option>Multicaixa</option>
                    </select>
                </div>
                <button class="w-full bg-indigo-600 text-white py-2 rounded font-bold">Confirmar Baixa</button>
            </form>
        `);
    },

    save: async (e, table) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target).entries());
        try {
            await fetch('/.netlify/functions/business', {
                method: 'POST',
                body: JSON.stringify({ action: 'save', table, data })
            });
            Utils.toast('✅ Salvo com sucesso!');
            Utils.closeModal();
            FinancasModule.fetchData();
        } catch(err) { Utils.toast('Erro ao salvar'); }
    },

    settle: async (e, id, table) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target).entries());
        data.id = id;
        data.table = table;
        
        try {
            const res = await fetch('/.netlify/functions/business', {
                method: 'POST',
                body: JSON.stringify({ action: 'settleAccount', data })
            });
            const json = await res.json();
            if(json.success) {
                Utils.toast('✅ Conta baixada com sucesso!');
                Utils.closeModal();
                FinancasModule.fetchData();
            } else throw new Error(json.message);
        } catch(err) { Utils.toast('Erro: ' + err.message); }
    },

    delete: async (table, id) => {
        if(!confirm('Tem certeza que deseja excluir?')) return;
        try {
            await fetch('/.netlify/functions/business', {
                method: 'POST',
                body: JSON.stringify({ action: 'delete', table, id })
            });
            FinancasModule.fetchData();
        } catch(e) { Utils.toast('Erro ao excluir'); }
    }
};

document.addEventListener('DOMContentLoaded', FinancasModule.init);