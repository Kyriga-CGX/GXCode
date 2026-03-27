import { state, subscribe, setState } from '../core/state.js';
import { showContextMenu } from './contextMenu.js';

let editor = null;
let editorRight = null;
let ignoreStateUpdate = false;
let _updateBreadcrumbs = null;
let breakpointDecorations = [];
let debugActiveDecorations = [];
let updateBreakpointDecorations = () => {};
let updateDebugActiveLine = () => {};
let getDocumentSymbols = () => [];

const normalizePath = (p) => {
    if (!p) return "";
    return p.replace(/\//g, '\\').toLowerCase();
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
    treeContainer.innerHTML = renderFileTree(ws.files);
};

export const initWorkspace = () => {
    const btnOpen = document.getElementById('btn-open-folder');
    const treeContainer = document.getElementById('workspace-tree-container');
    if (!btnOpen || !treeContainer) return;

    // Refresh Git Status in background on Load & Periodically
    const refreshGit = () => { if (window.renderGit) window.renderGit(); };
    refreshGit();
    setInterval(refreshGit, 10000); // Poll ogni 10s per cambiamenti esterni/salvataggi
    
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
                
                const createOptions = (isLight) => ({
                    value: '',
                    language: 'javascript',
                    theme: isLight ? 'gx-light' : 'gx-dark',
                    automaticLayout: true,
                    fontSize: 13,
                    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                    minimap: { enabled: true, showSlider: 'mouseover', maxColumn: 80 },
                    lineNumbers: 'on',
                    glyphMargin: true,
                    roundedSelection: true,
                    scrollBeyondLastLine: false,
                    padding: { top: 10 },
                    lineDecorationsWidth: 10,
                });

                editor = monaco.editor.create(document.getElementById('monaco-editor-container'), createOptions(isLight));
                editorRight = monaco.editor.create(document.getElementById('monaco-editor-container-right'), createOptions(isLight));
                
                editor.updateOptions({ glyphMargin: true });
                editorRight.updateOptions({ glyphMargin: true });

                // Ghost Breakpoint on Hover
                let ghostDecoration = [];
                editor.onMouseMove((e) => {
                    if (e.target.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN || e.target.type === monaco.editor.MouseTargetType.GUTTER_LINE_NUMBERS) {
                        const line = e.target.position.lineNumber;
                        ghostDecoration = editor.deltaDecorations(ghostDecoration, [{
                            range: new monaco.Range(line, 1, line, 1),
                            options: {
                                glyphMarginClassName: 'monaco-breakpoint-ghost',
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
                    const activeFileId = state.activeFileId;
                    if (!activeFileId) return;

                    if (e.target.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN || e.target.type === monaco.editor.MouseTargetType.GUTTER_LINE_NUMBERS) {
                        const line = e.target.position.lineNumber;
                        const normActive = normalizePath(activeFileId);
                        console.log("[Monaco Debug] Toggle breakpoint on line:", line, "path:", normActive);
                        
                        let breakpoints = [...state.breakpoints];
                        const idx = breakpoints.findIndex(bp => normalizePath(bp.path) === normActive && bp.line === line);

                        if (idx !== -1) {
                            breakpoints.splice(idx, 1);
                        } else {
                            breakpoints.push({ path: activeFileId, line: line });
                        }
                        setState({ breakpoints });
                    }
                });

                updateBreakpointDecorations = () => {
                    const activeFileId = state.activeFileId;
                    if (!activeFileId || !editor) return;

                    const normActive = normalizePath(activeFileId);
                    const activeBreakpoints = state.breakpoints.filter(bp => normalizePath(bp.path) === normActive);
                    
                    console.log(`[Monaco Debug] Updating decorations for ${normActive}. Count: ${activeBreakpoints.length}`);
                    
                    const newDecorations = activeBreakpoints.map(bp => ({
                        range: new monaco.Range(bp.line, 1, bp.line, 1),
                        options: {
                            isWholeLine: false,
                            glyphMarginClassName: 'monaco-breakpoint-gutter',
                            linesDecorationsClassName: 'monaco-breakpoint-line-hint',
                            glyphMarginHoverMessage: { value: 'Breakpoint' },
                            stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges
                        }
                    }));

                    breakpointDecorations = editor.deltaDecorations(breakpointDecorations, newDecorations);
                };

                updateDebugActiveLine = () => {
                    const activeLine = state.debugActiveLine;
                    if (!activeLine || !editor || !editor.getModel()) {
                        debugActiveDecorations = editor.deltaDecorations(debugActiveDecorations, []);
                        return;
                    }

                    console.log("[Monaco Debug] Highlighting active line:", activeLine);
                    debugActiveDecorations = editor.deltaDecorations(debugActiveDecorations, [
                        {
                            range: new monaco.Range(activeLine, 1, activeLine, 1),
                            options: {
                                isWholeLine: true,
                                className: 'monaco-debug-active-line',
                                glyphMarginClassName: 'monaco-debug-active-glyph'
                            }
                        }
                    ]);
                    
                    editor.revealLineInCenterIfOutsideViewport(activeLine);
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

                // Listener Globale per i Problemi (Diagnostica)
                monaco.editor.onDidChangeMarkers(([uri]) => {
                    const markers = monaco.editor.getModelMarkers({ resource: uri });
                    const allMarkers = monaco.editor.getModelMarkers({});
                    
                    // Solo errori e avvisi (Severity >= 3 in Monaco è Error/Warning)
                    const seriousIssues = allMarkers.filter(m => m.severity >= 3);
                    
                    setState({ 
                        problems: seriousIssues.map(m => ({
                            message: m.message,
                            severity: m.severity, // 3: Warning, 4: Error
                            resource: m.resource.toString(),
                            path: m.resource.path,
                            startLine: m.startLineNumber,
                            startColumn: m.startColumn,
                            source: m.source || 'Monaco'
                        })) 
                    });
                });

                _updateBreadcrumbs = updateBreadcrumbs;
                renderActiveFile();
            } catch (err) {
                console.error("[GXCode] Errore inizializzazione Monaco:", err);
            }
        });
    }

    btnOpen.onclick = async () => {
        if (!window.electronAPI || !window.electronAPI.openFolder) {
            console.error("IPC bridge non trovato per openFolder.");
            return;
        }
        
        const originalHtml = btnOpen.innerHTML;
        btnOpen.innerHTML = '<span class="animate-pulse">Loading OS System...</span>';
        
        try {
            const data = await window.electronAPI.openFolder();
            if (data && !data.error) {
                localStorage.setItem('gx-last-workspace', data.path);
                setState({ workspaceData: data });
            }
        } catch (err) {
            console.error(err);
        }
        btnOpen.innerHTML = originalHtml;
    };

    treeContainer.oncontextmenu = (e) => {
        const item = e.target.closest('.is-file, .is-folder');
        if (!item) return;
        const path = item.getAttribute('data-path').replace(/\//g, '\\');
        const isFolder = item.classList.contains('is-folder');
        showContextMenu(e, path, isFolder);
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
                
                await findAndAddChildren(state.workspaceData.files);
            }
        } else {
            // Logica apertura File (esistente)
            const filePath = path;
            const fileName = name;
            
            let openFiles = [...state.openFiles];
            const existing = openFiles.find(f => f.path === filePath);

            if (!existing) {
                openFiles.push({ name: fileName, path: filePath, content: null, loading: true, error: null });
                setState({ openFiles, activeFileId: filePath });

                try {
                    const content = await window.electronAPI.readFile(filePath);
                    openFiles = state.openFiles.map(f => f.path === filePath ? { ...f, content, loading: false } : f);
                    setState({ openFiles });
                } catch (err) {
                    console.error("Errore lettura file:", err);
                    openFiles = state.openFiles.map(f => f.path === filePath ? { ...f, content: null, loading: false, error: err.message } : f);
                    setState({ openFiles });
                }
            } else {
                setState({ activeFileId: filePath });
            }
        }
    });

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
        tabsContainer.innerHTML = state.openFiles.map(f => {
            const isActive = f.path === state.activeFileId;
            return `
                <div onclick="window.switchTab('${f.path.replace(/\\/g, '/')}')" class="px-3 py-1.5 text-[11px] font-bold ${isActive ? 'bg-[#161b22] text-blue-400 border-gray-800' : 'bg-transparent text-gray-500 border-transparent'} border border-b-0 inline-flex items-center gap-3 cursor-pointer relative translate-y-[1px] shadow-2xl rounded-t-lg hover:text-gray-300 transition group">
                    <span class="flex items-center gap-2">
                         <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" class="${isActive ? 'text-blue-500' : 'text-gray-700'}"><circle cx="12" cy="12" r="10"/></svg>
                         ${f.name}
                    </span>
                    <button onclick="event.stopPropagation(); window.closeTab('${f.path.replace(/\\/g, '/')}')" class="hover:text-red-400 transition ml-2 opacity-30 group-hover:opacity-100">×</button>
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

        // Layout Refresh avec timeout pour refléter les changements du DOM
        // Layout Refresh aggressivo - CRITICAL FIX v5
        const refresh = () => {
            console.log("[GX Split] Forced Layout Refresh Triggered v5");
            if (editor) editor.layout();
            if (editorRight) editorRight.layout();
            window.dispatchEvent(new Event('resize'));
        };
        refresh(); 
        setTimeout(refresh, 50);
        setTimeout(refresh, 250);
        setTimeout(refresh, 800);
        setTimeout(refresh, 2500); 

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
    
    subscribe((newState, oldState) => {
        if (editor && oldState && newState.activeCgxTheme !== oldState.activeCgxTheme) {
            const isLight = newState.activeCgxTheme === 'light' || newState.activeCgxTheme === 'apple' || newState.activeCgxTheme === 'aero';
            editor.updateOptions({ theme: isLight ? 'gx-light' : 'gx-dark' });
        }
        renderWorkspace();
        renderActiveFile();
        updateBreakpointDecorations();
        updateDebugActiveLine();
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

    // Ripristino Automatico Ultima Sessione di Lavoro (Workspace)
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

window.showFileDiff = () => {
    const activeFileId = state.activeFileId;
    if (!activeFileId) return;
    
    // Placeholder logic for Show Changes
    const t = document.createElement('div');
    t.innerHTML = `<div style="position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); background:#0d1117; border:1px solid #30363d; padding:20px; border-radius:8px; z-index:10000; box-shadow:0 10px 40px rgba(0,0,0,0.5); text-align:center;">
        <h3 style="color:#c9d1d9; margin-bottom:10px;">Show Changes</h3>
        <p style="color:#8b949e; font-size:12px;">Confronto modifiche per: <b>${activeFileId.split('/').pop()}</b></p>
        <div style="margin-top:20px; color:#2188ff; font-size:11px; cursor:pointer;" onclick="this.parentElement.remove()">Chiudi</div>
    </div>`;
    document.body.appendChild(t);
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
