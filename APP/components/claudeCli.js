import { state } from '../core/state.js';
import { triggerGlowOnMention } from '../core/uiUtils.js';

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

    // Monitor input for @mentions
    claudeTerm.onKey(e => {
        const { domEvent } = e;
        
        if (isMentionMode) {
            handleMentionKey(domEvent);
        } else if (domEvent && domEvent.key === '@') {
            startMentionMode();
        }
    });

    // Supporto Professionale per Copia/Incolla (Scorciatoie Tastiera)
    claudeTerm.attachCustomKeyEventHandler((e) => {
        // Se siamo in mention mode, blocchiamo le frecce/invio per farli andare al popup
        // Importante: intercettiamo solo se abbiamo suggerimenti validi, altrimenti 
        // lasciamo che Claude Code gestisca i suoi completamenti nativi (es. file @src/)
        if (isMentionMode && filteredItems.length > 0) {
            if (['ArrowUp', 'ArrowDown', 'Enter', 'Escape', 'Tab'].includes(e.key)) {
                return false; 
            }
        }
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

    // Iniezione Context Dinamico (CLAUDE.md)
    await ensureClaudeMetadata(workspacePath);

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

/**
 * Genera o aggiorna il file CLAUDE.md nella root del progetto per fornire contesto all'IA.
 */
const ensureClaudeMetadata = async (workspacePath) => {
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
        const targetFile = workspacePath.endsWith(separator) ? `${workspacePath}CLAUDE.md` : `${workspacePath}${separator}CLAUDE.md`;
        
        await window.electronAPI.fsWriteFile(targetFile, content);
        console.log("[CLAUDE-CLI-V3] Identità Git e contesto iniettati con successo.");
    } catch (err) {
        console.error("[CLAUDE-CLI] Failed to inject context:", err);
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
    console.log("[CLAUDE-MENTIONS] Mode started. Items:", filteredItems.length);
    showMentionsPopup();
};

const stopMentionMode = () => {
    isMentionMode = false;
    mentionPrefix = '';
    const popup = document.getElementById('claude-mentions-popup');
    if (popup) {
        popup.style.display = 'none';
        popup.classList.add('hidden');
    }
    console.log("[CLAUDE-MENTIONS] Mode stopped.");
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
        // per lasciare che Claude Code gestisca i suoi completamenti nativi (es. @src/...)
        if (e.key === '/' || e.key === '\\' || (filteredItems.length === 0 && mentionPrefix.length > 2)) {
            stopMentionMode();
        }
    }
};

const showMentionsPopup = () => {
    const popup = document.getElementById('claude-mentions-popup');
    if (!popup || !claudeTerm) return;

    const core = claudeTerm._core;
    const charWidth = core._renderService?.dimensions?.actualCellWidth || 7.2;
    const charHeight = core._renderService?.dimensions?.actualCellHeight || 15;
    
    const cursorX = claudeTerm.buffer.active.cursorX;
    const cursorY = claudeTerm.buffer.active.cursorY;
    
    const termRect = claudeTerm.element.getBoundingClientRect();
    
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
    popup.style.zIndex = '999999'; // Super high priority
    
    console.log(`[CLAUDE-MENTIONS] Popup shown at ${popup.style.left}, ${popup.style.top}`);
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
        const isSelected = idx === selectedIndex;
        const icon = item.type === 'agent' ? '🤖' : '⚡';
        return `
            <div class="mention-item ${isSelected ? 'selected' : ''}" onclick="window.selectClaudeMentionByIndex(${idx})">
                <div class="mention-icon ${item.type}">${icon}</div>
                <div class="mention-info">
                    <div class="mention-name">${item.name}</div>
                    <div class="mention-type">${item.type}</div>
                </div>
            </div>
        `;
    }).join('');
    
    // Esposizione globale temporanea per il click
    window.selectClaudeMentionByIndex = (idx) => {
        selectedIndex = idx;
        selectMention();
    };
};

const selectMention = () => {
    const item = filteredItems[selectedIndex];
    if (item) {
        // Inviamo solo la parte MANCANTE del nome (escludendo il prefisso già digitato dopo @)
        // Ma attenzione: Claude CLI potrebbe non supportare l'inserimento parziale se non siamo sincronizzati.
        // La strategia più sicura è inviare il nome completo (senza la @ che è già stata inviata al PTY dal terminale automaticamente quando l'abbiamo premuta)
        
        const remaining = item.name.substring(mentionPrefix.length);
        window.electronAPI.terminalWrite('claude-cli', remaining + ' ');
    }
    stopMentionMode();
};

