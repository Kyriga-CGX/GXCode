/**
 * chromeDebuggerHandlers.js - IPC handlers per ChromeDebugger
 * 
 * Responsabilità:
 * - Lanciare Chrome/Edge con debug
 * - Connettersi a browser esistente
 * - Gestire breakpoints
 * - Step debugging (over, into, out)
 * - Valutazione espressioni
 * - Navigazione e reload
 * - Ottenere stato debugger
 */

const { ipcMain } = require('electron');
const ChromeDebugger = require('../modules/debugger/ChromeDebugger');

function registerChromeDebuggerHandlers(mainWindow) {
    let activeDebugger = null;

    // === Gestione Browser ===

    ipcMain.handle('chrome-debug:launch', async (event, options = {}) => {
        try {
            if (activeDebugger && activeDebugger.isRunning) {
                await activeDebugger.stop();
                activeDebugger = null;
            }

            activeDebugger = new ChromeDebugger(options);
            const result = await activeDebugger.launch(options.url);
            
            return { success: true, result };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle('chrome-debug:stop', async () => {
        try {
            if (activeDebugger) {
                await activeDebugger.stop();
                activeDebugger = null;
            }
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle('chrome-debug:get-status', async () => {
        try {
            if (!activeDebugger) {
                return { success: true, status: { isRunning: false, isPaused: false } };
            }
            const status = activeDebugger.getStatus();
            return { success: true, status };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    // === Navigazione ===

    ipcMain.handle('chrome-debug:navigate', async (event, url) => {
        try {
            if (!activeDebugger || !activeDebugger.isRunning) {
                return { success: false, error: 'Browser not running' };
            }
            await activeDebugger.navigate(url);
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle('chrome-debug:reload', async () => {
        try {
            if (!activeDebugger || !activeDebugger.isRunning) {
                return { success: false, error: 'Browser not running' };
            }
            await activeDebugger.reload();
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    // === Breakpoints ===

    ipcMain.handle('chrome-debug:set-breakpoint', async (event, url, lineNumber, condition = '') => {
        try {
            if (!activeDebugger || !activeDebugger.isRunning) {
                return { success: false, error: 'Browser not running' };
            }
            const result = await activeDebugger.setBreakpoint(url, lineNumber, condition);
            return { success: true, result };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle('chrome-debug:remove-breakpoint', async (event, breakpointId) => {
        try {
            if (!activeDebugger || !activeDebugger.isRunning) {
                return { success: false, error: 'Browser not running' };
            }
            await activeDebugger.removeBreakpoint(breakpointId);
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    // === Step Debugging ===

    ipcMain.handle('chrome-debug:step-over', async () => {
        try {
            if (!activeDebugger || !activeDebugger.isRunning) {
                return { success: false, error: 'Browser not running' };
            }
            await activeDebugger.stepOver();
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle('chrome-debug:step-into', async () => {
        try {
            if (!activeDebugger || !activeDebugger.isRunning) {
                return { success: false, error: 'Browser not running' };
            }
            await activeDebugger.stepInto();
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle('chrome-debug:step-out', async () => {
        try {
            if (!activeDebugger || !activeDebugger.isRunning) {
                return { success: false, error: 'Browser not running' };
            }
            await activeDebugger.stepOut();
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle('chrome-debug:continue', async () => {
        try {
            if (!activeDebugger || !activeDebugger.isRunning) {
                return { success: false, error: 'Browser not running' };
            }
            await activeDebugger.continue();
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    // === Evaluation ===

    ipcMain.handle('chrome-debug:evaluate', async (event, expression) => {
        try {
            if (!activeDebugger || !activeDebugger.isRunning) {
                return { success: false, error: 'Browser not running' };
            }
            const result = await activeDebugger.evaluate(expression);
            return { success: true, result };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    // === Forward eventi CDP al renderer ===

    const eventBus = require('../core/EventBus');

    // Debugger paused
    eventBus.on('debug:paused', (data) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('chrome-debug:paused', data);
        }
    });

    // Debugger resumed
    eventBus.on('debug:resumed', (data) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('chrome-debug:resumed', data);
        }
    });

    // Variables update
    eventBus.on('debug:variables', (data) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('chrome-debug:variables', data);
        }
    });

    // Breakpoint events
    eventBus.on('debug:breakpoint-set', (data) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('chrome-debug:breakpoint-set', data);
        }
    });

    eventBus.on('debug:breakpoint-removed', (data) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('chrome-debug:breakpoint-removed', data);
        }
    });

    // Debug stopped
    eventBus.on('debug:stopped', (data) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('chrome-debug:stopped', data);
        }
    });

    // Browser events
    eventBus.on('browser:launched', (data) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('chrome-debug:browser-launched', data);
        }
    });

    eventBus.on('browser:exited', (data) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('chrome-debug:browser-exited', data);
        }
    });

    // CDP raw events (per advanced users)
    eventBus.on('cdp:Runtime.executionContextCreated', (data) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('chrome-debug:context-created', data);
        }
    });

    console.log('[ChromeDebuggerHandlers] Registered');
}

module.exports = { registerChromeDebuggerHandlers };
