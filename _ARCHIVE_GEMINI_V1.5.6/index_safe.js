const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const os = require('os');
const { createApiServer } = require('./api/server');
const { registerAiRoutes } = require('./api/routes/ai');
const { registerExternalRoutes } = require('./api/routes/external');
const { registerMarketplaceRoutes } = require('./api/routes/marketplace');
const { registerFsHandlers } = require('./ipc/fsHandlers');

// --- EMERGENCY HARDENING (v1.5.9 SafeMode) ---
process.on('uncaughtException', (err) => {
    console.error("[FATAL-MAIN] Uncaught Exception:", err.message, err.stack);
});
process.on('unhandledRejection', (reason) => {
    console.error("[FATAL-MAIN] Unhandled Rejection:", reason);
});

// Force paths to TEMP to bypass ALL OneDrive/Permission issues
const fallbackPath = path.join(os.tmpdir(), 'GXCode_SafeMode_' + Date.now());
app.setPath('userData', fallbackPath);
console.log("[GX-BOOTSTRAP] UserData redirected to TEMP:", fallbackPath);

const GOOGLE_CONFIG = {
    clientId: "411114937479-jfa96807lfiuo4rlnqd362598s7dj5va.apps.googleusercontent.com",
    clientSecret: "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",
    redirectUri: "http://localhost:5000/gemini/callback"
};

function createWindow() {
    console.log("[GX-BOOTSTRAP] Step 2: Creating Window Context...");
    const win = new BrowserWindow({
        width: 1400, height: 900, frame: false,
        backgroundColor: '#0d1117',
        webPreferences: { 
            nodeIntegration: false, 
            contextIsolation: true, 
            preload: path.join(app.getAppPath(), "preload.js"), 
            webviewTag: true 
        }
    });

    const indexPath = path.join(app.getAppPath(), "APP", "index.html");
    console.log("[GX-BOOTSTRAP] Step 3: Loading Static Assets:", indexPath);
    win.loadFile(indexPath).catch(err => {
        console.error("[FATAL-MAIN] Load Error:", err.message);
    });

    Menu.setApplicationMenu(null);
    return win;
}

app.whenReady().then(() => {
    console.log("[GX-BOOTSTRAP] Step 1: App Ready. Initializing Backend...");
    
    // 1. Minimal API Server
    try {
        const apiApp = createApiServer();
        registerAiRoutes(apiApp);
        registerExternalRoutes(apiApp, GOOGLE_CONFIG);
        registerMarketplaceRoutes(apiApp);
        apiApp.listen(5000, () => console.log("API IDE su http://localhost:5000"));
    } catch (e) { console.error("[FATAL-API] API Init Failed:", e.message); }

    // 2. Create Window
    const mainWindow = createWindow();

    // 3. Essential Handlers Only (Disable others for stability check)
    try {
        registerFsHandlers(mainWindow);
        console.log("[GX-BOOTSTRAP] IPC: FsHandlers registered.");
        // registerGitHandlers();
        // registerTestHandlers(mainWindow);
        // registerPtyHandlers();
        // registerAiHandlers(GOOGLE_CONFIG);
        // registerSystemHandlers();
        // registerDebugHandlers(mainWindow);
    } catch (e) { console.error("[FATAL-IPC] IPC Init Failed:", e.message); }

    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
