/**
 * GitGraphView - UI per visualizzare grafo commit Git
 * 
 * Features:
 * - Grafo commit con linee colorate per branch
 * - Commit node: hash, message, author, date, tags
 * - Click commit per dettagli (diff, files)
 * - Filter by branch
 * - Search commits
 * - Right-click menu (Checkout, Revert, Cherry-pick, Create branch)
 * - Infinite scroll
 */

export class GitGraphView {
  constructor() {
    this._commits = [];
    this._filteredCommits = [];
    this._branches = [];
    this._selectedBranch = 'all';
    this._searchQuery = '';
    this._selectedCommit = null;
    this._page = 0;
    this._pageSize = 50;
    this._loading = false;
    this._container = null;
    this._branchColors = [
      '#f472b6', '#60a5fa', '#34d399', '#fbbf24', '#a78bfa',
      '#f87171', '#38bdf8', '#4ade80', '#fb923c', '#c084fc'
    ];
    this._branchColorMap = {};
    
    this._init();
  }

  /**
   * Inizializza il componente
   * @private
   */
  _init() {
    this._container = document.createElement('div');
    this._container.className = 'git-graph-view';
    this._container.setAttribute('data-testid', 'git-graph-view');
    this._container.style.display = 'none';
    
    this._container.innerHTML = `
      <div class="graph-overlay"></div>
      <div class="graph-panel">
        <div class="graph-header">
          <h3>🌿 Git Graph</h3>
          <select class="graph-branch-filter">
            <option value="all">All Branches</option>
          </select>
          <input type="text" class="graph-search" placeholder="Search commits..." />
          <button class="graph-close" title="Close">✕</button>
        </div>
        
        <div class="graph-content">
          <div class="graph-canvas">
            <div class="graph-loading">Loading commits...</div>
          </div>
        </div>
        
        <div class="graph-footer">
          <button class="graph-btn btn-load-more">Load More</button>
          <span class="graph-info">0 commits</span>
        </div>
      </div>
      
      <!-- Context Menu -->
      <div class="graph-context-menu" style="display: none;">
        <div class="menu-item" data-action="checkout">📍 Checkout</div>
        <div class="menu-item" data-action="revert">↩️ Revert</div>
        <div class="menu-item" data-action="cherry-pick">🍒 Cherry-pick</div>
        <div class="menu-item" data-action="create-branch">🌿 Create Branch from Here</div>
        <div class="menu-divider"></div>
        <div class="menu-item" data-action="copy-hash">📋 Copy Hash</div>
      </div>
      
      <!-- Commit Details Panel -->
      <div class="graph-commit-details" style="display: none;">
        <div class="details-header">
          <h4>Commit Details</h4>
          <button class="details-close">✕</button>
        </div>
        <div class="details-content"></div>
      </div>
    `;
    
    document.body.appendChild(this._container);
    
    // Event listeners
    this._container.querySelector('.graph-close').addEventListener('click', () => this.hide());
    this._container.querySelector('.graph-branch-filter').addEventListener('change', (e) => this._onBranchFilter(e.target.value));
    this._container.querySelector('.graph-search').addEventListener('input', (e) => this._onSearch(e.target.value));
    this._container.querySelector('.btn-load-more').addEventListener('click', () => this.loadMore());
    this._container.querySelector('.details-close').addEventListener('click', () => this._hideCommitDetails());
    
    // Context menu
    this._container.querySelectorAll('.menu-item').forEach(item => {
      item.addEventListener('click', () => this._onMenuAction(item.dataset.action));
    });
    
    // Close context menu on click outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.graph-context-menu')) {
        this._hideContextMenu();
      }
    });
    
    // Infinite scroll
    this._container.querySelector('.graph-content').addEventListener('scroll', (e) => {
      const { scrollTop, scrollHeight, clientHeight } = e.target;
      if (scrollTop + clientHeight >= scrollHeight - 100 && !this._loading) {
        this.loadMore();
      }
    });
    
    console.log('[GitGraphView] Initialized');
  }

  /**
   * Mostra il pannello
   */
  async show() {
    this._container.style.display = 'flex';
    await this.loadCommits();
  }

  /**
   * Nasconde il pannello
   */
  hide() {
    this._container.style.display = 'none';
  }

  /**
   * Carica commit
   */
  async loadCommits() {
    this._page = 0;
    this._commits = [];
    await this._loadPage();
  }

  /**
   * Carica più commit (infinite scroll)
   */
  async loadMore() {
    if (this._loading) return;
    await this._loadPage();
  }

  /**
   * Carica una pagina di commit
   * @private
   */
  async _loadPage() {
    this._loading = true;
    
    try {
      if (!window.electronAPI?.getGitCommits) {
        throw new Error('getGitCommits API not available');
      }
      
      const newCommits = await window.electronAPI.getGitCommits({
        page: this._page,
        pageSize: this._pageSize,
        branch: this._selectedBranch !== 'all' ? this._selectedBranch : null
      });
      
      if (newCommits.length === 0) {
        // No more commits
        this._container.querySelector('.btn-load-more').style.display = 'none';
      } else {
        this._commits = [...this._commits, ...newCommits];
        this._page++;
        
        // Extract branches
        this._extractBranches();
        
        this._filterAndRender();
        this._container.querySelector('.btn-load-more').style.display = 'block';
      }
    } catch (err) {
      console.error('[GitGraphView] Error loading commits:', err.message);
      this._renderError(err.message);
    } finally {
      this._loading = false;
    }
  }

  /**
   * Estrae branch dai commit
   * @private
   */
  _extractBranches() {
    const branches = new Set();
    
    for (const commit of this._commits) {
      if (commit.branches) {
        for (const branch of commit.branches) {
          branches.add(branch);
        }
      }
    }
    
    this._branches = Array.from(branches);
    this._updateBranchFilter();
  }

  /**
   * Aggiorna filtro branch
   * @private
   */
  _updateBranchFilter() {
    const select = this._container.querySelector('.graph-branch-filter');
    const currentValue = select.value;
    
    // Clear existing options (except "All Branches")
    select.innerHTML = '<option value="all">All Branches</option>';
    
    for (const branch of this._branches) {
      const option = document.createElement('option');
      option.value = branch;
      option.textContent = branch;
      select.appendChild(option);
    }
    
    select.value = currentValue;
  }

  /**
   * Filtra per branch
   * @private
   */
  _onBranchFilter(branch) {
    this._selectedBranch = branch;
    this.loadCommits();
  }

  /**
   * Search commits
   * @private
   */
  _onSearch(query) {
    this._searchQuery = query.toLowerCase();
    this._filterAndRender();
  }

  /**
   * Filtra e renderizza
   * @private
   */
  _filterAndRender() {
    if (!this._searchQuery) {
      this._filteredCommits = [...this._commits];
    } else {
      this._filteredCommits = this._commits.filter(c => 
        c.message?.toLowerCase().includes(this._searchQuery) ||
        c.author?.toLowerCase().includes(this._searchQuery) ||
        c.hash?.toLowerCase().includes(this._searchQuery)
      );
    }
    
    this._renderGraph();
  }

  /**
   * Renderizza il grafo
   * @private
   */
  _renderGraph() {
    const canvas = this._container.querySelector('.graph-canvas');
    const info = this._container.querySelector('.graph-info');
    
    if (this._filteredCommits.length === 0) {
      canvas.innerHTML = `
        <div class="graph-empty">
          <p>No commits found</p>
        </div>
      `;
      info.textContent = '0 commits';
      return;
    }

    // Assign branch colors
    this._assignBranchColors();

    let html = '<div class="graph-commits">';
    
    for (const commit of this._filteredCommits) {
      html += this._renderCommitNode(commit);
    }
    
    html += '</div>';
    canvas.innerHTML = html;
    info.textContent = `${this._filteredCommits.length} commits`;
    
    // Add right-click listeners
    canvas.querySelectorAll('.commit-node').forEach(node => {
      node.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this._showContextMenu(e, node.dataset.hash);
      });
      
      node.addEventListener('click', () => {
        this.showCommitDetails(node.dataset.hash);
      });
    });
  }

  /**
   * Renderizza nodo commit
   * @private
   */
  _renderCommitNode(commit) {
    const color = this._getCommitColor(commit);
    const branches = commit.branches || [];
    const isHEAD = commit.isHEAD;
    
    return `
      <div class="commit-node" data-hash="${commit.hash}">
        <div class="commit-graph-line" style="border-left-color: ${color}"></div>
        <div class="commit-dot" style="background: ${color}; border-color: ${color}"></div>
        <div class="commit-content">
          <div class="commit-header">
            <span class="commit-message">${this._escapeHtml(commit.message)}</span>
            <span class="commit-hash" title="${commit.hash}">${commit.hash.substring(0, 7)}</span>
          </div>
          <div class="commit-meta">
            <span class="commit-author">👤 ${this._escapeHtml(commit.author)}</span>
            <span class="commit-date">🕒 ${this._formatDate(commit.date)}</span>
            ${branches.length > 0 ? `<span class="commit-branches">${branches.map(b => `<span class="branch-tag">${this._escapeHtml(b)}</span>`).join(' ')}</span>` : ''}
            ${isHEAD ? '<span class="head-tag">HEAD</span>' : ''}
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Assegna colori ai branch
   * @private
   */
  _assignBranchColors() {
    this._branchColorMap = {};
    
    this._branches.forEach((branch, index) => {
      this._branchColorMap[branch] = this._branchColors[index % this._branchColors.length];
    });
  }

  /**
   * Ottiene colore per commit
   * @private
   */
  _getCommitColor(commit) {
    const branches = commit.branches || [];
    if (branches.length === 0) return '#858585';
    return this._branchColorMap[branches[0]] || '#858585';
  }

  /**
   * Mostra context menu
   * @private
   */
  _showContextMenu(event, commitHash) {
    this._selectedCommit = commitHash;
    
    const menu = this._container.querySelector('.graph-context-menu');
    menu.style.display = 'block';
    menu.style.left = `${event.pageX}px`;
    menu.style.top = `${event.pageY}px`;
  }

  /**
   * Nasconde context menu
   * @private
   */
  _hideContextMenu() {
    this._container.querySelector('.graph-context-menu').style.display = 'none';
  }

  /**
   * Gestisce azione menu
   * @private
   */
  async _onMenuAction(action) {
    this._hideContextMenu();
    
    if (!this._selectedCommit) return;
    
    try {
      switch (action) {
        case 'checkout':
          if (window.electronAPI?.checkoutCommit) {
            await window.electronAPI.checkoutCommit(this._selectedCommit);
            this._showNotification('Checked out commit', 'success');
          }
          break;
        
        case 'revert':
          if (confirm(`Revert commit ${this._selectedCommit.substring(0, 7)}?`)) {
            if (window.electronAPI?.revertCommit) {
              await window.electronAPI.revertCommit(this._selectedCommit);
              this._showNotification('Commit reverted', 'success');
            }
          }
          break;
        
        case 'cherry-pick':
          if (window.electronAPI?.cherryPickCommit) {
            await window.electronAPI.cherryPickCommit(this._selectedCommit);
            this._showNotification('Commit cherry-picked', 'success');
          }
          break;
        
        case 'create-branch':
          const branchName = prompt('Branch name:', `feature/${this._selectedCommit.substring(0, 7)}`);
          if (branchName && window.electronAPI?.createBranch) {
            await window.electronAPI.createBranch(branchName, this._selectedCommit);
            this._showNotification(`Branch "${branchName}" created`, 'success');
          }
          break;
        
        case 'copy-hash':
          navigator.clipboard?.writeText(this._selectedCommit);
          this._showNotification('Hash copied to clipboard', 'success');
          break;
      }
    } catch (err) {
      console.error('[GitGraphView] Menu action error:', err.message);
      this._showNotification(`Error: ${err.message}`, 'error');
    }
  }

  /**
   * Mostra dettagli commit
   */
  async showCommitDetails(commitHash) {
    const details = this._container.querySelector('.graph-commit-details');
    const content = details.querySelector('.details-content');
    
    details.style.display = 'block';
    content.innerHTML = '<p>Loading...</p>';
    
    try {
      if (window.electronAPI?.getCommitDetails) {
        const commitDetails = await window.electronAPI.getCommitDetails(commitHash);
        
        content.innerHTML = `
          <div class="detail-item">
            <label>Hash:</label>
            <code>${commitDetails.hash}</code>
          </div>
          <div class="detail-item">
            <label>Author:</label>
            <span>${this._escapeHtml(commitDetails.author)}</span>
          </div>
          <div class="detail-item">
            <label>Date:</label>
            <span>${new Date(commitDetails.date).toLocaleString()}</span>
          </div>
          <div class="detail-item">
            <label>Message:</label>
            <p>${this._escapeHtml(commitDetails.message)}</p>
          </div>
          <div class="detail-item">
            <label>Files Changed:</label>
            <span>${commitDetails.filesChanged || 0}</span>
          </div>
          <div class="detail-item">
            <label>Insertions:</label>
            <span class="stat-add">+${commitDetails.insertions || 0}</span>
          </div>
          <div class="detail-item">
            <label>Deletions:</label>
            <span class="stat-del">-${commitDetails.deletions || 0}</span>
          </div>
        `;
      }
    } catch (err) {
      content.innerHTML = `<p class="error">Error loading details: ${err.message}</p>`;
    }
  }

  /**
   * Nasconde dettagli commit
   * @private
   */
  _hideCommitDetails() {
    this._container.querySelector('.graph-commit-details').style.display = 'none';
  }

  /**
   * Renderizza errore
   * @private
   */
  _renderError(message) {
    this._container.querySelector('.graph-canvas').innerHTML = `
      <div class="graph-error">
        <p>❌ Error loading commits</p>
        <p class="error-message">${this._escapeHtml(message)}</p>
        <button class="graph-btn btn-retry" onclick="window.__graphView.loadCommits()">Retry</button>
      </div>
    `;
  }

  /**
   * Mostra notifica
   * @private
   */
  _showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `graph-notification graph-notification-${type}`;
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
    const diffMs = Date.now() - d;
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffHours < 1) return 'Just now';
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
   * Espone istanza globale
   */
  getGlobalRef() {
    window.__graphView = this;
  }
}

// Stili CSS
const styles = `
.git-graph-view {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 10001;
  display: none;
}

.graph-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
}

.graph-panel {
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

.graph-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color, #454545);
}

.graph-header h3 {
  margin: 0;
  font-size: 16px;
  color: var(--text-primary, #cccccc);
}

.graph-branch-filter,
.graph-search {
  background: var(--bg-secondary, #2d2d2d);
  border: 1px solid var(--border-color, #454545);
  border-radius: 4px;
  padding: 6px 12px;
  color: var(--text-primary, #cccccc);
  font-size: 13px;
  outline: none;
}

.graph-search {
  flex: 1;
}

.graph-close {
  background: transparent;
  border: none;
  color: var(--text-secondary, #858585);
  font-size: 24px;
  cursor: pointer;
  width: 32px;
  height: 32px;
}

.graph-content {
  flex: 1;
  overflow-y: auto;
}

.graph-commits {
  padding: 16px 0;
}

.commit-node {
  display: flex;
  align-items: flex-start;
  padding: 12px 20px;
  cursor: pointer;
  transition: background 0.15s;
  position: relative;
}

.commit-node:hover {
  background: var(--bg-hover, #2a2d2e);
}

.commit-graph-line {
  position: absolute;
  left: 36px;
  top: 0;
  bottom: -12px;
  border-left: 2px solid;
  z-index: 0;
}

.commit-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid;
  margin-right: 16px;
  margin-top: 6px;
  position: relative;
  z-index: 1;
  flex-shrink: 0;
}

.commit-content {
  flex: 1;
  min-width: 0;
}

.commit-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 6px;
}

.commit-message {
  flex: 1;
  font-size: 13px;
  color: var(--text-primary, #cccccc);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.commit-hash {
  font-size: 11px;
  color: var(--accent-color, #007acc);
  font-family: 'Consolas', 'Monaco', monospace;
  cursor: pointer;
}

.commit-meta {
  display: flex;
  gap: 16px;
  font-size: 11px;
  color: var(--text-secondary, #858585);
  flex-wrap: wrap;
}

.branch-tag,
.head-tag {
  background: var(--accent-color, #007acc);
  color: #fff;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 10px;
  font-weight: 600;
}

.head-tag {
  background: #fbbf24;
  color: #000;
}

.graph-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  border-top: 1px solid var(--border-color, #454545);
  background: var(--bg-secondary, #2d2d2d);
}

.graph-btn {
  padding: 8px 16px;
  border: 1px solid var(--border-color, #454545);
  border-radius: 4px;
  background: var(--bg-primary, #1e1e1e);
  color: var(--text-primary, #cccccc);
  font-size: 13px;
  cursor: pointer;
}

.graph-info {
  font-size: 12px;
  color: var(--text-secondary, #858585);
}

.graph-context-menu {
  position: absolute;
  background: var(--bg-primary, #1e1e1e);
  border: 1px solid var(--border-color, #454545);
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  min-width: 180px;
  z-index: 2;
}

.menu-item {
  padding: 8px 16px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-primary, #cccccc);
  transition: background 0.15s;
}

.menu-item:hover {
  background: var(--bg-hover, #2a2d2e);
}

.menu-divider {
  height: 1px;
  background: var(--border-color, #454545);
}

.graph-commit-details {
  position: absolute;
  right: 20px;
  top: 80px;
  width: 350px;
  max-height: 400px;
  background: var(--bg-primary, #1e1e1e);
  border: 1px solid var(--border-color, #454545);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  z-index: 2;
  overflow-y: auto;
}

.details-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color, #454545);
}

.details-header h4 {
  margin: 0;
  font-size: 14px;
}

.details-close {
  background: transparent;
  border: none;
  color: var(--text-secondary, #858585);
  font-size: 18px;
  cursor: pointer;
}

.details-content {
  padding: 16px;
}

.detail-item {
  margin-bottom: 12px;
}

.detail-item label {
  display: block;
  font-size: 11px;
  color: var(--text-secondary, #858585);
  margin-bottom: 4px;
  text-transform: uppercase;
  font-weight: 500;
}

.detail-item code {
  background: var(--bg-secondary, #2d2d2d);
  padding: 4px 8px;
  border-radius: 4px;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 12px;
}

.stat-add { color: #3fb950; }
.stat-del { color: #f85149; }

.graph-notification {
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

.graph-notification-success { background: #238636; }
.graph-notification-error { background: #da3633; }

@keyframes slideIn {
  from { transform: translateX(100%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}
`;

// Inject styles
if (!document.getElementById('git-graph-view-styles')) {
  const styleEl = document.createElement('style');
  styleEl.id = 'git-graph-view-styles';
  styleEl.textContent = styles;
  document.head.appendChild(styleEl);
}
