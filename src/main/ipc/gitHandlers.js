const { ipcMain } = require('electron');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

function registerGitHandlers() {
    const runGit = (args, workspacePath) => {
        try {
            const cwd = workspacePath || process.cwd();
            return execSync(`git ${args}`, { encoding: 'utf8', cwd });
        } catch (err) {
            console.error(`[GIT] Error running: git ${args}`, err.message);
            throw err;
        }
    };

    ipcMain.handle('git-status', async (event, workspacePath) => {
        try {
            const status = runGit('status --porcelain', workspacePath);
            const branch = runGit('branch --show-current', workspacePath).trim();
            const files = status.split('\n').filter(l => l.trim()).map(line => ({
                path: line.substring(3), status: line.substring(0, 2).trim()
            }));
            return { success: true, files, branch };
        } catch (err) { return { success: false, error: err.message }; }
    });

    ipcMain.handle('git-remote-url', async (event, workspacePath) => {
        try {
            const url = runGit('remote get-url origin', workspacePath).trim();
            return { success: true, url };
        } catch (err) { return { success: false, error: "No remote origin" }; }
    });

    ipcMain.handle('git-pull', async (event, workspacePath) => {
        try {
            const output = runGit('pull', workspacePath);
            return { success: true, output };
        } catch (err) { return { success: false, error: err.message }; }
    });

    ipcMain.handle('git-push', async (event, workspacePath) => {
        try {
            const output = runGit('push', workspacePath);
            return { success: true, output };
        } catch (err) { return { success: false, error: err.message }; }
    });

    ipcMain.handle('git-diff', async (event, workspacePath, filePath) => {
        try {
            const output = runGit(`diff "${filePath}"`, workspacePath);
            if (!output) {
                const status = runGit(`status --porcelain "${filePath}"`, workspacePath);
                if (status.includes('??')) {
                    const content = await fs.promises.readFile(filePath, 'utf8');
                    return { success: true, diff: content, isUntracked: true };
                }
            }
            return { success: true, diff: output };
        } catch (err) { return { success: false, error: err.message }; }
    });

    ipcMain.handle('git-show-head', async (event, workspacePath, filePath) => {
        try {
            const rel = path.relative(workspacePath || process.cwd(), filePath).replace(/\\/g, '/');
            const output = runGit(`show "HEAD:${rel}"`, workspacePath);
            return { success: true, content: output };
        } catch (err) { return { success: false, error: err.message }; }
    });

    ipcMain.handle('git-stage', async (event, workspacePath, filePath) => {
        try { runGit(`add "${filePath}"`, workspacePath); return { success: true }; }
        catch (err) { return { success: false, error: err.message }; }
    });

    ipcMain.handle('git-commit', async (event, workspacePath, message) => {
        try { runGit(`commit -m "${message}"`, workspacePath); return { success: true }; }
        catch (err) { return { success: false, error: err.message }; }
    });
}

module.exports = { registerGitHandlers };
