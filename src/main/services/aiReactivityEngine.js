/**
 * AI Reactivity Engine - GXCode 2026
 * Gestisce analisi AI reattiva, context cutting, e comunicazione con Ollama.
 * Architettura: Non-blocking, Event-Driven, Context-Aware
 */

const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

class AiReactivityEngine {
    constructor() {
        // Coda di richieste AI
        this.queue = [];
        this.currentRequest = null;
        this.abortController = null;
        
        // Configurazione
        this.config = {
            maxContextTokens: 6000, // ~6K token per richiesta
            idleTimeout: 2500, // 2.5s di idle prima di analizzare
            debounceSave: 500, // 500ms debounce su save
            maxQueueSize: 5, // Max richieste in coda
            model: 'qwen2.5-coder:7b'
        };

        // Cache context per file
        this.contextCache = new Map();
        
        // Statistiche
        this.stats = {
            analyses: 0,
            avgResponseTime: 0,
            abortedRequests: 0
        };
    }

    /**
     * Aggiorna configurazione (es. modello)
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        console.log(`[AI-ENGINE] Config updated:`, this.config);
    }

    /**
     * TAGLIO CONTEXT INTELLIGENTE
     * Estrae solo le parti rilevanti del codice per l'analisi
     */
    extractSmartContext(filePath, code, cursorLine) {
        const lines = code.split('\n');
        const totalLines = lines.length;
        
        // 1. Determina il blocco di codice attivo (funzione/classe)
        let startLine = Math.max(0, cursorLine - 50);
        let endLine = Math.min(totalLines, cursorLine + 50);
        
        // Trova inizio e fine della funzione/classe
        for (let i = cursorLine; i >= 0; i--) {
            const line = lines[i];
            if (line && /^(function|class|const|let|var|async|def)\s+\w/.test(line.trim())) {
                startLine = i;
                break;
            }
        }

        for (let i = cursorLine; i < totalLines; i++) {
            const line = lines[i];
            if (line && i !== cursorLine && /^(function|class|const|let|var|async|def)\s+\w/.test(line.trim())) {
                endLine = i;
                break;
            }
        }

        // 2. Estrai imports rilevanti
        const importLines = lines.filter((line, idx) => 
            idx < 20 && (line.includes('import') || line.includes('require'))
        ).join('\n');

        // 3. Costruisci context ottimizzato
        const context = [
            `// File: ${path.basename(filePath)}`,
            `// Lines: ${startLine + 1}-${endLine + 1} of ${totalLines}`,
            `// Cursor: Line ${cursorLine + 1}`,
            '',
            '// Imports:',
            importLines || '// None',
            '',
            '// Active Code Block:',
            lines.slice(startLine, endLine).join('\n')
        ].join('\n');

        // 4. Trunca se troppo lungo
        const truncated = context.length > this.config.maxContextTokens * 4 
            ? context.substring(0, this.config.maxContextTokens * 4) + '\n\n// [Truncated for context limit]'
            : context;

        return {
            context: truncated,
            tokens: Math.trunc(truncated.length / 4), // Stima approssimativa
            fileInfo: {
                name: path.basename(filePath),
                totalLines,
                activeRange: { start: startLine + 1, end: endLine + 1 }
            }
        };
    }

    /**
     * ANALISI REATTIVA - Entry Point
     * Triggerata da: onSave, onIdle, onFileSwitch, onLintError
     */
    async analyze({
        filePath,
        code,
        cursorLine,
        trigger = 'idle', // onSave, onIdle, onFileSwitch, onLintError
        lintErrors = [],
        abortSignal = null
    }) {
        // Abort se c'è già una richiesta per questo file
        if (this.currentRequest?.filePath === filePath) {
            console.log(`[AI-ENGINE] Aborting previous analysis for ${path.basename(filePath)}`);
            this.abortCurrent();
        }

        // Aggiungi alla coda
        const request = {
            id: Date.now(),
            filePath,
            code,
            cursorLine,
            trigger,
            lintErrors,
            abortSignal,
            timestamp: Date.now()
        };

        // Se la coda è piena, scarta la richiesta più vecchia
        if (this.queue.length >= this.config.maxQueueSize) {
            const dropped = this.queue.shift();
            console.log(`[AI-ENGINE] Queue full, dropping old request: ${path.basename(dropped.filePath)}`);
        }

        this.queue.push(request);
        console.log(`[AI-ENGINE] Analysis queued: ${path.basename(filePath)} (trigger: ${trigger})`);

        // Processa la coda
        this.processQueue();
        
        return request.id;
    }

    /**
     * Processa la coda di richieste
     */
    async processQueue() {
        if (this.queue.length === 0 || this.currentRequest) return;

        const request = this.queue.shift();
        this.currentRequest = request;

        try {
            await this.executeAnalysis(request);
        } catch (error) {
            console.error('[AI-ENGINE] Analysis failed:', error.message);
        } finally {
            this.currentRequest = null;
            // Processa la prossima richiesta
            if (this.queue.length > 0) {
                this.processQueue();
            }
        }
    }

    /**
     * Esegue l'analisi AI
     */
    async executeAnalysis(request) {
        const startTime = Date.now();
        const { filePath, code, cursorLine, trigger, lintErrors, abortSignal } = request;

        console.log(`[AI-ENGINE] Executing analysis: ${path.basename(filePath)} (trigger: ${trigger})`);

        // 1. Estrai context intelligente
        const contextInfo = this.extractSmartContext(filePath, code, cursorLine);
        console.log(`[AI-ENGINE] Context: ${contextInfo.tokens} tokens, range: ${contextInfo.fileInfo.activeRange.start}-${contextInfo.fileInfo.activeRange.end}`);

        // 2. Costruisci prompt ottimizzato
        const prompt = this.buildAnalysisPrompt(contextInfo, lintErrors, trigger);

        // 3. Crea abort controller
        this.abortController = new AbortController();

        try {
            // 4. Chiama Ollama
            const response = await this.callOllama(prompt, this.abortController.signal, (chunk) => {
                // Streaming callback - invia al renderer (solo dati serializzabili)
                if (global.mainWindow && !global.mainWindow.isDestroyed()) {
                    try {
                        global.mainWindow.webContents.send('ai-analysis-stream', {
                            requestId: request.id,
                            chunk: typeof chunk === 'string' ? chunk : String(chunk || ''),
                            complete: false
                        });
                    } catch (e) {
                        // Ignora errori di serializzazione durante lo streaming
                        console.warn('[AI-ENGINE] Stream send error:', e.message);
                    }
                }
            });

            const responseTime = Date.now() - startTime;
            this.updateStats(responseTime);

            console.log(`[AI-ENGINE] Analysis complete in ${responseTime}ms`);

            // 5. Invia risultato completo
            if (global.mainWindow && !global.mainWindow.isDestroyed()) {
                // Sanitizza contextInfo per IPC (solo dati serializzabili)
                const safeContextInfo = contextInfo ? {
                    context: typeof contextInfo.context === 'string' ? contextInfo.context.substring(0, 5000) : '',
                    tokens: contextInfo.tokens || 0,
                    fileInfo: contextInfo.fileInfo ? {
                        name: contextInfo.fileInfo.name,
                        totalLines: contextInfo.fileInfo.totalLines,
                        activeRange: contextInfo.fileInfo.activeRange
                    } : null
                } : null;

                global.mainWindow.webContents.send('ai-analysis-complete', {
                    requestId: request.id,
                    filePath,
                    suggestions: this.parseSuggestions(response),
                    responseTime,
                    contextInfo: safeContextInfo
                });
            }

        } catch (error) {
            if (error.name === 'AbortError') {
                console.log('[AI-ENGINE] Analysis aborted');
                this.stats.abortedRequests++;
            } else {
                console.error('[AI-ENGINE] Ollama call failed:', error);
                
                // Notifica errore
                if (global.mainWindow && !global.mainWindow.isDestroyed()) {
                    global.mainWindow.webContents.send('ai-analysis-error', {
                        requestId: request.id,
                        error: error.message
                    });
                }
            }
        }
    }

    /**
     * Costruisci prompt ottimizzato per analisi codice
     */
    buildAnalysisPrompt(contextInfo, lintErrors, trigger) {
        const { context, fileInfo } = contextInfo;

        // Prompt base per tutti i trigger
        let systemPrompt = `Sei un esperto di coding che analizza codice in tempo reale.
Regole:
1. Analizza SOLO il codice fornito
2. Identifica problemi reali (non inventare)
3. Suggerisci fix concreti e testati
4. Usa il formato JSON per le risposte
5. Sii conciso e specifico

Formato risposta (JSON):
{
  "suggestions": [
    {
      "type": "bug|improvement|refactor|security",
      "severity": "high|medium|low",
      "line": 123,
      "message": "Descrizione chiara del problema",
      "suggestion": "Codice suggerito",
      "explanation": "Perché è meglio"
    }
  ]
}`;

        // Aggiungi contesto specifico per trigger
        let userPrompt = '';
        
        if (trigger === 'onSave') {
            userPrompt = `Analisi post-salvataggio. Cerca:\n- Bug e edge cases\n- Refactoring opportunities\n- Performance improvements\n\nCodice:\n${context}`;
        } else if (trigger === 'onLintError' && lintErrors.length > 0) {
            userPrompt = `Fix ESLint/TS errors:\n${lintErrors.map(e => `Line ${e.line}: ${e.message}`).join('\n')}\n\nCodice:\n${context}`;
        } else if (trigger === 'onFileSwitch') {
            userPrompt = `Contesto caricato. Fornisci:\n- Overview architettura\n- Dipendenze chiave\n- Punti critici da testare\n\nCodice:\n${context}`;
        } else {
            // Idle analysis
            userPrompt = `Analisi idle. Suggerisci:\n- Miglioramenti immediati\n- Pattern da applicare\n- Codice mancante\n\nCodice:\n${context}`;
        }

        return `${systemPrompt}\n\n${userPrompt}`;
    }

    /**
     * Chiama Ollama con streaming
     */
    async callOllama(prompt, abortSignal, onChunk) {
        return new Promise((resolve, reject) => {
            // Usa il modello configurato
            const model = this.config.model;
            
            // Comando Ollama con streaming
            const cmd = `ollama run ${model} "${prompt.replace(/"/g, '\\"')}"`;
            
            const child = exec(cmd, {
                maxBuffer: 50 * 1024 * 1024 // 50MB buffer
            });

            let fullResponse = '';

            child.stdout.on('data', (data) => {
                if (abortSignal?.aborted) {
                    child.kill();
                    reject(new Error('AbortError'));
                    return;
                }

                const text = data.toString();
                fullResponse += text;
                onChunk(text);
            });

            child.stderr.on('data', (data) => {
                // Filtra righe vuote e spinner di progresso (⠙⠸⠼⠴⠦⠧⠏)
                const text = data.toString().trim();
                if (text && !/^[\u2800-\u28FF]+$/.test(text)) {
                    console.error('[AI-ENGINE] Ollama stderr:', text);
                }
            });

            child.on('close', (code) => {
                if (code === 0) {
                    resolve(fullResponse);
                } else {
                    reject(new Error(`Ollama exited with code ${code}`));
                }
            });

            child.on('error', (err) => {
                reject(err);
            });

            // Timeout dopo 180 secondi (i modelli 7B su CPU sono lenti)
            setTimeout(() => {
                if (!child.killed) {
                    child.kill();
                    reject(new Error('Timeout'));
                }
            }, 180000);
        });
    }

    /**
     * Parse risposta JSON da Ollama
     */
    parseSuggestions(response) {
        try {
            // Estrai JSON dalla risposta (può essere in mezzo al testo)
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return parsed.suggestions || [];
            }
            return [];
        } catch (error) {
            console.error('[AI-ENGINE] Failed to parse suggestions:', error);
            return [];
        }
    }

    /**
     * Aggiorna statistiche
     */
    updateStats(responseTime) {
        this.stats.analyses++;
        this.stats.avgResponseTime = 
            (this.stats.avgResponseTime * (this.stats.analyses - 1) + responseTime) / this.stats.analyses;
    }

    /**
     * Abort richiesta corrente
     */
    abortCurrent() {
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }
        this.currentRequest = null;
    }

    /**
     * Clear coda
     */
    clearQueue() {
        this.queue = [];
        this.abortCurrent();
    }

    /**
     * Ottieni stato engine
     */
    getStatus() {
        return {
            queueLength: this.queue.length,
            isProcessing: !!this.currentRequest,
            stats: this.stats,
            currentModel: this.config.model
        };
    }
}

// Singleton export
module.exports = new AiReactivityEngine();
