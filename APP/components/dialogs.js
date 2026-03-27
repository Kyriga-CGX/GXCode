// APP/components/dialogs.js
import { state } from '../core/state.js';

/**
 * Custom Themed Modal for GXCode
 * Suplace confirm(), alert() e prompt() con versioni stilizzate.
 */

export const gxConfirm = (title, message, onConfirm) => {
    const root = document.getElementById('modals-root');
    root.classList.remove('pointer-events-none');
    
    root.innerHTML = `
        <div class="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[100] animate-fade-in p-4">
            <div class="bg-[#12161d] w-full max-w-sm rounded-xl border border-gray-800 shadow-2xl flex flex-col scale-in overflow-hidden">
                <div class="p-6 text-center space-y-4">
                    <div class="w-12 h-12 bg-red-500/20 text-red-400 rounded-full flex items-center justify-center mx-auto mb-2 border border-red-500/30">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                    </div>
                    <h3 class="text-gray-100 font-bold text-lg">${title}</h3>
                    <p class="text-gray-400 text-sm leading-relaxed">${message}</p>
                </div>
                
                <div class="flex border-t border-gray-800 divide-x divide-gray-800">
                    <button id="gx-modal-cancel" class="flex-1 py-4 text-xs font-bold uppercase tracking-widest text-gray-500 hover:bg-white/5 transition">Annulla</button>
                    <button id="gx-modal-ok" class="flex-1 py-4 text-xs font-bold uppercase tracking-widest text-red-400 hover:bg-red-500/10 transition">Conferma</button>
                </div>
            </div>
        </div>
    `;

    document.getElementById('gx-modal-cancel').onclick = () => {
        root.innerHTML = '';
        root.classList.add('pointer-events-none');
    };

    document.getElementById('gx-modal-ok').onclick = () => {
        root.innerHTML = '';
        root.classList.add('pointer-events-none');
        if (onConfirm) onConfirm();
    };
};

export const gxAlert = (title, message, iconType = 'info') => {
    const root = document.getElementById('modals-root');
    root.classList.remove('pointer-events-none');
    
    const icon = iconType === 'error' 
        ? `<div class="w-12 h-12 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto border border-red-500/30"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div>`
        : `<div class="w-12 h-12 bg-blue-500/20 text-blue-400 rounded-full flex items-center justify-center mx-auto border border-blue-500/30"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg></div>`;

    root.innerHTML = `
        <div class="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[110] animate-fade-in p-4">
            <div class="bg-[#12161d] w-full max-w-sm rounded-xl border border-gray-800 shadow-2xl flex flex-col scale-in overflow-hidden">
                <div class="p-6 text-center space-y-4">
                    ${icon}
                    <h3 class="text-gray-100 font-bold text-lg">${title}</h3>
                    <p class="text-gray-400 text-sm leading-relaxed">${message}</p>
                </div>
                <div class="p-4 border-t border-gray-800">
                    <button id="gx-alert-ok" class="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition uppercase tracking-widest">OK</button>
                </div>
            </div>
        </div>
    `;

    document.getElementById('gx-alert-ok').onclick = () => {
        root.innerHTML = '';
        root.classList.add('pointer-events-none');
    };
};

window.gxConfirm = gxConfirm;
window.gxAlert = gxAlert;

export const gxToast = (message, type = 'info', duration = 4000) => {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'fixed bottom-6 left-6 flex flex-col gap-3 pointer-events-none';
        container.style.zIndex = "99999"; // Garanzia assoluta sopra ogni modale (Tailwind JIT potrebbe mancare nel bundle)
        document.body.appendChild(container);
    } else {
        // Assicurati che sia l'ultimo elemento per lo stacking context
        document.body.appendChild(container);
        container.style.zIndex = "99999";
    }

    const toast = document.createElement('div');
    toast.className = `
        pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg border shadow-2xl animate-slide-up-fade min-w-[280px]
        ${type === 'error' ? 'bg-[#1c1616] border-red-500/30 text-red-400' : 'bg-[#161b22] border-blue-500/30 text-blue-400'}
    `;

    const icon = type === 'error' 
        ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`
        : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;

    toast.innerHTML = `
        <div class="shrink-0">${icon}</div>
        <div class="flex-1 text-xs font-bold">${message}</div>
        <button class="shrink-0 text-gray-500 hover:text-white transition">✕</button>
    `;

    container.appendChild(toast);

    const removeToast = () => {
        toast.classList.add('animate-fade-out');
        setTimeout(() => toast.remove(), 300);
    };

    toast.querySelector('button').onclick = removeToast;
    setTimeout(removeToast, duration);
};

window.gxToast = gxToast;
