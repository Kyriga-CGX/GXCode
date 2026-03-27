import { state, subscribe, setState } from '../core/state.js';

export const initProblems = () => {
    const pane = document.getElementById('pane-problems');
    const badge = document.getElementById('problems-count-badge');
    if (!pane || !badge) return;

    const renderProblems = () => {
        const problems = state.problems || [];
        badge.textContent = problems.length;
        badge.classList.toggle('bg-red-500', problems.some(p => p.severity === 4));
        badge.classList.toggle('text-white', problems.some(p => p.severity === 4));

        if (problems.length === 0) {
            pane.innerHTML = `<div class="opacity-30 text-[10px] uppercase text-gray-500 font-bold text-center mt-10" data-i18n="problems.empty">${window.t('problems.empty')}</div>`;
            return;
        }

        pane.innerHTML = `
            <div class="flex flex-col gap-1">
                ${problems.map(p => {
                    const isError = p.severity === 4;
                    const icon = isError ? 
                        `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" class="text-red-500" stroke="currentColor" stroke-width="3"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>` : 
                        `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" class="text-yellow-500" stroke="currentColor" stroke-width="3"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
                    
                    const fileName = p.path.split('/').pop();
                    
                    return `
                        <div class="flex items-start gap-3 p-1.5 hover:bg-[#161b22] cursor-pointer rounded border border-transparent hover:border-gray-800 transition group" 
                             onclick="window.openFileFromSearch(decodeURIComponent('${encodeURIComponent(p.path)}'), '${fileName}', ${p.startLine}, '')">
                            <div class="shrink-0 mt-0.5">${icon}</div>
                            <div class="flex-1 overflow-hidden">
                                <div class="text-[11px] text-gray-300 font-semibold line-clamp-1">${p.message}</div>
                                <div class="flex items-center gap-2 mt-0.5 opacity-60 text-[9px] uppercase tracking-widest font-bold">
                                    <span class="text-blue-400">${fileName}</span>
                                    <span class="text-gray-600">${p.startLine}:${p.startColumn}</span>
                                    <span class="text-gray-700 font-normal">[${p.source}]</span>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    };

    subscribe((newState, oldState) => {
        if (newState.problems !== oldState?.problems) {
            renderProblems();
        }
    });

    renderProblems();
};
