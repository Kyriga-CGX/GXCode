/**
 * GitDiffViewer - Componente UI per visualizzare diff Git inline
 * 
 * Features:
 * - Visualizzazione side-by-side diff
 * - Evidenziazione linee aggiunte/rimosse/modificate
 * - Navigazione tra hunks
 * - Toggle split/inline view
 * - Apply/revert changes
 */

export class GitDiffViewer {
  constructor(options = {}) {
    this._filePath = options.filePath || null;
    this._diff = options.diff || null;
    this._viewMode = 'split'; // 'split' or 'inline'
    this._container = null;
    this._currentHunk = 0;
    
    this._init();
  }

  /**
   * Inizializza il componente
   * @private
   */
  _init() {
    this._container = document.createElement('div');
    this._container.className = 'git-diff-viewer';
    this._container.setAttribute('data-testid', 'git-diff-viewer');
    
    this._container.innerHTML = `
      <div class="diff-toolbar">
        <div class="diff-toolbar-left">
          <span class="diff-file-name"></span>
        </div>
        <div class="diff-toolbar-center">
          <button class="diff-btn diff-prev-hunk" title="Previous Hunk">↑</button>
          <span class="diff-hunk-counter">0/0</span>
          <button class="diff-btn diff-next-hunk" title="Next Hunk">↓</button>
        </div>
        <div class="diff-toolbar-right">
          <button class="diff-btn diff-view-toggle" title="Toggle View Mode">Split</button>
          <button class="diff-btn diff-apply" title="Apply Changes">✓ Apply</button>
          <button class="diff-btn diff-revert" title="Revert Changes">✗ Revert</button>
          <button class="diff-btn diff-close" title="Close">✕</button>
        </div>
      </div>
      
      <div class="diff-content">
        <div class="diff-loading">
          <div class="loading-spinner"></div>
          <p>Loading diff...</p>
        </div>
      </div>
      
      <div class="diff-footer">
        <div class="diff-stats">
          <span class="diff-stat diff-additions">+0</span>
          <span class="diff-stat diff-deletions">-0</span>
        </div>
        <div class="diff-info">
          Use arrow keys to navigate hunks
        </div>
      </div>
    `;
    
    // Event listeners
    this._container.querySelector('.diff-view-toggle').addEventListener('click', () => this._toggleView());
    this._container.querySelector('.diff-apply').addEventListener('click', () => this._applyChanges());
    this._container.querySelector('.diff-revert').addEventListener('click', () => this._revertChanges());
    this._container.querySelector('.diff-close').addEventListener('click', () => this.close());
    this._container.querySelector('.diff-prev-hunk').addEventListener('click', () => this._prevHunk());
    this._container.querySelector('.diff-next-hunk').addEventListener('click', () => this._nextHunk());
    
    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
      if (!this._isVisible()) return;
      
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        this._prevHunk();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        this._nextHunk();
      } else if (e.key === 'Escape') {
        this.close();
      }
    });
    
    console.log('[GitDiffViewer] Initialized');
  }

  /**
   * Ottiene il container
   */
  getElement() {
    return this._container;
  }

  /**
   * Carica e visualizza diff
   * @param {string} filePath - File da confrontare
   */
  async loadDiff(filePath) {
    this._filePath = filePath;
    
    // Show loading
    this._container.querySelector('.diff-file-name').textContent = filePath?.split('/').pop() || 'Unknown';
    this._container.querySelector('.diff-content').innerHTML = `
      <div class="diff-loading">
        <div class="loading-spinner"></div>
        <p>Loading diff...</p>
      </div>
    `;
    
    try {
      // Get diff from main process
      if (!window.electronAPI?.getGitDiff) {
        throw new Error('getGitDiff API not available');
      }
      
      this._diff = await window.electronAPI.getGitDiff(filePath);
      this._renderDiff();
      
    } catch (err) {
      console.error('[GitDiffViewer] Error loading diff:', err.message);
      this._container.querySelector('.diff-content').innerHTML = `
        <div class="diff-error">
          <p>Error loading diff: ${err.message}</p>
        </div>
      `;
    }
  }

  /**
   * Visualizza il diff
   * @private
   */
  _renderDiff() {
    if (!this._diff) {
      return;
    }

    const content = this._container.querySelector('.diff-content');
    
    if (this._viewMode === 'split') {
      this._renderSplitView(content);
    } else {
      this._renderInlineView(content);
    }

    // Update stats
    this._updateStats();
  }

  /**
   * Renderizza vista split (side-by-side)
   * @private
   */
  _renderSplitView(container) {
    if (!this._diff || !this._diff.hunks) {
      container.innerHTML = '<div class="diff-empty">No changes</div>';
      return;
    }

    let html = '<div class="diff-split-view">';
    html += '<div class="diff-pane diff-old">';
    html += '<div class="diff-pane-header">Old Version</div>';
    html += '<div class="diff-lines">';
    
    for (const hunk of this._diff.hunks) {
      html += this._renderHunkOld(hunk);
    }
    
    html += '</div></div>';
    html += '<div class="diff-pane diff-new">';
    html += '<div class="diff-pane-header">New Version</div>';
    html += '<div class="diff-lines">';
    
    for (const hunk of this._diff.hunks) {
      html += this._renderHunkNew(hunk);
    }
    
    html += '</div></div></div>';
    
    container.innerHTML = html;
    this._currentHunk = 0;
    this._updateHunkCounter();
  }

  /**
   * Renderizza vista inline
   * @private
   */
  _renderInlineView(container) {
    if (!this._diff || !this._diff.hunks) {
      container.innerHTML = '<div class="diff-empty">No changes</div>';
      return;
    }

    let html = '<div class="diff-inline-view">';
    
    for (let i = 0; i < this._diff.hunks.length; i++) {
      const hunk = this._diff.hunks[i];
      html += `<div class="diff-hunk" data-hunk="${i}">`;
      html += `<div class="diff-hunk-header">${hunk.header || `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`}</div>`;
      html += '<div class="diff-lines">';
      
      for (const line of hunk.lines) {
        html += this._renderInlineLine(line);
      }
      
      html += '</div></div>';
    }
    
    html += '</div>';
    container.innerHTML = html;
    this._currentHunk = 0;
    this._updateHunkCounter();
  }

  /**
   * Renderizza linee vecchio file per split view
   * @private
   */
  _renderHunkOld(hunk) {
    let html = '';
    
    for (const line of hunk.lines) {
      if (line.type === 'add') {
        // Empty line in old view for additions
        html += `<div class="diff-line diff-empty" data-line="${line.oldLine || ''}"><span class="line-number"></span><span class="line-content"> </span></div>`;
      } else {
        const cls = line.type === 'remove' ? 'diff-remove' : 'diff-contesto';
        html += `<div class="diff-line ${cls}" data-line="${line.oldLine || ''}"><span class="line-number">${line.oldLine || ''}</span><span class="line-content">${this._escapeHtml(line.content)}</span></div>`;
      }
    }
    
    return html;
  }

  /**
   * Renderizza linee nuovo file per split view
   * @private
   */
  _renderHunkNew(hunk) {
    let html = '';
    
    for (const line of hunk.lines) {
      if (line.type === 'remove') {
        // Empty line in new view for deletions
        html += `<div class="diff-line diff-empty" data-line="${line.newLine || ''}"><span class="line-number"></span><span class="line-content"> </span></div>`;
      } else {
        const cls = line.type === 'add' ? 'diff_aggiunta' : 'diff-contesto';
        html += `<div class="diff-line ${cls}" data-line="${line.newLine || ''}"><span class="line-number">${line.newLine || ''}</span><span class="line-content">${this._escapeHtml(line.content)}</span></div>`;
      }
    }
    
    return html;
  }

  /**
   * Renderizza linea per inline view
   * @private
   */
  _renderInlineLine(line) {
    if (line.type === 'add') {
      return `<div class="diff-line diff-aggiunta" data-line="${line.newLine || ''}"><span class="line-marker">+</span><span class="line-number">${line.newLine || ''}</span><span class="line-content">${this._escapeHtml(line.content)}</span></div>`;
    } else if (line.type === 'remove') {
      return `<div class="diff-line diff-rimossa" data-line="${line.oldLine || ''}"><span class="line-marker">-</span><span class="line-number">${line.oldLine || ''}</span><span class="line-content">${this._escapeHtml(line.content)}</span></div>`;
    } else {
      return `<div class="diff-line diff-contesto" data-line="${line.oldLine || ''}"><span class="line-marker"> </span><span class="line-number">${line.oldLine || ''}</span><span class="line-content">${this._escapeHtml(line.content)}</span></div>`;
    }
  }

  /**
   * Toggle vista split/inline
   * @private
   */
  _toggleView() {
    this._viewMode = this._viewMode === 'split' ? 'inline' : 'split';
    const btn = this._container.querySelector('.diff-view-toggle');
    btn.textContent = this._viewMode === 'split' ? 'Split' : 'Inline';
    this._renderDiff();
  }

  /**
   * Vai a hunk precedente
   * @private
   */
  _prevHunk() {
    if (this._currentHunk > 0) {
      this._currentHunk--;
      this._scrollToHunk();
      this._updateHunkCounter();
    }
  }

  /**
   * Vai a hunk successivo
   * @private
   */
  _nextHunk() {
    const totalHunks = this._diff?.hunks?.length || 0;
    if (this._currentHunk < totalHunks - 1) {
      this._currentHunk++;
      this._scrollToHunk();
      this._updateHunkCounter();
    }
  }

  /**
   * Scrolla allo hunk corrente
   * @private
   */
  _scrollToHunk() {
    const hunkEl = this._container.querySelector(`[data-hunk="${this._currentHunk}"]`);
    if (hunkEl) {
      hunkEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  /**
   * Aggiorna counter hunk
   * @private
   */
  _updateHunkCounter() {
    const total = this._diff?.hunks?.length || 0;
    const counter = this._container.querySelector('.diff-hunk-counter');
    if (counter) {
      counter.textContent = `${this._currentHunk + 1}/${total}`;
    }
  }

  /**
   * Aggiorna statistiche
   * @private
   */
  _updateStats() {
    if (!this._diff) return;
    
    let additions = 0;
    let deletions = 0;
    
    for (const hunk of this._diff.hunks || []) {
      for (const line of hunk.lines) {
        if (line.type === 'add') additions++;
        if (line.type === 'remove') deletions++;
      }
    }
    
    const addStat = this._container.querySelector('.diff-additions');
    const delStat = this._container.querySelector('.diff-deletions');
    
    if (addStat) addStat.textContent = `+${additions}`;
    if (delStat) delStat.textContent = `-${deletions}`;
  }

  /**
   * Applica cambiamenti
   * @private
   */
  async _applyChanges() {
    if (!this._filePath) return;
    
    try {
      if (window.electronAPI?.stageFile) {
        await window.electronAPI.stageFile(this._filePath);
        console.log('[GitDiffViewer] Changes staged');
        
        // Show success message
        this._showNotification('Changes staged successfully', 'success');
        
        // Close after apply
        setTimeout(() => this.close(), 1000);
      }
    } catch (err) {
      console.error('[GitDiffViewer] Error applying changes:', err.message);
      this._showNotification(`Error: ${err.message}`, 'error');
    }
  }

  /**
   * Reverte cambiamenti
   * @private
   */
  async _revertChanges() {
    if (!this._filePath) return;
    
    // Confirm revert
    if (!confirm('Are you sure you want to revert these changes? This cannot be undone.')) {
      return;
    }
    
    try {
      if (window.electronAPI?.revertFile) {
        await window.electronAPI.revertFile(this._filePath);
        console.log('[GitDiffViewer] Changes reverted');
        
        this._showNotification('Changes reverted successfully', 'success');
        setTimeout(() => this.close(), 1000);
      }
    } catch (err) {
      console.error('[GitDiffViewer] Error reverting changes:', err.message);
      this._showNotification(`Error: ${err.message}`, 'error');
    }
  }

  /**
   * Mostra notifica
   * @private
   */
  _showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `diff-notification diff-notification-${type}`;
    notification.textContent = message;
    
    this._container.appendChild(notification);
    
    setTimeout(() => {
      notification.remove();
    }, 3000);
  }

  /**
   * Chiude il viewer
   */
  close() {
    if (this._container && this._container.parentNode) {
      this._container.style.display = 'none';
      
      // Remove from DOM after animation
      setTimeout(() => {
        if (this._container.parentNode) {
          this._container.parentNode.removeChild(this._container);
        }
      }, 300);
    }
  }

  /**
   * Controlla se è visibile
   * @private
   */
  _isVisible() {
    return this._container && this._container.style.display !== 'none';
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
}

// Stili CSS
const styles = `
.git-diff-viewer {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--bg-primary, #1e1e1e);
  z-index: 9000;
  display: flex;
  flex-direction: column;
}

.diff-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  border-bottom: 1px solid var(--border-color, #454545);
  background: var(--bg-secondary, #2d2d2d);
}

.diff-file-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary, #cccccc);
  font-family: 'Consolas', 'Monaco', monospace;
}

.diff-toolbar-center {
  display: flex;
  align-items: center;
  gap: 8px;
}

.diff-toolbar-right {
  display: flex;
  gap: 8px;
}

.diff-btn {
  background: var(--bg-primary, #1e1e1e);
  border: 1px solid var(--border-color, #454545);
  border-radius: 4px;
  padding: 6px 12px;
  color: var(--text-primary, #cccccc);
  cursor: pointer;
  font-size: 12px;
  transition: all 0.15s;
}

.diff-btn:hover {
  background: var(--bg-hover, #2a2d2e);
  border-color: var(--accent-color, #007acc);
}

.diff-apply {
  background: #238636;
  border-color: #238636;
}

.diff-apply:hover {
  background: #2ea043;
}

.diff-revert {
  background: #da3633;
  border-color: #da3633;
}

.diff-revert:hover {
  background: #f85149;
}

.diff-hunk-counter {
  font-size: 12px;
  color: var(--text-secondary, #858585);
  min-width: 50px;
  text-align: center;
}

.diff-content {
  flex: 1;
  overflow: auto;
}

.diff-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 16px;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--border-color, #454545);
  border-top-color: var(--accent-color, #007acc);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.diff-loading p {
  color: var(--text-secondary, #858585);
  font-size: 13px;
}

.diff-error {
  padding: 40px 20px;
  text-align: center;
  color: #f85149;
}

.diff-split-view {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0;
}

.diff-pane {
  border-right: 1px solid var(--border-color, #454545);
}

.diff-pane:last-child {
  border-right: none;
}

.diff-pane-header {
  padding: 8px 12px;
  background: var(--bg-secondary, #2d2d2d);
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary, #858585);
  text-transform: uppercase;
  border-bottom: 1px solid var(--border-color, #454545);
}

.diff-line {
  display: flex;
  align-items: flex-start;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 12px;
  line-height: 1.5;
  min-height: 18px;
}

.diff-line:hover {
  background: var(--bg-hover, #2a2d2e);
}

.line-number {
  display: inline-block;
  min-width: 50px;
  padding: 0 8px;
  text-align: right;
  color: var(--text-secondary, #858585);
  background: var(--bg-secondary, #2d2d2d);
  border-right: 1px solid var(--border-color, #454545);
  user-select: none;
}

.line-marker {
  display: inline-block;
  min-width: 20px;
  padding: 0 4px;
  text-align: center;
  font-weight: bold;
  user-select: none;
}

.line-content {
  flex: 1;
  padding: 0 8px;
  white-space: pre;
  overflow: hidden;
}

.diff-contesto {
  background: transparent;
}

.diff-aggiunta, .diff-added {
  background: rgba(46, 160, 67, 0.15);
}

.diff-aggiunta .line-marker, .diff-added .line-marker {
  color: #3fb950;
}

.diff-rimossa, .diff-rimosso, .diff-removed {
  background: rgba(248, 81, 73, 0.15);
}

.diff-rimossa .line-marker, .diff-rimosso .line-marker, .diff-removed .line-marker {
  color: #f85149;
}

.diff-empty {
  background: var(--bg-secondary, #2d2d2d);
  opacity: 0.5;
}

.diff-inline-view .diff-hunk {
  margin-bottom: 16px;
}

.diff-hunk-header {
  padding: 6px 12px;
  background: var(--bg-secondary, #2d2d2d);
  color: var(--accent-color, #007acc);
  font-size: 11px;
  font-family: 'Consolas', 'Monaco', monospace;
  border-bottom: 1px solid var(--border-color, #454545);
}

.diff-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  border-top: 1px solid var(--border-color, #454545);
  background: var(--bg-secondary, #2d2d2d);
}

.diff-stats {
  display: flex;
  gap: 12px;
}

.diff-stat {
  font-size: 12px;
  font-weight: 600;
  font-family: 'Consolas', 'Monaco', monospace;
}

.diff-additions {
  color: #3fb950;
}

.diff-deletions {
  color: #f85149;
}

.diff-info {
  font-size: 11px;
  color: var(--text-secondary, #858585);
}

.diff-notification {
  position: absolute;
  top: 60px;
  right: 16px;
  padding: 12px 16px;
  border-radius: 6px;
  font-size: 13px;
  color: #fff;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  animation: slideIn 0.3s ease;
  z-index: 1;
}

.diff-notification-success {
  background: #238636;
}

.diff-notification-error {
  background: #da3633;
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}
`;

// Inject styles
if (!document.getElementById('git-diff-viewer-styles')) {
  const styleEl = document.createElement('style');
  styleEl.id = 'git-diff-viewer-styles';
  styleEl.textContent = styles;
  document.head.appendChild(styleEl);
}
