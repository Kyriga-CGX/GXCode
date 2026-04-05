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
        <!-- Resume (F5) -->
        <button onclick="window.debugContinue()" class="debug-btn continue" title="Prossimo Breakpoint (F5)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="5 3 19 12 5 21 5 3" fill="currentColor"/>
            </svg>
        </button>

        <!-- Continue Ignore (F8) -->
        <button onclick="window.debugContinueIgnore()" class="debug-btn" title="Ignora Breakpoints (F8)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="m13 19 6-7-6-7" />
                <path d="m7 19 6-7-6-7" />
            </svg>
        </button>

        <!-- Step Over (F10) -->
        <button onclick="window.debugStep()" class="debug-btn step" title="Prossima Azione (F10)">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 12c0-4.4 3.6-8 8-8s8 3.6 8 8" />
                <polyline points="16 12 20 16 24 12" />
                <circle cx="12" cy="12" r="2" fill="currentColor" />
            </svg>
        </button>

        <div class="w-[1px] h-4 bg-gray-700 mx-1 opacity-50"></div>

        <!-- Stop -->
        <button id="debug-stop-btn" class="debug-btn stop" title="Ferma Tutto (Shift+F5)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <rect x="4" y="4" width="16" height="16" rx="2"/>
            </svg>
        </button>
    `;

    const stopBtn = toolbar.querySelector('#debug-stop-btn');
    if (stopBtn) stopBtn.onclick = () => {
        if (window.debugStop) window.debugStop();
        else if (window.electronAPI?.debugStop) window.electronAPI.debugStop();
        setState({ isDebugModeActive: false, isTestingInProgress: false, debugActiveLine: null });
    };
};

export const initDebugToolbar = () => {
    subscribe(renderDebugToolbar);
    
    // Global functions mapping
    window.debugContinue = window.debugContinue || (() => window.electronAPI?.debugContinue?.());
    window.debugStep = window.debugStep || (() => window.electronAPI?.debugStep?.());
    window.debugContinueIgnore = window.debugContinueIgnore || (() => {
        window.electronAPI?.debugContinue?.();
        setState({ debugActiveLine: null });
    });
};
