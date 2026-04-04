import { state, subscribe } from '../core/state.js';

let terminals = {}; // terminalId -> { term, fitAddon, container, shellType, ... }
let activeTerminalId = null;
let isInitialized = false;
let lastOpenedUrls = new Map(); // url -> timestamp
const AUTO_OPEN_COOLDOWN = 10000; // 10 secondi

export async function initTerminal() {
    const targetContainer = document.getElementById('pane-terminal');
    if (!targetContainer || isInitialized) return;
    
    isInitialized = true;

    targetContainer.innerHTML = `
        <div class="flex flex-col h-full w-full bg-[var(--bg-main)] overflow-hidden">
            <div id="terminal-shell-header" class="h-8 border-b border-[var(--border-dim)] flex items-center justify-between px-3 shrink-0 bg-[var(--bg-side)]"></div>
            <div id="terminals-stack" class="flex-1 w-full relative overflow-hidden bg-[var(--bg-main)]"></div>
        </div>
    `;

    renderHeader();
    
    subscribe((newState, oldState) => {
        if (newState.workspaceData !== oldState?.workspaceData || newState.activeTerminalFolder !== oldState?.activeTerminalFolder) {
            renderHeader();
        }
    });

    if (activeTerminalId) {
        switchTerminal(activeTerminalId);
    }

    // --- REATTIVITÀ AL BOOT: Creazione primo terminale ---
    // Se non ci sono terminali, aspettiamo che il workspace venga caricato
    let bootTerminalCreated = false;
    const bootCheck = () => {
        if (bootTerminalCreated || Object.keys(terminals).length > 0) return;
        
        const path = state.workspaceData?.path;
        if (path) {
            console.log(`[TERMINAL] Workspace rilevato al boot: ${path}. Creo terminale principale.`);
            bootTerminalCreated = true;
            // Forziamo il percorso del workspace per il primo terminale al boot
            createTerminal('t1', 'ps', path);
        }
    };

    // Sottoscriviamo per reagire al caricamento del workspace
    subscribe(() => bootCheck());
    
    // Eseguiamo un controllo immediato: se il workspace è già caricato da localStorage
    // lo inizializziamo subito senza attendere subscribe o timeout.
    bootCheck();
    
    // Safety Fallback: se dopo 4 secondi (tempo caricamento app/monaco) non c'è ancora un terminale
    setTimeout(() => {
        if (!bootTerminalCreated && Object.keys(terminals).length === 0) {
            console.log("[TERMINAL] Nessun workspace rilevato dopo timeout. Provo a caricare sessione...");
            
            // Proviamo a ri-prendere il path dal workspaceData se si è popolato nel frattempo (es. caricamento lento api)
            const path = state.workspaceData?.path;
            const fallbackPath = path || state.activeTerminalFolder || '';
            
            bootTerminalCreated = true;
            createTerminal('t1', 'ps', fallbackPath);
        }
    }, 4500);

    const resizeObserver = new ResizeObserver(() => {
        Object.values(terminals).forEach(t => t.fitAddon.fit());
    });
    resizeObserver.observe(targetContainer);
}

function getWorkspaceFolders() {
    if (state.workspaceData?.isWorkspace) {
        return state.files || [];
    } else if (state.workspaceData?.path) {
        return [{ name: state.workspaceData.name || 'Progetto', path: state.workspaceData.path }];
    }
    return [];
}

function renderHeader() {
    const headerContainer = document.getElementById('terminal-shell-header');
    if (!headerContainer) return;

    headerContainer.innerHTML = `
        <div class="flex items-center gap-3 overflow-hidden">
            <div class="flex items-center gap-1 overflow-x-auto no-scrollbar" id="terminal-tabs"></div>
        </div>
        
        <div class="flex gap-1 shrink-0 ml-2 items-center">
            <button id="btn-clear-term" class="p-1 px-1.5 text-[8px] font-bold text-red-400 hover:bg-red-500/10 rounded transition uppercase tracking-widest border border-red-500/20 flex items-center gap-1">CLEAR</button>
            <button id="btn-split-term" class="p-1 px-1.5 text-[8px] font-bold text-emerald-400 hover:bg-emerald-500/10 rounded transition uppercase tracking-widest border border-emerald-500/20 flex items-center gap-1">SPLIT</button>
            
            <div class="flex items-center border border-[var(--border-dim)] rounded overflow-hidden ml-1">
                <button id="btn-terminal-add-plus" class="p-1 px-2 text-[10px] font-bold text-gray-300 hover:bg-[var(--bg-side-alt)] transition border-r border-[var(--border-dim)]">+</button>
                <button id="btn-terminal-dropdown" class="p-1 px-1.5 text-[8px] text-gray-400 hover:bg-[var(--bg-side-alt)] transition">▼</button>
            </div>
        </div>
    `;

    renderTabs();

    document.getElementById('btn-terminal-add-plus').onclick = (e) => onPlusClick(e);
    document.getElementById('btn-terminal-dropdown').onclick = (e) => showTerminalPlusMenu(e);
    document.getElementById('btn-clear-term').onclick = () => { if (activeTerminalId) terminals[activeTerminalId]?.term.clear(); };
    document.getElementById('btn-split-term').onclick = () => handleSplit();
}

function onPlusClick(e) {
    const folders = getWorkspaceFolders();
    if (folders.length > 1) {
        const qpItems = folders.map(f => ({
            label: f.name,
            description: f.path,
            icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
            value: f.path
        }));

        import('./dialogs.js').then(m => {
            m.gxQuickPick('Seleziona la cartella di lavoro per il nuovo terminale', qpItems, (path) => {
                if (path) createTerminal('t' + Date.now(), state.defaultShell || 'ps', path);
            });
        });
    } else {
        const targetPath = folders[0]?.path || state.workspaceData?.path || '';
        createTerminal('t' + Date.now(), state.defaultShell || 'ps', targetPath);
    }
}

function showTerminalPlusMenu(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    const modalsRoot = document.getElementById('modals-root');
    if (!modalsRoot) return;

    const existing = document.getElementById('gx-terminal-plus-menu');
    if (existing) { existing.remove(); return; }

    const menu = document.createElement('div');
    menu.id = 'gx-terminal-plus-menu';
    menu.className = 'fixed bg-[var(--bg-side)] border border-[var(--border-dim)] rounded-lg shadow-2xl py-1.5 text-[10px] min-w-[200px] z-[9999999] animate-in fade-in zoom-in duration-100 flex flex-col pointer-events-auto';
    
    const x = Math.max(10, rect.left - 160);
    const y = rect.top - 160; 
    menu.style.left = `${x}px`;
    menu.style.top = `${y > 0 ? y : rect.bottom + 5}px`;

    const shells = [
        { id: 'ps', label: 'PowerShell', icon: 'PS' },
        { id: 'cmd', label: 'Command Prompt', icon: 'CMD' },
        { id: 'bash', label: 'Git Bash', icon: 'BASH' }
    ];

    const folders = getWorkspaceFolders();

    const askForFolder = (onSelect) => {
        if (folders.length <= 1) {
            onSelect(folders[0]?.path || state.workspaceData?.path || '');
            return;
        }
        const qpItems = folders.map(f => ({
            label: f.name,
            description: f.path,
            icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
            value: f.path
        }));
        import('./dialogs.js').then(m => {
            m.gxQuickPick('Seleziona la cartella di lavoro per il nuovo terminale', qpItems, (path) => {
                if (path) onSelect(path);
            });
        });
    };

    const addMenuItem = (label, icon, onClick, isHeader = false) => {
        if (isHeader) {
            const header = document.createElement('div');
            header.className = 'px-3 py-1 text-gray-500 font-bold uppercase tracking-widest text-[8px] mt-1';
            header.innerText = label;
            menu.appendChild(header);
            return;
        }
        const item = document.createElement('div');
        item.className = 'flex items-center px-3 py-1.5 hover:bg-[var(--accent-glow)] cursor-pointer text-[#c9d1d9] transition-all rounded mx-1 group';
        item.innerHTML = `
            <span class="mr-2 text-[8px] font-black opacity-40 group-hover:opacity-100 w-6 text-center">${icon}</span>
            <span class="flex-1">${label}</span>
        `;
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            onClick();
            menu.remove();
            if (!modalsRoot.innerHTML.trim()) modalsRoot.classList.add('pointer-events-none');
        });
        menu.appendChild(item);
    };

    addMenuItem('Scegli Shell', '', null, true);
    shells.forEach(sh => {
        addMenuItem(sh.label, sh.icon, () => {
            askForFolder((path) => {
                createTerminal('t' + Date.now(), sh.id, path);
            });
        });
    });

    modalsRoot.classList.remove('pointer-events-none');
    modalsRoot.appendChild(menu);

    const closeHandler = (e) => {
        if (!menu.contains(e.target)) {
            menu.remove();
            if (!modalsRoot.innerHTML.trim()) modalsRoot.classList.add('pointer-events-none');
            window.removeEventListener('mousedown', closeHandler);
        }
    };
    setTimeout(() => window.addEventListener('mousedown', closeHandler), 10);
}

function handleSplit() {
    const ids = Object.keys(terminals);
    if (ids.length < 2) return;
    const stackContainer = document.getElementById('terminals-stack');
    if (stackContainer) stackContainer.classList.add('flex');
}

export async function createTerminal(id, shellType = 'ps', forcedPath = null) {
    const stackContainer = document.getElementById('terminals-stack');
    if (!stackContainer) return;

    const workspaceRoot = state.workspaceData?.path || '';
    
    // LOGICA DI PRIORITÀ:
    // 1. forcedPath (es. da bootCheck o comando esplicito)
    // 2. workspaceRoot (se activeTerminalFolder non è parte del workspace corrente)
    // 3. activeTerminalFolder (se appartiene al workspace corrente)
    let finalCwd = forcedPath || '';
    
    if (!finalCwd) {
        if (state.activeTerminalFolder && workspaceRoot && state.activeTerminalFolder.startsWith(workspaceRoot)) {
            finalCwd = state.activeTerminalFolder;
        } else {
            finalCwd = workspaceRoot || '';
        }
    }

    const currentFolderPath = finalCwd;
    
    console.log(`[TERMINAL] Creazione terminale in: ${currentFolderPath || 'default/home'} (Workspace Root: ${workspaceRoot})`);
    const allFolders = getWorkspaceFolders();
    const folderName = allFolders.find(f => f.path === currentFolderPath)?.name || 'root';
    
    const labels = { 'ps': 'PS', 'cmd': 'CMD', 'bash': 'BASH', 'claude': 'CLAUDE' };
    const baseLabel = labels[shellType] || 'TERM';
    const tabLabel = `${baseLabel} (${folderName.toUpperCase()})`;

    const colorClasses = { 'ps': 'text-blue-400', 'cmd': 'text-gray-400', 'bash': 'text-orange-400', 'claude': 'text-purple-400' };
    const colorClass = colorClasses[shellType] || 'text-gray-400';

    const termContainer = document.createElement('div');
    termContainer.id = `term-container-${id}`;
    termContainer.className = 'absolute inset-0 p-2 hidden transition-all duration-300';
    stackContainer.appendChild(termContainer);

    const term = new Terminal({
        cursorBlink: true,
        fontSize: 12,
        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
        theme: getTerminalTheme(state.activeCgxTheme),
        allowProposedApi: true
    });

    const fitAddon = new FitAddon.FitAddon();
    term.loadAddon(fitAddon);
    term.open(termContainer);

    await window.electronAPI.terminalCreate(id, shellType, currentFolderPath);
    
    term.onData(data => window.electronAPI.terminalWrite(id, data));
    
    // --- SMART URL DETECTION & INTERACTION ---
    window.electronAPI.onTerminalData(id, (data) => {
        term.write(data);
        
        // Auto-open localhost links (npm start, etc.)
        const urlRegex = /(https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0):[0-9]{3,5})/g;
        let match;
        while ((match = urlRegex.exec(data)) !== null) {
            const url = match[1].replace('0.0.0.0', 'localhost');
            const now = Date.now();
            if (!lastOpenedUrls.has(url) || (now - lastOpenedUrls.get(url)) > AUTO_OPEN_COOLDOWN) {
                console.log(`[TERMINAL] Auto-launching server: ${url}`);
                lastOpenedUrls.set(url, now);
                window.electronAPI.shellOpenExternal(url);
            }
        }
    });

    // Native Link Provider for CTRL + Click
    term.registerLinkProvider({
        provideLinks(bufferLineNumber, callback) {
            const line = term.buffer.active.getLine(bufferLineNumber - 1).translateToString();
            const urlRegex = /(https?:\/\/[^\s^"^'^<]+)/g;
            let match;
            const links = [];
            while ((match = urlRegex.exec(line)) !== null) {
                const url = match[1];
                const startIndex = match.index;
                links.push({
                    range: { start: { x: startIndex + 1, y: bufferLineNumber }, end: { x: startIndex + url.length, y: bufferLineNumber } },
                    text: url,
                    activate: (event, text) => {
                        if (event.ctrlKey) {
                            window.electronAPI.shellOpenExternal(text);
                        } else {
                            // Feedback per l'utente: "Usa CTRL + Click per aprire"
                            if (window.gxToast) window.gxToast("Usa CTRL + CLICK per aprire il link", "info");
                        }
                    }
                });
            }
            callback(links);
        }
    });

    term.onResize(size => window.electronAPI.terminalResize(id, size.cols, size.rows));

    term.attachCustomKeyEventHandler((e) => {
        if (e.ctrlKey && e.key === 'c' && term.hasSelection()) {
            window.electronAPI.clipboardWrite(term.getSelection());
            return false;
        }
        if (e.ctrlKey && e.key === 'v') {
            window.electronAPI.clipboardRead().then(text => {
                if (text) window.electronAPI.terminalWrite(id, text);
            });
            return false;
        }
        return true;
    });

    term.element.addEventListener('contextmenu', async (e) => {
        e.preventDefault();
        if (term.hasSelection()) {
            window.electronAPI.clipboardWrite(term.getSelection());
        } else {
            const text = await window.electronAPI.clipboardRead();
            if (text) window.electronAPI.terminalWrite(id, text);
        }
    });

    terminals[id] = { term, fitAddon, container: termContainer, label: tabLabel, shellType, colorClass };
    switchTerminal(id);
}

function switchTerminal(id) {
    if (!terminals[id]) return;
    activeTerminalId = id;
    Object.keys(terminals).forEach(tid => {
        const t = terminals[tid];
        if (tid === id) {
            t.container.classList.remove('hidden');
            setTimeout(() => t.fitAddon.fit(), 10);
            t.term.focus();
        } else {
            t.container.classList.add('hidden');
        }
    });
    renderTabs();
}

function renderTabs() {
    const tabsContainer = document.getElementById('terminal-tabs');
    if (!tabsContainer) return;

    tabsContainer.innerHTML = Object.keys(terminals).map(id => {
        const t = terminals[id];
        const isActive = activeTerminalId === id;
        return `
            <div 
                onclick="window.switchGXTerm('${id}')" 
                class="group flex items-center gap-2 px-3 py-1 rounded-t border-t border-l border-r border-[var(--border-dim)] cursor-pointer transition ${isActive ? 'bg-[var(--bg-main)] border-[var(--border-dim)]' : 'bg-transparent text-gray-500 hover:text-gray-300'} border-b-2 border-b-transparent"
            >
                <svg class="${isActive ? t.colorClass : 'text-gray-600'}" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>
                <span class="text-[9px] font-bold uppercase tracking-widest ${isActive ? t.colorClass : ''}">${t.label}</span>
                <button onclick="window.closeGXTerm('${id}', event)" class="opacity-0 group-hover:opacity-100 hover:text-red-400 transition text-[8px] ml-1">✕</button>
            </div>
        `;
    }).join('');
}

window.switchGXTerm = (id) => switchTerminal(id);
window.closeGXTerm = (id, e) => {
    if (e) e.stopPropagation();
    if (terminals[id]) {
        terminals[id].container.remove();
        delete terminals[id];
        const remaining = Object.keys(terminals);
        if (remaining.length > 0) switchTerminal(remaining[remaining.length - 1]);
        else createTerminal('init-' + Date.now(), 'ps');
    }
};

window.writeToTestTerminal = async (data) => {
    const testId = 'test-runner';
    if (!terminals[testId]) {
        await createTerminal(testId, 'ps');
        terminals[testId].label = 'TEST RUNNER';
        terminals[testId].colorClass = 'text-emerald-400';
    }
    terminals[testId].term.write(data);
};

function getTerminalTheme(skinId) {
    const themes = {
        'dark': { background: '#090c10', foreground: '#e6edf3', cursor: '#3b82f6', selection: 'rgba(59, 130, 246, 0.3)' },
        'classic': { background: '#1e1e1e', foreground: '#cccccc', cursor: '#007acc', selection: 'rgba(0, 122, 204, 0.3)' },
        'neon-cyber': { background: '#020308', foreground: '#00f2ff', cursor: '#00f2ff', selection: 'rgba(0, 242, 255, 0.3)' },
        'nordic-frost': { background: '#0b1120', foreground: '#f1f5f9', cursor: '#38bdf8', selection: 'rgba(56, 189, 248, 0.3)' },
        'aurora-oled': { background: '#000000', foreground: '#ffffff', cursor: '#1aedc1', selection: 'rgba(26, 237, 193, 0.3)' },
        'titanium-carbon': { background: '#0d0f11', foreground: '#d1d5db', cursor: '#f97316', selection: 'rgba(249, 115, 22, 0.3)' },
        'solar-flare': { background: '#09090b', foreground: '#fafafa', cursor: '#fbbf24', selection: 'rgba(251, 191, 36, 0.3)' },
        'void-stealth': { background: '#000000', foreground: '#a0a0a0', cursor: '#ffffff', selection: 'rgba(255, 255, 255, 0.1)' }
    };
    const t = themes[skinId] || themes['dark'];
    return {
        ...t,
        black: '#21262d',
        red: '#f85149',
        green: '#3fb950',
        yellow: '#d29922',
        blue: '#58a6ff',
        magenta: '#bc8cff',
        cyan: '#39c5cf',
        white: '#ffffff',
        brightBlack: '#484f58',
        brightRed: '#ff7b72',
        brightGreen: '#56d364',
        brightYellow: '#e3b341',
        brightBlue: '#79c0ff',
        brightMagenta: '#d2a8ff',
        brightCyan: '#56d4dd',
        brightWhite: '#ffffff'
    };
}

// Reattività Temi Terminale
subscribe((newState, oldState) => {
    if (newState.activeCgxTheme !== oldState?.activeCgxTheme) {
        const newTheme = getTerminalTheme(newState.activeCgxTheme);
        Object.values(terminals).forEach(t => {
            t.term.options.theme = newTheme;
        });
    }
});
