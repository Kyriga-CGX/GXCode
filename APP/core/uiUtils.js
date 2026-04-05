/**
 * GXCode UI Utilities (Vision 2026 Elite)
 * Centralized logic for AI-to-UI feedback loops.
 */

/**
 * Strips ANSI escape codes from terminal data.
 */
export const stripAnsi = (str) => {
    const pattern = [
        '[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*)?\\u0007)',
        '(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-nq-uy=><~]))'
    ].join('|');
    const regex = new RegExp(pattern, 'g');
    return str.replace(regex, '');
};

/**
 * Scans text for mentions of agents or skills and triggers a visual "glow" in the sidebar.
 * 
 * @param {string} text The AI response text or terminal chunk.
 * @param {object} state The global state (state.agents, state.skills).
 * @param {Set} alreadyGlowedSet A set to track what has already glowed in the current session.
 */
export const triggerGlowOnMention = (text, state, alreadyGlowedSet) => {
    if (!text) return;
    
    // Pulizia testo (ANSI terminale)
    const cleanText = stripAnsi(text);
    const items = [...(state.skills || []), ...(state.agents || [])];
    
    items.forEach(item => {
        if (alreadyGlowedSet && alreadyGlowedSet.has(item.id)) return;
        
        // Cerca il nome con o senza @, gestendo confini di parola e punteggiatura
        const name = item.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // Escape regex chars
        const regex = new RegExp(`(?:@|\\b)${name}\\b`, 'gi');
        
        if (regex.test(cleanText)) {
            if (alreadyGlowedSet) alreadyGlowedSet.add(item.id);
            
            // Trova l'elemento nel DOM
            const el = document.querySelector(`[data-id="${item.slug || item.id}"]`);
            if (el) {
                // Se l'elemento è già animato, non sovrapponiamo
                if (el.classList.contains('premium-glow-active')) return;

                el.classList.add('premium-glow-active');
                
                // Opzionale: Scroll into view se non visibile? 
                // Per ora solo il glow per non disturbare lo scroll dell'utente.
                setTimeout(() => el.classList.remove('premium-glow-active'), 5000);
                
                console.log(`[UI-GLOW] Activated for: ${item.name}`);
            }
        }
    });
};
