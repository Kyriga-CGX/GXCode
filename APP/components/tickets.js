// APP/components/tickets.js
import { state, subscribe, setState } from '../core/state.js';
import { api } from '../core/api.js';

const statusMap = {
    'Aperto': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    'KO': 'bg-red-500/10 text-red-400 border-red-500/30',
    'Revisione Analisi': 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    'Sprint': 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    'In Test': 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
    'Preso in carico': 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
};

const borderColorMap = {
    'Aperto': 'border-l-emerald-500',
    'KO': 'border-l-red-500',
    'Revisione Analisi': 'border-l-purple-500',
    'Sprint': 'border-l-blue-500',
    'In Test': 'border-l-yellow-500',
    'Preso in carico': 'border-l-cyan-500'
};

const renderTicketItem = (t) => {
    const isActive = t.id === state.activeTicketId;
    const statusClass = statusMap[t.status] || 'bg-gray-500/10 text-gray-400 border-gray-500/30';
    const borderClass = borderColorMap[t.status] || 'border-l-gray-700';

    const priorityIcon = t.priority === 'High' || t.priority === 'Critical' ? '<span class="text-red-500">高</span>' : 
                        t.priority === 'Medium' || t.priority === 'Normal' ? '<span class="text-yellow-500">中</span>' : 
                        '<span class="text-gray-600">低</span>';

    return `
        <div data-id="${t.id}" class="ticket-item flex flex-col p-3 rounded-lg border transition-all hover:shadow-lg group border-l-[3px] ${borderClass} relative overflow-hidden ${isActive ? 'border-blue-500/50 bg-blue-500/5' : 'border-gray-800 bg-black/10'}" style="min-height: 80px;">
            <div class="relative z-10 flex flex-col h-full pointer-events-none">
                <div class="flex justify-between items-center mb-2">
                    <div class="flex items-center gap-2">
                        <span class="text-[10px] font-mono ${isActive ? 'text-blue-400 font-bold' : 'text-gray-500'} tracking-tighter">${t.id}</span>
                        <span class="text-[8px] text-gray-600 uppercase font-bold ml-1">${t.project || ''}</span>
                    </div>
                    <span class="text-[9px] px-2 py-0.5 rounded-full border ${statusClass} font-bold uppercase tracking-tighter shadow-sm pointer-events-auto">${t.status}</span>
                </div>
                
                <h4 class="text-[12px] font-bold ${isActive ? 'text-white' : 'text-gray-200'} leading-tight mb-3 group-hover:text-blue-400 transition-colors pointer-events-auto">${t.name}</h4>
                
                <div class="flex justify-between items-center mt-auto pt-2 border-t border-gray-800/50">
                    <div class="flex items-center gap-1.5 grayscale group-hover:grayscale-0 transition">
                        <div class="w-5 h-5 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-[10px] text-gray-300 shadow-sm font-bold">
                            ${t.assignee ? t.assignee.charAt(0).toUpperCase() : '?'}
                        </div>
                        <span class="text-[10px] text-gray-500 font-medium">${t.assignee || 'Unassigned'}</span>
                    </div>
                    <div class="flex items-center gap-1.5 px-1 py-0.5 rounded bg-black/20">
                        <span class="text-[10px] text-gray-600 uppercase tracking-widest font-bold">${t.priority}</span>
                        <div class="text-[12px] opacity-70">${priorityIcon}</div>
                    </div>
                </div>
            </div>
            
            <!-- Glow background overlay -->
            <div class="absolute inset-0 z-0 bg-blue-500/5 ${isActive ? 'opacity-100' : 'opacity-0'} group-hover:opacity-100 transition-opacity pointer-events-none"></div>
        </div>
    `;
};

let activeFilter = 'Tutti';
let activeSprint = 'Tutti';

const renderFilterBar = () => {
    const row1 = [
        { id: 'Tutti', label: 'Tutti' },
        { id: 'In Test', label: 'In Test' },
        { id: 'Preso in carico', label: 'Preso in carico' },
        { id: 'KO', label: 'Ko' },
        { id: 'Revisione Analisi', label: 'Rev.' }
    ];

    const sprints = ['Tutti', ...new Set(state.tickets.filter(t => t.sprint).map(t => t.sprint))];

    return `
        <div class="flex flex-col gap-2 px-3 py-3 border-b border-gray-800 bg-black/20 backdrop-blur-md">
            <!-- Row 1: Status Filters -->
            <div class="flex flex-wrap items-center gap-1.5">
                ${row1.map(cat => `
                    <button onclick="window.filterTickets('${cat.id}')" class="px-2 py-0.5 rounded text-[8px] uppercase font-bold tracking-tighter transition-all border ${activeFilter === cat.id ? 'bg-blue-600/20 border-blue-500 text-blue-400' : 'bg-black/20 border-gray-800 text-gray-500 hover:text-gray-300'}">
                        ${cat.label}
                    </button>
                `).join('')}
            </div>
            
            <!-- Row 2: Sprint Selection -->
            <div class="flex items-center gap-2">
                <span class="text-[8px] uppercase font-bold text-gray-600 tracking-widest">Sprint:</span>
                <select onchange="window.filterBySprint(this.value)" class="flex-1 bg-black/20 border border-gray-800 rounded px-2 py-1 text-[9px] text-gray-300 focus:outline-none focus:border-blue-500 transition cursor-pointer">
                    ${sprints.map(s => `<option value="${s}" ${activeSprint === s ? 'selected' : ''}>${s}</option>`).join('')}
                </select>
                <button onclick="window.filterTickets('Sprint')" class="px-2 py-1 rounded text-[8px] uppercase font-bold tracking-tighter transition-all border ${activeFilter === 'Sprint' ? 'bg-blue-600/20 border-blue-500 text-blue-400' : 'bg-black/20 border-gray-800 text-gray-500 hover:bg-black/40'}">
                    Mostra Sprint
                </button>
            </div>
        </div>
    `;
};

export const initTickets = async () => {
    const pane = document.getElementById('pane-tickets');
    if (!pane) return;

    pane.innerHTML = `
        <div class="h-10 px-4 flex items-center border-b border-gray-800 bg-black/30">
             <span class="text-[10px] uppercase font-bold text-gray-400 tracking-widest">YouTrack Assigned</span>
        </div>
        <div id="tickets-filter-root"></div>
        <div id="tickets-content" class="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar"></div>
    `;

    const filterRoot = pane.querySelector('#tickets-filter-root');
    const contentBox = pane.querySelector('#tickets-content');

    contentBox.addEventListener('click', (e) => {
        const item = e.target.closest('.ticket-item');
        if (!item) return;

        const ticketId = item.getAttribute('data-id');
        setState({ activeTicketId: ticketId === state.activeTicketId ? null : ticketId });
    });

    window.filterTickets = (cat) => { activeFilter = cat; render(); };
    window.filterBySprint = (sprint) => { activeSprint = sprint; render(); };

    const render = () => {
        filterRoot.innerHTML = renderFilterBar();
        
        const config = state.youtrackConfig || {};
        const isNotConfigured = !config.url || !config.token || !config.enabled;

        if (isNotConfigured) {
            contentBox.innerHTML = `
                <div class="flex flex-col items-center justify-center py-12 px-6 text-center animate-fade-in">
                    <div class="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center text-3xl mb-6 shadow-inner border border-blue-500/20">🎫</div>
                    <h3 class="text-xs font-bold text-gray-200 uppercase tracking-widest mb-3" data-i18n="tickets.onboardingTitle">Configura YouTrack</h3>
                    <p class="text-[10px] text-gray-500 leading-relaxed mb-8 max-w-[200px]" data-i18n="tickets.onboardingDesc">Gestisci i tuoi task direttamente dall'IDE. Collega il tuo account YouTrack per iniziare.</p>
                    
                    <button onclick="window.setState({ isSettingsOpen: true, activeSettingsTab: 'youtrack' })" class="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold rounded-lg transition shadow-lg shadow-blue-900/20 uppercase tracking-tighter" data-i18n="tickets.btnConfigure">
                        Apri Impostazioni
                    </button>
                    
                    <a href="https://www.jetbrains.com/help/youtrack/devportal/resource-api-token.html" target="_blank" class="mt-4 text-[9px] text-gray-600 hover:text-blue-400 underline transition group flex items-center gap-1">
                        <span>Come ottenere un Token?</span>
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="opacity-0 group-hover:opacity-100 transition"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/></svg>
                    </a>
                </div>
            `;
            return;
        }

        if (!state.tickets || state.tickets.length === 0) {
            contentBox.innerHTML = `
                <div class="flex flex-col items-center justify-center py-10 opacity-40">
                    <div class="text-4xl mb-4">✅</div>
                    <p class="text-[11px] text-gray-500 uppercase tracking-widest font-bold">Tutto Pulito!</p>
                    <p class="text-[9px] text-gray-600">Nessun ticket assegnato trovato.</p>
                </div>
            `;
            return;
        }

        let filtered = state.tickets;
        if (activeFilter !== 'Tutti') {
            filtered = filtered.filter(t => t.status === activeFilter);
        }
        if (activeSprint !== 'Tutti') {
            filtered = filtered.filter(t => t.sprint === activeSprint);
        }

        contentBox.innerHTML = filtered.map(renderTicketItem).join('');
    };

    subscribe(render);

    try {
        await api.loadTickets();
    } catch(e) {
        console.warn("Tickets API not responding.");
    }
};
