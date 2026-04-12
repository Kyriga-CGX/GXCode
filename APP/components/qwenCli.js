import { state } from '../core/state.js';
import { triggerGlowOnMention } from '../core/uiUtils.js';

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

    // Monitor input for @mentions
    qwenTerm.onKey(e => {
        const { domEvent } = e;

        if (isMentionMode) {
            handleMentionKey(domEvent);
        } else if (domEvent && domEvent.key === '@') {
            startMentionMode();
        }
    });

    // Supporto Professionale per Copia/Incolla (Scorciatoie Tastiera)
    qwenTerm.attachCustomKeyEventHandler((e) => {
        // Se siamo in mention mode, blocchiamo le frecce/invio per farli andare al popup
        if (isMentionMode && filteredItems.length > 0) {
            if (['ArrowUp', 'ArrowDown', 'Enter', 'Escape', 'Tab'].includes(e.key)) {
                return false;
            }
        }
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

    // Iniezione Context Dinamico (QWEN.md)
    await ensureQwenMetadata(workspacePath);

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

/**
 * Genera o aggiorna il file QWEN.md nella root del progetto per fornire contesto all'IA.
 */
const ensureQwenMetadata = async (workspacePath) => {
    if (!workspacePath) return;

    try {
        const aiPaths = await window.electronAPI.getAiPaths();
        const gitInfo = await window.electronAPI.getGitRemote(workspacePath);
        const openFiles = state.openFiles || [];
        const activeFile = state.activeFileId;

        // Identità del progetto: Priorità all'URL Git, altrimenti nome cartella
        const projectIdentity = gitInfo.success ? gitInfo.url : workspacePath.split(/[/\\]/).filter(Boolean).pop();

        // Helper per rendere i path relativi alla root del progetto (robusto per Windows/Unix)
        const getRelative = (fullPath) => {
            if (!fullPath) return 'None';
            const normPath = fullPath.replace(/\\/g, '/');
            const normRoot = workspacePath.replace(/\\/g, '/');

            let relative = normPath.replace(normRoot, '');
            if (relative.startsWith('/')) relative = relative.substring(1);
            return relative || '.';
        };

        // Costruiamo il contenuto in modo leggibile e portatile
        let content = `# ${projectIdentity.toUpperCase()} - PROJECT CONTEXT\n\n`;
        content += `This project is being managed by **GXCode IDE**.\n\n`;

        content += `## PROJECT IDENTITY\n`;
        content += `- **Remote/ID**: \`${projectIdentity}\`\n`;
        content += `- **Local Root**: \`.\` (Current Working Directory)\n\n`;

        content += `## IDE RESOURCES (GLOBAL)\n`;
        content += `- **Agents Location**: \`~/.GXCODE/agents\`\n`;
        content += `- **Skills Location**: \`~/.GXCODE/skills\`\n\n`;

        if (openFiles.length > 0) {
            content += `## CURRENT WORKSPACE CONTEXT\n`;
            content += `- **Open Editor Tabs**:\n`;
            openFiles.forEach(f => {
                const relPath = getRelative(f.path);
                content += `  - \`${relPath}\` ${f.path === activeFile ? '**[ACTIVE]**' : ''}\n`;
            });
            content += `\n`;
        }

        content += `\n## INSTRUCTIONS\n`;
        content += `1. When the user asks about agents or skills, prioritize looking into the Global locations (relative to User Home).\n`;
        content += `2. You have full access to the project root for searching and editing code.\n`;
        content += `3. Use the open editor tabs as your primary context for what the user is currently working on.\n`;

        // Scrittura del file
        const separator = workspacePath.includes('\\') ? '\\' : '/';
        const targetFile = workspacePath.endsWith(separator) ? `${workspacePath}QWEN.md` : `${workspacePath}${separator}QWEN.md`;

        await window.electronAPI.fsWriteFile(targetFile, content);
        console.log("[QWEN-CLI] Identità Git e contesto iniettati con successo.");
    } catch (err) {
        console.error("[QWEN-CLI] Failed to inject context:", err);
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
    updateFilteredItems();
    console.log("[QWEN-MENTIONS] Mode started. Items:", filteredItems.length);
    showMentionsPopup();
};

const stopMentionMode = () => {
    isMentionMode = false;
    mentionPrefix = '';
    const popup = document.getElementById('qwen-mentions-popup');
    if (popup) {
        popup.style.display = 'none';
        popup.classList.add('hidden');
    }
    console.log("[QWEN-MENTIONS] Mode stopped.");
};

const updateFilteredItems = () => {
    const all = [
        ...(state.agents || []).map(a => ({ ...a, type: 'agent' })),
        ...(state.skills || []).map(s => ({ ...s, type: 'skill' }))
    ];
    filteredItems = all.filter(i =>
        i.name.toLowerCase().includes(mentionPrefix.toLowerCase())
    ).slice(0, 8); // Max 8 items

    if (selectedIndex >= filteredItems.length) selectedIndex = 0;
};

const handleMentionKey = (e) => {
    if (e.key === 'ArrowUp') {
        selectedIndex = (selectedIndex - 1 + filteredItems.length) % filteredItems.length;
        renderMentions();
    } else if (e.key === 'ArrowDown') {
        selectedIndex = (selectedIndex + 1) % filteredItems.length;
        renderMentions();
    } else if (e.key === 'Enter' || e.key === 'Tab') {
        selectMention();
    } else if (e.key === 'Escape' || e.key === ' ') {
        stopMentionMode();
    } else if (e.key === 'Backspace') {
        if (mentionPrefix.length === 0) {
            stopMentionMode();
        } else {
            mentionPrefix = mentionPrefix.slice(0, -1);
            updateFilteredItems();
            renderMentions();
        }
    } else if (e.key.length === 1) {
        mentionPrefix += e.key;
        updateFilteredItems();
        renderMentions();

        // Se digitano un separatore di percorso, chiudiamo subito il menù delle skill
        if (e.key === '/' || e.key === '\\' || (filteredItems.length === 0 && mentionPrefix.length > 2)) {
            stopMentionMode();
        }
    }
};

const showMentionsPopup = () => {
    const popup = document.getElementById('qwen-mentions-popup');
    if (!popup || !qwenTerm) return;

    const core = qwenTerm._core;
    const charWidth = core._renderService?.dimensions?.actualCellWidth || 7.2;
    const charHeight = core._renderService?.dimensions?.actualCellHeight || 15;

    const cursorX = qwenTerm.buffer.active.cursorX;
    const cursorY = qwenTerm.buffer.active.cursorY;

    const termRect = qwenTerm.element.getBoundingClientRect();

    let left = termRect.left + (cursorX * charWidth);
    let top = termRect.top + (cursorY * charHeight) + 20;

    // Preveniamo che esca fuori dallo schermo
    if (top + 250 > window.innerHeight) {
        top = termRect.top + (cursorY * charHeight) - 260;
    }
    if (left + 220 > window.innerWidth) {
        left = window.innerWidth - 230;
    }

    popup.style.left = `${Math.max(10, left)}px`;
    popup.style.top = `${Math.max(10, top)}px`;
    popup.style.display = 'flex';
    popup.classList.remove('hidden');
    popup.style.zIndex = '999999';

    console.log(`[QWEN-MENTIONS] Popup shown at ${popup.style.left}, ${popup.style.top}`);
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
        const isSelected = idx === selectedIndex;
        const icon = item.type === 'agent' ? '🤖' : '⚡';
        return `
            <div class="mention-item ${isSelected ? 'selected' : ''}" onclick="window.selectQwenMentionByIndex(${idx})">
                <div class="mention-icon ${item.type}">${icon}</div>
                <div class="mention-info">
                    <div class="mention-name">${item.name}</div>
                    <div class="mention-type">${item.type}</div>
                </div>
            </div>
        `;
    }).join('');

    // Esposizione globale temporanea per il click
    window.selectQwenMentionByIndex = (idx) => {
        selectedIndex = idx;
        selectMention();
    };
};

const selectMention = () => {
    const item = filteredItems[selectedIndex];
    if (item) {
        const remaining = item.name.substring(mentionPrefix.length);
        window.electronAPI.terminalWrite('qwen-cli', remaining + ' ');
    }
    stopMentionMode();
};

// Esponi le funzioni globalmente per bottomPanel.js
window.startQwenCli = startQwenCli;
window.focusQwenCli = focusQwenCli;
window.initQwenCli = initQwenCli;
