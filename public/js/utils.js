// Verifica Autenticação Globalmente
if (!localStorage.getItem('user') && !window.location.href.includes('index.html')) {
    window.location.href = 'index.html';
}

// Função de Logout Global
window.logout = () => {
    localStorage.removeItem('user');
    window.location.href = 'index.html';
};

// Injeta CSS para animação do Modal
const modalStyle = document.createElement('style');
modalStyle.innerHTML = `
    #modal-container { transition: opacity 0.3s ease; }
    #modal-container.hidden { opacity: 0; pointer-events: none; }
    #modal-container:not(.hidden) { opacity: 1; pointer-events: auto; }
    
    #modal-container > div { transition: all 0.3s ease-out; opacity: 0; transform: scale(0.95); }
    #modal-container.show-modal > div { opacity: 1; transform: scale(1); }
    
    /* Remove display:none do Tailwind para permitir transição de opacidade */
    #modal-container.hidden { display: flex !important; visibility: hidden; }

    /* Sidebar Animation Helpers */
    .no-transition { transition: none !important; }

    /* --- SIDEBAR INTELIGENTE & TOOLTIPS --- */
    /* Esconde texto e logo quando recolhido */
    #sidebar.w-20 .sidebar-text { display: none; }
    #sidebar.w-20 #sidebar-logo { display: none; }
    /* Centraliza o botão de toggle quando recolhido */
    #sidebar.w-20 #sidebar-header { justify-content: center; }

    /* Transforma o texto em Tooltip ao passar o mouse (apenas quando recolhido) */
    #sidebar.w-20 nav a, #sidebar.w-20 nav button { position: relative; }
    
    #sidebar.w-20 nav a:hover span.sidebar-text,
    #sidebar.w-20 nav button:hover span.sidebar-text {
        display: block;
        position: absolute;
        left: 100%; /* Joga para fora do menu */
        top: 50%;
        transform: translateY(-50%);
        background-color: #020617; /* slate-950 */
        color: #fcd34d; /* yellow-400 */
        padding: 6px 12px;
        border-radius: 6px;
        font-size: 12px;
        white-space: nowrap;
        z-index: 50;
        box-shadow: 4px 4px 10px rgba(0,0,0,0.5);
        border: 1px solid #1e293b;
        margin-left: 10px;
    }
`;
document.head.appendChild(modalStyle);

// Estilo para o Toast
const toastStyle = document.createElement('style');
toastStyle.innerHTML = `
    .toast-container { position: fixed; top: 20px; right: 20px; z-index: 9999; display: flex; flex-direction: column; gap: 10px; }
    .toast { background: white; border-left: 4px solid; padding: 15px 20px; border-radius: 4px; shadow: 0 4px 6px rgba(0,0,0,0.1); min-width: 300px; transform: translateX(100%); transition: transform 0.3s ease-out; display: flex; align-items: center; justify-content: space-between; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); }
    .toast.show { transform: translateX(0); }
    .toast-success { border-color: #10B981; }
    .toast-error { border-color: #EF4444; }
    .toast-info { border-color: #3B82F6; }
`;
document.head.appendChild(toastStyle);

// Container de Toasts
const toastContainer = document.createElement('div');
toastContainer.className = 'toast-container';
document.body.appendChild(toastContainer);

const Utils = {
    formatCurrency: (val) => new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA' }).format(val || 0),
    
    formatDate: (date) => date ? new Date(date).toLocaleDateString('pt-BR') : '-',
    
    getUser: () => {
        try {
            return JSON.parse(localStorage.getItem('user')) || {};
        } catch (e) {
            return {};
        }
    },

    // SUPABASE CLIENT (Frontend - Realtime)
    supabaseClient: null,

    initSupabase: () => {
        if (typeof supabase === 'undefined' || !supabase.createClient) return;
        
        // ⚠️ SUBSTITUA PELAS SUAS CHAVES DO SUPABASE (Project Settings > API) ⚠️
        const SUPABASE_URL = 'https://shuhvwespebsdyipsaou.supabase.co'; 
        const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNodWh2d2VzcGVic2R5aXBzYW91Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4NzM2NjUsImV4cCI6MjA4NTQ0OTY2NX0.EEi0ChHbTUt2QdDD45wHDwKkuxqnued2ASW9b3WstKo';

        if (SUPABASE_URL.includes('SUA_URL')) {
            console.warn('⚠️ Supabase não configurado em js/utils.js. O Realtime não funcionará.');
            return;
        }
        Utils.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    },

    // Nova API Centralizada com Token
    api: async (action, table, data = null, id = null) => {
        const token = localStorage.getItem('token');
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch('/.netlify/functions/business', {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({ action, table, data, id })
        });

        if (res.status === 401) {
            Utils.toast('⚠️ Sessão expirada. Faça login novamente.');
            setTimeout(() => window.logout(), 2000);
            throw new Error('Sessão expirada');
        }

        const json = await res.json();
        if (json.success) return json.data;
        throw new Error(json.message || 'Erro na API');
    },

    // Função de Impressão Nativa (Centralizada)
    printNative: (htmlContent, orientation = 'portrait') => {
        let iframe = document.getElementById('print-iframe');
        if (!iframe) {
            iframe = document.createElement('iframe');
            iframe.id = 'print-iframe';
            iframe.style.position = 'fixed';
            iframe.style.right = '0';
            iframe.style.bottom = '0';
            iframe.style.width = '0';
            iframe.style.height = '0';
            iframe.style.border = '0';
            document.body.appendChild(iframe);
        }
        
        const doc = iframe.contentWindow.document;
        doc.open();
        doc.write(`
            <html>
            <head>
                <title>Imprimir Relatório</title>
                <script src="https://cdn.tailwindcss.com"></script>
                <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
                <style>
                    body { background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; font-family: sans-serif; }
                    @page { margin: 5mm; size: A4 ${orientation}; }
                    table { border-collapse: collapse; width: 100%; }
                </style>
            </head>
            <body>
                ${htmlContent}
                <script>window.onload = () => { setTimeout(() => { window.print(); }, 1000); };<\/script>
            </body>
            </html>
        `);
        doc.close();
    },

    // Verifica conexão com o Backend/Banco
    checkConnection: async () => {
        const footer = document.querySelector('footer');
        if (!footer) return;
        
        const statusId = 'db-status-indicator';
        if (document.getElementById(statusId)) return;

        const div = document.createElement('div');
        div.id = statusId;
        div.className = 'mt-2 text-[10px] flex items-center justify-center gap-2 text-gray-400';
        div.innerHTML = '<span class="w-2 h-2 rounded-full bg-gray-300 animate-pulse"></span> Verificando conexão...';
        footer.appendChild(div);

        try {
            await Utils.api('healthCheck');
            div.innerHTML = '<span class="w-2 h-2 rounded-full bg-green-500"></span> Sistema Online';
            div.className = 'mt-2 text-[10px] text-green-600 flex items-center justify-center gap-2';
        } catch (e) {
            div.innerHTML = '<span class="w-2 h-2 rounded-full bg-red-500"></span> Offline / Erro API';
            div.className = 'mt-2 text-[10px] text-red-600 flex items-center justify-center gap-2';
        }
    },

    toast: (msg, type = 'info') => {
        const el = document.createElement('div');
        const icon = type === 'success' ? '✅' : (type === 'error' ? '❌' : 'ℹ️');
        const colorClass = type === 'success' ? 'toast-success' : (type === 'error' ? 'toast-error' : 'toast-info');
        
        el.className = `toast ${colorClass}`;
        el.innerHTML = `<div><span class="mr-2">${icon}</span> <span class="font-medium text-gray-700 text-sm">${msg}</span></div>`;
        
        toastContainer.appendChild(el);
        // Força reflow
        void el.offsetWidth;
        el.classList.add('show');
        
        setTimeout(() => {
            el.classList.remove('show');
            setTimeout(() => el.remove(), 300);
        }, 3000);
    },
    
    closeModal: () => {
        const container = document.getElementById('modal-container');
        if (container) {
            container.classList.remove('show-modal');
            // Aguarda a transição terminar antes de esconder
            setTimeout(() => {
                container.classList.add('hidden');
            }, 300);
        }
    },
    
    openModal: (title, html) => {
        const titleEl = document.getElementById('modal-title');
        const bodyEl = document.getElementById('modal-body');
        const containerEl = document.getElementById('modal-container');
        
        if(titleEl) titleEl.innerText = title;
        if(bodyEl) bodyEl.innerHTML = html;
        if(containerEl) {
            containerEl.classList.remove('hidden');
            // Força um reflow para que a transição CSS funcione
            void containerEl.offsetWidth;
            containerEl.classList.add('show-modal');
        }
    },

    toggleSubmenu: (id) => {
        const submenu = document.getElementById(id);
        const icon = document.getElementById('icon-' + id);
        if (submenu) {
            submenu.classList.toggle('hidden');
            if (icon) icon.classList.toggle('rotate-180');
        }
    },
    
    toggleSidebar: () => {
        const sidebar = document.getElementById('sidebar');
        
        if (!sidebar) return;
        
        const isCollapsed = sidebar.classList.contains('w-20');
        
        if (isCollapsed) {
            // EXPANDIR
            sidebar.classList.replace('w-20', 'w-64');
            localStorage.setItem('sidebarState', 'expanded');
        } else {
            // RECOLHER
            sidebar.classList.replace('w-64', 'w-20');
            
            // Fecha submenus e reseta ícones para evitar quebras visuais
            document.querySelectorAll('[id^="submenu-"]').forEach(s => s.classList.add('hidden'));
            document.querySelectorAll('.fa-chevron-down').forEach(i => i.classList.remove('rotate-180'));
            
            localStorage.setItem('sidebarState', 'collapsed');
        }
    },

    initSidebar: () => {
        const state = localStorage.getItem('sidebarState');
        const sidebar = document.getElementById('sidebar');
        
        if (state === 'collapsed' && sidebar) {
            // Desativa transição temporariamente para não "piscar" a animação no load
            sidebar.classList.add('no-transition');
            Utils.toggleSidebar(); // Reaproveita a lógica para fechar
            setTimeout(() => sidebar.classList.remove('no-transition'), 100);
        }
    },

    // --- NOVAS FUNCIONALIDADES DE CABEÇALHO ---

    toggleProfileMenu: () => {
        const menu = document.getElementById('profile-menu');
        if(menu) menu.classList.toggle('hidden');
        else {
            const user = Utils.getUser();

            // Cria o menu se não existir (Injeção dinâmica)
            const btn = document.getElementById('profile-btn');
            if(btn) {
                const div = document.createElement('div');
                div.id = 'profile-menu';
                div.className = 'absolute right-0 top-full mt-2 w-56 bg-white rounded-lg shadow-xl border border-gray-100 z-50 py-2 animate-fade-in-down';
                div.innerHTML = `
                    <div class="px-4 py-3 border-b border-gray-100 mb-2 bg-gray-50">
                        <p class="text-sm font-bold text-gray-800">${user.Nome || 'Usuário'}</p>
                        <p class="text-xs text-gray-500 truncate">${user.Email || ''}</p>
                    </div>
                    <a href="perfil.html" class="block px-4 py-2 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"><i class="fas fa-user mr-2 w-5 text-center"></i> Meu Perfil</a>
                    <a href="configuracoes.html" class="block px-4 py-2 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"><i class="fas fa-cog mr-2 w-5 text-center"></i> Configurações</a>
                    <div class="border-t border-gray-100 mt-2 pt-2">
                        <a href="#" onclick="Utils.confirmLogout()" class="block px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"><i class="fas fa-sign-out-alt mr-2 w-5 text-center"></i> Sair</a>
                    </div>
                `;
                btn.parentElement.appendChild(div);
            }
        }
    },

    toggleNotifications: () => {
        const panel = document.getElementById('notification-panel');
        if(panel) panel.classList.toggle('hidden');
    },

    modalEditProfile: () => {
        const user = Utils.getUser();
        Utils.openModal('Editar Perfil', `
            <form onsubmit="Utils.handleUpdateProfile(event)">
                <input type="hidden" name="id" value="${user.ID}">
                <div class="mb-4 flex justify-center">
                    <div class="relative w-24 h-24">
                        <img id="profile-preview" src="${user.FotoURL || 'https://via.placeholder.com/150'}" class="w-24 h-24 rounded-full object-cover border-2 border-gray-200">
                        <label for="profile-upload" class="absolute bottom-0 right-0 bg-blue-600 text-white p-1 rounded-full cursor-pointer hover:bg-blue-700"><i class="fas fa-camera text-xs"></i></label>
                        <input type="file" id="profile-upload" accept="image/*" class="hidden" onchange="Utils.previewProfileImage(this)">
                    </div>
                </div>
                <div class="mb-4">
                    <label class="block text-sm font-bold mb-1">Nome</label>
                    <input name="nome" value="${user.Nome}" class="border p-2 rounded w-full" required>
                </div>
                <div class="mb-4">
                    <label class="block text-sm font-bold mb-1">Email</label>
                    <input name="email" value="${user.Email}" class="border p-2 rounded w-full" required>
                </div>
                <div class="mb-4">
                    <label class="block text-sm font-bold mb-1">Assinatura Digital (Texto/Cargo)</label>
                    <input name="assinatura" value="${user.Assinatura || ''}" placeholder="Ex: João Silva - Gerente" class="border p-2 rounded w-full bg-gray-50">
                </div>
                <div class="mb-4 border-t pt-4">
                    <h5 class="font-bold text-gray-700 mb-2">Segurança (Obrigatório para salvar)</h5>
                    <label class="block text-sm mb-1">Senha Atual</label>
                    <input type="password" name="senhaAtual" class="border p-2 rounded w-full" required>
                </div>
                <div class="mb-4">
                    <label class="block text-sm mb-1">Nova Senha (Opcional)</label>
                    <input type="password" name="novaSenha" placeholder="Deixe em branco para manter" class="border p-2 rounded w-full">
                </div>
                <button class="w-full bg-blue-600 text-white py-2 rounded font-bold hover:bg-blue-700">Salvar Alterações</button>
            </form>
        `);
        Utils.toggleProfileMenu();
    },

    previewProfileImage: (input) => {
        if (input.files && input.files[0]) {
            const reader = new FileReader();
            reader.onload = (e) => {
                document.getElementById('profile-preview').src = e.target.result;
            };
            reader.readAsDataURL(input.files[0]);
        }
    },

    handleUpdateProfile: async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target).entries());
        
        if (data.novaSenha && data.novaSenha.length < 6) {
            return Utils.toast('⚠️ Erro: A nova senha deve ter pelo menos 6 caracteres.');
        }

        // Processar Foto
        const fileInput = document.getElementById('profile-upload');
        if (fileInput && fileInput.files[0]) {
            const file = fileInput.files[0];
            if (file.size > 2 * 1024 * 1024) return Utils.toast('Imagem muito grande (Max 2MB)', 'error');
            
            const toBase64 = file => new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = () => resolve(reader.result);
                reader.onerror = error => reject(error);
            });
            data.fotoURL = await toBase64(file);
        }

        try {
            await Utils.api('updateProfile', null, data);
            
                // Atualiza local storage
                const currentUser = Utils.getUser();
                currentUser.Nome = data.nome;
                currentUser.Email = data.email;
                currentUser.Assinatura = data.assinatura;
                if(data.fotoURL) currentUser.FotoURL = data.fotoURL;
                localStorage.setItem('user', JSON.stringify(currentUser));
                
                Utils.toast('Perfil atualizado com sucesso!', 'success');
                Utils.closeModal();
                setTimeout(() => location.reload(), 1000);
        } catch (err) {
            Utils.toast(err.message, 'error');
        }
    },

    confirmLogout: () => {
        Utils.toggleProfileMenu();
        Utils.openModal('Sair do Sistema', `
            <div class="text-center">
                <i class="fas fa-sign-out-alt text-4xl text-red-500 mb-4"></i>
                <p class="mb-6 text-gray-600">Tem certeza que deseja encerrar sua sessão?</p>
                <div class="flex gap-4 justify-center">
                    <button onclick="Utils.closeModal()" class="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">Cancelar</button>
                    <button onclick="logout()" class="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">Sair Agora</button>
                </div>
            </div>
        `);
    },

    fetchNotifications: async () => {
        try {
            const data = await Utils.api('getNotifications');
            Utils.renderNotifications(data);
        } catch (e) { console.error('Erro ao buscar notificações', e); }
    },

    renderNotifications: (list) => {
        const panel = document.querySelector('#notification-panel div:last-child'); // O container com overflow
        const badge = document.querySelector('#notif-btn span');
        
        if (!list || list.length === 0) {
            if(panel) panel.innerHTML = '<div class="p-4 text-center text-gray-500 text-sm">Nenhuma notificação.</div>';
            if(badge) badge.classList.add('hidden');
            return;
        }

        const unreadCount = list.filter(n => !n.Lida).length;
        if(badge) {
            badge.innerText = unreadCount;
            if(unreadCount === 0) badge.classList.add('hidden');
            else badge.classList.remove('hidden');
        }

        if(panel) {
            panel.innerHTML = list.map(n => `
                <div class="p-3 hover:bg-gray-50 border-b text-sm ${n.Lida ? 'text-gray-400' : 'text-gray-700 font-medium'}">
                    ${n.Mensagem}
                    <div class="text-xs text-gray-400 mt-1">${Utils.formatDate(n.CriadoEm)}</div>
                </div>
            `).join('');
        }
    },

    // --- SISTEMA DE PERMISSÕES ---
    
    // RENDERIZADOR DE SIDEBAR ÚNICO (Substitui Sidebar.jsx)
    renderSidebar: () => {
        const sidebar = document.getElementById('sidebar');
        if (!sidebar) return;

        const user = Utils.getUser();
        const isAdmin = user.Cargo === 'Administrador';
        // Normaliza o path para identificar a página ativa
        const path = window.location.pathname.split('/').pop() || 'index.html';
        const search = window.location.search;

        // ESTRUTURA OBRIGATÓRIA DO MENU EM BLOCOS
        const menuStructure = [
            {
                title: 'PRINCIPAL',
                items: [
                    { label: 'Dashboard', icon: 'fa-chart-pie', href: 'dashboard.html' }
                ]
            },
            {
                title: 'GESTÃO EMPRESARIAL',
                items: [
                    { label: 'Recursos Humanos', icon: 'fa-users', href: 'rh.html' },
                    { label: 'Patrimônio', icon: 'fa-qrcode', href: 'inventario.html' },
                    { label: 'Finanças', icon: 'fa-coins', href: 'financas.html' }
                ]
            },
            {
                title: 'OPERAÇÕES',
                items: [
                    { label: 'Estoque', icon: 'fa-boxes', href: 'estoque.html' },
                    { label: 'Caso Social', icon: 'fa-hand-holding-heart', href: 'social.html' },
                    { label: 'Lista do Dia', icon: 'fa-clipboard-list', href: 'lista_dia.html' },
                    { label: 'Produção', icon: 'fa-utensils', href: 'producao.html' },
                    { label: 'Monitor Cozinha', icon: 'fa-tv', href: 'cozinha_realtime.html' },
                    { label: 'Eventos & Pedidos', icon: 'fa-calendar-alt', href: 'eventos.html' }
                ]
            },
            {
                title: 'CONTROLE E RELATÓRIOS',
                items: [
                    { label: 'M.L.PAIN', icon: 'fa-heartbeat', href: 'mlpain.html' },
                    { label: 'Auditoria', icon: 'fa-shield-alt', href: 'auditoria.html', adminOnly: true },
                    { label: 'Backups', icon: 'fa-database', href: 'backups.html', adminOnly: true }
                ]
            },
            {
                title: 'SISTEMA',
                items: [
                    { label: 'Configurações', icon: 'fa-cog', href: 'configuracoes.html' }
                ]
            }
        ];

        // Mapeamento de permissões (Nome do arquivo -> Nome do Módulo no Banco)
        const moduleMap = {
            'dashboard.html': 'Dashboard',
            'rh.html': 'RH',
            'estoque.html': 'Estoque',
            'social.html': 'Social',
            'lista_dia.html': 'ListaDia',
            'producao.html': 'Producao',
            'cozinha_realtime.html': 'Producao',
            'inventario.html': 'Inventario',
            'financas.html': 'Financas',
            'eventos.html': 'Eventos',
            'mlpain.html': 'MLPain',
            'configuracoes.html': 'Configuracoes'
        };

        let navHtml = '<nav class="flex-1 overflow-y-auto py-4 space-y-1">';

        menuStructure.forEach((section, index) => {
            // Filtra itens visíveis baseados em permissão
            const visibleItems = section.items.filter(item => {
                if (item.adminOnly && !isAdmin) return false;
                const moduleName = moduleMap[item.href];
                if (moduleName && !isAdmin && !Utils.checkPermission(moduleName, 'ver')) return false;
                return true;
            });

            if (visibleItems.length === 0) return;

            // Separador e Título
            if (index > 0) {
                navHtml += '<div class="my-2 border-t border-slate-800 mx-4"></div>';
            }
            
            navHtml += `
                <div class="px-4 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider sidebar-text">
                    ${section.title}
                </div>
            `;

            visibleItems.forEach(item => {
                const isActive = path === item.href;
                const activeClass = isActive 
                    ? 'bg-slate-800 text-white border-l-4 border-yellow-500' 
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white hover:border-l-4 hover:border-yellow-500 border-l-4 border-transparent';

                navHtml += `
                    <a href="${item.href}" class="flex items-center px-4 py-3 transition-all duration-200 group ${activeClass}">
                        <i class="fas ${item.icon} w-6 text-center"></i>
                        <span class="ml-3 font-medium sidebar-text group-hover:translate-x-1 transition-transform">${item.label}</span>
                    </a>
                `;
            });
        });

        navHtml += '</nav>';

        // Header Fixo
        const headerHtml = `
            <div id="sidebar-header" class="p-6 flex items-center justify-between h-20">
                <div class="flex items-center gap-3" id="sidebar-logo">
                    <div class="w-8 h-8 bg-yellow-500 rounded-lg flex items-center justify-center font-bold text-slate-900 flex-shrink-0">K</div>
                    <span class="font-bold text-lg tracking-wide sidebar-text">Kitchen OS</span>
                </div>
                <button onclick="Utils.toggleSidebar()" class="text-slate-400 hover:text-white transition"><i class="fas fa-bars"></i></button>
            </div>
        `;

        // Footer Fixo
        const footerHtml = `
            <div class="p-4 border-t border-slate-800">
                <button onclick="Utils.confirmLogout()" class="flex items-center w-full text-slate-400 hover:text-white transition group">
                    <i class="fas fa-sign-out-alt w-6 text-center"></i> <span class="ml-3 font-medium sidebar-text group-hover:translate-x-1 transition-transform">Sair</span>
                </button>
            </div>
        `;

        sidebar.innerHTML = headerHtml + navHtml + footerHtml;
        
        // Reaplica estado visual (colapsado/expandido)
        Utils.initSidebar();
    },

    // Verifica se o usuário tem permissão para uma ação específica em um módulo
    checkPermission: (module, action) => {
        const user = Utils.getUser();
        
        // Administrador tem acesso total (Bypass)
        if (user.Cargo === 'Administrador') return true;
        
        // Se não tiver permissões definidas, bloqueia tudo por segurança
        if (!user.Permissoes) return false;

        const modPerms = user.Permissoes[module];
        if (!modPerms) return false;

        // Verifica a ação específica (ver, criar, editar, excluir)
        return modPerms[action] === true;
    },

    // RENDERIZADOR DE HEADER DO USUÁRIO (Componente Global de Perfil)
    renderUserProfile: () => {
        const header = document.querySelector('header');
        if (!header) return;

        // Tenta encontrar o container da direita (onde ficam os botões)
        // Se não tiver classe específica, pega o último div (padrão do layout)
        let rightContainer = header.querySelector('.header-user-area');
        if (!rightContainer) {
            const divs = header.querySelectorAll('div');
            if (divs.length > 0) rightContainer = divs[divs.length - 1];
        }

        if (!rightContainer) return;
        
        // Marca para estilização e evita duplicidade
        rightContainer.className = 'header-user-area flex items-center justify-end gap-6';

        const user = Utils.getUser();
        // Avatar padrão se não tiver foto (Gera iniciais)
        const avatarUrl = user.FotoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.Nome || 'User')}&background=random&color=fff&size=128`;

        rightContainer.innerHTML = `
            <!-- Botão de Notificações (Único) -->
            <button id="notif-btn" onclick="Utils.toggleNotifications()" class="relative p-2 text-gray-400 hover:text-indigo-600 transition-colors focus:outline-none">
                <i class="fas fa-bell text-xl"></i>
                <span class="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full hidden border-2 border-white">0</span>
            </button>
            
            <!-- Perfil do Usuário (Sem ícones extras) -->
            <div class="relative">
                <button id="profile-btn" onclick="Utils.toggleProfileMenu()" class="flex items-center gap-3 focus:outline-none group text-left">
                    <div class="hidden md:flex flex-col items-end">
                        <span class="text-sm font-bold text-gray-700 leading-tight group-hover:text-indigo-600 transition-colors whitespace-nowrap">${user.Nome || 'Usuário'}</span>
                        <span class="text-xs text-gray-400 uppercase tracking-wide font-medium whitespace-nowrap">${user.Cargo || 'Colaborador'}</span>
                    </div>
                    
                    <div class="relative flex-shrink-0">
                        <img src="${avatarUrl}" class="w-10 h-10 rounded-full object-cover border border-gray-200 shadow-sm group-hover:border-indigo-50 transition-all" alt="Avatar">
                        <span class="absolute bottom-0 right-0 block w-3 h-3 bg-green-500 border-2 border-white rounded-full"></span>
                    </div>

                    <i class="fas fa-chevron-down text-sm text-gray-400 ml-1 group-hover:text-indigo-500 transition-colors"></i>
                </button>
            </div>
        `;

        // Busca notificações para atualizar o badge recém-criado
        Utils.fetchNotifications();
    },

    // --- CHAT INTERNO ---
    initChat: () => {
        const chatHTML = `
            <div id="chat-widget" class="fixed bottom-4 right-4 z-50 flex flex-col items-end">
                <div id="chat-window" class="hidden bg-white w-80 h-96 rounded-lg shadow-2xl border border-gray-200 flex flex-col mb-4 overflow-hidden">
                    <div class="bg-indigo-600 text-white p-3 flex justify-between items-center">
                        <h4 class="font-bold text-sm"><i class="fas fa-comments mr-2"></i>Chat da Equipe</h4>
                        <button onclick="Utils.toggleChat()" class="text-white hover:text-gray-200"><i class="fas fa-times"></i></button>
                    </div>
                    <div id="chat-messages" class="flex-1 p-3 overflow-y-auto bg-gray-50 space-y-2 text-sm">
                        <!-- Mensagens aqui -->
                    </div>
                    <form onsubmit="Utils.sendChatMessage(event)" class="p-2 border-t bg-white flex gap-2 items-center">
                        <input type="file" id="chat-file-input" class="hidden" accept="image/*,application/pdf">
                        <button type="button" onclick="document.getElementById('chat-file-input').click()" class="text-gray-500 hover:text-gray-700 px-1"><i class="fas fa-paperclip"></i></button>
                        <input name="message" class="flex-1 border rounded px-2 py-1 text-sm focus:outline-none focus:border-indigo-500" placeholder="Digite..." autocomplete="off">
                        <button type="submit" class="bg-indigo-600 text-white px-3 py-1 rounded hover:bg-indigo-700"><i class="fas fa-paper-plane"></i></button>
                    </form>
                </div>
                <button onclick="Utils.toggleChat()" class="bg-indigo-600 text-white w-12 h-12 rounded-full shadow-lg hover:bg-indigo-700 flex items-center justify-center transition transform hover:scale-110 relative">
                    <i class="fas fa-comment-dots text-xl"></i>
                    <span id="chat-badge" class="hidden absolute -top-1 -right-1 bg-red-500 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center">!</span>
                </button>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', chatHTML);
        
        // Polling de mensagens
        setInterval(Utils.loadChatMessages, 5000);
    },

    toggleChat: () => {
        const win = document.getElementById('chat-window');
        win.classList.toggle('hidden');
        if (!win.classList.contains('hidden')) {
            Utils.loadChatMessages();
            document.getElementById('chat-badge').classList.add('hidden');
            // Scroll to bottom
            const container = document.getElementById('chat-messages');
            container.scrollTop = container.scrollHeight;
        }
    },

    loadChatMessages: async () => {
        try {
            const msgs = await Utils.api('getChatMessages');
            const container = document.getElementById('chat-messages');
            const user = Utils.getUser();
            
            // Verifica se há novas mensagens para notificar (Badge)
            const lastMsg = msgs[0];
            const currentLastId = container.getAttribute('data-last-id');
            const isChatOpen = !document.getElementById('chat-window').classList.contains('hidden');
            
            if (lastMsg && lastMsg.ID !== currentLastId) {
                container.setAttribute('data-last-id', lastMsg.ID);
                if (!isChatOpen) document.getElementById('chat-badge').classList.remove('hidden');
            }

            // Renderiza apenas se a janela estiver aberta para economizar recursos
            if (isChatOpen) {
                const html = msgs.sort((a,b) => new Date(a.Timestamp) - new Date(b.Timestamp)).map(m => {
                    const isMe = m.SenderID === user.ID;
                    
                    let attachmentHtml = '';
                    if (m.Attachment) {
                        if (m.Attachment.startsWith('data:image')) {
                            attachmentHtml = `<img src="${m.Attachment}" class="mt-2 rounded max-w-full max-h-32 border cursor-pointer" onclick="Utils.openModal('Imagem', '<img src=\\'${m.Attachment}\\' class=\\'max-w-full\\'>')">`;
                        } else {
                            attachmentHtml = `<a href="${m.Attachment}" download="anexo" class="block mt-2 text-xs underline text-blue-200"><i class="fas fa-file-download"></i> Baixar Anexo</a>`;
                        }
                    }

                    return `
                        <div class="flex flex-col ${isMe ? 'items-end' : 'items-start'}">
                            <div class="text-[10px] text-gray-500 mb-0.5 ${isMe ? 'text-right' : ''}">${isMe ? 'Você' : m.SenderName}</div>
                            <div class="px-3 py-2 rounded-lg max-w-[85%] break-words ${isMe ? 'bg-indigo-100 text-indigo-900 rounded-tr-none' : 'bg-white border text-gray-800 rounded-tl-none shadow-sm'}">
                                ${m.Message} ${attachmentHtml}
                            </div>
                            <div class="text-[9px] text-gray-400 mt-0.5">${new Date(m.Timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                        </div>
                    `;
                }).join('');
                
                container.innerHTML = html;
                // Auto-scroll se estiver perto do fim
                if (container.scrollTop + container.clientHeight >= container.scrollHeight - 100) {
                    container.scrollTop = container.scrollHeight;
                }
            }
        } catch (e) { console.error('Erro no chat', e); }
    },

    sendChatMessage: async (e) => {
        e.preventDefault();
        const input = e.target.message;
        const fileInput = document.getElementById('chat-file-input');
        const text = input.value.trim();
        
        if (!text && (!fileInput.files || fileInput.files.length === 0)) return;

        const user = Utils.getUser();
        const payload = {
            SenderID: user.ID,
            SenderName: user.Nome,
            Message: text
        };

        const send = async () => {
            try {
                await Utils.api('sendChatMessage', null, payload);
                input.value = '';
                fileInput.value = ''; // Limpa o anexo
                Utils.loadChatMessages();
            } catch (err) { Utils.toast('Erro ao enviar.', 'error'); }
        };

        if (fileInput.files.length > 0) {
            const file = fileInput.files[0];
            if (file.size > 2 * 1024 * 1024) return Utils.toast('Arquivo muito grande (Max 2MB)', 'error');
            
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
                payload.Attachment = reader.result;
                send();
            };
        } else {
            send();
        }
    }
};

// Fechar menus ao clicar fora
document.addEventListener('click', (e) => {
    const profileMenu = document.getElementById('profile-menu');
    const notifPanel = document.getElementById('notification-panel');
    const profileBtn = document.getElementById('profile-btn');
    const notifBtn = document.getElementById('notif-btn');

    if(profileMenu && !profileMenu.contains(e.target) && !profileBtn.contains(e.target)) profileMenu.classList.add('hidden');
    if(notifPanel && !notifPanel.contains(e.target) && !notifBtn.contains(e.target)) notifPanel.classList.add('hidden');
});

// Inicializa notificações se houver o botão na tela
document.addEventListener('DOMContentLoaded', () => {
    if(document.getElementById('notif-btn')) {
        Utils.fetchNotifications();
        // Atualiza notificações a cada 15 segundos sem recarregar a página
        setInterval(() => Utils.fetchNotifications(), 15000);
    }
    
    // RENDERIZA O SIDEBAR ÚNICO (Centralizado)
    Utils.renderSidebar();

    // RENDERIZA O HEADER DO USUÁRIO (Global)
    Utils.renderUserProfile();

    // Inicializa Chat
    if (localStorage.getItem('user')) Utils.initChat();

    // Inicializa Supabase Frontend
    Utils.initSupabase();

    // Verifica Conexão
    Utils.checkConnection();
});
