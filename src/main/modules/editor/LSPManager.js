/**
 * LSPManager - Coordinatore per Language Server Protocol
 * 
 * Gestisce multipli LSPClient per diversi linguaggi
 * Fornisce interfaccia unificata per l'editor
 */

const path = require('path');
const fs = require('fs').promises;
const LSPClient = require('./LSPClient');
const eventBus = require('../../core/EventBus');

class LSPManager {
  constructor() {
    this.clients = new Map(); // Map<language, LSPClient>
    this.config = null;
    this.workspacePath = null;
    this._initialized = false;
  }

  /**
   * Inizializza il manager
   * @param {Object} context - Contesto
   */
  async init(context) {
    console.log('[LSPManager] Initializing...');
    
    this.workspacePath = context.workspacePath || null;
    
    // Load LSP config
    try {
      const configPath = path.join(context.userDataPath, 'lsp-config.json');
      const configData = await fs.readFile(configPath, 'utf-8');
      this.config = JSON.parse(configData);
      console.log('[LSPManager] Config loaded');
    } catch (err) {
      // Load default config
      this.config = this._getDefaultConfig();
      console.log('[LSPManager] Using default config');
    }

    this._initialized = true;
    
    eventBus.emit('lsp:manager:initialized', { config: this.config });
    console.log('[LSPManager] Initialized');
  }

  /**
   * Spegne il manager
   */
  async shutdown() {
    console.log('[LSPManager] Shutting down...');
    
    // Stop all clients
    for (const [language, client] of this.clients.entries()) {
      try {
        await client.stop();
        console.log(`[LSPManager] Stopped ${language}`);
      } catch (err) {
        console.error(`[LSPManager] Error stopping ${language}:`, err.message);
      }
    }
    
    this.clients.clear();
    this._initialized = false;
    
    eventBus.emit('lsp:manager:shutdown');
  }

  /**
   * Avvia language server per un linguaggio
   * @param {string} language - Linguaggio
   * @returns {Promise<LSPClient|null>}
   */
  async startLanguageServer(language) {
    if (!this._initialized) {
      console.warn('[LSPManager] Not initialized');
      return null;
    }

    const langConfig = this.config.languages?.[language];
    
    if (!langConfig || !langConfig.enabled) {
      console.log(`[LSPManager] ${language} not enabled`);
      return null;
    }

    // Check if already running
    if (this.clients.has(language)) {
      console.log(`[LSPManager] ${language} server already running`);
      return this.clients.get(language);
    }

    try {
      const client = new LSPClient(language, langConfig, this.workspacePath);
      await client.start();
      
      this.clients.set(language, client);
      
      eventBus.emit('lsp:server:started', { language });
      console.log(`[LSPManager] ${language} server started`);
      
      return client;
    } catch (err) {
      console.error(`[LSPManager] Failed to start ${language}:`, err.message);
      eventBus.emit('lsp:server:error', { language, error: err.message });
      return null;
    }
  }

  /**
   * Ferma language server per un linguaggio
   * @param {string} language - Linguaggio
   */
  async stopLanguageServer(language) {
    const client = this.clients.get(language);
    
    if (!client) {
      return;
    }

    try {
      await client.stop();
      this.clients.delete(language);
      
      eventBus.emit('lsp:server:stopped', { language });
      console.log(`[LSPManager] ${language} server stopped`);
    } catch (err) {
      console.error(`[LSPManager] Error stopping ${language}:`, err.message);
    }
  }

  /**
   * Ottieni client per linguaggio
   * @param {string} language - Linguaggio
   * @returns {LSPClient|null}
   */
  getClient(language) {
    return this.clients.get(language) || null;
  }

  /**
   * Determina linguaggio da estensione file
   * @param {string} filePath - Percorso file
   * @returns {string|null}
   */
  getLanguageFromPath(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    
    const extToLanguage = {
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.py': 'python',
      '.java': 'java',
      '.json': 'json',
      '.html': 'html',
      '.htm': 'html',
      '.css': 'css',
      '.scss': 'css',
      '.less': 'css'
    };
    
    return extToLanguage[ext] || null;
  }

  /**
   * Avvia automaticamente i server abilitati
   */
  async autoStartServers() {
    if (!this.config?.global?.autoStart) {
      console.log('[LSPManager] Auto-start disabled');
      return;
    }

    console.log('[LSPManager] Auto-starting enabled servers...');
    
    const languages = this.config.languages || {};
    const started = [];
    const failed = [];

    for (const [language, langConfig] of Object.entries(languages)) {
      if (langConfig.enabled) {
        try {
          const client = await this.startLanguageServer(language);
          if (client) {
            started.push(language);
          }
        } catch (err) {
          failed.push({ language, error: err.message });
        }
      }
    }

    console.log(`[LSPManager] Started: ${started.join(', ') || 'none'}`);
    if (failed.length > 0) {
      console.log(`[LSPManager] Failed: ${failed.map(f => f.language).join(', ')}`);
    }

    return { started, failed };
  }

  /**
   * Apre un documento nel LSP appropriato
   * @param {string} filePath - Percorso file
   * @param {string} content - Contenuto
   */
  async openDocument(filePath, content) {
    const language = this.getLanguageFromPath(filePath);
    
    if (!language) {
      return;
    }

    // Ensure server is running
    let client = this.clients.get(language);
    
    if (!client) {
      client = await this.startLanguageServer(language);
    }

    if (client) {
      await client.openDocument(filePath, content);
    }
  }

  /**
   * Chiude un documento
   * @param {string} filePath - Percorso file
   */
  async closeDocument(filePath) {
    const language = this.getLanguageFromPath(filePath);
    
    if (!language) {
      return;
    }

    const client = this.clients.get(language);
    
    if (client) {
      await client.closeDocument(filePath);
    }
  }

  /**
   * Aggiorna documento
   * @param {string} filePath - Percorso file
   * @param {string} content - Contenuto
   */
  async updateDocument(filePath, content) {
    const language = this.getLanguageFromPath(filePath);

    if (!language) {
      return;
    }

    const client = this.clients.get(language);

    if (client) {
      await client.updateDocument(filePath, content);
    }
  }

  /**
   * Cambiamento documento incrementale
   * @param {string} filePath - Percorso file
   * @param {Array} changes - Cambiamenti
   */
  async changeDocument(filePath, changes) {
    const language = this.getLanguageFromPath(filePath);

    if (!language) {
      return;
    }

    const client = this.clients.get(language);

    if (client) {
      await client.changeDocument(filePath, changes);
    }
  }

  /**
   * Ottieni completamento
   * @param {string} filePath - Percorso file
   * @param {number} line - Linea
   * @param {number} column - Colonna
   * @returns {Promise<Array>}
   */
  async getCompletion(filePath, line, column) {
    const language = this.getLanguageFromPath(filePath);

    if (!language) {
      return [];
    }

    const client = this.clients.get(language);

    if (!client || !client.isReady) {
      return [];
    }

    try {
      return await client.getCompletion(filePath, line, column);
    } catch (err) {
      console.error(`[LSPManager] Completion error:`, err.message);
      return [];
    }
  }

  /**
   * Risolvi elemento completamento
   * @param {Object} completionItem - Elemento completamento
   * @returns {Promise<Object>}
   */
  async resolveCompletion(completionItem) {
    // Usa il client del linguaggio dell'item
    const language = completionItem.language || null;

    if (!language) {
      return completionItem;
    }

    const client = this.clients.get(language);

    if (!client || !client.isReady) {
      return completionItem;
    }

    try {
      return await client.resolveCompletion(completionItem);
    } catch (err) {
      console.error(`[LSPManager] Completion resolve error:`, err.message);
      return completionItem;
    }
  }

  /**
   * Ottieni tutti i diagnostici
   * @returns {Map}
   */
  getAllDiagnostics() {
    const allDiagnostics = new Map();

    for (const [language, client] of this.clients.entries()) {
      const diagnostics = client.diagnostics;
      for (const [uri, diags] of diagnostics.entries()) {
        allDiagnostics.set(uri, diags);
      }
    }

    return allDiagnostics;
  }

  /**
   * Ottieni definizione
   * @param {string} filePath - Percorso file
   * @param {number} line - Linea
   * @param {number} column - Colonna
   * @returns {Promise<Object>}
   */
  async getDefinition(filePath, line, column) {
    return await this.goToDefinition(filePath, { line, character: column });
  }

  /**
   * Ottieni referenze
   * @param {string} filePath - Percorso file
   * @param {number} line - Linea
   * @param {number} column - Colonna
   * @returns {Promise<Array>}
   */
  async getReferences(filePath, line, column) {
    return await this.findReferences(filePath, { line, character: column });
  }

  /**
   * Formatta intervallo
   * @param {string} filePath - Percorso file
   * @param {number} startLine - Linea inizio
   * @param {number} endLine - Linea fine
   * @returns {Promise<Array>}
   */
  async formatRange(filePath, startLine, endLine) {
    return await this.formatDocument(filePath, {
      range: {
        start: { line: startLine, character: 0 },
        end: { line: endLine, character: 0 }
      }
    });
  }

  /**
   * Esegui comando
   * @param {string} command - Comando
   * @param {Array} args - Argomenti
   * @returns {Promise<Object>}
   */
  async executeCommand(command, args) {
    // Implementazione generica - dipende dal client
    console.log(`[LSPManager] Execute command: ${command}`);
    return { success: true };
  }

  /**
   * Salva documento
   * @param {string} filePath - Percorso file
   */
  async saveDocument(filePath) {
    const language = this.getLanguageFromPath(filePath);
    
    if (!language) {
      return;
    }

    const client = this.clients.get(language);
    
    if (client) {
      await client.saveDocument(filePath);
    }
  }

  /**
   * Go to Definition
   * @param {string} filePath - Percorso file
   * @param {Object} position - { line, character }
   * @returns {Promise<Object|null>}
   */
  async goToDefinition(filePath, position) {
    const language = this.getLanguageFromPath(filePath);
    
    if (!language) {
      return null;
    }

    const client = this.clients.get(language);
    
    if (!client) {
      return null;
    }

    try {
      return await client.getDefinition(filePath, position);
    } catch (err) {
      console.error(`[LSPManager] Go to definition failed:`, err.message);
      return null;
    }
  }

  /**
   * Find References
   * @param {string} filePath - Percorso file
   * @param {Object} position - { line, character }
   * @returns {Promise<Array>}
   */
  async findReferences(filePath, position) {
    const language = this.getLanguageFromPath(filePath);
    
    if (!language) {
      return [];
    }

    const client = this.clients.get(language);
    
    if (!client) {
      return [];
    }

    try {
      return await client.getReferences(filePath, position);
    } catch (err) {
      console.error(`[LSPManager] Find references failed:`, err.message);
      return [];
    }
  }

  /**
   * Get Hover
   * @param {string} filePath - Percorso file
   * @param {Object} position - { line, character }
   * @returns {Promise<Object|null>}
   */
  async getHover(filePath, position) {
    const language = this.getLanguageFromPath(filePath);
    
    if (!language) {
      return null;
    }

    const client = this.clients.get(language);
    
    if (!client) {
      return null;
    }

    try {
      return await client.getHover(filePath, position);
    } catch (err) {
      console.error(`[LSPManager] Get hover failed:`, err.message);
      return null;
    }
  }

  /**
   * Get Signature Help
   * @param {string} filePath - Percorso file
   * @param {Object} position - { line, character }
   * @returns {Promise<Object|null>}
   */
  async getSignatureHelp(filePath, position) {
    const language = this.getLanguageFromPath(filePath);
    
    if (!language) {
      return null;
    }

    const client = this.clients.get(language);
    
    if (!client) {
      return null;
    }

    try {
      return await client.getSignatureHelp(filePath, position);
    } catch (err) {
      console.error(`[LSPManager] Get signature help failed:`, err.message);
      return null;
    }
  }

  /**
   * Rename Symbol
   * @param {string} filePath - Percorso file
   * @param {Object} position - { line, character }
   * @param {string} newName - Nuovo nome
   * @returns {Promise<Object|null>}
   */
  async renameSymbol(filePath, position, newName) {
    const language = this.getLanguageFromPath(filePath);
    
    if (!language) {
      return null;
    }

    const client = this.clients.get(language);
    
    if (!client) {
      return null;
    }

    try {
      return await client.renameSymbol(filePath, position, newName);
    } catch (err) {
      console.error(`[LSPManager] Rename symbol failed:`, err.message);
      return null;
    }
  }

  /**
   * Get Code Actions
   * @param {string} filePath - Percorso file
   * @param {Object} range - { start, end }
   * @param {Object} context - Context
   * @returns {Promise<Array>}
   */
  async getCodeActions(filePath, range, context = {}) {
    const language = this.getLanguageFromPath(filePath);
    
    if (!language) {
      return [];
    }

    const client = this.clients.get(language);
    
    if (!client) {
      return [];
    }

    try {
      return await client.getCodeActions(filePath, range, context);
    } catch (err) {
      console.error(`[LSPManager] Get code actions failed:`, err.message);
      return [];
    }
  }

  /**
   * Format Document
   * @param {string} filePath - Percorso file
   * @param {Object} options - Options
   * @returns {Promise<Array>}
   */
  async formatDocument(filePath, options = {}) {
    const language = this.getLanguageFromPath(filePath);
    
    if (!language) {
      return [];
    }

    const client = this.clients.get(language);
    
    if (!client) {
      return [];
    }

    try {
      return await client.formatDocument(filePath, options);
    } catch (err) {
      console.error(`[LSPManager] Format document failed:`, err.message);
      return [];
    }
  }

  /**
   * Get Diagnostics
   * @param {string} filePath - Percorso file
   * @returns {Array}
   */
  getDiagnostics(filePath) {
    const language = this.getLanguageFromPath(filePath);
    
    if (!language) {
      return [];
    }

    const client = this.clients.get(language);
    
    if (!client) {
      return [];
    }

    return client.getDiagnostics(filePath);
  }

  /**
   * Aggiorna configurazione
   * @param {Object} newConfig - Nuova configurazione
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    
    eventBus.emit('lsp:config:updated', { config: this.config });
    console.log('[LSPManager] Config updated');
  }

  /**
   * Ottiene stato di tutti i server
   * @returns {Object}
   */
  getStatus() {
    const status = {
      initialized: this._initialized,
      servers: {}
    };

    for (const [language, client] of this.clients.entries()) {
      status.servers[language] = client.getStatus();
    }

    return status;
  }

  /**
   * Configurazione default
   * @private
   */
  _getDefaultConfig() {
    return {
      languages: {
        javascript: {
          enabled: true,
          command: 'typescript-language-server',
          args: ['--stdio']
        },
        typescript: {
          enabled: true,
          command: 'typescript-language-server',
          args: ['--stdio']
        },
        json: {
          enabled: true,
          command: 'vscode-json-languageserver',
          args: ['--stdio']
        },
        html: {
          enabled: true,
          command: 'vscode-html-languageserver',
          args: ['--stdio']
        },
        css: {
          enabled: true,
          command: 'vscode-css-languageserver',
          args: ['--stdio']
        }
      },
      global: {
        autoStart: true,
        logLevel: 'info'
      }
    };
  }
}

// Modulo export
module.exports = {
  name: 'LSPManager',
  version: '1.0.0',
  
  _instance: new LSPManager(),
  
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
