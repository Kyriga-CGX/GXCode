/**
 * CallStackManager - Gestisce lo stack delle chiamate durante il debug
 * 
 * Responsabilità:
 * - Memorizzare il call stack quando il debugger è in pausa
 * - Fornire navigazione nel call stack
 * - Tenere storico dei frame
 */

const path = require('path');

class CallStackManager {
  constructor() {
    this._stack = [];
    this._selectedFrame = 0;
    this._history = [];
    this._maxHistory = 20;
  }

  /**
   * Aggiorna il call stack (chiamato dal debugger quando va in pausa)
   * @param {Array} frames - Array di frame da CDP
   */
  update(frames = []) {
    this._stack = frames.map((frame, index) => ({
      index,
      functionName: frame.functionName || '(anonymous)',
      location: {
        path: this._extractPath(frame.location),
        line: frame.location?.lineNumber + 1 || 0, // Converti da 0-based a 1-based
        column: frame.location?.columnNumber + 1 || 0
      },
      scopeChain: frame.scopeChain || [],
      this: frame.this,
      isTopFrame: index === 0
    }));

    this._selectedFrame = 0; // Reset selection al top

    // Aggiungi allo storico
    this._history.push({
      stack: [...this._stack],
      timestamp: Date.now(),
      topFrame: this._stack[0]?.functionName || 'unknown'
    });

    // Limita storico
    if (this._history.length > this._maxHistory) {
      this._history = this._history.slice(-this._maxHistory);
    }
  }

  /**
   * Estrae il percorso dal location object CDP
   * @private
   */
  _extractPath(location) {
    if (!location) return 'unknown';
    
    // CDP può fornire scriptId o url
    if (location.url) {
      return location.url;
    }
    if (location.scriptId) {
      return `script:${location.scriptId}`;
    }
    return 'unknown';
  }

  /**
   * Ottiene il call stack corrente
   * @returns {Array} - Array di frame
   */
  getStack() {
    return this._stack;
  }

  /**
   * Ottiene il frame selezionato
   * @returns {Object|null} - Frame selezionato
   */
  getSelectedFrame() {
    if (this._stack.length === 0) return null;
    return this._stack[this._selectedFrame];
  }

  /**
   * Seleziona un frame specifico
   * @param {number} index - Indice del frame
   * @returns {boolean} - True se selezionato con successo
   */
  selectFrame(index) {
    if (index < 0 || index >= this._stack.length) {
      return false;
    }
    this._selectedFrame = index;
    return true;
  }

  /**
   * Seleziona il frame precedente
   * @returns {boolean} - True se spostato
   */
  selectPreviousFrame() {
    if (this._selectedFrame > 0) {
      this._selectedFrame--;
      return true;
    }
    return false;
  }

  /**
   * Seleziona il frame successivo
   * @returns {boolean} - True se spostato
   */
  selectNextFrame() {
    if (this._selectedFrame < this._stack.length - 1) {
      this._selectedFrame++;
      return true;
    }
    return false;
  }

  /**
   * Ottiene la posizione corrente (top frame)
   * @returns {Object|null} - Posizione corrente { path, line }
   */
  getCurrentPosition() {
    if (this._stack.length === 0) return null;
    
    const topFrame = this._stack[0];
    return {
      path: topFrame.location.path,
      line: topFrame.location.line
    };
  }

  /**
   * Ottiene lo storico del call stack
   * @param {number} [limit] - Numero massimo di entry
   * @returns {Array} - Storico
   */
  getHistory(limit = 10) {
    return this._history.slice(-limit);
  }

  /**
   * Pulisce il call stack
   */
  clear() {
    this._stack = [];
    this._selectedFrame = 0;
  }

  /**
   * Pulisce lo storico
   */
  clearHistory() {
    this._history = [];
  }

  /**
   * Ottiene statistiche
   * @returns {Object} - Statistiche
   */
  getStats() {
    return {
      totalFrames: this._stack.length,
      selectedFrame: this._selectedFrame,
      historySize: this._history.length,
      topFunction: this._stack[0]?.functionName || 'none'
    };
  }

  /**
   * Formatta il call stack per display
   * @returns {string[]} - Array di stringhe formattate
   */
  formatForDisplay() {
    return this._stack.map((frame, index) => {
      const prefix = index === this._selectedFrame ? '→ ' : '  ';
      const funcName = frame.functionName;
      const location = frame.location.path !== 'unknown'
        ? `${path.basename(frame.location.path)}:${frame.location.line}`
        : '';
      
      return `${prefix}${funcName} ${location}`;
    });
  }
}

// Modulo export
module.exports = {
  name: 'CallStackManager',
  version: '1.0.0',
  
  _instance: null,
  
  init(context) {
    this._instance = new CallStackManager();
    return this._instance;
  },
  
  shutdown() {
    this._instance = null;
  },
  
  getInstance() {
    return this._instance;
  }
};
