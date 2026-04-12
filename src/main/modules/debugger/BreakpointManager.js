/**
 * BreakpointManager - Gestisce i breakpoint per il debugger
 * 
 * Responsabilità:
 * - Aggiungere/rimuovere breakpoint
 * - Supportare tipi diversi (standard, conditional, logpoint)
 * - Convertire breakpoint per protocollo CDP
 * - Validare breakpoint
 */

const path = require('path');

class BreakpointManager {
  constructor() {
    this._breakpoints = new Map(); // Map<id, Breakpoint>
    this._nextId = 1;
  }

  /**
   * Aggiunge un breakpoint
   * @param {Object} bp - Configurazione breakpoint
   * @param {string} bp.path - Percorso file
   * @param {number} bp.line - Linea (1-based)
   * @param {string} [bp.type='standard'] - Tipo: 'standard', 'conditional', 'logpoint'
   * @param {string} [bp.condition] - Condizione (per conditional breakpoint)
   * @param {string} [bp.logMessage] - Messaggio log (per logpoint)
   * @param {boolean} [bp.enabled=true] - Se abilitato
   * @returns {Object} - Breakpoint creato con ID
   */
  add({ path: filePath, line, type = 'standard', condition, logMessage, enabled = true }) {
    if (!filePath || typeof line !== 'number' || line < 1) {
      throw new Error('[BreakpointManager] Invalid breakpoint: path and line required');
    }

    const id = this._nextId++;
    const breakpoint = {
      id,
      path: path.resolve(filePath),
      line,
      type,
      condition: condition || null,
      logMessage: logMessage || null,
      enabled,
      cdpId: null, // Will be set when applied to debugger
      createdAt: Date.now()
    };

    const key = this._getKey(breakpoint.path, breakpoint.line);
    this._breakpoints.set(key, breakpoint);

    console.log(`[BreakpointManager] Added ${type} breakpoint at ${path.basename(filePath)}:${line} (ID: ${id})`);
    
    return breakpoint;
  }

  /**
   * Rimuove un breakpoint per ID
   * @param {number} id - ID breakpoint
   * @returns {boolean} - True se rimosso
   */
  removeById(id) {
    for (const [key, bp] of this._breakpoints.entries()) {
      if (bp.id === id) {
        this._breakpoints.delete(key);
        console.log(`[BreakpointManager] Removed breakpoint ID: ${id}`);
        return true;
      }
    }
    return false;
  }

  /**
   * Rimuove un breakpoint per path e linea
   * @param {string} filePath - Percorso file
   * @param {number} line - Linea
   * @returns {boolean} - True se rimosso
   */
  remove(filePath, line) {
    const key = this._getKey(filePath, line);
    const bp = this._breakpoints.get(key);
    if (bp) {
      this._breakpoints.delete(key);
      console.log(`[BreakpointManager] Removed breakpoint at ${path.basename(filePath)}:${line}`);
      return true;
    }
    return false;
  }

  /**
   * Toggle breakpoint (aggiunge se non esiste, rimuove se esiste)
   * @param {string} filePath - Percorso file
   * @param {number} line - Linea
   * @param {Object} [options] - Opzioni
   * @returns {Object|null} - Breakpoint aggiunto o null se rimosso
   */
  toggle(filePath, line, options = {}) {
    const key = this._getKey(filePath, line);
    if (this._breakpoints.has(key)) {
      this.remove(filePath, line);
      return null;
    } else {
      return this.add({ path: filePath, line, ...options });
    }
  }

  /**
   * Ottiene tutti i breakpoint per un file
   * @param {string} filePath - Percorso file
   * @returns {Array} - Array di breakpoint
   */
  getByFile(filePath) {
    const resolvedPath = path.resolve(filePath);
    return Array.from(this._breakpoints.values())
      .filter(bp => bp.path === resolvedPath && bp.enabled);
  }

  /**
   * Ottiene tutti i breakpoint
   * @returns {Array} - Tutti i breakpoint
   */
  getAll() {
    return Array.from(this._breakpoints.values());
  }

  /**
   * Ottiene breakpoint per ID
   * @param {number} id - ID breakpoint
   * @returns {Object|null} - Breakpoint o null
   */
  getById(id) {
    return Array.from(this._breakpoints.values()).find(bp => bp.id === id) || null;
  }

  /**
   * Abilita/disabilita un breakpoint
   * @param {number} id - ID breakpoint
   * @param {boolean} enabled - Stato
   * @returns {boolean} - True se aggiornato
   */
  setEnabled(id, enabled) {
    const bp = this.getById(id);
    if (bp) {
      bp.enabled = enabled;
      return true;
    }
    return false;
  }

  /**
   * Converte breakpoint per protocollo Chrome DevTools
   * @param {string} filePath - Filtro per file
   * @returns {Array} - Array di parametri CDP
   */
  toCDPParams(filePath = null) {
    let breakpoints = this.getAll().filter(bp => bp.enabled);
    
    if (filePath) {
      const resolvedPath = path.resolve(filePath);
      breakpoints = breakpoints.filter(bp => bp.path === resolvedPath);
    }

    return breakpoints.map(bp => ({
      id: bp.id,
      location: {
        lineNumber: bp.line - 1, // CDP usa 0-based
        urlRegex: '.*' + path.basename(bp.path).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      },
      condition: bp.condition || ''
    }));
  }

  /**
   * Aggiorna CDP ID per un breakpoint
   * @param {number} breakpointId - ID breakpoint interno
   * @param {string} cdpId - ID breakpoint da CDP
   */
  setCdpId(breakpointId, cdpId) {
    const bp = this.getById(breakpointId);
    if (bp) {
      bp.cdpId = cdpId;
    }
  }

  /**
   * Controlla se esiste un breakpoint in una posizione
   * @param {string} filePath - Percorso file
   * @param {number} line - Linea
   * @returns {boolean} - True se esiste
   */
  has(filePath, line) {
    const key = this._getKey(filePath, line);
    return this._breakpoints.has(key);
  }

  /**
   * Rimuove tutti i breakpoint
   */
  clear() {
    this._breakpoints.clear();
    console.log('[BreakpointManager] Cleared all breakpoints');
  }

  /**
   * Ottiene statistiche sui breakpoint
   * @returns {Object} - Statistiche
   */
  getStats() {
    const all = this.getAll();
    return {
      total: all.length,
      enabled: all.filter(bp => bp.enabled).length,
      disabled: all.filter(bp => !bp.enabled).length,
      byType: {
        standard: all.filter(bp => bp.type === 'standard').length,
        conditional: all.filter(bp => bp.type === 'conditional').length,
        logpoint: all.filter(bp => bp.type === 'logpoint').length
      }
    };
  }

  /**
   * Genera chiave unica per breakpoint
   * @private
   */
  _getKey(filePath, line) {
    return `${path.resolve(filePath)}:${line}`;
  }
}

// Modulo export
module.exports = {
  name: 'BreakpointManager',
  version: '1.0.0',
  
  _instance: null,
  
  init(context) {
    this._instance = new BreakpointManager();
    return this._instance;
  },
  
  shutdown() {
    this._instance = null;
  },
  
  getInstance() {
    return this._instance;
  }
};
