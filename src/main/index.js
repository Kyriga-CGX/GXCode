const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const os = require('os');

// --- SINGLE INSTANCE LOCK (v1.5.8) ---
// Prevents cache corruption and 'Accesso negato' errors by ensuring only one IDE runs at a time.
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    console.warn("[GX-BOOTSTRAP] Another instance is already running. Quitting this one.");
    app.quit();
} else {
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        // Someone tried to run a second instance, we should focus our window.
        const windows = BrowserWindow.getAllWindows();
        if (windows.length > 0) {
            if (windows[0].isMinimized()) windows[0].restore();
            windows[0].focus();
        }
    });

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
    const { registerAiCompanionHandlers } = require('./ipc/aiCompanionHandlers');

    // --- HARDENING (Local AppData Redirection) ---
// Note: userData is set earlier in the root main.js script
const localDataPath = app.getPath('userData');
console.log("[GX-BOOTSTRAP] Main process using UserData:", localDataPath);

// Inject into Persistence Service (Fulfillment of Relative Path principle)
const { setBaseDir, ensureDataMigration } = require('./services/persistence');
setBaseDir(path.join(localDataPath, 'persistence'));
ensureDataMigration();

const GOOGLE_CONFIG = {
    clientId: "411114937479-jfa96807lfiuo4rlnqd362598s7dj5va.apps.googleusercontent.com",
    clientSecret: "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",
    redirectUri: "http://localhost:5000/gemini/callback"
};

function createWindow() {
    const win = new BrowserWindow({
        width: 1400, height: 900, frame: false,
        icon: path.join(app.getAppPath(), "APP", "assets", "logo.png"),
        backgroundColor: '#0d1117',
        webPreferences: { 
            nodeIntegration: false, 
            contextIsolation: true, 
            preload: path.join(app.getAppPath(), "preload.js"), 
            webviewTag: true 
        }
    });

    win.loadFile(path.join(app.getAppPath(), "APP", "index.html")).catch(err => {
        console.error("Failed to load index.html:", err);
    });

    win.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
        console.error(`Failed to load URL: ${validatedURL} with error: ${errorDescription} (${errorCode})`);
    });
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
    registerAiCompanionHandlers();

    // 4. Auto-Updater Logic (Safe Mode)
    if (app.isPackaged) {
        try {
            const { autoUpdater } = require('electron-updater');
            autoUpdater.on('update-available', () => {
                mainWindow.webContents.send('update-available');
            });
            autoUpdater.on('update-downloaded', () => {
                mainWindow.webContents.send('update-ready-to-install');
            });
            autoUpdater.checkForUpdatesAndNotify();
        } catch (e) {
            console.warn("AutoUpdater init failed:", e.message);
        }
    }

    // 5. Final Load
    // We already called win.loadFile(path.join(process.cwd(), "APP", "index.html")) inside createWindow.
    // To be safer, we could move it here, but it's already in the function.

    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
}
