/**
 * GitRepository - Gestione stato del repository Git
 * 
 * Responsabilità:
 * - Ottenere status del repository
 * - Ottenere lista file modificati
 * - Ottenere branch corrente
 * - Ottenere remote URL
 * - Ottenere informazioni commit
 */

const { exec } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const eventBus = require('../../core/EventBus');
const util = require('util');
const execAsync = util.promisify(exec);

class GitRepository {
    constructor(workspacePath) {
        this.workspacePath = workspacePath;
        this._isGitRepo = false;
        this._status = null;
        this._lastUpdated = null;
    }

    /**
     * Inizializza il repository
     */
    async init() {
        try {
            await this._runGitCommand('rev-parse --is-inside-work-tree');
            this._isGitRepo = true;
            console.log(`[GitRepository] Initialized: ${this.workspacePath}`);
            
            eventBus.emit('git:repo-initialized', { 
                path: this.workspacePath,
                isGitRepo: true 
            });
            
            return true;
        } catch (err) {
            this._isGitRepo = false;
            console.log(`[GitRepository] Not a git repository: ${this.workspacePath}`);
            return false;
        }
    }

    /**
     * Ottieni status del repository
     * @returns {Promise<Object>} - Status completo
     */
    async getStatus() {
        if (!this._isGitRepo) {
            throw new Error('[GitRepository] Not a git repository');
        }

        try {
            const [statusOutput, branchOutput, remoteOutput] = await Promise.all([
                this._runGitCommand('status --porcelain'),
                this._runGitCommand('branch --show-current'),
                this._runGitCommand('remote get-url origin').catch(() => null)
            ]);

            const files = this._parsePorcelainStatus(statusOutput);
            const branch = branchOutput.trim();
            const remoteUrl = remoteOutput ? remoteOutput.trim() : null;

            // Count changes by type
            const staged = files.filter(f => f.status.includes('M') || f.status.includes('A') || f.status.includes('D'));
            const unstaged = files.filter(f => f.status.includes('M') || f.status.includes('D'));
            const untracked = files.filter(f => f.status === '??');

            this._status = {
                branch,
                remoteUrl,
                files,
                summary: {
                    total: files.length,
                    staged: staged.length,
                    unstaged: unstaged.length,
                    untracked: untracked.length
                },
                isClean: files.length === 0
            };

            this._lastUpdated = new Date();

            eventBus.emit('git:status-changed', this._status);

            return this._status;
        } catch (err) {
            console.error('[GitRepository] Error getting status:', err.message);
            throw err;
        }
    }

    /**
     * Parsa output porcelain di git status
     * @private
     */
    _parsePorcelainStatus(output) {
        if (!output || !output.trim()) return [];

        return output
            .split('\n')
            .filter(line => line.trim())
            .map(line => {
                const status = line.substring(0, 2).trim();
                let filePath = line.substring(3);
                
                // Handle renamed files
                if (status.includes('R')) {
                    const parts = filePath.split(' -> ');
                    filePath = parts[1] || parts[0];
                }

                return {
                    path: filePath,
                    status: status,
                    statusText: this._describeStatus(status)
                };
            });
    }

    /**
     * Descrive lo status in testo leggibile
     * @private
     */
    _describeStatus(status) {
        const descriptions = {
            'M': 'Modified',
            'A': 'Added',
            'D': 'Deleted',
            'R': 'Renamed',
            'C': 'Copied',
            'U': 'Updated but unmerged',
            '??': 'Untracked',
            '!!': 'Ignored'
        };
        return descriptions[status] || status;
    }

    /**
     * Ottieni branch corrente
     * @returns {Promise<string>}
     */
    async getCurrentBranch() {
        const branch = await this._runGitCommand('branch --show-current');
        return branch.trim();
    }

    /**
     * Ottieni lista di tutti i branch
     * @returns {Promise<Array>}
     */
    async getBranches() {
        const output = await this._runGitCommand('branch -l');
        return output
            .split('\n')
            .filter(line => line.trim())
            .map(line => {
                const isCurrent = line.startsWith('*');
                const name = line.replace('*', '').trim();
                return { name, isCurrent };
            });
    }

    /**
     * Ottieni lista di tutti i remote
     * @returns {Promise<Array>}
     */
    async getRemotes() {
        const output = await this._runGitCommand('remote -v');
        const remotes = {};
        
        output.split('\n').filter(line => line.trim()).forEach(line => {
            const parts = line.split(/\s+/);
            if (parts.length >= 2) {
                const [name, url] = parts;
                if (!remotes[name]) {
                    remotes[name] = { name, fetch: null, push: null };
                }
                if (line.includes('(fetch)')) {
                    remotes[name].fetch = url;
                } else if (line.includes('(push)')) {
                    remotes[name].push = url;
                }
            }
        });

        return Object.values(remotes);
    }

    /**
     * Ottieni remote URL di origin
     * @returns {Promise<string|null>}
     */
    async getRemoteUrl() {
        try {
            const url = await this._runGitCommand('remote get-url origin');
            return url.trim();
        } catch (err) {
            return null;
        }
    }

    /**
     * Ottieni ultimi commit
     * @param {number} count - Numero di commit da ottenere
     * @returns {Promise<Array>}
     */
    async getRecentCommits(count = 10) {
        const format = '%H|%h|%an|%ae|%at|%s';
        const output = await this._runGitCommand(`log -${count} --pretty=format:"${format}"`);
        
        return output
            .split('\n')
            .filter(line => line.trim())
            .map(line => {
                const [hash, shortHash, authorName, authorEmail, timestamp, message] = line.split('|');
                return {
                    hash,
                    shortHash,
                    author: { name: authorName, email: authorEmail },
                    date: new Date(parseInt(timestamp) * 1000),
                    message,
                    timestamp: parseInt(timestamp)
                };
            });
    }

    /**
     * Controlla se è un repository git
     * @returns {boolean}
     */
    isGitRepository() {
        return this._isGitRepo;
    }

    /**
     * Ottieni ultimo aggiornamento status
     * @returns {Date|null}
     */
    getLastUpdated() {
        return this._lastUpdated;
    }

    /**
     * Esegue un comando git
     * @private
     */
    async _runGitCommand(args) {
        const { stdout, stderr } = await execAsync(`git ${args}`, {
            cwd: this.workspacePath,
            encoding: 'utf8',
            maxBuffer: 10 * 1024 * 1024 // 10MB
        });

        if (stderr && !stderr.includes('warning')) {
            throw new Error(stderr);
        }

        return stdout;
    }
}

module.exports = GitRepository;
