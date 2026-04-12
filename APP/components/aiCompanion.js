import { state, setState, subscribe } from '../core/state.js';

/**
 * AI Companion Component - GXCode Evolution 2026
 * Gestisce l'animazione dello Slime, le nuvolette e l'interazione sidebar.
 */
export const renderAiCompanion = (container) => {
    if (!container) return;

    const comp = state.aiCompanion;

    // STATO 1: Ollama non installato
    if (!comp.installed) {
        container.innerHTML = `
            <div class="flex flex-col items-center justify-center p-8 text-center gap-6 mt-10 animate-fade-in">
                <div class="relative">
                    <div class="w-24 h-24 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 text-4xl">⚠️</div>
                </div>
                <div class="space-y-2">
                    <h3 class="text-xs font-black text-white uppercase tracking-[0.3em] italic">Ollama Non Trovato</h3>
                    <p class="text-[10px] text-gray-500 leading-relaxed uppercase tracking-tighter max-w-[200px]">
                        Il motore AI locale non è installato nel sistema.
                    </p>
                </div>
                <button onclick="window.openAiCompanionSettings()" class="group relative px-10 py-3 bg-red-600 hover:bg-red-500 text-white text-[10px] font-black rounded-xl transition-all active:scale-95 uppercase tracking-widest shadow-[0_10px_30px_rgba(220,38,38,0.3)]">
                    <span class="relative z-10">Configura Ora</span>
                    <div class="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform"></div>
                </button>
            </div>
        `;
        return;
    }

    // STATO 2: Ollama installato ma modello non scaricato
    if (comp.installed && !comp.modelDownloaded) {
        container.innerHTML = `
            <div class="flex flex-col items-center justify-center p-8 text-center gap-6 mt-10 animate-fade-in">
                <div class="relative">
                    <div class="w-24 h-24 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 text-4xl">📦</div>
                </div>
                <div class="space-y-2">
                    <h3 class="text-xs font-black text-white uppercase tracking-[0.3em] italic">Modello Mancante</h3>
                    <p class="text-[10px] text-gray-500 leading-relaxed uppercase tracking-tighter max-w-[200px]">
                        Ollama è installato, ma manca il modello AI.
                    </p>
                </div>
                <button onclick="window.openAiCompanionSettings()" class="group relative px-10 py-3 bg-amber-600 hover:bg-amber-500 text-white text-[10px] font-black rounded-xl transition-all active:scale-95 uppercase tracking-widest shadow-[0_10px_30px_rgba(217,119,6,0.3)]">
                    <span class="relative z-10">Scarica Modello</span>
                    <div class="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform"></div>
                </button>
            </div>
        `;
        return;
    }

    // STATO 3 e 4: Tutto pronto (acceso o spento)
    const isActive = comp.enabled;
    // Extended states: sleeping, idle, thinking, helping, deleting, excited
    const slimeState = !comp.enabled 
        ? 'sleeping' 
        : comp.status === 'helping' 
            ? 'helping' 
            : comp.status === 'thinking'
                ? 'thinking'
                : comp.status === 'deleting'
                    ? 'deleting'
                    : comp.status === 'excited'
                        ? 'excited'
                        : 'idle';
    const bubbleMsg = getBubbleMessage(comp);

    container.innerHTML = `
        <div class="flex flex-col h-full bg-[#0b0c12]/50 backdrop-blur-xl border-t border-white/5 animate-fade-in overflow-hidden">
            <!-- Header Controls -->
            <div class="p-4 flex items-center justify-between border-b border-white/5">
                <div class="flex items-center gap-2">
                    <div class="w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500 animate-pulse' : 'bg-gray-600'}" data-component="companion-indicator"></div>
                    <span class="text-[9px] font-black text-gray-400 uppercase tracking-widest" data-component="companion-status">${isActive ? 'Operativo' : 'Inattivo'}</span>
                </div>
                <div class="flex items-center gap-2">
                    <button onclick="window.openAiCompanionSettings()" class="px-2 py-1.5 rounded-lg text-[8px] font-black uppercase transition-all bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10 hover:text-white" title="Configura">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
                    </button>
                    <button onclick="window.toggleAiCompanion()" class="px-4 py-1.5 rounded-lg text-[8px] font-black uppercase transition-all ${comp.enabled ? 'bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20'}">
                        ${comp.enabled ? 'Spegni' : 'Accendi'}
                    </button>
                </div>
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
                <div class="slime-container ${slimeState}" id="gx-slime" data-component="slime">
                    <div class="slime-body">
                        <div class="slime-eye left"></div>
                        <div class="slime-eye right"></div>
                        <div class="slime-mouth"></div>
                    </div>
                    <!-- Slime Hands for expressions -->
                    <div class="slime-hand left-hand"></div>
                    <div class="slime-hand right-hand"></div>
                    <div class="slime-shadow"></div>
                </div>

                <!-- Status Info -->
                <div class="mt-12 text-center">
                    <div class="text-[10px] font-black text-white/40 uppercase tracking-[0.4em]">${comp.model.replace('qwen', 'Qwen ').replace('coder', 'Coder').replace(':', ' ').replace('b', 'B')}</div>
                    <div class="text-[8px] text-gray-600 font-bold uppercase mt-1">Local Intelligence engine</div>
                </div>
            </div>

            <!-- Footer Stats (Mini) -->
            <div class="p-3 bg-black/20 flex items-center justify-around border-t border-white/5">
                <div class="flex flex-col items-center">
                    <span class="text-[7px] text-gray-600 font-black uppercase">RAM</span>
                    <span class="text-[9px] text-gray-400 font-mono">${comp.stats.freeRam || '?'}G</span>
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
 * FIX: Aggiorna solo lo stato dello slime senza ricostruire il DOM
 * Questo permette alle animazioni CSS di essere fluide
 * IMPORTANTE: Non aggiorna la bubble per evitare flash casuali
 */
const updateSlimeState = (container) => {
    const comp = state.aiCompanion;
    const slimeEl = container.querySelector('#gx-slime');
    const bubbleEl = container.querySelector('#ai-bubble');
    const statusText = container.querySelector('[data-component="companion-status"]');
    const indicatorDot = container.querySelector('[data-component="companion-indicator"]');

    if (!slimeEl) return;

    // Calcola il nuovo stato dello slime
    const slimeState = !comp.enabled
        ? 'sleeping'
        : comp.status === 'helping'
            ? 'helping'
            : comp.status === 'thinking'
                ? 'thinking'
                : comp.status === 'deleting'
                    ? 'deleting'
                    : comp.status === 'excited'
                        ? 'excited'
                        : 'idle';

    // FIX: Aggiorna solo le classi per transizione CSS fluida
    // Non ricostruire il DOM!
    slimeEl.className = `slime-container ${slimeState}`;

    // FIX: Aggiorna visibilità bubble SOLO se enabled cambia (non il testo!)
    if (bubbleEl) {
        const wasVisible = bubbleEl.classList.contains('visible');
        const shouldBeVisible = comp.enabled;
        if (wasVisible !== shouldBeVisible) {
            bubbleEl.className = `ai-bubble mb-8 ${shouldBeVisible ? 'visible' : 'opacity-0'}`;
        }
        // NON aggiornare il testo della bubble - causa flash casuali!
    }

    // Aggiorna indicatore e testo stato
    if (indicatorDot) {
        const isActive = comp.enabled;
        indicatorDot.className = `w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500 animate-pulse' : 'bg-gray-600'}`;
    }
    if (statusText) {
        const currentText = statusText.textContent;
        const newText = comp.enabled ? 'Operativo' : 'Inattivo';
        if (currentText !== newText) {
            statusText.textContent = newText;
        }
    }
};

/**
 * Eventi Globali
 */
window.openAiCompanionSettings = () => {
    setState({ isSettingsOpen: true, activeSettingsTab: 'ai-companion' });
};

/**
 * Inizializzazione modulo - check stato iniziale
 */
console.log('[AI-COMPANION] Module initialized - checking initial state...');
setTimeout(() => {
    if (window.checkAiCompanionInitialState) {
        window.checkAiCompanionInitialState();
    }
}, 2000); // Aspetta 2 secondi che l'app sia completamente avviata

// Subscribe per quando si apre la tab AI Companion
subscribe((newState, oldState) => {
    if (newState.activeRightTab === 'companion' && oldState?.activeRightTab !== 'companion') {
        // Quando si entra nella tab, controlla lo stato SOLO una volta
        if (window.checkAiCompanionInitialState) {
            window.checkAiCompanionInitialState();
        }
    }

    // Re-render SOLO quando cambia qualcosa di rilevante per il companion
    // FIX: Trigger SOLO su enabled change, non su status (che cambia troppo spesso)
    if (newState.activeRightTab === 'companion') {
        const enabledChanged = newState.aiCompanion?.enabled !== oldState?.aiCompanion?.enabled;

        if (enabledChanged) {
            // FIX: Debounce solo quando enabled cambia (acceso/spento)
            if (window._companionRenderTimer) clearTimeout(window._companionRenderTimer);
            window._companionRenderTimer = setTimeout(() => {
                const container = document.querySelector('[data-component="ai-companion"]');
                if (container) {
                    renderAiCompanion(container); // Full render solo quando enabled cambia
                }
            }, 300);
        }
    }
});

/**
 * FIX: Update slime classes senza debounce per status changes
 * Chiamato direttamente da trackAiActivity in app.js
 */
window.updateCompanionSlime = () => {
    const container = document.querySelector('[data-component="ai-companion"]');
    if (!container) return;
    
    const comp = state.aiCompanion;
    const slimeEl = container.querySelector('#gx-slime');
    const indicatorDot = container.querySelector('[data-component="companion-indicator"]');
    const statusText = container.querySelector('[data-component="companion-status"]');

    if (!slimeEl) return;

    const slimeState = !comp.enabled
        ? 'sleeping'
        : comp.status === 'helping'
            ? 'helping'
            : comp.status === 'thinking'
                ? 'thinking'
                : comp.status === 'deleting'
                    ? 'deleting'
                    : comp.status === 'excited'
                        ? 'excited'
                        : 'idle';

    // Update classes directly - CSS transitions handle smooth animation
    slimeEl.className = `slime-container ${slimeState}`;

    if (indicatorDot) {
        indicatorDot.className = `w-1.5 h-1.5 rounded-full ${comp.enabled ? 'bg-emerald-500 animate-pulse' : 'bg-gray-600'}`;
    }
    if (statusText) {
        statusText.textContent = comp.enabled ? 'Operativo' : 'Inattivo';
    }
};

/**
 * Check iniziale all'avvio per sincronizzare stato
 * NOTA: usa un flag per evitare di sovrascrivere azioni utente recenti
 */
let _lastUserToggleTime = 0;
let _isCheckingInitialState = false;
let _userExplicitlyTurnedOff = false; // Flag: l'utente ha spento manualmente il companion

window.checkAiCompanionInitialState = async () => {
    // Evita check multipli simultanei
    if (_isCheckingInitialState) return;
    _isCheckingInitialState = true;

    try {
        // Se l'utente ha fatto toggle negli ultimi 5 secondi, non sovrascrivere
        if (Date.now() - _lastUserToggleTime < 5000) {
            console.log('[AI-COMPANION] Skipping initial check - user action too recent');
            return;
        }

        // FIX: Se l'utente ha spento manualmente, non riattivare automaticamente
        // Solo se è ancora spento (se l'utente lo ha riaperto, resetta il flag)
        if (_userExplicitlyTurnedOff && !state.aiCompanion.enabled) {
            console.log('[AI-COMPANION] Skipping initial check - user explicitly turned off');
            return;
        }
        // Reset del flag se l'utente ha riaperto il companion
        if (state.aiCompanion.enabled) {
            _userExplicitlyTurnedOff = false;
        }

        const comp = state.aiCompanion;
        console.log(`[AI-COMPANION] checkInitialState - installed: ${comp.installed}, modelDownloaded: ${comp.modelDownloaded}, enabled: ${comp.enabled}`);

        // Se non è nemmeno installato, niente da fare
        if (!comp.installed) return;

        // Controlla se Ollama è running
        const isRunning = await window.electronAPI.aiCompanionIsRunning();
        console.log(`[AI-COMPANION] Initial state check - Ollama running: ${isRunning}`);

        // Il modello rimane scaricato finché non viene esplicitamente rimosso dall'utente
        // Controlla se è installato solo se Ollama è running
        let modelDownloaded = comp.modelDownloaded;
        if (isRunning) {
            const modelCheck = await window.electronAPI.aiCompanionIsModelInstalled(comp.model);
            modelDownloaded = modelCheck.success && modelCheck.isInstalled;
            console.log(`[AI-COMPANION] Model check (Ollama running): ${modelDownloaded}`);
        } else {
            console.log(`[AI-COMPANION] Ollama not running, keeping cached modelDownloaded: ${modelDownloaded}`);
        }

        // Aggiorna stato solo se c'è un cambiamento reale
        if (
            isRunning !== comp.enabled ||
            modelDownloaded !== comp.modelDownloaded
        ) {
            console.log(`[AI-COMPANION] Syncing state: enabled ${comp.enabled}→${isRunning}, modelDownloaded ${comp.modelDownloaded}→${modelDownloaded}`);
            setState({
                aiCompanion: {
                    ...comp,
                    enabled: isRunning,
                    modelDownloaded,
                    status: isRunning ? 'on' : 'ready'
                }
            });
        } else {
            console.log('[AI-COMPANION] State already in sync, no changes needed');
        }
    } catch (err) {
        console.error('[AI-COMPANION] Initial state check failed:', err);
    } finally {
        _isCheckingInitialState = false;
    }
};

window.toggleAiCompanion = async () => {
    // Registra il timestamp dell'azione utente
    _lastUserToggleTime = Date.now();

    const newState = !state.aiCompanion.enabled;

    if (newState && state.aiCompanion.installed) {
        // Usa i percorsi configurati, oppure ottieni i default dal backend
        let installPath = state.aiCompanion.installPath;
        let modelsPath = state.aiCompanion.modelsPath;

        // Fallback: se i percorsi non sono salvati, ottienili dal backend
        if (!installPath) {
            installPath = await window.electronAPI.aiCompanionGetDefaultInstallPath();
            console.log(`[AI-COMPANION] Using default installPath: ${installPath}`);
        }
        if (!modelsPath) {
            modelsPath = await window.electronAPI.aiCompanionGetDefaultModelsPath();
            console.log(`[AI-COMPANION] Using default modelsPath: ${modelsPath}`);
        }

        // Aggiorna i percorsi nello stato per il futuro
        if (!state.aiCompanion.installPath || !state.aiCompanion.modelsPath) {
            setState({
                aiCompanion: {
                    ...state.aiCompanion,
                    installPath,
                    modelsPath
                }
            });
        }
        
        if (!installPath || !modelsPath) {
            setState({
                aiCompanion: {
                    ...state.aiCompanion,
                    enabled: false,
                    status: 'unconfigured'
                }
            });
            window.gxToast("Configura i percorsi nelle impostazioni prima di accendere.", 'warning');
            return;
        }

        // Feedback immediato
        setState({
            aiCompanion: {
                ...state.aiCompanion,
                enabled: true,
                status: 'on'
            }
        });

        window.gxToast("Avvio motore AI locale...", 'info');

        try {
            const result = await window.electronAPI.aiCompanionStart({
                installPath,
                modelsPath
            });

            if (!result || !result.success) {
                // Rollback stato
                setState({
                    aiCompanion: {
                        ...state.aiCompanion,
                        enabled: false,
                        status: state.aiCompanion.installed ? 'ready' : 'unconfigured'
                    }
                });
                window.gxToast(`Errore avvio: ${result?.error || 'Verifica installazione.'}`, 'error');
                return;
            }

            // Aspetta che Ollama sia pronto (max 10 secondi)
            let ollamaReady = false;
            for (let i = 0; i < 20; i++) {
                await new Promise(resolve => setTimeout(resolve, 500));
                const status = await window.electronAPI.aiCompanionCheckStatus();
                if (status) {
                    ollamaReady = true;
                    break;
                }
            }

            if (!ollamaReady) {
                setState({
                    aiCompanion: {
                        ...state.aiCompanion,
                        enabled: false,
                        status: 'ready'
                    }
                });
                window.gxToast("Ollama non risponde.", 'error');
                return;
            }

            // VERIFICA: controlla che il modello selezionato sia scaricato
            const model = state.aiCompanion.model;
            const modelCheck = await window.electronAPI.aiCompanionIsModelInstalled(model);

            if (!modelCheck.success || !modelCheck.isInstalled) {
                // Non redirect alle settings - aggiorna stato e mostra messaggio chiaro
                setState({
                    aiCompanion: {
                        ...state.aiCompanion,
                        enabled: false,
                        modelDownloaded: false,
                        status: 'ready'
                    }
                });
                window.gxToast(`Modello "${model}" non scaricato.`, 'warning');
                return;
            }

            // Modello verificato, aggiorna stato
            setState({
                aiCompanion: {
                    ...state.aiCompanion,
                    modelDownloaded: true,
                    status: 'on'
                }
            });
        } catch (err) {
            console.error('[AI-COMPANION] Toggle error:', err);
            window.gxToast(`Errore: ${err.message}`, 'error');
        }
    } else if (!newState) {
        // FIX: Segna che l'utente ha spento manualmente
        _userExplicitlyTurnedOff = true;
        
        // Se stiamo spegnendo, ferma il servizio
        setState({
            aiCompanion: {
                ...state.aiCompanion,
                enabled: false,
                status: state.aiCompanion.installed ? 'ready' : 'unconfigured'
            }
        });

        try {
            const result = await window.electronAPI.aiCompanionStop();

            if (!result || !result.success) {
                // Rollback stato
                setState({
                    aiCompanion: {
                        ...state.aiCompanion,
                        enabled: true,
                        status: 'on'
                    }
                });
                window.gxToast(`Errore spegnimento: ${result?.error || 'Errore sconosciuto.'}`, 'error');
            }
        } catch (err) {
            console.error('[AI-COMPANION] Stop error:', err);
            window.gxToast(`Errore: ${err.message}`, 'error');
            // Rollback in caso di eccezione
            setState({
                aiCompanion: {
                    ...state.aiCompanion,
                    enabled: true,
                    status: 'on'
                }
            });
        }
    }
};
