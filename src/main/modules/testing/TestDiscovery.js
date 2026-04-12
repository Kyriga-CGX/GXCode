/**
 * TestDiscovery - Scopre e cataloga i file di test
 * 
 * Responsabilità:
 * - Scansionare workspace per file di test
 * - Identificare framework di test (Playwright, Jest, Vitest, Mocha)
 * - Parsare nomi di test per tree view
 * - Cache risultati
 */

const path = require('path');
const fs = require('fs').promises;

class TestDiscovery {
  constructor() {
    this._cache = new Map();
    this._cacheTimeout = 5000; // 5 secondi
  }

  /**
   * Scansiona il workspace per file di test
   * @param {string} workspacePath - Percorso workspace
   * @param {Object} [options] - Opzioni
   * @param {string[]} [options.patterns] - Pattern glob da cercare
   * @param {boolean} [options.useCache=true] - Usa cache
   * @returns {Promise<Array>} - Array di file test trovati
   */
  async discoverTests(workspacePath, options = {}) {
    const {
      patterns = ['**/*.spec.js', '**/*.test.js', '**/*.spec.ts', '**/*.test.ts'],
      useCache = true
    } = options;

    // Check cache
    if (useCache) {
      const cached = this._getFromCache(workspacePath, patterns);
      if (cached) return cached;
    }

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
            // Check if matches test patterns
            const matches = patterns.some(pattern => {
              const regex = patternToRegex(pattern);
              return regex.test(entry.name);
            });

            if (matches) {
              testFiles.push({
                path: fullPath,
                relativePath: path.relative(workspacePath, fullPath),
                name: entry.name,
                size: (await fs.stat(fullPath)).size,
                modifiedAt: (await fs.stat(fullPath)).mtime
              });
            }
          }
        }
      } catch (err) {
        // Ignore permission errors
        console.warn(`[TestDiscovery] Cannot scan ${dir}:`, err.message);
      }
    }

    await scan(workspacePath);

    // Cache results
    this._setCache(workspacePath, patterns, testFiles);

    return testFiles;
  }

  /**
   * Analizza un file test per estrarre i nomi dei test
   * @param {string} filePath - Percorso file
   * @returns {Promise<Array>} - Array di test names
   */
  async parseTestNames(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const tests = [];

      // Match test() o it()
      const testRegex = /(?:test|it)\s*\(\s*['"`]([^'"`]+)['"`]/g;
      let match;

      while ((match = testRegex.exec(content)) !== null) {
        tests.push({
          name: match[1],
          line: content.substring(0, match.index).split('\n').length
        });
      }

      // Match describe() blocks
      const describeRegex = /describe\s*\(\s*['"`]([^'"`]+)['"`]/g;
      while ((match = describeRegex.exec(content)) !== null) {
        tests.push({
          name: match[1],
          line: content.substring(0, match.index).split('\n').length,
          type: 'describe'
        });
      }

      return tests;
    } catch (err) {
      console.error(`[TestDiscovery] Error parsing test names from ${filePath}:`, err.message);
      return [];
    }
  }

  /**
   * Determina il framework di test usato
   * @param {string} workspacePath - Percorso workspace
   * @returns {Promise<string[]>} - Framework rilevati
   */
  async detectFrameworks(workspacePath) {
    const frameworks = [];

    try {
      // Check package.json
      const packagePath = path.join(workspacePath, 'package.json');
      const packageContent = await fs.readFile(packagePath, 'utf-8');
      const packageJson = JSON.parse(packageContent);

      const deps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies
      };

      if (deps['@playwright/test']) frameworks.push('playwright');
      if (deps['jest']) frameworks.push('jest');
      if (deps['vitest']) frameworks.push('vitest');
      if (deps['mocha']) frameworks.push('mocha');
      if (deps['jasmine']) frameworks.push('jasmine');

    } catch (err) {
      // package.json non esiste o non leggibile
      console.warn('[TestDiscovery] Could not read package.json:', err.message);
    }

    return frameworks;
  }

  /**
   * Controlla se Playwright è installato
   * @param {string} workspacePath - Percorso workspace
   * @returns {Promise<Object>} - Info installazione
   */
  async checkPlaywright(workspacePath) {
    const info = {
      installed: false,
      version: null,
      browsers: { chromium: false, firefox: false, webkit: false },
      path: null
    };

    try {
      // Check if @playwright/test exists
      const playwrightPath = path.join(workspacePath, 'node_modules', '@playwright', 'test');
      
      try {
        await fs.access(playwrightPath);
        info.installed = true;
        info.path = playwrightPath;

        // Get version
        const packagePath = path.join(workspacePath, 'node_modules', '@playwright', 'test', 'package.json');
        const packageContent = await fs.readFile(packagePath, 'utf-8');
        info.version = JSON.parse(packageContent).version;

        // Check installed browsers
        const browsersPath = path.join(workspacePath, 'node_modules', 'playwright-core');
        await fs.access(browsersPath);
        info.browsers.chromium = true; // Assume Chromium
      } catch {
        // Not installed
      }
    } catch (err) {
      console.error('[TestDiscovery] Error checking Playwright:', err.message);
    }

    return info;
  }

  /**
   * Pulisce la cache
   */
  clearCache() {
    this._cache.clear();
  }

  /**
   * Ottiene dalla cache
   * @private
   */
  _getFromCache(workspacePath, patterns) {
    const key = `${workspacePath}:${patterns.join(',')}`;
    const cached = this._cache.get(key);
    
    if (cached && Date.now() - cached.timestamp < this._cacheTimeout) {
      return cached.data;
    }
    
    return null;
  }

  /**
   * Imposta nella cache
   * @private
   */
  _setCache(workspacePath, patterns, data) {
    const key = `${workspacePath}:${patterns.join(',')}`;
    this._cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }
}

/**
 * Converte pattern glob in regex
 * @private
 */
function patternToRegex(pattern) {
  const escaped = pattern
    .replace(/\./g, '\\.')
    .replace(/\*\*/\//g, '.*')
    .replace(/\*/g, '[^/]*');
  return new RegExp(`${escaped}$`);
}

// Modulo export
module.exports = {
  name: 'TestDiscovery',
  version: '1.0.0',
  
  _instance: null,
  
  init(context) {
    this._instance = new TestDiscovery();
    return this._instance;
  },
  
  shutdown() {
    this._instance = null;
  },
  
  getInstance() {
    return this._instance;
  }
};
