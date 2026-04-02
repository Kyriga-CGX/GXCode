import { state, subscribe, setState } from '../core/state.js';
import { loadLocale } from '../core/i18n.js';
import { api } from '../core/api.js';

const getSkins = () => [
    { id: 'dark', label: window.t('settings.skins.dark') },
    { id: 'light', label: window.t('settings.skins.light') },
    { id: 'classic', label: window.t('settings.skins.classic') },
    { id: 'apple', label: window.t('settings.skins.apple') },
    { id: 'aero', label: window.t('settings.skins.aero') },
    { id: 'liquid-glass', label: window.t('settings.skins.liquid-glass') },
    { id: 'custom-gradient', label: window.t('settings.skins.custom-gradient') },
    { id: 'anime', label: window.t('settings.skins.anime') }
];

const getSettingsTabs = () => [
    {
        title: window.t('settings.groups.general'),
        tabs: [
            { id: 'preferences', label: window.t('settings.tabs.preferences'), icon: '⚙️' },
            { id: 'keybinds', label: window.t('settings.tabs.keybinds'), icon: '⌨️' },
            { id: 'updates', label: window.t('settings.tabs.updates'), icon: '🚀' }
        ]
    },
    {
        title: window.t('settings.groups.interface'),
        tabs: [
            { id: 'appearance', label: window.t('settings.tabs.appearance'), icon: '🎨' },
            { id: 'folders', label: window.t('settings.tabs.folders'), icon: '📁' },
            { id: 'language', label: window.t('settings.tabs.language'), icon: '🌐' }
        ]
    },
    {
        title: window.t('settings.groups.ai'),
        tabs: [
            { id: 'ai', label: window.t('settings.tabs.ai'), icon: '🤖' },
            { id: 'mcp', label: window.t('settings.tabs.mcp'), icon: '🧩' },
            { id: 'youtrack', label: window.t('settings.tabs.youtrack'), icon: '🎫' }
        ]
    },
    {
        title: window.t('settings.groups.extensions'),
        tabs: [
            { id: 'marketplace', label: window.t('settings.tabs.marketplace'), icon: '🛒' }
        ]
    }
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
        case 'preferences': {
            const autoSave = localStorage.getItem('gx-autosave') !== 'false';
            const fontSize = parseInt(localStorage.getItem('gx-font-size') || '14');
            const tabSize = parseInt(localStorage.getItem('gx-tab-size') || '4');
            const wordWrap = localStorage.getItem('gx-word-wrap') === 'true';
            const minimap = localStorage.getItem('gx-minimap') !== 'false';
            const autoUpdate = localStorage.getItem('gx-auto-update') !== 'false';
            const termFontSize = parseInt(localStorage.getItem('gx-terminal-font-size') || '13');

            return `
                <div class="space-y-6 animate-fade-in">
                    <h4 class="text-xs font-bold text-gray-400 uppercase tracking-widest">${window.t('settings.preferences.title')}</h4>

                    <!-- Auto-Save Toggle -->
                    <div class="flex items-center justify-between p-4 bg-[#161b22] border border-gray-800 rounded-lg group hover:border-blue-500/30 transition">
                        <div>
                            <div class="text-xs font-bold text-gray-200">${window.t('settings.preferences.autoSave')}</div>
                            <div class="text-[10px] text-gray-500 mt-0.5">${window.t('settings.preferences.autoSaveDesc')}</div>
                        </div>
                        <label class="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" id="pref-autosave" class="sr-only peer" ${autoSave ? 'checked' : ''} onchange="window.setPref('gx-autosave', this.checked)">
                            <div class="w-9 h-5 bg-gray-700 peer-checked:bg-blue-600 rounded-full peer-focus:ring-2 peer-focus:ring-blue-500/50 transition after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full"></div>
                        </label>
                    </div>

                    <!-- Font Size Slider -->
                    <div class="p-4 bg-[#161b22] border border-gray-800 rounded-lg group hover:border-blue-500/30 transition">
                        <div class="flex items-center justify-between mb-2">
                            <span class="text-xs font-bold text-gray-200">${window.t('settings.preferences.fontSize')}</span>
                            <span id="pref-fontsize-val" class="text-xs text-blue-400 font-mono">${fontSize}px</span>
                        </div>
                        <input type="range" min="10" max="24" value="${fontSize}" id="pref-fontsize" class="w-full accent-blue-500 cursor-pointer" oninput="window.setPref('gx-font-size', this.value); document.getElementById('pref-fontsize-val').textContent = this.value + 'px'">
                    </div>

                    <!-- Tab Size -->
                    <div class="flex items-center justify-between p-4 bg-[#161b22] border border-gray-800 rounded-lg group hover:border-blue-500/30 transition">
                        <span class="text-xs font-bold text-gray-200">${window.t('settings.preferences.tabSize')}</span>
                        <select id="pref-tabsize" onchange="window.setPref('gx-tab-size', this.value)" class="bg-[#0d1117] border border-gray-700 text-gray-300 text-xs rounded px-3 py-1.5 outline-none focus:border-blue-500 transition cursor-pointer">
                            <option value="2" ${tabSize === 2 ? 'selected' : ''}>2 Spaces</option>
                            <option value="4" ${tabSize === 4 ? 'selected' : ''}>4 Spaces</option>
                            <option value="8" ${tabSize === 8 ? 'selected' : ''}>8 Spaces</option>
                        </select>
                    </div>

                    <!-- Word Wrap Toggle -->
                    <div class="flex items-center justify-between p-4 bg-[#161b22] border border-gray-800 rounded-lg group hover:border-blue-500/30 transition">
                        <div>
                            <div class="text-xs font-bold text-gray-200">${window.t('settings.preferences.wordWrap')}</div>
                            <div class="text-[10px] text-gray-500 mt-0.5">${window.t('settings.preferences.wordWrapDesc')}</div>
                        </div>
                        <label class="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" id="pref-wordwrap" class="sr-only peer" ${wordWrap ? 'checked' : ''} onchange="window.setPref('gx-word-wrap', this.checked)">
                            <div class="w-9 h-5 bg-gray-700 peer-checked:bg-blue-600 rounded-full transition after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full"></div>
                        </label>
                    </div>

                    <!-- Minimap Toggle -->
                    <div class="flex items-center justify-between p-4 bg-[#161b22] border border-gray-800 rounded-lg group hover:border-blue-500/30 transition">
                        <div>
                            <div class="text-xs font-bold text-gray-200">${window.t('settings.preferences.minimap')}</div>
                            <div class="text-[10px] text-gray-500 mt-0.5">${window.t('settings.preferences.minimapDesc')}</div>
                        </div>
                        <label class="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" id="pref-minimap" class="sr-only peer" ${minimap ? 'checked' : ''} onchange="window.setPref('gx-minimap', this.checked)">
                            <div class="w-9 h-5 bg-gray-700 peer-checked:bg-blue-600 rounded-full transition after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full"></div>
                        </label>
                    </div>

                    <!-- Auto-Update Toggle -->
                    <div class="flex items-center justify-between p-4 bg-[#161b22] border border-gray-800 rounded-lg group hover:border-blue-500/30 transition">
                        <div>
                            <div class="text-xs font-bold text-gray-200">${window.t('settings.preferences.autoUpdate')}</div>
                            <div class="text-[10px] text-gray-500 mt-0.5">${window.t('settings.preferences.autoUpdateDesc')}</div>
                        </div>
                        <label class="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" id="pref-autoupdate" class="sr-only peer" ${autoUpdate ? 'checked' : ''} onchange="window.setPref('gx-auto-update', this.checked)">
                            <div class="w-9 h-5 bg-gray-700 peer-checked:bg-blue-600 rounded-full transition after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full"></div>
                        </label>
                    </div>

                    <!-- Terminal Font Size -->
                    <div class="p-4 bg-[#161b22] border border-gray-800 rounded-lg group hover:border-blue-500/30 transition">
                        <div class="flex items-center justify-between mb-2">
                            <span class="text-xs font-bold text-gray-200">${window.t('settings.preferences.termFontSize')}</span>
                            <span id="pref-termfontsize-val" class="text-xs text-blue-400 font-mono">${termFontSize}px</span>
                        </div>
                        <input type="range" min="10" max="20" value="${termFontSize}" id="pref-termfontsize" class="w-full accent-blue-500 cursor-pointer" oninput="window.setPref('gx-terminal-font-size', this.value); document.getElementById('pref-termfontsize-val').textContent = this.value + 'px'">
                    </div>
                </div>
            `;
        }
        case 'ai': {
            return `
                <div class="space-y-8 animate-fade-in">
                    <div class="p-6 bg-[#161b22] border border-gray-800 rounded-2xl shadow-inner">
                        <h4 class="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4" data-i18n="settings.ai.title">${window.t('settings.ai.title')}</h4>
                        
                        <div class="flex flex-col gap-3">
                            <label class="text-[9px] font-bold text-gray-600 uppercase" data-i18n="settings.ai.geminiKey">${window.t('settings.ai.geminiKey')}</label>
                            <input id="ai-gemini-key" type="password" value="${state.geminiApiKey || ''}" data-i18n="[placeholder]settings.ai.placeholder" placeholder="${window.t('settings.ai.placeholder')}" class="p-3 bg-black/40 border border-gray-700 rounded-lg text-xs text-gray-200 focus:border-blue-500 outline-none transition font-mono tracking-widest">
                            <p class="text-[10px] text-gray-500 leading-relaxed" data-i18n="settings.ai.geminiDesc">${window.t('settings.ai.geminiDesc')}</p>
                        </div>

                        <button onclick="window.saveGeminiKey()" class="mt-6 w-full py-3 bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold rounded-lg transition shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2">
                             <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                             <span data-i18n="settings.ai.save">${window.t('settings.ai.save')}</span>
                        </button>
                    </div>

                    <div class="p-6 bg-[#161b22] border border-gray-800 rounded-2xl shadow-inner mt-4">
                        <h4 class="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Anthropic Claude CLI</h4>
                        
                        <div class="flex flex-col gap-3">
                            <label class="text-[9px] font-bold text-gray-600 uppercase">Anthropic API Key</label>
                            <input id="ai-anthropic-key" type="password" value="${state.anthropicApiKey || ''}" placeholder="sk-ant-..." class="p-3 bg-black/40 border border-gray-700 rounded-lg text-xs text-gray-200 focus:border-orange-500 outline-none transition font-mono tracking-widest">
                            <p class="text-[10px] text-gray-500 leading-relaxed">Inserisci qui la tua chiave Anthropic per usare <b>claudecode</b> direttamente nel tab dedicato.</p>
                        </div>

                        <button onclick="window.saveAnthropicKey()" class="mt-6 w-full py-3 bg-orange-600 hover:bg-orange-500 text-white text-[11px] font-bold rounded-lg transition shadow-lg shadow-orange-900/20 flex items-center justify-center gap-2">
                             <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                             <span>SALVA CHIAVE ANTHROPIC</span>
                        </button>
                    </div>

                    <div class="p-6 border border-blue-500/20 bg-blue-500/5 rounded-2xl">
                         <div class="flex items-start gap-4">
                            <div class="p-2 bg-blue-500/20 rounded-lg text-blue-400">
                                <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                            </div>
                            <div>
                                <div class="text-[11px] font-bold text-blue-300 uppercase tracking-widest mb-1">Google AI Studio</div>
                                <p class="text-[10px] text-blue-200/60 leading-relaxed">Puoi ottenere una chiave gratuita su <a href="https://aistudio.google.com/" target="_blank" class="text-blue-400 hover:underline italic">aistudio.google.com</a>. Il piano gratuito di Gemini 1.5 Pro è perfetto per l'uso personale dell'IDE.</p>
                            </div>
                         </div>
                    </div>
                </div>
            `;
        }
        case 'keybinds': {
            const currentShortcuts = state.shortcuts || {};
            
            return `
                <div class="space-y-6 animate-fade-in">
                    <div class="flex items-center justify-between">
                        <div>
                            <h4 class="text-xs font-bold text-gray-200 uppercase tracking-widest leading-none">${window.t('settings.tabs.keybinds')}</h4>
                            <p class="text-[9px] text-gray-500 mt-1 uppercase tracking-tighter">Personalizza i comandi rapidi dell'IDE</p>
                        </div>
                        <button onclick="window.resetShortcuts()" class="px-2 py-1 bg-black/20 hover:bg-red-900/20 text-red-400 border border-red-900/30 text-[8px] font-bold rounded uppercase transition">
                            Reset Default
                        </button>
                    </div>

                    <div class="space-y-3 pt-2">
                        ${Object.entries(currentShortcuts).map(([key, binding]) => `
                            <div class="flex items-center justify-between p-4 bg-[#161b22] border border-gray-800 rounded-xl group hover:border-blue-500/30 transition shadow-sm overflow-hidden relative">
                                <div class="relative z-10">
                                    <div class="text-[11px] font-bold text-gray-300 mb-0.5">${binding.label}</div>
                                    <div class="text-[9px] text-gray-600 font-mono tracking-tighter">${binding.action}</div>
                                </div>
                                <div class="relative z-10 flex items-center gap-2">
                                    <input type="text" 
                                           value="${key}" 
                                           readonly
                                           onclick="window.recordShortcut(this, '${binding.action}')"
                                           class="w-32 bg-black border border-gray-700 rounded-lg text-center font-mono text-[10px] text-blue-400 cursor-pointer hover:border-blue-500 transition focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                           title="Clicca per cambiare scorciatoia">
                                </div>
                                <!-- Background accent -->
                                <div class="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            </div>
                        `).join('')}
                    </div>

                    <!-- Extra Actions / Bonus -->
                    <div class="p-4 border border-yellow-500/10 bg-yellow-500/5 rounded-xl opacity-60">
                         <p class="text-[9px] text-yellow-200/60 leading-relaxed italic text-center">
                             Pro Tip: Clicca su una scorciatoia per registrarne una nuova. La registrazione terminerà automaticamente tasto dopo tasto.
                         </p>
                    </div>
                </div>
            `;
        }
        case 'mcp':
            return `
                <div class="space-y-8 animate-fade-in">
                    <!-- Predefined Templates -->
                    <div class="space-y-4">
                        <h4 class="text-[10px] font-bold text-gray-500 uppercase tracking-widest" data-i18n="settings.mcp.predefined">${window.t('settings.mcp.predefined')}</h4>
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
                        <h4 class="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4" data-i18n="settings.mcp.title">${window.t('settings.mcp.title')}</h4>
                        <div class="grid grid-cols-2 gap-4">
                            <div class="flex flex-col gap-2">
                                <label class="text-[9px] font-bold text-gray-600 uppercase" data-i18n="settings.mcp.name">${window.t('settings.mcp.name')}</label>
                                <input id="mcp-new-name" type="text" data-i18n="[placeholder]settings.mcp.placeholderName" placeholder="${window.t('settings.mcp.placeholderName')}" class="p-2.5 bg-black/40 border border-gray-700 rounded-lg text-xs text-gray-200 focus:border-blue-500 outline-none transition">
                            </div>
                            <div class="flex flex-col gap-2">
                                <label class="text-[9px] font-bold text-gray-600 uppercase" data-i18n="settings.mcp.url">${window.t('settings.mcp.url')}</label>
                                <input id="mcp-new-url" type="text" data-i18n="[placeholder]settings.mcp.placeholderUrl" placeholder="${window.t('settings.mcp.placeholderUrl')}" class="p-2.5 bg-black/40 border border-gray-700 rounded-lg text-xs text-gray-200 focus:border-blue-500 outline-none transition">
                            </div>
                        </div>
                        <button onclick="window.submitMCPForm()" class="mt-4 w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold rounded-lg transition shadow-lg shadow-blue-900/20" data-i18n="settings.mcp.register">${window.t('settings.mcp.register')}</button>
                    </div>

                    <!-- Active List -->
                    <div class="space-y-4">
                        <div class="flex items-center justify-between">
                            <h4 class="text-[10px] font-bold text-gray-500 uppercase tracking-widest" data-i18n="settings.mcp.activeList" data-i18n-args='{"count": ${state.mcpServers.length}}'>${window.t('settings.mcp.activeList').replace('{count}', state.mcpServers.length)}</h4>
                        </div>
                        <div class="space-y-3">
                            ${state.mcpServers.length === 0 ? `<div class="p-10 text-center text-gray-600 italic text-[11px] bg-black/10 border border-dashed border-gray-800 rounded-xl" data-i18n="settings.mcp.empty">${window.t('settings.mcp.empty')}</div>` : ''}
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
                                        <button onclick="window.toggleMCPServer('${srv.id}')" class="px-2 py-1 ${srv.enabled ? 'text-blue-400 bg-blue-400/10' : 'text-gray-500 bg-gray-500/10'} rounded text-[9px] font-bold uppercase transition hover:scale-105">
                                            ${srv.enabled ? window.t('settings.mcp.active') : window.t('settings.mcp.inactive')}
                                        </button>
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
                    <p class="text-xs text-gray-500" data-i18n="settings.youtrack.desc">${window.t('settings.youtrack.desc')}</p>
                    <div class="space-y-4">
                        <div class="flex flex-col gap-2">
                            <label class="text-[10px] uppercase font-bold text-gray-500" data-i18n="settings.youtrack.url">${window.t('settings.youtrack.url')}</label>
                            <input id="yt-url" type="text" placeholder="https://youtrack.jetbrains.com" value="${config.url}" class="p-2.5 bg-[#161b22] border border-gray-700 rounded text-xs text-gray-200 outline-none focus:border-blue-500">
                        </div>
                        <div class="flex flex-col gap-2">
                            <label class="text-[10px] uppercase font-bold text-gray-500" data-i18n="settings.youtrack.token">${window.t('settings.youtrack.token')}</label>
                            <input id="yt-token" type="password" placeholder="perm:xxxx.yyyy.zzzz" value="${config.token}" class="p-2.5 bg-[#161b22] border border-gray-700 rounded text-xs text-gray-200 outline-none focus:border-blue-500">
                        </div>
                        <div class="flex items-center gap-3 pt-2">
                            <div onclick="window.toggleYoutrack()" class="w-10 h-5 p-0.5 rounded-full cursor-pointer transition-all ${config.enabled ? 'bg-blue-600' : 'bg-gray-700'}">
                                <div class="w-4 h-4 bg-white rounded-full transition-all ${config.enabled ? 'translate-x-5' : 'translate-x-0'}"></div>
                            </div>
                            <span class="text-xs text-gray-400" data-i18n="settings.youtrack.sync">${window.t('settings.youtrack.sync')}</span>
                        </div>
                        <button onclick="window.saveYoutrackConfig()" class="mt-4 px-4 py-2 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded text-xs font-bold hover:bg-blue-600/30 transition" data-i18n="settings.youtrack.save">${window.t('settings.youtrack.save')}</button>
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
        case 'folders':
            return `
                <div class="space-y-8 animate-fade-in">
                    <div>
                        <h4 class="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4" data-i18n="settings.folders.title">${window.t('settings.folders.title')}</h4>
                        <p class="text-[10px] text-gray-500 mb-6" data-i18n="settings.folders.desc">${window.t('settings.folders.desc')}</p>
                        
                        <div class="p-6 bg-[#161b22] border border-gray-800 rounded-2xl group hover:border-blue-500/30 transition shadow-inner">
                            <h4 class="text-[11px] font-bold text-gray-300 uppercase tracking-widest mb-2" data-i18n="settings.folders.systemDir">${window.t('settings.folders.systemDir')}</h4>
                            <p class="text-[10px] text-gray-500 mb-6 leading-relaxed" data-i18n="settings.folders.systemDirDesc">${window.t('settings.folders.systemDirDesc')}</p>
                            
                            <button onclick="window.electronAPI.openGxCodeFolder()" class="w-full py-4 bg-[#0d1117] hover:bg-black text-gray-300 border border-gray-700 rounded-xl transition-all flex items-center justify-center gap-3 group-hover:border-blue-500/50 shadow-md">
                                <span class="text-xl group-hover:scale-110 transition-transform">📂</span>
                                <span class="text-[11px] font-bold tracking-widest uppercase text-gray-200 group-hover:text-blue-400 transition-colors" data-i18n="settings.folders.openFolder">${window.t('settings.folders.openFolder')}</span>
                            </button>
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
                        <h4 class="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4" data-i18n="settings.appearance.title">${window.t('settings.appearance.title')}</h4>
                        <div class="grid grid-cols-2 gap-3">
                            ${getSkins().map(s => `
                                <div onclick="window.applySkin('${s.id}')" class="p-3 border rounded-lg cursor-pointer transition-all ${currentSkin === s.id ? 'bg-blue-600/10 border-blue-500 text-blue-400' : 'bg-[#161b22] border-gray-800 text-gray-400 hover:border-gray-600'}">
                                    <div class="text-xs font-bold mb-1">${s.label}</div>
                                    <div class="text-[9px] opacity-70" data-i18n="settings.appearance.skinDesc" data-i18n-args='{"skin": "${s.id}"}'>
                                        ${window.t('settings.appearance.skinDesc').replace('{skin}', s.id)}
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    <div id="settings-grad-box" class="${currentSkin === 'custom-gradient' ? 'block' : 'hidden'} space-y-4">
                        <h4 class="text-xs font-bold text-gray-400 uppercase tracking-widest" data-i18n="settings.appearance.customGrad">${window.t('settings.appearance.customGrad')}</h4>
                        <input type="color" id="settings-grad-color" value="${customColor}" class="w-full h-12 cursor-pointer bg-transparent rounded overflow-hidden">
                    </div>
                </div>
            `;
        case 'language':
            return `
                <div class="space-y-8 animate-fade-in">
                    <p class="text-[11px] text-gray-500" data-i18n="settings.language.desc">${window.t('settings.language.desc')}</p>
                    <div class="grid grid-cols-2 gap-4">
                        <!-- IT -->
                        <div onclick="window.changeLanguage('it')" class="p-8 rounded-xl flex flex-col items-center justify-center gap-4 border-2 cursor-pointer transition-all duration-300 ${state.language === 'it' ? 'bg-blue-600/10 border-blue-500 shadow-lg shadow-blue-900/20' : 'bg-[#161b22] border-gray-800 text-gray-500 hover:border-gray-700'}">
                            <span class="text-3xl font-black tracking-tighter ${state.language === 'it' ? 'text-blue-400' : 'text-gray-600'}" data-i18n="settings.language.it_label">${window.t('settings.language.it_label')}</span>
                            <div class="flex flex-col items-center gap-1">
                                <span class="text-[11px] font-bold uppercase tracking-widest ${state.language === 'it' ? 'text-blue-500' : 'text-gray-500'}" data-i18n="settings.language.italian">${window.t('settings.language.italian')}</span>
                            </div>
                        </div>
                        
                        <!-- EN -->
                        <div onclick="window.changeLanguage('en')" class="p-8 rounded-xl flex flex-col items-center justify-center gap-4 border-2 cursor-pointer transition-all duration-300 ${state.language === 'en' ? 'bg-blue-600/10 border-blue-500 shadow-lg shadow-blue-900/20' : 'bg-[#161b22] border-gray-800 text-gray-500 hover:border-gray-700'}">
                            <span class="text-3xl font-black tracking-tighter ${state.language === 'en' ? 'text-blue-400' : 'text-gray-600'}" data-i18n="settings.language.en_label">${window.t('settings.language.en_label')}</span>
                            <div class="flex flex-col items-center gap-1">
                                <span class="text-[11px] font-bold uppercase tracking-widest ${state.language === 'en' ? 'text-blue-500' : 'text-gray-500'}" data-i18n="settings.language.english">${window.t('settings.language.english')}</span>
                            </div>
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
                                <h4 class="text-sm font-bold text-gray-200" data-i18n="settings.updates.softwareUpdate">${window.t('settings.updates.softwareUpdate')}</h4>
                                <p class="text-[11px] text-gray-500" data-i18n="settings.updates.description">${window.t('settings.updates.description')}</p>
                            </div>
                        </div>
                        <div class="flex flex-col items-end gap-2">
                            <button id="btn-do-update" onclick="window.startAppUpdate()" class="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition shadow-lg shadow-blue-900/40" data-i18n="settings.updates.updateNow">${window.t('settings.updates.updateNow')}</button>
                            <div id="update-progress-container" class="hidden w-40 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                                <div id="update-progress-bar" class="h-full bg-blue-500 transition-all duration-300" style="width: 0%"></div>
                            </div>
                            <span id="update-progress-text" class="hidden text-[9px] text-gray-500 font-mono uppercase" data-i18n="settings.updates.downloading" data-i18n-args='{"percent": "0"}'>
                                ${window.t('settings.updates.downloading').replace('{percent}', '0')}
                            </span>
                        </div>
                    </div>

                    <div class="space-y-4">
                        <h5 class="text-[10px] font-bold text-gray-500 uppercase tracking-widest" data-i18n="settings.updates.systemInfo">${window.t('settings.updates.systemInfo')}</h5>
                        <div class="grid grid-cols-2 gap-4">
                            <div class="p-4 bg-black/20 border border-gray-800 rounded-lg">
                                <div class="text-[9px] text-gray-600 uppercase font-bold" data-i18n="settings.updates.currentVersion">${window.t('settings.updates.currentVersion')}</div>
                                <div class="text-xs text-gray-300 font-mono mt-1">${state.appVersion}</div>
                            </div>
                            <div class="p-4 bg-black/20 border border-gray-800 rounded-lg">
                                <div class="text-[9px] text-gray-600 uppercase font-bold" data-i18n="settings.updates.channel">${window.t('settings.updates.channel')}</div>
                                <div class="text-xs text-emerald-500 font-bold mt-1" data-i18n="settings.updates.officialChannel">${window.t('settings.updates.officialChannel')}</div>
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

    const groups = getSettingsTabs();
    const activeTab = groups.flatMap(g => g.tabs).find(t => t.id === state.activeSettingsTab);

    root.innerHTML = `
        <div class="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-6 pointer-events-auto animate-fade-in">
            <div class="bg-[#0d1117] w-full max-w-4xl h-[640px] rounded-2xl border border-gray-700/50 shadow-2xl flex overflow-hidden">
                <!-- Sidebar -->
                <div class="w-64 border-r border-gray-800 bg-[#161b22] flex flex-col">
                    <div class="h-14 flex items-center px-6 border-b border-gray-800 bg-black/20">
                        <h2 class="text-sm font-black text-white uppercase tracking-widest" data-i18n="settings.title">${window.t('settings.title')}</h2>
                    </div>
                    <div class="flex-1 py-4 overflow-y-auto no-scrollbar">
                        ${groups.map(group => `
                            <div class="px-6 py-2 mt-4 first:mt-0">
                                <h4 class="text-[9px] font-black text-gray-500 uppercase tracking-[0.2em] mb-2 px-1 opacity-50">${group.title}</h4>
                                <div class="space-y-1">
                                    ${group.tabs.map(tab => `
                                        <div onclick="window.switchSettingsTab('${tab.id}')" 
                                             class="px-3 py-2 flex items-center gap-3 rounded-lg cursor-pointer transition-all 
                                             ${state.activeSettingsTab === tab.id 
                                                 ? 'bg-blue-600/15 text-blue-400 border border-blue-500/20 shadow-lg shadow-blue-900/10' 
                                                 : 'text-gray-400 hover:bg-white/5 hover:text-gray-200 border border-transparent'}">
                                            <span class="text-sm scale-110">${tab.icon}</span>
                                            <span class="text-[11px] font-bold tracking-tight">${tab.label}</span>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                    <div class="p-6 border-t border-gray-800 bg-black/10">
                        <button onclick="window.closeSettings()" class="w-full py-2 bg-gray-800/50 hover:bg-red-600/20 hover:text-red-400 border border-transparent hover:border-red-500/30 text-gray-400 rounded-lg text-[10px] transition-all uppercase font-black tracking-widest" data-i18n="settings.close">${window.t('settings.close')}</button>
                    </div>
                </div>

                <!-- Content Area -->
                <div class="flex-1 flex flex-col bg-[#0d1117]">
                    <div class="h-14 border-b border-gray-800 flex items-center px-8 bg-[#0d1117] relative z-10 shadow-sm">
                        <div class="flex items-center gap-3">
                           <span class="text-lg">${activeTab?.icon || ''}</span>
                           <h3 class="font-black text-white text-sm uppercase tracking-wide">${activeTab?.label || ''}</h3>
                        </div>
                    </div>
                    <div class="flex-1 overflow-y-auto p-10 custom-scrollbar bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/5 via-transparent to-transparent">
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

window.setPref = (key, value) => {
    console.log(`Setting preference ${key} to ${value}`);
    localStorage.setItem(key, value);

    // Applica immediatamente le impostazioni che non richiedono riavvio
    if (window.editor) {
        const options = {};
        if (key === 'gx-font-size') options.fontSize = parseInt(value);
        if (key === 'gx-tab-size') options.tabSize = parseInt(value);
        if (key === 'gx-word-wrap') options.wordWrap = value ? 'on' : 'off';
        if (key === 'gx-minimap') options.minimap = { enabled: value };
        
        window.editor.updateOptions(options);
    }

    // Se cambia la dimensione del font del terminale, invia un evento (verrà catturato da terminal.js)
    if (key === 'gx-terminal-font-size') {
        window.dispatchEvent(new CustomEvent('gx-term-font-change', { detail: value }));
    }
};

window.changeLanguage = async (lang) => {
    await loadLocale(lang);
    setState({ language: lang });
    // Forza il ricaricamento della UI dei settings per vedere le traduzioni
    setState({ isSettingsOpen: true }); 
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
        setState({ mcpServers });
        
        // Sincronizza con il backend (così l'Agente può usarli)
        api.syncMCPServers?.(mcpServers);

        // Auto-Link YouTrack if name matches
        if (name.toLowerCase().includes('youtrack')) {
            console.log("[GX Settings] YouTrack MCP detected, linking to Tickets tab...");
            // Se non c'è già una configurazione manuale, impostiamo questa
            if (!state.youtrackConfig.url || !state.youtrackConfig.token) {
                setState({ 
                    youtrackConfig: { 
                        ...state.youtrackConfig, 
                        url: url, 
                        enabled: true 
                    } 
                });
                window.gxToast("YouTrack MCP collegato alla tab Tickets. Inserisci il token se richiesto.", 'info');
            }
        }
        
        nameEl.value = '';
        urlEl.value = '';
        window.gxToast(window.t('settings.mcp.toastSuccess'), 'info');
    } else {
        window.gxToast(window.t('settings.mcp.toastError'), 'error');
    }
};

window.useMCPTemplate = (templateId) => {
    const template = MCP_TEMPLATES.find(t => t.id === templateId);
    if (template) {
        const nameEl = document.getElementById('mcp-new-name');
        const urlEl = document.getElementById('mcp-new-url');
        if (nameEl) nameEl.value = template.name;
        if (urlEl) urlEl.value = template.url;
        window.gxToast(window.t('settings.mcp.toastTemplate').replace('{name}', template.name), 'info');
    }
};

window.addNewMCPServer = () => {
    // Legacy support, now managed by form
    const mcpTab = document.querySelector('[onclick*="switchSettingsTab(\'mcp\')"]');
    if (mcpTab) mcpTab.click();
};

window.removeMCPServer = (id) => {
    const mcpServers = state.mcpServers.filter(s => s.id !== id);
    setState({ mcpServers });
    api.syncMCPServers?.(mcpServers);
};

window.toggleMCPServer = (id) => {
    const mcpServers = state.mcpServers.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s);
    setState({ mcpServers });
    api.syncMCPServers?.(mcpServers);
};

window.toggleYoutrack = () => {
    const youtrackConfig = { ...state.youtrackConfig, enabled: !state.youtrackConfig.enabled };
    setState({ youtrackConfig });
    // Se attivato, prova a caricare subito i ticket
    if (youtrackConfig.enabled) api.loadIssues();
};

window.saveYoutrackConfig = () => {
    const url = document.getElementById('yt-url').value;
    const token = document.getElementById('yt-token').value;
    const youtrackConfig = { ...state.youtrackConfig, url, token };
    setState({ youtrackConfig });
    
    // Ricarica immediatamente i ticket per mostrare i cambiamenti
    api.loadIssues();
    
    window.gxToast(window.t('settings.youtrack.success'), 'info');
};

window.toggleMarketplaceSource = (sourceId) => {
    const marketplaceSources = { ...state.marketplaceSources, [sourceId]: !state.marketplaceSources[sourceId] };
    setState({ marketplaceSources });
};

window.toggleAddRepoForm = (show) => {
    setState({ isAddingRepo: show });
};

window.saveGeminiKey = () => {
    const key = document.getElementById('ai-gemini-key').value.trim();
    setState({ geminiApiKey: key });
    window.gxToast(window.t('settings.ai.success'), 'info');
};

window.saveAnthropicKey = () => {
    const key = document.getElementById('ai-anthropic-key').value.trim();
    setState({ anthropicApiKey: key });
    window.gxToast("Chiave Anthropic salvata!", 'info');
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
        window.gxToast(window.t('settings.mcp.toastError'), 'error');
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
        btn.innerHTML = `<span class="animate-pulse">${window.t('settings.updates.checking')}</span>`;
    }

    try {
        const hasUpdate = await window.electronAPI.performUpdate();
        if (!hasUpdate) {
            window.gxToast(window.t('updater.alreadyLatest'), 'info');
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = window.t('settings.updates.upToDate');
                setTimeout(() => { if (btn) btn.innerHTML = window.t('settings.updates.updateNow'); }, 3000);
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
        window.gxToast(err.message || window.t('updater.error'), 'error');
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = window.t('settings.updates.retry');
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
        if (text) text.innerText = window.t('settings.updates.downloading').replace('{percent}', Math.round(percent));
    });

    window.electronAPI.onUpdateReady(() => {
        const btn = document.getElementById('btn-do-update');
        const container = document.getElementById('update-progress-container');
        const text = document.getElementById('update-progress-text');

        if (btn) {
            btn.disabled = false;
            btn.innerHTML = window.t('settings.updates.restart');
            btn.classList.replace('bg-blue-600', 'bg-emerald-600');
            btn.classList.replace('hover:bg-blue-500', 'hover:bg-emerald-500');
            btn.dataset.state = 'restart';
        }
        if (container) container.classList.add('hidden');
        if (text) text.classList.add('hidden');
    });

    subscribe(renderSettingsModal);
};

// --- Shortcut Manager Helpers ---
window.recordShortcut = (input, action) => {
    input.value = "Premi tasti...";
    input.classList.add('animate-pulse', 'border-blue-500', 'text-white');
    
    // Mostriamo un piccolo overlay o feedback visivo? Per ora usiamo l'input.
    
    const onKey = (e) => {
        e.preventDefault();
        e.stopPropagation();

        const isModifier = ['Control', 'Shift', 'Alt', 'Meta'].includes(e.key);
        
        let keys = [];
        if (e.ctrlKey || e.metaKey) keys.push('Ctrl');
        if (e.shiftKey) keys.push('Shift');
        if (e.altKey) keys.push('Alt');

        // Se è un modificatore e non abbiamo ancora un tasto finale, aggiorniamo solo l'anteprima
        if (isModifier) {
            input.value = keys.join('+') + (keys.length > 0 ? '+...' : '...');
            return;
        }

        const key = e.key === ' ' ? 'Space' : e.key.charAt(0).toUpperCase() + e.key.slice(1);
        keys.push(key);

        const newShortcut = keys.join('+');
        input.value = newShortcut;
        input.classList.remove('animate-pulse', 'border-blue-500', 'text-white');
        
        // Salva nello stato
        const newShortcuts = { ...state.shortcuts };
        
        // Rimuovi eventuali vecchie assegnazioni per questa combinazione (evita conflitti)
        Object.keys(newShortcuts).forEach(k => {
            if (newShortcuts[k].action === action) delete newShortcuts[k];
        });

        // Aggiungi la nuova
        const originalLabel = Object.values(state.shortcuts).find(s => s.action === action)?.label || action;
        newShortcuts[newShortcut] = {
            action,
            label: originalLabel
        };

        setState({ shortcuts: newShortcuts });
        localStorage.setItem('gx-shortcuts', JSON.stringify(newShortcuts));
        
        window.removeEventListener('keydown', onKey, true);
        window.gxToast(`Scorciatoia aggiornata: ${newShortcut}`, 'info');
    };

    window.addEventListener('keydown', onKey, true);
};

window.resetShortcuts = () => {
    const defaults = {
        'Ctrl+S': { action: 'editor:save', label: 'Salva File Attivo' },
        'Ctrl+P': { action: 'search:quick-open', label: 'Ricerca Globale Rapida' },
        'Ctrl+B': { action: 'sidebar:toggle', label: 'Mostra/Nascondi Sidebar' },
        'Alt+F': { action: 'editor:format', label: 'Formatta Documento' }
    };
    setState({ shortcuts: defaults });
    localStorage.setItem('gx-shortcuts', JSON.stringify(defaults));
    window.gxToast('Scorciatoie resettate ai valori predefiniti', 'info');
};
