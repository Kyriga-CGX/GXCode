import { state, setState, subscribe } from '../core/state.js';

export const initCustomAi = () => {
    const pane = document.getElementById('pane-ai-custom');
    if (!pane) return;

    const render = () => {
        const config = state.customAiConfig;
        
        if (!config.isSetup) {
            renderSetupView();
        } else {
            renderChatView();
        }
    };

    const renderSetupView = () => {
        // Garantisce che il pane genitore sia il riferimento relativo ma non ne forza il display
        pane.style.position = 'relative';
        pane.style.display = ''; 

        pane.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; width: 100%; padding: 20px; position: relative; background-color: var(--bg-main); overflow: hidden;">
                
                <!-- Glow decorativo di sfondo -->
                <div class="absolute inset-0 pointer-events-none opacity-20" style="overflow: hidden;">
                    <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 400px; height: 400px; background: rgba(167, 139, 250, 0.1); filter: blur(100px); border-radius: 50%;"></div>
                </div>

                <!-- BLOCCO CENTRALE -->
                <div style="display: flex; flex-direction: column; align-items: center; gap: 20px; z-index: 10; max-width: 400px; width: 100%;">
                    
                    <!-- Icona -->
                    <div style="width: 48px; height: 48px; background: rgba(167, 139, 250, 0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 1px solid rgba(167, 139, 250, 0.2);">
                        <svg viewBox="0 0 24 24" style="width: 24px; height: 24px; color: #a78bfa;" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M19 19L21 21M15 15L17 17M14 2L16 4M10 2L12 4M2 14L4 16M2 10L4 12M5 5L19 19" stroke-linecap="round" stroke-linejoin="round"/>
                            <path d="M12 21L7 16" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </div>

                    <!-- Titoli -->
                    <div style="text-align: center;">
                        <h3 style="color: white; font-size: 18px; font-weight: 800; text-transform: uppercase; letter-spacing: 4px; margin: 0 0 8px 0;">Aggiungi API</h3>
                        <p style="color: rgba(167, 139, 250, 0.6); font-size: 10px; text-transform: uppercase; letter-spacing: 2px; margin: 0;">Configura il tuo assistente AI personalizzato</p>
                    </div>

                    <!-- Input Card -->
                    <div style="width: 100%; background: var(--bg-side); border: 1px solid var(--border-dim); padding: 25px; border-radius: 16px; margin-top: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.3);">
                        <div style="position: relative;">
                            <label style="position: absolute; top: -10px; left: 12px; background: var(--bg-side); padding: 0 8px; color: #a78bfa; font-size: 9px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; border-radius: 4px;">Chiave API</label>
                            <input type="password" id="custom-ai-api-input" 
                                   value="${state.customAiConfig.apiKey}"
                                   style="width: 100%; background: var(--bg-main); border: 1px solid var(--border-subtle); border-radius: 8px; padding: 12px 16px; color: white; font-size: 13px; outline: none; transition: border-color 0.3s;"
                                   placeholder="Inserisci la tua API Key...">
                        </div>
                    </div>
                </div>

                <!-- TASTO SALVA: Angolo in basso a destra (FOOLPROOF) -->
                <div style="position: absolute; bottom: 24px; right: 24px; z-index: 100;">
                    <button id="custom-ai-save-btn" 
                            style="display: flex; align-items: center; gap: 12px; background: #a78bfa; color: white; border: none; padding: 10px 24px; border-radius: 50px; cursor: pointer; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; box-shadow: 0 8px 20px rgba(167, 139, 250, 0.3); transition: all 0.3s;"
                            onmouseover="this.style.background='#c084fc'; this.style.transform='translateY(-2px)'"
                            onmouseout="this.style.background='#a78bfa'; this.style.transform='translateY(0)'">
                        <span>Salva</span>
                        <div style="width: 20px; height: 20px; background: rgba(255,255,255,0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                        </div>
                    </button>
                </div>
            </div>
        `;

        document.getElementById('custom-ai-save-btn').onclick = handleSave;
        
        // Aggiunge focus styling via JS
        const input = document.getElementById('custom-ai-api-input');
        if (input) {
            input.onfocus = () => input.style.borderColor = '#a78bfa';
            input.onblur = () => input.style.borderColor = '#30363d';
        }
    };

    const renderChatView = () => {
        // Resetta stili che potrebbero interferire con il sistema a tab
        pane.style.position = 'relative';
        pane.style.display = ''; 

        pane.innerHTML = `
            <div style="display: flex; flex-direction: column; height: 100%; width: 100%; background-color: var(--bg-main); position: relative; overflow: hidden;" class="animate-fade-in">
                <!-- Top Header / Settings -->
                <div class="absolute top-3 left-3 z-[20]">
                    <button id="custom-ai-settings-btn" class="p-2 text-gray-500 hover:text-[#a78bfa] transition rounded-lg hover:bg-[#a78bfa]/5">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/>
                            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                        </svg>
                    </button>
                </div>

                <!-- Messages Area -->
                <div id="custom-ai-messages" class="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                    <div class="flex flex-col items-center justify-center h-full opacity-20 select-none">
                         <div class="text-[10px] uppercase font-bold tracking-[0.3em] text-[#a78bfa]">Custom AI Ready</div>
                    </div>
                </div>

                <!-- Bottom Bar -->
                <div class="p-4 border-t border-[var(--border-dim)] flex items-end gap-3 bg-[var(--bg-main)] backdrop-blur-md">
                    <div class="flex-1 relative">
                        <textarea id="custom-ai-chat-input" 
                                  placeholder="Scrivi un messaggio..."
                                  rows="1"
                                  class="w-full bg-[var(--bg-side)] border border-[var(--border-dim)] rounded-2xl px-4 py-2.5 text-sm text-gray-300 outline-none focus:border-[#a78bfa]/50 transition duration-300 resize-none max-h-32"></textarea>
                    </div>

                    <div id="custom-ai-model-container" class="relative">
                        <select id="custom-ai-model-select" class="bg-[var(--bg-side)] border border-[var(--border-dim)] rounded-lg px-3 py-2 text-[10px] font-bold text-[#a78bfa] outline-none hover:border-[#a78bfa]/30 transition appearance-none pr-8 min-w-[120px]">
                            ${state.customAiConfig.models.length > 0 
                                ? state.customAiConfig.models.map(m => `<option value="${m}" ${m === state.customAiConfig.activeModel ? 'selected' : ''}>${m}</option>`).join('')
                                : `<option value="">${state.customAiConfig.activeModel || 'Caricamento...'}</option>`
                            }
                        </select>
                        <div class="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-gray-600">
                             <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
                        </div>
                    </div>
                </div>

                <!-- Settings Overlay -->
                <div id="custom-ai-settings-overlay" class="absolute inset-0 z-[100] bg-[#06080a]/90 backdrop-blur-sm hidden flex items-center justify-center p-6 animate-fade-in">
                    <div class="bg-[var(--bg-side)] border border-[var(--border-dim)] rounded-xl w-full max-w-sm p-6 shadow-2xl">
                        <div class="flex items-center justify-between mb-6">
                            <h4 class="text-sm font-bold text-[#a78bfa] uppercase tracking-widest">Impostazioni AI</h4>
                            <button id="close-custom-settings" class="text-gray-500 hover:text-white transition">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                            </button>
                        </div>
                        <div class="space-y-4">
                            <div>
                                <label class="text-[9px] text-gray-500 uppercase font-bold mb-1.5 block">Endpoint URL</label>
                                <input type="text" id="setting-custom-endpoint" value="${state.customAiConfig.endpoint}" class="w-full bg-[var(--bg-main)] border border-[var(--border-dim)] rounded px-3 py-2 text-xs text-gray-300 outline-none focus:border-[#a78bfa]/50 transition">
                            </div>
                            <div>
                                <label class="text-[9px] text-gray-500 uppercase font-bold mb-1.5 block">API Key</label>
                                <input type="password" id="setting-custom-key" value="${state.customAiConfig.apiKey}" class="w-full bg-[var(--bg-main)] border border-[var(--border-dim)] rounded px-3 py-2 text-xs text-gray-300 outline-none focus:border-[#a78bfa]/50 transition">
                            </div>
        `;

        setupChatEvents();
    };

    const handleSave = () => {
        const key = document.getElementById('custom-ai-api-input').value;
        if (!key) return;

        const newConfig = { ...state.customAiConfig, apiKey: key, isSetup: true };
        setState({ customAiConfig: newConfig });
        fetchModels();
    };

    const setupChatEvents = () => {
        const input = document.getElementById('custom-ai-chat-input');
        const settingsBtn = document.getElementById('custom-ai-settings-btn');
        const overlay = document.getElementById('custom-ai-settings-overlay');
        const closeOverlay = document.getElementById('close-settings-btn');
        const saveSettings = document.getElementById('save-settings-btn');

        if (input) {
            input.addEventListener('input', () => {
                input.style.height = 'auto';
                input.style.height = (input.scrollHeight) + 'px';
            });
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    // Handle Message Send
                    input.value = '';
                    input.style.height = 'auto';
                }
            });
        }

        if (settingsBtn) settingsBtn.onclick = () => overlay.classList.remove('hidden');
        if (closeOverlay) closeOverlay.onclick = () => overlay.classList.add('hidden');
        
        if (saveSettings) {
            saveSettings.onclick = () => {
                const endpoint = document.getElementById('setting-custom-endpoint').value;
                const key = document.getElementById('setting-custom-key').value;
                setState({ 
                    customAiConfig: { 
                        ...state.customAiConfig, 
                        endpoint, 
                        apiKey: key 
                    } 
                });
                overlay.classList.add('hidden');
                fetchModels();
            };
        }
    };

    const fetchModels = async () => {
        const { endpoint, apiKey } = state.customAiConfig;
        console.log(`[Custom AI] Fetching models from ${endpoint}...`);
        
        try {
            // Tentativo fetch standard (Ollama/LM Studio style)
            const response = await fetch(`${endpoint.replace(/\/$/, '')}/models`, {
                headers: apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {}
            });
            
            if (response.ok) {
                const data = await response.json();
                const list = (data.data || data.models || []).map(m => m.id || m.name || m);
                if (list.length > 0) {
                    setState({ 
                        customAiConfig: { 
                            ...state.customAiConfig, 
                            models: list, 
                            activeModel: list[0] 
                        } 
                    });
                    return;
                }
            }
        } catch (e) {
            console.warn("[Custom AI] Model fetch failed, using fallbacks.");
        }

        // Fallback common models if fetch fails
        const fallbacks = ["qwen-7b", "gemma-2b", "llama-3-8b", "phi-3"];
        setState({ 
            customAiConfig: { 
                ...state.customAiConfig, 
                models: fallbacks, 
                activeModel: fallbacks[0] 
            } 
        });
    };

    subscribe((newState, oldState) => {
        if (newState.customAiConfig !== oldState?.customAiConfig) {
            render();
        }
    });

    render();
};
