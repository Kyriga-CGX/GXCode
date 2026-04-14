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
  debugTest: (workspacePath, filePath, testName, breakpoints) => ipcRenderer.invoke('debug-test', workspacePath, filePath, testName, breakpoints),
  runAllTests: (workspacePath) => ipcRenderer.invoke('run-all-tests', workspacePath),
  installPlaywright: (workspacePath) => ipcRenderer.invoke('install-playwright', workspacePath),
  getDebugPort: () => ipcRenderer.invoke('get-debug-port'),
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
  debugStart: (filePath, breakpoints) => ipcRenderer.invoke('debug-start', filePath, breakpoints),
  debugStop: () => ipcRenderer.invoke('debug-stop'),
  debugStep: () => ipcRenderer.invoke('debug-step'),
  debugContinue: () => ipcRenderer.invoke('debug-continue'),
  onDebugPaused: (callback) => ipcRenderer.on('debug:paused', (event, data) => callback(data)),
  onDebugVariables: (callback) => ipcRenderer.on('debug:variables', (event, data) => callback(data)),
  onDebugResumed: (callback) => ipcRenderer.on('debug:resumed', () => callback()),
  onDebugFinished: (callback) => ipcRenderer.on('debug-finished', () => callback()),

  // Phase 6: Problems & Analysis
  lintFile: (filePath) => ipcRenderer.invoke('file-lint', filePath),

  // Phase 7: System & Ports
  getActivePorts: () => ipcRenderer.invoke('get-active-ports'),
  killProcess: (pid) => ipcRenderer.invoke('kill-process'),

  // File System / Shell (Context Menu)
  shellOpenPath: (targetPath) => ipcRenderer.invoke('shell-open-path', targetPath),
  openAiMetadata: (workspacePath, fileName) => ipcRenderer.invoke('open-ai-metadata', workspacePath, fileName),
  shellOpenExternal: (url) => ipcRenderer.invoke('shell-open-external', url),
  openGxCodeFolder: () => ipcRenderer.invoke('open-gxcode-folder'),
  clipboardRead: () => ipcRenderer.invoke('clipboard-read'),
  clipboardWrite: (text) => ipcRenderer.invoke('clipboard-write', text),
  fsCreateFile: (dirPath, name) => ipcRenderer.invoke('fs-create-file', dirPath, name),
  fsCreateFolder: (dirPath, name) => ipcRenderer.invoke('fs-create-folder-v2', dirPath, name),
  fsWriteFile: (filePath, content, options) => ipcRenderer.invoke('fs-write-file', filePath, content, options),
  fsDelete: (targetPath) => ipcRenderer.invoke('fs-delete', targetPath),
  fsRename: (oldPath, newPath) => ipcRenderer.invoke('fs-rename', oldPath, newPath),
  fsReadDir: (dirPath) => ipcRenderer.invoke('fs-read-dir', dirPath), // Lista file/cartelle
  getAiPaths: () => ipcRenderer.invoke('get-ai-paths'),
  getGitRemote: (workspacePath) => ipcRenderer.invoke('git-remote-url', workspacePath),

  // Gemini OAuth & Session
  geminiLogin: () => ipcRenderer.invoke('gemini:login'),
  saveGeminiSession: (data) => ipcRenderer.invoke('save-gemini-session', data),
  onGeminiAuthSuccess: (callback) => ipcRenderer.on('gemini:auth-success', (event, data) => callback(data)),
  
  // Test Runner Output
  onTestOutput: (callback) => ipcRenderer.on('test-output', (event, data) => callback(data)),
  onTestDebugPaused: (callback) => ipcRenderer.on('test-debug-paused', (event, line) => callback(line)),
  
  // Real-time File System Watcher
  onWorkspaceUpdated: (callback) => ipcRenderer.on('workspace-updated', (event, data) => callback(data)),

  // AI Companion Local
  aiCompanionGetStats: () => ipcRenderer.invoke('ai-companion:get-stats'),
  aiCompanionCheckStatus: () => ipcRenderer.invoke('ai-companion:check-status'),
  aiCompanionInstall: () => ipcRenderer.invoke('ai-companion:install'),
  aiCompanionPullModel: (modelName) => ipcRenderer.invoke('ai-companion:pull-model', modelName),
  onAiCompanionPullProgress: (callback) => ipcRenderer.on('ai-companion:pull-progress', (event, data) => callback(data)),
  aiCompanionSelectFolder: (title) => ipcRenderer.invoke('ai-companion:select-folder', title),
  onAiCompanionInstallProgress: (callback) => ipcRenderer.on('ai-companion:install-progress', (event, data) => callback(data)),
  aiCompanionStart: (paths) => ipcRenderer.invoke('ai-companion:start', paths),
  aiCompanionStop: () => ipcRenderer.invoke('ai-companion:stop'),
  aiCompanionGetDefaultInstallPath: () => ipcRenderer.invoke('ai-companion:get-default-install-path'),
  aiCompanionGetDefaultModelsPath: () => ipcRenderer.invoke('ai-companion:get-default-models-path'),
  aiCompanionIsRunning: () => ipcRenderer.invoke('ai-companion:is-running'),
  aiCompanionIsModelInstalled: (modelName) => ipcRenderer.invoke('ai-companion:is-model-installed', modelName),

  // AI Reactivity Engine
  aiReactivityAnalyze: (payload) => ipcRenderer.invoke('ai-reactivity:analyze', payload),
  aiReactivityAbort: () => ipcRenderer.invoke('ai-reactivity:abort'),
  aiReactivityClearQueue: () => ipcRenderer.invoke('ai-reactivity:clear-queue'),
  aiReactivityUpdateConfig: (config) => ipcRenderer.invoke('ai-reactivity:update-config', config),
  aiReactivityGetStatus: () => ipcRenderer.invoke('ai-reactivity:get-status'),
  aiReactivityManualAnalysis: (payload) => ipcRenderer.invoke('ai-reactivity:manual-analysis', payload),
  aiReactivityIsReady: () => ipcRenderer.invoke('ai-reactivity:is-ready'),
  onAiAnalysisStream: (callback) => ipcRenderer.on('ai-analysis-stream', (event, data) => callback(data)),
  onAiAnalysisComplete: (callback) => ipcRenderer.on('ai-analysis-complete', (event, data) => callback(data)),

  // Auto-Correction Service
  autoCorrectionSetEnabled: (enabled) => ipcRenderer.invoke('auto-correction:set-enabled', enabled),
  autoCorrectionGetStatus: () => ipcRenderer.invoke('auto-correction:get-status'),
  autoCorrectionGetStats: (filePath) => ipcRenderer.invoke('auto-correction:get-stats', filePath),
  autoCorrectionClearHistory: (filePath) => ipcRenderer.invoke('auto-correction:clear-history', filePath),
  onFileAutoCorrected: (callback) => ipcRenderer.on('file-auto-corrected', (event, data) => callback(data)),
  onFileSaveError: (callback) => ipcRenderer.on('file-save-error', (event, data) => callback(data)),
  onAiAnalysisError: (callback) => ipcRenderer.on('ai-analysis-error', (event, data) => callback(data)),
});
