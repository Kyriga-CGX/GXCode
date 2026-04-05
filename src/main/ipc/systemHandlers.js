const { ipcMain, app, clipboard, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const { exec, execSync } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');

function registerSystemHandlers() {
    let pendingUpdateCheck = null;
    let currentAiContext = '.GXCODE';

    ipcMain.handle('window-control', (event, action) => {
        const win = event.sender.getOwnerBrowserWindow();
        if (!win) return;
        if (action === 'minimize') win.minimize();
        else if (action === 'maximize') win.isMaximized() ? win.unmaximize() : win.maximize();
        else if (action === 'close') win.close();
    });

    ipcMain.on('open-devtools', (event) => {
        const win = event.sender.getOwnerBrowserWindow();
        if (win) win.webContents.openDevTools();
    });

    ipcMain.handle('check-for-updates', async () => {
        if (!app.isPackaged) return false;
        if (pendingUpdateCheck) return !!(await pendingUpdateCheck).updateInfo;
        pendingUpdateCheck = autoUpdater.checkForUpdates();
        try { const res = await pendingUpdateCheck; return !!res.updateInfo; }
        catch (e) { return false; } finally { pendingUpdateCheck = null; }
    });

    ipcMain.handle('perform-update', async () => {
        if (!app.isPackaged) return false;
        try { await autoUpdater.downloadUpdate(); return true; } catch (e) { return false; }
    });

    ipcMain.on('quit-and-install', () => autoUpdater.quitAndInstall());

    ipcMain.handle('get-app-version', () => app.getVersion());

    ipcMain.handle('clipboard-read', () => clipboard.readText());
    ipcMain.handle('clipboard-write', (event, text) => { if (text) clipboard.writeText(text); return true; });

    ipcMain.handle('get-active-ports', async () => {
        try {
            const { execSync } = require('child_process');
            const cmd = process.platform === 'win32' ? 'netstat -ano' : 'lsof -i -P -n | grep LISTEN';
            const output = execSync(cmd, { encoding: 'utf8' });
            const lines = output.split('\n');
            const ports = [];

            if (process.platform === 'win32') {
                lines.forEach(line => {
                    if (line.includes('LISTENING')) {
                        const parts = line.trim().split(/\s+/);
                        if (parts.length >= 5) {
                            const addr = parts[1];
                            const port = addr.split(':').pop();
                            const pid = parts[4];
                            ports.push({ protocol: parts[0], address: addr, port, pid });
                        }
                    }
                });
            } else {
                lines.forEach(line => {
                    const parts = line.trim().split(/\s+/);
                    if (parts.length >= 9) {
                        const pid = parts[1];
                        const name = parts[0];
                        const addr = parts[8];
                        const port = addr.split(':').pop();
                        ports.push({ protocol: 'TCP', address: addr, port, pid, name });
                    }
                });
            }
            const uniquePorts = Array.from(new Set(ports.map(p => p.port))).map(port => ports.find(p => p.port === port));
            return { success: true, ports: uniquePorts };
        } catch (e) { return { success: false, error: e.message }; }
    });

    ipcMain.handle('kill-process', async (event, pid) => {
        try {
            const { execSync } = require('child_process');
            const cmd = process.platform === 'win32' ? `taskkill /F /PID ${pid}` : `kill -9 ${pid}`;
            execSync(cmd);
            return { success: true };
        } catch (e) { return { success: false, error: e.message }; }
    });

    ipcMain.handle('execute-command', async (event, cmd, customCwd) => {
        const lower = cmd.toLowerCase().trim();
        if (lower.startsWith('claude')) currentAiContext = '.claude';
        else if (lower.startsWith('gemini')) currentAiContext = '.gemini';
        return new Promise(resolve => {
            exec(cmd, { cwd: customCwd || process.cwd() }, (err, stdout, stderr) => resolve({ error: err?.message, stdout, stderr }));
        });
    });

    ipcMain.handle('file-lint', async (event, filePath) => {
        try {
            const out = execSync(`npx eslint "${filePath}" --format json`, { encoding: 'utf8' });
            return { success: true, problems: JSON.parse(out) };
        } catch (e) { return { success: false, error: e.message }; }
    });
}

module.exports = { registerSystemHandlers };
