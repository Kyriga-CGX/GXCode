import { state, subscribe, setState } from '../core/state.js';

export const initTests = () => {
    const btnRunAll = document.getElementById('btn-run-all-tests');
    const btnScan = document.getElementById('btn-scan-tests');
    const treeRoot = document.getElementById('test-tree-root');
    
    if (!treeRoot) return;

    const t = (key) => window.t(key) || key;

    // Listen for test output globally
    window.electronAPI.onTestOutput((data) => {
        if (window.writeToTestTerminal) {
            window.writeToTestTerminal(data);
        }
    });

    const collapsedFolders = new Set();

    window.toggleTestFolder = (folderPath) => {
        if (collapsedFolders.has(folderPath)) {
            collapsedFolders.delete(folderPath);
        } else {
            collapsedFolders.add(folderPath);
        }
        renderTestTree();
    };

    window.viewTestFile = (filePath) => {
        const decodedPath = decodeURIComponent(filePath);
        const fileName = decodedPath.split(/[/\\]/).pop();
        window.openFileInIDE(decodedPath, fileName);
    };

    /**
     * Logica "Joined Folders" (VS Code Style)
     * Se una cartella ha un unico figlio ed è anch'esso una cartella, li uniamo.
     */
    const renderNode = (node, name, fullPath = '') => {
        const currentPath = fullPath ? `${fullPath}/${name}` : name;
        const isFolder = node.type === 'folder';
        const isCollapsed = collapsedFolders.has(currentPath);

        if (isFolder) {
            let displayName = name;
            let currentNode = node;
            let joinedPath = currentPath;

            // Se la cartella ha un solo figlio ed è una cartella, la uniamo ricorsivamente
            while (true) {
                const childKeys = Object.keys(currentNode.children);
                if (childKeys.length === 1) {
                    const nextNode = currentNode.children[childKeys[0]];
                    if (nextNode.type === 'folder') {
                        displayName += ` / ${childKeys[0]}`;
                        joinedPath += `/${childKeys[0]}`;
                        currentNode = nextNode;
                    } else {
                        break;
                    }
                } else {
                    break;
                }
            }

            const children = Object.entries(currentNode.children)
                .sort(([aName, aNode], [bName, bNode]) => {
                    if (aNode.type !== bNode.type) return aNode.type === 'folder' ? -1 : 1;
                    return aName.localeCompare(bName);
                })
                .map(([childName, childNode]) => renderNode(childNode, childName, joinedPath))
                .join('');

            return `
                <div class="test-tree-folder group mb-0.5" data-path="${joinedPath}">
                    <div class="flex items-center justify-between py-1.5 px-3 hover:bg-white/5 rounded-lg cursor-pointer transition-all duration-200" onclick="window.toggleTestFolder('${currentPath}')">
                        <div class="flex items-center gap-2 overflow-hidden flex-1">
                            <svg class="text-gray-500 transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="m6 9 6 6 6-6"/></svg>
                            <svg class="text-blue-500/80 shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                            <span class="text-[11px] font-bold text-gray-300 truncate" title="${joinedPath}">${displayName}</span>
                        </div>
                        <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                             <button onclick="event.stopPropagation(); window.runFileTests('${encodeURIComponent(joinedPath)}')" class="p-1 px-1.5 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white transition-all active:scale-90" title="Esegui Tutti i Test nella Cartella">
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="m5 3 14 9-14 9V3z"/></svg>
                             </button>
                        </div>
                    </div>
                    <div class="pl-4 border-l border-white/5 ml-4 mt-0.5 ${isCollapsed ? 'hidden' : 'flex flex-col'}">
                        ${children}
                    </div>
                </div>
            `;
        } else {
            const file = node.data;
            const fileName = name;
            const safeAbsPath = encodeURIComponent(file.fullPath);

            const testsHtml = file.testMatches.map(test => {
                const isFailed = test.status === 'failed';
                const isPassed = test.status === 'passed';
                const isRunning = test.status === 'running';

                const statusIcon = isRunning ? `<div class="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>` :
                                   isFailed ? `<div class="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]"></div>` :
                                   isPassed ? `<div class="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]"></div>` : 
                                   `<div class="w-1 h-1 rounded-full bg-gray-700"></div>`;

                return `
                    <div class="test-tree-item flex items-center justify-between py-1.5 px-3 rounded-lg hover:bg-white/5 transition-all cursor-pointer group" onclick="window.viewTestFile('${safeAbsPath}')">
                        <div class="flex items-center gap-2 overflow-hidden flex-1">
                            <div class="shrink-0 flex items-center justify-center p-0.5">${statusIcon}</div>
                            <span class="text-[10px] text-gray-500 font-medium truncate group-hover:text-white transition-colors tracking-tight">${test.name}</span>
                        </div>
                        <div class="flex gap-1.5 items-center opacity-0 group-hover:opacity-100 transition-opacity ml-2 shrink-0">
                            <button onclick="event.stopPropagation(); window.runSingleTest('${safeAbsPath}', '${encodeURIComponent(test.name)}')" class="p-1 rounded-lg bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white transition-all active:scale-95" title="Run Test">
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="m5 3 14 9-14 9V3z"/></svg>
                            </button>
                            <button onclick="event.stopPropagation(); window.debugSingleTest('${safeAbsPath}', '${encodeURIComponent(test.name)}')" class="p-1 rounded-lg bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500 hover:text-white transition-all active:scale-95" title="Debug in Inspector">
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M12 2a10 10 0 1 0 10 10"/><path d="m16.2 16.2 3.8 3.8"/></svg>
                            </button>
                        </div>
                    </div>
                `;
            }).join('');

            return `
                <div class="test-tree-file group mb-1">
                    <div class="flex items-center justify-between gap-2 py-1.5 px-3 hover:bg-white/5 rounded-lg cursor-pointer transition-all duration-200" onclick="window.viewTestFile('${safeAbsPath}')">
                        <div class="flex items-center gap-2 overflow-hidden flex-1">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" class="text-emerald-500 shrink-0 opacity-80" stroke="currentColor" stroke-width="2.5"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                            <span class="text-[11px] font-bold text-gray-200 truncate tracking-tight" title="${file.fullPath}">${fileName}</span>
                        </div>
                        <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onclick="event.stopPropagation(); window.runFileTests('${safeAbsPath}')" class="p-1 px-1.5 rounded-lg bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white transition-all active:scale-90" title="Run All Tests in File">
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="m5 3 14 9-14 9V3z"/></svg>
                            </button>
                        </div>
                    </div>
                    <div class="flex flex-col gap-0.5 mt-0.5 ml-4 border-l border-white/5 pl-2">
                        ${testsHtml}
                    </div>
                </div>
            `;
        }
    };


    const renderTestTree = () => {
        const { workspaceData, testFilesCache, isPlaywrightInstalled, isInstalling } = state;
        const t = (key) => {
            try {
                const val = key.split('.').reduce((o, i) => (o ? o[i] : undefined), window.gxTranslations);
                return val || key;
            } catch (e) { return key; }
        };

        if (!workspaceData || !workspaceData.path) {
            treeRoot.innerHTML = `<div class="opacity-20 text-[9px] uppercase text-gray-500 font-bold text-center mt-10">${t('tests.openWorkspace')}</div>`;
            return;
        }

        if (isInstalling) {
            treeRoot.innerHTML = `
                <div class="p-8 text-center space-y-6 animate-pulse">
                    <div class="flex justify-center">
                        <div class="relative w-12 h-12">
                            <div class="absolute inset-0 border-4 border-blue-500/20 rounded-full"></div>
                            <div class="absolute inset-0 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    </div>
                    <div class="space-y-2">
                        <h3 class="text-[11px] font-bold text-white uppercase tracking-widest">Installazione in corso...</h3>
                        <p class="text-[9px] text-gray-400">Scarico Playwright e i browser richiesti.</p>
                    </div>
                    <div class="p-3 bg-black/40 rounded-lg border border-white/5 font-mono text-[8px] text-gray-500 text-left overflow-hidden">
                        Controlla il terminale per i dettagli
                    </div>
                </div>
            `;
            return;
        }

        if (!isPlaywrightInstalled) {
            treeRoot.innerHTML = `
                <div class="p-4 text-center space-y-4 bg-yellow-500/5 rounded-xl border border-yellow-500/10 animate-fade-in">
                    <div class="flex justify-center"><div class="p-3 bg-yellow-500/10 rounded-full text-yellow-500"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div></div>
                    <h3 class="text-[10px] font-bold text-white uppercase tracking-wider">${t('tests.missingPlaywright')}</h3>
                    <button onclick="window.autoInstallPlaywright()" class="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-[9px] font-bold rounded-lg transition uppercase flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20">Install Playwright</button>
                </div>
            `;
            return;
        }

        if (!testFilesCache || testFilesCache.length === 0) {
            treeRoot.innerHTML = `<div class="opacity-20 text-[9px] uppercase text-gray-500 font-bold text-center mt-10">${t('tests.noTests')}</div>`;
            return;
        }

        const treeStructure = {};
        testFilesCache.forEach(file => {
            // Fix: Su Windows i path usano \, dobbiamo normalizzarli tutti in /
            const normalizedPath = file.relativePath.replace(/\\/g, '/');
            const parts = normalizedPath.split('/');
            let current = treeStructure;
            parts.forEach((part, index) => {
                if (index === parts.length - 1) {
                    current[part] = { type: 'file', data: file };
                } else {
                    if (!current[part]) current[part] = { type: 'folder', children: {} };
                    current = current[part].children;
                }
            });
        });

        treeRoot.innerHTML = Object.entries(treeStructure)
            .sort(([aName, aNode], [bName, bNode]) => {
                if (aNode.type !== bNode.type) return aNode.type === 'folder' ? -1 : 1;
                return aName.localeCompare(bName);
            })
            .map(([name, node]) => renderNode(node, name))
            .join('') || `<div class="opacity-20 text-[9px] uppercase text-gray-500 font-bold text-center mt-10">Nessun test trovato</div>`;
    };

    const scanWorkspaceForTests = async () => {
        if (!state.workspaceData || !state.workspaceData.path) return;
        
        try {
            const res = await window.electronAPI.checkPlaywright(state.workspaceData.path);
            setState({ isPlaywrightInstalled: !!res?.installed });
            
            if (!state.isPlaywrightInstalled) {
                renderTestTree();
                return;
            }

            treeRoot.innerHTML = `<div class="opacity-40 text-[9px] uppercase text-blue-400 font-bold text-center mt-10 animate-pulse">${t('tests.scanning')}...</div>`;
            const results = await window.electronAPI.scanTests(state.workspaceData.path);
            setState({ testFilesCache: results });
            renderTestTree();
        } catch(e) {
            treeRoot.innerHTML = `<div class="opacity-50 text-[9px] uppercase text-red-500 font-bold text-center mt-10">Errore scansione: ${e.message}</div>`;
        }
    };

    window.runSingleTest = async (filePath, testName) => {
        const decodedPath = decodeURIComponent(filePath);
        const decodedName = decodeURIComponent(testName);
        console.log(`[GX-TESTS] Running test: ${decodedName} in ${decodedPath}`);
        
        setState({ isTestingInProgress: true, testTarget: 'run' });
        try {
            await window.electronAPI.runTest(state.workspaceData.path, decodedPath, decodedName);
        } catch (err) {
            console.error("[GX-TESTS] Error:", err);
        } finally {
            setState({ isTestingInProgress: false });
        }
    };

    window.debugSingleTest = async (filePath, testName) => {
        const decodedPath = decodeURIComponent(filePath);
        const decodedName = decodeURIComponent(testName);
        console.log(`[GX-TESTS] Debugging test: ${decodedName} in ${decodedPath}`);
        
        setState({ isTestingInProgress: true, testTarget: 'debug', isDebugModeActive: true, debugActiveLine: null });
        try {
            const normDecoded = decodedPath.toLowerCase().replace(/\\/g, '/');
            // Get ONLY Playwright breakpoints for this file
            const fileBreakpoints = (state.breakpoints || [])
                .filter(bp => normalizePath(bp.path) === normDecoded && bp.type === 'playwright')
                .map(bp => bp.line);
            
            await window.electronAPI.debugTest(state.workspaceData.path, decodedPath, decodedName, fileBreakpoints);
        } finally {
            setState({ isTestingInProgress: false, isDebugModeActive: false, debugActiveLine: null });
            if (window.updateDebugActiveLine) window.updateDebugActiveLine();
        }
    };

    // Helper for normalized path shared with editor.js
    const normalizePath = (p) => {
        if (!p) return "";
        let path = p.toString().trim().toLowerCase().replace(/\\/g, '/');
        if (path.startsWith('file:///')) path = path.replace('file:///', '');
        return path;
    };

    // Listen for debug pause event
    window.electronAPI.onTestDebugPaused((line) => {
        console.log(`[GX-TESTS] Debugger paused at line: ${line}`);
        setState({ debugActiveLine: line });
        if (window.updateDebugActiveLine) window.updateDebugActiveLine();
        
        // Auto-scroll to line
        if (window.editor) {
            window.editor.revealLineInCenterIfOutsideViewport(line);
        }
    });

    // FUNZIONI DI CONTROLLO GLOBALI PER IL DEBUGGER (v1.4.7)
    window.debugContinue = async () => {
        console.log("[GX-TESTS] UI Debug Continue");
        if (window.electronAPI && window.electronAPI.debugContinue) {
            await window.electronAPI.debugContinue();
        }
    };

    window.debugStep = async () => {
        console.log("[GX-TESTS] UI Debug Step");
        if (window.electronAPI && window.electronAPI.debugStep) {
            await window.electronAPI.debugStep();
        }
    };

    window.debugStop = async () => {
        console.log("[GX-TESTS] UI Debug Stop");
        if (window.electronAPI && window.electronAPI.debugStop) {
            await window.electronAPI.debugStop();
        }
        setState({ isTestingInProgress: false, isDebugModeActive: false });
    };

    window.runFileTests = async (filePath) => {
        const decodedPath = decodeURIComponent(filePath);
        console.log(`[GX-TESTS] Running all tests in file: ${decodedPath}`);
        
        setState({ isTestingInProgress: true, testTarget: 'run' });
        try {
            // Se il backend non ha un runFileTests specifico, emuliamo l'esecuzione del file
            await window.electronAPI.runTest(state.workspaceData.path, decodedPath);
        } catch (err) {
            console.error("[GX-TESTS] File Run Error:", err);
        } finally {
            setState({ isTestingInProgress: false });
        }
    };

    if (btnRunAll) btnRunAll.onclick = async () => {
        if (!state.workspaceData || !state.workspaceData.path) return;
        console.log("[GX-TESTS] Running all tests in workspace");
        
        setState({ isTestingInProgress: true, testTarget: 'run' });
        try {
            await window.electronAPI.runAllTests(state.workspaceData.path);
        } catch (err) {
            console.error("[GX-TESTS] All Tests Error:", err);
        } finally {
            setState({ isTestingInProgress: false });
        }
    };

    window.autoInstallPlaywright = async () => {
        if (!state.workspaceData || !state.workspaceData.path) return;
        console.log("[GX-TESTS] Auto-installing Playwright...");
        
        setState({ isInstalling: true });
        try {
            if (window.electronAPI && window.electronAPI.installPlaywright) {
                const success = await window.electronAPI.installPlaywright(state.workspaceData.path);
                if (success) {
                    if (window.gxToast) window.gxToast("Playwright installato con successo!", "success");
                } else {
                    if (window.gxToast) window.gxToast("Errore durante l'installazione.", "error");
                }
            } else {
                // Fallback manuale
                const cmd = "npm install -D @playwright/test && npx playwright install";
                window.electronAPI.terminalWrite('default', `${cmd}\r`);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setState({ isInstalling: false });
            // Re-trigger scan
            scanWorkspaceForTests();
        }
    };

    if (btnScan) btnScan.onclick = () => scanWorkspaceForTests();

    let isScanning = false;
    subscribe((newState, oldState) => {
        const activityChanged = newState.activeActivity !== oldState?.activeActivity;
        const workspaceChanged = newState.workspaceData?.path !== oldState?.workspaceData?.path;
        const cacheChanged = newState.testFilesCache !== oldState?.testFilesCache;
        const statusChanged = newState.isTestingInProgress !== oldState?.isTestingInProgress || 
                             newState.isPlaywrightInstalled !== oldState?.isPlaywrightInstalled;

        if (newState.activeActivity === 'testing') {
            // Trigger scan only if entering the tab or workspace changed, and we have no cache
            if ((activityChanged || workspaceChanged) && (!newState.testFilesCache || newState.testFilesCache.length === 0)) {
                if (!isScanning) {
                    isScanning = true;
                    scanWorkspaceForTests().finally(() => {
                        isScanning = false;
                    });
                }
            } else if (activityChanged || cacheChanged || statusChanged) {
                renderTestTree();
            }
        }
    });

    // Initial render
    renderTestTree();
    console.log("[GX-TESTS] Module initialized.");
};
