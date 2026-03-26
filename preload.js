const { contextBridge, ipcRenderer } = require('electron');

// Esponiamo in modo sicuro le API usando il ContextBridge
contextBridge.exposeInMainWorld('electronAPI', {
  // Funzione handle per trasmettere il comando
  executeCommand: (cmd) => ipcRenderer.invoke('execute-command', cmd),
  // Apertura VERO sistema operativo cartelle
  openFolder: () => ipcRenderer.invoke('open-project-folder'),
  openSpecificFolder: (folderPath) => ipcRenderer.invoke('open-specific-folder', folderPath),
  // Lettura contenuto file per il Workspace
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  // Phase 2: Git Native
  gitStatus: () => ipcRenderer.invoke('git-status'),
  gitStage: (filePath) => ipcRenderer.invoke('git-stage', filePath),
  gitCommit: (message) => ipcRenderer.invoke('git-commit', message),
  gitPull: () => ipcRenderer.invoke('git-pull'),
  gitPush: () => ipcRenderer.invoke('git-push'),
  // Phase 3: Terminal PTY
  terminalCreate: (id, shellType) => ipcRenderer.invoke('terminal-create', id, shellType),
  terminalWrite: (id, data) => ipcRenderer.invoke('terminal-write', id, data),
  terminalResize: (id, cols, rows) => ipcRenderer.invoke('terminal-resize', id, cols, rows),
  onTerminalData: (id, callback) => ipcRenderer.on(`terminal-stdout-${id}`, (event, data) => callback(data)),
  
  // Phase 4: IDE Features
  searchFiles: (folderPath, query) => ipcRenderer.invoke('search-files', folderPath, query),
  scanTests: (folderPath) => ipcRenderer.invoke('scan-tests', folderPath),
  runTest: (workspacePath, filePath, testName) => ipcRenderer.invoke('run-test', workspacePath, filePath, testName),
  debugTest: (workspacePath, filePath, testName) => ipcRenderer.invoke('debug-test', workspacePath, filePath, testName),
  runAllTests: (workspacePath) => ipcRenderer.invoke('run-all-tests', workspacePath),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  performUpdate: () => ipcRenderer.invoke('perform-update')
});
