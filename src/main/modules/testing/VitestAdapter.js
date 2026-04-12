/**
 * VitestAdapter - Adapter per framework Vitest
 * 
 * Responsabilità:
 * - Scoprire file Vitest (*.test.js, *.spec.js)
 * - Eseguire test singoli o gruppi
 * - Supportare modalità debug
 * - Supportare coverage
 * - Parsare output JSON
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const eventBus = require('../../core/EventBus');

class VitestAdapter {
  constructor(workspacePath) {
    this.workspacePath = workspacePath;
    this._activeProcess = null;
    this._isRunning = false;
    this._vitestPath = null;
  }

  /**
   * Inizializza l'adapter
   */
  async init() {
    this._vitestPath = await this._findVitest();
    
    if (!this._vitestPath) {
      console.warn('[VitestAdapter] Vitest not found in workspace');
    } else {
      console.log(`[VitestAdapter] Found Vitest at: ${this._vitestPath}`);
    }
  }

  /**
   * Controlla se Vitest è installato
   * @returns {Promise<boolean>}
   */
  async isInstalled() {
    return await this._findVitest() !== null;
  }

  /**
   * Installa Vitest nel workspace
   * @returns {Promise<boolean>}
   */
  async install() {
    return new Promise((resolve, reject) => {
      eventBus.emit('test:install-start', { framework: 'vitest' });
      
      const proc = spawn('npm', ['install', '--save-dev', 'vitest', '@vitest/coverage-v8'], {
        cwd: this.workspacePath,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let output = '';
      let errorOutput = '';

      proc.stdout.on('data', (data) => {
        output += data.toString();
        eventBus.emit('test:install-progress', { 
          framework: 'vitest', 
          message: data.toString() 
        });
      });

      proc.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          console.log('[VitestAdapter] Vitest installed successfully');
          eventBus.emit('test:install-success', { framework: 'vitest' });
          resolve(true);
        } else {
          console.error(`[VitestAdapter] Install failed with code ${code}`);
          eventBus.emit('test:install-error', { 
            framework: 'vitest', 
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
      throw new Error('[VitestAdapter] Another test is already running');
    }

    if (!await this.isInstalled()) {
      throw new Error('[VitestAdapter] Vitest not installed. Run install() first.');
    }

    const relativePath = path.relative(this.workspacePath, testFile);
    
    eventBus.emit('test:start', {
      file: relativePath,
      testName,
      framework: 'vitest',
      debug
    });

    return new Promise((resolve, reject) => {
      const args = ['vitest', 'run', relativePath, '--reporter=json'];

      // Debug mode
      if (debug) {
        args.unshift('node', '--inspect-brk', './node_modules/.bin/vitest');
        args.push('--no-threads');
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
        this._parseOutput(chunk, results);
      });

      this._activeProcess.stderr.on('data', (data) => {
        const chunk = data.toString();
        errorOutput += chunk;
        
        eventBus.emit('test:output', { 
          framework: 'vitest',
          type: 'stderr', 
          data: chunk 
        });
      });

      this._activeProcess.on('close', (code) => {
        this._isRunning = false;
        this._activeProcess = null;

        const success = code === 0;
        
        eventBus.emit('test:end', {
          framework: 'vitest',
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
          framework: 'vitest',
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
      throw new Error('[VitestAdapter] Another test is already running');
    }

    if (!await this.isInstalled()) {
      throw new Error('[VitestAdapter] Vitest not installed');
    }

    eventBus.emit('test:run-all', { 
      framework: 'vitest',
      debug: options.debug 
    });

    return new Promise((resolve, reject) => {
      const args = ['vitest', 'run', '--reporter=json'];

      if (options.debug) {
        args.push('--no-threads');
      }

      // Coverage
      if (options.coverage) {
        args.push('--coverage');
      }

      // Watch mode (disabled for CI)
      args.push('--watch=false');

      this._isRunning = true;
      this._activeProcess = spawn('npx', args, {
        cwd: this.workspacePath,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let output = '';
      let errorOutput = '';
      const results = [];
      let coverageData = null;

      this._activeProcess.stdout.on('data', (data) => {
        const chunk = data.toString();
        output += chunk;
        this._parseOutput(chunk, results);
        
        // Try to parse coverage if present
        if (options.coverage) {
          coverageData = this._tryParseCoverage(chunk);
        }
      });

      this._activeProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      this._activeProcess.on('close', (code) => {
        this._isRunning = false;
        this._activeProcess = null;

        eventBus.emit('test:run-all:end', {
          framework: 'vitest',
          success: code === 0,
          exitCode: code,
          results,
          coverage: coverageData,
          output,
          errorOutput
        });

        resolve({
          success: code === 0,
          exitCode: code,
          results,
          coverage: coverageData,
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
      console.log('[VitestAdapter] Stopping test');
      this._activeProcess.kill('SIGTERM');
      this._activeProcess = null;
      this._isRunning = false;
      
      eventBus.emit('test:stopped', { framework: 'vitest' });
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
   * Scopre i file di test Vitest
   * @returns {Promise<Array>} - Array di file test
   */
  async discoverTests() {
    const patterns = [
      '**/*.test.js',
      '**/*.spec.js',
      '**/*.test.ts',
      '**/*.spec.ts',
      '**/*.test.mts',
      '**/*.spec.mts'
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
                framework: 'vitest'
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
   * Parsa output JSON di Vitest
   * @private
   */
  _parseOutput(chunk, results) {
    try {
      const lines = chunk.split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          
          if (data.testResults) {
            for (const testResult of data.testResults) {
              for (const assertionResult of testResult.assertionResults || []) {
                const result = {
                  title: assertionResult.title,
                  fullName: assertionResult.fullName || assertionResult.title,
                  status: assertionResult.status,
                  duration: assertionResult.duration,
                  file: testResult.name,
                  failureMessages: assertionResult.failureMessages || [],
                  framework: 'vitest'
                };

                results.push(result);

                eventBus.emit('test:result', result);
              }
            }
          }
        } catch {
          // Not JSON, ignore
        }
      }
    } catch (err) {
      console.error('[VitestAdapter] Error parsing output:', err.message);
    }

    return results;
  }

  /**
   * Tenta di parsare coverage dall'output
   * @private
   */
  _tryParseCoverage(chunk) {
    try {
      // Vitest coverage output può essere in formato JSON
      const match = chunk.match(/"coverage":\s*(\{[\s\S]*?\})/);
      if (match) {
        return JSON.parse(match[1]);
      }
    } catch (err) {
      // Ignore
    }
    return null;
  }

  /**
   * Trova l'eseguibile Vitest
   * @private
   */
  async _findVitest() {
    const possiblePaths = [
      path.join(this.workspacePath, 'node_modules', '.bin', 'vitest'),
      path.join(this.workspacePath, 'node_modules', 'vitest', 'vitest.mjs')
    ];

    for (const vitestPath of possiblePaths) {
      try {
        await fs.access(vitestPath);
        return vitestPath;
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
      vitestInstalled: this._vitestPath !== null
    };
  }
}

module.exports = VitestAdapter;
