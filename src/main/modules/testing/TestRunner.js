/**
 * TestRunner Module - Modulo principale per l'esecuzione test
 * 
 * Coordina PlaywrightRunner, JestAdapter, VitestAdapter, etc.
 * Fornisce interfaccia unificata per eseguire test
 */

const TestDiscoveryModule = require('./TestDiscovery');
const PlaywrightRunner = require('./PlaywrightRunner');
const eventBus = require('../../core/EventBus');

class TestRunnerModule {
  constructor() {
    this._testDiscovery = null;
    this._runners = new Map();
    this._workspacePath = null;
    this._context = null;
  }

  async init(context) {
    console.log('[TestRunnerModule] Initializing test runner module');
    
    this._context = context;
    this._workspacePath = context.workspacePath || null;
    
    // Initialize test discovery
    this._testDiscovery = TestDiscoveryModule.init(context);

    console.log('[TestRunnerModule] Test runner module initialized');
  }

  async shutdown() {
    console.log('[TestRunnerModule] Shutting down test runner module');
    
    // Stop all running tests
    for (const [framework, runner] of this._runners.entries()) {
      if (runner.stop) {
        runner.stop();
      }
    }
    this._runners.clear();
    
    TestDiscoveryModule.shutdown();
  }

  /**
   * Configura il workspace per i test
   * @param {string} workspacePath
   */
  setWorkspace(workspacePath) {
    this._workspacePath = workspacePath;
    if (this._testDiscovery) {
      this._testDiscovery.clearCache();
    }
  }

  /**
   * Scopre i file di test nel workspace
   * @param {Object} [options] - Opzioni
   * @returns {Promise<Array>}
   */
  async discoverTests(options = {}) {
    if (!this._workspacePath) {
      throw new Error('[TestRunner] No workspace set');
    }

    return await this._testDiscovery.discoverTests(this._workspacePath, options);
  }

  /**
   * Rileva i framework di test disponibili
   * @returns {Promise<string[]>}
   */
  async detectFrameworks() {
    if (!this._workspacePath) {
      throw new Error('[TestRunner] No workspace set');
    }

    return await this._testDiscovery.detectFrameworks(this._workspacePath);
  }

  /**
   * Esegue un singolo file di test
   * @param {string} testFile - Percorso file test
   * @param {Object} [options] - Opzioni
   * @param {string} [options.framework] - Framework da usare
   * @param {boolean} [options.debug=false] - Modalità debug
   * @param {string} [options.testName] - Nome test specifico
   * @returns {Promise<Object>} - Risultato
   */
  async runTest(testFile, options = {}) {
    const { framework = null, debug = false, testName = null } = options;

    // Auto-detect framework if not specified
    const targetFramework = framework || await this._detectFrameworkForFile(testFile);
    
    if (!targetFramework) {
      throw new Error(`[TestRunner] No test framework detected for ${testFile}`);
    }

    // Get or create runner
    const runner = this._getOrCreateRunner(targetFramework);

    eventBus.emit('test:running', {
      file: testFile,
      framework: targetFramework,
      debug
    });

    // Run test
    return await runner.runTest(testFile, { debug, testName });
  }

  /**
   * Esegue tutti i test
   * @param {Object} [options] - Opzioni
   * @returns {Promise<Object>} - Risultato
   */
  async runAllTests(options = {}) {
    if (!this._workspacePath) {
      throw new Error('[TestRunner] No workspace set');
    }

    const frameworks = await this.detectFrameworks();
    const results = [];

    for (const framework of frameworks) {
      const runner = this._getOrCreateRunner(framework);
      
      try {
        const result = await runner.runAllTests(options);
        results.push({ framework, ...result });
      } catch (err) {
        console.error(`[TestRunner] Error running ${framework} tests:`, err.message);
        results.push({ framework, success: false, error: err.message });
      }
    }

    return {
      success: results.every(r => r.success),
      results
    };
  }

  /**
   * Ferma tutti i test in esecuzione
   */
  stopAll() {
    for (const [framework, runner] of this._runners.entries()) {
      if (runner.stop) {
        runner.stop();
      }
    }
    
    eventBus.emit('test:all-stopped');
  }

  /**
   * Controlla se ci sono test in esecuzione
   * @returns {boolean}
   */
  isRunning() {
    for (const [, runner] of this._runners.entries()) {
      if (runner.isRunning && runner.isRunning()) {
        return true;
      }
    }
    return false;
  }

  /**
   * Ottiene o crea un runner per un framework
   * @private
   */
  _getOrCreateRunner(framework) {
    if (!this._runners.has(framework)) {
      switch (framework) {
        case 'playwright':
          this._runners.set(framework, new PlaywrightRunner(this._workspacePath));
          break;
        case 'jest':
          // TODO: Implement JestAdapter
          throw new Error('[TestRunner] Jest not implemented yet');
        case 'vitest':
          // TODO: Implement VitestAdapter
          throw new Error('[TestRunner] Vitest not implemented yet');
        default:
          throw new Error(`[TestRunner] Unsupported framework: ${framework}`);
      }
    }

    return this._runners.get(framework);
  }

  /**
   * Rileva il framework per un file specifico
   * @private
   */
  async _detectFrameworkForFile(testFile) {
    const frameworks = await this.detectFrameworks();
    
    // Return first available framework
    return frameworks.length > 0 ? frameworks[0] : null;
  }

  /**
   * Ottiene statistiche
   * @returns {Object}
   */
  getStats() {
    const stats = {
      workspace: this._workspacePath,
      frameworks: [],
      running: []
    };

    for (const [framework, runner] of this._runners.entries()) {
      stats.frameworks.push(framework);
      if (runner.isRunning && runner.isRunning()) {
        stats.running.push(framework);
      }
    }

    return stats;
  }
}

// Modulo export
module.exports = {
  name: 'TestRunner',
  version: '1.0.0',
  
  _instance: new TestRunnerModule(),
  
  async init(context) {
    return this._instance.init(context);
  },
  
  async shutdown() {
    return this._instance.shutdown();
  },
  
  getInstance() {
    return this._instance;
  }
};
