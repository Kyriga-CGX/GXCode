/**
 * VariableInspector - Ispeziona e gestisce le variabili durante il debug
 * 
 * Responsabilità:
 * - Estrarre variabili dagli scope CDP
 * - Formattare valori per display
 * - Supportare espansione oggetti complessi
 * - Tenere traccia delle variabili modificate
 */

class VariableInspector {
  constructor() {
    this._variables = new Map();
    this._expandedObjects = new Map();
    this._maxDepth = 3;
    this._maxProperties = 50;
  }

  /**
   * Processa le variabili da un messaggio CDP
   * @param {Object} scopeObject - Scope object da CDP
   * @param {Function} getPropertiesFn - Funzione async per ottenere proprietà
   * @returns {Promise<Array>} - Array di variabili processate
   */
  async extractVariables(scopeObject, getPropertiesFn) {
    if (!scopeObject || !scopeObject.objectId) {
      return [];
    }

    try {
      const response = await getPropertiesFn(scopeObject.objectId);
      const properties = response?.result || [];
      
      const variables = properties
        .filter(p => p.name) // Solo proprietà con nome
        .slice(0, this._maxProperties)
        .map(p => this._formatProperty(p));

      // Aggiorna cache
      for (const variable of variables) {
        this._variables.set(variable.name, variable);
      }

      return variables;
    } catch (err) {
      console.error('[VariableInspector] Error extracting variables:', err.message);
      return [];
    }
  }

  /**
   * Formatta una proprietà CDP
   * @private
   */
  _formatProperty(prop) {
    const value = prop.value || {};
    const type = value.type || 'unknown';
    
    return {
      name: prop.name,
      type: this._normalizeType(type),
      value: this._formatValue(value),
      display: this._formatDisplayValue(value),
      expandable: this._isExpandable(value),
      objectId: value.objectId || null,
      description: value.description || null
    };
  }

  /**
   * Normalizza il tipo
   * @private
   */
  _normalizeType(type) {
    const typeMap = {
      'object': 'object',
      'function': 'function',
      'undefined': 'undefined',
      'string': 'string',
      'number': 'number',
      'boolean': 'boolean',
      'symbol': 'symbol',
      'bigint': 'bigint',
      'undefined': 'undefined',
      'null': 'null'
    };
    return typeMap[type] || 'unknown';
  }

  /**
   * Formatta il valore per uso programmatico
   * @private
   */
  _formatValue(value) {
    if (value.unserializableValue) {
      return this._parseUnserializable(value.unserializableValue);
    }
    
    switch (value.type) {
      case 'string':
        return value.value;
      case 'number':
      case 'boolean':
        return value.value;
      case 'undefined':
        return undefined;
      case 'null':
        return null;
      case 'object':
      case 'function':
        return value.objectId || value.description || '[Object]';
      default:
        return value.description || value.value;
    }
  }

  /**
   * Formatta il valore per display
   * @private
   */
  _formatDisplayValue(value) {
    if (value.unserializableValue) {
      return value.unserializableValue;
    }

    switch (value.type) {
      case 'string':
        return `"${value.value}"`;
      case 'number':
      case 'boolean':
        return String(value.value);
      case 'undefined':
        return 'undefined';
      case 'null':
        return 'null';
      case 'object':
        return value.description || '[Object]';
      case 'function':
        return value.description || '[Function]';
      default:
        return value.description || String(value.value);
    }
  }

  /**
   * Controlla se un valore è espandibile
   * @private
   */
  _isExpandable(value) {
    return (value.type === 'object' || value.type === 'function') && value.objectId;
  }

  /**
   * Parsa valori unserializzabili
   * @private
   */
  _parseUnserializable(value) {
    if (value === 'NaN') return NaN;
    if (value === 'Infinity') return Infinity;
    if (value === '-Infinity') return -Infinity;
    if (value === '-0') return -0;
    return value;
  }

  /**
   * Espande un oggetto per mostrare le proprietà
   * @param {string} objectId - Object ID da espandere
   * @param {Function} getPropertiesFn - Funzione per ottenere proprietà
   * @returns {Promise<Array>} - Proprietà dell'oggetto
   */
  async expandObject(objectId, getPropertiesFn) {
    if (!objectId || !getPropertiesFn) {
      return [];
    }

    // Check cache
    if (this._expandedObjects.has(objectId)) {
      return this._expandedObjects.get(objectId);
    }

    try {
      const response = await getPropertiesFn(objectId);
      const properties = response?.result || [];
      
      const expanded = properties
        .filter(p => p.name && !p.name.startsWith('__'))
        .slice(0, this._maxProperties)
        .map(p => this._formatProperty(p));

      // Cache
      this._expandedObjects.set(objectId, expanded);

      return expanded;
    } catch (err) {
      console.error('[VariableInspector] Error expanding object:', err.message);
      return [];
    }
  }

  /**
   * Ottiene una variabile per nome
   * @param {string} name - Nome variabile
   * @returns {Object|null} - Variabile o null
   */
  getVariable(name) {
    return this._variables.get(name) || null;
  }

  /**
   * Ottiene tutte le variabili
   * @returns {Array} - Array di variabili
   */
  getAllVariables() {
    return Array.from(this._variables.values());
  }

  /**
   * Controlla se una variabile esiste
   * @param {string} name - Nome variabile
   * @returns {boolean} - True se esiste
   */
  hasVariable(name) {
    return this._variables.has(name);
  }

  /**
   * Pulisce la cache degli oggetti espansi
   */
  clearExpandedCache() {
    this._expandedObjects.clear();
  }

  /**
   * Pulisce tutte le variabili
   */
  clear() {
    this._variables.clear();
    this._expandedObjects.clear();
  }

  /**
   * Ottiene statistiche
   * @returns {Object} - Statistiche
   */
  getStats() {
    const vars = this.getAllVariables();
    const byType = {};
    
    for (const variable of vars) {
      byType[variable.type] = (byType[variable.type] || 0) + 1;
    }

    return {
      total: vars.length,
      byType,
      expandedObjects: this._expandedObjects.size
    };
  }

  /**
   * Formatta le variabili per display
   * @returns {string[]} - Array di stringhe formattate
   */
  formatForDisplay() {
    return this.getAllVariables().map(v => {
      const icon = this._getTypeIcon(v.type);
      return `${icon} ${v.name}: ${v.display}`;
    });
  }

  /**
   * Ottiene icona per tipo
   * @private
   */
  _getTypeIcon(type) {
    const icons = {
      'string': '🔤',
      'number': '🔢',
      'boolean': '✅',
      'object': '📦',
      'function': '⚙️',
      'undefined': '❓',
      'null': '⭕',
      'array': '📋'
    };
    return icons[type] || '•';
  }
}

// Modulo export
module.exports = {
  name: 'VariableInspector',
  version: '1.0.0',
  
  _instance: null,
  
  init(context) {
    this._instance = new VariableInspector();
    return this._instance;
  },
  
  shutdown() {
    this._instance = null;
  },
  
  getInstance() {
    return this._instance;
  }
};
