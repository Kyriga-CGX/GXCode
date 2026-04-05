const fs = require('fs');
const path = require('path');

let activeWatchers = new Map();
let mainWindow = null;

function setMainWindow(win) {
    mainWindow = win;
}

function setupWatcher(rootPath) {
  if (!rootPath) return;
  if (!mainWindow) {
    setTimeout(() => setupWatcher(rootPath), 1000);
    return;
  }

  const actualPath = rootPath.endsWith('.code-workspace') ? path.dirname(rootPath) : rootPath;
  
  if (activeWatchers.has(actualPath)) return;

  let debounceTimer = null;
  try {
    const watcher = fs.watch(actualPath, { recursive: true }, (eventType, filename) => {
      // Filtraggio aggressivo immediato per rumore noto
      if (filename && (
        filename.includes('node_modules') || 
        filename.includes('.git') ||
        filename.includes('.claudecode') ||
        filename.includes('.gxcode') ||
        filename.includes('dist') ||
        filename.includes('build') ||
        filename.includes('.next') ||
        filename.includes('target')
      )) return;

      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            const absoluteChangedPath = filename ? path.join(actualPath, filename).replace(/\\/g, '/') : actualPath;
            console.log(`[GX-WATCH] Workspace updated: ${absoluteChangedPath}`);
            mainWindow.webContents.send('workspace-updated', { root: actualPath, changedPath: absoluteChangedPath });
        }
      }, 800);
    });

    activeWatchers.set(actualPath, watcher);

    watcher.on('error', (err) => {
      console.error(`[GX-WATCH] Errore watcher per ${actualPath}:`, err);
      activeWatchers.delete(actualPath);
    });

  } catch (err) { }
}

function clearAllWatchers() {
  activeWatchers.forEach((watcher) => {
    try { watcher.close(); } catch(e) {}
  });
  activeWatchers.clear();
}

module.exports = { setupWatcher, clearAllWatchers, setMainWindow };
