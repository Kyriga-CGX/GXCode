const { ipcMain, shell } = require('electron');
const aiCompanionService = require('../services/aiCompanionService');

function registerAiCompanionHandlers() {
    /**
     * Recupera le statistiche hardware reali
     */
    ipcMain.handle('ai-companion:get-stats', async () => {
        try {
            return await aiCompanionService.getHardwareStats();
        } catch (e) {
            console.error("[GX-AI-IPC] Errore stats:", e);
            return { error: e.message };
        }
    });

    /**
     * Verifica se Ollama è attivo
     */
    ipcMain.handle('ai-companion:check-status', async () => {
        return await aiCompanionService.checkOllamaStatus();
    });

    /**
     * Selezione cartella tramite dialogo nativo
     */
    ipcMain.handle('ai-companion:select-folder', async (event, title) => {
        const { dialog } = require('electron');
        const result = await dialog.showOpenDialog({
            title: title || 'Seleziona Cartella',
            properties: ['openDirectory', 'createDirectory']
        });
        return result.canceled ? null : result.filePaths[0];
    });

    /**
     * Installazione automatica con percorsi personalizzati
     */
    ipcMain.handle('ai-companion:install', async (event, { installPath, modelsPath }) => {
        try {
            console.log("[GX-AI-IPC] Avvio procedura installazione automatica...");
            
            // 1. Download installer
            event.sender.send('ai-companion:install-progress', { status: 'Downloading Installer...', percent: 0 });
            const exePath = await aiCompanionService.downloadInstaller(installPath, (percent) => {
                event.sender.send('ai-companion:install-progress', { status: 'Downloading...', percent });
            });

            // 2. Installazione Silenziosa
            event.sender.send('ai-companion:install-progress', { status: 'Running Installer...', percent: 90 });
            await aiCompanionService.installOllama(exePath, installPath);

            // 3. Configurazione variabile d'ambiente (per questa istanza)
            process.env.OLLAMA_MODELS = modelsPath;

            return { success: true };
        } catch (err) {
            console.error("[GX-AI-IPC] Errore durante installazione:", err);
            return { success: false, error: err.message };
        }
    });

    /**
     * Avvio manuale servizio
     */
    ipcMain.handle('ai-companion:start', async (event, { installPath, modelsPath }) => {
        return await aiCompanionService.startOllamaService(installPath, modelsPath);
    });

    /**
     * Pull del modello tramite Ollama (REALE)
     */
    ipcMain.handle('ai-companion:pull-model', async (event, modelName) => {
        const { spawn } = require('child_process');
        const modelsPath = process.env.OLLAMA_MODELS;
        console.log(`[GX-AI-IPC] Avvio Pull reale modello: ${modelName} (Path: ${modelsPath || 'Default'})`);
        
        return new Promise((resolve) => {
            const env = { ...process.env };
            if (modelsPath) env.OLLAMA_MODELS = modelsPath;

            const child = spawn('ollama', ['pull', modelName], { env });

            child.stdout.on('data', (data) => {
                const output = data.toString();
                event.sender.send('ai-companion:pull-progress', output);
            });

            child.stderr.on('data', (data) => {
                console.error(`[OLLAMA-ERR] ${data}`);
            });

            child.on('close', (code) => {
                if (code === 0) {
                    console.log(`[GX-AI-IPC] Pull completato con successo: ${modelName}`);
                    resolve({ success: true, model: modelName });
                } else {
                    console.error(`[GX-AI-IPC] Errore pull codice: ${code}`);
                    resolve({ success: false, error: `Exit code ${code}` });
                }
            });

            child.on('error', (err) => {
                console.error("[GX-AI-IPC] Errore spawn ollama:", err);
                resolve({ success: false, error: "Ollama non trovato nel PATH." });
            });
        });
    });
}

module.exports = { registerAiCompanionHandlers };
