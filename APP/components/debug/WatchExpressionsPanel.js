/**
 * WatchExpressionsPanel - UI per gestire le watch expressions
 * 
 * Mostra espressioni watch con:
 * - Aggiungi/rimuovi espressioni
 * - Valutazione automatica quando debug è in pausa
 * - Storico valori
 * - Espansione oggetti
 */

export class WatchExpressionsPanel {
  constructor() {
    this._watches = [];
    _container = null;
    this._isDebugMode = false;
    
    this._init();
  }

  /**
   * Inizializza il pannello
   * @private
   */
  _init() {
    this._container = document.createElement('div');
    this._container.className = 'watch-expressions-panel';
    this._container.setAttribute('data-testid', 'watch-expressions-panel');
    
    this._container.innerHTML = `
      <div class="watch-header">
        <span class="watch-header-title">WATCH</span>
        <button class="watch-add-btn" aria-label="Add Expression" title="Add Expression">
          +
        </button>
      </div>
      <div class="watch-content">
        <div class="watch-input-wrapper">
          <input 
            type="text" 
            class="watch-input" 
            placeholder="Add expression..."
            spellcheck="false"
          />
        </div>
        <div class="watch-list">
          <div class="watch-empty">
            <span class="empty-icon">👁️</span>
            <p>Watch expressions are evaluated when paused</p>
          </div>
        </div>
      </div>
    `;
    
    // Event listeners
    const addBtn = this._container.querySelector('.watch-add-btn');
    const input = this._container.querySelector('.watch-input');
    
    addBtn.addEventListener('click', () => this._addWatch());
    
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && input.value.trim()) {
        this._addWatch(input.value.trim());
        input.value = '';
      }
    });
    
    // Listen for debug events
    if (window.electronAPI) {
      window.electronAPI.onDebugVariables?.((variables) => {
        this._updateWatches();
      });
    }
    
    console.log('[WatchExpressionsPanel] Initialized');
  }

  /**
   * Ottiene il container
   */
  getElement() {
    return this._container;
  }

  /**
   * Aggiunge una watch expression
   * @private
   */
  _addWatch(expression = null) {
    const input = this._container.querySelector('.watch-input');
    const expr = expression || input.value.trim();
    
    if (!expr) return;
    
    // Check duplicate
    if (this._watches.some(w => w.expression === expr)) {
      return;
    }
    
    const watch = {
      id: Date.now(),
      expression: expr,
      value: null,
      error: null,
      evaluating: false
    };
    
    this._watches.push(watch);
    this._renderWatches();
    
    if (!expression) {
      input.value = '';
    }
    
    console.log('[WatchExpressionsPanel] Added watch:', expr);
  }

  /**
   * Rimuove una watch expression
   * @param {number} id - Watch ID
   */
  removeWatch(id) {
    this._watches = this._watches.filter(w => w.id !== id);
    this._renderWatches();
    console.log('[WatchExpressionsPanel] Removed watch:', id);
  }

  /**
   * Aggiorna tutte le watches
   * @private
   */
  _updateWatches() {
    if (!this._isDebugMode) return;
    
    this._watches.forEach(watch => {
      watch.evaluating = true;
    });
    
    this._renderWatches();
    
    // Request evaluation from main process
    if (window.electronAPI?.evaluateWatch) {
      this._watches.forEach(async (watch) => {
        try {
          const result = await window.electronAPI.evaluateWatch(watch.expression);
          watch.value = result.value;
          watch.error = result.error;
          watch.evaluating = false;
          this._renderWatches();
        } catch (err) {
          watch.error = err.message;
          watch.evaluating = false;
          this._renderWatches();
        }
      });
    }
  }

  /**
   * Renderizza la lista watches
   * @private
   */
  _renderWatches() {
    const list = this._container.querySelector('.watch-list');
    
    if (this._watches.length === 0) {
      list.innerHTML = `
        <div class="watch-empty">
          <span class="empty-icon">👁️</span>
          <p>Watch expressions are evaluated when paused</p>
        </div>
      `;
      return;
    }
    
    list.innerHTML = '';
    
    this._watches.forEach(watch => {
      const item = document.createElement('div');
      item.className = 'watch-item';
      item.innerHTML = `
        <div class="watch-item-header">
          <span class="watch-item-expression">${this._escapeHtml(watch.expression)}</span>
          <button class="watch-remove-btn" title="Remove" data-id="${watch.id}">×</button>
        </div>
        <div class="watch-item-value ${watch.error ? 'error' : ''}">
          ${watch.evaluating ? '<span class="watch-loading">⏳ Evaluating...</span>' : 
            watch.error ? `<span class="watch-error">${this._escapeHtml(watch.error)}</span>` :
            watch.value !== null ? `<span class="watch-value">${this._formatValue(watch.value)}</span>` :
            '<span class="watch-not-evaluated">Not evaluated</span>'}
        </div>
      `;
      
      // Remove button
      item.querySelector('.watch-remove-btn').addEventListener('click', () => {
        this.removeWatch(watch.id);
      });
      
      list.appendChild(item);
    });
  }

  /**
   * Formatta valore per display
   * @private
   */
  _formatValue(value) {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    
    const type = typeof value;
    
    if (type === 'string') {
      return `"${this._escapeHtml(value)}"`;
    }
    
    if (type === 'object') {
      try {
        return this._escapeHtml(JSON.stringify(value, null, 2));
      } catch {
        return this._escapeHtml(String(value));
      }
    }
    
    return this._escapeHtml(String(value));
  }

  /**
   * Escape HTML
   * @private
   */
  _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Imposta stato debug
   * @param {boolean} isPaused
   */
  setDebugPaused(isPaused) {
    this._isDebugMode = isPaused;
    
    if (isPaused) {
      this._updateWatches();
    }
  }

  /**
   * Ottiene tutte le watches
   * @returns {Array}
   */
  getWatches() {
    return this._watches;
  }

  /**
   * Pulisce tutte le watches
   */
  clear() {
    this._watches = [];
    this._renderWatches();
  }
}

// Stili CSS
const styles = `
.watch-expressions-panel {
  background: var(--bg-primary, #1e1e1e);
  border-top: 1px solid var(--border-color, #454545);
  min-height: 150px;
  max-height: 300px;
  display: flex;
  flex-direction: column;
}

.watch-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-color, #454545);
  background: var(--bg-secondary, #2d2d2d);
}

.watch-header-title {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary, #858585);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.watch-add-btn {
  background: transparent;
  border: none;
  color: var(--text-primary, #cccccc);
  font-size: 18px;
  font-weight: 300;
  cursor: pointer;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.15s;
}

.watch-add-btn:hover {
  background: var(--bg-hover, #2a2d2e);
}

.watch-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.watch-input-wrapper {
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-color, #454545);
}

.watch-input {
  width: 100%;
  background: var(--bg-secondary, #2d2d2d);
  border: 1px solid var(--border-color, #454545);
  border-radius: 4px;
  padding: 6px 10px;
  color: var(--text-primary, #cccccc);
  font-size: 12px;
  font-family: 'Consolas', 'Monaco', monospace;
  outline: none;
  transition: border-color 0.15s;
}

.watch-input:focus {
  border-color: var(--accent-color, #007acc);
}

.watch-input::placeholder {
  color: var(--text-secondary, #858585);
}

.watch-list {
  flex: 1;
  overflow-y: auto;
}

.watch-item {
  padding: 8px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  transition: background 0.15s;
}

.watch-item:hover {
  background: var(--bg-hover, #2a2d2e);
}

.watch-item-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}

.watch-item-expression {
  font-size: 12px;
  color: var(--text-primary, #cccccc);
  font-family: 'Consolas', 'Monaco', monospace;
  font-weight: 500;
}

.watch-remove-btn {
  background: transparent;
  border: none;
  color: var(--text-secondary, #858585);
  font-size: 18px;
  cursor: pointer;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 3px;
  opacity: 0;
  transition: all 0.15s;
}

.watch-item:hover .watch-remove-btn {
  opacity: 1;
}

.watch-remove-btn:hover {
  background: rgba(255, 0, 0, 0.2);
  color: #ff6b6b;
}

.watch-item-value {
  font-size: 11px;
  color: var(--text-secondary, #858585);
  font-family: 'Consolas', 'Monaco', monospace;
  padding-left: 12px;
}

.watch-item-value.error .watch-error {
  color: #f48771;
}

.watch-item-value .watch-value {
  color: #b5cea8;
}

.watch-item-value .watch-not-evaluated {
  color: var(--text-secondary, #858585);
  font-style: italic;
}

.watch-loading {
  color: var(--accent-color, #007acc);
}

.watch-empty {
  padding: 24px 12px;
  text-align: center;
  color: var(--text-secondary, #858585);
}

.empty-icon {
  font-size: 32px;
  display: block;
  margin-bottom: 8px;
  opacity: 0.5;
}

.watch-empty p {
  margin: 0;
  font-size: 11px;
  line-height: 1.4;
}
`;

// Inject styles
if (!document.getElementById('watch-expressions-styles')) {
  const styleEl = document.createElement('style');
  styleEl.id = 'watch-expressions-styles';
  styleEl.textContent = styles;
  document.head.appendChild(styleEl);
}
