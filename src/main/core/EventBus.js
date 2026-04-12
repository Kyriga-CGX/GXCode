/**
 * EventBus - Sistema di comunicazione centralizzato per GXCode
 * 
 * Permette ai moduli di comunicare senza dipendenze dirette.
 * Pattern pub/sub con supporto per wildcard e una volta.
 * 
 * @example
 * const bus = require('../core/EventBus');
 * 
 * // Subscribe
 * bus.on('file:saved', (data) => console.log('File saved:', data.path));
 * 
 * // Subscribe once
 * bus.once('app:ready', () => console.log('App started'));
 * 
 * // Subscribe with wildcard
 * bus.on('debug:*', (event, data) => console.log('Debug event:', event));
 * 
 * // Emit
 * bus.emit('file:saved', { path: '/path/to/file.js' });
 * 
 * // Unsubscribe
 * bus.off('file:saved', handler);
 */

class EventBus {
  constructor() {
    this._listeners = new Map();
    this._onceListeners = new Map();
    this._history = [];
    this._maxHistory = 100;
  }

  /**
   * Registra un listener per un evento
   * @param {string} event - Nome evento (supporta wildcard: 'debug:*')
   * @param {Function} callback - Funzione da chiamare
   * @returns {Function} - Funzione di cleanup per unsubscribe
   */
  on(event, callback) {
    if (typeof event !== 'string' || !event) {
      throw new Error('[EventBus] Event name must be a non-empty string');
    }
    if (typeof callback !== 'function') {
      throw new Error('[EventBus] Callback must be a function');
    }

    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event).add(callback);

    // Return cleanup function
    return () => this.off(event, callback);
  }

  /**
   * Registra un listener che viene eseguito una sola volta
   * @param {string} event - Nome evento
   * @param {Function} callback - Funzione da chiamare
   * @returns {Function} - Funzione di cleanup
   */
  once(event, callback) {
    const onceWrapper = (...args) => {
      this.off(event, onceWrapper);
      callback.apply(this, args);
    };
    onceWrapper._original = callback;
    return this.on(event, onceWrapper);
  }

  /**
   * Rimuove un listener
   * @param {string} event - Nome evento
   * @param {Function} callback - Funzione da rimuovere
   */
  off(event, callback) {
    if (this._listeners.has(event)) {
      const listeners = this._listeners.get(event);
      
      // Support removal of once listeners
      const toRemove = callback._original 
        ? Array.from(listeners).find(l => l._original === callback)
        : callback;
      
      listeners.delete(toRemove || callback);
      
      if (listeners.size === 0) {
        this._listeners.delete(event);
      }
    }
  }

  /**
   * Emette un evento a tutti i listener
   * @param {string} event - Nome evento
   * @param {*} data - Dati da passare ai listener
   * @returns {number} - Numero di listener chiamati
   */
  emit(event, data = undefined) {
    if (typeof event !== 'string' || !event) {
      throw new Error('[EventBus] Event name must be a non-empty string');
    }

    let calledCount = 0;

    // Store in history
    this._history.push({ event, data, timestamp: Date.now() });
    if (this._history.length > this._maxHistory) {
      this._history.shift();
    }

    // Exact match listeners
    if (this._listeners.has(event)) {
      const listeners = Array.from(this._listeners.get(event));
      for (const listener of listeners) {
        try {
          listener(data, event);
          calledCount++;
        } catch (err) {
          console.error(`[EventBus] Error in listener for "${event}":`, err.message);
        }
      }
    }

    // Wildcard listeners (e.g., 'debug:*' matches 'debug:session:start')
    for (const [pattern, listeners] of this._listeners.entries()) {
      if (pattern.includes('*') && this._matchWildcard(pattern, event)) {
        for (const listener of listeners) {
          try {
            listener(data, event);
            calledCount++;
          } catch (err) {
            console.error(`[EventBus] Error in wildcard listener for "${pattern}":`, err.message);
          }
        }
      }
    }

    return calledCount;
  }

  /**
   * Controlla se un evento matcha un pattern wildcard
   * @private
   */
  _matchWildcard(pattern, event) {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return regex.test(event);
  }

  /**
   * Rimuove tutti i listener per un evento o tutti
   * @param {string} [event] - Nome evento (opzionale, se omesso rimuove tutti)
   */
  clear(event = null) {
    if (event) {
      this._listeners.delete(event);
    } else {
      this._listeners.clear();
    }
  }

  /**
   * Ottiene la history degli eventi
   * @param {number} [limit] - Numero massimo di eventi da restituire
   * @returns {Array} - Array di { event, data, timestamp }
   */
  getHistory(limit = 50) {
    return this._history.slice(-limit);
  }

  /**
   * Ottiene numero listener per un evento
   * @param {string} event - Nome evento
   * @returns {number} - Numero di listener
   */
  listenerCount(event) {
    return this._listeners.has(event) ? this._listeners.get(event).size : 0;
  }

  /**
   * Ottiene tutti gli eventi con listener
   * @returns {string[]} - Array di nomi eventi
   */
  events() {
    return Array.from(this._listeners.keys());
  }
}

// Singleton instance
const eventBus = new EventBus();

module.exports = eventBus;
