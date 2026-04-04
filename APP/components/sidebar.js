import { state, subscribe, setState } from '../core/state.js';
import { api } from '../core/api.js';

/**
 * Gestore centralizzato delle azioni della Sidebar (v8.0 Professional)
 * Inizializzato a livello documento per massima affidabilità.
 */
document.addEventListener('click', async (e) => {
    // 1. Identificazione pulsante azione
    const actionBtn = e.target.closest('[data-action]');
    const action = actionBtn ? actionBtn.dataset.action : null;

    // Se stiamo creando un nuovo elemento, non serve una card
    if (action === 'create-new') {
        const type = state.activeRightTab || 'agents';
        window.openCrudModal(type, null);
        return;
    }

    // 2. Identificazione card (supporto per entrambi i nomi classi per compatibilità)
    const card = e.target.closest('.sidebar-card-evolution, .sidebar-card-compact, .sidebar-card-elite');
    if (!card) return;

    const type = card.dataset.type; // 'agents' o 'skills'
    const id = card.dataset.id;
    const items = type === 'agents' ? (state.agents || []) : (state.skills || []);
    
    // Trova l'elemento
    const item = items.find(i => (i.slug || i.id) == id);

    if (!item) {
        console.warn(`[GX-SIDEBAR] Fallito lookup per ${type}:${id}`);
        return;
    }

    // GESTIONE AZIONI SPECIFICHE
    if (actionBtn) {
        e.stopPropagation();
        
        if (action === 'delete') {
            if (window.gxConfirm) {
                window.gxConfirm(
                    "CONFERMA RIMOZIONE",
                    `Sei sicuro di voler eliminare definitivamente "${item.name}"?`,
                    async () => {
                        try {
                            if (type === 'agents') await api.deleteAgent(id);
                            else await api.deleteSkill(id);
                            window.gxToast("Modulo rimosso correttamente", "success");
                        } catch(err) {
                            console.error("Errore eliminazione:", err);
                            window.gxToast("Errore durante la rimozione", "error");
                        }
                    }
                );
            }
        } else if (action === 'edit') {
            window.openCrudModal(type, item);
        }
        return;
    }

    // CLICK SULLA CARD (apre modifica) - Solo per i vecchi tipi di card
    if (card.classList.contains('sidebar-card-elite')) return; 
    
    window.openCrudModal(type, item);
});

export const handleSkillFilter = (e) => {
    e.preventDefault();
    e.stopPropagation();

    const skills = state.skills || [];
    const categories = [...new Set(skills.map(s => s.category).filter(Boolean))];
    
    const items = [
        { label: 'Mostra Tutto', icon: 'layers', onClick: () => setState({ activeSkillCategory: 'all' }) },
        { divider: true },
        ...categories.map(cat => ({
            label: cat,
            icon: 'box',
            color: state.activeSkillCategory === cat ? 'text-blue-400 font-bold' : '',
            onClick: () => setState({ activeSkillCategory: cat })
        }))
    ];

    if (window.showGenericMenu) {
        window.showGenericMenu(e, items);
    }
};

export const updateActivityBar = (activeActivity) => {
    const buttons = {
        explorer: document.getElementById('activity-explorer'),
        search: document.getElementById('activity-search'),
        git: document.getElementById('activity-git'),
        debug: document.getElementById('activity-debug'),
        testing: document.getElementById('activity-testing')
    };

    Object.entries(buttons).forEach(([key, btn]) => {
        if (!btn) return;
        
        // Rimuove vecchi indicatori se presenti
        const oldPill = btn.querySelector('.activity-glow-pill');
        if (oldPill) oldPill.remove();

        if (key === activeActivity) {
            btn.classList.add('text-blue-500');
            btn.classList.remove('text-gray-500');
            
            const pill = document.createElement('div');
            pill.className = 'activity-glow-pill';
            btn.appendChild(pill);
        } else {
            btn.classList.remove('text-blue-500');
            btn.classList.add('text-gray-500');
        }
    });
};

export const updateRightTabs = (activeTab) => {
    const tabs = {
        agents: document.getElementById('sidebar-tab-agents'),
        skills: document.getElementById('sidebar-tab-skills'),
        companion: document.getElementById('sidebar-tab-ai-companion')
    };

    // 1. GESTIONE CLASSI ACTIVE (Fissiamo il bug visivo)
    Object.entries(tabs).forEach(([key, tab]) => {
        if (!tab) return;
        if (key === activeTab) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });

    // 2. MOSTRA/NASCONDI CATEGORIE SKILLS SE NECESSARIO
    const skillCats = document.getElementById('skill-categories');
    if (skillCats) skillCats.classList.toggle('hidden', activeTab !== 'skills');
};

export const updateLeftTabs = (activeTab) => {
    const btnExplorer = document.getElementById('left-tab-explorer');
    const btnIssues = document.getElementById('left-tab-issues');
    const paneExplorer = document.getElementById('pane-explorer');
    const paneIssues = document.getElementById('pane-issues');

    if (activeTab === 'explorer') {
        if (btnExplorer) {
            btnExplorer.classList.add('active', 'text-[var(--accent)]', 'bg-[var(--bg-side-alt)]');
            btnExplorer.classList.remove('text-gray-500');
        }
        if (btnIssues) {
            btnIssues.classList.remove('active', 'text-[var(--accent)]', 'bg-[var(--bg-side-alt)]');
            btnIssues.classList.add('text-gray-500');
        }
        if (paneExplorer) paneExplorer.classList.remove('hidden');
        if (paneIssues) paneIssues.classList.add('hidden');
    } else {
        if (btnIssues) {
            btnIssues.classList.add('active', 'text-[var(--accent)]', 'bg-[var(--bg-side-alt)]');
            btnIssues.classList.remove('text-gray-500');
        }
        if (btnExplorer) {
            btnExplorer.classList.remove('active', 'text-[var(--accent)]', 'bg-[var(--bg-side-alt)]');
            btnExplorer.classList.add('text-gray-500');
        }
        if (paneExplorer) paneExplorer.classList.add('hidden');
        if (paneIssues) paneIssues.classList.remove('hidden');
    }
};

// --- PANES MANAGEMENT (VISION 2026 ELITE SPLIT) ---
export function updatePanes(activeActivity) {
    const secondarySection = document.getElementById('sidebar-secondary-section');
    const dragBar = document.getElementById('sidebar-drag-bar');
    
    // Pannelli secondari
    const secondaryPanes = {
        search: document.getElementById('pane-search'),
        git: document.getElementById('pane-git'),
        debug: document.getElementById('pane-debug'),
        testing: document.getElementById('pane-testing')
    };

    // Nascondi tutti i pannelli secondari inizialmente
    Object.values(secondaryPanes).forEach(p => p?.classList.add('hidden'));

    if (activeActivity === 'explorer') {
        // Se l'attività è Explorer, il pannello secondario si chiude
        secondarySection.style.height = '0px';
        secondarySection.classList.remove('active');
        dragBar.classList.add('hidden');
    } else if (secondaryPanes[activeActivity]) {
        // Mostra il pannello richiesto nella sezione secondaria
        secondaryPanes[activeActivity].classList.remove('hidden');
        
        // Espandi la sezione secondaria se è chiusa
        if (!secondarySection.classList.contains('active')) {
            secondarySection.style.height = '40%'; // Default split
            secondarySection.classList.add('active');
        }
        dragBar.classList.remove('hidden');
    }

    // Aggiorna icone Activity Bar
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active', 'text-white', 'bg-white/10');
        btn.classList.add('text-gray-500');
    });

    const activeBtn = document.getElementById(`activity-${activeActivity}`);
    if (activeBtn) {
        activeBtn.classList.add('active', 'text-white', 'bg-white/10');
        activeBtn.classList.remove('text-gray-500');
    }
}

// --- SIDEBAR RESIZER LOGIC ---
function initSidebarResizer() {
    const dragBar = document.getElementById('sidebar-drag-bar');
    const primary = document.getElementById('sidebar-primary-section');
    const secondary = document.getElementById('sidebar-secondary-section');
    const container = document.getElementById('left-sidebar');

    let isDragging = false;

    dragBar.addEventListener('mousedown', (e) => {
        isDragging = true;
        document.body.style.cursor = 'row-resize';
        dragBar.classList.add('bg-blue-500');
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;

        const containerRect = container.getBoundingClientRect();
        const relativeY = e.clientY - containerRect.top;
        const containerHeight = containerRect.height;
        
        // Vincoli: almeno 100px per sezione
        if (relativeY > 100 && relativeY < containerHeight - 100) {
            const percentage = (relativeY / containerHeight) * 100;
            primary.style.flex = `0 0 ${percentage}%`;
            secondary.style.height = `${100 - percentage}%`;
        }
    });

    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            document.body.style.cursor = 'default';
            dragBar.classList.remove('bg-blue-500');
        }
    });
}

export const renderSidebar = () => {
    const container = document.getElementById('sidebar-content');
    if (!container) return;

    const activeTab = state.activeRightTab || 'agents';
    const searchQuery = (document.getElementById('sidebar-search')?.value || '').toLowerCase();
    
    if (activeTab === 'agents') {
        const agents = state.agents || [];
        const filtered = agents.filter(a => 
            a.name.toLowerCase().includes(searchQuery) || 
            (a.description && a.description.toLowerCase().includes(searchQuery))
        );
        
        if (filtered.length === 0) {
            container.innerHTML = `
                <div class="flex flex-col items-center justify-center p-8 text-center gap-4 mt-6 animate-fade-in opacity-40">
                    <div class="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 text-2xl">🤖</div>
                    <div class="space-y-1">
                        <h3 class="text-[10px] font-bold text-gray-200 uppercase tracking-[0.3em]">Nessun Agente</h3>
                        <p class="text-[9px] text-gray-500 uppercase tracking-tighter">Personalizza il tuo flusso di lavoro creando il tuo primo agente.</p>
                    </div>
                </div>
                </div>
            `;
            return;
        }

        container.innerHTML = filtered.map(agent => {
            const key = agent.slug || agent.id;
            const initial = (agent.name || 'A').charAt(0).toUpperCase();
            return `
                <div class="sidebar-card-elite flex flex-col p-4 bg-[#0b0c10] border border-blue-500/20 rounded-md hover:border-blue-500/40 transition-all gap-3 group mb-2.5 mx-3.5 shadow-2xl relative overflow-hidden"
                     data-type="agents" data-id="${key}">
                    
                    <!-- Header: Icon + Name + Status -->
                    <div class="flex items-center justify-between gap-3 relative z-10">
                        <div class="flex items-center gap-2.5 overflow-hidden">
                            <div class="w-8 h-8 rounded bg-blue-500/5 flex items-center justify-center text-blue-400 border border-blue-500/15 transition-transform flex-shrink-0 font-black text-[10px]">
                                ${initial}
                            </div>
                            <div class="flex flex-col min-w-0">
                                <h4 class="text-[10px] font-black text-gray-300 uppercase tracking-tight truncate leading-tight">${agent.name}</h4>
                                <span class="text-[7px] text-gray-600 font-bold uppercase tracking-widest opacity-60">Operational Agent</span>
                            </div>
                        </div>
                        <div class="flex items-center gap-1 bg-emerald-500/5 px-2 py-0.5 rounded border border-emerald-500/10 flex-shrink-0">
                            <span class="w-1 h-1 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span class="text-[7px] font-black text-emerald-500/70 uppercase tracking-widest">Active</span>
                        </div>
                    </div>

                    <!-- Body: Description (Ultra-compact) -->
                    <div class="text-[9px] text-gray-500/80 leading-tight line-clamp-1 opacity-60 px-0.5">
                        ${agent.description || 'Nessuna descrizione configurata.'}
                    </div>

                    <!-- Footer: Actions -->
                    <div class="flex items-center gap-2">
                        <button class="flex-1 py-1.5 bg-white/max-[0.02] hover:bg-white/5 text-gray-500 hover:text-gray-300 text-[8px] font-black uppercase tracking-[0.2em] rounded-sm border border-white/5 transition-all text-center active:scale-[0.98]"
                                data-action="edit">
                            Configura
                        </button>
                        <button class="flex-1 py-1.5 bg-red-500/max-[0.02] hover:bg-red-500/10 text-red-500/40 hover:text-red-400 text-[8px] font-black uppercase tracking-[0.2em] rounded-sm border border-red-500/10 hover:border-red-500/25 transition-all text-center active:scale-[0.98]"
                                data-action="delete">
                            Elimina
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    } else if (activeTab === 'skills') {
        const skills = state.skills || [];
        const activeCat = state.activeSkillCategory || 'all';
        const filtered = skills.filter(s => {
            const matchesSearch = s.name.toLowerCase().includes(searchQuery);
            const matchesCat = activeCat === 'all' || s.category === activeCat;
            return matchesSearch && matchesCat;
        });

        // Aggiorna stile tasto filtro se attivo
        const filterBtn = document.getElementById('skill-filter-btn');
        if (filterBtn) {
            if (activeCat !== 'all') {
                filterBtn.classList.add('text-emerald-400', 'bg-emerald-400/10', 'rounded-lg');
                filterBtn.classList.remove('text-gray-500');
            } else {
                filterBtn.classList.remove('text-emerald-400', 'bg-emerald-400/10', 'rounded-lg');
                filterBtn.classList.add('text-gray-500');
            }
        }
        
        if (filtered.length === 0) {
            container.innerHTML = `
                <div class="flex flex-col items-center justify-center p-8 text-center gap-4 mt-6 animate-fade-in opacity-40">
                    <div class="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 text-2xl">⚡</div>
                    <div class="space-y-1">
                        <h3 class="text-[10px] font-bold text-gray-200 uppercase tracking-[0.3em]">Nessuna Skill</h3>
                        <p class="text-[9px] text-gray-500 uppercase tracking-tighter">Espandi le capacità dell'IDE aggiungendo nuove skill personalizzate.</p>
                    </div>
                </div>
            `;
            return;
        }

        container.innerHTML = filtered.map(skill => {
            const key = skill.slug || skill.id;
            const initial = (skill.name || 'S').charAt(0).toUpperCase();
            return `
                <div class="sidebar-card-evolution group"
                     data-type="skills" data-id="${key}">
                    <div class="avatar-evolution !bg-emerald-500/20 !text-emerald-400 !border-emerald-500/30 font-black shadow-[0_0_10px_rgba(16,185,129,0.2)]">${initial}</div>
                    <div class="flex flex-col min-w-0 flex-1">
                        <h4 class="text-[12px] font-bold text-gray-200 truncate leading-tight">${skill.name}</h4>
                        <span class="text-[9px] text-[#8b949e] uppercase tracking-wider font-bold">${skill.category || 'SKILL'}</span>
                    </div>
                    <div class="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button class="sidebar-action-btn" data-action="edit" title="Modifica">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button class="sidebar-action-btn hover:text-red-400" data-action="delete" title="Elimina">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    } else if (activeTab === 'companion') {
        container.innerHTML = `
            <div class="flex flex-col items-center justify-center p-8 text-center gap-4 mt-6 animate-fade-in">
                <div class="w-20 h-20 rounded-full bg-gradient-to-br from-purple-500/20 to-indigo-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400 text-3xl animate-pulse shadow-[0_0_30px_rgba(168,85,247,0.2)]">✨</div>
                <div class="space-y-1">
                    <h3 class="text-[11px] font-bold text-gray-200 uppercase tracking-widest">AI Companion</h3>
                    <p class="text-[10px] text-gray-500 leading-relaxed uppercase tracking-tighter">Attiva assistenti dedicati dal Marketplace per potenziare il tuo flusso di lavoro.</p>
                </div>
                <button onclick="setState({ isMarketplaceOpen: true, activeMarketplaceTab: 'ai-companion' })" class="mt-2 px-8 py-2.5 bg-purple-600 hover:bg-purple-500 text-white shadow-[0_4px_20px_rgba(168,85,247,0.4)] text-[10px] font-bold rounded-xl transition-all active:scale-95 uppercase tracking-widest">Sfoglia Companion</button>
            </div>
        `;
    }
};

export const initSidebar = () => {
    document.getElementById('sidebar-tab-agents')?.addEventListener('click', () => {
        const searchInput = document.getElementById('sidebar-search');
        if (searchInput) searchInput.value = '';
        setState({ activeRightTab: 'agents' });
    });
    document.getElementById('sidebar-tab-skills')?.addEventListener('click', () => {
        const searchInput = document.getElementById('sidebar-search');
        if (searchInput) searchInput.value = '';
        setState({ activeRightTab: 'skills' });
    });
    document.getElementById('sidebar-tab-ai-companion')?.addEventListener('click', () => {
        const searchInput = document.getElementById('sidebar-search');
        if (searchInput) searchInput.value = '';
        setState({ activeRightTab: 'companion' });
    });
    
    document.getElementById('skill-filter-btn')?.addEventListener('click', (e) => handleSkillFilter(e));

    // Ricerca Istantanea Sidebar
    document.getElementById('sidebar-search')?.addEventListener('input', () => {
        renderSidebar();
    });
    
    // ACTIVITY BAR LISTENERS (Elite Navigation)
    const btnMap = {
        'activity-explorer': 'explorer',
        'activity-search': 'search',
        'activity-git': 'git',
        'activity-debug': 'debug',
        'activity-testing': 'testing'
    };

    Object.entries(btnMap).forEach(([id, act]) => {
        document.getElementById(id)?.addEventListener('click', () => {
            setState({ activeActivity: act, isLeftSidebarOpen: true });
        });
    });

    // LEFT TABS (Explorer / Issues)
    document.getElementById('left-tab-explorer')?.addEventListener('click', () => {
        setState({ activeLeftTab: 'explorer' });
    });
    document.getElementById('left-tab-issues')?.addEventListener('click', () => {
        setState({ activeLeftTab: 'issues' });
    });

    // SIDEBAR RESIZER INITIALIZATION
    initSidebarResizer();

    // ESPOSIZIONE GLOBALE (Per app.js subscriber)
    window.updateActivityBar = updateActivityBar;
    window.updateRightTabs = updateRightTabs;
    window.updateLeftTabs = updateLeftTabs;
    window.updatePanes = updatePanes;

    subscribe((newState, oldState) => {
        // OTTIMIZZAZIONE FLICKER: Renderizza il contenuto laterale solo se cambiano i dati rilevanti
        const needsResSidebar =
            newState.activeRightTab !== oldState?.activeRightTab ||
            newState.agents !== oldState?.agents ||
            newState.skills !== oldState?.skills ||
            newState.activeSkillCategory !== oldState?.activeSkillCategory;

        if (needsResSidebar) {
            renderSidebar();
        }
    });
    renderSidebar();
};
