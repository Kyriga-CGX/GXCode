const { exec } = require('child_process');
const os = require('os');
const http = require('http');
const path = require('path');

/**
 * AI Companion Service - GXCode Evolution 2026
 * Gestisce la diagnostica hardware, l'integrazione con Ollama e la state machine locale.
 */
class AiCompanionService {
    constructor() {
        this.isChecking = false;
        this.lastStats = null;
        this.ollamaProcess = null; // Track the Ollama process
    }

    /**
     * Ottiene il percorso di installazione predefinito in base al sistema operativo
     */
    getDefaultInstallPath() {
        if (process.platform === 'win32') {
            return process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE, 'AppData', 'Local');
        } else if (process.platform === 'darwin') {
            return '/Applications';
        } else {
            return '/usr/local';
        }
    }

    /**
     * Ottiene il percorso predefinito per i modelli in base al sistema operativo
     */
    getDefaultModelsPath() {
        if (process.platform === 'win32') {
            return path.join(process.env.USERPROFILE || '', '.ollama', 'models');
        } else {
            return path.join(process.env.HOME || '', '.ollama', 'models');
        }
    }

    /**
     * Esegue diagnostica hardware profonda via PowerShell
     */
    async getHardwareStats() {
        return new Promise((resolve) => {
            const stats = {
                os: `${os.type()} ${os.release()} (${os.arch()})`,
                cpu: os.cpus()[0].model,
                cores: os.cpus().length,
                totalRam: Math.round(os.totalmem() / (1024 * 1024 * 1024)),
                freeRam: Math.round(os.freemem() / (1024 * 1024 * 1024)),
                gpu: 'Rilevamento in corso...',
                disk: 'Rilevamento in corso...',
                suitability: { level: 'checking', message: 'Analisi neurale in corso...' }
            };

            // 1. GPU Detection (PowerShell)
            const gpuCmd = 'powershell -Command "Get-CimInstance Win32_VideoController | Select-Object Name, AdapterRAM | ConvertTo-Json"';
            exec(gpuCmd, (err, stdout) => {
                try {
                    if (!err && stdout) {
                        const gpuInfo = JSON.parse(stdout);
                        const primaryGpu = Array.isArray(gpuInfo) ? gpuInfo[0] : gpuInfo;
                        const vram = primaryGpu.AdapterRAM ? Math.round(primaryGpu.AdapterRAM / (1024 * 1024 * 1024)) : 0;
                        stats.gpu = `${primaryGpu.Name} (${vram}GB VRAM)`;
                        stats.vram = vram;
                    } else {
                        stats.gpu = 'Standard Display Adapter';
                        stats.vram = 0;
                    }
                } catch (e) {
                    stats.gpu = 'Uso CPU fallback';
                    stats.vram = 0;
                }

                // 2. Disk Space (WMIC)
                const diskCmd = 'wmic logicaldisk where "DeviceID=\'C:\'" get FreeSpace /Value';
                exec(diskCmd, (err, stdout) => {
                    if (!err && stdout) {
                        const match = stdout.match(/FreeSpace=(\d+)/);
                        if (match) {
                            stats.freeDisk = Math.round(parseInt(match[1]) / (1024 * 1024 * 1024));
                            stats.disk = `${stats.freeDisk} GB disponibili`;
                        }
                    }

                    // 3. Final Suitability Calculation
                    stats.suitability = this.calculateSuitability(stats);
                    this.lastStats = stats;
                    resolve(stats);
                });
            });
        });
    }

    /**
     * Logica di decisione prudente per il coding locale
     */
    calculateSuitability(stats) {
        const { freeRam, totalRam, cores, vram, freeDisk } = stats;
        
        // Margine di sicurezza: consideriamo che l'utente ha browser/Docker aperti.
        // Se la RAM libera è < 4GB, è rischioso.
        
        if (totalRam < 8 || freeDisk < 10) {
            return { 
                level: 'unsupported', 
                message: 'Hardware non idoneo. Spazio disco insufficiente o RAM < 8GB. L\'esperienza sarebbe estremamente lenta.' 
            };
        }

        if (totalRam < 16 || (vram < 2 && cores < 8)) {
            return { 
                level: 'compromised', 
                message: 'Idoneo con compromessi. RAM limitata. Si consiglia l\'uso di modelli ultra-leggeri (1.5B) e la chiusura di app pesanti in background.' 
            };
        }

        if (totalRam >= 32 || (vram >= 6)) {
            return { 
                level: 'recommended', 
                message: 'Idoneo Consigliato. La tua macchina ha potenza sufficiente per far girare modelli da 7B con eccellente reattività.' 
            };
        }

        return { 
            level: 'ok', 
            message: 'Idoneo. Configurazione bilanciata per assistenza quotidiana.' 
        };
    }

    /**
     * Verifica se Ollama è raggiungibile sulla porta locale
     */
    async checkOllamaStatus() {
        return new Promise((resolve) => {
            const req = http.request({
                hostname: 'localhost',
                port: 11434,
                path: '/api/tags',
                method: 'GET',
                timeout: 2000
            }, (res) => {
                resolve(res.statusCode === 200);
            });

            req.on('error', () => resolve(false));
            req.on('timeout', () => {
                req.destroy();
                resolve(false);
            });
            req.end();
        });
    }

    /**
     * Mock per installazione Ollama (REALE ora)
     */
    async triggerInstallation() {
        // Questa funzione ora viene gestita via IPC con i parametri scelti dall'utente
        return true;
    }

    /**
     * Scarica l'installer di Ollama con progresso e retry logic
     */
    async downloadInstaller(installDir, onProgress) {
        const https = require('https');
        const fs = require('fs');
        const path = require('path');
        const url = 'https://ollama.com/download/OllamaSetup.exe';
        
        // Crea la directory se non esiste
        if (!fs.existsSync(installDir)) {
            fs.mkdirSync(installDir, { recursive: true });
        }
        
        const dest = path.join(installDir, 'OllamaSetup.exe');
        const maxRetries = 3;
        let retryCount = 0;

        const downloadWithRetry = () => {
            return new Promise((resolve, reject) => {
                const file = fs.createWriteStream(dest);
                
                const request = https.get(url, { followRedirect: true }, (response) => {
                    // Handle redirects
                    if (response.statusCode === 301 || response.statusCode === 302) {
                        file.close();
                        fs.unlink(dest, () => {});
                        reject(new Error('Redirect not supported'));
                        return;
                    }
                    
                    if (response.statusCode !== 200) {
                        file.close();
                        fs.unlink(dest, () => {});
                        reject(new Error(`HTTP ${response.statusCode}`));
                        return;
                    }

                    const total = parseInt(response.headers['content-length'], 10);
                    let downloaded = 0;

                    response.on('data', (chunk) => {
                        downloaded += chunk.length;
                        const percent = total ? Math.round((downloaded / total) * 100) : 0;
                        onProgress(percent);
                    });

                    response.pipe(file);

                    file.on('finish', () => {
                        file.close();
                        resolve(dest);
                    });
                });

                request.on('error', (err) => {
                    file.close();
                    fs.unlink(dest, () => {});
                    reject(err);
                });

                file.on('error', (err) => {
                    fs.unlink(dest, () => {});
                    reject(err);
                });
            });
        };

        // Retry logic
        while (retryCount < maxRetries) {
            try {
                onProgress(0);
                const exePath = await downloadWithRetry();
                console.log(`[AI-COMPANION] Download completed after ${retryCount + 1} attempt(s)`);
                return exePath;
            } catch (err) {
                retryCount++;
                console.warn(`[AI-COMPANION] Download attempt ${retryCount} failed:`, err.message);
                
                if (retryCount >= maxRetries) {
                    throw new Error(`Download failed after ${maxRetries} attempts: ${err.message}`);
                }
                
                // Wait before retry (exponential backoff)
                const waitTime = Math.pow(2, retryCount) * 1000;
                onProgress(0);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }
    }

    /**
     * Esegue l'installazione silenziosa
     */
    async installOllama(exePath, installDir) {
        return new Promise((resolve, reject) => {
            const { exec } = require('child_process');
            // Nota: /DIR deve essere tra virgolette se contiene spazi
            const cmd = `"${exePath}" /VERYSILENT /DIR="${installDir}"`;
            console.log(`[AI-COMPANION] Esecuzione installazione: ${cmd}`);
            
            exec(cmd, (err) => {
                if (err) reject(err);
                else {
                    // Pulizia installer
                    const fs = require('fs');
                    fs.unlink(exePath, () => {});
                    resolve(true);
                }
            });
        });
    }

    /**
     * Avvia il server Ollama se non è già attivo
     */
    async startOllamaService(installDir, modelsPath) {
        try {
            console.log(`[AI-COMPANION] Starting Ollama service from: ${installDir} with models in ${modelsPath}`);
            
            // Verifica se è già in ascolto
            const isActive = await this.checkOllamaStatus();
            if (isActive) {
                console.log('[AI-COMPANION] Ollama is already running');
                return true;
            }

            // Set OLLAMA_MODELS environment variable
            if (modelsPath) {
                process.env.OLLAMA_MODELS = modelsPath;
                console.log(`[AI-COMPANION] Set OLLAMA_MODELS to: ${modelsPath}`);
            }

            // Tenta di avviare Ollama
            const { spawn } = require('child_process');
            
            this.ollamaProcess = spawn('ollama', ['serve'], {
                env: { ...process.env },
                detached: true,
                stdio: 'ignore',
                windowsHide: true
            });

            this.ollamaProcess.unref();
            console.log(`[AI-COMPANION] Ollama process started with PID: ${this.ollamaProcess.pid}`);

            // Gestione chiusura inaspettata del processo
            this.ollamaProcess.on('exit', (code, signal) => {
                console.log(`[AI-COMPANION] Ollama process exited with code ${code}, signal ${signal}`);
                this.ollamaProcess = null;
            });

            this.ollamaProcess.on('error', (err) => {
                console.error('[AI-COMPANION] Ollama process error:', err.message);
                this.ollamaProcess = null;
            });

            // Aspetta che Ollama sia pronto (max 10 secondi)
            for (let i = 0; i < 20; i++) {
                await new Promise(resolve => setTimeout(resolve, 500));
                const ready = await this.checkOllamaStatus();
                if (ready) {
                    console.log('[AI-COMPANION] Ollama service is ready');
                    return true;
                }
            }

            console.warn('[AI-COMPANION] Ollama did not become ready within timeout');
            return false;
        } catch (err) {
            console.error('[AI-COMPANION] Failed to start Ollama service:', err);
            this.ollamaProcess = null;
            return false;
        }
    }

    /**
     * Ferma il server Ollama in modo sicuro
     */
    async killOllamaService() {
        try {
            console.log('[AI-COMPANION] Attempting to stop Ollama service safely...');
            const currentPid = process.pid;
            console.log(`[AI-COMPANION] Current IDE PID: ${currentPid}`);

            // Prima prova a killare SOLO il processo che abbiamo trackato
            if (this.ollamaProcess && this.ollamaProcess.pid) {
                try {
                    console.log(`[AI-COMPANION] Killing ONLY tracked process PID: ${this.ollamaProcess.pid}`);
                    if (process.platform === 'win32') {
                        const { execSync } = require('child_process');
                        // Uccide SOLO il processo trackato, NON i figli (/T rimosso per sicurezza)
                        execSync(`taskkill /pid ${this.ollamaProcess.pid} /F`, { stdio: 'ignore' });
                    } else {
                        process.kill(this.ollamaProcess.pid, 'SIGTERM');
                    }
                    this.ollamaProcess = null;
                    console.log('[AI-COMPANION] ✅ Ollama service stopped (tracked process killed)');
                    return true;
                } catch (err) {
                    console.warn('[AI-COMPANION] Could not kill tracked process:', err.message);
                    this.ollamaProcess = null;
                }
            }

            // Se non abbiamo un processo trackato, Ollama potrebbe essere già stato avviato esternamente
            // In questo caso, NON uccidiamo nulla per sicurezza
            console.log('[AI-COMPANION] ⚠️ No tracked process found. Ollama may have been started externally.');
            console.log('[AI-COMPANION] ⚠️ Skipping port-based cleanup to avoid killing IDE or other processes.');
            
            // Aggiorna stato locale
            return true;

        } catch (err) {
            console.error('[AI-COMPANION] ❌ Error stopping Ollama service:', err);
            this.ollamaProcess = null;
            return false;
        }
    }
}

module.exports = new AiCompanionService();
