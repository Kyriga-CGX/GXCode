const { ipcMain } = require('electron');
const aiReactivityEngine = require('../services/aiReactivityEngine');

function registerAiReactivityHandlers(mainWindow) {
    // Imposta mainWindow per streaming responses
    global.mainWindow = mainWindow;

    /**
     * Trigger analisi AI reattiva
     */
    ipcMain.handle('ai-reactivity:analyze', async (event, payload) => {
        try {
            // Sanitizza il payload per evitare errori di serializzazione
            const safePayload = {
                filePath: String(payload?.filePath || ''),
                code: String(payload?.code || ''),
                cursorLine: Number(payload?.cursorLine || 0),
                trigger: String(payload?.trigger || 'idle'),
                // Sanitizza lintErrors - estrai solo messaggi testuali
                lintErrors: Array.isArray(payload?.lintErrors)
                    ? payload.lintErrors.map(e => ({
                        message: String(e?.message || ''),
                        line: Number(e?.line || 0),
                        column: Number(e?.column || 0),
                        severity: String(e?.severity || 'warning'),
                        code: String(e?.code || '')
                    })).slice(0, 20) // Max 20 errori
                    : []
            };

            // await è necessario perché analyze() è async e ritorna un Promise
            const requestId = await aiReactivityEngine.analyze(safePayload);

            return { success: true, requestId: Number(requestId) };
        } catch (err) {
            console.error('[AI-REACTIVITY] Analyze handler error:', err);
            return { success: false, error: err.message };
        }
    });

    /**
     * Abort analisi corrente
     */
    ipcMain.handle('ai-reactivity:abort', async () => {
        aiReactivityEngine.abortCurrent();
        return { success: true };
    });

    /**
     * Clear coda analisi
     */
    ipcMain.handle('ai-reactivity:clear-queue', async () => {
        aiReactivityEngine.clearQueue();
        return { success: true };
    });

    /**
     * Aggiorna configurazione (modello, ecc.)
     */
    ipcMain.handle('ai-reactivity:update-config', async (event, config) => {
        aiReactivityEngine.updateConfig(config);
        return { success: true };
    });

    /**
     * Ottieni stato engine
     */
    ipcMain.handle('ai-reactivity:get-status', async () => {
        try {
            const status = aiReactivityEngine.getStatus();
            // Sanitizza per IPC
            return {
                isAnalyzing: !!status?.isAnalyzing,
                queueLength: Number(status?.queueLength || 0),
                stats: status?.stats ? {
                    totalRequests: Number(status.stats.totalRequests || 0),
                    successfulRequests: Number(status.stats.successfulRequests || 0),
                    failedRequests: Number(status.stats.failedRequests || 0),
                    abortedRequests: Number(status.stats.abortedRequests || 0),
                    avgResponseTime: Number(status.stats.avgResponseTime || 0)
                } : null,
                config: status?.config ? {
                    model: String(status.config.model || ''),
                    maxContextTokens: Number(status.config.maxContextTokens || 0)
                } : null
            };
        } catch (err) {
            console.error('[AI-REACTIVITY] Get status error:', err);
            return { error: err.message };
        }
    });

    /**
     * Analisi su richiesta (trigger manuale)
     */
    ipcMain.handle('ai-reactivity:manual-analysis', async (event, payload) => {
        try {
            const safePayload = {
                filePath: String(payload?.filePath || ''),
                code: String(payload?.code || ''),
                cursorLine: Number(payload?.cursorLine || 0),
                trigger: 'manual',
                lintErrors: []
            };

            const requestId = await aiReactivityEngine.analyze(safePayload);

            return { success: true, requestId };
        } catch (err) {
            console.error('[AI-REACTIVITY] Manual analysis error:', err);
            return { success: false, error: err.message };
        }
    });

    /**
     * Check rapido se modello è pronto
     */
    ipcMain.handle('ai-reactivity:is-ready', async () => {
        // Verifica che Ollama sia raggiungibile
        const http = require('http');
        
        return new Promise((resolve) => {
            const req = http.request({
                hostname: 'localhost',
                port: 11434,
                path: '/api/tags',
                method: 'GET',
                timeout: 3000
            }, (res) => {
                if (res.statusCode === 200) {
                    resolve({ 
                        ready: true,
                        model: aiReactivityEngine.config.model
                    });
                } else {
                    resolve({ ready: false, error: 'Ollama not responding' });
                }
            });

            req.on('error', () => resolve({ ready: false, error: 'Ollama not running' }));
            req.on('timeout', () => {
                req.destroy();
                resolve({ ready: false, error: 'Timeout' });
            });
            req.end();
        });
    });
}

module.exports = { registerAiReactivityHandlers };
