/**
 * lspHandlers.js - IPC handlers per Language Server Protocol
 * 
 * Responsabilità:
 * - Avviare/arrestare language server
 * - Gestire richieste completion
 * - Gestire diagnostics
 * - Gestire hover, definition, references
 * - Gestire formatting
 * - Gestire rename
 */

const { ipcMain } = require('electron');
const lspModule = require('../modules/editor/LSPClient');
const lspManagerModule = require('../modules/editor/LSPManager');

function registerLSPHandlers(mainWindow) {
    const manager = lspManagerModule.getInstance();

    // === Gestione Language Server ===

    ipcMain.handle('lsp:initialize', async (event, workspacePath) => {
        try {
            await manager.init({ workspacePath });
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle('lsp:start-server', async (event, language) => {
        try {
            await manager.startServer(language);
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle('lsp:stop-server', async (event, language) => {
        try {
            await manager.stopServer(language);
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle('lsp:restart-server', async (event, language) => {
        try {
            await manager.restartServer(language);
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle('lsp:get-status', async () => {
        try {
            const status = manager.getStatus();
            return { success: true, status };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    // === Document Management ===

    ipcMain.handle('lsp:open-document', async (event, filePath, content) => {
        try {
            await manager.openDocument(filePath, content);
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle('lsp:close-document', async (event, filePath) => {
        try {
            await manager.closeDocument(filePath);
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle('lsp:change-document', async (event, filePath, changes) => {
        try {
            await manager.changeDocument(filePath, changes);
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    // === Completion ===

    ipcMain.handle('lsp:completion', async (event, filePath, line, column) => {
        try {
            const completions = await manager.getCompletion(filePath, line, column);
            return { success: true, completions };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle('lsp:completion-resolve', async (event, completionItem) => {
        try {
            const resolved = await manager.resolveCompletion(completionItem);
            return { success: true, resolved };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    // === Diagnostics ===

    ipcMain.handle('lsp:get-diagnostics', async (event, filePath) => {
        try {
            const diagnostics = manager.getDiagnostics(filePath);
            return { success: true, diagnostics };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle('lsp:get-all-diagnostics', async () => {
        try {
            const diagnostics = manager.getAllDiagnostics();
            return { success: true, diagnostics };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    // === Hover ===

    ipcMain.handle('lsp:hover', async (event, filePath, line, column) => {
        try {
            const hover = await manager.getHover(filePath, line, column);
            return { success: true, hover };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    // === Definition ===

    ipcMain.handle('lsp:definition', async (event, filePath, line, column) => {
        try {
            const definition = await manager.getDefinition(filePath, line, column);
            return { success: true, definition };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    // === References ===

    ipcMain.handle('lsp:references', async (event, filePath, line, column) => {
        try {
            const references = await manager.getReferences(filePath, line, column);
            return { success: true, references };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    // === Rename ===

    ipcMain.handle('lsp:rename', async (event, filePath, line, column, newName) => {
        try {
            const edits = await manager.rename(filePath, line, column, newName);
            return { success: true, edits };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    // === Formatting ===

    ipcMain.handle('lsp:format-document', async (event, filePath) => {
        try {
            const edits = await manager.formatDocument(filePath);
            return { success: true, edits };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle('lsp:format-range', async (event, filePath, startLine, endLine) => {
        try {
            const edits = await manager.formatRange(filePath, startLine, endLine);
            return { success: true, edits };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    // === Code Actions ===

    ipcMain.handle('lsp:code-actions', async (event, filePath, startLine, endLine, context) => {
        try {
            const actions = await manager.getCodeActions(filePath, startLine, endLine, context);
            return { success: true, actions };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle('lsp:execute-command', async (event, command, args) => {
        try {
            const result = await manager.executeCommand(command, args);
            return { success: true, result };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    // === Signature Help ===

    ipcMain.handle('lsp:signature-help', async (event, filePath, line, column) => {
        try {
            const help = await manager.getSignatureHelp(filePath, line, column);
            return { success: true, help };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    // === Configuration ===

    ipcMain.handle('lsp:update-config', async (event, config) => {
        try {
            manager.updateConfig(config);
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    // === Forward eventi al renderer ===

    const eventBus = require('../core/EventBus');

    // Diagnostics pubblicati dai server
    eventBus.on('lsp:diagnostics', (data) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('lsp:diagnostics', data);
        }
    });

    // Server started/stopped
    eventBus.on('lsp:started', (data) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('lsp:server-started', data);
        }
    });

    eventBus.on('lsp:closed', (data) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('lsp:server-closed', data);
        }
    });

    // Errori
    eventBus.on('lsp:error', (data) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('lsp:error', data);
        }
    });

    console.log('[LSPHandlers] Registered');
}

module.exports = { registerLSPHandlers };
