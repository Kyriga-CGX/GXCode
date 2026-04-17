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

const ytColorMap = {
    '1': '#888', '2': '#3d3', '3': '#33d', '4': '#d33', '5': '#dd3', '6': '#d3d'
};

const priorityConfig = {
    'Critical': { color: 'text-red-500',    icon: '🔴' },
    'High':     { color: 'text-orange-400', icon: '🔺' },
    'Medium':   { color: 'text-yellow-500', icon: '▶' },
    'Normal':   { color: 'text-yellow-500', icon: '▶' },
    'Low':      { color: 'text-gray-500',   icon: '🔽' },
};

const formatDate = (ts) => {
    if (!ts) return null;
    const d = new Date(ts);
    return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit' });
};

const renderIssueItem = (issue) => {
    const isActive  = issue.id === state.activeIssueId;
    const isWorking = issue.id === state.activeWorkingIssueId;
    const myUsername = state.youtrackConfig?.myUsername || '';

    const statusClass  = statusMap[issue.status]  || 'bg-gray-500/10 text-gray-400 border-gray-500/30';
    const borderClass  = borderColorMap[issue.status] || 'border-l-[var(--border-dim)]';
    const prioConf     = priorityConfig[issue.priority] || { color: 'text-gray-600', icon: '—' };

    // Assignee badge
    const isAssignedToMe = myUsername && issue.assignee === myUsername;
    const assigneeBadge = isAssignedToMe
        ? `<span class="text-[8px] px-1.5 py-0.5 bg-blue-500/20 text-blue-400 border border-blue-500/40 rounded font-bold">IO</span>`
        : issue.assignee
        ? `<div class="flex items-center gap-1">
               <div class="w-3.5 h-3.5 rounded-full bg-gray-700 border border-gray-600 flex items-center justify-center text-[7px] text-gray-400 font-bold shrink-0">${issue.assignee.charAt(0).toUpperCase()}</div>
               <span class="text-[9px] text-gray-500 truncate max-w-[70px]">${issue.assignee}</span>
           </div>`
        : `<span class="text-[8px] text-gray-700 italic">Nessuno</span>`;

    // Badge "preso in carico" se io sono reporter e c'è un assignee != me
    const iMadeIt    = myUsername && issue.reporter === myUsername;
    const takenBadge = iMadeIt && issue.assignee && !isAssignedToMe
        ? `<span class="text-[7px] px-1 py-0.5 bg-amber-500/15 text-amber-400 border border-amber-500/30 rounded font-bold tracking-wide" title="Ticket creato da te, preso da ${issue.assignee}">📌 preso</span>`
        : '';

    const tagsHtml = (issue.tags || []).slice(0, 2).map(t =>
        `<span class="text-[7px] px-1 py-0.5 rounded border" style="background:${t.background || ytColorMap[t.color] || '#333'}22;color:${t.foreground || ytColorMap[t.color] || '#aaa'};border-color:${t.background || '#444'}44">${t.name}</span>`
    ).join('');

    const cardBase  = `issue-item flex flex-col p-3 rounded-lg border transition-all hover:shadow-lg group border-l-[3px] ${borderClass} relative overflow-hidden cursor-pointer select-none`;
    const cardState = isWorking
        ? 'border-blue-500/70 bg-blue-500/5 shadow-[0_0_0_1px_rgba(59,130,246,0.3),0_0_12px_rgba(59,130,246,0.15)]'
        : isActive
        ? 'border-[var(--accent)] bg-[var(--accent-glow)]'
        : 'border-[var(--border-dim)] bg-[var(--border-ghost)] hover:border-gray-600';

    return `
        <div data-id="${issue.id}" data-url="${issue.rawUrl || ''}" class="${cardBase} ${cardState}" style="min-height:80px;">
            ${isWorking ? `<div class="absolute top-1.5 right-1.5 z-20 flex items-center gap-1 px-1.5 py-0.5 bg-blue-600/80 rounded text-[7px] text-white font-bold uppercase tracking-wider border border-blue-400/40 backdrop-blur-sm"><div class="w-1 h-1 rounded-full bg-white animate-pulse"></div>WORKING</div>` : ''}

            <div class="relative z-10 flex flex-col h-full">
                <!-- Header: ID + Progetto + Status -->
                <div class="flex justify-between items-start mb-1.5 gap-2">
                    <div class="flex items-center gap-1.5 overflow-hidden flex-1">
                        <span class="text-[10px] font-mono ${isWorking||isActive ? 'text-blue-400' : 'text-gray-500'} font-bold tracking-tighter shrink-0">${issue.id}</span>
                        <span class="text-[8px] text-gray-600 font-bold bg-gray-800/60 px-1 py-0.5 rounded shrink-0 truncate max-w-[80px]">${issue.project}</span>
                        <div class="flex gap-0.5 overflow-hidden">${tagsHtml}</div>
                    </div>
                    <span class="text-[7px] px-1.5 py-0.5 rounded-full border ${statusClass} font-bold uppercase tracking-tighter shadow-sm shrink-0">${issue.status}</span>
                </div>

                <!-- Titolo -->
                <h4 class="text-[11px] font-bold ${isWorking||isActive ? 'text-white' : 'text-gray-200'} leading-tight mb-2 group-hover:text-blue-300 transition-colors line-clamp-2">${issue.name}</h4>

                <!-- Footer: Assegnatario + Priorità + taken badge -->
                <div class="flex justify-between items-center mt-auto pt-1.5 border-t border-white/5 gap-1 flex-wrap">
                    <div class="flex items-center gap-1.5">
                        ${assigneeBadge}
                        ${takenBadge}
                    </div>
                    <div class="flex items-center gap-1">
                        ${issue.created ? `<span class="text-[7px] text-gray-700">${formatDate(issue.created)}</span>` : ''}
                        <span class="${prioConf.color} text-[9px] font-bold">${prioConf.icon} ${issue.priority || ''}</span>
                    </div>
                </div>
            </div>

            <div class="absolute inset-0 z-0 ${isWorking ? 'bg-blue-500/5 opacity-100' : 'bg-blue-500/3 opacity-0 group-hover:opacity-100'} transition-opacity pointer-events-none rounded-lg"></div>
            ${isWorking ? '<div class="absolute inset-0 z-0 rounded-lg animate-pulse bg-blue-500/3 pointer-events-none"></div>' : ''}
        </div>
    `;
};

// --- Stato filtri ---
let activeFilter   = 'Tutti';
let activeSprint   = 'Tutti';
let activeProject  = 'Tutti';
let activePriority = 'Tutti';
let activeDate     = 'Tutti';   // Tutti | Oggi | Settimana | Mese
let activeAssignee = '';        // testo libero

const renderFilterBar = () => {
    const issues = state.issues || [];
    const uniqueStatuses  = [...new Set(issues.map(t => t.status).filter(Boolean))];
    const sprints  = ['Tutti', ...new Set(issues.filter(t => t.sprint).map(t => t.sprint).filter(Boolean))];
    const projects = ['Tutti', ...new Set(issues.map(t => t.project).filter(Boolean))];
    const priorities = ['Tutti', 'Critical', 'High', 'Medium', 'Normal', 'Low'].filter(p => p === 'Tutti' || issues.some(i => i.priority === p));

    const totalIssues = issues.length;
    const issuesByStatus = {};
    issues.forEach(i => { issuesByStatus[i.status] = (issuesByStatus[i.status] || 0) + 1; });

    const statusFilters = [
        { id: 'Tutti', label: 'Tutti' },
        ...uniqueStatuses.map(s => ({ id: s, label: s }))
    ];

    const dateOptions = [
        { id: 'Tutti', label: 'Tutti' },
        { id: 'Oggi', label: 'Oggi' },
        { id: 'Settimana', label: '7gg' },
        { id: 'Mese', label: '30gg' }
    ];

    const btnCls = (active) => `px-2 py-0.5 rounded text-[8px] uppercase font-bold tracking-tighter transition-all border ${active ? 'bg-[var(--accent-glow)] border-[var(--accent)] text-[var(--accent)]' : 'bg-[var(--bg-main)] gx-border-theme text-gray-500 hover:text-gray-300'}`;

    return `
        <div class="flex flex-col gap-2 px-3 py-2.5 border-b gx-border-theme bg-black/10 backdrop-blur-md">
            <!-- Stats -->
            <div class="flex items-center gap-2 pb-1.5 border-b border-gray-800/50">
                <span class="text-[9px] text-gray-500 font-bold">Totale: <span class="text-blue-400">${totalIssues}</span></span>
                ${Object.entries(issuesByStatus).slice(0, 4).map(([s, c]) =>
                    `<span class="text-[8px] text-gray-700">${s}: <span class="text-gray-500">${c}</span></span>`
                ).join('')}
            </div>

            <!-- Status -->
            <div class="flex flex-wrap gap-1">
                ${statusFilters.map(f =>
                    `<button onclick="window.filterIssues('${f.id}')" class="${btnCls(activeFilter === f.id)}">${f.label}</button>`
                ).join('')}
            </div>

            <!-- Priorità -->
            <div class="flex items-center gap-1.5">
                <span class="text-[8px] uppercase font-bold text-gray-600 tracking-widest shrink-0">Priorità:</span>
                <div class="flex flex-wrap gap-1">
                    ${priorities.map(p =>
                        `<button onclick="window.filterByPriority('${p}')" class="${btnCls(activePriority === p)}">${p}</button>`
                    ).join('')}
                </div>
            </div>

            <!-- Data creazione -->
            <div class="flex items-center gap-1.5">
                <span class="text-[8px] uppercase font-bold text-gray-600 tracking-widest shrink-0">Data:</span>
                <div class="flex gap-1">
                    ${dateOptions.map(d =>
                        `<button onclick="window.filterByDate('${d.id}')" class="${btnCls(activeDate === d.id)}">${d.label}</button>`
                    ).join('')}
                </div>
            </div>

            <!-- Progetto + Sprint -->
            <div class="flex gap-2">
                ${projects.length > 1 ? `
                <div class="flex items-center gap-1 flex-1 min-w-0">
                    <span class="text-[8px] uppercase font-bold text-gray-600 shrink-0">Prog:</span>
                    <select onchange="window.filterByProject(this.value)" class="flex-1 min-w-0 bg-[var(--bg-main)] border gx-border-theme rounded px-1.5 py-0.5 text-[9px] text-gray-300 focus:outline-none focus:border-[var(--accent)] cursor-pointer">
                        ${projects.map(p => `<option value="${p}" ${activeProject === p ? 'selected' : ''}>${p}</option>`).join('')}
                    </select>
                </div>` : ''}
                ${sprints.length > 1 ? `
                <div class="flex items-center gap-1 flex-1 min-w-0">
                    <span class="text-[8px] uppercase font-bold text-gray-600 shrink-0">Sprint:</span>
                    <select onchange="window.filterIssuesBySprint(this.value)" class="flex-1 min-w-0 bg-[var(--bg-main)] border gx-border-theme rounded px-1.5 py-0.5 text-[9px] text-gray-300 focus:outline-none focus:border-[var(--accent)] cursor-pointer">
                        ${sprints.map(s => `<option value="${s}" ${activeSprint === s ? 'selected' : ''}>${s}</option>`).join('')}
                    </select>
                </div>` : ''}
            </div>

            <!-- Assegnatario (testo libero) -->
            <div class="flex items-center gap-1.5">
                <span class="text-[8px] uppercase font-bold text-gray-600 shrink-0">Utente:</span>
                <input
                    id="filter-assignee-input"
                    type="text"
                    placeholder="es. giovanni.faggiano"
                    value="${activeAssignee}"
                    class="flex-1 bg-[var(--bg-main)] border gx-border-theme rounded px-2 py-0.5 text-[9px] text-gray-300 outline-none focus:border-[var(--accent)] font-mono placeholder:text-gray-700"
                />
                <button id="filter-assignee-clear" onclick="window.clearAssigneeFilter()" style="display:${activeAssignee ? 'inline' : 'none'}" class="text-[9px] text-gray-600 hover:text-white transition px-1">✕</button>
            </div>
        </div>
    `;
};

window.openIssuePopup = (issueId) => {
    const issue = state.issues.find(i => i.id === issueId);
    if (!issue) return;

    const tagsHtml = (issue.tags || []).map(t =>
        `<span class="text-[10px] px-2 py-0.5 rounded border gx-border-theme" style="background:${ytColorMap[t.color]||'#333'}44;color:${ytColorMap[t.color]||'#ccc'}">${t.name}</span>`
    ).join('');

    const linksHtml = (issue.links || []).map(l =>
        `<div class="flex items-center gap-2 text-[10px] text-gray-400 p-1 border-b border-gray-800/50">
            <span class="text-blue-500 uppercase font-bold text-[8px] w-12 shrink-0">${l.direction.replace('_',' ')}</span>
            <span class="font-mono text-gray-500">${l.id}</span>
            <span class="truncate italic opacity-70">${l.summary}</span>
        </div>`
    ).join('');

    const modal = document.createElement('div');
    modal.className = "fixed inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm z-[2000000] animate-fade-in pointer-events-auto p-10";
    modal.innerHTML = `
        <div class="w-full max-w-2xl bg-[var(--bg-main)] border border-[var(--border-dim)] rounded-xl shadow-2xl overflow-hidden flex flex-col animate-scale-up max-h-[80vh]">
            <div class="px-6 py-4 border-b border-gray-800 flex justify-between items-start bg-black/20">
                <div class="flex flex-col gap-1">
                    <div class="flex items-center gap-2">
                        <span class="text-xs font-mono text-blue-500 font-bold">${issue.id}</span>
                        <span class="text-[10px] text-gray-500 uppercase font-bold tracking-widest">${issue.project}</span>
                        ${issue.sprint ? `<span class="text-[8px] px-1.5 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded font-bold">Sprint: ${issue.sprint}</span>` : ''}
                    </div>
                    <h2 class="text-lg font-bold text-white leading-tight">${issue.name}</h2>
                </div>
                <button onclick="this.closest('.fixed').remove()" class="p-2 text-gray-500 hover:text-white transition hover:bg-gray-800 rounded-lg">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
            </div>

            <div class="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-5">
                <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div class="flex flex-col p-3 rounded-lg bg-black/20 border border-gray-800/50">
                        <span class="text-[9px] uppercase text-gray-600 font-bold mb-1">Stato</span>
                        <span class="text-xs text-blue-400 font-bold">${issue.status}</span>
                    </div>
                    <div class="flex flex-col p-3 rounded-lg bg-black/20 border border-gray-800/50">
                        <span class="text-[9px] uppercase text-gray-600 font-bold mb-1">Priorità</span>
                        <span class="text-xs text-yellow-500 font-bold">${issue.priority}</span>
                    </div>
                    <div class="flex flex-col p-3 rounded-lg bg-black/20 border border-gray-800/50">
                        <span class="text-[9px] uppercase text-gray-600 font-bold mb-1">Assegnato a</span>
                        <span class="text-xs text-gray-300 font-bold">${issue.assignee || 'Nessuno'}</span>
                    </div>
                    <div class="flex flex-col p-3 rounded-lg bg-black/20 border border-gray-800/50">
                        <span class="text-[9px] uppercase text-gray-600 font-bold mb-1">Reporter</span>
                        <span class="text-xs text-gray-300 font-bold">${issue.reporter || 'N/A'}</span>
                    </div>
                </div>
                ${issue.created ? `<p class="text-[9px] text-gray-600">Creato il: ${formatDate(issue.created)}</p>` : ''}
                ${tagsHtml ? `<div class="space-y-2"><h3 class="text-[10px] uppercase text-gray-500 font-bold tracking-widest">Tag</h3><div class="flex flex-wrap gap-2">${tagsHtml}</div></div>` : ''}
                <div class="space-y-2">
                    <h3 class="text-[10px] uppercase text-gray-500 font-bold tracking-widest">Descrizione</h3>
                    <div class="text-[13px] text-gray-400 leading-relaxed bg-black/10 p-4 rounded-lg border border-gray-800/30 whitespace-pre-wrap font-sans">${issue.description || 'Nessuna descrizione.'}</div>
                </div>
                ${linksHtml ? `<div class="space-y-2"><h3 class="text-[10px] uppercase text-gray-500 font-bold tracking-widest">Collegati</h3><div class="space-y-1">${linksHtml}</div></div>` : ''}
            </div>

            <div class="px-6 py-4 border-t border-gray-800 bg-black/20 flex justify-between items-center">
                <span class="text-[10px] text-gray-600 italic">Sprint: ${issue.sprint || 'N/A'}</span>
                <div class="flex gap-3">
                    <button onclick="this.closest('.fixed').remove()" class="px-4 py-2 text-[10px] font-bold text-gray-400 hover:text-white uppercase transition">Chiudi</button>
                    <button id="issue-open-browser-btn" data-url="${issue.rawUrl || ''}" class="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold rounded-lg transition uppercase flex items-center gap-2">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/></svg>
                        Apri in Browser
                    </button>
                </div>
            </div>
        </div>
    `;
    document.getElementById('modals-root').appendChild(modal);
    modal.querySelector('#issue-open-browser-btn')?.addEventListener('click', () => {
        const url = issue.rawUrl;
        if (url && window.electronAPI?.openExternalLink) window.electronAPI.openExternalLink(url);
    });
};

export const initIssues = async () => {
    const pane = document.getElementById('pane-issues');
    if (!pane) return;

    pane.innerHTML = `
        <div class="h-10 px-4 flex items-center border-b gx-border-theme bg-[var(--bg-side)]">
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
        const rawUrl  = item.getAttribute('data-url');
        if (e.ctrlKey || e.metaKey) {
            if (rawUrl && window.electronAPI?.openExternalLink) window.electronAPI.openExternalLink(rawUrl);
            return;
        }
        setState({ activeIssueId: issueId });
        window.toggleWorkingIssue(issueId);
        window.openIssuePopup(issueId);
    });

    window.toggleWorkingIssue = (issueId) => {
        setState({ activeWorkingIssueId: state.activeWorkingIssueId === issueId ? null : issueId });
    };

    const renderContent = () => {
        const config = state.youtrackConfig || {};
        if (!config.url || !config.token || !config.enabled) {
            contentBox.innerHTML = `
                <div class="flex flex-col items-center justify-center py-12 px-6 text-center animate-fade-in text-gray-500">
                    <div class="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center text-3xl mb-6 shadow-inner border border-blue-500/20">🔍</div>
                    <h3 class="text-xs font-bold text-gray-200 uppercase tracking-widest mb-3">${window.t('settings.youtrack.sync')}</h3>
                    <p class="text-[10px] text-gray-500 leading-relaxed mb-8 max-w-[200px]">Collega YouTrack nelle impostazioni per visualizzare le tue Issue.</p>
                    <button onclick="window.setState({ isSettingsOpen: true, activeSettingsTab: 'youtrack' })" class="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold rounded-lg transition uppercase tracking-tighter">
                        ${window.t('header.settings')}
                    </button>
                </div>`;
            return;
        }
        if (!state.issues || state.issues.length === 0) {
            contentBox.innerHTML = `
                <div class="flex flex-col items-center justify-center py-10 opacity-40">
                    <div class="text-4xl mb-4">✨</div>
                    <p class="text-[11px] text-gray-500 uppercase tracking-widest font-bold">In Pace!</p>
                    <p class="text-[9px] text-gray-600">Nessuna issue trovata.</p>
                </div>`;
            return;
        }
        let filtered = state.issues;
        if (activeFilter !== 'Tutti')   filtered = filtered.filter(t => t.status === activeFilter);
        if (activeSprint !== 'Tutti')   filtered = filtered.filter(t => t.sprint === activeSprint);
        if (activeProject !== 'Tutti')  filtered = filtered.filter(t => t.project === activeProject);
        if (activePriority !== 'Tutti') filtered = filtered.filter(t => t.priority === activePriority);
        if (activeAssignee.trim())      filtered = filtered.filter(t =>
            (t.assignee || '').toLowerCase().includes(activeAssignee.toLowerCase()) ||
            (t.reporter  || '').toLowerCase().includes(activeAssignee.toLowerCase())
        );
        if (activeDate !== 'Tutti') {
            const now  = Date.now();
            const days = activeDate === 'Oggi' ? 1 : activeDate === 'Settimana' ? 7 : 30;
            filtered   = filtered.filter(t => t.created && t.created >= now - days * 86400000);
        }
        if (filtered.length === 0) {
            contentBox.innerHTML = `
                <div class="flex flex-col items-center justify-center py-10 opacity-40">
                    <div class="text-3xl mb-3">🔎</div>
                    <p class="text-[10px] text-gray-500">Nessun risultato con i filtri attivi.</p>
                </div>`;
            return;
        }
        contentBox.innerHTML = filtered.map(renderIssueItem).join('');
    };

    const render = () => {
        filterRoot.innerHTML = renderFilterBar();
        // Attach live input listener — non ricostruisce la barra ad ogni tasto
        const assigneeInput = document.getElementById('filter-assignee-input');
        if (assigneeInput) {
            assigneeInput.addEventListener('input', (e) => {
                activeAssignee = e.target.value;
                // Mostra/nascondi pulsante ✕ senza rifare il render della barra
                const clearBtn = document.getElementById('filter-assignee-clear');
                if (clearBtn) clearBtn.style.display = activeAssignee ? 'inline' : 'none';
                renderContent();
            });
        }
        renderContent();
    };

    window.filterIssues        = (v) => { activeFilter   = v; render(); };
    window.filterIssuesBySprint= (v) => { activeSprint   = v; render(); };
    window.filterByProject     = (v) => { activeProject  = v; render(); };
    window.filterByPriority    = (v) => { activePriority = v; render(); };
    window.filterByDate        = (v) => { activeDate     = v; render(); };
    window.clearAssigneeFilter = ()  => {
        activeAssignee = '';
        const inp = document.getElementById('filter-assignee-input');
        if (inp) inp.value = '';
        const clearBtn = document.getElementById('filter-assignee-clear');
        if (clearBtn) clearBtn.style.display = 'none';
        renderContent();
    };

    subscribe((newState, oldState) => {
        if (newState.activeWorkingIssueId !== oldState?.activeWorkingIssueId) render();
    });
    subscribe(render);

    let refreshInterval = null;
    const startAutoRefresh = () => {
        if (refreshInterval) clearInterval(refreshInterval);
        const c = state.youtrackConfig || {};
        if (c.enabled && c.url && c.token)
            refreshInterval = setInterval(() => api.loadIssues(), 60000);
    };
    const stopAutoRefresh = () => { if (refreshInterval) { clearInterval(refreshInterval); refreshInterval = null; } };

    startAutoRefresh();
    subscribe((newState) => {
        const c = newState.youtrackConfig || {};
        if (!c.enabled || !c.url || !c.token) stopAutoRefresh(); else startAutoRefresh();
    });

    try { await api.loadIssues(); } catch(e) { console.warn("Issues API not responding."); }
};
