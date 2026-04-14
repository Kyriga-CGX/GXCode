import { state } from '../core/state.js';
import { api } from '../core/api.js';
import { triggerGlowOnMention } from '../core/uiUtils.js';
import { syncAllAiContextFiles } from '../core/aiKnowledgeBridge.js';

// Helper per unire percorsi (alternativa a path.join per il renderer)
const joinPaths = (...parts) => parts.filter(p => p).join('/').replace(/\/+/g, '/');

let glowedInThisSession = new Set();
let qwenTerm = null;
let qwenFitAddon = null;
let isStarted = false;

// Mention Autocomplete State
let isMentionMode = false;
let mentionPrefix = '';
let selectedIndex = 0;
let filteredItems = [];


export const initQwenCli = async () => {
    const container = document.getElementById('pane-qwen-cli');
    if (!container) return;

    if (qwenTerm) return; // Già inizializzato

    qwenTerm = new Terminal({
        cursorBlink: true,
        fontSize: 12,
        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
        theme: {
            background: '#06080a',
            foreground: '#d1d5db',
            cursor: '#8b5cf6', // Qwen Purple/Violet
            selection: 'rgba(139, 92, 246, 0.3)'
        },
        allowProposedApi: true
    });

    qwenFitAddon = new FitAddon.FitAddon();
    qwenTerm.loadAddon(qwenFitAddon);
    qwenTerm.open(container);

    // Resize observer
    const ro = new ResizeObserver(() => qwenFitAddon.fit());
    ro.observe(container);

    qwenTerm.onData(data => window.electronAPI.terminalWrite('qwen-cli', data));
    window.electronAPI.onTerminalData('qwen-cli', (data) => {
        qwenTerm.write(data);
        // Analizza dati terminale per illuminare skill/agenti
        triggerGlowOnMention(data, state, glowedInThisSession);
    });
    qwenTerm.onResize(size => window.electronAPI.terminalResize('qwen-cli', size.cols, size.rows));

    // Gestione @mentions — popup laterale con Agents/Skills (selezione solo mouse)
    // Le frecce NON vengono intercettate: Qwen le usa nativamente per file/cartelle nel terminale
    qwenTerm.onKey(({ domEvent }) => {
        if (domEvent.key === '@') {
            startMentionMode();
        } else if (isMentionMode) {
            if (domEvent.key === 'Escape') {
                stopMentionMode();
            } else if (domEvent.key === 'Backspace') {
                if (mentionPrefix.length === 0) {
                    stopMentionMode(); // l'utente ha cancellato la @
                } else {
                    mentionPrefix = mentionPrefix.slice(0, -1);
                    updateFilteredItems();
                    renderMentions();
                }
            } else if (domEvent.key.length === 1 && !domEvent.ctrlKey && !domEvent.metaKey && !domEvent.altKey) {
                mentionPrefix += domEvent.key;
                updateFilteredItems();
                renderMentions();
            }
            // ArrowUp/Down, Enter, Tab: NON intercettati → vanno al terminale (Qwen naviga file)
        }
    });

    // Supporto Professionale per Copia/Incolla
    qwenTerm.attachCustomKeyEventHandler(async (e) => {
        if (e.ctrlKey && e.shiftKey && (e.key === 'C' || e.key === 'V')) return false;

        if (e.ctrlKey && e.key === 'c' && qwenTerm.hasSelection()) {
            window.electronAPI.clipboardWrite(qwenTerm.getSelection());
            return false;
        }
        if (e.ctrlKey && e.key === 'v') {
            window.electronAPI.clipboardRead().then(text => {
                if (text) window.electronAPI.terminalWrite('qwen-cli', text);
            });
            return false;
        }
        return true;
    });

    // Click Destro Intelligente: Copia se c'è selezione, Incolla altrimenti
    qwenTerm.element.addEventListener('contextmenu', async (e) => {
        e.preventDefault();
        try {
            if (qwenTerm.hasSelection()) {
                window.electronAPI.clipboardWrite(qwenTerm.getSelection());
            } else {
                const text = await window.electronAPI.clipboardRead();
                if (text) window.electronAPI.terminalWrite('qwen-cli', text);
            }
        } catch (err) {
            console.error("[QWEN-CLI] Errore appunti:", err);
        }
    });

    console.log("[QWEN-CLI] Terminal initialized.");
};

export const startQwenCli = async () => {
    console.log("[QWEN-CLI] startQwenCli() called. isStarted:", isStarted);
    
    if (isStarted) {
        console.log("[QWEN-CLI] Already started, returning early.");
        return;
    }

    if (!qwenTerm) {
        console.log("[QWEN-CLI] Terminal not initialized, calling initQwenCli()...");
        await initQwenCli();
    }

    qwenTerm.write('\x1b[35m[GXCODE] Avvio Qwen Code CLI...\x1b[0m\r\n');

    const workspacePath = state.activeTerminalFolder || state.workspaceData?.path;
    console.log("[QWEN-CLI] Workspace path:", workspacePath);

    // Iniezione Context Dinamico (Sincronizza tutti i file AI)
    await syncAllAiContextFiles(state);

    console.log("[QWEN-CLI] Calling terminalCreate('qwen-cli', 'qwen', ...)...");
    const res = await window.electronAPI.terminalCreate('qwen-cli', 'qwen', workspacePath);
    console.log("[QWEN-CLI] terminalCreate result:", res);

    if (res && res.success) {
        isStarted = true;
        console.log("[QWEN-CLI] Qwen CLI started successfully!");
        qwenTerm.focus();
    } else {
        console.error("[QWEN-CLI] Failed to start Qwen CLI:", res);
        qwenTerm.write(`\r\n\x1b[31;1mERRORE AVVIO QWEN CLI\x1b[0m\r\n`);
        qwenTerm.write(`\x1b[33mDettaglio: ${res?.error || 'Unknown error'}\x1b[0m\r\n`);
        qwenTerm.write(`\x1b[90mAssicurati che 'npx' sia installato.\x1b[0m\r\n`);
        qwenTerm.write(`\x1b[90mProva: npm install -g @qwen-code/qwen-code\x1b[0m\r\n`);
    }
};

export const focusQwenCli = () => {
    if (qwenTerm) {
        qwenTerm.focus();
        setTimeout(() => qwenFitAddon.fit(), 100);
    }
};

// --- MENTION AUTOCOMPLETE LOGIC ---

const startMentionMode = () => {
    isMentionMode = true;
    mentionPrefix = '';
    selectedIndex = 0;
    // Mostra subito con dati in cache, poi ricarica in background
    updateFilteredItems();
    showMentionsPopup();
    api.loadAll().then(() => {
        if (isMentionMode) { updateFilteredItems(); renderMentions(); }
    }).catch(() => {});
};

const stopMentionMode = () => {
    isMentionMode = false;
    mentionPrefix = '';
    const popup = document.getElementById('qwen-mentions-popup');
    if (popup) {
        popup.classList.remove('active');
        popup.classList.add('hidden');
    }
};

const updateFilteredItems = () => {
    const all = [
        ...(state.agents || []).map(a => ({ ...a, type: 'agent' })),
        ...(state.skills || []).map(s => ({ ...s, type: 'skill' }))
    ];
    const prefix = mentionPrefix.toLowerCase();
    filteredItems = prefix.length === 0
        ? all.slice(0, 15)
        : all.filter(i => (i.name || '').toLowerCase().includes(prefix)).slice(0, 15);
    if (selectedIndex >= filteredItems.length) selectedIndex = 0;
};

const showMentionsPopup = () => {
    const popup = document.getElementById('qwen-mentions-popup');
    if (!popup || !qwenTerm) return;

    const termRect = qwenTerm.element.getBoundingClientRect();
    const popupWidth = 280;

    let left = termRect.right + 10;
    let top = termRect.top + 40;

    if (left + popupWidth > window.innerWidth) {
        left = termRect.left - popupWidth - 10;
    }
    top = Math.min(top, window.innerHeight - 380);
    top = Math.max(10, top);
    left = Math.max(10, left);

    if (popup.parentElement !== document.body) {
        document.body.appendChild(popup);
    }

    popup.style.position = 'fixed';
    popup.style.left = `${left}px`;
    popup.style.top = `${top}px`;
    popup.style.zIndex = '999999999';
    popup.classList.remove('hidden');
    popup.classList.add('active');

    renderMentions();
};

const renderMentions = () => {
    const popup = document.getElementById('qwen-mentions-popup');
    if (!popup) return;

    if (filteredItems.length === 0) {
        popup.innerHTML = `<div class="p-2 text-[10px] text-gray-500 uppercase tracking-widest text-center">Nessun risultato</div>`;
        return;
    }

    popup.innerHTML = filteredItems.map((item, idx) => {
        const icon = item.type === 'skill' ? '⚡' : '🤖';
        const iconClass = item.type === 'skill' ? 'skill' : 'agent';
        return `
            <div class="mention-item" onclick="window.selectQwenMentionByIndex(${idx})">
                <div class="mention-icon ${iconClass}">${icon}</div>
                <div class="mention-info">
                    <div class="mention-name">${item.name}</div>
                    <div class="mention-type">${item.type}</div>
                </div>
            </div>
        `;
    }).join('');

    window.selectQwenMentionByIndex = (idx) => {
        selectedIndex = idx;
        selectMention();
    };
};

const selectMention = () => {
    const item = filteredItems[selectedIndex];
    if (item) {
        // Cancella i caratteri digitati dopo @ e inserisce il nome dell'agent/skill
        const backspaces = '\b'.repeat(mentionPrefix.length);
        window.electronAPI.terminalWrite('qwen-cli', backspaces + item.name + ' ');
    }
    stopMentionMode();
};

// Esponi le funzioni globalmente per bottomPanel.js
window.startQwenCli = startQwenCli;
window.focusQwenCli = focusQwenCli;
window.initQwenCli = initQwenCli;
