/**
 * MergeConflictResolver - UI per risolvere conflitti di merge
 * 
 * Features:
 * - Visualizzazione conflitti (Current vs Incoming)
 * - Accept Current / Accept Incoming / Accept Both
 * - Navigazione tra conflitti multipli
 * - Evidenziazione marker (<<<<<<, =======, >>>>>>)
 * - Tracking risoluzione
 */

export class MergeConflictResolver {
  constructor() {
    this._conflicts = [];
    this._currentIndex = 0;
    this._container = null;
    
    this._init();
  }

  /**
   * Inizializza il componente
   * @private
   */
  _init() {
    this._container = document.createElement('div');
    this._container.className = 'merge-conflict-resolver';
    this._container.setAttribute('data-testid', 'merge-conflict-resolver');
    this._container.style.display = 'none';
    
    this._container.innerHTML = `
      <div class="conflict-overlay"></div>
      <div class="conflict-panel">
        <div class="conflict-header">
          <h3>🔀 Merge Conflicts</h3>
          <div class="conflict-counter">0/0</div>
          <button class="conflict-close" title="Close">✕</button>
        </div>
        
        <div class="conflict-file-info">
          <span class="conflict-file-name"></span>
        </div>
        
        <div class="conflict-content">
          <div class="conflict-section conflict-current">
            <div class="conflict-section-header">
              <span>📍 Current Change</span>
            </div>
            <pre class="conflict-code current-code"></pre>
          </div>
          
          <div class="conflict-actions">
            <button class="conflict-btn btn-accept-current" title="Accept Current Change">
              ← Accept Current
            </button>
            <button class="conflict-btn btn-accept-both" title="Accept Both Changes">
              ⇄ Accept Both
            </button>
            <button class="conflict-btn btn-accept-incoming" title="Accept Incoming Change">
              Accept Incoming →
            </button>
          </div>
          
          <div class="conflict-section conflict-incoming">
            <div class="conflict-section-header">
              <span>📥 Incoming Change</span>
            </div>
            <pre class="conflict-code incoming-code"></pre>
          </div>
        </div>
        
        <div class="conflict-footer">
          <button class="conflict-nav-btn btn-prev" title="Previous Conflict">← Prev</button>
          <button class="conflict-nav-btn btn-next" title="Next Conflict">Next →</button>
          <span class="conflict-nav-info">Use arrows to navigate between conflicts</span>
        </div>
      </div>
    `;
    
    document.body.appendChild(this._container);
    
    // Event listeners
    this._container.querySelector('.conflict-close').addEventListener('click', () => this.hide());
    this._container.querySelector('.btn-accept-current').addEventListener('click', () => this._resolve('current'));
    this._container.querySelector('.btn-accept-incoming').addEventListener('click', () => this._resolve('incoming'));
    this._container.querySelector('.btn-accept-both').addEventListener('click', () => this._resolve('both'));
    this._container.querySelector('.btn-prev').addEventListener('click', () => this.prevConflict());
    this._container.querySelector('.btn-next').addEventListener('click', () => this.nextConflict());
    
    console.log('[MergeConflictResolver] Initialized');
  }

  /**
   * Mostra il pannello
   * @param {Array} conflicts - Lista conflitti
   */
  show(conflicts = []) {
    this._conflicts = conflicts;
    this._currentIndex = 0;
    this._container.style.display = 'flex';
    this._renderConflict();
  }

  /**
   * Nasconde il pannello
   */
  hide() {
    this._container.style.display = 'none';
  }

  /**
   * Visualizza il conflitto corrente
   * @private
   */
  _renderConflict() {
    if (this._conflicts.length === 0) {
      this._container.querySelector('.conflict-content').innerHTML = `
        <div class="conflict-empty">
          <p>✅ No conflicts to resolve</p>
        </div>
      `;
      return;
    }

    const conflict = this._conflicts[this._currentIndex];
    
    // Update counter
    this._container.querySelector('.conflict-counter').textContent = 
      `${this._currentIndex + 1}/${this._conflicts.length}`;
    
    // Update file info
    this._container.querySelector('.conflict-file-name').textContent = conflict.file || 'Unknown file';
    
    // Update code sections
    this._container.querySelector('.current-code').textContent = conflict.current || '';
    this._container.querySelector('.incoming-code').textContent = conflict.incoming || '';
    
    // Update button states
    this._container.querySelector('.btn-prev').disabled = this._currentIndex === 0;
    this._container.querySelector('.btn-next').disabled = this._currentIndex === this._conflicts.length - 1;
  }

  /**
   * Risolve il conflitto corrente
   * @param {string} strategy - 'current', 'incoming', o 'both'
   * @private
   */
  async _resolve(strategy) {
    if (this._conflicts.length === 0) return;
    
    const conflict = this._conflicts[this._currentIndex];
    
    try {
      if (window.electronAPI?.resolveConflict) {
        await window.electronAPI.resolveConflict(conflict, strategy);
        console.log(`[MergeConflictResolver] Resolved with ${strategy}`);
        
        // Remove resolved conflict
        this._conflicts.splice(this._currentIndex, 1);
        
        // Adjust index if needed
        if (this._currentIndex >= this._conflicts.length && this._currentIndex > 0) {
          this._currentIndex--;
        }
        
        this._renderConflict();
        
        // Check if all resolved
        if (this._conflicts.length === 0) {
          this._showSuccess();
        }
      }
    } catch (err) {
      console.error('[MergeConflictResolver] Error resolving:', err.message);
      alert(`Error resolving conflict: ${err.message}`);
    }
  }

  /**
   * Vai a conflitto precedente
   */
  prevConflict() {
    if (this._currentIndex > 0) {
      this._currentIndex--;
      this._renderConflict();
    }
  }

  /**
   * Vai a conflitto successivo
   */
  nextConflict() {
    if (this._currentIndex < this._conflicts.length - 1) {
      this._currentIndex++;
      this._renderConflict();
    }
  }

  /**
   * Mostra messaggio successo
   * @private
   */
  _showSuccess() {
    this._container.querySelector('.conflict-content').innerHTML = `
      <div class="conflict-success">
        <span class="success-icon">✅</span>
        <h3>All Conflicts Resolved!</h3>
        <p>You can now continue with the merge operation.</p>
      </div>
    `;
    
    setTimeout(() => this.hide(), 3000);
  }

  /**
   * Ottiene conflitti rimanenti
   * @returns {number}
   */
  getRemainingConflicts() {
    return this._conflicts.length;
  }

  /**
   * Distruggi componente
   */
  destroy() {
    if (this._container && this._container.parentNode) {
      this._container.parentNode.removeChild(this._container);
    }
  }
}

// Stili CSS
const styles = `
.merge-conflict-resolver {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 10001;
  display: none;
}

.conflict-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
}

.conflict-panel {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 900px;
  max-width: 95vw;
  max-height: 85vh;
  background: var(--bg-primary, #1e1e1e);
  border: 1px solid var(--border-color, #454545);
  border-radius: 8px;
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.6);
  display: flex;
  flex-direction: column;
  z-index: 1;
}

.conflict-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color, #454545);
}

.conflict-header h3 {
  margin: 0;
  font-size: 16px;
  color: var(--text-primary, #cccccc);
  font-weight: 600;
}

.conflict-counter {
  font-size: 13px;
  color: var(--text-secondary, #858585);
  background: var(--bg-secondary, #2d2d2d);
  padding: 4px 12px;
  border-radius: 12px;
}

.conflict-close {
  background: transparent;
  border: none;
  color: var(--text-secondary, #858585);
  font-size: 24px;
  cursor: pointer;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: background 0.15s;
}

.conflict-close:hover {
  background: var(--bg-hover, #2a2d2e);
}

.conflict-file-info {
  padding: 12px 20px;
  border-bottom: 1px solid var(--border-color, #454545);
  background: var(--bg-secondary, #2d2d2d);
}

.conflict-file-name {
  font-size: 13px;
  color: var(--text-primary, #cccccc);
  font-family: 'Consolas', 'Monaco', monospace;
  font-weight: 500;
}

.conflict-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.conflict-section {
  margin-bottom: 16px;
}

.conflict-section-header {
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary, #cccccc);
  border-bottom: 1px solid var(--border-color, #454545);
}

.conflict-code {
  margin: 0;
  padding: 12px;
  background: var(--bg-secondary, #2d2d2d);
  border: 1px solid var(--border-color, #454545);
  border-radius: 4px;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 12px;
  line-height: 1.5;
  overflow-x: auto;
  color: var(--text-primary, #cccccc);
  white-space: pre-wrap;
  word-break: break-all;
}

.conflict-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  padding: 20px 0;
}

.conflict-btn {
  padding: 10px 20px;
  border: 1px solid var(--border-color, #454545);
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  background: var(--bg-secondary, #2d2d2d);
  color: var(--text-primary, #cccccc);
}

.btn-accept-current {
  background: #1f6feb;
  border-color: #1f6feb;
}

.btn-accept-current:hover {
  background: #388bfd;
}

.btn-accept-both {
  background: #8957e5;
  border-color: #8957e5;
}

.btn-accept-both:hover {
  background: #a371f7;
}

.btn-accept-incoming {
  background: #238636;
  border-color: #238636;
}

.btn-accept-incoming:hover {
  background: #2ea043;
}

.conflict-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  border-top: 1px solid var(--border-color, #454545);
}

.conflict-nav-btn {
  padding: 8px 16px;
  border: 1px solid var(--border-color, #454545);
  border-radius: 4px;
  background: var(--bg-secondary, #2d2d2d);
  color: var(--text-primary, #cccccc);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}

.conflict-nav-btn:hover:not(:disabled) {
  background: var(--bg-hover, #2a2d2e);
}

.conflict-nav-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.conflict-nav-info {
  font-size: 11px;
  color: var(--text-secondary, #858585);
}

.conflict-empty,
.conflict-success {
  padding: 60px 20px;
  text-align: center;
  color: var(--text-secondary, #858585);
}

.success-icon {
  font-size: 64px;
  display: block;
  margin-bottom: 16px;
}

.conflict-success h3 {
  margin: 16px 0 8px;
  font-size: 18px;
  color: #3fb950;
}

.conflict-success p {
  margin: 0;
  font-size: 13px;
}
`;

// Inject styles
if (!document.getElementById('merge-conflict-resolver-styles')) {
  const styleEl = document.createElement('style');
  styleEl.id = 'merge-conflict-resolver-styles';
  styleEl.textContent = styles;
  document.head.appendChild(styleEl);
}
