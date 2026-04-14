import { state } from '../core/state.js';
import { triggerGlowOnMention } from '../core/uiUtils.js';
import { syncAllAiContextFiles } from '../core/aiKnowledgeBridge.js';

let glowedInThisSession = new Set();
let claudeTerm = null;
let claudeFitAddon = null;
let isStarted = false;

// Mention Autocomplete State
let isMentionMode = false;
let mentionPrefix = '';
let selectedIndex = 0;
let filteredItems = [];


export const initClaudeCli = async () => {
    const container = document.getElementById('pane-claude-cli');
    if (!container) return;

    if (claudeTerm) return; // Già inizializzato

    claudeTerm = new Terminal({
        cursorBlink: true,
        fontSize: 12,
        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
        theme: {
            background: '#06080a',
            foreground: '#d1d5db',
            cursor: '#f97316',
            selection: 'rgba(249, 115, 22, 0.3)'
        },
        allowProposedApi: true
    });

    claudeFitAddon = new FitAddon.FitAddon();
    claudeTerm.loadAddon(claudeFitAddon);
    claudeTerm.open(container);
    
    // Resize observer
    const ro = new ResizeObserver(() => claudeFitAddon.fit());
    ro.observe(container);

    claudeTerm.onData(data => window.electronAPI.terminalWrite('claude-cli', data));
    window.electronAPI.onTerminalData('claude-cli', (data) => {
        claudeTerm.write(data);
        // Analizza dati terminale per illuminare skill/agenti
        triggerGlowOnMention(data, state, glowedInThisSession);
    });
    claudeTerm.onResize(size => window.electronAPI.terminalResize('claude-cli', size.cols, size.rows));

    // Gestione @mentions — popup laterale con Agents/Skills (selezione solo mouse)
    // Le frecce NON vengono intercettate: Claude le usa nativamente per file/cartelle nel terminale
    claudeTerm.onKey(({ domEvent }) => {
        if (domEvent.key === '@') {
            startMentionMode();
        } else if (isMentionMode) {
            if (domEvent.key === 'Escape') {
                stopMentionMode();
            } else if (domEvent.key === 'Backspace') {
                if (mentionPrefix.length === 0) {
                    stopMentionMode();
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
            // ArrowUp/Down, Enter, Tab: NON intercettati → vanno al terminale (Claude naviga file)
        }
    });

    // Supporto Professionale per Copia/Incolla (Scorciatoie Tastiera)
    claudeTerm.attachCustomKeyEventHandler((e) => {
        // NON intercettiamo le frecce per Claude - lasciamo che il menu nativo funzioni
        // Le skill/agent sono selezionabili solo tramite click
        if (e.ctrlKey && e.shiftKey && (e.key === 'C' || e.key === 'V')) return false;

        if (e.ctrlKey && e.key === 'c' && claudeTerm.hasSelection()) {
            window.electronAPI.clipboardWrite(claudeTerm.getSelection());
            return false;
        }
        if (e.ctrlKey && e.key === 'v') {
            window.electronAPI.clipboardRead().then(text => {
                if (text) window.electronAPI.terminalWrite('claude-cli', text);
            });
            return false;
        }
        return true;
    });

    // Click Destro Intelligente: Copia se c'è selezione, Incolla altrimenti
    claudeTerm.element.addEventListener('contextmenu', async (e) => {
        e.preventDefault();
        try {
            if (claudeTerm.hasSelection()) {
                window.electronAPI.clipboardWrite(claudeTerm.getSelection());
            } else {
                const text = await window.electronAPI.clipboardRead();
                if (text) window.electronAPI.terminalWrite('claude-cli', text);
            }
        } catch (err) {
            console.error("[CLAUDE-CLI] Errore appunti:", err);
        }
    });

    console.log("[CLAUDE-CLI] Terminal initialized.");
};

export const startClaudeCli = async () => {
    if (isStarted) return;
    
    if (!claudeTerm) await initClaudeCli();

    claudeTerm.write('\x1b[33m[GXCODE] Avvio Claude Code CLI...\x1b[0m\r\n');
    
    const apiKey = state.anthropicApiKey;
    const workspacePath = state.activeTerminalFolder || state.workspaceData?.path;

    // Sincronizza tutti i file AI (CLAUDE.md, QWEN.md, GEMINI.md, GX_IDENTITY.md)
    await syncAllAiContextFiles(state);

    const res = await window.electronAPI.terminalCreate('claude-cli', 'claude', workspacePath, apiKey);

    if (res && res.success) {
        isStarted = true;
        claudeTerm.focus();
    } else {
        claudeTerm.write(`\r\n\x1b[31;1mERRORE AVVIO CLAUDE CLI\x1b[0m\r\n`);
        claudeTerm.write(`\x1b[33mDettaglio: ${res.error}\x1b[0m\r\n`);
        claudeTerm.write(`\x1b[90mAssicurati che 'npx' sia installato e la chiave sia valida.\x1b[0m\r\n`);
    }
};

export const focusClaudeCli = () => {
    if (claudeTerm) {
        claudeTerm.focus();
        setTimeout(() => claudeFitAddon.fit(), 100);
    }
};

// --- MENTION AUTOCOMPLETE LOGIC ---

const startMentionMode = () => {
    isMentionMode = true;
    mentionPrefix = '';
    selectedIndex = 0;
    updateFilteredItems();
    showMentionsPopup();
};

const stopMentionMode = () => {
    isMentionMode = false;
    mentionPrefix = '';
    const popup = document.getElementById('claude-mentions-popup');
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
    const popup = document.getElementById('claude-mentions-popup');
    if (!popup || !claudeTerm) return;

    const termRect = claudeTerm.element.getBoundingClientRect();
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
    const popup = document.getElementById('claude-mentions-popup');
    if (!popup) return;

    if (filteredItems.length === 0) {
        popup.innerHTML = `<div class="p-2 text-[10px] text-gray-500 uppercase tracking-widest text-center">Nessun risultato</div>`;
        return;
    }

    popup.innerHTML = filteredItems.map((item, idx) => {
        const icon = item.type === 'skill' ? '⚡' : '🤖';
        const iconClass = item.type === 'skill' ? 'skill' : 'agent';
        return `
            <div class="mention-item" onclick="window.selectClaudeMentionByIndex(${idx})">
                <div class="mention-icon ${iconClass}">${icon}</div>
                <div class="mention-info">
                    <div class="mention-name">${item.name}</div>
                    <div class="mention-type">${item.type}</div>
                </div>
            </div>
        `;
    }).join('');

    window.selectClaudeMentionByIndex = (idx) => {
        selectedIndex = idx;
        selectMention();
    };
};

const selectMention = () => {
    const item = filteredItems[selectedIndex];
    if (item) {
        const backspaces = '\b'.repeat(mentionPrefix.length);
        window.electronAPI.terminalWrite('claude-cli', backspaces + item.name + ' ');
    }
    stopMentionMode();
};

