/**
 * GitHistory - Gestione log e cronologia commit
 * 
 * Responsabilità:
 * - Ottenere log commit
 * - Ottenere dettagli commit
 * - Navigare cronologia
 * - Blame file
 * - Confrontare commit
 */

const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

class GitHistory {
    constructor(workspacePath) {
        this.workspacePath = workspacePath;
    }

    /**
     * Ottieni log commit
     * @param {Object} [options] - Opzioni
     * @param {number} [options.maxCount=50] - Numero massimo di commit
     * @param {string} [options.branch] - Branch specifico
     * @param {string} [options.author] - Filtra per autore
     * @param {string} [options.since] - Filtra per data (es: "2 weeks ago")
     * @param {string} [options.filePath] - Filtra per file
     * @returns {Promise<Array>}
     */
    async getLog(options = {}) {
        const { 
            maxCount = 50, 
            branch = null, 
            author = null,
            since = null,
            filePath = null
        } = options;

        const format = '%H|%h|%an|%ae|%at|%ad|%s|%b';
        const args = [`--pretty=format:"${format}"`, `--max-count=${maxCount}`];

        if (branch) args.unshift(branch);
        if (author) args.push(`--author="${author}"`);
        if (since) args.push(`--since="${since}"`);
        if (filePath) args.push('--', filePath);

        const command = `log ${args.join(' ')}`;
        const output = await this._runGitCommand(command);

        return output
            .split('\n')
            .filter(line => line.trim() && !line.startsWith('"'))
            .map(line => {
                // Rimuovi quotes dal formato
                const cleanLine = line.replace(/^"|"$/g, '');
                const [hash, shortHash, authorName, authorEmail, timestamp, date, subject, body] = cleanLine.split('|');
                
                return {
                    hash,
                    shortHash,
                    author: {
                        name: authorName,
                        email: authorEmail
                    },
                    date: new Date(date),
                    timestamp: parseInt(timestamp),
                    message: subject,
                    body: body || '',
                    isMerge: subject.includes('Merge')
                };
            });
    }

    /**
     * Ottieni dettagli di un commit
     * @param {string} hash - Hash del commit
     * @returns {Promise<Object>}
     */
    async getCommitDetails(hash) {
        const format = '%H|%h|%an|%ae|%at|%ad|%s|%b';
        const logOutput = await this._runGitCommand(`log -1 --pretty=format:"${format}" ${hash}`);
        const cleanLine = logOutput.replace(/^"|"$/g, '');
        const [fullHash, shortHash, authorName, authorEmail, timestamp, date, subject, body] = cleanLine.split('|');

        // Ottieni file modificati
        const diffOutput = await this._runGitCommand(`diff-tree --no-commit-id --name-status -r ${hash}`);
        const files = diffOutput
            .split('\n')
            .filter(line => line.trim())
            .map(line => {
                const parts = line.split('\t');
                return {
                    status: parts[0],
                    path: parts[1]
                };
            });

        return {
            hash: fullHash,
            shortHash,
            author: {
                name: authorName,
                email: authorEmail
            },
            date: new Date(date),
            timestamp: parseInt(timestamp),
            message: subject,
            body: body || '',
            files
        };
    }

    /**
     * Ottieni diff di un commit
     * @param {string} hash - Hash del commit
     * @returns {Promise<string>}
     */
    async getCommitDiff(hash) {
        return await this._runGitCommand(`show ${hash}`);
    }

    /**
     * Blame di un file
     * @param {string} filePath - Percorso file
     * @param {string} [revision='HEAD'] - Revisione
     * @returns {Promise<Array>}
     */
    async blame(filePath, revision = 'HEAD') {
        const format = '%H|%an|%ad|%s';
        const output = await this._runGitCommand(
            `blame --line-porcelain ${revision} -- "${filePath}"`
        );

        const lines = output.split('\n');
        const blameInfo = [];
        let currentCommit = null;
        let lineNum = 0;

        for (const line of lines) {
            if (line.startsWith('author ')) {
                currentCommit = {
                    author: line.substring(7),
                    commit: lines[blameInfo.length * 10]?.split(' ')[0] || ''
                };
            } else if (line.startsWith('author-time ')) {
                if (currentCommit) {
                    currentCommit.date = new Date(parseInt(line.substring(12)) * 1000);
                }
            } else if (line.startsWith('\t')) {
                lineNum++;
                blameInfo.push({
                    line: lineNum,
                    content: line.substring(1),
                    commit: currentCommit?.commit || '',
                    author: currentCommit?.author || '',
                    date: currentCommit?.date || null
                });
                currentCommit = null;
            }
        }

        return blameInfo;
    }

    /**
     * Confronta due commit
     * @param {string} from - Commit di partenza
     * @param {string} to - Commit di arrivo
     * @returns {Promise<Object>}
     */
    async compareCommits(from, to) {
        // Ottieni file modificati
        const diffOutput = await this._runGitCommand(`diff --name-status ${from}..${to}`);
        const files = diffOutput
            .split('\n')
            .filter(line => line.trim())
            .map(line => {
                const parts = line.split('\t');
                return {
                    status: parts[0],
                    path: parts[1]
                };
            });

        // Conta statistiche
        const statOutput = await this._runGitCommand(`diff --stat ${from}..${to}`);
        
        return {
            from,
            to,
            files,
            stats: statOutput
        };
    }

    /**
     * Ottieni tag
     * @returns {Promise<Array>}
     */
    async getTags() {
        const output = await this._runGitCommand('tag -l --sort=-creatordate');
        
        return output
            .split('\n')
            .filter(line => line.trim())
            .map(name => ({ name }));
    }

    /**
     * Crea tag
     * @param {string} name - Nome tag
     * @param {string} [message=''] - Messaggio
     * @param {string} [commit='HEAD'] - Commit
     * @returns {Promise<Object>}
     */
    async createTag(name, message = '', commit = 'HEAD') {
        let command;
        if (message) {
            command = `tag -a "${name}" -m "${message}" ${commit}`;
        } else {
            command = `tag "${name}" ${commit}`;
        }
        
        const output = await this._runGitCommand(command);
        
        return { success: true, name, output };
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

module.exports = GitHistory;
