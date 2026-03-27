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
    repositories: JSON.parse(localStorage.getItem('gx-repositories') || '[{"id":"gx-official", "name":"GX Official Repo", "url":"https://api.gxcode.io/v1", "type":"all", "enabled":true}]'),
    marketplaceSources: {
        openvsx: true,
        skillssh: true,
        agentshub: true
    },

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
    
    tickets: [],
    activeTicketId: null,
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
    appVersion: "..." 
};

const listeners = new Set();

export const subscribe = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};

export const setState = (newState) => {
    Object.assign(state, newState);
    
    // Persistenza Automatica dei flag UI
    if (newState.activeSidebarTab) localStorage.setItem('gx-active-sidebar-tab', state.activeSidebarTab);
    if (newState.activeActivity) localStorage.setItem('gx-active-activity', state.activeActivity);
    if (newState.activeLeftTab) localStorage.setItem('gx-active-left-tab', state.activeLeftTab);
    if (newState.hasOwnProperty('isLeftSidebarOpen')) localStorage.setItem('gx-is-left-open', state.isLeftSidebarOpen);
    if (newState.hasOwnProperty('isRightSidebarOpen')) localStorage.setItem('gx-is-right-open', state.isRightSidebarOpen);
    if (newState.hasOwnProperty('isTerminalMinimized')) localStorage.setItem('gx-is-terminal-minimized', state.isTerminalMinimized);
    if (newState.openFiles) localStorage.setItem('gx-open-files', JSON.stringify(state.openFiles));
    if (newState.activeFileId) localStorage.setItem('gx-active-file-id', state.activeFileId);

    for (const listener of listeners) {
        listener(state);
    }
};
