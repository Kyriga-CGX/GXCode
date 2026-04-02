// APP/components/issues.js
import { state, subscribe, setState } from '../core/state.js';
import { api } from '../core/api.js';

const statusMap = {
    'Aperto': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    'Open': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    'KO': 'bg-red-500/10 text-red-400 border-red-500/30',
    'Revisione Analisi': 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    'Sprint': 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    'In Test': 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
    'Preso in carico': 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
    'In Progress': 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
};

const borderColorMap = {
    'Aperto': 'border-l-emerald-500',
    'Open': 'border-l-emerald-500',
    'KO': 'border-l-red-500',
    'Revisione Analisi': 'border-l-purple-500',
    'Sprint': 'border-l-blue-500',
    'In Test': 'border-l-yellow-500',
    'Preso in carico': 'border-l-cyan-500',
    'In Progress': 'border-l-cyan-500'
};

// YouTrack Color ID to Hex Mapping (Approximate)
const ytColorMap = {
    '1': '#888', // Gray
    '2': '#3d3', // Green
    '3': '#33d', // Blue
    '4': '#d33', // Red
    '5': '#dd3', // Yellow
    '6': '#d3d'  // Purple
};

const renderIssueItem = (issue) => {
    const isActive = issue.id === state.activeIssueId;
    const statusClass = statusMap[issue.status] || 'bg-gray-500/10 text-gray-400 border-gray-500/30';
    const borderClass = borderColorMap[issue.status] || 'border-l-gray-700';

    const priorityIcon = issue.priority === 'High' || issue.priority === 'Critical' ? '<span class="text-red-500">高</span>' : 
                        issue.priority === 'Medium' || issue.priority === 'Normal' ? '<span class="text-yellow-500">中</span>' : 
                        '<span class="text-gray-600">低</span>';

    const tagsHtml = (issue.tags || []).map(t => `
        <span class="text-[8px] px-1 rounded border border-white/10" style="background: ${ytColorMap[t.color] || '#333'}22; color: ${ytColorMap[t.color] || '#ccc'}">
            ${t.name}
        </span>
    `).join('');

    return `
        <div data-id="${issue.id}" class="issue-item flex flex-col p-3 rounded-lg border transition-all hover:shadow-lg group border-l-[3px] ${borderClass} relative overflow-hidden ${isActive ? 'border-blue-500/50 bg-blue-500/5' : 'border-gray-800 bg-black/10'}" style="min-height: 80px; cursor: pointer;">
            <div class="relative z-10 flex flex-col h-full pointer-events-none">
                <div class="flex justify-between items-center mb-1">
                    <div class="flex items-center gap-1.5 overflow-hidden">
                        <span class="text-[10px] font-mono ${isActive ? 'text-blue-400 font-bold' : 'text-gray-500'} tracking-tighter">${issue.id}</span>
                        <div class="flex gap-1 overflow-hidden">${tagsHtml}</div>
                    </div>
                    <span class="text-[8px] px-1.5 py-0.5 rounded-full border ${statusClass} font-bold uppercase tracking-tighter shadow-sm flex-shrink-0">${issue.status}</span>
                </div>
                
                <h4 class="text-[11px] font-bold ${isActive ? 'text-white' : 'text-gray-200'} leading-tight mb-2 group-hover:text-blue-400 transition-colors truncate">${issue.name}</h4>
                
                <div class="flex justify-between items-center mt-auto pt-2 border-t border-gray-800/20">
                    <div class="flex items-center gap-1.5 grayscale group-hover:grayscale-0 transition">
                        <div class="w-4 h-4 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-[8px] text-gray-300 shadow-sm font-bold">
                            ${issue.assignee ? issue.assignee.charAt(0).toUpperCase() : '?'}
                        </div>
                        <span class="text-[9px] text-gray-500 font-medium truncate max-w-[80px]">${issue.assignee || window.t('issues.noAssignee')}</span>
                    </div>
                    <div class="flex items-center gap-1 px-1 py-0.5 rounded bg-black/10">
                        <span class="text-[9px] text-gray-600 uppercase tracking-widest font-bold">${issue.priority}</span>
                        <div class="text-[10px] opacity-70">${priorityIcon}</div>
                    </div>
                </div>
            </div>
            
            <!-- Glow background overlay -->
            <div class="absolute inset-0 z-0 bg-blue-500/5 ${isActive ? 'opacity-100' : 'opacity-0'} group-hover:opacity-100 transition-opacity pointer-events-none"></div>
        </div>
    `;
};

let activeFilter = 'Tutti';
let activeSprint = 'Tutti';

const renderFilterBar = () => {
    const filters = [
        { id: 'Tutti', label: window.t('categories.all') },
        { id: 'In Test', label: 'In Test' },
        { id: 'In Progress', label: 'Progress' },
        { id: 'KO', label: 'Ko' }
    ];

    const sprints = ['Tutti', ...new Set(state.issues.filter(t => t.sprint).map(t => t.sprint))];

    return `
        <div class="flex flex-col gap-2 px-3 py-3 border-b border-gray-800 bg-black/10 backdrop-blur-md">
            <div class="flex flex-wrap items-center gap-1.5">
                ${filters.map(f => `
                    <button onclick="window.filterIssues('${f.id}')" class="px-2 py-0.5 rounded text-[8px] uppercase font-bold tracking-tighter transition-all border ${activeFilter === f.id ? 'bg-blue-600/20 border-blue-500 text-blue-400' : 'bg-black/20 border-gray-800 text-gray-500 hover:text-gray-300'}">
                        ${f.label}
                    </button>
                `).join('')}
            </div>
            
            ${sprints.length > 1 ? `
            <div class="flex items-center gap-2">
                <span class="text-[8px] uppercase font-bold text-gray-600 tracking-widest">${window.t('issues.sprint')}:</span>
                <select onchange="window.filterIssuesBySprint(this.value)" class="flex-1 bg-black/20 border border-gray-800 rounded px-2 py-1 text-[9px] text-gray-300 focus:outline-none focus:border-blue-500 transition cursor-pointer">
                    ${sprints.map(s => `<option value="${s}" ${activeSprint === s ? 'selected' : ''}>${s}</option>`).join('')}
                </select>
            </div>
            ` : ''}
        </div>
    `;
};

window.openIssuePopup = (issueId) => {
    const issue = state.issues.find(i => i.id === issueId);
    if (!issue) return;

    const modal = document.createElement('div');
    modal.className = "fixed inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm z-[2000000] animate-fade-in pointer-events-auto p-10";
    
    const tagsHtml = (issue.tags || []).map(t => `
        <span class="text-[10px] px-2 py-0.5 rounded border border-white/10" style="background: ${ytColorMap[t.color] || '#333'}44; color: ${ytColorMap[t.color] || '#ccc'}">
            ${t.name}
        </span>
    `).join('');

    const linksHtml = (issue.links || []).map(l => `
        <div class="flex items-center gap-2 text-[10px] text-gray-400 p-1 border-b border-gray-800/50">
            <span class="text-blue-500 uppercase font-bold text-[8px] w-12 shrink-0">${l.direction.replace('_', ' ')}</span>
            <span class="font-mono text-gray-500">${l.id}</span>
            <span class="truncate italic opacity-70">${l.summary}</span>
        </div>
    `).join('');

    modal.innerHTML = `
        <div class="w-full max-w-2xl bg-[#0d1117] border border-gray-800 rounded-xl shadow-2xl overflow-hidden flex flex-col animate-scale-up max-h-[80vh]">
            <!-- Header -->
            <div class="px-6 py-4 border-b border-gray-800 flex justify-between items-start bg-black/20">
                <div class="flex flex-col gap-1">
                    <div class="flex items-center gap-2">
                         <span class="text-xs font-mono text-blue-500 font-bold">${issue.id}</span>
                         <span class="text-[10px] text-gray-500 uppercase font-bold tracking-widest">${issue.project}</span>
                    </div>
                    <h2 class="text-lg font-bold text-white leading-tight">${issue.name}</h2>
                </div>
                <button onclick="this.closest('.fixed').remove()" class="p-2 text-gray-500 hover:text-white transition hover:bg-gray-800 rounded-lg">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
            </div>

            <!-- Content -->
            <div class="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-6">
                <!-- Info Grid -->
                <div class="grid grid-cols-3 gap-4">
                    <div class="flex flex-col p-3 rounded-lg bg-black/20 border border-gray-800/50">
                        <span class="text-[9px] uppercase text-gray-600 font-bold mb-1">${window.t('issues.state')}</span>
                        <span class="text-xs text-blue-400 font-bold">${issue.status}</span>
                    </div>
                    <div class="flex flex-col p-3 rounded-lg bg-black/20 border border-gray-800/50">
                        <span class="text-[9px] uppercase text-gray-600 font-bold mb-1">${window.t('issues.priority')}</span>
                        <span class="text-xs text-yellow-500 font-bold">${issue.priority}</span>
                    </div>
                    <div class="flex flex-col p-3 rounded-lg bg-black/20 border border-gray-800/50">
                        <span class="text-[9px] uppercase text-gray-600 font-bold mb-1">Assignee</span>
                        <span class="text-xs text-gray-300 font-bold">${issue.assignee || 'Unassigned'}</span>
                    </div>
                </div>

                <!-- Tags -->
                ${tagsHtml ? `
                <div class="space-y-2">
                    <h3 class="text-[10px] uppercase text-gray-500 font-bold tracking-widest">${window.t('issues.tags')}</h3>
                    <div class="flex flex-wrap gap-2">${tagsHtml}</div>
                </div>
                ` : ''}

                <!-- Description -->
                <div class="space-y-2">
                    <h3 class="text-[10px] uppercase text-gray-500 font-bold tracking-widest">${window.t('crud.description')}</h3>
                    <div class="text-[13px] text-gray-400 leading-relaxed bg-black/10 p-4 rounded-lg border border-gray-800/30 whitespace-pre-wrap font-sans">
                        ${issue.description || 'No description available.'}
                    </div>
                </div>

                <!-- Links -->
                ${linksHtml ? `
                <div class="space-y-2">
                    <h3 class="text-[10px] uppercase text-gray-500 font-bold tracking-widest">${window.t('issues.related')}</h3>
                    <div class="space-y-1">${linksHtml}</div>
                </div>
                ` : ''}
            </div>

            <!-- Footer -->
            <div class="px-6 py-4 border-t border-gray-800 bg-black/20 flex justify-between items-center">
                <span class="text-[10px] text-gray-600 italic">Sprint: ${issue.sprint || 'N/A'}</span>
                <div class="flex gap-3">
                    <button onclick="this.closest('.fixed').remove()" class="px-4 py-2 text-[10px] font-bold text-gray-400 hover:text-white uppercase transition">${window.t('dialogs.cancel')}</button>
                    <button onclick="window.electronAPI.openExternalLink('${issue.rawUrl}')" class="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold rounded-lg transition uppercase flex items-center gap-2">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/></svg>
                        <span>${window.t('issues.openInBrowser')}</span>
                    </button>
                </div>
            </div>
        </div>
    `;

    document.getElementById('modals-root').appendChild(modal);
};

export const initIssues = async () => {
    const pane = document.getElementById('pane-issues');
    if (!pane) return;

    pane.innerHTML = `
        <div class="h-10 px-4 flex items-center border-b border-gray-800 bg-black/30">
             <span class="text-[10px] uppercase font-bold text-gray-400 tracking-widest">YouTrack Issues</span>
        </div>
        <div id="issues-filter-root"></div>
        <div id="issues-content" class="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar"></div>
    `;

    const filterRoot = pane.querySelector('#issues-filter-root');
    const contentBox = pane.querySelector('#issues-content');

    contentBox.addEventListener('click', (e) => {
        const item = e.target.closest('.issue-item');
        if (!item) return;

        const issueId = item.getAttribute('data-id');
        window.openIssuePopup(issueId);
        setState({ activeIssueId: issueId });
    });

    window.filterIssues = (cat) => { activeFilter = cat; render(); };
    window.filterIssuesBySprint = (sprint) => { activeSprint = sprint; render(); };

    const render = () => {
        filterRoot.innerHTML = renderFilterBar();
        
        const config = state.youtrackConfig || {};
        const isNotConfigured = !config.url || !config.token || !config.enabled;

        if (isNotConfigured) {
            contentBox.innerHTML = `
                <div class="flex flex-col items-center justify-center py-12 px-6 text-center animate-fade-in text-gray-500">
                    <div class="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center text-3xl mb-6 shadow-inner border border-blue-500/20">🔍</div>
                    <h3 class="text-xs font-bold text-gray-200 uppercase tracking-widest mb-3">${window.t('settings.youtrack.sync')}</h3>
                    <p class="text-[10px] text-gray-500 leading-relaxed mb-8 max-w-[200px]" data-i18n="settings.youtrack.desc">Collega YouTrack nelle impostazioni per visualizzare le tue Issue.</p>
                    
                    <button onclick="window.setState({ isSettingsOpen: true, activeSettingsTab: 'youtrack' })" class="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold rounded-lg transition shadow-lg shadow-blue-900/20 uppercase tracking-tighter">
                        ${window.t('header.settings')}
                    </button>
                    
                    <a href="https://www.jetbrains.com/help/youtrack/devportal/resource-api-token.html" target="_blank" class="mt-4 text-[9px] text-gray-600 hover:text-blue-400 underline transition group flex items-center gap-1">
                        <span>How to get a Token?</span>
                    </a>
                </div>
            `;
            return;
        }

        if (!state.issues || state.issues.length === 0) {
            contentBox.innerHTML = `
                <div class="flex flex-col items-center justify-center py-10 opacity-40">
                    <div class="text-4xl mb-4">✨</div>
                    <p class="text-[11px] text-gray-500 uppercase tracking-widest font-bold">In Pace!</p>
                    <p class="text-[9px] text-gray-600">Nessuna issue trovata.</p>
                </div>
            `;
            return;
        }

        let filtered = state.issues;
        if (activeFilter !== 'Tutti') {
            filtered = filtered.filter(t => t.status === activeFilter);
        }
        if (activeSprint !== 'Tutti') {
            filtered = filtered.filter(t => t.sprint === activeSprint);
        }

        contentBox.innerHTML = filtered.map(renderIssueItem).join('');
    };

    subscribe(render);

    try {
        await api.loadIssues();
    } catch(e) {
        console.warn("Issues API not responding.");
    }
};
