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
        ipcMain.emit('gx-debug:internal:stop'); // Signal testHandlers
        if (activeDebugger) activeDebugger.stop();
        return true;
    });

    ipcMain.handle('debug-step', async () => {
        ipcMain.emit('gx-debug:internal:step'); // Signal testHandlers
        if (activeDebugger) activeDebugger.stepOver();
        return true;
    });

    ipcMain.handle('debug-continue', async () => {
        ipcMain.emit('gx-debug:internal:continue'); // Signal testHandlers
        if (activeDebugger) activeDebugger.continue();
        return true;
    });
}

module.exports = { registerDebugHandlers };
