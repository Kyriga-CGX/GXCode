import { state, subscribe, setState } from '../core/state.js';

export const initTests = () => {
    const btnRunAll = document.getElementById('btn-run-all-tests');
    const treeRoot = document.getElementById('test-tree-root');
    
    if (!treeRoot) return;

    let testFilesCache = [];

    // Aggiorniamo la UI dei Test in base allo stato
    const renderTestTree = () => {
        if (!state.workspaceData || !state.workspaceData.path) {
            treeRoot.innerHTML = `<div class="opacity-30 text-[10px] uppercase text-gray-500 font-bold text-center mt-10" data-i18n="tests.openWorkspace">${window.t('tests.openWorkspace')}</div>`;
            if (btnRunAll) {
                btnRunAll.classList.add('opacity-50', 'cursor-not-allowed');
                btnRunAll.disabled = true;
            }
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
            btnRunAll.disabled = false;
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

    // Scansiona rapidamente i file .spec.js con una RegExp personalizzata via backend
    // Usiamo il motore `search-files` che abbiamo già creato per cercare 'test(' e 'describe('?
    // In realtà, per parsare i test serve logica specifica. 
    // Manderemo un comando IPC 'scan-tests' che legge i nomi dei test usando AST o regex rapida.
    const scanWorkspaceForTests = async () => {
        if (!state.workspaceData || !state.workspaceData.path) return;
        
        treeRoot.innerHTML = `<div class="opacity-50 text-[10px] uppercase text-blue-400 font-bold text-center mt-10 animate-pulse" data-i18n="tests.scanning">${window.t('tests.scanning')}</div>`;
        try {
            // Un nuovo handler IPC che chiameremo scan-tests e ci darà { fullPath, relativePath, testMatches: [{name, line, status}] }
            testFilesCache = await window.electronAPI.scanTests(state.workspaceData.path);
            renderTestTree();
        } catch(e) {
            treeRoot.innerHTML = `<div class="opacity-50 text-[10px] uppercase text-red-500 font-bold text-center mt-10">${window.t('tests.error').replace('{error}', e.message)}</div>`;
        }
    };

    // Sottoscriviamo allo stato per scansionare i test solo quando il workspace viene caricato
    subscribe((newState, oldState) => {
        // Se si passa all'attività testing e The workspaceData non è cambiato ma i test non sono cachati
        if (newState.activeActivity === 'testing' && testFilesCache.length === 0) {
            scanWorkspaceForTests();
        }
        
        // Se il workspace cambia, invalidiamo la cache dei test e riscansiamo se la tab è aperta
        if (newState.workspaceData && oldState && newState.workspaceData.path !== oldState.workspaceData?.path) {
            testFilesCache = [];
            if (newState.activeActivity === 'testing') scanWorkspaceForTests();
        }
    });

    // Binding Globali Runtime
    if (btnRunAll) {
        btnRunAll.onclick = async () => {
            if (!state.workspaceData || !state.workspaceData.path) return;
            
            console.log("Run All Tests triggered");
            btnRunAll.classList.add('animate-pulse', 'text-yellow-400');
            btnRunAll.innerHTML = `<svg class="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 1 10 10"/></svg> ${window.t('tests.runningAll')}`;
            
            try {
                // Eseguiamo i test e aspettiamo il report JSON
                const report = await window.electronAPI.runAllTests(state.workspaceData.path);
                console.log("Test Report:", report);
                // Aggiorniamo la UI (idealmente dovremmo mappare il report sulla cache)
                await scanWorkspaceForTests(); 
            } catch(e) {
                console.error("Errore run all:", e);
            } finally {
                btnRunAll.classList.remove('animate-pulse', 'text-yellow-400');
                btnRunAll.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m5 3 14 9-14 9V3z"/></svg> <span data-i18n="tests.runAll">${window.t('tests.runAll')}</span>`;
            }
        };
    }

    window.debugSingleTest = async (absPath, testNameEncoded) => {
        const testName = decodeURIComponent(testNameEncoded);
        console.log(`[Tests] Debugging: ${testName}`);
        
        // Update local status for visual feedback
        testFilesCache.forEach(f => {
            if (f.fullPath === absPath) {
                f.testMatches.forEach(t => {
                    if (t.name === testName) t.status = 'running';
                });
            }
        });
        renderTestTree();

        try {
            await window.electronAPI.debugTest(state.workspaceData.path, absPath, testName);
        } catch(e) {
            console.error("Debug fallito:", e);
        } finally {
            // Re-render status (idle again as debug ended)
            testFilesCache.forEach(f => {
                if (f.fullPath === absPath) {
                    f.testMatches.forEach(t => {
                        if (t.name === testName) t.status = 'idle';
                    });
                }
            });
            renderTestTree();
        }
    };

    window.runSingleTest = async (encodedFilePath, encodedTestName) => {
        const filePath = decodeURIComponent(encodedFilePath);
        const testName = decodeURIComponent(encodedTestName);
        console.log("Run single test", testName, "in", filePath);

        // UI state optimistic: running
        testFilesCache = testFilesCache.map(f => {
            if (f.fullPath === filePath) {
                f.testMatches = f.testMatches.map(t => t.name === testName ? { ...t, status: 'running' } : t);
            }
            return f;
        });
        renderTestTree();

        try {
            await window.electronAPI.runTest(filePath, testName);
            // On success
            testFilesCache = testFilesCache.map(f => {
                if (f.fullPath === filePath) {
                    f.testMatches = f.testMatches.map(t => t.name === testName ? { ...t, status: 'passed' } : t);
                }
                return f;
            });
        } catch(e) {
            testFilesCache = testFilesCache.map(f => {
                if (f.fullPath === filePath) {
                    f.testMatches = f.testMatches.map(t => t.name === testName ? { ...t, status: 'failed' } : t);
                }
                return f;
            });
        }
        renderTestTree();
    };

    window.runFileTests = async (encodedFilePath) => {
        const filePath = decodeURIComponent(encodedFilePath);
        console.log("Run file tests", filePath);
        // Da implementare col backend per fare run di file interi
    };
};
