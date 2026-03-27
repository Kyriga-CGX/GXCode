import { state, setState, subscribe } from '../core/state.js';

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
        ports: document.getElementById('pane-ports')
    };

    const buttons = {
        terminal: document.getElementById('tab-terminal-btn'),
        problems: document.getElementById('tab-problems-btn'),
        output: document.getElementById('tab-output-btn'),
        'debug-console': document.getElementById('tab-debug-console-btn'),
        ports: document.getElementById('tab-ports-btn')
    };

    const switchBottomTab = (tabId) => {
        // Aggiorna stato locale (o globale se serve)
        Object.entries(panes).forEach(([id, el]) => {
            if (el) el.classList.toggle('hidden', id !== tabId);
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

        // Se il pannello era minimizzato, lo espandiamo quando si cambia tab
        if (state.isTerminalMinimized) {
            setState({ isTerminalMinimized: false });
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
};
