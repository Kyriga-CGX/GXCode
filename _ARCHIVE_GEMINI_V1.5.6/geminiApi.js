import { state, setState } from './state.js';

/**
 * Gemini API Client with Tool-Use for GXCode
 */

const BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

/**
 * Recupera la lista dei modelli disponibili per le credenziali attuali
 */
/**
 * Analisi dinamica dei modelli disponibili per popolare i Tier di lavoro.
 * Supporta versionamento automatico (Gemini 2, 3, etc) e varianti (Flash, Pro, Ultra).
 */
export async function listAvailableModels() {
    const config = state.geminiConfig || { isAuthenticated: false };
    const apiKey = state.geminiApiKey;
    let url = `${BASE_URL}/models`;
    const headers = { 'Content-Type': 'application/json' };

    if (apiKey) {
        url += `?key=${apiKey}`;
    } else if (config.isAuthenticated && config.token) {
        headers['Authorization'] = `Bearer ${config.token}`;
    } else {
        return; 
    }

    try {
        const response = await fetch(url, { headers });
        if (!response.ok) throw new Error("Errore recupero modelli");
        const data = await response.json();
        
        const models = data.models
            .filter(m => m.supportedGenerationMethods.includes("generateContent"))
            .map(m => m.name.replace('models/', ''));

        // Motore Discovery: Categorizzazione per Tier (Futuristico)
        // Regex: gemini-[versione]-[tipo]-[variante]
        const parseModel = (name) => {
            const match = name.match(/gemini-(\d+(?:\.\d+)?)-(flash|pro|ultra)(?:-([\w-]+))?/i);
            if (!match) return { name, version: 0, type: 'other' };
            return {
                name,
                version: parseFloat(match[1]),
                type: match[2].toLowerCase(),
                isHigh: name.includes('high') || name.includes('ultra')
            };
        };

        const parsed = models.map(parseModel);
        
        const getBestFor = (type, mode = 'any') => {
            let candidates = parsed.filter(p => p.type === type);
            if (candidates.length === 0) return null;
            
            if (mode === 'high') {
                const highOnes = candidates.filter(p => p.isHigh);
                if (highOnes.length > 0) candidates = highOnes;
            } else if (mode === 'standard') {
                const standardOnes = candidates.filter(p => !p.isHigh);
                if (standardOnes.length > 0) candidates = standardOnes;
            }
            
            // Ordiniamo per versione (DESC) per avere sempre il più recente (es. 3.1 > 1.5)
            return candidates.sort((a, b) => b.version - a.version)[0].name;
        };

        // Assegnazione automatica dei Tier (Evoluzione Chronos 3.x)
        const fastModel = getBestFor('flash', 'standard') || models[0];
        const balancedModel = getBestFor('pro', 'standard') || models[0];
        const eliteModel = getBestFor('pro', 'high') || getBestFor('ultra', 'any') || getBestFor('pro', 'standard') || models[0];

        setState({
            geminiConfig: {
                ...state.geminiConfig,
                models: models,
                tiers: {
                    fast: fastModel,
                    balanced: balancedModel,
                    elite: eliteModel
                },
                // Se il modello attivo non esiste più, passiamo al Balanced Tier
                activeModel: models.includes(state.geminiConfig.activeModel) 
                    ? state.geminiConfig.activeModel 
                    : balancedModel
            }
        });
        
        console.log("[GEMINI-TIERS] Tiering completato:", state.geminiConfig.tiers);
        
        // Generazione Automatica del file di contesto (Anti-Error Fallback)
        if (state.workspaceData?.path) {
            ensureGeminiMetadata(state.workspaceData.path);
        }
    } catch (err) {
        console.error("[GEMINI] Errore listModels:", err);
    }
}

// Tool Definitions for Gemini (Professional Suite + Dynamic Skills + MCP + YouTrack)
export const getDynamicTools = async () => {
    const baseTools = [
        {
            name: "list_files",
            description: "Elenca i file e le cartelle all'interno di una directory specifica del progetto.",
            parameters: {
                type: "object",
                properties: {
                    directory: { type: "string", description: "Il percorso relativo della directory (es. '.', 'src')." }
                },
                required: ["directory"]
            }
        },
        {
            name: "read_file",
            description: "Legge il contenuto di un file caricandolo in memoria.",
            parameters: {
                type: "object",
                properties: {
                    path: { type: "string", description: "Il percorso relativo o assoluto del file (es. 'src/index.js')." }
                },
                required: ["path"]
            }
        },
        {
            name: "write_file",
            description: "Crea o sovrascrive un file con il nuovo contenuto.",
            parameters: {
                type: "object",
                properties: {
                    path: { type: "string", description: "Percorso del file da scrivere." },
                    content: { type: "string", description: "Contenuto testuale completo del file." }
                },
                required: ["path", "content"]
            }
        },
        {
            name: "execute_terminal_command",
            description: "Esegue un comando nel terminale di sistema all'interno del workspace.",
            parameters: {
                type: "object",
                properties: {
                    command: { type: "string", description: "Il comando da eseguire (es: 'npm install', 'ls -la')." }
                },
                required: ["command"]
            }
        },
        {
            name: "git_status",
            description: "Recupera lo stato attuale del repository Git (file modificati, nuovi, eliminati).",
            parameters: { type: "object", properties: {} }
        }
    ];

    // --- INTEGRAZIONE YOUTRACK ---
    const ytConfig = state.youtrackConfig;
    if (ytConfig && ytConfig.enabled && ytConfig.url && ytConfig.token) {
        baseTools.push(
            {
                name: "youtrack_search_issues",
                description: "Cerca ticket su YouTrack utilizzando una query testuale o filtri (Project, State, etc).",
                parameters: {
                    type: "object",
                    properties: {
                        query: { type: "string", description: "Parole chiave per la ricerca (es. 'bug fixed')." },
                        project: { type: "string", description: "Filtra per nome progetto." }
                    }
                }
            },
            {
                name: "youtrack_get_issue_details",
                description: "Recupera tutti i dettagli (descrizione, priorità, commenti) di un ticket specifico tramite il suo ID (es. 'GX-123').",
                parameters: {
                    type: "object",
                    properties: {
                        issueId: { type: "string", description: "ID leggibile del ticket YouTrack." }
                    },
                    required: ["issueId"]
                }
            }
        );
    }

    // --- INTEGRAZIONE DINAMICA MCP SERVERS ---
    const mcpServers = (state.mcpServers || []).filter(s => s.enabled);
    const mcpTools = [];

    for (const server of mcpServers) {
        try {
            // Discovery via Backend Proxy
            const response = await fetch(`/api/mcp/tools?url=${encodeURIComponent(server.url)}`);
            if (response.ok) {
                const data = await response.json();
                if (data.tools && Array.isArray(data.tools)) {
                    data.tools.forEach(tool => {
                        mcpTools.push({
                            name: `mcp_${server.id}_${tool.name}`, // Prefisso per evitare collisioni
                            description: `[MCP: ${server.name}] ${tool.description}`,
                            parameters: tool.parameters
                        });
                    });
                }
            }
        } catch (err) {
            console.warn(`[MCP Discovery] Impossibile contattare ${server.name}:`, err.message);
        }
    }

    // Integrazione dinamica delle Skill dalla Sidebar
    const marketplaceSkills = (state.skills || []).map(skill => ({
        name: `gx_skill_${skill.id || skill.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
        description: `TOOL GXCODE: ${skill.description || 'Esegue una skill specifica della barra laterale.'}`,
        parameters: {
            type: "object",
            properties: {
                input: { type: "string", description: "Input opzionale per la skill." }
            }
        }
    }));

    if (marketplaceSkills.length > 0) {
        baseTools.push({
            name: "execute_gx_skill",
            description: "Esegue una delle skill installate in GXCode (es. Lint, Test, Deploy).",
            parameters: {
                type: "object",
                properties: {
                    skill_name: { type: "string", description: "Il nome esatto della skill da eseguire." },
                    args: { type: "string", description: "Argomenti extra opzionali." }
                },
                required: ["skill_name"]
            }
        });
    }

    return [{ function_declarations: [...baseTools, ...mcpTools, ...marketplaceSkills] }];
};

// Implementation of Tools (Bridge to Electron)
const toolHandlers = {
    list_files: async ({ directory }) => {
        try {
            const root = state.workspaceData?.path || "";
            const target = directory === '.' ? root : `${root}/${directory}`;
            const result = await window.electronAPI.openSpecificFolder(target);
            return JSON.stringify(result.map(f => ({ name: f.name, isDirectory: f.isDirectory })));
        } catch (err) {
            return `Errore lista directory: ${err.message}`;
        }
    },
    read_file: async ({ path }) => {
        try {
            const root = state.workspaceData?.path || "";
            const target = path.includes(':') ? path : `${root}/${path}`;
            return await window.electronAPI.readFile(target);
        } catch (err) {
            return `Errore lettura: ${err.message}`;
        }
    },
    write_file: async ({ path, content }) => {
        try {
            const root = state.workspaceData?.path || "";
            const target = path.includes(':') ? path : `${root}/${path}`;
            await window.electronAPI.fsWriteFile(target, content);
            return `File "${path}" salvato con successo.`;
        } catch (err) {
            return `Errore scrittura: ${err.message}`;
        }
    },
    execute_terminal_command: async ({ command }) => {
        try {
            const root = state.workspaceData?.path || "";
            const result = await window.electronAPI.executeCommand(command, root);
            if (result.success) {
                return `Output:\n${result.stdout}\n${result.stderr}`;
            } else {
                return `Errore Esecuzione: ${result.error}\nStderr: ${result.stderr}`;
            }
        } catch (err) {
            return `Errore Terminale: ${err.message}`;
        }
    },
    git_status: async () => {
        try {
            const root = state.workspaceData?.path || "";
            const status = await window.electronAPI.gitStatus(root);
            return JSON.stringify(status);
        } catch (err) {
            return `Errore Git: ${err.message}`;
        }
    },
    execute_gx_skill: async ({ skill_name, args }) => {
        try {
            console.log(`[GX-BRIDGE] AI Request to execute skill: ${skill_name}`);
            const result = await window.electronAPI.executeCommand(`gx-skill run "${skill_name}" ${args || ""}`, state.workspaceData?.path || "");
            return `Skill "${skill_name}" eseguita. Output:\n${result.stdout}`;
        } catch (err) {
            return `Errore esecuzione skill "${skill_name}": ${err.message}`;
        }
    },
    // Handler YouTrack
    youtrack_search_issues: async (args) => {
        try {
            const { url, token } = state.youtrackConfig;
            let finalUrl = `${url.replace(/\/$/, '')}/api/issues?fields=idReadable,summary,project(name),state(name)`;
            if (args.query) finalUrl += `&query=${encodeURIComponent(args.query)}`;
            
            const resp = await fetch(finalUrl, { headers: { 'Authorization': `Bearer ${token}` } });
            const issues = await resp.json();
            return JSON.stringify(issues.map(i => ({ id: i.idReadable, summary: i.summary, project: i.project?.name, state: i.state?.name })));
        } catch (err) {
            return `Errore YouTrack: ${err.message}`;
        }
    },
    youtrack_get_issue_details: async ({ issueId }) => {
        try {
            const { url, token } = state.youtrackConfig;
            const finalUrl = `${url.replace(/\/$/, '')}/api/issues/${issueId}?fields=idReadable,summary,description,project(name),state(name),priority(name)`;
            const resp = await fetch(finalUrl, { headers: { 'Authorization': `Bearer ${token}` } });
            return JSON.stringify(await resp.json());
        } catch (err) {
            return `Errore YouTrack (Issue ${issueId}): ${err.message}`;
        }
    }
};

// Internal MCP Proxy Handler (called by router below)
const handleMCPCall = async (toolFullName, args) => {
    // Il formato è mcp_SERVERID_TOOLNAME
    const parts = toolFullName.split('_');
    if (parts.length < 3) return "Errore formato nome tool.";
    
    const serverId = parts[1];
    const toolName = parts.slice(2).join('_');
    const server = state.mcpServers.find(s => String(s.id) === String(serverId));
    
    if (!server) return "Server MCP non trovato.";
    
    try {
        const response = await fetch('/api/mcp/proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: server.url, tool: toolName, arguments: args })
        });
        const result = await response.json();
        return JSON.stringify(result);
    } catch (err) {
        return `Errore Proxy MCP: ${err.message}`;
    }
};

/**
 * Determina il miglior modello da usare in base alla "strategia multi-modello elite".
 * Obiettivo: Usare Flash per pensare, Pro per scrivere, Elite per i tool.
 */
const getModelForPhase = (messages) => {
    const config = state.geminiConfig || {};
    if (!config.multiModelStrategyEnabled || !config.tiers) return config.activeModel || "gemini-1.5-pro";

    const isStart = messages.length <= 1;
    const hasToolContext = messages.some(m => m.role === "function") || messages.some(m => m.content?.parts?.some(p => p.functionCall));

    // Fase 1: Pensiero & Strategia -> Tier FAST (Flash)
    if (isStart) return config.tiers.fast;

    // Fase 2: Agentic & Tool Execution -> Tier ELITE (High Pro / Ultra)
    if (hasToolContext) return config.tiers.elite;

    // Fase 3: Scrittura finale & Soluzioni -> Tier BALANCED (Pro)
    return config.tiers.balanced;
};

export const callGeminiAgent = async (messages, onStatusUpdate) => {
    const config = state.geminiConfig || { isAuthenticated: false };
    const apiKey = state.geminiApiKey;
    
    // Selezione Dinamica del Modello (Zero-Config Elite)
    const activeModel = getModelForPhase(messages);
    
    let url = `${BASE_URL}/models/${activeModel}:generateContent`;
    const headers = { 'Content-Type': 'application/json' };

    console.log(`[GEMINI-ELITE] Using model: ${activeModel} for this turn.`);

    if (apiKey) {
        url += `?key=${apiKey}`;
    } else if (config.isAuthenticated && config.token) {
        headers['Authorization'] = `Bearer ${config.token}`;
    } else {
        throw new Error("Autenticazione mancante.");
    }

    const payload = {
        contents: messages,
        tools: await getDynamicTools(),
        tool_config: { function_calling_config: { mode: "AUTO" } }
    };

    const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || "Errore API");
    }

    const data = await response.json();
    const candidate = data.candidates[0];
    const part = candidate.content.parts[0];

    if (part.functionCall) {
        const { name, args } = part.functionCall;
        if (onStatusUpdate) onStatusUpdate(`Eseguo tool: ${name}...`);
        
        // Router per i gestori (base + YouTrack + MCP)
        let handler = toolHandlers[name];
        let result;
        
        if (handler) {
            result = await handler(args);
        } else if (name.startsWith('mcp_')) {
            result = await handleMCPCall(name, args);
        } else {
            result = `Tool "${name}" non implementato.`;
        }
            const nextMessages = [
                ...messages,
                candidate.content,
                {
                    role: "function",
                    parts: [{
                        functionResponse: { name, response: { content: result } }
                    }]
                }
            ];
            
            return await callGeminiAgent(nextMessages, onStatusUpdate);
    }

    return part.text || "Operazione completata.";
};

/**
 * Genera il file GEMINI.md alla root del progetto per sincronizzare il contesto.
 */
export async function ensureGeminiMetadata(workspacePath) {
    if (!workspacePath) return false;
    
    // Verifichiamo se abbiamo già i tier, altrimenti usiamo default
    const config = state.geminiConfig || {};
    const tiers = config.tiers || { fast: 'auto', balanced: 'auto', elite: 'auto' };
    
    // Sostituiamo backslash per uniformità nei percorsi di Electron
    const cleanPath = workspacePath.replace(/\\/g, '/');
    const filePath = cleanPath.endsWith('/') ? `${cleanPath}GEMINI.md` : `${cleanPath}/GEMINI.md`;
    
    const content = `# ${state.workspaceData?.name || 'GENESIS'} - GEMINI NEURAL CONTEXT

Questo file definisce l'identità del progetto e la strategia AI per Gemini in questo workspace.

## 🧠 DYNAMIC ELITE STRATEGY (CHRONOS)
Il sistema GXCode ha eletto i seguenti modelli per questo workspace in base alle capacità rilevate:

- **FAST TIER**: \`${tiers.fast}\` 
  > Utilizzato per il pensiero rapido, la pianificazione iniziale e l'analisi dei prompt.
  
- **BALANCED TIER**: \`${tiers.balanced}\`
  > Utilizzato per la generazione di codice, il refactoring e la scrittura di documentazione.
  
- **ELITE TIER**: \`${tiers.elite}\`
  > Utilizzato per workflow agentici complessi, esecuzione di tool (MCP) e task multi-fase.

## 📋 PROJECT IDENTITY
- **Root**: \`${workspacePath}\`
- **Identity**: \`${state.workspaceData?.name || 'Unknown'}\`

## 🛠️ INSTRUCTIONS
Gemini deve fare riferimento a questo file per comprendere la propria configurazione in GXCode e il contesto del progetto corrente.

---
*Generato automaticamente da GXCode Evolution 2026 - Elite Terminal Edition*
`;

    try {
        await window.electronAPI.fsWriteFile(filePath, content);
        console.log("[GEMINI] GEMINI.md sincronizzato:", filePath);
        if (window.gxToast) window.gxToast("Sincronizzazione GEMINI.md completata", "success");
        return true;
    } catch (err) {
        console.error("[GEMINI] Errore salvataggio GEMINI.md:", err);
        return false;
    }
}

window.ensureGeminiMetadata = ensureGeminiMetadata;
