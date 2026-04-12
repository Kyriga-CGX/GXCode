const { ipcMain, dialog, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { setupWatcher, clearAllWatchers } = require('../services/watcher');
const { updateClaudeContext, updateGeminiContext } = require('../services/context');
const { getAiContext } = require('../services/persistence');
const autoCorrectionService = require('../services/autoCorrectionService');

function registerFsHandlers(mainWindow) {
    const sortFiles = (files) => {
        return files.sort((a, b) => {
            if (a.isDirectory && !b.isDirectory) return -1;
            if (!a.isDirectory && b.isDirectory) return 1;
            return a.name.localeCompare(b.name);
        });
    };

    ipcMain.handle('fs-read-dir', async (event, dirPath) => {
        try {
            if (!fs.existsSync(dirPath)) return [];
            const dirents = await fs.promises.readdir(dirPath, { withFileTypes: true });
            const files = dirents.map(f => ({
                name: f.name,
                isDirectory: f.isDirectory(),
                path: path.join(dirPath, f.name)
            }));
            return sortFiles(files);
        } catch (e) {
            console.error("[FS] Read Dir Error:", e.message);
            return [];
        }
    });

    ipcMain.handle('open-project-folder', async () => {
        const result = await dialog.showOpenDialog(mainWindow, {
            properties: ['openDirectory']
        });

        if (result.canceled || result.filePaths.length === 0) return null;

        clearAllWatchers(); // Reset al cambio cartella
        const folderPath = result.filePaths[0];
        setupWatcher(folderPath);
        updateClaudeContext(folderPath);
        updateGeminiContext(folderPath);
        try {
            const dirents = await fs.promises.readdir(folderPath, { withFileTypes: true });
            const files = dirents.map(f => ({
                name: f.name,
                isDirectory: f.isDirectory(),
                path: path.join(folderPath, f.name)
            }));

            return { name: path.basename(folderPath), path: folderPath, files: sortFiles(files) };
        } catch (e) {
            return { error: e.message };
        }
    });

    ipcMain.handle('open-project-file', async () => {
        const result = await dialog.showOpenDialog(mainWindow, {
            properties: ['openFile'],
            filters: [
                { name: 'Tutti i file', extensions: ['*'] },
                { name: 'JavaScript', extensions: ['js', 'jsx'] },
                { name: 'TypeScript', extensions: ['ts', 'tsx'] },
                { name: 'HTML/CSS', extensions: ['html', 'css'] }
            ]
        });

        if (result.canceled || result.filePaths.length === 0) return null;
        const filePath = result.filePaths[0];
        return { path: filePath, isFile: true };
    });

    ipcMain.handle('open-project-workspace', async () => {
        const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
            title: 'Seleziona Workspace',
            properties: ['openFile', 'showHiddenFiles'],
            filters: [
                { name: 'GXCode Workspace', extensions: ['code-workspace'] },
                { name: 'Tutti i file', extensions: ['*'] }
            ]
        });

        if (canceled || filePaths.length === 0) return null;
        const wsPath = filePaths[0];
        updateClaudeContext(wsPath);
        updateGeminiContext(wsPath);

        try {
            const content = fs.readFileSync(wsPath, 'utf8');
            const config = JSON.parse(content);
            const folders = [];

            if (config.folders && Array.isArray(config.folders)) {
                clearAllWatchers();
                for (const item of config.folders) {
                    let folderPath = item.path;
                    if (!path.isAbsolute(folderPath)) {
                        folderPath = path.resolve(path.dirname(wsPath), folderPath);
                    }

                    setupWatcher(folderPath); // Monitoriamo ogni root

                    try {
                        const stats = await fs.promises.stat(folderPath);
                        if (stats.isDirectory()) {
                            const dirents = await fs.promises.readdir(folderPath, { withFileTypes: true });
                            const files = dirents.map(f => ({
                                name: f.name,
                                isDirectory: f.isDirectory(),
                                path: path.join(folderPath, f.name)
                            }));

                            folders.push({
                                name: item.name || path.basename(folderPath),
                                path: folderPath,
                                files: sortFiles(files)
                            });
                        }
                    } catch (e) { console.error(`[WS-SCAN] Folder skip: ${folderPath}`, e.message); }
                }
            }

            return {
                name: path.basename(wsPath, '.code-workspace'),
                path: wsPath,
                isWorkspace: true,
                folders
            };
        } catch (e) {
            console.error("[Workspace Error]", e);
            return { error: e.message };
        }
    });

    ipcMain.handle('open-specific-folder', async (event, folderPath) => {
        setupWatcher(folderPath);
        try {
            if (!fs.existsSync(folderPath)) return null;

            if (folderPath.endsWith('.code-workspace')) {
                const content = fs.readFileSync(folderPath, 'utf8');
                const config = JSON.parse(content);
                const folders = [];

                if (config.folders && Array.isArray(config.folders)) {
                    for (const item of config.folders) {
                        let fp = item.path;
                        if (!path.isAbsolute(fp)) fp = path.resolve(path.dirname(folderPath), fp);

                        if (fs.existsSync(fp) && fs.statSync(fp).isDirectory()) {
                            const files = fs.readdirSync(fp, { withFileTypes: true }).map(f => ({
                                name: f.name,
                                isDirectory: f.isDirectory(),
                                path: path.join(fp, f.name)
                            }));
                            folders.push({
                                name: item.name || path.basename(fp),
                                path: fp,
                                files: sortFiles(files)
                            });
                        }
                    }
                }
                return {
                    name: path.basename(folderPath, '.code-workspace'),
                    path: folderPath,
                    isWorkspace: true,
                    folders
                };
            }

            const dirents = await fs.promises.readdir(folderPath, { withFileTypes: true });
            const files = dirents.map(f => ({
                name: f.name,
                isDirectory: f.isDirectory(),
                path: path.join(folderPath, f.name)
            }));

            return { name: path.basename(folderPath), path: folderPath, files: sortFiles(files) };
        } catch (e) {
            return { error: e.message };
        }
    });

    ipcMain.handle('open-gxcode-folder', async () => {
        const p = path.join(os.homedir(), getAiContext());
        if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
        await shell.openPath(p);
        return true;
    });

    ipcMain.handle('shell-open-path', async (event, targetPath) => {
        await shell.openPath(targetPath);
        return true;
    });

    ipcMain.handle('open-ai-metadata', async (event, workspacePath, fileName) => {
        if (!workspacePath || !fileName) return false;
        try {
            const rootDir = workspacePath.endsWith('.code-workspace') ? path.dirname(workspacePath) : workspacePath;
            const targetFile = path.join(rootDir, fileName);
            await shell.openPath(targetFile);
            return true;
        } catch (e) {
            console.error("[FS] Open AI Metadata Error:", e);
            return false;
        }
    });

    ipcMain.handle('shell-open-external', async (event, url) => {
        await shell.openExternal(url);
        return true;
    });

    ipcMain.handle('read-file', async (event, filePath) => {
        try {
            const stats = await fs.promises.stat(filePath);
            if (stats.size > 1024 * 1024) return "File troppo grande (Max 1MB).";
            return await fs.promises.readFile(filePath, 'utf-8');
        } catch (e) { return `Errore lettura: ${e.message}`; }
    });

    ipcMain.handle('fs-write-file', async (event, filePath, content, options = {}) => {
        try {
            const dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

            // AUTO-CORRECTION POLICY:
            // - Auto-save (mentre scrivi): NESSUNA validazione/correzione
            // - Manual save (Ctrl+S): validazione + auto-correction
            // - Idle trigger: validazione + auto-correction (gestito da AI reactivity)
            let finalContent = content;
            let wasFixed = false;
            let correctedContent = null;

            const isAutoSave = options?.isAutoSave === true;
            const isIdleTrigger = options?.isIdleTrigger === true;
            const isManualSave = !isAutoSave && !isIdleTrigger;

            // Only validate on manual saves (Ctrl+S), NOT during typing
            if (isManualSave) {
                try {
                    const correctionResult = await autoCorrectionService.validateAndFix(filePath, content);

                    if (correctionResult.fixed && correctionResult.success) {
                        finalContent = correctionResult.code;
                        correctedContent = correctionResult.code;
                        wasFixed = true;

                        if (global.mainWindow && !global.mainWindow.isDestroyed()) {
                            global.mainWindow.webContents.send('file-auto-corrected', {
                                filePath,
                                fixed: true,
                                autoFixed: correctionResult.autoFixed || false,
                                aiFixed: correctionResult.aiFixed || false,
                                correctedContent: correctedContent,
                                message: 'File auto-corretto prima del salvataggio'
                            });
                        }
                    } else if (!correctionResult.success && correctionResult.errors.length > 0) {
                        if (global.mainWindow && !global.mainWindow.isDestroyed()) {
                            global.mainWindow.webContents.send('file-save-error', {
                                filePath,
                                errors: correctionResult.errors,
                                message: 'File salvato con errori di sintassi'
                            });
                        }
                    }
                } catch (validationError) {
                    console.error('[AUTO-CORRECTION] Validation error:', validationError.message);
                }
            } else if (isAutoSave) {
                console.log(`[AUTO-SAVE] Skipping validation (user is typing): ${path.basename(filePath)}`);
            } else if (isIdleTrigger) {
                console.log(`[IDLE] Running validation for: ${path.basename(filePath)}`);
            }

            // SAFETY CHECK: Never overwrite with empty content
            if (finalContent === '' || finalContent === null || finalContent === undefined) {
                console.error('[FS-WRITE] REJECTED: Attempted to write empty content to', filePath);
                return {
                    error: 'Scrittura rifiutata: il contenuto è vuoto',
                    rejected: true
                };
            }

            // SAFETY CHECK: If file exists, don't overwrite with significantly smaller content
            if (fs.existsSync(filePath)) {
                const existingContent = fs.readFileSync(filePath, 'utf8');
                const existingLines = existingContent.split('\n').filter(l => l.trim()).length;
                const newLines = finalContent.split('\n').filter(l => l.trim()).length;

                if (existingLines > 10 && newLines < existingLines * 0.5) {
                    console.warn(`[FS-WRITE] WARNING: Content shrinking (${existingLines} → ${newLines} lines)`);
                    if (global.mainWindow && !global.mainWindow.isDestroyed()) {
                        global.mainWindow.webContents.send('file-save-warning', {
                            filePath,
                            existingLines,
                            newLines,
                            message: `Attenzione: il file sta diminuendo (${existingLines} → ${newLines} righe)`
                        });
                    }
                }
            }

            fs.writeFileSync(filePath, finalContent, 'utf8');

            if (wasFixed) {
                autoCorrectionService.trackFix(filePath, wasFixed, 0);
            }

            return { success: true, fixed: wasFixed };
        } catch (e) {
            return { error: e.message };
        }
    });

    ipcMain.handle('fs-create-file', async (event, dirPath, name) => {
        try {
            const filePath = path.join(dirPath, name);
            const parentDir = path.dirname(filePath);
            if (!fs.existsSync(parentDir)) fs.mkdirSync(parentDir, { recursive: true });
            if (fs.existsSync(filePath)) return { error: 'File gi├á esistente.' };
            fs.writeFileSync(filePath, '', 'utf-8');
            return { success: true, path: filePath };
        } catch (e) {
            return { error: e.message };
        }
    });

    ipcMain.handle('fs-create-folder-v2', async (event, dirPath, name) => {
        try {
            const folderPath = path.join(dirPath, name);
            if (fs.existsSync(folderPath)) return { error: 'Cartella gi├á esistente.' };
            fs.mkdirSync(folderPath, { recursive: true });
            return { success: true, path: folderPath };
        } catch (e) {
            return { error: e.message };
        }
    });

    ipcMain.handle('fs-delete', async (event, targetPath) => {
        try {
            if (!fs.existsSync(targetPath)) return { error: 'Percorso non trovato.' };
            const stat = fs.statSync(targetPath);
            if (stat.isDirectory()) {
                fs.rmSync(targetPath, { recursive: true, force: true });
            } else {
                fs.unlinkSync(targetPath);
            }
            return { success: true };
        } catch (e) {
            return { error: e.message };
        }
    });

    ipcMain.handle('fs-rename', async (event, oldPath, newPath) => {
        try {
            if (!fs.existsSync(oldPath)) return { error: 'File o cartella sorgente non trovata.' };
            if (fs.existsSync(newPath)) return { error: 'Un file o cartella con questo nome esiste gi├á.' };
            fs.renameSync(oldPath, newPath);
            return { success: true };
        } catch (e) {
            return { error: e.message };
        }
    });

    ipcMain.handle('get-ai-paths', async () => {
        return {
            agents: path.join(os.homedir(), getAiContext(), 'agents'),
            skills: path.join(os.homedir(), getAiContext(), 'skills'),
            home: os.homedir()
        };
    });

    ipcMain.handle('search-files', async (event, folderPath, query, options = {}) => {
        if (!folderPath || !query) return [];
        const { caseSensitive = false, wholeWord = false, useRegex = false, includePattern = '', excludePattern = '' } = options;
        const results = [];
        const MAX_RESULTS = 250;

        const globToRegex = (glob) => {
            if (!glob || !glob.trim()) return null;
            let p = glob.trim()
                .replace(/[.+^${}()|[\]\\]/g, '\\$&')
                .replace(/\*\*/g, '(.+)')
                .replace(/\*/g, '([^/\\n]+)')
                .replace(/\?/g, '(.)');
            return new RegExp(p, 'i');
        };

        const includeRx = globToRegex(includePattern);
        const excludeRx = globToRegex(excludePattern);

        let regex;
        try {
            if (useRegex) {
                regex = new RegExp(query, caseSensitive ? '' : 'i');
            } else {
                let pattern = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                if (wholeWord) pattern = `\\b${pattern}\\b`;
                regex = new RegExp(pattern, caseSensitive ? '' : 'i');
            }
        } catch (e) { return []; }

        const searchInDir = (dir, rootForRelative) => {
            if (results.length >= MAX_RESULTS) return;
            try {
                const files = fs.readdirSync(dir, { withFileTypes: true });
                for (const file of files) {
                    if (results.length >= MAX_RESULTS) return;
                    const fullPath = path.join(dir, file.name);
                    const relativePath = path.relative(rootForRelative, fullPath).replace(/\\/g, '/');

                    if (file.isDirectory()) {
                        if (['node_modules', '.git', 'dist', 'build', '.gxcode'].includes(file.name.toLowerCase())) continue;
                        if (excludeRx && excludeRx.test(relativePath)) continue;
                        searchInDir(fullPath, rootForRelative);
                    } else {
                        if (includeRx && !includeRx.test(relativePath)) continue;
                        if (excludeRx && excludeRx.test(relativePath)) continue;
                        if (file.name.match(/\.(png|jpe?g|gif|webp|ico|svg|pdf|zip|tar|gz|exe|dll)$/i)) continue;

                        try {
                            const content = fs.readFileSync(fullPath, 'utf8');
                            if (regex.test(content)) {
                                content.split('\n').forEach((line, i) => {
                                    if (regex.test(line)) {
                                        results.push({
                                            file: fullPath,
                                            relativePath: relativePath,
                                            line: i + 1,
                                            text: line.trim().substring(0, 150)
                                        });
                                    }
                                });
                            }
                        } catch (e) { }
                    }
                }
            } catch (e) { }
        };

        if (folderPath.endsWith('.code-workspace')) {
            try {
                const content = fs.readFileSync(folderPath, 'utf8');
                const config = JSON.parse(content);
                if (config.folders && Array.isArray(config.folders)) {
                    for (const item of config.folders) {
                        let fp = item.path;
                        if (!path.isAbsolute(fp)) fp = path.resolve(path.dirname(folderPath), fp);
                        if (fs.existsSync(fp)) searchInDir(fp, fp);
                    }
                }
            } catch (e) { }
        } else {
            searchInDir(folderPath, folderPath);
        }

        return results;
    });

    // Auto-correction control handlers
    ipcMain.handle('auto-correction:set-enabled', async (event, enabled) => {
        autoCorrectionService.setEnabled(enabled);
        return { success: true, enabled };
    });

    ipcMain.handle('auto-correction:get-status', async () => {
        return {
            enabled: autoCorrectionService.enabled,
            maxRetries: autoCorrectionService.maxRetries
        };
    });

    ipcMain.handle('auto-correction:get-stats', async (event, filePath) => {
        return autoCorrectionService.getFixStats(filePath);
    });

    ipcMain.handle('auto-correction:clear-history', async (event, filePath) => {
        if (filePath) {
            autoCorrectionService.clearHistory(filePath);
        } else {
            autoCorrectionService.clearAllHistory();
        }
        return { success: true };
    });
}

module.exports = { registerFsHandlers };
