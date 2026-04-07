import { state, setState, subscribe } from '../core/state.js';

/**
 * AI Companion Component - GXCode Evolution 2026
 * Gestisce l'animazione dello Slime, le nuvolette e l'interazione sidebar.
 */
export const renderAiCompanion = (container) => {
    if (!container) return;

    const comp = state.aiCompanion;
    const isSetup = comp.status !== 'unconfigured';
    const isActive = comp.enabled && isSetup;

    // Se non configurato, mostra il pulsante di configurazione
    if (!isSetup) {
        container.innerHTML = `
            <div class="flex flex-col items-center justify-center p-8 text-center gap-6 mt-10 animate-fade-in">
                <div class="relative">
                    <div class="w-24 h-24 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 text-4xl animate-pulse">✨</div>
                    <div class="absolute -top-2 -right-2 px-2 py-0.5 bg-blue-600 text-[8px] font-bold rounded-full text-white shadow-lg">NEW</div>
                </div>
                <div class="space-y-2">
                    <h3 class="text-xs font-black text-white uppercase tracking-[0.3em] italic">AI Companion</h3>
                    <p class="text-[10px] text-gray-500 leading-relaxed uppercase tracking-tighter max-w-[200px]">
                        L'assistente locale intelligente che vive nel tuo IDE.
                    </p>
                </div>
                <button onclick="window.openAiCompanionSettings()" class="group relative px-10 py-3 bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-black rounded-xl transition-all active:scale-95 uppercase tracking-widest shadow-[0_10px_30px_rgba(168,85,247,0.3)]">
                    <span class="relative z-10">Configura</span>
                    <div class="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform"></div>
                </button>
            </div>
        `;
        return;
    }

    // Altrimenti mostra lo Slime e i controlli
    const slimeState = !comp.enabled ? 'sleeping' : comp.status === 'helping' ? 'helping' : 'idle';
    const bubbleMsg = getBubbleMessage(comp);

    container.innerHTML = `
        <div class="flex flex-col h-full bg-[#0b0c12]/50 backdrop-blur-xl border-t border-white/5 animate-fade-in overflow-hidden">
            <!-- Header Controls -->
            <div class="p-4 flex items-center justify-between border-b border-white/5">
                <div class="flex items-center gap-2">
                    <div class="w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500 animate-pulse' : 'bg-gray-600'}"></div>
                    <span class="text-[9px] font-black text-gray-400 uppercase tracking-widest">${isActive ? 'Operativo' : 'Inattivo'}</span>
                </div>
                <button onclick="window.toggleAiCompanion()" class="px-4 py-1.5 rounded-lg text-[8px] font-black uppercase transition-all ${comp.enabled ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}">
                    ${comp.enabled ? 'Spegni' : 'Accendi'}
                </button>
            </div>

            <!-- Slime Area -->
            <div class="flex-1 flex flex-col items-center justify-center p-6 relative">
                
                <!-- Bubble -->
                <div class="ai-bubble mb-8 ${isActive ? 'visible' : 'opacity-0'}" id="ai-bubble">
                    <div class="p-3 bg-white/5 border border-white/10 rounded-2xl text-[10px] text-gray-200 font-medium leading-tight relative shadow-2xl">
                        ${bubbleMsg}
                        <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-[#1a1b24] border-r border-b border-white/10 rotate-45"></div>
                    </div>
                </div>

                <!-- The Slime -->
                <div class="slime-container ${slimeState}" id="gx-slime">
                    <div class="slime-body">
                        <div class="slime-eye left"></div>
                        <div class="slime-eye right"></div>
                        <div class="slime-mouth"></div>
                    </div>
                    <div class="slime-shadow"></div>
                </div>

                <!-- Status Info -->
                <div class="mt-12 text-center">
                    <div class="text-[10px] font-black text-white/40 uppercase tracking-[0.4em]">${comp.model.split(':')[0]}</div>
                    <div class="text-[8px] text-gray-600 font-bold uppercase mt-1">Local Intelligence engine</div>
                </div>
            </div>

            <!-- Footer Stats (Mini) -->
            <div class="p-3 bg-black/20 flex items-center justify-around border-t border-white/5">
                <div class="flex flex-col items-center">
                    <span class="text-[7px] text-gray-600 font-black uppercase">RAM</span>
                    <span class="text-[9px] text-gray-400 font-mono">${comp.stats.freeRam}G</span>
                </div>
                <div class="w-[1px] h-4 bg-white/5"></div>
                <div class="flex flex-col items-center">
                    <span class="text-[7px] text-gray-600 font-black uppercase">GPU</span>
                    <span class="text-[9px] text-gray-400 font-mono">${comp.stats.vram || 0}G</span>
                </div>
                <div class="w-[1px] h-4 bg-white/5"></div>
                <div class="flex flex-col items-center">
                    <span class="text-[7px] text-gray-600 font-black uppercase">PING</span>
                    <span class="text-[9px] text-emerald-500 font-mono">1ms</span>
                </div>
            </div>
        </div>
    `;
};

/**
 * Logica per recuperare frasi dinamiche basate sul contesto
 */
const getBubbleMessage = (comp) => {
    if (!comp.enabled) return "Zzz... Sto riposando.";
    
    // In futuro qui leggeremo il contesto reale dal file attivo
    const phrases = [
        "Sto dando un occhio al codice...",
        "Qui si respira aria di refactor!",
        "Ottimo lavoro, procediamo.",
        "Ti serve una mano con le API?",
        "Sto analizzando la struttura...",
        "Ricordati di testare questa parte!"
    ];
    
    return phrases[Math.floor(Math.random() * phrases.length)];
};

/**
 * Eventi Globali
 */
window.openAiCompanionSettings = () => {
    setState({ isSettingsOpen: true, activeSettingsTab: 'ai-companion' });
};

window.toggleAiCompanion = async () => {
    const newState = !state.aiCompanion.enabled;
    
    // Se stiamo accendendo, avvia il servizio nel backend
    if (newState && state.aiCompanion.installed) {
        window.gxToast("Avvio motore AI locale...", 'info');
        await window.electronAPI.aiCompanionStart({
            installPath: state.aiCompanion.installPath,
            modelsPath: state.aiCompanion.modelsPath
        });
    }

    setState({
        aiCompanion: {
            ...state.aiCompanion,
            enabled: newState
        }
    });
};
