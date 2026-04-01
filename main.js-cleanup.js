  ipcMain.handle('git-push', async (event, workspacePath) => {
    try {
      const { execSync } = require('child_process');
      const output = execSync('git push', { encoding: 'utf8', cwd: workspacePath || process.cwd() });
      return { success: true, output };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('clipboard-read', () => {
    const { clipboard } = require('electron');
    return clipboard.readText();
  });
