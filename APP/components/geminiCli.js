import { state } from '../core/state.js';
import { triggerGlowOnMention } from '../core/uiUtils.js';

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

    // Monitor input for @mentions (Claude Pattern)
    geminiTerm.onKey(e => {
        const { domEvent } = e;
        if (isMentionMode) {
            handleMentionKey(domEvent);
        } else if (domEvent && domEvent.key === '@') {
            startMentionMode();
        }
    });

    geminiTerm.attachCustomKeyEventHandler((e) => {
        if (isMentionMode && filteredItems.length > 0) {
            if (['ArrowUp', 'ArrowDown', 'Enter', 'Escape', 'Tab'].includes(e.key)) {
                return false; 
            }
        }
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

    // Automatismi Context (GEMINI.md) - Replicating Claude logic
    await ensureGeminiMetadata(workspacePath);

    const res = await window.electronAPI.terminalCreate('gemini-cli', 'gemini', workspacePath);
    
    if (res && res.success) {
        isStarted = true;
        geminiTerm.focus();
    } else {
        geminiTerm.write(`\r\n\x1b[31;1mERRORE AVVIO GEMINI CLI\x1b[0m\r\n`);
        geminiTerm.write(`\x1b[33mDettaglio: ${res.error}\x1b[0m\r\n`);
    }
};

/**
 * Automatismi Gemini: Genera il file GEMINI.md con il contesto del workspace.
 */
const ensureGeminiMetadata = async (workspacePath) => {
    if (!workspacePath) return;
    try {
        const gitInfo = await window.electronAPI.getGitRemote(workspacePath);
        const projectIdentity = gitInfo.success ? gitInfo.url : workspacePath.split(/[/\\]/).filter(Boolean).pop();
        const openFiles = state.openFiles || [];
        const activeFile = state.activeFileId;

        const getRelative = (fullPath) => {
            if (!fullPath) return 'None';
            const normPath = fullPath.replace(/\\/g, '/');
            const normRoot = workspacePath.replace(/\\/g, '/');
            let relative = normPath.replace(normRoot, '');
            if (relative.startsWith('/')) relative = relative.substring(1);
            return relative || '.';
        };

        let content = `# ${projectIdentity.toUpperCase()} - GEMINI CONTEXT\n\n`;
        content += `This project is being managed by **GXCode IDE**.\n\n`;
        content += `## PROJECT IDENTITY\n`;
        content += `- **Remote/ID**: \`${projectIdentity}\`\n`;
        content += `- **Local Root**: \`.\` (Current Working Directory)\n\n`;

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
        content += `1. Prioritize working with the current open files provided in this context.\n`;
        content += `2. Refer to GEMINI_IDENTITY.md for project-specific directives.\n`;

        const separator = workspacePath.includes('\\') ? '\\' : '/';
        const targetFile = workspacePath.endsWith(separator) ? `${workspacePath}GEMINI.md` : `${workspacePath}${separator}GEMINI.md`;
        await window.electronAPI.fsWriteFile(targetFile, content);
        console.log("[GX-GEMINI] GEMINI.md generated.");
    } catch (err) {
        console.error("[GX-GEMINI] Metadata Error:", err);
    }
};

export const focusGeminiCli = () => {
    if (geminiTerm) {
        geminiTerm.focus();
        setTimeout(() => geminiFitAddon.fit(), 100);
    }
};

// --- MENTION AUTOCOMPLETE LOGIC (Mirroring Claude) ---

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
    if (popup) popup.style.display = 'none';
};

const updateFilteredItems = () => {
    const all = [
        ...(state.agents || []).map(a => ({ ...a, type: 'agent' })),
        ...(state.skills || []).map(s => ({ ...s, type: 'skill' }))
    ];
    filteredItems = all.filter(i => i.name.toLowerCase().includes(mentionPrefix.toLowerCase())).slice(0, 8);
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
        if (mentionPrefix.length === 0) stopMentionMode();
        else {
            mentionPrefix = mentionPrefix.slice(0, -1);
            updateFilteredItems();
            renderMentions();
        }
    } else if (e.key.length === 1) {
        mentionPrefix += e.key;
        updateFilteredItems();
        renderMentions();
        if (e.key === '/' || e.key === '\\') stopMentionMode();
    }
};

const showMentionsPopup = () => {
    const popup = document.getElementById('gemini-mentions-popup');
    if (!popup || !geminiTerm) return;

    const termRect = geminiTerm.element.getBoundingClientRect();
    const cursorX = geminiTerm.buffer.active.cursorX;
    const cursorY = geminiTerm.buffer.active.cursorY;
    const charWidth = 7.2; // Default approx
    const charHeight = 15; // Default approx
    
    popup.style.left = `${termRect.left + (cursorX * charWidth)}px`;
    popup.style.top = `${termRect.top + (cursorY * charHeight) + 20}px`;
    popup.style.display = 'flex';
    renderMentions();
};

const renderMentions = () => {
    const popup = document.getElementById('gemini-mentions-popup');
    if (!popup) return;
    if (filteredItems.length === 0) {
        popup.innerHTML = `<div class="p-2 text-[10px] text-gray-500 text-center">Nessun risultato</div>`;
        return;
    }
    popup.innerHTML = filteredItems.map((item, idx) => `
        <div class="mention-item ${idx === selectedIndex ? 'selected' : ''}" onclick="window.selectGeminiMention(${idx})">
            <div class="mention-name">${item.name}</div>
            <div class="mention-type">${item.type}</div>
        </div>
    `).join('');
    window.selectGeminiMention = (idx) => { selectedIndex = idx; selectMention(); };
};

const selectMention = () => {
    const item = filteredItems[selectedIndex];
    if (item) {
        const remaining = item.name.substring(mentionPrefix.length);
        window.electronAPI.terminalWrite('gemini-cli', remaining + ' ');
    }
    stopMentionMode();
};
