/**
 * Agent Selector - Menu dropdown unificato per la selezione degli agenti
 * Posizionato sopra la barra delle AI Companion
 */

import { state, setState, subscribe } from '../core/state.js';

let selectorElement = null;
let isOpen = false;

/**
 * Inizializza il selettore degli agenti
 */
export const initAgentSelector = () => {
    // Crea il contenitore del selettore
    selectorElement = document.createElement('div');
    selectorElement.id = 'agent-selector-container';
    selectorElement.className = 'relative';
    
    selectorElement.innerHTML = `
        <button id="agent-selector-btn" class="p-1.5 text-gray-500 hover:text-white transition-all rounded-lg hover:bg-white/5 flex items-center gap-1.5" title="Seleziona Agente">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 2a10 10 0 1 0 10 10H12V2z"/>
                <path d="M12 2a10 10 0 0 1 10 10"/>
                <circle cx="12" cy="12" r="3"/>
            </svg>
            <span class="text-[10px] font-bold uppercase tracking-wider hidden lg:block">Agenti</span>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" class="transition-transform duration-200" id="agent-selector-chevron">
                <path d="m6 9 6 6 6-6"/>
            </svg>
        </button>
        
        <div id="agent-selector-dropdown" class="hidden absolute bottom-full right-0 mb-2 w-64 bg-[var(--bg-side)] border border-[var(--border-dim)] rounded-xl shadow-2xl overflow-hidden z-[1000]">
            <div class="p-2 border-b border-[var(--border-dim)]">
                <div class="flex items-center justify-between px-2">
                    <span class="text-[9px] font-black text-gray-500 uppercase tracking-[0.2em]">Seleziona Agente</span>
                    <button id="agent-selector-close" class="text-gray-500 hover:text-white transition">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M18 6 6 18M6 6l12 12"/>
                        </svg>
                    </button>
                </div>
            </div>
            <div id="agent-selector-list" class="max-h-64 overflow-y-auto custom-scrollbar p-1">
                <!-- Agents will be rendered here -->
            </div>
        </div>
    `;
    
    // Inserisce il selettore prima del container degli AI companions
    const aiContainer = document.getElementById('ai-companions-container');
    if (aiContainer && aiContainer.parentNode) {
        aiContainer.parentNode.insertBefore(selectorElement, aiContainer);
    }
    
    // Event listeners
    const btn = selectorElement.querySelector('#agent-selector-btn');
    const dropdown = selectorElement.querySelector('#agent-selector-dropdown');
    const closeBtn = selectorElement.querySelector('#agent-selector-close');
    
    btn?.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleDropdown();
    });
    
    closeBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        closeDropdown();
    });
    
    // Chiude il dropdown quando si clicca fuori
    document.addEventListener('click', (e) => {
        if (isOpen && !selectorElement.contains(e.target)) {
            closeDropdown();
        }
    });
    
    // Renderizza la lista iniziale
    renderAgentList();
    
    // Aggiorna quando cambiano gli agenti
    subscribe(() => {
        renderAgentList();
    });
    
    console.log('[AGENT-SELECTOR] Initialized');
};

/**
 * Apre/chiude il dropdown
 */
const toggleDropdown = () => {
    if (isOpen) {
        closeDropdown();
    } else {
        openDropdown();
    }
};

/**
 * Apre il dropdown
 */
const openDropdown = () => {
    const dropdown = selectorElement.querySelector('#agent-selector-dropdown');
    const chevron = selectorElement.querySelector('#agent-selector-chevron');
    
    if (dropdown) {
        dropdown.classList.remove('hidden');
        isOpen = true;
        if (chevron) chevron.style.transform = 'rotate(180deg)';
        renderAgentList();
    }
};

/**
 * Chiude il dropdown
 */
const closeDropdown = () => {
    const dropdown = selectorElement.querySelector('#agent-selector-dropdown');
    const chevron = selectorElement.querySelector('#agent-selector-chevron');
    
    if (dropdown) {
        dropdown.classList.add('hidden');
        isOpen = false;
        if (chevron) chevron.style.transform = 'rotate(0deg)';
    }
};

/**
 * Renderizza la lista degli agenti
 */
const renderAgentList = () => {
    const listContainer = selectorElement?.querySelector('#agent-selector-list');
    if (!listContainer) return;
    
    const agents = state.agents || [];
    
    if (agents.length === 0) {
        listContainer.innerHTML = `
            <div class="p-6 text-center">
                <div class="text-2xl mb-2">🤖</div>
                <p class="text-[10px] text-gray-500 uppercase tracking-wider">Nessun agente disponibile</p>
                <p class="text-[9px] text-gray-600 mt-1">Crea un agente dal pannello laterale</p>
            </div>
        `;
        return;
    }
    
    listContainer.innerHTML = agents.map(agent => {
        const key = agent.slug || agent.id;
        const initial = (agent.name || 'A').charAt(0).toUpperCase();
        const color = getColorForAgent(agent);
        
        return `
            <div class="agent-selector-item p-2 rounded-lg cursor-pointer hover:bg-white/5 transition-all flex items-center gap-3 group" 
                 data-agent-id="${key}"
                 onclick="window.selectAgent('${key}')">
                <div class="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black text-white shrink-0" 
                     style="background: ${color}20; color: ${color}; border: 1px solid ${color}40;">
                    ${initial}
                </div>
                <div class="flex-1 min-w-0">
                    <div class="text-[10px] font-bold text-gray-200 truncate group-hover:text-white transition-colors">
                        ${agent.name}
                    </div>
                    <div class="text-[8px] text-gray-500 uppercase tracking-wider truncate">
                        ${agent.role || 'Agent'}
                    </div>
                </div>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" 
                     class="text-gray-600 group-hover:text-white transition-colors shrink-0 opacity-0 group-hover:opacity-100">
                    <path d="m9 6 6 6-6 6"/>
                </svg>
            </div>
        `;
    }).join('');
};

/**
 * Ottiene un colore per l'agente basato sul nome
 */
const getColorForAgent = (agent) => {
    const colors = [
        '#3b82f6', // blue
        '#8b5cf6', // violet
        '#ec4899', // pink
        '#10b981', // emerald
        '#f59e0b', // amber
        '#ef4444', // red
        '#06b6d4', // cyan
        '#84cc16'  // lime
    ];
    
    const index = agent.name.charCodeAt(0) % colors.length;
    return colors[index];
};

/**
 * Seleziona un agente (globale per onclick)
 */
window.selectAgent = (agentId) => {
    console.log(`[AGENT-SELECTOR] Selected agent: ${agentId}`);
    
    // Qui puoi aggiungere la logica per selezionare l'agente
    // Ad esempio: setState({ activeAgentId: agentId });
    
    // Chiude il dropdown dopo la selezione
    closeDropdown();
};

// Esporta le funzioni
export const agentSelector = {
    init: initAgentSelector,
    open: openDropdown,
    close: closeDropdown,
    toggle: toggleDropdown
};
