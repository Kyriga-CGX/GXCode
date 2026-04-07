const { exec } = require('child_process');
const os = require('os');
const http = require('http');

/**
 * AI Companion Service - GXCode Evolution 2026
 * Gestisce la diagnostica hardware, l'integrazione con Ollama e la state machine locale.
 */
class AiCompanionService {
    constructor() {
        this.isChecking = false;
        this.lastStats = null;
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
     * Scarica l'installer di Ollama con progresso
     */
    async downloadInstaller(installDir, onProgress) {
        const https = require('https');
        const fs = require('fs');
        const path = require('path');
        const url = 'https://ollama.com/download/OllamaSetup.exe';
        const dest = path.join(installDir, 'OllamaSetup.exe');

        return new Promise((resolve, reject) => {
            const file = fs.createWriteStream(dest);
            https.get(url, (response) => {
                const total = parseInt(response.headers['content-length'], 10);
                let downloaded = 0;

                response.on('data', (chunk) => {
                    downloaded += chunk.length;
                    const percent = Math.round((downloaded / total) * 100);
                    onProgress(percent);
                });

                response.pipe(file);

                file.on('finish', () => {
                    file.close();
                    resolve(dest);
                });
            }).on('error', (err) => {
                fs.unlink(dest, () => {});
                reject(err);
            });
        });
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
        const path = require('path');
        const { spawn } = require('child_process');
        
        // Verifica se è già in ascolto
        const isActive = await this.checkOllamaStatus();
        if (isActive) return true;

        const exeName = 'ollama.exe';
        const fullPath = path.join(installDir, 'ollama app', exeName); 
        // Nota: Ollama installer di solito mette l'exe in una sottocartella o lo aggiunge al PATH
        // Se l'utente ha scelto una DIR, cercatelo lì.
        
        console.log(`[AI-COMPANION] Avvio servizio Ollama da: ${installDir} con modelli in ${modelsPath}`);
        
        const env = { ...process.env };
        if (modelsPath) env.OLLAMA_MODELS = modelsPath;

        const child = spawn('ollama', ['serve'], {
            env,
            detached: true,
            stdio: 'ignore'
        });

        child.unref(); // Lascia correre indipendente
        return true;
    }
}

module.exports = new AiCompanionService();
