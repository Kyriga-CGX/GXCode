// APP/core/api.js
import { state, setState } from './state.js';

const API_BASE = 'http://localhost:5000/api';

/**
 * Utility modulare per chiamate di Rete JSON con log handling centralizzato.
 */
const fetchJson = async (endpoint, options = {}) => {
    // Evitiamo doppi slash se endpoint inizia con /
    const url = `${API_BASE.replace(/\/$/, '')}/${endpoint.replace(/^\//, '')}`;
    console.log(`[GX API] Requesting: ${url}`);
    try {
        const res = await fetch(url, options);
        if (!res.ok) throw new Error(res.statusText);
        if (res.status === 204) return true;
        return await res.json();
    } catch(err) {
        console.error(`API Error [${endpoint}]:`, err);
        return null;
    }
};

export const api = {
    // 1. Carica tutto lo stato da Disco/Backend e aggiorna il PubSub Reactively
    loadAll: async () => {
        const [agents, skills, plugins] = await Promise.all([
            fetchJson('/agents'), fetchJson('/skills'), fetchJson('/plugins')
        ]);
        setState({ 
            agents: agents || [], 
            skills: skills || [],
            plugins: plugins || [] 
        });
    },
    
    // 2. Carica i cataloghi online dal Marketplace Aggregator (Open VSX, Skills.sh, Hub)
    loadMarketplace: async (query = '') => {
          setState({ isMarketplaceLoading: true });
          const type = state.activeMarketplaceTab || 'agents';
          const enabledRepos = (state.repositories || [])
                                .filter(r => r.enabled)
                                .map(r => r.url)
                                .join(',');
          
          try {
              const cat = state.activeMarketplaceCategory || 'all';
              const queryStr = `/marketplace/search?type=${type}&q=${encodeURIComponent(query)}&category=${cat}` + 
                               (enabledRepos ? `&registries=${encodeURIComponent(enabledRepos)}` : '');
              
              // Chiamiamo l'aggregatore unico del backend
              const items = await fetchJson(queryStr);
              
              const update = {};
              if (type === 'agents') update.marketplaceAgents = items || [];
              else if (type === 'skills') update.marketplaceSkills = items || [];
              else if (type === 'addons') update.marketplacePlugins = items || [];
              
              setState({ ...update, isMarketplaceLoading: false });
          } catch(e) {
              console.error("Errore fetch marketplace aggregation:", e);
              setState({ isMarketplaceLoading: false });
          }
    },

    // Publishing Hub
    publishItem: async (item, targetRepoUrl) => {
        return await fetchJson('/marketplace/publish', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ item, targetRepoUrl })
        });
    },
    
    // Phase 6: Sync Issues (YouTrack)
    loadIssues: async () => {
         let { url, token, enabled } = state.youtrackConfig;
         
          // Fallback logic: if manual config is missing, check MCP servers
          if (!url || !token || !enabled) {
              const mcpList1 = Object.values(state.mcpServers || {});
              const mcpList2 = Object.values(state.claudeCliConfig?.mcpServers || {});
              const ytMcp = [...mcpList1, ...mcpList2].find(s => 
                  s.args?.some(a => a.toLowerCase().includes('youtrack'))
              );
              
              if (ytMcp && ytMcp.args) {
                  // Caso: URL e Token negli ARGS (npx mcp-remote style)
                  const remoteUrl = ytMcp.args.find(arg => arg.startsWith('http') && arg.toLowerCase().includes('youtrack'));
                  if (remoteUrl) {
                      url = remoteUrl.split('/mcp')[0]; 
                      
                      // Estraiamo il token se presente nel Bearer con Regex flessibile
                      const headerIdx = ytMcp.args.findIndex(a => a === '--header');
                      const authValue = headerIdx !== -1 ? ytMcp.args[headerIdx + 1] : null;

                      if (authValue && !token) {
                          token = authValue.replace(/^Authorization:\s*Bearer\s*/i, '').trim();
                      }
                  }

                  if (url) {
                      console.log(`[GX API] Smart-detected YouTrack from MCP: ${url}`);
                      enabled = true;
                  }
              }
          }

          if (!enabled || !url) {
             setState({ issues: [] });
             return;
          }

          // Ensure token exists (even if it's the one from manual config)
          if (!token) {
             console.warn("[GX API] YouTrack URL found but Token is missing. Sync disabled.");
             setState({ issues: [] });
             return;
          }

         const query = `?url=${encodeURIComponent(url)}&token=${encodeURIComponent(token)}`;
         const issues = await fetchJson(`/issues${query}`);
         setState({ issues: issues || [] });
    },
    
    // 3. I metodi di Installa risolvono istantaneamente il problema di asincronia
    installSkill: async (item) => {
         await fetchJson(`/marketplace-skills/${item.id}`, {
             method: 'PATCH',
             headers: {'Content-Type': 'application/json'},
             body: JSON.stringify({ ...item, isInstalled: true, isEnabled: true })
         });
         // Dopo aver installato, chiamando loadAll(), triggeriamo l'aggiornamento simultaneo globale della Sidebar. ZERO RELOADS.
         await api.loadAll();
         await api.loadMarketplace();
    },
    
    installAgent: async (item) => {
         await fetchJson(`/marketplace-agents/${item.id}`, {
             method: 'PATCH',
             headers: {'Content-Type': 'application/json'},
             body: JSON.stringify({ ...item, isInstalled: true, isEnabled: true })
         });
         await api.loadAll();
         await api.loadMarketplace();
    },
    
    installPlugin: async (item) => {
          await fetchJson(`/plugins/${item.id}`, {
              method: 'PATCH',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({ 
                  ...item,
                  isInstalled: true, 
                  isEnabled: true 
              })
          });
          await api.loadAll();
          await api.loadMarketplace();
     },
    
    // CRUD Agent
    createAgent: async (payload) => {
         await fetchJson('/agents', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
         await api.loadAll();
    },
    updateAgent: async (id, payload) => {
         await fetchJson(`/agents/${id}`, { method: 'PATCH', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
         await api.loadAll();
    },
    deleteAgent: async (id) => {
         await fetchJson(`/agents/${id}`, { method: 'DELETE' });
         await api.loadAll();
    },
    
    // CRUD Skill
    createSkill: async (payload) => {
         await fetchJson('/skills', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
         await api.loadAll();
    },
    updateSkill: async (id, payload) => {
         await fetchJson(`/skills/${id}`, { method: 'PATCH', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
         await api.loadAll();
    },
    deleteSkill: async (id) => {
         await fetchJson(`/skills/${id}`, { method: 'DELETE' });
         await api.loadAll();
    },
    deletePlugin: async (id) => {
         await fetchJson(`/plugins/${id}`, { method: 'DELETE' });
         await api.loadAll();
    },

    // MCP Sync to Backend
    syncMCPServers: async (mcpServers) => {
         return await fetchJson('/mcp-servers', {
             method: 'POST',
             headers: {'Content-Type': 'application/json'},
             body: JSON.stringify(mcpServers)
         });
    }
};
