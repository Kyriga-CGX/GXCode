import { state, setState, subscribe } from '../core/state.js';

export const initOllama = () => {
    const pane = document.getElementById('pane-ollama');
    if (!pane) return;

    let isInitialized = false;
    let autoItems = [];
    let activeIndex = 0;
    let isShowingAuto = false;
    let isFirstRequest = true;
    let pendingImages = []; // Array di stringhe base64
    let currentAbortController = null;
    let requestQueue = []; // Queue of {text, images}
    let isHistoryOpen = false;

    const render = () => {
        const config = state.ollamaConfig;
        if (!config.endpoint || !config.isSetup) {
            renderUnconfiguredView();
            isInitialized = false;
        } else if (!isInitialized) {
            renderTerminalSkeleton();
            isInitialized = true;
        }
    };

    const renderUnconfiguredView = () => {
        pane.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; width: 100%; padding: 40px; background-color: var(--bg-main); text-align: center;">
                <div style="width: 60px; height: 60px; margin-bottom: 24px; opacity: 0.5;">
                     <svg viewBox="0 0 24 24" fill="none" stroke="#4b5563" stroke-width="2">
                        <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
                    </svg>
                </div>
                <h3 style="color: white; font-size: 14px; font-weight: 800; text-transform: uppercase; margin-bottom: 8px;">Modulo Non Configurato</h3>
                <p style="color: #4b5563; font-size: 11px; margin-bottom: 24px; max-width: 280px;">Configura l'endpoint Ollama nelle impostazioni globali dell'IDE per attivare GX AI.</p>
                <button onclick="window.switchSettingsTab('ai'); window.setState({isSettingsOpen: true})" 
                        style="background: #10b981; color: white; border: none; padding: 10px 20px; border-radius: 6px; font-weight: bold; cursor: pointer; text-transform: uppercase; font-size: 10px;">
                    Apri Impostazioni Globali
                </button>
            </div>
        `;
    };

    const renderTerminalSkeleton = () => {
        pane.innerHTML = `
            <div id="ollama-terminal-container" style="display: flex; flex-direction: column; height: 100%; width: 100%; background-color: #06080a; position: relative; font-family: 'JetBrains Mono', 'Cascadia Code', monospace; font-size: 12px; user-select: text !important;">
                <div style="padding: 8px 16px; border-bottom: 1px solid var(--border-dim); display: flex; align-items: center; justify-content: space-between; background: #0a0d12;">
                    <div style="display: flex; flex-direction: column; gap: 2px;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="color: #10b981; font-weight: 900; letter-spacing: 1px; font-size: 11px;">GX AI_V1</span>
                            <span id="ollama-context-status" style="color: #3b82f6; font-size: 9px; text-transform: uppercase;">[IDLE]</span>
                        </div>
                        <div id="ollama-context-details" style="font-size: 8px; color: #4b5563; text-transform: uppercase; transition: all 0.3s;">CIRCUITI_PRONTI</div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <button id="ollama-new-btn" class="ai-header-btn success" title="Nuova Sessione">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        </button>
                        <button id="ollama-history-btn" class="ai-header-btn info" title="Cronologia Sessioni">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        </button>
                        <button id="ollama-reset-btn" class="ai-header-btn danger" title="Svuota Sessione Corrente (Mantieni Cronologia)">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                        </button>
                    </div>
                </div>
                <div id="ollama-history-overlay" class="ai-history-overlay hidden"></div>
                <div id="ollama-lines-area" style="flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; background: #06080a; user-select: text !important; scroll-behavior: smooth;" class="custom-scrollbar"></div>
                
                <div style="padding: 10px 16px; background: #0a0d12; border-top: 1px solid var(--border-dim); display: flex; flex-direction: column; gap: 8px; position: relative;">
                    <!-- IMAGE PREVIEW TRAY -->
                    <div id="ollama-image-tray" style="display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px;" class="hidden"></div>

                    <!-- AUTOCOMPLETE POPUP -->
                    <div id="ollama-autocomplete" class="gx-ai-autocomplete hidden"></div>

                    <div style="display: flex; gap: 12px; align-items: flex-start;">
                        <span style="color: #10b981; font-weight: 900; padding: 6px 0;">&gt;</span>
                        <textarea id="ollama-input" placeholder="Comando GX AI (Local)..." autocomplete="off"
                                  style="flex: 1; background: transparent; border: none; outline: none; color: #fff; font-family: inherit; font-size: 13px; line-height: 1.5; resize: none; padding: 6px 0;" rows="1"></textarea>
                        
                        <div style="display: flex; gap: 6px; align-items: center; padding: 2px 0;">
                            <!-- ATTACHMENT BUTTON -->
                            <button id="ollama-attach-btn" title="Allega Immagine" style="background: rgba(255,255,255,0.05); border: 1px solid #333; color: #9ca3af; padding: 5px; border-radius: 4px; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.color='#fff';this.style.backgroundColor='rgba(255,255,255,0.1)'" onmouseout="this.style.color='#9ca3af';this.style.backgroundColor='rgba(255,255,255,0.05)'">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.51a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                            </button>
                            <input type="file" id="ollama-file-input" accept="image/*" style="display: none;" multiple>
                            
                            <select id="ollama-model-select" style="background: #000; border: 1px solid #333; color: #10b981; font-size: 10px; padding: 4px 8px; border-radius: 4px; outline: none; cursor: pointer; text-transform: uppercase;">
                                ${state.ollamaConfig.models.map(m => `<option value="${m}" ${m === state.ollamaConfig.activeModel ? 'selected' : ''}>${m.toUpperCase()}</option>`).join('')}
                            </select>
                            <div style="position: relative;">
                                <button id="ollama-send-btn" style="background: #10b981; color: white; border: 1px solid rgba(16, 185, 129, 0.3); padding: 4px 12px; border-radius: 4px; font-weight: 800; cursor: pointer; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">INVIO</button>
                                <div id="ollama-queue-badge" class="queue-badge hidden">0</div>
                            </div>
                            <button id="ollama-stop-btn" class="btn-stop-pulse" style="color: white; border: none; padding: 4px 12px; border-radius: 4px; font-weight: 800; cursor: pointer; font-size: 11px; text-transform: uppercase;">STOP</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        setupTerminalListeners();
        syncCurrentMessages();
        updateContextDisplay();
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
        const auto = document.getElementById('ollama-autocomplete');
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
                <div class="gx-ai-autocomplete-icon">
                    ${item.type === 'agent' ? '🤖' : item.type === 'skill' ? '⚡' : item.type === 'folder' ? '📁' : '📄'}
                </div>
                <div class="gx-ai-autocomplete-name">${item.name}</div>
                <div class="gx-ai-autocomplete-desc">${item.desc}</div>
            </div>
        `).join('');

        auto.classList.remove('hidden');
        isShowingAuto = true;

        auto.querySelectorAll('.gx-ai-autocomplete-item').forEach(el => {
            el.onclick = () => {
                activeIndex = parseInt(el.dataset.idx);
                insertMention();
            };
        });
    };

    const insertMention = () => {
        const input = document.getElementById('ollama-input');
        const item = autoItems[activeIndex];
        if (!input || !item) return;

        const val = input.value;
        const pos = input.selectionStart;
        const lastAt = val.lastIndexOf('@', pos - 1);
        
        const newValue = val.substring(0, lastAt) + '@' + item.name + ' ' + val.substring(pos);
        input.value = newValue;
        input.focus();
        
        const auto = document.getElementById('ollama-autocomplete');
        auto.classList.add('hidden');
        isShowingAuto = false;
        activeIndex = 0;
    };

    const updateContextDisplay = () => {
        const status = document.getElementById('ollama-context-status');
        const details = document.getElementById('ollama-context-details');
        if (!status || !details) return;

        const activeFile = state.activeFileId ? state.activeFileId.split(/[\\/]/).pop() : 'NONE';
        const skillCount = state.skills?.length || 0;
        const agentCount = state.agents?.length || 0;

        status.innerText = `[AI_IDLE]`;
        details.innerText = `FILE: ${activeFile} | SKILLS: ${skillCount} | AGENTS: ${agentCount}`;
    };

    const syncCurrentMessages = () => {
        const area = document.getElementById('ollama-lines-area');
        if (!area) return;
        area.innerHTML = '';
        state.ollamaConfig.messages.forEach(msg => appendMessageToDOM(msg));
        
        scrollOllamaToBottom();
    };

    window.scrollOllamaToBottom = () => {
        const area = document.getElementById('ollama-lines-area');
        if (!area) return;
        requestAnimationFrame(() => {
            area.scrollTop = area.scrollHeight;
            // Secondo tentativo per messaggi lunghi o immagini
            setTimeout(() => { area.scrollTop = area.scrollHeight; }, 100);
        });
    };

    const appendMessageToDOM = (msg) => {
        const area = document.getElementById('ollama-lines-area');
        if (!area) return null;
        
        const container = document.createElement('div');
        container.className = `ai-cloud-container ${msg.role === 'user' ? 'user' : 'bot'} animate-fade-in`;
        
        const label = document.createElement('div');
        label.className = 'ai-cloud-label';
        label.innerText = msg.role === 'user' ? 'USER' : 'GX AI';
        
        const bubble = document.createElement('div');
        bubble.className = 'ai-cloud-bubble';
        bubble.innerText = msg.text;
        
        container.appendChild(label);
        container.appendChild(bubble);
        area.appendChild(container);

        // Auto-scroll
        requestAnimationFrame(() => {
            area.scrollTop = area.scrollHeight;
        });
        
        return { label, content: bubble, line: container };
    };

    const renderImageTray = () => {
        const tray = document.getElementById('ollama-image-tray');
        if (!tray) return;

        if (pendingImages.length === 0) {
            tray.classList.add('hidden');
            return;
        }

        tray.innerHTML = pendingImages.map((img, idx) => `
            <div style="position: relative; flex-shrink: 0;">
                <img src="${img}" style="width: 48px; height: 48px; border-radius: 4px; border: 1px solid #444; object-fit: cover;">
                <div class="ollama-remove-img" data-idx="${idx}" style="position: absolute; top: -4px; right: -4px; background: #ef4444; color: white; width: 14px; height: 14px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 8px; cursor: pointer; border: 1px solid #000;">✕</div>
            </div>
        `).join('');

        tray.classList.remove('hidden');
        tray.querySelectorAll('.ollama-remove-img').forEach(el => {
            el.onclick = () => {
                const idx = parseInt(el.dataset.idx);
                pendingImages.splice(idx, 1);
                renderImageTray();
            };
        });
    };

    const handleImageFile = (file) => {
        if (!file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            pendingImages.push(e.target.result);
            renderImageTray();
        };
        reader.readAsDataURL(file);
    };

    const parseAndExecuteAiCommands = async (text) => {
        const fileRegex = /<create_file\s+[^>]*path=["'](.*?)["'][^>]*>(.*?)<\/create_file>/gs;
        const folderRegex = /<create_folder\s+[^>]*path=["'](.*?)["'][^>]*\s*\/>/g;

        // Determinazione Root Path: usiamo workspaceData.path (il vero root del progetto)
        const rootPath = state.workspaceData?.path || (state.files && state.files[0] ? state.files[0].path : null);
        
        console.log(`[AI-TOOL] Root detected: ${rootPath}`);
        if (!rootPath) {
            console.warn("[AI-TOOL] Nessun workspace rilevato. Powers disattivati.");
            return;
        }

        let match;
        // Creazione File
        while ((match = fileRegex.exec(text)) !== null) {
            const relPath = match[1];
            const content = match[2].trim();
            const parentDir = rootPath;
            const name = relPath;
            
            // --- GX-SECURITY: BLOCKLIST --- 
            // Impedisce all'AI di sovrascrivere o creare "falsi" moduli interni nel progetto
            if (relPath.startsWith('agents/') || relPath.startsWith('skills/')) {
                console.warn(`[AI-SECURITY] Bloccato tentativo di scrittura in area protetta: ${relPath}`);
                continue;
            }

            console.log(`[AI-TOOL] Elaborazione file: ${name}`);
            const res = await window.electronAPI.fsCreateFile(parentDir, name);
            
            // Se il file esiste già (errore 309), proviamo a scriverci sopra comunque
            const fullPath = res.path || (rootPath + (rootPath.includes('/') ? '/' : '\\') + name).replace(/\\/g, '/');
            
            try {
                await window.electronAPI.fsWriteFile(fullPath, content);
                window.gxToast(`Progetto aggiornato: ${name}`, 'success');
            } catch(e) {
                console.error(`[AI-TOOL] Errore scrittura finale: ${e}`);
            }
        }

        // Creazione Cartelle
        while ((match = folderRegex.exec(text)) !== null) {
            const relPath = match[1];
            console.log(`[AI-TOOL] Richiesta creazione cartella: ${relPath}`);
            const res = await window.electronAPI.fsCreateFolder(rootPath, relPath);
            if (!res.error) {
                console.log(`[AI-TOOL] Cartella creata: ${relPath}`);
                if (window.pingExplorerFile) window.pingExplorerFile(relPath);
                window.gxToast(`AI ha creato la cartella: ${relPath}`, 'success');
            } else {
                console.error(`[AI-TOOL] Errore cartella: ${res.error}`);
            }
        }

        if (window.refreshWorkspace) await window.refreshWorkspace();

        fileRegex.lastIndex = 0;
        let lastCreatedFile = null;
        while ((match = fileRegex.exec(text)) !== null) {
            const path = match[1];
            if (window.pingExplorerFile) window.pingExplorerFile(path);
            lastCreatedFile = path;
        }
        
        if (lastCreatedFile && window.openFileInIDE) {
            setTimeout(() => {
                window.openFileInIDE(lastCreatedFile);
            }, 500);
        }
    };

    const setupTerminalListeners = () => {
        const input = document.getElementById('ollama-input');
        const sendBtn = document.getElementById('ollama-send-btn');
        const resetBtn = document.getElementById('ollama-reset-btn');
        const modelSelect = document.getElementById('ollama-model-select');
        const attachBtn = document.getElementById('ollama-attach-btn');
        const fileInput = document.getElementById('ollama-file-input');

        if (attachBtn && fileInput) {
            attachBtn.onclick = () => fileInput.click();
            fileInput.onchange = (e) => {
                Array.from(e.target.files).forEach(handleImageFile);
                fileInput.value = '';
            };
        }

        if (input) {
            input.focus();
            
            input.onpaste = (e) => {
                const items = (e.clipboardData || e.originalEvent.clipboardData).items;
                for (const item of items) {
                    if (item.type.indexOf('image') !== -1) {
                        const file = item.getAsFile();
                        handleImageFile(file);
                    }
                }
            };

            input.oninput = (e) => {
                const val = input.value;
                const pos = input.selectionStart;
                const lastAt = val.lastIndexOf('@', pos - 1);
                
                if (lastAt !== -1 && !val.substring(lastAt, pos).includes(' ')) {
                    const query = val.substring(lastAt + 1, pos);
                    renderAutocomplete(query);
                } else {
                    const auto = document.getElementById('ollama-autocomplete');
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
                        const auto = document.getElementById('ollama-autocomplete');
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
        if (document.getElementById('ollama-stop-btn')) {
            document.getElementById('ollama-stop-btn').onclick = stopGeneration;
        }
        
        const newBtn = document.getElementById('ollama-new-btn');
        if (newBtn) newBtn.onclick = createNewSession;

        const historyBtn = document.getElementById('ollama-history-btn');
        if (historyBtn) historyBtn.onclick = toggleHistory;

        if (resetBtn) {
            resetBtn.onclick = async () => {
                const confirmed = window.gxConfirm ? await window.gxConfirm("Sei sicuro di voler pulire la sessione corrente? Questa azione NON cancellerà la cronologia.") : confirm("CLEAR?");
                if (confirmed) {
                    stopGeneration();
                    setState({ ollamaConfig: { ...state.ollamaConfig, messages: [] } });
                }
            };
        }

        if (modelSelect) modelSelect.onchange = (e) => setState({ ollamaConfig: { ...state.ollamaConfig, activeModel: e.target.value } });
    };

    const createNewSession = () => {
        saveCurrentSession();
        setState({ 
            ollamaConfig: { 
                ...state.ollamaConfig, 
                messages: [], 
                activeSessionId: Date.now().toString() 
            } 
        });
        isFirstRequest = true;
    };

    const saveCurrentSession = () => {
        const config = state.ollamaConfig;
        if (config.messages.length === 0) return;
        
        const existingIdx = config.sessions.findIndex(s => s.id === config.activeSessionId);
        const sessionData = {
            id: config.activeSessionId || Date.now().toString(),
            name: config.messages[0].text.substring(0, 30) + (config.messages[0].text.length > 30 ? '...' : ''),
            messages: [...config.messages],
            timestamp: Date.now()
        };
        
        let newSessions = [...config.sessions];
        if (existingIdx >= 0) newSessions[existingIdx] = sessionData;
        else newSessions.unshift(sessionData);
        
        setState({ ollamaConfig: { ...config, sessions: newSessions, activeSessionId: sessionData.id } });
    };

    const toggleHistory = () => {
        isHistoryOpen = !isHistoryOpen;
        renderHistoryView();
    };

    const renderHistoryView = () => {
        const overlay = document.getElementById('ollama-history-overlay');
        if (!overlay) return;
        if (!isHistoryOpen) { overlay.classList.add('hidden'); return; }

        overlay.classList.remove('hidden');
        const sessions = state.ollamaConfig.sessions;
        overlay.innerHTML = `
            <div class="ai-history-header">Cronologia Sessioni</div>
            <div class="ai-history-list">
                ${sessions.length === 0 ? '<div style="padding:20px; color:#4b5563; font-size:10px; text-align:center;">Nessuna sessione salvata</div>' : ''}
                ${sessions.map(s => `
                    <div class="ai-history-item ${s.id === state.ollamaConfig.activeSessionId ? 'active' : ''}">
                        <div class="ai-history-item-info" onclick="window.switchAiSession('${s.id}')">
                            <span class="ai-history-item-name">${s.name}</span>
                            <span class="ai-history-item-date">${new Date(s.timestamp).toLocaleString()}</span>
                        </div>
                        <button class="ai-history-delete-btn" onclick="window.deleteAiSession('${s.id}')" title="Elimina Sessione">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 6h18"/><path d="M19 6V20a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v6"/></svg>
                        </button>
                    </div>
                `).join('')}
            </div>
        `;
    };

    window.deleteAiSession = async (id) => {
        const confirmed = window.gxConfirm ? await window.gxConfirm("Vuoi eliminare definitivamente questa sessione dalla cronologia?") : confirm("ELIMINA?");
        if (confirmed) {
            const sessions = state.ollamaConfig.sessions.filter(s => s.id !== id);
            // Se stiamo cancellando la sessione attiva, reinizializziamo
            if (id === state.ollamaConfig.activeSessionId) {
                setState({ 
                    ollamaConfig: { 
                        ...state.ollamaConfig, 
                        sessions, 
                        messages: [], 
                        activeSessionId: Date.now().toString() 
                    } 
                });
                isInitialized = false; render();
            } else {
                setState({ ollamaConfig: { ...state.ollamaConfig, sessions } });
                renderHistoryView();
            }
        }
    };

    window.switchAiSession = (id) => {
        saveCurrentSession();
        const session = state.ollamaConfig.sessions.find(s => s.id === id);
        if (session) {
            setState({ 
                ollamaConfig: { 
                    ...state.ollamaConfig, 
                    messages: session.messages, 
                    activeSessionId: id 
                } 
            });
            isFirstRequest = false;
        }
        isHistoryOpen = false;
        renderHistoryView();
    };

    const triggerGlowOnMention = (text, glowedItems) => {
        const items = [...(state.skills || []), ...(state.agents || [])];
        const normalizedText = text.toLowerCase();
        
        items.forEach(item => {
            if (glowedItems.has(item.id)) return;
            
            // Cerca il nome con o senza @, gestendo confini di parola e punteggiatura
            const name = item.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // Escape regex chars
            const regex = new RegExp(`(?:@|\\b)${name}\\b`, 'gi');
            
            if (regex.test(text)) {
                glowedItems.add(item.id);
                const el = document.querySelector(`[data-id="${item.slug || item.id}"]`);
                if (el) {
                    el.classList.add('premium-glow-active');
                    // Scroll into view if not visible? Or just glow.
                    setTimeout(() => el.classList.remove('premium-glow-active'), 5000);
                }
            }
        });
    };

    const stopGeneration = () => {
        if (currentAbortController) {
            currentAbortController.abort();
            currentAbortController = null;
            console.log("[AI] Generation manually stopped.");
            appendMessageToDOM({ role: 'assistant', text: '--- GENERAZIONE INTERROTTA DALL\'UTENTE ---' });
            setState({ _ollamaStreaming: false });
            updateContextDisplay();
        }
    };

    const sendMessage = async (queuedText = null) => {
        const input = document.getElementById('ollama-input');
        if (!input) return;

        // Gestione Coda: se stiamo già streamando, mettiamo in coda
        if (state._ollamaStreaming && !queuedText) {
            requestQueue.push({ text: input.value.trim(), images: [...pendingImages] });
            input.value = '';
            pendingImages = [];
            renderImageTray();
            updateQueueUI();
            return;
        }

        const text = queuedText || input.value.trim();
        if (!text) return;

        const { endpoint, activeModel, messages, apiKey } = state.ollamaConfig;
        
        const status = document.getElementById('ollama-context-status');
        const details = document.getElementById('ollama-context-details');
        
        if (isFirstRequest && status && details) {
            status.innerText = `[WARMING_UP_VRAM]`;
            status.style.color = '#f59e0b';
            details.innerText = `Attendi... Sto caricando il modello nei circuiti neurali (può richiedere fino a 1 minuto).`;
        } else if (status) {
            status.innerText = `[AI_THINKING]`;
            status.style.color = '#3b82f6';
        }

        let context = "--- SYSTEM CONTEXT (GXCODE) ---\n";
        if (state.activeFileId && window.editor) context += `ACTIVE_FILE: ${state.activeFileId}\nCONTENT:\n${window.editor.getValue()}\n\n`;
        
        const mentors = getMentionCandidates();
        const mentions = mentors.filter(c => text.includes(`@${c.name}`));

        if (mentions.length > 0) {
            context += "--- SPECIFIC MENTIONS ---\n";
            for (const m of mentions) {
                if (m.type === 'agent') {
                    const agent = state.agents.find(a => (a.slug || a.id) === m.id);
                    if (agent) context += `AGENT [${agent.name}]: ${agent.description}\nINST: ${agent.instructions}\n`;
                } else if (m.type === 'skill') {
                    const skill = state.skills.find(s => (s.slug || s.id) === m.id);
                    if (skill) context += `SKILL [${skill.name}]: ${skill.description}\nCODE:\n${skill.code}\n`;
                } else if (m.type === 'folder') {
                    const walkRecursive = (nodes, path) => {
                        let list = [];
                        const walk = (n) => { n.forEach(node => { if (node.path.startsWith(path)) { list.push(node.path); if (node.children) walk(node.children); } }); };
                        walk(state.files);
                        return list;
                    };
                    context += `FOLDER [${m.name}]: ${walkRecursive(state.files, m.id).join('\n')}\n`;
                } else if (m.type === 'file') {
                    try {
                        const content = await window.electronAPI.readFile(m.id);
                        context += `FILE [${m.name}]:\n${content}\n`;
                    } catch (e) { context += `ERR FILE [${m.name}]: Failed to read.\n`; }
                }
            }
        }

        context += "--- END CONTEXT ---\n\n";

        // AGGIUNTA AUTOMATICA DI TUTTI GLI AGENTI E SKILL (Visibilità Globale)
        const allAgents = (state.agents || []).map(a => `- AGENTE: ${a.name}\n  DESC: ${a.description || 'Nessuna'}\n  INST: ${a.instructions || 'Standard'}`).join('\n');
        const allSkills = (state.skills || []).map(s => `- SKILL: ${s.name}\n  DESC: ${s.description || 'Nessuna'}`).join('\n');
        
        let globalKnowledge = "--- [READ-ONLY] MEMORIA MODULI CONFIGURATI ---\n";
        globalKnowledge += "Questi componenti sono GIA' INTEGRATI nell'IDE Database. NON cercare di crearli come file.\n";
        globalKnowledge += "Puoi usare queste informazioni per descriverli all'utente o suggerirne l'uso tramite @Name.\n";
        globalKnowledge += allAgents + "\n" + allSkills + "\n\n";
        
        context = globalKnowledge + context;

        const toolInstructions = `
POWER_MODE: ACTIVE
Puoi agire sul progetto usando questi tag XML:
- Per CREARE o MODIFICARE un file: <create_file path="relative/path/file.est">NUOVO_CONTENUTO</create_file>
- Per creare una cartella (anche annidata): <create_folder path="relative/folder/path" />
Usa percorsi RELATIVI rispetto alla root del workspace corrente.
Sii preciso. Il tag <create_file> SOVRASCRIVE completamente il file se esiste già.
`;

        const apiMessages = [
            { 
                role: 'system', 
                content: `Sei GX AI, il cuore neurale di GXCode. 

PROTOCOLLO OPERATIVO:
1. TESTO OBBLIGATORIO: Ogni risposta DEVE contenere testo discorsivo iniziale. Mai rispondere solo con i tag XML.
2. BLOCCO MODULI SISTEMA: NON usare <create_file> per agire su Agenti o Skill elencati (sono componenti 'ROM' dell'IDE). 
3. STILE: Terminale, professionale, tecnico.

${toolInstructions}` 
            },
            ...messages.map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text })),
            { 
                role: 'user', 
                content: `${context}USER: ${text}`,
                images: pendingImages.map(img => img.split(',')[1])
            }
        ];

        appendMessageToDOM({ role: 'user', text });
        
        pendingImages = [];
        renderImageTray();

        const area = document.getElementById('ollama-lines-area');
        area.scrollTop = area.scrollHeight;
        input.value = '';
        input.style.height = 'auto';

        const glowedInThisSession = new Set();
        currentAbortController = new AbortController();

        try {
            const apiHeaders = { 'Content-Type': 'application/json' };
            if (apiKey) apiHeaders['Authorization'] = `Bearer ${apiKey}`;
            
            const response = await fetch(`${endpoint.replace(/\/$/, '')}/api/chat`, {
                method: 'POST',
                headers: apiHeaders,
                body: JSON.stringify({ model: activeModel, messages: apiMessages, stream: true }),
                signal: currentAbortController.signal
            });

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            const messageNodes = appendMessageToDOM({ role: 'assistant', text: '' });
            const aiNode = messageNodes.content;
            const lineNode = messageNodes.line;
            
            setState({ _ollamaStreaming: true });
            
            if (status) {
                status.classList.add('neural-flux-active');
                details.innerText = "SINTESI NEURALE IN CORSO...";
            }

            let fullText = "";
            let displayedText = "";
            let activeCards = new Map();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');
                for (const line of lines) {
                    if (!line.trim()) continue;
                    try {
                        const json = JSON.parse(line);
                        if (json.message?.content) {
                            fullText += json.message.content;
                                           // --- GX-VISION: LIVE XML STRIPPING & CARD RENDERING ---
                            displayedText = fullText
                                .replace(/<create_file\s+[^>]*path=["'](.*?)["'][^>]*>(.*?)<\/create_file>/gs, (m, path) => {
                                    if (!activeCards.has(path)) {
                                        const card = document.createElement('div');
                                        card.className = 'ai-action-card animate-in slide-in-from-left duration-300';
                                        card.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg> <span>Generating: <b>${path}</b>...</span>`;
                                        lineNode.appendChild(card);
                                        activeCards.set(path, card);
                                    }
                                    return '';
                                })
                                .replace(/<create_folder\s+[^>]*path=["'](.*?)["'].*?\/>/gs, (m, path) => {
                                    if (!activeCards.has('dir:'+path)) {
                                        const card = document.createElement('div');
                                        card.className = 'ai-action-card animate-in slide-in-from-left duration-300';
                                        card.style.borderColor = '#3b82f6'; card.style.color = '#3b82f6';
                                        card.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg> <span>Creating Folder: <b>${path}</b></span>`;
                                        lineNode.appendChild(card);
                                        activeCards.set('dir:'+path, card);
                                    }
                                    return '';
                                });

                            // HIDE UNCLOSED TAGS (VERY IMPORTANT)
                            // This regex hides everything from the start of an unclosed <create_file or <create_folder until the end of string
                            displayedText = displayedText.replace(/<(create_file|create_folder)\s+[^>]*(\s.*)?$/s, "");
                            displayedText = displayedText.replace(/<(create_file|create_folder)\s+[^>]*>.*$/s, "");

                            if (displayedText.trim() === "" && activeCards.size > 0) {
                                aiNode.innerText = "[GX-FS-OPERATIONS]: Sincronizzazione file in corso...";
                            } else {
                                aiNode.innerText = displayedText.trim();
                            }
                            
                            // --- GX-VISION: LIVE EDITOR STREAMING (Multi-File Robust) ---
                            const createRegex = /<create_file\s+[^>]*path=["'](.*?)["'][^>]*>(.*?)(?:<\/create_file>|$)/gs;
                            let match;
                            while ((match = createRegex.exec(fullText)) !== null) {
                                let path = match[1];
                                let currentContent = match[2];
                                
                                // SICUREZZA: Se il contenuto catturato contiene l'inizio di un ALTRO tag, lo tagliamo.
                                // In fase di streaming, il regex non-greedy può "estendersi" troppo.
                                if (currentContent.includes('<create_file')) currentContent = currentContent.split('<create_file')[0];
                                if (currentContent.includes('<create_folder')) currentContent = currentContent.split('<create_folder')[0];

                                if (!activeCards.has('streaming:' + path)) {
                                    activeCards.set('streaming:' + path, true);
                                    const root = state.workspaceData?.path || "";
                                    const fullPath = (root + (root.includes('/') ? '/' : '\\') + path).replace(/\\/g, '/');
                                    
                                    try {
                                        // Proviamo a creare (ignora se esiste)
                                        const res = await window.electronAPI.fsCreateFile(root, path);
                                        if (window.openFileInIDE) {
                                            const fullPath = res.path || (root + (root.includes('/') ? '/' : '\\') + path).replace(/\\/g, '/');
                                            await window.openFileInIDE(fullPath);
                                            // Sincronizzazione: diamo a Monaco il tempo di caricare il modello
                                            await new Promise(r => setTimeout(r, 200));
                                        }
                                    } catch(e) { /* Ignorato: procediamo con l'iniezione live */ }
                                }

                                // Robust Model search & Cache (Aggressive Linking with Throttling)
                                if (window.monaco && window.monaco.editor.getModels) {
                                    const modelKey = 'model:' + path;
                                    let model = activeCards.get(modelKey);
                                    
                                    if (!model) {
                                        const now = Date.now();
                                        const lastRetry = activeCards.get('retry:' + path) || 0;
                                        
                                        // Tentiamo la ricerca solo una volta ogni 1000ms per file se non trovato
                                        if (now - lastRetry > 1000) {
                                            activeCards.set('retry:' + path, now);
                                            const models = window.monaco.editor.getModels();
                                            const normalizedSearchPath = path.replace(/\\/g, '/').toLowerCase();
                                            
                                            model = models.find(m => {
                                                const p = (m.uri.fsPath || m.uri.path || m.uri._formatted || "").replace(/\\/g, '/').toLowerCase();
                                                return p.endsWith(normalizedSearchPath);
                                            });

                                            if (model) {
                                                activeCards.set(modelKey, model);
                                                console.log(`[AI-VISION] Linked model: ${path}`);
                                            } else if (window.openFileInIDE) {
                                                // Forza l'apertura ma senza spam
                                                const root = state.workspaceData?.path || "";
                                                const fullPath = (root + (root.includes('/') ? '/' : '\\') + path).replace(/\\/g, '/');
                                                window.openFileInIDE(fullPath);
                                            }
                                        }
                                    }

                                    if (model && currentContent.trim().length > 0) {
                                        // Update only if changed to avoid unnecessary event noise
                                        if (model.getValue() !== currentContent) {
                                            model.setValue(currentContent);
                                        }
                                    }
                                }
                            }
                        }
                             
                        area.scrollTop = area.scrollHeight;
                            triggerGlowOnMention(fullText, glowedInThisSession);
                            
                            if (isFirstRequest) {
                                isFirstRequest = false;
                                if (status) {
                                    status.innerText = `[AI_STREAMING]`;
                                    status.style.color = '#10b981';
                                    details.innerText = `MODULO_AI_CONNESSO_E_ATTIVO`;
                                }
                            }
                        } catch (e) { }
                    }
                }
            
            activeCards.forEach((card, key) => {
                if (card instanceof HTMLElement) {
                    card.style.opacity = '0.7';
                    const span = card.querySelector('span');
                    if (span) {
                        span.innerText = span.innerText.replace('Generating:', 'Generated:').replace('Creating Folder:', 'Folder Created:');
                    }
                }
            });

            if (status) {
                status.classList.remove('neural-flux-active');
            }

            await parseAndExecuteAiCommands(fullText);

            setState({ 
                _ollamaStreaming: false, 
                ollamaConfig: { ...state.ollamaConfig, messages: [...messages, { role: 'user', text }, { role: 'assistant', text: fullText }] } 
            });
            currentAbortController = null;
            updateContextDisplay(); // Reset to idle
            
            // Processiamo la coda se presente
            if (requestQueue.length > 0) {
                const next = requestQueue.shift();
                pendingImages = next.images;
                updateQueueUI();
                setTimeout(() => sendMessage(next.text), 500); // Piccolo delay per stabilità
            }
        } catch (err) {
            if (err.name === 'AbortError') {
                console.log("[AI] Request aborted as expected.");
            } else {
                console.error(err);
                setState({ _ollamaStreaming: false });
                if (status) {
                    status.innerText = `[OFFLINE]`;
                    status.style.color = '#ef4444';
                }
            }
            currentAbortController = null;
            
            // Svuotiamo la coda in caso di errore grave? No, lasciamola decidere all'utente o fermiamola.
            requestQueue = [];
            updateQueueUI();
        }
    };

    const updateQueueUI = () => {
        const badge = document.getElementById('ollama-queue-badge');
        if (!badge) return;
        if (requestQueue.length > 0) {
            badge.innerText = requestQueue.length;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    };

    const fetchModels = async (endpoint, apiKey = "") => {
        try {
            const headers = { 'Content-Type': 'application/json' };
            if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
            
            const resp = await fetch(`${endpoint.replace(/\/$/, '')}/api/tags`, { headers });
            if (resp.ok) {
                const data = await resp.json();
                const list = (data.models || []).map(m => m.name);
                if (list.length) {
                    setState({ ollamaConfig: { ...state.ollamaConfig, models: list, activeModel: state.ollamaConfig.activeModel || list[0] } });
                    return true;
                }
            }
        } catch (e) { }
        return false;
    };

    subscribe((newState, oldState) => {
        // PREVENZIONE FLICKER: Se la visibilità non è cambiata e siamo già inizializzati, non toccare il DOM strutturale
        const needsSkeleton = !isInitialized || 
                              newState.ollamaConfig.isSetup !== oldState?.ollamaConfig?.isSetup || 
                              newState.ollamaConfig.activeSessionId !== oldState?.ollamaConfig?.activeSessionId;

        if (needsSkeleton) {
            // Se isSetup sta cambiando o id sessione cambia, resettiamo isInitialized per forzare render()
            if (newState.ollamaConfig.isSetup !== oldState?.ollamaConfig?.isSetup || 
                newState.ollamaConfig.activeSessionId !== oldState?.ollamaConfig?.activeSessionId) {
                isInitialized = false;
            }
            render();
            return;
        }

        // AGGIORNAMENTI CHIRURGICI (Nessun re-render della struttura)
        
        // Se i messaggi vengono svuotati (CLEAR)
        if (newState.ollamaConfig.messages.length === 0 && oldState?.ollamaConfig?.messages?.length > 0) {
            syncCurrentMessages();
        }

        // Update context display (file attivo, skills, etc)
        if (newState.activeFileId !== oldState?.activeFileId || newState.skills?.length !== oldState?.skills?.length) {
            updateContextDisplay();
        }
        
        // Reattività tasti Stop
        if (newState._ollamaStreaming !== oldState?._ollamaStreaming) {
            const stopBtn = document.getElementById('ollama-stop-btn');
            if (stopBtn) {
                if (newState._ollamaStreaming) stopBtn.classList.add('btn-stop-active');
                else stopBtn.classList.remove('btn-stop-active');
            }
        }
    });

    render();
};
