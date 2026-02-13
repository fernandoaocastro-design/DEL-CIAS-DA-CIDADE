const RHModule = {
    state: {
        cache: { allFuncionarios: [], funcionarios: [], ferias: [], frequencia: null, avaliacoes: null, treinamentos: null, licencas: null, folha: null, escala: null, parametros: [], cargos: [], departamentos: [], instituicao: [] },
 filterTerm: '',
        filterVencidas: false,
        filterFrequenciaStart: '',
        filterFrequenciaEnd: '',
        pagination: {
            currentPage: 1,
            rowsPerPage: 15
        }
    },

    init: () => {
        RHModule.renderLayout();
        RHModule.fetchData();
    },

    fetchData: async () => {
        try {
            // Carregamento Otimizado: Apenas dados essenciais para a aba inicial
            const [funcs, ferias, params, cargos, deptos, inst] = await Promise.all([
                Utils.api('getAll', 'Funcionarios'),
                Utils.api('getAll', 'Ferias'),
                Utils.api('getAll', 'ParametrosRH'),
                Utils.api('getAll', 'Cargos'),
                Utils.api('getAll', 'Departamentos'),
                Utils.api('getAll', 'InstituicaoConfig')
            ]);
            
            RHModule.state.cache = {
                allFuncionarios: funcs || [],
                funcionarios: funcs || [],
                ferias: ferias || [],
                parametros: params || [],
                cargos: cargos || [],
                departamentos: deptos || [],
                instituicao: inst || [],
                // Dados sob demanda (Lazy Loading) - Inicializam como null
                frequencia: null, avaliacoes: null, treinamentos: null, licencas: null, folha: null, escala: null
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
        // Menu de Abas - Estilo Enterprise Minimalista (Underline)
        document.getElementById('rh-content').innerHTML = `
            <div class="border-b border-gray-200 mb-8">
                <nav class="-mb-px flex space-x-8 overflow-x-auto" aria-label="Tabs">
                    <button id="tab-funcionarios" onclick="RHModule.renderFuncionarios()" class="tab-btn whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200">Equipe</button>
                    <button id="tab-frequencia" onclick="RHModule.renderFrequencia()" class="tab-btn whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200">Frequência</button>
                    <button id="tab-ferias" onclick="RHModule.renderFerias()" class="tab-btn whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200">Férias</button>
                    <button id="tab-avaliacoes" onclick="RHModule.renderAvaliacoes()" class="tab-btn whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200">Avaliação</button>
                    <button id="tab-treinamento" onclick="RHModule.renderTreinamento()" class="tab-btn whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200">Treinamento</button>
                    <button id="tab-folha" onclick="RHModule.renderFolha()" class="tab-btn whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200">Folha</button>
                    <button id="tab-licencas" onclick="RHModule.renderLicencas()" class="tab-btn whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200">Licenças</button>
                    <button id="tab-relatorios" onclick="RHModule.renderRelatorios()" class="tab-btn whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200">Relatórios</button>
                </nav>
            </div>
            <div id="tab-content"></div>
        `;
    },

    highlightTab: (id) => {
        document.querySelectorAll('.tab-btn').forEach(b => {
            b.classList.remove('border-orange-500', 'text-orange-600');
            b.classList.add('border-transparent', 'text-gray-500', 'hover:text-gray-700', 'hover:border-gray-300');
        });
        const btn = document.getElementById(id);
        if(btn) {
            btn.classList.remove('border-transparent', 'text-gray-500', 'hover:text-gray-700', 'hover:border-gray-300');
            btn.classList.add('border-orange-500', 'text-orange-600');
        }
    },

    // --- 1. ABA FUNCIONÁRIOS ---
    renderFuncionarios: () => {
        RHModule.highlightTab('tab-funcionarios');
        let filteredData = RHModule.state.cache.funcionarios || [];
        
        // Ordenação Alfabética
        filteredData.sort((a, b) => a.Nome.localeCompare(b.Nome));

        const ferias = RHModule.state.cache.ferias || [];
        const canCreate = Utils.checkPermission('RH', 'criar');
        const canEdit = Utils.checkPermission('RH', 'editar');
        const canDelete = Utils.checkPermission('RH', 'excluir');

        // Filtro de Busca (Agora realizado no Backend via updateFilter)
        // A variável filteredData já contém os resultados da busca vindos do cache

        // Filtro de Férias Vencidas
        if (RHModule.state.filterVencidas) {
            const hoje = new Date();
            filteredData = filteredData.filter(f => {
                if (!f.Admissao) return false;
                const adm = new Date(f.Admissao);
                const diffTime = Math.abs(hoje - adm);
                const diffYears = diffTime / (1000 * 60 * 60 * 24 * 365.25);
                const direito = Math.floor(diffYears) * 22; // Base: 22 dias úteis
                
                const taken = ferias
                    .filter(r => r.FuncionarioID === f.ID && r.Status === 'Aprovado')
                    .reduce((acc, r) => acc + (Number(r.Dias) || 0), 0);
                
                return (direito - taken) > 22;
            });
        }

        // Lógica de Paginação
        const { currentPage, rowsPerPage } = RHModule.state.pagination;
        const totalRows = filteredData.length;
        const totalPages = Math.ceil(totalRows / rowsPerPage) || 1;
        const startIndex = (currentPage - 1) * rowsPerPage;
        const endIndex = startIndex + rowsPerPage;
        const paginatedData = filteredData.slice(startIndex, endIndex);

        // Gera o HTML da tabela separadamente
        const tableHTML = `
            <div class="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden" id="rh-table-container">
                <div class="overflow-x-auto">
                    <table class="w-full text-left border-collapse" data-total-rows="${totalRows}">
                        <thead class="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th scope="col" class="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">ID</th>
                                <th scope="col" class="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Colaborador</th>
                                <th scope="col" class="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Cargo / Depto</th>
                                <th scope="col" class="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Salário Base</th>
                                <th scope="col" class="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Contato</th>
                                <th scope="col" class="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status Férias</th>
                                <th scope="col" class="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-200 bg-white">
                        ${paginatedData.map(f => {
                            // Cálculo de Saldo de Férias
                            let saldo = '-';
                            let badgeClass = 'bg-gray-100 text-gray-600';
                            let statusText = 'Regular';
                            
                            if (f.Admissao) {
                                const adm = new Date(f.Admissao);
                                const hoje = new Date();
                                const diffTime = Math.abs(hoje - adm);
                                const diffYears = diffTime / (1000 * 60 * 60 * 24 * 365.25); 
                                const direito = Math.floor(diffYears) * 22; // Base: 22 dias úteis
                                
                                const taken = ferias
                                    .filter(r => r.FuncionarioID === f.ID && r.Status === 'Aprovado')
                                    .reduce((acc, r) => acc + (Number(r.Dias) || 0), 0);
                                    
                                const valSaldo = direito - taken;
                                
                                // Se houver saldo manual cadastrado, usa ele. Senão, usa o calculado.
                                if (f.SaldoFerias !== null && f.SaldoFerias !== undefined && f.SaldoFerias !== '') {
                                    saldo = f.SaldoFerias;
                                } else {
                                    saldo = valSaldo;
                                }
                                
                                if (valSaldo > 22) {
                                    badgeClass = 'bg-red-100 text-red-700';
                                    statusText = 'Vencidas';
                                } else if (valSaldo > 0) {
                                    badgeClass = 'bg-green-100 text-green-700';
                                    statusText = 'Disponível';
                                }
                            }

                            return `
                            <tr class="group hover:bg-gray-50 transition-colors duration-150">
                                <td class="px-6 py-4 whitespace-nowrap">
                                    <span class="font-mono text-xs text-gray-400">...${f.ID.slice(-4)}</span>
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap">
                                    <div class="flex items-center">
                                        <div class="h-9 w-9 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-xs font-bold overflow-hidden border border-gray-300">
                                            ${f.FotoURL ? `<img src="${f.FotoURL}" class="h-full w-full object-cover">` : f.Nome.charAt(0)}
 
                                        </div>
                                        <div class="ml-4">
                                            <div class="text-sm font-medium text-gray-900">${f.Nome}</div>
                                            <div class="text-xs text-gray-500">Admissão: ${Utils.formatDate(f.Admissao)}</div>
                                        </div>
                                    </div>
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap">
                                    <div class="text-sm text-gray-900">${f.Cargo}</div>
                                    <div class="text-xs text-gray-500">${f.Departamento || 'Geral'}</div>
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-700">
                                    ${Utils.formatCurrency(f.Salario)}
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    <div>${f.Telefone || '-'}</div>
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap">
                                    <span class="px-2.5 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${badgeClass}">
                                        ${saldo} dias (${statusText})
                                    </span>
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <div class="flex justify-end gap-3 opacity-60 group-hover:opacity-100 transition-opacity">
                                        <button onclick="RHModule.printFuncionarioProfile('${f.ID}')" class="text-gray-400 hover:text-gray-600 transition-colors" title="Perfil">
                                            <i class="fas fa-id-card"></i>
                                        </button>
                                        <button onclick="RHModule.modalEscala('${f.ID}')" class="text-gray-400 hover:text-purple-600 transition-colors" title="Escala">
                                            <i class="fas fa-calendar-alt"></i>
                                        </button>
                                        ${canEdit ? `<button onclick="RHModule.modalFuncionario('${f.ID}')" class="text-gray-400 hover:text-blue-600 transition-colors" title="Editar">
                                            <i class="fas fa-pen"></i>
                                        </button>` : ''}
                                        ${canDelete ? `<button onclick="RHModule.delete('Funcionarios', '${f.ID}')" class="text-gray-400 hover:text-red-600 transition-colors" title="Excluir">
                                            <i class="fas fa-trash"></i>
                                        </button>` : ''}
                                    </div>
                                </td>
                            </tr>
                        `}).join('')}
                    </tbody>
                </table>
                </div>
                
                <!-- Footer da Tabela / Paginação -->
                <div class="bg-gray-50 px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                    <span class="text-sm text-gray-500">
                        Mostrando <span class="font-medium">${Math.min(startIndex + 1, totalRows)}</span> a <span class="font-medium">${Math.min(endIndex, totalRows)}</span> de <span class="font-medium">${totalRows}</span> resultados
                    </span>
                    <div class="flex gap-1">
                        <button onclick="RHModule.changePage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''} class="px-3 py-1 border border-gray-300 rounded-md bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                            Anterior
                        </button>
                        <button onclick="RHModule.changePage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''} class="px-3 py-1 border border-gray-300 rounded-md bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                            Próxima
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Verifica se a tabela já existe para atualizar apenas ela (preservando o foco do input)
        const existingTable = document.getElementById('rh-table-container');
        if (existingTable) {
            existingTable.outerHTML = tableHTML;
        } else {
            // Se não existe, renderiza tudo (Header + Tabela)
            document.getElementById('tab-content').innerHTML = `
            <!-- Header da Seção -->
            <div class="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                <div>
                    <h3 class="text-2xl font-bold text-gray-900 tracking-tight">Gestão de Equipe</h3>
                    <p class="text-sm text-gray-500 mt-1">Gerencie colaboradores, cargos e departamentos.</p>
                </div>
                
                <div class="flex flex-wrap items-center gap-3">
                    <!-- Busca Moderna -->
                    <div class="relative group">
                        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <i class="fas fa-search text-gray-400 group-focus-within:text-orange-500 transition-colors"></i>
                        </div>
                        <input type="text" 
                            class="bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent block w-64 pl-10 p-2.5 transition-all" 
                            placeholder="Buscar colaborador..." 
                            value="${RHModule.state.filterTerm}" 
                            oninput="RHModule.updateFilter(this.value)">
                    </div>

                    <!-- Filtro Toggle -->
                    <label class="flex items-center gap-2 text-sm cursor-pointer bg-white px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors select-none">
                        <input type="checkbox" class="rounded text-orange-600 focus:ring-orange-500 border-gray-300" ${RHModule.state.filterVencidas ? 'checked' : ''} onchange="RHModule.toggleVencidas(this.checked)">
                        <span class="text-gray-600 font-medium">Férias Vencidas</span>
                    </label>

                    <!-- Botões Secundários -->
                    <div class="flex items-center border-l border-gray-300 pl-3 gap-2">
                        <button onclick="RHModule.printTabPDF('funcionarios')" class="text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 hover:text-gray-800 font-medium rounded-lg text-sm px-4 py-2.5 text-center inline-flex items-center transition-all">
                            <i class="fas fa-file-export mr-2"></i> Exportar
                        </button>
                        <button onclick="RHModule.printEscalaGeral()" class="text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 hover:text-gray-800 font-medium rounded-lg text-sm px-4 py-2.5 text-center inline-flex items-center transition-all">
                            <i class="fas fa-calendar-alt mr-2"></i> Escala
                        </button>
                    </div>

                    <!-- Botão Primário -->
                    ${canCreate ? `<button onclick="RHModule.modalFuncionario()" class="text-white bg-orange-600 hover:bg-orange-700 focus:ring-4 focus:ring-orange-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center inline-flex items-center shadow-md transition-all transform hover:-translate-y-0.5">
                        <i class="fas fa-plus mr-2"></i> Novo Colaborador
                    </button>` : ''}
                </div>
            </div>
            ${tableHTML}
            `;
        }
    },

    updateFilter: (term) => {
        RHModule.state.filterTerm = term;
        RHModule.state.pagination.currentPage = 1; // Reseta para a primeira página ao filtrar
        
        // Filtro Local (Instantâneo)
        const lower = term.toLowerCase();
        if (!lower) {
            RHModule.state.cache.funcionarios = [...RHModule.state.cache.allFuncionarios];
        } else {
            RHModule.state.cache.funcionarios = RHModule.state.cache.allFuncionarios.filter(f => 
                (f.Nome && f.Nome.toLowerCase().includes(lower)) ||
                (f.Cargo && f.Cargo.toLowerCase().includes(lower)) ||
                (f.Departamento && f.Departamento.toLowerCase().includes(lower)) ||
                (f.Email && f.Email.toLowerCase().includes(lower))
            );
        }
        RHModule.renderFuncionarios();
    },

    toggleVencidas: (checked) => {
        RHModule.state.filterVencidas = checked;
        RHModule.state.pagination.currentPage = 1;
        RHModule.renderFuncionarios();
    },

    changePage: (page) => {
        const totalRows = document.getElementById('tab-content').querySelector('tbody').getAttribute('data-total-rows');
        const totalPages = Math.ceil(totalRows / RHModule.state.pagination.rowsPerPage) || 1;

        if (page < 1 || page > totalPages) return;

        RHModule.state.pagination.currentPage = page;
        RHModule.renderFuncionarios();
    },

    // --- MÁSCARAS DE INPUT ---
    maskPhone: (el) => {
        let v = el.value.replace(/\D/g, ""); // Remove tudo que não é dígito
        if (v.startsWith("244")) v = v.substring(3); // Remove prefixo se já existir para evitar duplicação
        if (v.length > 9) v = v.substring(0, 9); // Limita a 9 dígitos locais
        
        // Formata: 9XX XXX XXX
        if (v.length > 6) v = v.replace(/^(\d{3})(\d{3})(\d{0,3})/, "$1 $2 $3");
        else if (v.length > 3) v = v.replace(/^(\d{3})(\d{0,3})/, "$1 $2");
        
        el.value = "+244 " + v;
    },

    maskCurrency: (el) => {
        let v = el.value.replace(/\D/g, "");
        v = (Number(v) / 100).toFixed(2) + ""; // Divide por 100 para centavos
        v = v.replace(".", ",");
        v = v.replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1."); // Milhares
        el.value = "Kz " + v;
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
                <input type="hidden" name="ID" value="${f.ID || ''}" id="func-id">
                
                <!-- WIZARD STEPPER -->
                <div class="flex items-center justify-between mb-8 px-4">
                    <div class="flex flex-col items-center cursor-pointer" onclick="RHModule.setWizardStep(1)">
                        <div id="step-indicator-1" class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold bg-orange-600 text-white transition-colors">1</div>
                        <span class="text-xs mt-1 font-medium text-gray-700">Pessoal</span>
                    </div>
                    <div class="flex-1 h-1 bg-gray-200 mx-2 rounded"><div id="progress-1" class="h-full bg-orange-600 rounded w-full transition-all duration-500"></div></div>
                    
                    <div class="flex flex-col items-center cursor-pointer" onclick="RHModule.setWizardStep(2)">
                        <div id="step-indicator-2" class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold bg-gray-200 text-gray-500 transition-colors">2</div>
                        <span class="text-xs mt-1 font-medium text-gray-500">Contrato</span>
                    </div>
                    <div class="flex-1 h-1 bg-gray-200 mx-2 rounded"><div id="progress-2" class="h-full bg-orange-600 rounded w-0 transition-all duration-500"></div></div>
                    
                    <div class="flex flex-col items-center cursor-pointer" onclick="RHModule.setWizardStep(3)">
                        <div id="step-indicator-3" class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold bg-gray-200 text-gray-500 transition-colors">3</div>
                        <span class="text-xs mt-1 font-medium text-gray-500">Financeiro</span>
                    </div>
                </div>

                <!-- STEP 1: DADOS PESSOAIS -->
                <div id="step-content-1" class="wizard-step space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Nome Completo</label>
                        <input name="Nome" value="${f.Nome || ''}" class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-orange-500 focus:border-orange-500 block w-full p-2.5" required>
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Data de Nascimento</label>
                            <input type="date" name="Nascimento" value="${f.Nascimento || ''}" class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-orange-500 focus:border-orange-500 block w-full p-2.5">
                        </div>
                        <div class="grid grid-cols-2 gap-2">
                            <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">BI / Identidade</label>
                            <input name="BI" value="${f.BI || ''}" placeholder="000123LA012" class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-orange-500 focus:border-orange-500 block w-full p-2.5">
                            </div>
                            <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Validade BI</label>
                            <input type="date" name="ValidadeBI" value="${f.ValidadeBI || ''}" class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-orange-500 focus:border-orange-500 block w-full p-2.5">
                            </div>
                        </div>
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
                            <input name="Telefone" value="${f.Telefone || '+244 '}" oninput="RHModule.maskPhone(this)" class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-orange-500 focus:border-orange-500 block w-full p-2.5" placeholder="+244 9XX XXX XXX">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
                            <input type="email" name="Email" value="${f.Email || ''}" placeholder="nome@exemplo.com" class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-orange-500 focus:border-orange-500 block w-full p-2.5">
                        </div>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Foto do Perfil</label>
                        <div class="flex gap-2 items-center">
                            <input type="file" id="foto-file" accept="image/*" class="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100">
                            <span class="text-xs text-gray-400">OU</span>
                            <input name="FotoURL" value="${f.FotoURL || ''}" placeholder="Cole uma URL..." class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-orange-500 focus:border-orange-500 block w-1/3 p-2.5">
                        </div>
                    </div>
                </div>

                <!-- STEP 2: CONTRATO & CARGO -->
                <div id="step-content-2" class="wizard-step hidden space-y-4">
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Cargo</label>
                            <select name="Cargo" class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-orange-500 focus:border-orange-500 block w-full p-2.5" onchange="(${updateDept})(this)" required>
                                <option value="">Selecione...</option>
                                ${optionsCargos}
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Departamento</label>
                            <input id="input-dept" name="Departamento" value="${f.Departamento || ''}" class="bg-gray-100 border border-gray-300 text-gray-500 text-sm rounded-lg block w-full p-2.5 cursor-not-allowed" readonly>
                        </div>
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Salário Base (Kz)</label>
                            <input name="Salario" type="text" value="${f.Salario ? Utils.formatCurrency(f.Salario) : ''}" oninput="RHModule.maskCurrency(this)" class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-orange-500 focus:border-orange-500 block w-full p-2.5" required placeholder="Kz 0,00">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Data de Admissão</label>
                            <input type="date" name="Admissao" value="${f.Admissao || ''}" class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-orange-500 focus:border-orange-500 block w-full p-2.5">
                        </div>
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Tipo de Contrato</label>
                            <select name="TipoContrato" class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-orange-500 focus:border-orange-500 block w-full p-2.5">
                                ${tiposContrato.length 
                                    ? tiposContrato.map(t => `<option ${f.TipoContrato===t.Valor?'selected':''}>${t.Valor}</option>`).join('')
                                    : '<option>CLT</option><option>Temporário</option><option>Estagiário</option>'}
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Regime de Turno</label>
                            <select name="Turno" class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-orange-500 focus:border-orange-500 block w-full p-2.5">
                                <option ${f.Turno==='Diarista'?'selected':''}>Diarista</option>
                                <option ${f.Turno==='Regime de Turno'?'selected':''}>Regime de Turno</option>
                            </select>
                        </div>
                    </div>
                </div>

                <!-- STEP 3: FINANCEIRO & STATUS -->
                <div id="step-content-3" class="wizard-step hidden space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">IBAN</label>
                        <input name="Iban" value="${f.Iban || 'AO06 '}" placeholder="AO06..." class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-orange-500 focus:border-orange-500 block w-full p-2.5">
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Status</label>
                            <select name="Status" class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-orange-500 focus:border-orange-500 block w-full p-2.5">
                                <option ${f.Status==='Ativo'?'selected':''}>Ativo</option>
                                <option ${f.Status==='Afastado'?'selected':''}>Afastado</option>
                                <option ${f.Status==='Demitido'?'selected':''}>Demitido</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Saldo Férias (Manual)</label>
                            <input type="number" name="SaldoFerias" value="${f.SaldoFerias || ''}" placeholder="Auto" class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-orange-500 focus:border-orange-500 block w-full p-2.5">
                        </div>
                    </div>
                </div>

                <!-- FOOTER NAVIGATION -->
                <div class="flex justify-between mt-8 pt-4 border-t border-gray-100">
                    <button type="button" id="btn-prev" onclick="RHModule.setWizardStep(currentStep - 1)" class="hidden px-5 py-2.5 text-sm font-medium text-gray-900 bg-white rounded-lg border border-gray-200 hover:bg-gray-100 hover:text-blue-700 focus:z-10 focus:ring-2 focus:ring-blue-700 focus:text-blue-700">
                        <i class="fas fa-arrow-left mr-2"></i> Anterior
                    </button>
                    <div class="flex-1"></div> <!-- Spacer -->
                    <button type="button" id="btn-next" onclick="RHModule.setWizardStep(currentStep + 1)" class="text-white bg-orange-600 hover:bg-orange-700 focus:ring-4 focus:ring-orange-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center">
                        Próximo <i class="fas fa-arrow-right ml-2"></i>
                    </button>
                    <button type="submit" id="btn-save" class="hidden text-white bg-green-600 hover:bg-green-700 focus:ring-4 focus:ring-green-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center">
                        <i class="fas fa-check mr-2"></i> Salvar Colaborador
                    </button>
                </div>
            </form>
            <script>
                var currentStep = 1;
            </script>
        `);
    },

    setWizardStep: (step) => {
        if (step < 1 || step > 3) return;
        
        // --- VALIDAÇÃO ANTES DE AVANÇAR ---
        let currentVisible = 1;
        for(let i=1; i<=3; i++) {
            const el = document.getElementById(`step-content-${i}`);
            if (el && !el.classList.contains('hidden')) {
                currentVisible = i;
                break;
            }
        }

        // Se estiver avançando (step > currentVisible), valida os campos do passo atual
        if (step > currentVisible) {
            const container = document.getElementById(`step-content-${currentVisible}`);
            if (container) {
                const requireds = container.querySelectorAll('[required]');
                let invalid = false;
                requireds.forEach(el => {
                    if (!el.value || el.value.trim() === '') {
                        invalid = true;
                        el.classList.add('border-red-500', 'ring-1', 'ring-red-500');
                        el.addEventListener('input', function() {
                            this.classList.remove('border-red-500', 'ring-1', 'ring-red-500');
                        }, {once: true});
                    }
                });
                if (invalid) return Utils.toast('⚠️ Preencha os campos obrigatórios para continuar.', 'warning');
            }
        }

        // Atualiza variável global do script injetado
        // Nota: Como o script roda no escopo global após injeção, precisamos acessar a variável ou passar o estado.
        // Uma abordagem melhor é controlar o estado visualmente aqui.
        const form = document.querySelector('#modal-body form');
        if(!form) return;
        
        // Esconde todos os passos
        document.querySelectorAll('.wizard-step').forEach(el => el.classList.add('hidden'));
        // Mostra o passo atual
        document.getElementById(`step-content-${step}`).classList.remove('hidden');
        
        // Atualiza Stepper (Bolinhas e Barras)
        for(let i=1; i<=3; i++) {
            const indicator = document.getElementById(`step-indicator-${i}`);
            const progress = document.getElementById(`progress-${i-1}`); // Barra anterior
            
            if (i <= step) {
                indicator.classList.remove('bg-gray-200', 'text-gray-500');
                indicator.classList.add('bg-orange-600', 'text-white');
                if(progress) progress.classList.replace('w-0', 'w-full');
            } else {
                indicator.classList.remove('bg-orange-600', 'text-white');
                indicator.classList.add('bg-gray-200', 'text-gray-500');
                if(progress) progress.classList.replace('w-full', 'w-0');
            }
        }

        // Atualiza Botões
        const btnPrev = document.getElementById('btn-prev');
        const btnNext = document.getElementById('btn-next');
        const btnSave = document.getElementById('btn-save');

        if (step === 1) btnPrev.classList.add('hidden');
        else btnPrev.classList.remove('hidden');

        if (step === 3) {
            btnNext.classList.add('hidden');
            btnSave.classList.remove('hidden');
        } else {
            btnNext.classList.remove('hidden');
            btnSave.classList.add('hidden');
        }
        
        // Atualiza variável de controle para os botões inline onclick
        // Hack: Atualiza a variável global criada dentro do modal
        try { window.currentStep = step; } catch(e){}
    },

    modalEscala: async (id) => {
        const f = RHModule.state.cache.funcionarios.find(x => x.ID === id);
        if(!f) return;

        // Carrega escalas sob demanda se ainda não carregou
        if (!RHModule.state.cache.escala) {
             try {
                RHModule.state.cache.escala = await Utils.api('getAll', 'Escala');
            } catch (e) { RHModule.state.cache.escala = []; }
        }
        
        const userEscala = RHModule.state.cache.escala.filter(e => e.FuncionarioID === id);
        const days = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
        
        let html = `
            <div class="mb-4 text-sm text-gray-600">Defina os dias fixos de trabalho para <b>${f.Nome}</b>.</div>
            <form onsubmit="RHModule.saveEscala(event)">
                <input type="hidden" name="FuncionarioID" value="${id}">
                <div class="grid grid-cols-1 gap-2 bg-gray-50 p-4 rounded border">
        `;
        
        days.forEach((d, index) => {
            const diaNum = index + 1; // 1=Seg
            const config = userEscala.find(e => e.DiaSemana === diaNum);
            // Se não tiver config, assume padrão Diarista (Seg-Sex) para visualização inicial
            const isTrabalho = config ? config.Tipo === 'Trabalho' : (f.Turno === 'Diarista' && diaNum <= 5);
            
            html += `
                <div class="flex justify-between items-center border-b pb-2 last:border-0">
                    <span class="font-bold text-gray-700">${d}</span>
                    <label class="flex items-center cursor-pointer">
                        <div class="relative">
                            <input type="checkbox" name="dia_${diaNum}" class="sr-only" ${isTrabalho ? 'checked' : ''}>
                            <div class="w-10 h-4 bg-gray-300 rounded-full shadow-inner"></div>
                            <div class="dot absolute w-6 h-6 bg-white rounded-full shadow -left-1 -top-1 transition"></div>
                        </div>
                        <div class="ml-3 text-gray-700 text-xs font-bold label-text w-16 text-center">${isTrabalho ? 'Trabalho' : 'Folga'}</div>
                    </label>
                    <input type="hidden" name="id_${diaNum}" value="${config ? config.ID : ''}">
                </div>
            `;
        });
        
        html += `
                </div>
                <button class="w-full bg-purple-600 text-white py-2 rounded mt-4 font-bold">Salvar Escala</button>
            </form>
            <style>
                input:checked ~ .dot { transform: translateX(100%); background-color: #4F46E5; }
                input:checked ~ .bg-gray-300 { background-color: #C7D2FE; }
            </style>
            <script>
                document.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                    cb.addEventListener('change', (e) => {
                        e.target.parentElement.nextElementSibling.innerText = e.target.checked ? 'Trabalho' : 'Folga';
                    });
                });
            </script>
        `;

        Utils.openModal('Configurar Escala', html);
    },

    saveEscala: async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const funcId = formData.get('FuncionarioID');
        const promises = [];

        for(let i=1; i<=7; i++) {
            const isTrabalho = formData.get(`dia_${i}`) === 'on';
            const id = formData.get(`id_${i}`);
            const tipo = isTrabalho ? 'Trabalho' : 'Folga';
            
            const payload = { FuncionarioID: funcId, DiaSemana: i, Tipo: tipo };
            if(id) payload.ID = id;

            promises.push(Utils.api('save', 'Escala', payload));
        }

        try {
            await Promise.all(promises);
            Utils.toast('Escala atualizada com sucesso!');
            Utils.closeModal();
            // Atualiza cache
            RHModule.state.cache.escala = await Utils.api('getAll', 'Escala');
        } catch(err) {
            Utils.toast('Erro ao salvar escala: ' + err.message, 'error');
        }
    },

    printEscalaGeral: async () => {
        // Carrega escalas sob demanda se ainda não carregou
        if (!RHModule.state.cache.escala) {
             try {
                RHModule.state.cache.escala = await Utils.api('getAll', 'Escala');
            } catch (e) { RHModule.state.cache.escala = []; }
        }

        const funcs = RHModule.state.cache.funcionarios.filter(f => f.Status === 'Ativo').sort((a, b) => a.Nome.localeCompare(b.Nome));
        const escala = RHModule.state.cache.escala || [];
        const days = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
        const inst = RHModule.state.cache.instituicao[0] || {};
        const showLogo = inst.ExibirLogoRelatorios;

        // Construção do HTML
        
        let html = `
            <div class="p-8 font-sans text-gray-900 bg-white">
                <div class="flex items-center justify-between border-b-2 border-gray-800 pb-4 mb-6">
                    <div class="${showLogo && inst.LogotipoURL ? 'flex items-center gap-4' : ''}">
                        ${showLogo && inst.LogotipoURL ? `<img src="${inst.LogotipoURL}" class="h-16 w-auto object-contain" crossorigin="anonymous">` : ''}
                        <div>
                            <h1 class="text-2xl font-bold uppercase">${inst.NomeFantasia || 'Delícia da Cidade'}</h1>
                            <p class="text-sm">${inst.Endereco || ''}</p>
                        </div>
                    </div>
                    <div class="text-right">
                        <h2 class="text-xl font-bold">ESCALA DE TRABALHO</h2>
                        <p class="text-sm">Gerado em: ${new Date().toLocaleDateString()}</p>
                    </div>
                </div>

                <table class="w-full text-sm border-collapse border border-gray-300">
                    <thead>
                        <tr class="bg-gray-100">
                            <th class="border p-2 text-left">Funcionário</th>
                            <th class="border p-2 text-left">Cargo</th>
                            ${days.map(d => `<th class="border p-2 text-center w-24">${d}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
        `;

        funcs.forEach(f => {
            html += `<tr><td class="border p-2 font-bold">${f.Nome}</td><td class="border p-2 text-xs text-gray-600">${f.Cargo}</td>`;
            for(let i=1; i<=7; i++) {
                const config = escala.find(e => e.FuncionarioID === f.ID && e.DiaSemana === i);
                // Lógica de visualização: Se tem config usa ela, senão usa padrão do turno
                let type = config ? config.Tipo : (f.Turno === 'Diarista' ? (i <= 5 ? 'Trabalho' : 'Folga') : (f.Turno === 'Regime de Turno' ? 'Turno' : 'Folga'));
                
                let label = type === 'Trabalho' ? '08:00 - 17:00' : (type === 'Turno' ? 'Escala' : 'Folga');
                // Estilos inline para garantir cor no PDF
                let style = type === 'Trabalho' ? 'background-color: #ffffff;' : (type === 'Turno' ? 'background-color: #eff6ff; color: #1e40af; font-weight: bold;' : 'background-color: #f3f4f6; color: #9ca3af;');
                html += `<td class="border p-2 text-center text-xs" style="${style}">${label}</td>`;
            }
            html += `</tr>`;
        });

        html += `</tbody></table><div class="mt-8 text-center text-xs text-gray-400">Documento de uso interno.</div></div>`;
        
        Utils.printNative(html);
    },

    shareEscalaGeral: async () => {
        // Carrega escalas sob demanda se ainda não carregou
        if (!RHModule.state.cache.escala) {
             try {
                RHModule.state.cache.escala = await Utils.api('getAll', 'Escala');
            } catch (e) { RHModule.state.cache.escala = []; }
        }
        
        // Garante que funcionários estejam carregados
        if (!RHModule.state.cache.funcionarios || RHModule.state.cache.funcionarios.length === 0) {
             try {
                RHModule.state.cache.funcionarios = await Utils.api('getAll', 'Funcionarios');
            } catch (e) { RHModule.state.cache.funcionarios = []; }
        }

        const funcs = RHModule.state.cache.funcionarios.filter(f => f.Status === 'Ativo').sort((a, b) => a.Nome.localeCompare(b.Nome));
        const escala = RHModule.state.cache.escala || [];
        const days = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
        
        let msg = `*📅 ESCALA DE TRABALHO SEMANAL*\n_Delícia da Cidade_\n\n`;
        
        days.forEach((d, index) => {
            const diaNum = index + 1;
            msg += `*${d.toUpperCase()}*\n`;
            
            const working = [];
            
            funcs.forEach(f => {
                const config = escala.find(e => e.FuncionarioID === f.ID && e.DiaSemana === diaNum);
                // Lógica de visualização
                let type = config ? config.Tipo : (f.Turno === 'Diarista' ? (diaNum <= 5 ? 'Trabalho' : 'Folga') : (f.Turno === 'Regime de Turno' ? 'Turno' : 'Folga'));
                
                if (type === 'Trabalho' || type === 'Turno') {
                    working.push(f.Nome);
                }
            });
            
            if(working.length > 0) msg += `✅ ${working.join(', ')}\n`;
            else msg += `🚫 Ninguém escalado\n`;
            
            msg += `\n`;
        });
        
        msg += `_Gerado em ${new Date().toLocaleDateString()}_`;
        const encodedMsg = encodeURIComponent(msg);

        Utils.openModal('Compartilhar Escala', `
            <div class="text-center">
                <i class="fab fa-whatsapp text-4xl text-green-500 mb-4"></i>
                <p class="text-gray-600 mb-6">A escala foi convertida para texto. Envie para o grupo da empresa.</p>
                
                <a href="https://wa.me/?text=${encodedMsg}" target="_blank" class="block w-full bg-green-500 text-white py-3 rounded font-bold hover:bg-green-600 flex items-center justify-center gap-2 transition mb-3 shadow">
                    Enviar para WhatsApp
                </a>
                
                <button onclick="navigator.clipboard.writeText(document.getElementById('msg-preview').innerText).then(() => Utils.toast('Texto copiado!'))" class="block w-full bg-gray-100 text-gray-700 py-3 rounded font-bold hover:bg-gray-200 flex items-center justify-center gap-2 transition">
                    <i class="fas fa-copy"></i> Copiar Texto
                </button>
                
                <div class="mt-4 text-left bg-gray-50 p-3 rounded border text-xs max-h-48 overflow-y-auto whitespace-pre-wrap font-mono text-gray-600" id="msg-preview">${msg}</div>
            </div>
        `);
    },

    printFuncionarioProfile: async (id) => {
        const f = RHModule.state.cache.funcionarios.find(x => x.ID === id);
        if (!f) return Utils.toast('Funcionário não encontrado.', 'error');

        // Carrega histórico financeiro se necessário
        if (!RHModule.state.cache.folha) {
             try {
                RHModule.state.cache.folha = await Utils.api('getAll', 'Folha');
            } catch (e) { RHModule.state.cache.folha = []; }
        }
        const historico = (RHModule.state.cache.folha || []).filter(r => r.FuncionarioID === id).sort((a,b) => a.Periodo.localeCompare(b.Periodo)).slice(-12);

        const inst = RHModule.state.cache.instituicao[0] || {};
        const showLogo = inst.ExibirLogoRelatorios;

        let html = `
            <div class="font-sans text-gray-900">
                <!-- Cabeçalho -->
                <div class="flex items-center justify-between border-b-2 border-gray-800 pb-4 mb-6">
                    <div class="${showLogo && inst.LogotipoURL ? 'flex items-center gap-4' : ''}">
                        ${showLogo && inst.LogotipoURL ? `<img src="${inst.LogotipoURL}" class="h-16 w-auto object-contain" crossorigin="anonymous">` : ''}
                        <div>
                            <h1 class="text-2xl font-bold uppercase">${inst.NomeFantasia || 'Delícia da Cidade'}</h1>
                            <p class="text-sm text-gray-600">${inst.Endereco || ''}</p>
                            <p class="text-sm text-gray-600">${inst.Telefone || ''} | ${inst.Email || ''}</p>
                        </div>
                    </div>
                    <div class="text-right">
                        <h2 class="text-xl font-bold text-gray-800">FICHA DE FUNCIONÁRIO</h2>
                        <p class="text-sm text-gray-500">Gerado em: ${new Date().toLocaleDateString()}</p>
                    </div>
                </div>

                <div class="flex gap-6 mb-8">
                    <div class="w-32 h-32 bg-gray-200 border border-gray-300 flex items-center justify-center rounded overflow-hidden">
                        ${f.FotoURL ? `<img src="${f.FotoURL}" class="w-full h-full object-cover">` : `<i class="fas fa-user text-4xl text-gray-400"></i>`}
                    </div>
                    <div class="flex-1">
                        <h3 class="text-2xl font-bold text-gray-800 mb-1">${f.Nome}</h3>
                        <p class="text-lg text-gray-600 mb-4">${f.Cargo} - ${f.Departamento || 'Geral'}</p>
                        <div class="grid grid-cols-2 gap-4 text-sm">
                            <div><span class="font-bold text-gray-700">ID:</span> ${f.ID}</div>
                            <div><span class="font-bold text-gray-700">Status:</span> <span class="px-2 py-0.5 rounded ${f.Status === 'Ativo' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'} text-xs font-bold">${f.Status}</span></div>
                            <div><span class="font-bold text-gray-700">Admissão:</span> ${Utils.formatDate(f.Admissao)}</div>
                            <div><span class="font-bold text-gray-700">Turno:</span> ${f.Turno || '-'}</div>
                        </div>
                    </div>
                </div>

                <div class="mb-6">
                    <h4 class="font-bold text-gray-800 border-b border-gray-300 mb-3 pb-1 uppercase text-sm">Informações Pessoais</h4>
                    <div class="grid grid-cols-3 gap-4 text-sm">
                        <div><span class="font-bold block text-gray-500 text-xs">Data de Nascimento</span>${Utils.formatDate(f.Nascimento)}</div>
                        <div><span class="font-bold block text-gray-500 text-xs">BI / Identidade</span>${f.BI || '-'}</div>
                        <div><span class="font-bold block text-gray-500 text-xs">Telefone</span>${f.Telefone || '-'}</div>
                        <div class="col-span-2"><span class="font-bold block text-gray-500 text-xs">Email</span>${f.Email || '-'}</div>
                    </div>
                </div>

                <div class="mb-6">
                    <h4 class="font-bold text-gray-800 border-b border-gray-300 mb-3 pb-1 uppercase text-sm">Evolução Salarial (Últimos 12 Meses)</h4>
                    <div class="h-48 w-full border border-gray-200 rounded p-2">
                        <canvas id="chart-profile-evolution"></canvas>
                    </div>
                </div>

                <div class="mb-6">
                    <h4 class="font-bold text-gray-800 border-b border-gray-300 mb-3 pb-1 uppercase text-sm">Dados Contratuais & Financeiros</h4>
                    <div class="grid grid-cols-3 gap-4 text-sm">
                        <div><span class="font-bold block text-gray-500 text-xs">Tipo de Contrato</span>${f.TipoContrato || '-'}</div>
                        <div><span class="font-bold block text-gray-500 text-xs">Salário Base</span>${Utils.formatCurrency(f.Salario)}</div>
                        <div><span class="font-bold block text-gray-500 text-xs">IBAN</span>${f.Iban || '-'}</div>
                        <div><span class="font-bold block text-gray-500 text-xs">Saldo de Férias</span>${f.SaldoFerias ? f.SaldoFerias + ' dias' : '-'}</div>
                    </div>
                </div>
            </div>
        `;
        
        // Script para renderizar o gráfico dentro do iframe de impressão
        let chartScript = '';
        if (historico.length > 0 && typeof Chart !== 'undefined') {
            const labels = JSON.stringify(historico.map(h => h.Periodo));
            const data = JSON.stringify(historico.map(h => h.SalarioLiquido));
            
            html += `
                <script>
                    new Chart(document.getElementById('chart-profile-evolution'), {
                        type: 'line',
                        data: {
                            labels: ${labels},
                            datasets: [{
                                label: 'Salário Líquido (Kz)',
                                data: ${data},
                                borderColor: '#10B981',
                                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                                borderWidth: 2,
                                fill: true,
                                tension: 0.3
                            }]
                        },
                        options: { animation: false, responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
                    });
                </script>
            `;
        }

        Utils.printNative(html);
    },

    // --- 2. ABA FREQUÊNCIA ---
    renderFrequencia: async () => {
        RHModule.highlightTab('tab-frequencia');
        
        if (!RHModule.state.cache.frequencia) {
            document.getElementById('tab-content').innerHTML = '<div class="text-center p-10"><i class="fas fa-spinner fa-spin text-4xl text-blue-600"></i><p class="mt-2">Carregando frequência...</p></div>';
            try {
                RHModule.state.cache.frequencia = await Utils.api('getAll', 'Frequencia');
            } catch (e) { return Utils.toast('Erro ao carregar dados.', 'error'); }
        }

        const data = RHModule.state.cache.frequencia || [];
        const canCreate = Utils.checkPermission('RH', 'criar');
        const canEdit = Utils.checkPermission('RH', 'editar');
        const canDelete = Utils.checkPermission('RH', 'excluir');
        
        // Função auxiliar para calcular horas
        const calcHours = (start, end, is24h) => {
            if(!start || !end) return 0;
            const [h1, m1] = start.split(':').map(Number);
            const [h2, m2] = end.split(':').map(Number);
            let diff = (h2*60+m2) - (h1*60+m1);
            // Ajuste para virada de dia (Se sair no dia seguinte ou mesmo horário = 24h)
            if (diff <= 0) diff += 24 * 60; 
            // Lógica Inteligente para 24h: Se a diferença for positiva mas pequena (< 4h), assume dia seguinte
            else if (is24h && diff < 240) diff += 24 * 60;
            return diff / 60;
        };

        // Aplicar filtro de data
        const { filterFrequenciaStart, filterFrequenciaEnd } = RHModule.state;
        if (filterFrequenciaStart) {
            data = data.filter(r => r.Data >= filterFrequenciaStart);
        }
        if (filterFrequenciaEnd) {
            data = data.filter(r => r.Data <= filterFrequenciaEnd);
        }

        document.getElementById('tab-content').innerHTML = `
            <div class="flex justify-between items-center mb-4">
                <div class="flex gap-2 items-center bg-gray-50 p-2 rounded border">
                    <label class="text-sm font-bold text-gray-600">Filtrar por Data:</label>
                    <input type="date" id="freq-start-date" class="border p-1 rounded text-sm" value="${filterFrequenciaStart || ''}">
                    <span class="text-gray-500">até</span>
                    <input type="date" id="freq-end-date" class="border p-1 rounded text-sm" value="${filterFrequenciaEnd || ''}">
                    <button onclick="RHModule.applyFrequenciaFilter()" class="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700" title="Aplicar Filtro"><i class="fas fa-filter"></i></button>
                    <button onclick="RHModule.clearFrequenciaFilter()" class="text-gray-500 px-2 text-sm hover:text-red-500" title="Limpar Filtro"><i class="fas fa-times"></i></button>
                </div>
                <div class="flex gap-2">
                    <button onclick="RHModule.printTabPDF('frequencia')" class="bg-red-600 text-white px-4 py-2 rounded shadow hover:bg-red-700"><i class="fas fa-file-pdf"></i> PDF</button>
                    ${canCreate ? `<button onclick="RHModule.modalFrequencia()" class="bg-blue-600 text-white px-4 py-2 rounded">+ Registrar Ponto</button>` : ''}
                </div>
            </div>
            <table class="w-full bg-white rounded shadow text-sm">
                <thead class="bg-gray-100">
                    <tr>
                        <th class="p-3 text-left">Data</th>
                        <th class="p-3 text-left">Funcionário</th>
                        <th class="p-3 text-center">Entrada</th>
                        <th class="p-3 text-center">Saída</th>
                        <th class="p-3 text-center">Status</th>
                        <th class="p-3 text-left">Observação</th>
                        <th class="p-3 text-center">Ações</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.map(r => {
                        // Busca funcionário para saber o turno
                        const func = RHModule.state.cache.funcionarios.find(f => f.ID === r.FuncionarioID);
                        
                        // Lógica de Status (Prioridade: Manual > Calculado)
                        let status = r.Status || 'Presente';
                        let statusClass = 'bg-green-100 text-green-800';
                        
                        // Cores baseadas no status
                        if (status.includes('Falta') || status === 'Suspensão') statusClass = 'bg-red-100 text-red-800';
                        else if (status === 'Atraso' || status === 'Saída Antecipada') statusClass = 'bg-yellow-100 text-yellow-800';
                        else if (status === 'Licença' || status === 'Férias') statusClass = 'bg-blue-100 text-blue-800';
                        
                        // Se não tiver status manual mas não tiver horários, sugere Falta (visual apenas)
                        if (!r.Status && !r.Entrada && !r.Saida) {
                             status = 'Falta (Sem registro)';
                             statusClass = 'bg-red-50 text-red-500 border border-red-200';
                        }
                        
                        return `
                        <tr class="border-t">
                            <td class="p-3">${Utils.formatDate(r.Data)}</td>
                            <td class="p-3 font-medium">
                                ${r.FuncionarioNome}
                                <div class="text-xs text-gray-500">${func ? func.Turno : ''}</div>
                            </td>
                            <td class="p-3 text-center">${r.Entrada || '—'}</td>
                            <td class="p-3 text-center">${r.Saida || '—'}</td>
                            <td class="p-3 text-center"><span class="px-2 py-1 rounded text-xs font-bold ${statusClass}">${status}</span></td>
                            <td class="p-3 text-sm text-gray-600">${r.Observacoes || '—'}</td>
                            <td class="p-3 text-center">
                                <button onclick="RHModule.printIndividualFrequency('${r.FuncionarioID}')" class="text-gray-600 hover:text-gray-900 mr-2" title="Imprimir Folha Mensal"><i class="fas fa-print"></i></button>
                                ${canEdit ? `<button onclick="RHModule.modalFrequencia('${r.ID}')" class="text-blue-500 mr-2"><i class="fas fa-edit"></i></button>` : ''}
                                ${canDelete ? `<button onclick="RHModule.delete('Frequencia', '${r.ID}')" class="text-red-500"><i class="fas fa-trash"></i></button>` : ''}
                            </td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
        `;
    },

    modalFrequencia: (id = null) => {
        const funcs = RHModule.state.cache.funcionarios;
        const today = new Date().toISOString().split('T')[0];
        
        const record = id ? RHModule.state.cache.frequencia.find(r => r.ID === id) : {};
        const title = id ? 'Editar Frequência' : 'Registrar Ponto';

        Utils.openModal(title, `
            <form onsubmit="RHModule.save(event, 'Frequencia')">
                <input type="hidden" name="ID" value="${record.ID || ''}">
                <div class="mb-4">
                    <label class="block text-sm font-bold">Funcionário</label>
                    <select name="FuncionarioID" class="border p-2 rounded w-full" onchange="this.form.FuncionarioNome.value = this.options[this.selectedIndex].text" required>
                        <option value="">Selecione...</option>
                        ${funcs.map(f => `<option value="${f.ID}" ${record.FuncionarioID === f.ID ? 'selected' : ''}>${f.Nome}</option>`).join('')}
                    </select>
                    <input type="hidden" name="FuncionarioNome" value="${record.FuncionarioNome || ''}">
                </div>
                <div class="mb-4"><label class="text-xs">Data</label><input type="date" name="Data" value="${record.Data || today}" class="border p-2 rounded w-full" required></div>
                <div class="grid grid-cols-2 gap-4 mb-4">
                    <div>
                        <label class="text-xs">Entrada</label>
                        <div class="flex gap-1"><input type="time" name="Entrada" value="${record.Entrada || ''}" class="border p-2 rounded w-full"><button type="button" onclick="RHModule.setCurrentTime('Entrada')" class="bg-gray-200 px-2 rounded hover:bg-gray-300" title="Agora"><i class="fas fa-clock"></i></button></div>
                    </div>
                    <div>
                        <label class="text-xs">Saída</label>
                        <div class="flex gap-1"><input type="time" name="Saida" value="${record.Saida || ''}" class="border p-2 rounded w-full"><button type="button" onclick="RHModule.setCurrentTime('Saida')" class="bg-gray-200 px-2 rounded hover:bg-gray-300" title="Agora"><i class="fas fa-clock"></i></button></div>
                    </div>
                </div>
                <div class="mb-4">
                    <label class="text-xs font-bold">Status do Dia</label>
                    <select name="Status" class="border p-2 rounded w-full bg-gray-50">
                        <option value="Presente" ${record.Status === 'Presente' ? 'selected' : ''}>Presente</option>
                        <option value="Atraso" ${record.Status === 'Atraso' ? 'selected' : ''}>Atraso</option>
                        <option value="Saída Antecipada" ${record.Status === 'Saída Antecipada' ? 'selected' : ''}>Saída Antecipada</option>
                        <option value="Falta" ${record.Status === 'Falta' ? 'selected' : ''}>Falta</option>
                        <option value="Falta Justificada" ${record.Status === 'Falta Justificada' ? 'selected' : ''}>Falta Justificada</option>
                        <option value="Licença" ${record.Status === 'Licença' ? 'selected' : ''}>Licença</option>
                        <option value="Férias" ${record.Status === 'Férias' ? 'selected' : ''}>Férias</option>
                        <option value="Suspensão" ${record.Status === 'Suspensão' ? 'selected' : ''}>Suspensão</option>
                    </select>
                </div>
                <div class="mb-4">
                    <input name="Assinatura" value="${record.Assinatura || ''}" placeholder="Assinatura Digital (Texto)" class="border p-2 rounded w-full bg-gray-50">
                </div>
                <div class="mb-4">
                    <textarea name="Observacoes" placeholder="Observações (Atrasos, Justificativas...)" class="border p-2 rounded w-full h-20">${record.Observacoes || ''}</textarea>
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

    applyFrequenciaFilter: () => {
        RHModule.state.filterFrequenciaStart = document.getElementById('freq-start-date').value;
        RHModule.state.filterFrequenciaEnd = document.getElementById('freq-end-date').value;
        RHModule.renderFrequencia();
    },

    clearFrequenciaFilter: () => {
        RHModule.state.filterFrequenciaStart = '';
        RHModule.state.filterFrequenciaEnd = '';
        // Não precisa limpar os inputs manualmente, o re-render já fará isso
        // ao ler o estado vazio.
        RHModule.renderFrequencia();
    },

    // --- 3. ABA FÉRIAS ---
    renderFerias: () => {
        RHModule.highlightTab('tab-ferias');
        const data = RHModule.state.cache.ferias || [];
        const canCreate = Utils.checkPermission('RH', 'criar');
        const canDelete = Utils.checkPermission('RH', 'excluir');
        document.getElementById('tab-content').innerHTML = `
            <div class="flex justify-end gap-2 mb-4">
                <button onclick="RHModule.printTabPDF('ferias')" class="bg-red-600 text-white px-4 py-2 rounded shadow hover:bg-red-700"><i class="fas fa-file-pdf"></i> PDF</button>
                ${canCreate ? `<button onclick="RHModule.modalFerias()" class="bg-blue-600 text-white px-4 py-2 rounded">+ Solicitar Férias</button>` : ''}
            </div>
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
                                <button onclick="RHModule.shareGuiaFerias('${r.ID}')" class="text-blue-600 hover:text-blue-800" title="Enviar por Email/WhatsApp"><i class="fas fa-share-alt"></i></button>
                                ${r.ComprovativoURL ? `<button onclick="RHModule.viewComprovativo('${r.ID}')" class="text-green-600 hover:text-green-800" title="Ver Comprovativo"><i class="fas fa-receipt"></i></button>` : ''}
                                ${canDelete ? `<button onclick="RHModule.delete('Ferias', '${r.ID}')" class="text-red-500 hover:text-red-700"><i class="fas fa-trash"></i></button>` : ''}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    },

    updateSubsidioFerias: () => {
        const funcId = document.querySelector('select[name="FuncionarioID"]').value;
        const dias = Number(document.querySelector('input[name="Dias"]').value || 0);
        const f = RHModule.state.cache.funcionarios.find(x => x.ID === funcId);
        const inst = RHModule.state.cache.instituicao[0] || {};
        const percentual = Number(inst.SubsidioFeriasPorcentagem || 50) / 100;
        
        if(f) {
            // Preencher dados básicos se chamado pelo select
            if (window.event && window.event.target.name === 'FuncionarioID') {
                document.querySelector('input[name="FuncionarioNome"]').value = f.Nome;
                document.getElementById('f-cargo').value = f.Cargo;
                document.getElementById('f-dept').value = f.Departamento || '';
                document.getElementById('f-adm').value = f.Admissao || '';
            }

            // Cálculo do Subsídio (Baseado na configuração global)
            const valorDiario = Number(f.Salario || 0) / 30;
            const subsidio = (valorDiario * dias) * percentual;
            document.getElementById('f-subsidio').value = Utils.formatCurrency(subsidio);
        }
    },

    modalFerias: () => {
        const funcs = RHModule.state.cache.funcionarios;
        
        Utils.openModal('Solicitar Férias', `
            <form onsubmit="RHModule.save(event, 'Ferias')">
                <h3 class="text-lg font-bold text-gray-800 mb-4 border-b pb-2">Controle de Férias / Observações (Opcional)</h3>
                
                <div class="mb-4">
                    <label class="block text-sm font-bold mb-1">Nome do Funcionario</label>
                    <select name="FuncionarioID" class="border p-2 rounded w-full mb-2" onchange="RHModule.updateSubsidioFerias()" required>
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
                    <div><label class="text-xs font-bold">TOTAL DE DIAS</label><input type="number" name="Dias" class="border p-2 rounded w-full" required oninput="RHModule.updateSubsidioFerias()"></div>
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
                    <div class="col-span-3 mt-2"><label class="text-xs font-bold block text-green-700">SUBSÍDIO ESTIMADO</label><input id="f-subsidio" class="border p-2 rounded w-full bg-green-50 font-bold text-green-800" readonly></div>
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
        const showLogo = inst.ExibirLogoRelatorios;

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
        const saldoRestante = 22 - diasGozados; // Base: 22 dias úteis

        const html = `
            <div class="border-2 border-gray-800 p-8 max-w-3xl mx-auto font-serif text-gray-900">
                <!-- Cabeçalho -->
                <div class="flex items-center justify-between border-b-2 border-gray-800 pb-4 mb-6">
                    <div class="${showLogo && inst.LogotipoURL ? 'flex items-center gap-4' : ''}">
                        ${showLogo && inst.LogotipoURL ? `<img src="${inst.LogotipoURL}" class="h-16 w-auto object-contain">` : ''}
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

        Utils.printNative(html);
    },

    shareGuiaFerias: (id) => {
        const ferias = RHModule.state.cache.ferias.find(f => f.ID === id);
        if (!ferias) return Utils.toast('Registro não encontrado.', 'error');

        const func = RHModule.state.cache.funcionarios.find(f => f.ID === ferias.FuncionarioID) || {};
        
        // Prepara a Mensagem
        const dataInicio = Utils.formatDate(ferias.DataInicio);
        const dataFim = Utils.formatDate(ferias.DataFim);
        const retorno = new Date(ferias.DataFim);
        retorno.setDate(retorno.getDate() + 1);
        const dataRetorno = Utils.formatDate(retorno.toISOString().split('T')[0]);
        
        const msg = `*GUIA DE FÉRIAS - DELÍCIA DA CIDADE*\n\n` +
            `Olá *${func.Nome}*,\n` +
            `Seguem os detalhes das suas férias:\n\n` +
            `📅 *Período:* ${dataInicio} a ${dataFim}\n` +
            `🏖️ *Dias:* ${ferias.Dias}\n` +
            `🔙 *Retorno:* ${dataRetorno}\n\n` +
            `Bom descanso!`;

        const encodedMsg = encodeURIComponent(msg);
        
        // Limpeza do telefone (remove caracteres não numéricos)
        let phone = func.Telefone || '';
        phone = phone.replace(/\D/g, ''); 
        
        const email = func.Email || '';

        Utils.openModal('Enviar Guia de Férias', `
            <div class="text-center space-y-4">
                <p class="text-gray-600">Escolha como deseja enviar as informações para <b>${func.Nome}</b>:</p>
                
                <div class="grid grid-cols-1 gap-3">
                    <a href="https://wa.me/${phone}?text=${encodedMsg}" target="_blank" class="block w-full bg-green-500 text-white py-3 rounded font-bold hover:bg-green-600 flex items-center justify-center gap-2 transition">
                        <i class="fab fa-whatsapp text-xl"></i> Enviar por WhatsApp
                    </a>
                    
                    <a href="mailto:${email}?subject=Guia de Férias - ${func.Nome}&body=${encodedMsg}" class="block w-full bg-blue-600 text-white py-3 rounded font-bold hover:bg-blue-700 flex items-center justify-center gap-2 transition">
                        <i class="fas fa-envelope text-xl"></i> Enviar por E-mail
                    </a>
                </div>
                
                <div class="text-xs text-gray-400 mt-4 border-t pt-2">
                    <p>Telefone cadastrado: ${func.Telefone || 'Não informado'}</p>
                    <p>E-mail cadastrado: ${func.Email || 'Não informado'}</p>
                </div>
            </div>
        `);
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
    renderAvaliacoes: async () => {
        RHModule.highlightTab('tab-avaliacoes');

        if (!RHModule.state.cache.avaliacoes) {
            document.getElementById('tab-content').innerHTML = '<div class="text-center p-10"><i class="fas fa-spinner fa-spin text-4xl text-blue-600"></i><p class="mt-2">Carregando avaliações...</p></div>';
            try {
                RHModule.state.cache.avaliacoes = await Utils.api('getAll', 'Avaliacoes');
            } catch (e) { return Utils.toast('Erro ao carregar dados.', 'error'); }
        }

        const data = RHModule.state.cache.avaliacoes || [];
        const canCreate = Utils.checkPermission('RH', 'criar');
        const canEdit = Utils.checkPermission('RH', 'editar');
        const canDelete = Utils.checkPermission('RH', 'excluir');
        document.getElementById('tab-content').innerHTML = `
            <div class="flex justify-end gap-2 mb-4">
                <button onclick="RHModule.printTabPDF('avaliacoes')" class="bg-red-600 text-white px-4 py-2 rounded shadow hover:bg-red-700"><i class="fas fa-file-pdf"></i> PDF</button>
                ${canCreate ? `<button onclick="RHModule.modalAvaliacao()" class="bg-blue-600 text-white px-4 py-2 rounded">+ Nova Avaliação</button>` : ''}
            </div>
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
                            <td class="p-3 text-center flex justify-center gap-2">
                                <button onclick="RHModule.printAvaliacaoIndividual('${r.ID}')" class="text-gray-600 hover:text-gray-900" title="Imprimir"><i class="fas fa-print"></i></button>
                                <button onclick="RHModule.shareAvaliacao('${r.ID}')" class="text-blue-600 hover:text-blue-800" title="Compartilhar"><i class="fas fa-share-alt"></i></button>
                                ${canEdit ? `<button onclick="RHModule.modalAvaliacao('${r.ID}')" class="text-blue-600 hover:text-blue-800" title="Editar"><i class="fas fa-edit"></i></button>` : ''}
                                ${canDelete ? `<button onclick="RHModule.delete('Avaliacoes', '${r.ID}')" class="text-red-500 hover:text-red-700" title="Excluir"><i class="fas fa-trash"></i></button>` : ''}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    },

    modalAvaliacao: (id = null) => {
        const funcs = RHModule.state.cache.funcionarios;
        const av = id ? RHModule.state.cache.avaliacoes.find(a => a.ID === id) : {};
        const details = av.DetalhesJSON || {};
        const title = id ? 'Editar Avaliação' : 'Avaliação de Desempenho';
        
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

        // Helper para pegar valor (do nível superior ou detalhes)
        const getVal = (key) => av[key] !== undefined ? av[key] : (details[key] || '');

        // Preencher cargo/dept se editando
        let initialCargo = '', initialDept = '';
        if (av.FuncionarioID) {
            const f = funcs.find(x => x.ID === av.FuncionarioID);
            if(f) { initialCargo = f.Cargo; initialDept = f.Departamento; }
        }

        Utils.openModal(title, `
            <form onsubmit="RHModule.save(event, 'Avaliacoes')">
                <input type="hidden" name="ID" value="${av.ID || ''}">
                <h4 class="font-bold text-gray-700 mb-2 border-b">1 AVALIAÇÃO DE DESEMPENHO</h4>
                <div class="mb-3">
                    <label class="block text-xs font-bold">NOME DO FUNCIONARIO</label>
                    <select name="FuncionarioID" class="border p-2 rounded w-full mb-2" onchange="(${fillData})(this)" required>
                        <option value="">Selecione...</option>
                        ${funcs.map(f => `<option value="${f.ID}" ${av.FuncionarioID === f.ID ? 'selected' : ''}>${f.Nome}</option>`).join('')}
                    </select>
                    <input type="hidden" name="FuncionarioNome">
                    <div class="grid grid-cols-2 gap-2 text-xs mb-2">
                        <input id="av-cargo" placeholder="CARGO/FUNÇÃO" class="border p-2 bg-gray-100 rounded" readonly value="${initialCargo}">
                        <input id="av-dept" placeholder="DEPARTAMENTO/SETOR" class="border p-2 bg-gray-100 rounded" readonly value="${initialDept}">
                    </div>
                    <div class="grid grid-cols-2 gap-2">
                        <div><label class="text-xs font-bold">DATA DE AVALIAÇÃO</label><input type="date" name="DataAvaliacao" class="border p-2 rounded w-full" required value="${av.DataAvaliacao || ''}"></div>
                        <div><label class="text-xs font-bold">NOME DO AVALIADOR</label><input name="Avaliador" class="border p-2 rounded w-full" value="${av.Avaliador || ''}"></div>
                    </div>
                </div>
                
                <h4 class="font-bold text-gray-700 mb-2 border-b">2 CRITERIOS DE AVALIAÇÃO (ESCALA 1-10)</h4>
                <div class="grid grid-cols-3 gap-2 mb-3 text-sm" oninput="(${calcMedia})()">
                    <input type="number" name="N1" placeholder="PONTUALIDADE" min="0" max="10" class="nota-input border p-2 rounded" value="${getVal('N1')}">
                    <input type="number" name="N2" placeholder="ASSIDUIDADE" min="0" max="10" class="nota-input border p-2 rounded" value="${getVal('N2')}">
                    <input type="number" name="N3" placeholder="CUMPRIMENTO DE TAREFAS" min="0" max="10" class="nota-input border p-2 rounded" value="${getVal('N3')}">
                    <input type="number" name="N4" placeholder="PRODUTIVIDADE" min="0" max="10" class="nota-input border p-2 rounded" value="${getVal('N4')}">
                    <input type="number" name="N5" placeholder="QUALIDADE DO TRABALHO" min="0" max="10" class="nota-input border p-2 rounded" value="${getVal('N5')}">
                    <input type="number" name="N6" placeholder="TRABALHO EM EQUIPE" min="0" max="10" class="nota-input border p-2 rounded" value="${getVal('N6')}">
                    <input type="number" name="N7" placeholder="RESPONSABILIDADE" min="0" max="10" class="nota-input border p-2 rounded" value="${getVal('N7')}">
                    <input type="number" name="N8" placeholder="COMPROMETIMENTO" min="0" max="10" class="nota-input border p-2 rounded" value="${getVal('N8')}">
                    <input type="number" name="N9" placeholder="COMUNICAÇÃO" min="0" max="10" class="nota-input border p-2 rounded" value="${getVal('N9')}">
                </div>

                <h4 class="font-bold text-gray-700 mb-2 border-b">3 AVALIAÇÃO QUALITATIVA</h4>
                <div class="grid grid-cols-2 gap-2 mb-3">
                    <textarea name="PontosFortes" placeholder="PONTOS FORTES" class="border p-2 rounded h-16 text-xs">${getVal('PontosFortes')}</textarea>
                    <textarea name="PontosMelhorar" placeholder="PONTOS A MELHORAR" class="border p-2 rounded h-16 text-xs">${getVal('PontosMelhorar')}</textarea>
                </div>
                <div class="mb-3">
                    <textarea name="Comentarios" placeholder="COMENTARIOS DO AVALIADOR" class="border p-2 rounded w-full h-16 text-xs">${getVal('Comentarios')}</textarea>
                </div>

                <h4 class="font-bold text-gray-700 mb-2 border-b">4 RESULTADO</h4>
                <div class="flex gap-2 mb-4">
                    <input id="media-final" name="MediaFinal" placeholder="NOTA FINAL/MÉDIA GERAL" class="border p-2 rounded w-1/2 font-bold text-center bg-gray-100" readonly value="${av.MediaFinal || ''}">
                    <input id="conclusao" name="Conclusao" placeholder="CONCLUSÃO" class="border p-2 rounded w-1/2 font-bold bg-gray-100" readonly value="${av.Conclusao || ''}">
                </div>

                <button class="w-full bg-blue-600 text-white py-2 rounded">Calcular & Salvar</button>
            </form>
        `);
    },

    printAvaliacaoIndividual: (id) => {
        const av = RHModule.state.cache.avaliacoes.find(a => a.ID === id);
        if (!av) return Utils.toast('Avaliação não encontrada.', 'error');
        
        const func = RHModule.state.cache.funcionarios.find(f => f.ID === av.FuncionarioID) || {};
        const inst = RHModule.state.cache.instituicao[0] || {};
        const showLogo = inst.ExibirLogoRelatorios;
        const details = av.DetalhesJSON || {};
        const getVal = (key) => av[key] !== undefined ? av[key] : (details[key] || '-');

        const html = `
            <div class="p-8 font-sans text-gray-900 bg-white max-w-4xl mx-auto border border-gray-200">
                <!-- CABEÇALHO -->
                <div class="flex justify-between items-start border-b-2 border-gray-800 pb-6 mb-6">
                    <div class="flex items-center gap-4">
                        ${showLogo && inst.LogotipoURL ? `<img src="${inst.LogotipoURL}" class="h-20 w-auto object-contain">` : ''}
                        <div>
                            <h1 class="text-2xl font-bold uppercase text-gray-800">${inst.NomeFantasia || 'Delícia da Cidade'}</h1>
                            <p class="text-sm text-gray-600">${inst.Endereco || ''}</p>
                        </div>
                    </div>
                    <div class="text-right">
                        <h2 class="text-xl font-bold text-gray-800 uppercase">Avaliação de Desempenho</h2>
                        <p class="text-sm text-gray-500">Data: ${Utils.formatDate(av.DataAvaliacao)}</p>
                    </div>
                </div>

                <!-- DADOS -->
                <div class="bg-gray-50 p-4 rounded border border-gray-200 mb-6">
                    <div class="grid grid-cols-2 gap-4 text-sm">
                        <div><span class="font-bold">Funcionário:</span> ${func.Nome || av.FuncionarioNome}</div>
                        <div><span class="font-bold">Cargo:</span> ${func.Cargo || '-'}</div>
                        <div><span class="font-bold">Departamento:</span> ${func.Departamento || '-'}</div>
                        <div><span class="font-bold">Avaliador:</span> ${av.Avaliador || '-'}</div>
                    </div>
                </div>

                <!-- NOTAS -->
                <div class="mb-6">
                    <h3 class="font-bold border-b border-gray-300 mb-2 uppercase text-sm">Critérios de Avaliação</h3>
                    <table class="w-full text-sm border-collapse border border-gray-300">
                        <tr class="bg-gray-100"><th class="border p-2 text-left">Critério</th><th class="border p-2 text-center w-20">Nota</th></tr>
                        <tr><td class="border p-2">Pontualidade</td><td class="border p-2 text-center">${getVal('N1')}</td></tr>
                        <tr><td class="border p-2">Assiduidade</td><td class="border p-2 text-center">${getVal('N2')}</td></tr>
                        <tr><td class="border p-2">Cumprimento de Tarefas</td><td class="border p-2 text-center">${getVal('N3')}</td></tr>
                        <tr><td class="border p-2">Produtividade</td><td class="border p-2 text-center">${getVal('N4')}</td></tr>
                        <tr><td class="border p-2">Qualidade do Trabalho</td><td class="border p-2 text-center">${getVal('N5')}</td></tr>
                        <tr><td class="border p-2">Trabalho em Equipe</td><td class="border p-2 text-center">${getVal('N6')}</td></tr>
                        <tr><td class="border p-2">Responsabilidade</td><td class="border p-2 text-center">${getVal('N7')}</td></tr>
                        <tr><td class="border p-2">Comprometimento</td><td class="border p-2 text-center">${getVal('N8')}</td></tr>
                        <tr><td class="border p-2">Comunicação</td><td class="border p-2 text-center">${getVal('N9')}</td></tr>
                        <tr class="bg-gray-100 font-bold"><td class="border p-2 text-right">MÉDIA FINAL</td><td class="border p-2 text-center text-lg">${av.MediaFinal}</td></tr>
                    </table>
                </div>

                <!-- QUALITATIVO -->
                <div class="grid grid-cols-2 gap-6 mb-6">
                    <div class="border p-3 rounded">
                        <h4 class="font-bold text-green-700 text-sm mb-2">Pontos Fortes</h4>
                        <p class="text-sm text-gray-700">${getVal('PontosFortes') || '-'}</p>
                    </div>
                    <div class="border p-3 rounded">
                        <h4 class="font-bold text-red-700 text-sm mb-2">Pontos a Melhorar</h4>
                        <p class="text-sm text-gray-700">${getVal('PontosMelhorar') || '-'}</p>
                    </div>
                </div>
                <div class="mb-6 border p-3 rounded">
                    <h4 class="font-bold text-gray-700 text-sm mb-2">Comentários Gerais</h4>
                    <p class="text-sm text-gray-700">${getVal('Comentarios') || '-'}</p>
                </div>

                <!-- RESULTADO -->
                <div class="text-center mb-12">
                    <span class="text-sm font-bold uppercase text-gray-500">Conclusão Final</span>
                    <div class="text-2xl font-bold text-blue-800 border-2 border-blue-800 inline-block px-6 py-2 rounded mt-1">${av.Conclusao}</div>
                </div>

                <!-- ASSINATURAS -->
                <div class="grid grid-cols-2 gap-16 text-center">
                    <div class="border-t border-gray-400 pt-2"><p class="font-bold text-sm">Avaliador</p></div>
                    <div class="border-t border-gray-400 pt-2"><p class="font-bold text-sm">Funcionário (Ciente)</p></div>
                </div>
                
                <div class="mt-8 text-center text-xs text-gray-400 border-t pt-2">
                    &copy; 2026 Delícia da Cidade. Todos os direitos reservados. | Versão 1.0.0
                </div>
            </div>
        `;
        Utils.printNative(html);
    },

    shareAvaliacao: (id) => {
        const av = RHModule.state.cache.avaliacoes.find(a => a.ID === id);
        if (!av) return Utils.toast('Avaliação não encontrada.', 'error');
        const func = RHModule.state.cache.funcionarios.find(f => f.ID === av.FuncionarioID) || {};
        
        const msg = `*AVALIAÇÃO DE DESEMPENHO*\n` +
            `Funcionário: ${func.Nome}\n` +
            `Data: ${Utils.formatDate(av.DataAvaliacao)}\n` +
            `Média Final: *${av.MediaFinal}*\n` +
            `Conclusão: *${av.Conclusao}*\n\n` +
            `Acesse o sistema para ver os detalhes completos.`;
            
        const encodedMsg = encodeURIComponent(msg);
        let phone = func.Telefone || '';
        phone = phone.replace(/\D/g, '');
        const email = func.Email || '';

        Utils.openModal('Compartilhar Avaliação', `
            <div class="text-center space-y-4">
                <p class="text-gray-600">Enviar resumo para <b>${func.Nome}</b>:</p>
                <div class="grid grid-cols-1 gap-3">
                    <a href="https://wa.me/${phone}?text=${encodedMsg}" target="_blank" class="block w-full bg-green-500 text-white py-3 rounded font-bold hover:bg-green-600 flex items-center justify-center gap-2 transition">
                        <i class="fab fa-whatsapp text-xl"></i> WhatsApp
                    </a>
                    <a href="mailto:${email}?subject=Avaliação de Desempenho&body=${encodedMsg}" class="block w-full bg-blue-600 text-white py-3 rounded font-bold hover:bg-blue-700 flex items-center justify-center gap-2 transition">
                        <i class="fas fa-envelope text-xl"></i> E-mail
                    </a>
                </div>
            </div>
        `);
    },

    // --- 5. ABA TREINAMENTO ---
    renderTreinamento: async () => {
        RHModule.highlightTab('tab-treinamento');

        if (!RHModule.state.cache.treinamentos) {
            document.getElementById('tab-content').innerHTML = '<div class="text-center p-10"><i class="fas fa-spinner fa-spin text-4xl text-blue-600"></i><p class="mt-2">Carregando treinamentos...</p></div>';
            try {
                RHModule.state.cache.treinamentos = await Utils.api('getAll', 'Treinamentos');
            } catch (e) { return Utils.toast('Erro ao carregar dados.', 'error'); }
        }

        const data = RHModule.state.cache.treinamentos || [];
        const canCreate = Utils.checkPermission('RH', 'criar');
        const canDelete = Utils.checkPermission('RH', 'excluir');
        document.getElementById('tab-content').innerHTML = `
            <div class="flex justify-end gap-2 mb-4">
                <button onclick="RHModule.printTabPDF('treinamento')" class="bg-red-600 text-white px-4 py-2 rounded shadow hover:bg-red-700"><i class="fas fa-file-pdf"></i> PDF</button>
                ${canCreate ? `<button onclick="RHModule.modalTreinamento()" class="bg-blue-600 text-white px-4 py-2 rounded">+ Novo Treinamento</button>` : ''}
            </div>
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
    renderFolha: async () => {
        RHModule.highlightTab('tab-folha');

        if (!RHModule.state.cache.folha) {
            document.getElementById('tab-content').innerHTML = '<div class="text-center p-10"><i class="fas fa-spinner fa-spin text-4xl text-blue-600"></i><p class="mt-2">Carregando folha de pagamento...</p></div>';
            try {
                RHModule.state.cache.folha = await Utils.api('getAll', 'Folha');
            } catch (e) { return Utils.toast('Erro ao carregar dados.', 'error'); }
        }

        const data = RHModule.state.cache.folha || [];
        const canCreate = Utils.checkPermission('RH', 'criar');
        const canEdit = Utils.checkPermission('RH', 'editar');
        const canDelete = Utils.checkPermission('RH', 'excluir');
        
        document.getElementById('tab-content').innerHTML = `
            <div class="flex justify-end gap-2 mb-4">
                <button onclick="RHModule.printTabPDF('folha')" class="bg-red-600 text-white px-4 py-2 rounded shadow hover:bg-red-700"><i class="fas fa-file-pdf"></i> PDF</button>
                ${canCreate ? `<button onclick="RHModule.modalFolha()" class="bg-indigo-600 text-white px-4 py-2 rounded">+ Lançar Pagamento</button>` : ''}
            </div>
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
                            <td class="p-3 text-center flex justify-center gap-2">
                                <button onclick="RHModule.printPayslip('${r.ID}')" class="text-gray-600 hover:text-gray-900" title="Imprimir Recibo"><i class="fas fa-print"></i></button>
                                ${canEdit ? `<button onclick="RHModule.modalFolha('${r.ID}')" class="text-blue-600 hover:text-blue-800" title="Editar"><i class="fas fa-edit"></i></button>` : ''}
                                ${canDelete ? `<button onclick="RHModule.delete('Folha', '${r.ID}')" class="text-red-500 hover:text-red-700"><i class="fas fa-trash"></i></button>` : ''}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    },

    modalFolha: (id = null) => {
        const funcs = RHModule.state.cache.funcionarios;
        const folha = id ? RHModule.state.cache.folha.find(f => f.ID === id) : {};
        const title = id ? 'Editar Folha' : 'Lançamento de Folha';
        
        // Preencher dados e Salário Base
        const fillData = (select) => {
            const f = RHModule.state.cache.funcionarios.find(x => x.ID === select.value);
            if(f) {
                select.form.FuncionarioNome.value = f.Nome;
                document.getElementById('folha-cargo').value = f.Cargo;
                document.getElementById('folha-base').value = f.Salario;
                document.getElementById('folha-iban').value = f.Iban || 'AO06';
                
                // Sugestão de valor por dia (Salário / 30)
                const valDia = f.Salario ? (f.Salario / 30).toFixed(2) : '';
                const inputValFalta = document.getElementById('val-falta');
                if(inputValFalta) inputValFalta.value = valDia;

                calcFolha();
            }
        };

        // Cálculo em tempo real
        const calcFolha = (event) => {
            const base = Number(document.getElementById('folha-base').value || 0);
            
            // Vencimentos
            const heVal = Number(document.querySelector('[name="ValorHoraExtra"]').value || 0);
            const heQtd = Number(document.querySelector('[name="QtdHoraExtra"]').value || 0);
            const bonus = Number(document.querySelector('[name="Bonus"]').value || 0);
            const outrosV = Number(document.querySelector('[name="OutrosVencimentos"]').value || 0);
            const totalV = base + (heVal * heQtd) + bonus + outrosV;

            // Cálculo de Faltas (Novo)
            const qtdFaltas = Number(document.getElementById('qtd-faltas').value || 0);
            const valFalta = Number(document.getElementById('val-falta').value || 0);
            const inputFaltas = document.getElementById('total-faltas');
            
            // Atualiza total se estiver editando os componentes
            // FIX: Usa event.target para garantir que o cálculo só ocorre ao mexer nestes campos
            if (inputFaltas && event && event.target && (event.target.id === 'qtd-faltas' || event.target.id === 'val-falta')) {
                 inputFaltas.value = (qtdFaltas * valFalta);
            }

            // Descontos
            const inss = Number(document.querySelector('[name="INSS"]').value || 0);
            const irt = Number(document.querySelector('[name="IRT"]').value || 0);
            const faltas = inputFaltas ? Number(inputFaltas.value || 0) : 0;
            const outrosD = Number(document.querySelector('[name="OutrosDescontos"]').value || 0);
            const totalD = inss + irt + faltas + outrosD;

            document.getElementById('total-venc').value = totalV;
            document.getElementById('total-desc').value = totalD;
            document.getElementById('liquido').value = totalV - totalD;
        };

        // Obter cargo para exibição inicial se estiver editando
        let initialCargo = '';
        if (id && folha.FuncionarioID) {
            const f = funcs.find(x => x.ID === folha.FuncionarioID);
            if (f) initialCargo = f.Cargo;
        }

        Utils.openModal(title, `
            <form onsubmit="RHModule.save(event, 'Folha')" oninput="(${calcFolha})(event)">
                <input type="hidden" name="ID" value="${folha.ID || ''}">
                <h4 class="font-bold text-gray-700 mb-2 border-b">1. Identificação</h4>
                <div class="grid grid-cols-2 gap-3 mb-3">
                    <select name="FuncionarioID" class="border p-2 rounded w-full col-span-2" onchange="(${fillData})(this)" required>
                        <option value="">Selecione...</option>
                        ${funcs.map(f => `<option value="${f.ID}" ${folha.FuncionarioID === f.ID ? 'selected' : ''}>${f.Nome}</option>`).join('')}
                    </select>
                    <input type="hidden" name="FuncionarioNome" value="${folha.FuncionarioNome || ''}">
                    <input id="folha-cargo" placeholder="Cargo" class="border p-2 bg-gray-100" readonly value="${initialCargo}">
                    <input type="month" name="Periodo" class="border p-2 rounded w-full" required value="${folha.Periodo || ''}">
                </div>

                <h4 class="font-bold text-gray-700 mb-2 border-b text-green-700">2. Vencimentos (Créditos)</h4>
                <div class="grid grid-cols-2 gap-2 mb-3 text-sm">
                    <input id="folha-base" name="SalarioBase" placeholder="Salário Base" class="border p-2 bg-gray-50" readonly value="${folha.SalarioBase || ''}">
                    <input name="Bonus" placeholder="Bônus/Prêmios" type="number" class="border p-2" value="${folha.Bonus || ''}">
                    <div class="flex gap-1">
                        <input name="QtdHoraExtra" placeholder="Qtd HE" type="number" class="border p-2 w-1/2" value="${folha.QtdHoraExtra || ''}">
                        <input name="ValorHoraExtra" placeholder="Vlr HE" type="number" class="border p-2 w-1/2" value="${folha.ValorHoraExtra || ''}">
                    </div>
                    <input name="OutrosVencimentos" placeholder="Outros (Comissões...)" type="number" class="border p-2" value="${folha.OutrosVencimentos || ''}">
                </div>

                <h4 class="font-bold text-gray-700 mb-2 border-b text-red-700">3. Descontos</h4>
                <div class="grid grid-cols-2 gap-2 mb-3 text-sm">
                    <input name="INSS" placeholder="INSS (3%)" type="number" class="border p-2" value="${folha.INSS || ''}">
                    <input name="IRT" placeholder="IRT" type="number" class="border p-2" value="${folha.IRT || ''}">
                    
                    <div class="col-span-2 grid grid-cols-3 gap-2 bg-red-50 p-2 rounded border border-red-100">
                        <div>
                            <label class="text-[10px] font-bold text-red-800 block mb-1">Qtd. Faltas</label>
                            <input type="number" id="qtd-faltas" placeholder="Dias/Horas" class="border p-2 w-full bg-white text-xs">
                        </div>
                        <div>
                            <label class="text-[10px] font-bold text-red-800 block mb-1">Valor Unit.</label>
                            <input type="number" id="val-falta" placeholder="Kz" class="border p-2 w-full bg-white text-xs">
                        </div>
                        <div>
                            <label class="text-[10px] font-bold text-red-800 block mb-1">Total Desconto</label>
                            <input id="total-faltas" name="Faltas" placeholder="Total" type="number" class="border p-2 w-full bg-white font-bold text-red-600 text-xs" value="${folha.Faltas || ''}">
                        </div>
                    </div>

                    <input name="OutrosDescontos" placeholder="Outros (Vales...)" type="number" class="border p-2 col-span-2" value="${folha.OutrosDescontos || ''}">
                </div>

                <h4 class="font-bold text-gray-700 mb-2 border-b">4. Totais & Banco</h4>
                <div class="grid grid-cols-3 gap-2 mb-3 font-bold">
                    <input id="total-venc" name="TotalVencimentos" class="border p-2 bg-green-50 text-green-700" readonly value="${folha.TotalVencimentos || ''}">
                    <input id="total-desc" name="TotalDescontos" class="border p-2 bg-red-50 text-red-700" readonly value="${folha.TotalDescontos || ''}">
                    <input id="liquido" name="SalarioLiquido" class="border p-2 bg-blue-50 text-blue-700" readonly value="${folha.SalarioLiquido || ''}">
                </div>
                <div class="grid grid-cols-2 gap-2 mb-4 text-sm">
                    <input name="Banco" placeholder="Banco" class="border p-2" value="${folha.Banco || ''}">
                    <input id="folha-iban" name="Iban" placeholder="IBAN" class="border p-2" value="${folha.Iban || ''}">
                </div>

                <button class="w-full bg-green-600 text-white py-2 rounded">Confirmar Pagamento</button>
            </form>
        `);
    },

    printPayslip: (id) => {
        const folha = RHModule.state.cache.folha.find(f => f.ID === id);
        if (!folha) return Utils.toast('Recibo não encontrado.', 'error');

        const func = RHModule.state.cache.funcionarios.find(f => f.ID === folha.FuncionarioID) || {};
        const inst = RHModule.state.cache.instituicao[0] || {};
        const showLogo = inst.ExibirLogoRelatorios;

        // Helper for currency
        const kz = (val) => Utils.formatCurrency(val);

        const html = `
            <div class="p-8 font-sans text-gray-900 bg-white max-w-4xl mx-auto border border-gray-200">
                <!-- 1. CABEÇALHO EMPRESA -->
                <div class="flex justify-between items-start border-b-2 border-gray-800 pb-6 mb-6">
                    <div class="flex items-center gap-4">
                        ${showLogo && inst.LogotipoURL ? `<img src="${inst.LogotipoURL}" class="h-20 w-auto object-contain">` : ''}
                        <div>
                            <h1 class="text-2xl font-bold uppercase text-gray-800">${inst.NomeFantasia || 'Delícia da Cidade'}</h1>
                            <p class="text-sm text-gray-600">${inst.NomeCompleto || ''}</p>
                            <p class="text-sm text-gray-600">${inst.Endereco || ''}</p>
                            <p class="text-sm text-gray-600">Tel: ${inst.Telefone || '-'} | Email: ${inst.Email || '-'}</p>
                        </div>
                    </div>
                    <div class="text-right">
                        <h2 class="text-xl font-bold text-gray-800 uppercase">Recibo de Vencimento</h2>
                        <p class="text-sm text-gray-500">Ref: ${folha.Periodo}</p>
                    </div>
                </div>

                <!-- 2. DADOS DO FUNCIONÁRIO & 3. PERÍODO -->
                <div class="bg-gray-50 p-4 rounded border border-gray-200 mb-6">
                    <div class="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                        <div><span class="font-bold text-gray-600">Funcionário:</span> ${func.Nome}</div>
                        <div><span class="font-bold text-gray-600">Cargo:</span> ${func.Cargo || '-'}</div>
                        <div><span class="font-bold text-gray-600">Matrícula:</span> ${func.ID.slice(0,8).toUpperCase()}</div>
                        <div><span class="font-bold text-gray-600">Departamento:</span> ${func.Departamento || '-'}</div>
                        <div><span class="font-bold text-gray-600">Admissão:</span> ${Utils.formatDate(func.Admissao)}</div>
                        <div><span class="font-bold text-gray-600">NIF/BI:</span> ${func.BI || '-'}</div>
                        <div><span class="font-bold text-gray-600">Banco/IBAN:</span> ${folha.Banco || func.Banco || '-'} / ${folha.Iban || func.Iban || '-'}</div>
                        <div class="col-span-2 border-t border-gray-300 mt-2 pt-2 flex justify-between">
                            <span><span class="font-bold text-gray-600">Período:</span> ${folha.Periodo}</span>
                            <span><span class="font-bold text-gray-600">Processamento:</span> ${Utils.formatDate(folha.CriadoEm)}</span>
                        </div>
                    </div>
                </div>

                <!-- 4. PROVENTOS & 5. DESCONTOS -->
                <div class="mb-6">
                    <table class="w-full text-sm border-collapse border border-gray-300">
                        <thead class="bg-gray-100">
                            <tr>
                                <th class="border border-gray-300 p-2 text-left w-1/2">Descrição</th>
                                <th class="border border-gray-300 p-2 text-right w-1/4 text-green-700">Proventos (+)</th>
                                <th class="border border-gray-300 p-2 text-right w-1/4 text-red-700">Descontos (-)</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr><td class="border border-gray-300 p-2">Salário Base</td><td class="border border-gray-300 p-2 text-right">${kz(folha.SalarioBase)}</td><td class="border border-gray-300 p-2 text-right"></td></tr>
                            ${Number(folha.QtdHoraExtra) > 0 ? `<tr><td class="border border-gray-300 p-2">Horas Extras (${folha.QtdHoraExtra}h)</td><td class="border border-gray-300 p-2 text-right">${kz(Number(folha.QtdHoraExtra) * Number(folha.ValorHoraExtra))}</td><td class="border border-gray-300 p-2 text-right"></td></tr>` : ''}
                            ${Number(folha.Bonus) > 0 ? `<tr><td class="border border-gray-300 p-2">Bónus / Comissões</td><td class="border border-gray-300 p-2 text-right">${kz(folha.Bonus)}</td><td class="border border-gray-300 p-2 text-right"></td></tr>` : ''}
                            ${Number(folha.OutrosVencimentos) > 0 ? `<tr><td class="border border-gray-300 p-2">Outros Proventos</td><td class="border border-gray-300 p-2 text-right">${kz(folha.OutrosVencimentos)}</td><td class="border border-gray-300 p-2 text-right"></td></tr>` : ''}
                            
                            ${Number(folha.INSS) > 0 ? `<tr><td class="border border-gray-300 p-2">Segurança Social (INSS)</td><td class="border border-gray-300 p-2 text-right"></td><td class="border border-gray-300 p-2 text-right">${kz(folha.INSS)}</td></tr>` : ''}
                            ${Number(folha.IRT) > 0 ? `<tr><td class="border border-gray-300 p-2">Imposto s/ Rendimento (IRT)</td><td class="border border-gray-300 p-2 text-right"></td><td class="border border-gray-300 p-2 text-right">${kz(folha.IRT)}</td></tr>` : ''}
                            ${Number(folha.Faltas) > 0 ? `<tr><td class="border border-gray-300 p-2">Faltas / Atrasos</td><td class="border border-gray-300 p-2 text-right"></td><td class="border border-gray-300 p-2 text-right">${kz(folha.Faltas)}</td></tr>` : ''}
                            ${Number(folha.OutrosDescontos) > 0 ? `<tr><td class="border border-gray-300 p-2">Outros Descontos</td><td class="border border-gray-300 p-2 text-right"></td><td class="border border-gray-300 p-2 text-right">${kz(folha.OutrosDescontos)}</td></tr>` : ''}
                            
                            <tr class="bg-gray-50 font-bold">
                                <td class="border border-gray-300 p-2 text-right">TOTAIS</td>
                                <td class="border border-gray-300 p-2 text-right text-green-800">${kz(folha.TotalVencimentos)}</td>
                                <td class="border border-gray-300 p-2 text-right text-red-800">${kz(folha.TotalDescontos)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <!-- 6. RESULTADO FINAL -->
                <div class="flex justify-end mb-8">
                    <div class="bg-gray-100 border border-gray-300 p-4 rounded w-1/3">
                        <div class="flex justify-between mb-2 text-sm">
                            <span>Total Bruto:</span>
                            <span>${kz(folha.TotalVencimentos)}</span>
                        </div>
                        <div class="flex justify-between mb-2 text-sm text-red-600">
                            <span>Total Descontos:</span>
                            <span>- ${kz(folha.TotalDescontos)}</span>
                        </div>
                        <div class="flex justify-between border-t border-gray-300 pt-2 font-bold text-lg text-blue-800">
                            <span>Líquido a Receber:</span>
                            <span>${kz(folha.SalarioLiquido)}</span>
                        </div>
                    </div>
                </div>

                <!-- 8. ASSINATURAS -->
                <div class="grid grid-cols-2 gap-16 mt-12 pt-8">
                    <div class="text-center">
                        <div class="border-t border-gray-400 w-3/4 mx-auto mb-2"></div>
                        <p class="font-bold text-sm text-gray-700">O Empregador</p>
                        <p class="text-xs text-gray-500">(Assinatura e Carimbo)</p>
                    </div>
                    <div class="text-center">
                        <div class="border-t border-gray-400 w-3/4 mx-auto mb-2"></div>
                        <p class="font-bold text-sm text-gray-700">O Funcionário</p>
                        <p class="text-xs text-gray-500">${func.Nome}</p>
                    </div>
                </div>

                <div class="mt-12 text-center text-[10px] text-gray-400 border-t pt-2">
                    &copy; 2026 Delícia da Cidade. Todos os direitos reservados. | Versão 1.0.0
                </div>
            </div>
        `;

        Utils.printNative(html);
    },

    // --- 7. ABA LICENÇAS E AUSÊNCIAS ---
    renderLicencas: async () => {
        RHModule.highlightTab('tab-licencas');

        if (!RHModule.state.cache.licencas) {
            document.getElementById('tab-content').innerHTML = '<div class="text-center p-10"><i class="fas fa-spinner fa-spin text-4xl text-blue-600"></i><p class="mt-2">Carregando licenças...</p></div>';
            try {
                RHModule.state.cache.licencas = await Utils.api('getAll', 'Licencas');
            } catch (e) { return Utils.toast('Erro ao carregar dados.', 'error'); }
        }

        const data = RHModule.state.cache.licencas || [];
        const canCreate = Utils.checkPermission('RH', 'criar');
        const canDelete = Utils.checkPermission('RH', 'excluir');
        document.getElementById('tab-content').innerHTML = `
            <div class="flex justify-end gap-2 mb-4">
                <button onclick="RHModule.printTabPDF('licencas')" class="bg-red-600 text-white px-4 py-2 rounded shadow hover:bg-red-700"><i class="fas fa-file-pdf"></i> PDF</button>
                ${canCreate ? `<button onclick="RHModule.modalLicencas()" class="bg-blue-600 text-white px-4 py-2 rounded">+ Nova Licença/Ausência</button>` : ''}
            </div>
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
    renderRelatorios: async () => {
        RHModule.highlightTab('tab-relatorios');
        
        // Relatórios dependem de Frequência (para atrasos). Carregar se necessário.
        if (!RHModule.state.cache.frequencia) {
            document.getElementById('tab-content').innerHTML = '<div class="text-center p-10"><i class="fas fa-spinner fa-spin text-4xl text-blue-600"></i><p class="mt-2">Carregando dados para relatórios...</p></div>';
            try {
                RHModule.state.cache.frequencia = await Utils.api('getAll', 'Frequencia');
            } catch (e) { return Utils.toast('Erro ao carregar dados.', 'error'); }
        }
        
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
                    <button onclick="RHModule.renderComissoes()" class="bg-green-600 text-white px-4 py-2 rounded ml-auto"><i class="fas fa-dollar-sign"></i> Comissões</button>
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

    renderComissoes: async () => {
        const start = document.getElementById('rel-inicio').value;
        const end = document.getElementById('rel-fim').value;
        
        if (!start || !end) return Utils.toast('Selecione um período (De/Até) para calcular comissões.', 'warning');

        document.getElementById('relatorio-results').innerHTML = '<div class="text-center p-10"><i class="fas fa-spinner fa-spin text-4xl text-green-600"></i><p>Calculando vendas...</p></div>';

        try {
            const data = await Utils.api('getWaiterSales', null, { startDate: start, endDate: end });
            
            let html = `
                <h4 class="text-lg font-bold text-green-700 mb-4 border-b border-green-200 pb-2">💰 Relatório de Vendas e Comissões (${Utils.formatDate(start)} a ${Utils.formatDate(end)})</h4>
                <div class="bg-white rounded shadow overflow-hidden">
                    <table class="w-full text-sm text-left">
                        <thead class="bg-green-50 text-green-800">
                            <tr>
                                <th class="p-3">Funcionário / Garçom</th>
                                <th class="p-3 text-center">Qtd Eventos</th>
                                <th class="p-3 text-right">Total Vendas</th>
                                <th class="p-3 text-right">Comissão (10%)</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y">
                            ${data.map(r => `
                                <tr class="hover:bg-green-50">
                                    <td class="p-3 font-bold">${r.name}</td>
                                    <td class="p-3 text-center">${r.count}</td>
                                    <td class="p-3 text-right">${Utils.formatCurrency(r.total)}</td>
                                    <td class="p-3 text-right font-bold text-green-600">${Utils.formatCurrency(r.commission)}</td>
                                </tr>
                            `).join('')}
                            ${data.length === 0 ? '<tr><td colspan="4" class="p-4 text-center text-gray-500">Nenhuma venda registrada com responsável neste período.</td></tr>' : ''}
                        </tbody>
                    </table>
                </div>
            `;
            document.getElementById('relatorio-results').innerHTML = html;
        } catch (e) { Utils.toast('Erro ao calcular comissões.', 'error'); }
    },

    updateRelatorios: () => {
        const start = document.getElementById('rel-inicio').value;
        const end = document.getElementById('rel-fim').value;
        const mesAniversario = document.getElementById('rel-mes-aniversario') ? document.getElementById('rel-mes-aniversario').value : (new Date().getMonth() + 1);
        let funcs = RHModule.state.cache.funcionarios || [];
        const ferias = RHModule.state.cache.ferias || [];
        const frequencia = RHModule.state.cache.frequencia || [];

        // --- ANIVERSARIANTES DO MÊS ---
        // --- ALERTA DE 1 ANO DE CASA ---
        // --- RELATÓRIO DE FÉRIAS VENCIDAS ---
        const vencidas = [];
        const hoje = new Date();
        
        funcs.forEach(f => {
            if(!f.Admissao) return;
            const adm = new Date(f.Admissao);
            // Cálculo aproximado de anos de casa
            const diffTime = Math.abs(hoje - adm);
            const diffYears = diffTime / (1000 * 60 * 60 * 24 * 365.25); 
            
            // Alerta de 1 ano exato (com margem de 1 mês)
            if (diffYears >= 1 && diffYears < 1.1) {
                Utils.toast(`🎉 ${f.Nome} completou 1 ano de casa! Direito a férias adquirido.`, 'info');
            }
            const direito = Math.floor(diffYears) * 30; // 30 dias por ano
            
            const taken = ferias
                .filter(r => r.FuncionarioID === f.ID && r.Status === 'Aprovado')
                .reduce((acc, r) => acc + (Number(r.Dias) || 0), 0);
                
            const saldo = direito - taken;
            
            if(saldo > 30) vencidas.push({ nome: f.Nome, saldo: Math.floor(saldo), dept: f.Departamento });
        });

        // --- ANIVERSARIANTES DO MÊS ---
        const mesSelecionado = Number(mesAniversario);
        const aniversariantes = funcs.filter(f => {
            if (!f.Nascimento) return false;
            const d = new Date(f.Nascimento);
            return (d.getMonth() + 1) === mesSelecionado;
        }).sort((a, b) => new Date(a.Nascimento).getDate() - new Date(b.Nascimento).getDate());


        // --- RELATÓRIO DE PONTUALIDADE (ATRASOS) ---
        const atrasosMap = {};
        const evolutionMap = {}; // Para o gráfico de linha
        const tempoCasaMap = { '< 1 Ano': 0, '1-3 Anos': 0, '> 3 Anos': 0 };

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

        // Cálculo de Tempo de Casa para Gráfico
        funcs.forEach(f => {
            if(!f.Admissao) return;
            const anos = (hoje - new Date(f.Admissao)) / (1000 * 60 * 60 * 24 * 365.25);
            if (anos < 1) tempoCasaMap['< 1 Ano']++;
            else if (anos <= 3) tempoCasaMap['1-3 Anos']++;
            else tempoCasaMap['> 3 Anos']++;
        });

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

        const htmlAniversariantes = `
            <div class="mt-8 mb-8">
                <h4 class="text-lg font-bold text-blue-700 mb-4 border-b border-blue-200 pb-2">🎂 Aniversariantes</h4>
                <div class="mb-2 flex items-center gap-2"><label class="text-xs font-bold text-gray-500 mr-2">Filtrar Mês:</label><select id="rel-mes-aniversario" onchange="RHModule.updateRelatorios()" class="border p-1 rounded text-sm"><option value="1" ${mesSelecionado===1?'selected':''}>Janeiro</option><option value="2" ${mesSelecionado===2?'selected':''}>Fevereiro</option><option value="3" ${mesSelecionado===3?'selected':''}>Março</option><option value="4" ${mesSelecionado===4?'selected':''}>Abril</option><option value="5" ${mesSelecionado===5?'selected':''}>Maio</option><option value="6" ${mesSelecionado===6?'selected':''}>Junho</option><option value="7" ${mesSelecionado===7?'selected':''}>Julho</option><option value="8" ${mesSelecionado===8?'selected':''}>Agosto</option><option value="9" ${mesSelecionado===9?'selected':''}>Setembro</option><option value="10" ${mesSelecionado===10?'selected':''}>Outubro</option><option value="11" ${mesSelecionado===11?'selected':''}>Novembro</option><option value="12" ${mesSelecionado===12?'selected':''}>Dezembro</option></select> <button onclick="RHModule.printAniversariantesFestivo()" class="text-xs bg-pink-500 text-white px-2 py-1 rounded hover:bg-pink-600"><i class="fas fa-birthday-cake"></i> PDF Festivo</button></div>
                <div class="bg-white p-4 border rounded shadow overflow-x-auto">
                    <table class="w-full text-sm">
                        <thead class="bg-blue-50 text-blue-800">
                            <tr><th class="p-2 text-left">Dia</th><th class="p-2 text-left">Funcionário</th><th class="p-2 text-left">Departamento</th></tr>
                        </thead>
                        <tbody>
                            ${aniversariantes.map(a => `<tr class="border-b"><td class="p-2 font-bold">${new Date(a.Nascimento).getDate()}</td><td class="p-2">${a.Nome}</td><td class="p-2">${a.Departamento || '-'}</td></tr>`).join('')}
                            ${aniversariantes.length === 0 ? '<tr><td colspan="3" class="p-4 text-center text-gray-500">Nenhum aniversariante neste mês.</td></tr>' : ''}
                        </tbody>
                    </table>
                </div>
            </div>`;

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

            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                <div class="bg-white p-4 border rounded shadow">
                    <h4 class="font-bold text-gray-700 mb-4">Média Salarial por Departamento (Kz)</h4>
                    <div class="h-64"><canvas id="chartSalarios"></canvas></div>
                </div>
                <div class="bg-white p-4 border rounded shadow">
                    <h4 class="font-bold text-gray-700 mb-4">Evolução de Atrasos</h4>
                    <div class="h-64"><canvas id="chartEvolucaoAtrasos"></canvas></div>
                </div>
                <div class="bg-white p-4 border rounded shadow">
                    <h4 class="font-bold text-gray-700 mb-4">Tempo de Casa</h4>
                    <div class="h-64"><canvas id="chartTempoCasa"></canvas></div>
                </div>
            </div>
        ` + htmlAniversariantes + htmlVencidas + htmlAtrasos;

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

            new Chart(document.getElementById('chartTempoCasa'), {
                type: 'bar',
                data: {
                    labels: Object.keys(tempoCasaMap),
                    datasets: [{
                        label: 'Funcionários',
                        data: Object.values(tempoCasaMap),
                        backgroundColor: ['#60A5FA', '#34D399', '#FBBF24']
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
            });
        } else if (total === 0) {
            document.getElementById('relatorio-results').innerHTML = '<p class="text-center text-gray-500 py-10">Nenhum funcionário encontrado neste período.</p>';
        }
    },

    exportPDF: () => {
        const inst = RHModule.state.cache.instituicao[0] || {};
        const user = Utils.getUser();
        const showLogo = inst.ExibirLogoRelatorios;
        
        // Captura o conteúdo atual do relatório
        const content = document.getElementById('relatorio-results').innerHTML;
        
        const html = `
            <div class="mb-4 border-b pb-2 ${showLogo && inst.LogotipoURL ? 'flex items-center gap-4' : ''}">
                ${showLogo && inst.LogotipoURL ? `<img src="${inst.LogotipoURL}" class="h-16 w-auto object-contain">` : ''}
                <div>
                    <h1 class="text-2xl font-bold text-gray-800">${inst.NomeFantasia || 'Delícia da Cidade'}</h1>
                    <p class="text-sm text-gray-500">${inst.Endereco || ''} | ${inst.Telefone || ''}</p>
                </div>
            </div>
            
            ${content}
            
            <div class="mt-10 pt-4 border-t text-center">
                <p class="font-bold text-gray-800">${user.Nome}</p>
                <p class="text-sm text-gray-600">${user.Assinatura || ''}</p>
                <p class="text-xs text-gray-400 mt-1">&copy; 2026 Delícia da Cidade. Todos os direitos reservados. | Versão 1.0.0</p>
            </div>
        `;
        
        Utils.printNative(html);
    },

    printAniversariantesFestivo: () => {
        const mesSelect = document.getElementById('rel-mes-aniversario');
        const mes = Number(mesSelect.value);
        const mesNome = mesSelect.options[mesSelect.selectedIndex].text;
        
        const funcs = RHModule.state.cache.funcionarios.filter(f => {
            if (!f.Nascimento) return false;
            const d = new Date(f.Nascimento);
            return (d.getMonth() + 1) === mes;
        }).sort((a, b) => new Date(a.Nascimento).getDate() - new Date(b.Nascimento).getDate());

        if (funcs.length === 0) return Utils.toast('Nenhum aniversariante neste mês.', 'warning');

        const html = `
            <div style="font-family: 'Comic Sans MS', 'Chalkboard SE', sans-serif; padding: 20px; border: 5px double #FF69B4; border-radius: 15px; background-color: #FFF0F5; text-align: center;">
                <h1 style="color: #FF1493; font-size: 32px; margin-bottom: 5px;">🎉 Feliz Aniversário! 🎉</h1>
                <h2 style="color: #C71585; font-size: 24px; margin-top: 0;">Aniversariantes de ${mesNome}</h2>
                <p style="color: #555; font-style: italic;">"A vida é um presente, e cada aniversário é um novo começo."</p>
                
                <div style="margin-top: 30px; display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px;">
                    ${funcs.map(f => {
                        const dia = new Date(f.Nascimento).getDate();
                        return `
                        <div style="background: white; padding: 15px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); border: 2px solid #FFB6C1; display: flex; align-items: center; gap: 15px;">
                            <div style="background: #FF69B4; color: white; width: 50px; height: 50px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 20px;">
                                ${dia}
                            </div>
                            <div style="text-align: left;">
                                <div style="font-weight: bold; font-size: 18px; color: #333;">${f.Nome}</div>
                                <div style="color: #666; font-size: 14px;">${f.Departamento || 'Equipe'}</div>
                            </div>
                        </div>
                        `;
                    }).join('')}
                </div>

                <div style="margin-top: 40px; font-size: 12px; color: #888;">
                    🎈 Desejamos muitas felicidades, saúde e sucesso a todos! 🎈
                </div>
            </div>
            <style>
                @media print {
                    body { -webkit-print-color-adjust: exact; }
                    @page { margin: 10mm; }
                }
            </style>
        `;

        Utils.printNative(html);
    },

    printIndividualFrequency: (funcId) => {
        const func = RHModule.state.cache.funcionarios.find(f => f.ID === funcId);
        if (!func) return Utils.toast('Funcionário não encontrado.', 'error');

        // Determinar o mês do relatório (baseado no filtro ou mês atual)
        let targetMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
        if (RHModule.state.filterFrequenciaStart) {
            targetMonth = RHModule.state.filterFrequenciaStart.slice(0, 7);
        }

        const [year, month] = targetMonth.split('-');
        const daysInMonth = new Date(year, month, 0).getDate();
        
        // Filtrar registros do funcionário no mês
        const records = RHModule.state.cache.frequencia.filter(r => 
            r.FuncionarioID === funcId && r.Data.startsWith(targetMonth)
        );

        // Cálculos do Resumo
        let presencas = 0;
        let faltas = 0;
        let faltasJustificadas = 0;
        let atrasos = 0;
        let totalHoras = 0;
        let diasUteis = 0; // Aproximação (dias com registro ou dias úteis do mês)

        // Mapa de registros por dia para preencher a tabela completa
        const mapRecords = {};
        records.forEach(r => {
            mapRecords[r.Data] = r;
            
            if (r.Status === 'Presente') presencas++;
            else if (r.Status === 'Falta') faltas++;
            else if (r.Status === 'Falta Justificada') faltasJustificadas++;
            else if (r.Status === 'Atraso') atrasos++;

            // Cálculo de horas (simplificado)
            if (r.Entrada && r.Saida) {
                const [h1, m1] = r.Entrada.split(':').map(Number);
                const [h2, m2] = r.Saida.split(':').map(Number);
                let diff = (h2 * 60 + m2) - (h1 * 60 + m1);
                if (diff < 0) diff += 24 * 60; // Virada de dia
                totalHoras += diff / 60;
            }
        });

        // Gerar linhas da tabela (1 a 31)
        let rowsHtml = '';
        for (let i = 1; i <= daysInMonth; i++) {
            const dayStr = `${year}-${month}-${String(i).padStart(2, '0')}`;
            const dateObj = new Date(dayStr);
            const dayOfWeek = dateObj.getDay(); // 0=Dom, 6=Sab
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            
            if (!isWeekend) diasUteis++;

            const r = mapRecords[dayStr] || {};
            const entrada = r.Entrada || '—';
            const saida = r.Saida || '—';
            const status = r.Status || (isWeekend ? 'Folga' : '—');
            const obs = r.Observacoes || '—';
            
            let horasDia = '0h';
            if (r.Entrada && r.Saida) {
                const [h1, m1] = r.Entrada.split(':').map(Number);
                const [h2, m2] = r.Saida.split(':').map(Number);
                let diff = (h2 * 60 + m2) - (h1 * 60 + m1);
                if (diff < 0) diff += 24 * 60;
                const h = Math.floor(diff / 60);
                const m = diff % 60;
                horasDia = `${h}h${m > 0 ? String(m).padStart(2,'0') : ''}`;
            }

            rowsHtml += `
                <tr class="${isWeekend ? 'bg-gray-100' : ''}">
                    <td class="border p-1 text-center">${String(i).padStart(2, '0')}/${month}</td>
                    <td class="border p-1 text-center">${entrada}</td>
                    <td class="border p-1 text-center">${saida}</td>
                    <td class="border p-1 text-center">${horasDia}</td>
                    <td class="border p-1 text-center text-xs">${status}</td>
                    <td class="border p-1 text-xs">${obs}</td>
                </tr>
            `;
        }

        const inst = RHModule.state.cache.instituicao[0] || {};
        const showLogo = inst.ExibirLogoRelatorios;

        const html = `
            <div class="p-8 font-sans text-gray-900 bg-white">
                <div class="flex items-center justify-between border-b-2 border-gray-800 pb-4 mb-6">
                    <div class="${showLogo && inst.LogotipoURL ? 'flex items-center gap-4' : ''}">
                        ${showLogo && inst.LogotipoURL ? `<img src="${inst.LogotipoURL}" class="h-16 w-auto object-contain">` : ''}
                        <div>
                            <h1 class="text-xl font-bold uppercase">${inst.NomeFantasia || 'Delícia da Cidade'}</h1>
                            <p class="text-sm text-gray-600">Folha Mensal de Presença</p>
                        </div>
                    </div>
                    <div class="text-right">
                        <p class="text-sm font-bold">Mês/Ano: ${month}/${year}</p>
                        <p class="text-xs text-gray-500">Gerado em: ${new Date().toLocaleDateString()}</p>
                    </div>
                </div>

                <div class="mb-6 bg-gray-50 p-4 rounded border border-gray-200">
                    <h3 class="font-bold border-b border-gray-300 mb-2 uppercase text-sm">Dados do Funcionário</h3>
                    <div class="grid grid-cols-2 gap-4 text-sm">
                        <div><span class="font-bold">Nome:</span> ${func.Nome}</div>
                        <div><span class="font-bold">Cargo:</span> ${func.Cargo || '-'}</div>
                        <div><span class="font-bold">ID:</span> ${func.ID.slice(0,8).toUpperCase()}</div>
                        <div><span class="font-bold">Turno:</span> ${func.Turno || '-'}</div>
                    </div>
                </div>

                <h3 class="font-bold text-gray-800 mb-2 text-sm uppercase">Frequência Mensal</h3>
                <table class="w-full text-sm border-collapse border border-gray-300 mb-6">
                    <thead class="bg-gray-100">
                        <tr>
                            <th class="border p-2 text-center">Data</th>
                            <th class="border p-2 text-center">Entrada</th>
                            <th class="border p-2 text-center">Saída</th>
                            <th class="border p-2 text-center">Horas</th>
                            <th class="border p-2 text-center">Status</th>
                            <th class="border p-2 text-left">Observação</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                </table>

                <div class="flex gap-8 mb-8">
                    <div class="w-1/2">
                        <h3 class="font-bold text-gray-800 mb-2 text-sm uppercase">Resumo do Mês</h3>
                        <table class="w-full text-sm border-collapse border border-gray-300">
                            <tr><td class="border p-2 bg-gray-50">Dias Úteis (Est.)</td><td class="border p-2 text-right">${diasUteis}</td></tr>
                            <tr><td class="border p-2 bg-gray-50">Presenças</td><td class="border p-2 text-right">${presencas}</td></tr>
                            <tr><td class="border p-2 bg-gray-50">Faltas</td><td class="border p-2 text-right">${faltas}</td></tr>
                            <tr><td class="border p-2 bg-gray-50">Faltas Justificadas</td><td class="border p-2 text-right">${faltasJustificadas}</td></tr>
                            <tr><td class="border p-2 bg-gray-50">Atrasos</td><td class="border p-2 text-right">${atrasos}</td></tr>
                            <tr class="font-bold"><td class="border p-2 bg-gray-100">Total Horas</td><td class="border p-2 text-right">${totalHoras.toFixed(2)}h</td></tr>
                        </table>
                    </div>
                    <div class="w-1/2 flex flex-col justify-end">
                        <div class="mb-8 text-center">
                            <div class="border-t border-gray-400 w-3/4 mx-auto mb-1"></div>
                            <p class="text-xs font-bold">Funcionário</p>
                        </div>
                        <div class="text-center">
                            <div class="border-t border-gray-400 w-3/4 mx-auto mb-1"></div>
                            <p class="text-xs font-bold">RH / Supervisor</p>
                        </div>
                    </div>
                </div>

                <div class="mt-4 text-center text-xs text-gray-400 border-t pt-2">
                    &copy; 2026 Delícia da Cidade. Todos os direitos reservados. | Versão 1.0.0
                </div>
            </div>
        `;

        Utils.printNative(html);
    },

    printTabPDF: (type) => {
        const inst = RHModule.state.cache.instituicao[0] || {};
        const showLogo = inst.ExibirLogoRelatorios;
        const user = Utils.getUser();
        let title = '';
        let filename = '';
        let content = '';
        let orientation = 'portrait';

        // Helper para construir tabela
        const buildTable = (headers, rows) => `
            <table class="w-full text-sm border-collapse border border-gray-300">
                <thead class="bg-gray-100">
                    <tr>${headers.map(h => `<th class="border p-2 text-left">${h}</th>`).join('')}</tr>
                </thead>
                <tbody>
                    ${rows.map(row => `<tr>${row.map(cell => `<td class="border p-2">${cell || '-'}</td>`).join('')}</tr>`).join('')}
                </tbody>
            </table>
        `;

        if (type === 'funcionarios') {
            title = 'Lista de Funcionários';
            filename = 'funcionarios.pdf';
            orientation = 'landscape';
            let data = RHModule.state.cache.funcionarios || [];
            
            // Aplicar filtros atuais
            if (RHModule.state.filterTerm) {
                const term = RHModule.state.filterTerm.toLowerCase();
                data = data.filter(f => 
                    (f.Nome && f.Nome.toLowerCase().includes(term)) || 
                    (f.BI && f.BI.toLowerCase().includes(term)) ||
                    (f.Departamento && f.Departamento.toLowerCase().includes(term))
                );
            }
            data.sort((a, b) => a.Nome.localeCompare(b.Nome));

            const headers = ['ID', 'Nome', 'Cargo', 'Departamento', 'Turno', 'Telefone', 'Admissão', 'Status'];
            const rows = data.map(f => [f.ID, f.Nome, f.Cargo, f.Departamento || '-', f.Turno || '-', f.Telefone || '-', Utils.formatDate(f.Admissao), f.Status]);
            content = buildTable(headers, rows);
        }
        else if (type === 'frequencia') {
            title = 'Relatório de Frequência';
            filename = 'frequencia.pdf';
            let data = RHModule.state.cache.frequencia || [];

            // Aplicar filtro de data também no PDF
            const { filterFrequenciaStart, filterFrequenciaEnd } = RHModule.state;
            if (filterFrequenciaStart) {
                data = data.filter(r => r.Data >= filterFrequenciaStart);
            }
            if (filterFrequenciaEnd) {
                data = data.filter(r => r.Data <= filterFrequenciaEnd);
            }

            data.sort((a,b) => new Date(b.Data) - new Date(a.Data));
            
            const headers = ['ID', 'Nome', 'Data', 'Entrada', 'Saída', 'Total', 'Status'];
            const rows = data.map(r => {
                const func = RHModule.state.cache.funcionarios.find(f => f.ID === r.FuncionarioID);
                const is24h = func && func.Turno === 'Regime de Turno';
                const refHours = is24h ? 24 : 8;
                
                const calcHours = (start, end, is24h) => {
                    if(!start || !end) return 0;
                    const [h1, m1] = start.split(':').map(Number);
                    const [h2, m2] = end.split(':').map(Number);
                    let diff = (h2*60+m2) - (h1*60+m1);
                    if (diff <= 0) diff += 24 * 60; 
                    else if (is24h && diff < 240) diff += 24 * 60;
                    return diff / 60;
                };
                
                const total = calcHours(r.Entrada, r.Saida, is24h);
                const diff = total - refHours;
                
                let statusText = 'Normal';
                if (total === 0) statusText = '1 Falta';
                else if (diff < 0) statusText = `Meia Falta (${diff.toFixed(1)}h)`;
                else if (diff > 0) statusText = `Extra: +${diff.toFixed(1)}h`;
                
                return [r.ID, r.FuncionarioNome, Utils.formatDate(r.Data), r.Entrada, r.Saida, total.toFixed(2)+'h', statusText];
            });
            content = buildTable(headers, rows);
        } 
        else if (type === 'ferias') {
            title = 'Relatório de Férias';
            filename = 'ferias.pdf';
            const data = RHModule.state.cache.ferias || [];
            const headers = ['ID', 'Nome', 'Início', 'Retorno', 'Dias', 'Status'];
            const rows = data.map(r => [r.ID, r.FuncionarioNome, Utils.formatDate(r.DataInicio), Utils.formatDate(r.DataFim), r.Dias, r.Status]);
            content = buildTable(headers, rows);
        }
        else if (type === 'avaliacoes') {
            title = 'Relatório de Avaliações';
            filename = 'avaliacoes.pdf';
            const data = RHModule.state.cache.avaliacoes || [];
            const headers = ['ID', 'Funcionário', 'Data', 'Média', 'Conclusão'];
            const rows = data.map(r => [r.ID, r.FuncionarioNome, Utils.formatDate(r.DataAvaliacao), r.MediaFinal, r.Conclusao]);
            content = buildTable(headers, rows);
        }
        else if (type === 'treinamento') {
            title = 'Relatório de Treinamentos';
            filename = 'treinamentos.pdf';
            orientation = 'landscape';
            const data = RHModule.state.cache.treinamentos || [];
            const headers = ['ID', 'Nome', 'Título', 'Tipo', 'Início', 'Término', 'Status'];
            const rows = data.map(r => [r.ID, r.FuncionarioNome, r.Titulo, r.Tipo, Utils.formatDate(r.Inicio), Utils.formatDate(r.Termino), r.Status]);
            content = buildTable(headers, rows);
        }
        else if (type === 'folha') {
            title = 'Folha de Pagamento';
            filename = 'folha.pdf';
            orientation = 'landscape';
            const data = RHModule.state.cache.folha || [];
            const headers = ['ID', 'Nome', 'Período', 'Base', 'Vencimentos', 'Descontos', 'Líquido', 'Banco'];
            const rows = data.map(r => [r.ID, r.FuncionarioNome, r.Periodo, Utils.formatCurrency(r.SalarioBase), Utils.formatCurrency(r.TotalVencimentos), Utils.formatCurrency(r.TotalDescontos), Utils.formatCurrency(r.SalarioLiquido), r.Banco]);
            content = buildTable(headers, rows);
        }
        else if (type === 'licencas') {
            title = 'Relatório de Licenças';
            filename = 'licencas.pdf';
            const data = RHModule.state.cache.licencas || [];
            const headers = ['ID', 'Funcionário', 'Tipo', 'Início', 'Retorno'];
            const rows = data.map(r => [r.ID, r.FuncionarioNome, r.Tipo, Utils.formatDate(r.Inicio), Utils.formatDate(r.Retorno)]);
            content = buildTable(headers, rows);
        }

        const html = `
            <div class="p-8 font-sans text-gray-900 bg-white">
                <div class="flex items-center justify-between border-b-2 border-gray-800 pb-4 mb-6">
                    <div class="${showLogo && inst.LogotipoURL ? 'flex items-center gap-4' : ''}">
                        ${showLogo && inst.LogotipoURL ? `<img src="${inst.LogotipoURL}" class="h-16 w-auto object-contain" crossorigin="anonymous">` : ''}
                        <div>
                            <h1 class="text-2xl font-bold uppercase">${inst.NomeFantasia || 'Delícia da Cidade'}</h1>
                            <p class="text-sm">${inst.Endereco || ''}</p>
                        </div>
                    </div>
                    <div class="text-right">
                        <h2 class="text-xl font-bold">${title.toUpperCase()}</h2>
                        <p class="text-sm">Gerado em: ${new Date().toLocaleDateString()}</p>
                        <p class="text-xs text-gray-500">Por: ${user.Nome}</p>
                    </div>
                </div>
                ${content}
                <div class="mt-8 text-center text-xs text-gray-400">&copy; 2026 Delícia da Cidade. Todos os direitos reservados. | Versão 1.0.0</div>
            </div>
        `;

        Utils.printNative(html, orientation);
    },

    // --- GENÉRICOS ---
    save: async (e, table) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target).entries());

        // Limpeza de Máscaras (Salário)
        if (table === 'Funcionarios' && data.Salario) {
            // Remove 'Kz', espaços e pontos de milhar, troca vírgula decimal por ponto
            // Ex: "Kz 1.500,00" -> "1500.00"
            data.Salario = parseFloat(data.Salario.replace(/[^0-9,]/g, '').replace(',', '.')) || 0;
        }

        // --- VALIDAÇÃO DE DUPLICIDADE (BI/NIF) ---
        if (table === 'Funcionarios') {
            const bi = data.BI ? data.BI.trim().toUpperCase() : '';
            if (bi) {
                const duplicado = RHModule.state.cache.allFuncionarios.find(f => 
                    f.BI && f.BI.trim().toUpperCase() === bi && f.ID !== data.ID
                );
                if (duplicado) {
                    return Utils.toast(`⚠️ O BI/NIF ${bi} já está cadastrado para: ${duplicado.Nome}`, 'error');
                }
            }
        }


        // Geração Automática de ID para Funcionários (Iniciais + Sequencial Global)
        if (table === 'Funcionarios' && !data.ID) {
            const nome = data.Nome.trim();
            if (nome) {
                const parts = nome.split(' ');
                const first = parts[0][0].toUpperCase();
                // Lida com nomes de uma só palavra (ex: "Maria" -> "MM")
                const last = parts.length > 1 ? parts[parts.length - 1][0].toUpperCase() : first;
                const prefix = first + last;
 
                // Lógica Corrigida: Busca o MAIOR número sequencial já existente em qualquer ID
                // Isso garante a ordem histórica (ex: se existe o 05, o próximo será 06, independente de quantos ativos existem)
                let maxSeq = 0;
                RHModule.state.cache.funcionarios.forEach(f => {
                    if (f.ID && f.ID.includes('-')) {
                        const partsId = f.ID.split('-');
                        const seq = parseInt(partsId[partsId.length - 1]); // Pega o número final
                        if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
                    }
 });
                
                data.ID = `${prefix}-${String(maxSeq + 1).padStart(2, '0')}`;
            }
        }

        // Lógica de Upload de Foto (Funcionários)
        if (table === 'Funcionarios') {
            const fileInput = document.getElementById('foto-file');
            if (fileInput && fileInput.files[0]) {
                try {
                    const toBase64 = file => new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.readAsDataURL(file);
                        reader.onload = () => resolve(reader.result);
                        reader.onerror = error => reject(error);
                    });
                    data.FotoURL = await toBase64(fileInput.files[0]);
                } catch (err) { return Utils.toast('Erro ao processar foto: ' + err.message); }
            }
        }

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
            // Validação removida para permitir turnos de 24h ou noturnos (que viram o dia)
            // if (data.Saida && data.Entrada && data.Saida <= data.Entrada) return Utils.toast('⚠️ Erro: A hora de saída deve ser posterior à entrada.');
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
            
            // Pack details into DetalhesJSON
            const detalhes = {};
            ['N1', 'N2', 'N3', 'N4', 'N5', 'N6', 'N7', 'N8', 'N9', 'PontosFortes', 'PontosMelhorar', 'Comentarios'].forEach(k => {
                if (data[k] !== undefined) {
                    detalhes[k] = data[k];
                    delete data[k]; // Remove from top level to avoid column error if strict
                }
            });
            data.DetalhesJSON = detalhes;
        }
        if (table === 'Folha') {
            if (!data.FuncionarioID) return Utils.toast('⚠️ Erro: Selecione um funcionário.');
            if (!data.Periodo) return Utils.toast('⚠️ Erro: O período de referência é obrigatório.');
            if (Number(data.SalarioLiquido) < 0) return Utils.toast('⚠️ Erro: O salário líquido não pode ser negativo. Revise os descontos.');
        }

        try {
            await Utils.api('save', table, data);
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
            await Utils.api('delete', table, null, id);
            RHModule.fetchData();
        }
    }
};

document.addEventListener('DOMContentLoaded', RHModule.init);