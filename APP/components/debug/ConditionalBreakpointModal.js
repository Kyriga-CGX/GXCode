/**
 * ConditionalBreakpointModal - UI per creare breakpoint condizionali
 * 
 * Permette di configurare:
 * - Condizione (es: x > 5)
 * - Hit count (es: break ogni 3 volte)
 * - Log message (es: "Variable x = {x}")
 */

export class ConditionalBreakpointModal {
  constructor(options = {}) {
    this._isVisible = false;
    this._mode = 'condition'; // 'condition', 'logpoint', 'hitCount'
    this._callback = options.callback || null;
    this._container = null;
    
    this._init();
  }

  /**
   * Inizializza il modal
   * @private
   */
  _init() {
    this._container = document.createElement('div');
    this._container.className = 'conditional-breakpoint-modal';
    this._container.style.display = 'none';
    
    this._container.innerHTML = `
      <div class="modal-backdrop"></div>
      <div class="modal-content">
        <div class="modal-header">
          <h3>Configure Breakpoint</h3>
          <button class="modal-close" aria-label="Close">&times;</button>
        </div>
        
        <div class="modal-tabs">
          <button class="modal-tab active" data-mode="condition">
            <span class="tab-icon">🔴</span>
            Condition
          </button>
          <button class="modal-tab" data-mode="logpoint">
            <span class="tab-icon">📝</span>
            Log Message
          </button>
          <button class="modal-tab" data-mode="hitCount">
            <span class="tab-icon">🔢</span>
            Hit Count
          </button>
        </div>
        
        <div class="modal-body">
          <!-- Condition -->
          <div class="modal-section" data-section="condition">
            <label class="section-label">
              Break when expression is true:
            </label>
            <input 
              type="text" 
              class="section-input condition-input"
              placeholder="e.g., x > 5, name === 'test'"
              spellcheck="false"
            />
            <p class="section-help">
              Expression evaluated in the current scope. Break if truthy.
            </p>
          </div>
          
          <!-- Logpoint -->
          <div class="modal-section" data-section="logpoint" style="display: none;">
            <label class="section-label">
              Log message:
            </label>
            <input 
              type="text" 
              class="section-input logpoint-input"
              placeholder='e.g., Variable x = {x}, Function called'
              spellcheck="false"
            />
            <p class="section-help">
              Message to log. Use {expression} for inline evaluation.
            </p>
          </div>
          
          <!-- Hit Count -->
          <div class="modal-section" data-section="hitCount" style="display: none;">
            <label class="section-label">
              Break when hit count condition is met:
            </label>
            <input 
              type="text" 
              class="section-input hitcount-input"
              placeholder="e.g., 5, % 3 == 0, > 10"
              spellcheck="false"
            />
            <p class="section-help">
              Use a number, modulo, or comparison.
            </p>
          </div>
        </div>
        
        <div class="modal-footer">
          <button class="modal-btn modal-btn-secondary modal-cancel">
            Cancel
          </button>
          <button class="modal-btn modal-btn-primary modal-save">
            Save
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(this._container);
    
    // Event listeners
    this._container.querySelector('.modal-close').addEventListener('click', () => this.hide());
    this._container.querySelector('.modal-backdrop').addEventListener('click', () => this.hide());
    this._container.querySelector('.modal-cancel').addEventListener('click', () => this.hide());
    this._container.querySelector('.modal-save').addEventListener('click', () => this._save());
    
    // Tabs
    this._container.querySelectorAll('.modal-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        this._setMode(tab.dataset.mode);
      });
    });
    
    // Keyboard
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this._isVisible) {
        this.hide();
      }
      
      if (e.key === 'Enter' && this._isVisible) {
        this._save();
      }
    });
    
    console.log('[ConditionalBreakpointModal] Initialized');
  }

  /**
   * Mostra il modal
   * @param {Object} [initialData] - Dati iniziali
   */
  show(initialData = {}) {
    this._isVisible = true;
    this._container.style.display = 'flex';
    
    // Set initial values
    if (initialData.condition) {
      this._container.querySelector('.condition-input').value = initialData.condition;
      this._setMode('condition');
    } else if (initialData.logMessage) {
      this._container.querySelector('.logpoint-input').value = initialData.logMessage;
      this._setMode('logpoint');
    } else if (initialData.hitCount) {
      this._container.querySelector('.hitcount-input').value = initialData.hitCount;
      this._setMode('hitCount');
    } else {
      this._setMode('condition');
    }
    
    // Focus input
    setTimeout(() => {
      const activeSection = this._container.querySelector('.modal-section:not([style*="display: none"]) input');
      if (activeSection) activeSection.focus();
    }, 100);
  }

  /**
   * Nasconde il modal
   */
  hide() {
    this._isVisible = false;
    this._container.style.display = 'none';
    this._clearInputs();
  }

  /**
   * Imposta la modalità
   * @private
   */
  _setMode(mode) {
    this._mode = mode;
    
    // Update tabs
    this._container.querySelectorAll('.modal-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.mode === mode);
    });
    
    // Update sections
    this._container.querySelectorAll('.modal-section').forEach(section => {
      const isVisible = section.dataset.section === mode;
      section.style.display = isVisible ? 'block' : 'none';
    });
  }

  /**
   * Salva configurazione
   * @private
   */
  _save() {
    const config = {
      type: this._mode,
      condition: null,
      logMessage: null,
      hitCount: null
    };
    
    switch (this._mode) {
      case 'condition':
        config.condition = this._container.querySelector('.condition-input').value.trim();
        break;
      
      case 'logpoint':
        config.logMessage = this._container.querySelector('.logpoint-input').value.trim();
        break;
      
      case 'hitCount':
        config.hitCount = this._container.querySelector('.hitcount-input').value.trim();
        break;
    }
    
    console.log('[ConditionalBreakpointModal] Saved:', config);
    
    if (this._callback) {
      this._callback(config);
    }
    
    this.hide();
  }

  /**
   * Pulisce input
   * @private
   */
  _clearInputs() {
    this._container.querySelectorAll('.section-input').forEach(input => {
      input.value = '';
    });
  }

  /**
   * Distruggi il modal
   */
  destroy() {
    if (this._container && this._container.parentNode) {
      this._container.parentNode.removeChild(this._container);
    }
  }
}

// Stili CSS
const styles = `
.conditional-breakpoint-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.modal-backdrop {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
}

.modal-content {
  position: relative;
  background: var(--bg-primary, #1e1e1e);
  border: 1px solid var(--border-color, #454545);
  border-radius: 8px;
  width: 500px;
  max-width: 90vw;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  z-index: 1;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color, #454545);
}

.modal-header h3 {
  margin: 0;
  font-size: 16px;
  color: var(--text-primary, #cccccc);
  font-weight: 600;
}

.modal-close {
  background: transparent;
  border: none;
  color: var(--text-secondary, #858585);
  font-size: 24px;
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: background 0.15s;
}

.modal-close:hover {
  background: var(--bg-hover, #2a2d2e);
}

.modal-tabs {
  display: flex;
  gap: 0;
  border-bottom: 1px solid var(--border-color, #454545);
}

.modal-tab {
  flex: 1;
  background: transparent;
  border: none;
  padding: 10px 16px;
  cursor: pointer;
  color: var(--text-secondary, #858585);
  font-size: 12px;
  font-weight: 500;
  border-bottom: 2px solid transparent;
  transition: all 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.modal-tab:hover {
  color: var(--text-primary, #cccccc);
  background: var(--bg-hover, #2a2d2e);
}

.modal-tab.active {
  color: var(--text-primary, #cccccc);
  border-bottom-color: var(--accent-color, #007acc);
}

.tab-icon {
  font-size: 14px;
}

.modal-body {
  padding: 20px;
}

.modal-section {
  margin-bottom: 16px;
}

.section-label {
  display: block;
  margin-bottom: 8px;
  color: var(--text-primary, #cccccc);
  font-size: 13px;
  font-weight: 500;
}

.section-input {
  width: 100%;
  background: var(--bg-secondary, #2d2d2d);
  border: 1px solid var(--border-color, #454545);
  border-radius: 4px;
  padding: 10px 12px;
  color: var(--text-primary, #cccccc);
  font-size: 13px;
  font-family: 'Consolas', 'Monaco', monospace;
  outline: none;
  transition: border-color 0.15s;
}

.section-input:focus {
  border-color: var(--accent-color, #007acc);
}

.section-input::placeholder {
  color: var(--text-secondary, #858585);
}

.section-help {
  margin-top: 8px;
  color: var(--text-secondary, #858585);
  font-size: 11px;
  line-height: 1.4;
}

.modal-footer {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  padding: 16px 20px;
  border-top: 1px solid var(--border-color, #454545);
}

.modal-btn {
  padding: 8px 16px;
  border-radius: 4px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.15s;
}

.modal-btn-secondary {
  background: var(--bg-secondary, #2d2d2d);
  color: var(--text-primary, #cccccc);
  border-color: var(--border-color, #454545);
}

.modal-btn-secondary:hover {
  background: var(--bg-hover, #2a2d2e);
}

.modal-btn-primary {
  background: var(--accent-color, #007acc);
  color: #ffffff;
}

.modal-btn-primary:hover {
  background: var(--accent-hover, #005a9e);
}
`;

// Inject styles
if (!document.getElementById('conditional-breakpoint-modal-styles')) {
  const styleEl = document.createElement('style');
  styleEl.id = 'conditional-breakpoint-modal-styles';
  styleEl.textContent = styles;
  document.head.appendChild(styleEl);
}
