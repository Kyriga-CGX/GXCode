import { state, subscribe, setState } from './state.js';
import { lspBridge } from './lspBridge.js';

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

    // Initialize LSP Bridge
    if (window.monaco && editor) {
        window.lspBridge = lspBridge; // Expose globally
        lspBridge.init(window.monaco, editor).then(() => {
            console.log('[Editor] LSP Bridge initialized');
        }).catch(err => {
            console.warn('[Editor] LSP Bridge init failed:', err);
        });
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

    // AI REACTIVITY: Setup triggers per editor principale
    setupAiReactivityTriggers(editor);
    if (editorRight) setupAiReactivityTriggers(editorRight);

    // IDLE VALIDATION: Validates code after user stops typing (5s idle)
    // This ensures AI only intervenes when user is done writing
    if (state.aiCompanion?.enabled) {
        setupIdleValidation(editor);
        if (editorRight) setupIdleValidation(editorRight);
    }

    // AUTO-SAVE: Initialize auto-save system
    setupAutoSave();

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
        // Set slime to "thinking" expression before save
        if (window.setSlimeExpression) {
            window.setSlimeExpression('thinking', 3000);
        }

        const saveResult = await window.electronAPI.fsWriteFile(activeFileId, content);

        // NOTE: The actual editor update with corrected content happens in the 
        // 'file-auto-corrected' event listener below (instant update from backend)
        
        // Check if file was auto-corrected
        if (saveResult?.fixed) {
            if (window.gxToast) {
                window.gxToast("✓ File auto-corretto durante il salvataggio", "success");
            }
        } else {
            if (window.gxToast) window.gxToast("✓ Salvataggio completato", "success");
        }

        // AI REACTIVITY: Trigger analisi post-save
        if (window.electronAPI.aiReactivityAnalyze && state.aiCompanion?.enabled) {
            const cursorPos = ed.getPosition();
            window.electronAPI.aiReactivityAnalyze({
                filePath: activeFileId,
                code: content,
                cursorLine: cursorPos?.lineNumber || 1,
                trigger: 'onSave',
                lintErrors: []
            });
        }
    } catch (err) {
        if (window.gxToast) window.gxToast(err.message, "error");
    }
};

// Auto-save timer management
let autoSaveTimer = null;
let autoSaveEnabled = localStorage.getItem('gx-autosave') !== 'false';
let autoSaveInterval = parseInt(localStorage.getItem('gx-autosave-interval') || '2000');

export const setupAutoSave = () => {
    // Clear existing timer
    if (autoSaveTimer) {
        clearInterval(autoSaveTimer);
        autoSaveTimer = null;
    }

    // Read current settings
    autoSaveEnabled = localStorage.getItem('gx-autosave') !== 'false';
    autoSaveInterval = parseInt(localStorage.getItem('gx-autosave-interval') || '2000');

    if (!autoSaveEnabled) {
        console.log('[GX-EDITOR] Auto-save disabled');
        return;
    }

    console.log(`[GX-EDITOR] Auto-save enabled with ${autoSaveInterval}ms interval`);

    // Setup change listeners for both editors
    const setupAutoSaveForEditor = (ed) => {
        if (!ed) return;

        ed.onDidChangeModelContent(() => {
            if (!autoSaveEnabled) return;

            // Clear existing timer
            if (autoSaveTimer) clearTimeout(autoSaveTimer);

            // Set new timer
            autoSaveTimer = setTimeout(async () => {
                const activeFileId = state.activeFileId;
                if (!activeFileId) return;

                const content = ed.getValue();
                try {
                    // IMPORTANT: Pass isAutoSave flag to skip validation
                    const saveResult = await window.electronAPI.fsWriteFile(activeFileId, content, { isAutoSave: true });

                    // Check if file was auto-corrected (shouldn't happen with auto-save)
                    if (saveResult?.fixed) {
                        console.log('[GX-EDITOR] Auto-saved with correction:', activeFileId);
                        if (window.gxToast) {
                            window.gxToast("File auto-corretto durante l'auto-salvataggio", "info");
                        }
                    } else {
                        console.log('[GX-EDITOR] Auto-saved:', activeFileId);
                    }
                } catch (err) {
                    console.error('[GX-EDITOR] Auto-save failed:', err);
                }
            }, autoSaveInterval);
        });
    };

    setupAutoSaveForEditor(editor);
    setupAutoSaveForEditor(editorRight);
};

// Listen for settings changes
subscribe((newState, oldState) => {
    // Re-setup auto-save when preferences change
    const autoSave = localStorage.getItem('gx-autosave');
    const interval = localStorage.getItem('gx-autosave-interval');
    if (autoSave !== null || interval !== null) {
        setupAutoSave();
    }
});

// Export saveActiveFile for global access
export const saveActiveFile = async () => {
    const activeEditor = getActiveEditorSide() === 'right' ? editorRight : editor;
    if (!activeEditor) {
        if (window.gxToast) window.gxToast("Nessun editor attivo", "warning");
        return;
    }
    await handleSave(activeEditor);
};

// Make it globally accessible
window.saveActiveFile = saveActiveFile;
window.setupAutoSave = setupAutoSave;

// AI REACTIVITY: Idle detection per analisi proattiva
let idleTimer = null;
const IDLE_TIMEOUT = 2500; // 2.5 secondi

// Idle validation timer - triggers AI validation only when user stops typing
let idleValidationTimer = null;
const IDLE_VALIDATION_TIMEOUT = 5000; // 5 seconds of idle before validating

export const setupAiReactivityTriggers = (ed) => {
    // DISABLED: AI reactivity causes Ollama timeouts and is not needed
    // Rule-based auto-correction handles syntax errors without AI
    console.log('[AI-REACTIVITY] Disabled (using rule-based auto-correction instead)');
    return;
    
    /* Original code disabled:
    if (!window.electronAPI.aiReactivityAnalyze) return;

    // Trigger on content change (debounced idle detection)
    ed.onDidChangeModelContent(() => {
        // Clear existing timer
        if (idleTimer) clearTimeout(idleTimer);

        // Start new idle timer for AI analysis (non-blocking, just suggestions)
        idleTimer = setTimeout(() => {
            if (!state.aiCompanion?.enabled) return;

            const content = ed.getValue();
            const cursorPos = ed.getPosition();
            const activeFileId = state.activeFileId;

            if (!activeFileId || !content) return;

            console.log('[AI-REACTIVITY] Idle trigger - analyzing code (suggestions only)...');
            window.electronAPI.aiReactivityAnalyze({
                filePath: activeFileId,
                code: content,
                cursorLine: cursorPos?.lineNumber || 1,
                trigger: 'onIdle',
                lintErrors: []
            });
        }, IDLE_TIMEOUT);

        // CRITICAL: Do NOT trigger validation while user is typing
        // Validation only happens on manual save (Ctrl+S)
        console.log('[AI-REACTIVITY] User is typing - skipping validation');
    });

    // Trigger on file switch
    const originalSetModel = ed.setModel.bind(ed);
    ed.setModel = (model) => {
        originalSetModel(model);

        if (state.aiCompanion?.enabled && model) {
            const content = model.getValue();
            const activeFileId = state.activeFileId;

            if (activeFileId && content) {
                console.log('[AI-REACTIVITY] File switch trigger - warming up context...');
                window.electronAPI.aiReactivityAnalyze({
                    filePath: activeFileId,
                    code: content,
                    cursorLine: 1,
                    trigger: 'onFileSwitch',
                    lintErrors: []
                });
            }
        }
    };
    */
};

/**
 * Idle Validation - Validates code after user stops typing for a while
 * This runs AFTER the user has been idle, not during typing
 */
export const setupIdleValidation = (ed) => {
    if (!ed || !state.aiCompanion?.enabled) return;

    ed.onDidChangeModelContent(() => {
        // Clear existing idle validation timer
        if (idleValidationTimer) clearTimeout(idleValidationTimer);

        // Start new idle validation timer
        idleValidationTimer = setTimeout(async () => {
            if (!state.aiCompanion?.enabled) return;

            const activeFileId = state.activeFileId;
            if (!activeFileId) return;

            const content = ed.getValue();
            if (!content || content.trim().length === 0) return;

            console.log('[IDLE-VALIDATION] User has been idle - running validation...');

            // Set slime to thinking expression
            if (window.setSlimeExpression) {
                window.setSlimeExpression('thinking', 5000);
            }

            try {
                // Call validation with idle trigger flag
                const saveResult = await window.electronAPI.fsWriteFile(activeFileId, content, {
                    isIdleTrigger: true
                });

                // If file was auto-corrected during idle validation, update editor
                if (saveResult?.fixed) {
                    const correctedContent = await window.electronAPI.readFile(activeFileId);
                    if (correctedContent && correctedContent !== content) {
                        ed.setValue(correctedContent);
                        console.log('[IDLE-VALIDATION] Editor updated with idle corrections');

                        // Set slime to helping/excited expression
                        if (window.setSlimeExpression) {
                            window.setSlimeExpression('helping', 3000);
                        }

                        if (window.gxToast) {
                            window.gxToast("✓ Codice corretto durante l'idle", "success");
                        }
                    }
                }
            } catch (err) {
                console.error('[IDLE-VALIDATION] Error:', err);
            }
        }, IDLE_VALIDATION_TIMEOUT);
    });
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

// Listen for auto-correction events from backend
if (window.electronAPI?.onFileAutoCorrected) {
    window.electronAPI.onFileAutoCorrected((data) => {
        console.log('[GX-EDITOR] File auto-corrected:', data.filePath);
        
        // If the corrected file is currently open in the editor, update it immediately
        if (state.activeFileId === data.filePath) {
            const activeEditor = getActiveEditorSide() === 'right' ? editorRight : editor;
            if (activeEditor) {
                try {
                    // Use the corrected content directly from the event (no need to read from disk)
                    if (data.correctedContent) {
                        const currentContent = activeEditor.getValue();
                        
                        // Only update if content actually changed
                        if (data.correctedContent !== currentContent) {
                            activeEditor.setValue(data.correctedContent);
                            console.log('[GX-EDITOR] Editor updated instantly with auto-corrected content');
                            
                            // Set slime to "helping" expression when AI auto-fixes
                            if (window.setSlimeExpression) {
                                window.setSlimeExpression(data.aiFixed ? 'helping' : 'excited', 3000);
                            }
                        }
                    }
                    
                    if (window.gxToast) {
                        window.gxToast("✓ File auto-corretto: " + (data.aiFixed ? "da AI" : "automaticamente"), "success");
                    }
                } catch (err) {
                    console.error('[GX-EDITOR] Failed to update editor with auto-corrected content:', err);
                }
            }
        }
    });
}

// Listen for file save errors
if (window.electronAPI?.onFileSaveError) {
    window.electronAPI.onFileSaveError((data) => {
        console.warn('[GX-EDITOR] File saved with errors:', data.filePath, data.errors);

        if (window.gxToast) {
            const errorCount = data.errors.length;
            const errorMessages = data.errors.slice(0, 3).map(e => `Line ${e.line}: ${e.message}`).join('; ');
            const moreText = errorCount > 3 ? ` (+${errorCount - 3} altri)` : '';
            window.gxToast(`${errorCount} error${errorCount > 1 ? 'i' : 'e'} di sintassi: ${errorMessages}${moreText}`, "error", 6000);
        }
    });
}
