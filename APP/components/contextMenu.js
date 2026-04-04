import { state, setState } from '../core/state.js';

export const showGenericMenu = (e, items) => {
    e.preventDefault();
    const existing = document.getElementById('gx-context-menu');
    if (existing) existing.remove();

    const modalsRoot = document.getElementById('modals-root');
    const menu = document.createElement('div');
    menu.id = 'gx-context-menu';
    
    const x = e.clientX + 2; 
    const y = e.clientY;

    // Aumentata l'opacità per una visibilità "Elite" superiore
    menu.className = 'fixed bg-[#0d1117] border gx-border-theme rounded-xl shadow-2xl py-1.5 text-[11px] min-w-[220px] animate-in fade-in zoom-in duration-150 backdrop-blur-3xl pointer-events-auto z-[9999]';
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    
    // Impediamo al click sul menu di propagarsi al dismisser globale
    menu.onmousedown = (ev) => ev.stopPropagation();
    menu.onclick = (ev) => ev.stopPropagation();
    menu.oncontextmenu = (ev) => ev.preventDefault();

    renderItems(menu, items, false);

    if (modalsRoot) {
        modalsRoot.classList.remove('pointer-events-none');
        modalsRoot.appendChild(menu);
    } else {
        document.body.appendChild(menu);
    }

    const rect = menu.getBoundingClientRect();
    if (rect.bottom > window.innerHeight) menu.style.top = `${e.clientY - rect.height}px`;
    if (rect.right > window.innerWidth) menu.style.left = `${e.clientX - rect.width}px`;

    const closeHandler = () => {
        menu.remove();
        document.querySelectorAll('.gx-submenu').forEach(s => s.remove());
        window.removeEventListener('click', closeHandler);
        window.removeEventListener('contextmenu', closeHandler);
    };
    
    // Usiamo 'click' invece di 'mousedown' per permettere alle azioni di triggerarsi correttamente
    setTimeout(() => {
        window.addEventListener('click', closeHandler);
        window.addEventListener('contextmenu', closeHandler);
    }, 10);
};

export const showContextMenu = (e, path, isDirectory) => {
    e.preventDefault();
    
    // Define items structure
    const items = [
        { label: 'Nuovo File', icon: 'file_plus', onClick: () => createItem(path, isDirectory, 'file') },
        { label: 'Nuova Cartella', icon: 'folder_plus', onClick: () => createItem(path, isDirectory, 'folder') },
        { label: 'Reveal in File Explorer', icon: 'external_link', onClick: () => revealInExplorer(path) },
        { label: 'Open in Integrated Terminal', icon: 'terminal', onClick: () => openInTerminal(path) },
        { divider: true },
        { 
            label: 'New Java File', 
            icon: 'coffee', 
            submenu: [
                { label: 'Class', onClick: () => createJavaFile(path, isDirectory, 'class') },
                { label: 'Interface', onClick: () => createJavaFile(path, isDirectory, 'interface') },
                { label: 'Enum', onClick: () => createJavaFile(path, isDirectory, 'enum') },
                { label: 'Record', onClick: () => createJavaFile(path, isDirectory, 'record') },
                { label: 'Annotation', onClick: () => createJavaFile(path, isDirectory, 'annotation') },
                { label: 'Abstract Class', onClick: () => createJavaFile(path, isDirectory, 'abstract_class') },
                { divider: true },
                { label: 'New Java Package', onClick: () => createItem(path, isDirectory, 'folder') },
                { label: 'New Java Project', onClick: () => window.gxAlert('Info', 'Java Project Wizard in arrivo...', 'info') }
            ] 
        },
        { 
            label: 'Maven', 
            icon: 'box', 
            submenu: [
                { label: 'New Project', onClick: () => createMavenProject(path, isDirectory) },
                { label: 'New Module', onClick: () => createMavenModule(path, isDirectory) }
            ] 
        },
        { divider: true },
        { label: 'Share', icon: 'share', onClick: () => window.gxToast('Link copiato!', 'info') },
        { divider: true },
        { 
            label: 'Workspace', 
            icon: 'layers', 
            submenu: [
                { label: 'Add folder to workspace...', onClick: () => window.openFolder() },
                { label: 'Open folder settings', onClick: () => window.gxAlert('Settings', 'Configurazione cartella...', 'info') },
                { label: 'Remove Folder from workspace', color: 'text-red-400', onClick: () => removeFolderFromWorkspace(path) }
            ] 
        },
        { divider: true },
        { label: 'Find in folder', icon: 'search', onClick: () => findInFolder(path) },
        { divider: true },
        { label: 'Paste', icon: 'clipboard', onClick: () => window.gxToast('Incolla non ancora supportato', 'info') },
        { label: 'Copy Path', icon: 'copy', onClick: () => navigator.clipboard.writeText(path) },
        { label: 'Copy Relative Path', icon: 'copy', onClick: () => copyRelativePath(path) },
        { divider: true },
        { label: 'Delete', icon: 'trash', color: 'text-red-400 hover:text-white hover:bg-red-500/80', onClick: () => deleteItem(path) },
    ];
    showGenericMenu(e, items);
};

const renderItems = (container, items, isSubmenu = false) => {
    items.forEach(item => {
        if (item.divider) {
            const d = document.createElement('div');
            d.className = 'h-[1px] bg-white/10 my-1.5 mx-3 border-t border-white/5';
            container.appendChild(d);
            return;
        }

        const div = document.createElement('div');
        div.className = `flex items-center px-3 py-1.5 hover:bg-[var(--accent-glow)] cursor-pointer text-gray-300 transition-all rounded-lg mx-1 group relative ${item.color || ''}`;
        
        const iconHtml = getIcon(item.icon);
        div.innerHTML = `
            <span class="mr-2.5 opacity-60 group-hover:opacity-100 w-4 h-4 flex items-center justify-center">${iconHtml}</span>
            <span class="flex-1">${item.label}</span>
            ${item.submenu ? '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" class="opacity-40"><path d="m9 18 6-6-6-6"/></svg>' : ''}
        `;

        if (item.submenu) {
            div.onmouseenter = () => {
                // Remove existing submenus at this level
                const existingSub = div.querySelector('.gx-submenu');
                if (existingSub) return;

                const sub = document.createElement('div');
                sub.className = 'gx-submenu fixed bg-[var(--bg-side)] border gx-border-theme rounded-xl shadow-2xl py-1.5 text-[11px] min-w-[180px] animate-in fade-in slide-in-from-left-1 duration-150 backdrop-blur-2xl pointer-events-auto';
                
                const rect = div.getBoundingClientRect();
                sub.style.left = `${rect.right + 2}px`;
                sub.style.top = `${rect.top - 5}px`;
                
                renderItems(sub, item.submenu, true);
                document.getElementById('modals-root').appendChild(sub);

                const removeSub = () => {
                    sub.remove();
                    div.onmouseleave = null;
                };
                
                // Logic to keep submenu open if mouse is over it
                let timeout;
                div.onmouseleave = () => {
                    timeout = setTimeout(() => sub.remove(), 100);
                };
                sub.onmouseenter = () => clearTimeout(timeout);
                sub.onmouseleave = () => sub.remove();
            };
        } else {
            div.onclick = (ev) => {
                ev.stopPropagation();
                item.onClick();
                // Close all menus
                document.getElementById('gx-context-menu')?.remove();
                document.querySelectorAll('.gx-submenu').forEach(s => s.remove());
            };
        }

        container.appendChild(div);
    });
};

const getIcon = (key) => {
    const icons = {
        file_plus: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/><line x1="12" y1="13" x2="12" y2="19"/><line x1="9" y1="16" x2="15" y2="16"/></svg>',
        folder_plus: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>',
        external_link: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>',
        terminal: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>',
        coffee: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V8z"/><line x1="6" y1="2" x2="6" y2="4"/><line x1="10" y1="2" x2="10" y2="4"/><line x1="14" y1="2" x2="14" y2="4"/></svg>',
        box: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>',
        layers: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>',
        search: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>',
        copy: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
        trash: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
        share: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>',
        clipboard: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg>'
    };
    return icons[key] || '';
};

// ACTIONS
const createItem = async (targetPath, isTargetDirectory, type) => {
    console.log(`[CONTEXT-MENU] Creation context: "${targetPath}", isDir: ${isTargetDirectory}`);
    
    // Calcolo robusto della cartella genitrice
    let parentDir = targetPath;
    
    // Feature (v1.3.9): Se clicchiamo nel vuoto (o su root) ma abbiamo un item selezionato,
    // usiamo la selezione come contesto invece del root nudo.
    const isRootClick = !targetPath || targetPath === state.workspaceData?.path;
    if (isRootClick && state.activeExplorerItem) {
        parentDir = state.activeExplorerItem;
        isTargetDirectory = state.activeExplorerItemIsDir;
        console.log(`[CONTEXT-MENU] Using persistent selection context: ${parentDir}`);
    }

    if (!isTargetDirectory && parentDir) {
        parentDir = parentDir.replace(/[\\/][^\\/]+$/, '');
    }

    // Normalizzazione
    if (parentDir) parentDir = parentDir.replace(/\\/g, '/');

    if (parentDir && parentDir.toLowerCase().endsWith('.code-workspace')) {
        parentDir = parentDir.replace(/\/[^\/]+$/, '');
    }
    
    // Fallback alla root del workspace se ancora vuoto o non valido
    if (!parentDir || parentDir === '.') {
        parentDir = state.workspaceData?.path?.replace(/\\/g, '/');
        if (state.workspaceData?.isWorkspace && state.workspaceData.folders?.length > 0) {
            parentDir = state.workspaceData.folders[0].path?.replace(/\\/g, '/');
        }
        
        if (parentDir && parentDir.toLowerCase().endsWith('.code-workspace')) {
            parentDir = parentDir.replace(/\/[^\/]+$/, '');
        }
    }

    console.log(`[CONTEXT-MENU] Using Parent Directory: "${parentDir}"`);

    const label = type === 'file' ? 'Nome File (es. index.js)' : 'Nome Cartella (es. components)';
    window.gxPrompt('Creazione', label, '', async (name) => {
        if (!name) return;
        
        let res;
        if (type === 'file') {
            res = await window.electronAPI.fsCreateFile(parentDir, name);
        } else {
            // Assicuriamoci che name sia solo il nome della cartella, non un path
            res = await window.electronAPI.fsCreateFolder(parentDir, name);
        }

        if (res && res.error) {
            console.error(`[CONTEXT-MENU] FS Error:`, res.error);
            window.gxAlert('Errore FS', res.error, 'error');
        } else {
            window.gxToast(type === 'file' ? 'File creato' : 'Cartella creata', 'success');
            refreshWorkspace();
        }
    });
};

const createJavaFile = async (targetPath, isTargetDirectory, type) => {
    let parentDir = isTargetDirectory ? targetPath : targetPath.substring(0, Math.max(targetPath.lastIndexOf('\\'), targetPath.lastIndexOf('/')));
    window.gxPrompt('New Java ' + type.charAt(0).toUpperCase() + type.slice(1), 'Class Name', '', async (name) => {
        if (!name) return;
        const fileName = name.endsWith('.java') ? name : name + '.java';
        const fullPath = `${parentDir.replace(/[\\/]$/, '')}/${fileName}`;
        
        let template = '';
        const className = name.replace('.java', '');
        
        switch(type) {
            case 'class': template = `public class ${className} {\n\n}`; break;
            case 'interface': template = `public interface ${className} {\n\n}`; break;
            case 'enum': template = `public enum ${className} {\n\n}`; break;
            case 'record': template = `public record ${className}() {\n\n}`; break;
            case 'annotation': template = `public @interface ${className} {\n\n}`; break;
            case 'abstract_class': template = `public abstract class ${className} {\n\n}`; break;
        }

        const res = await window.electronAPI.fsWriteFile(fullPath, template);
        if (res?.error) window.gxAlert('Errore', res.error, 'error');
        else {
            window.openFileInIDE(fullPath, fileName);
            refreshWorkspace();
        }
    });
};

const createMavenProject = async (path, isDirectory) => {
     window.gxPrompt('New Maven Project', 'Project ArtifactId', 'my-app', async (name) => {
         // Basic POM template
         const pom = `<?xml version="1.0" encoding="UTF-8"?>\n<project xmlns="http://maven.apache.org/POM/4.0.0" ...>\n  <modelVersion>4.0.0</modelVersion>\n  <groupId>com.example</groupId>\n  <artifactId>${name}</artifactId>\n  <version>1.0-SNAPSHOT</version>\n</project>`;
         // logic to create folder and pom...
         window.gxToast('Maven template generato (mock)', 'info');
     });
};

const openInTerminal = (path) => {
    setState({ activeActivity: 'terminal', isTerminalMinimized: false });
    // If the terminal has a way to change directory, we would call it here
    if (window.terminal && window.terminal.sendInput) {
        window.terminal.sendInput(`cd "${path}"\r`);
    } else {
        window.gxToast('Aperto nel terminale (CWD: ' + path + ')', 'info');
    }
};

const findInFolder = (path) => {
    setState({ activeActivity: 'search', isLeftSidebarOpen: true });
    const searchInput = document.getElementById('global-search-input');
    if (searchInput) {
        searchInput.placeholder = `Search in ${path.split(/[\\/]/).pop()}...`;
        searchInput.focus();
    }
};

const copyRelativePath = (path) => {
    const root = state.workspaceData?.path;
    if (root && path.startsWith(root)) {
        const rel = path.replace(root, '').replace(/^[\\/]/, '');
        navigator.clipboard.writeText(rel);
        window.gxToast('Path relativo copiato', 'success');
    } else {
        navigator.clipboard.writeText(path);
    }
};

const removeFolderFromWorkspace = (path) => {
    if (window.gxConfirm) {
        window.gxConfirm("RIMUOVI CARTELLA", "Sei sicuro di voler rimuovere questa cartella dal workspace corrente?", () => {
             const newFiles = state.files.filter(f => f.path !== path);
             setState({ files: newFiles });
             window.gxToast('Cartella rimossa dal workspace', 'info');
        });
    }
};

const deleteItem = async (path) => {
    if (window.gxConfirm) {
        window.gxConfirm(
            "ELIMINA DEFINITIVAMENTE", 
            `Sei sicuro di voler eliminare questo elemento dal disco? L'azione non può essere annullata.\n\nTarget: ${path.split(/[\\/]/).pop()}`,
            async () => {
                const res = await window.electronAPI.fsDelete(path);
                if (res.error) window.gxAlert('Errore FS', res.error, 'error');
                else refreshWorkspace();
            }
        );
    }
};

const revealInExplorer = async (path) => {
    await window.electronAPI.shellOpenPath(path);
};

const refreshWorkspace = async () => {
    const currentPath = state.workspaceData?.path;
    if (currentPath && window.electronAPI?.openSpecificFolder) {
        console.log(`[CONTEXT-MENU] Refreshing workspace: ${currentPath}`);
        const data = await window.electronAPI.openSpecificFolder(currentPath);
        
        if (data && !data.error) {
            // Sincronizziamo sia workspaceData che files per triggerare il re-render dell'explorer
            if (data.isWorkspace) {
                setState({ 
                    workspaceData: data,
                    files: data.folders || [] 
                });
            } else {
                setState({ 
                    workspaceData: data,
                    files: data.files || [] 
                });
            }
        }
    }
    if (window.renderWorkspace) window.renderWorkspace();
};

// ESPOSIZIONE GLOBALE (Bridge tra moduli ES e attributi HTML)
window.showContextMenu = showContextMenu;
window.showGenericMenu = showGenericMenu;
