// APP/components/settings.js
import { state, subscribe, setState } from '../core/state.js';

const SKINS = [
    { id: 'dark', label: 'Dark Mode (Default)' },
    { id: 'light', label: 'Light Mode' },
    { id: 'classic', label: 'Classic Layout' },
    { id: 'apple', label: 'Apple Style' },
    { id: 'aero', label: 'Aero Glass' },
    { id: 'liquid-glass', label: 'Liquid Glass' },
    { id: 'custom-gradient', label: 'Sfumato a Scelta' },
    { id: 'anime', label: 'Anime Style' }
];

const SETTINGS_TABS = [
    { id: 'preferences', label: 'Preferenze', icon: '⚙️' },
    { id: 'keybinds', label: 'Keybinds', icon: '⌨️' },
    { id: 'mcp', label: 'Server MCP', icon: '🔗' },
    { id: 'youtrack', label: 'Server MCP Youtrack', icon: '🎯' },
    { id: 'marketplace', label: 'Marketplace & Repo', icon: '📦' },
    { id: 'appearance', label: 'Aspetto', icon: '🎨' },
    { id: 'language', label: 'Lingua', icon: '🌐' },
    { id: 'updates', label: 'Aggiornamenti', icon: '🚀' }
];

const getSavedSkin = () => localStorage.getItem('cgx-skin') || 'dark';

const applyGlobalSkinEffects = () => {
    document.documentElement.dataset.cgxTheme = getSavedSkin();
    const custom = localStorage.getItem('cgx-grad-color');
    if (custom) document.documentElement.style.setProperty('--cgx-grad-custom', custom);
};

const renderTabContent = () => {
    switch (state.activeSettingsTab) {
        case 'preferences':
            return `
                <div class="flex flex-col items-center justify-center h-full text-center opacity-50 gap-4">
                    <div class="text-5xl">🕒</div>
                    <h4 class="text-xl font-bold text-gray-200">Coming Soon</h4>
                    <p class="text-xs text-gray-500 max-w-xs">Stiamo definendo le migliori preferenze globali per il tuo workflow. Resta sintonizzato!</p>
                </div>
            `;
        case 'keybinds':
            return `
                <div class="space-y-6">
                    <p class="text-xs text-gray-500 mb-6">Gestisci le scorciatoie da tastiera per un'azione rapida.</p>
                    <div class="space-y-2">
                        ${[
                            { action: 'Cerca in tutto il progetto', key: 'CTRL + SHIFT + F' },
                            { action: 'Formattazione (Prettier)', key: 'ALT + F' },
                            { action: 'Apri Marketplace', key: 'CTRL + M' },
                            { action: 'Switch Explorer/Tickets', key: 'CTRL + E' }
                        ].map(kb => `
                            <div class="flex items-center justify-between p-3 bg-[#161b22] border border-gray-800 rounded group hover:border-blue-500/30 transition">
                                <span class="text-xs text-gray-300 font-bold">${kb.action}</span>
                                <span class="px-2 py-1 bg-black text-blue-400 border border-gray-700 rounded text-[10px] font-mono">${kb.key}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        case 'mcp':
            return `
                <div class="space-y-6">
                    <div class="flex items-center justify-between">
                        <h4 class="text-xs font-bold text-gray-400 uppercase tracking-widest">Server MCP Salvati</h4>
                        <button onclick="window.addNewMCPServer()" class="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-[10px] rounded font-bold transition">Aggiungi Nuovo</button>
                    </div>
                    <div class="space-y-3">
                        ${state.mcpServers.length === 0 ? '<div class="p-6 text-center text-gray-600 italic text-xs border border-dashed border-gray-800 rounded">Nessun server configurato.</div>' : ''}
                        ${state.mcpServers.map(srv => `
                            <div class="p-4 bg-[#161b22] border border-gray-800 rounded flex items-center justify-between">
                                <div class="flex flex-col gap-1">
                                    <span class="text-xs font-bold text-gray-200">${srv.name}</span>
                                    <span class="text-[10px] text-gray-500 font-mono">${srv.url}</span>
                                </div>
                                <div class="flex items-center gap-4">
                                    <div onclick="window.toggleMCPServer('${srv.id}')" class="w-10 h-5 p-0.5 rounded-full cursor-pointer transition-all ${srv.enabled ? 'bg-blue-600' : 'bg-gray-700'}">
                                        <div class="w-4 h-4 bg-white rounded-full transition-all ${srv.enabled ? 'translate-x-5' : 'translate-x-0'}"></div>
                                    </div>
                                    <button onclick="window.removeMCPServer('${srv.id}')" class="text-gray-600 hover:text-red-400 transition">✕</button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        case 'youtrack':
            const config = state.youtrackConfig;
            return `
                <div class="space-y-6">
                    <p class="text-xs text-gray-500">Configura l'integrazione specifica per i ticket Youtrack tramite MCP.</p>
                    <div class="space-y-4">
                        <div class="flex flex-col gap-2">
                            <label class="text-[10px] uppercase font-bold text-gray-500">URL Server</label>
                            <input id="yt-url" type="text" placeholder="https://youtrack.jetbrains.com" value="${config.url}" class="p-2.5 bg-[#161b22] border border-gray-700 rounded text-xs text-gray-200 outline-none focus:border-blue-500">
                        </div>
                        <div class="flex flex-col gap-2">
                            <label class="text-[10px] uppercase font-bold text-gray-500">Token App</label>
                            <input id="yt-token" type="password" placeholder="perm:xxxx.yyyy.zzzz" value="${config.token}" class="p-2.5 bg-[#161b22] border border-gray-700 rounded text-xs text-gray-200 outline-none focus:border-blue-500">
                        </div>
                        <div class="flex items-center gap-3 pt-2">
                            <div onclick="window.toggleYoutrack()" class="w-10 h-5 p-0.5 rounded-full cursor-pointer transition-all ${config.enabled ? 'bg-blue-600' : 'bg-gray-700'}">
                                <div class="w-4 h-4 bg-white rounded-full transition-all ${config.enabled ? 'translate-x-5' : 'translate-x-0'}"></div>
                            </div>
                            <span class="text-xs text-gray-400">Abilita Sincronizzazione Ticket</span>
                        </div>
                        <button onclick="window.saveYoutrackConfig()" class="mt-4 px-4 py-2 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded text-xs font-bold hover:bg-blue-600/30 transition">Salva Configurazione</button>
                    </div>
                </div>
            `;
        case 'marketplace':
            const ms = state.marketplaceSources || {};
            return `
                <div class="space-y-8 animate-fade-in">
                    <!-- Built-in Sources -->
                    <div>
                        <h4 class="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4">Official Sources</h4>
                        <div class="space-y-3">
                            ${[
                                { id: 'openvsx', name: 'Open VSX (Addons)', desc: 'Marketplace universale per estensioni VS Code.' },
                                { id: 'skillssh', name: 'Skills.sh', desc: 'Libreria globale per Claude/Gemini AI Skills.' },
                                { id: 'agentshub', name: 'GX Agents Hub', desc: 'Repository ufficiale per Agenti certificati.' }
                            ].map(s => `
                                <div class="flex items-center justify-between p-3 bg-[#161b22] border border-gray-800 rounded group transition hover:border-blue-500/30">
                                    <div class="flex flex-col">
                                        <span class="text-xs font-bold text-gray-200">${s.name}</span>
                                        <span class="text-[10px] text-gray-500">${s.desc}</span>
                                    </div>
                                    <div onclick="window.toggleMarketplaceSource('${s.id}')" class="w-10 h-5 p-0.5 rounded-full cursor-pointer transition-all ${ms[s.id] ? 'bg-blue-600' : 'bg-gray-700'}">
                                        <div class="w-4 h-4 bg-white rounded-full transition-all ${ms[s.id] ? 'translate-x-5' : 'translate-x-0'}"></div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>

                    <!-- Custom Repositories -->
                    <div>
                        <div class="flex items-center justify-between mb-4">
                            <h4 class="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Custom Repositories</h4>
                            ${!state.isAddingRepo ? `
                                <button onclick="window.toggleAddRepoForm(true)" class="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-[9px] uppercase font-bold rounded shadow-lg transition">Add Repository</button>
                            ` : ''}
                        </div>
                        
                        ${state.isAddingRepo ? `
                            <div class="mb-6 p-4 bg-[#1c2128] border border-blue-500/30 rounded-lg animate-slide-down space-y-4">
                                <div class="grid grid-cols-2 gap-4">
                                    <div class="flex flex-col gap-1.5">
                                        <label class="text-[9px] text-gray-400 font-bold uppercase">Repo Name</label>
                                        <input id="new-repo-name" type="text" placeholder="GitHub Registry" class="p-2 bg-black/40 border border-gray-800 rounded text-xs text-blue-100 outline-none focus:border-blue-500">
                                    </div>
                                    <div class="flex flex-col gap-1.5">
                                        <label class="text-[9px] text-gray-400 font-bold uppercase">Repo URL</label>
                                        <input id="new-repo-url" type="text" placeholder="https://..." class="p-2 bg-black/40 border border-gray-800 rounded text-xs text-blue-100 outline-none focus:border-blue-500">
                                    </div>
                                </div>
                                <div class="flex items-center justify-end gap-3">
                                    <button onclick="window.toggleAddRepoForm(false)" class="text-[10px] text-gray-500 hover:text-gray-300 font-bold uppercase">Cancel</button>
                                    <button onclick="window.submitNewRepository()" class="px-4 py-1.5 bg-blue-600 text-white text-[10px] font-bold uppercase rounded hover:bg-blue-500 shadow-lg shadow-blue-900/40">Save Repository</button>
                                </div>
                            </div>
                        ` : ''}

                        <div class="space-y-3">
                            ${state.repositories.length === 0 ? '<div class="p-6 text-center text-gray-600 italic text-xs border border-dashed border-gray-800 rounded">Nessuna repository personalizzata configurata.</div>' : ''}
                            ${state.repositories.map(repo => `
                                <div class="p-4 bg-[#161b22] border border-gray-800 rounded flex items-center justify-between group hover:border-emerald-500/30 transition">
                                    <div class="flex flex-col gap-1">
                                        <div class="flex items-center gap-2">
                                            <span class="text-xs font-bold text-gray-200">${repo.name}</span>
                                            <span class="text-[8px] px-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase font-black tracking-tighter">${repo.type || 'all'}</span>
                                        </div>
                                        <span class="text-[10px] text-gray-500 font-mono italic">${repo.url}</span>
                                    </div>
                                    <div class="flex items-center gap-4">
                                        <div onclick="window.toggleRepository('${repo.id}')" class="w-10 h-5 p-0.5 rounded-full cursor-pointer transition-all ${repo.enabled ? 'bg-emerald-600' : 'bg-gray-700'}">
                                            <div class="w-4 h-4 bg-white rounded-full transition-all ${repo.enabled ? 'translate-x-5' : 'translate-x-0'}"></div>
                                        </div>
                                        <button onclick="window.removeRepository('${repo.id}')" class="text-gray-600 hover:text-red-400 transition opacity-0 group-hover:opacity-100">✕</button>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            `;
        case 'appearance':
            const currentSkin = getSavedSkin();
            const customColor = localStorage.getItem('cgx-grad-color') || '#ff0055';
            return `
                <div class="space-y-8">
                    <div>
                        <h4 class="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Seleziona Interfaccia</h4>
                        <div class="grid grid-cols-2 gap-3">
                            ${SKINS.map(s => `
                                <div onclick="window.applySkin('${s.id}')" class="p-3 border rounded-lg cursor-pointer transition-all ${currentSkin === s.id ? 'bg-blue-600/10 border-blue-500 text-blue-400' : 'bg-[#161b22] border-gray-800 text-gray-400 hover:border-gray-600'}">
                                    <div class="text-xs font-bold mb-1">${s.label}</div>
                                    <div class="text-[9px] opacity-70">Layout ottimizzato per ${s.id}</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    <div id="settings-grad-box" class="${currentSkin === 'custom-gradient' ? 'block' : 'hidden'} space-y-4">
                        <h4 class="text-xs font-bold text-gray-400 uppercase tracking-widest">Colore Personalizzato Gradiente</h4>
                        <input type="color" id="settings-grad-color" value="${customColor}" class="w-full h-12 cursor-pointer bg-transparent rounded overflow-hidden">
                    </div>
                </div>
            `;
        case 'language':
            return `
                <div class="space-y-8">
                    <p class="text-xs text-gray-500">Scegli la lingua del sistema GXCode. Il cambio richiede il riavvio della dashboard.</p>
                    <div class="grid grid-cols-2 gap-4">
                        <div onclick="window.setLanguage('it')" class="p-4 rounded-lg flex flex-col items-center gap-3 border cursor-pointer transition-all ${state.language === 'it' ? 'bg-blue-600/10 border-blue-500 text-blue-400' : 'bg-[#161b22] border-gray-800 text-gray-500'}">
                            <span class="text-2xl">🇮🇹</span>
                            <span class="text-xs font-bold">Italiano</span>
                        </div>
                        <div onclick="window.setLanguage('en')" class="p-4 rounded-lg flex flex-col items-center gap-3 border cursor-pointer transition-all ${state.language === 'en' ? 'bg-blue-600/10 border-blue-500 text-blue-400' : 'bg-[#161b22] border-gray-800 text-gray-500'}">
                            <span class="text-2xl">🇬🇧</span>
                            <span class="text-xs font-bold">English</span>
                        </div>
                    </div>
                </div>
            `;
        case 'updates':
            return `
                <div class="space-y-8 animate-fade-in">
                    <div class="p-6 bg-[#161b22] border border-gray-800 rounded-xl flex items-center justify-between">
                        <div class="flex items-center gap-4">
                            <div class="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                            </div>
                            <div>
                                <h4 class="text-sm font-bold text-gray-200">Software Update</h4>
                                <p class="text-[11px] text-gray-500">Mantenere GXCode aggiornato garantisce le ultime feature e patch di sicurezza.</p>
                            </div>
                        </div>
                        <button id="btn-do-update" onclick="window.startAppUpdate()" class="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition shadow-lg shadow-blue-900/40">Aggiorna Ora</button>
                    </div>

                    <div class="space-y-4">
                        <h5 class="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Informazioni Sistema</h5>
                        <div class="grid grid-cols-2 gap-4">
                            <div class="p-4 bg-black/20 border border-gray-800 rounded-lg">
                                <div class="text-[9px] text-gray-600 uppercase font-bold">Versione Corrente</div>
                                <div class="text-xs text-gray-300 font-mono mt-1">1.2.0-stable</div>
                            </div>
                            <div class="p-4 bg-black/20 border border-gray-800 rounded-lg">
                                <div class="text-[9px] text-gray-600 uppercase font-bold">Canale</div>
                                <div class="text-xs text-emerald-500 font-bold mt-1">Official Git</div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        default:
            return '';
    }
};

const renderSettingsModal = () => {
    const root = document.getElementById('modals-root');
    if (!state.isSettingsOpen) {
        if (!state.isMarketplaceOpen) root.innerHTML = '';
        return;
    }

    root.innerHTML = `
        <div class="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-6 pointer-events-auto animate-fade-in">
            <div class="bg-[#0d1117] w-full max-w-4xl h-[600px] rounded-xl border border-gray-700 shadow-2xl flex overflow-hidden">
                <!-- Sidebar -->
                <div class="w-64 border-r border-gray-800 bg-[#161b22] flex flex-col">
                    <div class="h-14 flex items-center px-6 border-b border-gray-800">
                        <h2 class="text-sm font-bold text-gray-200 uppercase tracking-widest">Opzioni</h2>
                    </div>
                    <div class="flex-1 py-4">
                        ${SETTINGS_TABS.map(tab => `
                            <div onclick="window.switchSettingsTab('${tab.id}')" class="px-6 py-3 flex items-center gap-3 cursor-pointer transition-all hover:bg-black/20 ${state.activeSettingsTab === tab.id ? 'bg-blue-600/10 text-blue-400 border-r-2 border-blue-500' : 'text-gray-400'}">
                                <span class="text-base">${tab.icon}</span>
                                <span class="text-xs font-bold">${tab.label}</span>
                            </div>
                        `).join('')}
                    </div>
                    <div class="p-6 border-t border-gray-800">
                        <button onclick="window.closeSettings()" class="w-full py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded text-xs transition uppercase font-bold tracking-tighter">Chiudi</button>
                    </div>
                </div>

                <!-- Content Area -->
                <div class="flex-1 flex flex-col bg-[#0d1117]">
                    <div class="h-14 border-b border-gray-800 flex items-center px-8 bg-[#0d1117]">
                        <h3 class="font-bold text-gray-300 capitalize">${SETTINGS_TABS.find(t => t.id === state.activeSettingsTab)?.label || ''}</h3>
                    </div>
                    <div class="flex-1 overflow-y-auto p-8 custom-scrollbar">
                        ${renderTabContent()}
                    </div>
                </div>
            </div>
        </div>
    `;

    // Event Listeners for Appearance
    setTimeout(() => {
        const gradCol = document.getElementById('settings-grad-color');
        if (gradCol) gradCol.addEventListener('input', (e) => {
            localStorage.setItem('cgx-grad-color', e.target.value);
            applyGlobalSkinEffects();
        });
    }, 0);
};

// Global Actions
window.closeSettings = () => setState({ isSettingsOpen: false });

window.switchSettingsTab = (tabId) => {
    setState({ activeSettingsTab: tabId });
};

window.applySkin = (skinId) => {
    localStorage.setItem('cgx-skin', skinId);
    applyGlobalSkinEffects();
    setState({ isSettingsOpen: true }); // Re-render logic
};

window.setLanguage = (lang) => {
    localStorage.setItem('gx-language', lang);
    setState({ language: lang });
};

window.addNewMCPServer = () => {
    const name = prompt("Nome del Server:");
    const url = prompt("URL del Server (es. http://localhost:3000):");
    if (name && url) {
        const newServer = { id: Date.now().toString(), name, url, enabled: true };
        const mcpServers = [...state.mcpServers, newServer];
        localStorage.setItem('gx-mcp-servers', JSON.stringify(mcpServers));
        setState({ mcpServers });
    }
};

window.removeMCPServer = (id) => {
    const mcpServers = state.mcpServers.filter(s => s.id !== id);
    localStorage.setItem('gx-mcp-servers', JSON.stringify(mcpServers));
    setState({ mcpServers });
};

window.toggleMCPServer = (id) => {
    const mcpServers = state.mcpServers.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s);
    localStorage.setItem('gx-mcp-servers', JSON.stringify(mcpServers));
    setState({ mcpServers });
};

window.toggleYoutrack = () => {
    const youtrackConfig = { ...state.youtrackConfig, enabled: !state.youtrackConfig.enabled };
    localStorage.setItem('gx-youtrack-config', JSON.stringify(youtrackConfig));
    setState({ youtrackConfig });
};

window.saveYoutrackConfig = () => {
    const url = document.getElementById('yt-url').value;
    const token = document.getElementById('yt-token').value;
    const youtrackConfig = { ...state.youtrackConfig, url, token };
    localStorage.setItem('gx-youtrack-config', JSON.stringify(youtrackConfig));
    setState({ youtrackConfig });
    alert("Configurazione salvata con successo!");
};

window.toggleMarketplaceSource = (sourceId) => {
    const marketplaceSources = { ...state.marketplaceSources, [sourceId]: !state.marketplaceSources[sourceId] };
    setState({ marketplaceSources });
};

window.toggleAddRepoForm = (show) => {
    setState({ isAddingRepo: show });
};

window.submitNewRepository = () => {
    const nameInput = document.getElementById('new-repo-name');
    const urlInput = document.getElementById('new-repo-url');
    
    const name = nameInput.value.trim();
    const url = urlInput.value.trim();

    if (name && url) {
        const newRepo = { 
            id: 'repo-' + Date.now(), 
            name, 
            url, 
            type: 'all', 
            enabled: true 
        };
        const repositories = [...state.repositories, newRepo];
        localStorage.setItem('gx-repositories', JSON.stringify(repositories));
        setState({ repositories, isAddingRepo: false });
    } else {
        alert("Per favore, inserisci sia il nome che l'URL.");
    }
};

window.removeRepository = (id) => {
    const repositories = state.repositories.filter(r => r.id !== id);
    localStorage.setItem('gx-repositories', JSON.stringify(repositories));
    setState({ repositories });
};

window.toggleRepository = (id) => {
    const repositories = state.repositories.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r);
    localStorage.setItem('gx-repositories', JSON.stringify(repositories));
    setState({ repositories });
};

window.openSourceSettings = () => {
    setState({ isSettingsOpen: true, activeSettingsTab: 'marketplace', isMarketplaceOpen: false });
};

window.startAppUpdate = async () => {
    const btn = document.getElementById('btn-do-update');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="animate-pulse">Updating...</span>';
    }
    try {
        await window.electronAPI.performUpdate();
    } catch (err) {
        alert("Errore durante l'aggiornamento: " + err.message);
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = 'Aggiorna Ora';
        }
    }
};

export const initSettings = () => {
    applyGlobalSkinEffects();
    const btnNav = document.getElementById('nav-settings');
    if (btnNav) btnNav.addEventListener('click', () => {
        setState({ isSettingsOpen: true, isMarketplaceOpen: false });
    });
    subscribe(renderSettingsModal);
};
