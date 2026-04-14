// APP/core/state.js
// Un micro-Gestore di Stato Globale (PubSub) che sostituisce le librerie pesanti come Redux o React!

export const state = {
    agents: [],
    skills: [],
    marketplaceAgents: [],
    marketplaceSkills: [],
    plugins: [],

    // settings.js handles skin persistence, but let's centralize other things here
    language: localStorage.getItem('gx-language') || 'it',
    mcpServers: JSON.parse(localStorage.getItem('gx-mcp-servers') || '[]'),
    youtrackConfig: (() => {
        const defaults = { url: '', token: '', enabled: false, query: '', filterProjects: [], ytProjects: [], myUsername: '' };
        const saved = JSON.parse(localStorage.getItem('gx-youtrack-config') || '{}');
        return { ...defaults, ...saved };
    })(),
    geminiApiKey: localStorage.getItem('gx-gemini-api-key') || '',
    anthropicApiKey: localStorage.getItem('gx-anthropic-api-key') || '',
    repositories: JSON.parse(localStorage.getItem('gx-repositories') || '[{"id":"gx-official", "name":"GX Official Repo", "url":"https://api.gxcode.io/v1", "type":"all", "enabled":true}]'),
    marketplaceSources: {
        openvsx: true,
        skillssh: true,
        agentshub: true
    },

    // Shortcuts (Dinamiche e Persistenti)
    shortcuts: (() => {
        const defaults = {
            'Ctrl+S': { action: 'editor:save', label: 'Salva File Attivo' },
            'Ctrl+P': { action: 'search:quick-open', label: 'Ricerca Globale Rapida' },
            'Ctrl+B': { action: 'sidebar:toggle', label: 'Mostra/Nascondi Sidebar' },
            'Alt+F': { action: 'editor:format', label: 'Formatta Documento' },
            'F5': { action: 'debug:continue', label: 'Debug: Prossimo Breakpoint' },
            'F8': { action: 'debug:continue-ignore', label: 'Debug: Ignora Breakpoint' },
            'F10': { action: 'debug:step-over', label: 'Debug: Prossima Azione' },
            'Shift+F5': { action: 'debug:stop', label: 'Debug: Ferma Tutto' }
        };
        const saved = JSON.parse(localStorage.getItem('gx-shortcuts') || '{}');
        return { ...defaults, ...saved }; // Merge (defaults priority if missing)
    })(),

    // UI State (Persistiti su localStorage)
    activeRightTab: localStorage.getItem('gx-active-right-tab') || 'agents',
    activeActivity: localStorage.getItem('gx-active-activity') || 'explorer',
    isMarketplaceOpen: false,
    activeMarketplaceTab: 'agents',
    isSettingsOpen: false,
    isSettingsMobileMenuOpen: false,
    isAddingRepo: false,
    activeSettingsTab: 'preferences',
    activeLeftTab: localStorage.getItem('gx-active-left-tab') || 'explorer',
    isLeftSidebarOpen: localStorage.getItem('gx-is-left-open') === 'true',
    isRightSidebarOpen: localStorage.getItem('gx-is-right-open') !== 'false', // Default true
    isTerminalMinimized: localStorage.getItem('gx-is-terminal-minimized') === 'true',
    
    // Panel Dimensions (Persistite)
    leftSidebarWidth: parseInt(localStorage.getItem('gx-left-sidebar-width') || '260'),
    rightSidebarWidth: parseInt(localStorage.getItem('gx-right-sidebar-width') || '320'),
    bottomPanelHeight: parseInt(localStorage.getItem('gx-bottom-panel-height') || '300'),
    
    issues: [],
    activeIssueId: null,
    activeWorkingIssueId: null,
    activeAgentId: localStorage.getItem('gx-active-agent-id'),
    workspaceData: JSON.parse(localStorage.getItem('gx-workspace-data') || 'null'),
    files: JSON.parse(localStorage.getItem('gx-workspace-files') || '[]'),
    openFiles: JSON.parse(localStorage.getItem('gx-open-files') || '[]'),
    activeFileId: localStorage.getItem('gx-active-file-id'),
    problems: [],
    breakpoints: [],
    expandedFolders: [],
    isDebugModeActive: false,
    isSplitMode: false,
    activeFileIdRight: null,
    debugCallStack: [],
    debugVariables: [],
    debugActiveLine: null,
    gitStatus: {}, // Map of path -> status (M, A, D, U)
    customAiConfig: JSON.parse(localStorage.getItem('gx-custom-ai-config') || '{"apiKey":"","endpoint":"http://localhost:11434/v1","models":[],"activeModel":"","isSetup":false}'),
    
    // New Module Configurations
    terminalConfig: JSON.parse(localStorage.getItem('gx-terminal-config') || '{"fontSize":14,"fontFamily":"Cascadia Code","cursorBlink":true,"scrollback":5000}'),
    aiReactivityConfig: JSON.parse(localStorage.getItem('gx-ai-reactivity-config') || '{"enabled":true,"model":"qwen2.5-coder:7b","timeout":180000,"maxContextTokens":6000,"idleTimeout":2500,"enableStreaming":true,"enableSmartContext":true}'),
    testingConfig: JSON.parse(localStorage.getItem('gx-testing-config') || '{"defaultFramework":"playwright","autoDetect":true,"runOnSave":false,"showTestPanel":true}'),
    debuggerConfig: JSON.parse(localStorage.getItem('gx-debugger-config') || '{"enableSourceMaps":true,"autoDetectLaunchConfigs":true,"showWatchPanel":true,"showCallStackPanel":true}'),
    gitConfig: JSON.parse(localStorage.getItem('gx-git-config') || '{"autoFetchStatus":true,"fetchInterval":60000,"showGitGraph":true,"enableStash":true}'),
    extensionsConfig: JSON.parse(localStorage.getItem('gx-extensions-config') || '{"autoActivate":true,"extensionsDir":"~/.gxcode/extensions","showMarketplace":true}'),
    lspConfig: JSON.parse(localStorage.getItem('gx-lsp-config') || '{"enabled":true,"autoStart":true,"languages":["typescript","javascript","python","html","css","json","markdown"]}'),
    // Configurazione Gemini con merge dei default (Evita crash per schema-mismatch)
    geminiConfig: (() => {
        const defaults = {
            isAuthenticated: false,
            apiKey: "",
            activeModel: "gemini-1.5-pro",
            models: ["gemini-2.0-flash", "gemini-1.5-pro", "gemini-1.5-flash"],
            user: null,
            mode: "fast",
            multiModelStrategyEnabled: true,
            tiers: {
                fast: "gemini-1.5-flash",
                balanced: "gemini-1.5-pro",
                elite: "gemini-1.5-pro"
            },
            messages: []
        };
        const saved = JSON.parse(localStorage.getItem('gx-gemini-config') || '{}');
        return { ...defaults, ...saved };
    })(),

    ollamaConfig: (() => {
        const defaults = {
            endpoint: "http://localhost:11434",
            activeModel: "",
            models: [],
            messages: [],
            sessions: [], // Array of {id, name, messages, timestamp}
            activeSessionId: null,
            apiKey: "",
            isSetup: false
        };
        const saved = JSON.parse(localStorage.getItem('gx-ollama-config') || '{}');
        return { ...defaults, ...saved };
    })(),

    claudeCliConfig: (() => {
        const defaults = {
            command: "npx @anthropic-ai/claude-code",
            lastSession: null,
            env: {}
        };
        const saved = JSON.parse(localStorage.getItem('gx-claude-cli-config') || '{}');
        return { ...defaults, ...saved };
    })(),

    qwenCliConfig: (() => {
        const defaults = {
            command: "npx @qwen-code/qwen-code",
            lastSession: null,
            env: {}
        };
        const saved = JSON.parse(localStorage.getItem('gx-qwen-cli-config') || '{}');
        return { ...defaults, ...saved };
    })(),

    _geminiLoading: false,
    _ollamaLoading: false,
    _ollamaStreaming: false,
    _geminiAuthenticating: false,
    _geminiAuthError: null,
    _geminiNeedsKey: false,
    appVersion: "...",
    
    // Testing & Playwright State
    testFilesCache: [],
    isPlaywrightInstalled: true,
    isTestingInProgress: false,
    testTarget: null, // 'run' o 'debug'
    selectedTestProject: localStorage.getItem('gx-selected-test-project') || 'all',
    
    // Multi-Project Terminal Support (v1.3.8)
    activeTerminalFolder: localStorage.getItem('gx-active-terminal-folder') || '',

    // Context & AI (v1.4.5)
    projectGuidelines: localStorage.getItem('gx-project-guidelines') || '',

    // Vision 2026 Theme State
    activeCgxTheme: localStorage.getItem('gx-active-skin') || 'dark',

    // Skill Filter State
    activeSkillCategory: localStorage.getItem('gx-active-skill-category') || 'all',

    // Explorer Selection State (v1.3.8)
    activeExplorerItem: null,
    activeExplorerItemIsDir: false,

    // Tomcat Backend Setup Assistant (v1.4.6)
    detectedModules: [],
    activeModuleId: localStorage.getItem('gx-active-module-id') || null,

    // AI Companion State (Evolution 2026)
    aiCompanion: (() => {
        const VALID_MODELS = ['qwen2.5-coder:1.5b', 'qwen2.5-coder:7b', 'qwen2.5-coder:14b', 'qwen2.5-coder:32b'];
        let savedModel = localStorage.getItem('gx-ai-companion-model') || 'qwen2.5-coder:7b';

        // Migrazione: se il modello salvato non esiste su Ollama, usa il default
        if (!VALID_MODELS.includes(savedModel)) {
            console.warn(`[GX-STATE] Invalid model "${savedModel}" in localStorage, migrating to default "qwen2.5-coder:7b"`);
            savedModel = 'qwen2.5-coder:7b';
            localStorage.setItem('gx-ai-companion-model', savedModel);
        }

        const defaults = {
            installed: false, // Ollama è installato nel sistema?
            modelDownloaded: false, // Il modello selezionato è scaricato?
            enabled: localStorage.getItem('gx-ai-companion-enabled') === 'true',
            status: 'unconfigured', // unconfigured, checking, ready, downloading, on, off, helping
            stats: { cpu: '', totalRam: 0, freeRam: 0, gpu: '', disk: '', suitability: null },
            // DEFAULT: qwen2.5-coder:7b è il miglior bilanciamento qualità/performance.
            // Richiede ~5GB RAM. Perfetto per PC con 16GB+ RAM.
            model: savedModel,
            installPath: localStorage.getItem('gx-ai-companion-install-path') || '',
            modelsPath: localStorage.getItem('gx-ai-companion-models-path') || '',
            isIlluminated: false,
            lastActivity: Date.now()
        };
        const saved = JSON.parse(localStorage.getItem('gx-ai-companion-state') || '{}');
        return { ...defaults, ...saved };
    })(),

    // LSP (Language Server Protocol) State
    lspConfig: (() => {
        const defaults = {
            enabled: true,
            autoStart: true,
            servers: {}, // Map<language, serverStatus>
            activeServers: [],
            enableDiagnostics: true,
            enableCompletion: true,
            enableHover: true,
            enableSignatureHelp: true,
            enableDefinition: true,
            enableReferences: true,
            enableRename: true,
            enableCodeActions: true,
            enableFormatting: true,
            logLevel: 'info'
        };
        const saved = JSON.parse(localStorage.getItem('gx-lsp-config') || '{}');
        return { ...defaults, ...saved };
    })(),

    // Testing Framework State
    testingConfig: (() => {
        const defaults = {
            enabled: true,
            defaultFramework: 'auto', // 'auto', 'playwright', 'jest', 'vitest', 'mocha'
            autoDiscoverTests: true,
            runOnSave: false,
            showCoverage: true,
            coverageThreshold: 80,
            parallelExecution: false,
            watchMode: false,
            reporters: ['default'], // 'default', 'json', 'html', 'junit'
            testExplorer: {
                expanded: true,
                showPassed: true,
                showSkipped: true,
                autoScroll: false
            }
        };
        const saved = JSON.parse(localStorage.getItem('gx-testing-config') || '{}');
        return { ...defaults, ...saved };
    })(),

    // Git Advanced State
    gitAdvancedConfig: (() => {
        const defaults = {
            diffViewer: {
                viewMode: 'split', // 'split' or 'inline'
                showLineNumbers: true,
                highlightWords: false,
                ignoreWhitespace: false
            },
            conflictResolver: {
                autoDetect: true,
                showOnOpen: true,
                defaultStrategy: 'manual' // 'manual', 'current', 'incoming'
            },
            stashManager: {
                showUntracked: false,
                autoPop: false,
                confirmDrop: true
            },
            graphView: {
                commitsPerPage: 50,
                showAuthor: true,
                showDate: true,
                colorizeBranches: true,
                infiniteScroll: true
            }
        };
        const saved = JSON.parse(localStorage.getItem('gx-git-advanced-config') || '{}');
        return { ...defaults, ...saved };
    })(),

    // Terminal Advanced State
    terminalConfig: (() => {
        const defaults = {
            defaultShell: '', // Will be auto-detected by main process
            fontSize: 14,
            fontFamily: "'Cascadia Code', 'Fira Code', 'Consolas', monospace",
            cursorBlink: true,
            cursorStyle: 'block', // 'block', 'line', 'underline'
            scrollback: 5000,
            splitLayout: 'single', // 'single', 'split-h', 'split-v'
            splitSize: 0.5,
            autoDetectCwd: true,
            showTabs: true,
            confirmClose: true,
            persistentSessions: false,
            // Task runner
            tasks: {
                autoDiscover: true,
                showOnStart: false,
                defaultTask: null,
                problemMatchers: true
            },
            // Output channels
            output: {
                visible: false,
                autoScroll: true,
                maxLines: 10000,
                showTimestamps: true,
                showSource: true,
                filterLevel: 'all' // 'all', 'info', 'warn', 'error'
            }
        };
        const saved = JSON.parse(localStorage.getItem('gx-terminal-config') || '{}');
        return { ...defaults, ...saved };
    })(),

    // Browser Debug State
    browserDebugConfig: (() => {
        const defaults = {
            browserPath: '', // Auto-detect if empty
            userDataDir: '', // Auto-generated if empty
            debugPort: 9222,
            defaultUrl: 'about:blank',
            headless: false,
            autoLaunch: false,
            // Source maps
            sourceMaps: {
                enabled: true,
                autoLoad: true,
                loadSourceContent: true,
                maxCacheSize: 100
            },
            // Console
            console: {
                visible: true,
                preserveLog: false,
                showTimestamps: true,
                filterLevel: 'all'
            },
            // Network
            network: {
                visible: false,
                recordRequests: true,
                showWaterfall: true,
                filterTypes: ['xhr', 'fetch', 'doc', 'js', 'css', 'img', 'media', 'font', 'ws', 'manifest', 'other']
            },
            // Elements
            elements: {
                visible: true,
                autoRefresh: false,
                showDOMProperties: true,
                showComputedStyles: true
            }
        };
        const saved = JSON.parse(localStorage.getItem('gx-browser-debug-config') || '{}');
        return { ...defaults, ...saved };
    })()
};

console.log("[GX-STATE] Global State initialized from Storage.");
if (state.workspaceData) console.log(`[GX-STATE] Workspace found: ${state.workspaceData.path}`);
if (state.openFiles.length > 0) console.log(`[GX-STATE] Open files: ${state.openFiles.length}`);


const listeners = new Set();

export const subscribe = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};

export const setState = (newState) => {
    // Verifichiamo se c'è un cambiamento reale per evitare loop infiniti
    let hasChanges = false;
    const prevState = { ...state };

    for (const key in newState) {
        if (state[key] !== newState[key]) {
            state[key] = newState[key];
            hasChanges = true;
        }
    }

    if (!hasChanges) return;
    
    // Persistenza Automatica dei flag UI
    if (newState.activeRightTab) localStorage.setItem('gx-active-right-tab', state.activeRightTab);
    if (newState.activeActivity) localStorage.setItem('gx-active-activity', state.activeActivity);
    if (newState.activeLeftTab) localStorage.setItem('gx-active-left-tab', state.activeLeftTab);
    if (newState.hasOwnProperty('isLeftSidebarOpen')) localStorage.setItem('gx-is-left-open', state.isLeftSidebarOpen);
    if (newState.hasOwnProperty('isRightSidebarOpen')) localStorage.setItem('gx-is-right-open', state.isRightSidebarOpen);
    if (newState.hasOwnProperty('isTerminalMinimized')) localStorage.setItem('gx-is-terminal-minimized', state.isTerminalMinimized);
    if (newState.hasOwnProperty('openFiles')) localStorage.setItem('gx-open-files', JSON.stringify(state.openFiles));
    if (newState.hasOwnProperty('activeFileId')) localStorage.setItem('gx-active-file-id', state.activeFileId || '');
    if (newState.hasOwnProperty('geminiApiKey')) localStorage.setItem('gx-gemini-api-key', state.geminiApiKey);
    if (newState.hasOwnProperty('anthropicApiKey')) localStorage.setItem('gx-anthropic-api-key', state.anthropicApiKey);
    if (newState.hasOwnProperty('customAiConfig')) localStorage.setItem('gx-custom-ai-config', JSON.stringify(state.customAiConfig));
    if (newState.hasOwnProperty('geminiConfig')) localStorage.setItem('gx-gemini-config', JSON.stringify(state.geminiConfig));
    if (newState.hasOwnProperty('ollamaConfig')) localStorage.setItem('gx-ollama-config', JSON.stringify(state.ollamaConfig));
    if (newState.hasOwnProperty('claudeCliConfig')) localStorage.setItem('gx-claude-cli-config', JSON.stringify(state.claudeCliConfig));
    if (newState.hasOwnProperty('qwenCliConfig')) localStorage.setItem('gx-qwen-cli-config', JSON.stringify(state.qwenCliConfig));
    if (newState.hasOwnProperty('mcpServers')) localStorage.setItem('gx-mcp-servers', JSON.stringify(state.mcpServers));
    if (newState.hasOwnProperty('youtrackConfig')) localStorage.setItem('gx-youtrack-config', JSON.stringify(state.youtrackConfig));
    if (newState.hasOwnProperty('activeTerminalFolder')) localStorage.setItem('gx-active-terminal-folder', state.activeTerminalFolder);
    if (newState.hasOwnProperty('selectedTestProject')) localStorage.setItem('gx-selected-test-project', state.selectedTestProject);
    if (newState.hasOwnProperty('workspaceData')) localStorage.setItem('gx-workspace-data', JSON.stringify(state.workspaceData));
    if (newState.hasOwnProperty('files')) localStorage.setItem('gx-workspace-files', JSON.stringify(state.files));
    if (newState.hasOwnProperty('activeCgxTheme')) localStorage.setItem('gx-active-skin', state.activeCgxTheme);
    if (newState.hasOwnProperty('projectGuidelines')) localStorage.setItem('gx-project-guidelines', state.projectGuidelines);
    if (newState.hasOwnProperty('activeSkillCategory')) localStorage.setItem('gx-active-skill-category', state.activeSkillCategory);
    if (newState.hasOwnProperty('activeModuleId')) localStorage.setItem('gx-active-module-id', state.activeModuleId || '');
    if (newState.hasOwnProperty('aiCompanion')) {
        localStorage.setItem('gx-ai-companion-state', JSON.stringify(state.aiCompanion));
        localStorage.setItem('gx-ai-companion-enabled', state.aiCompanion.enabled);
        localStorage.setItem('gx-ai-companion-install-path', state.aiCompanion.installPath);
        localStorage.setItem('gx-ai-companion-models-path', state.aiCompanion.modelsPath);
        localStorage.setItem('gx-ai-companion-model', state.aiCompanion.model);
    }
    
    if (newState.hasOwnProperty('bottomPanelHeight')) localStorage.setItem('gx-bottom-panel-height', state.bottomPanelHeight);
    if (newState.hasOwnProperty('terminalConfig')) localStorage.setItem('gx-terminal-config', JSON.stringify(state.terminalConfig));
    if (newState.hasOwnProperty('aiReactivityConfig')) localStorage.setItem('gx-ai-reactivity-config', JSON.stringify(state.aiReactivityConfig));
    if (newState.hasOwnProperty('testingConfig')) localStorage.setItem('gx-testing-config', JSON.stringify(state.testingConfig));
    if (newState.hasOwnProperty('debuggerConfig')) localStorage.setItem('gx-debugger-config', JSON.stringify(state.debuggerConfig));
    if (newState.hasOwnProperty('gitConfig')) localStorage.setItem('gx-git-config', JSON.stringify(state.gitConfig));
    if (newState.hasOwnProperty('extensionsConfig')) localStorage.setItem('gx-extensions-config', JSON.stringify(state.extensionsConfig));
    if (newState.hasOwnProperty('lspConfig')) localStorage.setItem('gx-lsp-config', JSON.stringify(state.lspConfig));

    console.log("[GX-STATE] Persistence updated for keys:", Object.keys(newState).filter(k => 
        ['activeRightTab', 'activeActivity', 'activeLeftTab', 'isLeftSidebarOpen', 'isRightSidebarOpen', 
         'isTerminalMinimized', 'openFiles', 'activeFileId', 'workspaceData', 'activeCgxTheme'].includes(k)
    ));

    for (const listener of listeners) {
        listener(state, prevState);
    }
};
