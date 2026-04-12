import { state, subscribe, setState } from '../core/state.js';

export const initGit = () => {
    console.log('[GX GIT] Initializing Git Component...');

    // Fetch iniziale silenzioso per popolare i badge nell'Explorer
    refreshGitStatusSilent();

    // Rerender on activity change
    subscribe((newState, oldState) => {
        if (newState.activeActivity === 'git' && oldState?.activeActivity !== 'git') {
            renderGit();
        }
    });

    // Refresh gitStatus quando cambia il workspace
    subscribe((newState, oldState) => {
        if (newState.workspaceData?.path !== oldState?.workspaceData?.path) {
            refreshGitStatusSilent();
        }
    });

    if (state.activeActivity === 'git') {
        renderGit();
    }
};

// Fetch silenzioso di gitStatus (senza UI loading)
export const refreshGitStatusSilent = async () => {
    if (!state.workspaceData?.path) return;
    
    try {
        const res = await window.electronAPI.gitStatus(state.workspaceData.path);
        if (!res.success) {
            console.warn('[GX GIT] Silent refresh failed:', res.error);
            return;
        }

        // Usiamo lo stesso formato di normalizePath in explorer.js (slash, lowercase)
        const workspacePath = state.workspaceData.path.replace(/\\/g, '/').toLowerCase().replace(/\/$/, '');
        const statusMap = {};
        
        res.files.forEach(f => {
            // git status restituisce path relativi, dobbiamo convertirli in assoluti
            const relativePath = f.path.replace(/\\/g, '/');
            const absolutePath = (workspacePath + '/' + relativePath).toLowerCase();
            statusMap[absolutePath] = f.status;
        });
        
        setState({ gitStatus: statusMap });
        console.log(`[GX GIT] Silent refresh: ${res.files.length} tracked files`);
        console.log(`[GX GIT] Sample mappings:`, Object.entries(statusMap).slice(0, 3));
    } catch (err) {
        console.warn('[GX GIT] Silent refresh error:', err);
    }
};

export const renderGit = async () => {
    const container = document.getElementById('git-content');
    if (!container) return;

    // Loading State
    container.innerHTML = `
        <div class="p-8 text-center opacity-30 mt-10">
            <svg class="mx-auto mb-4 animate-spin" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
            <p class="text-[10px] uppercase font-bold tracking-widest" data-i18n="git.refreshing">${window.t('git.refreshing')}</p>
        </div>
    `;

    const res = await window.electronAPI.gitStatus(state.workspaceData?.path);
    if (!res.success) {
        // ... (Error handling remains same)
        container.innerHTML = `
            <div class="p-6 text-center text-red-500/60 mt-10">
                <p class="text-[10px] uppercase font-bold mb-2" data-i18n="git.error">${window.t('git.error')}</p>
                <p class="text-[9px] font-mono whitespace-normal overflow-hidden">${res.error}</p>
                <button onclick="renderGit()" class="mt-4 px-3 py-1 bg-[var(--bg-side-alt)] rounded text-[9px] text-gray-400 hover:text-white transition" data-i18n="git.retry">${window.t('git.retry')}</button>
            </div>
        `;
        return;
    }

    const { files, branch } = res;

    // 🔥 SYNC GLOBAL STATE FOR FILE EXPLORER 🔥
    // Usiamo lo stesso formato di normalizePath (slash, lowercase)
    const workspacePath = (state.workspaceData?.path?.replace(/\\/g, '/').toLowerCase() || '').replace(/\/$/, '');
    const statusMap = {};
    files.forEach(f => {
        // git status restituisce path relativi, convertiamo in assoluti
        const relativePath = f.path.replace(/\\/g, '/');
        const absolutePath = (workspacePath + '/' + relativePath).toLowerCase();
        statusMap[absolutePath] = f.status;
    });
    setState({ gitStatus: statusMap });

    const getStatusInfo = (s) => {
        if (s === 'M') return { label: 'M', color: 'text-amber-500', title: window.t('git.status.m') };
        if (s === 'A') return { label: 'A', color: 'text-emerald-500', title: window.t('git.status.a') };
        if (s === 'D') return { label: 'D', color: 'text-red-500', title: window.t('git.status.d') };
        if (s === '??') return { label: 'U', color: 'text-purple-500', title: window.t('git.status.u') };
        return { label: s, color: 'text-gray-500', title: window.t('git.status.unknown') };
    };

    const filesHtml = files.length > 0 ? files.map(file => {
        const info = getStatusInfo(file.status);
        return `
            <div class="group flex items-center justify-between p-1.5 hover:bg-[var(--bg-side-alt)] rounded transition border border-transparent hover:border-[var(--border-ghost)] cursor-pointer">
                <div class="flex items-center gap-2 overflow-hidden">
                    <span class="${info.color} text-[9px] font-bold shrink-0 w-3 text-center" title="${info.title}">${info.label}</span>
                    <span class="text-[11px] text-gray-300 truncate font-mono">${file.path}</span>
                </div>
                <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onclick="window.handleGitAction('stage', '${file.path}')" class="p-1 text-gray-500 hover:text-blue-400 transition" data-i18n="[title]git.stage">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                    </button>
                </div>
            </div>
        `;
    }).join('') : `<div class="p-4 text-center text-gray-600 text-[10px] uppercase font-bold tracking-tighter" data-i18n="git.noChanges">${window.t('git.noChanges')}</div>`;

    container.innerHTML = `
        <div class="flex flex-col h-full">
            <!-- Sync Bar -->
            <div class="px-3 py-2 border-b border-[var(--border-dim)] flex items-center justify-between bg-gradient-to-r from-[var(--bg-side)] to-[var(--bg-main)]">
                <div class="flex gap-1">
                    <button onclick="window.handleGitAction('pull')" class="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 hover:text-blue-300 transition border border-blue-500/20" data-i18n="[title]git.pull" title="Pull">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 17V3"/><path d="m6 11 6 6 6-6"/></svg>
                    </button>
                    <button onclick="window.handleGitAction('push')" class="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300 transition border border-emerald-500/20" data-i18n="[title]git.push" title="Push">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v14"/><path d="m6 9 6-6 6 6"/></svg>
                    </button>
                </div>
                <div class="flex items-center gap-2">
                    <div class="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-purple-500/10 border border-purple-500/20">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-purple-400"><path d="M6 3v12"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>
                        <span class="text-[10px] font-mono text-purple-300 font-semibold">${branch}</span>
                    </div>
                </div>
            </div>

            <div class="p-3 space-y-3 flex-1 overflow-y-auto custom-scrollbar">
                <div class="flex items-center justify-between px-2 py-2 rounded-lg bg-black/20 border border-[var(--border-ghost)]">
                    <h4 class="text-[9px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-blue-400"><path d="M9 14l-4-4 4-4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg>
                        ${window.t('git.changes') || 'Modifiche'}
                    </h4>
                    <span class="px-2 py-0.5 rounded-full bg-gradient-to-r from-blue-500/20 to-blue-600/10 text-blue-400 text-[10px] font-bold border border-blue-500/30 shadow-lg shadow-blue-500/10">${files.length}</span>
                </div>

                <div class="space-y-1 max-h-[200px] overflow-y-auto custom-scrollbar pr-1">
                    ${filesHtml}
                </div>

                <div class="pt-3 border-t border-[var(--border-dim)]">
                    <div class="flex flex-col gap-2">
                        <textarea id="git-commit-msg-input" data-i18n="[placeholder]git.commitPlaceholder" placeholder="${window.t('git.commitPlaceholder')}"
                            class="w-full bg-[var(--bg-side)] border border-[var(--border-dim)] rounded-lg p-2.5 text-[11px] text-gray-300 outline-none focus:border-[var(--accent)] transition min-h-[60px] resize-none custom-scrollbar placeholder:text-gray-600"
                        ></textarea>
                        <button onclick="window.handleGitAction('commit')" class="w-full py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white rounded-lg text-[10px] font-bold uppercase tracking-widest transition shadow-lg shadow-blue-900/40 flex items-center justify-center gap-2 hover:shadow-blue-800/50">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m5 12 5 5L20 7"/></svg>
                            <span>Commit to ${branch}</span>
                        </button>
                    </div>
                </div>
            </div>

            <div class="p-2 border-t border-[var(--border-dim)] bg-gradient-to-t from-[var(--bg-side)] to-[var(--bg-main)] flex items-center justify-center">
                 <button onclick="renderGit()" class="text-[10px] text-gray-500 hover:text-gray-300 flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-white/5 transition uppercase tracking-widest font-bold">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/><path d="M22 2v6h-6"/></svg>
                    ${window.t('git.refresh') || 'Refresh'}
                 </button>
            </div>
        </div>
    `;
};

window.handleGitAction = async (action, data) => {
    const workspacePath = state.workspaceData?.path;
    if (action === 'stage') {
        await window.electronAPI.gitStage(workspacePath, data);
        renderGit();
    } else if (action === 'commit') {
        const msgInput = document.getElementById('git-commit-msg-input');
        const message = msgInput?.value.trim();
        if (!message) return;
        
        await window.electronAPI.gitCommit(workspacePath, message);
        if (msgInput) msgInput.value = '';
        renderGit();
    } else if (action === 'pull') {
        const res = await window.electronAPI.gitPull(workspacePath);
        alert(res.success ? window.t('git.pullSuccess') : (window.t('git.pullError').replace('{error}', res.error)));
        renderGit();
    } else if (action === 'push') {
        const res = await window.electronAPI.gitPush(workspacePath);
        alert(res.success ? window.t('git.pushSuccess') : (window.t('git.pushError').replace('{error}', res.error)));
        renderGit();
    }
};

window.renderGit = renderGit;
window.refreshGitStatusSilent = refreshGitStatusSilent;
