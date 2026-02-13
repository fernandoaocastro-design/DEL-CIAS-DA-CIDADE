const BackupsModule = {
    state: {
        backups: [],
        chart: null
    },

    init: () => {
        console.log("Iniciando módulo de backups...");
        BackupsModule.fetchData();
    },

    fetchData: async () => {
        try {
            const data = await Utils.api('getSystemBackups');
            BackupsModule.state.backups = data || [];
            BackupsModule.render();
        } catch (e) {
            console.error("Erro ao carregar backups:", e);
            Utils.toast("Erro ao carregar lista de backups.", "error");
            
            // Mostra erro na tela se falhar
            const container = document.getElementById('backups-content');
            if(container) container.innerHTML = `<div class="p-8 text-center text-red-500 bg-white rounded shadow">Erro ao carregar dados: ${e.message}</div>`;
        }
    },

    render: () => {
        const container = document.getElementById('backups-content');
        if (!container) return;

        const backups = BackupsModule.state.backups;
        const sizeMap = {}; // Para o gráfico

        // Agrupar backups por Tabela Original
        const grouped = {};
        backups.forEach(b => {
            // Regex robusto para extrair nome: Backup_(NOME)_YYYY_MM_DD...
            const match = b.nome_tabela.match(/^Backup_(.+)_\d{4}_\d{2}_\d{2}/);
            
            if (match && match[1]) {
                const originalName = match[1];
                
                if (!grouped[originalName]) grouped[originalName] = [];
                grouped[originalName].push(b);
                
                // Soma bytes para o gráfico
                sizeMap[originalName] = (sizeMap[originalName] || 0) + (Number(b.tamanho_bytes) || 0);
            }
        });

        let html = `
            <div class="flex justify-between items-center mb-6">
                <h3 class="text-xl font-bold text-gray-800">Administração de Backups</h3>
                <div class="flex gap-2">
                    <button onclick="BackupsModule.cleanBackups()" class="bg-orange-600 text-white px-4 py-2 rounded hover:bg-orange-700 shadow transition">
                        <i class="fas fa-broom mr-2"></i> Limpar Antigos
                    </button>
                    <button onclick="BackupsModule.fetchData()" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 shadow transition">
                        <i class="fas fa-sync-alt mr-2"></i> Atualizar
                    </button>
                </div>
            </div>
            
            <div class="bg-white p-4 rounded shadow mb-6 border border-gray-200">
                <h4 class="font-bold text-gray-700 mb-4 border-b pb-2">Ocupação de Disco por Tabela (Backups)</h4>
                <div class="h-64 w-full"><canvas id="chartBackups"></canvas></div>
            </div>

            <div class="grid grid-cols-1 gap-6">
        `;

        if (Object.keys(grouped).length === 0) {
            html += `<div class="p-8 text-center text-gray-500 bg-gray-50 rounded border border-dashed border-gray-300">Nenhum backup encontrado no sistema. Execute um backup manual ou aguarde a rotina automática.</div>`;
        }

        for (const [table, items] of Object.entries(grouped)) {
            html += `
                <div class="bg-white rounded shadow border border-gray-200 overflow-hidden">
                    <div class="bg-gray-100 px-4 py-3 border-b border-gray-200 flex justify-between items-center">
                        <h4 class="font-bold text-gray-700 flex items-center">
                            <i class="fas fa-database mr-2 text-indigo-500"></i> ${table}
                        </h4>
                        <span class="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded">${items.length} snapshots</span>
                    </div>
                    <div class="max-h-64 overflow-y-auto">
                        <table class="w-full text-sm text-left">
                            <thead class="bg-gray-50 text-gray-500 sticky top-0">
                                <tr>
                                    <th class="p-3">Data do Backup</th>
                                    <th class="p-3">Tamanho</th>
                                    <th class="p-3 text-right">Ação</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y">
                                ${items.map(b => {
                                    return `
                                    <tr class="hover:bg-red-50 transition-colors group">
                                        <td class="p-3 font-mono text-xs">${b.nome_tabela}</td>
                                        <td class="p-3 text-gray-600">${b.tamanho}</td>
                                        <td class="p-3 text-right flex justify-end gap-2">
                                            <button onclick="BackupsModule.exportBackup('${b.nome_tabela}')" 
                                                class="text-green-600 border border-green-200 bg-white hover:bg-green-600 hover:text-white px-3 py-1 rounded text-xs font-bold transition">
                                                <i class="fas fa-download mr-1"></i> CSV
                                            </button>
                                            <button onclick="BackupsModule.restore('${table}', '${b.nome_tabela}')" 
                                                class="text-red-600 border border-red-200 bg-white hover:bg-red-600 hover:text-white px-3 py-1 rounded text-xs font-bold transition">
                                                <i class="fas fa-history mr-1"></i> Restaurar
                                            </button>
                                        </td>
                                    </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        }

        html += `</div>`;
        container.innerHTML = html;

        // Renderizar Gráfico
        if (document.getElementById('chartBackups')) {
            if (BackupsModule.state.chart) BackupsModule.state.chart.destroy();
            
            // Ordenar por tamanho (Top 10)
            const sortedSizes = Object.entries(sizeMap)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10);

            if (typeof Chart !== 'undefined') {
                BackupsModule.state.chart = new Chart(document.getElementById('chartBackups'), {
                    type: 'bar',
                    data: {
                        labels: sortedSizes.map(i => i[0]),
                        datasets: [{
                            label: 'Tamanho Total (MB)',
                            data: sortedSizes.map(i => (i[1] / 1024 / 1024).toFixed(2)), // Converte para MB
                            backgroundColor: '#4F46E5',
                            borderRadius: 4
                        }]
                    },
                    options: { responsive: true, maintainAspectRatio: false }
                });
            }
        }
    },

    cleanBackups: async () => {
        if (confirm('Deseja remover todos os backups com mais de 30 dias?')) {
            try {
                await Utils.api('cleanOldBackups');
                Utils.toast('Limpeza concluída!', 'success');
                BackupsModule.fetchData();
            } catch (e) {
                Utils.toast('Erro ao limpar: ' + e.message, 'error');
            }
        }
    },

    exportBackup: async (tableName) => {
        try {
            Utils.toast('Baixando dados...', 'info');
            const data = await Utils.api('getBackupData', null, { tableName });
            
            if (!data || data.length === 0) return Utils.toast('Backup vazio.', 'warning');

            // Converter para CSV
            const headers = Object.keys(data[0]);
            const csvContent = [
                headers.join(','),
                ...data.map(row => headers.map(fieldName => {
                    let val = row[fieldName];
                    if (val === null || val === undefined) val = '';
                    return `"${String(val).replace(/"/g, '""')}"`; // Escape quotes
                }).join(','))
            ].join('\n');

            // Download
            const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = `${tableName}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            Utils.toast('Download iniciado!', 'success');
        } catch (e) {
            console.error(e);
            Utils.toast('Erro ao exportar: ' + e.message, 'error');
        }
    },

    restore: async (table, backupTable) => {
        if (confirm(`⚠️ PERIGO: Restaurar "${table}" usando "${backupTable}" apagará os dados atuais. Continuar?`)) {
            try {
                await Utils.api('restoreSystemBackup', null, { table, backupTable });
                Utils.toast('✅ Restauração concluída!', 'success');
            } catch (e) { Utils.toast('Erro: ' + e.message, 'error'); }
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    if(document.getElementById('backups-content')) BackupsModule.init();
});