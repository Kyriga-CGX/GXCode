/**
 * Git Module - Modulo principale per operazioni Git
 * 
 * Coordina GitRepository, GitOperations, GitConflictResolver, e GitHistory
 * 
 * Responsabilità:
 * - Inizializzare tutti i sotto-moduli
 * - Fornire API unificata per Git
 * - Gestire eventi Git
 * - Coordinare operazioni complesse
 */

const GitRepository = require('./GitRepository');
const GitOperations = require('./GitOperations');
const GitConflictResolver = require('./GitConflictResolver');
const GitHistory = require('./GitHistory');
const eventBus = require('../../core/EventBus');

class GitModule {
    constructor() {
        this._repository = null;
        this._operations = null;
        this._conflictResolver = null;
        this._history = null;
        this._workspacePath = null;
        this._initialized = false;
    }

    /**
     * Inizializza il modulo Git
     * @param {Object} context - Contesto dell'applicazione
     * @param {string} context.workspacePath - Percorso workspace
     */
    async init(context) {
        console.log('[GitModule] Initializing Git module...');

        this._workspacePath = context.workspacePath || process.cwd();

        try {
            // Inizializza repository
            this._repository = new GitRepository(this._workspacePath);
            const isGitRepo = await this._repository.init();

            if (!isGitRepo) {
                console.warn('[GitModule] Not a git repository');
                this._initialized = false;
                return { success: false, error: 'Not a git repository' };
            }

            // Inizializza sotto-moduli
            this._operations = new GitOperations(this._workspacePath);
            this._conflictResolver = new GitConflictResolver(this._workspacePath);
            this._history = new GitHistory(this._workspacePath);

            this._initialized = true;

            console.log('[GitModule] Git module initialized successfully');
            
            eventBus.emit('git:module-initialized', {
                workspacePath: this._workspacePath
            });

            return { success: true };
        } catch (err) {
            console.error('[GitModule] Initialization error:', err.message);
            this._initialized = false;
            return { success: false, error: err.message };
        }
    }

    /**
     * Spegne il modulo Git
     */
    shutdown() {
        console.log('[GitModule] Shutting down Git module...');
        this._repository = null;
        this._operations = null;
        this._conflictResolver = null;
        this._history = null;
        this._initialized = false;
        
        eventBus.emit('git:module-shutdown');
    }

    // === Repository ===

    /**
     * Ottieni status del repository
     * @returns {Promise<Object>}
     */
    async getStatus() {
        this._checkInitialized();
        return await this._repository.getStatus();
    }

    /**
     * Controlla se è un repository git
     * @returns {boolean}
     */
    isGitRepository() {
        return this._repository ? this._repository.isGitRepository() : false;
    }

    /**
     * Ottieni branch corrente
     * @returns {Promise<string>}
     */
    async getCurrentBranch() {
        this._checkInitialized();
        return await this._repository.getCurrentBranch();
    }

    /**
     * Ottieni lista branch
     * @returns {Promise<Array>}
     */
    async getBranches() {
        this._checkInitialized();
        return await this._repository.getBranches();
    }

    /**
     * Ottieni remote URL
     * @returns {Promise<string|null>}
     */
    async getRemoteUrl() {
        this._checkInitialized();
        return await this._repository.getRemoteUrl();
    }

    /**
     * Ottieni ultimi commit
     * @param {number} [count=10]
     * @returns {Promise<Array>}
     */
    async getRecentCommits(count = 10) {
        this._checkInitialized();
        return await this._repository.getRecentCommits(count);
    }

    // === Operations ===

    /**
     * Stage file
     * @param {string|string[]} files
     * @returns {Promise<Object>}
     */
    async stage(files) {
        this._checkInitialized();
        return await this._operations.stage(files);
    }

    /**
     * Stage tutti i file
     * @returns {Promise<Object>}
     */
    async stageAll() {
        this._checkInitialized();
        return await this._operations.stageAll();
    }

    /**
     * Unstage file
     * @param {string|string[]} files
     * @returns {Promise<Object>}
     */
    async unstage(files) {
        this._checkInitialized();
        return await this._operations.unstage(files);
    }

    /**
     * Unstage tutti i file
     * @returns {Promise<Object>}
     */
    async unstageAll() {
        this._checkInitialized();
        return await this._operations.unstageAll();
    }

    /**
     * Crea commit
     * @param {string} message
     * @param {Object} [options]
     * @returns {Promise<Object>}
     */
    async commit(message, options = {}) {
        this._checkInitialized();
        return await this._operations.commit(message, options);
    }

    /**
     * Push al remote
     * @param {Object} [options]
     * @returns {Promise<Object>}
     */
    async push(options = {}) {
        this._checkInitialized();
        return await this._operations.push(options);
    }

    /**
     * Pull dal remote
     * @param {Object} [options]
     * @returns {Promise<Object>}
     */
    async pull(options = {}) {
        this._checkInitialized();
        return await this._operations.pull(options);
    }

    /**
     * Crea branch
     * @param {string} name
     * @param {boolean} [checkout=true]
     * @returns {Promise<Object>}
     */
    async createBranch(name, checkout = true) {
        this._checkInitialized();
        return await this._operations.createBranch(name, checkout);
    }

    /**
     * Switch branch
     * @param {string} name
     * @returns {Promise<Object>}
     */
    async checkoutBranch(name) {
        this._checkInitialized();
        return await this._operations.checkoutBranch(name);
    }

    /**
     * Elimina branch
     * @param {string} name
     * @param {boolean} [force=false]
     * @returns {Promise<Object>}
     */
    async deleteBranch(name, force = false) {
        this._checkInitialized();
        return await this._operations.deleteBranch(name, force);
    }

    /**
     * Crea stash
     * @param {string} [message='']
     * @param {boolean} [includeUntracked=false]
     * @returns {Promise<Object>}
     */
    async stashCreate(message = '', includeUntracked = false) {
        this._checkInitialized();
        return await this._operations.stashCreate(message, includeUntracked);
    }

    /**
     * Lista stash
     * @returns {Promise<Array>}
     */
    async stashList() {
        this._checkInitialized();
        return await this._operations.stashList();
    }

    /**
     * Applica stash
     * @param {string} [ref='stash@{0}']
     * @param {boolean} [drop=false]
     * @returns {Promise<Object>}
     */
    async stashApply(ref = 'stash@{0}', drop = false) {
        this._checkInitialized();
        return await this._operations.stashApply(ref, drop);
    }

    /**
     * Elimina stash
     * @param {string} [ref='stash@{0}']
     * @returns {Promise<Object>}
     */
    async stashDrop(ref = 'stash@{0}') {
        this._checkInitialized();
        return await this._operations.stashDrop(ref);
    }

    // === Conflicts ===

    /**
     * Controlla se c'è un merge in corso
     * @returns {Promise<boolean>}
     */
    async isMergeInProgress() {
        this._checkInitialized();
        return await this._conflictResolver.isMergeInProgress();
    }

    /**
     * Rileva file con conflitti
     * @returns {Promise<Array>}
     */
    async detectConflicts() {
        this._checkInitialized();
        return await this._conflictResolver.detectConflicts();
    }

    /**
     * Parsa conflitti in un file
     * @param {string} filePath
     * @returns {Promise<Array>}
     */
    async parseConflicts(filePath) {
        this._checkInitialized();
        return await this._conflictResolver.parseConflicts(filePath);
    }

    /**
     * Risolvi conflitto accettando "ours"
     * @param {string} filePath
     * @returns {Promise<boolean>}
     */
    async acceptOurs(filePath) {
        this._checkInitialized();
        return await this._conflictResolver.acceptOurs(filePath);
    }

    /**
     * Risolvi conflitto accettando "theirs"
     * @param {string} filePath
     * @returns {Promise<boolean>}
     */
    async acceptTheirs(filePath) {
        this._checkInitialized();
        return await this._conflictResolver.acceptTheirs(filePath);
    }

    /**
     * Risolvi conflitto accettando entrambe
     * @param {string} filePath
     * @returns {Promise<boolean>}
     */
    async acceptBoth(filePath) {
        this._checkInitialized();
        return await this._conflictResolver.acceptBoth(filePath);
    }

    /**
     * Risolvi conflitto con contenuto custom
     * @param {string} filePath
     * @param {string} content
     * @returns {Promise<boolean>}
     */
    async acceptCustom(filePath, content) {
        this._checkInitialized();
        return await this._conflictResolver.acceptCustom(filePath, content);
    }

    /**
     * Stagea file dopo risoluzione
     * @param {string} file
     * @returns {Promise<boolean>}
     */
    async markConflictResolved(file) {
        this._checkInitialized();
        return await this._conflictResolver.markResolved(file);
    }

    // === History ===

    /**
     * Ottieni log commit
     * @param {Object} [options]
     * @returns {Promise<Array>}
     */
    async getLog(options = {}) {
        this._checkInitialized();
        return await this._history.getLog(options);
    }

    /**
     * Ottieni dettagli commit
     * @param {string} hash
     * @returns {Promise<Object>}
     */
    async getCommitDetails(hash) {
        this._checkInitialized();
        return await this._history.getCommitDetails(hash);
    }

    /**
     * Ottieni diff di un commit
     * @param {string} hash
     * @returns {Promise<string>}
     */
    async getCommitDiff(hash) {
        this._checkInitialized();
        return await this._history.getCommitDiff(hash);
    }

    /**
     * Blame di un file
     * @param {string} filePath
     * @param {string} [revision='HEAD']
     * @returns {Promise<Array>}
     */
    async blame(filePath, revision = 'HEAD') {
        this._checkInitialized();
        return await this._history.blame(filePath, revision);
    }

    /**
     * Confronta due commit
     * @param {string} from
     * @param {string} to
     * @returns {Promise<Object>}
     */
    async compareCommits(from, to) {
        this._checkInitialized();
        return await this._history.compareCommits(from, to);
    }

    /**
     * Ottieni tag
     * @returns {Promise<Array>}
     */
    async getTags() {
        this._checkInitialized();
        return await this._history.getTags();
    }

    /**
     * Crea tag
     * @param {string} name
     * @param {string} [message='']
     * @param {string} [commit='HEAD']
     * @returns {Promise<Object>}
     */
    async createTag(name, message = '', commit = 'HEAD') {
        this._checkInitialized();
        return await this._history.createTag(name, message, commit);
    }

    // === Diff ===

    /**
     * Ottieni diff di un file
     * @param {string} file
     * @param {string} [commit='HEAD']
     * @returns {Promise<string>}
     */
    async getDiff(file, commit = 'HEAD') {
        this._checkInitialized();
        return await this._operations.getDiff(file, commit);
    }

    /**
     * Ottieni contenuto di un file da un commit
     * @param {string} file
     * @param {string} [commit='HEAD']
     * @returns {Promise<string>}
     */
    async getFileContent(file, commit = 'HEAD') {
        this._checkInitialized();
        return await this._operations.getFileContent(file, commit);
    }

    // === Merge ===

    /**
     * Merge branch
     * @param {string} branch
     * @param {Object} [options]
     * @returns {Promise<Object>}
     */
    async merge(branch, options = {}) {
        this._checkInitialized();
        return await this._operations.merge(branch, options);
    }

    /**
     * Abort merge
     * @returns {Promise<Object>}
     */
    async abortMerge() {
        this._checkInitialized();
        return await this._operations.abortMerge();
    }

    // === Utility ===

    /**
     * Controlla se inizializzato
     * @private
     */
    _checkInitialized() {
        if (!this._initialized) {
            throw new Error('[GitModule] Git module not initialized');
        }
    }

    /**
     * Ottieni stato del modulo
     * @returns {Object}
     */
    getStatus() {
        return {
            initialized: this._initialized,
            workspacePath: this._workspacePath,
            isGitRepo: this._repository ? this._repository.isGitRepository() : false
        };
    }
}

// Modulo export
module.exports = {
    name: 'Git',
    version: '1.0.0',

    _instance: new GitModule(),

    async init(context) {
        return this._instance.init(context);
    },

    shutdown() {
        return this._instance.shutdown();
    },

    getInstance() {
        return this._instance;
    }
};
