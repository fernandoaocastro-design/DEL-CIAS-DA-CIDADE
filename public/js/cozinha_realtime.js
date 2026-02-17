const KitchenMonitor = {
    state: {
        orders: []
    },

    init: async () => {
        KitchenMonitor.updateClock();
        setInterval(KitchenMonitor.updateClock, 1000);

        // Aguarda Utils carregar e inicializar Supabase
        if (!Utils.supabaseClient) {
            Utils.initSupabase();
            if (!Utils.supabaseClient) {
                alert('Erro: Configure as chaves do Supabase em js/utils.js para usar o monitor.');
                return;
            }
        }

        // Atualiza status visual
        const statusEl = document.getElementById('connection-status');
        statusEl.innerHTML = '<div class="w-3 h-3 rounded-full bg-green-500"></div> Conectado';
        statusEl.className = 'flex items-center gap-2 text-xs text-green-400';

        await KitchenMonitor.fetchOrders();
        KitchenMonitor.subscribeRealtime();
    },

    updateClock: () => {
        const now = new Date();
        document.getElementById('clock').innerText = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    },

    fetchOrders: async () => {
        try {
            // Busca ordens do dia (Pendentes, Em Produção e Concluídas hoje)
            const today = new Date().toISOString().split('T')[0];
            const { data, error } = await Utils.supabaseClient
                .from('OrdensProducao')
                .select('*')
                .gte('Data', today)
                .order('CriadoEm', { ascending: true });

            if (error) throw error;

            KitchenMonitor.state.orders = data || [];
            KitchenMonitor.render();
        } catch (e) {
            console.error('Erro ao buscar ordens:', e);
        }
    },

    subscribeRealtime: () => {
        const channel = Utils.supabaseClient
            .channel('cozinha-db-changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'OrdensProducao' },
                (payload) => {
                    console.log('Change received!', payload);
                    
                    if (payload.eventType === 'INSERT') {
                        // Nova ordem: Adiciona e toca som
                        KitchenMonitor.state.orders.push(payload.new);
                        KitchenMonitor.playSound();
                        Utils.toast('Nova Ordem de Produção!', 'info');
                    } else if (payload.eventType === 'UPDATE') {
                        // Atualização: Substitui na lista
                        const idx = KitchenMonitor.state.orders.findIndex(o => o.ID === payload.new.ID);
                        if (idx !== -1) {
                            KitchenMonitor.state.orders[idx] = payload.new;
                        } else {
                            // Se não estava na lista (ex: mudou data), adiciona
                            KitchenMonitor.state.orders.push(payload.new);
                        }
                    } else if (payload.eventType === 'DELETE') {
                        KitchenMonitor.state.orders = KitchenMonitor.state.orders.filter(o => o.ID !== payload.old.ID);
                    }
                    
                    KitchenMonitor.render();
                }
            )
            .subscribe();
    },

    playSound: () => {
        const audio = document.getElementById('sound-new');
        if (audio) {
            audio.currentTime = 0;
            audio.play().catch(e => console.log('Autoplay bloqueado, interação necessária.'));
        }
    },

    render: () => {
        const pendentes = KitchenMonitor.state.orders.filter(o => o.Status === 'Pendente' || o.Status === 'Aberta');
        const producao = KitchenMonitor.state.orders.filter(o => o.Status === 'Em Produção');
        const concluidas = KitchenMonitor.state.orders.filter(o => o.Status === 'Concluída').sort((a,b) => new Date(b.CriadoEm) - new Date(a.CriadoEm)); // Mais recentes primeiro

        document.getElementById('count-pendente').innerText = pendentes.length;
        document.getElementById('count-producao').innerText = producao.length;
        document.getElementById('count-concluido').innerText = concluidas.length;

        KitchenMonitor.renderList('list-pendente', pendentes, 'pendente');
        KitchenMonitor.renderList('list-producao', producao, 'producao');
        KitchenMonitor.renderList('list-concluido', concluidas, 'concluida');
    },

    renderList: (elementId, items, type) => {
        const container = document.getElementById(elementId);
        container.innerHTML = items.map(o => {
            const detalhes = o.DetalhesProducao || {};
            const pratos = detalhes.pratos || [];
            const tempo = Math.floor((new Date() - new Date(o.CriadoEm)) / 60000); // Minutos desde criação
            
            let timeColor = 'text-gray-400';
            if (type !== 'concluida') {
                if (tempo > 30) timeColor = 'text-red-400 animate-pulse';
                else if (tempo > 15) timeColor = 'text-yellow-400';
            }

            // Botão de Ação
            let actionBtn = '';
            if (type === 'pendente') {
                actionBtn = `<button onclick="KitchenMonitor.updateStatus('${o.ID}', 'Em Produção')" class="w-full mt-3 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded font-bold text-sm transition">INICIAR PREPARO</button>`;
            } else if (type === 'producao') {
                actionBtn = `<button onclick="KitchenMonitor.updateStatus('${o.ID}', 'Concluída')" class="w-full mt-3 bg-green-600 hover:bg-green-700 text-white py-2 rounded font-bold text-sm transition">CONCLUIR</button>`;
            }

            return `
                <div class="bg-gray-700 p-4 rounded shadow-lg border-l-4 ${type === 'pendente' ? 'border-blue-500' : (type === 'producao' ? 'border-yellow-500' : 'border-green-500')} new-order">
                    <div class="flex justify-between items-start mb-2">
                        <span class="font-mono text-lg font-bold text-white">#${String(o.Codigo).padStart(4, '0')}</span>
                        <span class="text-xs font-bold ${timeColor}"><i class="far fa-clock"></i> ${tempo} min</span>
                    </div>
                    <div class="text-sm text-gray-300 mb-2 font-bold">${o.OrigemTipo || 'Rotina'}</div>
                    
                    <div class="space-y-1 mb-2">
                        ${pratos.map(p => `
                            <div class="flex justify-between text-sm border-b border-gray-600 pb-1">
                                <span class="text-white">${p.nome}</span>
                                <span class="font-bold text-yellow-400">x${p.porcoes}</span>
                            </div>
                        `).join('')}
                        ${pratos.length === 0 ? '<span class="text-gray-500 italic text-xs">Ver detalhes na ficha</span>' : ''}
                    </div>

                    ${o.Observacoes ? `<div class="text-xs text-red-300 bg-red-900/30 p-1 rounded mt-2">⚠️ ${o.Observacoes}</div>` : ''}
                    
                    ${actionBtn}
                </div>
            `;
        }).join('');
    },

    updateStatus: async (id, status) => {
        // Atualiza via API do Backend (que já trata estoque e lógica de negócio)
        // Não usamos o cliente Supabase direto aqui para garantir que a regra de negócio do backend rode
        try {
            await Utils.api('updateProductionStatus', null, { id, status, detalhes: null }); // Detalhes null mantém o atual
            // O Realtime atualizará a tela automaticamente quando o backend salvar
        } catch (e) {
            Utils.toast('Erro ao atualizar: ' + e.message, 'error');
        }
    }
};

document.addEventListener('DOMContentLoaded', KitchenMonitor.init);