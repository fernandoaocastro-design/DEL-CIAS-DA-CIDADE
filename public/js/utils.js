// Verifica Autenticação Globalmente
if (!localStorage.getItem('user') && !window.location.href.includes('index.html')) {
    window.location.href = 'index.html';
}

// Função de Logout Global
window.logout = () => {
    localStorage.removeItem('user');
    window.location.href = 'index.html';
};

const Utils = {
    formatCurrency: (val) => new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA' }).format(val || 0),
    
    formatDate: (date) => date ? new Date(date).toLocaleDateString('pt-BR') : '-',
    
    toast: (msg) => alert(msg), // TODO: Implementar toast nativo mais bonito futuramente
    
    closeModal: () => document.getElementById('modal-container').classList.add('hidden'),
    
    openModal: (title, html) => {
        const titleEl = document.getElementById('modal-title');
        const bodyEl = document.getElementById('modal-body');
        const containerEl = document.getElementById('modal-container');
        
        if(titleEl) titleEl.innerText = title;
        if(bodyEl) bodyEl.innerHTML = html;
        if(containerEl) containerEl.classList.remove('hidden');
    },
    
    toggleSidebar: () => {
        const sidebar = document.getElementById('sidebar');
        const texts = document.querySelectorAll('.menu-text');
        const iconOnly = document.getElementById('sidebar-icon-only');
        
        if (sidebar) {
            sidebar.classList.toggle('w-64');
            sidebar.classList.toggle('w-20');
            
            // Fecha submenus se recolher para evitar quebras visuais
            if (sidebar.classList.contains('w-20')) {
                document.querySelectorAll('[id^="submenu-"]').forEach(s => s.classList.add('hidden'));
            }
        }
        
        texts.forEach(t => t.classList.toggle('hidden'));
        if(iconOnly) iconOnly.classList.toggle('hidden');
    },

    // --- NOVAS FUNCIONALIDADES DE CABEÇALHO ---

    toggleProfileMenu: () => {
        const menu = document.getElementById('profile-menu');
        if(menu) menu.classList.toggle('hidden');
    },

    toggleNotifications: () => {
        const panel = document.getElementById('notification-panel');
        if(panel) panel.classList.toggle('hidden');
    },

    modalEditProfile: () => {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
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
            const res = await fetch('/.netlify/functions/business', {
                method: 'POST',
                body: JSON.stringify({ action: 'updateProfile', data })
            });
            const json = await res.json();
            
            if(json.success) {
                // Atualiza local storage
                const currentUser = JSON.parse(localStorage.getItem('user'));
                currentUser.Nome = data.nome;
                currentUser.Email = data.email;
                if(data.novaSenha) currentUser.Senha = data.novaSenha; // Em app real, não salvaria senha no localstorage
                localStorage.setItem('user', JSON.stringify(currentUser));
                
                Utils.toast('✅ Perfil atualizado com sucesso!');
                Utils.closeModal();
                setTimeout(() => location.reload(), 1000);
            } else {
                throw new Error(json.message);
            }
        } catch (err) {
            Utils.toast('❌ Erro: ' + err.message);
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
            const res = await fetch('/.netlify/functions/business', {
                method: 'POST',
                body: JSON.stringify({ action: 'getNotifications' })
            });
            const json = await res.json();
            if (json.success) {
                Utils.renderNotifications(json.data);
            }
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
    if(document.getElementById('notif-btn')) Utils.fetchNotifications();
});