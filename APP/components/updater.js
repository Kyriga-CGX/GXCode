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
        if (window.gxToast) {
            window.gxToast(window.t('updater.available'), 'info', 6000);
        }
    };

    // Ascolta eventi dal Main Process
    window.electronAPI.onUpdateAvailable(() => {
        showUpdatePopup();
    });

    window.electronAPI.onUpdateReady(() => {
        // Notifica finale quando il download è completato
        window.gxToast(window.t('updater.completed'), 'info', 8000);
    });

    // Primo controllo all'avvio dopo 10 secondi
    setTimeout(checkForUpdates, 10000);
    
    // Loop
    setInterval(checkForUpdates, CHECK_INTERVAL);
};
