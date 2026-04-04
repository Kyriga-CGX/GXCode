import { state, setState, subscribe } from '../core/state.js';

export const initGemini = () => {
    const pane = document.getElementById('pane-ai-gemini');
    if (!pane) return;

    let autoItems = [];
    let activeIndex = 0;
    let isShowingAuto = false;

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
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; width: 100%; background-color: var(--bg-main); color: white; padding: 20px; text-align: center;">
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
        pane.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; width: 100%; padding: 40px; background-color: var(--bg-main); position: relative; overflow: hidden;">
                <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: radial-gradient(circle at 50% 50%, rgba(66, 133, 244, 0.05) 0%, transparent 70%); pointer-events: none;"></div>
                <div style="width: 80px; height: 80px; margin-bottom: 32px; filter: drop-shadow(0 0 20px rgba(66, 133, 244, 0.3));">
                     <svg viewBox="0 0 100 100" style="width: 100%; height: 100%;">
                        <defs><linearGradient id="gemini-auth-glow" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#4285F4" /><stop offset="50%" style="stop-color:#34A853" /><stop offset="100%" style="stop-color:#FBBC05" /></linearGradient></defs>
                        <path d="M50 5 Q57 43 95 50 Q57 57 50 95 Q43 57 5 50 Q43 43 50 5" fill="url(#gemini-auth-glow)" />
                    </svg>
                </div>
                <div style="position: absolute; top: 20px; right: 20px; z-index: 20;">
                    <button id="google-signin-btn" style="display: flex; align-items: center; justify-content: center; gap: 8px; background: white; color: #3c4043; border: none; padding: 8px 16px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.3s; box-shadow: 0 4px 12px rgba(0,0,0,0.2); font-family: 'Inter', sans-serif;">
                        <svg width="14" height="14" viewBox="0 0 18 18"><path d="M17.64 9.2c0-.63-.06-1.25-.16-1.84H9v3.49h4.84a4.14 4.14 0 0 1-1.8 2.71v2.26h2.91c1.71-1.58 2.69-3.9 2.69-6.62z" fill="#4285F4"/><path d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.8.54-1.83.86-3.05.86-2.34 0-4.32-1.58-5.03-3.71H.95v2.33C2.43 15.98 5.48 18 9 18z" fill="#34A853"/><path d="M3.97 10.71a4.69 4.69 0 0 1 0-3.42V4.96H.95a8.99 8.99 0 0 0 0 8.08l3.02-2.33z" fill="#FBBC05"/><path d="M9 3.58c1.32 0 2.5.45 3.44 1.35L15.1 2.3C13.47.8 11.42 0 9 0 5.48 0 2.43 2.02.95 4.96l3.02 2.33C4.68 5.16 6.66 3.58 9 3.58z" fill="#EA4335"/></svg> Sign in with Google
                    </button>
                </div>
                <div style="text-align: center; z-index: 10; max-width: 420px;">
                    <h2 style="color: white; font-size: 20px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 12px; font-family: 'Outfit', sans-serif;">GX AI (Cloud)</h2>
                    <p style="color: rgba(255,255,255,0.5); font-size: 11px; line-height: 1.6; margin-bottom: 16px; text-transform: uppercase;">Esegui l'accesso per sbloccare la potenza del cloud.</p>
                </div>
            </div>
        `;
        document.getElementById('google-signin-btn').onclick = async () => {
            setState({ _geminiAuthenticating: true });
            if (window.electronAPI?.geminiLogin) {
                const res = await window.electronAPI.geminiLogin();
                if (res && !res.success) setState({ _geminiAuthError: res.message });
            }
        };
    };

    const extractItems = (nodes) => {
        let folders = [];
        let files = [];
        const walk = (list) => {
            list.forEach(node => {
                if (node.type === 'directory') {
                    folders.push({ id: node.path, name: node.name, type: 'folder', desc: 'Folder' });
                    if (node.children) walk(node.children);
                } else {
                    files.push({ id: node.path, name: node.name, type: 'file', desc: 'File' });
                }
            });
        };
        walk(nodes);
        return { folders, files };
    };

    const getMentionCandidates = () => {
        const agents = (state.agents || []).map(a => ({ id: a.slug || a.id, name: a.name, type: 'agent', desc: 'Agent' }));
        const skills = (state.skills || []).map(s => ({ id: s.slug || s.id, name: s.name, type: 'skill', desc: 'Skill' }));
        const { folders, files } = extractItems(state.files || []);
        return [...agents, ...skills, ...folders, ...files];
    };

    const renderAutocomplete = (query = '') => {
        const auto = document.getElementById('gemini-autocomplete');
        if (!auto) return;

        const candidates = getMentionCandidates();
        autoItems = candidates.filter(c => c.name.toLowerCase().includes(query.toLowerCase())).slice(0, 50);

        if (autoItems.length === 0) {
            auto.classList.add('hidden');
            isShowingAuto = false;
            return;
        }

        auto.innerHTML = autoItems.map((item, idx) => `
            <div class="gx-ai-autocomplete-item ${idx === activeIndex ? 'active' : ''}" data-idx="${idx}">
                <div class="gx-ai-autocomplete-icon">${item.type === 'agent' ? '🤖' : item.type === 'skill' ? '⚡' : item.type === 'folder' ? '📁' : '📄'}</div>
                <div class="gx-ai-autocomplete-name">${item.name}</div>
                <div class="gx-ai-autocomplete-desc">${item.desc}</div>
            </div>
        `).join('');

        auto.style.left = '10px';
        auto.classList.remove('hidden');
        isShowingAuto = true;

        auto.querySelectorAll('.gx-ai-autocomplete-item').forEach(el => {
            el.onclick = (e) => {
                e.stopPropagation();
                activeIndex = parseInt(el.dataset.idx);
                insertMention();
            };
        });
    };

    const insertMention = () => {
        const input = document.getElementById('gemini-input');
        const item = autoItems[activeIndex];
        if (!input || !item) return;

        const val = input.value;
        const pos = input.selectionStart;
        const lastAt = val.lastIndexOf('@', pos - 1);
        
        const newValue = val.substring(0, lastAt) + '@' + item.name + ' ' + val.substring(pos);
        input.value = newValue;
        input.focus();
        
        const auto = document.getElementById('gemini-autocomplete');
        if (auto) auto.classList.add('hidden');
        isShowingAuto = false;
        activeIndex = 0;
    };

    const renderChatView = () => {
        const messages = state.geminiConfig.messages || [];
        pane.innerHTML = `
            <div style="display: flex; flex-direction: column; height: 100%; width: 100%; background-color: var(--bg-main); position: relative; overflow: hidden;" class="animate-fade-in">
                <div style="padding: 12px 20px; border-bottom: 1px solid var(--border-dim); display: flex; align-items: center; justify-content: space-between; background: var(--bg-side);">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <svg width="16" height="16" viewBox="0 0 100 100"><path d="M50 5 Q57 43 95 50 Q57 57 50 95 Q43 57 5 50 Q43 43 50 5" fill="#4285F4" /></svg>
                        <span style="color: #cad1d8; font-size: 11px; font-weight: 700; text-transform: uppercase;">GX AI Chat (Cloud)</span>
                    </div>
                    <button id="gemini-logout-btn" style="background: none; border: none; color: #f85149; font-size: 10px; cursor: pointer;">LOGOUT</button>
                </div>

                <div id="gemini-messages-area" style="flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; background: var(--bg-main); scroll-behavior: smooth;" class="custom-scrollbar">
                    ${messages.map(msg => `
                        <div class="ai-cloud-container ${msg.role === 'user' ? 'user' : 'bot'} animate-fade-in">
                            <div class="ai-cloud-label">${msg.role === 'user' ? 'USER' : 'GX AI'}</div>
                            <div class="ai-cloud-bubble">${msg.text}</div>
                        </div>
                    `).join('')}
                    ${state._geminiLoading ? `<div class="animate-pulse flex gap-1"><div class="w-1 h-1 bg-blue-500 rounded-full"></div><div class="w-1 h-1 bg-blue-500 rounded-full"></div></div>` : ''}
                </div>

                <div style="padding: 10px; position: relative;">
                    <!-- AUTOCOMPLETE MENU -->
                    <div id="gemini-autocomplete" class="gx-ai-autocomplete hidden"></div>

                    <div style="background: var(--bg-side); border: 1px solid var(--border-dim); border-radius: 14px; padding: 10px 14px; display: flex; flex-direction: column; gap: 8px;">
                        <div style="display: flex; gap: 10px; align-items: flex-end;">
                            <textarea id="gemini-input" placeholder="Chiedi a GX AI... (@ per citare)" style="flex: 1; background: transparent; border: none; outline: none; color: white; font-size: 12px; line-height: 1.4; resize: none; max-height: 80px;" rows="1"></textarea>
                            <button id="gemini-send-btn" style="width: 28px; height: 28px; border-radius: 50%; background: #4285F4; border: none; display: flex; align-items: center; justify-content: center; color: white; cursor: pointer;">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                            </button>
                        </div>
                        <div style="display: flex; align-items: center; justify-content: space-between; border-top: 1px solid var(--border-dim); padding-top: 8px;">
                            <div style="display: flex; gap: 8px;">
                                <button id="mode-fast" style="padding: 2px 8px; border-radius: 4px; font-size: 8px; font-weight: 800; border: none; cursor: pointer; ${state.geminiConfig.mode === 'fast' ? 'background: #4285F4; color: white;' : 'background: transparent; color: #484f58;'}">Fast</button>
                                <button id="mode-planning" style="padding: 2px 8px; border-radius: 4px; font-size: 8px; font-weight: 800; border: none; cursor: pointer; ${state.geminiConfig.mode === 'planning' ? 'background: #4285F4; color: white;' : 'background: transparent; color: #484f58;'}">Planning</button>
                            </div>
                            <select id="gemini-model-select" style="background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.05); color: #4285F4; font-size: 9px; padding: 4px; border-radius: 4px; outline: none;">
                                ${state.geminiConfig.models.map(m => `<option value="${m}" ${m === state.geminiConfig.activeModel ? 'selected' : ''}>${String(m).replace('gemini-', '').toUpperCase()}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                </div>
            </div>
        `;

        setupChatListeners();
        const area = document.getElementById('gemini-messages-area');
        if (area) area.scrollTop = area.scrollHeight;
    };

    const setupChatListeners = () => {
        const input = document.getElementById('gemini-input');
        const sendBtn = document.getElementById('gemini-send-btn');

        if (input) {
            input.oninput = () => {
                input.style.height = 'auto';
                input.style.height = input.scrollHeight + 'px';
                
                const val = input.value;
                const pos = input.selectionStart;
                const lastAt = val.lastIndexOf('@', pos - 1);
                
                if (lastAt !== -1 && !val.substring(lastAt, pos).includes(' ')) {
                    const query = val.substring(lastAt + 1, pos);
                    renderAutocomplete(query);
                } else {
                    const auto = document.getElementById('gemini-autocomplete');
                    if (auto) auto.classList.add('hidden');
                    isShowingAuto = false;
                }
            };

            input.onkeydown = (e) => {
                if (isShowingAuto) {
                    if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        activeIndex = (activeIndex + 1) % autoItems.length;
                        renderAutocomplete(input.value.substring(input.value.lastIndexOf('@') + 1));
                    } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        activeIndex = (activeIndex - 1 + autoItems.length) % autoItems.length;
                        renderAutocomplete(input.value.substring(input.value.lastIndexOf('@') + 1));
                    } else if (e.key === 'Enter' || e.key === 'Tab') {
                        e.preventDefault();
                        insertMention();
                    } else if (e.key === 'Escape') {
                        const auto = document.getElementById('gemini-autocomplete');
                        if (auto) auto.classList.add('hidden');
                        isShowingAuto = false;
                    }
                    return;
                }

                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                }
            };
        }

        if (sendBtn) sendBtn.onclick = sendMessage;
        document.getElementById('gemini-logout-btn').onclick = () => setState({ geminiConfig: { ...state.geminiConfig, isAuthenticated: false, messages: [] } });
        document.getElementById('mode-fast').onclick = () => setState({ geminiConfig: { ...state.geminiConfig, mode: 'fast' } });
        document.getElementById('mode-planning').onclick = () => setState({ geminiConfig: { ...state.geminiConfig, mode: 'planning' } });
        document.getElementById('gemini-model-select').onchange = (e) => setState({ geminiConfig: { ...state.geminiConfig, activeModel: e.target.value } });
    };

    const sendMessage = async () => {
        const input = document.getElementById('gemini-input');
        if (!input || state._geminiLoading) return;
        let text = input.value.trim();
        if (!text) return;

        const { activeModel, apiKey, manualApiKey, messages } = state.geminiConfig;

        // Build Context from Mentions
        let context = "";
        const candidates = getMentionCandidates();
        const mentions = candidates.filter(c => text.includes(`@${c.name}`));

        if (mentions.length > 0) {
            context += "--- SYSTEM CONTEXT (GXCODE MENTIONS) ---\n";
            for (const m of mentions) {
                if (m.type === 'file') {
                    try {
                        const content = await window.electronAPI.readFile(m.id);
                        context += `FILE [${m.name}]:\n${content}\n\n`;
                    } catch (e) { context += `ERR FILE [${m.name}]: Failed to read.\n`; }
                } else if (m.type === 'agent') {
                    const agent = state.agents.find(a => (a.slug || a.id) === m.id);
                    if (agent) context += `AGENT [${agent.name}]: ${agent.instructions}\n\n`;
                } else if (m.type === 'skill') {
                    const skill = state.skills.find(s => (s.slug || s.id) === m.id);
                    if (skill) context += `SKILL [${skill.name}]: ${skill.code}\n\n`;
                } else if (m.type === 'folder') {
                    const walk = (nodes, path) => {
                        let list = [];
                        const w = (n) => n.forEach(node => { if (node.path.startsWith(path)) { list.push(node.path); if (node.children) w(node.children); } });
                        w(state.files);
                        return list;
                    };
                    context += `FOLDER [${m.name}] CONTENT:\n${walk(state.files, m.id).join('\n')}\n\n`;
                }
            }
            context += "--- END CONTEXT ---\n\n";
        }

        const fullPrompt = context + text;
        const newMessages = [...messages, { role: 'user', text }];
        setState({ geminiConfig: { ...state.geminiConfig, messages: newMessages }, _geminiLoading: true });
        
        input.value = '';
        input.style.height = 'auto';

        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${activeModel}:generateContent?key=${manualApiKey || apiKey}`;
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [
                        ...messages.map(m => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.text }] })),
                        { role: 'user', parts: [{ text: fullPrompt }] }
                    ]
                })
            });

            const data = await response.json();
            if (data.error) throw new Error(data.error.message);

            const aiText = data.candidates[0].content.parts[0].text;
            setState({ 
                _geminiLoading: false,
                geminiConfig: { ...state.geminiConfig, messages: [...newMessages, { role: 'model', text: aiText }] } 
            });
        } catch (err) {
            console.error(err);
            setState({ _geminiLoading: false });
        }
    };

    subscribe((newState, oldState) => {
        if (newState.geminiConfig !== oldState?.geminiConfig || newState._geminiLoading !== oldState?._geminiLoading) {
            render();
        }
    });

    render();
};
