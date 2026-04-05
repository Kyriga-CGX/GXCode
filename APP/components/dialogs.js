// APP/components/dialogs.js
import { state } from '../core/state.js';

/**
 * Custom Themed Modal for GXCode
 * Suplace confirm(), alert() e prompt() con versioni stilizzate.
 */

export const gxConfirm = (title, message, onConfirm) => {
    const root = document.getElementById('dialogs-root');
    if (!root) return;
    root.classList.remove('pointer-events-none');
    root.style.pointerEvents = 'auto';

    root.innerHTML = `
        <div class="fixed inset-0 bg-black/90 flex items-center justify-center z-[100000] animate-fade-in p-4 backdrop-blur-md">
            <div class="snapshot-modal scale-in !max-w-[640px] !border-white/10 shadow-[0_40px_100px_rgba(0,0,0,0.8)] overflow-hidden">
                <!-- Header Snapshot Fidelity (Amber for Warning) -->
                <div class="snapshot-header !border-white/5 bg-white/[0.02]" style="padding: 16px 40px !important;">
                    <div class="flex items-center text-left">
                        <div class="snapshot-header-box !bg-[#d29922] !shadow-[0_0_30px_rgba(210,153,34,0.5)] !w-14 !h-14">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                        </div>
                        <div class="ml-6">
                            <h3 class="text-white font-black text-2xl leading-none uppercase tracking-tighter">${title}</h3>
                            <span class="text-[9px] text-[#d29922] font-black uppercase mt-1.5 block tracking-[0.5em] opacity-80">Security Protocol | GX CORE 2026</span>
                        </div>
                    </div>
                </div>
                
                <!-- Corpo Industrial Style -->
                <div class="bg-[#0b0c10] space-y-20 text-left" style="padding: 15px 25px 25px 25px !important;">
                    <div class="space-y-4">
                        <label class="text-gray-600 text-[10px] font-black uppercase tracking-[0.3em] block opacity-50">Messaggio di Sistema</label>
                        <p class="text-gray-200 text-[16px] font-bold leading-normal tracking-tight group-hover:text-white transition-colors">${message}</p>
                    </div>
                    
                    <div class="mt-4 flex items-center gap-3 active:scale-[0.98] transition-all">
                        <div class="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shadow-[0_0_15px_#ef4444]"></div>
                        <span class="text-[10px] text-red-500/80 font-black uppercase tracking-widest leading-none">
                            Attenzione: l'operazione è definitiva.
                        </span>
                    </div>
                </div>
                
                <!-- Footer Snap Style -->
                <div class="snapshot-footer bg-black/40 border-t border-white/[0.03] !justify-end gap-6" style="padding: 18px 40px !important;">
                    <button id="gx-confirm-cancel" class="px-8 py-3 text-[11px] font-black text-gray-500 hover:text-white hover:bg-white/5 rounded-xl transition-all uppercase tracking-[0.4em] active:scale-95 border border-transparent hover:border-white/10">
                        Ignora
                    </button>
                    <button id="gx-confirm-ok" class="flex items-center justify-center gap-3 bg-[#d29922] hover:bg-[#e6a82c] text-black text-[12px] font-black uppercase tracking-[0.2em] px-12 py-4 rounded-xl shadow-[0_10px_40px_rgba(210,153,34,0.3)] hover:shadow-[0_15px_50px_rgba(210,153,34,0.5)] transition-all hover:scale-[1.05] active:scale-95 group">
                        <span>Conferma</span>
                        <div class="w-6 h-6 rounded-lg bg-black/10 flex items-center justify-center group-hover:bg-black/20 transition-colors">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4.5"><polyline points="20 6 9 17 4 12"/></svg>
                        </div>
                    </button>
                </div>
            </div>
        </div>
    `;

    const closeHandler = () => {
        root.innerHTML = '';
        root.classList.add('pointer-events-none');
        root.style.pointerEvents = 'none';
    };

    document.getElementById('gx-confirm-cancel').onclick = closeHandler;
    document.getElementById('gx-confirm-ok').onclick = () => {
        closeHandler();
        if (onConfirm) onConfirm();
    };
};

export const gxAlert = (title, message, iconType = 'info') => {
    const root = document.getElementById('dialogs-root');
    if (!root) return;
    root.classList.remove('pointer-events-none');
    root.style.pointerEvents = 'auto';

    const isError = iconType === 'error';
    const accentColor = isError ? '#f85149' : '#58a6ff';
    const boxColor = isError ? '#da3633' : '#1f6feb';

    root.innerHTML = `
        <div class="fixed inset-0 bg-black/80 flex items-center justify-center z-[100000] animate-fade-in p-4 backdrop-blur-md">
            <div class="snapshot-modal scale-in !max-w-[420px] ${isError ? '!border-[#f8514930]' : '!border-[#58a6ff30]'}">
                <!-- Header Snapshot Fidelity -->
                <div class="snapshot-header ${isError ? '!border-[#f8514930]' : '!border-[#58a6ff30]'}">
                    <div class="flex items-center">
                        <div class="snapshot-header-box" style="background: ${boxColor}; box-shadow: 0 0 20px ${accentColor}40">
                            ${isError
            ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`
            : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`
        }
                        </div>
                        <div class="ml-4 text-left">
                            <h3 class="text-white font-bold text-lg leading-none uppercase tracking-tighter">${title}</h3>
                            <span class="text-[9px] font-bold uppercase tracking-[0.2em] mt-1 block" style="color: ${accentColor}">${isError ? 'Notifica Critica' : 'Avviso di Sistema'}</span>
                        </div>
                    </div>
                </div>
                
                <!-- Corpo Snapshot Style -->
                <div class="p-12 bg-[#0d1117] text-center space-y-6">
                    <p class="text-gray-400 text-[11px] leading-relaxed font-black uppercase tracking-[0.2em] px-2">${message}</p>
                    
                    <div class="h-[1px] w-12 mx-auto bg-white/5"></div>
                    
                    <div class="flex items-center justify-center gap-2 text-[8px] font-bold text-gray-600 uppercase tracking-[0.3em]">
                        <span class="w-1 h-1 rounded-full" style="background: ${accentColor}"></span>
                        Richiesta Attenzione Utente
                    </div>
                </div>
                
                <!-- Footer Snapshot Style -->
                <div class="snapshot-footer !justify-center px-10 py-8 bg-[#0b0c10]">
                    <button id="gx-alert-ok" class="snapshot-btn-blue !w-full !py-4 !text-[11px]" style="background: ${boxColor}; box-shadow: 0 4px 15px ${accentColor}30">
                        <span>Ricevuto / Chiudi</span>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
                    </button>
                </div>
            </div>
        </div>
    `;

    document.getElementById('gx-alert-ok').onclick = () => {
        root.innerHTML = '';
        root.classList.add('pointer-events-none');
        root.style.pointerEvents = 'none';
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
        container.style.zIndex = "100001";
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
window.gxConfirm = gxConfirm;
window.gxAlert = gxAlert;

window.gxToast = gxToast;

/**
 * Styled Prompt Dialog
 */
export const gxPrompt = (title, message, defaultValue = '', onConfirm) => {
    const root = document.getElementById('dialogs-root');
    if (!root) return;
    root.classList.remove('pointer-events-none');
    root.style.pointerEvents = 'auto';

    root.innerHTML = `
        <div class="fixed inset-0 bg-black/80 flex items-center justify-center z-[100000] animate-fade-in p-4 backdrop-blur-md">
            <div class="snapshot-modal scale-in !max-w-[480px] !border-[#2ea04330]">
                <!-- Header Snapshot Fidelity (Green for Creation) -->
                <div class="snapshot-header !border-[#2ea04330]">
                    <div class="flex items-center">
                        <div class="snapshot-header-box !bg-[#238636] !shadow-[0_0_20px_rgba(35,134,54,0.4)]">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                        </div>
                        <div class="ml-4 text-left">
                            <h3 class="text-white font-bold text-lg leading-none uppercase tracking-tighter">${title}</h3>
                            <span class="text-[9px] text-[#2ea043] font-bold uppercase tracking-[0.2em] mt-1 block">Operazione di Sistema | GX-FS</span>
                        </div>
                    </div>
                </div>
                
                <!-- Corpo Snapshot Style -->
                <div class="p-10 bg-[#0d1117] space-y-8">
                    <div class="space-y-4">
                        <label class="text-gray-500 text-[10px] font-black uppercase tracking-[0.3em] block ml-1">${message}</label>
                        <div class="relative group">
                            <div class="absolute -inset-0.5 bg-[#2ea043]/10 blur-xl rounded-2xl group-focus-within:bg-[#2ea043]/20 transition-all"></div>
                            <input type="text" id="gx-prompt-input" value="${defaultValue}" 
                                   class="relative w-full bg-[#0b0c10] border border-[#30363d] focus:border-[#2ea043] text-white rounded-xl px-5 py-4 text-sm font-bold outline-none transition-all placeholder-white/30" 
                                   placeholder="Digita il nome d'origine..." autofocus>
                        </div>
                    </div>
                    
                    <div class="flex items-center gap-3 p-4 bg-black/20 rounded-xl border border-white/5">
                        <div class="w-2 h-2 rounded-full bg-[#2ea043] animate-pulse"></div>
                        <span class="text-[9px] text-gray-500 font-bold uppercase tracking-widest">In attesa dell'input utente per la creazione...</span>
                    </div>
                </div>
                
                <!-- Footer Snapshot Style -->
                <div class="snapshot-footer px-8 py-6">
                    <button id="gx-prompt-cancel" class="text-[10px] font-extrabold text-gray-500 hover:text-white transition uppercase tracking-[0.3em]">Annulla</button>
                    <button id="gx-prompt-ok" class="snapshot-btn-blue !bg-[#238636] !shadow-[0_4px_15px_rgba(35,134,54,0.3)] !px-10">
                        <span>Crea Ora</span>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
                    </button>
                </div>
            </div>
        </div>
    `;

    const input = document.getElementById('gx-prompt-input');
    input.focus();
    input.select();

    const close = () => {
        root.innerHTML = '';
        root.classList.add('pointer-events-none');
        root.style.pointerEvents = 'none';
    };

    document.getElementById('gx-prompt-cancel').onclick = close;

    const confirm = () => {
        const val = input.value.trim();
        if (val) {
            close();
            if (onConfirm) onConfirm(val);
        } else {
            input.classList.add('border-red-500');
            setTimeout(() => input.classList.remove('border-red-500'), 1000);
        }
    };

    document.getElementById('gx-prompt-ok').onclick = confirm;

    input.onkeydown = (e) => {
        if (e.key === 'Enter') confirm();
        if (e.key === 'Escape') close();
    };
};

window.gxPrompt = gxPrompt;

/**
 * gxQuickPick - Styled Multi-Select/List Selection Dialog
 * title: String
 * items: Array of { label, description, icon, value }
 * onSelect: function(value)
 */
export const gxQuickPick = (title, items, onSelect) => {
    const root = document.getElementById('dialogs-root');
    if (!root) return;
    root.classList.remove('pointer-events-none');
    root.style.pointerEvents = 'auto';

    let selectedIndex = 0; const render = () => {
        root.innerHTML = `
            <div id="gx-qp-overlay" class="fixed inset-0 bg-black/20 backdrop-blur-3xl flex items-start justify-center z-[100000] animate-fade-in pt-[10vh] p-12">
                <div class="liquid-glass w-full max-w-3xl rounded-[6rem] flex flex-col scale-in overflow-hidden max-h-[75vh] border-white/5 shadow-[0_120px_300px_rgba(0,0,0,1)] p-6">
                    <div class="premium-mesh-bg op-40"></div>
                    <div class="p-12 border-b border-white/[0.02] bg-white/[0.01] relative z-10 text-center">
                        <div class="flex flex-col items-center gap-4 mb-10">
                             <div class="w-16 h-16 rounded-full bg-indigo-600/20 text-indigo-400 flex items-center justify-center border border-indigo-500/20 shadow-3xl animate-pulse backdrop-blur-3xl">
                                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                             </div>
                             <div class="space-y-2">
                                <h3 class="text-white font-black text-2xl uppercase tracking-[0.5em] mb-1">${title}</h3>
                                <span class="text-[9px] text-gray-700 font-bold uppercase tracking-[0.6em]">GX-ENGINE COMMAND CORE v3.0</span>
                             </div>
                        </div>
                        <div class="floating-2026 group max-w-lg mx-auto">
                            <input type="text" id="gx-qp-input" 
                                   class="pod-input-2026 w-full outline-none placeholder-transparent !py-6 shadow-3xl text-center" 
                                   placeholder=" " autofocus>
                            <label class="label-2026 !translate-x-[-50%] !left-1/2">Cerca comandi o file...</label>
                            <div class="absolute right-10 top-1/2 -translate-y-1/2 flex gap-3 items-center opacity-40 select-none">
                                <kbd class="px-3 py-1.5 rounded-xl bg-white/5 text-[9px] font-black border border-white/10 uppercase tracking-widest">TAB</kbd>
                            </div>
                        </div>
                    </div>
                    
                    <div id="gx-qp-list" class="flex-1 overflow-y-auto overflow-x-hidden p-10 custom-scrollbar scroll-smooth space-y-4 relative z-10 max-w-2xl mx-auto w-full">
                        ${items.map((item, idx) => `
                            <div class="gx-qp-item group flex flex-col items-center gap-3 px-8 py-8 rounded-[3rem] cursor-pointer transition-all duration-500 ${idx === selectedIndex ? 'bg-gradient-to-br from-indigo-500/20 to-indigo-700/20 text-white shadow-[0_40px_100px_rgba(0,0,0,0.5)] scale-[1.05] z-30 relative ring-2 ring-indigo-500/40' : 'hover:bg-white/[0.02] text-gray-600 active:scale-95'}" 
                                 data-index="${idx}">
                                <div class="shrink-0 w-16 h-16 rounded-full bg-black/40 flex items-center justify-center border border-white/5 transition-transform group-hover:scale-110 shadow-inner ${idx === selectedIndex ? 'bg-indigo-500/20 border-indigo-500/30 text-indigo-400' : ''}">
                                    ${item.icon || '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect width="18" height="18" x="3" y="3" rx="2"/></svg>'}
                                </div>
                                <div class="flex flex-col items-center text-center">
                                    <span class="text-[15px] font-black truncate leading-none tracking-[0.2em] uppercase">${item.label}</span>
                                    <span class="text-[10px] truncate font-bold mt-2 tracking-[0.15em] ${idx === selectedIndex ? 'text-indigo-400' : 'text-gray-700 group-hover:text-gray-500'}">${item.description || 'ACCESSO RAPIDO'}</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                    
                    <!-- QuickPick Footer Elite 2026 -->
                    <div class="px-16 py-8 border-t border-white/[0.01] bg-black/10 shrink-0 relative z-10 flex flex-col items-center gap-4">
                         <div class="h-1 w-20 bg-white/5 rounded-full mb-2"></div>
                         <div class="flex items-center gap-8 opacity-30">
                             <div class="flex items-center gap-3"><kbd class="bg-white/5 px-3 py-1.5 rounded-xl text-[10px] font-black border border-white/10 uppercase">ESC</kbd><span class="text-[9px] font-black uppercase tracking-[0.3em]">Ignora</span></div>
                             <div class="flex items-center gap-3"><kbd class="bg-indigo-500/20 px-3 py-1.5 rounded-xl text-[10px] font-black border border-indigo-500/20 uppercase text-indigo-400">ENTER</kbd><span class="text-[9px] font-black uppercase tracking-[0.3em] text-indigo-400">Esegui</span></div>
                         </div>
                    </div>
                </div>
            </div>
        `;

        const input = document.getElementById('gx-qp-input');
        input.focus();

        // Mouse click events
        const itemsDivs = document.querySelectorAll('.gx-qp-item');
        itemsDivs.forEach(div => {
            div.onclick = () => {
                const idx = parseInt(div.dataset.index);
                confirmSelection(idx);
            };
        });

        // Close on overlay click
        document.getElementById('gx-qp-overlay').onclick = (e) => {
            if (e.target.id === 'gx-qp-overlay') close();
        };

        input.onkeydown = (e) => handleKeyDown(e);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            selectedIndex = (selectedIndex + 1) % items.length;
            render();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            selectedIndex = (selectedIndex - 1 + items.length) % items.length;
            render();
        } else if (e.key === 'Enter') {
            e.preventDefault();
            confirmSelection(selectedIndex);
        } else if (e.key === 'Escape') {
            close();
        }
    };

    const confirmSelection = (idx) => {
        const val = items[idx]?.value;
        close();
        if (onSelect) onSelect(val);
    };

    const close = () => {
        root.innerHTML = '';
        root.classList.add('pointer-events-none');
        root.style.pointerEvents = 'none';
    };

    render();
};

window.gxQuickPick = gxQuickPick;
