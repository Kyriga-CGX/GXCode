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

    // Monitora i cambiamenti nelle skill e negli agenti
    subscribe((newState) => {
        const skills = newState.skills || [];
        const currentHash = JSON.stringify(skills.map(s => s.id));

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

        let content = `# GXCODE PROJECT IDENTITY\n\n`;
        content += `Questo file è autogenerato da GXCode per informare l'AI sugli strumenti disponibili nel sistema.\n\n`;

        content += `## DISPONIBILI GX-SKILLS\n`;
        content += `Puoi richiamare queste skill usando il comando terminale: \`gx-skill run "<nome_skill>"\`\n\n`;

        if (skills.length === 0) {
            content += `*Nessuna skill installata.*\n`;
        } else {
            skills.forEach(s => {
                content += `### ${s.name}\n`;
                content += `- **Descrizione**: ${s.description || 'Nessuna descrizione.'}\n`;
                content += `- **Comando**: \`gx-skill run "${s.name}"\`\n\n`;
            });
        }

        content += `\n## AGENTI SUGGERITI\n`;
        agents.forEach(a => {
            content += `- **${a.name}**: ${a.role || 'General Assistant'}\n`;
        });

        // Scriviamo il file nella cartella .claudecode per Claude
        const dotClaudePath = `${workspacePath}/.claudecode`;
        const fileName = `${dotClaudePath}/GX_IDENTITY.md`;

        // Assicuriamoci che la cartella esista (tramite Electron FS)
        // Nota: window.electronAPI.fsWriteFile crea le directory se non esistono? 
        // Solitamente sì se implementato correttamente nel main.js
        await window.electronAPI.fsWriteFile(fileName, content);
        
        console.log(`[GX-BRIDGE] Identità AI aggiornata in: ${fileName}`);
    } catch (err) {
        console.error("[GX-BRIDGE] Errore aggiornamento identità:", err);
    }
};
