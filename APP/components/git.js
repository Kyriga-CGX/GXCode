import { state, subscribe } from '../core/state.js';

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
            <div class="px-3 py-2 border-b border-[var(--border-dim)] flex items-center justify-between bg-[var(--bg-side)]">
                <div class="flex gap-1">
                    <button onclick="window.handleGitAction('pull')" class="p-1 mr-1 text-gray-400 hover:text-blue-400 transition" data-i18n="[title]git.pull">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 17V3"/><path d="m6 11 6 6 6-6"/></svg>
                    </button>
                    <button onclick="window.handleGitAction('push')" class="p-1 text-gray-400 hover:text-emerald-400 transition" data-i18n="[title]git.push">
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
                    <h4 class="text-[9px] font-bold text-gray-500 uppercase tracking-widest" data-i18n="git.changes">${window.t('git.changes')}</h4>
                    <span class="px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 text-[10px] font-bold border border-blue-500/20">${files.length}</span>
                </div>
                
                <div class="space-y-0.5 max-h-[250px] overflow-y-auto custom-scrollbar">
                    ${filesHtml}
                </div>

                <div class="pt-4 border-t border-[var(--border-dim)] mt-auto">
                    <div class="flex flex-col gap-2">
                        <textarea id="git-commit-msg-input" data-i18n="[placeholder]git.commitPlaceholder" placeholder="${window.t('git.commitPlaceholder')}" 
                            class="w-full bg-[var(--bg-side)] border border-[var(--border-dim)] rounded p-2 text-[11px] text-gray-300 outline-none focus:border-[var(--accent)] transition min-h-[60px] resize-none custom-scrollbar"
                        ></textarea>
                        <button onclick="window.handleGitAction('commit')" class="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-[10px] font-bold uppercase tracking-widest transition shadow-lg flex items-center justify-center gap-2">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m5 12 5 5L20 7"/></svg>
                            <span data-i18n="git.commitTo">${window.t('git.commitTo').replace('{branch}', branch)}</span>
                        </button>
                    </div>
                </div>
            </div>

            <div class="p-3 border-t border-[var(--border-dim)] bg-[var(--bg-side)] flex items-center justify-center">
                 <button onclick="renderGit()" class="text-[10px] text-gray-600 hover:text-gray-400 flex items-center gap-1 transition uppercase tracking-widest font-bold" data-i18n="git.refresh">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/><path d="M22 2v6h-6"/></svg>
                    ${window.t('git.refresh')}
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
