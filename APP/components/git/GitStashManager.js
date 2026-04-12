/**
 * GitStashManager - UI per gestire Git stash
 * 
 * Features:
 * - Lista stash con indice, messaggio, data, branch
 * - Azioni: Apply, Pop, Drop, Create branch
 * - Crea nuovo stash (con messaggio, untracked)
 * - Search/filter
 * - Preview diff
 */

export class GitStashManager {
  constructor() {
    this._stashes = [];
    this._filteredStashes = [];
    this._searchQuery = '';
    this._container = null;
    
    this._init();
  }

  /**
   * Inizializza il componente
   * @private
   */
  _init() {
    this._container = document.createElement('div');
    this._container.className = 'git-stash-manager';
    this._container.setAttribute('data-testid', 'git-stash-manager');
    this._container.style.display = 'none';
    
    this._container.innerHTML = `
      <div class="stash-overlay"></div>
      <div class="stash-panel">
        <div class="stash-header">
          <h3>📦 Stashed Changes</h3>
          <button class="stash-btn btn-create-stash" title="Create New Stash">+ New Stash</button>
          <button class="stash-close" title="Close">✕</button>
        </div>
        
        <div class="stash-toolbar">
          <input 
            type="text" 
            class="stash-search" 
            placeholder="Search stashes..."
          />
          <button class="stash-btn btn-refresh" title="Refresh">↻</button>
        </div>
        
        <div class="stash-list">
          <div class="stash-loading">Loading stashes...</div>
        </div>
        
        <div class="stash-footer">
          <span class="stash-count">0 stashes</span>
        </div>
      </div>
      
      <!-- Create Stash Modal -->
      <div class="stash-modal" style="display: none;">
        <div class="stash-modal-content">
          <h4>Create New Stash</h4>
          <div class="stash-form-group">
            <label>Message:</label>
            <input type="text" class="stash-message-input" placeholder="WIP: My changes..." />
          </div>
          <div class="stash-form-group">
            <label class="stash-checkbox">
              <input type="checkbox" class="stash-include-untracked" />
              Include untracked files
            </label>
          </div>
          <div class="stash-modal-actions">
            <button class="stash-btn btn-cancel">Cancel</button>
            <button class="stash-btn btn-save-stash">Stash Changes</button>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(this._container);
    
    // Event listeners
    this._container.querySelector('.stash-close').addEventListener('click', () => this.hide());
    this._container.querySelector('.btn-create-stash').addEventListener('click', () => this._showCreateModal());
    this._container.querySelector('.btn-cancel').addEventListener('click', () => this._hideCreateModal());
    this._container.querySelector('.btn-save-stash').addEventListener('click', () => this._createStash());
    this._container.querySelector('.btn-refresh').addEventListener('click', () => this.loadStashes());
    this._container.querySelector('.stash-search').addEventListener('input', (e) => this._filterStashes(e.target.value));
    
    console.log('[GitStashManager] Initialized');
  }

  /**
   * Mostra il pannello
   */
  async show() {
    this._container.style.display = 'flex';
    await this.loadStashes();
  }

  /**
   * Nasconde il pannello
   */
  hide() {
    this._container.style.display = 'none';
  }

  /**
   * Carica la lista stash
   */
  async loadStashes() {
    try {
      if (!window.electronAPI?.getGitStashes) {
        throw new Error('getGitStashes API not available');
      }
      
      this._stashes = await window.electronAPI.getGitStashes();
      this._filterStashes(this._searchQuery);
    } catch (err) {
      console.error('[GitStashManager] Error loading st:', err.message);
      this._renderError(err.message);
    }
  }

  /**
   * Filtra stash per ricerca
   * @private
   */
  _filterStashes(query) {
    this._searchQuery = query.toLowerCase();
    
    if (!this._searchQuery) {
      this._filteredStashes = [...this._stashes];
    } else {
      this._filteredStashes = this._stashes.filter(s => 
        s.message?.toLowerCase().includes(this._searchQuery) ||
        s.branch?.toLowerCase().includes(this._searchQuery)
      );
    }
    
    this._renderStashes();
  }

  /**
   * Renderizza la lista stash
   * @private
   */
  _renderStashes() {
    const list = this._container.querySelector('.stash-list');
    const count = this._container.querySelector('.stash-count');
    
    if (this._filteredStashes.length === 0) {
      list.innerHTML = `
        <div class="stash-empty">
          <span class="empty-icon">📦</span>
          <p>${this._searchQuery ? 'No stashes match your search' : 'No stashes yet'}</p>
          ${!this._searchQuery ? '<button class="stash-btn btn-create-first">Create your first stash</button>' : ''}
        </div>
      `;
      
      if (list.querySelector('.btn-create-first')) {
        list.querySelector('.btn-create-first').addEventListener('click', () => this._showCreateModal());
      }
    } else {
      list.innerHTML = '';
      
      this._filteredStashes.forEach((stash, index) => {
        const item = document.createElement('div');
        item.className = 'stash-item';
        item.innerHTML = `
          <div class="stash-item-header">
            <span class="stash-item-index">${stash.index || index}</span>
            <span class="stash-item-message" title="${this._escapeHtml(stash.message)}">${this._escapeHtml(stash.message)}</span>
          </div>
          <div class="stash-item-meta">
            <span class="stash-item-branch">📍 ${this._escapeHtml(stash.branch || 'unknown')}</span>
            <span class="stash-item-date">${this._formatDate(stash.date)}</span>
          </div>
          <div class="stash-item-actions">
            <button class="stash-action-btn btn-apply" title="Apply (keep in stash)">▶ Apply</button>
            <button class="stash-action-btn btn-pop" title="Pop (remove after apply)">📤 Pop</button>
            <button class="stash-action-btn btn-branch" title="Create branch from stash">🌿 Branch</button>
            <button class="stash-action-btn btn-drop" title="Drop (delete) stash">🗑️ Drop</button>
          </div>
        `;
        
        // Event listeners
        item.querySelector('.btn-apply').addEventListener('click', () => this.applyStash(stash.id || stash.index));
        item.querySelector('.btn-pop').addEventListener('click', () => this.popStash(stash.id || stash.index));
        item.querySelector('.btn-branch').addEventListener('click', () => this._createBranchFromStash(stash));
        item.querySelector('.btn-drop').addEventListener('click', () => this.dropStash(stash.id || stash.index));
        
        list.appendChild(item);
      });
    }
    
    count.textContent = `${this._filteredStashes.length} stash${this._filteredStashes.length !== 1 ? 'es' : ''}`;
  }

  /**
   * Applica stash (mantiene nella lista)
   * @param {string|number} stashId - ID stash
   */
  async applyStash(stashId) {
    try {
      if (window.electronAPI?.applyGitStash) {
        await window.electronAPI.applyGitStash(stashId);
        console.log('[GitStashManager] Stash applied:', stashId);
        this._showNotification('Stash applied successfully', 'success');
        await this.loadStashes();
      }
    } catch (err) {
      console.error('[GitStashManager] Error applying stash:', err.message);
      this._showNotification(`Error: ${err.message}`, 'error');
    }
  }

  /**
   * Pop stash (applica e rimuove)
   * @param {string|number} stashId - ID stash
   */
  async popStash(stashId) {
    if (!confirm('This will apply and remove the stash. Continue?')) {
      return;
    }
    
    try {
      if (window.electronAPI?.popGitStash) {
        await window.electronAPI.popGitStash(stashId);
        console.log('[GitStashManager] Stash popped:', stashId);
        this._showNotification('Stash popped successfully', 'success');
        await this.loadStashes();
      }
    } catch (err) {
      console.error('[GitStashManager] Error popping stash:', err.message);
      this._showNotification(`Error: ${err.message}`, 'error');
    }
  }

  /**
   * Elimina stash
   * @param {string|number} stashId - ID stash
   */
  async dropStash(stashId) {
    if (!confirm('This will permanently delete the stash. Continue?')) {
      return;
    }
    
    try {
      if (window.electronAPI?.dropGitStash) {
        await window.electronAPI.dropGitStash(stashId);
        console.log('[GitStashManager] Stash dropped:', stashId);
        this._showNotification('Stash dropped', 'success');
        await this.loadStashes();
      }
    } catch (err) {
      console.error('[GitStashManager] Error dropping stash:', err.message);
      this._showNotification(`Error: ${err.message}`, 'error');
    }
  }

  /**
   * Mostra modal creazione stash
   * @private
   */
  _showCreateModal() {
    const modal = this._container.querySelector('.stash-modal');
    modal.style.display = 'flex';
    modal.querySelector('.stash-message-input').value = '';
    modal.querySelector('.stash-include-untracked').checked = false;
    modal.querySelector('.stash-message-input').focus();
  }

  /**
   * Nasconde modal creazione stash
   * @private
   */
  _hideCreateModal() {
    this._container.querySelector('.stash-modal').style.display = 'none';
  }

  /**
   * Crea nuovo stash
   * @private
   */
  async _createStash() {
    const message = this._container.querySelector('.stash-message-input').value.trim();
    const includeUntracked = this._container.querySelector('.stash-include-untracked').checked;
    
    if (!message) {
      alert('Please enter a message for the stash');
      return;
    }
    
    try {
      if (window.electronAPI?.createGitStash) {
        await window.electronAPI.createGitStash(message, includeUntracked);
        console.log('[GitStashManager] Stash created:', message);
        this._showNotification('Stash created successfully', 'success');
        this._hideCreateModal();
        await this.loadStashes();
      }
    } catch (err) {
      console.error('[GitStashManager] Error creating stash:', err.message);
      this._showNotification(`Error: ${err.message}`, 'error');
    }
  }

  /**
   * Crea branch da stash
   * @private
   */
  async _createBranchFromStash(stash) {
    const branchName = prompt('Enter branch name:', `stash-${stash.index || 'backup'}`);
    
    if (!branchName) return;
    
    try {
      if (window.electronAPI?.createBranchFromStash) {
        await window.electronAPI.createBranchFromStash(stash.id || stash.index, branchName);
        console.log('[GitStashManager] Branch created from stash:', branchName);
        this._showNotification(`Branch "${branchName}" created`, 'success');
        await this.loadStashes();
      }
    } catch (err) {
      console.error('[GitStashManager] Error creating branch:', err.message);
      this._showNotification(`Error: ${err.message}`, 'error');
    }
  }

  /**
   * Renderizza errore
   * @private
   */
  _renderError(message) {
    this._container.querySelector('.stash-list').innerHTML = `
      <div class="stash-error">
        <p>❌ Error loading stashes</p>
        <p class="error-message">${this._escapeHtml(message)}</p>
        <button class="stash-btn btn-retry" onclick="window.__stashManager.loadStashes()">Retry</button>
      </div>
    `;
  }

  /**
   * Mostra notifica
   * @private
   */
  _showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `stash-notification stash-notification-${type}`;
    notification.textContent = message;
    
    this._container.appendChild(notification);
    
    setTimeout(() => notification.remove(), 3000);
  }

  /**
   * Formatta data
   * @private
   */
  _formatDate(date) {
    if (!date) return '';
    
    const d = new Date(date);
    const now = new Date();
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return d.toLocaleDateString();
  }

  /**
   * Escape HTML
   * @private
   */
  _escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Espone istanza globale per retry
   */
  getGlobalRef() {
    window.__stashManager = this;
  }
}

// Stili CSS
const styles = `
.git-stash-manager {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 10001;
  display: none;
}

.stash-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
}

.stash-panel {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 700px;
  max-width: 95vw;
  max-height: 80vh;
  background: var(--bg-primary, #1e1e1e);
  border: 1px solid var(--border-color, #454545);
  border-radius: 8px;
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.6);
  display: flex;
  flex-direction: column;
  z-index: 1;
}

.stash-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color, #454545);
}

.stash-header h3 {
  margin: 0;
  font-size: 16px;
  color: var(--text-primary, #cccccc);
  font-weight: 600;
}

.stash-close {
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

.stash-close:hover {
  background: var(--bg-hover, #2a2d2e);
}

.stash-toolbar {
  display: flex;
  gap: 12px;
  padding: 12px 20px;
  border-bottom: 1px solid var(--border-color, #454545);
}

.stash-search {
  flex: 1;
  background: var(--bg-secondary, #2d2d2d);
  border: 1px solid var(--border-color, #454545);
  border-radius: 4px;
  padding: 8px 12px;
  color: var(--text-primary, #cccccc);
  font-size: 13px;
  outline: none;
}

.stash-search:focus {
  border-color: var(--accent-color, #007acc);
}

.stash-list {
  flex: 1;
  overflow-y: auto;
}

.stash-item {
  padding: 16px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  transition: background 0.15s;
}

.stash-item:hover {
  background: var(--bg-hover, #2a2d2e);
}

.stash-item-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.stash-item-index {
  background: var(--accent-color, #007acc);
  color: #fff;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
  min-width: 32px;
  text-align: center;
}

.stash-item-message {
  flex: 1;
  font-size: 13px;
  color: var(--text-primary, #cccccc);
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stash-item-meta {
  display: flex;
  gap: 16px;
  margin-bottom: 12px;
  font-size: 11px;
  color: var(--text-secondary, #858585);
}

.stash-item-actions {
  display: flex;
  gap: 8px;
}

.stash-action-btn {
  padding: 6px 12px;
  border: 1px solid var(--border-color, #454545);
  border-radius: 4px;
  background: var(--bg-secondary, #2d2d2d);
  color: var(--text-primary, #cccccc);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}

.stash-action-btn:hover {
  background: var(--bg-hover, #2a2d2e);
  border-color: var(--accent-color, #007acc);
}

.btn-drop:hover {
  background: rgba(248, 81, 73, 0.2);
  border-color: #f85149;
  color: #f85149;
}

.stash-footer {
  padding: 12px 20px;
  border-top: 1px solid var(--border-color, #454545);
  background: var(--bg-secondary, #2d2d2d);
}

.stash-count {
  font-size: 12px;
  color: var(--text-secondary, #858585);
}

.stash-empty {
  padding: 60px 20px;
  text-align: center;
  color: var(--text-secondary, #858585);
}

.stash-empty .empty-icon {
  font-size: 64px;
  display: block;
  margin-bottom: 16px;
  opacity: 0.5;
}

.stash-modal {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2;
}

.stash-modal-content {
  background: var(--bg-primary, #1e1e1e);
  border: 1px solid var(--border-color, #454545);
  border-radius: 8px;
  padding: 24px;
  width: 400px;
  max-width: 90vw;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
}

.stash-modal-content h4 {
  margin: 0 0 20px 0;
  font-size: 16px;
  color: var(--text-primary, #cccccc);
}

.stash-form-group {
  margin-bottom: 16px;
}

.stash-form-group label {
  display: block;
  margin-bottom: 6px;
  font-size: 13px;
  color: var(--text-secondary, #858585);
}

.stash-message-input {
  width: 100%;
  background: var(--bg-secondary, #2d2d2d);
  border: 1px solid var(--border-color, #454545);
  border-radius: 4px;
  padding: 10px 12px;
  color: var(--text-primary, #cccccc);
  font-size: 13px;
  outline: none;
}

.stash-message-input:focus {
  border-color: var(--accent-color, #007acc);
}

.stash-checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.stash-modal-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 24px;
}

.stash-btn {
  padding: 8px 16px;
  border: 1px solid var(--border-color, #454545);
  border-radius: 4px;
  background: var(--bg-secondary, #2d2d2d);
  color: var(--text-primary, #cccccc);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}

.stash-btn:hover {
  background: var(--bg-hover, #2a2d2e);
}

.btn-save-stash {
  background: #238636;
  border-color: #238636;
}

.btn-save-stash:hover {
  background: #2ea043;
}

.stash-notification {
  position: absolute;
  top: 60px;
  right: 16px;
  padding: 12px 16px;
  border-radius: 6px;
  font-size: 13px;
  color: #fff;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  animation: slideIn 0.3s ease;
  z-index: 3;
}

.stash-notification-success {
  background: #238636;
}

.stash-notification-error {
  background: #da3633;
}

@keyframes slideIn {
  from { transform: translateX(100%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}
`;

// Inject styles
if (!document.getElementById('git-stash-manager-styles')) {
  const styleEl = document.createElement('style');
  styleEl.id = 'git-stash-manager-styles';
  styleEl.textContent = styles;
  document.head.appendChild(styleEl);
}
