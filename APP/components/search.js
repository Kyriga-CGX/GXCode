import { state, subscribe, setState } from '../core/state.js';

export const initSearch = () => {
    const searchInput = document.getElementById('global-search-input');
    const searchResults = document.getElementById('global-search-results');
    if (!searchInput || !searchResults) return;

    let searchTimeout = null;

    searchInput.addEventListener('input', (e) => {
        const query = e.target.value;
        if (!query.trim()) {
            searchResults.innerHTML = `<div class="opacity-50 text-[10px] uppercase text-gray-600 font-bold text-center mt-10" data-i18n="search.idle">${window.t('search.idle')}</div>`;
            return;
        }

        if (searchTimeout) clearTimeout(searchTimeout);
        searchTimeout = setTimeout(async () => {
            if (!state.workspaceData || !state.workspaceData.path) {
                searchResults.innerHTML = `<div class="opacity-50 text-[10px] uppercase text-red-500 font-bold text-center mt-10" data-i18n="search.noProject">${window.t('search.noProject')}</div>`;
                return;
            }

            searchResults.innerHTML = `<div class="opacity-50 text-[10px] uppercase text-blue-400 font-bold text-center mt-10 animate-pulse" data-i18n="search.searching">${window.t('search.searching')}</div>`;

            try {
                const results = await window.electronAPI.searchFiles(state.workspaceData.path, query);
                
                if (!results || results.length === 0) {
                    searchResults.innerHTML = `<div class="opacity-50 text-[10px] uppercase text-gray-600 font-bold text-center mt-10" data-i18n="search.noResults">${window.t('search.noResults')}</div>`;
                    return;
                }

                // Renderizziamo i risultati
                searchResults.innerHTML = results.map(res => {
                    // Evidenziamo il testo in modo rudimentale ma efficace
                    const escQuery = query.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&');
                    const regex = new RegExp(`(${escQuery})`, 'gi');
                    const highlightedText = res.text.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(regex, '<span class="bg-blue-500/40 text-blue-100 rounded px-1">$1</span>');
                    
                    const displayPath = res.relativePath.replace(/\\\\/g, '/');
                    const safeFileNameObj = encodeURIComponent(displayPath.split('/').pop());
                    const safeAbsPath = encodeURIComponent(res.file);
                    
                    return `
                        <div class="p-2 hover:bg-[#161b22] cursor-pointer rounded border border-transparent hover:border-gray-800 transition group" onclick="window.openFileFromSearch(decodeURIComponent('${safeAbsPath}'), decodeURIComponent('${safeFileNameObj}'), ${res.line}, decodeURIComponent('${encodeURIComponent(query)}'))">
                            <div class="flex items-center gap-2 mb-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" class="text-blue-500 shrink-0" stroke="currentColor" stroke-width="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
                                <div class="text-[10px] text-gray-300 font-bold truncate tracking-widest">${displayPath} <span class="text-gray-600 font-normal">:${res.line}</span></div>
                            </div>
                            <div class="text-[11px] text-gray-400 truncate pl-5 border-l-2 border-gray-800 group-hover:border-blue-500/50 font-mono tracking-tighter">${highlightedText}</div>
                        </div>
                    `;
                }).join('');
            } catch (err) {
                searchResults.innerHTML = `<div class="opacity-70 text-[10px] uppercase text-red-500 font-bold text-center mt-10">Errore: ${err.message}</div>`;
            }
        }, 500); // 500ms debounce
    });

    // Funzione globale chiamata all'onclick (integrata alla UI standard del workspace)
    window.openFileFromSearch = async (absolutePath, fileName, line, query) => {
        let openFiles = [...state.openFiles];
        const existing = openFiles.find(f => f.path === absolutePath);
        
        const focusState = { searchLineToFocus: line, searchColumnQuery: query };

        if (!existing) {
            openFiles.push({ 
                name: fileName, 
                path: absolutePath, 
                content: null, 
                loading: true, 
                error: null,
                type: (line || query) ? 'problem' : 'file' 
            });
            setState({ openFiles, activeFileId: absolutePath, ...focusState });

            try {
                const content = await window.electronAPI.readFile(absolutePath);
                openFiles = state.openFiles.map(f => f.path === absolutePath ? { ...f, content, loading: false } : f);
                setState({ openFiles });
            } catch (err) {
                console.error("Errore lettura file dal search:", err);
                openFiles = state.openFiles.map(f => f.path === absolutePath ? { ...f, content: null, loading: false, error: err.message } : f);
                setState({ openFiles });
            }
        } else {
            setState({ activeFileId: absolutePath, ...focusState });
        }
    };
};
