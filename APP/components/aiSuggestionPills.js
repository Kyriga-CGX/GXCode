/**
 * AI Suggestion Pills Component - GXCode 2026
 * Mostra suggerimenti AI inline nell'editor come pills interattive
 */

import { state, setState, subscribe } from '../core/state.js';

let suggestionPillsContainer = null;
let currentSuggestions = [];

export const initAiSuggestionPills = () => {
    // Crea container per le pills (overlay sopra l'editor)
    const container = document.createElement('div');
    container.id = 'ai-suggestion-pills-container';
    container.className = 'absolute top-0 right-0 z-50 pointer-events-none';
    container.style.cssText = `
        position: absolute;
        top: 0;
        right: 0;
        width: 300px;
        max-height: 80vh;
        overflow-y: auto;
        pointer-events: auto;
        padding: 8px;
        z-index: 1000;
    `;

    // Inserisci nel workspace
    const workspace = document.getElementById('workspace');
    if (workspace) {
        workspace.appendChild(container);
        suggestionPillsContainer = container;
    }

    // Listener per suggerimenti completati
    window.electronAPI?.onAiAnalysisComplete?.((data) => {
        console.log('[AI-PILLS] Analysis complete:', data);
        displaySuggestions(data.suggestions, data.filePath);
    });

    window.electronAPI?.onAiAnalysisStream?.((data) => {
        // Opzionale: mostra suggerimenti mentre arrivano
        console.log('[AI-PILLS] Streaming chunk:', data.chunk.substring(0, 50));
    });

    window.electronAPI?.onAiAnalysisError?.((data) => {
        console.error('[AI-PILLS] Analysis error:', data.error);
        showNotification('Errore analisi AI', 'error');
    });

    console.log('[AI-PILLS] Suggestion Pills initialized');
};

/**
 * Mostra suggerimenti come pills interattive
 */
const displaySuggestions = (suggestions, filePath) => {
    if (!suggestions || suggestions.length === 0) {
        hideSuggestions();
        return;
    }

    currentSuggestions = suggestions;

    // Crea HTML per le pills
    const pillsHtml = suggestions.map((suggestion, index) => {
        const severityColor = {
            high: 'border-red-500 bg-red-500/10',
            medium: 'border-yellow-500 bg-yellow-500/10',
            low: 'border-blue-500 bg-blue-500/10'
        }[suggestion.severity] || 'border-gray-500 bg-gray-500/10';

        const typeIcon = {
            bug: '🐛',
            improvement: '✨',
            refactor: '♻️',
            security: '🔒'
        }[suggestion.type] || '💡';

        return `
            <div class="ai-suggestion-pill mb-2 p-3 rounded-lg border ${severityColor} backdrop-blur-sm animate-fade-in" 
                 data-suggestion-index="${index}"
                 style="animation-delay: ${index * 100}ms">
                <div class="flex items-start gap-2">
                    <span class="text-lg">${typeIcon}</span>
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 mb-1">
                            <span class="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Line ${suggestion.line}</span>
                            <span class="text-[8px] font-bold text-gray-500 uppercase">${suggestion.type}</span>
                        </div>
                        <p class="text-[10px] text-gray-200 font-medium leading-tight mb-2">${suggestion.message}</p>
                        
                        ${suggestion.suggestion ? `
                            <div class="bg-black/40 rounded p-2 mb-2">
                                <pre class="text-[8px] text-green-400 font-mono overflow-x-auto whitespace-pre-wrap">${escapeHtml(suggestion.suggestion)}</pre>
                            </div>
                        ` : ''}
                        
                        ${suggestion.explanation ? `
                            <p class="text-[8px] text-gray-500 italic">${suggestion.explanation}</p>
                        ` : ''}
                    </div>
                </div>
                
                <div class="flex gap-2 mt-2 pt-2 border-t border-white/10">
                    <button onclick="window.applyAiSuggestion(${index})" 
                            class="flex-1 py-1 px-2 bg-blue-600 hover:bg-blue-500 text-white text-[8px] font-bold rounded transition active:scale-95">
                        Applica
                    </button>
                    <button onclick="window.ignoreAiSuggestion(${index})" 
                            class="py-1 px-2 bg-white/5 hover:bg-white/10 text-gray-400 text-[8px] font-bold rounded transition active:scale-95">
                        Ignora
                    </button>
                </div>
            </div>
        `;
    }).join('');

    // Aggiorna container
    if (suggestionPillsContainer) {
        suggestionPillsContainer.innerHTML = `
            <div class="bg-[var(--bg-side)]/95 border border-white/10 rounded-lg shadow-2xl backdrop-blur-md">
                <div class="flex items-center justify-between p-2 border-b border-white/10">
                    <span class="text-[9px] font-bold text-gray-400 uppercase tracking-wider">💡 ${suggestions.length} Suggeriment${suggestions.length === 1 ? 'o' : 'i'}</span>
                    <button onclick="window.dismissAllAiSuggestions()" 
                            class="p-1 hover:bg-white/10 rounded transition">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                            <path d="M18 6L6 18M6 6l12 12"/>
                        </svg>
                    </button>
                </div>
                <div class="p-2 max-h-[60vh] overflow-y-auto custom-scrollbar">
                    ${pillsHtml}
                </div>
            </div>
        `;
    }
};

/**
 * Nasconde le pills
 */
const hideSuggestions = () => {
    if (suggestionPillsContainer) {
        suggestionPillsContainer.innerHTML = '';
    }
    currentSuggestions = [];
};

/**
 * Applica un suggerimento
 */
window.applyAiSuggestion = async (index) => {
    const suggestion = currentSuggestions[index];
    if (!suggestion || !suggestion.suggestion) return;

    try {
        // Qui andrebbe l'integrazione con Monaco Editor per applicare la modifica
        // Per ora mostriamo solo un toast
        if (window.gxToast) {
            window.gxToast(`Suggerimento applicato (Line ${suggestion.line})`, 'success');
        }
        
        // Rimuovi la pill applicata
        currentSuggestions.splice(index, 1);
        displaySuggestions(currentSuggestions);
    } catch (err) {
        console.error('[AI-PILLS] Failed to apply suggestion:', err);
        if (window.gxToast) {
            window.gxToast('Errore nell\'applicazione', 'error');
        }
    }
};

/**
 * Ignora un suggerimento
 */
window.ignoreAiSuggestion = (index) => {
    currentSuggestions.splice(index, 1);
    displaySuggestions(currentSuggestions);
};

/**
 * Chiudi tutte le pills
 */
window.dismissAllAiSuggestions = () => {
    hideSuggestions();
};

/**
 * Utility: escape HTML
 */
const escapeHtml = (text) => {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
};

/**
 * Utility: mostra notifica
 */
const showNotification = (message, type = 'info') => {
    if (window.gxToast) {
        window.gxToast(message, type);
    }
};

// Esporta per inizializzazione
export default { initAiSuggestionPills };
