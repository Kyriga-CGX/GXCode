import { state, setState } from './state.js';

/**
 * Gemini API Client with Tool-Use for GXCode
 */

const BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

/**
 * Recupera la lista dei modelli disponibili per le credenziali attuali
 */
export const listAvailableModels = async () => {
    const config = state.geminiConfig || { isAuthenticated: false };
    const apiKey = state.geminiApiKey;
    let url = `${BASE_URL}/models`;
    const headers = { 'Content-Type': 'application/json' };

    if (apiKey) {
        url += `?key=${apiKey}`;
    } else if (config.isAuthenticated && config.token) {
        headers['Authorization'] = `Bearer ${config.token}`;
    } else {
        return; // Niente credenziali, niente modelli
    }

    try {
        const response = await fetch(url, { headers });
        if (!response.ok) throw new Error("Errore recupero modelli");
        const data = await response.json();
        
        // Filtriamo solo i modelli che supportano generateContent
        const models = data.models
            .filter(m => m.supportedGenerationMethods.includes("generateContent"))
            .map(m => m.name.replace('models/', ''));

        console.log("[GEMINI] Modelli disponibili:", models);
        
        setState({
            geminiConfig: {
                ...state.geminiConfig,
                models: models,
                // Imposta un default se quello attuale non è nella lista
                activeModel: models.includes(state.geminiConfig.activeModel) 
                    ? state.geminiConfig.activeModel 
                    : (models.includes('gemini-1.5-pro') ? 'gemini-1.5-pro' : models[0])
            }
        });
    } catch (err) {
        console.error("[GEMINI] Errore listModels:", err);
    }
};

// Tool Definitions for Gemini (Professional Suite + Dynamic Skills)
export const getDynamicTools = () => {
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
                    path: { type: "string", description: "Il percorso relativo o assoluto del file." }
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
                    content: { type: "string", description: "Contenuto testuale completo." }
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

    // Se ci sono skill, aggiungiamo un tool generico di esecuzione per sicurezza
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

    return [{ function_declarations: [...baseTools, ...marketplaceSkills] }];
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
            // In un framework reale, qui chiameremmo api.runSkill(skill_name, args)
            // Per ora simuliamo l'uso del terminale per eseguire la logica della skill
            const result = await window.electronAPI.executeCommand(`gx-skill run "${skill_name}" ${args || ""}`, state.workspaceData?.path || "");
            return `Skill "${skill_name}" eseguita. Output:\n${result.stdout}`;
        } catch (err) {
            return `Errore esecuzione skill "${skill_name}": ${err.message}`;
        }
    }
};

export const callGeminiAgent = async (messages, onStatusUpdate) => {
    const config = state.geminiConfig || { isAuthenticated: false };
    const apiKey = state.geminiApiKey; // La chiave manuale inserita nelle impostazioni
    const activeModel = config.activeModel || "gemini-1.5-pro";
    let url = `${BASE_URL}/models/${activeModel}:generateContent`;
    const headers = { 'Content-Type': 'application/json' };

    if (apiKey) {
        // PRIORITÀ 1: API Key manuale (AI Studio) - Molto più affidabile per i dev
        url += `?key=${apiKey}`;
        console.log(`[GX-AGENT] Using Manual API Key with Model: ${activeModel}`);
    } else if (config.isAuthenticated && config.token) {
        // PRIORITÀ 2: Token OAuth Account (Se non c'è una chiave manuale)
        headers['Authorization'] = `Bearer ${config.token}`;
        console.log(`[GX-AGENT] Using Official Account with Model: ${activeModel}`);
    } else {
        throw new Error("Nessun metodo di autenticazione configurato. Inserisci una Gemini API Key nelle impostazioni o accedi con Google.");
    }

    const payload = {
        contents: messages,
        tools: getDynamicTools(),
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
        
        const handler = toolHandlers[name];
        if (handler) {
            const result = await handler(args);
            
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
    }

    return part.text || "Operazione completata.";
};
