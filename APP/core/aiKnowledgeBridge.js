import { state, subscribe } from './state.js';
import { api } from './api.js';

/**
 * AI Knowledge Bridge
 * Sincronizza lo stato di GXCode (Skills, Agents) con il filesystem
 * per permettere a Claude CLI e altri strumenti esterni di "conoscere" l'ambiente.
 */

let lastSkillsHash = "";

export const initAiKnowledgeBridge = () => {
    console.log("[GX-BRIDGE] Knowledge Bridge Inizializzato.");

    // Monitora i cambiamenti nelle skill, negli agenti e nelle linee guida
    subscribe((newState) => {
        const skills = newState.skills || [];
        const guidelines = newState.projectGuidelines || "";
        const currentHash = JSON.stringify(skills.map(s => s.id)) + guidelines;

        if (currentHash !== lastSkillsHash) {
            lastSkillsHash = currentHash;
            updateClaudeIdentity(newState);
        }
    });

    // Esegui un primo aggiornamento se siamo già in un workspace
    if (state.workspaceData?.path) {
        updateClaudeIdentity(state);
    }
};

const updateClaudeIdentity = async (currentState) => {
    const workspacePath = currentState.workspaceData?.path;
    if (!workspacePath) return;

    try {
        const skills = currentState.skills || [];
        const agents = currentState.agents || [];
        const guidelines = currentState.projectGuidelines || "";

        // --- CONTENUTO PER CLAUDE.md (Root) ---
        let claudeMd = `# PROJECT GUIDELINES & TOOLS (GXCode)\n\n`;
        if (guidelines) {
            claudeMd += `## PROJECT CONTEXT\n${guidelines}\n\n`;
        }
        
        claudeMd += `## STANDARDS & COMMANDS\n`;
        claudeMd += `- **Skills**: Invocabili via terminale con \`gx-skill run "<nome>"\`\n`;
        claudeMd += `- **Agenti**: Info dettagliate in \`.claudecode/GX_IDENTITY.md\`\n\n`;
        
        claudeMd += `### AVAILABLE SKILLS\n`;
        if (skills.length === 0) {
            claudeMd += `*Nessuna skill installata.*\n`;
        } else {
            skills.forEach(s => {
                claudeMd += `- \`${s.name}\`: ${s.description || 'Strumento GXCode.'}\n`;
            });
        }

        // --- CONTENUTO PER GX_IDENTITY.md (.claudecode) ---
        let identityMd = `# GXCODE SYSTEM IDENTITY\n\n`;
        identityMd += `Questo file aiuta l'AI a capire i limiti e i poteri del sistema GXCode.\n\n`;

        if (guidelines) {
            identityMd += `## PROJECT GUIDELINES\n${guidelines}\n\n`;
        }

        identityMd += `## GX-SKILLS (TOOLING)\n`;
        skills.forEach(s => {
            identityMd += `### ${s.name}\n`;
            identityMd += `- **Descrizione**: ${s.description}\n`;
            identityMd += `- **Invocazione**: \`gx-skill run "${s.name}"\`\n\n`;
        });

        identityMd += `\n## ACTIVE AGENTS\n`;
        agents.forEach(a => {
            identityMd += `- **${a.name}**: ${a.role || 'Assistant'}\n`;
        });

        const separator = workspacePath.includes('\\') ? '\\' : '/';
        
        // 1. Scrittura CLAUDE.md (Root)
        const claudeRootPath = workspacePath.endsWith(separator) ? `${workspacePath}CLAUDE.md` : `${workspacePath}${separator}CLAUDE.md`;
        await window.electronAPI.fsWriteFile(claudeRootPath, claudeMd);

        // 2. Scrittura GX_IDENTITY.md (.claudecode)
        const dotClaudeDir = workspacePath.endsWith(separator) ? `${workspacePath}.claudecode` : `${workspacePath}${separator}.claudecode`;
        const identityPath = `${dotClaudeDir}${separator}GX_IDENTITY.md`;
        
        await window.electronAPI.fsWriteFile(identityPath, identityMd);
        
        console.log(`[GX-BRIDGE] Knowledge synced: CLAUDE.md & GX_IDENTITY.md updated.`);
    } catch (err) {
        console.error("[GX-BRIDGE] Errore sync identità:", err);
    }
};
