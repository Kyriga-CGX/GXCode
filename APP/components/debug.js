import { state, subscribe, setState } from '../core/state.js';

export const initDebug = () => {
    const pane = document.getElementById('pane-debug');
    if (!pane) return;

    window.toggleDebugSession = async () => {
        if (!state.isDebugModeActive) {
            const activeFileId = state.activeFileId;
            if (!activeFileId) {
                window.gxToast("Apri un file per avviare il debug", "error");
                return;
            }
            
            setState({ isDebugModeActive: true });
            window.gxToast("Avvio Debug Session... 🐛", "info");
            
            try {
                await window.electronAPI.debugStart(activeFileId, state.breakpoints || []);
            } catch (err) {
                window.gxToast("Errore avvio debug: " + err.message, "error");
                setState({ isDebugModeActive: false });
            }
        } else {
            await window.electronAPI.debugStop();
            setState({ isDebugModeActive: false });
            window.gxToast("Debug Terminato ⏹️", "info");
        }
    };

    window.debugStep = () => window.electronAPI.debugStep();
    window.debugContinue = () => window.electronAPI.debugContinue();

    // Listen for debug events from backend
    window.electronAPI.onDebugPaused((data) => {
        setState({ 
            debugCallStack: data.callStack || [],
            debugVariables: data.variables || [],
            debugActiveLine: data.line
        });
        window.gxToast(`Pausa alla riga ${data.line}`, "info");
    });

    window.electronAPI.onDebugResumed(() => {
        setState({ 
            debugActiveLine: null 
        });
    });

    window.clearAllBreakpoints = () => {
        setState({ breakpoints: [] });
    };

    const renderDebugInfo = () => {
        const breakpoints = state.breakpoints || [];
        
        pane.innerHTML = `
            <div class="flex flex-col h-full animate-fade-in">
                <!-- Controls -->
                <div class="p-4 border-b border-gray-800 bg-[#161b22]/50 flex items-center justify-between">
                    <div class="flex items-center gap-2">
                        <button onclick="window.toggleDebugSession()" class="flex items-center gap-2 px-3 py-1.5 ${state.isDebugModeActive ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'} border rounded text-[10px] font-bold uppercase transition hover:scale-105">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="${state.isDebugModeActive ? 'M6 6h12v12H6z' : 'M8 5v14l11-7z'}"/></svg>
                            ${state.isDebugModeActive ? 'Stop' : 'Avvia'}
                        </button>
                    </div>
                    <div class="flex items-center gap-2">
                         <button onclick="window.debugContinue()" class="p-1.5 text-gray-400 hover:text-emerald-400 transition" title="Continua (F5)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/></svg></button>
                         <button onclick="window.debugStep()" class="p-1.5 text-gray-400 hover:text-blue-400 transition" title="Step Over (F10)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 10 20 15 15 20"/><path d="M4 4v7a4 4 0 0 0 4 4h12"/></svg></button>
                    </div>
                </div>

                <div class="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
                    <!-- Call Stack -->
                    <section class="space-y-3">
                        <h5 class="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Call Stack</h5>
                        <div class="space-y-1">
                            ${state.debugCallStack && state.debugCallStack.length > 0 ? 
                                state.debugCallStack.map(cf => `
                                    <div class="text-[10px] px-2 py-1 bg-gray-800/30 border-l-2 border-yellow-500/50 text-gray-300 font-mono line-clamp-1">
                                        ${cf.functionName} <span class="text-gray-600 text-[8px]">riga ${cf.location.lineNumber + 1}</span>
                                    </div>
                                `).join('') : 
                                '<div class="text-[10px] text-gray-600 italic px-2 border-l border-gray-800">No active process.</div>'
                            }
                        </div>
                    </section>

                    <!-- Variables -->
                    <section class="space-y-3">
                        <h5 class="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Variables (Local)</h5>
                        <div class="text-[10px] text-gray-600 italic px-2 border-l border-gray-800">Scope empty.</div>
                    </section>

                    <!-- Breakpoints -->
                    <section class="space-y-3">
                        <div class="flex items-center justify-between">
                            <h5 class="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Punti di Interruzione</h5>
                            <button onclick="window.clearAllBreakpoints()" class="text-[9px] text-gray-600 hover:text-red-400 uppercase font-bold">Resetta</button>
                        </div>
                        <div class="space-y-2">
                            ${breakpoints.length === 0 ? '<div class="text-[10px] text-gray-600 italic px-2 border-l border-gray-800">Nessun breakpoint impostato.</div>' : ''}
                            ${breakpoints.map(bp => {
                                const fileName = bp.path.split(/[\\\\/]/).pop();
                                return `
                                    <div class="flex items-center justify-between p-2 bg-[#161b22] border border-gray-800 rounded group hover:border-red-500/30 transition">
                                        <div class="flex flex-col">
                                            <span class="text-[11px] font-bold text-gray-300 line-clamp-1">${fileName}</span>
                                            <span class="text-[9px] text-gray-600 font-mono">riga ${bp.line}</span>
                                        </div>
                                        <div class="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.5)]"></div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </section>
                </div>
            </div>
        `;
    };

    subscribe((newState, oldState) => {
        if (
            newState.breakpoints !== oldState?.breakpoints || 
            newState.isDebugModeActive !== oldState?.isDebugModeActive ||
            newState.debugCallStack !== oldState?.debugCallStack ||
            newState.debugActiveLine !== oldState?.debugActiveLine
        ) {
            renderDebugInfo();
        }
    });

    renderDebugInfo();
};
