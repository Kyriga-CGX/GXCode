import { state } from '../core/state.js';
import { triggerGlowOnMention } from '../core/uiUtils.js';
import { ensureGeminiMetadata } from '../core/geminiApi.js';

let geminiTerm = null;
let geminiFitAddon = null;
let isStarted = false;
let glowedInThisSession = new Set();

// Mention Autocomplete State
let isMentionMode = false;
let mentionPrefix = '';
let selectedIndex = 0;
let filteredItems = [];

export const initGeminiCli = async () => {
    const container = document.getElementById('pane-gemini-cli');
    if (!container) return;
    if (geminiTerm) return; 

    // Elite HUD Creation
    const hud = document.createElement('div');
    hud.className = 'gemini-nano-hud';
    
    // Recupero Tier Dinamici
    const tiers = state.geminiConfig?.tiers || {};
    const modelHint = (tiers.balanced || 'pro').split('-').pop().toUpperCase();

    hud.innerHTML = `
        <div class="hud-item pr-3">
            <span class="hud-label-nano">WKS</span>
            <span class="hud-value-nano">${state.workspaceData?.name || 'Local'}</span>
        </div>
        <div class="hud-dot-sep"></div>
        <div class="hud-item pl-3 pr-3" title="Strategy: Dynamic Elite | Tiers: ${tiers.fast} / ${tiers.balanced}">
            <span class="hud-label-nano">CHRONOS</span>
            <span class="hud-value-nano text-blue-400">${modelHint}</span>
        </div>
        <div class="flex-grow"></div>
        <div class="hud-item">
            <div class="hud-status-dot active scale-[0.7]"></div>
            <span class="hud-value-nano opacity-40 uppercase text-[7px] tracking-widest pl-1">Link</span>
        </div>
    `;
    container.appendChild(hud);

    geminiTerm = new Terminal({
        cursorBlink: true,
        fontSize: 13,
        fontWeight: 'normal',
        fontFamily: '"JetBrains Mono", "Fira Code", Menlo, Monaco, monospace',
        letterSpacing: 0.5,
        theme: {
            background: 'transparent',
            foreground: '#e2e8f0',
            cursor: '#3b82f6',
            selection: 'rgba(59, 130, 246, 0.4)',
            black: '#1a1a1a',
            red: '#f87171',
            green: '#34d399',
            yellow: '#fbbf24',
            blue: '#60a5fa',
            magenta: '#c084fc',
            cyan: '#22d3ee',
            white: '#f1f5f9'
        },
        allowProposedApi: true
    });

    geminiFitAddon = new FitAddon.FitAddon();
    geminiTerm.loadAddon(geminiFitAddon);
    geminiTerm.open(container);
    
    // Boot animation
    container.classList.add('terminal-elite-ready');
    
    const ro = new ResizeObserver(() => {
        if (container.offsetWidth > 0) {
            geminiFitAddon.fit();
            if (geminiTerm) geminiTerm.refresh(0, geminiTerm.rows - 1);
        }
    });
    ro.observe(container);

    // Initial fit force after 300ms
    setTimeout(() => {
        if (container.offsetWidth > 0) {
            geminiFitAddon.fit();
            geminiTerm.refresh(0, geminiTerm.rows - 1);
        }
    }, 300);

    geminiTerm.onData(data => window.electronAPI.terminalWrite('gemini-cli', data));
    window.electronAPI.onTerminalData('gemini-cli', (data) => {
        geminiTerm.write(data);
        // Attiva l'illuminazione in barra laterale quando Gemini cita Agenti/Skill
        triggerGlowOnMention(data, state, glowedInThisSession);
    });
    geminiTerm.onResize(size => window.electronAPI.terminalResize('gemini-cli', size.cols, size.rows));

    // Monitor input per tag @mentions
    geminiTerm.onKey(e => {
        const { domEvent } = e;
        if (isMentionMode) {
            handleMentionKey(domEvent);
        } else if (domEvent && domEvent.key === '@') {
            startMentionMode();
        }
    });

    // Gestione tasti speciali per navigazione suggerimenti
    geminiTerm.attachCustomKeyEventHandler((e) => {
        if (isMentionMode && filteredItems.length > 0) {
            if (['ArrowUp', 'ArrowDown', 'Enter', 'Escape', 'Tab'].includes(e.key)) {
                return false; // Intercettiamo per il popup
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

    // Controllo se il comando gemini è disponibile nel sistema
    let isCommandFound = false;
    try {
        const check = await window.electronAPI.executeCommand('gemini --version');
        if (check && !check.error) {
            isCommandFound = true;
        }
    } catch (err) {}

    if (!isCommandFound) {
        geminiTerm.write('\r\n\x1b[33m[!] Gemini CLI non rilevato. Avvio installazione automatica...\x1b[0m\r\n');
        geminiTerm.write('\x1b[34m[NPM] Esecuzione: npm install -g @google/gemini-cli\x1b[0m\r\n');
        geminiTerm.write('\x1b[90mQuesta operazione potrebbe richiedere alcuni secondi...\x1b[0m\r\n');

        try {
            // Esegue l'installazione globale
            const installRes = await window.electronAPI.executeCommand('npm install -g @google/gemini-cli');
            
            if (installRes && !installRes.error) {
                geminiTerm.write('\x1b[32m[✓] Installazione completata con successo!\x1b[0m\r\n');
                // Piccola pausa per dare tempo al sistema di "vedere" il nuovo comando
                await new Promise(r => setTimeout(r, 1500));
            } else {
                const errorMsg = installRes ? (installRes.stderr || installRes.error) : "Errore sconosciuto";
                throw new Error(errorMsg);
            }
        } catch (err) {
            geminiTerm.write('\r\n\x1b[31;1mERRORE INSTALLAZIONE AUTOMATICA\x1b[0m\r\n');
            geminiTerm.write(`\x1b[33mDettaglio: ${err.message}\x1b[0m\r\n`);
            geminiTerm.write('\x1b[38;5;244mIl comando ha fallito. Prova ad eseguire manualmente in un terminale esterno:\x1b[0m\r\n');
            geminiTerm.write('   \x1b[1;36mnpm install -g @google/gemini-cli\x1b[0m\r\n');
            geminiTerm.write('\x1b[90m(Potrebbe essere necessario eseguire come Amministratore)\x1b[0m\r\n');
            return;
        }
    }

    geminiTerm.write('\x1b[32m[✓] Gemini CLI rilevato. Avvio sessione interattiva...\x1b[0m\r\n');

    const workspacePath = state.workspaceData?.path || "";
    const activeModel = state.geminiConfig?.activeModel || "gemini-1.5-pro";
    
    // Genera/Aggiorna il file di identità GEMINI.md
    await ensureGeminiMetadata(workspacePath);
    
    // Update HUD (Se i puntatori ID sono stati iniettati)
    const wsLabel = document.getElementById('ghud-workspace');
    const modelLabel = document.getElementById('ghud-model');
    const statusDot = document.getElementById('ghud-status');
    const statusText = document.getElementById('ghud-status-text');

    if (wsLabel) wsLabel.textContent = workspacePath.split(/[\\/]/).pop() || 'GX Workspace';
    if (modelLabel) modelLabel.textContent = activeModel;
    if (statusDot) statusDot.classList.add('active');
    if (statusText) statusText.textContent = 'syncing';

    // Passiamo la API Key dallo stato per l'autenticazione automatica
    const res = await window.electronAPI.terminalCreate('gemini-cli', 'gemini', workspacePath, state.geminiApiKey);
    
    if (res && res.success) {
        isStarted = true;
        if (statusText) statusText.textContent = 'active';
        geminiTerm.focus();
    } else {
        if (statusDot) statusDot.classList.remove('active');
        if (statusText) statusText.textContent = 'failed';
        geminiTerm.write(`\r\n\x1b[31;1mERRORE AVVIO GEMINI CLI\x1b[0m\r\n`);
        geminiTerm.write(`\x1b[33mDettaglio: ${res.error}\x1b[0m\r\n`);
    }
};

// --- LOGICA AUTOCOMPLETE @MENTIONS (REPLICA CLAUDE) ---

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
        popup.style.display = 'none';
        popup.classList.add('hidden');
    }
};

const updateFilteredItems = () => {
    const all = [
        ...(state.agents || []).map(a => ({ ...a, type: 'agent' })),
        ...(state.skills || []).map(s => ({ ...s, type: 'skill' }))
    ];
    filteredItems = all.filter(i => 
        i.name.toLowerCase().includes(mentionPrefix.toLowerCase())
    ).slice(0, 8);
    
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

        if (e.key === '/' || e.key === '\\' || (filteredItems.length === 0 && mentionPrefix.length > 2)) {
            stopMentionMode();
        }
    }
};

const showMentionsPopup = () => {
    const popup = document.getElementById('claude-mentions-popup');
    if (!popup || !geminiTerm) return;

    const core = geminiTerm._core;
    const charWidth = core._renderService?.dimensions?.actualCellWidth || 7.8;
    const charHeight = core._renderService?.dimensions?.actualCellHeight || 15;
    
    const cursorX = geminiTerm.buffer.active.cursorX;
    const cursorY = geminiTerm.buffer.active.cursorY;
    
    const termRect = geminiTerm.element.getBoundingClientRect();
    
    let left = termRect.left + (cursorX * charWidth);
    let top = termRect.top + (cursorY * charHeight) + 20;

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
            <div class="mention-item ${isSelected ? 'selected' : ''}" onclick="window.selectGeminiMentionByIndex(${idx})">
                <div class="mention-icon ${item.type}">${icon}</div>
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
        const remaining = item.name.substring(mentionPrefix.length);
        window.electronAPI.terminalWrite('gemini-cli', remaining + ' ');
    }
    stopMentionMode();
};

export const focusGeminiCli = () => {
    if (geminiTerm) {
        geminiTerm.focus();
        setTimeout(() => geminiFitAddon.fit(), 100);
    }
};
