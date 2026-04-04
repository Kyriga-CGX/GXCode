import { state, subscribe, setState } from '../core/state.js';

export const initSearch = () => {
    const searchInput = document.getElementById('global-search-input');
    const searchResults = document.getElementById('global-search-results');
    
    // Toggles
    const btnCase = document.getElementById('search-case-sensitive');
    const btnWord = document.getElementById('search-whole-word');
    const btnRegex = document.getElementById('search-regex');

    const inputInclude = document.getElementById('search-include');
    const inputExclude = document.getElementById('search-exclude');

    if (!searchInput || !searchResults) return;

    let searchTimeout = null;

    // Local state for toggles
    let searchOptions = {
        caseSensitive: false,
        wholeWord: false,
        useRegex: false,
        includePattern: '',
        excludePattern: ''
    };

    const updateToggleUI = () => {
        if (btnCase) btnCase.classList.toggle('active', !!searchOptions.caseSensitive);
        if (btnWord) btnWord.classList.toggle('active', !!searchOptions.wholeWord);
        if (btnRegex) btnRegex.classList.toggle('active', !!searchOptions.useRegex);
    };

    const performSearch = async () => {
        const query = searchInput.value;
        if (!query.trim()) {
            searchResults.innerHTML = `<div class="opacity-50 text-[10px] uppercase text-gray-600 font-bold text-center mt-10" data-i18n="search.idle">${window.t('search.idle')}</div>`;
            return;
        }

        if (!state.workspaceData || !state.workspaceData.path) {
            searchResults.innerHTML = `<div class="opacity-50 text-[10px] uppercase text-red-500 font-bold text-center mt-10" data-i18n="search.noProject">${window.t('search.noProject')}</div>`;
            return;
        }

        searchResults.innerHTML = `<div class="opacity-50 text-[10px] uppercase text-blue-400 font-bold text-center mt-10 animate-pulse" data-i18n="search.searching">${window.t('search.searching')}</div>`;

        // Aggiorna opzioni con include/exclude
        searchOptions.includePattern = inputInclude ? inputInclude.value : '';
        searchOptions.excludePattern = inputExclude ? inputExclude.value : '';

        try {
            const results = await window.electronAPI.searchFiles(state.workspaceData.path, query, searchOptions);
            
            if (!results || results.length === 0) {
                searchResults.innerHTML = `<div class="opacity-50 text-[10px] uppercase text-gray-600 font-bold text-center mt-10" data-i18n="search.noResults">${window.t('search.noResults')}</div>`;
                return;
            }

            searchResults.innerHTML = results.map((res, index) => {
                let highlightedText = res.text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
                
                try {
                    const escQuery = searchOptions.useRegex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    let pattern = escQuery;
                    if (searchOptions.wholeWord && !searchOptions.useRegex) pattern = `\\b${pattern}\\b`;
                    
                    const regex = new RegExp(`(${pattern})`, searchOptions.caseSensitive ? '' : 'i');
                    highlightedText = highlightedText.replace(regex, '<span class="bg-blue-500/30 text-blue-300 rounded px-1 font-bold shadow-[0_0_10px_rgba(59,130,246,0.2)]">$1</span>');
                } catch(e) { /* fallback */ }
                
                const displayPath = res.relativePath.replace(/\\/g, '/');
                const pathParts = displayPath.split('/');
                const fileName = pathParts.pop();
                const folderPath = pathParts.join('/');
                
                // Usiamo BASE64 o encoding stretto per evitare problemi con apici nei percorsi
                const safePath = btoa(unescape(encodeURIComponent(res.file)));
                const safeName = btoa(unescape(encodeURIComponent(fileName)));
                const safeQuery = btoa(unescape(encodeURIComponent(query)));
                
                return `
                    <div class="p-3 bg-[var(--bg-main)] hover:bg-[var(--bg-side-alt)] cursor-pointer rounded-xl border border-[var(--border-dim)] hover:border-[var(--accent-glow)] transition-all duration-300 group mb-2 shadow-sm relative overflow-hidden" 
                         onclick="window.openFileFromSearch('${safePath}', '${safeName}', ${res.line}, '${safeQuery}', true)">
                        <div class="absolute inset-0 bg-gradient-to-r from-blue-500/0 via-blue-500/0 to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                        <div class="flex items-center gap-3 mb-2 relative z-10">
                            <div class="p-1.5 rounded-lg bg-[var(--bg-ghost)] text-blue-400 group-hover:bg-blue-500/10 transition-colors">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
                            </div>
                            <div class="flex flex-col min-w-0">
                                <span class="text-[11px] text-gray-200 font-bold truncate tracking-tight">${fileName}</span>
                                <span class="text-[9px] text-gray-500 truncate font-mono">${folderPath} <span class="text-blue-500/70 font-bold ml-1">line ${res.line}</span></span>
                            </div>
                        </div>
                        <div class="text-[10px] text-gray-400 pl-4 border-l-2 border-[var(--border-dim)] group-hover:border-blue-500/40 font-mono tracking-tight leading-relaxed bg-[var(--bg-side)] p-2 rounded-lg truncate relative z-10">${highlightedText}</div>
                    </div>
                `;
            }).join('');
        } catch (err) {
            searchResults.innerHTML = `<div class="opacity-70 text-[10px] uppercase text-red-500 font-bold text-center mt-10">Errore: ${err.message}</div>`;
        }
    };

    searchInput.addEventListener('input', (e) => {
        if (searchTimeout) clearTimeout(searchTimeout);
        searchTimeout = setTimeout(performSearch, 500);
    });

    if (btnCase) btnCase.onclick = () => { searchOptions.caseSensitive = !searchOptions.caseSensitive; updateToggleUI(); performSearch(); };
    if (btnWord) btnWord.onclick = () => { searchOptions.wholeWord = !searchOptions.wholeWord; updateToggleUI(); performSearch(); };
    if (btnRegex) btnRegex.onclick = () => { searchOptions.useRegex = !searchOptions.useRegex; updateToggleUI(); performSearch(); };

    updateToggleUI();

    window.openFileFromSearch = async (absolutePath, fileName, line, query, isBase64 = false) => {
        if (isBase64) {
            absolutePath = decodeURIComponent(escape(atob(absolutePath)));
            fileName = decodeURIComponent(escape(atob(fileName)));
            query = decodeURIComponent(escape(atob(query)));
        }
        
        // Impostiamo prima i metadati di focus nello stato
        setState({ 
            searchLineToFocus: line, 
            searchColumnQuery: query 
        });

        // Deleghiamo l'apertura reale al coordinatore dell'IDE
        if (window.openFileInIDE) {
            await window.openFileInIDE(absolutePath, fileName);
        }
    };
};
