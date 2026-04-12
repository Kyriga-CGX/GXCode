/**
 * terminalSplitHandlers.js - IPC handlers per TerminalSplitManager
 * 
 * Responsabilità:
 * - Creare terminali multipli
 * - Gestire split layout (orizzontale/verticale)
 * - Scrivere/leggere dai terminali
 * - Resize terminali
 * - Chiudere terminali
 * - Configurazione terminale
 */

const { ipcMain } = require('electron');
const terminalModule = require('../modules/terminal/TerminalSplitManager');

function registerTerminalSplitHandlers() {
    const manager = terminalModule.getInstance();

    // === Gestione Terminali ===

    ipcMain.handle('terminal-split:create', async (event, options = {}) => {
        try {
            const terminalId = manager.createTerminal(options);
            return { success: true, terminalId };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle('terminal-split:start', async (event, terminalId, cols, rows) => {
        try {
            manager.startTerminal(terminalId, cols, rows);
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle('terminal-split:write', async (event, terminalId, data) => {
        try {
            manager.writeToTerminal(terminalId, data);
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle('terminal-split:resize', async (event, terminalId, cols, rows) => {
        try {
            manager.resizeTerminal(terminalId, cols, rows);
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle('terminal-split:close', async (event, terminalId) => {
        try {
            manager.closeTerminal(terminalId);
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle('terminal-split:get-active', async () => {
        try {
            const session = manager.getActiveSession();
            return { success: true, session: session ? {
                id: session.id,
                name: session.name,
                shell: session.shell,
                cwd: session.cwd,
                isRunning: session.isRunning
            } : null };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle('terminal-split:set-active', async (event, terminalId) => {
        try {
            manager.setActiveSession(terminalId);
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    // === Split Layout ===

    ipcMain.handle('terminal-split:split-horizontal', async () => {
        try {
            const terminalId = manager.splitHorizontal();
            return { success: true, terminalId };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle('terminal-split:split-vertical', async () => {
        try {
            const terminalId = manager.splitVertical();
            return { success: true, terminalId };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle('terminal-split:single-layout', async () => {
        try {
            manager.setSingleLayout();
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle('terminal-split:get-layout', async () => {
        try {
            const layout = manager.getLayout();
            return { success: true, layout };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    // === Sessioni ===

    ipcMain.handle('terminal-split:get-all-sessions', async () => {
        try {
            const sessions = manager.getAllSessions();
            return { success: true, sessions };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    // === Configurazione ===

    ipcMain.handle('terminal-split:get-config', async () => {
        try {
            const config = manager.getConfig();
            return { success: true, config };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle('terminal-split:update-config', async (event, newConfig) => {
        try {
            manager.updateConfig(newConfig);
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    // === Status ===

    ipcMain.handle('terminal-split:get-status', async () => {
        try {
            const status = manager.getStatus();
            return { success: true, status };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    console.log('[TerminalSplitHandlers] Registered');
}

module.exports = { registerTerminalSplitHandlers };
