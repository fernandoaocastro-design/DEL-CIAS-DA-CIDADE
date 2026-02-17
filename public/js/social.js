const SocialModule = {
    state: {
        pacientes: [],
        dietas: [],
        filterTerm: '',
        activePatient: null
    },

    init: () => {
        SocialModule.fetchData();
    },

    fetchData: async () => {
        try {
            const [pacientes, dietas] = await Promise.all([
                Utils.api('getAll', 'Pacientes'),
                Utils.api('getAll', 'Dietas')
            ]);
            SocialModule.state.pacientes = pacientes || [];
            SocialModule.state.dietas = dietas || [];
            SocialModule.render();
        } catch (e) {
            console.error(e);
            Utils.toast("Erro ao carregar dados.", 'error');
            const container = document.getElementById('social-content');
            if(container) container.innerHTML = '<div class="text-center p-10 text-red-500"><i class="fas fa-exclamation-circle text-4xl mb-2"></i><p>Erro ao carregar dados.</p><button onclick="SocialModule.fetchData()" class="mt-2 text-blue-600 underline font-bold">Tentar novamente</button></div>';
        }
    },

    render: () => {
        const container = document.getElementById('social-content');
        if (!container) return;

        let data = SocialModule.state.pacientes;
        if (SocialModule.state.filterTerm) {
            const term = SocialModule.state.filterTerm.toLowerCase();
            data = data.filter(p => p.Nome.toLowerCase().includes(term) || (p.Grupo && p.Grupo.toLowerCase().includes(term)));
        }

        const canCreate = Utils.checkPermission('Social', 'criar');
        const canEdit = Utils.checkPermission('Social', 'editar');
        const canDelete = Utils.checkPermission('Social', 'excluir');

        container.innerHTML = `
            <div class="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <div class="flex gap-2 w-full md:w-auto">
                    <input type="text" placeholder="🔍 Buscar paciente..." class="border p-2 rounded text-sm w-full md:w-64" value="${SocialModule.state.filterTerm}" oninput="SocialModule.state.filterTerm=this.value; SocialModule.render()">
                </div>
                <div class="flex gap-2">
                    <button onclick="SocialModule.generateShoppingList()" class="bg-purple-600 text-white px-4 py-2 rounded shadow hover:bg-purple-700 transition flex items-center gap-2">
                        <i class="fas fa-shopping-cart"></i> Lista de Compras
                    </button>
                    ${canCreate ? `<button onclick="SocialModule.modalPaciente()" class="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700 transition flex items-center gap-2">
                        <i class="fas fa-user-plus"></i> Novo Paciente
                    </button>` : ''}
                </div>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <!-- LISTA DE PACIENTES -->
                <div class="lg:col-span-2 bg-white rounded shadow overflow-hidden">
                    <div class="p-4 border-b bg-gray-50 font-bold text-gray-700">Pacientes Cadastrados</div>
                    <div class="overflow-x-auto">
                        <table class="w-full text-sm text-left">
                            <thead class="bg-gray-100 text-gray-600 uppercase">
                                <tr>
                                    <th class="p-3">Nome</th>
                                    <th class="p-3 text-center">Idade</th>
                                    <th class="p-3">Grupo</th>
                                    <th class="p-3">Condição</th>
                                    <th class="p-3 text-center">Ações</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y">
                                ${data.map(p => `
                                    <tr class="hover:bg-gray-50 cursor-pointer ${SocialModule.state.activePatient === p.ID ? 'bg-blue-50' : ''}" onclick="SocialModule.selectPatient('${p.ID}')">
                                        <td class="p-3 font-bold text-gray-800">${p.Nome}</td>
                                        <td class="p-3 text-center">${p.Idade || '-'}</td>
                                        <td class="p-3"><span class="bg-gray-100 px-2 py-1 rounded text-xs">${p.Grupo || '-'}</span></td>
                                        <td class="p-3 text-xs text-gray-500 truncate max-w-xs">${p.CondicaoMedica || '-'}</td>
                                        <td class="p-3 text-center">
                                            ${canEdit ? `<button onclick="event.stopPropagation(); SocialModule.modalPaciente('${p.ID}')" class="text-blue-600 hover:text-blue-800 mr-2"><i class="fas fa-edit"></i></button>` : ''}
                                            ${canDelete ? `<button onclick="event.stopPropagation(); SocialModule.deletePaciente('${p.ID}')" class="text-red-500 hover:text-red-700"><i class="fas fa-trash"></i></button>` : ''}
                                        </td>
                                    </tr>
                                `).join('')}
                                ${data.length === 0 ? '<tr><td colspan="5" class="p-6 text-center text-gray-500">Nenhum paciente encontrado.</td></tr>' : ''}
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- DETALHES / DIETA -->
                <div class="bg-white rounded shadow h-full flex flex-col">
                    <div class="p-4 border-b bg-gray-50 font-bold text-gray-700 flex justify-between items-center">
                        <span>Detalhes & Dieta</span>
                        ${SocialModule.state.activePatient ? `<button onclick="SocialModule.modalDieta('${SocialModule.state.activePatient}')" class="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700">Editar Dieta</button>` : ''}
                    </div>
                    <div class="p-4 flex-1 overflow-y-auto" id="patient-details">
                        <div class="text-center text-gray-400 py-10">Selecione um paciente para ver os detalhes.</div>
                    </div>
                </div>
            </div>
        `;

        if (SocialModule.state.activePatient) {
            SocialModule.renderPatientDetails(SocialModule.state.activePatient);
        }
    },

    selectPatient: (id) => {
        SocialModule.state.activePatient = id;
        SocialModule.render();
    },

    renderPatientDetails: (id) => {
        const p = SocialModule.state.pacientes.find(x => x.ID === id);
        if (!p) return;

        const dietas = SocialModule.state.dietas.filter(d => d.PacienteID === id);
        const days = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
        const meals = ['Café da Manhã', 'Almoço', 'Lanche', 'Jantar'];

        let dietHtml = '';
        days.forEach(day => {
            const dayDiets = dietas.filter(d => d.DiaSemana === day);
            if (dayDiets.length > 0) {
                dietHtml += `<div class="mb-4 border-b pb-2">
                    <h5 class="font-bold text-indigo-600 text-sm mb-2">${day}</h5>
                    <div class="space-y-2">
                        ${meals.map(meal => {
                            const d = dayDiets.find(x => x.Refeicao === meal);
                            if (!d || !d.AlimentosJSON) return '';
                            const items = d.AlimentosJSON.map(i => `${i.item} (${i.qtd})`).join(', ');
                            return `<div class="text-xs"><span class="font-bold text-gray-700">${meal}:</span> <span class="text-gray-600">${items}</span></div>`;
                        }).join('')}
                    </div>
                </div>`;
            }
        });

        if (!dietHtml) dietHtml = '<div class="text-gray-400 text-sm italic">Nenhuma dieta cadastrada.</div>';

        const html = `
            <div class="mb-4">
                <h3 class="text-xl font-bold text-gray-800">${p.Nome}</h3>
                <p class="text-sm text-gray-500">${p.Idade} anos • ${p.Sexo || '-'} • ${p.Grupo || '-'}</p>
            </div>
            
            <div class="bg-yellow-50 p-3 rounded border border-yellow-200 mb-4 text-sm">
                <p class="font-bold text-yellow-800 mb-1">Condição Médica:</p>
                <p class="text-gray-700 mb-2">${p.CondicaoMedica || 'Nenhuma informada'}</p>
                <p class="font-bold text-yellow-800 mb-1">Restrições:</p>
                <p class="text-gray-700">${p.Restricoes || 'Nenhuma'}</p>
            </div>

            <div class="mb-4">
                <h4 class="font-bold text-gray-700 border-b pb-1 mb-2">Plano Alimentar Semanal</h4>
                ${dietHtml}
            </div>
            
            <button onclick="SocialModule.printPatient('${p.ID}')" class="w-full border border-gray-300 text-gray-600 py-2 rounded hover:bg-gray-50 text-sm font-bold">
                <i class="fas fa-print mr-2"></i> Imprimir Ficha
            </button>
        `;

        document.getElementById('patient-details').innerHTML = html;
    },

    modalPaciente: (id = null) => {
        const p = id ? SocialModule.state.pacientes.find(x => x.ID === id) : {};
        Utils.openModal(id ? 'Editar Paciente' : 'Novo Paciente', `
            <form onsubmit="SocialModule.savePaciente(event)">
                <input type="hidden" name="ID" value="${p.ID || ''}">
                <div class="mb-3"><label class="text-xs font-bold">Nome Completo</label><input name="Nome" value="${p.Nome || ''}" class="border p-2 rounded w-full" required></div>
                <div class="grid grid-cols-3 gap-3 mb-3">
                    <div><label class="text-xs font-bold">Idade</label><input type="number" name="Idade" value="${p.Idade || ''}" class="border p-2 rounded w-full"></div>
                    <div><label class="text-xs font-bold">Sexo</label><select name="Sexo" class="border p-2 rounded w-full"><option>M</option><option>F</option></select></div>
                    <div><label class="text-xs font-bold">Grupo</label><input name="Grupo" value="${p.Grupo || ''}" class="border p-2 rounded w-full" placeholder="Ex: Adultos"></div>
                </div>
                <div class="mb-3"><label class="text-xs font-bold">Condição Médica</label><textarea name="CondicaoMedica" class="border p-2 rounded w-full h-16">${p.CondicaoMedica || ''}</textarea></div>
                <div class="mb-3"><label class="text-xs font-bold">Restrições Alimentares</label><textarea name="Restricoes" class="border p-2 rounded w-full h-16">${p.Restricoes || ''}</textarea></div>
                <div class="mb-3"><label class="text-xs font-bold">Observações</label><textarea name="Observacoes" class="border p-2 rounded w-full h-16">${p.Observacoes || ''}</textarea></div>
                <button class="w-full bg-blue-600 text-white py-2 rounded font-bold">Salvar</button>
            </form>
        `);
        if(p.Sexo) document.querySelector('[name="Sexo"]').value = p.Sexo;
    },

    savePaciente: async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target).entries());
        try {
            await Utils.api('save', 'Pacientes', data);
            Utils.toast('Paciente salvo!', 'success');
            Utils.closeModal();
            SocialModule.fetchData();
        } catch (err) { 
            console.error(err);
            Utils.toast('Erro ao salvar: ' + (err.message || err), 'error'); 
        }
    },

    deletePaciente: async (id) => {
        // Validação: Impedir exclusão se houver dietas
        const temDietas = SocialModule.state.dietas.some(d => d.PacienteID === id);
        if (temDietas) {
            return Utils.toast('⚠️ Não é possível excluir: O paciente possui dietas cadastradas. Remova as dietas primeiro.', 'warning');
        }

        if(confirm('Tem certeza que deseja excluir este paciente?')) {
            try {
                await Utils.api('delete', 'Pacientes', null, id);
                SocialModule.state.activePatient = null;
                SocialModule.fetchData();
            } catch (e) { Utils.toast('Erro ao excluir.', 'error'); }
        }
    },

    modalDieta: (patientId) => {
        const p = SocialModule.state.pacientes.find(x => x.ID === patientId);
        const dietas = SocialModule.state.dietas.filter(d => d.PacienteID === patientId);
        const days = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
        const meals = ['Café da Manhã', 'Almoço', 'Lanche', 'Jantar'];

        // Função para duplicar dieta
        window.duplicateDiet = (sourceDay) => {
            if(!confirm(`Deseja copiar a dieta de ${sourceDay} para TODOS os outros dias da semana?`)) return;
            
            meals.forEach(meal => {
                const sourceInput = document.querySelector(`input[name="diet_${sourceDay}_${meal}"]`);
                if (sourceInput) {
                    const val = sourceInput.value;
                    days.forEach(targetDay => {
                        if (targetDay !== sourceDay) {
                            const targetInput = document.querySelector(`input[name="diet_${targetDay}_${meal}"]`);
                            if (targetInput) targetInput.value = val;
                        }
                    });
                }
            });
            Utils.toast('Dieta replicada para a semana toda!');
        };

        // Função para gerar campos de dieta
        window.renderDietFields = (day) => {
            let html = `<div class="bg-gray-50 p-3 rounded mb-2 border">
                <div class="flex justify-between items-center mb-2"><h5 class="font-bold text-sm text-indigo-700">${day}</h5><button type="button" onclick="duplicateDiet('${day}')" class="text-xs bg-white border border-blue-200 text-blue-600 px-2 py-1 rounded hover:bg-blue-50 transition" title="Copiar para todos os dias"><i class="fas fa-copy mr-1"></i> Replicar Semana</button></div>`;
            
            meals.forEach(meal => {
                const d = dietas.find(x => x.DiaSemana === day && x.Refeicao === meal);
                const items = d && d.AlimentosJSON ? d.AlimentosJSON.map(i => `${i.item}:${i.qtd}`).join('; ') : '';
                html += `
                    <div class="mb-2">
                        <label class="text-xs font-bold text-gray-600">${meal}</label>
                        <input name="diet_${day}_${meal}" value="${items}" class="border p-1 rounded w-full text-sm" placeholder="Ex: Arroz:100g; Feijão:50g">
                    </div>
                `;
            });
            html += `</div>`;
            return html;
        };

        Utils.openModal(`Dieta: ${p.Nome}`, `
            <form onsubmit="SocialModule.saveDieta(event, '${patientId}')">
                <div class="max-h-[60vh] overflow-y-auto pr-2">
                    ${days.map(d => renderDietFields(d)).join('')}
                </div>
                <p class="text-xs text-gray-500 mt-2">Formato: Item:Qtd; Item:Qtd (Ex: Pão:1un; Leite:200ml)</p>
                <button class="w-full bg-green-600 text-white py-2 rounded font-bold mt-4">Salvar Dieta</button>
            </form>
        `);
    },

    saveDieta: async (e, patientId) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const promises = [];

        // Deleta dietas antigas deste paciente (simplificação para update total)
        // Idealmente faria upsert, mas como a estrutura é complexa, limpar e recriar é mais seguro aqui
        // Nota: Isso requer uma API específica ou deletar um por um. Vamos usar upsert lógico.
        
        // Iterar sobre os campos
        for (const [key, value] of formData.entries()) {
            if (key.startsWith('diet_')) {
                const parts = key.split('_');
                const day = parts[1];
                const meal = parts[2];
                
                // Parse string "Item:Qtd; Item:Qtd"
                const alimentos = value.trim() ? value.split(';').map(s => {
                    const [item, qtd] = s.split(':');
                    return { item: item ? item.trim() : '', qtd: qtd ? qtd.trim() : '' };
                }).filter(x => x.item) : [];

                // Busca ID existente para update ou cria novo
                const existing = SocialModule.state.dietas.find(d => d.PacienteID === patientId && d.DiaSemana === day && d.Refeicao === meal);
                
                // Otimização: Verifica se houve mudança antes de enviar
                const currentJson = JSON.stringify(alimentos);
                const existingJson = existing ? JSON.stringify(existing.AlimentosJSON || []) : '[]';

                if (currentJson !== existingJson) {
                    const payload = {
                        PacienteID: patientId,
                        DiaSemana: day,
                        Refeicao: meal,
                        AlimentosJSON: alimentos
                    };
                    if (existing) payload.ID = existing.ID;

                    promises.push(Utils.api('save', 'Dietas', payload));
                }
            }
        }

        try {
            await Promise.all(promises);
            Utils.toast('Dieta atualizada!', 'success');
            Utils.closeModal();
            SocialModule.fetchData();
        } catch (err) { 
            console.error(err);
            Utils.toast('Erro ao salvar: ' + (err.message || err), 'error'); 
        }
    },

    generateShoppingList: () => {
        const dietas = SocialModule.state.dietas;
        const shoppingList = {};

        dietas.forEach(d => {
            if (d.AlimentosJSON) {
                d.AlimentosJSON.forEach(i => {
                    const key = i.item.toLowerCase();
                    if (!shoppingList[key]) shoppingList[key] = { name: i.item, count: 0, details: [] };
                    shoppingList[key].count++;
                    shoppingList[key].details.push(`${i.qtd} (${d.DiaSemana})`);
                });
            }
        });

        const items = Object.values(shoppingList).sort((a,b) => a.name.localeCompare(b.name));

        const html = `
            <div class="p-8 font-sans bg-white">
                <h2 class="text-xl font-bold text-center mb-6">Lista de Compras - Caso Social</h2>
                <table class="w-full text-sm border-collapse border border-gray-300">
                    <thead class="bg-gray-100"><tr><th class="border p-2 text-left">Alimento</th><th class="border p-2 text-center">Frequência Semanal</th><th class="border p-2 text-left">Detalhes de Qtd</th></tr></thead>
                    <tbody>
                        ${items.map(i => `<tr><td class="border p-2 font-bold">${i.name}</td><td class="border p-2 text-center">${i.count}</td><td class="border p-2 text-xs text-gray-500">${i.details.join(', ')}</td></tr>`).join('')}
                    </tbody>
                </table>
            </div>
        `;
        Utils.printNative(html);
    },

    printPatient: (id) => {
        const p = SocialModule.state.pacientes.find(x => x.ID === id);
        const dietas = SocialModule.state.dietas.filter(d => d.PacienteID === id);
        const days = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
        const meals = ['Café da Manhã', 'Almoço', 'Lanche', 'Jantar'];

        let dietHtml = '';
        days.forEach(day => {
            const dayDiets = dietas.filter(d => d.DiaSemana === day);
            if (dayDiets.length > 0) {
                dietHtml += `
                    <div class="mb-4 break-inside-avoid border p-2 rounded">
                        <h4 class="font-bold bg-gray-100 p-1 mb-2">${day}</h4>
                        <table class="w-full text-sm">
                            ${meals.map(meal => {
                                const d = dayDiets.find(x => x.Refeicao === meal);
                                if (!d || !d.AlimentosJSON) return '';
                                const items = d.AlimentosJSON.map(i => `${i.item} (${i.qtd})`).join(', ');
                                return `<tr><td class="font-bold w-32 align-top">${meal}:</td><td>${items}</td></tr>`;
                            }).join('')}
                        </table>
                    </div>
                `;
            }
        });

        const html = `
            <div class="p-8 font-sans bg-white">
                <div class="text-center border-b-2 border-gray-800 pb-4 mb-6">
                    <h1 class="text-2xl font-bold uppercase">Ficha de Caso Social</h1>
                    <p class="text-sm text-gray-600">Delícia da Cidade</p>
                </div>
                
                <div class="mb-6 bg-gray-50 p-4 rounded border">
                    <h3 class="font-bold text-lg mb-2">${p.Nome}</h3>
                    <div class="grid grid-cols-2 gap-4 text-sm">
                        <div><b>Idade:</b> ${p.Idade || '-'}</div>
                        <div><b>Sexo:</b> ${p.Sexo || '-'}</div>
                        <div><b>Grupo:</b> ${p.Grupo || '-'}</div>
                        <div><b>Status:</b> ${p.Status}</div>
                    </div>
                    <div class="mt-2 text-sm">
                        <p><b>Condição Médica:</b> ${p.CondicaoMedica || '-'}</p>
                        <p><b>Restrições:</b> ${p.Restricoes || '-'}</p>
                        <p><b>Observações:</b> ${p.Observacoes || '-'}</p>
                    </div>
                </div>

                <h3 class="font-bold text-lg mb-4 border-b pb-1">Plano Alimentar Semanal</h3>
                ${dietHtml || '<p class="italic text-gray-500">Sem dieta cadastrada.</p>'}
            </div>
        `;
        Utils.printNative(html);
    }
};

document.addEventListener('DOMContentLoaded', SocialModule.init);