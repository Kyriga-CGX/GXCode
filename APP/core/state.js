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
    youtrackConfig: JSON.parse(localStorage.getItem('gx-youtrack-config') || '{"url":"", "token":"", "enabled":false}'),
    geminiApiKey: localStorage.getItem('gx-gemini-api-key') || '',
    anthropicApiKey: localStorage.getItem('gx-anthropic-api-key') || '',
    repositories: JSON.parse(localStorage.getItem('gx-repositories') || '[{"id":"gx-official", "name":"GX Official Repo", "url":"https://api.gxcode.io/v1", "type":"all", "enabled":true}]'),
    marketplaceSources: {
        openvsx: true,
        skillssh: true,
        agentshub: true
    },

    // Shortcuts (Dinamiche e Persistenti)
    shortcuts: JSON.parse(localStorage.getItem('gx-shortcuts') || JSON.stringify({
        'Ctrl+S': { action: 'editor:save', label: 'Salva File Attivo' },
        'Ctrl+P': { action: 'search:quick-open', label: 'Ricerca Globale Rapida' },
        'Ctrl+B': { action: 'sidebar:toggle', label: 'Mostra/Nascondi Sidebar' },
        'Alt+F': { action: 'editor:format', label: 'Formatta Documento' }
    })),

    // UI State (Persistiti su localStorage)
    activeSidebarTab: localStorage.getItem('gx-active-sidebar-tab') || 'agents',
    activeActivity: localStorage.getItem('gx-active-activity') || 'explorer',
    isMarketplaceOpen: false,
    activeMarketplaceTab: 'agents',
    isSettingsOpen: false,
    isAddingRepo: false,
    activeSettingsTab: 'preferences',
    activeLeftTab: localStorage.getItem('gx-active-left-tab') || 'explorer',
    isLeftSidebarOpen: localStorage.getItem('gx-is-left-open') === 'true',
    isRightSidebarOpen: localStorage.getItem('gx-is-right-open') !== 'false', // Default true
    isTerminalMinimized: localStorage.getItem('gx-is-terminal-minimized') === 'true',
    
    issues: [],
    activeIssueId: null,
    activeAgentId: localStorage.getItem('gx-active-agent-id'),
    workspaceData: null,
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
    // Configurazione Gemini con merge dei default (Evita crash per schema-mismatch)
    geminiConfig: (() => {
        const defaults = {
            isAuthenticated: false,
            apiKey: "",
            activeModel: "gemini-1.5-pro",
            models: ["gemini-2.0-flash", "gemini-1.5-pro", "gemini-1.5-flash"],
            user: null,
            mode: "fast",
            messages: []
        };
        const saved = JSON.parse(localStorage.getItem('gx-gemini-config') || '{}');
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

    _geminiLoading: false,
    _geminiAuthenticating: false,
    _geminiAuthError: null,
    _geminiNeedsKey: false,
    appVersion: "...",
    
    // Testing & Playwright State
    testFilesCache: [],
    isPlaywrightInstalled: true,
    isTestingInProgress: false,
    
    // Multi-Project Terminal Support (v1.3.8)
    activeTerminalFolder: localStorage.getItem('gx-active-terminal-folder') || ''
};

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
    if (newState.activeSidebarTab) localStorage.setItem('gx-active-sidebar-tab', state.activeSidebarTab);
    if (newState.activeActivity) localStorage.setItem('gx-active-activity', state.activeActivity);
    if (newState.activeLeftTab) localStorage.setItem('gx-active-left-tab', state.activeLeftTab);
    if (newState.hasOwnProperty('isLeftSidebarOpen')) localStorage.setItem('gx-is-left-open', state.isLeftSidebarOpen);
    if (newState.hasOwnProperty('isRightSidebarOpen')) localStorage.setItem('gx-is-right-open', state.isRightSidebarOpen);
    if (newState.hasOwnProperty('isTerminalMinimized')) localStorage.setItem('gx-is-terminal-minimized', state.isTerminalMinimized);
    if (newState.openFiles) localStorage.setItem('gx-open-files', JSON.stringify(state.openFiles));
    if (newState.activeFileId) localStorage.setItem('gx-active-file-id', state.activeFileId);
    if (newState.hasOwnProperty('geminiApiKey')) localStorage.setItem('gx-gemini-api-key', state.geminiApiKey);
    if (newState.hasOwnProperty('anthropicApiKey')) localStorage.setItem('gx-anthropic-api-key', state.anthropicApiKey);
    if (newState.customAiConfig) localStorage.setItem('gx-custom-ai-config', JSON.stringify(state.customAiConfig));
    if (newState.geminiConfig) localStorage.setItem('gx-gemini-config', JSON.stringify(state.geminiConfig));
    if (newState.claudeCliConfig) localStorage.setItem('gx-claude-cli-config', JSON.stringify(state.claudeCliConfig));
    if (newState.mcpServers) localStorage.setItem('gx-mcp-servers', JSON.stringify(state.mcpServers));
    if (newState.youtrackConfig) localStorage.setItem('gx-youtrack-config', JSON.stringify(state.youtrackConfig));
    if (newState.hasOwnProperty('activeTerminalFolder')) localStorage.setItem('gx-active-terminal-folder', state.activeTerminalFolder);

    for (const listener of listeners) {
        listener(state, prevState);
    }
};
