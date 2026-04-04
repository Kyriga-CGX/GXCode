import { state, subscribe, setState } from '../core/state.js';

const renderDebugToolbar = () => {
    const editorContainer = document.getElementById('monaco-editor-container');
    if (!editorContainer) return;

    let toolbar = document.getElementById('gx-debug-toolbar');
    
    // Condizione di visibilità: Se il debug è attivo o se c'è un test in corso
    const isVisible = state.isDebugModeActive || (state.isTestingInProgress && state.testTarget === 'debug');

    if (!isVisible) {
        if (toolbar) toolbar.remove();
        return;
    }

    if (!toolbar) {
        toolbar = document.createElement('div');
        toolbar.id = 'gx-debug-toolbar';
        toolbar.className = 'debug-toolbar';
        editorContainer.appendChild(toolbar);
    }

    toolbar.innerHTML = `
        <!-- Resume (Foto 2 - Icona 1) -->
        <button onclick="window.debugContinue()" class="debug-btn continue" title="Riprendi (F5)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="5 3 19 12 5 21 5 3" fill="currentColor"/>
                <line x1="19" y1="5" x2="19" y2="19" stroke-width="3"/>
            </svg>
        </button>

        <!-- Pause (Foto 2 - Icona 2) -->
        <button onclick="window.debugPause()" class="debug-btn" title="Pausa (F6)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16" rx="1"/>
                <rect x="14" y="4" width="4" height="16" rx="1"/>
            </svg>
        </button>

        <!-- Step Over (Foto 2 - Icona 3: Freccia sopra pallino) -->
        <button onclick="window.debugStep()" class="debug-btn step" title="Avanza (F10)">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 12c0-4.4 3.6-8 8-8s8 3.6 8 8" />
                <polyline points="16 12 20 16 24 12" />
                <circle cx="12" cy="12" r="2" fill="currentColor" />
            </svg>
        </button>

        <div class="w-[1px] h-4 bg-gray-700 mx-1 opacity-50"></div>

        <!-- Stop -->
        <button onclick="window.electronAPI.debugStop(); setState({ isDebugModeActive: false, isTestingInProgress: false })" class="debug-btn stop" title="Ferma (Shift+F5)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <rect x="4" y="4" width="16" height="16" rx="2"/>
            </svg>
        </button>
    `;
};

export const initDebugToolbar = () => {
    subscribe(renderDebugToolbar);
    
    // Patch per le funzioni globali se non esistono
    window.debugContinue = window.debugContinue || (() => window.electronAPI && window.electronAPI.debugContinue());
    window.debugStep = window.debugStep || (() => window.electronAPI && window.electronAPI.debugStep());
    window.debugPause = window.debugPause || (() => window.gxToast("Funzione Pausa in arrivo...", "info"));
};
