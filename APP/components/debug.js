import { state, subscribe, setState } from '../core/state.js';

export const initDebug = () => {
    const pane = document.getElementById('pane-debug');
    if (!pane) return;

    window.toggleDebugSession = async () => {
        const t = (key) => window.t(key) || key;
        if (!state.isDebugModeActive) {
            const activeFileId = state.activeFileId;
            if (!activeFileId) {
                window.gxToast(t('debug.toastOpen'), "error");
                return;
            }
            
            setState({ isDebugModeActive: true });
            window.gxToast(t('debug.toastStart'), "info");
            
            try {
                await window.electronAPI.debugStart(activeFileId, state.breakpoints || []);
            } catch (err) {
                window.gxToast(t('debug.toastError').replace('{error}', err.message), "error");
                setState({ isDebugModeActive: false });
            }
        } else {
            await window.electronAPI.debugStop();
            setState({ isDebugModeActive: false });
            window.gxToast(t('debug.toastStop'), "info");
        }
    };

    window.debugStep = () => window.electronAPI.debugStep();
    window.debugContinue = () => window.electronAPI.debugContinue();

    // Listen for debug events from backend
    window.electronAPI.onDebugPaused((data) => {
        const t = (key) => window.t(key) || key;
        setState({ 
            debugCallStack: data.callStack || [],
            debugActiveLine: data.line
        });
        window.gxToast(t('debug.toastPause').replace('{line}', data.line), "info");
    });

    window.electronAPI.onDebugVariables((vars) => {
        setState({ debugVariables: vars || [] });
    });

    window.electronAPI.onDebugResumed(() => {
        setState({ 
            debugActiveLine: null,
            debugVariables: []
        });
    });

    window.clearAllBreakpoints = () => {
        setState({ breakpoints: [] });
    };

    const renderDebugInfo = () => {
        const t = (key) => window.t(key) || key;
        const breakpoints = state.breakpoints || [];
        const variables = state.debugVariables || [];
        
        pane.innerHTML = `
            <div class="flex flex-col h-full animate-fade-in">
                <!-- Controls -->
                <div class="p-4 border-b border-[var(--border-dim)] bg-[var(--bg-side)] flex items-center justify-between shrink-0">
                    <div class="flex items-center gap-2">
                        <button onclick="window.toggleDebugSession()" class="flex items-center gap-2 px-3 py-1.5 ${state.isDebugModeActive ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'} border rounded text-[10px] font-bold uppercase transition hover:scale-105 active:scale-95">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="${state.isDebugModeActive ? 'M6 6h12v12H6z' : 'M8 5v14l11-7z'}"/></svg>
                            <span>${state.isDebugModeActive ? t('debug.stop') : t('debug.start')}</span>
                        </button>
                    </div>
                    <div class="flex items-center gap-2 ${state.isDebugModeActive ? 'opacity-100' : 'opacity-30 pointer-events-none'}">
                         <button onclick="window.debugContinue()" class="p-1.5 text-gray-400 hover:text-emerald-400 transition hover:bg-[var(--bg-side-alt)] rounded" title="${t('debug.continue')}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/></svg></button>
                         <button onclick="window.debugStep()" class="p-1.5 text-gray-400 hover:text-blue-400 transition hover:bg-[var(--bg-side-alt)] rounded" title="${t('debug.stepOver')}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 10 20 15 15 20"/><path d="M4 4v7a4 4 0 0 0 4 4h12"/></svg></button>
                    </div>
                </div>

                <div class="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
                    <!-- Call Stack -->
                    <section class="space-y-3">
                        <h5 class="text-[9px] font-bold text-gray-500 uppercase tracking-widest">${t('debug.callStack')}</h5>
                        <div class="space-y-1">
                            ${state.debugCallStack && state.debugCallStack.length > 0 ? 
                                state.debugCallStack.map(cf => `
                                    <div class="text-[10px] px-2 py-1 bg-[var(--bg-side)] border-l-2 border-yellow-500/50 text-gray-300 font-mono line-clamp-1 rounded-r">
                                        ${cf.functionName} <span class="text-gray-600 text-[8px]">${t('debug.line')} ${cf.location.lineNumber + 1}</span>
                                    </div>
                                `).join('') : 
                                `<div class="text-[10px] text-gray-600 italic px-2 border-l border-[var(--border-dim)]">${t('debug.noProcess')}</div>`
                            }
                        </div>
                    </section>

                    <!-- Variables -->
                    <section class="space-y-3">
                        <h5 class="text-[9px] font-bold text-gray-500 uppercase tracking-widest">${t('debug.variables')}</h5>
                        <div class="space-y-1">
                            ${variables.length > 0 ? 
                                variables.map(v => `
                                    <div class="flex items-baseline gap-2 text-[10px] px-2 py-1 hover:bg-[var(--bg-side)] rounded transition group border border-transparent hover:border-[var(--border-dim)]">
                                        <span class="text-blue-400 font-bold font-mono">${v.name}:</span>
                                        <span class="text-gray-300 font-mono truncate" title="${v.value}">${v.value}</span>
                                        <span class="text-[8px] text-gray-600 uppercase ml-auto opacity-0 group-hover:opacity-100">${v.type}</span>
                                    </div>
                                `).join('') : 
                                `<div class="text-[10px] text-gray-600 italic px-2 border-l border-[var(--border-dim)]">${t('debug.scopeEmpty')}</div>`
                            }
                        </div>
                    </section>

                    <!-- Breakpoints -->
                    <section class="space-y-3">
                        <div class="flex items-center justify-between">
                            <h5 class="text-[9px] font-bold text-gray-500 uppercase tracking-widest">${t('debug.breakpoints')}</h5>
                            <button onclick="window.clearAllBreakpoints()" class="text-[9px] text-gray-600 hover:text-red-400 uppercase font-bold transition">${t('debug.reset')}</button>
                        </div>
                        <div class="space-y-2">
                            ${breakpoints.length === 0 ? `<div class="text-[10px] text-gray-600 italic px-2 border-l border-[var(--border-dim)]">${t('debug.noBreakpoints')}</div>` : ''}
                            ${breakpoints.map(bp => {
                                const fileName = bp.path.split(/[\\\\/]/).pop();
                                return `
                                    <div class="flex items-center justify-between p-2.5 bg-[var(--bg-side)] border border-[var(--border-dim)] rounded-lg group hover:border-red-500/30 transition shadow-sm">
                                        <div class="flex flex-col">
                                            <span class="text-[11px] font-bold text-gray-300 line-clamp-1">${fileName}</span>
                                            <span class="text-[9px] text-gray-600 font-mono italic">${t('debug.line')} ${bp.line}</span>
                                        </div>
                                        <div class="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]"></div>
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
        // Render if debug activity is selected OR if debug state changes
        if (
            newState.activeActivity === 'debug' ||
            newState.breakpoints !== oldState?.breakpoints || 
            newState.isDebugModeActive !== oldState?.isDebugModeActive ||
            newState.debugCallStack !== oldState?.debugCallStack ||
            newState.debugVariables !== oldState?.debugVariables ||
            newState.debugActiveLine !== oldState?.debugActiveLine
        ) {
            renderDebugInfo();
        }
    });

    renderDebugInfo();
    console.log("[GX-DEBUG] Module initialized.");
};
