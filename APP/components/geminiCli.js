import { state } from '../core/state.js';
import { triggerGlowOnMention } from '../core/uiUtils.js';
import { syncAllAiContextFiles } from '../core/aiKnowledgeBridge.js';

let glowedInThisSession = new Set();
let geminiTerm = null;
let geminiFitAddon = null;
let isStarted = false;

// Mention Autocomplete State (Replicating Claude pattern)
let isMentionMode = false;
let mentionPrefix = '';
let selectedIndex = 0;
let filteredItems = [];

export const initGeminiCli = async () => {
    const container = document.getElementById('pane-gemini-cli');
    if (!container) return;
    if (geminiTerm) return; 

    geminiTerm = new Terminal({
        cursorBlink: true,
        fontSize: 12,
        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
        theme: {
            background: '#06080a',
            foreground: '#d1d5db',
            cursor: '#3b82f6', // Gemini Blue
            selection: 'rgba(59, 130, 246, 0.3)'
        },
        allowProposedApi: true
    });

    geminiFitAddon = new FitAddon.FitAddon();
    geminiTerm.loadAddon(geminiFitAddon);
    geminiTerm.open(container);
    
    const ro = new ResizeObserver(() => geminiFitAddon.fit());
    ro.observe(container);

    geminiTerm.onData(data => window.electronAPI.terminalWrite('gemini-cli', data));
    window.electronAPI.onTerminalData('gemini-cli', (data) => {
        geminiTerm.write(data);
        triggerGlowOnMention(data, state, glowedInThisSession);
    });
    geminiTerm.onResize(size => window.electronAPI.terminalResize('gemini-cli', size.cols, size.rows));

    // Gestione @mentions — popup laterale con Agents/Skills (selezione solo mouse)
    // Le frecce NON vengono intercettate: Gemini le usa nativamente per file/cartelle nel terminale
    geminiTerm.onKey(({ domEvent }) => {
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
            // ArrowUp/Down, Enter, Tab: NON intercettati → vanno al terminale (Gemini naviga file)
        }
    });

    // Supporto Professionale per Copia/Incolla (Scorciatoie Tastiera)
    geminiTerm.attachCustomKeyEventHandler((e) => {
        // NON intercettiamo le frecce per Gemini - lasciamo che il menu nativo funzioni
        // Le skill/agent sono selezionabili solo tramite click
        if (e.ctrlKey && e.shiftKey && (e.key === 'C' || e.key === 'V')) return false;
        if (e.ctrlKey && e.key === 'c' && geminiTerm.hasSelection()) {
            window.electronAPI.clipboardWrite(geminiTerm.getSelection());
            return false;
        }
        if (e.ctrlKey && e.key === 'v') {
            window.electronAPI.clipboardRead().then(text => {
                if (text) window.electronAPI.terminalWrite('gemini-cli', text);
            });
            return false;
        }
        return true;
    });

    geminiTerm.element.addEventListener('contextmenu', async (e) => {
        e.preventDefault();
        try {
            if (geminiTerm.hasSelection()) {
                window.electronAPI.clipboardWrite(geminiTerm.getSelection());
            } else {
                const text = await window.electronAPI.clipboardRead();
                if (text) window.electronAPI.terminalWrite('gemini-cli', text);
            }
        } catch (err) {}
    });
};

export const startGeminiCli = async () => {
    if (isStarted) return;
    if (!geminiTerm) await initGeminiCli();

    geminiTerm.write('\x1b[34m[GXCODE] Avvio Gemini AI CLI Agent...\x1b[0m\r\n');
    
    const workspacePath = state.activeTerminalFolder || state.workspaceData?.path;

    // Sincronizza tutti i file AI (GEMINI.md, CLAUDE.md, QWEN.md, GX_IDENTITY.md)
    await syncAllAiContextFiles(state);

    const res = await window.electronAPI.terminalCreate('gemini-cli', 'gemini', workspacePath);

    if (res && res.success) {
        isStarted = true;
        geminiTerm.focus();
    } else {
        geminiTerm.write(`\r\n\x1b[31;1mERRORE AVVIO GEMINI CLI\x1b[0m\r\n`);
        geminiTerm.write(`\x1b[33mDettaglio: ${res.error}\x1b[0m\r\n`);
    }
};

export const focusGeminiCli = () => {
    if (geminiTerm) {
        geminiTerm.focus();
        setTimeout(() => geminiFitAddon.fit(), 100);
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
    const popup = document.getElementById('gemini-mentions-popup');
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
    const popup = document.getElementById('gemini-mentions-popup');
    if (!popup || !geminiTerm) return;

    const termRect = geminiTerm.element.getBoundingClientRect();
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
    const popup = document.getElementById('gemini-mentions-popup');
    if (!popup) return;

    if (filteredItems.length === 0) {
        popup.innerHTML = `<div class="p-2 text-[10px] text-gray-500 uppercase tracking-widest text-center">Nessun risultato</div>`;
        return;
    }

    popup.innerHTML = filteredItems.map((item, idx) => {
        const icon = item.type === 'skill' ? '⚡' : '🤖';
        const iconClass = item.type === 'skill' ? 'skill' : 'agent';
        return `
            <div class="mention-item" onclick="window.selectGeminiMentionByIndex(${idx})">
                <div class="mention-icon ${iconClass}">${icon}</div>
                <div class="mention-info">
                    <div class="mention-name">${item.name}</div>
                    <div class="mention-type">${item.type}</div>
                </div>
            </div>
        `;
    }).join('');

    window.selectGeminiMentionByIndex = (idx) => {
        selectedIndex = idx;
        selectMention();
    };
};

const selectMention = () => {
    const item = filteredItems[selectedIndex];
    if (item) {
        const backspaces = '\b'.repeat(mentionPrefix.length);
        window.electronAPI.terminalWrite('gemini-cli', backspaces + item.name + ' ');
    }
    stopMentionMode();
};
