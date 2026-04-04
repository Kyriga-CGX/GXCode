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

    const renderNode = (node, name, fullPath = '') => {
        const isFolder = node.type === 'folder';
        const currentPath = fullPath ? `${fullPath}/${name}` : name;
        const isCollapsed = collapsedFolders.has(currentPath);

        if (isFolder) {
            const children = Object.entries(node.children)
                .sort(([aName, aNode], [bName, bNode]) => {
                    if (aNode.type !== bNode.type) return aNode.type === 'folder' ? -1 : 1;
                    return aName.localeCompare(bName);
                })
                .map(([childName, childNode]) => renderNode(childNode, childName, currentPath))
                .join('');

            return `
                <div class="test-tree-folder">
                    <div class="flex items-center gap-1.5 py-1 px-1.5 hover:bg-[var(--bg-side-alt)] rounded cursor-pointer group transition-colors" onclick="window.toggleTestFolder('${currentPath}')">
                        <svg class="text-gray-500 transition-transform ${isCollapsed ? '-rotate-90' : ''}" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="m6 9 6 6 6-6"/></svg>
                        <svg class="text-blue-400/70" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                        <span class="text-[10px] font-bold text-gray-400 uppercase tracking-widest truncate">${name}</span>
                    </div>
                    <div class="pl-3 border-l border-[var(--border-dim)] ml-2 mt-0.5 ${isCollapsed ? 'hidden' : 'flex flex-col'}">
                        ${children}
                    </div>
                </div>
            `;
        } else {
            const file = node.data;
            const fileName = name;
            const safeAbsPath = encodeURIComponent(file.fullPath);
            const safeFileName = encodeURIComponent(fileName);

            const testsHtml = file.testMatches.map(test => {
                const isFailed = test.status === 'failed';
                const isPassed = test.status === 'passed';
                const isRunning = test.status === 'running';

                const statusColor = isRunning ? 'text-blue-400 animate-pulse' : 
                                   isFailed ? 'text-red-500' : 
                                   isPassed ? 'text-emerald-500' : 'text-gray-600 hover:text-blue-500';

                const statusIcon = isRunning ? `<svg class="animate-spin" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 1 10 10"/></svg>` :
                                   isFailed ? `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>` :
                                   isPassed ? `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg>` : 
                                   `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m5 3 14 9-14 9V3z"/></svg>`;

                return `
                    <div class="flex items-center justify-between py-0.5 px-2 hover:bg-[var(--bg-side)] rounded transition cursor-pointer group" onclick="window.openFileInIDE(decodeURIComponent('${safeAbsPath}'), decodeURIComponent('${safeFileName}'))">
                        <div class="flex items-center gap-2 overflow-hidden flex-1">
                            <span class="text-[10px] text-gray-500 truncate group-hover:text-blue-400 transition cursor-text font-medium">${test.name}</span>
                        </div>
                        <div class="flex gap-1 items-center opacity-0 group-hover:opacity-100 transition-opacity ml-2 shrink-0">
                            <button onclick="event.stopPropagation(); window.runSingleTest('${safeAbsPath}', '${encodeURIComponent(test.name)}')" class="p-1 rounded bg-[var(--bg-side-alt)] text-gray-500 hover:text-emerald-500 transition" title="Esegui Test">
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m5 3 14 9-14 9V3z"/></svg>
                            </button>
                            <button onclick="event.stopPropagation(); window.debugSingleTest('${safeAbsPath}', '${encodeURIComponent(test.name)}')" class="p-1 rounded bg-[var(--bg-side-alt)] text-gray-500 hover:text-yellow-500 transition" title="Debug Test">
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m8 2 1.88 1.88"/><path d="M14.12 3.88 16 2"/><path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1"/><path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6"/><path d="M12 20v-9"/><path d="M6.53 9C4.6 8.8 3 7.1 3 5"/><path d="M6 13H2"/><path d="M3 21c0-2.1 1.7-3.9 3.8-4"/><path d="M20.97 5c0 2.1-1.6 3.8-3.5 4"/><path d="M22 13h-4"/><path d="M17.2 17c2.1.1 3.8 1.9 3.8 4"/></svg>
                            </button>
                            <div class="p-1 ${statusColor}">${statusIcon}</div>
                        </div>
                    </div>
                `;
            }).join('');

            return `
                <div class="test-tree-file mb-1">
                    <div class="flex items-center justify-between gap-2 p-1.5 hover:bg-[var(--bg-side-alt)] rounded cursor-pointer group transition-all" onclick="window.openFileInIDE(decodeURIComponent('${safeAbsPath}'), decodeURIComponent('${safeFileName}'))">
                        <div class="flex items-center gap-1.5 overflow-hidden flex-1">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" class="text-emerald-500 shrink-0" stroke="currentColor" stroke-width="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                            <span class="text-[10px] font-bold text-gray-300 truncate">${fileName}</span>
                        </div>
                        <button onclick="event.stopPropagation(); window.runFileTests('${safeAbsPath}')" class="p-1 rounded bg-blue-500/10 text-blue-400 opacity-0 group-hover:opacity-100 hover:bg-blue-500/20 transition duration-300" title="Esegui file">
                             <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m5 3 14 9-14 9V3z"/></svg>
                        </button>
                    </div>
                    <div class="flex flex-col gap-0.5 mt-0.5 ml-2 border-l border-[var(--border-ghost)] pl-2">
                        ${testsHtml}
                    </div>
                </div>
            `;
        }
    };

    const renderTestTree = () => {
        const { workspaceData, testFilesCache, isPlaywrightInstalled } = state;

        if (!workspaceData || !workspaceData.path) {
            treeRoot.innerHTML = `<div class="opacity-20 text-[9px] uppercase text-gray-500 font-bold text-center mt-10">${t('tests.openWorkspace')}</div>`;
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
            const parts = file.relativePath.replace(/\\\\/g, '/').split('/');
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
        
        setState({ isTestingInProgress: true, testTarget: 'debug' });
        try {
            await window.electronAPI.debugTest(state.workspaceData.path, decodedPath, decodedName);
        } catch (err) {
            console.error("[GX-TESTS] Debug Error:", err);
        } finally {
            setState({ isTestingInProgress: false });
        }
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
        const cmd = "npm install -D @playwright/test && npx playwright install";
        if (window.executeGlobalCommand) {
            window.executeGlobalCommand(cmd);
        } else {
            // Fallback terminal
            window.electronAPI.terminalWrite('default', `${cmd}\r`);
        }
    };

    if (btnScan) btnScan.onclick = () => scanWorkspaceForTests();

    subscribe((newState, oldState) => {
        if (
            newState.activeActivity === 'testing' ||
            newState.testFilesCache !== oldState?.testFilesCache || 
            newState.isPlaywrightInstalled !== oldState?.isPlaywrightInstalled ||
            newState.isTestingInProgress !== oldState?.isTestingInProgress
        ) {
            if (newState.activeActivity === 'testing' && (!newState.testFilesCache || newState.testFilesCache.length === 0)) {
                scanWorkspaceForTests();
            } else {
                renderTestTree();
            }
        }
    });

    renderTestTree();
    console.log("[GX-TESTS] Module initialized.");
};
