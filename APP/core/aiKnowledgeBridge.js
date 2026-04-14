import { state, subscribe } from './state.js';
import { api } from './api.js';

/**
 * AI Knowledge Bridge
 * Sincronizza lo stato di GXCode (Skills, Agents) con il filesystem
 * per permettere a tutte le AI (Claude, Qwen, Gemini) di "conoscere" l'ambiente.
 */

let lastStateHash = "";

export const initAiKnowledgeBridge = () => {
    console.log("[GX-BRIDGE] AI Knowledge Bridge Inizializzato.");

    // Monitora i cambiamenti rilevanti
    subscribe((newState) => {
        // Trigger quando cambia il workspace, le skills, gli agents o le guidelines
        const currentHash = JSON.stringify({
            workspace: newState.workspaceData?.path,
            skills: (newState.skills || []).map(s => s.id),
            agents: (newState.agents || []).map(a => a.id),
            guidelines: newState.projectGuidelines,
            openFiles: newState.openFiles?.map(f => f.path)
        });

        if (currentHash !== lastStateHash) {
            lastStateHash = currentHash;
            syncAllAiContextFiles(newState);
        }
    });

    // Esegui un primo aggiornamento se siamo già in un workspace
    if (state.workspaceData?.path) {
        syncAllAiContextFiles(state);
    }
};

/**
 * Genera tutti i file di contesto per le AI (CLAUDE.md, QWEN.md, GEMINI.md, GX_IDENTITY.md)
 */
export const syncAllAiContextFiles = async (currentState) => {
    const workspacePath = currentState.workspaceData?.path;
    if (!workspacePath) return;

    try {
        const skills = currentState.skills || [];
        const agents = currentState.agents || [];
        const guidelines = currentState.projectGuidelines || "";
        const openFiles = currentState.openFiles || [];
        const activeFile = currentState.activeFileId;

        // Identità del progetto: Priorità all'URL Git, altrimenti nome cartella
        // Nota: getGitRemote è asincrono, lo chiamiamo qui
        let projectIdentity = workspacePath.split(/[/\\]/).filter(Boolean).pop();
        try {
            const gitInfo = await window.electronAPI.getGitRemote(workspacePath);
            if (gitInfo.success) projectIdentity = gitInfo.url;
        } catch (e) { /* Ignora errori git */ }

        const separator = workspacePath.includes('\\') ? '\\' : '/';

        // Helper per rendere i path relativi
        const getRelative = (fullPath) => {
            if (!fullPath) return 'None';
            const normPath = fullPath.replace(/\\/g, '/');
            const normRoot = workspacePath.replace(/\\/g, '/');
            let relative = normPath.replace(normRoot, '');
            if (relative.startsWith('/')) relative = relative.substring(1);
            return relative || '.';
        };

        const workspaceContext = openFiles.length > 0 ? `
## CURRENT WORKSPACE CONTEXT
- **Open Editor Tabs**:
${openFiles.map(f => `  - \`${getRelative(f.path)}\` ${f.path === activeFile ? '**[ACTIVE]**' : ''}`).join('\n')}
` : '';

        const instructions = `
## INSTRUCTIONS
1. When the user asks about agents or skills, prioritize looking into the Global locations (relative to User Home).
2. You have full access to the project root for searching and editing code.
3. Use the open editor tabs as your primary context for what the user is currently working on.
4. Refer to **GX_IDENTITY.md** for detailed system capabilities (Skills and Agents).
`;

        // --- 1. CLAUDE.md ---
        const claudeMd = `# ${projectIdentity.toUpperCase()} - PROJECT CONTEXT

This project is being managed by **GXCode IDE**.

## PROJECT IDENTITY
- **Remote/ID**: \`${projectIdentity}\`
- **Local Root**: \`.\` (Current Working Directory)

## IDE RESOURCES (GLOBAL)
- **Agents Location**: \`~/.GXCODE/agents\`
- **Skills Location**: \`~/.GXCODE/skills\`
${workspaceContext}
${instructions}`;

        // --- 2. QWEN.md ---
        const qwenMd = `# ${projectIdentity.toUpperCase()} - PROJECT CONTEXT

This project is being managed by **GXCode IDE**.

## PROJECT IDENTITY
- **Remote/ID**: \`${projectIdentity}\`
- **Local Root**: \`.\` (Current Working Directory)

## IDE RESOURCES (GLOBAL)
- **Agents Location**: \`~/.GXCODE/agents\`
- **Skills Location**: \`~/.GXCODE/skills\`
${workspaceContext}
${instructions}`;

        // --- 3. GEMINI.md ---
        const geminiMd = `# ${projectIdentity.toUpperCase()} - PROJECT CONTEXT

This project is being managed by **GXCode IDE**.

## PROJECT IDENTITY
- **Remote/ID**: \`${projectIdentity}\`
- **Local Root**: \`.\` (Current Working Directory)

## IDE RESOURCES (GLOBAL)
- **Agents Location**: \`~/.GXCODE/agents\`
- **Skills Location**: \`~/.GXCODE/skills\`
${workspaceContext}
${instructions}`;

        // --- 4. GX_IDENTITY.md (Il "Cervello" condiviso delle capacità) ---
        let identityMd = `# GXCODE SYSTEM IDENTITY

Questo file definisce le capacità operative dell'ambiente GXCode. Tutte le AI (Claude, Qwen, Gemini) devono farvi riferimento.

## PROJECT GUIDELINES
${guidelines || '*Nessuna linea guida specifica definita.*'}

## GX-SKILLS (TOOLING)
Le seguenti competenze possono essere invocate tramite il comando \`gx-skill run "<nome>"\`.
`;
        if (skills.length === 0) {
            identityMd += `*Nessuna skill installata.*\n`;
        } else {
            skills.forEach(s => {
                identityMd += `### ${s.name}\n- **Descrizione**: ${s.description || 'Strumento GXCode.'}\n- **Invocazione**: \`gx-skill run "${s.name}"\`\n\n`;
            });
        }

        identityMd += `## ACTIVE AGENTS\n`;
        if (agents.length === 0) {
            identityMd += `*Nessun agente attivo.*\n`;
        } else {
            agents.forEach(a => {
                identityMd += `- **${a.name}**: ${a.role || 'Assistant'}\n`;
            });
        }

        // --- Scrittura su Filesystem ---
        
        // 1. CLAUDE.md (Root)
        const claudeRootPath = workspacePath.endsWith(separator) ? `${workspacePath}CLAUDE.md` : `${workspacePath}${separator}CLAUDE.md`;
        await window.electronAPI.fsWriteFile(claudeRootPath, claudeMd);

        // 2. QWEN.md (Root)
        const qwenRootPath = workspacePath.endsWith(separator) ? `${workspacePath}QWEN.md` : `${workspacePath}${separator}QWEN.md`;
        await window.electronAPI.fsWriteFile(qwenRootPath, qwenMd);

        // 3. GEMINI.md (Root)
        const geminiRootPath = workspacePath.endsWith(separator) ? `${workspacePath}GEMINI.md` : `${workspacePath}${separator}GEMINI.md`;
        await window.electronAPI.fsWriteFile(geminiRootPath, geminiMd);

        // 4. GX_IDENTITY.md (.claudecode) - Condiviso come fonte di verità
        const dotClaudeDir = workspacePath.endsWith(separator) ? `${workspacePath}.claudecode` : `${workspacePath}${separator}.claudecode`;
        const identityPath = `${dotClaudeDir}${separator}GX_IDENTITY.md`;
        await window.electronAPI.fsWriteFile(identityPath, identityMd);

        console.log(`[GX-BRIDGE] All AI context files synced successfully.`);
    } catch (err) {
        console.error("[GX-BRIDGE] Errore sync contesto AI:", err);
    }
};

// Mantengo il vecchio nome per compatibilità, ma ora punta alla nuova funzione centrale
export const updateClaudeIdentity = syncAllAiContextFiles;
