const { ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
let pty;
try { pty = require('node-pty'); } catch (e) { console.error("PTY missing."); }

function registerPtyHandlers() {
    const ptyProcesses = {};

    ipcMain.handle('terminal-create', (event, id, shellType, workspacePath, apiKey) => {
        if (!pty) return { success: false, error: "node-pty not loaded" };
        
        let safeCwd = workspacePath;
        if (safeCwd && safeCwd.endsWith('.code-workspace')) {
            try {
                const content = fs.readFileSync(safeCwd, 'utf8');
                const config = JSON.parse(content);
                if (config.folders && config.folders.length > 0) {
                    const firstFolder = config.folders[0].path;
                    safeCwd = path.isAbsolute(firstFolder) ? firstFolder : path.join(path.dirname(workspacePath), firstFolder);
                }
            } catch (e) { console.error("PTY Workspace parse error:", e.message); }
        }
        if (!safeCwd || !fs.existsSync(safeCwd)) safeCwd = process.cwd();

        let shell = process.platform === 'win32' ? 'powershell.exe' : 'bash';
        let args = [];

        if (shellType === 'claude') { shell = 'npx.cmd'; args = ['@anthropic-ai/claude-code']; }
        else if (shellType === 'gemini') { 
            shell = process.platform === 'win32' ? 'gemini.cmd' : 'gemini'; 
        }
        else if (shellType === 'bash' && process.platform === 'win32') {
            const commonPaths = ['C:\\Program Files\\Git\\bin\\bash.exe', 'C:\\Program Files (x86)\\Git\\bin\\bash.exe', path.join(os.homedir(), 'AppData\\Local\\Programs\\Git\\bin\\bash.exe')];
            for (const p of commonPaths) { if (fs.existsSync(p)) { shell = p; break; } }
        }

        try {
            const ptyProcess = pty.spawn(shell, args, {
                name: 'xterm-color', cols: 80, rows: 24, cwd: safeCwd,
                env: { 
                    ...process.env, 
                    ANTHROPIC_API_KEY: apiKey, 
                    GEMINI_API_KEY: apiKey,
                    GOOGLE_API_KEY: apiKey,
                    CI: 'false', 
                    TERM: 'xterm-256color' 
                }
            });
            ptyProcesses[id] = ptyProcess;
            ptyProcess.onData(data => event.sender.send(`terminal-stdout-${id}`, data));
            return { success: true };
        } catch (err) { return { success: false, error: err.message }; }
    });

    ipcMain.handle('terminal-write', (event, id, data) => { if (ptyProcesses[id]) ptyProcesses[id].write(data); });
    ipcMain.handle('terminal-resize', (event, id, cols, rows) => { if (ptyProcesses[id]) ptyProcesses[id].resize(cols, rows); });
}

module.exports = { registerPtyHandlers };
