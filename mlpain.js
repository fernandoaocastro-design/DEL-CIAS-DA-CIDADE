const MLPainModule = {
    state: {
        areas: [],
        registros: [],
        currentMonth: new Date().toISOString().slice(0, 7) // YYYY-MM
    },

    init: () => {
        MLPainModule.fetchData();
    },

    fetchData: async () => {
        try {
            const [areas, registros] = await Promise.all([
                Utils.api('getAll', 'MLPain_Areas'),
                Utils.api('getAll', 'MLPain_Registros')
            ]);
            // Ordenar áreas pela ordem definida
            MLPainModule.state.areas = (areas || []).sort((a, b) => (a.Ordem || 0) - (b.Ordem || 0));
            MLPainModule.state.registros = registros || [];
            MLPainModule.render();
        } catch (e) {
            console.error('Erro ao carregar dados:', e);
            Utils.toast('Erro ao carregar dados do M.L. Pain', 'error');
        }
    },

    render: () => {
        // Renderização básica da tela (placeholder para a lógica existente)
        const content = document.getElementById('mlpain-content');
        if (!content) return;

        content.innerHTML = `
            <div class="flex justify-between items-center mb-6">
                <div class="flex gap-4 items-center">
                    <h2 class="text-xl font-bold text-gray-700">Relatório de Refeições - ${MLPainModule.state.currentMonth}</h2>
                    <input type="month" value="${MLPainModule.state.currentMonth}" 
                           onchange="MLPainModule.updateMonth(this.value)" 
                           class="border p-2 rounded text-sm shadow-sm">
                </div>
                <button onclick="MLPainModule.exportPDF()" class="bg-red-600 text-white px-4 py-2 rounded shadow hover:bg-red-700 transition flex items-center gap-2">
                    <i class="fas fa-file-pdf"></i> Exportar PDF Profissional
                </button>
            </div>
            <div class="bg-white p-6 rounded shadow text-center text-gray-500">
                <i class="fas fa-table text-4xl mb-3 text-gray-300"></i>
                <p>A visualização em tabela está otimizada para o PDF.</p>
                <p class="text-sm">Clique em "Exportar PDF" para gerar o relatório mensal completo.</p>
            </div>
        `;
    },

    updateMonth: (val) => {
        if (!val) return;
        MLPainModule.state.currentMonth = val;
        MLPainModule.render();
    },

    exportPDF: () => {
        const { areas, registros, currentMonth } = MLPainModule.state;
        const [year, month] = currentMonth.split('-');
        const daysInMonth = new Date(year, month, 0).getDate();
        
        // Filtrar registros do mês selecionado
        const filteredRegistros = registros.filter(r => r.Data && r.Data.startsWith(currentMonth));

        // Criar Container Temporário para o PDF
        const container = document.createElement('div');
        container.id = 'print-mlpain-pdf';
        
        // --- CSS PROFISSIONAL PARA A4 PAISAGEM ---
        const styles = `
            <style>
                #print-mlpain-pdf {
                    width: 285mm; /* Largura segura para A4 Paisagem (297mm - margens) */
                    background: white;
                    padding: 5mm;
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    color: #1f2937;
                }
                .pdf-header {
                    display: flex; justify-content: space-between; align-items: center;
                    border-bottom: 2px solid #1f2937; padding-bottom: 10px; margin-bottom: 15px;
                }
                .pdf-logo-text h1 { font-size: 18px; font-weight: bold; text-transform: uppercase; margin: 0; }
                .pdf-logo-text p { font-size: 10px; color: #6b7280; margin: 0; }
                .pdf-info { text-align: right; }
                .pdf-info h2 { font-size: 14px; font-weight: bold; margin: 0; color: #374151; }
                .pdf-info p { font-size: 10px; margin: 0; }
                
                table {
                    width: 100%; border-collapse: collapse; font-size: 9px;
                    table-layout: fixed; /* Garante colunas iguais e evita cortes */
                }
                th, td {
                    border: 1px solid #d1d5db; padding: 3px 1px;
                    text-align: center; vertical-align: middle;
                    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
                }
                th { background-color: #f3f4f6; font-weight: bold; color: #111827; font-size: 8px; }
                
                /* Larguras de Coluna Otimizadas */
                .col-area { width: 15%; text-align: left; padding-left: 5px; font-weight: bold; white-space: normal; }
                .col-day { width: auto; } /* Distribui o restante automaticamente */
                .col-total { width: 6%; font-weight: bold; background-color: #f9fafb; }
                
                tr:nth-child(even) { background-color: #f9fafb; }
                .total-row { background-color: #e5e7eb; font-weight: bold; }
            </style>
        `;

        // Cabeçalho do PDF (Sem o título indesejado da tela)
        const header = `
            <div class="pdf-header">
                <div class="pdf-logo-text">
                    <h1>Delícia da Cidade</h1>
                    <p>Relatório de Controle - M.L. Pain</p>
                </div>
                <div class="pdf-info">
                    <h2>${new Date(year, month - 1).toLocaleString('pt-AO', { month: 'long', year: 'numeric' }).toUpperCase()}</h2>
                    <p>Gerado em: ${new Date().toLocaleDateString()}</p>
                </div>
            </div>
        `;

        // Construção da Tabela
        let daysHeader = '';
        for (let i = 1; i <= daysInMonth; i++) daysHeader += `<th class="col-day">${i}</th>`;

        let rowsHtml = '';
        let grandTotal = 0;
        const dayTotals = new Array(daysInMonth + 1).fill(0);

        areas.forEach(area => {
            let rowCells = '';
            let totalArea = 0;
            for (let i = 1; i <= daysInMonth; i++) {
                const dateStr = `${currentMonth}-${String(i).padStart(2, '0')}`;
                const sum = filteredRegistros
                    .filter(r => r.AreaID === area.ID && r.Data === dateStr)
                    .reduce((acc, r) => acc + (Number(r.Quantidade) || 0), 0);
                
                totalArea += sum;
                dayTotals[i] += sum;
                rowCells += `<td>${sum > 0 ? sum : ''}</td>`;
            }
            rowsHtml += `<tr><td class="col-area">${area.Nome}</td>${rowCells}<td class="col-total">${totalArea}</td></tr>`;
            grandTotal += totalArea;
        });

        let totalCells = '';
        for (let i = 1; i <= daysInMonth; i++) totalCells += `<td>${dayTotals[i] > 0 ? dayTotals[i] : ''}</td>`;

        const table = `<table><thead><tr><th class="col-area">ÁREA / SETOR</th>${daysHeader}<th class="col-total">TOTAL</th></tr></thead><tbody>${rowsHtml}<tr class="total-row"><td class="col-area text-right">TOTAL GERAL</td>${totalCells}<td class="col-total">${grandTotal}</td></tr></tbody></table>`;

        container.innerHTML = styles + header + table;
        
        // Renderização Oculta
        container.style.position = 'fixed'; container.style.left = '-10000px';
        document.body.appendChild(container);

        // Configuração html2pdf
        const opt = { margin: 5, filename: `mlpain-${currentMonth}.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, useCORS: true }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' } };
        html2pdf().set(opt).from(container).save().then(() => document.body.removeChild(container));
    }
};

document.addEventListener('DOMContentLoaded', MLPainModule.init);