import { state } from '../core/state.js';

let claudeTerm = null;
let claudeFitAddon = null;
let isStarted = false;

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
    window.electronAPI.onTerminalData('claude-cli', (data) => claudeTerm.write(data));
    claudeTerm.onResize(size => window.electronAPI.terminalResize('claude-cli', size.cols, size.rows));

    // Funzionalità Pro: Incolla con Tasto Destro (Richiesto dall'utente)
    container.addEventListener('contextmenu', async (e) => {
        e.preventDefault();
        try {
            const text = await window.electronAPI.clipboardRead();
            if (text) {
                window.electronAPI.terminalWrite('claude-cli', text);
            }
        } catch (err) {
            console.error("[CLAUDE-CLI] Errore incolla:", err);
        }
    });

    console.log("[CLAUDE-CLI] Terminal initialized.");
};

export const startClaudeCli = async () => {
    if (isStarted) return;
    
    if (!claudeTerm) await initClaudeCli();

    claudeTerm.write('\x1b[33m[GXCODE] Avvio Claude Code CLI...\x1b[0m\r\n');
    
    const apiKey = state.anthropicApiKey;
    const workspacePath = state.workspaceData?.path;

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
