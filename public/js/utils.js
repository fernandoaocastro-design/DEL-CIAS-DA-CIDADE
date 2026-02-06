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
    #sidebar.w-20 .sidebar-text, 
    #sidebar.w-20 #sidebar-logo { display: none; }

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
            // Cria o menu se não existir (Injeção dinâmica)
            const btn = document.querySelector('button[onclick="Utils.toggleProfileMenu()"]');
            if(btn) {
                const div = document.createElement('div');
                div.id = 'profile-menu';
                div.className = 'absolute right-8 top-20 w-56 bg-white rounded-lg shadow-xl border z-50 py-2 animate-fade-in-down';
                div.innerHTML = `
                    <div class="px-4 py-2 border-b mb-2">
                        <p class="text-sm font-bold text-gray-800">Administrador</p>
                        <p class="text-xs text-gray-500">admin@deliciadacidade.com</p>
                    </div>
                    <a href="#" onclick="Utils.modalEditProfile()" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"><i class="fas fa-user mr-2"></i> Meu Perfil</a>
                    <a href="configuracoes.html" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"><i class="fas fa-cog mr-2"></i> Configurações</a>
                    <div class="border-t mt-2 pt-2">
                        <a href="#" onclick="Utils.confirmLogout()" class="block px-4 py-2 text-sm text-red-600 hover:bg-red-50"><i class="fas fa-sign-out-alt mr-2"></i> Sair</a>
                    </div>
                `;
                document.body.appendChild(div);
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

    handleUpdateProfile: async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target).entries());
        
        if (data.novaSenha && data.novaSenha.length < 6) {
            return Utils.toast('⚠️ Erro: A nova senha deve ter pelo menos 6 caracteres.');
        }

        try {
            await Utils.api('updateProfile', null, data);
            
                // Atualiza local storage
                const currentUser = Utils.getUser();
                currentUser.Nome = data.nome;
                currentUser.Email = data.email;
                currentUser.Assinatura = data.assinatura;
                if(data.novaSenha) currentUser.Senha = data.novaSenha; // Em app real, não salvaria senha no localstorage
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

    // Aplica regras visuais na barra lateral
    applySidebarPermissions: () => {
        const user = Utils.getUser();
        if (user.Cargo === 'Administrador') return;

        const mapping = {
            'dashboard.html': 'Dashboard',
            'rh.html': 'RH',
            'estoque.html': 'Estoque',
            'producao.html': 'Producao',
            'eventos.html': 'Eventos',
            'mlpain.html': 'MLPain',
            'financas.html': 'Financas',
            'inventario.html': 'Inventario',
            'configuracoes.html': 'Configuracoes'
        };

        document.querySelectorAll('#sidebar nav a').forEach(link => {
            const href = link.getAttribute('href');
            const module = mapping[href];
            
            // Se o módulo existe no mapa e o usuário não tem permissão de 'ver', esconde
            if (module && !Utils.checkPermission(module, 'ver')) {
                link.classList.add('hidden');
            }
        });
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
    
    // Aplica permissões na sidebar
    Utils.applySidebarPermissions();

    // Restaura estado do menu lateral
    Utils.initSidebar();
});