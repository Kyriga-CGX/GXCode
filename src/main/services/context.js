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

module.exports = { updateClaudeContext };
