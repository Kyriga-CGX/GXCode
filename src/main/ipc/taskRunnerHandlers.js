/**
 * taskRunnerHandlers.js - IPC handlers per TaskRunner
 * 
 * Responsabilità:
 * - Eseguire tasks da tasks.json
 * - Ottenere lista tasks
 * - Fermare task in esecuzione
 * - Ricaricare configurazione tasks
 * - Monitorare output in real-time
 */

const { ipcMain } = require('electron');
const taskRunnerModule = require('../modules/terminal/TaskRunner');

function registerTaskRunnerHandlers(mainWindow) {
    const runner = taskRunnerModule.getInstance();

    // === Gestione Tasks ===

    ipcMain.handle('task-runner:get-all', async () => {
        try {
            const tasks = runner.getTasks();
            return { success: true, tasks };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle('task-runner:get-by-label', async (event, label) => {
        try {
            const task = runner.getTaskByLabel(label);
            return { success: true, task };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle('task-runner:get-default', async (event, group) => {
        try {
            const task = runner.getDefaultTask(group);
            return { success: true, task };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    // === Esecuzione ===

    ipcMain.handle('task-runner:run', async (event, taskLabel, options = {}) => {
        try {
            const result = await runner.run(taskLabel, options);
            return { success: true, result };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle('task-runner:stop', async () => {
        try {
            runner.stop();
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle('task-runner:is-running', async () => {
        try {
            const isRunning = runner.isRunning();
            return { success: true, isRunning };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle('task-runner:get-current', async () => {
        try {
            const currentTask = runner.getCurrentTask();
            return { success: true, currentTask };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    // === Reload e Status ===

    ipcMain.handle('task-runner:reload', async () => {
        try {
            await runner.reload();
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle('task-runner:get-status', async () => {
        try {
            const status = runner.getStatus();
            return { success: true, status };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    // === Forward eventi al renderer ===
    // Questi eventi vengono emessi dal TaskRunner e forwarded alla UI

    const eventBus = require('../core/EventBus');

    eventBus.on('task:start', (data) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('task-runner:event', {
                type: 'start',
                data
            });
        }
    });

    eventBus.on('task:output', (data) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('task-runner:event', {
                type: 'output',
                data
            });
        }
    });

    eventBus.on('task:end', (data) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('task-runner:event', {
                type: 'end',
                data
            });
        }
    });

    eventBus.on('task:error', (data) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('task-runner:event', {
                type: 'error',
                data
            });
        }
    });

    eventBus.on('task:stopped', (data) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('task-runner:event', {
                type: 'stopped',
                data
            });
        }
    });

    console.log('[TaskRunnerHandlers] Registered');
}

module.exports = { registerTaskRunnerHandlers };
