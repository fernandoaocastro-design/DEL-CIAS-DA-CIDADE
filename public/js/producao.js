const ProducaoModule = {
    state: {
        activeTab: 'planejamento',
        fichas: [],
        planejamento: [],
        ordens: [],
        desperdicio: [],
        estoque: [], // Necessário para ingredientes
        consumo: [],
        charts: {},
        instituicao: []
    },

    init: () => {
        ProducaoModule.fetchData();
    },

    fetchData: async () => {
        try {
            const [fichas, plan, ordens, desp, estoque, consumo, inst] = await Promise.all([
                Utils.api('getAll', 'FichasTecnicas'),
                Utils.api('getAll', 'PlanejamentoProducao'),
                Utils.api('getAll', 'OrdensProducao'),
                Utils.api('getAll', 'ControleDesperdicio'),
                Utils.api('getAll', 'Estoque'),
                Utils.api('getAll', 'ConsumoIngredientes'),
                Utils.api('getAll', 'InstituicaoConfig')
            ]);
            
            ProducaoModule.state.fichas = fichas || [];
            ProducaoModule.state.planejamento = plan || [];
            ProducaoModule.state.ordens = ordens || [];
            ProducaoModule.state.desperdicio = desp || [];
            ProducaoModule.state.estoque = estoque || [];
            ProducaoModule.state.consumo = consumo || [];
            ProducaoModule.state.instituicao = inst || [];
            
            ProducaoModule.render();
        } catch (e) {
            console.error(e);
            Utils.toast("Erro ao carregar dados de produção.", 'error');
        }
    },

    setTab: (tab) => {
        ProducaoModule.state.activeTab = tab;
        
        // Atualiza visual das abas
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.className = 'tab-btn px-4 py-2 text-gray-500 hover:text-gray-700 transition whitespace-nowrap';
            btn.style.borderBottom = 'none';
        });
        const activeBtn = document.getElementById(`tab-${tab}`);
        if(activeBtn) {
            activeBtn.className = 'tab-btn px-4 py-2 font-bold text-orange-600 border-b-2 border-orange-500 transition whitespace-nowrap';
        }
        ProducaoModule.render();
    },

    render: () => {
        const container = document.getElementById('producao-content');
        const tab = ProducaoModule.state.activeTab;

        if (tab === 'planejamento') ProducaoModule.renderPlanejamento(container);
        else if (tab === 'fichas') ProducaoModule.renderFichas(container);
        else if (tab === 'ordens') ProducaoModule.renderOrdens(container);
        else if (tab === 'ingredientes') ProducaoModule.renderIngredientes(container);
        else if (tab === 'desperdicio') ProducaoModule.renderDesperdicio(container);
        else if (tab === 'custos') ProducaoModule.renderCustos(container);
        else if (tab === 'relatorios') ProducaoModule.renderRelatorios(container);
    },

    // 🍽️ 1️⃣ Planejamento de Produção
    renderPlanejamento: (container) => {
        const data = ProducaoModule.state.planejamento;
        container.innerHTML = `
            <div class="flex justify-between mb-4">
                <h3 class="text-xl font-bold text-gray-800">Planejamento de Produção</h3>
                <button onclick="ProducaoModule.modalPlanejamento()" class="bg-orange-600 text-white px-4 py-2 rounded shadow hover:bg-orange-700">
                    <i class="fas fa-plus"></i> Novo Planejamento
                </button>
            </div>
            <div class="bg-white rounded shadow overflow-x-auto">
                <table class="w-full text-sm text-left">
                    <thead class="bg-gray-100 text-gray-600 uppercase">
                        <tr><th>Data</th><th>Refeição</th><th>Setor</th><th>Receita</th><th>Qtd Plan.</th><th>Status</th><th>Ações</th></tr>
                    </thead>
                    <tbody class="divide-y">
                        ${data.map(p => `
                            <tr class="hover:bg-gray-50">
                                <td class="p-3">${Utils.formatDate(p.DataProducao)}</td>
                                <td class="p-3">${p.TipoRefeicao}</td>
                                <td class="p-3">${p.Setor}</td>
                                <td class="p-3 font-bold">${p.ReceitaNome}</td>
                                <td class="p-3">${p.QtdPlanejada}</td>
                                <td class="p-3"><span class="px-2 py-1 rounded text-xs bg-blue-100 text-blue-800">${p.Status}</span></td>
                                <td class="p-3">
                                    <button onclick="ProducaoModule.gerarOrdem('${p.ID}')" class="text-green-600 hover:text-green-800" title="Gerar Ordem"><i class="fas fa-file-signature"></i></button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },

    modalPlanejamento: () => {
        const receitas = ProducaoModule.state.fichas;
        Utils.openModal('Novo Planejamento', `
            <form onsubmit="ProducaoModule.save(event, 'PlanejamentoProducao')">
                <div class="grid grid-cols-2 gap-3 mb-3">
                    <div><label class="text-xs font-bold">Data Produção</label><input type="date" name="DataProducao" class="border p-2 rounded w-full" required></div>
                    <div><label class="text-xs font-bold">Tipo Refeição</label>
                        <select name="TipoRefeicao" class="border p-2 rounded w-full">
                            <option>Café da Manhã</option><option>Almoço</option><option>Jantar</option><option>Ceia</option>
                        </select>
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-3 mb-3">
                    <div><label class="text-xs font-bold">Setor / Unidade</label><input name="Setor" class="border p-2 rounded w-full" placeholder="Ex: Pediatria"></div>
                    <div><label class="text-xs font-bold">Nº Pacientes</label><input type="number" name="QtdPacientes" class="border p-2 rounded w-full"></div>
                </div>
                <div class="mb-3">
                    <label class="text-xs font-bold">Receita Planejada</label>
                    <select name="ReceitaID" class="border p-2 rounded w-full" onchange="this.form.ReceitaNome.value = this.options[this.selectedIndex].text">
                        <option value="">Selecione...</option>
                        ${receitas.map(r => `<option value="${r.ID}">${r.Nome}</option>`).join('')}
                    </select>
                    <input type="hidden" name="ReceitaNome">
                </div>
                <div class="grid grid-cols-2 gap-3 mb-3">
                    <div><label class="text-xs font-bold">Qtd Planejada (Kg/Porções)</label><input type="number" name="QtdPlanejada" class="border p-2 rounded w-full"></div>
                    <div><label class="text-xs font-bold">Resp. Técnico</label><input name="ResponsavelTecnico" class="border p-2 rounded w-full"></div>
                </div>
                <div class="mb-3"><label class="text-xs font-bold">Observações</label><textarea name="Observacoes" class="border p-2 rounded w-full"></textarea></div>
                <button class="w-full bg-orange-600 text-white py-2 rounded font-bold">Salvar Planejamento</button>
            </form>
        `);
    },

    // 🧑‍🍳 2️⃣ Fichas Técnicas
    renderFichas: (container) => {
        const data = ProducaoModule.state.fichas;
        container.innerHTML = `
            <div class="flex justify-between mb-4">
                <h3 class="text-xl font-bold text-gray-800">Fichas Técnicas</h3>
                <button onclick="ProducaoModule.modalFicha()" class="bg-orange-600 text-white px-4 py-2 rounded shadow hover:bg-orange-700">
                    <i class="fas fa-plus"></i> Nova Ficha
                </button>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                ${data.map(f => `
                    <div class="bg-white p-4 rounded shadow border-l-4 border-orange-400">
                        <h4 class="font-bold text-lg">${f.Nome}</h4>
                        <p class="text-xs text-gray-500 mb-2">${f.Categoria || 'Geral'}</p>
                        <div class="text-sm mb-2">
                            <div>⏱️ ${f.TempoPreparo || '-'}</div>
                            <div>🥘 Rendimento: ${f.Rendimento || 0} porções</div>
                            <div class="font-bold text-green-600">💰 Custo: ${Utils.formatCurrency(f.CustoPorPorcao)}</div>
                        </div>
                        <div class="flex gap-3 mt-2">
                            <button onclick="ProducaoModule.modalFicha('${f.ID}')" class="text-blue-600 text-sm hover:underline">Editar</button>
                            <button onclick="ProducaoModule.duplicarFicha('${f.ID}')" class="text-gray-600 text-sm hover:text-gray-800" title="Duplicar"><i class="fas fa-copy"></i> Duplicar</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    },

    duplicarFicha: async (id) => {
        if(!confirm('Deseja duplicar esta ficha técnica?')) return;
        const original = ProducaoModule.state.fichas.find(f => f.ID === id);
        if(!original) return;

        const copia = { ...original };
        delete copia.ID;
        delete copia.CriadoEm;
        copia.Nome = copia.Nome + ' (Cópia)';

        try {
            await Utils.api('save', 'FichasTecnicas', copia);
            Utils.toast('Ficha duplicada com sucesso!', 'success');
            ProducaoModule.fetchData();
        } catch (err) { Utils.toast('Erro ao duplicar: ' + err.message, 'error'); }
    },

    modalFicha: (id = null) => {
        const ficha = id ? ProducaoModule.state.fichas.find(f => f.ID === id) : {};
        const estoque = ProducaoModule.state.estoque || [];
        const ingredientes = ficha.IngredientesJSON || [];

        // Função para adicionar linha de ingrediente
        window.addIngrediente = () => {
            const container = document.getElementById('lista-ingredientes');
            const index = container.children.length;
            const div = document.createElement('div');
            div.className = 'grid grid-cols-12 gap-2 mb-2 items-center ingrediente-row';
            div.innerHTML = `
                <div class="col-span-6">
                    <select name="ingrediente_id_${index}" class="border p-2 rounded w-full text-sm" onchange="updateCusto(this)">
                        <option value="">Selecione...</option>
                        ${estoque.map(e => `<option value="${e.ID}" data-custo="${e.CustoUnitario}" data-unidade="${e.Unidade}">${e.Nome} (${e.Unidade})</option>`).join('')}
                    </select>
                </div>
                <div class="col-span-3">
                    <input type="number" step="0.001" name="ingrediente_qtd_${index}" class="border p-2 rounded w-full text-sm" placeholder="Qtd" oninput="calcCustoTotal()">
                </div>
                <div class="col-span-2">
                    <input type="text" readonly class="border p-2 rounded w-full text-sm bg-gray-100 text-right custo-parcial" value="0.00">
                </div>
                <div class="col-span-1 text-center">
                    <button type="button" onclick="this.parentElement.parentElement.remove(); calcCustoTotal()" class="text-red-500"><i class="fas fa-times"></i></button>
                </div>
            `;
            container.appendChild(div);
        };

        Utils.openModal(id ? 'Editar Ficha Técnica' : 'Nova Ficha Técnica', `
            <form onsubmit="ProducaoModule.save(event, 'FichasTecnicas')">
                <input type="hidden" name="ID" value="${ficha.ID || ''}">
                <div class="mb-3"><label class="text-xs font-bold">Nome da Preparação</label><input name="Nome" value="${ficha.Nome || ''}" class="border p-2 rounded w-full" required></div>
                <div class="grid grid-cols-2 gap-3 mb-3">
                    <div><label class="text-xs font-bold">Categoria</label><select name="Categoria" class="border p-2 rounded w-full"><option>Prato Principal</option><option>Guarnição</option><option>Sobremesa</option><option>Salada</option></select></div>
                    <div><label class="text-xs font-bold">Tempo Preparo</label><input name="TempoPreparo" value="${ficha.TempoPreparo || ''}" class="border p-2 rounded w-full"></div>
                </div>
                <div class="grid grid-cols-2 gap-3 mb-3">
                    <div><label class="text-xs font-bold">Rendimento (Porções)</label><input type="number" name="Rendimento" value="${ficha.Rendimento || ''}" class="border p-2 rounded w-full"></div>
                    <div><label class="text-xs font-bold">Custo Total (Kz)</label><input type="number" step="0.01" id="custo-total" name="CustoPorPorcao" value="${ficha.CustoPorPorcao || ''}" class="border p-2 rounded w-full bg-gray-100" readonly></div>
                </div>
                
                <h4 class="font-bold text-gray-700 mb-2 border-b mt-4">Ingredientes</h4>
                <div id="lista-ingredientes" class="mb-2"></div>
                <button type="button" onclick="addIngrediente()" class="text-sm text-blue-600 hover:underline mb-4">+ Adicionar Ingrediente</button>

                <div class="mb-3"><label class="text-xs font-bold">Modo de Preparo</label><textarea name="ModoPreparo" class="border p-2 rounded w-full h-24">${ficha.ModoPreparo || ''}</textarea></div>
                <button class="w-full bg-orange-600 text-white py-2 rounded font-bold">Salvar Ficha</button>
            </form>
        `);

        // Funções globais para o modal
        window.updateCusto = (select) => {
            calcCustoTotal();
        };

        window.calcCustoTotal = () => {
            let total = 0;
            document.querySelectorAll('.ingrediente-row').forEach(row => {
                const select = row.querySelector('select');
                const qtdInput = row.querySelector('input[type="number"]');
                const custoInput = row.querySelector('.custo-parcial');
                
                if (select.selectedIndex > 0) {
                    const option = select.options[select.selectedIndex];
                    const custoUnit = parseFloat(option.getAttribute('data-custo')) || 0;
                    const qtd = parseFloat(qtdInput.value) || 0;
                    const parcial = custoUnit * qtd;
                    
                    custoInput.value = parcial.toFixed(2);
                    total += parcial;
                }
            });
            document.getElementById('custo-total').value = total.toFixed(2);
        };

        // Carregar ingredientes existentes
        if (ingredientes && ingredientes.length > 0) {
            ingredientes.forEach((ing, i) => {
                addIngrediente();
                const rows = document.querySelectorAll('.ingrediente-row');
                const lastRow = rows[rows.length - 1];
                const select = lastRow.querySelector('select');
                const qtdInput = lastRow.querySelector('input[type="number"]');
                
                select.value = ing.id;
                qtdInput.value = ing.quantidade;
            });
            calcCustoTotal();
        }
    },

    // 🧾 3️⃣ Ordem de Produção
    renderOrdens: (container) => {
        const data = ProducaoModule.state.ordens;
        const planejamento = ProducaoModule.state.planejamento;
        container.innerHTML = `
            <div class="flex justify-between mb-4">
                <h3 class="text-xl font-bold text-gray-800">Ordens de Produção</h3>
            </div>
            <div class="bg-white rounded shadow overflow-x-auto">
                <table class="w-full text-sm text-left">
                    <thead class="bg-gray-100 text-gray-600 uppercase">
                        <tr><th>Nº</th><th>Data</th><th>Turno</th><th>Responsável</th><th>Qtd Prod.</th><th>Status</th><th>Ações</th></tr>
                    </thead>
                    <tbody class="divide-y">
                        ${data.map(o => {
                            // Lógica de Alerta de Divergência
                            const plan = planejamento.find(p => p.ID === o.PlanejamentoID);
                            const qtdPlan = plan ? Number(plan.QtdPlanejada) : 0;
                            const qtdProd = Number(o.QtdProduzida) || 0;
                            let alertHtml = '';
                            
                            if (o.Status === 'Concluída' && qtdPlan > 0) {
                                const diff = Math.abs(qtdProd - qtdPlan);
                                const percent = (diff / qtdPlan) * 100;
                                if (percent > 10) { // Alerta se diferença > 10%
                                    alertHtml = `<span class="ml-2 text-red-500 cursor-help" title="Divergência: ${percent.toFixed(1)}% (Plan: ${qtdPlan})"><i class="fas fa-exclamation-triangle"></i></span>`;
                                }
                            }

                            return `
                            <tr class="hover:bg-gray-50">
                                <td class="p-3 font-bold">#${o.Codigo}</td>
                                <td class="p-3">${Utils.formatDate(o.Data)}</td>
                                <td class="p-3">${o.Turno || '-'}</td>
                                <td class="p-3">${o.Responsavel || '-'}</td>
                                <td class="p-3">${o.QtdProduzida || 0} ${alertHtml}</td>
                                <td class="p-3"><span class="px-2 py-1 rounded text-xs ${o.Status === 'Concluída' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}">${o.Status}</span></td>
                                <td class="p-3 flex gap-2">
                                    <button onclick="ProducaoModule.modalOrdem('${o.ID}')" class="text-blue-600 hover:text-blue-800"><i class="fas fa-edit"></i></button>
                                    <button onclick="ProducaoModule.printOrdem('${o.ID}')" class="text-gray-600 hover:text-gray-800" title="Imprimir Ficha"><i class="fas fa-print"></i></button>
                                    ${o.Status !== 'Concluída' ? `<button onclick="ProducaoModule.concluirOrdem('${o.ID}')" class="text-green-600 hover:text-green-800 ml-2" title="Concluir e Baixar Estoque"><i class="fas fa-check-circle"></i></button>` : ''}
                                </td>
                            </tr>
                        `}).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },

    printOrdem: (id) => {
        const ordem = ProducaoModule.state.ordens.find(o => o.ID === id);
        if(!ordem) return;
        
        const plan = ProducaoModule.state.planejamento.find(p => p.ID === ordem.PlanejamentoID) || {};
        const ficha = ProducaoModule.state.fichas.find(f => f.ID === plan.ReceitaID) || {};
        const ingredientes = ficha.IngredientesJSON || [];
        const estoque = ProducaoModule.state.estoque || [];
        const inst = ProducaoModule.state.instituicao[0] || {};
        const showLogo = inst.ExibirLogoRelatorios;

        const element = document.getElementById('print-area-producao');
        const header = document.getElementById('pdf-header');
        const content = document.getElementById('pdf-content');

        // Cabeçalho
        header.innerHTML = `
            <div class="flex justify-between items-center">
                <div class="${showLogo && inst.LogotipoURL ? 'flex items-center gap-4' : ''}">
                    ${showLogo && inst.LogotipoURL ? `<img src="${inst.LogotipoURL}" class="h-16 w-auto object-contain">` : ''}
                    <div>
                        <h1 class="text-xl font-bold text-gray-800">${inst.NomeFantasia || 'Ordem de Produção'}</h1>
                        <p class="text-xs text-gray-500">OP #${ordem.Codigo} | Emitido em: ${new Date().toLocaleString()}</p>
                    </div>
                </div>
                <div class="text-right">
                    <div class="text-2xl font-bold text-gray-800">OP #${ordem.Codigo}</div>
                    <div class="text-sm font-bold ${ordem.Status === 'Concluída' ? 'text-green-600' : 'text-yellow-600'}">${ordem.Status.toUpperCase()}</div>
                </div>
            </div>
        `;

        // Conteúdo
        content.innerHTML = `
            <div class="grid grid-cols-2 gap-4 mb-6 border p-4 rounded bg-gray-50">
                <div>
                    <p class="text-xs text-gray-500 uppercase font-bold">Data / Turno</p>
                    <p class="font-bold">${Utils.formatDate(ordem.Data)} - ${ordem.Turno || '-'}</p>
                </div>
                <div>
                    <p class="text-xs text-gray-500 uppercase font-bold">Responsável</p>
                    <p class="font-bold">${ordem.Responsavel || 'Não definido'}</p>
                </div>
                <div>
                    <p class="text-xs text-gray-500 uppercase font-bold">Receita</p>
                    <p class="font-bold text-lg">${ficha.Nome || 'N/A'}</p>
                </div>
                <div>
                    <p class="text-xs text-gray-500 uppercase font-bold">Quantidade Planejada</p>
                    <p class="font-bold text-lg">${plan.QtdPlanejada || 0} <span class="text-sm font-normal text-gray-500">porções/kg</span></p>
                </div>
            </div>

            <h4 class="font-bold text-gray-700 mb-2 border-b pb-1">Checklist de Ingredientes</h4>
            <table class="w-full text-sm mb-6 border">
                <thead class="bg-gray-100">
                    <tr>
                        <th class="p-2 border text-center w-10">OK</th>
                        <th class="p-2 border text-left">Ingrediente</th>
                        <th class="p-2 border text-right">Qtd. Unitária</th>
                        <th class="p-2 border text-right">Qtd. Total Est.</th>
                    </tr>
                </thead>
                <tbody>
                    ${ingredientes.map(ing => {
                        const itemEstoque = estoque.find(e => e.ID === ing.id);
                        const nome = itemEstoque ? `${itemEstoque.Nome} (${itemEstoque.Unidade})` : 'Item desconhecido';
                        const qtdTotal = (Number(ing.quantidade) * (Number(plan.QtdPlanejada) / (Number(ficha.Rendimento)||1))).toFixed(2);
                        return `
                        <tr>
                            <td class="p-2 border text-center"><div class="w-4 h-4 border border-gray-400 rounded mx-auto"></div></td>
                            <td class="p-2 border">${nome}</td>
                            <td class="p-2 border text-right">${ing.quantidade}</td>
                            <td class="p-2 border text-right font-bold">${qtdTotal}</td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>

            <div class="mb-6">
                <h4 class="font-bold text-gray-700 mb-2 border-b pb-1">Modo de Preparo (Resumo)</h4>
                <div class="text-sm text-gray-600 p-2 bg-gray-50 rounded border min-h-[60px]">
                    ${ficha.ModoPreparo || 'Consultar Ficha Técnica completa.'}
                </div>
            </div>

            <div class="grid grid-cols-2 gap-8 mt-12">
                <div class="border-t border-gray-400 pt-2 text-center text-xs">
                    <p class="font-bold">Responsável pela Produção</p>
                    <p>Assinatura</p>
                </div>
                <div class="border-t border-gray-400 pt-2 text-center text-xs">
                    <p class="font-bold">Controle de Qualidade</p>
                    <p>Visto</p>
                </div>
            </div>
        `;

        element.classList.remove('hidden');
        
        const opt = {
            margin: 10,
            filename: `OP-${ordem.Codigo}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        html2pdf().set(opt).from(element).save().then(() => {
            element.classList.add('hidden');
        });
    },

    modalOrdem: (id) => {
        const ordem = ProducaoModule.state.ordens.find(o => o.ID === id);
        if(!ordem) return;

        Utils.openModal('Editar Ordem de Produção', `
            <form onsubmit="ProducaoModule.save(event, 'OrdensProducao')">
                <input type="hidden" name="ID" value="${ordem.ID}">
                <div class="grid grid-cols-2 gap-3 mb-3">
                    <div><label class="text-xs font-bold">Responsável / Cozinheiro</label><input name="Responsavel" value="${ordem.Responsavel || ''}" class="border p-2 rounded w-full"></div>
                    <div><label class="text-xs font-bold">Qtd Produzida</label><input type="number" name="QtdProduzida" value="${ordem.QtdProduzida || ''}" class="border p-2 rounded w-full"></div>
                </div>
                <div class="grid grid-cols-2 gap-3 mb-3">
                    <div><label class="text-xs font-bold">Início</label><input type="time" name="Inicio" value="${ordem.Inicio || ''}" class="border p-2 rounded w-full"></div>
                    <div><label class="text-xs font-bold">Fim</label><input type="time" name="Fim" value="${ordem.Fim || ''}" class="border p-2 rounded w-full"></div>
                </div>
                <div class="mb-3"><label class="text-xs font-bold">Observações</label><textarea name="Observacoes" class="border p-2 rounded w-full">${ordem.Observacoes || ''}</textarea></div>
                <div class="mb-3"><label class="text-xs font-bold">Status</label>
                    <select name="Status" class="border p-2 rounded w-full">
                        <option ${ordem.Status === 'Aberta' ? 'selected' : ''}>Aberta</option>
                        <option ${ordem.Status === 'Em Produção' ? 'selected' : ''}>Em Produção</option>
                        <option ${ordem.Status === 'Concluída' ? 'selected' : ''}>Concluída</option>
                    </select>
                </div>
                <button class="w-full bg-blue-600 text-white py-2 rounded font-bold">Atualizar Ordem</button>
            </form>
        `);
    },

    concluirOrdem: async (id) => {
        if(!confirm('Confirma a conclusão da produção? Isso irá baixar os ingredientes do estoque automaticamente com base na quantidade produzida.')) return;
        try {
            await Utils.api('completeProductionOrder', null, { id });
            Utils.toast('Produção concluída e estoque atualizado!', 'success');
            ProducaoModule.fetchData();
        } catch (err) { Utils.toast('Erro: ' + err.message, 'error'); }
    },

    gerarOrdem: async (planejamentoId) => {
        if(!confirm('Gerar Ordem de Produção para este planejamento?')) return;
        const plan = ProducaoModule.state.planejamento.find(p => p.ID === planejamentoId);
        
        const novaOrdem = {
            PlanejamentoID: plan.ID,
            Data: plan.DataProducao,
            Status: 'Aberta',
            Observacoes: `Gerado a partir do planejamento de ${plan.TipoRefeicao}`
        };

        try {
            await Utils.api('save', 'OrdensProducao', novaOrdem);
            Utils.toast('Ordem gerada com sucesso!', 'success');
            ProducaoModule.fetchData();
            ProducaoModule.setTab('ordens');
        } catch (err) { Utils.toast('Erro: ' + err.message, 'error'); }
    },

    // ♻️ 6️⃣ Controle de Desperdício
    renderDesperdicio: (container) => {
        const data = ProducaoModule.state.desperdicio;
        container.innerHTML = `
            <div class="flex justify-between mb-4">
                <h3 class="text-xl font-bold text-gray-800">Controle de Desperdício</h3>
                <button onclick="ProducaoModule.modalDesperdicio()" class="bg-red-600 text-white px-4 py-2 rounded shadow hover:bg-red-700">
                    <i class="fas fa-trash-alt"></i> Registrar Perda
                </button>
            </div>
            <div class="bg-white rounded shadow overflow-x-auto">
                <table class="w-full text-sm text-left">
                    <thead class="bg-gray-100 text-gray-600 uppercase">
                        <tr><th>Data</th><th>Refeição</th><th>Sobra Limpa (kg)</th><th>Sobra Suja (kg)</th><th>Motivo</th><th>Resp.</th></tr>
                    </thead>
                    <tbody class="divide-y">
                        ${data.map(d => `
                            <tr class="hover:bg-gray-50">
                                <td class="p-3">${Utils.formatDate(d.Data)}</td>
                                <td class="p-3">${d.TipoRefeicao}</td>
                                <td class="p-3 text-yellow-600 font-bold">${d.SobraLimpa || 0}</td>
                                <td class="p-3 text-red-600 font-bold">${d.SobraSuja || 0}</td>
                                <td class="p-3">${d.Motivo}</td>
                                <td class="p-3">${d.Responsavel}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },

    modalDesperdicio: () => {
        Utils.openModal('Registrar Desperdício', `
            <form onsubmit="ProducaoModule.save(event, 'ControleDesperdicio')">
                <div class="grid grid-cols-2 gap-3 mb-3">
                    <div><label class="text-xs font-bold">Data</label><input type="date" name="Data" class="border p-2 rounded w-full" required></div>
                    <div><label class="text-xs font-bold">Tipo Refeição</label><select name="TipoRefeicao" class="border p-2 rounded w-full"><option>Almoço</option><option>Jantar</option></select></div>
                </div>
                <div class="grid grid-cols-2 gap-3 mb-3">
                    <div><label class="text-xs font-bold">Sobra Limpa (kg)</label><input type="number" step="0.01" name="SobraLimpa" class="border p-2 rounded w-full"></div>
                    <div><label class="text-xs font-bold">Sobra Suja (kg)</label><input type="number" step="0.01" name="SobraSuja" class="border p-2 rounded w-full"></div>
                </div>
                <div class="mb-3"><label class="text-xs font-bold">Motivo</label><input name="Motivo" class="border p-2 rounded w-full" placeholder="Ex: Excesso de produção"></div>
                <div class="mb-3"><label class="text-xs font-bold">Responsável</label><input name="Responsavel" class="border p-2 rounded w-full"></div>
                <button class="w-full bg-red-600 text-white py-2 rounded font-bold">Salvar Registro</button>
            </form>
        `);
    },

    // 🧂 4️⃣ Ingredientes (Placeholder visual)
    renderIngredientes: (container) => {
        container.innerHTML = `
            <div class="text-center py-10 bg-white rounded shadow">
                <i class="fas fa-carrot text-4xl text-green-500 mb-4"></i>
                <h3 class="text-xl font-bold text-gray-800">Controle de Ingredientes</h3>
                <p class="text-gray-500 mb-4">Vincule insumos do estoque às ordens de produção.</p>
                <button class="bg-green-600 text-white px-4 py-2 rounded" onclick="Utils.toast('Funcionalidade em desenvolvimento')">Baixar Estoque para Produção</button>
            </div>
        `;
    },

    // 🧮 7️⃣ Custos (Placeholder visual)
    renderCustos: (container) => {
        const ordens = ProducaoModule.state.ordens.filter(o => o.Status === 'Concluída');
        const planejamento = ProducaoModule.state.planejamento;
        const fichas = ProducaoModule.state.fichas;
        const consumo = ProducaoModule.state.consumo;
        const estoque = ProducaoModule.state.estoque;

        // Construir dados do relatório
        const relatorio = ordens.map(ordem => {
            const plan = planejamento.find(p => p.ID === ordem.PlanejamentoID);
            const ficha = plan ? fichas.find(f => f.ID === plan.ReceitaID) : null;
            
            if (!ficha) return null;

            // Custo Planejado (Unitário da Ficha)
            const custoPlanUnit = Number(ficha.CustoPorPorcao || 0);

            // Custo Real (Baseado no consumo de ingredientes vinculado à ordem)
            const ingredientesConsumidos = consumo.filter(c => c.OrdemID === ordem.ID);
            const custoRealTotal = ingredientesConsumidos.reduce((acc, item) => {
                const prod = estoque.find(e => e.ID === item.ProdutoID);
                const custoItem = prod ? Number(prod.CustoUnitario || 0) : 0;
                return acc + (Number(item.Quantidade || 0) * custoItem);
            }, 0);

            const qtdProduzida = Number(ordem.QtdProduzida || 1);
            const custoRealUnit = qtdProduzida > 0 ? custoRealTotal / qtdProduzida : 0;

            const variacao = custoPlanUnit > 0 ? ((custoRealUnit - custoPlanUnit) / custoPlanUnit) * 100 : 0;

            return {
                data: ordem.Data,
                ordem: ordem.Codigo,
                receita: ficha.Nome,
                qtd: qtdProduzida,
                custoPlan: custoPlanUnit,
                custoReal: custoRealUnit,
                variacao: variacao
            };
        }).filter(i => i !== null);

        container.innerHTML = `
            <div class="flex justify-between mb-4">
                <h3 class="text-xl font-bold text-gray-800">Relatório de Custos (Planejado vs Real)</h3>
                <button onclick="window.print()" class="bg-gray-600 text-white px-4 py-2 rounded shadow hover:bg-gray-700">
                    <i class="fas fa-print"></i> Imprimir
                </button>
            </div>
            
            <div class="bg-white p-4 rounded shadow mb-6">
                <h4 class="font-bold text-gray-700 mb-4">Variação de Custo por Receita (%)</h4>
                <div class="h-64"><canvas id="chartCustos"></canvas></div>
            </div>

            <div class="bg-white rounded shadow overflow-x-auto">
                <table class="w-full text-sm text-left">
                    <thead class="bg-gray-100 text-gray-600 uppercase">
                        <tr>
                            <th class="p-3">Data</th>
                            <th class="p-3">Ordem</th>
                            <th class="p-3">Receita</th>
                            <th class="p-3 text-center">Qtd Prod.</th>
                            <th class="p-3 text-right">Custo Plan. (Un)</th>
                            <th class="p-3 text-right">Custo Real (Un)</th>
                            <th class="p-3 text-center">Variação</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y">
                        ${relatorio.map(r => {
                            const varClass = r.variacao > 0 ? 'text-red-600' : (r.variacao < 0 ? 'text-green-600' : 'text-gray-600');
                            const varIcon = r.variacao > 0 ? '▲' : (r.variacao < 0 ? '▼' : '-');
                            return `
                            <tr class="hover:bg-gray-50">
                                <td class="p-3">${Utils.formatDate(r.data)}</td>
                                <td class="p-3 font-bold">#${r.ordem}</td>
                                <td class="p-3">${r.receita}</td>
                                <td class="p-3 text-center">${r.qtd}</td>
                                <td class="p-3 text-right">${Utils.formatCurrency(r.custoPlan)}</td>
                                <td class="p-3 text-right font-bold">${Utils.formatCurrency(r.custoReal)}</td>
                                <td class="p-3 text-center font-bold ${varClass}">
                                    ${varIcon} ${Math.abs(r.variacao).toFixed(1)}%
                                </td>
                            </tr>
                        `}).join('')}
                        ${relatorio.length === 0 ? '<tr><td colspan="7" class="p-4 text-center text-gray-500">Nenhuma ordem concluída com dados de custo.</td></tr>' : ''}
                    </tbody>
                </table>
            </div>
        `;

        // Renderizar Gráfico
        if (relatorio.length > 0) {
            if (ProducaoModule.state.charts.custos) ProducaoModule.state.charts.custos.destroy();

            const labels = relatorio.map(r => `#${r.ordem} ${r.receita}`);
            const data = relatorio.map(r => r.variacao);
            const colors = relatorio.map(r => r.variacao > 0 ? '#EF4444' : '#10B981'); // Vermelho se aumentou custo, Verde se economizou

            ProducaoModule.state.charts.custos = new Chart(document.getElementById('chartCustos'), {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Variação (%)',
                        data: data,
                        backgroundColor: colors,
                        borderRadius: 4
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
            });
        }
    },

    // 📊 5️⃣ Relatórios (Placeholder visual)
    renderRelatorios: (container) => {
        container.innerHTML = `
            <div class="text-center py-10 bg-white rounded shadow">
                <i class="fas fa-chart-bar text-4xl text-purple-500 mb-4"></i>
                <h3 class="text-xl font-bold text-gray-800">Relatórios de Eficiência</h3>
                <p class="text-gray-500">Indicadores de desperdício e rendimento.</p>
            </div>
        `;
    },

    save: async (e, table) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target).entries());
        
        // Validações básicas
        if (table === 'FichasTecnicas' && !data.Nome) return Utils.toast('Nome é obrigatório.', 'error');
        if (table === 'PlanejamentoProducao' && !data.DataProducao) return Utils.toast('Data é obrigatória.', 'error');

        // Processar Ingredientes (Fichas Técnicas)
        if (table === 'FichasTecnicas') {
            const ingredientes = [];
            const formData = new FormData(e.target);
            for (const [key, value] of formData.entries()) {
                if (key.startsWith('ingrediente_id_') && value) {
                    const index = key.split('_')[2];
                    const qtd = formData.get(`ingrediente_qtd_${index}`);
                    if (qtd) {
                        ingredientes.push({
                            id: value,
                            quantidade: Number(qtd)
                        });
                    }
                }
            }
            data.IngredientesJSON = ingredientes;
        }

        try {
            await Utils.api('save', table, data);
            Utils.toast('Salvo com sucesso!', 'success'); 
            Utils.closeModal(); 
            ProducaoModule.fetchData();
        } catch (err) { Utils.toast('Erro: ' + err.message, 'error'); }
    },

    delete: async (table, id) => {
        if(confirm('Tem certeza que deseja excluir?')) { 
            try {
                await Utils.api('delete', table, null, id); 
                ProducaoModule.fetchData(); 
            } catch (e) { Utils.toast('Erro ao apagar', 'error'); }
        }
    }
};

document.addEventListener('DOMContentLoaded', ProducaoModule.init);