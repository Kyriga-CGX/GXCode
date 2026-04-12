/**
 * GitOperations - Operazioni di scrittura su repository Git
 * 
 * Responsabilità:
 * - Stage/unstage file
 * - Commit
 * - Push/Pull
 * - Creare/switch branch
 * - Gestire stash
 * - Risolvere merge conflicts
 */

const { exec } = require('child_process');
const path = require('path');
const eventBus = require('../../core/EventBus');
const util = require('util');
const execAsync = util.promisify(exec);

class GitOperations {
    constructor(workspacePath) {
        this.workspacePath = workspacePath;
        this._isRunning = false;
    }

    /**
     * Stage file
     * @param {string|string[]} files - File da stageare
     * @returns {Promise<Object>}
     */
    async stage(files) {
        const fileList = Array.isArray(files) ? files : [files];
        const quotedFiles = fileList.map(f => `"${f}"`).join(' ');
        
        await this._runGitCommand(`add ${quotedFiles}`);
        
        eventBus.emit('git:stage-complete', { files: fileList });
        
        return { success: true, files: fileList };
    }

    /**
     * Stage tutti i file modificati
     * @returns {Promise<Object>}
     */
    async stageAll() {
        await this._runGitCommand('add -A');
        
        eventBus.emit('git:stage-all-complete');
        
        return { success: true };
    }

    /**
     * Unstage file
     * @param {string|string[]} files - File da unstageare
     * @returns {Promise<Object>}
     */
    async unstage(files) {
        const fileList = Array.isArray(files) ? files : [files];
        const quotedFiles = fileList.map(f => `"${f}"`).join(' ');
        
        await this._runGitCommand(`reset HEAD ${quotedFiles}`);
        
        eventBus.emit('git:unstage-complete', { files: fileList });
        
        return { success: true, files: fileList };
    }

    /**
     * Unstage tutti i file
     * @returns {Promise<Object>}
     */
    async unstageAll() {
        await this._runGitCommand('reset');
        
        eventBus.emit('git:unstage-all-complete');
        
        return { success: true };
    }

    /**
     * Crea commit
     * @param {string} message - Messaggio di commit
     * @param {Object} [options] - Opzioni aggiuntive
     * @param {boolean} [options.amend=false] - Modifica ultimo commit
     * @param {boolean} [options.allowEmpty=false] - Permetti commit vuoto
     * @returns {Promise<Object>}
     */
    async commit(message, options = {}) {
        const flags = [];
        if (options.amend) flags.push('--amend');
        if (options.allowEmpty) flags.push('--allow-empty');
        
        const command = `commit ${flags.join(' ')} -m "${message}"`;
        const output = await this._runGitCommand(command);
        
        eventBus.emit('git:commit-complete', { message, output });
        
        return { success: true, message, output };
    }

    /**
     * Push al remote
     * @param {Object} [options] - Opzioni
     * @param {string} [options.remote='origin'] - Remote name
     * @param {string} [options.branch] - Branch name
     * @param {boolean} [options.force=false] - Force push
     * @param {boolean} [options.setUpstream=false] - Set upstream
     * @returns {Promise<Object>}
     */
    async push(options = {}) {
        const { 
            remote = 'origin', 
            branch = null, 
            force = false, 
            setUpstream = false 
        } = options;

        const flags = [];
        if (force) flags.push('--force');
        if (setUpstream) flags.push('-u');

        const branchArg = branch ? ` ${remote} ${branch}` : ` ${remote}`;
        const command = `push ${flags.join(' ')}${branchArg}`;
        
        eventBus.emit('git:push-start', { remote, branch, force });
        
        const output = await this._runGitCommand(command);
        
        eventBus.emit('git:push-complete', { remote, branch, output });
        
        return { success: true, output };
    }

    /**
     * Pull dal remote
     * @param {Object} [options] - Opzioni
     * @param {string} [options.remote='origin'] - Remote name
     * @param {string} [options.branch] - Branch name
     * @param {boolean} [options.rebase=false] - Usa rebase invece di merge
     * @returns {Promise<Object>}
     */
    async pull(options = {}) {
        const { remote = 'origin', branch = null, rebase = false } = options;

        const flags = [];
        if (rebase) flags.push('--rebase');

        const branchArg = branch ? ` ${remote} ${branch}` : ` ${remote}`;
        const command = `pull ${flags.join(' ')}${branchArg}`;
        
        eventBus.emit('git:pull-start', { remote, branch });
        
        const output = await this._runGitCommand(command);
        
        eventBus.emit('git:pull-complete', { remote, branch, output });
        
        return { success: true, output };
    }

    /**
     * Crea nuovo branch
     * @param {string} name - Nome del branch
     * @param {boolean} [checkout=true] - Switch al nuovo branch
     * @returns {Promise<Object>}
     */
    async createBranch(name, checkout = true) {
        const command = checkout ? `checkout -b "${name}"` : `branch "${name}"`;
        const output = await this._runGitCommand(command);
        
        eventBus.emit('git:branch-created', { name, checkout });
        
        return { success: true, name, output };
    }

    /**
     * Switch branch
     * @param {string} name - Nome del branch
     * @returns {Promise<Object>}
     */
    async checkoutBranch(name) {
        const output = await this._runGitCommand(`checkout "${name}"`);
        
        eventBus.emit('git:branch-checkedout', { name });
        
        return { success: true, name, output };
    }

    /**
     * Elimina branch
     * @param {string} name - Nome del branch
     * @param {boolean} [force=false] - Forza eliminazione
     * @returns {Promise<Object>}
     */
    async deleteBranch(name, force = false) {
        const flag = force ? '-D' : '-d';
        const output = await this._runGitCommand(`branch ${flag} "${name}"`);
        
        eventBus.emit('git:branch-deleted', { name, force });
        
        return { success: true, name, output };
    }

    /**
     * Crea stash
     * @param {string} [message=''] - Messaggio stash
     * @param {boolean} [includeUntracked=false] - Includi file untracked
     * @returns {Promise<Object>}
     */
    async stashCreate(message = '', includeUntracked = false) {
        const flag = includeUntracked ? '-u' : '';
        const msgFlag = message ? `-m "${message}"` : '';
        const command = `stash ${flag} ${msgFlag}`;
        
        const output = await this._runGitCommand(command);
        
        eventBus.emit('git:stash-created', { message });
        
        return { success: true, output };
    }

    /**
     * Lista stash
     * @returns {Promise<Array>}
     */
    async stashList() {
        const output = await this._runGitCommand('stash list');
        
        return output
            .split('\n')
            .filter(line => line.trim())
            .map((line, index) => {
                const match = line.match(/^(stash@{\d+}):\s*(.+)$/);
                return match ? {
                    ref: match[1],
                    message: match[2],
                    index
                } : null;
            })
            .filter(Boolean);
    }

    /**
     * Applica stash
     * @param {string} [ref='stash@{0}'] - Reference stash
     * @param {boolean} [drop=false] - Elimina stash dopo applicazione
     * @returns {Promise<Object>}
     */
    async stashApply(ref = 'stash@{0}', drop = false) {
        if (drop) {
            const output = await this._runGitCommand(`stash pop "${ref}"`);
            return { success: true, ref, output, dropped: true };
        } else {
            const output = await this._runGitCommand(`stash apply "${ref}"`);
            return { success: true, ref, output, dropped: false };
        }
    }

    /**
     * Elimina stash
     * @param {string} [ref='stash@{0}'] - Reference stash
     * @returns {Promise<Object>}
     */
    async stashDrop(ref = 'stash@{0}') {
        const output = await this._runGitCommand(`stash drop "${ref}"`);
        
        eventBus.emit('git:stash-dropped', { ref });
        
        return { success: true, ref, output };
    }

    /**
     * Ottieni diff di un file
     * @param {string} file - Percorso file
     * @param {string} [commit='HEAD'] - Commit di riferimento
     * @returns {Promise<string>}
     */
    async getDiff(file, commit = 'HEAD') {
        try {
            const output = await this._runGitCommand(`diff ${commit} -- "${file}"`);
            return output;
        } catch (err) {
            // File potrebbe essere untracked
            return null;
        }
    }

    /**
     * Ottieni contenuto di un file da un commit
     * @param {string} file - Percorso file
     * @param {string} [commit='HEAD'] - Commit
     * @returns {Promise<string>}
     */
    async getFileContent(file, commit = 'HEAD') {
        const relPath = path.relative(this.workspacePath, file).replace(/\\/g, '/');
        const output = await this._runGitCommand(`show "${commit}:${relPath}"`);
        return output;
    }

    /**
     * Merge branch
     * @param {string} branch - Branch da mergiare
     * @param {Object} [options] - Opzioni
     * @returns {Promise<Object>}
     */
    async merge(branch, options = {}) {
        const flags = [];
        if (options.noCommit) flags.push('--no-commit');
        if (options.noFastForward) flags.push('--no-ff');
        if (options.squash) flags.push('--squash');
        if (options.message) flags.push(`-m "${options.message}"`);

        const command = `merge ${flags.join(' ')} "${branch}"`;
        const output = await this._runGitCommand(command);
        
        eventBus.emit('git:merge-complete', { branch, output });
        
        return { success: true, branch, output };
    }

    /**
     * Abort merge
     * @returns {Promise<Object>}
     */
    async abortMerge() {
        const output = await this._runGitCommand('merge --abort');
        
        eventBus.emit('git:merge-aborted');
        
        return { success: true, output };
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

module.exports = GitOperations;
