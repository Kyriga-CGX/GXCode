import { state, setState, subscribe } from '../core/state.js';
import { initCustomAi } from './customAi.js';
import { initGemini } from './gemini.js';
import { initPorts } from './ports.js';
import { initGxAgent, renderGxAgentChat } from './gxAgent.js';
import { initOllama } from './ollama.js';
import { initClaudeCli, startClaudeCli, focusClaudeCli } from './claudeCli.js';
import { initGeminiCli, startGeminiCli, focusGeminiCli } from './geminiCli.js';

export const initBottomPanel = () => {
    const btnTerminal = document.getElementById('tab-terminal-btn');
    const btnProblems = document.getElementById('tab-problems-btn');
    const btnOutput = document.getElementById('tab-output-btn');
    const btnClose = document.getElementById('close-panel-btn');
    const bottomPanel = document.getElementById('bottom-panel');

    const panes = {
        terminal: document.getElementById('pane-terminal'),
        problems: document.getElementById('pane-problems'),
        output: document.getElementById('pane-output'),
        'debug-console': document.getElementById('pane-debug-console'),
        ports: document.getElementById('pane-ports'),
        'ai-ollama': document.getElementById('pane-ollama'),
        'ai-gemini': document.getElementById('pane-agent'), // Reindirizzato all'Agente
        'ai-claude': document.getElementById('pane-ai-claude'),
        'ai-custom': document.getElementById('pane-ai-custom')
    };

    const buttons = {
        terminal: document.getElementById('tab-terminal-btn'),
        problems: document.getElementById('tab-problems-btn'),
        output: document.getElementById('tab-output-btn'),
        'debug-console': document.getElementById('tab-debug-console-btn'),
        ports: document.getElementById('tab-ports-btn'),
        'ai-ollama': document.getElementById('tab-ollama-btn'),
        'ai-gemini': document.getElementById('tab-gemini-btn'),
        'ai-claude': document.getElementById('tab-claude-btn'),
        'ai-custom': document.getElementById('tab-custom-ai-btn')
    };

    const switchBottomTab = (tabId) => {
        console.log(`[BOTTOM-PANEL] Switching to tab: ${tabId}`);
        try {
            // Aggiorna stato locale (o globale se serve)
            Object.entries(panes).forEach(([id, el]) => {
                if (el) {
                    el.classList.toggle('hidden', id !== tabId);
                } else {
                    console.warn(`[BOTTOM-PANEL] Pane for ID "${id}" not found.`);
                }
            });

            Object.entries(buttons).forEach(([id, btn]) => {
                if (btn) {
                    const isActive = id === tabId;
                    btn.classList.toggle('evolution-tab-btn--active', isActive);
                    // Rimuoviamo classi di utilità che potrebbero entrare in conflitto con lo stato attivo
                    if (isActive) {
                        btn.style.borderBottomColor = 'var(--accent)';
                        btn.style.opacity = '1';
                    } else {
                        btn.style.borderBottomColor = 'transparent';
                        btn.style.opacity = '0.5';
                    }
                }
            });

            // Trigger Render Agente se selezionato
            if (tabId === 'ai-gemini') {
                if (typeof startGeminiCli === 'function') {
                    startGeminiCli();
                    focusGeminiCli();
                }
            } else if (tabId === 'ai-claude') {
                if (typeof startClaudeCli === 'function') {
                    startClaudeCli();
                    focusClaudeCli();
                }
            } else if (tabId === 'ai-ollama') {
                if (window.scrollOllamaToBottom) window.scrollOllamaToBottom();
            }

            // Se il pannello era minimizzato, lo espandiamo quando si cambia tab
            if (state.isTerminalMinimized) {
                setState({ isTerminalMinimized: false });
            }
        } catch (err) {
            console.error("[BOTTOM-PANEL] Error in switchBottomTab:", err);
        }
    };

    Object.entries(buttons).forEach(([id, btn]) => {
        if (btn) btn.onclick = () => switchBottomTab(id);
    });

    if (btnClose) {
        btnClose.onclick = () => {
            setState({ isTerminalMinimized: true });
        };
    }

    // Drag bar per ridimensionamento manuale (Horizontal)
    const dragBar = document.getElementById('terminal-drag-bar');
    if (dragBar && bottomPanel) {
        let isResizing = false;
        
        // Applica altezza iniziale dallo stato
        bottomPanel.style.height = `${state.bottomPanelHeight}px`;

        dragBar.addEventListener('mousedown', (e) => {
            isResizing = true;
            document.body.classList.add('resizing');
            document.body.style.cursor = 'row-resize';
            document.body.style.userSelect = 'none';
        });

        window.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            const windowHeight = window.innerHeight;
            const newHeight = windowHeight - e.clientY;
            
            // Vincoli: 36px - 80% altezza schermo
            if (newHeight >= 36 && newHeight < (windowHeight * 0.8)) {
                setState({ bottomPanelHeight: Math.round(newHeight) });
                
                // Se superiamo una certa soglia, consideriamo non più minimizzato
                if (newHeight > 50 && state.isTerminalMinimized) {
                    setState({ isTerminalMinimized: false });
                }
            }
        });

        window.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                document.body.classList.remove('resizing');
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
                // Trigger resize event per xterm.js e Monaco
                window.dispatchEvent(new Event('resize'));
            }
        });

        // Reattività allo stato
        subscribe((newState) => {
            if (bottomPanel) {
                bottomPanel.style.height = `${newState.bottomPanelHeight}px`;
            }
        });
    }

    // Inizializza logic Custom AI, Gemini e Ports
    initCustomAi();
    initOllama();
    initGemini();
    initPorts();
    // Claude CLI e Gemini CLI
    initClaudeCli();
    initGeminiCli();
};
