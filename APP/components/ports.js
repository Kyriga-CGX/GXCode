import { state, subscribe, setState } from '../core/state.js';

export const initPorts = () => {
    const pane = document.getElementById('pane-ports');
    if (!pane) return;

    const renderPorts = async () => {
        try {
            const res = await window.electronAPI.getActivePorts();
            if (!res.success) {
                pane.innerHTML = `<div class="p-4 text-red-500 text-[10px]">Error: ${res.error}</div>`;
                return;
            }

            const ports = res.ports || [];
            
            if (ports.length === 0) {
                pane.innerHTML = `
                    <div class="flex flex-col items-center justify-center h-full opacity-30 select-none pointer-events-none">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="mb-2"><path d="M12 2v20M2 12h20"/></svg>
                        <div class="text-[10px] uppercase font-bold tracking-widest text-center" data-i18n="panes.noActivePorts">${window.t('panes.noActivePorts') || 'Nessuna porta attiva'}</div>
                    </div>
                `;
                return;
            }

            pane.innerHTML = `
                <div class="flex flex-col gap-2">
                    <div class="flex items-center justify-between mb-2">
                        <h3 class="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Active Services (${ports.length})</h3>
                        <button onclick="window.refreshPorts()" class="px-2 py-0.5 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 text-[9px] font-bold uppercase rounded border border-blue-500/20 transition">Refresh</button>
                    </div>
                    <div class="grid grid-cols-5 gap-4 text-[9px] font-bold text-gray-600 uppercase tracking-wider pb-2 border-b border-gray-800">
                        <div>Port</div>
                        <div>Protocol</div>
                        <div class="col-span-2">Address / Process</div>
                        <div class="text-right">Action</div>
                    </div>
                    ${ports.map(p => `
                        <div class="grid grid-cols-5 gap-4 items-center p-1.5 hover:bg-white/5 rounded transition group">
                            <div class="text-blue-400 font-mono font-bold">${p.port}</div>
                            <div class="text-gray-500">${p.protocol}</div>
                            <div class="col-span-2 overflow-hidden truncate whitespace-nowrap text-gray-400 font-mono">
                                ${p.address} ${p.name ? `<span class="text-gray-600 ml-2">[${p.name}]</span>` : ''}
                                <span class="text-[8px] text-gray-700 ml-1">PID: ${p.pid}</span>
                            </div>
                            <div class="text-right">
                                <button onclick="window.killPortProcess(${p.pid})" 
                                        class="opacity-0 group-hover:opacity-100 px-2 py-0.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[8px] font-bold uppercase rounded border border-red-500/20 transition">
                                    Kill
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        } catch (err) {
            pane.innerHTML = `<div class="p-4 text-red-500 text-[10px]">Fatal Error: ${err.message}</div>`;
        }
    };

    window.refreshPorts = renderPorts;
    
    window.killPortProcess = async (pid) => {
        if (!confirm(`Sei sicuro di voler terminare il processo ${pid}?`)) return;
        const res = await window.electronAPI.killProcess(pid);
        if (res.success) {
            renderPorts();
        } else {
            alert("Errore terminazione processo: " + res.error);
        }
    };

    // Primo caricamento
    renderPorts();
    
    // Auto-poll ogni 15 secondi se il pannello è visibile
    setInterval(() => {
        if (!pane.classList.contains('hidden')) {
            renderPorts();
        }
    }, 15000);
};
