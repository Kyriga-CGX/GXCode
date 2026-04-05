const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const { createApiServer } = require('./api/server');
const { registerAiRoutes } = require('./api/routes/ai');
const { registerExternalRoutes } = require('./api/routes/external');
const { registerMarketplaceRoutes } = require('./api/routes/marketplace');
const { registerFsHandlers } = require('./ipc/fsHandlers');
const { registerGitHandlers } = require('./ipc/gitHandlers');
const { registerTestHandlers } = require('./ipc/testHandlers');
const { registerPtyHandlers } = require('./ipc/ptyHandlers');
const { registerAiHandlers } = require('./ipc/aiHandlers');
const { registerSystemHandlers } = require('./ipc/systemHandlers');
const { registerDebugHandlers } = require('./ipc/debugHandlers');

const GOOGLE_CONFIG = {
    clientId: "411114937479-jfa96807lfiuo4rlnqd362598s7dj5va.apps.googleusercontent.com",
    clientSecret: "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",
    redirectUri: "http://localhost:5000/gemini/callback"
};

function createWindow() {
    const win = new BrowserWindow({
        width: 1400, height: 900, frame: false,
        icon: path.join(process.cwd(), "APP", "assets", "logo.png"),
        webPreferences: { nodeIntegration: false, contextIsolation: true, preload: path.join(process.cwd(), "preload.js"), webviewTag: true }
    });
    win.loadFile(path.join(process.cwd(), "APP", "index.html"));
    Menu.setApplicationMenu(null);
    return win;
}

app.whenReady().then(() => {
    // 1. API Server Initialization
    const apiApp = createApiServer();
    registerAiRoutes(apiApp);
    registerExternalRoutes(apiApp, GOOGLE_CONFIG);
    registerMarketplaceRoutes(apiApp);
    apiApp.listen(5000, () => console.log("API IDE su http://localhost:5000"));

    // 2. Create Window
    const mainWindow = createWindow();

    // 3. IPC Handlers Registration (MUST BE BEFORE LOAD OR ASAP)
    registerFsHandlers(mainWindow);
    registerGitHandlers();
    registerTestHandlers(mainWindow);
    registerPtyHandlers();
    registerAiHandlers(GOOGLE_CONFIG);
    registerSystemHandlers();
    registerDebugHandlers(mainWindow);

    // 4. Auto-Updater Logic
    const { autoUpdater } = require('electron-updater');
    autoUpdater.on('update-available', () => {
        mainWindow.webContents.send('update-available');
    });
    autoUpdater.on('update-downloaded', () => {
        mainWindow.webContents.send('update-ready-to-install');
    });

    // 5. Final Load
    // We already called win.loadFile(path.join(process.cwd(), "APP", "index.html")) inside createWindow.
    // To be safer, we could move it here, but it's already in the function.

    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
