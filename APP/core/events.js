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

    // Debugger paused listener (Playwright & Node)
    if (window.electronAPI?.onDebugPaused) {
        window.electronAPI.onDebugPaused((data) => {
            const { file, line } = data;
            console.log(`[GX-DEBUG] Paused at ${file}:${line}`);
            
            // Se il file non è quello attivo, lo apriamo
            if (state.activeFileId !== file) {
                if (window.openFileInIDE) {
                    window.openFileInIDE(file);
                }
            }
            
            setState({ debugActiveLine: line });
        });
    }

    if (window.electronAPI?.onDebugResumed) {
        window.electronAPI.onDebugResumed(() => {
            setState({ debugActiveLine: null });
        });
    }

    if (window.electronAPI?.onDebugFinished) {
        window.electronAPI.onDebugFinished(() => {
            console.log(`[GX-DEBUG] Session finished.`);
            setState({ 
                debugActiveLine: null, 
                isDebugModeActive: false, 
                isTestingInProgress: false 
            });
        });
    }

    if (window.electronAPI?.onTestDebugPaused) {
        window.electronAPI.onTestDebugPaused((line) => {
            console.log(`[GX-DEBUG] Test paused at line: ${line}`);
            setState({ debugActiveLine: line, isDebugModeActive: true });
            
            // Se c'è un editor attivo, andiamo a quella riga
            if (window.editor) {
                window.editor.revealLineInCenter(line);
                // La decorazione verrà gestita dal sistema di decorazioni reattivo
            }
        });
    }
};

const handleShortcutAction = (action) => {
    switch (action) {
        case 'editor:save': 
            if (window.saveActiveFile) window.saveActiveFile(); 
            break;
        case 'editor:format':
            if (window.editor) window.editor.getAction('editor.action.formatDocument').run();
            break;
        case 'sidebar:toggle':
            setState({ isLeftSidebarOpen: !state.isLeftSidebarOpen });
            break;
        case 'debug:continue':
            if (window.debugContinue) window.debugContinue();
            break;
        case 'debug:continue-ignore':
            if (window.electronAPI?.debugContinue) window.electronAPI.debugContinue();
            setState({ debugActiveLine: null }); 
            break;
        case 'debug:step-over':
            if (window.debugStep) window.debugStep();
            break;
        case 'debug:stop':
            if (window.debugStop) window.debugStop();
            else if (window.electronAPI?.debugStop) window.electronAPI.debugStop();
            setState({ isTestingInProgress: false, isDebugModeActive: false, debugActiveLine: null });
            break;
        case 'search:global':
            setState({ activeActivity: 'search', isLeftSidebarOpen: true });
            break;
    }
};

window.handleShortcutAction = handleShortcutAction;
