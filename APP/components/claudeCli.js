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

    // Supporto Professionale per Copia/Incolla (Scorciatoie Tastiera)
    claudeTerm.attachCustomKeyEventHandler((e) => {
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
