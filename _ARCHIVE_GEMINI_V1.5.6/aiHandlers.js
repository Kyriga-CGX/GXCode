const { ipcMain, shell, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

function registerAiHandlers(GOOGLE_CONFIG) {
    ipcMain.handle('gemini:login', async () => {
        if (!GOOGLE_CONFIG || !GOOGLE_CONFIG.clientId) return { success: false, error: "CONFIG_MISSING" };
        const SCOPE = encodeURIComponent("openid email profile https://www.googleapis.com/auth/cloud-platform");
        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CONFIG.clientId}&redirect_uri=${GOOGLE_CONFIG.redirectUri}&response_type=code&scope=${SCOPE}&access_type=offline&prompt=consent`;
        shell.openExternal(authUrl);
        return { success: true };
    });

    ipcMain.handle('save-gemini-session', async (event, data) => {
        try {
            const sessionDir = path.join(process.cwd(), '.gxcode');
            if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });
            const sessionPath = path.join(sessionDir, 'gemini-session.json');
            let existing = {};
            if (fs.existsSync(sessionPath)) existing = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
            const updated = { ...existing, ...data, date: new Date().toISOString() };
            fs.writeFileSync(sessionPath, JSON.stringify(updated, null, 2));
            return { success: true };
        } catch (err) { return { success: false, error: err.message }; }
    });
}

module.exports = { registerAiHandlers };
