/**
 * PlaywrightRunner - Esegue test Playwright
 * 
 * Responsabilità:
 * - Eseguire test singoli o gruppi
 * - Supportare modalità debug
 * - Catturare output e risultati
 * - Emettere eventi per la UI
 */

const { spawn } = require('child_process');
const path = require('path');
const eventBus = require('../../core/EventBus');

class PlaywrightRunner {
  constructor(workspacePath) {
    this.workspacePath = workspacePath;
    this._activeProcess = null;
    this._isRunning = false;
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
      throw new Error('[PlaywrightRunner] Another test is already running');
    }

    const relativePath = path.relative(this.workspacePath, testFile);
    
    eventBus.emit('test:start', {
      file: relativePath,
      testName,
      debug
    });

    return new Promise((resolve, reject) => {
      const args = ['node_modules/.bin/playwright', 'test', relativePath];

      // Add test name filter
      if (testName) {
        args.push('-g', testName);
      }

      // Debug mode
      if (debug) {
        args.push('--headed', '--timeout=0');
      }

      // Add reporter
      args.push('--reporter=json');

      this._isRunning = true;
      this._activeProcess = spawn('npx', args, {
        cwd: this.workspacePath,
        env: { ...process.env },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let output = '';
      let errorOutput = '';

      this._activeProcess.stdout.on('data', (data) => {
        const chunk = data.toString();
        output += chunk;
        
        // Parse JSON output
        this._parseOutput(chunk);
      });

      this._activeProcess.stderr.on('data', (data) => {
        const chunk = data.toString();
        errorOutput += chunk;
        
        eventBus.emit('test:output', { type: 'stderr', data: chunk });
      });

      this._activeProcess.on('close', (code) => {
        this._isRunning = false;
        this._activeProcess = null;

        const success = code === 0;
        
        eventBus.emit('test:end', {
          file: relativePath,
          testName,
          success,
          exitCode: code,
          output,
          errorOutput
        });

        resolve({
          success,
          exitCode: code,
          output,
          errorOutput
        });
      });

      this._activeProcess.on('error', (err) => {
        this._isRunning = false;
        this._activeProcess = null;

        eventBus.emit('test:error', {
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
      throw new Error('[PlaywrightRunner] Another test is already running');
    }

    eventBus.emit('test:run-all', { debug: options.debug });

    return new Promise((resolve, reject) => {
      const args = ['node_modules/.bin/playwright', 'test'];

      if (options.debug) {
        args.push('--headed', '--timeout=0');
      }

      args.push('--reporter=json');

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
      console.log('[PlaywrightRunner] Stopping test');
      this._activeProcess.kill('SIGTERM');
      this._activeProcess = null;
      this._isRunning = false;
      
      eventBus.emit('test:stopped');
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
   * Parsa l'output JSON di Playwright
   * @private
   */
  _parseOutput(chunk, results = []) {
    try {
      // Playwright JSON reporter output
      const lines = chunk.split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          
          if (data.type === 'test' && data.title) {
            const testResult = {
              title: data.title,
              status: data.status, // 'passed', 'failed', 'skipped'
              duration: data.duration,
              file: data.location?.file,
              line: data.location?.line
            };

            results.push(testResult);

            eventBus.emit('test:result', testResult);
          }
        } catch {
          // Not JSON, ignore
        }
      }
    } catch (err) {
      console.error('[PlaywrightRunner] Error parsing output:', err.message);
    }

    return results;
  }

  /**
   * Ottiene statistiche
   * @returns {Object}
   */
  getStats() {
    return {
      isRunning: this._isRunning,
      workspace: this.workspacePath
    };
  }
}

module.exports = PlaywrightRunner;
