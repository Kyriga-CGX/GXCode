/**
 * LSPClient - Client Language Server Protocol
 * 
 * Connette e comunica con language server esterni
 * Supporta: TypeScript, Python, Java, JSON, HTML, CSS
 */

const { spawn } = require('child_process');
const path = require('path');
const eventBus = require('../../core/EventBus');

class LSPClient {
  constructor(language, config, workspacePath) {
    this.language = language;
    this.config = config;
    this.workspacePath = workspacePath;
    
    this.process = null;
    this.messageId = 1;
    this.callbacks = new Map();
    this.capabilities = null;
    this.isReady = false;
    this.isRunning = false;
    
    // Document state
    this.openDocuments = new Map(); // Map<uri, document>
    
    // Diagnostics cache
    this.diagnostics = new Map(); // Map<uri, diagnostics[]>
  }

  /**
   * Avvia il language server
   */
  async start() {
    if (this.isRunning) {
      console.warn(`[LSP:${this.language}] Already running`);
      return;
    }

    console.log(`[LSP:${this.language}] Starting ${this.config.command}...`);

    try {
      // Spawn LSP server con stdio
      this.process = spawn(this.config.command, this.config.args || [], {
        cwd: this.workspacePath,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env }
      });

      this.isRunning = true;

      // Setup stdout listener
      this.process.stdout.on('data', (data) => {
        this._handleMessage(data.toString());
      });

      // Setup stderr listener
      this.process.stderr.on('data', (data) => {
        console.error(`[LSP:${this.language}] stderr:`, data.toString());
      });

      this.process.on('error', (err) => {
        console.error(`[LSP:${this.language}] Process error:`, err.message);
        this.isRunning = false;
        eventBus.emit('lsp:error', { 
          language: this.language, 
          error: err.message 
        });
      });

      this.process.on('close', (code) => {
        console.log(`[LSP:${this.language}] Process closed with code ${code}`);
        this.isRunning = false;
        this.isReady = false;
        eventBus.emit('lsp:closed', { language: this.language });
      });

      // Initialize LSP connection
      await this._initialize();

      console.log(`[LSP:${this.language}] Started successfully`);
      eventBus.emit('lsp:started', { language: this.language });

    } catch (err) {
      console.error(`[LSP:${this.language}] Failed to start:`, err.message);
      this.isRunning = false;
      throw err;
    }
  }

  /**
   * Inizializza la connessione LSP
   * @private
   */
  async _initialize() {
    const result = await this._sendRequest('initialize', {
      processId: process.pid,
      clientInfo: {
        name: 'GXCode',
        version: '1.6.1'
      },
      rootUri: this._pathToUri(this.workspacePath),
      rootPath: this.workspacePath,
      capabilities: {
        textDocument: {
          synchronization: {
            didSave: true,
            willSave: true,
            willSaveWaitUntil: false
          },
          completion: {
            completionItem: {
              snippetSupport: true,
              commitCharactersSupport: true
            }
          },
          hover: {
            contentFormat: ['markdown', 'plaintext']
          },
          signatureHelp: {
            signatureInformation: {
              documentationFormat: ['markdown', 'plaintext']
            }
          },
          definition: {
            linkSupport: true
          },
          references: {},
          rename: {
            prepareSupport: true
          },
          publishDiagnostics: {
            relatedInformation: true
          },
          codeAction: {
            codeActionLiteralSupport: {
              codeActionKind: {
                valueSet: ['', 'quickfix', 'refactor', 'refactor.extract', 'source']
              }
            }
          },
          formatting: {}
        },
        workspace: {
          applyEdit: true,
          workspaceEdit: {
            documentChanges: true
          }
        }
      },
      initializationOptions: this.config.settings || {}
    });

    this.capabilities = result?.capabilities || {};
    this.isReady = true;

    // Notify server that we're initialized
    this._sendNotification('initialized', {});

    console.log(`[LSP:${this.language}] Initialized with capabilities:`, Object.keys(this.capabilities));
    eventBus.emit('lsp:ready', { 
      language: this.language, 
      capabilities: this.capabilities 
    });
  }

  /**
   * Apre un documento
   * @param {string} filePath - Percorso file
   * @param {string} content - Contenuto file
   * @param {string} [languageId] - Language ID
   */
  async openDocument(filePath, content, languageId = null) {
    if (!this.isReady) {
      console.warn(`[LSP:${this.language}] Not ready yet`);
      return;
    }

    const uri = this._pathToUri(filePath);
    
    this.openDocuments.set(uri, {
      uri,
      filePath,
      content,
      version: 1,
      languageId: languageId || this.language
    });

    this._sendNotification('textDocument/didOpen', {
      textDocument: {
        uri,
        languageId: languageId || this.language,
        version: 1,
        text: content
      }
    });

    console.log(`[LSP:${this.language}] Opened document: ${path.basename(filePath)}`);
  }

  /**
   * Chiude un documento
   * @param {string} filePath - Percorso file
   */
  async closeDocument(filePath) {
    const uri = this._pathToUri(filePath);
    
    if (!this.openDocuments.has(uri)) {
      return;
    }

    this._sendNotification('textDocument/didClose', {
      textDocument: { uri }
    });

    this.openDocuments.delete(uri);
    console.log(`[LSP:${this.language}] Closed document: ${path.basename(filePath)}`);
  }

  /**
   * Aggiorna contenuto documento
   * @param {string} filePath - Percorso file
   * @param {string} content - Nuovo contenuto
   * @param {Array} [contentChanges] - Cambi incrementali
   */
  async updateDocument(filePath, content, contentChanges = null) {
    const uri = this._pathToUri(filePath);
    const doc = this.openDocuments.get(uri);

    if (!doc) {
      console.warn(`[LSP:${this.language}] Document not open: ${filePath}`);
      return;
    }

    doc.version++;
    doc.content = content;

    this._sendNotification('textDocument/didChange', {
      textDocument: { uri, version: doc.version },
      contentChanges: contentChanges || [{ text: content }]
    });
  }

  /**
   * Cambiamento documento incrementale (alias)
   * @param {string} filePath - Percorso file
   * @param {Array} changes - Cambiamenti
   */
  async changeDocument(filePath, changes) {
    return await this.updateDocument(filePath, null, changes);
  }

  /**
   * Salva documento
   * @param {string} filePath - Percorso file
   */
  async saveDocument(filePath) {
    const uri = this._pathToUri(filePath);
    
    this._sendNotification('textDocument/didSave', {
      textDocument: { uri },
      text: this.openDocuments.get(uri)?.content
    });
  }

  /**
   * Ottieni completamento
   * @param {string} filePath - Percorso file
   * @param {Object} position - { line, character }
   * @returns {Promise<Array>} - Lista completamenti
   */
  async getCompletion(filePath, position) {
    const uri = this._pathToUri(filePath);

    const result = await this._sendRequest('textDocument/completion', {
      textDocument: { uri },
      position
    });

    return result?.items || result || [];
  }

  /**
   * Risolvi dettagli completamento
   * @param {Object} completionItem - Elemento completamento
   * @returns {Promise<Object>} - Elemento risolto
   */
  async resolveCompletion(completionItem) {
    const result = await this._sendRequest('completionItem/resolve', completionItem);
    return result || completionItem;
  }

  /**
   * Ottieni definizione (Go to Definition)
   * @param {string} filePath - Percorso file
   * @param {Object} position - { line, character }
   * @returns {Promise<Object|null>} - Location definizione
   */
  async getDefinition(filePath, position) {
    const uri = this._pathToUri(filePath);
    
    const result = await this._sendRequest('textDocument/definition', {
      textDocument: { uri },
      position
    });

    if (Array.isArray(result) && result.length > 0) {
      return result[0];
    }
    
    return result || null;
  }

  /**
   * Ottieni riferimenti
   * @param {string} filePath - Percorso file
   * @param {Object} position - { line, character }
   * @returns {Promise<Array>} - Lista location
   */
  async getReferences(filePath, position) {
    const uri = this._pathToUri(filePath);
    
    const result = await this._sendRequest('textDocument/references', {
      textDocument: { uri },
      position,
      context: { includeDeclaration: true }
    });

    return result || [];
  }

  /**
   * Ottieni hover info
   * @param {string} filePath - Percorso file
   * @param {Object} position - { line, character }
   * @returns {Promise<Object|null>} - Hover content
   */
  async getHover(filePath, position) {
    const uri = this._pathToUri(filePath);
    
    const result = await this._sendRequest('textDocument/hover', {
      textDocument: { uri },
      position
    });

    return result?.contents || null;
  }

  /**
   * Ottieni signature help
   * @param {string} filePath - Percorso file
   * @param {Object} position - { line, character }
   * @returns {Promise<Object|null>} - Signature info
   */
  async getSignatureHelp(filePath, position) {
    const uri = this._pathToUri(filePath);
    
    const result = await this._sendRequest('textDocument/signatureHelp', {
      textDocument: { uri },
      position
    });

    return result || null;
  }

  /**
   * Rename symbol
   * @param {string} filePath - Percorso file
   * @param {Object} position - { line, character }
   * @param {string} newName - Nuovo nome
   * @returns {Promise<Object>} - Workspace edit
   */
  async renameSymbol(filePath, position, newName) {
    const uri = this._pathToUri(filePath);
    
    const result = await this._sendRequest('textDocument/rename', {
      textDocument: { uri },
      position,
      newName
    });

    return result || null;
  }

  /**
   * Ottieni diagnostics
   * @param {string} filePath - Percorso file
   * @returns {Array} - Lista diagnostics
   */
  getDiagnostics(filePath) {
    const uri = this._pathToUri(filePath);
    return this.diagnostics.get(uri) || [];
  }

  /**
   * Formatta documento
   * @param {string} filePath - Percorso file
   * @param {Object} [options] - Formattazione options
   * @returns {Promise<Array>} - Text edits
   */
  async formatDocument(filePath, options = {}) {
    const uri = this._pathToUri(filePath);
    
    const result = await this._sendRequest('textDocument/formatting', {
      textDocument: { uri },
      options: {
        tabSize: options.tabSize || 2,
        insertSpaces: options.insertSpaces !== false
      }
    });

    return result || [];
  }

  /**
   * Ottieni code actions
   * @param {string} filePath - Percorso file
   * @param {Object} range - { start, end }
   * @param {Array} context - Diagnostics context
   * @returns {Promise<Array>} - Code actions
   */
  async getCodeActions(filePath, range, context = {}) {
    const uri = this._pathToUri(filePath);
    
    const result = await this._sendRequest('textDocument/codeAction', {
      textDocument: { uri },
      range,
      context
    });

    return result || [];
  }

  /**
   * Ferma il language server
   */
  async stop() {
    if (!this.isRunning) {
      return;
    }

    console.log(`[LSP:${this.language}] Stopping...`);

    try {
      // Send shutdown request
      await this._sendRequest('shutdown', null, 5000);
      
      // Send exit notification
      this._sendNotification('exit');
      
      // Kill process
      if (this.process) {
        this.process.kill();
        this.process = null;
      }
    } catch (err) {
      console.error(`[LSP:${this.language}] Error stopping:`, err.message);
    }

    this.isRunning = false;
    this.isReady = false;
    this.openDocuments.clear();
    
    eventBus.emit('lsp:stopped', { language: this.language });
  }

  /**
   * Invia richiesta LSP
   * @private
   */
  _sendRequest(method, params, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const id = this.messageId++;
      
      const timeoutId = setTimeout(() => {
        this.callbacks.delete(id);
        reject(new Error(`LSP request timeout: ${method}`));
      }, timeout);

      this.callbacks.set(id, { resolve, reject, timeoutId, method });

      this._send({
        jsonrpc: '2.0',
        id,
        method,
        params
      });
    });
  }

  /**
   * Invia notifica LSP (senza risposta)
   * @private
   */
  _sendNotification(method, params = null) {
    this._send({
      jsonrpc: '2.0',
      method,
      params
    });
  }

  /**
   * Invia messaggio al processo
   * @private
   */
  _send(message) {
    if (!this.process || !this.process.stdin) {
      console.error(`[LSP:${this.language}] Process not available`);
      return;
    }

    const content = JSON.stringify(message);
    const header = `Content-Length: ${Buffer.byteLength(content, 'utf-8')}\r\n\r\n`;
    
    this.process.stdin.write(header + content);
  }

  /**
   * Gestisce messaggio ricevuto
   * @private
   */
  _handleMessage(data) {
    try {
      // Parse LSP message (Content-Length header + JSON body)
      const parts = data.split('\r\n\r\n');
      
      for (let i = 1; i < parts.length; i += 2) {
        const body = parts[i];
        if (!body) continue;

        const message = JSON.parse(body);

        if (message.id && this.callbacks.has(message.id)) {
          // Response to request
          const callback = this.callbacks.get(message.id);
          clearTimeout(callback.timeoutId);
          this.callbacks.delete(message.id);

          if (message.error) {
            callback.reject(new Error(message.error.message));
          } else {
            callback.resolve(message.result);
          }
        } else if (message.method) {
          // Server notification
          this._handleNotification(message.method, message.params);
        }
      }
    } catch (err) {
      console.error(`[LSP:${this.language}] Error handling message:`, err.message);
    }
  }

  /**
   * Gestisce notifica dal server
   * @private
   */
  _handleNotification(method, params) {
    switch (method) {
      case 'textDocument/publishDiagnostics':
        this._handleDiagnostics(params);
        break;
      
      case 'window/showMessage':
        console.log(`[LSP:${this.language}] Message:`, params.message);
        eventBus.emit('lsp:message', { 
          language: this.language, 
          type: params.type, 
          message: params.message 
        });
        break;
      
      default:
        eventBus.emit('lsp:notification', { method, params });
    }
  }

  /**
   * Gestisce diagnostics
   * @private
   */
  _handleDiagnostics(params) {
    const { uri, diagnostics } = params;
    this.diagnostics.set(uri, diagnostics);

    eventBus.emit('lsp:diagnostics', {
      language: this.language,
      uri,
      filePath: this._uriToPath(uri),
      diagnostics
    });
  }

  /**
   * Converte percorso a URI
   * @private
   */
  _pathToUri(filePath) {
    const absolutePath = path.resolve(filePath).replace(/\\/g, '/');
    return `file:///${absolutePath}`;
  }

  /**
   * Converte URI a percorso
   * @private
   */
  _uriToPath(uri) {
    return uri.replace('file:///', '').replace(/\//g, path.sep);
  }

  /**
   * Ottiene stato
   */
  getStatus() {
    return {
      language: this.language,
      isRunning: this.isRunning,
      isReady: this.isReady,
      openDocuments: this.openDocuments.size,
      diagnosticsCount: Array.from(this.diagnostics.values()).reduce((sum, d) => sum + d.length, 0)
    };
  }
}

module.exports = LSPClient;
