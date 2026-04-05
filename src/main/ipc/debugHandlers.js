const { ipcMain } = require('electron');
const { NodeDebugger } = require('../services/debugger');

function registerDebugHandlers(mainWindow) {
    let activeDebugger = null;

    ipcMain.handle('debug-start', async (event, filePath, breakpoints) => {
        if (activeDebugger) activeDebugger.stop();
        activeDebugger = new NodeDebugger(mainWindow);
        return await activeDebugger.start(filePath, breakpoints);
    });

    ipcMain.handle('debug-stop', async () => {
        if (activeDebugger) activeDebugger.stop();
        return true;
    });

    ipcMain.handle('debug-step', async () => {
        if (activeDebugger) activeDebugger.stepOver();
        return true;
    });

    ipcMain.handle('debug-continue', async () => {
        if (activeDebugger) activeDebugger.continue();
        return true;
    });
}

module.exports = { registerDebugHandlers };
