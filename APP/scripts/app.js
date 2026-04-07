import { api } from '../core/api.js';
import { state, subscribe, setState } from '../core/state.js';
import { loadLocale, t } from '../core/i18n.js';
import { initMarketplace } from '../components/marketplace.js';
import { initTerminal } from '../components/terminal.js';
import { initSettings } from '../components/settings.js';
import { initIssues } from '../components/issues.js';
import { initWorkspace, initExplorerToolbar } from '../components/workspace.js';
import { initCrud } from '../components/crud.js';
import { initGit } from '../components/git.js';
import { initSearch } from '../components/search.js';
import { initTests } from '../components/tests.js';
import { initBottomPanel } from '../components/bottomPanel.js';
import { initProblems } from '../components/problems.js';
import { initUpdater } from '../components/updater.js';
import { initDebug } from '../components/debug.js';
import { initAiKnowledgeBridge } from '../core/aiKnowledgeBridge.js';
import { initDebugToolbar } from '../components/debugToolbar.js';
import { initSidebar } from '../components/sidebar.js';
import { initGlobalEvents } from '../core/events.js';
import { tomcatAssistant } from '../components/tomcatAssistant.js';
import '../components/dialogs.js';

// 1. ESPOSIZIONE GLOBALE IMMEDIATA (Anti-Regressione)
window.api = api;
window.state = state;
window.setState = setState;
window.t = (key) => {
    try { return t(key) || key; } catch(e) { return key; }
};

// window.gxToast is now handled primarily by dialogs.js for visual consistency

// --- TOGGLE PANNELLI LATERALI / TERMINALE ---
const initPanelToggles = () => {
    const btnLeft     = document.getElementById('toggle-left-btn');
    const btnTerminal = document.getElementById('toggle-terminal-btn');
    const btnRight    = document.getElementById('toggle-right-btn');

    if (btnLeft) btnLeft.onclick = () => {
        setState({ isLeftSidebarOpen: !state.isLeftSidebarOpen });
    };

    if (btnTerminal) btnTerminal.onclick = () => {
        setState({ isTerminalMinimized: !state.isTerminalMinimized });
    };

    if (btnRight) btnRight.onclick = () => {
        setState({ isRightSidebarOpen: !state.isRightSidebarOpen });
    };

    // Supporto per il tasto "X" nel pannello in basso (già esistente in HTML)
    const btnClosePanel = document.getElementById('close-panel-btn');
    if (btnClosePanel) btnClosePanel.onclick = () => {
        setState({ isTerminalMinimized: true });
    };
};

// --- BINDING PULSANTI MARKET ---
const initMarketplaceNav = () => {
    const btnMarketAgents = document.getElementById('nav-market-agents');
    const btnMarketSkills = document.getElementById('nav-market-skills');
    const btnMarketAddons = document.getElementById('nav-market-addons');

    if (btnMarketAgents) btnMarketAgents.onclick = () => setState({ isMarketplaceOpen: true, activeMarketplaceTab: 'agents' });
    if (btnMarketSkills) btnMarketSkills.onclick = () => setState({ isMarketplaceOpen: true, activeMarketplaceTab: 'skills' });
    if (btnMarketAddons) btnMarketAddons.onclick = () => setState({ isMarketplaceOpen: true, activeMarketplaceTab: 'addons' });
};

const initWindowControls = () => {
    const winMin = document.getElementById('win-min');
    const winMax = document.getElementById('win-max');
    const winClose = document.getElementById('win-close');
    const navDevtools = document.getElementById('nav-devtools');

    // Icone SVG per i due stati
    const ICON_MAXIMIZE = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg>`;
    const ICON_RESTORE  = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="5" y="5" width="14" height="14" rx="1"/><path d="M8 5V3h13v13h-2"/></svg>`;

    if (winMin) winMin.onclick = () => window.electronAPI?.windowControl?.('minimize');
    if (winMax) winMax.onclick = () => window.electronAPI?.windowControl?.('maximize');
    if (winClose) winClose.onclick = () => window.electronAPI?.windowControl?.('close');

    // Sincronizzo l'icona del bottone con lo stato reale della finestra
    if (winMax && window.electronAPI?.onWindowMaximized) {
        window.electronAPI.onWindowMaximized(() => {
            winMax.innerHTML = ICON_RESTORE;
            winMax.title = 'Ripristina finestra';
        });
        window.electronAPI.onWindowUnmaximized(() => {
            winMax.innerHTML = ICON_MAXIMIZE;
            winMax.title = 'Massimizza';
        });
    }

    // Devtools
    if (navDevtools) navDevtools.onclick = () => {
        try { 
            window.electronAPI?.openDevTools?.();
        } catch(e) {
            setState({ activeActivity: 'debug', isLeftSidebarOpen: true });
        }
    };
};


const bootstrap = async () => {
    console.log("[GX-BOOTSTRAP] Nucleo avviato...");
    
    try {
        await loadLocale(localStorage.getItem('gx-language') || 'it');

        // Moduli UI (Reattività Immediata)
        initGlobalEvents(); 
        initSidebar();      
        initMarketplaceNav();
        initWindowControls();
        initPanelToggles();
        initExplorerToolbar(); // Binding tasti apertura cartelle subito!
        initCrud(); // Esponiamo crud globalmente subito

        // Attesa Monaco Editor
        const waitForMonaco = () => {
            return new Promise((resolve) => {
                if (typeof require !== 'undefined' && require.config) {
                    require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.43.0/min/vs' } });
                    require(['vs/editor/editor.main'], () => resolve());
                } else {
                    const check = () => { if (window.monaco) resolve(); else setTimeout(check, 100); };
                    check();
                }
            });
        };
        await waitForMonaco();
        
        // Inizializzazione Componenti Editor/Logici
        const inits = [
            { name: 'Workspace', fn: initWorkspace },
            { name: 'Terminal', fn: initTerminal },
            { name: 'BottomPanel', fn: initBottomPanel },
            { name: 'Marketplace', fn: initMarketplace },
            { name: 'Settings', fn: initSettings },
            { name: 'Issues', fn: initIssues },
            { name: 'Git', fn: initGit },
            { name: 'Search', fn: initSearch },
            { name: 'Tests', fn: initTests },
            { name: 'Debug', fn: initDebug },
            { name: 'DebugToolbar', fn: initDebugToolbar },
            { name: 'AiBridge', fn: initAiKnowledgeBridge },
            { name: 'TomcatAssistant', fn: tomcatAssistant.init },
            { name: 'Updater', fn: initUpdater }
        ];

        for (const item of inits) {
            try {
                item.fn();
            } catch (err) {
                console.warn(`[GX-BOOTSTRAP] Minor issue in ${item.name}:`, err);
            }
        }

        // SOTTOSCRIZIONE GLOBALE (Visibility & Layout)
        subscribe((newState) => {
            if (window.updateActivityBar) window.updateActivityBar(newState.activeActivity);
            if (window.updatePanes) window.updatePanes(newState.activeActivity);
            if (window.updateLeftTabs) window.updateLeftTabs(newState.activeLeftTab);
            if (window.updateRightTabs) window.updateRightTabs(newState.activeRightTab);
            
            // Gestione Visibilità Sidebar & Activity Bar
            const leftSidebar   = document.getElementById('left-sidebar');
            const activityBar   = document.getElementById('activity-bar');
            const rightSidebar  = document.getElementById('right-sidebar');
            const bottomPanel   = document.getElementById('bottom-panel');
            const terminalDrag  = document.getElementById('terminal-drag-bar');

            // Toggles Buttons Styling
            const btnLeft     = document.getElementById('toggle-left-btn');
            const btnTerminal = document.getElementById('toggle-terminal-btn');
            const btnRight    = document.getElementById('toggle-right-btn');

            const updateToggleUI = (btn, isOpen) => {
                if (!btn) return;
                if (!isOpen) { // Se è CHIUSO, evidenziamo il tasto (per indicare che è "disattivato")
                    btn.classList.add('text-blue-500');
                    btn.classList.remove('text-gray-500');
                } else {
                    btn.classList.remove('text-blue-500');
                    btn.classList.add('text-gray-500');
                }
            };

            updateToggleUI(btnLeft, newState.isLeftSidebarOpen);
            updateToggleUI(btnRight, newState.isRightSidebarOpen);
            updateToggleUI(btnTerminal, !newState.isTerminalMinimized);
            
            if (leftSidebar) {
                leftSidebar.classList.toggle('hidden', !newState.isLeftSidebarOpen);
                if (activityBar) activityBar.classList.toggle('hidden', !newState.isLeftSidebarOpen);
            }
            if (rightSidebar) {
                rightSidebar.classList.toggle('hidden', !newState.isRightSidebarOpen);
            }
            if (bottomPanel) {
                bottomPanel.classList.toggle('hidden', newState.isTerminalMinimized);
                if (terminalDrag) terminalDrag.classList.toggle('hidden', newState.isTerminalMinimized);
            }

            // Forza il layout degli editor dopo ogni cambio di visibilità dei pannelli
            setTimeout(() => {
                if (window.editor) window.editor.layout();
                if (window.editorRight) window.editorRight.layout();
            }, 100);
        });

        console.log("[GX-BOOTSTRAP] Finalizing data sync...");
        await api.loadAll();
        
        // --- SESSION RESTORE (v1.5.0) ---
        if (window.restoreSession) {
            console.log("[GX-BOOTSTRAP] Triggering session restore...");
            await window.restoreSession();
            
            // Se c'era un file attivo, ricarichiamolo nel Monaco Editor
            if (state.activeFileId) {
                console.log(`[GX-BOOTSTRAP] Restoring active file: ${state.activeFileId}`);
                setTimeout(() => {
                    window.openFileInIDE(state.activeFileId);
                }, 500); // Wait bit for Monaco initialization
            } else if (state.openFiles.length > 0) {
                console.log("[GX-BOOTSTRAP] Multiple tabs found, but no active file selected.");
            }
        }
        
        console.log("[GX-BOOTSTRAP] IDE Ready and Stable.");

    } catch (fatalError) {
        console.error("[GX-BOOTSTRAP] FATAL ERROR during initialization:", fatalError);
        alert(`Errore critico avvio: ${fatalError.message}`);
    }
};

document.addEventListener('DOMContentLoaded', bootstrap);
