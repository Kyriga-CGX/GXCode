/**
 * JestAdapter - Adapter per framework Jest
 * 
 * Responsabilità:
 * - Scoprire file Jest (*.test.js, *.spec.js)
 * - Eseguire test singoli o gruppi
 * - Supportare modalità debug
 * - Parsare output JSON
 * - Emettere eventi per la UI
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const eventBus = require('../../core/EventBus');

class JestAdapter {
  constructor(workspacePath) {
    this.workspacePath = workspacePath;
    this._activeProcess = null;
    this._isRunning = false;
    this._jestPath = null;
  }

  /**
   * Inizializza l'adapter
   */
  async init() {
    // Trova jest
    this._jestPath = await this._findJest();
    
    if (!this._jestPath) {
      console.warn('[JestAdapter] Jest not found in workspace');
    } else {
      console.log(`[JestAdapter] Found Jest at: ${this._jestPath}`);
    }
  }

  /**
   * Controlla se Jest è installato
   * @returns {Promise<boolean>}
   */
  async isInstalled() {
    return await this._findJest() !== null;
  }

  /**
   * Installa Jest nel workspace
   * @returns {Promise<boolean>}
   */
  async install() {
    return new Promise((resolve, reject) => {
      eventBus.emit('test:install-start', { framework: 'jest' });
      
      const proc = spawn('npm', ['install', '--save-dev', 'jest', 'jest-environment-jsdom'], {
        cwd: this.workspacePath,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let output = '';
      let errorOutput = '';

      proc.stdout.on('data', (data) => {
        output += data.toString();
        eventBus.emit('test:install-progress', { 
          framework: 'jest', 
          message: data.toString() 
        });
      });

      proc.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          console.log('[JestAdapter] Jest installed successfully');
          eventBus.emit('test:install-success', { framework: 'jest' });
          resolve(true);
        } else {
          console.error(`[JestAdapter] Install failed with code ${code}`);
          eventBus.emit('test:install-error', { 
            framework: 'jest', 
            error: errorOutput 
          });
          reject(new Error(`Install failed: ${errorOutput}`));
        }
      });

      proc.on('error', reject);
    });
  }

  /**
   * Esegue un singolo file di test
   * @param {string} testFile - Percorso file test
   * @param {Object} [options] - Opzioni
   * @param {boolean} [options.debug=false] - Modalità debug
   * @param {string} [options.testName] - Nome test specifico
   * @returns {Promise<Object>} - Risultato esecuzione
   */
  async runTest(testFile, options = {}) {
    const { debug = false, testName = null } = options;

    if (this._isRunning) {
      throw new Error('[JestAdapter] Another test is already running');
    }

    if (!await this.isInstalled()) {
      throw new Error('[JestAdapter] Jest not installed. Run install() first.');
    }

    const relativePath = path.relative(this.workspacePath, testFile);
    
    eventBus.emit('test:start', {
      file: relativePath,
      testName,
      framework: 'jest',
      debug
    });

    return new Promise((resolve, reject) => {
      const args = ['jest', relativePath, '--json', '--verbose'];

      // Debug mode
      if (debug) {
        args.unshift('node', '--inspect-brk', './node_modules/.bin/jest');
        args.push('--runInBand');
      }

      // Test name filter
      if (testName) {
        args.push('-t', testName);
      }

      this._isRunning = true;
      this._activeProcess = spawn('npx', args, {
        cwd: this.workspacePath,
        env: { 
          ...process.env, 
          FORCE_COLOR: '1',
          NODE_ENV: 'test'
        },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let output = '';
      let errorOutput = '';
      const results = [];

      this._activeProcess.stdout.on('data', (data) => {
        const chunk = data.toString();
        output += chunk;
        
        // Try to parse JSON output
        this._parseOutput(chunk, results);
      });

      this._activeProcess.stderr.on('data', (data) => {
        const chunk = data.toString();
        errorOutput += chunk;
        
        eventBus.emit('test:output', { 
          framework: 'jest',
          type: 'stderr', 
          data: chunk 
        });
      });

      this._activeProcess.on('close', (code) => {
        this._isRunning = false;
        this._activeProcess = null;

        const success = code === 0;
        
        eventBus.emit('test:end', {
          framework: 'jest',
          file: relativePath,
          testName,
          success,
          exitCode: code,
          results,
          output,
          errorOutput
        });

        resolve({
          success,
          exitCode: code,
          results,
          output,
          errorOutput
        });
      });

      this._activeProcess.on('error', (err) => {
        this._isRunning = false;
        this._activeProcess = null;

        eventBus.emit('test:error', {
          framework: 'jest',
          file: relativePath,
          error: err.message
        });

        reject(err);
      });
    });
  }

  /**
   * Esegue tutti i test
   * @param {Object} [options] - Opzioni
   * @returns {Promise<Object>} - Risultato
   */
  async runAllTests(options = {}) {
    if (this._isRunning) {
      throw new Error('[JestAdapter] Another test is already running');
    }

    if (!await this.isInstalled()) {
      throw new Error('[JestAdapter] Jest not installed');
    }

    eventBus.emit('test:run-all', { 
      framework: 'jest',
      debug: options.debug 
    });

    return new Promise((resolve, reject) => {
      const args = ['jest', '--json', '--verbose', '--watchAll=false'];

      if (options.debug) {
        args.push('--runInBand');
      }

      // Coverage
      if (options.coverage) {
        args.push('--coverage');
      }

      this._isRunning = true;
      this._activeProcess = spawn('npx', args, {
        cwd: this.workspacePath,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let output = '';
      let errorOutput = '';
      const results = [];

      this._activeProcess.stdout.on('data', (data) => {
        const chunk = data.toString();
        output += chunk;
        this._parseOutput(chunk, results);
      });

      this._activeProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      this._activeProcess.on('close', (code) => {
        this._isRunning = false;
        this._activeProcess = null;

        eventBus.emit('test:run-all:end', {
          framework: 'jest',
          success: code === 0,
          exitCode: code,
          results,
          output,
          errorOutput
        });

        resolve({
          success: code === 0,
          exitCode: code,
          results,
          output,
          errorOutput
        });
      });

      this._activeProcess.on('error', (err) => {
        this._isRunning = false;
        this._activeProcess = null;
        reject(err);
      });
    });
  }

  /**
   * Ferma il test corrente
   */
  stop() {
    if (this._activeProcess) {
      console.log('[JestAdapter] Stopping test');
      this._activeProcess.kill('SIGTERM');
      this._activeProcess = null;
      this._isRunning = false;
      
      eventBus.emit('test:stopped', { framework: 'jest' });
    }
  }

  /**
   * Controlla se un test è in esecuzione
   * @returns {boolean}
   */
  isRunning() {
    return this._isRunning;
  }

  /**
   * Scopre i file di test Jest
   * @returns {Promise<Array>} - Array di file test
   */
  async discoverTests() {
    const patterns = [
      '**/*.test.js',
      '**/*.spec.js',
      '**/*.test.jsx',
      '**/*.spec.jsx',
      '**/*.test.ts',
      '**/*.spec.ts',
      '**/*.test.tsx',
      '**/*.spec.tsx'
    ];

    const testFiles = [];
    const excludeDirs = ['node_modules', '.git', 'dist', 'build', 'coverage'];

    async function scan(dir) {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          if (entry.isDirectory()) {
            if (!excludeDirs.includes(entry.name)) {
              await scan(fullPath);
            }
          } else if (entry.isFile()) {
            const matches = patterns.some(pattern => {
              const regex = new RegExp(pattern.replace(/\*\*/g, '.*').replace(/\./g, '\\.'));
              return regex.test(entry.name);
            });

            if (matches) {
              testFiles.push({
                path: fullPath,
                relativePath: path.relative(this.workspacePath, fullPath),
                name: entry.name,
                framework: 'jest'
              });
            }
          }
        }
      } catch (err) {
        // Ignore permission errors
      }
    }

    await scan(this.workspacePath);
    return testFiles;
  }

  /**
   * Genera report coverage
   * @param {Object} coverageData - Dati coverage
   * @returns {Object} - Report formattato
   */
  generateCoverageReport(coverageData) {
    if (!coverageData) {
      return null;
    }

    const report = {
      total: {
        lines: { total: 0, covered: 0, pct: 0 },
        statements: { total: 0, covered: 0, pct: 0 },
        functions: { total: 0, covered: 0, pct: 0 },
        branches: { total: 0, covered: 0, pct: 0 }
      },
      files: []
    };

    for (const [file, data] of Object.entries(coverageData)) {
      const fileReport = {
        path: file,
        lines: {
          total: data.l ? Object.keys(data.l).length : 0,
          covered: data.l ? Object.values(data.l).filter(v => v > 0).length : 0
        },
        statements: {
          total: data.s ? Object.keys(data.s).length : 0,
          covered: data.s ? Object.values(data.s).filter(v => v > 0).length : 0
        },
        functions: {
          total: data.f ? Object.keys(data.f).length : 0,
          covered: data.f ? Object.values(data.f).filter(v => v > 0).length : 0
        },
        branches: {
          total: data.b ? Object.keys(data.b).length : 0,
          covered: data.b ? Object.values(data.b).filter(v => v > 0).length : 0
        }
      };

      // Calculate percentages
      fileReport.lines.pct = fileReport.lines.total > 0 
        ? (fileReport.lines.covered / fileReport.lines.total * 100).toFixed(1) 
        : 100;
      fileReport.statements.pct = fileReport.statements.total > 0 
        ? (fileReport.statements.covered / fileReport.statements.total * 100).toFixed(1) 
        : 100;
      fileReport.functions.pct = fileReport.functions.total > 0 
        ? (fileReport.functions.covered / fileReport.functions.total * 100).toFixed(1) 
        : 100;
      fileReport.branches.pct = fileReport.branches.total > 0 
        ? (fileReport.branches.covered / fileReport.branches.total * 100).toFixed(1) 
        : 100;

      report.files.push(fileReport);

      // Accumulate totals
      report.total.lines.total += fileReport.lines.total;
      report.total.lines.covered += fileReport.lines.covered;
      report.total.statements.total += fileReport.statements.total;
      report.total.statements.covered += fileReport.statements.covered;
      report.total.functions.total += fileReport.functions.total;
      report.total.functions.covered += fileReport.functions.covered;
      report.total.branches.total += fileReport.branches.total;
      report.total.branches.covered += fileReport.branches.covered;
    }

    // Calculate overall percentages
    report.total.lines.pct = report.total.lines.total > 0 
      ? (report.total.lines.covered / report.total.lines.total * 100).toFixed(1) 
      : 100;
    report.total.statements.pct = report.total.statements.total > 0 
      ? (report.total.statements.covered / report.total.statements.total * 100).toFixed(1) 
      : 100;
    report.total.functions.pct = report.total.functions.total > 0 
      ? (report.total.functions.covered / report.total.functions.total * 100).toFixed(1) 
      : 100;
    report.total.branches.pct = report.total.branches.total > 0 
      ? (report.total.branches.covered / report.total.branches.total * 100).toFixed(1) 
      : 100;

    return report;
  }

  /**
   * Parsa output JSON di Jest
   * @private
   */
  _parseOutput(chunk, results) {
    try {
      // Jest JSON output può essere in mezzo ad altro testo
      const lines = chunk.split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          
          if (data.testResults) {
            // Jest full JSON output
            for (const testResult of data.testResults) {
              for (const assertionResult of testResult.assertionResults) {
                const result = {
                  title: assertionResult.title,
                  status: assertionResult.status, // 'passed', 'failed', 'skipped', 'pending'
                  duration: assertionResult.duration,
                  file: testResult.name,
                  ancestorTitles: assertionResult.ancestorTitles || [],
                  failureMessages: assertionResult.failureMessages || []
                };

                results.push(result);

                eventBus.emit('test:result', {
                  framework: 'jest',
                  ...result
                });
              }
            }
          }
        } catch {
          // Not JSON, ignore
        }
      }
    } catch (err) {
      console.error('[JestAdapter] Error parsing output:', err.message);
    }

    return results;
  }

  /**
   * Trova l'eseguibile Jest
   * @private
   */
  async _findJest() {
    const possiblePaths = [
      path.join(this.workspacePath, 'node_modules', '.bin', 'jest'),
      path.join(this.workspacePath, 'node_modules', 'jest', 'bin', 'jest.js')
    ];

    for (const jestPath of possiblePaths) {
      try {
        await fs.access(jestPath);
        return jestPath;
      } catch {
        // Not found
      }
    }

    return null;
  }

  /**
   * Ottiene statistiche
   * @returns {Object}
   */
  getStats() {
    return {
      isRunning: this._isRunning,
      workspace: this.workspacePath,
      jestInstalled: this._jestPath !== null
    };
  }
}

module.exports = JestAdapter;
