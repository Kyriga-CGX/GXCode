import { state, subscribe, setState } from '../core/state.js';

export const initTests = () => {
    const btnRunAll = document.getElementById('btn-run-all-tests');
    const treeRoot = document.getElementById('test-tree-root');
    
    if (!treeRoot) return;

    // Listen for test output globally
    window.electronAPI.onTestOutput((data) => {
        if (window.writeToTestTerminal) {
            window.writeToTestTerminal(data);
        }
    });

    // Aggiorniamo la UI dei Test in base allo stato
    const renderTestTree = () => {
        const { workspaceData, testFilesCache, isPlaywrightInstalled, isTestingInProgress } = state;

        if (!workspaceData || !workspaceData.path) {
            treeRoot.innerHTML = `<div class="opacity-30 text-[10px] uppercase text-gray-500 font-bold text-center mt-10" data-i18n="tests.openWorkspace">${window.t('tests.openWorkspace')}</div>`;
            if (btnRunAll) {
                btnRunAll.classList.add('opacity-50', 'cursor-not-allowed');
                btnRunAll.disabled = true;
            }
            return;
        }

        // UI per Playwright mancante
        if (!isPlaywrightInstalled) {
            treeRoot.innerHTML = `
                <div class="p-4 text-center space-y-4">
                    <div class="flex justify-center">
                        <div class="p-3 bg-yellow-500/10 rounded-full text-yellow-500">
                             <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                        </div>
                    </div>
                    <div class="space-y-1">
                        <h3 class="text-xs font-bold text-white uppercase tracking-wider">${window.t('tests.missingPlaywright')}</h3>
                        <p class="text-[10px] text-gray-400">${window.t('tests.installDesc')}</p>
                    </div>
                    <button onclick="window.autoInstallPlaywright()" class="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold rounded-lg transition uppercase flex items-center justify-center gap-2">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        <span>${window.t('tests.installPlaywright')}</span>
                    </button>
                </div>
            `;
            if (btnRunAll) btnRunAll.disabled = true;
            return;
        }

        if (testFilesCache.length === 0) {
            treeRoot.innerHTML = `<div class="opacity-30 text-[10px] uppercase text-gray-500 font-bold text-center mt-10" data-i18n="tests.noTests">${window.t('tests.noTests')}</div>`;
            if (btnRunAll) {
                btnRunAll.classList.add('opacity-50', 'cursor-not-allowed');
                btnRunAll.disabled = true;
            }
            return;
        }

        if (btnRunAll) {
            btnRunAll.classList.remove('opacity-50', 'cursor-not-allowed');
            btnRunAll.disabled = isTestingInProgress;
        }

        treeRoot.innerHTML = testFilesCache.map(file => {
            const fileName = file.relativePath.replace(/\\\\/g, '/').split('/').pop();
            const safeAbsPath = encodeURIComponent(file.fullPath);
            const safeFileName = encodeURIComponent(fileName);

            // Generiamo l'albero per ogni test matchato
            const testsHtml = file.testMatches.map(test => {
                const isFailed = test.status === 'failed';
                const isPassed = test.status === 'passed';
                const isRunning = test.status === 'running';

                const statusColor = isRunning ? 'text-yellow-400 animate-pulse' : 
                                  isFailed ? 'text-red-500' : 
                                  isPassed ? 'text-emerald-500' : 'text-gray-600 hover:text-blue-500';

                const statusIcon = isRunning ? `<svg class="animate-spin" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 1 10 10"/></svg>` :
                                   isFailed ? `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>` :
                                   isPassed ? `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg>` : 
                                   `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m5 3 14 9-14 9V3z"/></svg>`;

                return `
                    <div class="flex items-center justify-between py-0.5 px-2 hover:bg-[#1d232b] rounded transition cursor-pointer group" onclick="window.runSingleTest('${safeAbsPath}', '${encodeURIComponent(test.name)}')">
                        <div class="flex items-center gap-2 overflow-hidden flex-1" onclick="event.stopPropagation(); window.openFileFromSearch(decodeURIComponent('${safeAbsPath}'), decodeURIComponent('${safeFileName}'), ${test.line}, '')">
                            <span class="text-[10px] text-gray-400 font-mono truncate group-hover:text-blue-400 transition cursor-text">${test.name}</span>
                        </div>
                        <div class="flex gap-1 items-center opacity-0 group-hover:opacity-100 transition-opacity ml-2 shrink-0">
                            <button onclick="event.stopPropagation(); window.debugSingleTest('${safeAbsPath}', '${encodeURIComponent(test.name)}')" class="p-1 rounded bg-[#0d1117] text-gray-500 hover:text-yellow-500 transition" data-i18n="[title]tests.debugTooltip" title="${window.t('tests.debugTooltip')}">
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m8 2 1.88 1.88"/><path d="M14.12 3.88 16 2"/><path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1"/><path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6"/><path d="M12 20v-9"/><path d="M6.53 9C4.6 8.8 3 7.1 3 5"/><path d="M6 13H2"/><path d="M3 21c0-2.1 1.7-3.9 3.8-4"/><path d="M20.97 5c0 2.1-1.6 3.8-3.5 4"/><path d="M22 13h-4"/><path d="M17.2 17c2.1.1 3.8 1.9 3.8 4"/></svg>
                            </button>
                            <button class="p-1 rounded bg-[#161b22] border border-gray-800 ${statusColor} hover:scale-110 transition-transform">
                                ${statusIcon}
                            </button>
                        </div>
                    </div>
                `;
            }).join('');

            return `
                <div class="mb-3">
                    <div class="flex items-center justify-between gap-2 p-1.5 bg-[#161b22] rounded cursor-pointer group hover:bg-gray-800 transition" onclick="window.runFileTests('${safeAbsPath}')">
                        <div class="flex items-center gap-1.5 overflow-hidden flex-1" onclick="event.stopPropagation(); window.openFileFromSearch(decodeURIComponent('${safeAbsPath}'), decodeURIComponent('${safeFileName}'), 1, '')">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" class="text-emerald-500 shrink-0" stroke="currentColor" stroke-width="2"><path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/></svg>
                            <span class="text-[10px] font-bold text-gray-300 truncate">${fileName}</span>
                        </div>
                        <button class="p-1 rounded bg-[#0d1117] text-gray-500 opacity-0 group-hover:opacity-100 hover:text-blue-500 transition duration-300">
                             <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m5 3 14 9-14 9V3z"/></svg>
                        </button>
                    </div>
                    <div class="border-l border-gray-800 ml-3 pl-2 mt-1 flex flex-col gap-0.5">
                        ${testsHtml}
                    </div>
                </div>
            `;
        }).join('');
    };

    const checkPlaywrightStatus = async () => {
        if (!state.workspaceData || !state.workspaceData.path) return;
        try {
            const res = await window.electronAPI.checkPlaywright(state.workspaceData.path);
            setState({ isPlaywrightInstalled: !!res?.installed });
        } catch (e) {
            console.error("Errore check playwright:", e);
        }
    };

    const scanWorkspaceForTests = async () => {
        if (!state.workspaceData || !state.workspaceData.path) return;
        
        await checkPlaywrightStatus();
        if (!state.isPlaywrightInstalled) {
            renderTestTree();
            return;
        }

        treeRoot.innerHTML = `<div class="opacity-50 text-[10px] uppercase text-blue-400 font-bold text-center mt-10 animate-pulse" data-i18n="tests.scanning">${window.t('tests.scanning')}</div>`;
        try {
            const results = await window.electronAPI.scanTests(state.workspaceData.path);
            setState({ testFilesCache: results });
            renderTestTree();
        } catch(e) {
            treeRoot.innerHTML = `<div class="opacity-50 text-[10px] uppercase text-red-500 font-bold text-center mt-10">${window.t('tests.error').replace('{error}', e.message)}</div>`;
        }
    };

    // Auto-Installation Logic
    window.autoInstallPlaywright = async () => {
        if (!state.workspaceData || !state.workspaceData.path) return;
        
        setState({ isTestingInProgress: true });
        treeRoot.innerHTML = `
            <div class="p-10 text-center animate-pulse">
                <div class="text-blue-400 font-bold uppercase text-[10px]">${window.t('tests.installingPlaywright')}</div>
                <div class="text-[9px] text-gray-500 mt-2">Running: npm install -D @playwright/test</div>
            </div>
        `;

        try {
            // Utilizziamo executeCommand (esposto in preload.js) in CWD del progetto
            await window.electronAPI.executeCommand('npm install -D @playwright/test && npx playwright install', state.workspaceData.path);
            window.showToast(window.t('tests.installSuccess'), 'success');
            await checkPlaywrightStatus();
            if (state.isPlaywrightInstalled) scanWorkspaceForTests();
        } catch(e) {
            window.showToast("Installazione fallita: " + e.message, 'error');
        } finally {
            setState({ isTestingInProgress: false });
            renderTestTree();
        }
    };

    subscribe((newState, oldState) => {
        try {
            // Se cambiamo tab Testing, scansioniamo se necessario
            if (newState.activeActivity === 'testing' && (!newState.testFilesCache || newState.testFilesCache.length === 0)) {
                scanWorkspaceForTests();
            }
            
            // Se cambia il workspace, resettiamo tutto
            if (newState.workspaceData?.path && newState.workspaceData.path !== oldState?.workspaceData?.path) {
                // AGGIUNTO GUARD PER EVITARE LOOP INFINITO
                if (state.testFilesCache.length > 0) {
                    setState({ testFilesCache: [] });
                }
                if (newState.activeActivity === 'testing') scanWorkspaceForTests();
            }

        // Se cambia qualcosa che richiede re-render
            if (newState.testFilesCache !== oldState?.testFilesCache || 
                newState.isPlaywrightInstalled !== oldState?.isPlaywrightInstalled ||
                newState.isTestingInProgress !== oldState?.isTestingInProgress) {
                renderTestTree();
            }
        } catch (e) {
            console.error("[Tests] Error in subscribe listener:", e);
        }
    });

    if (btnRunAll) {
        btnRunAll.onclick = async () => {
            if (!state.workspaceData || !state.workspaceData.path || state.isTestingInProgress) return;
            
            console.log("Run All Tests triggered");
            setState({ isTestingInProgress: true });
            btnRunAll.classList.add('animate-pulse', 'text-yellow-400');
            btnRunAll.innerHTML = `<svg class="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 1 10 10"/></svg> ${window.t('tests.runningAll')}`;
            
            try {
                const report = await window.electronAPI.runAllTests(state.workspaceData.path);
                console.log("Test Report:", report);
                await scanWorkspaceForTests(); 
            } catch(e) {
                console.error("Errore run all:", e);
            } finally {
                setState({ isTestingInProgress: false });
                btnRunAll.classList.remove('animate-pulse', 'text-yellow-400');
                btnRunAll.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m5 3 14 9-14 9V3z"/></svg> <span data-i18n="tests.runAll">${window.t('tests.runAll')}</span>`;
            }
        };
    }

    window.debugSingleTest = async (absPath, testNameEncoded) => {
        const testName = decodeURIComponent(testNameEncoded);
        console.log(`[Tests] Debugging: ${testName}`);
        
        setState({
            testFilesCache: state.testFilesCache.map(f => {
                if (f.fullPath === absPath) {
                    return { ...f, testMatches: f.testMatches.map(t => t.name === testName ? { ...t, status: 'running' } : t) };
                }
                return f;
            }),
            activeBottomTab: 'terminal',
            isTerminalMinimized: false
        });

        try {
            if (window.writeToTestTerminal) {
                window.writeToTestTerminal(`\x1b[1;36m>>> [GX] STARTING DEBUG: ${testName}\x1b[0m\r\n`);
            }
            await window.electronAPI.debugTest(state.workspaceData.path, absPath, testName);
        } catch(e) {
            console.error("Debug fallito:", e);
        } finally {
            setState({
                testFilesCache: state.testFilesCache.map(f => {
                    if (f.fullPath === absPath) {
                        return { ...f, testMatches: f.testMatches.map(t => t.name === testName ? { ...t, status: 'idle' } : t) };
                    }
                    return f;
                })
            });
        }
    };

    window.runSingleTest = async (encodedFilePath, encodedTestName) => {
        const filePath = decodeURIComponent(encodedFilePath);
        const testName = decodeURIComponent(encodedTestName);
        console.log("Run single test", testName, "in", filePath);

        setState({
            testFilesCache: state.testFilesCache.map(f => {
                if (f.fullPath === filePath) {
                    return { ...f, testMatches: f.testMatches.map(t => t.name === testName ? { ...t, status: 'running' } : t) };
                }
                return f;
            }),
            activeBottomTab: 'terminal',
            isTerminalMinimized: false
        });

        try {
            if (window.writeToTestTerminal) {
                window.writeToTestTerminal(`\x1b[1;32m>>> [GX] RUNNING TEST: ${testName}\x1b[0m\r\n`);
            }
            const success = await window.electronAPI.runTest(state.workspaceData.path, filePath, testName);
            
            setState({
                testFilesCache: state.testFilesCache.map(f => {
                    if (f.fullPath === filePath) {
                        return { ...f, testMatches: f.testMatches.map(t => t.name === testName ? { ...t, status: success ? 'passed' : 'failed' } : t) };
                    }
                    return f;
                })
            });
        } catch(e) {
             setState({
                testFilesCache: state.testFilesCache.map(f => {
                    if (f.fullPath === filePath) {
                        return { ...f, testMatches: f.testMatches.map(t => t.name === testName ? { ...t, status: 'failed' } : t) };
                    }
                    return f;
                })
            });
        }
    };

    window.runFileTests = async (encodedFilePath) => {
        const filePath = decodeURIComponent(encodedFilePath);
        console.log("[GX-TESTS] Running all tests in file:", filePath);

        setState({
            testFilesCache: state.testFilesCache.map(f => {
                if (f.fullPath === filePath) {
                    return { ...f, testMatches: f.testMatches.map(t => ({ ...t, status: 'running' })) };
                }
                return f;
            })
        });

        try {
            const report = await window.electronAPI.runFileTests(state.workspaceData.path, filePath);
            setState({
                testFilesCache: state.testFilesCache.map(f => {
                    if (f.fullPath === filePath) {
                        return { ...f, testMatches: f.testMatches.map(t => ({ ...t, status: report.errors && report.errors.length > 0 ? 'failed' : 'passed' })) };
                    }
                    return f;
                })
            });
        } catch(e) {
            console.error("Errore run file:", e);
        }
    };
};
