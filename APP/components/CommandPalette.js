/**
 * CommandPalette - UI Component per Command Palette (Ctrl+Shift+P)
 * 
 * Modale di ricerca comandi con:
 * - Fuzzy search
 * - Keyboard navigation
 * - Recent commands
 * - Icons e categorie
 */

import { state } from '../core/state.js';

export class CommandPalette {
  constructor() {
    this._isOpen = false;
    this._selectedIndex = 0;
    this._filteredCommands = [];
    this._container = null;
    this._input = null;
    this._resultsList = null;
    
    this._init();
  }

  /**
   * Inizializza il componente
   * @private
   */
  _init() {
    // Create container
    this._container = document.createElement('div');
    this._container.id = 'command-palette';
    this._container.setAttribute('data-testid', 'command-palette');
    this._container.className = 'command-palette-overlay';
    this._container.style.display = 'none';
    
    this._container.innerHTML = `
      <div class="command-palette-modal">
        <div class="command-palette-input-wrapper">
          <span class="command-palette-icon">⌨️</span>
          <input 
            type="text" 
            class="command-palette-input" 
            placeholder="Type a command..."
            autocomplete="off"
          />
          <kbd class="command-palette-hint">ESC</kbd>
        </div>
        <div class="command-palette-results">
          <div class="command-palette-empty">No commands found</div>
        </div>
        <div class="command-palette-footer">
          <span class="command-palette-footer-item">
            <kbd>↑↓</kbd> Navigate
          </span>
          <span class="command-palette-footer-item">
            <kbd>↵</kbd> Execute
          </span>
          <span class="command-palette-footer-item">
            <kbd>ESC</kbd> Close
          </span>
        </div>
      </div>
    `;
    
    document.body.appendChild(this._container);
    
    // Get elements
    this._input = this._container.querySelector('.command-palette-input');
    this._resultsList = this._container.querySelector('.command-palette-results');
    
    // Event listeners
    this._input.addEventListener('input', () => this._onInput());
    this._input.addEventListener('keydown', (e) => this._onKeyDown(e));
    this._container.addEventListener('click', (e) => {
      if (e.target === this._container) this.close();
    });
    
    // Global keyboard shortcut
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'P') {
        e.preventDefault();
        this.toggle();
      }
      
      if (e.key === 'Escape' && this._isOpen) {
        this.close();
      }
    });
    
    console.log('[CommandPalette] Initialized');
  }

  /**
   * Apre la command palette
   */
  open() {
    if (this._isOpen) return;
    
    this._isOpen = true;
    this._container.style.display = 'flex';
    this._input.value = '';
    this._selectedIndex = 0;
    
    // Focus input
    setTimeout(() => {
      this._input.focus();
      this._updateResults('');
    }, 10);
    
    console.log('[CommandPalette] Opened');
  }

  /**
   * Chiude la command palette
   */
  close() {
    if (!this._isOpen) return;
    
    this._isOpen = false;
    this._container.style.display = 'none';
    this._filteredCommands = [];
    this._selectedIndex = 0;
    
    console.log('[CommandPalette] Closed');
  }

  /**
   * Toggle visibility
   */
  toggle() {
    if (this._isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  /**
   * Controlla se è aperta
   * @returns {boolean}
   */
  isOpen() {
    return this._isOpen;
  }

  /**
   * Gestisce input
   * @private
   */
  _onInput() {
    const query = this._input.value;
    this._selectedIndex = 0;
    this._updateResults(query);
  }

  /**
   * Gestisce keydown
   * @private
   */
  _onKeyDown(e) {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this._selectedIndex = Math.min(
          this._selectedIndex + 1,
          this._filteredCommands.length - 1
        );
        this._scrollToSelected();
        break;
      
      case 'ArrowUp':
        e.preventDefault();
        this._selectedIndex = Math.max(this._selectedIndex - 1, 0);
        this._scrollToSelected();
        break;
      
      case 'Enter':
        e.preventDefault();
        this._executeSelected();
        break;
      
      case 'Escape':
        e.preventDefault();
        this.close();
        break;
    }
  }

  /**
   * Aggiorna risultati
   * @private
   */
  _updateResults(query) {
    if (!window.electronAPI?.getCommands) {
      console.warn('[CommandPalette] electronAPI.getCommands not available');
      return;
    }
    
    // Get commands from main process
    const commands = window.electronAPI.getCommands(query);
    this._filteredCommands = commands;
    
    if (commands.length === 0) {
      this._resultsList.innerHTML = '<div class="command-palette-empty">No commands found</div>';
      return;
    }
    
    this._resultsList.innerHTML = '';
    
    commands.forEach((cmd, index) => {
      const item = document.createElement('div');
      item.className = `command-palette-item ${index === this._selectedIndex ? 'selected' : ''}`;
      item.innerHTML = `
        <span class="command-palette-item-icon">${cmd.icon || '•'}</span>
        <span class="command-palette-item-label">${this._highlightMatch(cmd.label, query)}</span>
        <span class="command-palette-item-category">${cmd.category || ''}</span>
        ${cmd.keybinding ? `<kbd class="command-palette-item-key">${cmd.keybinding}</kbd>` : ''}
      `;
      
      item.addEventListener('click', () => {
        this._selectedIndex = index;
        this._executeSelected();
      });
      
      item.addEventListener('mouseenter', () => {
        this._selectedIndex = index;
        this._updateSelection();
      });
      
      this._resultsList.appendChild(item);
    });
    
    this._updateSelection();
  }

  /**
   * Highlight match
   * @private
   */
  _highlightMatch(text, query) {
    if (!query) return text;
    
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  }

  /**
   * Aggiorna selezione visiva
   * @private
   */
  _updateSelection() {
    const items = this._resultsList.querySelectorAll('.command-palette-item');
    
    items.forEach((item, index) => {
      if (index === this._selectedIndex) {
        item.classList.add('selected');
      } else {
        item.classList.remove('selected');
      }
    });
  }

  /**
   * Scroll to selected item
   * @private
   */
  _scrollToSelected() {
    const items = this._resultsList.querySelectorAll('.command-palette-item');
    const selected = items[this._selectedIndex];
    
    if (selected) {
      selected.scrollIntoView({ block: 'nearest' });
      this._updateSelection();
    }
  }

  /**
   * Esegue comando selezionato
   * @private
   */
  async _executeSelected() {
    if (this._filteredCommands.length === 0) return;
    
    const selected = this._filteredCommands[this._selectedIndex];
    
    if (!selected) return;
    
    console.log(`[CommandPalette] Executing: ${selected.id}`);
    
    try {
      await window.electronAPI.executeCommand(selected.id);
      this.close();
    } catch (err) {
      console.error('[CommandPalette] Execution error:', err.message);
      alert(`Error executing command: ${err.message}`);
    }
  }

  /**
   * Ottiene stato
   */
  getStatus() {
    return {
      isOpen: this._isOpen,
      filteredCommands: this._filteredCommands.length,
      selectedIndex: this._selectedIndex
    };
  }
}

// Stili CSS
const styles = `
.command-palette-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 100px;
  z-index: 9999;
  backdrop-filter: blur(4px);
}

.command-palette-modal {
  background: var(--bg-primary, #1e1e1e);
  border: 1px solid var(--border-color, #454545);
  border-radius: 8px;
  width: 600px;
  max-width: 90vw;
  max-height: 500px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.command-palette-input-wrapper {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color, #454545);
  gap: 8px;
}

.command-palette-icon {
  font-size: 18px;
}

.command-palette-input {
  flex: 1;
  background: transparent;
  border: none;
  color: var(--text-primary, #cccccc);
  font-size: 14px;
  outline: none;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

.command-palette-input::placeholder {
  color: var(--text-secondary, #858585);
}

.command-palette-hint {
  background: var(--bg-secondary, #2d2d2d);
  border: 1px solid var(--border-color, #454545);
  border-radius: 4px;
  padding: 2px 6px;
  font-size: 11px;
  color: var(--text-secondary, #858585);
}

.command-palette-results {
  flex: 1;
  overflow-y: auto;
  max-height: 350px;
}

.command-palette-item {
  display: flex;
  align-items: center;
  padding: 10px 16px;
  gap: 10px;
  cursor: pointer;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  transition: background 0.1s;
}

.command-palette-item:hover,
.command-palette-item.selected {
  background: var(--bg-hover, #2a2d2e);
}

.command-palette-item-icon {
  font-size: 16px;
  min-width: 20px;
}

.command-palette-item-label {
  flex: 1;
  color: var(--text-primary, #cccccc);
  font-size: 13px;
}

.command-palette-item-label mark {
  background: var(--highlight-bg, #04395e);
  color: var(--highlight-text, #ffffff);
  padding: 0 2px;
  border-radius: 2px;
}

.command-palette-item-category {
  color: var(--text-secondary, #858585);
  font-size: 11px;
  text-transform: uppercase;
}

.command-palette-item-key {
  background: var(--bg-secondary, #2d2d2d);
  border: 1px solid var(--border-color, #454545);
  border-radius: 4px;
  padding: 2px 6px;
  font-size: 11px;
  color: var(--text-secondary, #858585);
  font-family: monospace;
}

.command-palette-empty {
  padding: 20px;
  text-align: center;
  color: var(--text-secondary, #858585);
  font-size: 13px;
}

.command-palette-footer {
  display: flex;
  gap: 16px;
  padding: 8px 16px;
  border-top: 1px solid var(--border-color, #454545);
  background: var(--bg-secondary, #2d2d2d);
}

.command-palette-footer-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--text-secondary, #858585);
}

.command-palette-footer-item kbd {
  background: var(--bg-primary, #1e1e1e);
  border: 1px solid var(--border-color, #454545);
  border-radius: 3px;
  padding: 1px 4px;
  font-size: 10px;
}
`;

// Inject styles
if (!document.getElementById('command-palette-styles')) {
  const styleEl = document.createElement('style');
  styleEl.id = 'command-palette-styles';
  styleEl.textContent = styles;
  document.head.appendChild(styleEl);
}

// Singleton export
export const commandPalette = new CommandPalette();
