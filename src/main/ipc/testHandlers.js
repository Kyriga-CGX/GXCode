const { ipcMain } = require('electron');
const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');

function resolveTestCwd(filePath, workspacePath) {
    if (!workspacePath) return path.dirname(filePath);
    if (!workspacePath.endsWith('.code-workspace')) return workspacePath;
    try {
        const config = JSON.parse(fs.readFileSync(workspacePath, 'utf8'));
        const folders = (config.folders || []).map(f => path.isAbsolute(f.path) ? f.path : path.resolve(path.dirname(workspacePath), f.path));
        return folders.filter(f => filePath.startsWith(f)).sort((a, b) => b.length - a.length)[0] || path.dirname(filePath);
    } catch (e) { return path.dirname(filePath); }
}

function registerTestHandlers() {
    ipcMain.handle('scan-tests', async (event, rootPath) => {
        if (!rootPath) return [];
        const testFiles = [];
        
        // Risolviamo le cartelle se è un workspace
        const foldersToScan = [];
        if (rootPath.endsWith('.code-workspace')) {
            try {
                const config = JSON.parse(await fs.promises.readFile(rootPath, 'utf8'));
                if (config.folders) {
                    config.folders.forEach(f => {
                        let p = f.path;
                        if (!path.isAbsolute(p)) p = path.resolve(path.dirname(rootPath), p);
                        foldersToScan.push(p);
                    });
                }
            } catch (e) { console.error("[TEST-SCAN] Workspace parse error:", e); }
        } else {
            foldersToScan.push(rootPath);
        }

        const asyncScan = async (dir, root) => {
            try {
                const dirents = await fs.promises.readdir(dir, { withFileTypes: true });
                await Promise.all(dirents.map(async (f) => {
                    const full = path.join(dir, f.name);
                    const nameLower = f.name.toLowerCase();

                    if (f.isDirectory()) {
                        // Esclusioni pesanti
                        if (['node_modules', '.git', 'dist', 'build', 'target', '.next', 'out', 'bin', 'obj'].includes(nameLower)) return;
                        await asyncScan(full, root);
                    } else if (f.name.match(/\.(spec|test)\.(js|ts|jsx|tsx)$/i)) {
                        try {
                            const content = await fs.promises.readFile(full, 'utf8');
                            const testMatches = content.split('\n').map((line, i) => {
                                const m = line.match(/(?:test|it)\s*\(['"`](.*?)['"`]/);
                                return m ? { name: m[1], line: i + 1, status: 'idle' } : null;
                            }).filter(Boolean);
                            
                            if (testMatches.length) {
                                testFiles.push({
                                    file: f.name,
                                    fullPath: full,
                                    relativePath: path.relative(root, full),
                                    testMatches
                                });
                            }
                        } catch (e) {}
                    }
                }));
            } catch (e) {}
        };

        for (const folder of foldersToScan) {
            if (fs.existsSync(folder)) await asyncScan(folder, folder);
        }
        
        return testFiles;
    });

    ipcMain.handle('check-playwright', async (event, workspacePath) => {
        if (!workspacePath) return { installed: false };
        const folders = [workspacePath];
        if (workspacePath.endsWith('.code-workspace')) {
            try {
                const config = JSON.parse(fs.readFileSync(workspacePath, 'utf8'));
                folders.push(...(config.folders || []).map(f => path.isAbsolute(f.path) ? f.path : path.resolve(path.dirname(workspacePath), f.path)));
            } catch (e) {}
        }
        for (const f of folders) { if (fs.existsSync(path.join(f, 'node_modules', '@playwright', 'test'))) return { installed: true }; }
        return new Promise((resolve) => { exec('npx playwright --version', { cwd: folders[0] }, (err) => resolve({ installed: !err })); });
    });

    ipcMain.handle('run-test', async (event, workspacePath, filePath, testName) => {
        return new Promise((resolve) => {
            const testCwd = resolveTestCwd(filePath, workspacePath);
            const relativePath = path.relative(testCwd, filePath).replace(/\\/g, '/');
            const args = ['playwright', 'test', `"${relativePath}"`, '--project=chromium'];
            if (testName) args.push('-g', `"${testName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`);
            const child = spawn('npx.cmd', args, { cwd: testCwd, env: { ...process.env, FORCE_COLOR: '1' }, shell: true });
            child.stdout.on('data', d => event.sender.send('test-output', d.toString().replace(/\n/g, '\r\n')));
            child.stderr.on('data', d => event.sender.send('test-output', d.toString().replace(/\n/g, '\r\n')));
            child.on('close', code => resolve(code === 0));
        });
    });

    ipcMain.handle('debug-test', async (event, workspacePath, filePath, testName) => {
        return new Promise((resolve) => {
            const testCwd = resolveTestCwd(filePath, workspacePath);
            const relativePath = path.relative(testCwd, filePath).replace(/\\/g, '/');
            const args = ['playwright', 'test', `"${relativePath}"`, '--headed', '--debug'];
            if (testName) args.push('-g', `"${testName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`);
            const child = spawn('npx.cmd', args, { cwd: testCwd, env: { ...process.env, PWDEBUG: '0' }, shell: true });
            child.on('close', code => resolve(code === 0));
        });
    });

    ipcMain.handle('run-all-tests', async (event, workspacePath) => {
        return new Promise((resolve) => {
            exec('npx playwright test --reporter=json', { cwd: workspacePath }, (err, stdout) => {
                try { resolve(JSON.parse(stdout)); } catch (e) { resolve({ success: !err }); }
            });
        });
    });
}

module.exports = { registerTestHandlers };
