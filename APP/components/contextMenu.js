import { state, setState } from '../core/state.js';

export const showContextMenu = (e, path, isDirectory) => {
    e.preventDefault();
    
    // Remove existing menu
    const existing = document.getElementById('gx-context-menu');
    if (existing) existing.remove();

    const menu = document.createElement('div');
    menu.id = 'gx-context-menu';
    menu.className = 'fixed bg-[#161b22] border border-[#30363d] rounded-lg shadow-2xl py-2 z-[9999] text-[12px] min-w-[180px] animate-in fade-in zoom-in duration-150 backdrop-blur-md';
    menu.style.left = `${e.clientX}px`;
    menu.style.top = `${e.clientY}px`;

    // Modern items construction
    const items = [
        { label: 'New File', icon: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>', onClick: () => createItem(path, isDirectory, 'file') },
        { label: 'New Folder', icon: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>', onClick: () => createItem(path, isDirectory, 'folder') },
        { divider: true },
        { label: 'Reveal in Explorer', icon: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>', onClick: () => revealInExplorer(path) },
        { label: 'Copy Path', icon: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>', onClick: () => navigator.clipboard.writeText(path) },
        { divider: true },
        { label: 'Delete', icon: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>', color: 'text-red-400 hover:text-white hover:bg-red-500/80', onClick: () => deleteItem(path) },
    ];

    items.forEach(item => {
        if (item.divider) {
            const d = document.createElement('div');
            d.className = 'h-[1px] bg-[#30363d] my-1 mx-2 opacity-50';
            menu.appendChild(d);
            return;
        }
        const div = document.createElement('div');
        div.className = `flex items-center px-3 py-1.5 hover:bg-blue-600 cursor-pointer text-[#c9d1d9] transition-all rounded-md mx-1 group ${item.color || ''}`;
        div.innerHTML = `
            <span class="mr-2.5 opacity-60 group-hover:opacity-100 transition-opacity">${item.icon}</span>
            <span class="flex-1">${item.label}</span>
        `;
        div.onclick = (ev) => {
            ev.stopPropagation();
            item.onClick();
            menu.remove();
        };
        menu.appendChild(div);
    });

    document.body.appendChild(menu);

    // Dynamic repositioning if menu overflows screen
    const rect = menu.getBoundingClientRect();
    if (rect.bottom > window.innerHeight) {
        menu.style.top = `${e.clientY - rect.height}px`;
    }
    if (rect.right > window.innerWidth) {
        menu.style.left = `${e.clientX - rect.width}px`;
    }

    const closeHandler = () => {
        menu.remove();
        window.removeEventListener('mousedown', closeHandler);
    };
    setTimeout(() => window.addEventListener('mousedown', closeHandler), 10);
};

const createItem = async (targetPath, isTargetDirectory, type) => {
    const parentDir = isTargetDirectory ? targetPath : targetPath.substring(0, targetPath.lastIndexOf('\\'));
    const name = prompt(`Inserisci il nome del ${type === 'file' ? 'file' : 'cartella'}:`);
    if (!name) return;

    let res;
    if (type === 'file') {
        res = await window.electronAPI.fsCreateFile(parentDir, name);
    } else {
        res = await window.electronAPI.fsCreateFolder(parentDir, name);
    }

    if (res.error) {
        console.error("[GX FS] Creation error:", res.error);
        alert(`Errore: ${res.error}`);
    } else {
        console.log(`[GX FS] ${type} creato:`, res.path);
        refreshWorkspaceAndGit();
    }
};

const deleteItem = async (path) => {
    if (!confirm(`Sei sicuro di voler eliminare definitivamente questo elemento?\n\n${path}`)) return;
    const res = await window.electronAPI.fsDelete(path);
    if (res.error) {
        alert(`Errore eliminazione: ${res.error}`);
    } else {
        refreshWorkspaceAndGit();
    }
};

const revealInExplorer = async (path) => {
    await window.electronAPI.shellOpenPath(path);
};

const refreshWorkspaceAndGit = async () => {
    // Refresh folder data in state first
    const currentPath = state.workspaceData?.path;
    if (currentPath && window.electronAPI?.openSpecificFolder) {
        const data = await window.electronAPI.openSpecificFolder(currentPath);
        if (data && !data.error) {
            setState({ workspaceData: data });
        }
    }
    // Refresh Git Status
    if (window.renderGit) window.renderGit();
};
