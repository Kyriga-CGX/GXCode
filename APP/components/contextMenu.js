import { state, setState } from '../core/state.js';

export const showContextMenu = (e, path, isDirectory) => {
    e.preventDefault();
    
    // Remove existing menu
    const existing = document.getElementById('gx-context-menu');
    if (existing) existing.remove();

    const modalsRoot = document.getElementById('modals-root');
    const menu = document.createElement('div');
    menu.id = 'gx-context-menu';
    // Offset x slightly (+2px) to prevent being cut by the sidebar shadow/border
    const x = e.clientX + 2; 
    const y = e.clientY;

    menu.className = 'fixed bg-[#12161d] border border-gray-800 rounded-lg shadow-2xl py-1.5 text-[12px] min-w-[200px] animate-in fade-in zoom-in duration-150 backdrop-blur-xl pointer-events-auto';
    menu.style.zIndex = "2147483647"; 
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;

    // Modern items construction
    const items = [
        { label: window.t('contextMenu.newFile'), icon: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>', onClick: () => createItem(path, isDirectory, 'file') },
        { label: window.t('contextMenu.newFolder'), icon: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>', onClick: () => createItem(path, isDirectory, 'folder') },
        { label: window.t('contextMenu.newWorkspace'), icon: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>', onClick: () => createItem(path, isDirectory, 'workspace') },
        { divider: true },
        { label: window.t('contextMenu.reveal'), icon: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>', onClick: () => revealInExplorer(path) },
        { label: window.t('contextMenu.copyPath'), icon: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>', onClick: () => navigator.clipboard.writeText(path) },
        { divider: true },
        { label: window.t('contextMenu.delete'), icon: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>', color: 'text-red-400 hover:text-white hover:bg-red-500/80', onClick: () => deleteItem(path) },
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

    if (modalsRoot) {
        modalsRoot.classList.remove('pointer-events-none');
        modalsRoot.appendChild(menu);
    } else {
        document.body.appendChild(menu);
    }

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
        if (modalsRoot && !modalsRoot.innerHTML.trim()) {
            modalsRoot.classList.add('pointer-events-none');
        }
        window.removeEventListener('mousedown', closeHandler);
    };
    setTimeout(() => window.addEventListener('mousedown', closeHandler), 10);
};

const createItem = async (targetPath, isTargetDirectory, type) => {
    let parentDir = isTargetDirectory ? targetPath : targetPath.substring(0, Math.max(targetPath.lastIndexOf('\\'), targetPath.lastIndexOf('/')));
    
    // Fallback alla root se parentDir è vuoto o non valido
    if (!parentDir && state.workspaceData?.path) {
        parentDir = state.workspaceData.path;
    }

    const typeLabel = type === 'file' ? window.t('contextMenu.file') : window.t('contextMenu.folder');
    
    // Dismiss context menu then open prompt
    const menu = document.getElementById('gx-context-menu');
    if (menu) menu.remove();

    window.gxPrompt(window.t('contextMenu.enterName'), typeLabel, '', async (name) => {
        let res;
        if (type === 'file') {
            res = await window.electronAPI.fsWriteFile(`${parentDir}\\${name}`, '');
        } else if (type === 'workspace') {
            const wsName = name.endsWith('.code-workspace') ? name : `${name}.code-workspace`;
            const template = JSON.stringify({ folders: [{ path: "." }], settings: {} }, null, 4);
            res = await window.electronAPI.fsWriteFile(`${parentDir}\\${wsName}`, template);
        } else {
            res = await window.electronAPI.fsCreateFolder(parentDir, name);
        }

        if (res?.error) {
            window.gxAlert('Errore', res.error, 'error');
        } else {
            window.gxToast(window.t('common.success'), 'success');
            refreshWorkspaceAndGit();
        }
    });
};

const deleteItem = async (path) => {
    if (!confirm(window.t('contextMenu.deleteConfirm').replace('{path}', path))) return;
    const res = await window.electronAPI.fsDelete(path);
    if (res.error) {
        alert(window.t('contextMenu.deleteError').replace('{error}', res.error));
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
