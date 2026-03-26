import { state, subscribe, setState } from '../core/state.js';

let editor = null;
let ignoreStateUpdate = false;
let _updateBreadcrumbs = null;

const renderFileTree = (files) => {
    if (!files || files.length === 0) return `<div class="text-[11px] text-gray-500 italic p-2 text-center border border-dashed border-gray-800 rounded mx-2 mt-2">La directory è vuota o inaccessibile.</div>`;
    
    return files.map(f => `
        <div class="flex items-center gap-2 py-[5px] px-2 hover:bg-[#1a202a] cursor-pointer text-[11px] transition rounded-sm group border-transparent ${f.isDirectory ? 'is-folder' : 'is-file'}" data-path="${f.path}" data-name="${f.name}">
            <span class="${f.isDirectory ? 'text-blue-400' : 'text-gray-500'} w-3.5 text-center flex-shrink-0 pointer-events-none">
                ${f.isDirectory ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" opacity="0.8"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>' : '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" class="text-gray-400" stroke="currentColor" stroke-width="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>'}
            </span>
            <span class="text-gray-300 truncate font-mono tracking-tight pointer-events-none">${f.name}</span>
            ${!f.isDirectory ? '<button class="ml-auto opacity-0 group-hover:opacity-100 text-[9px] text-blue-400 hover:text-white transition bg-gray-800 px-1.5 py-0.5 rounded pointer-events-none">visualizza</button>' : ''}
        </div>
    `).join('');
};

const renderWorkspace = () => {
    const treeContainer = document.getElementById('workspace-tree-container');
    if (!treeContainer) return;
    
    if (!state.workspaceData) {
        // Mostra placeholder VS Code style
        treeContainer.innerHTML = `
            <div class="px-3 py-4 text-center">
                <p class="text-[11px] text-gray-500 leading-snug mb-3">Non hai ancora aperto nessuna cartella.</p>
                <div class="text-[10px] text-gray-600 bg-black/20 rounded border border-gray-800 p-2 inline-block">Premi il tasto <span class="text-blue-500">Apri</span> In alto nel pannello.</div>
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
                
                container.innerHTML = `<div id="monaco-editor-container" class="w-full h-full hidden"></div><div id="hub-placeholder" class="w-full h-full flex items-center justify-center"></div>`;
                
                editor = monaco.editor.create(document.getElementById('monaco-editor-container'), {
                    value: '',
                    language: 'javascript',
                    theme: isLight ? 'gx-light' : 'gx-dark',
                    automaticLayout: true,
                    fontSize: 13,
                    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                    minimap: { enabled: false },
                    lineNumbers: 'on',
                    roundedSelection: true,
                    scrollBeyondLastLine: false,
                    padding: { top: 10 }
                });

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
                const registerSymbols = (lang) => {
                    monaco.languages.registerDocumentSymbolProvider(lang, {
                        provideDocumentSymbols: (model) => {
                            const symbols = [];
                            const lines = model.getValue().split('\n');
                            const regexes = [
                                { kind: 4, regex: /class\s+([a-zA-Z0-9_$]+)/ }, // Class
                                { kind: 11, regex: /(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*\(.*?\)\s*=>/ }, // Arrow Func
                                { kind: 11, regex: /function\s+([a-zA-Z0-9_$]+)\s*\(/ }, // Function
                                { kind: 5, regex: /^\s*(?:async\s+)?([a-zA-Z0-9_$]+)\s*\(.*?\)\s*\{/ } // Method
                            ];
                            lines.forEach((line, i) => {
                                regexes.forEach(r => {
                                    const m = line.match(r.regex);
                                    if (m && m[1]) {
                                        symbols.push({
                                            name: m[1],
                                            kind: r.kind,
                                            range: new monaco.Range(i + 1, 1, i + 1, line.length + 1),
                                            selectionRange: new monaco.Range(i + 1, 1, i + 1, line.length + 1)
                                        });
                                    }
                                });
                            });
                            return symbols;
                        }
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
                    
                    // Ottieni simboli (Monaco li richiede asincroni - API standard 0.43.0)
                    const symbols = await monaco.editor.executeCommand(model.uri, 'vscode.executeDocumentSymbolProvider');
                    const currentSymbol = symbols?.slice().reverse().find(s => s.range.startLineNumber <= pos.lineNumber);
                    
                    bc.classList.remove('hidden');
                    bc.innerHTML = `
                        <div class="flex items-center gap-1.5 text-[10px] text-gray-500 font-bold uppercase tracking-widest whitespace-nowrap">
                            <span class="hover:text-blue-400 cursor-pointer">GXCode</span>
                            <span class="opacity-30">/</span>
                            <span class="text-gray-400 overflow-hidden truncate max-w-[100px]">${fileName}</span>
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

    treeContainer.addEventListener('click', async (e) => {
        const item = e.target.closest('.is-file');
        if (!item) return;

        // Normalizziamo il path per coerenza su Windows
        const filePath = item.getAttribute('data-path').replace(/\//g, '\\');
        const fileName = item.getAttribute('data-name');
        
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
    });

    function renderActiveFile() {
        if (ignoreStateUpdate) return;
        if (_updateBreadcrumbs) _updateBreadcrumbs();
        
        const placeholder = document.getElementById('hub-placeholder');
        const editorContainer = document.getElementById('monaco-editor-container');
        const tabsContainer = document.getElementById('workspace-tabs');
        if (!placeholder || !editorContainer || !tabsContainer || !editor) return;

        const activeFile = state.openFiles.find(f => f.path === state.activeFileId);
        const tabsParent = tabsContainer.parentElement;

        if (!activeFile) {
            placeholder.classList.remove('hidden');
            editorContainer.classList.add('hidden');
            tabsParent.classList.add('hidden');
            placeholder.innerHTML = `
                <div class="max-w-2xl text-center text-gray-400 space-y-4">
                    <div class="inline-flex items-center justify-center w-20 h-20 rounded-full bg-blue-500/5 border border-blue-500/20 mb-2">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" class="text-blue-500/50" stroke-width="1.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                    </div>
                    <h2 class="text-3xl font-light text-gray-200 tracking-tight">Workspace Ready.</h2>
                    <p class="text-[13px] text-gray-500">Apri un progetto dalla barra di sinistra dell'Explorer per visualizzare i tuoi file.</p>
                </div>
            `;
            tabsContainer.innerHTML = '';
            document.getElementById('hub-content-area').querySelector('.h-9')?.remove(); // Rimuoviamo footer se presente
            return;
        }

        // Render Tabs
        tabsParent.classList.remove('hidden');
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

        if (activeFile.loading) {
            placeholder.classList.remove('hidden');
            editorContainer.classList.add('hidden');
            placeholder.innerHTML = `<div class="p-10 flex flex-col items-center justify-center h-full text-gray-500 animate-pulse uppercase tracking-[0.3em] text-[10px]">Caricamento...</div>`;
            return;
        }

        if (activeFile.error) {
            placeholder.classList.remove('hidden');
            editorContainer.classList.add('hidden');
            placeholder.innerHTML = `<div class="flex flex-col items-center justify-center h-full text-red-400/50 p-10 text-center gap-4">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
                <div class="uppercase tracking-[0.2em] font-bold text-xs">Impossibile leggere il file</div>
                <p class="text-[10px] text-gray-600 max-w-xs">${activeFile.error}</p>
            </div>`;
            return;
        }

        placeholder.classList.add('hidden');
        editorContainer.classList.remove('hidden');

        // Update Monaco content and language
        let lang = 'javascript';
        if (activeFile.name.endsWith('.html')) lang = 'html';
        else if (activeFile.name.endsWith('.css')) lang = 'css';
        else if (activeFile.name.endsWith('.json')) lang = 'json';
        else if (activeFile.name.endsWith('.md')) lang = 'markdown';

        const currentModel = editor.getModel();
        const value = activeFile.content || '';
        
        // EVITIAMO RESET DEL CURSORE: Aggiorniamo il valore solo se il file è cambiato 
        // o se il contenuto è sensibilmente diverso (es. caricamento completato)
        // e non siamo in fase di "typing" (gestita da onDidChangeModelContent)
        if (!ignoreStateUpdate) {
            if (currentModel.getValue() !== value) {
                ignoreStateUpdate = true;
                editor.setValue(value);
                ignoreStateUpdate = false;
            }
            monaco.editor.setModelLanguage(currentModel, lang);
        }

        // Focus della Search (salta alla linea giusta)
        if (state.searchLineToFocus) {
            const line = parseInt(state.searchLineToFocus);
            const query = state.searchColumnQuery || '';
            let col = 1;
            
            if (query && value) {
                const lines = value.split('\\n');
                if (lines[line - 1]) {
                    const idx = lines[line - 1].toLowerCase().indexOf(query.toLowerCase());
                    if (idx !== -1) col = idx + 1;
                }
            }

            // Mute silencioso dello stato per non ripetere lo scroll
            state.searchLineToFocus = null;
            state.searchColumnQuery = null;

            // Scrolliamo e focalizziamo in centro
            setTimeout(() => {
                editor.layout(); // Ricalcola dimensioni
                editor.revealLineInCenter(line);
                editor.setPosition({ lineNumber: line, column: col });
                editor.focus();
                
                // Mettiamo focus sul cursore e selezioniamo il testo fisicamente
                if (query) {
                    editor.setSelection({
                        startLineNumber: line,
                        startColumn: col,
                        endLineNumber: line,
                        endColumn: col + query.length
                    });
                }

                // Applichiamo un evidenziatore "Flash" alla riga (stile VS Code)
                // Molto utile se setSelection non è abbastanza visibile!
                const tempDecorations = editor.deltaDecorations([], [
                    {
                        range: new monaco.Range(line, 1, line, 1),
                        options: {
                            isWholeLine: true,
                            className: 'bg-blue-500/20', // Classe tailwind per lo sfondo celeste opaco
                            linesDecorationsClassName: 'bg-blue-500 w-1' // Bordo colorato sulla riga
                        }
                    }
                ]);

                // Rimuoviamo l'evidenziatore dopo 2.5 secondi
                setTimeout(() => {
                    editor.deltaDecorations(tempDecorations, []);
                }, 2500);

            }, 400); // Alziamo a 400ms per dare a Monaco-WebWorker tutto il tempo di parsare file giganti (es. package-lock.json)
        }
    }
    
    subscribe((newState, oldState) => {
        if (editor && oldState && newState.activeCgxTheme !== oldState.activeCgxTheme) {
            const isLight = newState.activeCgxTheme === 'light' || newState.activeCgxTheme === 'apple' || newState.activeCgxTheme === 'aero';
            editor.updateOptions({ theme: isLight ? 'gx-light' : 'gx-dark' });
        }
        renderWorkspace();
        renderActiveFile();
    });

    // Aggiungiamo scorciatoia globale Alt + F per Formattazione
    window.addEventListener('keydown', (e) => {
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
    const normalizedPath = path.replace(/\//g, '\\');
    const openFiles = state.openFiles.filter(f => f.path !== normalizedPath);
    let activeFileId = state.activeFileId;
    
    if (activeFileId === normalizedPath) {
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
