/**
 * CommandRegistry - Registro comandi globali per GXCode
 * 
 * Permette di registrare, cercare ed eseguire comandi
 * Ogni comando ha: id, label, keybinding, execute()
 */

const eventBus = require('../core/EventBus');

class CommandRegistry {
  constructor() {
    this._commands = new Map();
    this._categories = new Set();
  }

  /**
   * Registra un comando
   * @param {Object} command - Configurazione comando
   * @param {string} command.id - ID univoco (es: 'file:save')
   * @param {string} command.label - Label visibile (es: 'Save File')
   * @param {string} [command.category] - Categoria (es: 'File', 'Edit')
   * @param {string} [command.keybinding] - Scorciatoia (es: 'Ctrl+S')
   * @param {string} [command.icon] - Icona (emoji o classe)
   * @param {Function} command.execute - Funzione da eseguire
   * @param {Function} [command.enabled] - Funzione per controllare se abilitato
   * @param {string} [command.description] - Descrizione estesa
   */
  register(command) {
    if (!command.id || !command.label || !command.execute) {
      throw new Error('[CommandRegistry] Command must have id, label, and execute function');
    }

    if (this._commands.has(command.id)) {
      console.warn(`[CommandRegistry] Command "${command.id}" already registered, overwriting`);
    }

    const cmd = {
      ...command,
      category: command.category || 'Other',
      enabled: command.enabled || (() => true),
      usageCount: 0
    };

    this._commands.set(command.id, cmd);
    this._categories.add(cmd.category);

    console.log(`[CommandRegistry] Registered: ${command.id} (${command.label})`);
    
    eventBus.emit('command:registered', { id: command.id });
    
    // Return unregister function
    return () => this.unregister(command.id);
  }

  /**
   * Registra multipli comandi
   * @param {Array<Object>} commands - Array di comandi
   */
  registerMany(commands) {
    for (const command of commands) {
      this.register(command);
    }
  }

  /**
   * Annulla registrazione comando
   * @param {string} id - ID comando
   */
  unregister(id) {
    const removed = this._commands.delete(id);
    
    if (removed) {
      console.log(`[CommandRegistry] Unregistered: ${id}`);
      eventBus.emit('command:unregistered', { id });
    }
    
    return removed;
  }

  /**
   * Esegue un comando per ID
   * @param {string} id - ID comando
   * @param {...*} args - Argomenti per execute
   * @returns {Promise<*>} - Risultato execute
   */
  async execute(id, ...args) {
    const command = this._commands.get(id);
    
    if (!command) {
      throw new Error(`[CommandRegistry] Command not found: ${id}`);
    }

    if (!command.enabled()) {
      console.warn(`[CommandRegistry] Command disabled: ${id}`);
      return null;
    }

    console.log(`[CommandRegistry] Executing: ${id}`);
    
    try {
      const result = await command.execute(...args);
      command.usageCount++;
      
      eventBus.emit('command:executed', { id, args });
      
      return result;
    } catch (err) {
      console.error(`[CommandRegistry] Error executing ${id}:`, err.message);
      eventBus.emit('command:error', { id, error: err.message });
      throw err;
    }
  }

  /**
   * Ottieni comando per ID
   * @param {string} id - ID comando
   * @returns {Object|null}
   */
  get(id) {
    return this._commands.get(id) || null;
  }

  /**
   * Cerca comandi per query (fuzzy search)
   * @param {string} query - Stringa di ricerca
   * @returns {Array<Object>} - Comandi matchati
   */
  search(query) {
    if (!query || query.trim() === '') {
      return this.getAll();
    }

    const queryLower = query.toLowerCase();
    const results = [];

    for (const [, command] of this._commands.entries()) {
      const score = this._fuzzyMatch(queryLower, command.label.toLowerCase()) +
                    this._fuzzyMatch(queryLower, command.id.toLowerCase()) * 0.5;
      
      if (score > 0) {
        results.push({ ...command, score });
      }
    }

    // Sort by score (descending)
    return results.sort((a, b) => b.score - a.score);
  }

  /**
   * Ottieni tutti i comandi
   * @param {Object} [options] - Opzioni
   * @param {boolean} [options.enabledOnly=false] - Solo abilitati
   * @returns {Array<Object>}
   */
  getAll(options = {}) {
    const { enabledOnly = false } = options;
    
    let commands = Array.from(this._commands.values());
    
    if (enabledOnly) {
      commands = commands.filter(cmd => cmd.enabled());
    }
    
    return commands;
  }

  /**
   * Ottieni comandi per categoria
   * @param {string} category - Nome categoria
   * @returns {Array<Object>}
   */
  getByCategory(category) {
    return this.getAll().filter(cmd => cmd.category === category);
  }

  /**
   * Ottieni tutte le categorie
   * @returns {string[]}
   */
  getCategories() {
    return Array.from(this._categories);
  }

  /**
   * Controlla se un comando esiste
   * @param {string} id - ID comando
   * @returns {boolean}
   */
  has(id) {
    return this._commands.has(id);
  }

  /**
   * Controlla se un comando è abilitato
   * @param {string} id - ID comando
   * @returns {boolean}
   */
  isEnabled(id) {
    const command = this._commands.get(id);
    return command ? command.enabled() : false;
  }

  /**
   * Ottieni comandi per keybinding
   * @param {string} keybinding - Keybinding (es: 'Ctrl+S')
   * @returns {Object|null}
   */
  getByKeybinding(keybinding) {
    return this.getAll().find(cmd => cmd.keybinding === keybinding) || null;
  }

  /**
   * Aggiorna conteggio uso comando
   * @param {string} id - ID comando
   */
  incrementUsage(id) {
    const command = this._commands.get(id);
    if (command) {
      command.usageCount++;
    }
  }

  /**
   * Ottieni comandi più usati
   * @param {number} [limit=10] - Numero massimo
   * @returns {Array<Object>}
   */
  getMostUsed(limit = 10) {
    return this.getAll()
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, limit);
  }

  /**
   * Pulisce il registro
   */
  clear() {
    this._commands.clear();
    this._categories.clear();
    console.log('[CommandRegistry] Cleared');
  }

  /**
   * Ottiene statistiche
   * @returns {Object}
   */
  getStats() {
    const commands = this.getAll();
    const totalUsage = commands.reduce((sum, cmd) => sum + cmd.usageCount, 0);
    
    return {
      total: commands.length,
      enabled: commands.filter(cmd => cmd.enabled()).length,
      disabled: commands.filter(cmd => !cmd.enabled()).length,
      totalUsage,
      categories: this._categories.size
    };
  }

  /**
   * Fuzzy match scoring
   * @private
   */
  _fuzzyMatch(query, text) {
    let queryIndex = 0;
    let score = 0;
    let consecutiveBonus = 0;

    for (let i = 0; i < text.length && queryIndex < query.length; i++) {
      if (text[i] === query[queryIndex]) {
        score += 1;
        
        // Bonus per caratteri consecutivi
        if (i > 0 && text[i - 1] === query[queryIndex - 1]) {
          consecutiveBonus += 0.5;
        }
        
        // Bonus per inizio parola
        if (i === 0 || text[i - 1] === ' ' || text[i - 1] === ':') {
          score += 1;
        }
        
        queryIndex++;
      }
    }

    return queryIndex === query.length ? score + consecutiveBonus : 0;
  }
}

// Singleton
const registry = new CommandRegistry();

// Register default commands
function registerDefaultCommands(electronAPI) {
  registry.registerMany([
    {
      id: 'file:save',
      label: 'Save File',
      category: 'File',
      keybinding: 'Ctrl+S',
      icon: '💾',
      execute: () => electronAPI?.saveFile?.()
    },
    {
      id: 'file:save-all',
      label: 'Save All Files',
      category: 'File',
      keybinding: 'Ctrl+Shift+S',
      icon: '💾💾',
      execute: () => electronAPI?.saveAllFiles?.()
    },
    {
      id: 'file:new',
      label: 'New File',
      category: 'File',
      keybinding: 'Ctrl+N',
      icon: '📄',
      execute: () => electronAPI?.newFile?.()
    },
    {
      id: 'file:open',
      label: 'Open File...',
      category: 'File',
      keybinding: 'Ctrl+O',
      icon: '📂',
      execute: () => electronAPI?.openFile?.()
    },
    {
      id: 'file:open-folder',
      label: 'Open Folder...',
      category: 'File',
      keybinding: 'Ctrl+K Ctrl+O',
      icon: '📁',
      execute: () => electronAPI?.openFolder?.()
    },
    {
      id: 'edit:undo',
      label: 'Undo',
      category: 'Edit',
      keybinding: 'Ctrl+Z',
      icon: '↩️',
      execute: () => electronAPI?.undo?.()
    },
    {
      id: 'edit:redo',
      label: 'Redo',
      category: 'Edit',
      keybinding: 'Ctrl+Y',
      icon: '↪️',
      execute: () => electronAPI?.redo?.()
    },
    {
      id: 'edit:find',
      label: 'Find',
      category: 'Edit',
      keybinding: 'Ctrl+F',
      icon: '🔍',
      execute: () => electronAPI?.find?.()
    },
    {
      id: 'edit:replace',
      label: 'Replace',
      category: 'Edit',
      keybinding: 'Ctrl+H',
      icon: '🔄',
      execute: () => electronAPI?.replace?.()
    },
    {
      id: 'view:toggle-sidebar',
      label: 'Toggle Sidebar',
      category: 'View',
      keybinding: 'Ctrl+B',
      icon: '📊',
      execute: () => electronAPI?.toggleSidebar?.()
    },
    {
      id: 'view:toggle-terminal',
      label: 'Toggle Terminal',
      category: 'View',
      keybinding: 'Ctrl+`',
      icon: '💻',
      execute: () => electronAPI?.toggleTerminal?.()
    },
    {
      id: 'view:toggle-split',
      label: 'Toggle Split Editor',
      category: 'View',
      keybinding: 'Ctrl+\\',
      icon: '✂️',
      execute: () => electronAPI?.toggleSplit?.()
    },
    {
      id: 'view:command-palette',
      label: 'Command Palette',
      category: 'View',
      keybinding: 'Ctrl+Shift+P',
      icon: '⌨️',
      execute: () => electronAPI?.showCommandPalette?.()
    },
    {
      id: 'go:file',
      label: 'Go to File...',
      category: 'Go',
      keybinding: 'Ctrl+P',
      icon: '📄',
      execute: () => electronAPI?.quickOpenFile?.()
    },
    {
      id: 'go:line',
      label: 'Go to Line...',
      category: 'Go',
      keybinding: 'Ctrl+G',
      icon: '🔢',
      execute: (line) => electronAPI?.goToLine?.(line)
    },
    {
      id: 'go:symbol',
      label: 'Go to Symbol...',
      category: 'Go',
      keybinding: 'Ctrl+Shift+O',
      icon: '@',
      execute: () => electronAPI?.goToSymbol?.()
    },
    {
      id: 'editor:format',
      label: 'Format Document',
      category: 'Editor',
      keybinding: 'Alt+Shift+F',
      icon: '🎨',
      execute: () => electronAPI?.formatDocument?.()
    },
    {
      id: 'editor:toggle-word-wrap',
      label: 'Toggle Word Wrap',
      category: 'Editor',
      keybinding: 'Alt+Z',
      icon: '↔️',
      execute: () => electronAPI?.toggleWordWrap?.()
    },
    {
      id: 'debug:start',
      label: 'Start Debugging',
      category: 'Debug',
      keybinding: 'F5',
      icon: '🐛',
      execute: () => electronAPI?.startDebug?.()
    },
    {
      id: 'debug:stop',
      label: 'Stop Debugging',
      category: 'Debug',
      keybinding: 'Shift+F5',
      icon: '⏹️',
      execute: () => electronAPI?.stopDebug?.()
    },
    {
      id: 'debug:continue',
      label: 'Continue',
      category: 'Debug',
      keybinding: 'F5',
      icon: '▶️',
      execute: () => electronAPI?.debugContinue?.()
    },
    {
      id: 'debug:step-over',
      label: 'Step Over',
      category: 'Debug',
      keybinding: 'F10',
      icon: '⏭️',
      execute: () => electronAPI?.debugStepOver?.()
    },
    {
      id: 'debug:step-into',
      label: 'Step Into',
      category: 'Debug',
      keybinding: 'F11',
      icon: '⬇️',
      execute: () => electronAPI?.debugStepInto?.()
    },
    {
      id: 'terminal:new',
      label: 'Create New Terminal',
      category: 'Terminal',
      keybinding: 'Ctrl+Shift+`',
      icon: '💻',
      execute: () => electronAPI?.newTerminal?.()
    },
    {
      id: 'terminal:clear',
      label: 'Clear Terminal',
      category: 'Terminal',
      icon: '🧹',
      execute: () => electronAPI?.clearTerminal?.()
    },
    {
      id: 'git:commit',
      label: 'Git Commit',
      category: 'Git',
      icon: '✅',
      execute: () => electronAPI?.gitCommit?.()
    },
    {
      id: 'git:push',
      label: 'Git Push',
      category: 'Git',
      icon: '⬆️',
      execute: () => electronAPI?.gitPush?.()
    },
    {
      id: 'git:pull',
      label: 'Git Pull',
      category: 'Git',
      icon: '⬇️',
      execute: () => electronAPI?.gitPull?.()
    },
    {
      id: 'ai:toggle-companion',
      label: 'Toggle AI Companion',
      category: 'AI',
      icon: '🤖',
      execute: () => electronAPI?.toggleAICompanion?.()
    }
  ]);
}

module.exports = {
  registry,
  registerDefaultCommands
};
