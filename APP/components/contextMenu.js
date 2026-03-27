// APP/components/contextMenu.js
// Right-click context menu for the file explorer tree
import { state, setState } from '../core/state.js';

// ─── Menu Item Definitions ──────────────────────────────────────────────────
const SEPARATOR = { type: 'separator' };

const buildMenuItems = (targetPath, isDir, workspacePath) => {
    const relPath = workspacePath 
        ? targetPath.replace(workspacePath, '').replace(/^[\/\\]/, '')
        : targetPath;

    return [
        // Group 1
        { id: 'new-file',    label: 'Nuovo File...',                     icon: '📄', shortcut: '' },
        { id: 'new-folder',  label: 'Nuova Cartella...',                 icon: '📁', shortcut: '' },
        { id: 'reveal',      label: 'Reveal in File Explorer',           icon: '🔍', shortcut: 'Shift+Alt+R' },
        { id: 'open-term',   label: 'Apri nel Terminale Integrato',      icon: '⌨️',  shortcut: '' },
        SEPARATOR,
        // Group 2 – Java
        { id: 'java-file',   label: 'Nuovo File Java',                   icon: '☕', shortcut: '', submenu: [
            { id: 'java-class',    label: 'Class...' },
            { id: 'java-iface',    label: 'Interface...' },
            { id: 'java-enum',     label: 'Enum...' },
            { id: 'java-record',   label: 'Record...' },
            { id: 'java-annot',    label: 'Annotation...' },
            { id: 'java-abstract', label: 'Abstract Class...' },
        ]},
        { id: 'java-pkg',    label: 'Nuovo Pacchetto Java...',           icon: '📦', shortcut: '' },
        { id: 'java-proj',   label: 'Nuovo Progetto Java...',            icon: '🏗️',  shortcut: '' },
        { id: 'maven',       label: 'Maven',                             icon: '🔧', shortcut: '', submenu: [
            { id: 'maven-project', label: 'New Project...' },
            { id: 'maven-module',  label: 'New Module...' },
        ]},
        { id: 'share',       label: 'Condividi',                         icon: '🔗', shortcut: '', submenu: [
            { id: 'share-link',    label: 'Copy vscode.dev Link' },
        ]},
        SEPARATOR,
        // Group 3 – Workspace
        { id: 'add-ws',      label: 'Aggiungi la Cartella al Workspace...', icon: '➕', shortcut: '' },
        { id: 'open-set',    label: 'Apri Impostazioni Cartella',        icon: '⚙️',  shortcut: '' },
        { id: 'remove-ws',   label: 'Rimuovi la Cartella dal Workspace', icon: '✖️',  shortcut: '' },
        SEPARATOR,
        // Group 4
        { id: 'find',        label: 'Trova nella Cartella...',           icon: '🔎', shortcut: 'Shift+Alt+F' },
        SEPARATOR,
        { id: 'paste',       label: 'Incolla',                           icon: '📋', shortcut: 'Ctrl+V' },
        SEPARATOR,
        { id: 'copy-path',   label: 'Copia Percorso',                   icon: '📎', shortcut: 'Shift+Alt+C' },
        { id: 'copy-rel',    label: 'Copia Percorso Relativo',          icon: '📎', shortcut: 'Ctrl+K Ctrl+Shift+C' },
        SEPARATOR,
        { id: 'python-proj', label: 'Aggiungi come Progetto Python',     icon: '🐍', shortcut: '' },
    ];
};

// ─── DOM Builder ────────────────────────────────────────────────────────────
const buildMenuEl = (items, _targetPath, isDir, workspacePath) => {
    const ul = document.createElement('ul');
    ul.className = 'gx-ctx-list';

    items.forEach(item => {
        if (item.type === 'separator') {
            const li = document.createElement('li');
            li.className = 'gx-ctx-sep';
            ul.appendChild(li);
            return;
        }

        const li = document.createElement('li');
        li.className = 'gx-ctx-item';
        li.dataset.id = item.id;

        const hasSubmenu = item.submenu && item.submenu.length > 0;

        li.innerHTML = `
            <span class="gx-ctx-icon">${item.icon || ''}</span>
            <span class="gx-ctx-label">${item.label}</span>
            ${item.shortcut ? `<span class="gx-ctx-shortcut">${item.shortcut}</span>` : ''}
            ${hasSubmenu ? `<span class="gx-ctx-arrow">›</span>` : ''}
        `;

        if (hasSubmenu) {
            const sub = document.createElement('ul');
            sub.className = 'gx-ctx-list gx-ctx-submenu';
            item.submenu.forEach(s => {
                const sli = document.createElement('li');
                sli.className = 'gx-ctx-item';
                sli.dataset.id = s.id;
                sli.innerHTML = `<span class="gx-ctx-icon"></span><span class="gx-ctx-label">${s.label}</span>`;
                sub.appendChild(sli);
            });
            li.appendChild(sub);
            li.classList.add('gx-ctx-has-sub');
        }

        ul.appendChild(li);
    });

    return ul;
};

// ─── Inject CSS ──────────────────────────────────────────────────────────────
const injectCSS = () => {
    if (document.getElementById('gx-ctx-style')) return;
    const style = document.createElement('style');
    style.id = 'gx-ctx-style';
    style.textContent = `
        #gx-context-menu {
            position: fixed;
            z-index: 9999;
            background: #1c2128;
            border: 1px solid #30363d;
            border-radius: 6px;
            padding: 4px 0;
            min-width: 230px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.6), 0 2px 8px rgba(0,0,0,0.4);
            font-family: -apple-system, system-ui, sans-serif;
            font-size: 12px;
            animation: gxCtxIn 0.08s ease;
            user-select: none;
        }
        @keyframes gxCtxIn {
            from { opacity: 0; transform: scale(0.97) translateY(-4px); }
            to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        .gx-ctx-list {
            list-style: none;
            margin: 0;
            padding: 0;
        }
        .gx-ctx-item {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 5px 10px 5px 8px;
            cursor: pointer;
            color: #c9d1d9;
            border-radius: 3px;
            margin: 0 4px;
            position: relative;
            white-space: nowrap;
        }
        .gx-ctx-item:hover {
            background: #2188ff;
            color: #fff;
        }
        .gx-ctx-icon {
            width: 16px;
            text-align: center;
            font-size: 11px;
            flex-shrink: 0;
        }
        .gx-ctx-label { flex: 1; }
        .gx-ctx-shortcut {
            color: #6e7681;
            font-size: 10px;
            margin-left: 16px;
        }
        .gx-ctx-item:hover .gx-ctx-shortcut { color: rgba(255,255,255,0.6); }
        .gx-ctx-arrow {
            font-size: 14px;
            opacity: 0.6;
            margin-left: 4px;
        }
        .gx-ctx-sep {
            height: 1px;
            background: #30363d;
            margin: 4px 0;
        }
        /* Submenu */
        .gx-ctx-submenu {
            display: none;
            position: absolute;
            left: calc(100% + 4px);
            top: -4px;
            background: #1c2128;
            border: 1px solid #30363d;
            border-radius: 6px;
            padding: 4px 0;
            min-width: 180px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.6);
            z-index: 10000;
        }
        .gx-ctx-has-sub:hover > .gx-ctx-submenu { display: block; }
        /* Inline input for new file/folder */
        .gx-tree-inline-input {
            background: #0d1117;
            border: 1px solid #2188ff;
            color: #c9d1d9;
            font-size: 11px;
            font-family: monospace;
            padding: 2px 6px;
            border-radius: 3px;
            outline: none;
            width: calc(100% - 28px);
            margin-left: 14px;
        }
    `;
    document.head.appendChild(style);
};

// ─── Main Menu Instance ──────────────────────────────────────────────────────
let menuEl = null;

const closeMenu = () => {
    if (menuEl) { menuEl.remove(); menuEl = null; }
};

const showMenu = (x, y, targetPath, isDir) => {
    closeMenu();
    injectCSS();

    const workspacePath = state.workspaceData?.path || '';
    const items = buildMenuItems(targetPath, isDir, workspacePath);

    menuEl = document.createElement('div');
    menuEl.id = 'gx-context-menu';
    menuEl.appendChild(buildMenuEl(items, targetPath, isDir, workspacePath));

    document.body.appendChild(menuEl);

    // Position: keep inside viewport
    const vw = window.innerWidth, vh = window.innerHeight;
    menuEl.style.left = Math.min(x, vw - 240) + 'px';
    menuEl.style.top  = Math.min(y, vh - menuEl.offsetHeight - 20) + 'px';

    menuEl.addEventListener('click', (e) => handleAction(e, targetPath, isDir, workspacePath));
};

// ─── Action Handler ──────────────────────────────────────────────────────────
const handleAction = async (e, targetPath, isDir, workspacePath) => {
    const item = e.target.closest('.gx-ctx-item');
    if (!item) return;
    const id = item.dataset.id;
    if (!id) return;

    closeMenu();

    // Determine the directory context
    const contextDir = isDir ? targetPath : targetPath.split(/[\/\\]/).slice(0, -1).join('\\') || workspacePath;

    switch (id) {
        case 'new-file':   await cmdNewFile(contextDir);   break;
        case 'new-folder': await cmdNewFolder(contextDir); break;

        case 'reveal':
            if (window.electronAPI?.shellOpenPath) await window.electronAPI.shellOpenPath(contextDir);
            break;

        case 'open-term':
            // Send a cd command to the active terminal
            if (window.gxTerminalSendCd) window.gxTerminalSendCd(contextDir);
            break;

        case 'find':
            // Switch to search pane and pre-populate
            window.setState?.({ activeActivity: 'search', isLeftSidebarOpen: true });
            setTimeout(() => {
                const inp = document.getElementById('global-search-input');
                if (inp) { inp.focus(); inp.value = ''; }
            }, 100);
            break;

        case 'paste':       document.execCommand?.('paste'); break;
        case 'copy-path':   navigator.clipboard.writeText(targetPath); showToast('Percorso copiato!'); break;
        case 'copy-rel': {
            const rel = workspacePath ? targetPath.replace(workspacePath, '').replace(/^[\/\\]/, '') : targetPath;
            navigator.clipboard.writeText(rel);
            showToast('Percorso relativo copiato!');
            break;
        }
        case 'remove-ws':
            window.setState?.({ workspaceData: null, openFiles: [], activeFileId: null });
            localStorage.removeItem('gx-last-workspace');
            break;

        case 'share-link':
            showToast('Funzionalità disponibile nella versione cloud.');
            break;

        // Java / Maven / Python stubs
        case 'java-class':     showToast('Crea nuova Classe Java (coming soon)'); break;
        case 'java-iface':     showToast('Crea nuova Interface Java (coming soon)'); break;
        case 'java-enum':      showToast('Crea nuovo Enum Java (coming soon)'); break;
        case 'java-record':    showToast('Crea nuovo Record Java (coming soon)'); break;
        case 'java-annot':     showToast('Crea nuova Annotation Java (coming soon)'); break;
        case 'java-abstract':  showToast('Crea nuova Abstract Class Java (coming soon)'); break;
        case 'java-pkg':       showToast('Nuovo pacchetto Java (coming soon)'); break;
        case 'java-proj':      showToast('Nuovo progetto Java (coming soon)'); break;
        case 'maven-project':  showToast('Nuovo progetto Maven (coming soon)'); break;
        case 'maven-module':   showToast('Nuovo modulo Maven (coming soon)'); break;
        case 'python-proj':    showToast('Aggiunto come progetto Python (coming soon)'); break;
        case 'add-ws':         showToast('Aggiungi cartella al workspace (coming soon)'); break;
        case 'open-set':       showToast('Impostazioni cartella (coming soon)'); break;

        default: break;
    }
};

// ─── Inline rename/create input ──────────────────────────────────────────────
const cmdNewFile = async (dirPath) => {
    const treeContainer = document.getElementById('workspace-tree-container');
    if (!treeContainer) return;
    showInlineInput(treeContainer, '📄 Nuovo file...', async (name) => {
        if (!name) return;
        const result = await window.electronAPI?.fsCreateFile(dirPath, name);
        if (result?.error) { showToast('Errore: ' + result.error, true); return; }
        await refreshWorkspace(dirPath);
    });
};

const cmdNewFolder = async (dirPath) => {
    const treeContainer = document.getElementById('workspace-tree-container');
    if (!treeContainer) return;
    showInlineInput(treeContainer, '📁 Nuova cartella...', async (name) => {
        if (!name) return;
        const result = await window.electronAPI?.fsCreateFolder(dirPath, name);
        if (result?.error) { showToast('Errore: ' + result.error, true); return; }
        await refreshWorkspace(dirPath);
    });
};

const showInlineInput = (container, placeholder, onConfirm) => {
    const existing = container.querySelector('.gx-tree-inline-input');
    if (existing) existing.remove();

    const input = document.createElement('input');
    input.className = 'gx-tree-inline-input';
    input.placeholder = placeholder;
    container.prepend(input);
    input.focus();

    const confirm = () => { const v = input.value.trim(); input.remove(); onConfirm(v); };
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') confirm();
        if (e.key === 'Escape') input.remove();
    });
    input.addEventListener('blur', () => setTimeout(() => { if (document.body.contains(input)) input.remove(); }, 150));
};

const refreshWorkspace = async (dirPath) => {
    if (!window.electronAPI?.openSpecificFolder || !state.workspaceData) return;
    const data = await window.electronAPI.openSpecificFolder(state.workspaceData.path);
    if (data && !data.error) window.setState?.({ workspaceData: data });
};

// ─── Toast Notification ───────────────────────────────────────────────────────
const showToast = (msg, isError = false) => {
    const t = document.createElement('div');
    t.textContent = msg;
    t.style.cssText = `position:fixed;bottom:70px;left:50%;transform:translateX(-50%);
        background:${isError ? '#b00020' : '#161b22'};color:#c9d1d9;
        border:1px solid ${isError ? '#f00' : '#30363d'};border-radius:6px;
        padding:8px 16px;font-size:11px;z-index:99999;
        box-shadow:0 4px 16px rgba(0,0,0,0.5);animation:gxCtxIn .15s ease;`;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2500);
};

// ─── Export / Init ────────────────────────────────────────────────────────────
export const initContextMenu = () => {
    injectCSS();

    const attach = () => {
        const treeContainer = document.getElementById('workspace-tree-container');
        if (!treeContainer || treeContainer._ctxBound) return;
        treeContainer._ctxBound = true;

        treeContainer.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const item = e.target.closest('[data-path]');
            if (item) {
                const p = item.getAttribute('data-path').replace(/\//g, '\\');
                const isDir = item.classList.contains('is-folder');
                showMenu(e.clientX, e.clientY, p, isDir);
            } else {
                // Empty area → root workspace
                const rootPath = state.workspaceData?.path;
                if (rootPath) showMenu(e.clientX, e.clientY, rootPath, true);
            }
        });
    };

    // Try immediately, then observe for DOM readiness
    attach();
    const obs = new MutationObserver(() => attach());
    obs.observe(document.getElementById('left-sidebar') || document.body, { childList: true, subtree: true });

    // Global close on outside click or Escape
    document.addEventListener('click', (e) => {
        if (menuEl && !menuEl.contains(e.target)) closeMenu();
    }, true);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeMenu();
    });
};
