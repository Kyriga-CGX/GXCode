import { state, setState, subscribe } from '../core/state.js';

export const initGemini = () => {
    const pane = document.getElementById('pane-ai-gemini');
    if (!pane) return;

    const render = () => {
        const config = state.geminiConfig;
        
        if (state._geminiAuthenticating) {
            renderAuthenticatingView();
        } else if (!config.isAuthenticated) {
            renderAuthView();
        } else {
            renderChatView();
        }
    };

    const renderAuthenticatingView = () => {
        const error = state._geminiAuthError;
        pane.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; width: 100%; background-color: #0d1117; color: white; padding: 20px; text-align: center;">
                ${error ? `
                    <div style="color: #f87171; margin-bottom: 20px;">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-bottom: 15px;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                        <h2 style="font-size: 16px; font-weight: 800; margin-bottom: 8px;">ERRORE CONFIGURAZIONE</h2>
                        <p style="font-size: 11px; opacity: 0.8; line-height: 1.5;">${error}</p>
                    </div>
                ` : `
                    <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-[#4285F4] mb-6"></div>
                    <h2 style="font-size: 18px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 8px;">Accesso in corso...</h2>
                    <p style="color: rgba(255,255,255,0.5); font-size: 11px;">Completa l'autenticazione nel tuo browser predefinito.</p>
                `}
                <button id="cancel-auth-btn" style="margin-top: 24px; background: none; border: 1px solid rgba(255,255,255,0.1); color: rgba(255,255,255,0.4); padding: 8px 16px; border-radius: 6px; font-size: 10px; cursor: pointer; text-transform: uppercase; letter-spacing: 1px;">
                    ${error ? 'Torna Indietro' : 'Annulla'}
                </button>
            </div>
        `;
        document.getElementById('cancel-auth-btn').onclick = () => setState({ _geminiAuthenticating: false, _geminiAuthError: null });
    };

    const renderAuthView = () => {
        pane.style.position = 'relative';
        pane.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; width: 100%; padding: 40px; background-color: #0d1117; position: relative; overflow: hidden;">
                <!-- Decorazione Background -->
                <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: radial-gradient(circle at 50% 50%, rgba(66, 133, 244, 0.05) 0%, transparent 70%); pointer-events: none;"></div>
                
                <!-- Logo Gemini Animato (Placeholder per l'SVG già presente in index.html o nuova versione) -->
                <div style="width: 80px; height: 80px; margin-bottom: 32px; filter: drop-shadow(0 0 20px rgba(66, 133, 244, 0.3));">
                     <svg viewBox="0 0 100 100" style="width: 100%; height: 100%;">
                        <defs>
                            <linearGradient id="gemini-auth-glow" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" style="stop-color:#4285F4" />
                                <stop offset="50%" style="stop-color:#34A853" />
                                <stop offset="100%" style="stop-color:#FBBC05" />
                            </linearGradient>
                        </defs>
                        <path d="M50 5 Q57 43 95 50 Q57 57 50 95 Q43 57 5 50 Q43 43 50 5" fill="url(#gemini-auth-glow)" />
                    </svg>
                </div>
                <!-- Pulsante Login in alto a destra -->
                <div style="position: absolute; top: 20px; right: 20px; z-index: 20;">
                    <button id="google-signin-btn" style="display: flex; align-items: center; justify-content: center; gap: 8px; background: white; color: #3c4043; border: none; padding: 8px 16px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.3s; box-shadow: 0 4px 12px rgba(0,0,0,0.2); font-family: 'Inter', sans-serif;">
                        <svg width="14" height="14" viewBox="0 0 18 18">
                            <path d="M17.64 9.2c0-.63-.06-1.25-.16-1.84H9v3.49h4.84a4.14 4.14 0 0 1-1.8 2.71v2.26h2.91c1.71-1.58 2.69-3.9 2.69-6.62z" fill="#4285F4"/>
                            <path d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.8.54-1.83.86-3.05.86-2.34 0-4.32-1.58-5.03-3.71H.95v2.33C2.43 15.98 5.48 18 9 18z" fill="#34A853"/>
                            <path d="M3.97 10.71a4.69 4.69 0 0 1 0-3.42V4.96H.95a8.99 8.99 0 0 0 0 8.08l3.02-2.33z" fill="#FBBC05"/>
                            <path d="M9 3.58c1.32 0 2.5.45 3.44 1.35L15.1 2.3C13.47.8 11.42 0 9 0 5.48 0 2.43 2.02.95 4.96l3.02 2.33C4.68 5.16 6.66 3.58 9 3.58z" fill="#EA4335"/>
                        </svg>
                        Sign in with Google
                    </button>
                </div>

                <div style="text-align: center; z-index: 10; max-width: 420px;">
                    <h2 style="color: white; font-size: 20px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 12px; font-family: 'Outfit', sans-serif;">Gemini AI</h2>
                    <p style="color: rgba(255,255,255,0.5); font-size: 11px; line-height: 1.6; margin-bottom: 16px; text-transform: uppercase; letter-spacing: 1px;">Esegui l'accesso con il tuo account Google per sbloccare la potenza di Gemini nel tuo ambiente di sviluppo.</p>
                    
                    <p style="color: rgba(255,255,255,0.15); font-size: 9px; text-transform: uppercase; letter-spacing: 1px;">Google AI SDK / OAuth Flow Recommendation</p>
                </div>
            </div>
        `;

        const btn = document.getElementById('google-signin-btn');
        btn.onmouseover = () => {
            btn.style.transform = 'translateY(-2px)';
            btn.style.boxShadow = '0 6px 20px rgba(0,0,0,0.3)';
            btn.style.backgroundColor = '#f8f9fa';
        };
        btn.onmouseout = () => {
            btn.style.transform = 'translateY(0)';
            btn.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
            btn.style.backgroundColor = 'white';
        };
        
        btn.onclick = async () => {
             // Avvia login reale tramite Main Process
             setState({ _geminiAuthenticating: true, _geminiAuthError: null });
             if (window.electronAPI?.geminiLogin) {
                 const res = await window.electronAPI.geminiLogin();
                 if (res && !res.success) {
                     setState({ _geminiAuthError: res.message });
                 }
             } else {
                 // Fallback per test locale
                 setTimeout(() => {
                    setState({ 
                        _geminiAuthenticating: false,
                        geminiConfig: { ...state.geminiConfig, isAuthenticated: true, user: { name: "User", email: "user@gmail.com" } } 
                    });
                 }, 2000);
             }
        };
    };
    const renderChatView = () => {
        const messages = state.geminiConfig.messages || [];
        
        pane.innerHTML = `
            <div style="display: flex; flex-direction: column; height: 100%; width: 100%; background-color: #0d1117; position: relative; overflow: hidden;" class="animate-fade-in">
                <!-- Header Chat -->
                <div style="padding: 12px 20px; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; align-items: center; justify-content: space-between; background: rgba(22,27,34,0.5);">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <svg width="16" height="16" viewBox="0 0 100 100">
                             <path d="M50 5 Q57 43 95 50 Q57 57 50 95 Q43 57 5 50 Q43 43 50 5" fill="#4285F4" />
                        </svg>
                        <span style="color: #cad1d8; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px;">Gemini Chat</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div style="font-size: 9px; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 1px;">${state.geminiConfig.user?.email || ''}</div>
                        <button id="gemini-logout-btn" style="background: none; border: none; color: #f85149; font-size: 10px; cursor: pointer; text-transform: uppercase; font-weight: bold; padding: 4px 8px; border-radius: 4px;">Logout</button>
                    </div>
                </div>

                <!-- Messages area (Compact v9) -->
                <div id="gemini-messages-area" style="flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 10px;" class="custom-scrollbar">
                    ${state._geminiNeedsKey ? `
                        <div style="background: rgba(239, 68, 68, 0.05); border: 1px solid rgba(239, 68, 68, 0.2); padding: 16px; border-radius: 12px; margin-bottom: 20px; text-align: center;">
                            <div style="font-size: 14px; color: #ef4444; margin-bottom: 8px; font-weight: bold;">⚠️ Permessi Insufficienti</div>
                            <p style="font-size: 10px; color: rgba(255,255,255,0.6); margin-bottom: 12px;">Il tuo account Google non ha i permessi per questa API. Incolla una Gemini API Key (da AI Studio):</p>
                            <input id="gemini-manual-key-input" type="password" placeholder="AIza..." style="width: 100%; background: #000; border: 1px solid rgba(255,255,255,0.1); color: white; padding: 8px; border-radius: 6px; font-size: 11px; margin-bottom: 10px;">
                            <button id="save-gemini-key-btn" style="background: #ef4444; color: white; border: none; padding: 6px 12px; border-radius: 6px; font-size: 10px; font-weight: bold; cursor: pointer;">SALVA CHIAVE</button>
                        </div>
                    ` : ''}
                    
                    ${messages.length === 0 && !state._geminiNeedsKey ? `
                        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; opacity: 0.15; pointer-events: none;">
                            <div style="text-align: center;">
                                <h4 style="color: white; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 4px; margin-bottom: 4px;">Connesso</h4>
                                <p style="color: white; font-size: 8px;">Pronto ad assisterti con Google AI</p>
                            </div>
                        </div>
                    ` : messages.map(msg => `
                        <div style="display: flex; flex-direction: column; align-items: ${msg.role === 'user' ? 'flex-end' : 'flex-start'}; gap: 2px; max-width: 80%; align-self: ${msg.role === 'user' ? 'flex-end' : 'flex-start'}; animate: slideIn 0.3s ease;">
                             <div style="background: ${msg.role === 'user' ? 'rgba(66, 133, 244, 0.12)' : 'rgba(255,255,255,0.02)'}; border: 1px solid ${msg.role === 'user' ? 'rgba(66, 133, 244, 0.15)' : 'rgba(255,255,255,0.06)'}; color: ${msg.role === 'user' ? '#f0f3f5' : '#c9d1d9'}; padding: 6px 10px; border-radius: 12px; border-bottom-${msg.role === 'user' ? 'right' : 'left'}-radius: 2px; font-size: 11px; line-height: 1.5; white-space: pre-wrap;">
                                ${msg.text}
                             </div>
                             <div style="font-size: 7px; color: rgba(255,255,255,0.2); text-transform: uppercase; letter-spacing: 0.5px;">${msg.role === 'user' ? 'User' : 'Gemini'}</div>
                        </div>
                    `).join('')}
                    ${state._geminiLoading ? `
                         <div style="display: flex; align-items: center; gap: 6px; align-self: flex-start;">
                            <div class="animate-pulse" style="width: 4px; height: 4px; border-radius: 50%; background: #4285F4;"></div>
                            <div class="animate-pulse" style="width: 4px; height: 4px; border-radius: 50%; background: #4285F4; animation-delay: 0.2s;"></div>
                            <div class="animate-pulse" style="width: 4px; height: 4px; border-radius: 50%; background: #4285F4; animation-delay: 0.4s;"></div>
                         </div>
                    ` : ''}
                </div>

                <!-- Bottom UI: Chat Input Bubble (Compact) -->
                <div style="padding: 10px; position: relative;">
                    <div style="background: rgba(22, 27, 34, 0.95); border: 1px solid rgba(167, 139, 250, 0.08); border-radius: 14px; padding: 10px 14px; box-shadow: 0 4px 20px rgba(0,0,0,0.3); backdrop-blur: 16px; display: flex; flex-direction: column; gap: 8px;">
                        
                        <div style="display: flex; gap: 10px; align-items: flex-end;">
                            <textarea id="gemini-input" placeholder="Chiedi a Gemini..." style="flex: 1; background: transparent; border: none; outline: none; color: white; font-size: 12px; line-height: 1.4; resize: none; max-height: 80px; padding: 2px 0;" rows="1"></textarea>
                            
                            <button id="gemini-send-btn" style="width: 28px; height: 28px; border-radius: 50%; background: #4285F4; border: none; display: flex; align-items: center; justify-content: center; color: white; cursor: pointer; transition: all 0.2s;">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                            </button>
                        </div>

                        <!-- Pill Box -->
                        <div style="display: flex; align-items: center; justify-content: space-between; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 8px;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <button id="gemini-context-btn" style="width: 24px; height: 24px; border-radius: 6px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.05); color: #8b949e; display: flex; align-items: center; justify-content: center; cursor: pointer;">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M12 5v14M5 12h14"/></svg>
                                </button>
                                
                                <div style="display: flex; background: rgba(0,0,0,0.2); border-radius: 6px; padding: 2px;">
                                    <button id="mode-fast" style="padding: 2px 8px; border-radius: 4px; font-size: 8px; font-weight: 800; border: none; cursor: pointer; transition: all 0.2s; text-transform: uppercase; ${state.geminiConfig.mode === 'fast' ? 'background: #4285F4; color: white;' : 'background: transparent; color: #484f58;'}">Fast</button>
                                    <button id="mode-planning" style="padding: 2px 8px; border-radius: 4px; font-size: 8px; font-weight: 800; border: none; cursor: pointer; transition: all 0.2s; text-transform: uppercase; ${state.geminiConfig.mode === 'planning' ? 'background: #4285F4; color: white;' : 'background: transparent; color: #484f58;'}">Planning</button>
                                </div>
                            </div>

                            <select id="gemini-model-select" style="background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.05); color: #4285F4; font-size: 9px; font-weight: 800; padding: 4px 10px; border-radius: 6px; outline: none; cursor: pointer; appearance: none; text-transform: uppercase;">
                                ${((window.state?.geminiConfig || state?.geminiConfig)?.models || []).map(m => `<option value="${m}" ${m === (window.state?.geminiConfig || state?.geminiConfig)?.activeModel ? 'selected' : ''}>${String(m).replace('gemini-', '').toUpperCase()}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const area = document.getElementById('gemini-messages-area');
        area.scrollTop = area.scrollHeight;

        const sendMessage = async () => {
            const input = document.getElementById('gemini-input');
            const text = input.value.trim();
            if (!text || state._geminiLoading) return;

            const newMessages = [...(state.geminiConfig.messages || []), { role: 'user', text }];
            setState({ 
                geminiConfig: { ...state.geminiConfig, messages: newMessages },
                _geminiLoading: true 
            });

            input.value = '';
            input.style.height = 'auto';

            try {
                const model = state.geminiConfig.activeModel;
                const oauthToken = state.geminiConfig.apiKey;
                const manualKey = state.geminiConfig.manualApiKey; // Aggiunto fallback
                
                const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent${manualKey ? `?key=${manualKey}` : ''}`;
                const headers = { 'Content-Type': 'application/json' };
                if (!manualKey && oauthToken) headers['Authorization'] = `Bearer ${oauthToken}`;

                const response = await fetch(url, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        contents: newMessages.map(m => ({
                            role: m.role === 'user' ? 'user' : 'model',
                            parts: [{ text: m.text }]
                        }))
                    })
                });

                const data = await response.json();
                
                if (data.error) {
                    if (data.error.status === "PERMISSION_DENIED" || data.error.message.includes("scopes") || data.error.message.includes("auth")) {
                        setState({ _geminiNeedsKey: true, _geminiLoading: false });
                        return;
                    }
                    throw new Error(data.error.message);
                }

                const aiText = data.candidates[0].content.parts[0].text;
                setState({ 
                    _geminiLoading: false,
                    geminiConfig: { 
                        ...state.geminiConfig, 
                        messages: [...newMessages, { role: 'model', text: aiText }] 
                    }
                });
            } catch (err) {
                console.error("[Gemini] API Error:", err);
                setState({ 
                    _geminiLoading: false,
                    geminiConfig: { 
                        ...state.geminiConfig, 
                        messages: [...newMessages, { role: 'model', text: "Errore: " + err.message }] 
                    }
                });
            }
        };

        if (state._geminiNeedsKey) {
            const saveBtn = document.getElementById('save-gemini-key-btn');
            const keyInput = document.getElementById('gemini-manual-key-input');
            if (saveBtn) {
                saveBtn.onclick = () => {
                    const key = keyInput.value.trim();
                    if (key) {
                        setState({ 
                            geminiConfig: { ...state.geminiConfig, manualApiKey: key },
                            _geminiNeedsKey: false 
                        });
                        alert("API Key salvata! Ora puoi riprovare a inviare il messaggio.");
                    }
                };
            }
        }

        const input = document.getElementById('gemini-input');
        input.addEventListener('input', () => {
            input.style.height = 'auto';
            input.style.height = input.scrollHeight + 'px';
        });

        input.onkeydown = (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        };

        document.getElementById('gemini-send-btn').onclick = sendMessage;

        // Altri eventi rimangono simili (logout, mode, etc.)
        document.getElementById('gemini-logout-btn').onclick = () => {
            setState({ geminiConfig: { ...state.geminiConfig, isAuthenticated: false, user: null, messages: [] } });
        };
        
        document.getElementById('mode-fast').onclick = () => {
            setState({ geminiConfig: { ...state.geminiConfig, mode: 'fast' } });
        };
        document.getElementById('mode-planning').onclick = () => {
            setState({ geminiConfig: { ...state.geminiConfig, mode: 'planning' } });
        };
        // Model selection
        document.getElementById('gemini-model-select').onchange = (e) => {
             setState({ geminiConfig: { ...state.geminiConfig, activeModel: e.target.value } });
        };
    };

    // Listener per il successo dell'autenticazione reale (da Main Process)
    if (window.electronAPI?.onGeminiAuthSuccess && !window._geminiAuthListenerSet) {
        window._geminiAuthListenerSet = true;
        window.electronAPI.onGeminiAuthSuccess((data) => {
            console.log("[Gemini] Auth Success! Profile received:", data.email);
            setState({ 
                _geminiAuthenticating: false,
                geminiConfig: { 
                    ...state.geminiConfig, 
                    isAuthenticated: true, 
                    apiKey: data.code, 
                    user: { 
                        name: data.name || "Google User", 
                        email: data.email || "authenticated@google.com",
                        picture: data.picture 
                    } 
                } 
            });
        });
    }

    subscribe((newState, oldState) => {
        const configChanged = newState.geminiConfig !== oldState?.geminiConfig;
        const loadingChanged = newState._geminiLoading !== oldState?._geminiLoading;
        const keyNeededChanged = newState._geminiNeedsKey !== oldState?._geminiNeedsKey;
        
        if (configChanged || loadingChanged || keyNeededChanged) {
            render();
            // Scroll automatico dopo ogni render della chat
            const area = document.getElementById('gemini-messages-area');
            if (area) area.scrollTop = area.scrollHeight;
        }
    });

    render();
};
