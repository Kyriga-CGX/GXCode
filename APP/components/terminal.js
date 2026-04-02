import { state, subscribe } from '../core/state.js';

let terminals = {}; // terminalId -> { term, fitAddon, container, shellType, ... }
let activeTerminalId = null;
let isInitialized = false;

export const initTerminal = async () => {
    const targetContainer = document.getElementById('pane-terminal');
    if (!targetContainer || isInitialized) return;
    
    isInitialized = true;

    // Inizializzazione Struttura Base (UNA SOLA VOLTA)
    targetContainer.innerHTML = `
        <div class="flex flex-col h-full w-full bg-[#06080a] overflow-hidden">
            <div id="terminal-shell-header" class="h-8 border-b border-gray-800/50 flex items-center justify-between px-3 shrink-0 bg-[#161b22]/30"></div>
            <div id="terminals-stack" class="flex-1 w-full relative overflow-hidden bg-[#06080a]"></div>
        </div>
    `;

    const headerContainer = document.getElementById('terminal-shell-header');
    const stackContainer = document.getElementById('terminals-stack');

    const renderHeader = () => {
        if (!headerContainer) return;
        const isWorkspace = state.workspaceData?.isWorkspace && state.workspaceData?.folders?.length > 0;
        
        headerContainer.innerHTML = `
            <div class="flex items-center gap-3 overflow-hidden">
                <div class="flex items-center gap-1 overflow-x-auto no-scrollbar" id="terminal-tabs"></div>
                
                ${isWorkspace ? `
                    <div class="h-4 w-[1px] bg-gray-800 mx-1"></div>
                    <div class="flex items-center gap-1 shrink-0">
                        <svg class="text-gray-500" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                        <select id="terminal-folder-selector" class="bg-transparent border-none text-[9px] text-gray-400 font-bold uppercase tracking-wider focus:outline-none hover:text-white cursor-pointer max-w-[150px] truncate">
                            ${state.workspaceData.folders.map(f => `
                                <option value="${f.path}" ${state.activeTerminalFolder === f.path ? 'selected' : ''}>${f.name}</option>
                            `).join('')}
                        </select>
                    </div>
                ` : ''}
            </div>
            
            <div class="flex gap-1 shrink-0 ml-2">
                <button id="btn-add-ps" class="p-1 px-1.5 text-[8px] font-bold text-blue-400 hover:bg-blue-500/10 rounded transition uppercase tracking-widest border border-blue-500/20 flex items-center gap-1" title="+ PowerShell">+ PS</button>
                <button id="btn-add-cmd" class="p-1 px-1.5 text-[8px] font-bold text-gray-400 hover:bg-gray-500/10 rounded transition uppercase tracking-widest border border-gray-500/20 flex items-center gap-1" title="+ CMD">+ CMD</button>
                <button id="btn-add-bash" class="p-1 px-1.5 text-[8px] font-bold text-orange-400 hover:bg-orange-500/10 rounded transition uppercase tracking-widest border border-orange-500/20 flex items-center gap-1" title="+ Bash">+ BASH</button>
                <button id="btn-clear-term" class="p-1 px-1.5 text-[8px] font-bold text-red-400 hover:bg-red-500/10 rounded transition uppercase tracking-widest border border-red-500/20 flex items-center gap-1" title="Clear">CLEAR</button>
                <button id="btn-split-term" class="p-1 px-1.5 text-[8px] font-bold text-emerald-400 hover:bg-emerald-500/10 rounded transition uppercase tracking-widest border border-emerald-500/20 flex items-center gap-1" title="Split">SPLIT</button>
            </div>
        `;

        renderTabs();

        const selector = document.getElementById('terminal-folder-selector');
        if (selector) {
            selector.onchange = (e) => {
                import('../core/state.js').then(m => m.setState({ activeTerminalFolder: e.target.value }));
            };
        }

        document.getElementById('btn-add-ps').onclick = () => createTerminal('t' + Date.now(), 'ps');
        document.getElementById('btn-add-cmd').onclick = () => createTerminal('t' + Date.now(), 'cmd');
        document.getElementById('btn-add-bash').onclick = () => createTerminal('t' + Date.now(), 'bash');
        document.getElementById('btn-clear-term').onclick = () => { if (activeTerminalId) terminals[activeTerminalId]?.term.clear(); };
        document.getElementById('btn-split-term').onclick = () => handleSplit();
    };

    const handleSplit = () => {
        const ids = Object.keys(terminals);
        if (ids.length < 2) return;
        stackContainer.classList.add('flex');
        // Logic for side-by-side but simplified for now
    };

    const createTerminal = async (id, shellType = 'ps') => {
        // Rileviamo la cartella selezionata per darne nome al tab
        const currentFolderPath = state.activeTerminalFolder || state.workspaceData?.path || '';
        const folderName = state.workspaceData?.folders?.find(f => f.path === currentFolderPath)?.name || 'root';
        
        const labels = { 'ps': 'PS', 'cmd': 'CMD', 'bash': 'BASH', 'claude': 'CLAUDE' };
        const baseLabel = labels[shellType] || 'TERM';
        const label = `${baseLabel} (${folderName})`;

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
            theme: {
                background: '#06080a',
                foreground: '#cccccc',
                cursor: '#3b82f6',
                selection: 'rgba(59, 130, 246, 0.3)'
            },
            allowProposedApi: true
        });

        const fitAddon = new FitAddon.FitAddon();
        term.loadAddon(fitAddon);
        term.open(termContainer);

        const res = await window.electronAPI.terminalCreate(id, shellType, currentFolderPath);
        
        term.onData(data => window.electronAPI.terminalWrite(id, data));
        window.electronAPI.onTerminalData(id, (data) => term.write(data));
        term.onResize(size => window.electronAPI.terminalResize(id, size.cols, size.rows));

        // Supporto Professionale per Copia/Incolla (Scorciatoie Tastiera)
        term.attachCustomKeyEventHandler((e) => {
            if (e.ctrlKey && e.shiftKey && (e.key === 'C' || e.key === 'V')) return false; // Lascia passare le varianti shift per usi xterm nativi
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

        // Click Destro Intelligente: Copia se c'è selezione, Incolla altrimenti
        termContainer.addEventListener('contextmenu', async (e) => {
            e.preventDefault();
            if (term.hasSelection()) {
                const text = term.getSelection();
                window.electronAPI.clipboardWrite(text);
                // Feedback visivo (opzionale)
            } else {
                const text = await window.electronAPI.clipboardRead();
                if (text) window.electronAPI.terminalWrite(id, text);
            }
        });

        terminals[id] = { term, fitAddon, container: termContainer, label, shellType, colorClass };
        
        switchTerminal(id);
    };

    const switchTerminal = (id) => {
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
    };

    const renderTabs = () => {
        const tabsContainer = document.getElementById('terminal-tabs');
        if (!tabsContainer) return;

        tabsContainer.innerHTML = Object.keys(terminals).map(id => {
            const t = terminals[id];
            const isActive = activeTerminalId === id;
            return `
                <div 
                    onclick="window.switchGXTerm('${id}')" 
                    class="group flex items-center gap-2 px-3 py-1 rounded-t border-t border-l border-r border-gray-800 cursor-pointer transition ${isActive ? 'bg-[#06080a] border-gray-700' : 'bg-transparent text-gray-500 hover:text-gray-300'} border-b-2 border-b-transparent"
                >
                    <svg class="${isActive ? t.colorClass : 'text-gray-600'}" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>
                    <span class="text-[9px] font-bold uppercase tracking-widest ${isActive ? t.colorClass : ''}">${t.label}</span>
                    <button onclick="window.closeGXTerm('${id}', event)" class="opacity-0 group-hover:opacity-100 hover:text-red-400 transition text-[8px] ml-1">✕</button>
                </div>
            `;
        }).join('');
    };

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
            renderTabs();
        }
        switchTerminal(testId);
        terminals[testId].term.write(data);
    };

    renderHeader();

    const resizeObserver = new ResizeObserver(() => {
        Object.values(terminals).forEach(t => t.fitAddon.fit());
    });
    resizeObserver.observe(targetContainer);

    subscribe((newState, oldState) => {
        if (newState.workspaceData !== oldState?.workspaceData || newState.activeTerminalFolder !== oldState?.activeTerminalFolder) {
            renderHeader();
        }
    });

    if (Object.keys(terminals).length === 0) {
        await createTerminal('t1', 'ps');
    } else if (activeTerminalId) {
        switchTerminal(activeTerminalId);
    }
};
