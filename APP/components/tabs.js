import { state } from '../core/state.js';
import { getFileIcon } from './explorer.js';

export const renderTabs = () => {
    const tabsContainer = document.getElementById('workspace-tabs');
    if (!tabsContainer) return;

    const { openFiles, activeFileId } = state;

    if (openFiles.length === 0) {
        tabsContainer.innerHTML = '';
        return;
    }

    tabsContainer.innerHTML = openFiles.map(file => {
        const isActive = file.path === activeFileId;
        const fileName = file.name || file.path.split(/[\\/]/).pop();
        
        return `
            <div class="evolution-tab-card ${isActive ? 'active' : ''} group relative flex items-center h-[32px] px-3 min-w-[120px] max-w-[200px] rounded-lg cursor-pointer transition-all duration-500 select-none mx-0.5 overflow-hidden" 
                 onclick="window.openFileInIDE('${file.path.replace(/\\/g, '\\\\')}', '${fileName}')"
                 onmousedown="if(event.button === 1) { event.preventDefault(); window.closeFile('${file.path.replace(/\\/g, '\\\\')}'); }"
                 title="${file.path}">
                
                <!-- TOP GLOW INDICATOR -->
                <div class="absolute top-0 left-0 right-0 h-[2px] transition-all duration-700 ${isActive ? 'bg-blue-500 shadow-[0_2px_10px_var(--accent-glow)]' : 'bg-transparent'}"></div>

                <span class="gx-tab-icon mr-2 scale-75 ${isActive ? 'opacity-100' : 'opacity-40 group-hover:opacity-70'} transition-opacity">
                    ${getFileIcon(fileName)}
                </span>
                
                <span class="text-[10px] font-black truncate flex-1 tracking-tight uppercase ${isActive ? 'text-blue-200' : 'text-gray-500 group-hover:text-gray-300'} transition-colors">
                    ${fileName}
                </span>

                <button class="gx-tab-close ml-2 p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-white/10 transition-all text-gray-500 hover:text-white" 
                        onclick="event.stopPropagation(); window.closeFile('${file.path.replace(/\\/g, '\\\\')}')">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
            </div>
        `;
    }).join('');

    // Auto-scroll al tab attivo
    const activeTab = tabsContainer.querySelector('.active-evolution');
    if (activeTab) {
        activeTab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
};

window.renderTabs = renderTabs;
