/**
 * TerminalSplitManager - Gestore terminali multipli con split pane
 * 
 * Features:
 * - Split orizzontale/verticale
 * - Resize pannelli
 * - Navigazione tra terminali (click e tastiera)
 * - Drag & drop per riordinare
 * - Close terminal
 * - Settings per dimensione default
 */

const { spawn } = require('child_process');
const path = require('path');
const eventBus = require('../../core/EventBus');

class TerminalSession {
  constructor(id, options = {}) {
    this.id = id;
    this.shell = options.shell || this._detectDefaultShell();
    this.cwd = options.cwd || process.cwd();
    this.name = options.name || `Terminal ${id}`;
    this.pty = null;
    this.isRunning = false;
    this.createdAt = Date.now();
  }

  /**
   * Rileva shell di default
   * @private
   */
  _detectDefaultShell() {
    if (process.platform === 'win32') {
      return process.env.COMSPEC || 'powershell.exe';
    }
    return process.env.SHELL || '/bin/bash';
  }

  /**
   * Avvia il terminale
   */
  start(cols, rows) {
    if (this.isRunning) return;

    const os = require('os');
    const pty = require('node-pty');

    this.pty = pty.spawn(this.shell, [], {
      name: 'xterm-color',
      cols: cols || 80,
      rows: rows || 24,
      cwd: this.cwd,
      env: process.env
    });

    this.isRunning = true;

    this.pty.onData((data) => {
      eventBus.emit('terminal:data', { id: this.id, data });
    });

    this.pty.onExit((exitCode) => {
      this.isRunning = false;
      eventBus.emit('terminal:exit', { id: this.id, exitCode });
    });

    eventBus.emit('terminal:started', { id: this.id });
  }

  /**
   * Scrivi nel terminale
   */
  write(data) {
    if (this.pty && this.isRunning) {
      this.pty.write(data);
    }
  }

  /**
   * Resize terminale
   */
  resize(cols, rows) {
    if (this.pty && this.isRunning) {
      this.pty.resize(cols, rows);
    }
  }

  /**
   * Chiudi terminale
   */
  close() {
    if (this.pty) {
      this.pty.kill();
      this.pty = null;
      this.isRunning = false;
      eventBus.emit('terminal:closed', { id: this.id });
    }
  }
}

class TerminalSplitManager {
  constructor() {
    this._sessions = new Map();
    this._activeSessionId = null;
    this._nextId = 1;
    this._layout = 'single'; // 'single', 'split-h', 'split-v'
    this._activeSplit = 0; // Index del terminale attivo nello split
    this._config = {
      defaultShell: this._detectDefaultShell(),
      defaultCwd: process.cwd(),
      fontSize: 14,
      fontFamily: "'Cascadia Code', 'Fira Code', 'Consolas', monospace",
      cursorBlink: true,
      cursorStyle: 'block', // 'block', 'line', 'underline'
      scrollback: 5000,
      splitSize: 0.5, // 50% per split
      autoDetectCwd: true
    };

    this._initialized = false;
  }

  /**
   * Rileva shell di default
   * @private
   */
  _detectDefaultShell() {
    if (process.platform === 'win32') {
      return process.env.COMSPEC || 'powershell.exe';
    }
    return process.env.SHELL || '/bin/bash';
  }

  /**
   * Inizializza il manager
   */
  async init(context) {
    console.log('[TerminalSplitManager] Initializing...');
    
    // Load config
    try {
      const configPath = path.join(context.userDataPath, 'terminal-config.json');
      const fs = require('fs').promises;
      const configData = await fs.readFile(configPath, 'utf-8');
      this._config = { ...this._config, ...JSON.parse(configData) };
      console.log('[TerminalSplitManager] Config loaded');
    } catch (err) {
      console.log('[TerminalSplitManager] Using default config');
    }

    this._initialized = true;
    eventBus.emit('terminal:manager:initialized', { config: this._config });
    console.log('[TerminalSplitManager] Initialized');
  }

  /**
   * Spegne il manager
   */
  async shutdown() {
    console.log('[TerminalSplitManager] Shutting down...');
    
    for (const [, session] of this._sessions.entries()) {
      session.close();
    }
    
    this._sessions.clear();
    this._initialized = false;
    eventBus.emit('terminal:manager:shutdown');
  }

  /**
   * Crea un nuovo terminale
   */
  createTerminal(options = {}) {
    const id = this._nextId++;
    const session = new TerminalSession(id, {
      shell: options.shell || this._config.defaultShell,
      cwd: options.cwd || this._config.defaultCwd,
      name: options.name || `Terminal ${id}`
    });

    this._sessions.set(id, session);
    
    eventBus.emit('terminal:created', { 
      id, 
      name: session.name, 
      shell: session.shell 
    });

    console.log(`[TerminalSplitManager] Created terminal ${id}`);
    return id;
  }

  /**
   * Avvia un terminale
   */
  startTerminal(id, cols, rows) {
    const session = this._sessions.get(id);
    
    if (!session) {
      throw new Error(`[TerminalSplitManager] Terminal ${id} not found`);
    }

    session.start(cols, rows);
    this._activeSessionId = id;
  }

  /**
   * Scrivi in un terminale
   */
  writeToTerminal(id, data) {
    const session = this._sessions.get(id);
    
    if (session) {
      session.write(data);
    }
  }

  /**
   * Resize terminale
   */
  resizeTerminal(id, cols, rows) {
    const session = this._sessions.get(id);
    
    if (session) {
      session.resize(cols, rows);
    }
  }

  /**
   * Chiudi terminale
   */
  closeTerminal(id) {
    const session = this._sessions.get(id);
    
    if (session) {
      session.close();
      this._sessions.delete(id);
      
      if (this._activeSessionId === id) {
        this._activeSessionId = this._sessions.size > 0 
          ? Array.from(this._sessions.keys())[0] 
          : null;
      }

      eventBus.emit('terminal:closed', { id });
      console.log(`[TerminalSplitManager] Closed terminal ${id}`);
    }
  }

  /**
   * Ottieni sessione attiva
   */
  getActiveSession() {
    return this._sessions.get(this._activeSessionId) || null;
  }

  /**
   * Imposta sessione attiva
   */
  setActiveSession(id) {
    if (this._sessions.has(id)) {
      this._activeSessionId = id;
      eventBus.emit('terminal:active-changed', { id });
    }
  }

  /**
   * Ottieni tutte le sessioni
   */
  getAllSessions() {
    return Array.from(this._sessions.values()).map(s => ({
      id: s.id,
      name: s.name,
      shell: s.shell,
      cwd: s.cwd,
      isRunning: s.isRunning,
      isActive: s.id === this._activeSessionId
    }));
  }

  /**
   * Split terminale (orizzontale)
   */
  splitHorizontal() {
    const newId = this.createTerminal();
    this._layout = 'split-h';
    this._activeSplit = 1;
    
    eventBus.emit('terminal:split', { 
      layout: this._layout, 
      activeSplit: this._activeSplit 
    });

    return newId;
  }

  /**
   * Split terminale (verticale)
   */
  splitVertical() {
    const newId = this.createTerminal();
    this._layout = 'split-v';
    this._activeSplit = 1;
    
    eventBus.emit('terminal:split', { 
      layout: this._layout, 
      activeSplit: this._activeSplit 
    });

    return newId;
  }

  /**
   * Torna a singolo terminale
   */
  setSingleLayout() {
    this._layout = 'single';
    this._activeSplit = 0;
    
    eventBus.emit('terminal:layout-changed', { layout: 'single' });
  }

  /**
   * Ottieni layout corrente
   */
  getLayout() {
    return {
      layout: this._layout,
      activeSplit: this._activeSplit,
      terminalCount: this._sessions.size
    };
  }

  /**
   * Aggiorna configurazione
   */
  updateConfig(newConfig) {
    this._config = { ...this._config, ...newConfig };
    eventBus.emit('terminal:config-updated', { config: this._config });
  }

  /**
   * Ottieni configurazione
   */
  getConfig() {
    return { ...this._config };
  }

  /**
   * Ottieni stato
   */
  getStatus() {
    return {
      initialized: this._initialized,
      activeSession: this._activeSessionId,
      layout: this._layout,
      terminalCount: this._sessions.size,
      config: this._config
    };
  }
}

// Modulo export
module.exports = {
  name: 'TerminalSplitManager',
  version: '1.0.0',
  
  _instance: new TerminalSplitManager(),
  
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
