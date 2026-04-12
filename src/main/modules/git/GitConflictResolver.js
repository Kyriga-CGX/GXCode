/**
 * GitConflictResolver - Gestione merge conflicts
 * 
 * Responsabilità:
 * - Rilevare file con conflitti
 * - Parsare conflitti nei file
 * - Risolvere conflitti (ours/theirs/custom)
 * - Ottenere stato conflitti
 */

const fs = require('fs').promises;
const path = require('path');
const eventBus = require('../../core/EventBus');

class GitConflictResolver {
    constructor(workspacePath) {
        this.workspacePath = workspacePath;
        this._conflicts = [];
    }

    /**
     * Controlla se c'è un merge in corso
     * @returns {Promise<boolean>}
     */
    async isMergeInProgress() {
        try {
            const mergeHeadPath = path.join(this.workspacePath, '.git', 'MERGE_HEAD');
            await fs.access(mergeHeadPath);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Rileva file con conflitti
     * @returns {Promise<Array>}
     */
    async detectConflicts() {
        const { exec } = require('child_process');
        const util = require('util');
        const execAsync = util.promisify(exec);

        try {
            const { stdout } = await execAsync('git diff --name-only --diff-filter=U', {
                cwd: this.workspacePath
            });

            const conflictFiles = stdout
                .split('\n')
                .filter(line => line.trim())
                .map(file => ({
                    file,
                    fullPath: path.join(this.workspacePath, file)
                }));

            this._conflicts = conflictFiles;

            eventBus.emit('git:conflicts-detected', { 
                count: conflictFiles.length,
                files: conflictFiles
            });

            return conflictFiles;
        } catch (err) {
            console.error('[GitConflictResolver] Error detecting conflicts:', err.message);
            return [];
        }
    }

    /**
     * Parsa conflitti in un file
     * @param {string} filePath - Percorso del file
     * @returns {Promise<Array>} - Lista conflitti
     */
    async parseConflicts(filePath) {
        try {
            const content = await fs.readFile(filePath, 'utf8');
            const lines = content.split('\n');
            const conflicts = [];
            let currentConflict = null;
            let inConflict = false;
            let inOurs = false;
            let inTheirs = false;

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const lineNum = i + 1;

                if (line.startsWith('<<<<<<<')) {
                    inConflict = true;
                    inOurs = true;
                    inTheirs = false;
                    currentConflict = {
                        startLine: lineNum,
                        ours: [],
                        theirs: [],
                        oursStart: lineNum,
                        theirsStart: null,
                        endLine: null
                    };
                } else if (line === '=======' && inConflict) {
                    inOurs = false;
                    inTheirs = true;
                    currentConflict.theirsStart = lineNum + 1;
                } else if (line.startsWith('>>>>>>>') && inConflict) {
                    currentConflict.endLine = lineNum;
                    conflicts.push(currentConflict);
                    currentConflict = null;
                    inConflict = false;
                    inTheirs = false;
                } else if (inConflict && inOurs) {
                    currentConflict.ours.push(line);
                } else if (inConflict && inTheirs) {
                    currentConflict.theirs.push(line);
                }
            }

            return conflicts;
        } catch (err) {
            console.error('[GitConflictResolver] Error parsing conflicts:', err.message);
            return [];
        }
    }

    /**
     * Risolvi conflitto accettando "ours"
     * @param {string} filePath - Percorso file
     * @returns {Promise<boolean>}
     */
    async acceptOurs(filePath) {
        return this._resolveConflict(filePath, 'ours');
    }

    /**
     * Risolvi conflitto accettando "theirs"
     * @param {string} filePath - Percorso file
     * @returns {Promise<boolean>}
     */
    async acceptTheirs(filePath) {
        return this._resolveConflict(filePath, 'theirs');
    }

    /**
     * Risolvi conflitto accettando entrambe le versioni
     * @param {string} filePath - Percorso file
     * @returns {Promise<boolean>}
     */
    async acceptBoth(filePath) {
        return this._resolveConflict(filePath, 'both');
    }

    /**
     * Risolvi conflitto con contenuto custom
     * @param {string} filePath - Percorso file
     * @param {string} content - Contenuto risolutivo
     * @returns {Promise<boolean>}
     */
    async acceptCustom(filePath, content) {
        try {
            await fs.writeFile(filePath, content, 'utf8');
            
            eventBus.emit('git:conflict-resolved', { 
                file: filePath, 
                strategy: 'custom' 
            });
            
            return true;
        } catch (err) {
            console.error('[GitConflictResolver] Error resolving conflict:', err.message);
            return false;
        }
    }

    /**
     * Risolvi conflitto interno
     * @private
     */
    async _resolveConflict(filePath, strategy) {
        try {
            const content = await fs.readFile(filePath, 'utf8');
            const lines = content.split('\n');
            const resolved = [];
            let inConflict = false;

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];

                if (line.startsWith('<<<<<<<')) {
                    inConflict = true;
                    continue;
                }

                if (line === '=======') {
                    if (strategy === 'both') {
                        // Aggiungi marker tra ours e theirs
                        resolved.push('');
                        resolved.push('// ====== CONFLICT RESOLUTION (BOTH) ======');
                        resolved.push('');
                    }
                    continue;
                }

                if (line.startsWith('>>>>>>>')) {
                    inConflict = false;
                    continue;
                }

                if (!inConflict) {
                    resolved.push(line);
                } else if (strategy === 'ours') {
                    resolved.push(line);
                } else if (strategy === 'theirs') {
                    // Salta le righe "ours" (prima di '=======')
                    // Aggiungeremo le righe "theirs" dopo
                } else if (strategy === 'both') {
                    resolved.push(line);
                }
            }

            // Se strategy è 'theirs', dobbiamo riparsare e prendere solo theirs
            if (strategy === 'theirs') {
                const conflicts = await this.parseConflicts(filePath);
                let result = content;
                
                for (const conflict of conflicts) {
                    const conflictBlock = [
                        `<<<<<<< HEAD`,
                        ...conflict.ours,
                        '=======',
                        ...conflict.theirs,
                        `>>>>>>> theirs`
                    ].join('\n');
                    
                    const resolvedBlock = conflict.theirs.join('\n');
                    result = result.replace(conflictBlock, resolvedBlock);
                }
                
                await fs.writeFile(filePath, result, 'utf8');
            } else {
                await fs.writeFile(filePath, resolved.join('\n'), 'utf8');
            }

            eventBus.emit('git:conflict-resolved', { 
                file: filePath, 
                strategy 
            });

            return true;
        } catch (err) {
            console.error('[GitConflictResolver] Error resolving conflict:', err.message);
            return false;
        }
    }

    /**
     * Ottieni conflitti rilevati
     * @returns {Array}
     */
    getConflicts() {
        return this._conflicts;
    }

    /**
     * Conta conflitti
     * @returns {number}
     */
    getConflictCount() {
        return this._conflicts.length;
    }

    /**
     * Stagea file dopo risoluzione
     * @param {string} file - File da stageare
     * @returns {Promise<boolean>}
     */
    async markResolved(file) {
        const { exec } = require('child_process');
        const util = require('util');
        const execAsync = util.promisify(exec);

        try {
            await execAsync(`git add "${file}"`, {
                cwd: this.workspacePath
            });
            
            eventBus.emit('git:conflict-marked-resolved', { file });
            
            return true;
        } catch (err) {
            console.error('[GitConflictResolver] Error marking resolved:', err.message);
            return false;
        }
    }
}

module.exports = GitConflictResolver;
