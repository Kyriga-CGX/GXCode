import { api } from '../core/api.js';
import { state, subscribe, setState } from '../core/state.js';
import { loadLocale } from '../core/i18n.js';
import { initMarketplace } from '../components/marketplace.js';
import { initTerminal } from '../components/terminal.js';
import { initSettings } from '../components/settings.js';
import { initTickets } from '../components/tickets.js';
import { initWorkspace } from '../components/workspace.js';
import { initCrud } from '../components/crud.js';
import { gxConfirm } from '../components/dialogs.js';
import { initGit } from '../components/git.js';
import { initSearch } from '../components/search.js';
import { initTests } from '../components/tests.js';
import { initBottomPanel } from '../components/bottomPanel.js';
import { initProblems } from '../components/problems.js';
import { initUpdater } from '../components/updater.js';
import { initDebug } from '../components/debug.js';
import { initGxAgent } from '../components/gxAgent.js';
import { listAvailableModels } from '../core/geminiApi.js';
import { initAiKnowledgeBridge } from '../core/aiKnowledgeBridge.js';
// initContextMenu non necessario (gestito da workspace.js)

// DOM Elements Right Sidebar
const sidebarContent = document.getElementById('sidebar-content');
const tabAgents = document.getElementById('sidebar-tab-agents');
const tabSkills = document.getElementById('sidebar-tab-skills');
const tabAiCompanion = document.getElementById('sidebar-tab-ai-companion');
const sidebarTitle = document.getElementById('sidebar-dynamic-title');
const sidebarSearch = document.getElementById('sidebar-search');
const skillCategories = document.getElementById('skill-categories');

let searchTerm = '';
let activeCategory = 'all';

// DOM Elements Left Sidebar
const leftTabExplorer = document.getElementById('left-tab-explorer');
const leftTabTickets = document.getElementById('left-tab-tickets');
const paneExplorer = document.getElementById('pane-explorer');
const paneTickets = document.getElementById('pane-tickets');
const updateActivityBar = (activity) => {
    const icons = {
        explorer: document.getElementById('activity-explorer'),
        search: document.getElementById('activity-search'),
        git: document.getElementById('activity-git'),
        debug: document.getElementById('activity-debug'),
        testing: document.getElementById('activity-testing')
    };
    Object.entries(icons).forEach(([key, el]) => {
        if (!el) return;
        if (key === activity) {
            el.className = "p-2.5 text-blue-500 hover:text-white transition rounded-md border-l-2 border-blue-500 bg-gray-800/30";
        } else {
            el.className = "p-2.5 text-gray-500 hover:text-white transition rounded-md border-transparent";
        }
    });
};

const updatePanes = (activity) => {
    const panes = {
        explorer: document.getElementById('pane-explorer-root'),
        search: document.getElementById('pane-search'),
        git: document.getElementById('pane-git'),
        debug: document.getElementById('pane-debug'),
        testing: document.getElementById('pane-testing')
    };
    Object.entries(panes).forEach(([key, el]) => {
        if (el) el.classList.toggle('hidden', key !== activity);
    });

    // Special handling for explorer tabs
    if (activity === 'explorer') {
        updateLeftSidebarTabs();
    }
};

// Terminal & Collapsers

const leftSidebar = document.getElementById('left-sidebar');
const rightSidebar = document.getElementById('right-sidebar');
const bottomPanel = document.getElementById('bottom-panel');

const btnLeftToggle = document.getElementById('toggle-left-btn');
const btnRightToggle = document.getElementById('toggle-right-btn');
const btnTerminalToggle = document.getElementById('toggle-terminal-btn');

// --- METODI DI RENDERING UI MODULARE ---

const renderSidebarItem = (item, type) => {
    // Layout basato sul vecchio design
    const div = document.createElement('div');
    div.setAttribute('data-id', item.id);
    div.setAttribute('data-type', type);
    div.className = "flex flex-col p-3 rounded-lg border border-gray-800/80 bg-[#161b22]/50 hover:bg-[#1d232b] cursor-pointer transition shadow-sm group";

    // Icona in base a bot o skill
    const avatar = type === 'agents'
        ? `<div class="w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs shrink-0 border border-blue-500/30">A</div>`
        : `<div class="w-8 h-8 rounded bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold text-xs shrink-0 border border-purple-500/30"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg></div>`;

    // Source tag
    const sourceTag = item._managedBy
        ? `<span class="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mt-1 self-start">${item._managedBy}</span>`
        : '';

    div.innerHTML = `
        <div class="flex items-center gap-3">
            ${avatar}
            <div class="flex flex-col flex-1 overflow-hidden">
                <span class="text-sm font-semibold text-gray-200 truncate pr-1">${item.name}</span>
                <span class="text-[10px] text-gray-500 truncate uppercase tracking-widest leading-none mt-0.5">${item.role || item.category || 'General'}</span>
            </div>
            <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button data-action="edit" data-id="${item.id}" data-type="${type}" class="p-1.5 text-gray-500 hover:text-blue-400 transition bg-[#161b22] hover:bg-[#1d232b] rounded-sm" data-i18n="[title]sidebar.editTooltip" title="${window.t('sidebar.editTooltip')}">
                     <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                </button>
                <button data-action="delete" data-id="${item.id}" data-type="${type}" class="p-1.5 text-gray-500 hover:text-red-400 transition bg-[#161b22] hover:bg-[#1d232b] rounded-sm" data-i18n="[title]sidebar.deleteTooltip" title="${window.t('sidebar.deleteTooltip')}">
                     <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
            </div>
        </div>
        ${sourceTag}
    `;
    return div;
};

// Gestione delle Tab Sidebar per Active View
const updateSidebarTabs = () => {
    // Reset all
    [tabAgents, tabSkills, tabAiCompanion].forEach(t => {
        if (t) t.className = "flex-1 py-3 text-sm font-semibold border-b-[2px] transition text-gray-500 border-transparent hover:text-gray-300";
    });

    if (state.activeSidebarTab === 'agents') {
        sidebarTitle.textContent = window.t('sidebar.agents');
        sidebarTitle.dataset.i18n = 'sidebar.agents';
        if (tabAgents) tabAgents.className = "flex-1 py-3 text-sm font-semibold border-b-[2px] transition text-blue-400 border-blue-500 bg-[#161b22]";
    } else if (state.activeSidebarTab === 'skills') {
        sidebarTitle.textContent = window.t('sidebar.skills');
        sidebarTitle.dataset.i18n = 'sidebar.skills';
        if (tabSkills) tabSkills.className = "flex-1 py-3 text-sm font-semibold border-b-[2px] transition text-purple-400 border-purple-500 bg-[#161b22]";
    } else {
        sidebarTitle.textContent = "Companion";
        sidebarTitle.dataset.i18n = ""; 
        if (tabAiCompanion) tabAiCompanion.className = "flex-1 py-3 text-sm font-semibold border-b-[2px] transition text-emerald-400 border-emerald-500 bg-[#161b22]";
    }
};

// La funzione vitale che svuota e ririempie la dom IN TEMPO REALE
const updateLeftSidebarTabs = () => {
    if (!leftTabExplorer || !leftTabTickets || !paneExplorer || !paneTickets) return;

    if (state.activeLeftTab === 'explorer') {
        leftTabExplorer.className = "flex-1 py-2 text-[10px] uppercase tracking-wider font-semibold border-b-[2px] transition text-gray-300 border-blue-500 bg-[#161b22]";
        leftTabTickets.className = "flex-1 py-2 text-[10px] uppercase tracking-wider font-semibold border-b-[2px] transition text-gray-500 border-transparent hover:text-gray-300";
        paneExplorer.classList.remove('hidden');
        paneTickets.classList.add('hidden');
    } else {
        leftTabTickets.className = "flex-1 py-2 text-[10px] uppercase tracking-wider font-semibold border-b-[2px] transition text-gray-300 border-blue-500 bg-[#161b22]";
        leftTabExplorer.className = "flex-1 py-2 text-[10px] uppercase tracking-wider font-semibold border-b-[2px] transition text-gray-500 border-transparent hover:text-gray-300";
        paneTickets.classList.remove('hidden');
        paneExplorer.classList.add('hidden');
    }
};

const renderSidebar = () => {
    sidebarContent.innerHTML = '';
    const rawList = state.activeSidebarTab === 'agents' ? state.agents 
                    : state.activeSidebarTab === 'skills' ? state.skills 
                    : state.plugins || [];
    
    // Safety Filter: Deduplicazione per ID per evitare "fantasmi" in UI
    const activeList = Array.from(new Map(rawList.map(item => [item.id, item])).values());
    
    // Icon mapping per renderSidebarItem
    const type = state.activeSidebarTab === 'agents' ? 'agents' 
               : state.activeSidebarTab === 'skills' ? 'skills' 
               : 'ai-companion';
    
    // UI Adjustments for AI Companion
    const searchContainer = sidebarSearch ? sidebarSearch.parentElement : null;
    const createBtn = document.querySelector('[data-action="create-new"]');
    
    if (state.activeSidebarTab === 'ai-companion') {
        if (searchContainer) searchContainer.classList.add('hidden');
        if (createBtn) createBtn.setAttribute('title', 'Coming soon');
    } else {
        if (searchContainer) searchContainer.classList.remove('hidden');
        if (createBtn) createBtn.removeAttribute('title');
    }
    
    // Filtro Ricerca
    let filtered = activeList.filter(item => 
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    // Filtro Categoria (solo per Skills)
    if (state.activeSidebarTab === 'skills' && activeCategory !== 'all') {
        filtered = filtered.filter(item => 
            item.category && item.category.toLowerCase() === activeCategory.toLowerCase()
        );
    }

    if (filtered.length === 0) {
        const isComingSoon = state.activeSidebarTab === 'ai-companion';
        sidebarContent.innerHTML = `
            <div class="flex flex-col items-center justify-center p-8 text-center gap-2 opacity-60">
                <div class="text-[10px] font-bold text-gray-500 uppercase tracking-widest bg-gray-800/50 px-2 py-1 rounded" data-i18n="${isComingSoon ? '' : 'sidebar.noResults'}">
                    ${isComingSoon ? 'Coming soon' : window.t('sidebar.noResults')}
                </div>
                <p class="text-[9px] text-gray-600 uppercase tracking-tighter" data-i18n="${isComingSoon ? '' : 'sidebar.searchHint'}">
                    ${isComingSoon ? 'Funzione in fase di studio' : window.t('sidebar.searchHint')}
                </p>
            </div>
        `;
        return;
    }
    
    if (state.activeSidebarTab === 'ai-companion') {
        // La chat (GX-Agent) è stata rimossa per ora su richiesta.
        // Verrà mostrato il placeholder "Coming soon" gestito dal blocco filtered.length === 0.
        filtered = []; // Forza lo stato vuoto per mostrare il Coming soon
    }

    filtered.forEach(item => {
        sidebarContent.appendChild(renderSidebarItem(item, state.activeSidebarTab));
    });
};

// --- BINDING STARTUP ---
// Expose setState globally so context menu and other modules can reach it
window.setState = setState;

const bootstrap = async () => {
    // Carica le traduzioni prima di tutto
    await loadLocale(state.language || 'it');

    // --- WINDOW CONTROLS BINDINGS ---
    document.getElementById('win-min')?.addEventListener('click', () => window.electronAPI.windowControl('minimize'));
    document.getElementById('win-max')?.addEventListener('click', () => window.electronAPI.windowControl('maximize'));
    document.getElementById('win-close')?.addEventListener('click', () => window.electronAPI.windowControl('close'));
    document.getElementById('nav-devtools')?.addEventListener('click', () => window.electronAPI.openDevTools());

    // Leghiamo i tasti
    if (tabAgents) tabAgents.onclick = () => {
        setState({ activeSidebarTab: 'agents' });
        skillCategories.classList.add('hidden');
    };
    if (tabSkills) tabSkills.onclick = () => {
        setState({ activeSidebarTab: 'skills' });
        skillCategories.classList.remove('hidden');
    };
    if (tabAiCompanion) tabAiCompanion.onclick = () => {
        setState({ activeSidebarTab: 'ai-companion' });
        skillCategories.classList.add('hidden');
    };
    
    // Gestione tasto + (Create New) - Disabilitato per AI Companion
    const createBtn = document.querySelector('[data-action="create-new"]');
    if (createBtn) {
        const originalOnClick = createBtn.onclick;
        createBtn.onclick = (e) => {
            if (state.activeSidebarTab === 'ai-companion') {
                e.preventDefault();
                e.stopPropagation();
                // Mostra un piccolo toast o feedback se necessario, ma qui l'utente vuole solo il tooltip
                return;
            }
            // Se c'era un handler dinamico altrove, lo lasciamo agire, 
            // ma app.js non definisce l'handler qui, è solitamente in crud.js o workspace.js
        };
    }
    
    // Gestione Ricerca
    if (sidebarSearch) {
        sidebarSearch.oninput = (e) => {
            searchTerm = e.target.value;
            renderSidebar();
        };
    }

    // Gestione Categorie
    if (skillCategories) {
        skillCategories.onclick = (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;
            
            // Reset styles
            skillCategories.querySelectorAll('button').forEach(b => {
                b.className = "px-2 py-0.5 rounded text-[9px] bg-gray-800 text-gray-400 border border-gray-700 hover:bg-gray-700 transition lowercase";
            });
            
            btn.className = "px-2 py-0.5 rounded text-[9px] bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition lowercase";
            activeCategory = btn.getAttribute('data-cat');
            renderSidebar();
        };
    }

    // Market Section Bindings
    const btnMarketAgents = document.getElementById('nav-market-agents');
    const btnMarketSkills = document.getElementById('nav-market-skills');
    const btnMarketAddons = document.getElementById('nav-market-addons');

    if (btnMarketAgents) btnMarketAgents.onclick = () => setState({ isMarketplaceOpen: true, activeMarketplaceTab: 'agents', isSettingsOpen: false });
    if (btnMarketSkills) btnMarketSkills.onclick = () => setState({ isMarketplaceOpen: true, activeMarketplaceTab: 'skills', isSettingsOpen: false });
    if (btnMarketAddons) btnMarketAddons.onclick = () => setState({ isMarketplaceOpen: true, activeMarketplaceTab: 'addons', isSettingsOpen: false });

    // Moduli separati
    initMarketplace();
    initTerminal();
    initSettings();
    initTickets();
    initWorkspace();
    // initContextMenu(); <-- Rimossa poiché non necessaria e non esportata
    // Esposizione Globale per componenti Legacy/Agenti
    window.state = state;
    window.setState = setState;

    initCrud();
    initGit();
    initBottomPanel();
    initGxAgent();
    initAiKnowledgeBridge();
    
    // --- GLOBAL SHORTCUT DISPATCHER (Dynamic & Professional) ---
    window.addEventListener('keydown', (e) => {
        // Ignora se siamo in un input o textarea (tranne salvataggio)
        const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName);
        
        let keys = [];
        if (e.ctrlKey || e.metaKey) keys.push('Ctrl');
        if (e.shiftKey) keys.push('Shift');
        if (e.altKey) keys.push('Alt');
        
        // Mappa tasti speciali
        const key = e.key === ' ' ? 'Space' : e.key.charAt(0).toUpperCase() + e.key.slice(1);
        if (!['Control', 'Shift', 'Alt', 'Meta'].includes(key)) {
            keys.push(key);
        }

        const shortcutStr = keys.join('+');
        const binding = state.shortcuts[shortcutStr];

        if (binding) {
            // Se siamo in un input, permettiamo solo il salvataggio o scorciatoie non conflittuali
            if (isInput && !['editor:save', 'editor:format'].includes(binding.action)) return;

            e.preventDefault();
            console.log(`[GX-SHORTCUT] Triggering Action: ${binding.action} for ${shortcutStr}`);
            
            switch (binding.action) {
                case 'editor:save': 
                    if (window.saveActiveFile) window.saveActiveFile(); 
                    break;
                case 'editor:format': 
                    if (window.formatActiveFile) window.formatActiveFile(); 
                    break;
                case 'search:quick-open': 
                    setState({ activeActivity: 'search', isLeftSidebarOpen: true });
                    setTimeout(() => document.getElementById('global-search-input')?.focus(), 50);
                    break;
                case 'sidebar:toggle': 
                    if (window.toggleSidebar) window.toggleSidebar(); 
                    break;
                case 'search:global':
                    setState({ activeActivity: 'search', isLeftSidebarOpen: true });
                    break;
            }
        }
    });

    // Listen for Gemini Official OAuth Success
    if (window.electronAPI.onGeminiAuthSuccess) {
        window.electronAPI.onGeminiAuthSuccess((data) => {
            console.log("[GX-AGENT] OAuth Success:", data.email);
            setState({
                geminiConfig: {
                    isAuthenticated: true,
                    user: {
                        email: data.email,
                        name: data.name,
                        picture: data.picture
                    },
                    token: data.code // Token di accesso
                }
            });
            // Carica modelli reali per questo account
            listAvailableModels();
            // Forza il re-render della chat se visibile nel Bottom Panel
            if (window.renderGxAgentChat) {
                window.renderGxAgentChat();
            }
        });
    }

    // Event Delegation for CRUD in the Right Sidebar (Global for Header + Content)
    if (rightSidebar) {
        rightSidebar.addEventListener('click', async (e) => {
            const btn = e.target.closest('button[data-action]');
            const itemElement = e.target.closest('[data-id]');
            
            if (!btn && itemElement) {
                // Selezione Agente/Persona
                const id = itemElement.getAttribute('data-id');
                const type = itemElement.getAttribute('data-type');
                if (type === 'agents') {
                    console.log(`[GX-AGENT] Attivazione Persona ID: ${id}`);
                    setState({ activeAgentId: id });
                }
                return;
            }

            if (!btn) return;
            const action = btn.getAttribute('data-action');

            if (action === 'create-new') {
                if (window.openCrudModal) window.openCrudModal(state.activeSidebarTab, null);
                return;
            }

            const id = btn.getAttribute('data-id');
            const type = btn.getAttribute('data-type');
            if (!id || !type) return;

            const list = type === 'agents' ? state.agents : (type === 'skills' ? state.skills : state.plugins);
            const item = list.find(i => String(i.id) === String(id));
            if (!item) return;
            if (action === 'delete') {
                console.log(`[GX-DELETE] Requesting deletion for ${type} ID: ${id}`);
                const typeLabel = type === 'agents' ? window.t('crud.agent') : (type === 'skills' ? window.t('crud.skill') : window.t('crud.addon'));
                const modalTitle = window.t('contextMenu.delete') + " " + typeLabel;
                const modalMsg = window.t('contextMenu.deleteConfirm').replace('{path}', `<strong>${item.name || '...'}</strong>`);
                
                if (window.gxConfirm) {
                    window.gxConfirm(modalTitle, modalMsg, async () => {
                        console.log(`[GX-DELETE] Confirmed deletion for ${id}`);
                        if (type === 'agents') await api.deleteAgent(id);
                        else if (type === 'skills') await api.deleteSkill(id);
                        else await api.deletePlugin(id);
                        await api.loadAll(); 
                    });
                } else {
                    if (confirm(`Vuoi eliminare: ${item.name || id}?`)) {
                        console.log(`[GX-DELETE] Native confirm deletion for ${id}`);
                        if (type === 'agents') await api.deleteAgent(id);
                        else if (type === 'skills') await api.deleteSkill(id);
                        else await api.deletePlugin(id);
                        await api.loadAll();
                    }
                }
            } else if (action === 'edit') {

                if (window.openCrudModal) window.openCrudModal(type, item);
            }
        });
    }

    // Tab Left Sidebar Bindings
    if (leftTabExplorer) leftTabExplorer.onclick = () => setState({ activeLeftTab: 'explorer' });
    if (leftTabTickets) leftTabTickets.onclick = () => setState({ activeLeftTab: 'tickets' });

    // Split Marketplace Buttons Bindings
    const openMarket = async (tab) => {
        setState({ isMarketplaceOpen: true, activeMarketplaceTab: tab });
        if (state.marketplaceAgents.length === 0 && !state.isMarketplaceLoading) {
            await api.loadMarketplace();
        }
    };

    document.getElementById('nav-market-agents')?.addEventListener('click', () => openMarket('agents'));
    document.getElementById('nav-market-skills')?.addEventListener('click', () => openMarket('skills'));
    document.getElementById('nav-market-addons')?.addEventListener('click', () => openMarket('addons'));

    // Inizializzazione della Search Globale reale
    if (typeof initSearch === 'function') {
        initSearch();
    }
    // Inizializzazione dei Test
    if (typeof initTests === 'function') {
        initTests();
    }
    // Inizializzazione del Debug
    if (typeof initDebug === 'function') {
        initDebug();
    }

    // Toggle Sidebars Bindings
    if (btnLeftToggle) btnLeftToggle.onclick = () => setState({ isLeftSidebarOpen: !state.isLeftSidebarOpen });
    if (btnRightToggle) btnRightToggle.onclick = () => setState({ isRightSidebarOpen: !state.isRightSidebarOpen });
    if (btnTerminalToggle) btnTerminalToggle.onclick = () => setState({ isTerminalMinimized: !state.isTerminalMinimized });

    // Registriamo il componente UI core per ascoltare `state.js`
    subscribe((newState) => {
        updateSidebarTabs();
        updateLeftSidebarTabs();
        updateActivityBar(newState.activeActivity);
        updatePanes(newState.activeActivity);
        renderSidebar();
        
        // Pannelli laterali
        if (leftSidebar) {
            leftSidebar.className = newState.isLeftSidebarOpen 
                ? "w-64 bg-[#0d1117] border-r border-gray-800 flex flex-col shrink-0 transition-all z-10 shadow-lg overflow-hidden relative"
                : "w-0 border-r-0 flex flex-col shrink-0 transition-all overflow-hidden opacity-0 shadow-none";
        }
        if (rightSidebar) {
            rightSidebar.className = newState.isRightSidebarOpen 
                ? "w-72 bg-[#0d1117] border-l border-gray-800 flex flex-col shrink-0 transition-all z-10 shadow-lg overflow-hidden relative"
                : "w-0 border-l-0 flex flex-col shrink-0 transition-all overflow-hidden opacity-0 shadow-none";
        }
        if (bottomPanel) {
            if (newState.isTerminalMinimized) {
                bottomPanel.style.height = '36px';
                bottomPanel.style.minHeight = '36px';
            } else {
                // Se non è stato cambiato manualmente via drag (che mette stile inline), mettiamo default
                if (!bottomPanel.style.height || bottomPanel.style.height === '36px') {
                    bottomPanel.style.height = '300px';
                    bottomPanel.style.minHeight = '150px';
                }
            }
        }
    });

    // Project opening logic is now fully managed by the dynamic menu in workspace.js
    // to prevent event listener conflicts and ensure state consistency.

    // Inizializza i dati dal backend!
    await api.loadAll();
    
    // Sincronizza i server MCP locali con il backend
    if (state.mcpServers && state.mcpServers.length > 0) {
        api.syncMCPServers(state.mcpServers);
    }

    // Ripristina l'ultimo progetto/workspace salvato
    if (window.restoreSession) {
        await window.restoreSession();
    }
};

document.addEventListener('DOMContentLoaded', bootstrap);
