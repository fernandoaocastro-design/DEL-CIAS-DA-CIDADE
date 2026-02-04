const InventarioModule = {
    state: { bens: [], filteredBens: null },

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
        const data = InventarioModule.state.filteredBens || InventarioModule.state.bens || [];
        const tbody = document.getElementById('tabela-inventario');
        
        // KPIs
        const totalValor = data.reduce((acc, b) => acc + Number(b.ValorAquisicao || 0), 0);
        const emManutencao = data.filter(b => b.EstadoConservacao === 'Em Manutenção').length;
        const deptos = new Set(data.map(b => b.Departamento)).size;

        const canEdit = Utils.checkPermission('Inventario', 'editar');

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
                        ${canEdit ? `<button onclick="InventarioModule.modalBem('${b.ID}')" class="text-gray-600 hover:bg-gray-100 p-2 rounded" title="Editar"><i class="fas fa-edit"></i></button>` : ''}
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

        const user = Utils.getUser();
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
        const inst = Utils.getUser().Instituicao || {}; // Assumindo que Utils.getUser() pode ter dados da instituição ou buscar de cache global se disponível
        // Como InventarioModule não carrega InstituicaoConfig explicitamente no fetchData, vamos usar um fallback ou buscar se necessário.
        // Para simplificar e manter consistência com outros módulos que usam cache global ou buscam na hora:
        const user = Utils.getUser();
        
        // Elemento temporário
        const printDiv = document.createElement('div');
        printDiv.id = 'print-inventario-list';
        printDiv.style.position = 'absolute'; printDiv.style.top = '0'; printDiv.style.left = '0'; printDiv.style.zIndex = '-9999';
        printDiv.style.width = '297mm'; // Landscape
        printDiv.style.background = 'white';

        const totalValor = data.reduce((acc, b) => acc + Number(b.ValorAquisicao || 0), 0);

        printDiv.innerHTML = `
            <div class="p-8 font-sans text-gray-900 bg-white">
                <div class="flex justify-between items-center border-b-2 border-gray-800 pb-4 mb-6">
                    <div>
                        <h1 class="text-2xl font-bold uppercase">Relatório de Inventário</h1>
                        <p class="text-sm text-gray-500">Total de Itens: ${data.length} | Valor Total: ${Utils.formatCurrency(totalValor)}</p>
                    </div>
                    <div class="text-right">
                        <p class="text-sm">Gerado em: ${new Date().toLocaleDateString()}</p>
                        <p class="text-xs text-gray-500">Por: ${user.Nome}</p>
                    </div>
                </div>
                <table class="w-full text-sm border-collapse border border-gray-300">
                    <thead class="bg-gray-100">
                        <tr>
                            <th class="border p-2 text-left">Código</th><th class="border p-2 text-left">Nome</th><th class="border p-2 text-left">Categoria</th>
                            <th class="border p-2 text-left">Local</th><th class="border p-2 text-center">Estado</th><th class="border p-2 text-right">Valor</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.map(b => `<tr><td class="border p-2 font-mono text-xs">${b.Codigo}</td><td class="border p-2">${b.Nome}</td><td class="border p-2">${b.Categoria}</td><td class="border p-2">${b.Departamento}</td><td class="border p-2 text-center">${b.EstadoConservacao}</td><td class="border p-2 text-right">${Utils.formatCurrency(b.ValorAquisicao)}</td></tr>`).join('')}
                    </tbody>
                </table>
                <div class="mt-8 text-center text-xs text-gray-400">Documento de uso interno.</div>
            </div>
        `;

        document.body.appendChild(printDiv);
        const opt = { margin: 10, filename: 'inventario_geral.pdf', image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, useCORS: true }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' } };
        html2pdf().set(opt).from(printDiv).save().then(() => { document.body.removeChild(printDiv); });
    },

    filtrar: () => {
        const term = document.getElementById('search-bem').value.toLowerCase();
        const dept = document.getElementById('filter-dept').value;
        
        let filtered = InventarioModule.state.bens.filter(b => {
            const matchTerm = b.Nome.toLowerCase().includes(term) || 
                              b.Codigo.toLowerCase().includes(term) ||
                              (b.Responsavel && b.Responsavel.toLowerCase().includes(term));
            const matchDept = dept === '' || b.Departamento === dept;
            return matchTerm && matchDept;
        });

        InventarioModule.state.filteredBens = filtered;
        InventarioModule.render();
    }
};

document.addEventListener('DOMContentLoaded', InventarioModule.init);