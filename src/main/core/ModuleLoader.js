/**
 * ModuleLoader - Sistema di caricamento modulare per GXCode
 * 
 * Carica, inizializza e gestisce il lifecycle dei moduli.
 * Ogni modulo deve esporre: name, version, init(), shutdown()
 * 
 * @example
 * const ModuleLoader = require('./core/ModuleLoader');
 * 
 * const loader = new ModuleLoader();
 * 
 * // Register a module
 * loader.register('myModule', {
 *   name: 'myModule',
 *   version: '1.0.0',
 *   init: async (context) => { ... },
 *   shutdown: async () => { ... }
 * });
 * 
 * // Initialize all
 * await loader.start();
 * 
 * // Shutdown all
 * await loader.stop();
 */

const path = require('path');
const fs = require('fs').promises;
const eventBus = require('./EventBus');

class ModuleLoader {
  constructor() {
    this._modules = new Map();
    this._initialized = false;
    this._context = {};
  }

  /**
   * Registra un modulo
   * @param {string} name - Nome del modulo
   * @param {Object} module - Oggetto modulo con init/shutdown
   */
  register(name, module) {
    if (this._modules.has(name)) {
      console.warn(`[ModuleLoader] Module "${name}" already registered, overwriting`);
    }

    // Validate module interface
    if (!module.name) {
      throw new Error(`[ModuleLoader] Module "${name}" must have a "name" property`);
    }
    if (typeof module.init !== 'function') {
      throw new Error(`[ModuleLoader] Module "${name}" must have an "init()" function`);
    }
    if (typeof module.shutdown !== 'function') {
      throw new Error(`[ModuleLoader] Module "${name}" must have a "shutdown()" function`);
    }

    this._modules.set(name, {
      ...module,
      status: 'registered',
      initializedAt: null
    });

    eventBus.emit('module:registered', { name, version: module.version });
    console.log(`[ModuleLoader] Registered module: ${name} v${module.version || '0.0.0'}`);
  }

  /**
   * Carica moduli da una directory
   * @param {string} dirPath - Percorso directory moduli
   * @param {Object} context - Contesto da passare ai moduli
   */
  async loadFromDirectory(dirPath, context = {}) {
    try {
      const files = await fs.readdir(dirPath);
      
      for (const file of files) {
        if (file.endsWith('.js') && !file.startsWith('_')) {
          const modulePath = path.join(dirPath, file);
          const module = require(modulePath);
          
          const moduleName = module.name || path.basename(file, '.js');
          this.register(moduleName, module);
        }
      }

      console.log(`[ModuleLoader] Loaded modules from: ${dirPath}`);
    } catch (err) {
      console.error(`[ModuleLoader] Error loading modules from ${dirPath}:`, err.message);
    }
  }

  /**
   * Inizializza tutti i moduli registrati
   * @param {Object} context - Contesto da passare ai moduli
   */
  async start(context = {}) {
    if (this._initialized) {
      console.warn('[ModuleLoader] Already initialized, restarting...');
      await this.stop();
    }

    this._context = context;
    eventBus.emit('modules:starting', { count: this._modules.size });
    console.log(`[ModuleLoader] Starting ${this._modules.size} modules...`);

    const startTime = Date.now();
    let successCount = 0;
    let failCount = 0;

    for (const [name, module] of this._modules.entries()) {
      try {
        module.status = 'initializing';
        await module.init(context);
        module.status = 'active';
        module.initializedAt = Date.now();
        successCount++;
        
        eventBus.emit('module:started', { name, duration: Date.now() - startTime });
        console.log(`[ModuleLoader] ✓ ${name} initialized`);
      } catch (err) {
        module.status = 'error';
        module.error = err.message;
        failCount++;
        
        eventBus.emit('module:error', { name, error: err.message });
        console.error(`[ModuleLoader] ✗ ${name} failed:`, err.message);
        
        // Continue with other modules even if one fails
      }
    }

    this._initialized = true;
    const duration = Date.now() - startTime;
    
    eventBus.emit('modules:ready', { 
      total: this._modules.size,
      success: successCount,
      failed: failCount,
      duration 
    });

    console.log(`[ModuleLoader] ${successCount}/${this._modules.size} modules started in ${duration}ms`);

    return {
      total: this._modules.size,
      success: successCount,
      failed: failCount,
      duration
    };
  }

  /**
   * Spegne tutti i moduli
   */
  async stop() {
    if (!this._initialized) {
      console.warn('[ModuleLoader] Not initialized, nothing to stop');
      return;
    }

    eventBus.emit('modules:stopping', { count: this._modules.size });
    console.log('[ModuleLoader] Stopping all modules...');

    const startTime = Date.now();
    let successCount = 0;
    let failCount = 0;

    // Shutdown in reverse order
    const modules = Array.from(this._modules.entries()).reverse();
    
    for (const [name, module] of modules) {
      if (module.status !== 'active') {
        continue;
      }

      try {
        module.status = 'shutting-down';
        await module.shutdown();
        module.status = 'stopped';
        successCount++;
        
        console.log(`[ModuleLoader] ✓ ${name} shutdown`);
      } catch (err) {
        module.status = 'error';
        failCount++;
        
        eventBus.emit('module:error', { name, error: err.message });
        console.error(`[ModuleLoader] ✗ ${name} shutdown failed:`, err.message);
      }
    }

    this._initialized = false;
    const duration = Date.now() - startTime;

    eventBus.emit('modules:stopped', { 
      total: this._modules.size,
      success: successCount,
      failed: failCount,
      duration 
    });

    console.log(`[ModuleLoader] All modules stopped in ${duration}ms`);
  }

  /**
   * Ottiene lo stato di un modulo
   * @param {string} name - Nome modulo
   * @returns {Object|null} - Stato del modulo
   */
  getModule(name) {
    return this._modules.get(name) || null;
  }

  /**
   * Ottiene tutti i moduli
   * @returns {Map} - Tutti i moduli
   */
  getAllModules() {
    return new Map(this._modules);
  }

  /**
   * Controlla se un modulo è attivo
   * @param {string} name - Nome modulo
   * @returns {boolean} - True se attivo
   */
  isModuleActive(name) {
    const module = this._modules.get(name);
    return module ? module.status === 'active' : false;
  }

  /**
   * Ottiene statistiche sui moduli
   * @returns {Object} - Statistiche
   */
  getStats() {
    const stats = {
      total: this._modules.size,
      active: 0,
      error: 0,
      stopped: 0,
      registered: 0
    };

    for (const module of this._modules.values()) {
      stats[module.status] = (stats[module.status] || 0) + 1;
    }

    return stats;
  }

  /**
   * Ottiene il contesto passato ai moduli
   * @returns {Object} - Contesto
   */
  getContext() {
    return this._context;
  }
}

module.exports = ModuleLoader;
