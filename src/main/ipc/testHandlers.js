const { ipcMain, app } = require('electron');
const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { WebSocketServer } = require('ws');
let debugServer = null;
let activeDebugSocket = null;
let debugServerPort = 9999;

// Funzione per trovare una porta libera
function findAvailablePort(startPort, maxAttempts = 10) {
    return new Promise((resolve, reject) => {
        const net = require('net');
        let currentPort = startPort;
        let attempts = 0;

        const tryPort = (port) => {
            const server = net.createServer();
            server.listen(port, '127.0.0.1', () => {
                server.once('close', () => {
                    resolve(port);
                });
                server.close();
            });
            server.on('error', (err) => {
                if (err.code === 'EADDRINUSE') {
                    attempts++;
                    if (attempts >= maxAttempts) {
                        reject(new Error(`No available ports found after ${maxAttempts} attempts`));
                    } else {
                        tryPort(port + 1);
                    }
                } else {
                    reject(err);
                }
            });
        };

        tryPort(currentPort);
    });
}

function resolveTestCwd(filePath, workspacePath) {
    if (!workspacePath) return path.dirname(filePath);
    if (!workspacePath.endsWith('.code-workspace')) return workspacePath;
    try {
        const config = JSON.parse(fs.readFileSync(workspacePath, 'utf8'));
        const folders = (config.folders || []).map(f => path.isAbsolute(f.path) ? f.path : path.resolve(path.dirname(workspacePath), f.path));
        
        // Fix: aggiungi path separator per evitare match parziali (es. C:\projects vs C:\projects-extra)
        const sep = path.sep;
        const matchingFolders = folders.filter(f => {
            const folderWithSep = f.endsWith(sep) ? f : f + sep;
            const fileWithCheck = filePath.startsWith(folderWithSep) || filePath === f;
            return fileWithCheck;
        });
        
        return matchingFolders.sort((a, b) => b.length - a.length)[0] || path.dirname(filePath);
    } catch (e) { return path.dirname(filePath); }
}

function registerTestHandlers(mainWindow) {
    // Initialize Debug Server if not exists
    if (!debugServer) {
        try {
            // Find available port starting from 9999
            findAvailablePort(9999).then((port) => {
                debugServerPort = port;
                console.log(`[GX-DEBUG] Using port ${port} for WebSocket debug server`);
                
                debugServer = new WebSocketServer({ port });
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
                console.log(`[GX-DEBUG] WebSocket Server ready on port ${port}`);
            }).catch((err) => {
                console.error("[GX-DEBUG] Failed to find available port:", err);
            });
        } catch (e) {
            console.error("[GX-DEBUG] Failed to init WebSocket server:", e);
        }
    }

    // Listen to internal debugger events (from debugHandlers.js)
    ipcMain.on('gx-debug:internal:continue', () => {
        if (activeDebugSocket) activeDebugSocket.send(JSON.stringify({ type: 'resume' }));
    });
    ipcMain.on('gx-debug:internal:step', () => {
        if (activeDebugSocket) activeDebugSocket.send(JSON.stringify({ type: 'resume' }));
    });
    ipcMain.on('gx-debug:internal:stop', () => {
        ipcMain.emit('playwright-debug-stop'); // Kill child process
        if (activeDebugSocket) activeDebugSocket.send(JSON.stringify({ type: 'resume' })); // Release loop
    });

    ipcMain.handle('scan-tests', async (event, rootPath) => {
        if (!rootPath) {
            console.log('[TEST-SCAN] No rootPath provided');
            return [];
        }
        
        console.log(`[TEST-SCAN] ========== STARTING SCAN ==========`);
        console.log(`[TEST-SCAN] Root path: ${rootPath}`);
        console.log(`[TEST-SCAN] Path exists: ${fs.existsSync(rootPath)}`);
        console.log(`[TEST-SCAN] Is workspace file: ${rootPath.endsWith('.code-workspace')}`);
        
        const testFiles = [];
        const foldersToScan = [];
        
        if (rootPath.toString().endsWith('.code-workspace')) {
            console.log(`[TEST-SCAN] Detected workspace file`);
            try {
                const config = JSON.parse(fs.readFileSync(rootPath, 'utf8'));
                if (config.folders) {
                    config.folders.forEach(f => {
                        let p = f.path;
                        if (!path.isAbsolute(p)) p = path.resolve(path.dirname(rootPath), p);
                        foldersToScan.push({ absPath: p, id: p, name: f.name || path.basename(p) });
                    });
                }
            } catch (e) { console.error("[TEST-SCAN] Workspace parse error:", e); }
        } else {
            // PROGETTO SINGOLO - usa il path assoluto come ID
            console.log(`[TEST-SCAN] Detected single project folder`);
            foldersToScan.push({ 
                absPath: rootPath, 
                id: rootPath,  // FIX: usa rootPath invece di '.'
                name: path.basename(rootPath) 
            });
        }
        
        console.log(`[TEST-SCAN] Folders to scan: ${foldersToScan.length}`);
        foldersToScan.forEach((f, i) => {
            console.log(`[TEST-SCAN]   [${i+1}] ${f.absPath} (id: ${f.id})`);
        });

        const asyncScan = async (dir, root, folderId) => {
            try {
                console.log(`[TEST-SCAN] 📂 Reading directory: ${dir}`);
                const dirents = await fs.promises.readdir(dir, { withFileTypes: true });
                console.log(`[TEST-SCAN] Found ${dirents.length} entries in ${dir}`);
                
                // Show test files found in this directory
                const testFilesInDir = dirents.filter(d => !d.isDirectory() && 
                    (d.name.match(/[\._-](spec|test)\.(js|ts|jsx|tsx|mjs)$/i) || 
                     d.name.match(/\.(spec|test)\.(js|ts|jsx|tsx|mjs)$/i)));
                
                if (testFilesInDir.length > 0) {
                    console.log(`[TEST-SCAN]  Test files in this directory:`, testFilesInDir.map(f => f.name));
                }
                
                await Promise.all(dirents.map(async (f) => {
                    const full = path.join(dir, f.name);
                    const nameLower = f.name.toLowerCase();

                    if (f.isDirectory()) {
                        if (['node_modules', '.git', 'dist', 'build', 'target', '.next', 'out', 'bin', 'obj'].includes(nameLower)) {
                            console.log(`[TEST-SCAN] Skipping excluded directory: ${full}`);
                            return;
                        }
                        try {
                            await asyncScan(full, root, folderId);
                        } catch (e) {
                            console.warn(`[TEST-SCAN] Error scanning ${full}:`, e.message);
                        }
                    } else if (f.name.match(/[\._-](spec|test)\.(js|ts|jsx|tsx|mjs)$/i) || 
                               f.name.match(/\.(spec|test)\.(js|ts|jsx|tsx|mjs)$/i) ||
                               f.name.match(/^(spec|test)\.(js|ts|jsx|tsx|mjs)$/i)) {
                        console.log(`[TEST-SCAN] ✅✅✅ MATCHED test file: ${f.name} at ${full}`);
                        try {
                            const content = await fs.promises.readFile(full, 'utf8');
                            const testMatches = [];
                            const lines = content.split('\n');
                            
                            // Multiple patterns to catch test formats ONLY (exclude describe):
                            // test('name', ...)
                            // it('name', ...)
                            const testPattern = /(?:^|\s)(?:test|it)\s*\(\s*['"`](.*?)['"`]/;
                            
                            for (let i = 0; i < lines.length; i++) {
                                const m = lines[i].match(testPattern);
                                if (m) {
                                    const testName = m[1].trim();
                                    // Evita duplicati nello stesso file
                                    if (!testMatches.some(t => t.name === testName)) {
                                        testMatches.push({ name: testName, line: i + 1, status: 'idle' });
                                    }
                                }
                            }

                            if (testMatches.length) {
                                testFiles.push({
                                    file: f.name,
                                    fullPath: full,
                                    relativePath: path.relative(root, full),
                                    folderId: folderId,
                                    testMatches
                                });
                                console.log(`[TEST-SCAN] Found ${testMatches.length} test(s) in: ${f.name} (Project: ${folderId})`);
                            } else {
                                console.log(`[TEST-SCAN] File ${f.name} matched pattern but no test/it/describe calls found`);
                                // Print first 20 lines for debugging
                                console.log(`[TEST-SCAN] First 20 lines of ${f.name}:`, content.split('\n').slice(0, 20).join('\n'));
                            }
                        } catch (e) {
                            console.warn(`[TEST-SCAN] Error reading ${full}:`, e.message);
                        }
                    }
                }));
            } catch (e) {
                console.warn(`[TEST-SCAN] Error reading directory ${dir}:`, e.message);
            }
        };

        for (const folder of foldersToScan) {
            console.log(`[TEST-SCAN] >>> Scanning folder: ${folder.absPath}`);
            console.log(`[TEST-SCAN]     Folder exists: ${fs.existsSync(folder.absPath)}`);
            console.log(`[TEST-SCAN]     Folder ID: ${folder.id}`);
            console.log(`[TEST-SCAN]     Folder name: ${folder.name}`);
            
            if (fs.existsSync(folder.absPath)) {
                // List first 20 items to understand structure
                try {
                    const firstItems = await fs.promises.readdir(folder.absPath, { withFileTypes: true });
                    console.log(`[TEST-SCAN] First items in folder:`, firstItems.slice(0, 20).map(i => `${i.isDirectory() ? '📁' : '📄'} ${i.name}`));
                    
                    // Count total files
                    let totalFiles = 0;
                    let totalDirs = 0;
                    for (const item of firstItems) {
                        if (item.isDirectory()) totalDirs++;
                        else totalFiles++;
                    }
                    console.log(`[TEST-SCAN] Total: ${totalFiles} files, ${totalDirs} directories (showing first ${firstItems.length})`);
                } catch (e) {
                    console.log(`[TEST-SCAN] Could not list folder:`, e.message);
                }
                
                await asyncScan(folder.absPath, folder.absPath, folder.id);
            } else {
                console.log(`[TEST-SCAN] WARNING: Folder does not exist!`);
            }
        }

        // --- INTELLIGENT DE-DUPLICATION (v1.5.8) ---
        const dedupedMap = new Map();
        testFiles.forEach(tf => {
            const normPath = tf.fullPath.toLowerCase().replace(/\\/g, '/');
            const existing = dedupedMap.get(normPath);
            if (!existing || tf.folderId.length > existing.folderId.length) {
                dedupedMap.set(normPath, tf);
            }
        });

        const finalTestFiles = Array.from(dedupedMap.values());
        console.log(`[TEST-SCAN] Scan finished. Original: ${testFiles.length} | Deduped: ${finalTestFiles.length}`);
        if (finalTestFiles.length > 0) {
            console.log(`[TEST-SCAN] Found test files:`, finalTestFiles.map(f => f.relativePath));
        }
        return finalTestFiles;
    });

    ipcMain.handle('check-playwright', async (event, workspacePath) => {
        if (!workspacePath) return { installed: false, browsersInstalled: false };
        const folders = [workspacePath];
        if (workspacePath.endsWith('.code-workspace')) {
            try {
                const config = JSON.parse(fs.readFileSync(workspacePath, 'utf8'));
                folders.push(...(config.folders || []).map(f => path.isAbsolute(f.path) ? f.path : path.resolve(path.dirname(workspacePath), f.path)));
            } catch (e) {}
        }

        let playwrightInstalled = false;
        let browsersInstalled = false;
        let browsersFoundIn = '';

        // Check node_modules for @playwright/test
        for (const f of folders) {
            const pkgPath = path.join(f, 'node_modules', '@playwright', 'test');
            if (fs.existsSync(pkgPath)) {
                playwrightInstalled = true;
                console.log(`[PLAYWRIGHT-CHECK] Found @playwright/test in: ${pkgPath}`);
                
                // Check multiple possible browser locations
                const possiblePaths = [
                    path.join(f, 'node_modules', '.cache', 'ms-playwright'),
                    path.join(f, 'node_modules', 'playwright-core', '.local-browsers'),
                    path.join(process.env.HOME || process.env.USERPROFILE || '', '.cache', 'ms-playwright'),
                    path.join(process.env.LOCALAPPDATA || '', 'ms-playwright'), // Windows standard
                ];
                
                for (const browsersPath of possiblePaths) {
                    if (fs.existsSync(browsersPath)) {
                        try {
                            const items = fs.readdirSync(browsersPath);
                            // Filter for actual browser folders (e.g., chromium-1234)
                            const validBrowsers = items.filter(b => 
                                !b.startsWith('.') && 
                                !b.endsWith('.zip') && 
                                !b.endsWith('.lock') &&
                                b.length > 5
                            );
                            if (validBrowsers.length > 0) {
                                browsersInstalled = true;
                                browsersFoundIn = browsersPath;
                                console.log(`[PLAYWRIGHT-CHECK] ✅ Found ${validBrowsers.length} browsers in: ${browsersPath}`);
                                break;
                            }
                        } catch (e) {}
                    }
                }
                
                if (!browsersInstalled) {
                    console.log(`[PLAYWRIGHT-CHECK] ⚠️ Playwright package found, but NO browsers found in standard locations.`);
                    console.log(`[PLAYWRIGHT-CHECK] Searched:`, possiblePaths);
                }
                break;
            }
        }

        return { 
            installed: playwrightInstalled, 
            browsersInstalled,
            debugPath: browsersFoundIn // For logging
        };
    });

    ipcMain.handle('get-debug-port', async () => {
        return debugServerPort;
    });

    ipcMain.handle('run-test', async (event, workspacePath, filePath, testName) => {
        const ideNodeModules = path.join(app.getAppPath(), 'node_modules');
        const env = {
            ...process.env,
            NODE_PATH: (process.env.NODE_PATH ? process.env.NODE_PATH + path.delimiter : '') + ideNodeModules
        };

        return new Promise((resolve) => {
            const testCwd = resolveTestCwd(filePath, workspacePath);
            const relativePath = path.relative(testCwd, filePath).replace(/\\/g, '/');
            // Passa il path relativo come filtro file + --grep ancorato per isolare il singolo test
            const args = ['playwright', 'test', relativePath];
            if (testName) {
                const escapedName = testName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                args.push('--grep', escapedName);
            }

            // Cross-platform: usa 'npx' invece di 'npx.cmd'
            const npx = os.platform() === 'win32' ? 'npx.cmd' : 'npx';
            const child = spawn(npx, args, { cwd: testCwd, env, shell: true });
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
            instrumentedLines.push(`const _gxWs = new _gxBridge('ws://localhost:${debugServerPort}');`);
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

            // Cross-platform: usa 'npx' invece di 'npx.cmd'
            const npx = os.platform() === 'win32' ? 'npx.cmd' : 'npx';
            const child = spawn(npx, args, { cwd: testCwd, env, shell: true });
            
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
            const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';
            const cmd = os.platform() === 'win32' 
                ? 'npm install -D @playwright/test && npx playwright install'
                : 'npm install -D @playwright/test && npx playwright install';
            
            const child = spawn(shell, os.platform() === 'win32' ? ['-Command', cmd] : ['-c', cmd], { 
                cwd: workspacePath, 
                env: process.env, 
                shell: true 
            });

            child.stdout.on('data', d => event.sender.send('test-output', d.toString().replace(/\n/g, '\r\n')));
            child.stderr.on('data', d => event.sender.send('test-output', d.toString().replace(/\n/g, '\r\n')));

            child.on('close', code => {
                console.log(`[TEST-INSTALL] Finished with code: ${code}`);
                resolve(code === 0);
            });
        });
    });

    ipcMain.handle('run-all-tests', async (event, workspacePath) => {
        const ideNodeModules = path.join(app.getAppPath(), 'node_modules');
        const env = {
            ...process.env,
            NODE_PATH: (process.env.NODE_PATH ? process.env.NODE_PATH + path.delimiter : '') + ideNodeModules
        };

        const foldersToRun = [];
        if (workspacePath.endsWith('.code-workspace')) {
            try {
                const config = JSON.parse(fs.readFileSync(workspacePath, 'utf8'));
                if (config.folders) {
                    config.folders.forEach(f => {
                        let p = f.path;
                        if (!path.isAbsolute(p)) p = path.resolve(path.dirname(workspacePath), p);
                        foldersToRun.push(p);
                    });
                }
            } catch (e) { 
                console.error("[TEST-RUN-ALL] Workspace parse error:", e);
                foldersToRun.push(path.dirname(workspacePath));
            }
        } else {
            foldersToRun.push(workspacePath);
        }

        const results = [];
        for (const folder of foldersToRun) {
            if (!fs.existsSync(folder)) continue;
            
            console.log(`[TEST-RUN-ALL] Running all tests in: ${folder}`);
            const npx = os.platform() === 'win32' ? 'npx.cmd' : 'npx';
            const child = spawn(npx, ['playwright', 'test', '--reporter=json'], { 
                cwd: folder, 
                env, 
                shell: true 
            });

            let output = '';
            child.stdout.on('data', d => {
                const text = d.toString();
                output += text;
                event.sender.send('test-output', text.replace(/\n/g, '\r\n'));
            });
            child.stderr.on('data', d => {
                const text = d.toString();
                output += text;
                event.sender.send('test-output', text.replace(/\n/g, '\r\n'));
            });

            await new Promise((resolve) => {
                child.on('close', code => {
                    console.log(`[TEST-RUN-ALL] Finished in ${folder} with code: ${code}`);
                    results.push({ folder, exitCode: code });
                    resolve();
                });
            });
        }

        return results.every(r => r.exitCode === 0);
    });
}

module.exports = { registerTestHandlers };
