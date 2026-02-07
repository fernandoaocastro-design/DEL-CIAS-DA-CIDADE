const FinancasModule = {
    state: {
        dashboardData: null,
        filterStart: '',
        filterEnd: '',
        charts: {}
    },

    init: () => {
        // Define o filtro padrão para o mês atual
        const now = new Date();
        const y = now.getFullYear();
        const m = now.getMonth() + 1;
        FinancasModule.state.filterStart = `${y}-${String(m).padStart(2, '0')}-01`;
        FinancasModule.state.filterEnd = new Date(y, m, 0).toISOString().split('T')[0];
        
        FinancasModule.fetchDashboard();
    },

    fetchDashboard: async () => {
        try {
            const { filterStart, filterEnd } = FinancasModule.state;
            
            // Mostra loading
            const container = document.getElementById('financas-content');
            if (container && !FinancasModule.state.dashboardData) {
                container.innerHTML = '<div class="flex justify-center items-center h-64"><i class="fas fa-spinner fa-spin text-4xl text-blue-600"></i></div>';
            }

            const data = await Utils.api('getFinancialDashboard', null, { startDate: filterStart, endDate: filterEnd });
            FinancasModule.state.dashboardData = data;
            FinancasModule.render();
        } catch (e) {
            console.error(e);
            Utils.toast('Erro ao carregar dados financeiros.', 'error');
        }
    },

    updateFilter: () => {
        FinancasModule.state.filterStart = document.getElementById('fin-start').value;
        FinancasModule.state.filterEnd = document.getElementById('fin-end').value;
        FinancasModule.fetchDashboard();
    },

    render: () => {
        const data = FinancasModule.state.dashboardData;
        if (!data) return;

        const { resumo, pendencias, graficos } = data;
        const meta = resumo.meta || { receitaEsperada: 0, despesaMaxima: 0, atingido: 0 };

        // Cores para Lucratividade
        const lucroClass = resumo.lucratividade >= 20 ? 'text-green-600' : (resumo.lucratividade > 0 ? 'text-blue-600' : 'text-red-600');
        const saldoClass = resumo.saldo >= 0 ? 'text-green-600' : 'text-red-600';

        const container = document.getElementById('financas-content');
        if (!container) return;

        container.innerHTML = `
            <!-- Filtros e Ações -->
            <div class="flex flex-col md:flex-row justify-between items-center mb-6 gap-4 bg-white p-4 rounded shadow-sm">
                <div class="flex items-center gap-2">
                    <h3 class="text-xl font-bold text-gray-800"><i class="fas fa-chart-line text-blue-600 mr-2"></i>Painel Financeiro</h3>
                </div>
                <div class="flex items-center gap-2">
                    <div class="flex items-center bg-gray-50 border rounded p-1">
                        <input type="date" id="fin-start" value="${FinancasModule.state.filterStart}" class="bg-transparent text-sm p-1 outline-none">
                        <span class="text-gray-400 mx-1">até</span>
                        <input type="date" id="fin-end" value="${FinancasModule.state.filterEnd}" class="bg-transparent text-sm p-1 outline-none">
                    </div>
                    <button onclick="FinancasModule.updateFilter()" class="bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700 transition"><i class="fas fa-filter"></i></button>
                    <button onclick="FinancasModule.modalMeta()" class="bg-purple-600 text-white px-3 py-2 rounded hover:bg-purple-700 transition flex items-center gap-2"><i class="fas fa-bullseye"></i> Metas</button>
                    <button onclick="FinancasModule.renderDRE()" class="bg-indigo-600 text-white px-3 py-2 rounded hover:bg-indigo-700 transition flex items-center gap-2"><i class="fas fa-file-invoice-dollar"></i> DRE</button>
                    <button onclick="FinancasModule.renderFluxoProjetado()" class="bg-teal-600 text-white px-3 py-2 rounded hover:bg-teal-700 transition flex items-center gap-2"><i class="fas fa-chart-line"></i> Projeção</button>
                    <button onclick="FinancasModule.printDashboard()" class="bg-gray-700 text-white px-3 py-2 rounded hover:bg-gray-800 transition"><i class="fas fa-print"></i></button>
                </div>
            </div>

            <!-- KPIs Principais -->
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div class="bg-white p-4 rounded shadow border-l-4 border-green-500">
                    <div class="text-gray-500 text-xs font-bold uppercase">Receita Total</div>
                    <div class="text-2xl font-bold text-gray-800">${Utils.formatCurrency(resumo.receita)}</div>
                    <div class="text-xs text-gray-400 mt-1">Meta: ${Utils.formatCurrency(meta.receitaEsperada)}</div>
                </div>
                <div class="bg-white p-4 rounded shadow border-l-4 border-red-500">
                    <div class="text-gray-500 text-xs font-bold uppercase">Despesa Total</div>
                    <div class="text-2xl font-bold text-gray-800">${Utils.formatCurrency(resumo.despesa)}</div>
                    <div class="text-xs text-gray-400 mt-1">Max: ${Utils.formatCurrency(meta.despesaMaxima)}</div>
                </div>
                <div class="bg-white p-4 rounded shadow border-l-4 ${resumo.saldo >= 0 ? 'border-blue-500' : 'border-red-500'}">
                    <div class="text-gray-500 text-xs font-bold uppercase">Saldo Líquido</div>
                    <div class="text-2xl font-bold ${saldoClass}">${Utils.formatCurrency(resumo.saldo)}</div>
                </div>
                <div class="bg-white p-4 rounded shadow border-l-4 border-purple-500">
                    <div class="text-gray-500 text-xs font-bold uppercase">Lucratividade</div>
                    <div class="text-2xl font-bold ${lucroClass}">${resumo.lucratividade.toFixed(1)}%</div>
                    <div class="text-xs text-gray-400 mt-1">Margem Operacional</div>
                </div>
            </div>

            <!-- Seção de Metas (Progresso) -->
            <div class="bg-white p-6 rounded shadow mb-6">
                <h4 class="font-bold text-gray-700 mb-4 border-b pb-2">Acompanhamento de Metas</h4>
                
                <div class="mb-4">
                    <div class="flex justify-between text-sm mb-1">
                        <span class="font-bold text-gray-600">Meta de Receita</span>
                        <span class="font-bold ${meta.atingido >= 100 ? 'text-green-600' : 'text-blue-600'}">${meta.atingido.toFixed(1)}% Atingido</span>
                    </div>
                    <div class="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                        <div class="bg-gradient-to-r from-blue-500 to-green-400 h-4 rounded-full transition-all duration-1000" style="width: ${Math.min(meta.atingido, 100)}%"></div>
                    </div>
                </div>

                ${meta.despesaMaxima > 0 ? `
                <div>
                    <div class="flex justify-between text-sm mb-1">
                        <span class="font-bold text-gray-600">Teto de Gastos</span>
                        <span class="font-bold ${resumo.despesa > meta.despesaMaxima ? 'text-red-600' : 'text-green-600'}">
                            ${((resumo.despesa / meta.despesaMaxima) * 100).toFixed(1)}% Utilizado
                        </span>
                    </div>
                    <div class="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                        <div class="bg-gradient-to-r from-green-400 to-red-500 h-4 rounded-full transition-all duration-1000" style="width: ${Math.min((resumo.despesa / meta.despesaMaxima) * 100, 100)}%"></div>
                    </div>
                </div>
                ` : ''}
            </div>

            <!-- Gráficos -->
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                <div class="bg-white p-6 rounded shadow lg:col-span-2">
                    <h4 class="font-bold text-gray-700 mb-4">Fluxo de Caixa Diário</h4>
                    <div class="h-64"><canvas id="chartFluxoDiario"></canvas></div>
                </div>
                <div class="bg-white p-6 rounded shadow">
                    <h4 class="font-bold text-gray-700 mb-4">Despesas por Categoria</h4>
                    <div class="h-64"><canvas id="chartDespesasCat"></canvas></div>
                </div>
            </div>

            <!-- Pendências Financeiras -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="bg-white p-6 rounded shadow border-t-4 border-red-400">
                    <h4 class="font-bold text-gray-700 mb-4 flex justify-between">
                        <span>Contas a Pagar</span>
                        <span class="text-red-600">${Utils.formatCurrency(pendencias.aPagar)}</span>
                    </h4>
                    <div class="text-sm text-gray-600">
                        <p class="mb-2">Total em Atraso: <span class="font-bold text-red-600">${Utils.formatCurrency(pendencias.aPagarAtrasado)}</span></p>
                        <button onclick="Utils.navigate('financeiro', 'pagar')" class="text-blue-600 hover:underline text-xs">Ver Detalhes <i class="fas fa-arrow-right"></i></button>
                    </div>
                </div>
                <div class="bg-white p-6 rounded shadow border-t-4 border-green-400">
                    <h4 class="font-bold text-gray-700 mb-4 flex justify-between">
                        <span>Contas a Receber</span>
                        <span class="text-green-600">${Utils.formatCurrency(pendencias.aReceber)}</span>
                    </h4>
                    <div class="text-sm text-gray-600">
                        <p class="mb-2">Total em Atraso: <span class="font-bold text-red-600">${Utils.formatCurrency(pendencias.aReceberAtrasado)}</span></p>
                        <button onclick="Utils.navigate('financeiro', 'receber')" class="text-blue-600 hover:underline text-xs">Ver Detalhes <i class="fas fa-arrow-right"></i></button>
                    </div>
                </div>
            </div>
        `;

        // Renderizar Gráficos
        FinancasModule.renderCharts(graficos);
    },

    renderCharts: (data) => {
        // Fluxo Diário
        if (FinancasModule.state.charts.fluxo) FinancasModule.state.charts.fluxo.destroy();
        
        const ctxFluxo = document.getElementById('chartFluxoDiario');
        if (ctxFluxo) {
            FinancasModule.state.charts.fluxo = new Chart(ctxFluxo, {
                type: 'bar',
                data: {
                    labels: data.fluxoDiario.map(d => d.date.split('-').slice(1).reverse().join('/')),
                    datasets: [
                        { label: 'Receita', data: data.fluxoDiario.map(d => d.receita), backgroundColor: '#10B981', borderRadius: 2 },
                        { label: 'Despesa', data: data.fluxoDiario.map(d => d.despesa), backgroundColor: '#EF4444', borderRadius: 2 }
                    ]
                },
                options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
            });
        }

        // Despesas por Categoria
        if (FinancasModule.state.charts.cat) FinancasModule.state.charts.cat.destroy();

        const ctxCat = document.getElementById('chartDespesasCat');
        if (ctxCat) {
            FinancasModule.state.charts.cat = new Chart(ctxCat, {
                type: 'doughnut',
                data: {
                    labels: data.despesasCategoria.map(d => d.name),
                    datasets: [{
                        data: data.despesasCategoria.map(d => d.value),
                        backgroundColor: ['#EF4444', '#F59E0B', '#3B82F6', '#8B5CF6', '#EC4899', '#6B7280']
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { boxWidth: 10, font: { size: 10 } } } } }
            });
        }
    },

    modalMeta: async () => {
        const monthKey = FinancasModule.state.filterStart.substring(0, 7); // YYYY-MM
        
        // Tenta buscar meta existente para o mês
        let meta = {};
        try {
            const { data } = await Utils.api('getAll', 'MetasFinanceiras'); // Ideal seria filtrar no backend, mas getAll serve para poucos registros
            meta = data.find(m => m.Mes === monthKey) || {};
        } catch (e) { console.warn('Erro ao buscar metas:', e); }

        Utils.openModal('Definir Metas Financeiras', `
            <form onsubmit="FinancasModule.saveMeta(event)">
                <input type="hidden" name="ID" value="${meta.ID || ''}">
                <div class="mb-4 bg-blue-50 p-3 rounded border border-blue-100 text-sm text-blue-800">
                    Definindo metas para o mês de: <strong>${monthKey}</strong>
                    <input type="hidden" name="Mes" value="${monthKey}">
                </div>
                
                <div class="mb-4">
                    <label class="block text-sm font-bold text-gray-700 mb-1">Meta de Receita (Kz)</label>
                    <input type="number" name="ReceitaEsperada" value="${meta.ReceitaEsperada || ''}" class="border p-2 rounded w-full font-bold text-green-700" placeholder="0.00" required>
                    <p class="text-xs text-gray-500 mt-1">Valor alvo de vendas/entradas para este mês.</p>
                </div>

                <div class="mb-6">
                    <label class="block text-sm font-bold text-gray-700 mb-1">Teto de Despesas (Kz)</label>
                    <input type="number" name="DespesaMaxima" value="${meta.DespesaMaxima || ''}" class="border p-2 rounded w-full font-bold text-red-700" placeholder="0.00" required>
                    <p class="text-xs text-gray-500 mt-1">Limite máximo de gastos planejado.</p>
                </div>

                <button class="w-full bg-purple-600 text-white py-3 rounded font-bold hover:bg-purple-700 transition">Salvar Metas</button>
            </form>
        `);
    },

    saveMeta: async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target).entries());
        
        try {
            await Utils.api('save', 'MetasFinanceiras', data);
            Utils.toast('Metas atualizadas com sucesso!', 'success');
            Utils.closeModal();
            FinancasModule.fetchDashboard(); // Recarrega para atualizar as barras de progresso
        } catch (err) {
            Utils.toast('Erro ao salvar metas: ' + err.message, 'error');
        }
    },

    printDashboard: () => {
        const data = FinancasModule.state.dashboardData;
        if (!data) return;
        
        const { resumo, pendencias } = data;
        const user = Utils.getUser();
        
        // Captura os gráficos como imagem (base64)
        const imgFluxo = document.getElementById('chartFluxoDiario').toDataURL('image/png');
        const imgCat = document.getElementById('chartDespesasCat').toDataURL('image/png');

        const html = `
            <div class="p-8 font-sans text-gray-900 bg-white">
                <div class="flex items-center justify-between border-b-2 border-gray-800 pb-4 mb-6">
                    <div>
                        <h1 class="text-2xl font-bold uppercase">Relatório Financeiro</h1>
                        <p class="text-sm text-gray-500">Período: ${Utils.formatDate(FinancasModule.state.filterStart)} a ${Utils.formatDate(FinancasModule.state.filterEnd)}</p>
                    </div>
                    <div class="text-right">
                        <p class="text-xs text-gray-500">Gerado por: ${user.Nome}</p>
                        <p class="text-xs text-gray-500">${new Date().toLocaleString()}</p>
                    </div>
                </div>

                <!-- Resumo -->
                <div class="grid grid-cols-4 gap-4 mb-8 text-center">
                    <div class="p-2 border bg-green-50">
                        <div class="text-xs text-gray-500 uppercase">Receita</div>
                        <div class="font-bold text-lg">${Utils.formatCurrency(resumo.receita)}</div>
                    </div>
                    <div class="p-2 border bg-red-50">
                        <div class="text-xs text-gray-500 uppercase">Despesa</div>
                        <div class="font-bold text-lg">${Utils.formatCurrency(resumo.despesa)}</div>
                    </div>
                    <div class="p-2 border bg-gray-50">
                        <div class="text-xs text-gray-500 uppercase">Saldo</div>
                        <div class="font-bold text-lg">${Utils.formatCurrency(resumo.saldo)}</div>
                    </div>
                    <div class="p-2 border bg-purple-50">
                        <div class="text-xs text-gray-500 uppercase">Lucratividade</div>
                        <div class="font-bold text-lg">${resumo.lucratividade.toFixed(1)}%</div>
                    </div>
                </div>

                <!-- Pendências -->
                <div class="mb-8">
                    <h3 class="font-bold border-b mb-2">Posição de Contas</h3>
                    <table class="w-full text-sm border-collapse border">
                        <tr class="bg-gray-100"><th>Tipo</th><th class="text-right">Total Aberto</th><th class="text-right">Em Atraso</th></tr>
                        <tr>
                            <td class="border p-2">A Pagar</td>
                            <td class="border p-2 text-right">${Utils.formatCurrency(pendencias.aPagar)}</td>
                            <td class="border p-2 text-right text-red-600 font-bold">${Utils.formatCurrency(pendencias.aPagarAtrasado)}</td>
                        </tr>
                        <tr>
                            <td class="border p-2">A Receber</td>
                            <td class="border p-2 text-right">${Utils.formatCurrency(pendencias.aReceber)}</td>
                            <td class="border p-2 text-right text-red-600 font-bold">${Utils.formatCurrency(pendencias.aReceberAtrasado)}</td>
                        </tr>
                    </table>
                </div>

                <!-- Gráficos -->
                <div class="grid grid-cols-2 gap-4">
                    <div><h4 class="text-center text-xs font-bold mb-2">Fluxo Diário</h4><img src="${imgFluxo}" style="width:100%"></div>
                    <div><h4 class="text-center text-xs font-bold mb-2">Despesas por Categoria</h4><img src="${imgCat}" style="width:100%"></div>
                </div>
            </div>
        `;

        // Usa a função de impressão nativa (assumindo que Utils ou outro módulo tenha, ou implementamos aqui)
        // Como este é um módulo novo, vou incluir a função printNative aqui também para garantir.
        if (typeof EstoqueModule !== 'undefined' && EstoqueModule.printNative) {
            EstoqueModule.printNative(html);
        } else if (typeof RHModule !== 'undefined' && RHModule.printNative) {
            RHModule.printNative(html);
        } else {
            // Fallback simples se não houver printNative global
            const win = window.open('', '', 'width=800,height=600');
            win.document.write(html);
            win.document.close();
            win.print();
        }
    },

    renderDRE: async () => {
        const { filterStart, filterEnd } = FinancasModule.state;
        
        try {
            Utils.toast('Gerando DRE...', 'info');
            const dre = await Utils.api('getDRE', null, { startDate: filterStart, endDate: filterEnd });
            
            // Cálculos Intermediários
            const receitaLiquida = dre.receitaBruta - dre.impostos;
            const lucroBruto = receitaLiquida - dre.custosVariaveis;
            const totalDespesasOp = dre.despesasPessoal + dre.despesasAdministrativas;
            const resultadoOperacional = lucroBruto - totalDespesasOp; // EBITDA aprox
            const lucroLiquido = resultadoOperacional - dre.despesasFinanceiras + dre.outrasReceitas;
            
            const margemLucro = dre.receitaBruta > 0 ? (lucroLiquido / dre.receitaBruta) * 100 : 0;

            const html = `
                <div class="p-8 font-sans text-gray-900 bg-white max-w-4xl mx-auto border shadow-lg my-8">
                    <div class="text-center mb-8 border-b pb-4">
                        <h1 class="text-2xl font-bold uppercase">Demonstrativo de Resultados (DRE)</h1>
                        <p class="text-sm text-gray-500">Período: ${Utils.formatDate(filterStart)} a ${Utils.formatDate(filterEnd)}</p>
                    </div>

                    <table class="w-full text-sm border-collapse">
                        <tbody>
                            <!-- RECEITA BRUTA -->
                            <tr class="font-bold bg-gray-50">
                                <td class="p-2 border-b">(+) RECEITA BRUTA DE VENDAS</td>
                                <td class="p-2 border-b text-right text-blue-700">${Utils.formatCurrency(dre.receitaBruta)}</td>
                                <td class="p-2 border-b text-right text-xs text-gray-500">100%</td>
                            </tr>
                            <tr>
                                <td class="p-2 pl-6 text-gray-600">(-) Impostos e Deduções</td>
                                <td class="p-2 text-right text-red-500">(${Utils.formatCurrency(dre.impostos)})</td>
                                <td class="p-2 text-right text-xs text-gray-400"></td>
                            </tr>

                            <!-- RECEITA LÍQUIDA -->
                            <tr class="font-bold bg-gray-100">
                                <td class="p-2 border-y">(=) RECEITA LÍQUIDA</td>
                                <td class="p-2 border-y text-right">${Utils.formatCurrency(receitaLiquida)}</td>
                                <td class="p-2 border-y text-right text-xs text-gray-500">${dre.receitaBruta > 0 ? ((receitaLiquida/dre.receitaBruta)*100).toFixed(1) : 0}%</td>
                            </tr>
                            <tr>
                                <td class="p-2 pl-6 text-gray-600">(-) Custos Variáveis (CMV/Insumos)</td>
                                <td class="p-2 text-right text-red-500">(${Utils.formatCurrency(dre.custosVariaveis)})</td>
                                <td class="p-2 text-right text-xs text-gray-400"></td>
                            </tr>

                            <!-- LUCRO BRUTO -->
                            <tr class="font-bold bg-gray-100">
                                <td class="p-2 border-y">(=) LUCRO BRUTO</td>
                                <td class="p-2 border-y text-right">${Utils.formatCurrency(lucroBruto)}</td>
                                <td class="p-2 border-y text-right text-xs text-gray-500">${dre.receitaBruta > 0 ? ((lucroBruto/dre.receitaBruta)*100).toFixed(1) : 0}%</td>
                            </tr>
                            
                            <!-- DESPESAS OPERACIONAIS -->
                            <tr><td colspan="3" class="p-2 font-bold text-gray-700 mt-2">(-) DESPESAS OPERACIONAIS</td></tr>
                            <tr>
                                <td class="p-2 pl-6 text-gray-600">Despesas com Pessoal</td>
                                <td class="p-2 text-right text-red-500">(${Utils.formatCurrency(dre.despesasPessoal)})</td>
                                <td class="p-2"></td>
                            </tr>
                            <tr>
                                <td class="p-2 pl-6 text-gray-600">Despesas Administrativas/Gerais</td>
                                <td class="p-2 text-right text-red-500">(${Utils.formatCurrency(dre.despesasAdministrativas)})</td>
                                <td class="p-2"></td>
                            </tr>

                            <!-- RESULTADO OPERACIONAL -->
                            <tr class="font-bold bg-gray-100">
                                <td class="p-2 border-y">(=) RESULTADO OPERACIONAL (EBITDA)</td>
                                <td class="p-2 border-y text-right">${Utils.formatCurrency(resultadoOperacional)}</td>
                                <td class="p-2 border-y text-right text-xs text-gray-500">${dre.receitaBruta > 0 ? ((resultadoOperacional/dre.receitaBruta)*100).toFixed(1) : 0}%</td>
                            </tr>

                            <tr>
                                <td class="p-2 pl-6 text-gray-600">(-) Despesas Financeiras</td>
                                <td class="p-2 text-right text-red-500">(${Utils.formatCurrency(dre.despesasFinanceiras)})</td>
                                <td class="p-2"></td>
                            </tr>
                            <tr>
                                <td class="p-2 pl-6 text-gray-600">(+) Outras Receitas</td>
                                <td class="p-2 text-right text-blue-500">${Utils.formatCurrency(dre.outrasReceitas)}</td>
                                <td class="p-2"></td>
                            </tr>

                            <!-- LUCRO LÍQUIDO -->
                            <tr class="font-bold text-lg ${lucroLiquido >= 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                                <td class="p-4 border-t-2 border-gray-400">(=) LUCRO LÍQUIDO DO EXERCÍCIO</td>
                                <td class="p-4 border-t-2 border-gray-400 text-right">${Utils.formatCurrency(lucroLiquido)}</td>
                                <td class="p-4 border-t-2 border-gray-400 text-right text-sm">${margemLucro.toFixed(1)}%</td>
                            </tr>
                        </tbody>
                    </table>
                    
                    <div class="mt-8 text-center">
                        <button onclick="FinancasModule.printDRE()" class="bg-gray-800 text-white px-6 py-2 rounded hover:bg-gray-900"><i class="fas fa-print"></i> Imprimir DRE</button>
                        <button onclick="FinancasModule.render()" class="ml-2 text-gray-600 hover:underline">Voltar</button>
                    </div>
                </div>
            `;
            
            document.getElementById('financas-content').innerHTML = html;
        } catch (e) {
            Utils.toast('Erro ao gerar DRE: ' + e.message, 'error');
        }
    },

    printDRE: () => {
        const content = document.querySelector('#financas-content > div').innerHTML;
        // Remove os botões de ação para a impressão
        const cleanContent = content.replace(/<button.*?>.*?<\/button>/g, '');
        
        if (typeof EstoqueModule !== 'undefined' && EstoqueModule.printNative) {
            EstoqueModule.printNative(cleanContent);
        } else {
            const win = window.open('', '', 'width=800,height=600');
            win.document.write(`<html><head><title>DRE</title><script src="https://cdn.tailwindcss.com"></script></head><body>${cleanContent}</body></html>`);
            win.document.close();
            setTimeout(() => win.print(), 1000);
        }
    },

    renderFluxoProjetado: async () => {
        const { filterStart, filterEnd } = FinancasModule.state;
        
        try {
            Utils.toast('Calculando projeção...', 'info');
            const data = await Utils.api('getProjectedCashFlow', null, { startDate: filterStart, endDate: filterEnd });
            
            const html = `
                <div class="bg-white p-6 rounded shadow mb-6">
                    <div class="flex justify-between items-center mb-4">
                        <h3 class="text-xl font-bold text-gray-800">Fluxo de Caixa Projetado (Previsão)</h3>
                        <button onclick="FinancasModule.render()" class="text-gray-600 hover:underline">Voltar</button>
                    </div>
                    <p class="text-sm text-gray-500 mb-4">Baseado nas contas a pagar e receber em aberto.</p>
                    
                    <div class="h-80"><canvas id="chartProjecao"></canvas></div>
                    
                    <div class="mt-4 grid grid-cols-3 gap-4 text-center">
                        <div class="p-3 bg-gray-50 rounded"><span class="block text-xs text-gray-500">Saldo Atual</span><span class="font-bold text-lg">${Utils.formatCurrency(data.saldoAtual)}</span></div>
                        <div class="p-3 bg-gray-50 rounded"><span class="block text-xs text-gray-500">Saldo Final Projetado</span><span class="font-bold text-lg ${data.projection[data.projection.length-1]?.saldo >= 0 ? 'text-green-600' : 'text-red-600'}">${Utils.formatCurrency(data.projection[data.projection.length-1]?.saldo || 0)}</span></div>
                    </div>
                </div>
            `;
            
            document.getElementById('financas-content').innerHTML = html;

            // Renderizar Gráfico
            new Chart(document.getElementById('chartProjecao'), {
                type: 'line',
                data: {
                    labels: data.projection.map(d => Utils.formatDate(d.data)),
                    datasets: [
                        { label: 'Saldo Projetado', data: data.projection.map(d => d.saldo), borderColor: '#0D9488', backgroundColor: 'rgba(13, 148, 136, 0.1)', fill: true, tension: 0.3, yAxisID: 'y' },
                        { label: 'Entradas Previstas', data: data.projection.map(d => d.entradas), backgroundColor: '#10B981', type: 'bar', yAxisID: 'y1' },
                        { label: 'Saídas Previstas', data: data.projection.map(d => d.saidas), backgroundColor: '#EF4444', type: 'bar', yAxisID: 'y1' }
                    ]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    scales: {
                        y: { type: 'linear', display: true, position: 'left', title: { display: true, text: 'Saldo Acumulado' } },
                        y1: { type: 'linear', display: true, position: 'right', grid: { drawOnChartArea: false }, title: { display: true, text: 'Movimentação Diária' } }
                    }
                }
            });
        } catch (e) { Utils.toast('Erro na projeção: ' + e.message, 'error'); }
    }
};

document.addEventListener('DOMContentLoaded', FinancasModule.init);