import { state, subscribe, setState } from '../core/state.js';
import { callGeminiAgent, listAvailableModels } from '../core/geminiApi.js';
import { triggerGlowOnMention } from '../core/uiUtils.js';

const glowedInThisSession = new Set();

/**
 * GX-Agent Sidebar Component
 */

let chatHistory = []; // Local history for the session
let autoItems = [];
let activeIndex = 0;
let isShowingAuto = false;

export const initGxAgent = () => {
    // Carica i modelli reali all'avvio
    listAvailableModels();
    window.renderGxAgentChat = renderGxAgentChat;

    // Sottoscrizione reattiva allo stato (Ottimizzata per evitare flickering e perdita focus)
    subscribe((newState, oldState) => {
        // Rileva se il cambiamento è strutturale o solo di dati
        const configChanged = newState.geminiConfig !== oldState?.geminiConfig;
        const agentsChanged = newState.agents !== oldState?.agents;
        const activeAgentChanged = newState.activeAgentId !== oldState?.activeAgentId;
        
        // Se non è cambiato nulla di rilevante per la struttura, evita il re-render distruttivo
        if (!configChanged && !agentsChanged && !activeAgentChanged) return;

        const paneContainer = document.getElementById('pane-agent');
        const sidebarContainer = document.getElementById('sidebar-ai-companion-container');
        
        // Se l'utente sta scrivendo, non interrompere il flusso a meno che non fosse cambiato qualcosa di critico (config)
        const activeEl = document.activeElement;
        const isUserTyping = activeEl && (activeEl.id === 'gx-agent-input' || activeEl.id === 'ollama-input');
        
        if (isUserTyping && !configChanged) {
            // Aggiorna solo eventuali parti non distruttive se necessario
            return;
        }

        if (paneContainer && !paneContainer.classList.contains('hidden')) {
            renderGxAgentChat('pane-agent');
        }
        if (sidebarContainer) {
            renderGxAgentChat('sidebar-ai-companion-container');
        }
    });

    // Inizializzazione iniziale se necessario
    const container = document.getElementById('pane-agent');
    if (container && !container.classList.contains('hidden')) {
        renderGxAgentChat();
    }
};

export const renderGxAgentChat = (targetId = 'pane-agent', shouldFocus = false) => {
    const container = document.getElementById(targetId);
    if (!container) return;

    // Recupera lo stato in modo sicuro (usa window.state se disponibile o l'import locale)
    const currentState = window.state || state;
    const config = (currentState && currentState.geminiConfig) || { isAuthenticated: false };

    container.innerHTML = `
        <div class="flex flex-col h-full bg-[var(--bg-main)] shadow-xl text-sans">
            <!-- User Profile Header (OAuth) -->
            ${config.isAuthenticated ? `
                <div class="px-4 py-2.5 bg-purple-600/5 border-b border-purple-500/10 flex items-center justify-between gap-2 overflow-hidden">
                    <div class="flex items-center gap-2 min-w-0 flex-1">
                        <img src="${config.user.picture}" class="w-6 h-6 rounded-full border border-purple-500/30 shadow-sm shrink-0" />
                        <div class="flex flex-col min-w-0 overflow-hidden">
                            <span class="text-[9px] font-bold text-gray-200 leading-tight truncate px-0.5">${config.user.name}</span>
                            <span class="text-[8px] text-blue-400 font-bold leading-tight truncate px-0.5 tracking-tighter">
                                ${state.activeAgentId ? `ACTIVE: ${state.agents.find(a => String(a.id) === String(state.activeAgentId))?.name || 'CUSTOM'}` : 'STANDARD AGENT'}
                            </span>
                        </div>
                    </div>
                    <div class="flex items-center gap-1.5 shrink-0">
                        <select onchange="window.handleGeminiModelChange(this.value)" class="bg-[#21262d] border border-purple-500/30 text-[8px] text-purple-300 font-bold px-1 py-0.5 rounded-md outline-none cursor-pointer hover:border-purple-500 transition-all uppercase max-w-[65px] truncate">
                            ${(config.models || ['gemini-1.5-pro']).map(m => `
                                <option value="${m}" ${m === config.activeModel ? 'selected' : ''}>
                                    ${(m || 'unknown').replace('gemini-', '').toUpperCase()}
                                </option>
                            `).join('')}
                        </select>
                        <button onclick="window.handleGeminiLogout()" class="p-1 text-gray-600 hover:text-red-400 transition" title="Esci">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                        </button>
                    </div>
                </div>
            ` : `
                <div class="px-4 py-2 bg-yellow-500/5 border-b border-yellow-500/10 flex items-center justify-between group">
                    <div class="flex items-center gap-2">
                        <div class="p-1 bg-yellow-500/20 rounded-md">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#eab308" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
                        </div>
                        <span class="text-[9px] font-bold text-yellow-600 uppercase tracking-wider">Accesso non autenticato</span>
                    </div>
                    <button onclick="window.electronAPI.geminiLogin()" class="px-2 py-1 bg-white hover:bg-gray-100 text-black text-[9px] font-bold rounded flex items-center gap-1.5 transition-all active:scale-95 shadow-sm">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                        Accedi con Google
                    </button>
                </div>
            `}

            <!-- Chat History (Vision 2026 Elite: Selectable Text) -->
            <div id="gx-chat-messages" class="flex-1 overflow-y-auto p-1 py-1 space-y-[1px] custom-scrollbar bg-[var(--bg-main)] select-text">
                ${chatHistory.length === 0 ? `
                    <div class="flex flex-col items-center justify-center h-40 opacity-40 text-center">
                        <div class="w-12 h-12 rounded-full border border-blue-500/30 flex items-center justify-center text-blue-400 mb-3 bg-blue-500/10">🤖</div>
                        <p class="text-[10px] uppercase tracking-widest font-bold">GX-Agent Pronto</p>
                        <p class="text-[9px] mt-1">Chiedimi di creare file, cartelle o analizzare il progetto.</p>
                    </div>
                ` : chatHistory.map(msg => renderMessage(msg)).join('')}
                <div id="gx-chat-anchor"></div>
            </div>

            <!-- Input Area -->
            <div class="p-3 border-t border-[var(--border-dim)] bg-[var(--bg-side)]">
                <div class="relative flex items-center bg-[var(--bg-ghost)] border border-[var(--border-subtle)] focus-within:border-[var(--accent)] transition-all px-2 pr-1">
                    <textarea id="gx-agent-input" 
                        rows="1"
                        data-i18n="[placeholder]gxAgent.placeholder"
                        placeholder="Chiedi al GX-Agent..." 
                        class="flex-1 bg-transparent border-none text-[11px] text-gray-200 p-2.5 outline-none resize-none max-h-32 custom-scrollbar"></textarea>
                    
                    <!-- AUTOCOMPLETE POPUP (Vision 2026 Elite) -->
                    <div id="gx-agent-autocomplete" class="gx-ai-autocomplete !bottom-full !top-auto !mb-2 hidden"></div>

                    <button id="gx-agent-send" class="p-2 text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-30" disabled>
                        <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
                    </button>
                </div>
            </div>
        </div>
    `;

    setupListeners();
    if (shouldFocus) {
        setTimeout(() => document.getElementById('gx-agent-input')?.focus(), 10);
    }
    scrollGxAgentToBottom();
};

export const scrollGxAgentToBottom = () => {
    const area = document.getElementById('gx-chat-messages');
    if (!area) return;
    requestAnimationFrame(() => {
        area.scrollTop = area.scrollHeight;
        // Secondo tentativo per messaggi lunghi
        setTimeout(() => { area.scrollTop = area.scrollHeight; }, 50);
    });
};

const renderMessage = (msg) => {
    const isUser = msg.role === 'user';
    const prefixColor = isUser ? 'text-blue-500' : (msg.isError ? 'text-red-500' : 'text-purple-500');
    const label = isUser ? 'IO' : (msg.isError ? 'ERROR' : 'AGENT');

    if (msg.isQuota) {
        return `
            <div class="mx-2 my-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-[11px] animate-pulse">
                <div class="flex items-center gap-2 mb-1 text-yellow-500 font-bold uppercase tracking-tighter">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                    Limite Quota Superato
                </div>
                <div class="text-gray-300 leading-relaxed">${msg.text}</div>
            </div>
        `;
    }

    return `
        <div class="px-2 py-0 hover:bg-[var(--bg-side-alt)] transition-colors terminal-line text-[12px] leading-[1.2] font-sans group select-text">
            <span class="font-mono text-[9px] font-bold ${prefixColor} opacity-80 mr-1.5 inline-block select-none">[${label}] &gt;</span>
            <span class="text-gray-300 whitespace-pre-wrap select-text selection:bg-blue-500/30">${msg.text}</span>
        </div>
    `;
};

// --- MENTIONS SYSTEM (Ported from Ollama for Consistency) ---

const getMentionCandidates = () => {
    const agents = (state.agents || []).map(a => ({ id: a.slug || a.id, name: a.name, type: 'agent', desc: 'Agent' }));
    const skills = (state.skills || []).map(s => ({ id: s.slug || s.id, name: s.name, type: 'skill', desc: 'Skill' }));
    
    // Helper per estrarre file/cartelle dallo stato
    const extractItems = (nodes) => {
        let folders = [];
        let files = [];
        const walk = (list) => {
            list.forEach(node => {
                if (node.isDirectory) {
                    folders.push({ id: node.path, name: node.name, type: 'folder', desc: 'Folder' });
                    if (node.children) walk(node.children);
                } else {
                    files.push({ id: node.path, name: node.name, type: 'file', desc: 'File' });
                }
            });
        };
        if (nodes && Array.isArray(nodes)) walk(nodes);
        return { folders, files };
    };

    const { folders, files } = extractItems(state.files || []);
    return [...agents, ...skills, ...folders, ...files];
};

const renderAutocomplete = (query = '') => {
    const auto = document.getElementById('gx-agent-autocomplete');
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
    const input = document.getElementById('gx-agent-input');
    const item = autoItems[activeIndex];
    if (!input || !item) return;

    const val = input.value;
    const pos = input.selectionStart;
    const lastAt = val.lastIndexOf('@', pos - 1);
    
    const newValue = val.substring(0, lastAt) + '@' + item.name + ' ' + val.substring(pos);
    input.value = newValue;
    input.focus();
    
    const auto = document.getElementById('gx-agent-autocomplete');
    auto.classList.add('hidden');
    isShowingAuto = false;
    activeIndex = 0;
};

const setupListeners = () => {
    const input = document.getElementById('gx-agent-input');
    const btn = document.getElementById('gx-agent-send');
    if (!input || !btn) return;

    input.oninput = () => {
        btn.disabled = !input.value.trim();
        
        // --- GESTIONE AUTOCOMPLETE ---
        const val = input.value;
        const pos = input.selectionStart;
        const lastAt = val.lastIndexOf('@', pos - 1);
        
        if (lastAt !== -1 && !val.substring(lastAt, pos).includes(' ')) {
            const query = val.substring(lastAt + 1, pos);
            renderAutocomplete(query);
        } else {
            const auto = document.getElementById('gx-agent-autocomplete');
            if (auto) auto.classList.add('hidden');
            isShowingAuto = false;
        }

        // Auto-resize
        input.style.height = 'auto';
        input.style.height = input.scrollHeight + 'px';
    };

    input.onkeydown = (e) => {
        if (isShowingAuto) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                activeIndex = (activeIndex + 1) % autoItems.length;
                renderAutocomplete(document.getElementById('gx-agent-input').value.split('@').pop());
                return;
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                activeIndex = (activeIndex - 1 + autoItems.length) % autoItems.length;
                renderAutocomplete(document.getElementById('gx-agent-input').value.split('@').pop());
                return;
            }
            if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                insertMention();
                return;
            }
            if (e.key === 'Escape') {
                document.getElementById('gx-agent-autocomplete').classList.add('hidden');
                isShowingAuto = false;
                return;
            }
        }

        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    btn.onclick = handleSend;

    // Supporto Copia/Incolla Pro (Richiesto dall'utente)
    const messagesContainer = document.getElementById('gx-chat-messages');
    if (messagesContainer) {
        messagesContainer.oncontextmenu = async (e) => {
            const selection = window.getSelection().toString();
            if (selection) {
                e.preventDefault();
                window.electronAPI.clipboardWrite(selection);
            }
        };
    }

    input.oncontextmenu = async (e) => {
        const selection = input.value.substring(input.selectionStart, input.selectionEnd);
        if (selection) {
            e.preventDefault();
            window.electronAPI.clipboardWrite(selection);
        } else {
            e.preventDefault();
            const text = await window.electronAPI.clipboardRead();
            if (text) {
                const start = input.selectionStart;
                const end = input.selectionEnd;
                input.value = input.value.substring(0, start) + text + input.value.substring(end);
                input.dispatchEvent(new Event('input')); // Trigger auto-resize
            }
        }
    };
};

const handleSend = async () => {
    const input = document.getElementById('gx-agent-input');
    if (!input || !input.value.trim()) return;

    const text = input.value.trim();
    input.value = '';
    
    // 1. Aggiungi alla storia locale
    chatHistory.push({ role: 'user', text });
    renderGxAgentChat('pane-agent', true); // Mantieni il focus dopo l'invio

    // 2. Prepara messaggi per l'API (Inclusione Persona Agente se presente)
    let apiMessages = chatHistory.map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.text }]
    }));

    // Iniezione "Persona" (Role/Prompt) & CONTESTO ELITE
    let personaPrompt = "Stai operando come un Assistente AI d'Elite. Sii proattivo, preciso e tecnico.";
    
    if (state.activeAgentId) {
        const activeAgent = state.agents.find(a => String(a.id) === String(state.activeAgentId));
        if (activeAgent) {
            personaPrompt = `Stai operando come: "${activeAgent.name}". Il tuo ruolo è: ${activeAgent.role}. Istruzioni: ${activeAgent.prompt || 'Sii utile.'}`;
        }
    }

    // --- ELITE CONTEXT INJECTION (Snapshot del Progetto) ---
    const activeDoc = state.activeDocumentPath;
    const fileTree = (state.files || []).map(f => `- ${f.name}${f.isDirectory ? '/' : ''}`).join('\n');
    personaPrompt += `\n\n[CONTESTO PROGETTO ATTUALE]:
Albero File principale:
${fileTree}
${activeDoc ? `Documento Attivo: ${activeDoc}` : 'Nessun documento attivo.'}

[REGOLE ELITE]:
1. Hai pieno accesso al filesystem tramite i tuoi tool (write_file, list_files, read_file, etc).
2. Se l'utente ti chiede di creare file o cartelle, USA I TUOI TOOL immediatamente.
3. Se l'utente menziona @Skills o @Agents, interagisci con loro o suggeriscine l'uso.
4. Ogni tua azione tecnica deve essere accompagnata da una spiegazione professionale nel terminale.
PRO-TIP: Se non conosci il contenuto di un file rilevante, usa 'read_file' prima di rispondere.`;

    // Mettiamo il prompt di persona all'inizio come istruzione di sistema per Gemini
    apiMessages.unshift({
        role: "user",
        parts: [{ text: `[GX-SYSTEM-PROMPT] ${personaPrompt}` }]
    });

    try {
        // Mostra indicatore di caricamento
        const statusIdx = chatHistory.push({ role: 'model', text: 'Sto pensando...', isLoading: true }) - 1;
        renderGxAgentChat('pane-agent', true);
        
        // Passiamo una callback per aggiornare lo stato durante i tool calls
        const response = await callGeminiAgent(apiMessages, (statusMsg) => {
            chatHistory[statusIdx].text = statusMsg;
            renderGxAgentChat('pane-agent', true);
            // Analizza status per glow
            triggerGlowOnMention(statusMsg, state, glowedInThisSession);
        });
        
        // Sostituisci il caricamento con la risposta vera
        chatHistory[statusIdx].text = response;
        chatHistory[statusIdx].isLoading = false;
        renderGxAgentChat('pane-agent', true);
        // Analizza risposta finale
        triggerGlowOnMention(response, state, glowedInThisSession);

    } catch (err) {
        chatHistory.pop(); // Rimuovi il "pensando"
        
        let errorMsg = err.message;
        let isQuota = errorMsg.toLowerCase().includes('quota') || errorMsg.includes('429');
        
        if (isQuota) {
            errorMsg = `⚠️ QUOTA RAGGIUNTA: Hai esaurito i messaggi gratuiti per questo minuto/giorno. Attendi qualche istante o passa a un piano superiore su Google AI Studio.`;
        }

        chatHistory.push({ 
            role: 'model', 
            text: errorMsg,
            isError: true,
            isQuota: isQuota
        });
        renderGxAgentChat('pane-agent', true);
    }
};

window.handleGeminiModelChange = (model) => {
    setState({
        geminiConfig: {
            ...state.geminiConfig,
            activeModel: model
        }
    });
    renderGxAgentChat();
};

window.handleGeminiLogout = () => {
    setState({
        geminiConfig: {
            isAuthenticated: false,
            user: null,
            token: null
        }
    });
    renderGxAgentChat();
};

// Esportiamo per compatibilità legacy se necessario
window.renderGxAgentChat = renderGxAgentChat;
