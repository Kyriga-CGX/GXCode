import { setState } from '../core/state.js';

export const initUpdater = () => {
    // Controllo ogni 5 minuti (300000ms)
    // Per test rapidi, lo mettiamo a 1 minuto
    const CHECK_INTERVAL = 60000 * 5; 

    const checkForUpdates = async () => {
        try {
            const hasUpdate = await window.electronAPI.checkForUpdates();
            if (hasUpdate) {
                showUpdatePopup();
            }
        } catch (err) {
            console.warn("[Updater] Errore verifica:", err);
        }
    };

    const showUpdatePopup = () => {
        // Usiamo gxConfirm se disponibile, o un toast personalizzato
        if (window.gxConfirm) {
            window.gxConfirm(
                "Aggiornamento Disponibile! 🚀",
                "È stata rilevata una nuova versione di GXCode con nuovi commit. Vuoi andare nelle impostazioni per aggiornare l'applicazione?",
                () => {
                    // Apri impostazioni alla tab aggiornamenti (che creeremo)
                    setState({ isSettingsOpen: true, activeSettingsTab: 'updates' });
                }
            );
        }
    };

    // Primo controllo all'avvio dopo 10 secondi per non appesantire il bootstrap
    setTimeout(checkForUpdates, 10000);
    
    // Ascolta quando la build è pronta per essere installata (scaricata)
    window.electronAPI.onUpdateReady(() => {
        window.gxConfirm(
            "Installazione Pronta! 📦",
            "Il download dell'aggiornamento è terminato. Vuoi riavviare GXCode ora per applicare i cambiamenti?",
            () => {
                window.electronAPI.quitAndInstall();
            }
        );
    });

    // Loop
    setInterval(checkForUpdates, CHECK_INTERVAL);
};
