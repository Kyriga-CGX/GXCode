const { contextBridge, ipcRenderer } = require('electron');

// Esponiamo in modo sicuro le API usando il ContextBridge
contextBridge.exposeInMainWorld('electronAPI', {
  // Funzione handle per trasmettere il comando
  executeCommand: (cmd) => ipcRenderer.invoke('execute-command', cmd),

  getVersion: () => ipcRenderer.invoke('get-app-version'),
  // Apertura VERO sistema operativo cartelle
  openFolder: () => ipcRenderer.invoke('open-project-folder'),
  openFile: () => ipcRenderer.invoke('open-project-file'),
  openWorkspace: () => ipcRenderer.invoke('open-project-workspace'),
  openSpecificFolder: (folderPath) => ipcRenderer.invoke('open-specific-folder', folderPath),
  // Lettura contenuto file per il Workspace
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  // Phase 2: Git Native
  gitStatus: (workspacePath) => ipcRenderer.invoke('git-status', workspacePath),
  gitStage: (workspacePath, filePath) => ipcRenderer.invoke('git-stage', workspacePath, filePath),
  gitCommit: (workspacePath, message) => ipcRenderer.invoke('git-commit', workspacePath, message),
  gitPull: (workspacePath) => ipcRenderer.invoke('git-pull', workspacePath),
  gitPush: (workspacePath) => ipcRenderer.invoke('git-push', workspacePath),
  gitDiff: (workspacePath, filePath) => ipcRenderer.invoke('git-diff', workspacePath, filePath),
  gitShowHead: (workspacePath, filePath) => ipcRenderer.invoke('git-show-head', workspacePath, filePath),
  // Phase 3: Terminal PTY
  terminalCreate: (id, shellType, workspacePath) => ipcRenderer.invoke('terminal-create', id, shellType, workspacePath),
  terminalWrite: (id, data) => ipcRenderer.invoke('terminal-write', id, data),
  terminalResize: (id, cols, rows) => ipcRenderer.invoke('terminal-resize', id, cols, rows),
  onTerminalData: (id, callback) => ipcRenderer.on(`terminal-stdout-${id}`, (event, data) => callback(data)),
  
  // Phase 4: IDE Features
  searchFiles: (folderPath, query, options) => ipcRenderer.invoke('search-files', folderPath, query, options),
  scanTests: (folderPath) => ipcRenderer.invoke('scan-tests', folderPath),
  checkPlaywright: (workspacePath) => ipcRenderer.invoke('check-playwright', workspacePath),
  runTest: (workspacePath, filePath, testName) => ipcRenderer.invoke('run-test', workspacePath, filePath, testName),
  debugTest: (workspacePath, filePath, testName) => ipcRenderer.invoke('debug-test', workspacePath, filePath, testName),
  runAllTests: (workspacePath) => ipcRenderer.invoke('run-all-tests', workspacePath),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  performUpdate: () => ipcRenderer.invoke('perform-update'),
  
  // Gestione Finestra Personalizzata (invoke per garantire ricezione)
  windowControl: (action) => ipcRenderer.invoke('window-control', action),
  openDevTools: () => ipcRenderer.send('open-devtools'),
  onWindowMaximized: (cb) => ipcRenderer.on('window-maximized', cb),
  onWindowUnmaximized: (cb) => ipcRenderer.on('window-unmaximized', cb),
  onUpdateReady: (callback) => ipcRenderer.on('update-ready-to-install', () => callback()),
  onUpdateAvailable: (callback) => ipcRenderer.on('update-available', () => callback()),
  onDownloadProgress: (callback) => ipcRenderer.on('download-progress', (event, progress) => callback(progress)),
  quitAndInstall: () => ipcRenderer.send('quit-and-install'),
  
  // Phase 5: Debugging
  debugStart: (filePath, breakpoints) => ipcRenderer.invoke('debug:start', filePath, breakpoints),
  debugStop: () => ipcRenderer.invoke('debug:stop'),
  debugStep: () => ipcRenderer.invoke('debug:step'),
  debugContinue: () => ipcRenderer.invoke('debug:continue'),
  onDebugPaused: (callback) => ipcRenderer.on('debug:paused', (event, data) => callback(data)),
  onDebugVariables: (callback) => ipcRenderer.on('debug:variables', (event, data) => callback(data)),
  onDebugResumed: (callback) => ipcRenderer.on('debug:resumed', () => callback()),

  // Phase 6: Problems & Analysis
  lintFile: (filePath) => ipcRenderer.invoke('file-lint', filePath),

  // Phase 7: System & Ports
  getActivePorts: () => ipcRenderer.invoke('get-active-ports'),
  killProcess: (pid) => ipcRenderer.invoke('kill-process'),

  // File System / Shell (Context Menu)
  shellOpenPath: (targetPath) => ipcRenderer.invoke('shell-open-path', targetPath),
  shellOpenExternal: (url) => ipcRenderer.invoke('shell-open-external', url),
  openGxCodeFolder: () => ipcRenderer.invoke('open-gxcode-folder'),
  clipboardRead: () => ipcRenderer.invoke('clipboard-read'),
  clipboardWrite: (text) => ipcRenderer.invoke('clipboard-write', text),
  fsCreateFile: (dirPath, name) => ipcRenderer.invoke('fs-create-file', dirPath, name),
  fsCreateFolder: (dirPath, name) => ipcRenderer.invoke('fs-create-folder-v2', dirPath, name),
  fsWriteFile: (filePath, content) => ipcRenderer.invoke('fs-write-file', filePath, content),
  fsDelete: (targetPath) => ipcRenderer.invoke('fs-delete', targetPath),
  fsRename: (oldPath, newPath) => ipcRenderer.invoke('fs-rename', oldPath, newPath),
  getAiPaths: () => ipcRenderer.invoke('get-ai-paths'),
  getGitRemote: (workspacePath) => ipcRenderer.invoke('git-remote-url', workspacePath),

  // Gemini OAuth
  geminiLogin: () => ipcRenderer.invoke('gemini:login'),
  onGeminiAuthSuccess: (callback) => ipcRenderer.on('gemini:auth-success', (event, data) => callback(data)),
  
  // Test Runner Output
  onTestOutput: (callback) => ipcRenderer.on('test-output', (event, data) => callback(data)),
});
