const EstoqueModule = {
    state: { items: [], movimentacoes: [], activeTab: 'produtos' },

    // Classificação Inteligente
    taxonomy: {
        'Alimentos': {
            'Frescos': ['Carne', 'Frango', 'Peixe', 'Ovos', 'Legumes', 'Frutas', 'Laticínios', 'Congelados'],
            'Secos': ['Arroz', 'Massa', 'Feijão', 'Açúcar', 'Óleo', 'Temperos', 'Enlatados', 'Cereais']
        },
        'Bebidas': {
            'Geral': ['Água', 'Refrigerantes', 'Sumos', 'Cervejas', 'Vinhos', 'Energéticos', 'Bebidas alcoólicas']
        },
        'Insumos': {
            'Materiais': ['Limpeza', 'Gás', 'Embalagens', 'Descartáveis', 'Equipamentos', 'Utensílios']
        }
    },

    init: () => {
        EstoqueModule.fetchData();
    },

    fetchData: async () => {
        try {
            const res = await fetch('/.netlify/functions/business', {
                method: 'POST',
                body: JSON.stringify({ action: 'getAll', table: 'Estoque' }) // Traz produtos
            });
            const json = await res.json();
            
            if (json.success) {
                EstoqueModule.state.items = json.data;
                
                // Se estiver na aba de movimentações, busca o histórico também
                if(EstoqueModule.state.activeTab === 'movimentacoes') await EstoqueModule.fetchMovimentacoes();
                
                EstoqueModule.render(); // Renderiza a aba atual
            } else {
                throw new Error(json.message);
            }
        } catch (e) {
            console.error(e);
            Utils.toast("❌ Erro ao carregar estoque.");
        }
    },

    fetchMovimentacoes: async () => {
        try {
            const res = await fetch('/.netlify/functions/business', { method: 'POST', body: JSON.stringify({ action: 'getAll', table: 'MovimentacoesEstoque' }) });
            const json = await res.json();
            if(json.success) EstoqueModule.state.movimentacoes = json.data;
        } catch(e) { console.error(e); }
    },

    setTab: (tab) => {
        EstoqueModule.state.activeTab = tab;
        
        // Atualiza visual das abas
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.className = 'tab-btn px-4 py-2 text-gray-500 hover:text-gray-700 transition';
            btn.style.borderBottom = 'none';
        });
        const activeBtn = document.getElementById(`tab-${tab}`);
        activeBtn.className = 'tab-btn px-4 py-2 font-bold text-yellow-600 transition';
        activeBtn.style.borderBottom = '2px solid #EAB308';

        if (tab === 'movimentacoes') EstoqueModule.fetchMovimentacoes().then(EstoqueModule.render);
        else EstoqueModule.render();
    },

    render: () => {
        if (EstoqueModule.state.activeTab === 'movimentacoes') {
            EstoqueModule.renderMovimentacoes();
            return;
        }
        // --- RENDERIZAÇÃO DA ABA PRODUTOS (Padrão) ---

        const data = EstoqueModule.state.items || [];
        const totalValue = data.reduce((acc, item) => acc + (Number(item.Quantidade) * Number(item.CustoUnitario)), 0);
        const criticalItems = data.filter(i => Number(i.Quantidade) <= Number(i.Minimo)).length;

        document.getElementById('estoque-content').innerHTML = `
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div class="bg-white p-4 rounded shadow border-l-4 border-blue-500">
                    <div class="text-gray-500 text-sm">Total de Itens</div>
                    <div class="text-2xl font-bold">${data.length}</div>
                </div>
                <div class="bg-white p-4 rounded shadow border-l-4 border-green-500">
                    <div class="text-gray-500 text-sm">Valor em Estoque</div>
                    <div class="text-2xl font-bold text-green-600">${Utils.formatCurrency(totalValue)}</div>
                </div>
                <div class="bg-white p-4 rounded shadow border-l-4 border-red-500">
                    <div class="text-gray-500 text-sm">Itens Críticos</div>
                    <div class="text-2xl font-bold text-red-600">${criticalItems}</div>
                </div>
            </div>

            <div class="flex justify-between mb-4">
                <h3 class="text-xl font-bold">Cadastro de Produtos</h3>
                <div class="flex gap-2">
                    <button onclick="EstoqueModule.modalEntrada()" class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded shadow transition"><i class="fas fa-arrow-down"></i> Entrada</button>
                    <button onclick="EstoqueModule.modalSaida()" class="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded shadow transition"><i class="fas fa-arrow-up"></i> Saída</button>
                    <button onclick="EstoqueModule.modalItem()" class="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded shadow transition">
                        <i class="fas fa-plus"></i> Novo Produto
                    </button>
                </div>
            </div>

            <div class="overflow-x-auto">
                <table class="w-full bg-white rounded shadow text-sm">
                    <thead class="bg-gray-100">
                        <tr>
                            <th class="p-3 text-left">Produto</th>
                            <th class="p-3 text-left">Classificação</th>
                            <th class="p-3 text-center">Local</th>
                            <th class="p-3 text-center">Qtd</th>
                            <th class="p-3 text-right">Custo Médio</th>
                            <th class="p-3 text-right">Total</th>
                            <th class="p-3 text-center">Validade</th>
                            <th class="p-3 text-center">Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.map(i => {
                            const qtd = Number(i.Quantidade);
                            const min = Number(i.Minimo);
                            const custo = Number(i.CustoUnitario);
                            const isLow = qtd <= min;
                            const total = qtd * custo;
                            const nome = i.Nome || i.Item; // Compatibilidade com dados antigos
                            return `
                            <tr class="border-t hover:bg-gray-50 ${isLow ? 'bg-red-50' : ''}">
                                <td class="p-3 font-bold">
                                    ${nome} 
                                    <div class="text-xs text-gray-500">${i.Codigo || ''}</div>
                                </td>
                                <td class="p-3 text-xs">
                                    <span class="font-bold">${i.Tipo || '-'}</span><br>
                                    ${i.Subtipo || ''}
                                </td>
                                <td class="p-3 text-center text-xs">${i.Localizacao || '-'}</td>
                                <td class="p-3 text-center font-bold ${isLow ? 'text-red-600' : ''}">
                                    ${qtd} <span class="text-xs font-normal text-gray-500">${i.Unidade}</span>
                                </td>
                                <td class="p-3 text-right">${Utils.formatCurrency(custo)}</td>
                                <td class="p-3 text-right font-bold text-green-700">${Utils.formatCurrency(total)}</td>
                                <td class="p-3 text-center">${Utils.formatDate(i.Validade)}</td>
                                <td class="p-3 text-center">
                                    <button onclick="EstoqueModule.delete('${i.ID}')" class="text-red-500 hover:text-red-700"><i class="fas fa-trash"></i></button>
                                </td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },

    renderMovimentacoes: () => {
        const movs = EstoqueModule.state.movimentacoes || [];
        // Ordenar por data (mais recente primeiro)
        movs.sort((a, b) => new Date(b.Data) - new Date(a.Data));

        document.getElementById('estoque-content').innerHTML = `
            <h3 class="text-xl font-bold mb-4">Histórico de Movimentações</h3>
            <div class="overflow-x-auto">
                <table class="w-full bg-white rounded shadow text-sm">
                    <thead class="bg-gray-100"><tr><th>Data</th><th>Tipo</th><th>Produto</th><th>Qtd</th><th>Responsável</th><th>Obs</th></tr></thead>
                    <tbody>
                        ${movs.map(m => {
                            const prod = EstoqueModule.state.items.find(i => i.ID === m.ProdutoID);
                            const nomeProd = prod ? prod.Nome : 'Item Excluído';
                            const color = m.Tipo === 'Entrada' ? 'text-green-600' : 'text-red-600';
                            return `<tr class="border-t hover:bg-gray-50">
                                <td class="p-3 text-center">${new Date(m.Data).toLocaleString()}</td>
                                <td class="p-3 font-bold ${color}">${m.Tipo}</td>
                                <td class="p-3">${nomeProd}</td>
                                <td class="p-3 text-center font-bold">${m.Quantidade}</td>
                                <td class="p-3">${m.Responsavel || '-'}</td>
                                <td class="p-3 text-xs text-gray-500">${m.Observacoes || '-'}</td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },

    modalItem: () => {
        // Função para atualizar subtipos dinamicamente
        window.updateSubtypes = (select) => {
            const type = select.value;
            const subSelect = document.getElementById('subtipo-select');
            const catSelect = document.getElementById('categoria-select');
            
            subSelect.innerHTML = '<option value="">Selecione...</option>';
            catSelect.innerHTML = '<option value="">Selecione...</option>';
            
            if (EstoqueModule.taxonomy[type]) {
                Object.keys(EstoqueModule.taxonomy[type]).forEach(sub => {
                    subSelect.innerHTML += `<option value="${sub}">${sub}</option>`;
                });
            }
        };

        window.updateCategories = (select) => {
            const type = document.getElementById('tipo-select').value;
            const sub = select.value;
            const catSelect = document.getElementById('categoria-select');
            
            catSelect.innerHTML = '<option value="">Selecione...</option>';
            
            if (EstoqueModule.taxonomy[type] && EstoqueModule.taxonomy[type][sub]) {
                EstoqueModule.taxonomy[type][sub].forEach(cat => {
                    catSelect.innerHTML += `<option value="${cat}">${cat}</option>`;
                });
            }
        };

        Utils.openModal('Cadastro de Produto', `
            <form onsubmit="EstoqueModule.save(event)">
                <h4 class="font-bold text-gray-700 mb-2 border-b">1. Identificação & Classificação</h4>
                <div class="grid grid-cols-2 gap-3 mb-3">
                    <div><label class="text-xs font-bold">Código</label><input name="Codigo" placeholder="Ex: AL-001" class="border p-2 rounded w-full"></div>
                    <div><label class="text-xs font-bold">Nome do Produto</label><input name="Nome" class="border p-2 rounded w-full" required></div>
                </div>
                <div class="grid grid-cols-3 gap-3 mb-3">
                    <div><label class="text-xs font-bold">Tipo</label><select id="tipo-select" name="Tipo" class="border p-2 rounded w-full" onchange="updateSubtypes(this)" required><option value="">Selecione...</option><option>Alimentos</option><option>Bebidas</option><option>Insumos</option></select></div>
                    <div><label class="text-xs font-bold">Subtipo</label><select id="subtipo-select" name="Subtipo" class="border p-2 rounded w-full" onchange="updateCategories(this)"><option value="">...</option></select></div>
                    <div><label class="text-xs font-bold">Categoria</label><select id="categoria-select" name="Categoria" class="border p-2 rounded w-full"><option value="">...</option></select></div>
                </div>

                <h4 class="font-bold text-gray-700 mb-2 border-b mt-4">2. Controle de Estoque</h4>
                <div class="grid grid-cols-3 gap-3 mb-3">
                    <div><label class="text-xs font-bold">Localização</label><select name="Localizacao" class="border p-2 rounded w-full"><option>Arca</option><option>Câmara Fria</option><option>Prateleira</option><option>Despensa</option><option>Armazém</option></select></div>
                    <div><label class="text-xs font-bold">Lote</label><input name="Lote" class="border p-2 rounded w-full"></div>
                    <div><label class="text-xs font-bold">Validade</label><input type="date" name="Validade" class="border p-2 rounded w-full"></div>
                </div>
                <div class="grid grid-cols-3 gap-3 mb-3">
                    <div><label class="text-xs font-bold">Qtd Atual</label><input type="number" step="0.01" name="Quantidade" class="border p-2 rounded w-full" required></div>
                    <div><label class="text-xs font-bold">Unidade</label><select name="Unidade" class="border p-2 rounded w-full"><option>Kg</option><option>L</option><option>Un</option><option>Cx</option><option>Lata</option></select></div>
                    <div><label class="text-xs font-bold">Estoque Mínimo</label><input type="number" step="0.01" name="Minimo" class="border p-2 rounded w-full"></div>
                </div>

                <h4 class="font-bold text-gray-700 mb-2 border-b mt-4">3. Custos & Fornecedor</h4>
                <div class="grid grid-cols-2 gap-3 mb-3">
                    <div><label class="text-xs font-bold">Custo Unitário (Kz)</label><input type="number" step="0.01" name="CustoUnitario" class="border p-2 rounded w-full"></div>
                    <div><label class="text-xs font-bold">Fornecedor</label><input name="Fornecedor" class="border p-2 rounded w-full"></div>
                </div>
                
                <button class="w-full bg-yellow-500 text-white py-3 rounded font-bold mt-2">Salvar Produto</button>
            </form>
        `);
    },

    modalEntrada: () => {
        const prods = EstoqueModule.state.items;
        Utils.openModal('Registrar Entrada (Compra)', `
            <form onsubmit="EstoqueModule.saveMovimentacao(event, 'Entrada')">
                <div class="mb-3">
                    <label class="text-xs font-bold">Produto</label>
                    <select name="produtoId" class="border p-2 rounded w-full" required>
                        <option value="">Selecione...</option>
                        ${prods.map(p => `<option value="${p.ID}">${p.Nome} (${p.Unidade})</option>`).join('')}
                    </select>
                </div>
                <div class="grid grid-cols-2 gap-3 mb-3">
                    <div><label class="text-xs font-bold">Quantidade Comprada</label><input type="number" step="0.01" name="quantidade" class="border p-2 rounded w-full" required></div>
                    <div><label class="text-xs font-bold">Preço Unitário (Novo)</label><input type="number" step="0.01" name="custo" class="border p-2 rounded w-full"></div>
                </div>
                <div class="mb-3"><label class="text-xs font-bold">Fornecedor / Mercado</label><input name="detalhes[fornecedor]" class="border p-2 rounded w-full"></div>
                <div class="mb-3"><label class="text-xs font-bold">Responsável (Recebimento)</label><input name="responsavel" class="border p-2 rounded w-full" required></div>
                <button class="w-full bg-green-600 text-white py-3 rounded font-bold">Confirmar Entrada</button>
            </form>
        `);
    },

    modalSaida: () => {
        const prods = EstoqueModule.state.items;
        Utils.openModal('Registrar Saída (Consumo)', `
            <form onsubmit="EstoqueModule.saveMovimentacao(event, 'Saida')">
                <div class="mb-3">
                    <label class="text-xs font-bold">Produto</label>
                    <select name="produtoId" class="border p-2 rounded w-full" required>
                        <option value="">Selecione...</option>
                        ${prods.map(p => `<option value="${p.ID}">${p.Nome} (Atual: ${p.Quantidade} ${p.Unidade})</option>`).join('')}
                    </select>
                </div>
                <div class="grid grid-cols-2 gap-3 mb-3">
                    <div><label class="text-xs font-bold">Quantidade Retirada</label><input type="number" step="0.01" name="quantidade" class="border p-2 rounded w-full" required></div>
                    <div><label class="text-xs font-bold">Finalidade</label>
                        <select name="detalhes[finalidade]" class="border p-2 rounded w-full">
                            <option>Cozinha</option><option>Bar</option><option>Venda</option><option>Evento</option><option>Quebra/Perda</option>
                        </select>
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-3 mb-3">
                    <div><label class="text-xs font-bold">Solicitado por</label><input name="detalhes[solicitante]" class="border p-2 rounded w-full"></div>
                    <div><label class="text-xs font-bold">Responsável Retirada</label><input name="responsavel" class="border p-2 rounded w-full" required></div>
                </div>
                <div class="mb-3"><label class="text-xs font-bold">Observações</label><textarea name="observacoes" class="border p-2 rounded w-full"></textarea></div>
                <button class="w-full bg-red-600 text-white py-3 rounded font-bold">Confirmar Saída</button>
            </form>
        `);
    },

    save: async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target).entries());
        
        // Validações de Regra de Negócio
        if (!data.Nome.trim()) return Utils.toast('⚠️ Erro: O nome do produto é obrigatório.');
        if (Number(data.Quantidade) < 0) return Utils.toast('⚠️ Erro: A quantidade não pode ser negativa.');
        if (Number(data.CustoUnitario) < 0) return Utils.toast('⚠️ Erro: O custo unitário não pode ser negativo.');
        if (Number(data.Minimo) < 0) return Utils.toast('⚠️ Erro: O estoque mínimo não pode ser negativo.');

        try {
            const res = await fetch('/.netlify/functions/business', {
                method: 'POST',
                body: JSON.stringify({ action: 'save', table: 'Estoque', data })
            });
            const json = await res.json();
            if (json.success) {
                Utils.toast('✅ Item salvo!');
                Utils.closeModal();
                EstoqueModule.fetchData();
            } else {
                throw new Error(json.message);
            }
        } catch (err) {
            Utils.toast('❌ Erro ao salvar: ' + err.message);
        }
    },

    saveMovimentacao: async (e, tipo) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData.entries());
        
        // Estruturar dados complexos (detalhes)
        data.tipo = tipo;
        data.detalhes = {};
        for (const [key, value] of formData.entries()) {
            if (key.startsWith('detalhes[')) {
                const realKey = key.match(/\[(.*?)\]/)[1];
                data.detalhes[realKey] = value;
            }
        }

        try {
            const res = await fetch('/.netlify/functions/business', { method: 'POST', body: JSON.stringify({ action: 'registerStockMovement', data }) });
            const json = await res.json();
            if (json.success) { Utils.toast('✅ Movimentação registrada!'); Utils.closeModal(); EstoqueModule.fetchData(); }
            else throw new Error(json.message);
        } catch (err) { Utils.toast('❌ Erro: ' + err.message); }
    },

    delete: async (id) => {
        if(!confirm('Apagar este item?')) return;
        try {
            await fetch('/.netlify/functions/business', {
                method: 'POST',
                body: JSON.stringify({ action: 'delete', table: 'Estoque', id })
            });
            EstoqueModule.fetchData();
        } catch (e) { Utils.toast('Erro ao apagar'); }
    }
};

document.addEventListener('DOMContentLoaded', EstoqueModule.init);