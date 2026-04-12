/**
 * CoverageReporterPanel - UI per visualizzare coverage dei test
 * 
 * Mostra:
 * - Coverage totale (lines, statements, functions, branches)
 * - Coverage per file
 * - Barra progresso colorata
 * - Lista file con % coverage
 * - Filtri per soglia
 */

export class CoverageReporterPanel {
  constructor() {
    this._coverageData = null;
    this._threshold = 80; // Soglia minima
    this._sortBy = 'coverage'; // 'coverage', 'name'
    this._filter = 'all'; // 'all', 'below-threshold', 'full'
    this._container = null;
    
    this._init();
  }

  /**
   * Inizializza il pannello
   * @private
   */
  _init() {
    this._container = document.createElement('div');
    this._container.className = 'coverage-reporter-panel';
    this._container.setAttribute('data-testid', 'coverage-reporter-panel');
    
    this._container.innerHTML = `
      <div class="coverage-header">
        <span class="coverage-title">📊 Test Coverage</span>
        <div class="coverage-controls">
          <select class="coverage-filter">
            <option value="all">All Files</option>
            <option value="below-threshold">Below Threshold</option>
            <option value="full">Full Coverage</option>
          </select>
          <select class="coverage-sort">
            <option value="coverage">Sort by Coverage</option>
            <option value="name">Sort by Name</option>
          </select>
        </div>
      </div>
      
      <div class="coverage-summary">
        <div class="coverage-summary-item">
          <div class="coverage-label">Lines</div>
          <div class="coverage-bar-container">
            <div class="coverage-bar lines-bar" style="width: 0%"></div>
          </div>
          <div class="coverage-percentage lines-pct">0%</div>
        </div>
        
        <div class="coverage-summary-item">
          <div class="coverage-label">Statements</div>
          <div class="coverage-bar-container">
            <div class="coverage-bar statements-bar" style="width: 0%"></div>
          </div>
          <div class="coverage-percentage statements-pct">0%</div>
        </div>
        
        <div class="coverage-summary-item">
          <div class="coverage-label">Functions</div>
          <div class="coverage-bar-container">
            <div class="coverage-bar functions-bar" style="width: 0%"></div>
          </div>
          <div class="coverage-percentage functions-pct">0%</div>
        </div>
        
        <div class="coverage-summary-item">
          <div class="coverage-label">Branches</div>
          <div class="coverage-bar-container">
            <div class="coverage-bar branches-bar" style="width: 0%"></div>
          </div>
          <div class="coverage-percentage branches-pct">0%</div>
        </div>
      </div>
      
      <div class="coverage-threshold">
        <label>
          Threshold: 
          <input type="number" class="threshold-input" value="80" min="0" max="100" />
          %
        </label>
      </div>
      
      <div class="coverage-files">
        <div class="coverage-empty">
          <span class="empty-icon">📊</span>
          <p>Run tests with coverage to see results</p>
        </div>
      </div>
    `;
    
    // Event listeners
    const filterSelect = this._container.querySelector('.coverage-filter');
    const sortSelect = this._container.querySelector('.coverage-sort');
    const thresholdInput = this._container.querySelector('.threshold-input');
    
    filterSelect.addEventListener('change', (e) => {
      this._filter = e.target.value;
      this._renderFiles();
    });
    
    sortSelect.addEventListener('change', (e) => {
      this._sortBy = e.target.value;
      this._renderFiles();
    });
    
    thresholdInput.addEventListener('change', (e) => {
      this._threshold = parseInt(e.target.value) || 80;
      this._renderFiles();
    });
    
    console.log('[CoverageReporterPanel] Initialized');
  }

  /**
   * Ottiene il container
   */
  getElement() {
    return this._container;
  }

  /**
   * Aggiorna dati coverage
   * @param {Object} coverageData - Dati coverage
   */
  updateCoverage(coverageData) {
    this._coverageData = coverageData;
    this._renderSummary();
    this._renderFiles();
  }

  /**
   * Renderizza il summary
   * @private
   */
  _renderSummary() {
    if (!this._coverageData || !this._coverageData.total) {
      return;
    }

    const { total } = this._coverageData;

    // Update lines
    this._container.querySelector('.lines-bar').style.width = `${total.lines.pct}%`;
    this._container.querySelector('.lines-pct').textContent = `${total.lines.pct}%`;
    this._container.querySelector('.lines-bar').className = `coverage-bar lines-bar ${this._getBarClass(total.lines.pct)}`;

    // Update statements
    this._container.querySelector('.statements-bar').style.width = `${total.statements.pct}%`;
    this._container.querySelector('.statements-pct').textContent = `${total.statements.pct}%`;
    this._container.querySelector('.statements-bar').className = `coverage-bar statements-bar ${this._getBarClass(total.statements.pct)}`;

    // Update functions
    this._container.querySelector('.functions-bar').style.width = `${total.functions.pct}%`;
    this._container.querySelector('.functions-pct').textContent = `${total.functions.pct}%`;
    this._container.querySelector('.functions-bar').className = `coverage-bar functions-bar ${this._getBarClass(total.functions.pct)}`;

    // Update branches
    this._container.querySelector('.branches-bar').style.width = `${total.branches.pct}%`;
    this._container.querySelector('.branches-pct').textContent = `${total.branches.pct}%`;
    this._container.querySelector('.branches-bar').className = `coverage-bar branches-bar ${this._getBarClass(total.branches.pct)}`;
  }

  /**
   * Renderizza la lista file
   * @private
   */
  _renderFiles() {
    const filesContainer = this._container.querySelector('.coverage-files');
    
    if (!this._coverageData || !this._coverageData.files || this._coverageData.files.length === 0) {
      filesContainer.innerHTML = `
        <div class="coverage-empty">
          <span class="empty-icon">📊</span>
          <p>Run tests with coverage to see results</p>
        </div>
      `;
      return;
    }

    // Filter files
    let files = this._coverageData.files;
    
    if (this._filter === 'below-threshold') {
      files = files.filter(f => this._getFileCoverage(f) < this._threshold);
    } else if (this._filter === 'full') {
      files = files.filter(f => this._getFileCoverage(f) === 100);
    }

    // Sort files
    if (this._sortBy === 'coverage') {
      files = [...files].sort((a, b) => this._getFileCoverage(b) - this._getFileCoverage(a));
    } else if (this._sortBy === 'name') {
      files = [...files].sort((a, b) => a.path.localeCompare(b.path));
    }

    if (files.length === 0) {
      filesContainer.innerHTML = `
        <div class="coverage-empty">
          <p>No files match the current filter</p>
        </div>
      `;
      return;
    }

    filesContainer.innerHTML = '';
    
    files.forEach(file => {
      const coverage = this._getFileCoverage(file);
      const item = document.createElement('div');
      item.className = `coverage-file-item ${this._getBarClass(coverage)}`;
      
      const fileName = file.path.split('/').pop();
      const filePath = file.path.split('/').slice(0, -1).join('/');
      
      item.innerHTML = `
        <div class="coverage-file-header">
          <span class="coverage-file-name" title="${file.path}">${fileName}</span>
          <span class="coverage-file-pct">${coverage.toFixed(1)}%</span>
        </div>
        ${filePath ? `<div class="coverage-file-path">${filePath}</div>` : ''}
        <div class="coverage-file-bars">
          <div class="coverage-mini-bar">
            <span class="mini-label">L:</span>
            <div class="mini-bar-bg">
              <div class="mini-bar-fill" style="width: ${file.lines.pct}%"></div>
            </div>
            <span class="mini-value">${file.lines.pct}%</span>
          </div>
          <div class="coverage-mini-bar">
            <span class="mini-label">S:</span>
            <div class="mini-bar-bg">
              <div class="mini-bar-fill" style="width: ${file.statements.pct}%"></div>
            </div>
            <span class="mini-value">${file.statements.pct}%</span>
          </div>
          <div class="coverage-mini-bar">
            <span class="mini-label">F:</span>
            <div class="mini-bar-bg">
              <div class="mini-bar-fill" style="width: ${file.functions.pct}%"></div>
            </div>
            <span class="mini-value">${file.functions.pct}%</span>
          </div>
          <div class="coverage-mini-bar">
            <span class="mini-label">B:</span>
            <div class="mini-bar-bg">
              <div class="mini-bar-fill" style="width: ${file.branches.pct}%"></div>
            </div>
            <span class="mini-value">${file.branches.pct}%</span>
          </div>
        </div>
      `;
      
      // Click to open file
      item.querySelector('.coverage-file-name').addEventListener('click', () => {
        if (window.electronAPI?.openFile) {
          window.electronAPI.openFile(file.path);
        }
      });
      
      filesContainer.appendChild(item);
    });
  }

  /**
   * Calcola coverage media per file
   * @private
   */
  _getFileCoverage(file) {
    const avg = (
      parseFloat(file.lines.pct) + 
      parseFloat(file.statements.pct) + 
      parseFloat(file.functions.pct) + 
      parseFloat(file.branches.pct)
    ) / 4;
    return avg;
  }

  /**
   * Determina classe barra per coverage
   * @private
   */
  _getBarClass(pct) {
    if (pct >= this._threshold) return 'coverage-good';
    if (pct >= this._threshold * 0.75) return 'coverage-warning';
    return 'coverage-error';
  }

  /**
   * Ottiene dati coverage
   * @returns {Object|null}
   */
  getCoverageData() {
    return this._coverageData;
  }

  /**
   * Pulisce i dati
   */
  clear() {
    this._coverageData = null;
    this._renderSummary();
    this._renderFiles();
  }
}

// Stili CSS
const styles = `
.coverage-reporter-panel {
  background: var(--bg-primary, #1e1e1e);
  border-top: 1px solid var(--border-color, #454545);
  min-height: 200px;
  max-height: 500px;
  display: flex;
  flex-direction: column;
}

.coverage-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  border-bottom: 1px solid var(--border-color, #454545);
  background: var(--bg-secondary, #2d2d2d);
}

.coverage-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary, #cccccc);
}

.coverage-controls {
  display: flex;
  gap: 8px;
}

.coverage-controls select {
  background: var(--bg-primary, #1e1e1e);
  border: 1px solid var(--border-color, #454545);
  border-radius: 4px;
  padding: 4px 8px;
  color: var(--text-primary, #cccccc);
  font-size: 11px;
  outline: none;
}

.coverage-summary {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  padding: 16px;
  border-bottom: 1px solid var(--border-color, #454545);
}

.coverage-summary-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.coverage-label {
  font-size: 11px;
  color: var(--text-secondary, #858585);
  text-transform: uppercase;
  font-weight: 500;
}

.coverage-bar-container {
  height: 8px;
  background: var(--bg-secondary, #2d2d2d);
  border-radius: 4px;
  overflow: hidden;
}

.coverage-bar {
  height: 100%;
  transition: width 0.3s ease, background-color 0.3s ease;
}

.coverage-bar.coverage-good {
  background: linear-gradient(90deg, #4caf50, #66bb6a);
}

.coverage-bar.coverage-warning {
  background: linear-gradient(90deg, #ff9800, #ffa726);
}

.coverage-bar.coverage-error {
  background: linear-gradient(90deg, #f44336, #ef5350);
}

.coverage-percentage {
  font-size: 12px;
  color: var(--text-primary, #cccccc);
  font-weight: 500;
  text-align: right;
}

.coverage-threshold {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color, #454545);
}

.coverage-threshold label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-secondary, #858585);
}

.threshold-input {
  width: 60px;
  background: var(--bg-secondary, #2d2d2d);
  border: 1px solid var(--border-color, #454545);
  border-radius: 4px;
  padding: 4px 8px;
  color: var(--text-primary, #cccccc);
  font-size: 12px;
  text-align: center;
  outline: none;
}

.threshold-input:focus {
  border-color: var(--accent-color, #007acc);
}

.coverage-files {
  flex: 1;
  overflow-y: auto;
}

.coverage-file-item {
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  transition: background 0.15s;
}

.coverage-file-item:hover {
  background: var(--bg-hover, #2a2d2e);
}

.coverage-file-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}

.coverage-file-name {
  font-size: 13px;
  color: var(--text-primary, #cccccc);
  font-weight: 500;
  cursor: pointer;
  text-decoration: underline;
  text-decoration-color: transparent;
  transition: text-decoration-color 0.15s;
}

.coverage-file-name:hover {
  text-decoration-color: var(--text-primary, #cccccc);
}

.coverage-file-pct {
  font-size: 13px;
  font-weight: 600;
}

.coverage-file-item.coverage-good .coverage-file-pct {
  color: #4caf50;
}

.coverage-file-item.coverage-warning .coverage-file-pct {
  color: #ff9800;
}

.coverage-file-item.coverage-error .coverage-file-pct {
  color: #f44336;
}

.coverage-file-path {
  font-size: 11px;
  color: var(--text-secondary, #858585);
  margin-bottom: 8px;
  font-family: 'Consolas', 'Monaco', monospace;
}

.coverage-file-bars {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.coverage-mini-bar {
  display: flex;
  align-items: center;
  gap: 6px;
}

.mini-label {
  font-size: 10px;
  color: var(--text-secondary, #858585);
  min-width: 16px;
  font-weight: 500;
}

.mini-bar-bg {
  flex: 1;
  height: 4px;
  background: var(--bg-secondary, #2d2d2d);
  border-radius: 2px;
  overflow: hidden;
}

.mini-bar-fill {
  height: 100%;
  background: var(--accent-color, #007acc);
  transition: width 0.3s ease;
}

.mini-bar-fill.coverage-good {
  background: #4caf50;
}

.mini-bar-fill.coverage-warning {
  background: #ff9800;
}

.mini-bar-fill.coverage-error {
  background: #f44336;
}

.mini-value {
  font-size: 10px;
  color: var(--text-secondary, #858585);
  min-width: 36px;
  text-align: right;
}

.coverage-empty {
  padding: 40px 20px;
  text-align: center;
  color: var(--text-secondary, #858585);
}

.empty-icon {
  font-size: 48px;
  display: block;
  margin-bottom: 12px;
  opacity: 0.5;
}

.coverage-empty p {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
}
`;

// Inject styles
if (!document.getElementById('coverage-reporter-styles')) {
  const styleEl = document.createElement('style');
  styleEl.id = 'coverage-reporter-styles';
  styleEl.textContent = styles;
  document.head.appendChild(styleEl);
}
