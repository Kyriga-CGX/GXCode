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

const MCP_TEMPLATES = [
    { id: 'google-search', name: 'Google Search', icon: '🔍', url: 'http://localhost:3000', desc: 'Permette all\'IA di cercare sul web.' },
    { id: 'github', name: 'GitHub Integration', icon: '🐙', url: 'http://localhost:3001', desc: 'Gestione repository e issue.' },
    { id: 'slack', name: 'Slack MCP', icon: '💬', url: 'http://localhost:3002', desc: 'Comunicazione automatizzata.' },
    { id: 'python', name: 'Python Interpreter', icon: '🐍', url: 'http://localhost:3003', desc: 'Esecuzione codice Python sicuro.' }
];

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
                <div class="space-y-8 animate-fade-in">
                    <!-- Predefined Templates -->
                    <div class="space-y-4">
                        <h4 class="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Server Predefiniti</h4>
                        <div class="grid grid-cols-2 gap-4">
                            ${MCP_TEMPLATES.map(t => `
                                <div onclick="window.useMCPTemplate('${t.id}')" class="p-4 bg-[#161b22] border border-gray-800 rounded-xl hover:border-blue-500/50 cursor-pointer transition group relative overflow-hidden">
                                    <div class="absolute top-0 right-0 w-16 h-16 bg-blue-500/5 rounded-bl-full group-hover:bg-blue-500/10 transition"></div>
                                    <div class="flex items-start gap-3 relative z-10">
                                        <span class="text-2xl">${t.icon}</span>
                                        <div>
                                            <div class="text-xs font-bold text-gray-200">${t.name}</div>
                                            <div class="text-[9px] text-gray-500 mt-0.5 line-clamp-1">${t.desc}</div>
                                        </div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>

                    <!-- Add New Professional Form -->
                    <div class="p-6 bg-[#161b22] border border-gray-800 rounded-2xl shadow-inner">
                        <h4 class="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Configura Nuovo Server</h4>
                        <div class="grid grid-cols-2 gap-4">
                            <div class="flex flex-col gap-2">
                                <label class="text-[9px] font-bold text-gray-600 uppercase">Nome Identificativo</label>
                                <input id="mcp-new-name" type="text" placeholder="Es. My Google Search" class="p-2.5 bg-black/40 border border-gray-700 rounded-lg text-xs text-gray-200 focus:border-blue-500 outline-none transition">
                            </div>
                            <div class="flex flex-col gap-2">
                                <label class="text-[9px] font-bold text-gray-600 uppercase">Endpoint URL</label>
                                <input id="mcp-new-url" type="text" placeholder="http://localhost:XXXX" class="p-2.5 bg-black/40 border border-gray-700 rounded-lg text-xs text-gray-200 focus:border-blue-500 outline-none transition">
                            </div>
                        </div>
                        <button onclick="window.submitMCPForm()" class="mt-4 w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold rounded-lg transition shadow-lg shadow-blue-900/20">Registra Server MCP</button>
                    </div>

                    <!-- Active List -->
                    <div class="space-y-4">
                        <div class="flex items-center justify-between">
                            <h4 class="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Server MCP Attivi (${state.mcpServers.length})</h4>
                        </div>
                        <div class="space-y-3">
                            ${state.mcpServers.length === 0 ? '<div class="p-10 text-center text-gray-600 italic text-[11px] bg-black/10 border border-dashed border-gray-800 rounded-xl">Configura il tuo primo server MCP per estendere le potenzialità dell\'IA.</div>' : ''}
                            ${state.mcpServers.map(srv => `
                                <div class="px-5 py-4 bg-[#161b22] border border-gray-800 rounded-xl flex items-center justify-between group hover:border-gray-700 transition">
                                    <div class="flex items-center gap-4">
                                        <div class="w-2 h-2 rounded-full ${srv.enabled ? 'bg-emerald-500 animate-pulse' : 'bg-gray-600'}"></div>
                                        <div class="flex flex-col gap-0.5">
                                            <span class="text-[12px] font-bold text-gray-200">${srv.name}</span>
                                            <span class="text-[9px] text-gray-500 font-mono tracking-tight">${srv.url}</span>
                                        </div>
                                    </div>
                                    <div class="flex items-center gap-4">
                                        <button onclick="window.toggleMCPServer('${srv.id}')" class="px-2 py-1 ${srv.enabled ? 'text-blue-400 bg-blue-400/10' : 'text-gray-500 bg-gray-500/10'} rounded text-[9px] font-bold uppercase transition hover:scale-105">${srv.enabled ? 'Attivo' : 'Disattivo'}</button>
                                        <button onclick="window.removeMCPServer('${srv.id}')" class="text-gray-600 hover:text-red-400 transition opacity-0 group-hover:opacity-100 p-1">
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                        </button>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
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
                        <div class="flex flex-col items-end gap-2">
                            <button id="btn-do-update" onclick="window.startAppUpdate()" class="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition shadow-lg shadow-blue-900/40">Aggiorna Ora</button>
                            <div id="update-progress-container" class="hidden w-40 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                                <div id="update-progress-bar" class="h-full bg-blue-500 transition-all duration-300" style="width: 0%"></div>
                            </div>
                            <span id="update-progress-text" class="hidden text-[9px] text-gray-500 font-mono uppercase">Downloading: 0%</span>
                        </div>
                    </div>

                    <div class="space-y-4">
                        <h5 class="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Informazioni Sistema</h5>
                        <div class="grid grid-cols-2 gap-4">
                            <div class="p-4 bg-black/20 border border-gray-800 rounded-lg">
                                <div class="text-[9px] text-gray-600 uppercase font-bold">Versione Corrente</div>
                                <div class="text-xs text-gray-300 font-mono mt-1">${state.appVersion}</div>
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

window.submitMCPForm = () => {
    const nameEl = document.getElementById('mcp-new-name');
    const urlEl = document.getElementById('mcp-new-url');
    if (!nameEl || !urlEl) return;

    const name = nameEl.value.trim();
    const url = urlEl.value.trim();

    if (name && url) {
        const newServer = { id: Date.now().toString(), name, url, enabled: true };
        const mcpServers = [...state.mcpServers, newServer];
        localStorage.setItem('gx-mcp-servers', JSON.stringify(mcpServers));
        setState({ mcpServers });
        
        nameEl.value = '';
        urlEl.value = '';
        window.gxToast("Server MCP registrato con successo! 🚀", 'info');
    } else {
        window.gxToast("Per favore, compila tutti i campi.", 'error');
    }
};

window.useMCPTemplate = (templateId) => {
    const template = MCP_TEMPLATES.find(t => t.id === templateId);
    if (template) {
        const nameEl = document.getElementById('mcp-new-name');
        const urlEl = document.getElementById('mcp-new-url');
        if (nameEl) nameEl.value = template.name;
        if (urlEl) urlEl.value = template.url;
        window.gxToast(`Modello ${template.name} caricato. Completa la configurazione! ✨`, 'info');
    }
};

window.addNewMCPServer = () => {
    // Legacy support, now managed by form
    const mcpTab = document.querySelector('[onclick*="switchSettingsTab(\'mcp\')"]');
    if (mcpTab) mcpTab.click();
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

    // Se il tasto è in stato "Riavvia ora", esegui il restart
    if (btn && btn.dataset.state === 'restart') {
        window.electronAPI.quitAndInstall();
        return;
    }

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="animate-pulse">Verifica...</span>';
    }

    try {
        const hasUpdate = await window.electronAPI.performUpdate();
        if (!hasUpdate) {
            window.gxToast("Sei già all'ultima versione di GXCode!", 'info');
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = 'GXCode è aggiornato';
                setTimeout(() => { if (btn) btn.innerHTML = 'Aggiorna Ora'; }, 3000);
            }
            return;
        }

        // Se l'update inizia, mostriamo la progress bar
        const container = document.getElementById('update-progress-container');
        const text = document.getElementById('update-progress-text');
        if (container) container.classList.remove('hidden');
        if (text) text.classList.remove('hidden');
        if (btn) btn.innerHTML = '<span class="animate-pulse">Download...</span>';

    } catch (err) {
        window.gxToast(err.message || "Errore durante l'aggiornamento", 'error');
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = 'Riprova';
        }
    }
};

export const initSettings = async () => {
    // Fetch real version from Electron
    if (window.electronAPI && window.electronAPI.getVersion) {
        try {
            const version = await window.electronAPI.getVersion();
            setState({ appVersion: version });
        } catch (err) {
            console.error("Errore fetch versione:", err);
            setState({ appVersion: "1.1.5-dev" }); // Fallback
        }
    }

    applyGlobalSkinEffects();
    const btnNav = document.getElementById('nav-settings');
    if (btnNav) btnNav.addEventListener('click', () => {
        setState({ isSettingsOpen: true, isMarketplaceOpen: false });
    });

    // Gestione download in tempo reale
    window.electronAPI.onDownloadProgress((percent) => {
        const bar = document.getElementById('update-progress-bar');
        const text = document.getElementById('update-progress-text');
        if (bar) bar.style.width = `${percent}%`;
        if (text) text.innerText = `Downloading: ${Math.round(percent)}%`;
    });

    window.electronAPI.onUpdateReady(() => {
        const btn = document.getElementById('btn-do-update');
        const container = document.getElementById('update-progress-container');
        const text = document.getElementById('update-progress-text');

        if (btn) {
            btn.disabled = false;
            btn.innerHTML = 'Riavvia ora 🛠️';
            btn.classList.replace('bg-blue-600', 'bg-emerald-600');
            btn.classList.replace('hover:bg-blue-500', 'hover:bg-emerald-500');
            btn.dataset.state = 'restart';
        }
        if (container) container.classList.add('hidden');
        if (text) text.classList.add('hidden');
    });

    subscribe(renderSettingsModal);
};
