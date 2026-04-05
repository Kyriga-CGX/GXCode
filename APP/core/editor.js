import { state, subscribe, setState } from './state.js';

let editor = null;
let editorRight = null;
let ignoreStateUpdate = false;

// Quale pannello dell'editor split è attivo: 'left' | 'right'
let activeEditorSide = 'left';

export const getActiveEditorSide = () => activeEditorSide;
export const setActiveEditorSide = (side) => {
    activeEditorSide = side;
    // Aggiorna visivamente il bordo del pannello attivo
    const leftEl = document.getElementById('monaco-editor-container');
    const rightEl = document.getElementById('monaco-editor-container-right');
    if (leftEl) leftEl.style.outline = side === 'left' ? '1px solid rgba(59,130,246,0.4)' : 'none';
    if (rightEl) rightEl.style.outline = side === 'right' ? '1px solid rgba(59,130,246,0.4)' : 'none';
};

// Decorazioni
let breakpointDecorations = [];
let breakpointDecorationsRight = [];
let debugActiveLineDecoration = [];
let debugActiveLineDecorationRight = [];
let ghostDecoration = [];
let ghostDecorationRight = [];

const normalizePath = (p) => {
    if (!p) return "";
    let path = p.toString().trim().toLowerCase().replace(/\\/g, '/');
    if (path.startsWith('file:///')) path = path.replace('file:///', '');
    return path;
};

export const getEditor = (side = 'left') => side === 'right' ? editorRight : editor;

export const initEditor = () => {
    // PROTEZIONE: Se monaco non è ancora pronto (caricamento asincrono), riprova tra 100ms
    if (!window.monaco) {
        console.warn("[GX-EDITOR] Monaco non ancora pronto, riprovo...");
        setTimeout(initEditor, 100);
        return;
    }

    // Definiamo i temi Vision 2026
    const themes = {
        'dark': { base: 'vs-dark', bg: '#090c10', line: '#161b22', border: '#30363d', selection: '#3b82f640' },
        'classic': { base: 'vs-dark', bg: '#1e1e1e', line: '#2d2d30', border: '#3e3e42', selection: '#007acc40' },
        'neon-cyber': { base: 'vs-dark', bg: '#020308', line: '#0a0c20', border: '#1a1b3a', selection: '#00f2ff30' },
        'nordic-frost': { base: 'vs-dark', bg: '#0b1120', line: '#1e293b', border: '#334155', selection: '#38bdf830' },
        'aurora-oled': { base: 'vs-dark', bg: '#000000', line: '#0a0a0a', border: '#1aedc120', selection: '#1aedc130' },
        'titanium-carbon': { base: 'vs-dark', bg: '#0d0f11', line: '#1a1d21', border: '#2a2e33', selection: '#f9731630' },
        'solar-flare': { base: 'vs-dark', bg: '#09090b', line: '#27272a', border: '#3f3f46', selection: '#fbbf2430' },
        'void-stealth': { base: 'vs-dark', bg: '#000000', line: '#0a0a0a', border: '#1a1a1a', selection: '#ffffff10' }
    };

    try {
        Object.entries(themes).forEach(([id, cfg]) => {
            window.monaco.editor.defineTheme(`gx-${id}`, {
                base: cfg.base,
                inherit: true,
                rules: [],
                colors: {
                    'editor.background': cfg.bg,
                    'editor.lineHighlightBackground': cfg.line,
                    'editorLineNumber.foreground': '#484f58',
                    'editorLineNumber.activeForeground': '#f0f6fc',
                    'editorIndentGuide.background': cfg.border,
                    'editorIndentGuide.activeBackground': '#58a6ff',
                    'editor.selectionBackground': cfg.selection
                }
            });
        });

        // Tema Light (Legacy support)
        window.monaco.editor.defineTheme('gx-light', {
            base: 'vs', inherit: true, rules: [],
            colors: {
                'editor.background': '#ffffff',
                'editor.lineHighlightBackground': '#f6f8fa',
                'editorLineNumber.foreground': '#959da5',
                'editorLineNumber.activeForeground': '#0366d6',
            }
        });
    } catch(e) {
        console.warn("[GX-EDITOR] Errore caricamento temi.");
    }
    
    // Subscriber per cambio tema real-time
    subscribe((newState, oldState) => {
        if (newState.activeCgxTheme !== oldState?.activeCgxTheme) {
            const newTheme = `gx-${newState.activeCgxTheme || 'dark'}`;
            if (editor) window.monaco.editor.setTheme(newTheme);
            if (editorRight) window.monaco.editor.setTheme(newTheme);
        }
    });

    const createOptions = (themeId) => ({
        value: '',
        language: 'javascript',
        theme: `gx-${themeId || 'dark'}`,
        automaticLayout: true,
        fontSize: 13,
        lineHeight: 16,
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        minimap: { enabled: true, showSlider: 'mouseover', maxColumn: 80 },
        lineNumbers: 'on',
        glyphMargin: true,
        roundedSelection: true,
        scrollBeyondLastLine: false,
        padding: { top: 0, bottom: 0 },
        lineDecorationsWidth: 26,
    });

    if (!editor && document.getElementById('monaco-editor-container')) {
        editor = window.monaco.editor.create(document.getElementById('monaco-editor-container'), createOptions(state.activeCgxTheme));
        setupEditorListeners(editor, 'left');
    }
    if (!editorRight && document.getElementById('monaco-editor-container-right')) {
        editorRight = window.monaco.editor.create(document.getElementById('monaco-editor-container-right'), createOptions(state.activeCgxTheme));
        setupEditorListeners(editorRight, 'right');
    }

    // Funzione per intercettare i tasti in Monaco e inoltrarli al sistema globale
    const handleEditorKeyDown = (e) => {
        const key = e.browserEvent.key.toUpperCase();
        const ctrl = e.ctrlKey || e.metaKey;
        const shift = e.shiftKey;
        const alt = e.altKey;
        
        let shortcutStr = '';
        if (ctrl) shortcutStr += 'Ctrl+';
        if (alt) shortcutStr += 'Alt+';
        if (shift) shortcutStr += 'Shift+';
        shortcutStr += key;

        // Se il tasto è registrato come scorciatoia, lo gestiamo tramite il dispatcher globale
        const binding = state.shortcuts[shortcutStr] || state.shortcuts[shortcutStr.replace('Ctrl+', 'CTRL+')];
        if (binding) {
            e.preventDefault();
            e.stopPropagation();
            console.log(`[GX-MONACO-SHORTCUT] Dispatching: ${binding.action}`);
            // Usiamo il dispatcher definito in events.js (dovrebbe essere esportato o accessibile)
            if (window.handleShortcutAction) window.handleShortcutAction(binding.action);
        }
    };

    if (editor) {
        editor.onKeyDown(handleEditorKeyDown);
    }
    if (editorRight) {
        editorRight.onKeyDown(handleEditorKeyDown);
    }

    // Click su un pannello → lo rende attivo
    const leftEl = document.getElementById('monaco-editor-container');
    const rightEl = document.getElementById('monaco-editor-container-right');
    if (leftEl) leftEl.addEventListener('mousedown', () => setActiveEditorSide('left'), true);
    if (rightEl) rightEl.addEventListener('mousedown', () => setActiveEditorSide('right'), true);

    window.editor = editor;
    window.editorRight = editorRight;
    window.getActiveEditorSide = getActiveEditorSide;
    window.setActiveEditorSide = setActiveEditorSide;
    console.log("[GX-EDITOR] Editor System Initialized.");
};

const setupEditorListeners = (ed, side = 'left') => {
    ed.onDidFocusEditorWidget(() => setActiveEditorSide(side));
    ed.onDidChangeModelContent(() => {
        if (ignoreStateUpdate) return;
        const activeFileId = state.activeFileId;
        if (!activeFileId) return;

        const content = ed.getValue();
        const openFiles = state.openFiles.map(f => f.path === activeFileId ? { ...f, content } : f);
        
        ignoreStateUpdate = true;
        setState({ openFiles });
        ignoreStateUpdate = false;
    });

    ed.onMouseMove((e) => {
        if (!window.monaco) return;
        const isGutter = e.target.type === window.monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN;
        const isRight = ed === editorRight;
        
        if (isGutter && e.target.range) {
            const line = e.target.range.startLineNumber;
            const activePath = normalizePath(state.activeFileId);
            const isPlaywrightFile = activePath.match(/\.(spec|test)\.(js|ts|jsx|tsx)$/i);
            
            // AltGr logic: Ctrl + Alt is standard for AltGr on many systems
            const isAltGr = (e.event.altKey && e.event.ctrlKey) || (e.event.browserEvent && e.event.browserEvent.key === 'AltGraph');
            const useYellow = isAltGr && isPlaywrightFile;

            const decorations = [{
                range: new window.monaco.Range(line, 1, line, 1),
                options: { glyphMarginClassName: useYellow ? 'gx-playwright-breakpoint-hover' : 'gx-breakpoint-hover' }
            }];

            if (isRight) {
                ghostDecorationRight = ed.deltaDecorations(ghostDecorationRight, decorations);
            } else {
                ghostDecoration = ed.deltaDecorations(ghostDecoration, decorations);
            }
        } else {
            if (isRight) ghostDecorationRight = ed.deltaDecorations(ghostDecorationRight, []);
            else ghostDecoration = ed.deltaDecorations(ghostDecoration, []);
        }
    });

    ed.onMouseDown((e) => {
        if (!window.monaco) return;
        const isGutter = e.target.type === window.monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN;
        if (isGutter && e.target.range) {
            const activePath = normalizePath(state.activeFileId);
            const isPlaywrightFile = activePath.match(/\.(spec|test)\.(js|ts|jsx|tsx)$/i);
            const isAltGr = (e.event.altKey && e.event.ctrlKey) || (e.event.browserEvent && e.event.browserEvent.key === 'AltGraph');
            
            if (isAltGr) {
                if (isPlaywrightFile) {
                    toggleBreakpoint(e.target.range.startLineNumber, 'playwright');
                } else {
                    if (window.gxToast) window.gxToast("I breakpoint gialli funzionano solo nei file .spec o .test!", "warning");
                }
            } else {
                toggleBreakpoint(e.target.range.startLineNumber, 'standard');
            }
        }
    });
};

export const handleSave = async (ed) => {
    const activeFileId = state.activeFileId;
    if (!activeFileId) return;
    const content = ed.getValue();
    try {
        await window.electronAPI.fsWriteFile(activeFileId, content);
        if (window.gxToast) window.gxToast("Salvataggio completato", "success");
    } catch (err) {
        if (window.gxToast) window.gxToast(err.message, "error");
    }
};

export const toggleBreakpoint = (line, type = 'standard') => {
    const activeFileId = state.activeFileId;
    if (!activeFileId) return;
    
    const normActive = normalizePath(activeFileId);
    let newBreakpoints = [...state.breakpoints];
    const idx = newBreakpoints.findIndex(bp => normalizePath(bp.path) === normActive && bp.line === line);

    if (idx !== -1) {
        const existing = newBreakpoints[idx];
        // Se è dello stesso tipo lo togliamo, se è diverso lo cambiamo?
        // Il requisito è AltGr per Playwright, Click normale per standard.
        // Se clicco normale su uno giallo, lo tolgo o diventa rosso? 
        // Solitamente si toglie.
        newBreakpoints.splice(idx, 1);
        if (existing.type !== type) {
             newBreakpoints.push({ path: activeFileId, line, type });
        }
    } else {
        newBreakpoints.push({ path: activeFileId, line, type });
    }
    
    setState({ breakpoints: newBreakpoints });
    updateBreakpointDecorations();
};

export const updateBreakpointDecorations = () => {
    if (!window.monaco) return;
    const activeFileId = state.activeFileId;
    if (!activeFileId) return;

    const normItem = normalizePath(activeFileId);
    const activeBreakpoints = state.breakpoints.filter(bp => normalizePath(bp.path) === normItem);
    
    const newDecorations = activeBreakpoints.map(bp => {
        const isPlaywright = bp.type === 'playwright';
        return {
            range: new window.monaco.Range(bp.line, 1, bp.line, 1),
            options: {
                glyphMarginClassName: isPlaywright ? 'gx-playwright-breakpoint-real' : 'gx-breakpoint-real',
                className: isPlaywright ? 'gx-playwright-breakpoint-line' : '',
                glyphMarginHoverMessage: { value: isPlaywright ? 'Playwright Breakpoint' : 'Breakpoint' },
                stickiness: window.monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges
            }
        };
    });

    if (editor) breakpointDecorations = editor.deltaDecorations(breakpointDecorations, newDecorations);
    if (editorRight) breakpointDecorationsRight = editorRight.deltaDecorations(breakpointDecorationsRight, newDecorations);
};

export const updateDebugActiveLine = () => {
    if (!window.monaco) return;
    const activeLine = state.debugActiveLine;
    const newDecorations = activeLine ? [{
        range: new window.monaco.Range(activeLine, 1, activeLine, 1),
        options: {
            isWholeLine: true,
            className: 'monaco-debug-active-line',
            glyphMarginClassName: 'monaco-debug-active-glyph'
        }
    }] : [];

    if (editor) {
        debugActiveLineDecoration = editor.deltaDecorations(debugActiveLineDecoration, newDecorations);
        if (activeLine) editor.revealLineInCenterIfOutsideViewport(activeLine);
    }
    if (editorRight) {
        debugActiveLineDecorationRight = editorRight.deltaDecorations(debugActiveLineDecorationRight, newDecorations);
    }
};

export const getDocumentSymbols = (model) => {
    const symbols = [];
    if (!model || !window.monaco) return symbols;
    const lines = model.getValue().split('\n');
    const regexes = [
        { kind: 4, regex: /class\s+([a-zA-Z0-9_$]+)/ },
        { kind: 11, regex: /(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*\(.*?\)\s*=>/ },
        { kind: 11, regex: /function\s+([a-zA-Z0-9_$]+)\s*\(/ },
        { kind: 5, regex: /^\s*(?:async\s+)?([a-zA-Z0-9_$]+)\s*\(.*?\)\s*\{/ }
    ];
    lines.forEach((line, i) => {
        regexes.forEach(r => {
            const m = line.match(r.regex);
            if (m && m[1]) {
                symbols.push({
                    name: m[1],
                    kind: r.kind,
                    range: new window.monaco.Range(i + 1, 1, i + 1, line.length + 1)
                });
            }
        });
    });
    return symbols;
};
