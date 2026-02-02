const RHModule = {
    state: { cache: { funcionarios: [], ferias: [], frequencia: [], avaliacoes: [], treinamentos: [], licencas: [], folha: [], parametros: [], cargos: [], departamentos: [], instituicao: [] } },

    init: () => {
        RHModule.renderLayout();
        RHModule.fetchData();
    },

    fetchData: async () => {
        try {
            const [funcs, ferias, freq, aval, trein, lic, folha, params, cargos, deptos, inst] = await Promise.all([
                Utils.api('getAll', 'Funcionarios'),
                Utils.api('getAll', 'Ferias'),
                Utils.api('getAll', 'Frequencia'),
                Utils.api('getAll', 'Avaliacoes'),
                Utils.api('getAll', 'Treinamentos'),
                Utils.api('getAll', 'Licencas'),
                Utils.api('getAll', 'Folha'),
                Utils.api('getAll', 'ParametrosRH'),
                Utils.api('getAll', 'Cargos'),
                Utils.api('getAll', 'Departamentos'),
                Utils.api('getAll', 'InstituicaoConfig')
            ]);
            RHModule.state.cache = { 
                funcionarios: funcs, ferias, frequencia: freq, avaliacoes: aval, treinamentos: trein, licencas: lic, folha: folha, 
                parametros: params || [], cargos: cargos || [], departamentos: deptos || [], instituicao: inst || [] 
            };
            RHModule.renderFuncionarios();
        } catch (e) { 
            console.error("Erro crítico ao carregar dados do servidor:", e);
            Utils.toast("Erro de Conexão: Verifique se o backend está online.", 'error');
            document.getElementById('rh-content').innerHTML = `
                <div class="flex flex-col items-center justify-center h-64 text-red-600">
                    <i class="fas fa-server text-4xl mb-4"></i>
                    <h3 class="text-xl font-bold">Erro de Conexão</h3>
                    <p>Não foi possível carregar os dados reais do sistema.</p>
                </div>
            `;
        }
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
                <button id="tab-relatorios" onclick="RHModule.renderRelatorios()" class="tab-btn px-4 py-2 rounded transition whitespace-nowrap">📊 Relatórios</button>
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
        const canDelete = Utils.checkPermission('RH', 'excluir');
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
                                    ${canDelete ? `<button onclick="RHModule.delete('Funcionarios', '${f.ID}')" class="text-red-500"><i class="fas fa-trash"></i></button>` : ''}
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
        const tiposContrato = RHModule.state.cache.parametros.filter(p => p.Tipo === 'TipoContrato');
        const cargosList = RHModule.state.cache.cargos || [];
        
        // Lógica de Departamento Automático
        const updateDept = (select) => {
            const cargoNome = select.value;
            const cargos = RHModule.state.cache.cargos || [];
            const deptos = RHModule.state.cache.departamentos || [];
            
            const cargo = cargos.find(c => c.Nome === cargoNome);
            let deptNome = 'Outros';

            if (cargo && cargo.DepartamentoID) {
                const dept = deptos.find(d => d.ID === cargo.DepartamentoID);
                if (dept) deptNome = dept.Nome;
            } else {
                // Fallback (Mapa antigo caso o banco esteja vazio)
                const map = { 'Gerente Geral': 'Administração', 'Cozinheiro': 'Cozinha', 'Garçon': 'Salão', 'Limpeza': 'Serviços Gerais' };
                deptNome = map[cargoNome] || 'Outros';
            }
            
            const deptInput = document.getElementById('input-dept');
            if(deptInput) deptInput.value = deptNome;
        };

        // Gera opções de cargo (Do banco ou Padrão)
        const optionsCargos = cargosList.length > 0
            ? cargosList.map(c => `<option ${f.Cargo===c.Nome?'selected':''}>${c.Nome}</option>`).join('')
            : ['Gerente Geral','Gestor','Supervisor','Cozinheiro Chefe','Cozinheiro','Auxiliar de Cozinha','Garçon','Recepcionista','Auxiliar administrativo','Limpeza','Auxiliar de limpeza','Segurança'].map(c => `<option ${f.Cargo===c?'selected':''}>${c}</option>`).join('');

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
                        ${optionsCargos}
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
                        ${tiposContrato.length 
                            ? tiposContrato.map(t => `<option ${f.TipoContrato===t.Valor?'selected':''}>${t.Valor}</option>`).join('')
                            : '<option>CLT</option><option>Temporário</option><option>Estagiário</option>'}
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
        const canDelete = Utils.checkPermission('RH', 'excluir');
        
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
                            <td class="p-3 text-center">${canDelete ? `<button onclick="RHModule.delete('Frequencia', '${r.ID}')" class="text-red-500"><i class="fas fa-trash"></i></button>` : ''}</td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
        `;
    },

    modalFrequencia: () => {
        const funcs = RHModule.state.cache.funcionarios;
        const today = new Date().toISOString().split('T')[0];
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
                <div class="mb-4"><label class="text-xs">Data</label><input type="date" name="Data" value="${today}" class="border p-2 rounded w-full" required></div>
                <div class="grid grid-cols-2 gap-4 mb-4">
                    <div>
                        <label class="text-xs">Entrada</label>
                        <div class="flex gap-1"><input type="time" name="Entrada" class="border p-2 rounded w-full" required><button type="button" onclick="RHModule.setCurrentTime('Entrada')" class="bg-gray-200 px-2 rounded hover:bg-gray-300" title="Agora"><i class="fas fa-clock"></i></button></div>
                    </div>
                    <div>
                        <label class="text-xs">Saída</label>
                        <div class="flex gap-1"><input type="time" name="Saida" class="border p-2 rounded w-full" required><button type="button" onclick="RHModule.setCurrentTime('Saida')" class="bg-gray-200 px-2 rounded hover:bg-gray-300" title="Agora"><i class="fas fa-clock"></i></button></div>
                    </div>
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

    setCurrentTime: (field) => {
        const now = new Date();
        const time = now.toTimeString().slice(0, 5);
        const input = document.querySelector(`input[name="${field}"]`);
        if(input) input.value = time;
    },

    // --- 3. ABA FÉRIAS ---
    renderFerias: () => {
        RHModule.highlightTab('tab-ferias');
        const data = RHModule.state.cache.ferias || [];
        const canDelete = Utils.checkPermission('RH', 'excluir');
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
                            <td class="p-3 text-center flex justify-center gap-2">
                                <button onclick="RHModule.printGuiaFerias('${r.ID}')" class="text-gray-600 hover:text-gray-900" title="Imprimir Guia"><i class="fas fa-print"></i></button>
                                ${r.ComprovativoURL ? `<button onclick="RHModule.viewComprovativo('${r.ID}')" class="text-green-600 hover:text-green-800" title="Ver Comprovativo"><i class="fas fa-receipt"></i></button>` : ''}
                                ${canDelete ? `<button onclick="RHModule.delete('Ferias', '${r.ID}')" class="text-red-500 hover:text-red-700"><i class="fas fa-trash"></i></button>` : ''}
                            </td>
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
                <div class="mb-3">
                    <label class="text-xs font-bold block">COMPROVATIVO DE PAGAMENTO (ANEXO)</label>
                    <input type="file" id="file-comprovativo" class="border p-2 rounded w-full text-xs bg-gray-50">
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

    printGuiaFerias: (id) => {
        const ferias = RHModule.state.cache.ferias.find(f => f.ID === id);
        if (!ferias) return Utils.toast('Registro não encontrado.', 'error');

        const func = RHModule.state.cache.funcionarios.find(f => f.ID === ferias.FuncionarioID) || {};
        const inst = RHModule.state.cache.instituicao[0] || {};

        // Cálculos Auxiliares
        // 1. Data de Retorno (Dia seguinte ao fim)
        const dataFim = new Date(ferias.DataFim);
        const dataRetorno = new Date(dataFim);
        dataRetorno.setDate(dataRetorno.getDate() + 1);

        // 2. Saldo de Férias (Estimativa simples: 30 - dias gozados no ano atual)
        const anoAtual = new Date().getFullYear();
        const feriasAno = RHModule.state.cache.ferias.filter(f => 
            f.FuncionarioID === ferias.FuncionarioID && 
            f.Status === 'Aprovado' && 
            new Date(f.DataInicio).getFullYear() === anoAtual
        );
        const diasGozados = feriasAno.reduce((acc, cur) => acc + Number(cur.Dias), 0);
        const saldoRestante = 30 - diasGozados; // Assumindo direito a 30 dias/ano

        // Elemento temporário para impressão
        const printDiv = document.createElement('div');
        printDiv.className = 'bg-white p-8 hidden';
        printDiv.id = 'guia-ferias-print';
        
        printDiv.innerHTML = `
            <div class="border-2 border-gray-800 p-8 max-w-3xl mx-auto font-serif text-gray-900">
                <!-- Cabeçalho -->
                <div class="flex items-center justify-between border-b-2 border-gray-800 pb-4 mb-6">
                    <div class="flex items-center gap-4">
                        ${inst.LogotipoURL ? `<img src="${inst.LogotipoURL}" class="h-16 w-auto object-contain">` : ''}
                        <div>
                            <h1 class="text-2xl font-bold uppercase">${inst.NomeFantasia || 'Delícia da Cidade'}</h1>
                            <p class="text-sm">${inst.Endereco || ''}</p>
                        </div>
                    </div>
                    <div class="text-right">
                        <h2 class="text-xl font-bold">GUIA DE FÉRIAS</h2>
                        <p class="text-sm">Ref: ${new Date().getFullYear()}/${ferias.ID.slice(0,4)}</p>
                    </div>
                </div>

                <!-- Dados do Colaborador -->
                <div class="mb-6 bg-gray-50 p-4 rounded border border-gray-200">
                    <h3 class="font-bold border-b border-gray-300 mb-2 uppercase text-sm">Dados do Colaborador</h3>
                    <div class="grid grid-cols-2 gap-4">
                        <div><span class="font-bold text-sm">Nome:</span> <span class="text-lg block">${func.Nome || ferias.FuncionarioNome}</span></div>
                        <div><span class="font-bold text-sm">Cargo/Função:</span> <span class="text-lg block">${func.Cargo || '-'}</span></div>
                        <div><span class="font-bold text-sm">Departamento:</span> <span class="block">${func.Departamento || '-'}</span></div>
                        <div><span class="font-bold text-sm">Nº Funcionário:</span> <span class="block">${func.ID.slice(0,8)}</span></div>
                    </div>
                </div>

                <!-- Detalhes das Férias -->
                <div class="mb-8">
                    <h3 class="font-bold border-b border-gray-800 mb-4 uppercase text-sm">Detalhamento do Período</h3>
                    <table class="w-full text-left border-collapse border border-gray-300">
                        <tr class="bg-gray-100"><th class="border p-2">Início das Férias</th><th class="border p-2">Término das Férias</th><th class="border p-2">Dias de Gozo</th></tr>
                        <tr>
                            <td class="border p-3 text-lg">${Utils.formatDate(ferias.DataInicio)}</td>
                            <td class="border p-3 text-lg">${Utils.formatDate(ferias.DataFim)}</td>
                            <td class="border p-3 text-lg font-bold text-center">${ferias.Dias}</td>
                        </tr>
                    </table>
                    <div class="mt-4 grid grid-cols-2 gap-4">
                        <div class="p-3 border bg-blue-50"><span class="font-bold">Data de Retorno ao Trabalho:</span> <br> ${dataRetorno.toLocaleDateString('pt-BR')}</div>
                        <div class="p-3 border bg-gray-50"><span class="font-bold">Saldo Restante (Estimado):</span> <br> ${saldoRestante > 0 ? saldoRestante : 0} dias</div>
                    </div>
                </div>

                <!-- Assinaturas -->
                <div class="mt-16 grid grid-cols-2 gap-16 text-center">
                    <div class="border-t border-gray-800 pt-2">
                        <p class="font-bold">${func.Nome}</p>
                        <p class="text-xs">Assinatura do Colaborador</p>
                    </div>
                    <div class="border-t border-gray-800 pt-2">
                        <p class="font-bold">Recursos Humanos / Gestão</p>
                        <p class="text-xs">Autorizado por</p>
                    </div>
                </div>
                <div class="mt-8 text-center text-xs text-gray-400">Documento gerado eletronicamente em ${new Date().toLocaleString()}</div>
            </div>
        `;

        document.body.appendChild(printDiv);
        
        const opt = {
            margin: 10,
            filename: `guia-ferias-${func.Nome.split(' ')[0]}-${ferias.DataInicio}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        html2pdf().set(opt).from(printDiv).save().then(() => {
            document.body.removeChild(printDiv);
        });
    },

    viewComprovativo: (id) => {
        const r = RHModule.state.cache.ferias.find(x => x.ID === id);
        if(r && r.ComprovativoURL) {
            Utils.openModal('Comprovativo de Pagamento', `
                <div class="text-center">
                    <img src="${r.ComprovativoURL}" class="max-w-full max-h-[70vh] mx-auto border rounded shadow">
                    <a href="${r.ComprovativoURL}" download="comprovativo-${r.FuncionarioNome}.png" class="inline-block mt-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Baixar Imagem</a>
                </div>
            `);
        }
    },

    // --- 4. ABA AVALIAÇÃO ---
    renderAvaliacoes: () => {
        RHModule.highlightTab('tab-avaliacoes');
        const data = RHModule.state.cache.avaliacoes || [];
        const canDelete = Utils.checkPermission('RH', 'excluir');
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
                            <td class="p-3 text-center">${canDelete ? `<button onclick="RHModule.delete('Avaliacoes', '${r.ID}')" class="text-red-500"><i class="fas fa-trash"></i></button>` : ''}</td>
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
        const canDelete = Utils.checkPermission('RH', 'excluir');
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
                            <td class="p-3 text-center">${canDelete ? `<button onclick="RHModule.delete('Treinamentos', '${r.ID}')" class="text-red-500"><i class="fas fa-trash"></i></button>` : ''}</td>
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
        const canDelete = Utils.checkPermission('RH', 'excluir');
        
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
                            <td class="p-3 text-center">${canDelete ? `<button onclick="RHModule.delete('Folha', '${r.ID}')" class="text-red-500"><i class="fas fa-trash"></i></button>` : ''}</td>
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
        const canDelete = Utils.checkPermission('RH', 'excluir');
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
                            <td class="p-3 text-center">${canDelete ? `<button onclick="RHModule.delete('Licencas', '${r.ID}')" class="text-red-500"><i class="fas fa-trash"></i></button>` : ''}</td>
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

    // --- 8. ABA RELATÓRIOS ---
    renderRelatorios: () => {
        RHModule.highlightTab('tab-relatorios');
        
        document.getElementById('tab-content').innerHTML = `
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-xl font-bold">Relatórios de RH</h3>
                <button onclick="RHModule.exportPDF()" class="bg-red-600 text-white px-4 py-2 rounded shadow hover:bg-red-700 transition">
                    <i class="fas fa-file-pdf mr-2"></i> Exportar PDF
                </button>
            </div>
            
            <div class="bg-white p-4 rounded shadow mb-6">
                <h4 class="font-bold text-gray-700 mb-2">Filtros (Período de Admissão)</h4>
                <div class="flex gap-4 items-end">
                    <div><label class="block text-xs font-bold text-gray-500">De</label><input type="date" id="rel-inicio" class="border p-2 rounded"></div>
                    <div><label class="block text-xs font-bold text-gray-500">Até</label><input type="date" id="rel-fim" class="border p-2 rounded"></div>
                    <button onclick="RHModule.updateRelatorios()" class="bg-blue-600 text-white px-4 py-2 rounded"><i class="fas fa-filter"></i> Filtrar</button>
                    <button onclick="document.getElementById('rel-inicio').value='';document.getElementById('rel-fim').value='';RHModule.updateRelatorios()" class="text-gray-500 px-4 py-2 hover:text-gray-700">Limpar</button>
                </div>
            </div>

            <div id="print-area" class="p-4 bg-white rounded">
                <div id="pdf-header" class="hidden mb-6 border-b pb-4"></div>
                <div id="relatorio-results"></div>
                <div id="pdf-footer" class="hidden mt-10 pt-4 border-t text-center"></div>
            </div>
        `;
        
        RHModule.updateRelatorios();
    },

    updateRelatorios: () => {
        const start = document.getElementById('rel-inicio').value;
        const end = document.getElementById('rel-fim').value;
        let funcs = RHModule.state.cache.funcionarios || [];
        const ferias = RHModule.state.cache.ferias || [];
        const frequencia = RHModule.state.cache.frequencia || [];

        // --- RELATÓRIO DE FÉRIAS VENCIDAS ---
        const vencidas = [];
        const hoje = new Date();
        
        funcs.forEach(f => {
            if(!f.Admissao) return;
            const adm = new Date(f.Admissao);
            // Cálculo aproximado de anos de casa
            const diffTime = Math.abs(hoje - adm);
            const diffYears = diffTime / (1000 * 60 * 60 * 24 * 365.25); 
            const direito = Math.floor(diffYears) * 30; // 30 dias por ano
            
            const taken = ferias
                .filter(r => r.FuncionarioID === f.ID && r.Status === 'Aprovado')
                .reduce((acc, r) => acc + (Number(r.Dias) || 0), 0);
                
            const saldo = direito - taken;
            
            if(saldo > 30) vencidas.push({ nome: f.Nome, saldo: Math.floor(saldo), dept: f.Departamento });
        });

        // --- RELATÓRIO DE PONTUALIDADE (ATRASOS) ---
        const atrasosMap = {};
        const evolutionMap = {}; // Para o gráfico de linha

        frequencia.forEach(r => {
            if (start && r.Data < start) return;
            if (end && r.Data > end) return;
            
            // Regra: Entrada após 08:15 é considerada atraso (Tolerância de 15min)
            if (r.Entrada && r.Entrada > '08:15') {
                atrasosMap[r.FuncionarioNome] = (atrasosMap[r.FuncionarioNome] || 0) + 1;
                
                const month = r.Data.substring(0, 7); // YYYY-MM
                evolutionMap[month] = (evolutionMap[month] || 0) + 1;
            }
        });

        const rankingAtrasos = Object.entries(atrasosMap)
            .map(([nome, qtd]) => ({ nome, qtd }))
            .sort((a, b) => b.qtd - a.qtd)
            .slice(0, 5); // Top 5
            
        const sortedMonths = Object.keys(evolutionMap).sort();
        const evoLabels = sortedMonths.map(m => {
            const [y, mo] = m.split('-');
            return `${mo}/${y}`;
        });
        const evoData = sortedMonths.map(m => evolutionMap[m]);

        // Filtragem por Data de Admissão
        if (start) funcs = funcs.filter(f => f.Admissao >= start);
        if (end) funcs = funcs.filter(f => f.Admissao <= end);

        // Agrupar por Departamento
        const deptMap = {};
        const salaryMap = {};

        funcs.forEach(f => {
            const dept = f.Departamento || 'Sem Departamento';
            deptMap[dept] = (deptMap[dept] || 0) + 1;
            
            if(!salaryMap[dept]) salaryMap[dept] = { total: 0, count: 0 };
            salaryMap[dept].total += Number(f.Salario || 0);
            salaryMap[dept].count++;
        });

        const reportData = Object.entries(deptMap)
            .map(([dept, count]) => ({ dept, count }))
            .sort((a, b) => b.count - a.count);

        const salaryData = Object.entries(salaryMap).map(([dept, val]) => ({
            dept,
            avg: val.count ? val.total / val.count : 0
        })).sort((a,b) => b.avg - a.avg);

        const total = funcs.length;

        const htmlVencidas = `
            <div class="mt-8 mb-8">
                <h4 class="text-lg font-bold text-red-700 mb-4 border-b border-red-200 pb-2">⚠️ Funcionários com Férias Vencidas (>30 dias)</h4>
                <div class="bg-white p-4 border rounded shadow overflow-x-auto">
                    <table class="w-full text-sm">
                        <thead class="bg-red-50 text-red-800">
                            <tr><th class="p-2 text-left">Funcionário</th><th class="p-2 text-left">Departamento</th><th class="p-2 text-right">Saldo (Dias)</th></tr>
                        </thead>
                        <tbody>
                            ${vencidas.map(v => `<tr class="border-b"><td class="p-2 font-bold">${v.nome}</td><td class="p-2">${v.dept || '-'}</td><td class="p-2 text-right font-bold text-red-600">${v.saldo}</td></tr>`).join('')}
                            ${vencidas.length === 0 ? '<tr><td colspan="3" class="p-4 text-center text-gray-500">Nenhuma pendência encontrada.</td></tr>' : ''}
                        </tbody>
                    </table>
                </div>
            </div>`;
            
        const htmlAtrasos = `
            <div class="mt-6 bg-white p-4 border rounded shadow">
                <h4 class="font-bold text-gray-700 mb-4 border-b pb-2">🕒 Ranking de Atrasos (Entrada após 08:15)</h4>
                <table class="w-full text-sm">
                    <thead class="bg-orange-50 text-orange-800">
                        <tr><th class="p-2 text-left">Funcionário</th><th class="p-2 text-right">Qtd. Atrasos</th></tr>
                    </thead>
                    <tbody>
                        ${rankingAtrasos.map(r => `<tr class="border-b"><td class="p-2 font-medium">${r.nome}</td><td class="p-2 text-right font-bold text-orange-600">${r.qtd}</td></tr>`).join('')}
                        ${rankingAtrasos.length === 0 ? '<tr><td colspan="2" class="p-4 text-center text-gray-500">Nenhum atraso registrado no período.</td></tr>' : ''}
                    </tbody>
                </table>
            </div>`;

        const html = `
            <h4 class="text-lg font-bold text-gray-700 mb-4">Lotação por Departamento ${start || end ? '(Filtrado)' : '(Geral)'}</h4>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="bg-white p-4 border rounded">
                    <table class="w-full text-sm">
                        <thead class="bg-gray-100">
                            <tr><th class="p-2 text-left">Departamento</th><th class="p-2 text-right">Funcionários</th><th class="p-2 text-right">%</th></tr>
                        </thead>
                        <tbody>
                            ${reportData.map(r => {
                                const pct = total > 0 ? ((r.count / total) * 100).toFixed(1) : 0;
                                return `<tr class="border-b"><td class="p-2 font-medium">${r.dept}</td><td class="p-2 text-right font-bold">${r.count}</td><td class="p-2 text-right text-gray-500">${pct}%</td></tr>`;
                            }).join('')}
                            <tr class="bg-gray-50 font-bold"><td class="p-2">TOTAL</td><td class="p-2 text-right">${total}</td><td class="p-2 text-right">100%</td></tr>
                        </tbody>
                    </table>
                </div>
                <div class="bg-white p-4 border rounded flex flex-col items-center justify-center">
                     <div class="w-full h-64"><canvas id="chartRelatorioRH"></canvas></div>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                <div class="bg-white p-4 border rounded shadow">
                    <h4 class="font-bold text-gray-700 mb-4">Média Salarial por Departamento (Kz)</h4>
                    <div class="h-64"><canvas id="chartSalarios"></canvas></div>
                </div>
                <div class="bg-white p-4 border rounded shadow">
                    <h4 class="font-bold text-gray-700 mb-4">Evolução de Atrasos</h4>
                    <div class="h-64"><canvas id="chartEvolucaoAtrasos"></canvas></div>
                </div>
            </div>
        ` + htmlVencidas + htmlAtrasos;

        document.getElementById('relatorio-results').innerHTML = html;

        if(typeof Chart !== 'undefined' && reportData.length > 0) {
            new Chart(document.getElementById('chartRelatorioRH'), {
                type: 'doughnut',
                data: { labels: reportData.map(r => r.dept), datasets: [{ data: reportData.map(r => r.count), backgroundColor: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#6B7280', '#EC4899', '#14B8A6'] }] },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } }
            });
            
            new Chart(document.getElementById('chartSalarios'), {
                type: 'bar',
                data: { 
                    labels: salaryData.map(d => d.dept), 
                    datasets: [{ 
                        label: 'Média Salarial', 
                        data: salaryData.map(d => d.avg), 
                        backgroundColor: '#10B981',
                        borderRadius: 4
                    }] 
                },
                options: { 
                    responsive: true, 
                    maintainAspectRatio: false, 
                    plugins: { legend: { display: false } },
                    scales: { y: { beginAtZero: true, ticks: { callback: (v) => Utils.formatCurrency(v) } } }
                }
            });

            new Chart(document.getElementById('chartEvolucaoAtrasos'), {
                type: 'line',
                data: {
                    labels: evoLabels,
                    datasets: [{
                        label: 'Atrasos',
                        data: evoData,
                        borderColor: '#F97316',
                        backgroundColor: 'rgba(249, 115, 22, 0.1)',
                        fill: true,
                        tension: 0.3
                    }]
                },
                options: { 
                    responsive: true, 
                    maintainAspectRatio: false,
                    scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
                }
            });
        } else if (total === 0) {
            document.getElementById('relatorio-results').innerHTML = '<p class="text-center text-gray-500 py-10">Nenhum funcionário encontrado neste período.</p>';
        }
    },

    exportPDF: () => {
        const element = document.getElementById('print-area');
        const header = document.getElementById('pdf-header');
        const footer = document.getElementById('pdf-footer');
        const inst = RHModule.state.cache.instituicao[0] || {};
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        
        // Monta o cabeçalho com Logotipo e Dados da Empresa
        header.innerHTML = `
            <div class="flex items-center gap-4">
                ${inst.LogotipoURL ? `<img src="${inst.LogotipoURL}" class="h-16 w-auto object-contain">` : ''}
                <div>
                    <h1 class="text-2xl font-bold text-gray-800">${inst.NomeFantasia || 'Delícia da Cidade'}</h1>
                    <p class="text-sm text-gray-500">${inst.Endereco || ''} | ${inst.Telefone || ''}</p>
                </div>
            </div>
        `;
        header.classList.remove('hidden'); // Torna visível para a captura

        // Monta o rodapé com a Assinatura Digital
        footer.innerHTML = `
            <p class="font-bold text-gray-800">${user.Nome}</p>
            <p class="text-sm text-gray-600">${user.Assinatura || ''}</p>
            <p class="text-xs text-gray-400 mt-1">Documento gerado em ${new Date().toLocaleString()}</p>
        `;
        footer.classList.remove('hidden');
        
        const opt = {
            margin: 10,
            filename: 'relatorio-rh-departamentos.pdf',
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
        };
        
        html2pdf().set(opt).from(element).save().then(() => {
            header.classList.add('hidden'); // Esconde novamente após gerar
            footer.classList.add('hidden');
        });
    },

    // --- GENÉRICOS ---
    save: async (e, table) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target).entries());

        // Lógica de Upload de Arquivo (Férias)
        if (table === 'Ferias') {
            const fileInput = document.getElementById('file-comprovativo');
            if (fileInput && fileInput.files[0]) {
                try {
                    const toBase64 = file => new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.readAsDataURL(file);
                        reader.onload = () => resolve(reader.result);
                        reader.onerror = error => reject(error);
                    });
                    data.ComprovativoURL = await toBase64(fileInput.files[0]);
                } catch (err) {
                    return Utils.toast('Erro ao processar arquivo: ' + err.message);
                }
            }
        }

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