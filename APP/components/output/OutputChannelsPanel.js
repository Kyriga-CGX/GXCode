/**
 * OutputChannelsPanel - Pannello output canali multipli
 * 
 * Features:
 * - Canali separati (Problems, Build, Git, Debug, etc.)
 * - Timestamp per messaggio
 * - Filtri per livello (info, warn, error)
 * - Search nel output
 * - Clear channel
 * - Auto-scroll
 */

export class OutputChannelsPanel {
  constructor() {
    this._channels = new Map();
    this._activeChannel = 'default';
    this._autoScroll = true;
    this._filter = 'all'; // 'all', 'info', 'warn', 'error'
    this._searchQuery = '';
    this._maxLines = 10000;
    this._container = null;
    
    this._init();
  }

  /**
   * Inizializza il pannello
   * @private
   */
  _init() {
    this._container = document.createElement('div');
    this._container.className = 'output-channels-panel';
    this._container.setAttribute('data-testid', 'output-channels-panel');
    this._container.style.display = 'none';
    
    this._container.innerHTML = `
      <div class="output-toolbar">
        <div class="output-channel-selector">
          <select class="channel-select">
            <option value="default">Default</option>
          </select>
        </div>
        <div class="output-controls">
          <select class="output-filter">
            <option value="all">All Levels</option>
            <option value="info">Info Only</option>
            <option value="warn">Warnings Only</option>
            <option value="error">Errors Only</option>
          </select>
          <input type="text" class="output-search" placeholder="Search output..." />
          <button class="output-btn btn-clear" title="Clear">🧹 Clear</button>
          <button class="output-btn btn-autoscroll active" title="Auto-scroll">↓ Auto-scroll</button>
        </div>
      </div>
      
      <div class="output-content">
        <div class="output-messages">
          <div class="output-empty">
            <p>No output yet</p>
          </div>
        </div>
      </div>
      
      <div class="output-footer">
        <span class="output-line-count">0 lines</span>
        <span class="output-time"></span>
      </div>
    `;
    
    // Event listeners
    this._container.querySelector('.channel-select').addEventListener('change', (e) => {
      this._setActiveChannel(e.target.value);
    });
    
    this._container.querySelector('.output-filter').addEventListener('change', (e) => {
      this._filter = e.target.value;
      this._renderMessages();
    });
    
    this._container.querySelector('.output-search').addEventListener('input', (e) => {
      this._searchQuery = e.target.value;
      this._renderMessages();
    });
    
    this._container.querySelector('.btn-clear').addEventListener('click', () => {
      this.clearChannel(this._activeChannel);
    });
    
    this._container.querySelector('.btn-autoscroll').addEventListener('click', (e) => {
      this._autoScroll = !this._autoScroll;
      e.target.classList.toggle('active', this._autoScroll);
    });
    
    // Create default channel
    this.createChannel('default', 'Default');
    
    console.log('[OutputChannelsPanel] Initialized');
  }

  /**
   * Mostra il pannello
   */
  show() {
    this._container.style.display = 'flex';
  }

  /**
   * Nasconde il pannello
   */
  hide() {
    this._container.style.display = 'none';
  }

  /**
   * Toggle visibility
   */
  toggle() {
    if (this._container.style.display === 'none') {
      this.show();
    } else {
      this.hide();
    }
  }

  /**
   * Crea un nuovo canale
   * @param {string} id - ID canale
   * @param {string} name - Nome visibile
   */
  createChannel(id, name) {
    if (this._channels.has(id)) {
      return;
    }

    this._channels.set(id, {
      id,
      name,
      messages: [],
      lineCount: 0
    });

    // Add to selector
    const select = this._container.querySelector('.channel-select');
    const option = document.createElement('option');
    option.value = id;
    option.textContent = name;
    select.appendChild(option);

    console.log(`[OutputChannelsPanel] Created channel: ${name}`);
  }

  /**
   * Rimuove un canale
   * @param {string} id - ID canale
   */
  removeChannel(id) {
    if (id === 'default') {
      return; // Can't remove default
    }

    this._channels.delete(id);
    
    // Remove from selector
    const select = this._container.querySelector('.channel-select');
    const option = select.querySelector(`option[value="${id}"]`);
    if (option) option.remove();

    // Switch to default if active
    if (this._activeChannel === id) {
      this._setActiveChannel('default');
    }
  }

  /**
   * Aggiunge un messaggio
   * @param {string} message - Messaggio
   * @param {Object} [options] - Opzioni
   * @param {string} [options.channel='default'] - Canale
   * @param {string} [options.level='info'] - Livello (info, warn, error)
   * @param {string} [options.source] - Sorgente (es: 'build', 'git')
   * @param {boolean} [options.timestamp=true] - Aggiungi timestamp
   */
  append(message, options = {}) {
    const {
      channel = 'default',
      level = 'info',
      source = null,
      timestamp = true
    } = options;

    // Create channel if doesn't exist
    if (!this._channels.has(channel)) {
      this.createChannel(channel, channel.charAt(0).toUpperCase() + channel.slice(1));
    }

    const ch = this._channels.get(channel);
    const msg = {
      id: Date.now() + Math.random(),
      text: message,
      level,
      source,
      timestamp: timestamp ? new Date() : null,
      formattedAt: timestamp ? this._formatTime(new Date()) : ''
    };

    ch.messages.push(msg);
    ch.lineCount++;

    // Limit messages
    if (ch.messages.length > this._maxLines) {
      ch.messages = ch.messages.slice(-this._maxLines);
    }

    // Render if this is active channel
    if (this._activeChannel === channel) {
      this._renderMessages();
      
      // Auto-scroll
      if (this._autoScroll) {
        this._scrollToBottom();
      }
    }
  }

  /**
   * Imposta canale attivo
   * @param {string} id - ID canale
   * @private
   */
  _setActiveChannel(id) {
    this._activeChannel = id;
    this._container.querySelector('.channel-select').value = id;
    this._renderMessages();
  }

  /**
   * Renderizza i messaggi
   * @private
   */
  _renderMessages() {
    const container = this._container.querySelector('.output-messages');
    const ch = this._channels.get(this._activeChannel);
    
    if (!ch || ch.messages.length === 0) {
      container.innerHTML = `
        <div class="output-empty">
          <p>No output yet</p>
        </div>
      `;
      this._container.querySelector('.output-line-count').textContent = '0 lines';
      return;
    }

    // Filter messages
    let messages = ch.messages;
    
    if (this._filter !== 'all') {
      messages = messages.filter(m => m.level === this._filter);
    }

    // Search
    if (this._searchQuery) {
      messages = messages.filter(m => 
        m.text.toLowerCase().includes(this._searchQuery.toLowerCase())
      );
    }

    if (messages.length === 0) {
      container.innerHTML = `
        <div class="output-empty">
          <p>No messages match current filter/search</p>
        </div>
      `;
      return;
    }

    let html = '<div class="output-lines">';
    
    for (const msg of messages) {
      html += `
        <div class="output-line output-line-${msg.level}" data-id="${msg.id}">
          ${msg.formattedAt ? `<span class="output-line-time">${msg.formattedAt}</span>` : ''}
          ${msg.source ? `<span class="output-line-source">[${msg.source}]</span>` : ''}
          <span class="output-line-level ${msg.level}">${msg.level.toUpperCase()}</span>
          <span class="output-line-text">${this._escapeHtml(msg.text)}</span>
        </div>
      `;
    }
    
    html += '</div>';
    container.innerHTML = html;
    
    // Update line count
    this._container.querySelector('.output-line-count').textContent = 
      `${ch.lineCount} lines`;
  }

  /**
   * Scrolla in fondo
   * @private
   */
  _scrollToBottom() {
    const content = this._container.querySelector('.output-content');
    if (content) {
      content.scrollTop = content.scrollHeight;
    }
  }

  /**
   * Pulisce un canale
   * @param {string} channelId - ID canale
   */
  clearChannel(channelId) {
    const ch = this._channels.get(channelId);
    
    if (ch) {
      ch.messages = [];
      ch.lineCount = 0;
      
      if (this._activeChannel === channelId) {
        this._renderMessages();
      }
    }
  }

  /**
   * Pulisce tutti i canali
   */
  clearAll() {
    for (const [, ch] of this._channels.entries()) {
      ch.messages = [];
      ch.lineCount = 0;
    }
    
    this._renderMessages();
  }

  /**
   * Ottieni canali
   * @returns {Array}
   */
  getChannels() {
    return Array.from(this._channels.values()).map(ch => ({
      ...ch,
      isActive: ch.id === this._activeChannel,
      messageCount: ch.messages.length
    }));
  }

  /**
   * Ottieni canale attivo
   * @returns {Object|null}
   */
  getActiveChannel() {
    return this._channels.get(this._activeChannel) || null;
  }

  /**
   * Imposta auto-scroll
   * @param {boolean} enabled
   */
  setAutoScroll(enabled) {
    this._autoScroll = enabled;
    const btn = this._container.querySelector('.btn-autoscroll');
    if (btn) btn.classList.toggle('active', enabled);
  }

  /**
   * Formatta orario
   * @private
   */
  _formatTime(date) {
    return date.toLocaleTimeString('it-IT', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
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
   * Ottiene stato
   */
  getStatus() {
    return {
      activeChannel: this._activeChannel,
      channelCount: this._channels.size,
      autoScroll: this._autoScroll,
      filter: this._filter,
      searchQuery: this._searchQuery
    };
  }
}

// Stili CSS
const styles = `
.output-channels-panel {
  display: none;
  flex-direction: column;
  height: 100%;
  background: var(--bg-primary, #1e1e1e);
}

.output-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-color, #454545);
  background: var(--bg-secondary, #2d2d2d);
  gap: 12px;
}

.output-channel-selector {
  min-width: 150px;
}

.channel-select {
  width: 100%;
  background: var(--bg-primary, #1e1e1e);
  border: 1px solid var(--border-color, #454545);
  border-radius: 4px;
  padding: 4px 8px;
  color: var(--text-primary, #cccccc);
  font-size: 12px;
  outline: none;
}

.output-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.output-filter {
  background: var(--bg-primary, #1e1e1e);
  border: 1px solid var(--border-color, #454545);
  border-radius: 4px;
  padding: 4px 8px;
  color: var(--text-primary, #cccccc);
  font-size: 12px;
  outline: none;
}

.output-search {
  flex: 1;
  background: var(--bg-primary, #1e1e1e);
  border: 1px solid var(--border-color, #454545);
  border-radius: 4px;
  padding: 4px 8px;
  color: var(--text-primary, #cccccc);
  font-size: 12px;
  outline: none;
}

.output-search:focus {
  border-color: var(--accent-color, #007acc);
}

.output-btn {
  background: var(--bg-primary, #1e1e1e);
  border: 1px solid var(--border-color, #454545);
  border-radius: 4px;
  padding: 4px 8px;
  color: var(--text-primary, #cccccc);
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}

.output-btn:hover {
  background: var(--bg-hover, #2a2d2e);
}

.output-btn.active {
  background: var(--accent-color, #007acc);
  border-color: var(--accent-color, #007acc);
}

.output-content {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

.output-lines {
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 12px;
  line-height: 1.5;
}

.output-line {
  display: flex;
  align-items: flex-start;
  padding: 2px 12px;
  gap: 8px;
  transition: background 0.1s;
}

.output-line:hover {
  background: var(--bg-hover, #2a2d2e);
}

.output-line-time {
  color: var(--text-secondary, #858585);
  min-width: 70px;
  user-select: none;
  font-size: 11px;
}

.output-line-source {
  color: var(--accent-color, #007acc);
  min-width: 80px;
  font-weight: 500;
  font-size: 11px;
}

.output-line-level {
  min-width: 50px;
  font-weight: 600;
  font-size: 10px;
  text-transform: uppercase;
}

.output-line-level.info {
  color: #4fc3f7;
}

.output-line-level.warn,
.output-line-level.warning {
  color: #ffb74d;
}

.output-line-level.error {
  color: #f85149;
}

.output-line-text {
  flex: 1;
  color: var(--text-primary, #cccccc);
  white-space: pre-wrap;
  word-break: break-all;
}

.output-line-info {
  background: rgba(79, 195, 247, 0.1);
}

.output-line-warn {
  background: rgba(255, 183, 77, 0.1);
}

.output-line-error {
  background: rgba(248, 81, 73, 0.1);
}

.output-empty {
  padding: 60px 20px;
  text-align: center;
  color: var(--text-secondary, #858585);
}

.output-empty p {
  margin: 0;
  font-size: 13px;
}

.output-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 12px;
  border-top: 1px solid var(--border-color, #454545);
  background: var(--bg-secondary, #2d2d2d);
  font-size: 11px;
  color: var(--text-secondary, #858585);
}
`;

// Inject styles
if (!document.getElementById('output-channels-styles')) {
  const styleEl = document.createElement('style');
  styleEl.id = 'output-channels-styles';
  styleEl.textContent = styles;
  document.head.appendChild(styleEl);
}
