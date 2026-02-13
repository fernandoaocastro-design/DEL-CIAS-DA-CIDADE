const ConfigModule = {
    state: {
        config: {}
    },

    init: async () => {
        try {
            const configs = await Utils.api('getAll', 'InstituicaoConfig');
            ConfigModule.state.config = configs[0] || {};
            ConfigModule.render();
        } catch (e) {
            console.error(e);
            Utils.toast('Erro ao carregar configurações.', 'error');
        }
    },

    render: () => {
        const c = ConfigModule.state.config;
        const container = document.getElementById('config-content');

        container.innerHTML = `
            <form onsubmit="ConfigModule.save(event)" class="space-y-6">
                <input type="hidden" name="ID" value="${c.ID || ''}">
                
                <!-- 1. Identidade Visual -->
                <div class="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <h3 class="text-lg font-bold text-gray-800 mb-4 border-b pb-2 flex items-center gap-2">
                        <i class="fas fa-image text-indigo-600"></i> Identidade Visual
                    </h3>
                    
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div class="col-span-1 flex flex-col items-center justify-center">
                            <div class="w-40 h-40 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-gray-50 mb-3 overflow-hidden relative group">
                                <img id="preview-logo" src="${c.LogotipoURL || ''}" class="${c.LogotipoURL ? '' : 'hidden'} w-full h-full object-contain p-2">
                                <div class="${c.LogotipoURL ? 'hidden' : ''} text-center p-4 text-gray-400" id="placeholder-logo">
                                    <i class="fas fa-cloud-upload-alt text-3xl mb-2"></i>
                                    <p class="text-xs">Sem Logotipo</p>
                                </div>
                                <div class="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition cursor-pointer" onclick="document.getElementById('logo-input').click()">
                                    <span class="text-white text-sm font-bold"><i class="fas fa-edit"></i> Alterar</span>
                                </div>
                            </div>
                            <input type="file" id="logo-input" accept="image/*" class="hidden" onchange="ConfigModule.handleLogoPreview(this)">
                            <input type="hidden" name="LogotipoURL" value="${c.LogotipoURL || ''}">
                            <p class="text-xs text-gray-500 text-center">Recomendado: PNG Transparente (300x300px)</p>
                        </div>
                        
                        <div class="col-span-2 space-y-4">
                            <div>
                                <label class="block text-sm font-bold text-gray-700 mb-1">Nome Fantasia (Sistema)</label>
                                <input name="NomeFantasia" value="${c.NomeFantasia || ''}" class="w-full border p-2 rounded focus:ring-2 focus:ring-indigo-500" required>
                            </div>
                            <div>
                                <label class="block text-sm font-bold text-gray-700 mb-1">Razão Social (Relatórios)</label>
                                <input name="NomeCompleto" value="${c.NomeCompleto || ''}" class="w-full border p-2 rounded focus:ring-2 focus:ring-indigo-500">
                            </div>
                            <div class="flex items-center gap-4 mt-4">
                                <label class="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" name="ExibirLogoRelatorios" class="w-5 h-5 text-indigo-600 rounded" ${c.ExibirLogoRelatorios ? 'checked' : ''}>
                                    <span class="text-sm text-gray-700">Exibir Logotipo nos Relatórios PDF</span>
                                </label>
                                <div>
                                    <label class="text-sm font-bold text-gray-700 mr-2">Cor Principal:</label>
                                    <input type="color" name="CorRelatorios" value="${c.CorRelatorios || '#3B82F6'}" class="h-8 w-16 rounded cursor-pointer">
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 2. Dados Institucionais -->
                <div class="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <h3 class="text-lg font-bold text-gray-800 mb-4 border-b pb-2 flex items-center gap-2">
                        <i class="fas fa-building text-indigo-600"></i> Dados Institucionais
                    </h3>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div class="col-span-2">
                            <label class="block text-sm font-bold text-gray-700 mb-1">Endereço Completo</label>
                            <input name="Endereco" value="${c.Endereco || ''}" class="w-full border p-2 rounded focus:ring-2 focus:ring-indigo-500">
                        </div>
                        <div>
                            <label class="block text-sm font-bold text-gray-700 mb-1">Telefone / WhatsApp</label>
                            <input name="Telefone" value="${c.Telefone || ''}" class="w-full border p-2 rounded focus:ring-2 focus:ring-indigo-500">
                        </div>
                        <div>
                            <label class="block text-sm font-bold text-gray-700 mb-1">E-mail de Contato</label>
                            <input name="Email" value="${c.Email || ''}" class="w-full border p-2 rounded focus:ring-2 focus:ring-indigo-500">
                        </div>
                        <div>
                            <label class="block text-sm font-bold text-gray-700 mb-1">Website</label>
                            <input name="Website" value="${c.Website || ''}" class="w-full border p-2 rounded focus:ring-2 focus:ring-indigo-500">
                        </div>
                        <div>
                            <label class="block text-sm font-bold text-gray-700 mb-1">Tipo de Unidade</label>
                            <input name="TipoUnidade" value="${c.TipoUnidade || ''}" placeholder="Ex: Matriz, Filial, Hospital..." class="w-full border p-2 rounded focus:ring-2 focus:ring-indigo-500">
                        </div>
                    </div>
                </div>

                <!-- 3. Parâmetros do Sistema -->
                <div class="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <h3 class="text-lg font-bold text-gray-800 mb-4 border-b pb-2 flex items-center gap-2">
                        <i class="fas fa-sliders-h text-indigo-600"></i> Parâmetros do Sistema
                    </h3>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label class="block text-sm font-bold text-gray-700 mb-1">Moeda Padrão</label>
                            <input name="Moeda" value="${c.Moeda || 'Kz'}" class="w-full border p-2 rounded focus:ring-2 focus:ring-indigo-500">
                        </div>
                        <div>
                            <label class="block text-sm font-bold text-gray-700 mb-1">Fuso Horário</label>
                            <select name="FusoHorario" class="w-full border p-2 rounded focus:ring-2 focus:ring-indigo-500">
                                <option ${c.FusoHorario === 'Africa/Luanda' ? 'selected' : ''}>Africa/Luanda</option>
                                <option ${c.FusoHorario === 'Europe/Lisbon' ? 'selected' : ''}>Europe/Lisbon</option>
                                <option ${c.FusoHorario === 'America/Sao_Paulo' ? 'selected' : ''}>America/Sao_Paulo</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-bold text-gray-700 mb-1">Subsídio Férias (%)</label>
                            <input type="number" name="SubsidioFeriasPorcentagem" value="${c.SubsidioFeriasPorcentagem || 50}" class="w-full border p-2 rounded focus:ring-2 focus:ring-indigo-500">
                        </div>
                    </div>
                </div>

                <div class="flex justify-end pt-4">
                    <button type="submit" class="bg-green-600 text-white px-8 py-3 rounded-lg font-bold shadow hover:bg-green-700 transition transform hover:-translate-y-0.5">
                        <i class="fas fa-save mr-2"></i> Salvar Configurações
                    </button>
                </div>
            </form>
        `;
    },

    handleLogoPreview: (input) => {
        if (input.files && input.files[0]) {
            const reader = new FileReader();
            reader.onload = (e) => {
                document.getElementById('preview-logo').src = e.target.result;
                document.getElementById('preview-logo').classList.remove('hidden');
                document.getElementById('placeholder-logo').classList.add('hidden');
            };
            reader.readAsDataURL(input.files[0]);
        }
    },

    save: async (e) => {
        e.preventDefault();
        const form = e.target;
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        
        // Checkbox handling
        data.ExibirLogoRelatorios = form.querySelector('[name="ExibirLogoRelatorios"]').checked;

        // File handling (Convert to Base64)
        const fileInput = document.getElementById('logo-input');
        if (fileInput.files.length > 0) {
            const file = fileInput.files[0];
            if (file.size > 2 * 1024 * 1024) return Utils.toast('A imagem deve ter no máximo 2MB.', 'error');
            
            try {
                const toBase64 = file => new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.readAsDataURL(file);
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = error => reject(error);
                });
                data.LogotipoURL = await toBase64(file);
            } catch (err) {
                return Utils.toast('Erro ao processar imagem.', 'error');
            }
        }

        try {
            await Utils.api('save', 'InstituicaoConfig', data);
            Utils.toast('Configurações salvas com sucesso!', 'success');
            ConfigModule.state.config = data; // Update local state
        } catch (err) {
            Utils.toast('Erro ao salvar: ' + err.message, 'error');
        }
    }
};

document.addEventListener('DOMContentLoaded', ConfigModule.init);