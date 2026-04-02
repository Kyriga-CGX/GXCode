import { state, subscribe } from '../core/state.js';

const terminals = {}; // terminalId -> { term, fitAddon, container, shellType, ... }
let activeTerminalId = null;

export const initTerminal = async () => {
    const targetContainer = document.getElementById('pane-terminal');
    if (!targetContainer) return;

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
                <button id="btn-add-ps" class="p-1 px-1.5 text-[8px] font-bold text-blue-400 hover:bg-blue-500/10 rounded transition uppercase tracking-widest border border-blue-500/20 flex items-center gap-1" data-i18n="[title]terminal.newPs" title="${window.t('terminal.newPs')}">+ PS</button>
                <button id="btn-add-cmd" class="p-1 px-1.5 text-[8px] font-bold text-gray-400 hover:bg-gray-500/10 rounded transition uppercase tracking-widest border border-gray-500/20 flex items-center gap-1" data-i18n="[title]terminal.newCmd" title="${window.t('terminal.newCmd')}">+ CMD</button>
                <button id="btn-add-bash" class="p-1 px-1.5 text-[8px] font-bold text-orange-400 hover:bg-orange-500/10 rounded transition uppercase tracking-widest border border-orange-500/20 flex items-center gap-1" data-i18n="[title]terminal.newBash" title="${window.t('terminal.newBash')}">+ BASH</button>
                <button id="btn-clear-term" class="p-1 px-1.5 text-[8px] font-bold text-red-400 hover:bg-red-500/10 rounded transition uppercase tracking-widest border border-red-500/20 flex items-center gap-1" data-i18n="[title]terminal.clear" title="${window.t('terminal.clear')}">CLEAR</button>
                <button id="btn-split-term" class="p-1 px-1.5 text-[8px] font-bold text-emerald-400 hover:bg-emerald-500/10 rounded transition uppercase tracking-widest border border-emerald-500/20 flex items-center gap-1" data-i18n="[title]terminal.split" title="${window.t('terminal.split')}">SPLIT</button>
            </div>
        `;

        // Rerenderizziamo i tab visto che l'id 'terminal-tabs' è stato ricreato nell'header
        renderTabs();

        // Bind events
        const selector = document.getElementById('terminal-folder-selector');
        if (selector) {
            selector.onchange = (e) => {
                import('../core/state.js').then(m => m.setState({ activeTerminalFolder: e.target.value }));
            };
        }

        const bPs = document.getElementById('btn-add-ps');
        const bCmd = document.getElementById('btn-add-cmd');
        const bBash = document.getElementById('btn-add-bash');
        const bClear = document.getElementById('btn-clear-term');
        const bSplit = document.getElementById('btn-split-term');

        if (bPs) bPs.onclick = () => createTerminal('t' + Date.now(), 'ps');
        if (bCmd) bCmd.onclick = () => createTerminal('t' + Date.now(), 'cmd');
        if (bBash) bBash.onclick = () => createTerminal('t' + Date.now(), 'bash');
        if (bClear) bClear.onclick = () => { if (activeTerminalId) terminals[activeTerminalId]?.term.clear(); };
        if (bSplit) bSplit.onclick = () => handleSplit();
    };

    const handleSplit = () => {
        if (!activeTerminalId || Object.keys(terminals).length < 2) {
             alert(window.t('terminal.splitError'));
             return;
        }
        const tIds = Object.keys(terminals);
        if (tIds.length >= 2) {
            const first = terminals[tIds[0]];
            const second = terminals[tIds[1]];
            
            stackContainer.classList.add('flex');
            first.container.classList.remove('absolute', 'inset-0', 'hidden');
            first.container.classList.add('flex-1', 'border-r', 'border-gray-800');
            
            second.container.classList.remove('absolute', 'inset-0', 'hidden');
            second.container.classList.add('flex-1');
            
            setTimeout(() => {
                first.fitAddon.fit();
                second.fitAddon.fit();
            }, 100);
        }
    };

    const createTerminal = async (id, shellType = 'ps') => {
        const labels = { 'ps': 'powershell', 'cmd': 'cmd', 'bash': 'bash' };
        const label = labels[shellType] || 'term';
        const colorClasses = { 'ps': 'text-blue-400', 'cmd': 'text-gray-400', 'bash': 'text-orange-400' };
        const colorClass = colorClasses[shellType];

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
                cursor: shellType === 'ps' ? '#3b82f6' : (shellType === 'bash' ? '#f97316' : '#ffffff'),
                selection: 'rgba(59, 130, 246, 0.3)'
            },
            allowProposedApi: true
        });

        const fitAddon = new FitAddon.FitAddon();
        term.loadAddon(fitAddon);
        term.open(termContainer);

        const terminalCwd = state.activeTerminalFolder || state.workspaceData?.path;
        const res = await window.electronAPI.terminalCreate(id, shellType, terminalCwd);
        
        if (res && !res.success) {
            term.write(`\r\n\x1b[31;1m${window.t('terminal.errorStart').replace('{shell}', shellType.toUpperCase())}\x1b[0m\r\n`);
            term.write(`\x1b[33m${window.t('terminal.errorDetail').replace('{error}', res.error)}\x1b[0m\r\n`);
            term.write(`\x1b[90m${window.t('terminal.errorAdvice')}\x1b[0m\r\n\r\n`);
        }

        term.onData(data => window.electronAPI.terminalWrite(id, data));
        window.electronAPI.onTerminalData(id, (data) => term.write(data));
        term.onResize(size => window.electronAPI.terminalResize(id, size.cols, size.rows));

        termContainer.addEventListener('contextmenu', async (e) => {
            e.preventDefault();
            try {
                const text = await window.electronAPI.clipboardRead();
                if (text) {
                    window.electronAPI.terminalWrite(id, text);
                }
            } catch (err) {
                console.error("Errore incolla terminale:", err);
            }
        });

        terminals[id] = { term, fitAddon, container: termContainer, label, shellType, colorClass };
        
        renderTabs();
        switchTerminal(id);
    };

    const switchTerminal = (id) => {
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
                    onauxclick="if(event.button === 1) window.closeGXTerm('${id}', event)"
                    class="group flex items-center gap-2 px-3 py-1 rounded-t border-t border-l border-r border-gray-800 cursor-pointer transition ${isActive ? 'bg-[#06080a] border-gray-700' : 'bg-transparent text-gray-500 hover:text-gray-300'} border-b-2 border-b-transparent"
                    data-i18n="[title]terminal.closeHint"
                    title="${window.t('terminal.closeHint')}"
                >
                    <svg class="${isActive ? t.colorClass : 'text-gray-600'}" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>
                    <span class="text-[9px] font-bold uppercase tracking-widest ${isActive ? t.colorClass : ''}">${t.label}</span>
                    ${Object.keys(terminals).length > 1 ? `<button onclick="window.closeGXTerm('${id}', event)" class="opacity-0 group-hover:opacity-100 hover:text-red-400 transition text-[8px] ml-1">✕</button>` : ''}
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
            if (remaining.length > 0) {
                switchTerminal(remaining[remaining.length - 1]);
            } else {
                createTerminal('t' + Date.now(), 'ps');
            }
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

    // Primo render dell'header
    renderHeader();

    const resizeObserver = new ResizeObserver(() => {
        Object.values(terminals).forEach(t => t.fitAddon.fit());
    });
    resizeObserver.observe(targetContainer);

    subscribe((newState, oldState) => {
        if (newState.activeCgxTheme !== oldState?.activeCgxTheme) {
            const isLight = newState.activeCgxTheme === 'light' || newState.activeCgxTheme === 'apple';
            Object.values(terminals).forEach(t => {
                t.term.options.theme = {
                    background: isLight ? '#f3f4f6' : '#06080a',
                    foreground: isLight ? '#1f2937' : '#cccccc',
                    cursor: '#3b82f6'
                };
            });
        }

        if (newState.workspaceData !== oldState?.workspaceData || newState.activeTerminalFolder !== oldState?.activeTerminalFolder) {
            renderHeader();
        }
    });

    // Avvio primo terminale
    await createTerminal('t1', 'ps');
};
