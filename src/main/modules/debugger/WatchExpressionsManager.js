/**
 * WatchExpressionsManager - Gestisce le espressioni watch durante il debug
 * 
 * Responsabilità:
 * - Aggiungere/rimuovere espressioni watch
 * - Valutare espressioni nel contesto debug
 * - Tenere storico dei valori
 */

class WatchExpressionsManager {
  constructor() {
    this._expressions = new Map(); // Map<id, WatchExpression>
    this._nextId = 1;
    this._maxHistory = 50;
  }

  /**
   * Aggiunge un'espressione watch
   * @param {string} expression - Espressione da valutare
   * @returns {Object} - Watch expression creata
   */
  add(expression) {
    if (!expression || typeof expression !== 'string') {
      throw new Error('[WatchExpressions] Expression must be a string');
    }

    // Check if already exists
    for (const [, watch] of this._expressions.entries()) {
      if (watch.expression === expression) {
        return watch;
      }
    }

    const id = this._nextId++;
    const watch = {
      id,
      expression: expression.trim(),
      value: null,
      error: null,
      history: [],
      createdAt: Date.now(),
      lastEvaluated: null
    };

    this._expressions.set(id, watch);
    console.log(`[WatchExpressions] Added watch: ${expression} (ID: ${id})`);
    
    return watch;
  }

  /**
   * Rimuove una watch expression
   * @param {number} id - ID watch expression
   * @returns {boolean} - True se rimossa
   */
  remove(id) {
    const result = this._expressions.delete(id);
    if (result) {
      console.log(`[WatchExpressions] Removed watch ID: ${id}`);
    }
    return result;
  }

  /**
   * Aggiorna il valore di una watch expression
   * @param {number} id - ID watch expression
   * @param {*} value - Nuovo valore
   * @param {Error} [error] - Eventuale errore
   */
  updateValue(id, value, error = null) {
    const watch = this._expressions.get(id);
    if (!watch) {
      return false;
    }

    watch.value = value;
    watch.error = error;
    watch.lastEvaluated = Date.now();

    // Add to history
    watch.history.push({
      value,
      error: error ? error.message : null,
      timestamp: Date.now()
    });

    // Limit history
    if (watch.history.length > this._maxHistory) {
      watch.history = watch.history.slice(-this._maxHistory);
    }

    return true;
  }

  /**
   * Ottiene una watch expression per ID
   * @param {number} id - ID watch expression
   * @returns {Object|null} - Watch expression o null
   */
  getById(id) {
    return this._expressions.get(id) || null;
  }

  /**
   * Ottiene tutte le watch expressions
   * @returns {Array} - Array di watch expressions
   */
  getAll() {
    return Array.from(this._expressions.values());
  }

  /**
   * Ottiene tutte le espressioni (solo testo)
   * @returns {string[]} - Array di espressioni
   */
  getExpressions() {
    return this.getAll().map(w => w.expression);
  }

  /**
   * Valuta tutte le watch expressions
   * Questo metodo viene chiamato dal debugger quando è in pausa
   * @param {Function} evalFn - Funzione async per valutare espressioni
   * @returns {Promise<Array>} - Risultati valutazione
   */
  async evaluateAll(evalFn) {
    const results = [];

    for (const watch of this._expressions.values()) {
      try {
        const value = await evalFn(watch.expression);
        this.updateValue(watch.id, value);
        results.push({
          id: watch.id,
          expression: watch.expression,
          value,
          error: null
        });
      } catch (err) {
        this.updateValue(watch.id, null, err);
        results.push({
          id: watch.id,
          expression: watch.expression,
          value: null,
          error: err.message
        });
      }
    }

    return results;
  }

  /**
   * Ottiene storico di una watch expression
   * @param {number} id - ID watch expression
   * @returns {Array} - Storico valori
   */
  getHistory(id) {
    const watch = this._expressions.get(id);
    return watch ? watch.history : [];
  }

  /**
   * Pulisce lo storico di tutte le watch expressions
   */
  clearHistory() {
    for (const watch of this._expressions.values()) {
      watch.history = [];
    }
  }

  /**
   * Rimuove tutte le watch expressions
   */
  clear() {
    this._expressions.clear();
    console.log('[WatchExpressions] Cleared all watch expressions');
  }

  /**
   * Ottiene statistiche
   * @returns {Object} - Statistiche
   */
  getStats() {
    const all = this.getAll();
    const withErrors = all.filter(w => w.error).length;
    
    return {
      total: all.length,
      withErrors,
      withoutErrors: all.length - withErrors,
      totalEvaluations: all.reduce((sum, w) => sum + w.history.length, 0)
    };
  }
}

// Modulo export
module.exports = {
  name: 'WatchExpressionsManager',
  version: '1.0.0',
  
  _instance: null,
  
  init(context) {
    this._instance = new WatchExpressionsManager();
    return this._instance;
  },
  
  shutdown() {
    this._instance = null;
  },
  
  getInstance() {
    return this._instance;
  }
};
