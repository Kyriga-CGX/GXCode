// APP/components/marketplace.js
import { state, subscribe, setState } from '../core/state.js';
import { api } from '../core/api.js';

const modalsRoot = document.getElementById('modals-root');
window.__marketCache = new Map();

const renderMarketplaceContent = (items, type) => {
    if (!items || items.length === 0) return `<div class="text-[11px] text-gray-500 italic p-6 text-center border border-dashed border-gray-800 rounded-xl bg-black/20">Nessun modulo trovato. Prova un'altra ricerca.</div>`;

    return items.map(item => {
        const key = item.slug || String(item.id);
        window.__marketCache.set(key, item);

        const isNew = item.discoveredAt && (Date.now() - item.discoveredAt < 120000);

        const sourceColor = item.source === 'Open VSX' ? 'text-blue-400 border-blue-500/30 bg-blue-500/10' :
                           item.source === 'skills.sh' ? 'text-purple-400 border-purple-500/30 bg-purple-500/10' :
                           ['Apify', 'DeepNLP', 'Agensi', 'Superface'].includes(item.source) ? 'text-amber-400 border-amber-500/30 bg-amber-500/10' :
                           'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';

        return `
        <div class="p-4 border border-gray-800 rounded-xl bg-[#161b22] flex flex-col hover:border-blue-500/30 hover:bg-[#1d232b] transition-all group shadow-sm relative overflow-hidden">
            ${isNew ? `<div class="absolute top-0 right-0 bg-blue-600 text-white text-[8px] font-black px-2 py-0.5 rounded-bl-lg animate-pulse uppercase tracking-tighter z-10">NEW SYNC</div>` : ''}
            <div class="flex justify-between items-start mb-2">
                <div class="flex flex-col gap-1 overflow-hidden">
                    <span class="text-[8px] px-1.5 py-0.5 rounded border ${sourceColor} uppercase font-bold tracking-[0.1em] self-start">${item.source || 'GX Hub'}</span>
                    <h3 class="font-bold text-gray-100 text-[13px] group-hover:text-blue-400 transition-colors truncate pr-2">${item.name}</h3>
                </div>
                <span class="text-[9px] px-1.5 py-0.5 rounded bg-black/40 text-gray-500 uppercase tracking-tighter border border-gray-800 shrink-0">${item.category || item.role || 'Addon'}</span>
            </div>
            <p class="text-[11px] text-gray-500 mt-1 mb-4 line-clamp-3 leading-relaxed h-[48px]">${item.description || 'Modulo estensione per GXCode.'}</p>
            <div class="mt-auto flex justify-between items-center pt-3 border-t border-gray-800/50">
                <div class="flex flex-col">
                    <span class="text-[9px] text-gray-600 font-mono uppercase tracking-widest">${item.author || 'Registry'}</span>
                    <span class="text-[8px] text-gray-700 font-mono italic">${item.version || 'v' + (item.discoveredAt ? '2.4.live' : '1.0.0')}</span>
                </div>
                <button onclick="window.installMarketItem('${type}', '${key}', event)" 
                        class="text-[10px] px-3 py-1.5 font-bold uppercase tracking-wider rounded-md bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-lg shadow-blue-900/20 active:scale-95 ${item.isInstalled ? 'opacity-30 cursor-not-allowed bg-emerald-600' : ''}"
                        ${item.isInstalled ? 'disabled' : ''}>
                    ${item.isInstalled ? 'Installato ✓' : 'Installa'}
                </button>
            </div>
        </div>
        `;
    }).join('');
};

const renderMarketplace = () => {
    if (!state.isMarketplaceOpen) {
        modalsRoot.innerHTML = '';
        return;
    }

    const activeTab = state.activeMarketplaceTab || 'agents';
    const isLoading = state.isMarketplaceLoading;

    // Filtro client-side per rendere i risultati più precisi rispetto alla query Open VSX
    const currentSearch = document.getElementById('market-addon-search')?.value || '';
    let filteredPlugins = state.marketplacePlugins || [];
    if (currentSearch.length > 1) {
        const q = currentSearch.toLowerCase();
        filteredPlugins = filteredPlugins.filter(p => 
            p.name.toLowerCase().includes(q) || 
            (p.description && p.description.toLowerCase().includes(q)) ||
            (p.slug && p.slug.toLowerCase().includes(q))
        );
    }

    const mAgents = renderMarketplaceContent(state.marketplaceAgents, 'agent');
    const mSkills = renderMarketplaceContent(state.marketplaceSkills, 'skill');
    const mAddons = isLoading 
        ? `<div class="col-span-full flex flex-col items-center justify-center p-20 gap-4">
             <div class="w-10 h-10 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
             <p class="text-xs text-gray-500 font-mono tracking-widest uppercase animate-pulse">Searching Open VSX...</p>
           </div>`
        : renderMarketplaceContent(filteredPlugins, 'addon');

    const getTabClass = (t) => t === activeTab
        ? "px-5 py-2 text-xs font-bold text-blue-400 border-b-2 border-blue-500 bg-blue-500/5"
        : "px-5 py-2 text-xs font-medium text-gray-500 hover:text-gray-300 transition-colors hover:bg-white/5";

    modalsRoot.innerHTML = `
        <div class="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 p-4 pointer-events-auto animate-fade-in">
            <div class="bg-[#0d1117] w-full max-w-6xl h-[85vh] rounded-24px border border-gray-800 shadow-[0_30px_90px_rgba(0,0,0,0.9)] flex flex-col overflow-hidden">
                
                <!-- Modal Header -->
                <div class="h-20 border-b border-gray-800 flex items-center justify-between px-8 bg-[#161b22] shrink-0">
                    <div class="flex items-center gap-5">
                        <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-2xl shadow-xl border border-white/10">📦</div>
                        <div>
                            <h2 class="text-sm font-black text-white uppercase tracking-[0.2em]">GX Marketplace</h2>
                            <p class="text-[10px] text-gray-500 font-mono uppercase tracking-widest mt-0.5 opacity-70">Unified Hub • v2.5.0</p>
                        </div>
                    </div>
                    
                    <div class="flex bg-[#0d1117] p-1 rounded-xl border border-gray-800/80 shadow-inner">
                        <button onclick="window.setState({ activeMarketplaceTab: 'agents', activeMarketplaceCategory: 'all' })" class="${getTabClass('agents')} rounded-l-lg">🤖 Agenti</button>
                        <button onclick="window.setState({ activeMarketplaceTab: 'skills', activeMarketplaceCategory: 'all' })" class="${getTabClass('skills')}">📖 Skills</button>
                        <button onclick="window.setState({ activeMarketplaceTab: 'addons', activeMarketplaceCategory: 'all' })" class="${getTabClass('addons')} rounded-r-lg">🧩 Addons</button>
                    </div>

                    <button onclick="window.openSourceSettings()" class="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600/10 text-blue-400 border border-blue-500/20 hover:bg-blue-600/20 transition-all font-bold text-[10px] uppercase tracking-widest active:scale-95">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                        Manage Sources
                    </button>

                    <button onclick="window.closeMarketplace()" class="w-10 h-10 rounded-xl bg-gray-800/30 text-gray-500 hover:text-white hover:bg-red-500/40 flex items-center justify-center transition border border-gray-700/50 active:scale-90">✕</button>
                </div>

                <!-- Sub-Header: Search & Categories -->
                <div class="px-8 py-4 bg-[#0d1117] border-b border-gray-800 flex items-center justify-between gap-6 shrink-0">
                    <div class="flex items-center gap-4 overflow-x-auto no-scrollbar py-1">
                        <div class="flex items-center gap-2 pr-4 border-r border-gray-800">
                             ${state.isMarketplaceLoading 
                                ? `<span class="flex items-center gap-1.5 text-[9px] font-bold text-blue-400 animate-pulse uppercase tracking-widest"><div class="w-1.5 h-1.5 rounded-full bg-blue-500"></div> Syncing...</span>`
                                : `<button onclick="api.loadMarketplace()" class="p-1.5 rounded-lg bg-gray-800/30 text-gray-500 hover:text-white hover:bg-gray-800 transition-all active:scale-90 shadow-sm" title="Refresh Catalog">
                                     <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                                   </button>`
                             }
                        </div>
                        <div class="flex items-center gap-2">
                            ${['all', 'coding', 'automation', 'security', 'architecture', 'integration', 'devops', 'tools'].map(cat => `
                                <button onclick="window.setState({ activeMarketplaceCategory: '${cat}' })" 
                                        class="px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap
                                        ${state.activeMarketplaceCategory === cat 
                                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' 
                                            : 'bg-gray-800/50 text-gray-500 hover:text-gray-300 hover:bg-gray-800'}">
                                    ${cat}
                                </button>
                            `).join('')}
                        </div>
                    </div>
                    
                    <div class="flex items-center bg-[#161b22] border border-gray-800 rounded-xl px-4 py-2 focus-within:border-blue-500/50 transition-all w-80 shadow-inner group">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" class="text-gray-600 group-focus-within:text-blue-500 transition-colors mr-3" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        <input id="market-global-search" type="text" placeholder="Cerca in ${activeTab}..." class="bg-transparent border-none outline-none text-xs text-gray-300 w-full font-medium" value="${currentSearch}">
                    </div>
                </div>
                
                <!-- Content View -->
                <div class="flex-1 overflow-y-auto p-10 custom-scrollbar bg-[#090c10] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/5 via-transparent to-transparent">
                    ${activeTab === 'agents' ? `
                        <div class="animate-slide-up">
                            <div class="mb-8">
                                <h3 class="text-2xl font-light text-gray-200 tracking-tight">Advanced AI Personas</h3>
                                <p class="text-gray-500 text-sm mt-1">Scegli tra i migliori agenti certificati da Agensi, DeepNLP e OpenSkills.</p>
                            </div>
                            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                ${mAgents}
                            </div>
                        </div>
                    ` : ''}

                    ${activeTab === 'skills' ? `
                        <div class="animate-slide-up">
                            <div class="mb-8">
                                <h3 class="text-2xl font-light text-gray-200 tracking-tight">System Capabilities</h3>
                                <p class="text-gray-500 text-sm mt-1">Libreria unificata di tool e skill in formato SKILL.md per i tuoi agenti.</p>
                            </div>
                            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                ${mSkills}
                            </div>
                        </div>
                    ` : ''}

                    ${activeTab === 'addons' ? `
                        <div class="animate-slide-up">
                            <div class="flex flex-col gap-6">
                                <div class="mb-2">
                                    <h3 class="text-2xl font-light text-gray-200 tracking-tight">IDE Personalization</h3>
                                    <p class="text-gray-500 text-sm mt-1">Esplora e installa migliaia di estensioni tramite Open VSX.</p>
                                </div>
                                <div class="mb-4 p-4 bg-blue-500/5 border border-blue-500/20 rounded-xl flex flex-col gap-1">
                                    <span class="text-[10px] font-bold text-blue-400 uppercase tracking-widest font-mono">Open VSX Store Integration</span>
                                    <p class="text-[11px] text-gray-500 italic">Nota: GXCode estrae metadati e asset direttamente dal registro Open VSX per un'esperienza nativa.</p>
                                </div>
                                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    ${mAddons}
                                </div>
                            </div>
                        </div>
                    ` : ''}
                </div>

                <div class="h-14 border-t border-gray-800 bg-[#0d1117] px-10 flex justify-between items-center shrink-0">
                    <div class="flex items-center gap-3">
                        <div class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                        <span class="text-[9px] text-gray-600 font-mono uppercase tracking-[0.3em]">SECURE LOCAL SYNC ACTIVE</span>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Ripristiniamo il focus e il binding con debounce
    const input = document.getElementById('market-global-search');
    if (input) {
        input.focus();
        input.setSelectionRange(currentSearch.length, currentSearch.length);
        
        input.oninput = (e) => {
            const q = e.target.value;
            if (window.__searchTimeout) clearTimeout(window.__searchTimeout);
            
            input.parentElement.classList.add('border-blue-500');
            
            window.__searchTimeout = setTimeout(async () => {
                await api.loadMarketplace(q);
                input.parentElement.classList.remove('border-blue-500');
            }, 400);
        };
    }
};

window.closeMarketplace = () => setState({ isMarketplaceOpen: false });

window.installMarketItem = async (type, id, event) => {
    const btn = event.target;
    const originalHtml = btn.innerHTML;
    btn.innerHTML = '<span class="animate-spin inline-block">⏳</span>';
    btn.disabled = true;

    try {
        if (type === 'agents' || type === 'agent') await api.installAgent(id);
        else if (type === 'skills' || type === 'skill') await api.installSkill(id);
        else if (type === 'addons' || type === 'addon') {
            const item = window.__marketCache.get(id);
            if (!item) throw new Error("Item non trovato in cache");
            await api.installPlugin(item);
        }

        btn.innerHTML = '✅ OK';
        setTimeout(() => {
            btn.innerHTML = 'INSTALLATO';
            btn.className = "px-3 py-1 bg-gray-800 text-gray-500 rounded text-xs cursor-default";
        }, 1000);
    } catch (err) {
        console.error(err);
        btn.innerHTML = '❌ ERRORE';
        btn.disabled = false;
        setTimeout(() => btn.innerHTML = originalHtml, 2000);
    }
};

window.setState = setState;
window.api = api;

let lastTab = null;
let lastCat = null;

export const initMarketplace = () => {
    subscribe((newState) => {
        // Trigger load if tab OR category changed, or if marketplace just opened
        if (newState.isMarketplaceOpen && 
           (newState.activeMarketplaceTab !== lastTab || newState.activeMarketplaceCategory !== lastCat)) {
            
            lastTab = newState.activeMarketplaceTab;
            lastCat = newState.activeMarketplaceCategory;
            api.loadMarketplace();
        }
        
        renderMarketplace();
    });
};
