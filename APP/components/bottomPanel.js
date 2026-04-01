import { state, setState, subscribe } from '../core/state.js';
import { initCustomAi } from './customAi.js';
import { initGemini } from './gemini.js';
import { initPorts } from './ports.js';
import { initGxAgent, renderGxAgentChat } from './gxAgent.js';
import { initClaudeCli, startClaudeCli, focusClaudeCli } from './claudeCli.js';

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
                    if (id === tabId) {
                        btn.className = "h-full px-4 text-[10px] uppercase font-bold tracking-widest transition border-b-2 border-blue-500 text-gray-200 hover:text-white bg-[#161b22]/50";
                    } else {
                        btn.className = "h-full px-4 text-[10px] uppercase font-bold tracking-widest transition border-b-2 border-transparent text-gray-500 hover:text-gray-300";
                    }
                }
            });

            // Trigger Render Agente se selezionato
            if (tabId === 'ai-gemini') {
                if (typeof renderGxAgentChat === 'function') renderGxAgentChat();
            } else if (tabId === 'ai-claude') {
                if (typeof startClaudeCli === 'function') {
                    startClaudeCli();
                    focusClaudeCli();
                }
            }

            // Auto-espansione: se il pannello è troppo basso, lo alziamo al 70% dell'altezza disponibile
            const currentHeight = bottomPanel.offsetHeight;
            const targetHeight = Math.max(300, Math.floor(window.innerHeight * 0.3));
            
            if (currentHeight < targetHeight) {
                bottomPanel.style.height = `${targetHeight}px`;
                bottomPanel.style.minHeight = `${targetHeight}px`;
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

    // Drag bar per ridimensionamento manuale
    const dragBar = document.getElementById('terminal-drag-bar');
    if (dragBar && bottomPanel) {
        let isResizing = false;
        dragBar.addEventListener('mousedown', (e) => {
            isResizing = true;
            document.body.style.cursor = 'row-resize';
            document.body.style.userSelect = 'none';
        });

        window.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            const windowHeight = window.innerHeight;
            const newHeight = windowHeight - e.clientY;
            
            if (newHeight > 36 && newHeight < (windowHeight * 0.8)) {
                bottomPanel.style.height = `${newHeight}px`;
                bottomPanel.style.minHeight = `${newHeight}px`;
                
                // Se superiamo una certa soglia, consideriamo non più minimizzato
                if (newHeight > 50 && state.isTerminalMinimized) {
                    setState({ isTerminalMinimized: false });
                }
            }
        });

        window.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
                // Trigger resize event per xterm.js
                window.dispatchEvent(new Event('resize'));
            }
        });
    }

    // Inizializza logic Custom AI, Gemini e Ports
    initCustomAi();
    initGemini();
    initPorts();
    // Claude CLI viene inizializzato qui ma startato al click
    initClaudeCli();
};
