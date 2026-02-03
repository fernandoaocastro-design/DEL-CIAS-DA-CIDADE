const FinancasModule = {
    state: {
        activeTab: 'fluxo',
        fluxo: [],
        receber: [],
        pagar: [],
        instituicao: []
    },

    init: () => {
        FinancasModule.fetchData();
    },

    fetchData: async () => {
        try {
            // Busca dados das 3 tabelas em paralelo
            const [fluxo, receber, pagar, inst] = await Promise.all([
                Utils.api('getAll', 'Financas'),
                Utils.api('getAll', 'ContasReceber'),
                Utils.api('getAll', 'ContasPagar'),
                Utils.api('getAll', 'InstituicaoConfig')
            ]);
            
            FinancasModule.state.fluxo = fluxo || [];
            FinancasModule.state.receber = receber || [];
            FinancasModule.state.pagar = pagar || [];
            FinancasModule.state.instituicao = inst || [];
            
            FinancasModule.render();
        } catch (e) {
            console.error(e);
            Utils.toast("Erro ao carregar dados financeiros.", 'error');
        }
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
        else if (tab === 'relatorios') FinancasModule.renderRelatorios(container);
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
        const canCreate = Utils.checkPermission('Financas', 'criar');
        const canEdit = Utils.checkPermission('Financas', 'editar');
        const canDelete = Utils.checkPermission('Financas', 'excluir');
        
        container.innerHTML = `
            <div class="flex justify-between mb-4">
                <h3 class="text-xl font-bold text-gray-700">${title}</h3>
                ${canCreate ? `<button onclick="FinancasModule.modalConta('${table}')" class="${btnColor} text-white px-4 py-2 rounded shadow hover:opacity-90 transition">
                    + Nova Conta
                </button>` : ''}
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
                                    ${canEdit ? `<button onclick="FinancasModule.modalBaixa('${item.ID}', '${table}')" class="flex-1 bg-indigo-50 text-indigo-700 py-1 rounded text-sm font-bold hover:bg-indigo-100">
                                        <i class="fas fa-check"></i> ${isReceber ? 'Receber' : 'Pagar'}
                                    </button>` : ''}
                                    ${canDelete ? `<button onclick="FinancasModule.delete('${table}', '${item.ID}')" class="px-3 text-red-400 hover:text-red-600"><i class="fas fa-trash"></i></button>` : ''}
                                </div>
                            ` : ''}
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    },

    renderRelatorios: (container) => {
        // Renderiza a estrutura base (Filtros + Área de Impressão)
        container.innerHTML = `
            <div class="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <h3 class="text-xl font-bold text-gray-700">Relatórios Financeiros</h3>
                
                <div class="flex gap-2 items-center bg-white p-2 rounded shadow">
                    <label class="text-xs font-bold text-gray-500">Período:</label>
                    <input type="month" id="filtro-mes" class="border p-1 rounded text-sm" onchange="FinancasModule.updateRelatorios()">
                    <button onclick="document.getElementById('filtro-mes').value=''; FinancasModule.updateRelatorios()" class="text-gray-400 hover:text-gray-600 text-sm px-2" title="Limpar Filtro"><i class="fas fa-times"></i></button>
                </div>

                <button onclick="FinancasModule.exportPDF()" class="bg-red-600 text-white px-4 py-2 rounded shadow hover:bg-red-700 transition">
                    <i class="fas fa-file-pdf mr-2"></i> Exportar PDF
                </button>
            </div>

            <div id="print-area-financas" class="p-4 bg-white rounded">
                <div id="pdf-header" class="hidden mb-6 border-b pb-4"></div>
                <div id="relatorio-content"></div>
                <div id="pdf-footer" class="hidden mt-10 pt-4 border-t text-center"></div>
            </div>
        `;

        FinancasModule.updateRelatorios();
    },

    updateRelatorios: () => {
        const mesFiltro = document.getElementById('filtro-mes').value; // Formato YYYY-MM
        let fluxo = FinancasModule.state.fluxo;

        // --- DADOS PARA GRÁFICO DE EVOLUÇÃO (Histórico Completo) ---
        const evolutionMap = {};
        FinancasModule.state.fluxo.forEach(item => {
            if (!item.Data) return;
            const mes = item.Data.substring(0, 7); // YYYY-MM
            if (!evolutionMap[mes]) evolutionMap[mes] = { receita: 0, despesa: 0 };
            
            if (item.Tipo === 'Receita') evolutionMap[mes].receita += Number(item.Valor);
            else evolutionMap[mes].despesa += Number(item.Valor);
        });
        
        const sortedMonths = Object.keys(evolutionMap).sort().slice(-12); // Últimos 12 meses
        const evoLabels = sortedMonths.map(m => { const [a, mm] = m.split('-'); return `${mm}/${a}`; });
        
        // --- FILTRAGEM PARA PIE CHARTS E TABELA ---
        // Aplicar Filtro
        if (mesFiltro) {
            fluxo = fluxo.filter(item => item.Data && item.Data.startsWith(mesFiltro));
        }

        // Ordenar por data para a tabela
        fluxo.sort((a, b) => new Date(b.Data) - new Date(a.Data));
        
        // Processamento de Dados
        const receitasMap = {};
        const despesasMap = {};
        let totalReceitas = 0, totalDespesas = 0;

        fluxo.forEach(item => {
            const val = Number(item.Valor);
            const cat = item.Categoria || 'Sem Categoria';
            
            if (item.Tipo === 'Receita') {
                receitasMap[cat] = (receitasMap[cat] || 0) + val;
                totalReceitas += val;
            } else {
                despesasMap[cat] = (despesasMap[cat] || 0) + val;
                totalDespesas += val;
            }
        });

        // Preparar dados para Chart.js
        const prepChartData = (map) => ({
            labels: Object.keys(map),
            data: Object.values(map)
        });

        const recData = prepChartData(receitasMap);
        const despData = prepChartData(despesasMap);

        const html = `
            <h4 class="text-center text-gray-500 mb-4 font-bold">${mesFiltro ? 'Período: ' + mesFiltro : 'Período: Geral (Todo o Histórico)'}</h4>
            
            <!-- GRÁFICO DE EVOLUÇÃO -->
            <div class="bg-white p-4 rounded border mb-6 shadow-sm">
                <h4 class="font-bold text-gray-700 mb-2 border-b pb-2">Evolução Mensal (Últimos 12 Meses)</h4>
                <div class="h-64"><canvas id="chartEvolucao"></canvas></div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <!-- RECEITAS -->
                <div class="bg-gray-50 p-4 rounded border">
                    <h4 class="font-bold text-green-700 mb-4 border-b pb-2 flex justify-between">
                        <span>Receitas</span>
                        <span>${Utils.formatCurrency(totalReceitas)}</span>
                    </h4>
                    <div class="h-64">
                        <canvas id="chartReceitas"></canvas>
                    </div>
                    <p class="text-xs text-center text-gray-400 mt-2">Clique no gráfico para detalhes</p>
                </div>

                <!-- DESPESAS -->
                <div class="bg-gray-50 p-4 rounded border">
                    <h4 class="font-bold text-red-700 mb-4 border-b pb-2 flex justify-between">
                        <span>Despesas</span>
                        <span>${Utils.formatCurrency(totalDespesas)}</span>
                    </h4>
                    <div class="h-64">
                        <canvas id="chartDespesas"></canvas>
                    </div>
                    <p class="text-xs text-center text-gray-400 mt-2">Clique no gráfico para detalhes</p>
                </div>
            </div>

            <div class="bg-blue-50 p-6 rounded border border-blue-100 text-center mb-8">
                <h4 class="font-bold text-gray-700 mb-2">Resultado do Período</h4>
                <div class="text-3xl font-bold ${totalReceitas - totalDespesas >= 0 ? 'text-green-600' : 'text-red-600'}">
                    ${Utils.formatCurrency(totalReceitas - totalDespesas)}
                </div>
            </div>

            <!-- TABELA DETALHADA -->
            <div>
                <h4 class="font-bold text-gray-700 mb-4 border-b pb-2">Detalhamento das Transações</h4>
                <div class="overflow-x-auto">
                    <table class="w-full text-sm text-left">
                        <thead class="bg-gray-100 text-gray-600 uppercase">
                            <tr>
                                <th class="p-3">Data</th>
                                <th class="p-3">Tipo</th>
                                <th class="p-3">Categoria</th>
                                <th class="p-3">Descrição</th>
                                <th class="p-3 text-right">Valor</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y">
                            ${fluxo.map(f => `
                                <tr class="hover:bg-gray-50">
                                    <td class="p-3">${Utils.formatDate(f.Data)}</td>
                                    <td class="p-3"><span class="px-2 py-1 rounded text-xs ${f.Tipo === 'Receita' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">${f.Tipo}</span></td>
                                    <td class="p-3">${f.Categoria || '-'}</td>
                                    <td class="p-3">${f.Descricao}</td>
                                    <td class="p-3 text-right font-bold ${f.Tipo === 'Receita' ? 'text-green-600' : 'text-red-600'}">${Utils.formatCurrency(f.Valor)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        document.getElementById('relatorio-content').innerHTML = html;

        // Renderizar Gráfico de Evolução
        new Chart(document.getElementById('chartEvolucao'), {
            type: 'bar',
            data: {
                labels: evoLabels,
                datasets: [
                    { label: 'Receitas', data: sortedMonths.map(m => evolutionMap[m].receita), backgroundColor: '#10B981', borderRadius: 4 },
                    { label: 'Despesas', data: sortedMonths.map(m => evolutionMap[m].despesa), backgroundColor: '#EF4444', borderRadius: 4 }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { position: 'top' }, tooltip: { callbacks: { label: (c) => c.dataset.label + ': ' + Utils.formatCurrency(c.parsed.y) } } },
                scales: { y: { beginAtZero: true, ticks: { callback: (v) => Utils.formatCurrency(v) } } }
            }
        });

        // Configuração comum para os gráficos com evento de clique
        const chartOptions = (type, labels) => ({
            responsive: true,
            maintainAspectRatio: false,
            onClick: (evt, elements) => {
                if (elements.length > 0) {
                    const index = elements[0].index;
                    const category = labels[index];
                    FinancasModule.showCategoryDetails(category, type, mesFiltro);
                }
            },
            plugins: {
                legend: { position: 'bottom' },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return (context.label || '') + ': ' + Utils.formatCurrency(context.parsed);
                        }
                    }
                }
            }
        });

        // Renderizar Gráficos
        new Chart(document.getElementById('chartReceitas'), {
            type: 'doughnut',
            data: { labels: recData.labels, datasets: [{ data: recData.data, backgroundColor: ['#10B981', '#34D399', '#6EE7B7', '#059669', '#047857'] }] },
            options: chartOptions('Receita', recData.labels)
        });

        new Chart(document.getElementById('chartDespesas'), {
            type: 'doughnut',
            data: { labels: despData.labels, datasets: [{ data: despData.data, backgroundColor: ['#EF4444', '#F87171', '#FCA5A5', '#B91C1C', '#991B1B'] }] },
            options: chartOptions('Despesa', despData.labels)
        });
    },

    showCategoryDetails: (category, type, periodo) => {
        let items = FinancasModule.state.fluxo.filter(i => i.Categoria === category && i.Tipo === type);
        if(periodo) items = items.filter(i => i.Data && i.Data.startsWith(periodo));
        
        items.sort((a,b) => new Date(b.Data) - new Date(a.Data));

        const total = items.reduce((acc, i) => acc + Number(i.Valor), 0);

        Utils.openModal(`Detalhes: ${category} (${type})`, `
            <div class="mb-4 text-sm text-gray-600">
                Período: <b>${periodo || 'Todo o Histórico'}</b> <br>
                Total: <b class="${type === 'Receita' ? 'text-green-600' : 'text-red-600'}">${Utils.formatCurrency(total)}</b>
            </div>
            <div class="overflow-y-auto max-h-96">
                <table class="w-full text-sm text-left">
                    <thead class="bg-gray-100 sticky top-0">
                        <tr><th class="p-2">Data</th><th class="p-2">Descrição</th><th class="p-2 text-right">Valor</th></tr>
                    </thead>
                    <tbody class="divide-y">
                        ${items.map(i => `
                            <tr>
                                <td class="p-2">${Utils.formatDate(i.Data)}</td>
                                <td class="p-2">${i.Descricao}</td>
                                <td class="p-2 text-right font-bold">${Utils.formatCurrency(i.Valor)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `);
    },

    exportPDF: () => {
        const element = document.getElementById('print-area-financas');
        const header = document.getElementById('pdf-header');
        const footer = document.getElementById('pdf-footer');
        const inst = FinancasModule.state.instituicao[0] || {};
        const user = Utils.getUser();
        const showLogo = inst.ExibirLogoRelatorios;
        
        // Cabeçalho
        header.innerHTML = `
            <div class="mb-4 border-b pb-2 ${showLogo && inst.LogotipoURL ? 'flex items-center gap-4' : ''}">
                ${showLogo && inst.LogotipoURL ? `<img src="${inst.LogotipoURL}" class="h-16 w-auto object-contain">` : ''}
                <div>
                    <h1 class="text-2xl font-bold text-gray-800">${inst.NomeFantasia || 'Relatório Financeiro'}</h1>
                    <p class="text-sm text-gray-500">${inst.Endereco || ''} | ${inst.Telefone || ''}</p>
                </div>
            </div>
        `;
        header.classList.remove('hidden');

        // Rodapé
        footer.innerHTML = `<p class="text-xs text-gray-400">Gerado por ${user.Nome} em ${new Date().toLocaleString()}</p>`;
        footer.classList.remove('hidden');
        
        // --- CORREÇÃO DE ESTILOS PARA PDF ---
        const style = document.createElement('style');
        style.innerHTML = `
            #print-area-financas { width: 100%; background: white; margin: 0; padding: 0; }
            #print-area-financas table { width: 100% !important; border-collapse: collapse !important; }
            #print-area-financas th, #print-area-financas td { 
                font-size: 9px !important; 
                padding: 4px 2px !important; 
                border: 1px solid #ccc !important;
            }
            /* Forçar layout de grid para impressão (evita empilhamento) */
            #print-area-financas .grid { display: grid !important; }
            #print-area-financas .md\\:grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
            
            /* Limpeza visual */
            #print-area-financas .shadow { box-shadow: none !important; }
            #print-area-financas .bg-gray-50 { background-color: #f9fafb !important; }
            #print-area-financas .overflow-x-auto { overflow: visible !important; }
        `;
        document.head.appendChild(style);

        const opt = {
            margin: [10, 10, 10, 10],
            filename: 'relatorio-financeiro.pdf',
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, scrollY: 0, x: 0, y: 0 },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
            pagebreak: { mode: 'css', avoid: 'tr' }
        };
        
        html2pdf().set(opt).from(element).save().then(() => {
            header.classList.add('hidden');
            footer.classList.add('hidden');
            document.head.removeChild(style);
        });
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
        
        // Validação de Dados Reais
        if (!data.Descricao || data.Descricao.trim() === '') return Utils.toast('A descrição é obrigatória.', 'error');
        if (Number(data.ValorTotal) <= 0) return Utils.toast('O valor deve ser maior que zero.', 'error');
        if (!data.DataVencimento) return Utils.toast('A data de vencimento é obrigatória.', 'error');

        try {
            await Utils.api('save', table, data);
            Utils.toast('Salvo com sucesso!', 'success');
            Utils.closeModal();
            FinancasModule.fetchData();
        } catch(err) { Utils.toast('Erro ao salvar', 'error'); }
    },

    settle: async (e, id, table) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target).entries());
        data.id = id;
        data.table = table;
        
        try {
            await Utils.api('settleAccount', null, data);
            Utils.toast('Conta baixada com sucesso!', 'success');
            Utils.closeModal();
            FinancasModule.fetchData();
        } catch(err) { Utils.toast('Erro: ' + err.message, 'error'); }
    },

    delete: async (table, id) => {
        if(!confirm('Tem certeza que deseja excluir?')) return;
        try {
            await Utils.api('delete', table, null, id);
            FinancasModule.fetchData();
        } catch(e) { Utils.toast('Erro ao excluir', 'error'); }
    }
};

document.addEventListener('DOMContentLoaded', FinancasModule.init);