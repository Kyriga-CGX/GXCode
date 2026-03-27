import { state, subscribe, setState } from '../core/state.js';

export const initDebug = () => {
    const pane = document.getElementById('pane-debug');
    if (!pane) return;

    window.toggleDebugSession = async () => {
        if (!state.isDebugModeActive) {
            const activeFileId = state.activeFileId;
            if (!activeFileId) {
                window.gxToast(window.t('debug.toastOpen'), "error");
                return;
            }
            
            setState({ isDebugModeActive: true });
            window.gxToast(window.t('debug.toastStart'), "info");
            
            try {
                await window.electronAPI.debugStart(activeFileId, state.breakpoints || []);
            } catch (err) {
                window.gxToast(window.t('debug.toastError').replace('{error}', err.message), "error");
                setState({ isDebugModeActive: false });
            }
        } else {
            await window.electronAPI.debugStop();
            setState({ isDebugModeActive: false });
            window.gxToast(window.t('debug.toastStop'), "info");
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
        window.gxToast(window.t('debug.toastPause').replace('{line}', data.line), "info");
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
                            <span data-i18n="${state.isDebugModeActive ? 'debug.stop' : 'debug.start'}">${state.isDebugModeActive ? window.t('debug.stop') : window.t('debug.start')}</span>
                        </button>
                    </div>
                    <div class="flex items-center gap-2">
                         <button onclick="window.debugContinue()" class="p-1.5 text-gray-400 hover:text-emerald-400 transition" data-i18n="[title]debug.continue"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/></svg></button>
                         <button onclick="window.debugStep()" class="p-1.5 text-gray-400 hover:text-blue-400 transition" data-i18n="[title]debug.stepOver"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 10 20 15 15 20"/><path d="M4 4v7a4 4 0 0 0 4 4h12"/></svg></button>
                    </div>
                </div>

                <div class="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
                    <!-- Call Stack -->
                    <section class="space-y-3">
                        <h5 class="text-[9px] font-bold text-gray-500 uppercase tracking-widest" data-i18n="debug.callStack">${window.t('debug.callStack')}</h5>
                        <div class="space-y-1">
                            ${state.debugCallStack && state.debugCallStack.length > 0 ? 
                                state.debugCallStack.map(cf => `
                                    <div class="text-[10px] px-2 py-1 bg-gray-800/30 border-l-2 border-yellow-500/50 text-gray-300 font-mono line-clamp-1">
                                        ${cf.functionName} <span class="text-gray-600 text-[8px]">${window.t('debug.line')} ${cf.location.lineNumber + 1}</span>
                                    </div>
                                `).join('') : 
                                `<div class="text-[10px] text-gray-600 italic px-2 border-l border-gray-800" data-i18n="debug.noProcess">${window.t('debug.noProcess')}</div>`
                            }
                        </div>
                    </section>

                    <!-- Variables -->
                    <section class="space-y-3">
                        <h5 class="text-[9px] font-bold text-gray-500 uppercase tracking-widest" data-i18n="debug.variables">${window.t('debug.variables')}</h5>
                        <div class="text-[10px] text-gray-600 italic px-2 border-l border-gray-800" data-i18n="debug.scopeEmpty">${window.t('debug.scopeEmpty')}</div>
                    </section>

                    <!-- Breakpoints -->
                    <section class="space-y-3">
                        <div class="flex items-center justify-between">
                            <h5 class="text-[9px] font-bold text-gray-500 uppercase tracking-widest" data-i18n="debug.breakpoints">${window.t('debug.breakpoints')}</h5>
                            <button onclick="window.clearAllBreakpoints()" class="text-[9px] text-gray-600 hover:text-red-400 uppercase font-bold" data-i18n="debug.reset">${window.t('debug.reset')}</button>
                        </div>
                        <div class="space-y-2">
                            ${breakpoints.length === 0 ? `<div class="text-[10px] text-gray-600 italic px-2 border-l border-gray-800" data-i18n="debug.noBreakpoints">${window.t('debug.noBreakpoints')}</div>` : ''}
                            ${breakpoints.map(bp => {
                                const fileName = bp.path.split(/[\\\\/]/).pop();
                                return `
                                    <div class="flex items-center justify-between p-2 bg-[#161b22] border border-gray-800 rounded group hover:border-red-500/30 transition">
                                        <div class="flex flex-col">
                                            <span class="text-[11px] font-bold text-gray-300 line-clamp-1">${fileName}</span>
                                            <span class="text-[9px] text-gray-600 font-mono">${window.t('debug.line')} ${bp.line}</span>
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
