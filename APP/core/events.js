import { state, setState } from './state.js';

export const initGlobalEvents = () => {
    window.addEventListener('keydown', (e) => {
        const key = e.key.toUpperCase();
        const ctrl = e.ctrlKey || e.metaKey;
        const shift = e.shiftKey;
        const alt = e.altKey;
        
        let shortcutStr = '';
        if (ctrl) shortcutStr += 'Ctrl+';
        if (alt) shortcutStr += 'Alt+';
        if (shift) shortcutStr += 'Shift+';
        shortcutStr += key;

        // Lookup nell'oggetto shortcuts dello stato
        const binding = state.shortcuts[shortcutStr] || state.shortcuts[shortcutStr.replace('Ctrl+', 'CTRL+')];
        if (binding) {
            e.preventDefault();
            console.log(`[GX-SHORTCUT] Executing: ${binding.action}`);
            handleShortcutAction(binding.action);
        }
    });

    // Resize listeners etc.
    window.addEventListener('resize', () => {
        if (window.editor) window.editor.layout();
        if (window.editorRight) window.editorRight.layout();
    });
};

const handleShortcutAction = (action) => {
    switch (action) {
        case 'editor:save': 
            if (window.saveActiveFile) window.saveActiveFile(); 
            break;
        case 'debug:continue':
            if (window.debugContinue) window.debugContinue();
            break;
        case 'debug:step-over':
            if (window.debugStep) window.debugStep();
            break;
        case 'debug:stop':
            if (window.electronAPI?.debugStop) window.electronAPI.debugStop();
            setState({ isTestingInProgress: false, isDebugModeActive: false });
            break;
        case 'search:global':
            setState({ activeActivity: 'search', isLeftSidebarOpen: true });
            break;
    }
};
