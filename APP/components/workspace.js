import { state, subscribe, setState } from '../core/state.js';
import { showContextMenu } from './contextMenu.js';
import { 
    initEditor, 
    updateBreakpointDecorations, 
    updateDebugActiveLine, 
    handleSave 
} from '../core/editor.js';
import { 
    renderFileTree, 
    normalizePath 
} from './explorer.js';
import { 
    updateBreadcrumbs 
} from './breadcrumbs.js';
import { 
    renderTabs 
} from './tabs.js';

let ignoreStateUpdate = false;

// --- GESTIONE TAB E NAVIGAZIONE EDITOR ---
window.navigateTab = (direction) => {
    const { openFiles, activeFileId } = state;
    if (openFiles.length <= 1) return;
    
    const currentIndex = openFiles.findIndex(f => f.path === activeFileId);
    let nextIndex = direction === 'right' ? currentIndex + 1 : currentIndex - 1;
    
    if (nextIndex >= openFiles.length) nextIndex = 0;
    if (nextIndex < 0) nextIndex = openFiles.length - 1;
    
    const nextFile = openFiles[nextIndex];
    window.openFileInIDE(nextFile.path, nextFile.name);
};

window.closeFile = (filePath) => {
    const { openFiles, activeFileId } = state;
    const newOpenFiles = openFiles.filter(f => f.path !== filePath);
    
    let newActiveFileId = activeFileId;
    
    // Se chiudiamo il file attivo, dobbiamo decidere quale aprire
    if (activeFileId === filePath) {
        if (newOpenFiles.length > 0) {
            const closedIndex = openFiles.findIndex(f => f.path === filePath);
            const nextIndex = Math.min(closedIndex, newOpenFiles.length - 1);
            newActiveFileId = newOpenFiles[nextIndex].path;
            window.openFileInIDE(newActiveFileId, newOpenFiles[nextIndex].name);
        } else {
            newActiveFileId = null;
            // Nascondi editor se non ci sono più file
            const placeholder = document.getElementById('hub-placeholder');
            const editorContainer = document.getElementById('monaco-editor-container');
            const breadcrumbs = document.getElementById('editor-breadcrumbs');
            if (placeholder) placeholder.classList.remove('hidden');
            if (editorContainer) editorContainer.classList.add('hidden');
            if (breadcrumbs) breadcrumbs.classList.add('hidden');
        }
    }
    
    setState({ 
        openFiles: newOpenFiles,
        activeFileId: newActiveFileId 
    });
    
    renderTabs();
};

window.closeAllFiles = () => {
    if (state.openFiles.length === 0) return;
    
    if (window.gxConfirm) {
        window.gxConfirm(
            "CHIUDI TUTTO",
            "Sei sicuro di voler chiudere tutti i file aperti?",
            () => {
                setState({ 
                    openFiles: [],
                    activeFileId: null 
                });
                
                const placeholder = document.getElementById('hub-placeholder');
                const editorContainer = document.getElementById('monaco-editor-container');
                const editorContainerRight = document.getElementById('monaco-editor-container-right');
                const breadcrumbs = document.getElementById('editor-breadcrumbs');
                
                if (placeholder) placeholder.classList.remove('hidden');
                if (editorContainer) editorContainer.classList.add('hidden');
                if (editorContainerRight) editorContainerRight.classList.add('hidden');
                if (breadcrumbs) breadcrumbs.classList.add('hidden');
                
                renderTabs();
            }
        );
    }
};

window.createNewFile = () => {
    if (window.gxPrompt) {
        window.gxPrompt(
            "NUOVO FILE",
            "Inserisci il nome del file (es: index.js)",
            "nuovo_file.js",
            async (fileName) => {
                try {
                    let fullPath = fileName;
                    // Se c'è un workspace aperto, creiamo il file lì dentro
                    if (state.workspaceData && state.workspaceData.path) {
                        const pathDelimiter = state.workspaceData.path.includes('\\') ? '\\' : '/';
                        fullPath = state.workspaceData.path + pathDelimiter + fileName;
                    }
                    
                    await window.electronAPI.fsWriteFile(fullPath, "");
                    window.openFileInIDE(fullPath, fileName);
                    
                    // Forza il refresh del file tree se possibile
                    if (window.renderWorkspace) window.renderWorkspace();
                    
                    if (window.gxToast) window.gxToast(`File ${fileName} creato`, "success");
                } catch (err) {
                    if (window.gxToast) window.gxToast("Errore creazione file: " + err.message, "error");
                }
            }
        );
    }
};

window.showFileDiff = () => {
    if (window.gxToast) window.gxToast("Funzionalità Diff in arrivo...", "info");
};

let currentSplitMode = null;

const RIGHT_PLACEHOLDER = `
    <div class="flex flex-col items-center justify-center h-full text-center opacity-30 select-none">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="mb-3 text-gray-500">
            <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="3" x2="12" y2="21"/>
        </svg>
        <p class="text-[10px] uppercase font-bold tracking-widest text-gray-500">Clicca qui per attivare</p>
        <p class="text-[9px] text-gray-600 mt-1">Poi seleziona un file dall'explorer</p>
    </div>
`;

window.setSplitMode = (mode) => {
    const rightContainer = document.getElementById('monaco-editor-container-right');
    const dragBar = document.getElementById('editor-split-drag-bar');
    const hubArea = document.getElementById('hub-content-area');
    
    if (!rightContainer || !hubArea) return;

    // Toggle: click same mode again to close split
    if (currentSplitMode === mode) {
        currentSplitMode = null;
        setState({ isSplitEditorOpen: false });

        hubArea.style.flexDirection = '';
        rightContainer.classList.add('hidden');
        if (dragBar) dragBar.classList.add('hidden');

        ['btn-split-right', 'btn-split-bottom', 'btn-split-left'].forEach(id => {
            document.getElementById(id)?.classList.remove('tab-control-btn--active');
        });

        // Reset active side to left
        if (window.setActiveEditorSide) window.setActiveEditorSide('left');
        if (window.editor) setTimeout(() => window.editor.layout(), 50);
        return;
    }

    currentSplitMode = mode;
    setState({ isSplitEditorOpen: true });

    if (dragBar) dragBar.classList.remove('hidden', 'w-1', 'h-1');
    rightContainer.classList.remove('hidden');

    if (mode === 'vertical-right') {
        hubArea.style.flexDirection = 'row';
        if (dragBar) { dragBar.style.width = '4px'; dragBar.style.height = ''; dragBar.style.cursor = 'col-resize'; }
    } else if (mode === 'horizontal-bottom') {
        hubArea.style.flexDirection = 'column';
        if (dragBar) { dragBar.style.height = '4px'; dragBar.style.width = ''; dragBar.style.cursor = 'row-resize'; }
    } else if (mode === 'vertical-left') {
        hubArea.style.flexDirection = 'row-reverse';
        if (dragBar) { dragBar.style.width = '4px'; dragBar.style.height = ''; dragBar.style.cursor = 'col-resize'; }
    }

    // Active button states
    ['btn-split-right', 'btn-split-bottom', 'btn-split-left'].forEach(id => {
        document.getElementById(id)?.classList.remove('tab-control-btn--active');
    });
    const activeId = mode === 'vertical-right' ? 'btn-split-right' 
                   : mode === 'horizontal-bottom' ? 'btn-split-bottom' 
                   : 'btn-split-left';
    document.getElementById(activeId)?.classList.add('tab-control-btn--active');

    // Se l'editor destro esiste ma è vuoto, mostra placeholder nel DOM overlay
    // (il monaco editor è già inizializzato, il placeholder è un div sopra)
    let rightOverlay = document.getElementById('split-right-placeholder');
    if (window.editorRight && !window.editorRight.getModel()?.getValue()) {
        if (!rightOverlay) {
            rightOverlay = document.createElement('div');
            rightOverlay.id = 'split-right-placeholder';
            rightOverlay.style.cssText = 'position:absolute;inset:0;z-index:1;pointer-events:none;display:flex;align-items:center;justify-content:center;';
            rightOverlay.innerHTML = RIGHT_PLACEHOLDER;
            rightContainer.style.position = 'relative';
            rightContainer.appendChild(rightOverlay);
        }
        rightOverlay.style.display = 'flex';
    }

    // Right side becomes active immediately → next file opened goes there
    if (window.setActiveEditorSide) window.setActiveEditorSide('right');

    // Relayout both editors
    setTimeout(() => {
        if (window.editor) window.editor.layout();
        if (window.editorRight) window.editorRight.layout();
    }, 50);
};

// Keep backward compat
window.toggleSplitEditor = () => window.setSplitMode('vertical-right');


// --- FUNZIONI NATIVE (Disponibili Immediatamente) ---
window.openFolder = async () => {
    try {
        const result = await window.electronAPI.openFolder();
        if (result && result.path) {
            setState({ 
                workspaceData: { path: result.path, name: result.name },
                files: result.files || [] 
            });
            if (window.api) await window.api.loadAll();
            if (window.gxToast) window.gxToast(`Cartella aperta: ${result.name}`, "success");
        }
    } catch (err) {
        console.error("Errore apertura cartella:", err);
    }
};

window.openWorkspaceNative = async () => {
    try {
        const result = await window.electronAPI.openWorkspace();
        if (result && result.path) {
            setState({ 
                workspaceData: { path: result.path, isWorkspace: true, name: result.name },
                files: result.folders || [] 
            });
            if (window.api) await window.api.loadAll();
            if (window.gxToast) window.gxToast(`Workspace aperto: ${result.name}`, "success");
        }
    } catch (err) {
        if (window.gxToast) window.gxToast("Errore apertura workspace", "error");
    }
};

window.openFileNative = async () => {
    try {
        const result = await window.electronAPI.openFile();
        if (result && result.path) {
            window.openFileInIDE(result.path, result.name || result.path.split(/[\\/]/).pop());
        }
    } catch (err) {
        console.error("Errore apertura file nativo:", err);
    }
};

window.openFileInIDE = async (filePath, name) => {
    if (state.isTestingInProgress && state.testTarget === 'run') return;
    if (!filePath) return;
    
    console.log(`[GX-WORKSPACE] Tentativo apertura: ${filePath}`);

    // Determina in quale pannello aprire il file
    const isSplit = state.isSplitEditorOpen;
    const activeSide = window.getActiveEditorSide ? window.getActiveEditorSide() : 'left';
    const targetEditor = (isSplit && activeSide === 'right') ? window.editorRight : window.editor;

    // --- SWITCH VISIBILITÀ IMMEDIATO ---
    const placeholder = document.getElementById('hub-placeholder');
    const editorContainer = document.getElementById('monaco-editor-container');
    const breadcrumbs = document.getElementById('editor-breadcrumbs');
    
    if (placeholder) placeholder.classList.add('hidden');
    if (editorContainer) editorContainer.classList.remove('hidden');
    if (breadcrumbs) {
        breadcrumbs.classList.remove('hidden');
        breadcrumbs.classList.add('flex');
    }

    // Protezione Directory (Evita EISDIR)
    const normPath = filePath.replace(/\\/g, '/').toLowerCase();
    const normRoot = state.workspaceData?.path?.replace(/\\/g, '/').toLowerCase();
    if (normRoot && normPath === normRoot.replace(/\/$/, '')) {
        console.warn("[GX-WORKSPACE] Root folder load blocked.");
        return;
    }
    
    try {
        const content = await window.electronAPI.readFile(filePath);
        let openFiles = [...state.openFiles];
        const fileName = name || filePath.split(/[\\/]/).pop();
        
        if (!openFiles.find(f => f.path === filePath)) {
            openFiles.push({ path: filePath, name: fileName, content });
        }

        const currentActivity = state.activeActivity;
        const preservedActivities = ['testing', 'search', 'debug', 'issues'];
        
        setState({ 
            activeFileId: filePath, 
            openFiles,
            activeActivity: preservedActivities.includes(currentActivity) ? currentActivity : 'explorer'
        });

        if (targetEditor && window.monaco) {
            const ext = fileName.split('.').pop().toLowerCase();
            const lang = 
                ext === 'js' ? 'javascript' : 
                ext === 'ts' ? 'typescript' : 
                ext === 'css' ? 'css' : 
                ext === 'html' ? 'html' : 
                ext === 'json' ? 'json' : 'plaintext';

            const model = window.monaco.editor.createModel(content, lang);
            targetEditor.setModel(model);

            // Nascondi il placeholder del pannello destro se presente
            if (activeSide === 'right') {
                const overlay = document.getElementById('split-right-placeholder');
                if (overlay) overlay.style.display = 'none';
            }
            
            // --- FOCUS RIGA RICERCA ---
            if (state.searchLineToFocus && activeSide === 'left') {
                const line = parseInt(state.searchLineToFocus);
                setTimeout(() => {
                    targetEditor.revealLineInCenter(line, window.monaco.editor.ScrollType.Smooth);
                    targetEditor.setPosition({ lineNumber: line, column: 1 });
                    targetEditor.focus();
                    const decorations = targetEditor.deltaDecorations([], [{
                        range: new window.monaco.Range(line, 1, line, 1),
                        options: { isWholeLine: true, className: 'monaco-search-active-line', glyphMarginClassName: 'monaco-search-active-glyph' }
                    }]);
                    setTimeout(() => targetEditor.deltaDecorations(decorations, []), 2000);
                    setState({ searchLineToFocus: null });
                }, 200);
            }

            setTimeout(() => targetEditor.layout(), 100);
            
            updateBreadcrumbs();
            updateBreakpointDecorations();
            updateDebugActiveLine();
        }
    } catch (err) {
        if (err.message.includes('EISDIR')) {
            console.warn("[GX-WORKSPACE] EISDIR ignored for: " + filePath);
            return;
        }
        if (window.gxToast) window.gxToast("Errore apertura file: " + err.message, "error");
    }
};

// --- GESTIONE DROP-DOWN EXPLORER ---
export const initExplorerToolbar = () => {
    const btnDropdown = document.getElementById('btn-open-dropdown');
    const menuDropdown = document.getElementById('open-dropdown-menu');
    const optOpenFolder = document.getElementById('opt-open-folder');
    const optOpenFile = document.getElementById('opt-open-file');
    const optOpenWorkspace = document.getElementById('opt-open-workspace');

    if (btnDropdown && menuDropdown) {
        btnDropdown.onclick = (e) => {
            e.stopPropagation();
            menuDropdown.classList.toggle('hidden');
        };

        window.addEventListener('click', () => {
            menuDropdown.classList.add('hidden');
        });
    }

    if (optOpenFolder) optOpenFolder.onclick = () => window.openFolder();
    if (optOpenFile) optOpenFile.onclick = () => window.openFileNative();
    if (optOpenWorkspace) optOpenWorkspace.onclick = () => window.openWorkspaceNative();
};

export const fetchFolderContents = async (targetPath) => {
    console.log(`[GX-WORKSPACE] Caricamento dinamico: ${targetPath}`);
    try {
        const result = await window.electronAPI.openSpecificFolder(targetPath);
        if (!result || !result.files) return;

        const mergeChildren = (files, path, newChildren) => {
            return files.map(f => {
                if (f.path === path) {
                    return { ...f, children: newChildren, type: 'directory' };
                }
                if (f.children) {
                    return { ...f, children: mergeChildren(f.children, path, newChildren) };
                }
                return f;
            });
        };

        const updatedFiles = mergeChildren(state.files, targetPath, result.files);
        setState({ files: updatedFiles });
    } catch (err) {
        console.error("[GX-WORKSPACE] Errore fetch cartella:", err);
    }
};

window.fetchFolderContents = fetchFolderContents;

export const renderWorkspace = () => {
    const container = document.getElementById('workspace-tree-container');
    if (!container) return;

    const files = state.files || [];
    const isEmpty = files.length === 0;

    if (isEmpty) {
        container.innerHTML = `
            <div class="h-full flex flex-col items-center justify-center p-6 text-center space-y-4 opacity-80 mt-10">
                <div class="w-16 h-16 rounded-3xl bg-blue-500/5 border border-blue-500/10 flex items-center justify-center text-blue-500/30">
                     <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                </div>
                <div class="space-y-1">
                    <h3 class="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">Nessuna Cartella</h3>
                    <p class="text-[9px] text-gray-600 max-w-[150px] mx-auto">Inizia aprendo una cartella di progetto o un file singolo.</p>
                </div>
                <button onclick="window.openFolder()" class="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-[9px] font-bold rounded-lg transition shadow-lg shadow-blue-600/20 uppercase tracking-widest active:scale-95">
                    Apri Progetto
                </button>
            </div>
        `;
    } else {
        // Aggiungiamo padding inferiore e altezza minima per permettere il right-click nello spazio vuoto
        container.innerHTML = `<div class="p-1 pb-40" style="min-height: 100%">${renderFileTree(files)}</div>`;
    }

    container.querySelectorAll('.gx-del-btn').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            const path = btn.getAttribute('data-del');
            if (window.gxConfirm) {
                window.gxConfirm(
                    "ELIMINA DEFINITIVAMENTE",
                    `Sei sicuro di voler eliminare questo elemento dal disco? L'azione non può essere annullata.\n\nTarget: ${path.split(/[\\/]/).pop()}`,
                    () => {
                        window.electronAPI.fsDelete(path);
                        setTimeout(() => {
                            if (window.renderWorkspace) window.renderWorkspace();
                        }, 500);
                    }
                );
            }
        };
    });
};

export const restoreSession = async () => {
    const { workspaceData } = state;
    if (workspaceData && workspaceData.path) {
        console.log(`[GX-RESTORE] Ripristino sessione per: ${workspaceData.path}`);
        try {
            // Ricarica la struttura dei file per assicurarsi che sia aggiornata
            const result = await window.electronAPI.openSpecificFolder(workspaceData.path);
            if (result && result.files) {
                setState({ files: result.files });
            }
        } catch (err) {
            console.error("[GX-RESTORE] Errore ripristino cartella:", err);
        }
    }
};

export const initWorkspace = () => {
    initEditor();
    initExplorerToolbar();
    const treeContainer = document.getElementById('workspace-tree-container');
    if (treeContainer) {
        treeContainer.oncontextmenu = (e) => {
            e.preventDefault();
            const card = e.target.closest('.explorer-item-card');
            if (card) {
                if (window.showContextMenu) window.showContextMenu(e, card.dataset.path, card.dataset.isDirectory === 'true');
            } else {
                // Click su spazio vuoto: usa la root del workspace (o il primo folder disponibile)
                let rootPath = state.workspaceData?.path;
                // Se è un workspace multi-root, prendiamo la prima cartella come default per il "root click"
                if (state.workspaceData?.isWorkspace && state.workspaceData.folders?.length > 0) {
                    rootPath = state.workspaceData.folders[0].path;
                }
                if (rootPath && window.showContextMenu) {
                    window.showContextMenu(e, rootPath, true);
                }
            }
        };
    }

    subscribe((newState) => {
        renderWorkspace();
        renderTabs();
        if (newState.activeFileId) {
            updateBreadcrumbs();
            updateBreakpointDecorations();
            updateDebugActiveLine();
        }
    });

    console.log("[GX-WORKSPACE] Orchestrator initialized.");
};

window.renderWorkspace = renderWorkspace;
window.initWorkspace = initWorkspace;
window.restoreSession = restoreSession;
