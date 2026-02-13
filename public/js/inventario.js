const InventarioModule = {
    state: { bens: [], filteredBens: null, instituicao: [], filterTerm: '', filterDept: '', charts: {}, pagination: { page: 1, limit: 15, total: 0 } },

    init: () => {
        InventarioModule.fetchData();
    },

    fetchData: async () => {
        try {
            const [data, inst] = await Promise.all([
                Utils.api('getAll', 'Inventario'),
                Utils.api('getAll', 'InstituicaoConfig')
            ]);
            InventarioModule.state.bens = data || [];
            InventarioModule.state.instituicao = inst || [];
            InventarioModule.render();
        } catch (e) { 
            console.error("Erro no Inventário:", e);
            Utils.toast("Erro ao carregar inventário."); 
        }
    },

    render: () => {
        let data = InventarioModule.state.bens || [];

        // Filtros
        if (InventarioModule.state.filterTerm) {
            const term = InventarioModule.state.filterTerm.toLowerCase();
            data = data.filter(b => 
                b.Nome.toLowerCase().includes(term) || 
                b.Codigo.toLowerCase().includes(term) ||
                (b.Responsavel && b.Responsavel.toLowerCase().includes(term))
            );
        }
        if (InventarioModule.state.filterDept) {
            data = data.filter(b => b.Departamento === InventarioModule.state.filterDept);
        }

        InventarioModule.state.filteredBens = data;

        const container = document.getElementById('inventario-content');
        if (!container) return;
        
        // KPIs
        const totalValor = data.reduce((acc, b) => acc + Number(b.ValorAquisicao || 0), 0);
        const emManutencao = data.filter(b => b.EstadoConservacao === 'Em Manutenção').length;
        const deptos = new Set(data.map(b => b.Departamento)).size;
        const deptsUnique = [...new Set(InventarioModule.state.bens.map(b => b.Departamento).filter(Boolean))];

        const canEdit = Utils.checkPermission('Inventario', 'editar');
        const canCreate = Utils.checkPermission('Inventario', 'criar');

        // Paginação
        InventarioModule.state.pagination.total = data.length;
        const { page, limit } = InventarioModule.state.pagination;
        const totalPages = Math.ceil(data.length / limit) || 1;
        const paginatedData = data.slice((page - 1) * limit, page * limit);

        // Dados para Gráfico
        const statusMap = {};
        data.forEach(b => {
            const s = b.EstadoConservacao || 'Não Definido';
            statusMap[s] = (statusMap[s] || 0) + 1;
        });

        // Tabela
        container.innerHTML = `
            <!-- KPIs -->
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div class="bg-white p-4 rounded shadow border-l-4 border-purple-500">
                    <div class="text-gray-500 text-sm">Total de Bens</div>
                    <div class="text-2xl font-bold" id="kpi-total">${data.length}</div>
                </div>
                <div class="bg-white p-4 rounded shadow border-l-4 border-green-500">
                    <div class="text-gray-500 text-sm">Valor Patrimonial</div>
                    <div class="text-2xl font-bold text-green-600" id="kpi-valor">${Utils.formatCurrency(totalValor)}</div>
                </div>
                <div class="bg-white p-4 rounded shadow border-l-4 border-yellow-500">
                    <div class="text-gray-500 text-sm">Em Manutenção</div>
                    <div class="text-2xl font-bold text-yellow-600" id="kpi-manutencao">${emManutencao}</div>
                </div>
                <div class="bg-white p-4 rounded shadow border-l-4 border-blue-500">
                    <div class="text-gray-500 text-sm">Departamentos</div>
                    <div class="text-2xl font-bold text-blue-600" id="kpi-deptos">${deptos}</div>
                </div>
            </div>

            <!-- Gráfico e Toolbar -->
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                <!-- Gráfico -->
                <div class="bg-white p-4 rounded shadow">
                    <h4 class="font-bold text-gray-700 mb-4 border-b pb-2 text-sm">Estado de Conservação</h4>
                    <div class="h-48"><canvas id="chartEstadoConservacao"></canvas></div>
                </div>

                <!-- Toolbar e Filtros -->
                <div class="lg:col-span-2 bg-white p-4 rounded shadow flex flex-col justify-center">
                    <div class="flex flex-col md:flex-row justify-between items-center gap-4">
                        <h3 class="text-xl font-bold text-gray-800">Gestão de Patrimônio</h3>
                        <div class="flex flex-wrap gap-2">
                            ${canCreate ? `<button onclick="InventarioModule.modalBem()" class="bg-purple-600 text-white px-4 py-2 rounded shadow hover:bg-purple-700 transition"><i class="fas fa-plus mr-2"></i> Novo Bem</button>` : ''}
                            <button onclick="InventarioModule.exportPDF()" class="bg-red-600 text-white px-4 py-2 rounded shadow hover:bg-red-700 transition"><i class="fas fa-file-pdf mr-2"></i> Baixar PDF</button>
                            <button onclick="InventarioModule.exportCSV()" class="bg-green-600 text-white px-4 py-2 rounded shadow hover:bg-green-700 transition"><i class="fas fa-file-csv mr-2"></i> Excel</button>
                        </div>
                    </div>
                    <div class="mt-4 flex gap-2">
                        <input type="text" placeholder="🔍 Buscar bem..." class="border p-2 rounded text-sm w-full" value="${InventarioModule.state.filterTerm}" oninput="InventarioModule.updateFilter(this.value)">
                        <select class="border p-2 rounded text-sm" onchange="InventarioModule.updateDeptFilter(this.value)">
                            <option value="">🏢 Todos Deptos</option>
                            ${deptsUnique.map(d => `<option value="${d}" ${InventarioModule.state.filterDept === d ? 'selected' : ''}>${d}</option>`).join('')}
                        </select>
                    </div>
                </div>
            </div>

            <!-- Tabela -->
            <div class="bg-white rounded shadow overflow-x-auto">
                <table class="w-full text-sm text-left" id="tabela-inventario-container">
                    <thead class="bg-gray-100 text-gray-600 uppercase">
                        <tr>
                            <th class="p-3">Código</th>
                            <th class="p-3">Bem / Descrição</th>
                            <th class="p-3">Categoria</th>
                            <th class="p-3">Local</th>
                            <th class="p-3 text-center">Estado</th>
                            <th class="p-3 text-right">Valor</th>
                            <th class="p-3 text-center">Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${paginatedData.map(b => {
            let statusColor = 'bg-green-100 text-green-800';
            if(b.EstadoConservacao === 'Ruim') statusColor = 'bg-red-100 text-red-800';
            if(b.EstadoConservacao === 'Em Manutenção') statusColor = 'bg-yellow-100 text-yellow-800';

            return `
                <tr class="border-t hover:bg-gray-50">
                    <td class="p-3 font-mono text-xs font-bold text-purple-700">${b.Codigo}</td>
                    <td class="p-3 font-bold">
                        <div class="flex items-center gap-3">
                            ${b.FotoURL ? `<img src="${b.FotoURL}" class="h-10 w-10 rounded object-cover border bg-white">` : `<div class="h-10 w-10 rounded bg-gray-100 flex items-center justify-center text-gray-400 border"><i class="fas fa-camera"></i></div>`}
                            <div>
                                ${b.Nome} <span class="ml-1 text-xs bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded">Qtd: ${b.Quantidade || 1}</span>
                                <div class="text-xs text-gray-400 font-normal">${b.Responsavel || 'Sem responsável'}</div>
                            </div>
                        </div>
                    </td>
                    <td class="p-3 text-sm">${b.Categoria}</td>
                    <td class="p-3 text-sm">${b.Departamento}</td>
                    <td class="p-3 text-center"><span class="px-2 py-1 rounded text-xs ${statusColor}">${b.EstadoConservacao}</span></td>
                    <td class="p-3 text-right font-bold text-gray-700">${Utils.formatCurrency(b.ValorAquisicao)}</td>
                    <td class="p-3 text-center">
                        <button onclick="InventarioModule.detalhes('${b.ID}')" class="text-blue-600 hover:bg-blue-50 p-2 rounded" title="Detalhes/QR Code"><i class="fas fa-eye"></i></button>
                        ${canEdit ? `<button onclick="InventarioModule.modalBem('${b.ID}')" class="text-gray-600 hover:bg-gray-100 p-2 rounded" title="Editar"><i class="fas fa-edit"></i></button>` : ''}
                    </td>
                </tr>
            `;
        }).join('')}
                    </tbody>
                </table>
            </div>

            <!-- Paginação -->
            <div class="flex justify-between items-center mt-4 text-sm text-gray-600 bg-gray-50 p-3 rounded border">
                <span>Mostrando <b>${(page - 1) * limit + 1}</b> a <b>${Math.min(page * limit, data.length)}</b> de <b>${data.length}</b> itens</span>
                <div class="flex gap-2 items-center">
                    <button onclick="InventarioModule.changePage(-1)" class="px-3 py-1 border rounded bg-white hover:bg-gray-100 disabled:opacity-50" ${page === 1 ? 'disabled' : ''}><i class="fas fa-chevron-left"></i> Anterior</button>
                    <span class="px-2 font-bold">Página ${page} de ${totalPages}</span>
                    <button onclick="InventarioModule.changePage(1)" class="px-3 py-1 border rounded bg-white hover:bg-gray-100 disabled:opacity-50" ${page >= totalPages ? 'disabled' : ''}>Próxima <i class="fas fa-chevron-right"></i></button>
                </div>
            </div>
        `;

        // Renderizar Gráfico
        if (InventarioModule.state.charts.estado) InventarioModule.state.charts.estado.destroy();
        
        if (typeof Chart !== 'undefined' && document.getElementById('chartEstadoConservacao')) {
            InventarioModule.state.charts.estado = new Chart(document.getElementById('chartEstadoConservacao'), {
                type: 'doughnut',
                data: {
                    labels: Object.keys(statusMap),
                    datasets: [{
                        data: Object.values(statusMap),
                        backgroundColor: ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#6B7280']
                    }]
                },
                options: { 
                    responsive: true, 
                    maintainAspectRatio: false, 
                    plugins: { legend: { position: 'right', labels: { boxWidth: 10, font: { size: 10 } } } } 
                }
            });
        }

        // Foco no input
        const searchInput = document.querySelector('input[placeholder="🔍 Buscar bem..."]');
        if (searchInput && document.activeElement !== searchInput && InventarioModule.state.filterTerm) {
            searchInput.focus();
            const val = searchInput.value;
            searchInput.value = '';
            searchInput.value = val;
        }
    },

    changePage: (offset) => {
        const { page, limit, total } = InventarioModule.state.pagination;
        const newPage = page + offset;
        const totalPages = Math.ceil(total / limit);
        
        if (newPage > 0 && newPage <= totalPages) {
            InventarioModule.state.pagination.page = newPage;
            InventarioModule.render();
        }
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
                
                <div class="mb-3">
                    <label class="text-xs font-bold">Foto do Bem</label>
                    <div class="flex items-center gap-4">
                        <img id="preview-img" src="${bem.FotoURL || ''}" class="h-16 w-16 object-cover rounded border ${bem.FotoURL ? '' : 'hidden'}">
                        <input type="file" id="foto-bem" accept="image/*" class="border p-2 rounded w-full text-xs bg-gray-50" onchange="InventarioModule.previewImage(this)">
                    </div>
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
                <div class="mb-3"><label class="text-xs font-bold">Fornecedor</label><input name="Fornecedor" value="${bem.Fornecedor || ''}" class="border p-2 rounded w-full" placeholder="Nome do Fornecedor"></div>

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

        // Upload de Foto
        const fileInput = document.getElementById('foto-bem');
        if (fileInput && fileInput.files[0]) {
            const file = fileInput.files[0];
            if (file.size > 2 * 1024 * 1024) return Utils.toast('⚠️ A imagem é muito grande (Máx 2MB).', 'warning');
            
            try {
                const toBase64 = file => new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.readAsDataURL(file);
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = error => reject(error);
                });
                data.FotoURL = await toBase64(fileInput.files[0]);
            } catch (err) { return Utils.toast('Erro ao processar foto: ' + err.message, 'error'); }
        }

        const user = Utils.getUser();
        data.UserAction = user.Nome || 'Admin';

        try {
            await Utils.api('saveInventario', null, data);
            Utils.toast('Bem salvo com sucesso!', 'success'); Utils.closeModal(); InventarioModule.fetchData();
        } catch (err) { Utils.toast('Erro: ' + err.message, 'error'); }
    },

    previewImage: (input) => {
        if (input.files && input.files[0]) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = document.getElementById('preview-img');
                if(img) {
                    img.src = e.target.result;
                    img.classList.remove('hidden');
                }
            };
            reader.readAsDataURL(input.files[0]);
        }
    },

    detalhes: (id) => {
        const bem = InventarioModule.state.bens.find(b => b.ID === id);
        Utils.openModal('Detalhes do Bem', `
            <div class="flex gap-6">
                <div class="w-1/3 flex flex-col items-center justify-start bg-gray-50 p-4 rounded border">
                    ${bem.FotoURL ? `<img src="${bem.FotoURL}" class="w-full h-32 object-cover rounded mb-4 border bg-white">` : ''}
                    <div id="qrcode" class="mb-2 bg-white p-2 rounded border"></div>
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

    gerarRelatorioEstado: () => {
        const data = InventarioModule.state.bens;
        const stats = {};
        
        // Agrupar por estado
        data.forEach(b => {
            const estado = b.EstadoConservacao || 'Não Definido';
            if (!stats[estado]) stats[estado] = { qtd: 0, valor: 0 };
            stats[estado].qtd++;
            stats[estado].valor += Number(b.ValorAquisicao || 0);
        });

        let html = `
            <div id="print-relatorio-estado" class="p-4 bg-white">
                <div class="text-center mb-6 border-b pb-4">
                    <h3 class="text-xl font-bold text-gray-800">Relatório de Bens por Estado</h3>
                    <p class="text-xs text-gray-500">Gerado em ${new Date().toLocaleString()}</p>
                </div>
                <table class="w-full text-sm text-left border-collapse">
                    <thead class="bg-gray-100">
                        <tr>
                            <th class="p-2 border">Estado de Conservação</th>
                            <th class="p-2 border text-center">Quantidade</th>
                            <th class="p-2 border text-right">Valor Total (Kz)</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        let totalQtd = 0;
        let totalValor = 0;

        Object.keys(stats).forEach(estado => {
            totalQtd += stats[estado].qtd;
            totalValor += stats[estado].valor;
            html += `
                <tr>
                    <td class="p-2 border">${estado}</td>
                    <td class="p-2 border text-center">${stats[estado].qtd}</td>
                    <td class="p-2 border text-right">${Utils.formatCurrency(stats[estado].valor)}</td>
                </tr>
            `;
        });

        html += `
                    <tr class="bg-gray-50 font-bold">
                        <td class="p-2 border">TOTAL GERAL</td>
                        <td class="p-2 border text-center">${totalQtd}</td>
                        <td class="p-2 border text-right">${Utils.formatCurrency(totalValor)}</td>
                    </tr>
                    </tbody>
                </table>
            </div>
            <div class="mt-4 text-center">
                <button onclick="InventarioModule.printRelatorio()" class="bg-red-600 text-white px-4 py-2 rounded shadow hover:bg-red-700"><i class="fas fa-file-pdf mr-2"></i> Baixar PDF</button>
            </div>
        `;

        Utils.openModal('Relatório de Patrimônio', html);
    },

    printRelatorio: () => {
        const element = document.getElementById('print-relatorio-estado');
        
        // --- CORREÇÃO DE ESTILOS PARA PDF ---
        const style = document.createElement('style');
        style.innerHTML = `
            #print-relatorio-estado { width: 100%; background: white; margin: 0; padding: 0; }
            #print-relatorio-estado table { width: 100% !important; border-collapse: collapse !important; }
            #print-relatorio-estado th, #print-relatorio-estado td { 
                font-size: 10px !important; 
                padding: 4px 2px !important; 
                border: 1px solid #ccc !important;
            }
            #print-relatorio-estado .shadow { box-shadow: none !important; }
        `;
        document.head.appendChild(style);

        const opt = {
            margin: [10, 10, 10, 10],
            filename: 'relatorio-patrimonio-estado.pdf',
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, scrollY: 0, x: 0, y: 0 },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        html2pdf().set(opt).from(element).save().then(() => {
            document.head.removeChild(style);
        });
    },

    exportPDF: () => {
        const data = InventarioModule.state.filteredBens || InventarioModule.state.bens || [];
        const inst = InventarioModule.state.instituicao[0] || {};
        const showLogo = inst.ExibirLogoRelatorios;
        const user = Utils.getUser();
        
        // Preparar dados do gráfico
        const deptMap = {};
        data.forEach(b => {
            const dept = b.Departamento || 'Sem Departamento';
            deptMap[dept] = (deptMap[dept] || 0) + (Number(b.Quantidade) || 1);
        });
        const labels = Object.keys(deptMap);
        const values = Object.values(deptMap);
        
        // Elemento temporário para renderizar o gráfico (fora da tela)
        const printDiv = document.createElement('div');
        printDiv.style.position = 'absolute'; 
        printDiv.style.left = '-9999px';
        printDiv.style.width = '800px'; 
        document.body.appendChild(printDiv);

        // Canvas para o gráfico
        const canvas = document.createElement('canvas');
        printDiv.appendChild(canvas);

        // Renderizar Gráfico
        if (typeof Chart !== 'undefined') {
            new Chart(canvas, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Quantidade',
                        data: values,
                        backgroundColor: '#3B82F6',
                        borderColor: '#2563EB',
                        borderWidth: 1
                    }]
                },
                options: {
                    animation: false, // Importante para PDF
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
                }
            });
        }

        // Aguarda renderização, converte gráfico em imagem e gera PDF
        setTimeout(() => {
            const chartImg = canvas.toDataURL('image/png');
            document.body.removeChild(printDiv); // Limpa elemento temporário

            const totalValor = data.reduce((acc, b) => acc + Number(b.ValorAquisicao || 0), 0);

            const html = `
                <div class="p-8 font-sans text-gray-900 bg-white">
                    <div class="flex items-center justify-between border-b-2 border-gray-800 pb-4 mb-6">
                        <div class="${showLogo && inst.LogotipoURL ? 'flex items-center gap-4' : ''}">
                            ${showLogo && inst.LogotipoURL ? `<img src="${inst.LogotipoURL}" class="h-16 w-auto object-contain" crossorigin="anonymous">` : ''}
                            <div>
                                <h1 class="text-2xl font-bold uppercase">${inst.NomeFantasia || 'Relatório de Inventário'}</h1>
                                <p class="text-sm text-gray-500">Total de Itens: ${data.length} | Valor Total: ${Utils.formatCurrency(totalValor)}</p>
                            </div>
                        </div>
                        <div class="text-right">
                            <h2 class="text-xl font-bold">RELATÓRIO DE INVENTÁRIO</h2>
                            <p class="text-sm">Gerado em: ${new Date().toLocaleDateString()}</p>
                            <p class="text-xs text-gray-500">Por: ${user.Nome}</p>
                        </div>
                    </div>
                    <table class="w-full text-sm border-collapse border border-gray-300 mb-6">
                        <thead class="bg-gray-100">
                            <tr>
                                <th class="border p-2 text-left">Código</th><th class="border p-2 text-left">Bem / Descrição</th><th class="border p-2 text-left">Categoria</th>
                                <th class="border p-2 text-left">Local</th><th class="border p-2 text-center">Estado</th><th class="border p-2 text-right">Valor</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.map(b => `<tr><td class="border p-2 font-mono text-xs">${b.Codigo}</td><td class="border p-2">${b.Nome}</td><td class="border p-2">${b.Categoria}</td><td class="border p-2">${b.Departamento}</td><td class="border p-2 text-center">${b.EstadoConservacao}</td><td class="border p-2 text-right">${Utils.formatCurrency(b.ValorAquisicao)}</td></tr>`).join('')}
                        </tbody>
                    </table>

                    <!-- GRÁFICO COMO IMAGEM -->
                    <div class="break-inside-avoid mt-4 text-center">
                        <h3 class="text-lg font-bold mb-4 text-gray-700">Quantidade de Bens por Departamento</h3>
                        <img src="${chartImg}" style="max-width: 80%; height: auto; margin: 0 auto;">
                    </div>

                    <div class="mt-8 text-center text-xs text-gray-400">Documento de uso interno.</div>
                </div>
            `;

            Utils.printNative(html, 'landscape');
        }, 500);
    },

    exportCSV: () => {
        const data = InventarioModule.state.filteredBens || InventarioModule.state.bens || [];
        if (data.length === 0) return Utils.toast('Sem dados para exportar.', 'warning');

        const headers = ['Código', 'Nome', 'Categoria', 'Departamento', 'Responsável', 'Estado', 'Valor', 'Data Aquisição'];
        const csvContent = [
            headers.join(','),
            ...data.map(b => {
                const escape = (val) => `"${String(val || '').replace(/"/g, '""')}"`;
                return [escape(b.Codigo), escape(b.Nome), escape(b.Categoria), escape(b.Departamento), escape(b.Responsavel), escape(b.EstadoConservacao), b.ValorAquisicao || 0, b.DataAquisicao || ''].join(',');
            })
        ].join('\n');

        const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `inventario_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    },

    updateFilter: (val) => {
        InventarioModule.state.filterTerm = val;
        InventarioModule.state.pagination.page = 1;
        InventarioModule.render();
    },

    updateDeptFilter: (val) => {
        InventarioModule.state.filterDept = val;
        InventarioModule.state.pagination.page = 1;
        InventarioModule.render();
    }
};

document.addEventListener('DOMContentLoaded', InventarioModule.init);