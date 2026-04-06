const { ipcMain, app } = require('electron');
const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const { WebSocketServer } = require('ws');
let debugServer = null;
let activeDebugSocket = null;

function resolveTestCwd(filePath, workspacePath) {
    if (!workspacePath) return path.dirname(filePath);
    if (!workspacePath.endsWith('.code-workspace')) return workspacePath;
    try {
        const config = JSON.parse(fs.readFileSync(workspacePath, 'utf8'));
        const folders = (config.folders || []).map(f => path.isAbsolute(f.path) ? f.path : path.resolve(path.dirname(workspacePath), f.path));
        return folders.filter(f => filePath.startsWith(f)).sort((a, b) => b.length - a.length)[0] || path.dirname(filePath);
    } catch (e) { return path.dirname(filePath); }
}

function registerTestHandlers(mainWindow) {
    // Initialize Debug Server if not exists
    if (!debugServer) {
        try {
            debugServer = new WebSocketServer({ port: 9999 });
            debugServer.on('connection', (socket) => {
                activeDebugSocket = socket;
                socket.on('message', (data) => {
                    try {
                        const msg = JSON.parse(data);
                        if (msg.type === 'paused') {
                            if (mainWindow && !mainWindow.isDestroyed()) {
                                mainWindow.webContents.send('test-debug-paused', msg.line);
                            }
                        }
                    } catch (e) { console.error("[GX-DEBUG] JSON parse error:", e); }
                });
                socket.on('close', () => { activeDebugSocket = null; });
                socket.on('error', (e) => { console.error("[GX-DEBUG] Socket error:", e); });
            });
            debugServer.on('error', (e) => {
                console.warn("[GX-DEBUG] WS Server error:", e.message);
                debugServer = null; // Mark as failed
            });
            console.log("[GX-DEBUG] WebSocket Server ready on port 9999");
        } catch (e) {
            console.error("[GX-DEBUG] Failed to init WebSocket server:", e);
        }
    }

    // Restore Debugger Control IPCs
    ipcMain.on('debug-continue', () => {
        if (activeDebugSocket) activeDebugSocket.send(JSON.stringify({ type: 'resume' }));
    });
    ipcMain.on('debug-step', () => {
        if (activeDebugSocket) activeDebugSocket.send(JSON.stringify({ type: 'resume' }));
    });
    ipcMain.on('debug-stop', () => {
        ipcMain.emit('playwright-debug-stop');
        if (activeDebugSocket) activeDebugSocket.send(JSON.stringify({ type: 'resume' }));
    });

    ipcMain.handle('scan-tests', async (event, rootPath) => {
        if (!rootPath) return [];
        console.log(`[TEST-SCAN] Starting scan in: ${rootPath}`);
        const testFiles = [];
        
        const foldersToScan = [];
        if (rootPath.toString().endsWith('.code-workspace')) {
            try {
                const config = JSON.parse(fs.readFileSync(rootPath, 'utf8'));
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
                        if (['node_modules', '.git', 'dist', 'build', 'target', '.next', 'out', 'bin', 'obj'].includes(nameLower)) return;
                        try {
                            await asyncScan(full, root);
                        } catch (e) {}
                    } else if (f.name.match(/\.(spec|test)\.(js|ts|jsx|tsx)$/i)) {
                        try {
                            const content = await fs.promises.readFile(full, 'utf8');
                            const testMatches = [];
                            const lines = content.split('\n');
                            for (let i = 0; i < lines.length; i++) {
                                const m = lines[i].match(/(?:test|it)\s*\(['"`](.*?)['"`]/);
                                if (m) testMatches.push({ name: m[1], line: i + 1, status: 'idle' });
                            }
                            
                            if (testMatches.length) {
                                testFiles.push({
                                    file: f.name,
                                    fullPath: full,
                                    relativePath: path.relative(root, full),
                                    testMatches
                                });
                                console.log(`[TEST-SCAN] Found tests in: ${f.name}`);
                            }
                        } catch (e) {}
                    }
                }));
            } catch (e) {}
        };

        for (const folder of foldersToScan) {
            if (fs.existsSync(folder)) await asyncScan(folder, folder);
        }
        
        console.log(`[TEST-SCAN] Scan finished. Found ${testFiles.length} files.`);
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
        
        // Check node_modules for @playwright/test
        for (const f of folders) { 
            if (fs.existsSync(path.join(f, 'node_modules', '@playwright', 'test'))) return { installed: true }; 
        }
        
        return { installed: false };
    });

    ipcMain.handle('run-test', async (event, workspacePath, filePath, testName) => {
        const ideNodeModules = path.join(process.cwd(), 'node_modules');
        const env = { 
            ...process.env, 
            NODE_PATH: (process.env.NODE_PATH ? process.env.NODE_PATH + path.delimiter : '') + ideNodeModules
        };

        return new Promise((resolve) => {
            const testCwd = resolveTestCwd(filePath, workspacePath);
            const relativePath = path.relative(testCwd, filePath).replace(/\\/g, '/');
            const args = ['playwright', 'test', relativePath];
            if (testName) args.push('-g', testName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
            const child = spawn('npx.cmd', args, { cwd: testCwd, env, shell: true });
            child.stdout.on('data', d => event.sender.send('test-output', d.toString().replace(/\n/g, '\r\n')));
            child.stderr.on('data', d => event.sender.send('test-output', d.toString().replace(/\n/g, '\r\n')));
            child.on('close', code => resolve(code === 0));
        });
    });

    ipcMain.handle('debug-test', async (event, workspacePath, filePath, testName, breakpointLines) => {
        const testCwd = resolveTestCwd(filePath, workspacePath);
        const fileName = path.basename(filePath);
        // Create temp file IN THE SAME DIRECTORY as original to keep relative imports working!
        const tempFilePath = path.join(path.dirname(filePath), `gx_debug_${Date.now()}_${fileName}`);
        const relativeTempPath = path.relative(testCwd, tempFilePath).replace(/\\/g, '/');
        
        // Use IDE's local ws to avoid missing dependency in user workspace
        // If app is packaged (asar), external Node processes (Playwright) can't reach inside it.
        // We use the unpacked version instead.
        let baseDir = app.getAppPath();
        if (baseDir.includes('app.asar') && !baseDir.includes('app.asar.unpacked')) {
            baseDir = baseDir.replace('app.asar', 'app.asar.unpacked');
        }
        
        const wsPath = path.join(baseDir, 'node_modules', 'ws').replace(/\\/g, '\\\\');
        const ideNodeModules = path.join(baseDir, 'node_modules');

        // 1. Read and Instrument the test file
        try {
            let content = fs.readFileSync(filePath, 'utf8');
            const lines = content.split('\n');
            const instrumentedLines = [];
            
            // Inject Bridge Logic at the start
            instrumentedLines.push(`/** GXCODE DEBUG BRIDGE **/`);
            instrumentedLines.push(`const _gxBridge = require('${wsPath}');`);
            instrumentedLines.push(`const _gxWs = new _gxBridge('ws://localhost:9999');`);
            instrumentedLines.push(`global.gxPause = (line) => new Promise(resolve => {`);
            instrumentedLines.push(`  _gxWs.send(JSON.stringify({ type: 'paused', line }));`);
            instrumentedLines.push(`  _gxWs.once('message', (data) => {`);
            instrumentedLines.push(`    const msg = JSON.parse(data);`);
            instrumentedLines.push(`    if (msg.type === 'resume') resolve();`);
            instrumentedLines.push(`  });`);
            instrumentedLines.push(`});`);
            instrumentedLines.push(``);

            for (let i = 0; i < lines.length; i++) {
                const lineNum = i + 1;
                const lineText = lines[i];
                const trimmed = lineText.trim();
                
                // Safe instrumentation logic
                if ((trimmed.startsWith('await ') || trimmed.match(/^(?:const|let|var)\s+.*?\s*=\s*await\s+/)) && 
                    !trimmed.startsWith('//') && !trimmed.startsWith('/*')) {
                    const indent = lineText.match(/^\s*/)[0];
                    instrumentedLines.push(`${indent}await global.gxPause(${lineNum});`);
                }
                instrumentedLines.push(lineText);
            }
            
            fs.writeFileSync(tempFilePath, instrumentedLines.join('\n'));
        } catch (e) {
            console.error("[GX-DEBUG] Instrumentation failed:", e);
            return false;
        }

        return new Promise((resolve) => {
            const args = ['playwright', 'test', relativeTempPath, '--headed'];
            if (testName) args.push('-g', testName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
            
            // Inject NODE_PATH so Playwright finds its own library in the IDE
            const env = { 
                ...process.env, 
                PWDEBUG: '0', 
                NODE_PATH: (process.env.NODE_PATH ? process.env.NODE_PATH + path.delimiter : '') + ideNodeModules
            };

            const child = spawn('npx.cmd', args, { cwd: testCwd, env, shell: true });
            
            // Pipe output to IDE terminal
            child.stdout.on('data', d => event.sender.send('test-output', d.toString().replace(/\n/g, '\r\n')));
            child.stderr.on('data', d => event.sender.send('test-output', d.toString().replace(/\n/g, '\r\n')));

            child.on('close', code => {
                if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
                resolve(code === 0);
            });

            // Handle Stop from IDE
            ipcMain.once('playwright-debug-stop', () => {
                child.kill();
                if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
            });
        });
    });

    ipcMain.handle('install-playwright', async (event, workspacePath) => {
        return new Promise((resolve) => {
            console.log(`[TEST-INSTALL] Installing Playwright in: ${workspacePath}`);
            const cmd = 'npm install -D @playwright/test && npx playwright install';
            // Use shell: true and pipe output
            const child = spawn('powershell.exe', ['-Command', cmd], { cwd: workspacePath, env: process.env, shell: true });
            
            child.stdout.on('data', d => event.sender.send('test-output', d.toString().replace(/\n/g, '\r\n')));
            child.stderr.on('data', d => event.sender.send('test-output', d.toString().replace(/\n/g, '\r\n')));
            
            child.on('close', code => {
                console.log(`[TEST-INSTALL] Finished with code: ${code}`);
                resolve(code === 0);
            });
        });
    });
}

module.exports = { registerTestHandlers };
