/**
 * AI Reactivity Engine - Versione 2.0 Modulare
 * 
 * Analisi AI reattiva del codice con:
 * - Smart context extraction
 * - Queue management
 * - Streaming support
 * - Abort capability
 * - Multiple trigger types
 */

const { exec } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const eventBus = require('../../core/EventBus');

class AiReactivityEngine {
  constructor() {
    // Queue management
    this.queue = [];
    this.currentRequest = null;
    this.abortController = null;

    // Configuration
    this.config = {
      enabled: true,
      maxContextTokens: 6000,
      idleTimeout: 2500, // 2.5s idle before analysis
      maxQueueSize: 5,
      model: 'qwen2.5-coder:7b',
      timeout: 180000, // 3 minutes
      enableStreaming: true,
      enableSmartContext: true,
      logLevel: 'info' // 'debug', 'info', 'warn', 'error'
    };

    // Statistics
    this.stats = {
      analysesCompleted: 0,
      analysesFailed: 0,
      avgResponseTime: 0,
      abortedRequests: 0,
      totalRequests: 0
    };

    // Cache
    this.contextCache = new Map();
    this._initialized = false;
  }

  /**
   * Inizializza il modulo
   */
  async init(context) {
    console.log('[AIReactivityEngine] Initializing engine');
    
    this._initialized = true;
    
    // Load config from file if exists
    try {
      const configPath = path.join(context.userDataPath, 'ai-reactivity-config.json');
      const configData = await fs.readFile(configPath, 'utf-8');
      const savedConfig = JSON.parse(configData);
      this.config = { ...this.config, ...savedConfig };
      console.log('[AIReactivityEngine] Config loaded from file');
    } catch (err) {
      // Use defaults
      console.log('[AIReactivityEngine] Using default config');
    }

    eventBus.emit('ai:reactivity:initialized', { config: this.config });
    console.log('[AIReactivityEngine] Engine initialized');
  }

  /**
   * Spegne il modulo
   */
  async shutdown() {
    console.log('[AIReactivityEngine] Shutting down engine');
    
    this.clearQueue();
    this.abortCurrent();
    this._initialized = false;
    
    eventBus.emit('ai:reactivity:shutdown');
  }

  /**
   * Aggiorna configurazione
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    this._log('info', 'Config updated', this.config);
    
    eventBus.emit('ai:reactivity:config', { config: this.config });
  }

  /**
   * Analizza codice (entry point principale)
   */
  async analyze({
    filePath,
    code,
    cursorLine = 1,
    trigger = 'idle',
    lintErrors = []
  }) {
    if (!this.config.enabled) {
      this._log('debug', 'Engine disabled, skipping analysis');
      return null;
    }

    if (!this._initialized) {
      this._log('warn', 'Engine not initialized');
      return null;
    }

    // Abort existing request for same file
    if (this.currentRequest?.filePath === filePath) {
      this._log('debug', `Aborting previous analysis for ${path.basename(filePath)}`);
      this.abortCurrent();
    }

    // Create request
    const request = {
      id: Date.now(),
      filePath: path.resolve(filePath),
      code,
      cursorLine,
      trigger,
      lintErrors,
      timestamp: Date.now()
    };

    // Queue management
    if (this.queue.length >= this.config.maxQueueSize) {
      const dropped = this.queue.shift();
      this._log('warn', `Queue full, dropping: ${path.basename(dropped.filePath)}`);
    }

    this.queue.push(request);
    this.stats.totalRequests++;
    
    this._log('info', `Queued analysis: ${path.basename(filePath)} (${trigger})`);
    eventBus.emit('ai:reactivity:queued', { 
      id: request.id, 
      file: path.basename(filePath), 
      trigger 
    });

    // Process queue
    this.processQueue();

    return request.id;
  }

  /**
   * Processa la coda
   */
  async processQueue() {
    if (this.queue.length === 0 || this.currentRequest) {
      return;
    }

    const request = this.queue.shift();
    this.currentRequest = request;

    try {
      await this.executeAnalysis(request);
    } catch (error) {
      this._log('error', `Analysis failed: ${error.message}`);
      this.stats.analysesFailed++;
      
      eventBus.emit('ai:reactivity:error', {
        requestId: request.id,
        error: error.message
      });
    } finally {
      this.currentRequest = null;
      
      // Process next
      if (this.queue.length > 0) {
        setTimeout(() => this.processQueue(), 100);
      }
    }
  }

  /**
   * Esegue l'analisi
   */
  async executeAnalysis(request) {
    const startTime = Date.now();
    const { filePath, code, cursorLine, trigger, lintErrors } = request;

    this._log('info', `Analyzing: ${path.basename(filePath)} (${trigger})`);

    // Extract smart context
    const contextInfo = this.config.enableSmartContext 
      ? this.extractSmartContext(filePath, code, cursorLine)
      : { context: code, tokens: code.length / 4 };

    // Build prompt
    const prompt = this.buildAnalysisPrompt(contextInfo, lintErrors, trigger);

    // Create abort controller
    this.abortController = new AbortController();

    try {
      // Call AI
      const response = await this.callAI(prompt, this.abortController.signal, (chunk) => {
        // Streaming callback
        if (this.config.enableStreaming) {
          eventBus.emit('ai:reactivity:stream', {
            requestId: request.id,
            chunk: typeof chunk === 'string' ? chunk : String(chunk || '')
          });
        }
      });

      const responseTime = Date.now() - startTime;
      this.stats.analysesCompleted++;
      this.updateStats(responseTime);

      this._log('info', `Analysis complete in ${responseTime}ms`);

      // Parse suggestions
      const suggestions = this.parseSuggestions(response);

      // Emit complete
      eventBus.emit('ai:reactivity:complete', {
        requestId: request.id,
        filePath,
        suggestions,
        responseTime,
        contextInfo: {
          tokens: contextInfo.tokens,
          fileInfo: contextInfo.fileInfo
        }
      });

    } catch (error) {
      if (error.name === 'AbortError' || error.message === 'AbortError') {
        this._log('info', 'Analysis aborted');
        this.stats.abortedRequests++;
      } else {
        this._log('error', `AI call failed: ${error.message}`);
        this.stats.analysesFailed++;
        
        eventBus.emit('ai:reactivity:error', {
          requestId: request.id,
          error: error.message
        });
      }
      
      throw error;
    }
  }

  /**
   * Estrae contesto intelligente
   */
  extractSmartContext(filePath, code, cursorLine) {
    const lines = code.split('\n');
    const totalLines = lines.length;

    // Find active code block
    let startLine = Math.max(0, cursorLine - 50);
    let endLine = Math.min(totalLines, cursorLine + 50);

    // Find function/class boundaries
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

    // Extract imports
    const importLines = lines
      .slice(0, 20)
      .filter(line => line.includes('import') || line.includes('require'))
      .join('\n');

    // Build context
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

    // Truncate if too long
    const maxChars = this.config.maxContextTokens * 4;
    const truncated = context.length > maxChars
      ? context.substring(0, maxChars) + '\n\n// [Truncated for context limit]'
      : context;

    return {
      context: truncated,
      tokens: Math.trunc(truncated.length / 4),
      fileInfo: {
        name: path.basename(filePath),
        totalLines,
        activeRange: { start: startLine + 1, end: endLine + 1 }
      }
    };
  }

  /**
   * Costruisce il prompt
   */
  buildAnalysisPrompt(contextInfo, lintErrors, trigger) {
    const systemPrompt = `Sei un esperto di coding che analizza codice in tempo reale.
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

    let userPrompt = '';

    switch (trigger) {
      case 'onSave':
        userPrompt = `Analisi post-salvataggio. Cerca:\n- Bug e edge cases\n- Refactoring opportunities\n- Performance improvements\n\nCodice:\n${contextInfo.context}`;
        break;
      
      case 'onLintError':
        userPrompt = `Fix ESLint/TS errors:\n${lintErrors.map(e => `Line ${e.line}: ${e.message}`).join('\n')}\n\nCodice:\n${contextInfo.context}`;
        break;
      
      case 'onFileSwitch':
        userPrompt = `Contesto caricato. Fornisci:\n- Overview architettura\n- Dipendenze chiave\n- Punti critici da testare\n\nCodice:\n${contextInfo.context}`;
        break;
      
      default: // idle
        userPrompt = `Analisi idle. Suggerisci:\n- Miglioramenti immediati\n- Pattern da applicare\n- Codice mancante\n\nCodice:\n${contextInfo.context}`;
    }

    return `${systemPrompt}\n\n${userPrompt}`;
  }

  /**
   * Chiama AI (Ollama HTTP API - più veloce e affidabile)
   */
  async callAI(prompt, abortSignal, onChunk) {
    const http = require('http');

    return new Promise((resolve, reject) => {
      const model = this.config.model;
      const payload = JSON.stringify({
        model: model,
        prompt: prompt,
        stream: this.config.enableStreaming
      });

      const options = {
        hostname: 'localhost',
        port: 11434,
        path: '/api/generate',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        },
        timeout: this.config.timeout
      };

      const req = http.request(options, (res) => {
        let fullResponse = '';

        res.on('data', (chunk) => {
          if (abortSignal?.aborted) {
            req.destroy();
            reject(new Error('AbortError'));
            return;
          }

          const text = chunk.toString();
          
          // Ollama streaming: ogni riga è un JSON
          if (this.config.enableStreaming) {
            const lines = text.split('\n').filter(l => l.trim());
            for (const line of lines) {
              try {
                const data = JSON.parse(line);
                if (data.response) {
                  fullResponse += data.response;
                  if (onChunk) {
                    onChunk(data.response);
                  }
                }
              } catch (e) {
                // Ignore malformed JSON
              }
            }
          } else {
            fullResponse += text;
          }
        });

        res.on('end', () => {
          if (fullResponse) {
            resolve(fullResponse);
          } else {
            reject(new Error('Empty response from Ollama'));
          }
        });

        res.on('error', (err) => {
          reject(new Error(`Ollama response error: ${err.message}`));
        });
      });

      req.on('error', (err) => {
        if (err.code === 'ECONNREFUSED') {
          reject(new Error('Ollama not running. Start Ollama service first.'));
        } else if (err.code === 'ECONNRESET' || err.message === 'AbortError') {
          reject(new Error('AbortError'));
        } else {
          reject(new Error(`Ollama request error: ${err.message}`));
        }
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Ollama timeout after ${this.config.timeout / 1000}s`));
      });

      // Check abort signal periodically
      const abortCheck = setInterval(() => {
        if (abortSignal?.aborted) {
          clearInterval(abortCheck);
          req.destroy();
          reject(new Error('AbortError'));
        }
      }, 1000);

      req.write(payload);
      req.end();
    });
  }

  /**
   * Parsa le suggestions
   */
  parseSuggestions(response) {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return parsed.suggestions || [];
      }
      return [];
    } catch (error) {
      this._log('error', `Failed to parse suggestions: ${error.message}`);
      return [];
    }
  }

  /**
   * Aggiorna statistiche
   */
  updateStats(responseTime) {
    this.stats.avgResponseTime =
      (this.stats.avgResponseTime * (this.stats.analysesCompleted - 1) + responseTime) / 
      this.stats.analysesCompleted;
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
   * Pulisce la coda
   */
  clearQueue() {
    this.queue = [];
  }

  /**
   * Ottiene stato
   */
  getStatus() {
    return {
      initialized: this._initialized,
      enabled: this.config.enabled,
      queueLength: this.queue.length,
      isProcessing: !!this.currentRequest,
      stats: this.stats,
      model: this.config.model
    };
  }

  /**
   * Log helper
   */
  _log(level, message, data = null) {
    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    const configLevel = levels[this.config.logLevel] || 1;

    if (levels[level] >= configLevel) {
      const prefix = `[AI-Reactivity] [${level.toUpperCase()}]`;
      
      switch (level) {
        case 'error':
          console.error(prefix, message, data || '');
          break;
        case 'warn':
          console.warn(prefix, message, data || '');
          break;
        default:
          console.log(prefix, message, data || '');
      }
    }
  }
}

// Modulo export
module.exports = {
  name: 'AIReactivityEngine',
  version: '2.0.0',
  
  _instance: new AiReactivityEngine(),
  
  async init(context) {
    return this._instance.init(context);
  },
  
  async shutdown() {
    return this._instance.shutdown();
  },
  
  getInstance() {
    return this._instance;
  }
};
