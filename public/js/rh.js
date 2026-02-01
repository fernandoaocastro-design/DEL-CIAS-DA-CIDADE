const RHModule = {
    state: { cache: { funcionarios: [], ferias: [], frequencia: [], avaliacoes: [], treinamentos: [], licencas: [], folha: [] } },

    init: () => {
        RHModule.renderLayout();
        RHModule.fetchData();
    },

    fetchData: async () => {
        try {
            const [funcs, ferias, freq, aval, trein, lic, folha] = await Promise.all([
                RHModule.api('getAll', 'Funcionarios'),
                RHModule.api('getAll', 'Ferias'),
                RHModule.api('getAll', 'Frequencia'),
                RHModule.api('getAll', 'Avaliacoes'),
                RHModule.api('getAll', 'Treinamentos'),
                RHModule.api('getAll', 'Licencas'),
                RHModule.api('getAll', 'Folha')
            ]);
            RHModule.state.cache = { funcionarios: funcs, ferias, frequencia: freq, avaliacoes: aval, treinamentos: trein, licencas: lic, folha: folha };
            RHModule.renderFuncionarios();
        } catch (e) { 
            console.error("Erro crítico ao carregar dados do servidor:", e);
            Utils.toast("❌ Erro de Conexão: Verifique se o backend está online.");
            document.getElementById('rh-content').innerHTML = `
                <div class="flex flex-col items-center justify-center h-64 text-red-600">
                    <i class="fas fa-server text-4xl mb-4"></i>
                    <h3 class="text-xl font-bold">Erro de Conexão</h3>
                    <p>Não foi possível carregar os dados reais do sistema.</p>
                </div>
            `;
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

    renderLayout: () => {
        // Menu de Abas
        document.getElementById('rh-content').innerHTML = `
            <div class="flex gap-2 mb-6 border-b pb-2 overflow-x-auto">
                <button id="tab-funcionarios" onclick="RHModule.renderFuncionarios()" class="tab-btn px-4 py-2 rounded transition whitespace-nowrap">👥 Funcionários</button>
                <button id="tab-frequencia" onclick="RHModule.renderFrequencia()" class="tab-btn px-4 py-2 rounded transition whitespace-nowrap">⏱️ Frequência</button>
                <button id="tab-ferias" onclick="RHModule.renderFerias()" class="tab-btn px-4 py-2 rounded transition whitespace-nowrap">🏖️ Férias</button>
                <button id="tab-avaliacoes" onclick="RHModule.renderAvaliacoes()" class="tab-btn px-4 py-2 rounded transition whitespace-nowrap">⭐ Avaliação</button>
                <button id="tab-treinamento" onclick="RHModule.renderTreinamento()" class="tab-btn px-4 py-2 rounded transition whitespace-nowrap">🎓 Treinamento</button>
                <button id="tab-folha" onclick="RHModule.renderFolha()" class="tab-btn px-4 py-2 rounded transition whitespace-nowrap">💰 Folha</button>
                <button id="tab-licencas" onclick="RHModule.renderLicencas()" class="tab-btn px-4 py-2 rounded transition whitespace-nowrap">🏥 Licenças</button>
            </div>
            <div id="tab-content"></div>
        `;
    },

    highlightTab: (id) => {
        document.querySelectorAll('.tab-btn').forEach(b => b.className = 'tab-btn px-4 py-2 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition');
        const btn = document.getElementById(id);
        if(btn) btn.className = 'tab-btn px-4 py-2 bg-blue-100 text-blue-700 rounded font-bold hover:bg-blue-200 transition';
    },

    // --- 1. ABA FUNCIONÁRIOS ---
    renderFuncionarios: () => {
        RHModule.highlightTab('tab-funcionarios');
        const data = RHModule.state.cache.funcionarios || [];
        document.getElementById('tab-content').innerHTML = `
            <div class="flex justify-between mb-4">
                <h3 class="text-xl font-bold">Equipe (${data.length})</h3>
                <button onclick="RHModule.modalFuncionario()" class="bg-blue-600 text-white px-4 py-2 rounded">+ Novo Funcionário</button>
            </div>
            <div class="overflow-x-auto">
                <table class="w-full bg-white rounded shadow text-sm">
                    <thead class="bg-gray-100"><tr><th class="p-3 text-left">ID</th><th>Nome</th><th>Cargo</th><th>Departamento</th><th>Salário</th><th>Telefone</th><th>BI</th><th>Admissão</th><th>Ações</th></tr></thead>
                    <tbody>
                        ${data.map(f => `
                            <tr class="border-t hover:bg-gray-50">
                                <td class="p-3 font-mono text-xs">${f.ID}</td>
                                <td class="p-3 font-bold">${f.Nome}</td>
                                <td class="p-3">${f.Cargo}</td>
                                <td class="p-3">${f.Departamento || '-'}</td>
                                <td class="p-3 text-green-600 font-bold">${Utils.formatCurrency(f.Salario)}</td>
                                <td class="p-3">${f.Telefone || '-'}</td>
                                <td class="p-3">${f.BI || '-'}</td>
                                <td class="p-3">${Utils.formatDate(f.Admissao)}</td>
                                <td class="p-3">
                                    <button onclick="RHModule.modalFuncionario('${f.ID}')" class="text-blue-500 mr-2"><i class="fas fa-edit"></i></button>
                                    <button onclick="RHModule.delete('Funcionarios', '${f.ID}')" class="text-red-500"><i class="fas fa-trash"></i></button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },

    modalFuncionario: (id = null) => {
        const f = id ? RHModule.state.cache.funcionarios.find(x => x.ID === id) : {};
        
        // Lógica de Departamento Automático
        const updateDept = (select) => {
            const map = {
                'Gerente Geral': 'Administração', 'Gestor': 'Administração', 'Supervisor': 'Operações',
                'Cozinheiro Chefe': 'Cozinha', 'Cozinheiro': 'Cozinha', 'Auxiliar de Cozinha': 'Cozinha',
                'Garçon': 'Salão', 'Recepcionista': 'Recepção', 'Auxiliar administrativo': 'Administração',
                'Limpeza': 'Serviços Gerais', 'Auxiliar de limpeza': 'Serviços Gerais', 'Segurança': 'Segurança'
            };
            const deptInput = document.getElementById('input-dept');
            if(deptInput) deptInput.value = map[select.value] || 'Outros';
        };

        Utils.openModal(id ? 'Editar' : 'Novo Funcionário', `
            <form onsubmit="RHModule.save(event, 'Funcionarios')">
                <input type="hidden" name="ID" value="${f.ID || ''}">
                
                <h4 class="font-bold text-gray-700 mb-2 border-b">1️⃣ Informações Pessoais</h4>
                <div class="grid grid-cols-2 gap-3 mb-3">
                    <input name="Nome" value="${f.Nome || ''}" placeholder="Nome Completo" class="border p-2 rounded w-full col-span-2" required>
                    <div><label class="text-xs">Nascimento</label><input type="date" name="Nascimento" value="${f.Nascimento || ''}" class="border p-2 rounded w-full"></div>
                    <div><label class="text-xs">BI / Identidade</label><input name="BI" value="${f.BI || ''}" placeholder="000123LA012" class="border p-2 rounded w-full"></div>
                    <div><label class="text-xs">Telefone</label><input name="Telefone" value="${f.Telefone || '+244 '}" class="border p-2 rounded w-full"></div>
                    <div><label class="text-xs">E-mail</label><input type="email" name="Email" value="${f.Email || ''}" placeholder="email@exemplo.com" class="border p-2 rounded w-full"></div>
                </div>

                <h4 class="font-bold text-gray-700 mb-2 border-b mt-4">2️⃣ Área de Trabalho</h4>
                <div class="grid grid-cols-2 gap-3 mb-3">
                    <select name="Cargo" class="border p-2 rounded w-full" onchange="(${updateDept})(this)" required>
                        <option value="">Selecione o Cargo...</option>
                        ${['Gerente Geral','Gestor','Supervisor','Cozinheiro Chefe','Cozinheiro','Auxiliar de Cozinha','Garçon','Recepcionista','Auxiliar administrativo','Limpeza','Auxiliar de limpeza','Segurança'].map(c => `<option ${f.Cargo===c?'selected':''}>${c}</option>`).join('')}
                    </select>
                    <input id="input-dept" name="Departamento" value="${f.Departamento || ''}" placeholder="Departamento (Auto)" class="border p-2 rounded w-full bg-gray-100" readonly>
                    <select name="Turno" class="border p-2 rounded w-full">
                        <option ${f.Turno==='Diarista'?'selected':''}>Diarista</option>
                        <option ${f.Turno==='Regime de Turno'?'selected':''}>Regime de Turno</option>
                    </select>
                    <input name="Salario" type="number" value="${f.Salario || ''}" placeholder="Salário Base (Kz)" class="border p-2 rounded w-full" required>
                </div>

                <h4 class="font-bold text-gray-700 mb-2 border-b mt-4">3️⃣ Informações Administrativas</h4>
                <div class="grid grid-cols-2 gap-3 mb-3">
                    <select name="TipoContrato" class="border p-2 rounded w-full">
                        <option>CLT</option><option>Temporário</option><option>Estagiário</option>
                    </select>
                    <div><label class="text-xs">Admissão</label><input type="date" name="Admissao" value="${f.Admissao || ''}" class="border p-2 rounded w-full"></div>
                    <input name="Iban" value="${f.Iban || 'AO06 '}" placeholder="IBAN (AO06...)" class="border p-2 rounded w-full col-span-2">
                    <select name="Status" class="border p-2 rounded w-full col-span-2">
                        <option ${f.Status==='Ativo'?'selected':''}>Ativo</option>
                        <option ${f.Status==='Afastado'?'selected':''}>Afastado</option>
                        <option ${f.Status==='Demitido'?'selected':''}>Demitido</option>
                    </select>
                </div>

                <button class="w-full bg-blue-600 text-white py-2 rounded">Salvar</button>
            </form>
        `);
    },

    // --- 2. ABA FREQUÊNCIA ---
    renderFrequencia: () => {
        RHModule.highlightTab('tab-frequencia');
        const data = RHModule.state.cache.frequencia || [];
        
        // Função auxiliar para calcular horas
        const calcHours = (start, end) => {
            if(!start || !end) return 0;
            const [h1, m1] = start.split(':').map(Number);
            const [h2, m2] = end.split(':').map(Number);
            return ((h2*60+m2) - (h1*60+m1)) / 60;
        };

        document.getElementById('tab-content').innerHTML = `
            <div class="text-right mb-4"><button onclick="RHModule.modalFrequencia()" class="bg-blue-600 text-white px-4 py-2 rounded">+ Registrar Ponto</button></div>
            <table class="w-full bg-white rounded shadow text-sm">
                <thead class="bg-gray-100"><tr><th class="p-3 text-left">ID</th><th>Nome</th><th>Entrada</th><th>Saída</th><th>Total Horas</th><th>Status (Ref: 8h)</th><th>Ações</th></tr></thead>
                <tbody>
                    ${data.map(r => {
                        const total = calcHours(r.Entrada, r.Saida);
                        const diff = total - 8;
                        const statusClass = diff < 0 ? 'text-red-500' : (diff > 0 ? 'text-green-500' : 'text-gray-500');
                        const statusText = diff < 0 ? `Falta: ${Math.abs(diff).toFixed(1)}h` : (diff > 0 ? `Extra: ${diff.toFixed(1)}h` : 'Normal');
                        
                        return `
                        <tr class="border-t">
                            <td class="p-3">${r.ID}</td>
                            <td class="p-3">${r.FuncionarioNome}</td>
                            <td class="p-3 text-center">${r.Entrada}</td>
                            <td class="p-3 text-center">${r.Saida}</td>
                            <td class="p-3 text-center font-bold">${total.toFixed(2)}h</td>
                            <td class="p-3 text-center font-bold ${statusClass}">${statusText}</td>
                            <td class="p-3 text-center"><button onclick="RHModule.delete('Frequencia', '${r.ID}')" class="text-red-500"><i class="fas fa-trash"></i></button></td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
        `;
    },

    modalFrequencia: () => {
        const funcs = RHModule.state.cache.funcionarios;
        Utils.openModal('Registro de Frequência', `
            <form onsubmit="RHModule.save(event, 'Frequencia')">
                <div class="mb-4">
                    <label class="block text-sm font-bold">Funcionário</label>
                    <select name="FuncionarioID" class="border p-2 rounded w-full" onchange="this.form.FuncionarioNome.value = this.options[this.selectedIndex].text" required>
                        <option value="">Selecione...</option>
                        ${funcs.map(f => `<option value="${f.ID}">${f.Nome}</option>`).join('')}
                    </select>
                    <input type="hidden" name="FuncionarioNome">
                </div>
                <div class="mb-4"><label class="text-xs">Data</label><input type="date" name="Data" class="border p-2 rounded w-full" required></div>
                <div class="grid grid-cols-2 gap-4 mb-4">
                    <div><label class="text-xs">Entrada</label><input type="time" name="Entrada" class="border p-2 rounded w-full" required></div>
                    <div><label class="text-xs">Saída</label><input type="time" name="Saida" class="border p-2 rounded w-full" required></div>
                </div>
                <div class="mb-4">
                    <input name="Assinatura" placeholder="Assinatura Digital (Texto)" class="border p-2 rounded w-full bg-gray-50">
                </div>
                <div class="mb-4">
                    <textarea name="Observacoes" placeholder="Observações (Atrasos, Justificativas...)" class="border p-2 rounded w-full h-20"></textarea>
                </div>
                <button class="w-full bg-blue-600 text-white py-2 rounded">Registrar</button>
            </form>
        `);
    },

    // --- 3. ABA FÉRIAS ---
    renderFerias: () => {
        RHModule.highlightTab('tab-ferias');
        const data = RHModule.state.cache.ferias || [];
        document.getElementById('tab-content').innerHTML = `
            <div class="text-right mb-4"><button onclick="RHModule.modalFerias()" class="bg-blue-600 text-white px-4 py-2 rounded">+ Solicitar Férias</button></div>
            <table class="w-full bg-white rounded shadow text-sm">
                <thead class="bg-gray-100"><tr><th class="p-3 text-left">ID</th><th>Nome</th><th>Início</th><th>Retorno</th><th>Dias</th><th>Subsídio de Férias</th><th>Status</th><th>Ações</th></tr></thead>
                <tbody>
                    ${data.map(r => `
                        <tr class="border-t">
                            <td class="p-3">${r.ID}</td>
                            <td class="p-3">${r.FuncionarioNome || '-'}</td>
                            <td class="p-3 text-center">${Utils.formatDate(r.DataInicio)}</td>
                            <td class="p-3 text-center">${Utils.formatDate(r.DataFim)}</td>
                            <td class="p-3 text-center">${r.Dias}</td>
                            <td class="p-3 text-center">${r.Pagamento13 === 'Sim' ? '✅' : '❌'}</td>
                            <td class="p-3 text-center"><span class="px-2 py-1 rounded ${r.Status==='Aprovado'?'bg-green-100 text-green-700':'bg-yellow-100 text-yellow-700'}">${r.Status}</span></td>
                            <td class="p-3 text-center"><button onclick="RHModule.delete('Ferias', '${r.ID}')" class="text-red-500"><i class="fas fa-trash"></i></button></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    },

    modalFerias: () => {
        const funcs = RHModule.state.cache.funcionarios;
        
        // Script para preencher dados automaticamente
        const fillData = (select) => {
            const f = RHModule.state.cache.funcionarios.find(x => x.ID === select.value);
            if(f) {
                select.form.FuncionarioNome.value = f.Nome;
                document.getElementById('f-cargo').value = f.Cargo;
                document.getElementById('f-dept').value = f.Departamento || '';
                document.getElementById('f-adm').value = f.Admissao || '';
            }
        };

        Utils.openModal('Solicitar Férias', `
            <form onsubmit="RHModule.save(event, 'Ferias')">
                <h3 class="text-lg font-bold text-gray-800 mb-4 border-b pb-2">Controle de Férias / Observações (Opcional)</h3>
                
                <div class="mb-4">
                    <label class="block text-sm font-bold mb-1">Nome do Funcionario</label>
                    <select name="FuncionarioID" class="border p-2 rounded w-full mb-2" onchange="(${fillData})(this)" required>
                        <option value="">Selecione...</option>
                        ${funcs.map(f => `<option value="${f.ID}">${f.Nome}</option>`).join('')}
                    </select>
                    <input type="hidden" name="FuncionarioNome">
                    <div class="grid grid-cols-3 gap-2 text-xs">
                        <input id="f-cargo" placeholder="CARGO" class="border p-2 bg-gray-100 rounded" readonly>
                        <input id="f-dept" placeholder="DEPARTAMENTO" class="border p-2 bg-gray-100 rounded" readonly>
                        <input id="f-adm" placeholder="DATA DE ADMISSÃO" class="border p-2 bg-gray-100 rounded" readonly>
                    </div>
                </div>

                <h4 class="font-bold text-gray-700 mb-2 border-b">1. PERIODO</h4>
                <div class="grid grid-cols-3 gap-2 mb-3">
                    <div><label class="text-xs font-bold">DATA DE INICIO DAS FERIAS</label><input type="date" name="DataInicio" class="border p-2 rounded w-full" required></div>
                    <div><label class="text-xs font-bold">DATA DE RETORNO</label><input type="date" name="DataFim" class="border p-2 rounded w-full" required></div>
                    <div><label class="text-xs font-bold">TOTAL DE DIAS</label><input type="number" name="Dias" class="border p-2 rounded w-full" required></div>
                </div>

                <h4 class="font-bold text-gray-700 mb-2 border-b">2. FRACCIONAMENTO</h4>
                <div class="mb-3">
                    <label class="text-xs font-bold block">FÉRIAS FRACIONADAS (SIM/NÃO)</label>
                    <select name="Fracionadas" class="border p-2 rounded w-full"><option>Não</option><option>Sim</option></select>
                </div>

                <h4 class="font-bold text-gray-700 mb-2 border-b">3. PAGAMENTOS</h4>
                <div class="grid grid-cols-3 gap-2 mb-3">
                    <div><label class="text-xs font-bold block">PAGAMENTO COM 1/3 CONSTITUCIONAL</label><select name="Pagamento13" class="border p-2 rounded w-full"><option>Não</option><option>Sim</option></select></div>
                    <div><label class="text-xs font-bold block">ADIANTAMENTO DE 13º SLÁRIO</label><select name="Adiantamento13" class="border p-2 rounded w-full"><option>Não</option><option>Sim</option></select></div>
                    <div><label class="text-xs font-bold block">DATA DE PAGAMENTO</label><input type="date" name="DataPagamento" class="border p-2 rounded w-full"></div>
                </div>

                <div class="mb-4">
                    <label class="text-xs font-bold block">OBSERVAÇÕES</label>
                    <textarea name="Observacoes" class="border p-2 rounded w-full h-16"></textarea>
                </div>
                
                <div class="grid grid-cols-2 gap-4 mb-4">
                    <input name="AssinaturaFunc" placeholder="ASSINATURA DO FUNCIONARIO" class="border p-2 rounded bg-gray-50 text-xs">
                    <input name="AssinaturaRH" placeholder="ASSINATURA DO SUPERVISOR/ RH" class="border p-2 rounded bg-gray-50 text-xs">
                </div>

                <select name="Status" class="border p-2 rounded w-full mb-4 bg-yellow-50">
                    <option>Solicitado</option>
                    <option>Aprovado</option>
                </select>

                <button class="w-full bg-blue-600 text-white py-2 rounded">Salvar</button>
            </form>
        `);
    },

    // --- 4. ABA AVALIAÇÃO ---
    renderAvaliacoes: () => {
        RHModule.highlightTab('tab-avaliacoes');
        const data = RHModule.state.cache.avaliacoes || [];
        document.getElementById('tab-content').innerHTML = `
            <div class="text-right mb-4"><button onclick="RHModule.modalAvaliacao()" class="bg-blue-600 text-white px-4 py-2 rounded">+ Nova Avaliação</button></div>
            <table class="w-full bg-white rounded shadow text-sm">
                <thead class="bg-gray-100"><tr><th class="p-3 text-left">ID</th><th>Funcionário</th><th>Data</th><th>Média (0-10)</th><th>Conclusão</th><th>Ações</th></tr></thead>
                <tbody>
                    ${data.map(r => `
                        <tr class="border-t">
                            <td class="p-3">${r.ID}</td>
                            <td class="p-3">${r.FuncionarioNome}</td>
                            <td class="p-3 text-center">${Utils.formatDate(r.DataAvaliacao)}</td>
                            <td class="p-3 text-center font-bold">${r.MediaFinal}</td>
                            <td class="p-3 text-center"><span class="px-2 py-1 rounded bg-gray-100 text-xs">${r.Conclusao || '-'}</span></td>
                            <td class="p-3 text-center"><button onclick="RHModule.delete('Avaliacoes', '${r.ID}')" class="text-red-500"><i class="fas fa-trash"></i></button></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    },

    modalAvaliacao: () => {
        const funcs = RHModule.state.cache.funcionarios;
        
        // Script para preencher dados
        const fillData = (select) => {
            const f = RHModule.state.cache.funcionarios.find(x => x.ID === select.value);
            if(f) {
                select.form.FuncionarioNome.value = f.Nome;
                document.getElementById('av-cargo').value = f.Cargo;
                document.getElementById('av-dept').value = f.Departamento || '';
            }
        };

        // Script para calcular média
        const calcMedia = () => {
            const inputs = document.querySelectorAll('.nota-input');
            let sum = 0;
            inputs.forEach(i => sum += Number(i.value || 0));
            const avg = (sum / inputs.length).toFixed(1);
            document.getElementById('media-final').value = avg;
            
            let conc = 'Insatisfatório';
            if(avg >= 9) conc = 'Excelente';
            else if(avg >= 7) conc = 'Aprovado';
            else if(avg >= 5) conc = 'Requer Melhorias';
            document.getElementById('conclusao').value = conc;
        };

        Utils.openModal('Avaliação de Desempenho', `
            <form onsubmit="RHModule.save(event, 'Avaliacoes')">
                <h4 class="font-bold text-gray-700 mb-2 border-b">1 AVALIAÇÃO DE DESEMPENHO</h4>
                <div class="mb-3">
                    <label class="block text-xs font-bold">NOME DO FUNCIONARIO</label>
                    <select name="FuncionarioID" class="border p-2 rounded w-full mb-2" onchange="(${fillData})(this)" required>
                        <option value="">Selecione...</option>
                        ${funcs.map(f => `<option value="${f.ID}">${f.Nome}</option>`).join('')}
                    </select>
                    <input type="hidden" name="FuncionarioNome">
                    <div class="grid grid-cols-2 gap-2 text-xs mb-2">
                        <input id="av-cargo" placeholder="CARGO/FUNÇÃO" class="border p-2 bg-gray-100 rounded" readonly>
                        <input id="av-dept" placeholder="DEPARTAMENTO/SETOR" class="border p-2 bg-gray-100 rounded" readonly>
                    </div>
                    <div class="grid grid-cols-2 gap-2">
                        <div><label class="text-xs font-bold">DATA DE AVALIAÇÃO</label><input type="date" name="DataAvaliacao" class="border p-2 rounded w-full" required></div>
                        <div><label class="text-xs font-bold">NOME DO AVALIADOR</label><input name="Avaliador" class="border p-2 rounded w-full"></div>
                    </div>
                </div>
                
                <h4 class="font-bold text-gray-700 mb-2 border-b">2 CRITERIOS DE AVALIAÇÃO (ESCALA 1-10)</h4>
                <div class="grid grid-cols-3 gap-2 mb-3 text-sm" oninput="(${calcMedia})()">
                    <input type="number" name="N1" placeholder="PONTUALIDADE" min="0" max="10" class="nota-input border p-2 rounded">
                    <input type="number" name="N2" placeholder="ASSIDUIDADE" min="0" max="10" class="nota-input border p-2 rounded">
                    <input type="number" name="N3" placeholder="CUMPRIMENTO DE TAREFAS" min="0" max="10" class="nota-input border p-2 rounded">
                    <input type="number" name="N4" placeholder="PRODUTIVIDADE" min="0" max="10" class="nota-input border p-2 rounded">
                    <input type="number" name="N5" placeholder="QUALIDADE DO TRABALHO" min="0" max="10" class="nota-input border p-2 rounded">
                    <input type="number" name="N6" placeholder="TRABALHO EM EQUIPE" min="0" max="10" class="nota-input border p-2 rounded">
                    <input type="number" name="N7" placeholder="RESPONSABILIDADE" min="0" max="10" class="nota-input border p-2 rounded">
                    <input type="number" name="N8" placeholder="COMPROMETIMENTO" min="0" max="10" class="nota-input border p-2 rounded">
                    <input type="number" name="N9" placeholder="COMUNICAÇÃO" min="0" max="10" class="nota-input border p-2 rounded">
                </div>

                <h4 class="font-bold text-gray-700 mb-2 border-b">3 AVALIAÇÃO QUALITATIVA</h4>
                <div class="grid grid-cols-2 gap-2 mb-3">
                    <textarea name="PontosFortes" placeholder="PONTOS FORTES" class="border p-2 rounded h-16 text-xs"></textarea>
                    <textarea name="PontosMelhorar" placeholder="PONTOS A MELHORAR" class="border p-2 rounded h-16 text-xs"></textarea>
                </div>
                <div class="mb-3">
                    <textarea name="Comentarios" placeholder="COMENTARIOS DO AVALIADOR" class="border p-2 rounded w-full h-16 text-xs"></textarea>
                </div>

                <h4 class="font-bold text-gray-700 mb-2 border-b">4 RESULTADO</h4>
                <div class="flex gap-2 mb-4">
                    <input id="media-final" name="MediaFinal" placeholder="NOTA FINAL/MÉDIA GERAL" class="border p-2 rounded w-1/2 font-bold text-center bg-gray-100" readonly>
                    <input id="conclusao" name="Conclusao" placeholder="CONCLUSÃO" class="border p-2 rounded w-1/2 font-bold bg-gray-100" readonly>
                </div>

                <button class="w-full bg-blue-600 text-white py-2 rounded">Calcular & Salvar</button>
            </form>
        `);
    },

    // --- 5. ABA TREINAMENTO ---
    renderTreinamento: () => {
        RHModule.highlightTab('tab-treinamento');
        const data = RHModule.state.cache.treinamentos || [];
        document.getElementById('tab-content').innerHTML = `
            <div class="text-right mb-4"><button onclick="RHModule.modalTreinamento()" class="bg-blue-600 text-white px-4 py-2 rounded">+ Novo Treinamento</button></div>
            <table class="w-full bg-white rounded shadow text-sm">
                <thead class="bg-gray-100"><tr><th class="p-3 text-left">ID</th><th>Nome</th><th>Título</th><th>Tipo</th><th>Início</th><th>Término</th><th>Status</th><th>Ações</th></tr></thead>
                <tbody>
                    ${data.map(r => `
                        <tr class="border-t">
                            <td class="p-3">${r.ID}</td>
                            <td class="p-3">${r.FuncionarioNome}</td>
                            <td class="p-3 font-bold">${r.Titulo}</td>
                            <td class="p-3">${r.Tipo}</td>
                            <td class="p-3 text-center">${Utils.formatDate(r.Inicio)}</td>
                            <td class="p-3 text-center">${Utils.formatDate(r.Termino)}</td>
                            <td class="p-3 text-center"><span class="px-2 py-1 rounded bg-blue-100 text-blue-800 text-xs">${r.Status}</span></td>
                            <td class="p-3 text-center"><button onclick="RHModule.delete('Treinamentos', '${r.ID}')" class="text-red-500"><i class="fas fa-trash"></i></button></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    },

    modalTreinamento: () => {
        const funcs = RHModule.state.cache.funcionarios;
        Utils.openModal('Registro de Treinamento', `
            <form onsubmit="RHModule.save(event, 'Treinamentos')">
                <div class="mb-3">
                    <label class="block text-sm font-bold">Participante</label>
                    <select name="FuncionarioID" class="border p-2 rounded w-full" onchange="this.form.FuncionarioNome.value = this.options[this.selectedIndex].text">
                        <option value="Todos">Todos os Funcionários</option>
                        ${funcs.map(f => `<option value="${f.ID}">${f.Nome}</option>`).join('')}
                    </select>
                    <input type="hidden" name="FuncionarioNome" value="Todos">
                </div>
                
                <h4 class="font-bold text-gray-700 mb-2 border-b">Detalhes</h4>
                <div class="grid grid-cols-2 gap-3 mb-3">
                    <input name="Titulo" placeholder="Título do Treinamento" class="border p-2 rounded w-full col-span-2" required>
                    <select name="Tipo" class="border p-2 rounded w-full">
                        <option>Interno</option><option>Externo</option><option>Online</option><option>Presencial</option>
                    </select>
                    <input name="Instrutor" placeholder="Instrutor/Responsável" class="border p-2 rounded w-full">
                    <input name="Local" placeholder="Local" class="border p-2 rounded w-full col-span-2">
                </div>

                <h4 class="font-bold text-gray-700 mb-2 border-b">Datas & Status</h4>
                <div class="grid grid-cols-3 gap-2 mb-3">
                    <div><label class="text-xs">Início</label><input type="date" name="Inicio" class="border p-1 rounded w-full"></div>
                    <div><label class="text-xs">Término</label><input type="date" name="Termino" class="border p-1 rounded w-full"></div>
                    <div><label class="text-xs">Carga (h)</label><input type="number" name="Carga" class="border p-1 rounded w-full"></div>
                </div>
                <select name="Status" class="border p-2 rounded w-full mb-4">
                    <option>Pendente</option><option>Em Andamento</option><option>Concluído</option><option>Futuro</option>
                </select>

                <button class="w-full bg-blue-600 text-white py-2 rounded">Salvar</button>
            </form>
        `);
    },

    // --- 6. ABA FOLHA DE PAGAMENTO ---
    renderFolha: () => {
        RHModule.highlightTab('tab-folha');
        const data = RHModule.state.cache.folha || [];
        
        document.getElementById('tab-content').innerHTML = `
            <div class="text-right mb-4"><button onclick="RHModule.modalFolha()" class="bg-indigo-600 text-white px-4 py-2 rounded">+ Lançar Pagamento</button></div>
            <table class="w-full bg-white rounded shadow text-sm">
                <thead class="bg-gray-100"><tr><th class="p-3 text-left">ID</th><th>Nome</th><th class="text-right">Salário Base</th><th class="text-right">Vencimentos</th><th class="text-right">Descontos</th><th class="text-right">Líquido</th><th>Banco/IBAN</th><th>Ações</th></tr></thead>
                <tbody>
                    ${data.map(r => `
                        <tr class="border-t">
                            <td class="p-3">${r.ID}</td>
                            <td class="p-3 font-bold">${r.FuncionarioNome}</td>
                            <td class="p-3 text-right">${Utils.formatCurrency(r.SalarioBase)}</td>
                            <td class="p-3 text-right text-blue-600">${Utils.formatCurrency(r.TotalVencimentos)}</td>
                            <td class="p-3 text-right text-red-500">${Utils.formatCurrency(r.TotalDescontos)}</td>
                            <td class="p-3 text-right font-bold text-green-700">${Utils.formatCurrency(r.SalarioLiquido)}</td>
                            <td class="p-3 text-xs">${r.Banco || '-'} <br> ${r.Iban || '-'}</td>
                            <td class="p-3 text-center"><button onclick="RHModule.delete('Folha', '${r.ID}')" class="text-red-500"><i class="fas fa-trash"></i></button></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    },

    modalFolha: () => {
        const funcs = RHModule.state.cache.funcionarios;
        
        // Preencher dados e Salário Base
        const fillData = (select) => {
            const f = RHModule.state.cache.funcionarios.find(x => x.ID === select.value);
            if(f) {
                select.form.FuncionarioNome.value = f.Nome;
                document.getElementById('folha-cargo').value = f.Cargo;
                document.getElementById('folha-base').value = f.Salario;
                document.getElementById('folha-iban').value = f.Iban || 'AO06';
                calcFolha();
            }
        };

        // Cálculo em tempo real
        const calcFolha = () => {
            const base = Number(document.getElementById('folha-base').value || 0);
            
            // Vencimentos
            const heVal = Number(document.querySelector('[name="ValorHoraExtra"]').value || 0);
            const heQtd = Number(document.querySelector('[name="QtdHoraExtra"]').value || 0);
            const bonus = Number(document.querySelector('[name="Bonus"]').value || 0);
            const outrosV = Number(document.querySelector('[name="OutrosVencimentos"]').value || 0);
            const totalV = base + (heVal * heQtd) + bonus + outrosV;

            // Descontos
            const inss = Number(document.querySelector('[name="INSS"]').value || 0);
            const irt = Number(document.querySelector('[name="IRT"]').value || 0);
            const faltas = Number(document.querySelector('[name="Faltas"]').value || 0);
            const outrosD = Number(document.querySelector('[name="OutrosDescontos"]').value || 0);
            const totalD = inss + irt + faltas + outrosD;

            document.getElementById('total-venc').value = totalV;
            document.getElementById('total-desc').value = totalD;
            document.getElementById('liquido').value = totalV - totalD;
        };

        Utils.openModal('Lançamento de Folha', `
            <form onsubmit="RHModule.save(event, 'Folha')" oninput="(${calcFolha})()">
                <h4 class="font-bold text-gray-700 mb-2 border-b">1. Identificação</h4>
                <div class="grid grid-cols-2 gap-3 mb-3">
                    <select name="FuncionarioID" class="border p-2 rounded w-full col-span-2" onchange="(${fillData})(this)" required>
                        <option value="">Selecione...</option>
                        ${funcs.map(f => `<option value="${f.ID}">${f.Nome}</option>`).join('')}
                    </select>
                    <input type="hidden" name="FuncionarioNome">
                    <input id="folha-cargo" placeholder="Cargo" class="border p-2 bg-gray-100" readonly>
                    <input type="month" name="Periodo" class="border p-2 rounded w-full" required>
                </div>

                <h4 class="font-bold text-gray-700 mb-2 border-b text-green-700">2. Vencimentos (Créditos)</h4>
                <div class="grid grid-cols-2 gap-2 mb-3 text-sm">
                    <input id="folha-base" name="SalarioBase" placeholder="Salário Base" class="border p-2 bg-gray-50" readonly>
                    <input name="Bonus" placeholder="Bônus/Prêmios" type="number" class="border p-2">
                    <div class="flex gap-1">
                        <input name="QtdHoraExtra" placeholder="Qtd HE" type="number" class="border p-2 w-1/2">
                        <input name="ValorHoraExtra" placeholder="Vlr HE" type="number" class="border p-2 w-1/2">
                    </div>
                    <input name="OutrosVencimentos" placeholder="Outros (Comissões...)" type="number" class="border p-2">
                </div>

                <h4 class="font-bold text-gray-700 mb-2 border-b text-red-700">3. Descontos</h4>
                <div class="grid grid-cols-2 gap-2 mb-3 text-sm">
                    <input name="INSS" placeholder="INSS (3%)" type="number" class="border p-2">
                    <input name="IRT" placeholder="IRT" type="number" class="border p-2">
                    <input name="Faltas" placeholder="Faltas/Atrasos" type="number" class="border p-2">
                    <input name="OutrosDescontos" placeholder="Outros (Vales...)" type="number" class="border p-2">
                </div>

                <h4 class="font-bold text-gray-700 mb-2 border-b">4. Totais & Banco</h4>
                <div class="grid grid-cols-3 gap-2 mb-3 font-bold">
                    <input id="total-venc" name="TotalVencimentos" class="border p-2 bg-green-50 text-green-700" readonly>
                    <input id="total-desc" name="TotalDescontos" class="border p-2 bg-red-50 text-red-700" readonly>
                    <input id="liquido" name="SalarioLiquido" class="border p-2 bg-blue-50 text-blue-700" readonly>
                </div>
                <div class="grid grid-cols-2 gap-2 mb-4 text-sm">
                    <input name="Banco" placeholder="Banco" class="border p-2">
                    <input id="folha-iban" name="Iban" placeholder="IBAN" class="border p-2">
                </div>

                <button class="w-full bg-green-600 text-white py-2 rounded">Confirmar Pagamento</button>
            </form>
        `);
    },

    // --- 7. ABA LICENÇAS E AUSÊNCIAS ---
    renderLicencas: () => {
        RHModule.highlightTab('tab-licencas');
        const data = RHModule.state.cache.licencas || [];
        document.getElementById('tab-content').innerHTML = `
            <div class="text-right mb-4"><button onclick="RHModule.modalLicencas()" class="bg-blue-600 text-white px-4 py-2 rounded">+ Nova Licença/Ausência</button></div>
            <table class="w-full bg-white rounded shadow text-sm">
                <thead class="bg-gray-100"><tr><th class="p-3 text-left">ID</th><th>Funcionário</th><th>Tipo</th><th>Início</th><th>Retorno</th><th>Ações</th></tr></thead>
                <tbody>
                    ${data.map(r => `
                        <tr class="border-t">
                            <td class="p-3">${r.ID}</td>
                            <td class="p-3">${r.FuncionarioNome}</td>
                            <td class="p-3 font-bold">${r.Tipo}</td>
                            <td class="p-3 text-center">${Utils.formatDate(r.Inicio)}</td>
                            <td class="p-3 text-center">${Utils.formatDate(r.Retorno)}</td>
                            <td class="p-3 text-center"><button onclick="RHModule.delete('Licencas', '${r.ID}')" class="text-red-500"><i class="fas fa-trash"></i></button></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    },

    modalLicencas: () => {
        const funcs = RHModule.state.cache.funcionarios;
        
        // Lógica Dinâmica de Exibição
        const toggleForm = (select) => {
            const val = select.value;
            document.querySelectorAll('.dynamic-form').forEach(d => d.classList.add('hidden'));
            
            if(val === 'Licença Médica') document.getElementById('form-medica').classList.remove('hidden');
            else if(val === 'Licença Maternidade') document.getElementById('form-maternidade').classList.remove('hidden');
            else if(val === 'Licença Paternidade') document.getElementById('form-paternidade').classList.remove('hidden');
            else if(val === 'Licença Casamento') document.getElementById('form-casamento').classList.remove('hidden');
            else if(val === 'Ausência Justificada') document.getElementById('form-justificada').classList.remove('hidden');
            else if(val === 'Ausência Não Justificada') document.getElementById('form-nao-justificada').classList.remove('hidden');
        };

        Utils.openModal('Gestão de Ausências', `
            <form onsubmit="RHModule.save(event, 'Licencas')">
                <div class="mb-4">
                    <label class="block text-sm font-bold">Tipo de Licença</label>
                    <select name="Tipo" class="border p-2 rounded w-full bg-blue-50" onchange="(${toggleForm})(this)" required>
                        <option value="">[Selecione]</option>
                        <option>Licença Médica</option>
                        <option>Licença Maternidade</option>
                        <option>Licença Paternidade</option>
                        <option>Licença Casamento</option>
                        <option>Ausência Justificada</option>
                        <option>Ausência Não Justificada</option>
                    </select>
                </div>

                <div class="mb-3">
                    <select name="FuncionarioID" class="border p-2 rounded w-full" onchange="this.form.FuncionarioNome.value = this.options[this.selectedIndex].text" required>
                        <option value="">Selecione o Funcionário...</option>
                        ${funcs.map(f => `<option value="${f.ID}">${f.Nome}</option>`).join('')}
                    </select>
                    <input type="hidden" name="FuncionarioNome">
                </div>

                <!-- FORMULÁRIOS DINÂMICOS -->
                <div id="form-medica" class="dynamic-form hidden space-y-3 border-l-4 border-blue-500 pl-3">
                    <h5 class="font-bold text-blue-600">🩺 Licença Médica</h5>
                    <div class="grid grid-cols-2 gap-2">
                        <input type="date" name="Inicio" class="border p-2 w-full">
                        <input type="date" name="Retorno" class="border p-2 w-full">
                    </div>
                    <input name="Medico" placeholder="Nome do Médico" class="border p-2 w-full">
                    <label class="block text-xs">Anexo Atestado</label>
                    <input type="file" class="border p-1 w-full text-xs">
                </div>

                <div id="form-maternidade" class="dynamic-form hidden space-y-3 border-l-4 border-pink-500 pl-3">
                    <h5 class="font-bold text-pink-600">🤰 Licença Maternidade</h5>
                    <div class="grid grid-cols-2 gap-2">
                        <input type="date" name="InicioMat" class="border p-2 w-full">
                        <input type="date" name="TerminoMat" class="border p-2 w-full">
                    </div>
                    <label class="block text-xs">Certidão Nascimento (Opcional)</label>
                    <input type="file" class="border p-1 w-full text-xs">
                </div>

                <div id="form-paternidade" class="dynamic-form hidden space-y-3 border-l-4 border-blue-800 pl-3">
                    <h5 class="font-bold text-blue-800">👨‍🍼 Licença Paternidade</h5>
                    <div class="grid grid-cols-2 gap-2">
                        <input type="date" name="InicioPat" class="border p-2 w-full">
                        <input type="date" name="TerminoPat" class="border p-2 w-full">
                    </div>
                </div>

                <div id="form-casamento" class="dynamic-form hidden space-y-3 border-l-4 border-purple-500 pl-3">
                    <h5 class="font-bold text-purple-600">💍 Licença Casamento</h5>
                    <input type="date" name="DataCasamento" class="border p-2 w-full">
                    <input type="number" name="DiasLicenca" placeholder="Dias de Licença (3-5)" class="border p-2 w-full">
                </div>

                <div id="form-justificada" class="dynamic-form hidden space-y-3 border-l-4 border-green-500 pl-3">
                    <h5 class="font-bold text-green-600">🚫 Ausência Justificada</h5>
                    <input type="date" name="DataAusencia" class="border p-2 w-full">
                    <input name="Motivo" placeholder="Motivo" class="border p-2 w-full">
                    <textarea name="Justificativa" placeholder="Detalhes..." class="border p-2 w-full h-16"></textarea>
                </div>

                <div id="form-nao-justificada" class="dynamic-form hidden space-y-3 border-l-4 border-red-500 pl-3">
                    <h5 class="font-bold text-red-600">❌ Ausência Não Justificada</h5>
                    <input type="date" name="DataFalta" class="border p-2 w-full">
                    <textarea name="ObsFalta" placeholder="Observações..." class="border p-2 w-full h-16"></textarea>
                </div>

                <button class="w-full bg-blue-600 text-white py-2 rounded mt-4">Salvar Registro</button>
            </form>
        `);
    },

    // --- GENÉRICOS ---
    save: async (e, table) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target).entries());

        // VALIDAÇÕES DE REGRAS DE NEGÓCIO
        if (table === 'Frequencia') {
            if (!data.FuncionarioID) return Utils.toast('⚠️ Erro: Selecione um funcionário.');
            if (!data.Data) return Utils.toast('⚠️ Erro: A data é obrigatória.');
            if (data.Saida && data.Entrada && data.Saida <= data.Entrada) return Utils.toast('⚠️ Erro: A hora de saída deve ser posterior à entrada.');
        }
        if (table === 'Ferias') {
            if (!data.FuncionarioID) return Utils.toast('⚠️ Erro: Selecione um funcionário.');
            if (new Date(data.DataFim) <= new Date(data.DataInicio)) return Utils.toast('⚠️ Erro: A data de retorno deve ser posterior ao início.');
            if (Number(data.Dias) <= 0) return Utils.toast('⚠️ Erro: A quantidade de dias deve ser positiva.');
        }
        if (table === 'Treinamentos') {
            if (!data.Titulo) return Utils.toast('⚠️ Erro: O título do treinamento é obrigatório.');
            if (data.Inicio && data.Termino && new Date(data.Termino) < new Date(data.Inicio)) return Utils.toast('⚠️ Erro: A data de término não pode ser anterior ao início.');
        }
        if (table === 'Avaliacoes') {
            if (!data.FuncionarioID) return Utils.toast('⚠️ Erro: Selecione um funcionário.');
            if (Object.keys(data).filter(k => k.startsWith('N')).some(k => Number(data[k]) < 0 || Number(data[k]) > 10)) return Utils.toast('⚠️ Erro: As notas devem ser entre 0 e 10.');
        }
        if (table === 'Folha') {
            if (!data.FuncionarioID) return Utils.toast('⚠️ Erro: Selecione um funcionário.');
            if (!data.Periodo) return Utils.toast('⚠️ Erro: O período de referência é obrigatório.');
            if (Number(data.SalarioLiquido) < 0) return Utils.toast('⚠️ Erro: O salário líquido não pode ser negativo. Revise os descontos.');
        }

        try {
            await RHModule.api('save', table, data);
            Utils.toast('✅ Registro salvo com sucesso!'); 
            Utils.closeModal(); 
            RHModule.fetchData(); 
        } catch (err) {
            console.error("Erro ao salvar:", err);
            Utils.toast('❌ Erro ao salvar: ' + err.message);
        }
    },

    delete: async (table, id) => {
        if(confirm('Tem certeza?')) {
            await RHModule.api('delete', table, null, id);
            RHModule.fetchData();
        }
    }
};

document.addEventListener('DOMContentLoaded', RHModule.init);