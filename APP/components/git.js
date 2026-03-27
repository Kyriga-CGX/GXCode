import { state, subscribe } from '../core/state.js';

export const initGit = () => {
    console.log('[GX GIT] Initializing Git Component...');
    
    // Rerender on activity change
    subscribe((newState, oldState) => {
        if (newState.activeActivity === 'git' && oldState?.activeActivity !== 'git') {
            renderGit();
        }
    });

    if (state.activeActivity === 'git') {
        renderGit();
    }
};

export const renderGit = async () => {
    const container = document.getElementById('git-content');
    if (!container) return;

    // Loading State
    container.innerHTML = `
        <div class="p-8 text-center opacity-30 mt-10">
            <svg class="mx-auto mb-4 animate-spin" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
            <p class="text-[10px] uppercase font-bold tracking-widest">Refreshing Status...</p>
        </div>
    `;

    const res = await window.electronAPI.gitStatus();
    if (!res.success) {
        // ... (Error handling remains same)
        container.innerHTML = `
            <div class="p-6 text-center text-red-500/60 mt-10">
                <p class="text-[10px] uppercase font-bold mb-2">Git Error</p>
                <p class="text-[9px] font-mono whitespace-normal overflow-hidden">${res.error}</p>
                <button onclick="renderGit()" class="mt-4 px-3 py-1 bg-gray-800 rounded text-[9px] text-gray-400 hover:text-white transition">Riprova</button>
            </div>
        `;
        return;
    }

    const { files, branch } = res;
    
    // 🔥 SYNC GLOBAL STATE FOR FILE EXPLORER 🔥
    const statusMap = {};
    files.forEach(f => {
        // Normalizziamo il path per Windows per matchare workspaceData
        const normPath = f.path.replace(/\//g, '\\');
        statusMap[normPath] = f.status;
    });
    setState({ gitStatus: statusMap });

    const getStatusInfo = (s) => {
        if (s === 'M') return { label: 'M', color: 'text-amber-500', title: 'Modified' };
        if (s === 'A') return { label: 'A', color: 'text-emerald-500', title: 'Added' };
        if (s === 'D') return { label: 'D', color: 'text-red-500', title: 'Deleted' };
        if (s === '??') return { label: 'U', color: 'text-purple-500', title: 'Untracked' };
        return { label: s, color: 'text-gray-500', title: 'Unknown' };
    };

    const filesHtml = files.length > 0 ? files.map(file => {
        const info = getStatusInfo(file.status);
        return `
            <div class="group flex items-center justify-between p-1.5 hover:bg-white/5 rounded transition border border-transparent hover:border-white/5 cursor-pointer">
                <div class="flex items-center gap-2 overflow-hidden">
                    <span class="${info.color} text-[9px] font-bold shrink-0 w-3 text-center" title="${info.title}">${info.label}</span>
                    <span class="text-[11px] text-gray-300 truncate font-mono">${file.path}</span>
                </div>
                <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onclick="window.handleGitAction('stage', '${file.path}')" class="p-1 text-gray-500 hover:text-blue-400 transition" title="Stage Change">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                    </button>
                </div>
            </div>
        `;
    }).join('') : `<div class="p-4 text-center text-gray-600 text-[10px] uppercase font-bold tracking-tighter">No Changes Found</div>`;

    container.innerHTML = `
        <div class="flex flex-col h-full">
            <!-- Sync Bar -->
            <div class="px-3 py-2 border-b border-gray-800/50 flex items-center justify-between bg-[#161b22]/30">
                <div class="flex gap-1">
                    <button onclick="window.handleGitAction('pull')" class="p-1 mr-1 text-gray-400 hover:text-blue-400 transition" title="Git Pull">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 17V3"/><path d="m6 11 6 6 6-6"/></svg>
                    </button>
                    <button onclick="window.handleGitAction('push')" class="p-1 text-gray-400 hover:text-emerald-400 transition" title="Git Push">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v14"/><path d="m6 9 6-6 6 6"/></svg>
                    </button>
                </div>
                <div class="flex items-center gap-1.5 opacity-60">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 3v12"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>
                    <span class="text-[10px] font-mono text-gray-300">${branch}</span>
                </div>
            </div>

            <div class="p-3 space-y-4 flex-1">
                <div class="flex items-center justify-between px-1">
                    <h4 class="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Changes</h4>
                    <span class="px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 text-[10px] font-bold border border-blue-500/20">${files.length}</span>
                </div>
                
                <div class="space-y-0.5 max-h-[250px] overflow-y-auto custom-scrollbar">
                    ${filesHtml}
                </div>

                <div class="pt-4 border-t border-gray-800/50 mt-auto">
                    <div class="flex flex-col gap-2">
                        <textarea id="git-commit-msg-input" placeholder="Messaggio di commit..." 
                            class="w-full bg-[#161b22]/50 border border-gray-800 rounded p-2 text-[11px] text-gray-300 outline-none focus:border-blue-500/30 transition min-h-[60px] resize-none custom-scrollbar"
                        ></textarea>
                        <button onclick="window.handleGitAction('commit')" class="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-[10px] font-bold uppercase tracking-widest transition shadow-lg flex items-center justify-center gap-2">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m5 12 5 5L20 7"/></svg>
                            Commit to ${branch}
                        </button>
                    </div>
                </div>
            </div>

            <div class="p-3 border-t border-gray-800/50 bg-[#0d1117]/80 flex items-center justify-center">
                 <button onclick="renderGit()" class="text-[10px] text-gray-600 hover:text-gray-400 flex items-center gap-1 transition uppercase tracking-widest font-bold">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/><path d="M22 2v6h-6"/></svg>
                    Refresh
                 </button>
            </div>
        </div>
    `;
};

window.handleGitAction = async (action, data) => {
    if (action === 'stage') {
        await window.electronAPI.gitStage(data);
        renderGit();
    } else if (action === 'commit') {
        const msgInput = document.getElementById('git-commit-msg-input');
        const message = msgInput?.value.trim();
        if (!message) return;
        
        await window.electronAPI.gitCommit(message);
        if (msgInput) msgInput.value = '';
        renderGit();
    } else if (action === 'pull') {
        const res = await window.electronAPI.gitPull();
        alert(res.success ? 'Pull completed!' : 'Pull failed: ' + res.error);
        renderGit();
    } else if (action === 'push') {
        const res = await window.electronAPI.gitPush();
        alert(res.success ? 'Push completed!' : 'Push failed: ' + res.error);
        renderGit();
    }
};

window.renderGit = renderGit;
