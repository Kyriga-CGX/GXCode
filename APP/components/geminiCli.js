import { state } from '../core/state.js';
import { triggerGlowOnMention } from '../core/uiUtils.js';

let glowedInThisSession = new Set();
let geminiTerm = null;
let geminiFitAddon = null;
let isStarted = false;

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
            cursor: '#60a5fa',
            selection: 'rgba(96, 165, 250, 0.3)'
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

    geminiTerm.attachCustomKeyEventHandler((e) => {
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

    geminiTerm.write('\x1b[34m[GXCODE] Avvio Gemini Elite CLI Agent...\x1b[0m\r\n');
    
    const workspacePath = state.workspaceData?.path || process.cwd();
    // Launching via npm script we defined earlier
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
