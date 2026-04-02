import { state, subscribe, setState } from '../core/state.js';
import { showContextMenu } from './contextMenu.js';

let editor = null;
let editorRight = null;
let ignoreStateUpdate = false;
let _updateBreadcrumbs = null;
let breakpointDecorations = [];
let breakpointDecorationsRight = [];
let debugActiveLineDecoration = [];
let debugActiveLineDecorationRight = [];
let updateBreakpointDecorations = () => {};
let updateDebugActiveLine = () => {};
let getDocumentSymbols = () => [];

const normalizePath = (p) => {
    if (!p) return "";
    // Absolute Normalizer: lowercase, forward-slashes, remove 'file:///' and extra spaces
    let path = p.toString().trim().toLowerCase().replace(/\\/g, '/');
    if (path.startsWith('file:///')) path = path.replace('file:///', '');
    return path;
};

// ── Selection state ──────────────────────────────────────────────────────────
let selectedFilePath = null;

// ── File-type icon map ───────────────────────────────────────────────────────
const getFileIcon = (name) => {
    const ext = (name.includes('.') ? name.split('.').pop() : '').toLowerCase();
    const base = name.toLowerCase();

    // Specific Files (Logos)
    if (base === 'package.json' || base === 'package-lock.json') {
        return `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#42b883" stroke-width="2.5"><path d="M12 2l10 5v10l-10 5-10-5V7l10-5z"/><path d="M12 8v8m-4-4h8" stroke-width="2"/></svg>`;
    }
    if (base.includes('tailwind.config')) {
        return `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2.5"><path d="M12 3c7 0 9 9 0 9s-7 9 0 9" stroke-linecap="round"/><path d="M12 3c-7 0-9 9 0 9s7 9 0 9" stroke-linecap="round"/></svg>`;
    }
    if (base.includes('postcss.config')) {
        return `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#dd3a0a" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M8 12h8m-4-4v8"/></svg>`;
    }
    if (base === '.gitignore' || base === '.gitattributes') {
        return `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#f05032" stroke-width="2.5"><path d="M12 22l10-10L12 2 2 12z"/><circle cx="12" cy="12" r="2" fill="currentColor"/></svg>`;
    }
    if (base === 'readme.md') {
        return `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#42a5f5" stroke-width="2.5"><path d="M3 5h18v14H3z"/><path d="M7 15V9l3 3 3-3v6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    }

    // Extensions
    const icons = {
        js:   { color: '#f7df1e', html: `<span class="text-[9px] font-black text-[#f7df1e] mr-1">JS</span>` },
        mjs:  { color: '#f7df1e', html: `<span class="text-[9px] font-black text-[#f7df1e] mr-1">JS</span>` },
        ts:   { color: '#3178c6', html: `<span class="text-[9px] font-black text-[#3178c6] mr-1">TS</span>` },
        tsx:  { color: '#61dafb', html: `<span class="text-[9px] font-black text-[#61dafb] mr-1">TSX</span>` },
        jsx:  { color: '#61dafb', html: `<span class="text-[9px] font-black text-[#61dafb] mr-1">JSX</span>` },
        html: { color: '#e44d26', html: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#e44d26" stroke-width="2.5"><path d="M16 18l6-6-6-6M8 6l-6 6 6 6"/></svg>` },
        css:  { color: '#264de4', html: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#264de4" stroke-width="2.5"><path d="M7 8l-4 4 4 4m10-8l4 4-4 4M13 4l-2 16"/></svg>` },
        json: { color: '#f5a623', html: `<span class="text-[10px] font-bold text-[#f5a623]">{ }</span>` },
        py:   { color: '#3572a5', html: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#3572a5" stroke-width="2.5"><path d="M12 2v10m0 0v10m0-10H2m10 0h10"/></svg>` }, // Proxy
        md:   { color: '#9ca3af', html: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2"><path d="M12 5l7 7-7 7M5 5l7 7-7 7"/></svg>` }
    };

    if (icons[ext]) return icons[ext].html;
    return `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6e7681" stroke-width="2"><circle cx="12" cy="12" r="2" fill="currentColor"/></svg>`;
};

// ── Folder Icons (Professional SVG Set) ──────────────────────────────────────
const getFolderIcon = (name, isExpanded) => {
    const n = name.toLowerCase();
    const FOLDER_COLOR = '#8b949e'; 
    let iconColor = '#8b949e';
    let overlay = ''; 

    // Category mapping
    if (n === 'components' || n === 'app' || n === 'core' || n === 'src' || n === 'hooks' || n === 'services') {
        iconColor = '#82aaff'; 
        overlay = '<path d="M10 14l-2-2 2-2M14 10l2 2-2 2" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
    } else if (n === '.git' || n === '.github') {
        iconColor = '#f05032'; 
        overlay = '<circle cx="12" cy="15" r="2"/><path d="M12 13V9m0 0a2 2 0 1 1 2 2" stroke-width="2"/>';
    } else if (n === 'node_modules') {
        iconColor = '#a78bfa'; 
        overlay = '<path d="M8 10l4 2 4-2m-8 4l4 2 4-2" stroke-width="2"/>';
    } else if (n === 'tests' || n === 'test' || n === 'e2e' || n === '__tests__') {
        iconColor = '#4eaa25'; 
        overlay = '<path d="M9 12l2 2 4-4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
    } else if (n === 'assets' || n === 'img' || n === 'images' || n === 'public') {
        iconColor = '#c3e88d'; 
        overlay = '<circle cx="10" cy="12" r="2"/><path d="M14 15l-4-4-4 4" stroke-width="2"/>';
    } else if (n === 'dist' || n === 'build' || n === 'out' || n === 'dist_electron') {
        iconColor = '#f78c6c'; 
        overlay = '<path d="M12 11v4m0 0l-2-2m2 2l2-2" stroke-width="2"/>';
    } else if (n === 'api' || n === 'routes' || n === 'middleware') {
        iconColor = '#bb80ff'; 
        overlay = '<path d="M8 12h8m-2-2l2 2-2 2" stroke-width="2" stroke-linecap="round"/>';
    } else if (n === 'lib' || n === 'utils' || n === 'helpers') {
        iconColor = '#89ddff'; 
        overlay = '<path d="M8 10V8a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke-width="2"/>';
    } else if (n === 'config' || n === 'scripts' || n === '.vscode') {
        iconColor = '#f7df1e'; 
        overlay = '<circle cx="12" cy="12" r="3" stroke-width="2"/>';
    }

    const folderPath = isExpanded 
        ? 'M20 20H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h2.5L10 4h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2z' 
        : 'M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z';

    return `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" class="flex-shrink-0">
            <!-- Base Folder -->
            <path d="${folderPath}" stroke="${FOLDER_COLOR}" stroke-width="2" />
            <!-- Corner Overlay Icon -->
            <g stroke="${iconColor}" transform="translate(10, 10) scale(0.6)">
                ${overlay}
            </g>
        </svg>
    `;
};

// ── Delete button HTML ───────────────────────────────────────────────────────
const delBtn = (p) => `<button class="gx-del-btn" data-del="${p}" data-i18n="[title]explorer.deleteBtn">
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
    </svg></button>`;

// ── Tree renderer (Refined with Git Status & Bubbling) ────────────────────────
const renderFileTree = (files, depth = 0) => {
    if (!files || files.length === 0) return '';
    
    // Helper per determinare se una cartella ha figli modificati (Bubbling)
    const getGitStatus = (itemPath, isDirectory) => {
        const statuses = state.gitStatus || {};
        const normItem = normalizePath(itemPath);

        if (!isDirectory) {
            // Se è un file, cerchiamo il match esatto o parziale (se Git ritorna slash diversi)
            for (const [gitPath, status] of Object.entries(statuses)) {
                if (normalizePath(gitPath) === normItem) return status;
            }
            return null;
        }

        // Se è una cartella, cerchiamo se QUALSIASI file modificato "inizia con" questo path
        let hasModified = false;
        let hasAdded = false;
        for (const [gitPath, status] of Object.entries(statuses)) {
            const normGit = normalizePath(gitPath);
            if (normGit.startsWith(normItem + '\\')) {
                if (status === 'M') hasModified = true;
                if (status === 'A' || status === '??') hasAdded = true;
            }
        }
        if (hasModified) return 'M';
        if (hasAdded) return 'A';
        return null;
    };

    return files.map(f => {
        const isExpanded = state.expandedFolders?.includes(f.path);
        const pl = depth * 16 + 8;
        const isSel = selectedFilePath && normalizePath(selectedFilePath) === normalizePath(f.path);
        const status = getGitStatus(f.path, f.isDirectory);
        
        // Colors & Labels
        let statusClass = '';
        let statusLabel = '';
        if (status === 'M') { statusClass = 'text-[#e2c08d]'; statusLabel = 'M'; }
        if (status === 'A' || status === '??') { statusClass = 'text-[#73c991]'; statusLabel = status === 'M' ? 'M' : 'U'; }
        if (status === 'D') { statusClass = 'text-[#f14c4c]'; statusLabel = 'D'; }

        if (f.isDirectory) {
            const folderIconHtml = getFolderIcon(f.name, isExpanded);
            const colorMatch = folderIconHtml.match(/stroke="(.+?)"/);
            const color = colorMatch ? colorMatch[1] : '#8b949e';

            return `<div class="gx-tree-item is-folder${isSel?' gx-sel':''}" data-path="${f.path}" data-name="${f.name}" style="padding-left:${pl}px">
                <span class="gx-arr${isExpanded?' gx-arr-open':''}" style="color:${color}">
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M9 18l6-6-6-6"/></svg>
                </span>
                ${folderIconHtml}
                <span class="gx-nm ${statusClass}">${f.name}</span>
                ${status ? `<span class="text-[8px] font-bold ${statusClass} opacity-80 ml-auto mr-3">${status === 'M' ? '●' : '●'}</span>` : ''}
            </div>
            ${isExpanded && f.children ? `<div class="gx-kids" style="--gx:${pl+10}px">${renderFileTree(f.children, depth+1)}</div>` : ''}`;
        } else {
            const fileIconHtml = getFileIcon(f.name);
            return `<div class="gx-tree-item is-file${isSel?' gx-sel':''}" data-path="${f.path}" data-name="${f.name}" style="padding-left:${pl}px">
                <span class="gx-fic">${fileIconHtml}</span>
                <span class="gx-nm ml-1 ${statusClass}">${f.name}</span>
                ${statusLabel ? `<span class="text-[9px] font-bold ${statusClass} opacity-80 ml-auto mr-3">${statusLabel}</span>` : ''}
            </div>`;
        }
    }).join('');
};

const renderWorkspace = () => {
    const treeContainer = document.getElementById('workspace-tree-container');
    if (!treeContainer) return;
    
    if (!state.workspaceData) {
        treeContainer.innerHTML = `
            <div class="px-3 py-4 text-center">
                <p class="text-[11px] text-gray-500 leading-snug mb-3" data-i18n="explorer.emptyTitle">${window.t('explorer.emptyTitle')}</p>
                <div class="text-[10px] text-gray-600 bg-black/20 rounded border border-gray-800 p-2 inline-block" data-i18n="[html]explorer.emptyDesc">${window.t('explorer.emptyDesc')}</div>
            </div>
        `;
        return;
    }
    
    const ws = state.workspaceData;

    if (ws.isWorkspace && ws.folders) {
        let html = '';
        ws.folders.forEach(folder => {
            const isExpanded = state.expandedFolders?.includes(folder.path);
            const pl = 8;
            
            html += `
                <div class="gx-tree-item is-folder is-workspace-root" data-path="${folder.path}" data-name="${folder.name}" style="padding-left:${pl}px">
                    <span class="gx-arr${isExpanded?' gx-arr-open':''}" style="color:#2188ff">
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M9 18l6-6-6-6"/></svg>
                    </span>
                    <span class="text-blue-500 mr-2">💼</span>
                    <span class="gx-nm font-black uppercase text-[9px] tracking-widest text-gray-400">${folder.name}</span>
                </div>
                ${isExpanded ? `<div class="gx-kids" style="--gx:${pl+10}px">${renderFileTree(folder.files, 1)}</div>` : ''}
            `;
        });
        treeContainer.innerHTML = html;
    } else {
        treeContainer.innerHTML = renderFileTree(ws.files);
    }
};

export const initWorkspace = () => {
    const btnOpenDropdown = document.getElementById('btn-open-dropdown');
    const treeContainer = document.getElementById('workspace-tree-container');
    if (!btnOpenDropdown || !treeContainer) return;

    // Gestione Dropdown "Apri"
    btnOpenDropdown.onclick = (e) => {
        e.stopPropagation();
        const menu = document.createElement('div');
        menu.className = 'fixed bg-[#161b22] border border-gray-700 rounded-md shadow-[0_10px_40px_rgba(0,0,0,0.5)] py-1 min-w-[180px] animate-in fade-in zoom-in duration-150';
        
        // Forza z-index estremo via inline style per superare ogni stacking context
        menu.style.zIndex = '999999';
        
        const rect = btnOpenDropdown.getBoundingClientRect();
        menu.style.top = `${rect.bottom + 8}px`;
        menu.style.left = `${rect.left}px`;

        const options = [
            { id: 'folder', icon: '📁', label: window.t('explorer.openFolder') || 'Apri Cartella', action: window.electronAPI.openFolder },
            { id: 'file', icon: '📄', label: window.t('explorer.openFile') || 'Apri File', action: window.electronAPI.openFile },
            { id: 'workspace', icon: '💼', label: window.t('explorer.openWorkspace') || 'Apri Workspace', action: window.electronAPI.openWorkspace }
        ];

        options.forEach(opt => {
            const item = document.createElement('div');
            item.className = 'px-3 py-1.5 text-[11px] text-gray-400 hover:text-white hover:bg-blue-600 cursor-pointer flex items-center gap-2 transition-colors';
            item.innerHTML = `<span>${opt.icon}</span> <span>${opt.label}</span>`;
            item.onclick = async () => {
                menu.remove();
                try {
                    const data = await opt.action();
                    if (data && !data.error) {
                        if (opt.id === 'file') {
                            // Non sostituiamo il workspace, ma apriamo il file
                            if (window.openFileInIDE) window.openFileInIDE(data.path, data.path.split('\\').pop());
                        } else {
                            // Salvataggio ora gestito automaticamente dal subscribe nello stato
                            setState({ workspaceData: data });
                        }
                    }
                } catch (err) { console.error(err); }
            };
            menu.appendChild(item);
        });

        document.body.appendChild(menu);
        const closeMenu = () => { menu.remove(); document.removeEventListener('click', closeMenu); };
        setTimeout(() => document.addEventListener('click', closeMenu), 10);
    };
    
    // Inizializzazione Monaco Editor
    if (window.require) {
        window.require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.43.0/min/vs' } });
        window.require(['vs/editor/editor.main'], function() {
            try {
                monaco.editor.defineTheme('gx-dark', {
                    base: 'vs-dark',
                    inherit: true,
                    rules: [],
                    colors: {
                        'editor.background': '#0d1117',
                        'editor.lineHighlightBackground': '#161b22',
                        'editorLineNumber.foreground': '#484f58',
                        'editorLineNumber.activeForeground': '#2188ff',
                    }
                });

                monaco.editor.defineTheme('gx-light', {
                    base: 'vs',
                    inherit: true,
                    rules: [],
                    colors: {
                        'editor.background': '#ffffff',
                        'editor.lineHighlightBackground': '#f6f8fa',
                        'editorLineNumber.foreground': '#959da5',
                        'editorLineNumber.activeForeground': '#0366d6',
                    }
                });

                const isLight = state.activeCgxTheme === 'light' || state.activeCgxTheme === 'apple' || state.activeCgxTheme === 'aero';

                const container = document.getElementById('hub-content-area');
                if (!container) return;
                
                // --- INSTANCE GUARD (Ghost Fix) ---
                if (editor) {
                    console.log("[GX-DEBUG] Monaco already initialized, skipping duplicate creation.");
                    return;
                }
                
                const createOptions = (isLight) => ({
                    value: '',
                    language: 'javascript',
                    theme: isLight ? 'gx-light' : 'gx-dark',
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

                editor = monaco.editor.create(document.getElementById('monaco-editor-container'), createOptions(isLight));
                editorRight = monaco.editor.create(document.getElementById('monaco-editor-container-right'), createOptions(isLight));
                
                // Forza il ricalcolo del layout per sincronizzare il gutter
                setTimeout(() => {
                    if (editor) editor.layout();
                    if (editorRight) editorRight.layout();
                }, 100);

                // --- SAVE & LINT INTEGRATION ---
                const gxToast = (msg, type) => {
                    if (window.gxToast) window.gxToast(msg, type);
                    else console.log(`[GX Toast] ${type}: ${msg}`);
                };

                const handleSave = async (ed) => {
                    const activeFileId = state.activeFileId;
                    if (!activeFileId) return;
                    const content = ed.getValue();
                    try {
                        await window.electronAPI.fsWriteFile(activeFileId, content);
                        gxToast(window.t('explorer.saveSuccess'), "success");
                        // Trigger lint after save
                        if (window.runLint) window.runLint(activeFileId);
                    } catch (err) {
                        gxToast(window.t('explorer.saveError')?.replace('{error}', err.message) || err.message, "error");
                    }
                };

                editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => handleSave(editor));
                editorRight.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => handleSave(editorRight));

                editor.updateOptions({ glyphMargin: true });
                editorRight.updateOptions({ glyphMargin: true });

                // Ghost Breakpoint on Hover
                let ghostDecoration = [];
                editor.onMouseMove((e) => {
                    const isGutter = e.target.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN || 
                                     e.target.type === monaco.editor.MouseTargetType.GUTTER_LINE_NUMBERS;
                    if (isGutter && e.target.range) {
                        const line = e.target.range.startLineNumber;
                        ghostDecoration = editor.deltaDecorations(ghostDecoration, [{
                            range: new monaco.Range(line, 1, line, 1),
                            options: {
                                glyphMarginClassName: 'gx-breakpoint-hover',
                                glyphMarginHoverMessage: { value: 'Add Breakpoint' }
                            }
                        }]);
                    } else {
                        ghostDecoration = editor.deltaDecorations(ghostDecoration, []);
                    }
                });

                editor.onMouseLeave(() => {
                    ghostDecoration = editor.deltaDecorations(ghostDecoration, []);
                });

                editor.onMouseDown((e) => {
                    const isGutter = e.target.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN || 
                                     e.target.type === monaco.editor.MouseTargetType.GUTTER_LINE_NUMBERS;
                    if (isGutter && e.target.range) {
                        const line = e.target.range.startLineNumber;
                        console.log(`[CLICK-SYNC] Line detected: ${line}`);
                        const activeFileId = state.activeFileId;
                        if (!activeFileId) return;
                        
                        const normActive = normalizePath(activeFileId);
                        console.log("[Monaco Debug] Toggle breakpoint on line:", line, "path:", normActive);
                        
                        let newBreakpoints = [...state.breakpoints];
                        const idx = newBreakpoints.findIndex(bp => normalizePath(bp.path) === normActive && bp.line === line);

                        if (idx !== -1) {
                            newBreakpoints.splice(idx, 1);
                        } else {
                            newBreakpoints.push({ path: activeFileId, line: line });
                        }
                        
                        setState({ breakpoints: newBreakpoints });
                        if (updateBreakpointDecorations) updateBreakpointDecorations();
                    }
                });

                updateBreakpointDecorations = () => {
                    const activeFileId = state.activeFileId;
                    if (!activeFileId) return;

                    const normActive = normalizePath(activeFileId);
                    const activeBreakpoints = state.breakpoints.filter(bp => normalizePath(bp.path) === normActive);
                    
                    console.log(`[DEBUG-IDE] MATCHED COUNT: ${activeBreakpoints.length} FOR [${normActive}]`);
                    
                    const newDecorations = activeBreakpoints.map(bp => {
                        console.log(`[BREAKPOINT-RENDER] Drawing at line: ${bp.line}`);
                        return {
                            range: new monaco.Range(bp.line, 1, bp.line, 1),
                            options: {
                                isWholeLine: false,
                                glyphMarginClassName: 'gx-breakpoint-real',
                                glyphMarginHoverMessage: { value: 'Breakpoint' },
                                stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges
                            }
                        };
                    });

                    // Update BOTH editors
                    if (editor) {
                        console.log(`[GX-DEBUG-SYNC] Syncing LEFT editor model: ${editor.getModel()?.uri.toString()}`);
                        breakpointDecorations = editor.deltaDecorations(breakpointDecorations, newDecorations);
                    }
                    if (editorRight) {
                        console.log(`[GX-DEBUG-SYNC] Syncing RIGHT editor model: ${editorRight.getModel()?.uri.toString()}`);
                        breakpointDecorationsRight = editorRight.deltaDecorations(breakpointDecorationsRight, newDecorations);
                    }
                };

                updateDebugActiveLine = () => {
                    const activeLine = state.debugActiveLine;
                    const newDecorations = activeLine ? [{
                        range: new monaco.Range(activeLine, 1, activeLine, 1),
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

                editor.onDidChangeModelContent(() => {
                    if (ignoreStateUpdate) return;
                    const activeFileId = state.activeFileId;
                    if (!activeFileId) return;

                    const content = editor.getValue();
                    const openFiles = state.openFiles.map(f => f.path === activeFileId ? { ...f, content } : f);
                    
                    ignoreStateUpdate = true;
                    setState({ openFiles });
                    ignoreStateUpdate = false;
                });

                console.log("[GXCode] Monaco Editor initialized successfully.");

                // --- PHASE 3: SYMBOL PROVIDER & BREADCRUMBS ---
                getDocumentSymbols = (model) => {
                    const symbols = [];
                    if (!model) return symbols;
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
                                    range: new monaco.Range(i + 1, 1, i + 1, line.length + 1)
                                });
                            }
                        });
                    });
                    return symbols;
                };

                const registerSymbols = (lang) => {
                    monaco.languages.registerDocumentSymbolProvider(lang, {
                        provideDocumentSymbols: (model) => getDocumentSymbols(model)
                    });
                };
                registerSymbols('javascript');
                registerSymbols('typescript');

                const updateBreadcrumbs = async () => {
                    const bc = document.getElementById('editor-breadcrumbs');
                    const activeFileId = state.activeFileId;
                    if (!bc || !activeFileId || !editor) return;

                    const model = editor.getModel();
                    if (!model) return;

                    const pos = editor.getPosition();
                    const fileName = activeFileId.split('\\').pop();
                    
                    // Ottieni simboli (Usa helper interno per evitare bug API monaco asincroni)
                    const symbols = getDocumentSymbols(model);
                    const currentSymbol = symbols?.slice().reverse().find(s => s.range.startLineNumber <= pos.lineNumber);
                    
                    const pathParts = activeFileId.split('\\');
                    const workspaceBase = state.workspaceData?.path || '';
                    const workspaceBaseMatch = workspaceBase.split('\\').pop();
                    
                    // Trova l'indice dove inizia il workspace nel path completo
                    let startIndex = pathParts.indexOf(workspaceBaseMatch);
                    if (startIndex === -1) startIndex = 0;

                    let breadcrumbsHtml = '';
                    let currentPath = pathParts.slice(0, startIndex).join('\\');

                    for (let i = startIndex; i < pathParts.length; i++) {
                        const part = pathParts[i];
                        if (!part) continue;
                        
                        if (currentPath) currentPath += '\\' + part;
                        else currentPath = part;

                        const isLast = i === pathParts.length - 1;
                        const isFirst = i === startIndex;

                        breadcrumbsHtml += `
                            ${!isFirst ? '<span class="opacity-30">/</span>' : ''}
                            <span class="${isLast ? 'text-gray-400' : 'hover:text-blue-400 cursor-pointer transition'} overflow-hidden truncate max-w-[120px]" 
                                  ${!isLast ? `onclick="window.revealInTree('${currentPath.replace(/\\/g, '\\\\')}')"` : ''}>
                                ${part}
                            </span>
                        `;
                    }

                    bc.classList.remove('hidden');
                    bc.innerHTML = `
                        <div class="flex items-center gap-1.5 text-[10px] text-gray-500 font-bold uppercase tracking-widest whitespace-nowrap">
                            ${breadcrumbsHtml}
                            ${currentSymbol ? `
                                <span class="opacity-30">/</span>
                                <span class="text-blue-500 flex items-center gap-1 cursor-pointer hover:underline" onclick="window.jumpToSymbol(${currentSymbol.range.startLineNumber})">
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M16 11l-4 4-4-4"/></svg>
                                    ${currentSymbol.name}
                                </span>
                            ` : ''}
                        </div>
                    `;
                };

                window.jumpToSymbol = (line) => {
                    editor.revealLineInCenter(line);
                    editor.setPosition({ lineNumber: line, column: 1 });
                    editor.focus();
                };

                window.revealInTree = (path) => {
                    console.log("[GX Breadcrumbs] Revealing path in tree:", path);
                    const parts = path.split('\\');
                    let current = '';
                    let expandedFolders = [...(state.expandedFolders || [])];
                    
                    for (let i = 0; i < parts.length - 1; i++) {
                        current = current ? current + '\\' + parts[i] : parts[i];
                        if (!expandedFolders.includes(current)) {
                            expandedFolders.push(current);
                        }
                    }
                    setState({ expandedFolders });
                    
                    // Scroll to element after state update and render
                    setTimeout(() => {
                        const el = document.querySelector(`[data-path="${path.replace(/\\/g, '\\\\')}"]`);
                        if (el) {
                            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            el.classList.add('gx-highlight-pulse');
                            setTimeout(() => el.classList.remove('gx-highlight-pulse'), 2000);
                        }
                    }, 300);
                };

                editor.onDidChangeCursorPosition(() => updateBreadcrumbs());

                // Listener Globale per i Problemi (Optimized v10)
                monaco.editor.onDidChangeMarkers(([uri]) => {
                    const allMarkers = monaco.editor.getModelMarkers({});
                    const seriousIssues = allMarkers.filter(m => m.severity >= 3);
                    
                    const newProblems = seriousIssues.map(m => ({
                        message: m.message,
                        severity: m.severity,
                        resource: m.resource.toString(),
                        path: m.resource.path,
                        startLine: m.startLineNumber,
                        startColumn: m.startColumn,
                        source: m.source || 'Monaco'
                    }));

                    // Evita Loop: Aggiorna solo se i messaggi o il numero di problemi sono cambiati
                    const oldJson = JSON.stringify(state.problems);
                    const newJson = JSON.stringify(newProblems);
                    
                    if (oldJson !== newJson) {
                        setState({ problems: newProblems });
                    }
                });

                _updateBreadcrumbs = updateBreadcrumbs;
                renderActiveFile();
            } catch (err) {
                console.error("[GXCode] Errore inizializzazione Monaco:", err);
            }
        });
    }

    // Refresh Git Status in background
    const refreshGit = () => { if (window.renderGit) window.renderGit(); };
    refreshGit();
    setInterval(refreshGit, 10000);

    treeContainer.oncontextmenu = (e) => {
        const item = e.target.closest('.is-file, .is-folder');
        const rootPath = state.workspaceData?.path;

        if (item) {
            const path = item.getAttribute('data-path').replace(/\//g, '\\');
            const isFolder = item.classList.contains('is-folder');
            showContextMenu(e, path, isFolder);
        } else if (rootPath) {
            // Se clicco sullo spazio vuoto, apro il menu sulla root
            showContextMenu(e, rootPath, true);
        }
    };

    treeContainer.addEventListener('click', async (e) => {
        // ── Delete button ────────────────────────────────────────────────────
        const delTarget = e.target.closest('[data-del]');
        if (delTarget) {
            e.stopPropagation();
            const delPath = delTarget.getAttribute('data-del').replace(/\//g, '\\');
            if (!confirm(window.t('explorer.deleteConfirm'))) return;
            if (window.electronAPI?.fsDelete) {
                const result = await window.electronAPI.fsDelete(delPath);
                if (result?.error) { alert('Errore: ' + result.error); return; }
            }
            if (selectedFilePath && normalizePath(selectedFilePath) === normalizePath(delPath)) {
                selectedFilePath = null;
                const openFiles = state.openFiles.filter(f => normalizePath(f.path) !== normalizePath(delPath));
                setState({ openFiles, activeFileId: openFiles.length > 0 ? openFiles[openFiles.length-1].path : null });
            }
            const ws = await window.electronAPI?.openSpecificFolder?.(state.workspaceData?.path);
            if (ws && !ws.error) setState({ workspaceData: ws });
            return;
        }

        const item = e.target.closest('.is-file, .is-folder');
        if (!item) return;

        const path = item.getAttribute('data-path').replace(/\//g, '\\');
        const name = item.getAttribute('data-name');
        const isFolder = item.classList.contains('is-folder');

        // Update selection
        selectedFilePath = path;

        if (isFolder) {
            let expandedFolders = [...state.expandedFolders];
            const idx = expandedFolders.indexOf(path);
            
            if (idx !== -1) {
                // Collasso
                expandedFolders.splice(idx, 1);
                setState({ expandedFolders });
            } else {
                // Espansione
                expandedFolders.push(path);
                setState({ expandedFolders });

                // Carichiamo i figli se non presenti
                const findAndAddChildren = (files) => {
                    if (!files) return null;
                    for (const f of files) {
                        if (f.path === path) {
                            return (async () => {
                                if (!f.children) {
                                    const data = await window.electronAPI.openSpecificFolder(path);
                                    if (data && data.files) {
                                        f.children = data.files;
                                        setState({ workspaceData: { ...state.workspaceData } });
                                    }
                                }
                            })();
                        }
                        if (f.children) {
                            const res = findAndAddChildren(f.children);
                            if (res) return res;
                        }
                    }
                    return null;
                };
                
                const ws = state.workspaceData;
                let res = null;
                if (ws.isWorkspace && ws.folders) {
                    for (const folder of ws.folders) {
                        if (folder.path === path) {
                            // Workspace root itself doesn't need to be re-scanned, it's scanned on open
                            res = true;
                            break;
                        }
                        res = findAndAddChildren(folder.files);
                        if (res) break;
                    }
                } else {
                    res = findAndAddChildren(ws.files);
                }
                if (typeof res === 'function') await res();
            }
        } else {
            if (window.openFileInIDE) window.openFileInIDE(path, name);
        }
    });

    // Funzione globale per aprire file da qualsiasi punto (Menu, Search, Explorer)
    window.openFileInIDE = async (filePath, fileName) => {
        let openFiles = [...state.openFiles];
        const existing = openFiles.find(f => f.path === filePath);

        if (!existing) {
            openFiles.push({ name: fileName, path: filePath, content: null, loading: true, error: null });
            setState({ openFiles, activeFileId: filePath });

            try {
                const content = await window.electronAPI.readFile(filePath);
                openFiles = state.openFiles.map(f => f.path === filePath ? { ...f, content, loading: false } : f);
                setState({ openFiles });
                
                // Trigger lint on first open
                setTimeout(() => { if (window.runLint) window.runLint(filePath); }, 500);
            } catch (err) {
                console.error("Errore lettura file:", err);
                openFiles = state.openFiles.map(f => f.path === filePath ? { ...f, content: null, loading: false, error: err.message } : f);
                setState({ openFiles });
            }
        } else {
            setState({ activeFileId: filePath });
        }
    };

    // ─── Refined Tab & Split Logic ───────────────────────────────────────────
    window.navigateTab = (direction) => {
        const { openFiles, activeFileId } = state;
        if (openFiles.length <= 1) return;
        const currentIndex = openFiles.findIndex(f => f.path === activeFileId);
        if (currentIndex === -1) return;
        
        let nextIndex;
        if (direction === 'left') {
            nextIndex = (currentIndex - 1 + openFiles.length) % openFiles.length;
        } else {
            nextIndex = (currentIndex + 1) % openFiles.length;
        }
        window.switchTab(openFiles[nextIndex].path);
    };

    window.toggleSplitEditor = () => {
        const newSplitMode = !state.isSplitMode;
        setState({ 
            isSplitMode: newSplitMode, 
            activeFileIdRight: newSplitMode ? state.activeFileId : null 
        });
    };

    function renderActiveFile() {
        if (ignoreStateUpdate) return;
        if (_updateBreadcrumbs) _updateBreadcrumbs();
        
        const area = document.getElementById('hub-content-area');
        const placeholder = document.getElementById('hub-placeholder');
        const containerLeft = document.getElementById('monaco-editor-container');
        const containerRight = document.getElementById('monaco-editor-container-right');
        const tabsContainer = document.getElementById('workspace-tabs');
        const dragBar = document.getElementById('editor-split-drag-bar');
        
        if (!area || !placeholder || !containerLeft || !containerRight || !tabsContainer || !editor || !editorRight || !dragBar) return;

        // Middle-click to close tab (Restore)
        if (!tabsContainer._auxclickBound) {
            tabsContainer._auxclickBound = true;
            tabsContainer.addEventListener('auxclick', (e) => {
                if (e.button !== 1) return;
                e.preventDefault();
                const tab = e.target.closest('[onclick^="window.switchTab"]');
                if (!tab) return;
                const match = tab.getAttribute('onclick').match(/window\.switchTab\('(.+?)'\)/);
                if (match) window.closeTab(match[1]);
            });
        }

        const activeFileLeft = state.openFiles.find(f => f.path === state.activeFileId);
        const activeFileRight = state.openFiles.find(f => f.path === state.activeFileIdRight);
        
        // Tab UI Update
        tabsContainer.style.overflowX = 'auto';
        tabsContainer.style.display = 'flex';
        tabsContainer.style.scrollbarWidth = 'none'; // Hide scrollbar for cleaner look
        
        tabsContainer.innerHTML = state.openFiles.map(f => {
            const isActive = f.path === state.activeFileId;
            return `
                <div onclick="window.switchTab('${f.path.replace(/\\/g, '/')}')" class="px-3 py-1.5 text-[11px] font-bold ${isActive ? 'bg-[#161b22] text-blue-400 border-gray-800' : 'bg-transparent text-gray-500 border-transparent'} border border-b-0 flex items-center gap-3 cursor-pointer relative translate-y-[1px] shadow-2xl rounded-t-lg hover:text-gray-300 transition group whitespace-nowrap shrink-0">
                    <span class="flex items-center gap-2 truncate max-w-[160px]">
                         <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" class="shrink-0 ${isActive ? 'text-blue-500' : 'text-gray-700'}"><circle cx="12" cy="12" r="10"/></svg>
                         <span class="truncate">${f.name}</span>
                    </span>
                    <button onclick="event.stopPropagation(); window.closeTab('${f.path.replace(/\\/g, '/')}')" class="hover:text-red-400 transition ml-2 opacity-30 group-hover:opacity-100 shrink-0">×</button>
                </div>
            `;
        }).join('');

        // Layout Logic
        if (!activeFileLeft) {
            placeholder.classList.remove('hidden');
            containerLeft.classList.add('hidden');
            containerRight.classList.add('hidden');
            dragBar.classList.add('hidden');
            
            // Fix: Reset layout to centered flex-col when empty
            area.style.display = 'flex';
            area.classList.add('flex-col');
            area.style.gridTemplateColumns = '';
            return;
        }

        placeholder.classList.add('hidden');
        containerLeft.classList.remove('hidden');

        // Layout Logic - HARDENED GRID SYSTEM
        if (state.isSplitMode) {
            area.classList.remove('flex-col');
            area.style.display = 'grid';
            // Default 50/50 if not dragged yet
            const p = containerLeft.dataset.splitPerc || '50';
            area.style.gridTemplateColumns = `${p}% 4px 1fr`;
            
            containerRight.classList.remove('hidden');
            dragBar.classList.remove('hidden');
            dragBar.style.width = '4px';
        } else {
            area.style.display = 'flex';
            area.classList.add('flex-col');
            area.style.gridTemplateColumns = '';
            
            containerRight.classList.add('hidden');
            dragBar.classList.add('hidden');
            containerLeft.style.flex = "1";
            containerLeft.style.maxWidth = "100%";
        }

        // Editor Loading & Model Sync
        const updateEditor = (ed, file) => {
            if (!file || file.loading || file.error) return;
            
            let lang = 'javascript';
            if (file.name.endsWith('.html')) lang = 'html';
            else if (file.name.endsWith('.css')) lang = 'css';
            else if (file.name.endsWith('.py')) lang = 'python';
            else if (file.name.endsWith('.java')) lang = 'java';

            const model = ed.getModel();
            const val = file.content || '';
            if (model.getValue() !== val) {
                ignoreStateUpdate = true;
                ed.setValue(val);
                ignoreStateUpdate = false;
            }
            monaco.editor.setModelLanguage(model, lang);
        };

        updateEditor(editor, activeFileLeft);
        if (state.isSplitMode && activeFileRight) {
            updateEditor(editorRight, activeFileRight);
        }

        // [GX Split] Layout Refresh v6-STABLE-FIX
        if (editor) editor.layout();
        if (editorRight) editorRight.layout();
        
        // ─── Search Focus (Restore) ─────────────────────────────────────────
        if (state.searchLineToFocus) {
            const line = parseInt(state.searchLineToFocus);
            const query = state.searchColumnQuery || '';
            let col = 1;
            const val = activeFileLeft.content || '';
            
            if (query && val) {
                const lines = val.split('\n');
                if (lines[line - 1]) {
                    const idx = lines[line - 1].toLowerCase().indexOf(query.toLowerCase());
                    if (idx !== -1) col = idx + 1;
                }
            }

            state.searchLineToFocus = null;
            state.searchColumnQuery = null;

            setTimeout(() => {
                editor.layout();
                editor.revealLineInCenter(line);
                editor.setPosition({ lineNumber: line, column: col });
                editor.focus();
                
                if (query) {
                    editor.setSelection({
                        startLineNumber: line,
                        startColumn: col,
                        endLineNumber: line,
                        endColumn: col + query.length
                    });
                }

                const tempDecorations = editor.deltaDecorations([], [{
                    range: new monaco.Range(line, 1, line, 1),
                    options: {
                        isWholeLine: true,
                        className: 'bg-blue-500/20',
                        linesDecorationsClassName: 'bg-blue-500 w-1'
                    }
                }]);
                setTimeout(() => editor.deltaDecorations(tempDecorations, []), 2500);
            }, 400);
        }
    }
    
    // [GX Split] Update Listener (Optimized v8-STABLE)
    subscribe((newState, oldState) => {
        const themeChanged = newState.activeCgxTheme !== oldState?.activeCgxTheme;
        const fileChanged = newState.activeFileId !== oldState?.activeFileId;
        const listChanged = newState.openFiles !== oldState?.openFiles;
        const bpsChanged = newState.breakpoints !== oldState?.breakpoints;
        const workspaceChanged = newState.workspaceData !== oldState?.workspaceData;
        const expandedChanged = newState.expandedFolders !== oldState?.expandedFolders;

        if (editor && themeChanged) {
            const isLight = newState.activeCgxTheme === 'light' || newState.activeCgxTheme === 'apple' || newState.activeCgxTheme === 'aero';
            editor.updateOptions({ theme: isLight ? 'gx-light' : 'gx-dark' });
        }

        if (fileChanged || listChanged || workspaceChanged || expandedChanged) {
            renderWorkspace();
            renderActiveFile();
        }

        if (fileChanged || bpsChanged) {
            updateBreakpointDecorations();
        }

        if (fileChanged || newState.debugActiveLine !== oldState?.debugActiveLine) {
            updateDebugActiveLine();
        }

        // Autosave Workspace Path for next session
        if (newState.workspaceData?.path && newState.workspaceData.path !== oldState?.workspaceData?.path) {
            localStorage.setItem('gx-last-workspace', newState.workspaceData.path);
        }
    });

    // Aggiungiamo scorciatoia globale Alt + F per Formattazione
    window.addEventListener('keydown', (e) => {
        if (e.altKey && e.key === 'ArrowLeft') {
            e.preventDefault();
            window.navigateTab('left');
        }
        if (e.altKey && e.key === 'ArrowRight') {
            e.preventDefault();
            window.navigateTab('right');
        }
        if (e.altKey && e.key.toLowerCase() === 'f') {
            e.preventDefault();
            window.simulateFormatting();
        }
    });

    
// ── Global Actions for Shortcuts ───────────────────────────────────────────
window.saveActiveFile = async () => {
    if (!editor || !state.activeFileId) return;
    
    const content = editor.getValue();
    const path = state.activeFileId;
    
    console.log(`[GX-SHORTCUT] Saving active file: ${path}`);
    try {
        await window.electronAPI.fsWriteFile(path, content);
        // Dispatch event for UI feedback (optional)
        console.log(`[GX-SHORTCUT] File saved successfully.`);
    } catch (err) {
        console.error(`[GX-SHORTCUT] Error saving file: ${err.message}`);
    }
};

window.formatActiveFile = () => {
    if (!editor) return;
    console.log(`[GX-SHORTCUT] Formatting active file.`);
    editor.getAction('editor.action.formatDocument').run();
};

window.toggleSidebar = () => {
    setState({ isLeftSidebarOpen: !state.isLeftSidebarOpen });
};

// Esportiamo per compatibilità legacy se necessario
window.renderWorkspace = renderWorkspace;
    setTimeout(async () => {
        const lastWorkspace = localStorage.getItem('gx-last-workspace');
        if (lastWorkspace && window.electronAPI && window.electronAPI.openSpecificFolder) {
            try {
                const data = await window.electronAPI.openSpecificFolder(lastWorkspace);
                if (data && !data.error) {
                    console.log(`[GX Session] Ripristinando l'ultimo progetto: ${lastWorkspace}`);
                    setState({ workspaceData: data });
                }
            } catch (err) {
                console.error("[GX Session] Errore ripristino cartella:", err);
            }
        }
    }, 100);
};

window.switchTab = (path) => {
    const normalizedPath = path.replace(/\//g, '\\');
    setState({ activeFileId: normalizedPath });
};

window.closeTab = (path) => {
    // Normalizzazione aggressiva per Windows
    const normalizedPath = path.replace(/\//g, '\\').toLowerCase();
    const openFiles = state.openFiles.filter(f => f.path.replace(/\//g, '\\').toLowerCase() !== normalizedPath);
    
    let activeFileId = state.activeFileId;
    if (activeFileId && activeFileId.replace(/\//g, '\\').toLowerCase() === normalizedPath) {
        activeFileId = openFiles.length > 0 ? openFiles[openFiles.length - 1].path : null;
    }
    
    setState({ openFiles, activeFileId });
};

window.simulateFormatting = () => {
    if (!editor) return;
    
    const originalText = editor.getValue();
    const activeFileId = state.activeFileId;
    
    console.log("[GX Addon] Formatting with Prettier simulation...");
    
    // Mostriamo un effetto di finto caricamento
    const btn = document.querySelector('button[onclick="window.simulateFormatting()"]');
    if (btn) btn.innerHTML = '<span class="animate-spin mr-1">↻</span> Formatting...';

    setTimeout(() => {
        // Simuliamo un "beauty" di base
        let formatted = originalText.trim().split('\n').map(line => line.trim()).join('\n    ');
        editor.setValue(formatted);
        
        if (btn) btn.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg> Format with Prettier';
        console.log("[GX Addon] Prettier integration finished.");
    }, 800);
};

// ─── Tab Bar Enhancements ────────────────────────────────────────────────────
window.scrollTabs = (direction) => {
    const tabs = document.getElementById('workspace-tabs');
    if (!tabs) return;
    const scrollAmount = 200;
    if (direction === 'left') {
        tabs.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
    } else {
        tabs.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
};


window.showFileDiff = async () => {
    const activeFileId = state.activeFileId;
    if (!activeFileId || !state.workspaceData?.path) return;
    
    // Mostriamo un caricamento rapido
    const originalBtnHtml = document.querySelector('[onclick="window.showFileDiff()"]')?.innerHTML;
    const btn = document.querySelector('[onclick="window.showFileDiff()"]');
    if (btn) btn.innerHTML = '<svg class="animate-spin" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>';

    try {
        const workspacePath = state.workspaceData.path;
        const headRes = await window.electronAPI.gitShowHead(workspacePath, activeFileId);
        const currentContent = editor.getValue();
        
        // Creiamo la modale
        const modal = document.createElement('div');
        modal.id = 'gx-diff-modal';
        modal.className = 'fixed inset-0 z-[1000000] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in p-6 md:p-12';
        modal.innerHTML = `
            <div class="bg-[#0d1117] border border-gray-800 rounded-xl w-full h-full flex flex-col shadow-2xl overflow-hidden animate-scale-up">
                <div class="px-6 py-4 border-b border-gray-800 flex justify-between items-center bg-[#161b22]">
                    <div class="flex items-center gap-3">
                        <div class="p-2 bg-blue-500/10 rounded-lg">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2188ff" stroke-width="2.5"><path d="M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8Z"/><path d="M15 3v5h5"/><path d="M12 12v6"/><path d="M9 15h6"/></svg>
                        </div>
                        <div>
                            <h3 class="text-[11px] font-bold text-gray-200 uppercase tracking-[0.2em]">Cambiamenti File (Git Diff)</h3>
                            <p class="text-[9px] text-gray-500 font-mono mt-0.5 opacity-70">${activeFileId}</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-4">
                        <div class="text-[9px] font-bold py-1 px-2 rounded bg-gray-800 text-gray-400 border border-gray-700">ESC per uscire</div>
                        <button onclick="document.getElementById('gx-diff-modal').remove()" class="p-1.5 hover:bg-white/5 text-gray-500 hover:text-white transition rounded-md text-xl">✕</button>
                    </div>
                </div>
                <div id="monaco-diff-container" class="flex-1 min-h-0 bg-[#0d1117]"></div>
                <div class="px-6 py-3 border-t border-gray-800 bg-[#0a0d12] flex justify-between items-center">
                    <div class="flex gap-4">
                        <div class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-red-500/50"></span> <span class="text-[9px] text-gray-500 uppercase font-bold tracking-wider">Originale (HEAD)</span></div>
                        <div class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-emerald-500/50"></span> <span class="text-[9px] text-gray-500 uppercase font-bold tracking-wider">Modificato</span></div>
                    </div>
                    <button onclick="document.getElementById('gx-diff-modal').remove()" class="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold uppercase rounded transition">Chiudi</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        // Handler per chiusura con ESC
        const escHandler = (e) => {
           if (e.key === 'Escape') {
               modal.remove();
               window.removeEventListener('keydown', escHandler);
           }
        };
        window.addEventListener('keydown', escHandler);

        // Inizializziamo Monaco Diff Editor
        const container = document.getElementById('monaco-diff-container');
        const diffEditor = monaco.editor.createDiffEditor(container, {
            theme: state.activeCgxTheme.includes('light') ? 'gx-light' : 'gx-dark',
            automaticLayout: true,
            readOnly: true,
            renderSideBySide: true,
            fontSize: 12,
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            minimap: { enabled: false },
            originalEditable: false
        });

        const originalContent = headRes.success ? headRes.content : '';
        const ext = activeFileId.split('.').pop();
        let lang = 'javascript';
        if (['js','ts','jsx','tsx'].includes(ext)) lang = 'javascript';
        else if (ext === 'html') lang = 'html';
        else if (ext === 'css') lang = 'css';
        else if (ext === 'json') lang = 'json';

        diffEditor.setModel({
            original: monaco.editor.createModel(originalContent, lang),
            modified: monaco.editor.createModel(currentContent, lang)
        });

    } catch (err) {
        console.error("Diff Error:", err);
        alert("Impossibile generare il diff.");
    } finally {
        if (btn) btn.innerHTML = originalBtnHtml;
    }
};

// ─── Drag Resize Logic ───────────────────────────────────────────────────────
const initSplitResize = () => {
    if (window._splitResizeInitialized) return;
    
    const dragBar = document.getElementById('editor-split-drag-bar');
    const containerLeft = document.getElementById('monaco-editor-container');
    const area = document.getElementById('hub-content-area');
    
    if (!dragBar || !containerLeft || !area) {
        console.warn("[GX Split] Components not ready for resize init, retrying...");
        setTimeout(initSplitResize, 1000);
        return;
    }

    console.log("[GX Split] Initializing Vertical Drag bar listeners.");
    window._splitResizeInitialized = true;
    let isDragging = false;

    dragBar.addEventListener('mousedown', (e) => {
        isDragging = true;
        document.body.style.cursor = 'col-resize';
        dragBar.classList.add('!bg-blue-500');
        document.body.style.userSelect = 'none'; 
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const rect = area.getBoundingClientRect();
        const offset = e.clientX - rect.left;
        const percentage = (offset / rect.width) * 100;
        
        if (percentage > 5 && percentage < 95) {
            if (area.style.display === 'grid') {
                area.style.gridTemplateColumns = `${percentage}% 4px 1fr`;
            } else {
                containerLeft.style.flex = `0 0 ${percentage}%`;
                containerLeft.style.maxWidth = `${percentage}%`;
            }
            containerLeft.dataset.splitPerc = percentage;
            
            // Layout refresh immediate for smooth feel
            if (editor) editor.layout();
            if (editorRight) editorRight.layout();
        }
    });

    window.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            document.body.style.cursor = 'default';
            dragBar.classList.remove('!bg-blue-500');
            document.body.style.userSelect = '';
        }
    });
};

// Start initialization attempt
setTimeout(initSplitResize, 500);
