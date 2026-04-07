const fs = require('fs');
const path = require('path');

function updateClaudeContext(workspacePath) {
  if (!workspacePath) return;
  const rootDir = workspacePath.endsWith('.code-workspace') 
    ? path.dirname(workspacePath) 
    : workspacePath;

  const claudePath = path.join(rootDir, 'CLAUDE.md');
  const identityPath = path.join(rootDir, 'GX_IDENTITY.md');
  const contextHeader = '## CURRENT WORKSPACE CONTEXT';
  const contextLine = `- **Root Path**: ./ (Current project root)`;

  // Safety check: ensure root exists before writing
  if (!fs.existsSync(rootDir)) {
      console.warn(`[GX-CLAUDE] Root directory missing: ${rootDir}`);
      return;
  }

  try {
    // 1. CLAUDE.md Update/Generation
    let content = '';
    if (fs.existsSync(claudePath)) {
      content = fs.readFileSync(claudePath, 'utf8');
      const lines = content.split('\n');
      const headerIndex = lines.findIndex(l => l.includes(contextHeader));
      if (headerIndex !== -1) {
        let found = false;
        for (let i = headerIndex + 1; i < Math.min(headerIndex + 5, lines.length); i++) {
          if (lines[i].includes('**Root Path**:')) {
            lines[i] = contextLine;
            found = true;
            break;
          }
        }
        if (!found) lines.splice(headerIndex + 1, 0, contextLine);
        content = lines.join('\n');
      } else {
        content = content.trim() + `\n\n${contextHeader}\n${contextLine}\n`;
      }
    } else {
      content = `# PROJECT GUIDELINES & TOOLS (GXCode)\n\n${contextHeader}\n${contextLine}\n`;
    }
    fs.writeFileSync(claudePath, content, 'utf8');

    // 2. GX_IDENTITY.md Generation (If missing)
    if (!fs.existsSync(identityPath)) {
        const idContent = `# GX_IDENTITY\n\nThis file defines your project identity for the GXCode agentic system.\n\n- **Project Name**: ${path.basename(rootDir)}\n- **Generated At**: ${new Date().toISOString()}`;
        fs.writeFileSync(identityPath, idContent, 'utf8');
    }
    
    console.log(`[GX-CLAUDE] Context files synchronized for workspace: ${path.basename(rootDir)}`);
  } catch (err) {
    console.error(`[GX-CLAUDE] Error updating context files:`, err);
  }
}

function updateGeminiContext(workspacePath) {
  if (!workspacePath) return;
  const rootDir = workspacePath.endsWith('.code-workspace') 
    ? path.dirname(workspacePath) 
    : workspacePath;

  const geminiPath = path.join(rootDir, 'GEMINI.md');
  const identityPath = path.join(rootDir, 'GEMINI_IDENTITY.md');
  const contextHeader = '## CURRENT WORKSPACE CONTEXT';
  const contextLine = `- **Root Path**: ./ (Current project root)`;

  if (!fs.existsSync(rootDir)) {
      console.warn(`[GX-GEMINI] Root directory missing: ${rootDir}`);
      return;
  }

  try {
    // 1. GEMINI.md Update/Generation
    let content = '';
    if (fs.existsSync(geminiPath)) {
      content = fs.readFileSync(geminiPath, 'utf8');
      const lines = content.split('\n');
      const headerIndex = lines.findIndex(l => l.includes(contextHeader));
      if (headerIndex !== -1) {
        let found = false;
        for (let i = headerIndex + 1; i < Math.min(headerIndex + 5, lines.length); i++) {
          if (lines[i].includes('**Root Path**:')) {
            lines[i] = contextLine;
            found = true;
            break;
          }
        }
        if (!found) lines.splice(headerIndex + 1, 0, contextLine);
        content = lines.join('\n');
      } else {
        content = content.trim() + `\n\n${contextHeader}\n${contextLine}\n`;
      }
    } else {
      content = `# GEMINI AI - PROJECT CONTEXT (GXCode)\n\n${contextHeader}\n${contextLine}\n`;
    }
    fs.writeFileSync(geminiPath, content, 'utf8');

    // 2. GEMINI_IDENTITY.md Generation (Directive File)
    if (!fs.existsSync(identityPath)) {
        const idContent = `# GEMINI IDENTITY DIRECTIVES\n\nThis file defines your project personality for the Gemini AI agent.\n\n- **Project Name**: ${path.basename(rootDir)}\n- **Directives Version**: 1.0.0\n\n## INSTRUCTIONS\n1. Be an expert ${path.basename(rootDir)} developer.\n2. Follow the patterns defined in the current workspace.`;
        fs.writeFileSync(identityPath, idContent, 'utf8');
    }
    
    console.log(`[GX-GEMINI] Context files synchronized for workspace: ${path.basename(rootDir)}`);
  } catch (err) {
    console.error(`[GX-GEMINI] Error updating context files:`, err);
  }
}

module.exports = { updateClaudeContext, updateGeminiContext };
