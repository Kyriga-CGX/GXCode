import { state, setState } from '../core/state.js';

export const normalizePath = (p) => {
    if (!p) return "";
    let path = p.toString().trim().toLowerCase().replace(/\\/g, '/');
    if (path.startsWith('file:///')) path = path.replace('file:///', '');
    return path;
};

// ── Professional Programming Icons (VSCode Style) ──────────────────────────
export const getFileIcon = (name) => {
    const ext = name.split('.').pop().toLowerCase();
    
    // Icon color/content mapping
    const icons = {
        js: { color: '#f7df1e', content: '<text x="12" y="15" text-anchor="middle" font-family="Arial, sans-serif" font-weight="900" font-size="10" fill="currentColor">JS</text>' },
        ts: { color: '#3178c6', content: '<text x="12" y="15" text-anchor="middle" font-family="Arial, sans-serif" font-weight="900" font-size="10" fill="currentColor">TS</text>' },
        json: { color: '#4fc3f7', content: '<text x="12" y="16" text-anchor="middle" font-family="monospace" font-weight="900" font-size="14" fill="currentColor">{ }</text>' },
        html: { color: '#e44d26', content: '<path d="m8 7-5 5 5 5m8-10 5 5-5 5" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>' },
        css: { color: '#264de4', content: '<path d="m8 7-5 5 5 5m8-10 5 5-5 5" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>' },
        md: { color: '#03a9f4', content: '<path d="M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm6 4v6l4-3z" fill="currentColor"/>' },
        git: { color: '#f05032', content: '<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><path d="M12 7v10M9 10l3-3 3 3" stroke="currentColor" stroke-width="2"/>' }
    };

    const aliases = {
        jsx: 'js', mjs: 'js', cjs: 'js',
        tsx: 'ts',
        htm: 'html', xml: 'html', php: 'html',
        scss: 'css', sass: 'css', less: 'css',
        yaml: 'json', yml: 'json', lock: 'json',
        gitignore: 'git', env: 'git'
    };

    const target = icons[ext] || icons[aliases[ext]] || { color: '#9198a1', content: '<path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" stroke="currentColor" stroke-width="2"/><path d="M13 2v7h7" stroke="currentColor" stroke-width="2"/>' };

    return `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" class="flex-shrink-0" style="color: ${target.color}">
            ${target.content}
        </svg>
    `;
};

export const getFolderIcon = (name, isExpanded) => {
    // Minimalist solid box for folder
    return `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" class="flex-shrink-0">
            <rect x="3" y="6" width="18" height="13" rx="1.5" fill="currentColor" class="text-gray-400 opacity-60" />
            <path d="M3 10V5a2 2 0 0 1 2-2h5l2 3h10" stroke="currentColor" stroke-width="2.5" class="text-gray-400 opacity-40" />
        </svg>
    `;
};

const delBtn = (p) => `<button class="gx-del-btn opacity-0 group-hover:opacity-100 hover:text-red-500 transition-opacity p-0.5" data-del="${p}">
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
    </svg></button>`;

export const renderFileTree = (files, depth = 0) => {
    if (!files || !Array.isArray(files) || files.length === 0) return '';

    const checkIsDir = (file) => {
        return file.type === 'directory' || 
               file.isDirectory === true || 
               Array.isArray(file.children) || 
               Array.isArray(file.files) ||
               (file.path && !file.path.split(/[\\/]/).pop().includes('.') && !file.name.includes('.'));
    };

    // --- SORTING LOGIC: Folders First, then Alphabetical ---
    const sortedFiles = [...files].sort((a, b) => {
        const aDir = checkIsDir(a);
        const bDir = checkIsDir(b);
        if (aDir !== bDir) return aDir ? -1 : 1;
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true });
    });
    
    return sortedFiles.map(file => {
        const isDirectory = checkIsDir(file);
                             
        const normItem = normalizePath(file.path);
        const isExpanded = state.expandedFolders.some(p => normalizePath(p) === normItem);
        const children = file.children || file.files || file.items;
        
        const icon = isDirectory ? getFolderIcon(file.name, isExpanded) : getFileIcon(file.name);
        const isActive = state.activeFileId === file.path;
        const isSelected = state.activeExplorerItem === file.path;

        const chevron = isDirectory ? `
            <svg class="text-gray-600 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                <path d="M9 5l7 7-7 7"/>
            </svg>` : '<div class="w-[8px]"></div>';

        const linesHtml = Array.from({ length: depth }, (_, i) => 
            `<div class="hierarchy-line" style="left: -${(i + 1) * 20 - 10}px; opacity: ${1 - (i * 0.15)}"></div>`
        ).join('');

        return `
            <div class="flex flex-col relative" style="margin-left: ${depth === 0 ? '0' : '20px'}">
                <div class="explorer-item-card ${isActive ? 'active' : ''} ${isSelected ? 'selected-explorer-item' : ''}" 
                     data-path="${file.path}" data-name="${file.name}" data-is-directory="${isDirectory}"
                     draggable="true"
                     ondragstart="window.onExplorerDragStart(event, '${file.path.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}')"
                     ondragover="window.onExplorerDragOver(event, ${isDirectory})"
                     ondragleave="window.onExplorerDragLeave(event)"
                     ondrop="window.onExplorerDrop(event, '${file.path.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}', ${isDirectory})"
                     onclick="window.selectExplorerItem('${file.path.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}', ${isDirectory}); ${isDirectory ? `window.toggleExplorerFolder('${file.path.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}')` : `window.openFileInIDE('${file.path.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}', '${file.name.replace(/'/g, "\\'")}')`}">
                    
                    ${linesHtml}
                    
                    <div class="flex items-center gap-2 overflow-hidden flex-1">
                        ${chevron}
                        <div class="shrink-0 flex items-center justify-center w-4 h-4 translate-y-[0.5px]">${icon}</div>
                        <span class="text-[10px] font-bold truncate tracking-tight transition-colors ${isActive || isSelected ? 'text-white' : 'text-gray-400 group-hover:text-gray-200'}">${file.name}</span>
                    </div>
                </div>
                
                ${isDirectory && isExpanded && children ? `
                    <div class="explorer-children-container">
                        ${renderFileTree(children, depth + 1)}
                    </div>` : ''}
            </div>
        `;
    }).join('');
};

window.toggleExplorerFolder = (path) => {
    const normPath = normalizePath(path);
    let expandedFolders = [...state.expandedFolders];
    const normalizedExpanded = expandedFolders.map(p => normalizePath(p));
    const isAlreadyExpanded = normalizedExpanded.includes(normPath);

    if (isAlreadyExpanded) {
        expandedFolders = expandedFolders.filter(p => normalizePath(p) !== normPath);
    } else {
        expandedFolders.push(path);
        
        const findNode = (items, p) => {
            for (const item of items) {
                if (item.path === p) return item;
                const children = item.children || item.files || item.items;
                if (children) {
                    const found = findNode(children, p);
                    if (found) return found;
                }
            }
            return null;
        };

        const node = findNode(state.files, path);
        if (node && (!node.children || node.children.length === 0)) {
            if (window.fetchFolderContents) {
                window.fetchFolderContents(path);
            }
        }
    }
    setState({ expandedFolders });
};

window.selectExplorerItem = (path, isDirectory) => {
    setState({ activeExplorerItem: path, activeExplorerItemIsDir: isDirectory });
};

window.handleExplorerContextMenu = (event, path, isDirectory) => {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    
    // Se facciamo clic col destro, selezioniamo anche l'item
    window.selectExplorerItem(path, isDirectory);
    
    console.log(`[Explorer] Right-click on: ${path} (isDirectory: ${isDirectory})`);
    
    if (window.showContextMenu) {
        window.showContextMenu(event, path, isDirectory);
    } else {
        console.warn("[Explorer] window.showContextMenu non è definita!");
    }
};

// --- DRAG & DROP LOGIC (Evolution 2026) ---

let activeDragPath = null;

window.onExplorerDragStart = (event, path) => {
    activeDragPath = path;
    const name = path.split(/[\\/]/).pop();
    event.dataTransfer.setData('text/plain', path);
    event.dataTransfer.effectAllowed = 'move';
    
    // Visual feedback on the ghost image (optional)
    console.log(`[DnD] Start dragging: ${name}`);
};

window.onExplorerDragOver = (event, isDirectory) => {
    event.preventDefault();
    if (!isDirectory) return;
    
    const card = event.currentTarget;
    const targetPath = card.dataset.path;
    
    // Anticede: non puoi droppare su se stesso o in una sottocartella se è una cartella
    if (activeDragPath === targetPath || targetPath.startsWith(activeDragPath + '/') || targetPath.startsWith(activeDragPath + '\\')) {
        event.dataTransfer.dropEffect = 'none';
        return;
    }
    
    event.dataTransfer.dropEffect = 'move';
    card.classList.add('drag-over-active');
};

window.onExplorerDragLeave = (event) => {
    event.currentTarget.classList.remove('drag-over-active');
};

window.onExplorerDrop = async (event, targetPath, isDirectory) => {
    event.preventDefault();
    const card = event.currentTarget;
    card.classList.remove('drag-over-active');
    
    if (!isDirectory || !activeDragPath) return;
    if (activeDragPath === targetPath) return;

    // Controllo se il target è una sottocartella del sorgente (loop infinito)
    if (targetPath.startsWith(activeDragPath + '/') || targetPath.startsWith(activeDragPath + '\\')) {
        if (window.gxToast) window.gxToast("Non puoi spostare una cartella dentro se stessa!", "error");
        return;
    }

    const name = activeDragPath.split(/[\\/]/).pop();
    const delimiter = targetPath.includes('/') ? '/' : '\\';
    const newPath = targetPath.endsWith(delimiter) ? (targetPath + name) : (targetPath + delimiter + name);

    console.log(`[DnD] Moving: ${activeDragPath} -> ${newPath}`);

    try {
        const res = await window.electronAPI.fsRename(activeDragPath, newPath);
        if (res && res.error) {
            throw new Error(res.error);
        }
        
        if (window.gxToast) window.gxToast(`Spostato: ${name}`, "success");
        if (window.refreshWorkspace) window.refreshWorkspace();
    } catch (err) {
        console.error("[DnD] Errore spostamento:", err);
        if (window.gxToast) window.gxToast("Errore: " + err.message, "error");
    } finally {
        activeDragPath = null;
    }
};

export function pingExplorerFile(path) {
    // Cerchiamo l'elemento nel DOM tramite attributo data-path o data-id
    const el = document.querySelector(`[data-path="${path}"]`) || document.querySelector(`[data-id="${path}"]`);
    if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        el.classList.add('ai-glow-discovery');
        setTimeout(() => el.classList.remove('ai-glow-discovery'), 4000);
    }
}
window.pingExplorerFile = pingExplorerFile;
