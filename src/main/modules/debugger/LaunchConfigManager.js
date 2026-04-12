/**
 * LaunchConfigManager - Gestisce le configurazioni di debug (launch.json)
 * 
 * Responsabilità:
 * - Parsare launch.json
 * - Validare configurazioni
 * - Fornire configurazioni per tipo/file
 * - Supportare variabili (${file}, ${workspaceFolder}, etc.)
 * - Creare configurazioni default
 */

const path = require('path');
const fs = require('fs').promises;
const eventBus = require('../../core/EventBus');

class LaunchConfigManager {
  constructor() {
    this.configurations = [];
    this.compounds = [];
    this.defaults = {};
    this.workspacePath = null;
    this.configPath = null;
    this._initialized = false;
  }

  /**
   * Inizializza il manager
   * @param {Object} context - Contesto
   */
  async init(context) {
    console.log('[LaunchConfigManager] Initializing...');
    
    this.workspacePath = context.workspacePath || null;
    
    if (this.workspacePath) {
      this.configPath = path.join(this.workspacePath, '.gxcode', 'launch.json');
      await this.loadConfig();
    }

    this._initialized = true;
    
    eventBus.emit('launch:config:initialized', { 
      configurations: this.configurations.length 
    });
    
    console.log(`[LaunchConfigManager] Initialized with ${this.configurations.length} configurations`);
  }

  /**
   * Spegne il manager
   */
  async shutdown() {
    console.log('[LaunchConfigManager] Shutting down...');
    this.configurations = [];
    this.compounds = [];
    this.defaults = {};
    this._initialized = false;
    
    eventBus.emit('launch:config:shutdown');
  }

  /**
   * Carica configurazione da file
   */
  async loadConfig() {
    if (!this.configPath) {
      console.warn('[LaunchConfigManager] No config path set');
      return;
    }

    try {
      const content = await fs.readFile(this.configPath, 'utf-8');
      const config = JSON.parse(content);
      
      this.configurations = config.configurations || [];
      this.compounds = config.compounds || [];
      this.defaults = config.defaults || {};
      
      console.log(`[LaunchConfigManager] Loaded ${this.configurations.length} configurations`);
      
      // Validate all configurations
      this.validateAll();
      
    } catch (err) {
      if (err.code === 'ENOENT') {
        console.log('[LaunchConfigManager] No launch.json found, using defaults');
        this.configurations = this._getDefaultConfigurations();
      } else {
        console.error('[LaunchConfigManager] Error loading config:', err.message);
        this.configurations = this._getDefaultConfigurations();
      }
    }
  }

  /**
   * Salva configurazione su file
   */
  async saveConfig() {
    if (!this.configPath) {
      throw new Error('[LaunchConfigManager] No config path set');
    }

    const config = {
      version: '1.0.0',
      configurations: this.configurations,
      compounds: this.compounds,
      defaults: this.defaults
    };

    // Ensure directory exists
    const dir = path.dirname(this.configPath);
    await fs.mkdir(dir, { recursive: true });
    
    await fs.writeFile(this.configPath, JSON.stringify(config, null, 2), 'utf-8');
    
    console.log('[LaunchConfigManager] Config saved');
    eventBus.emit('launch:config:saved');
  }

  /**
   * Ottieni tutte le configurazioni
   * @returns {Array}
   */
  getConfigurations() {
    return this.configurations;
  }

  /**
   * Ottieni configurazione per nome
   * @param {string} name - Nome configurazione
   * @returns {Object|null}
   */
  getConfigurationByName(name) {
    return this.configurations.find(c => c.name === name) || null;
  }

  /**
   * Ottieni configurazione per tipo
   * @param {string} type - Tipo (node, python, etc.)
   * @returns {Array}
   */
  getConfigurationsByType(type) {
    return this.configurations.filter(c => c.type === type);
  }

  /**
   * Risolve variabili in una configurazione
   * @param {Object} config - Configurazione
   * @param {Object} context - Contesto per variabili
   * @returns {Object} - Configurazione con variabili risolte
   */
  resolveVariables(config, context = {}) {
    const resolved = { ...config };
    
    const variables = {
      '${file}': context.filePath || '',
      '${fileBasename}': context.filePath ? path.basename(context.filePath) : '',
      '${fileBasenameNoExtension}': context.filePath ? path.parse(context.filePath).name : '',
      '${fileDirname}': context.filePath ? path.dirname(context.filePath) : '',
      '${fileExtname}': context.filePath ? path.extname(context.filePath) : '',
      '${relativeFile}': context.filePath && this.workspacePath 
        ? path.relative(this.workspacePath, context.filePath) 
        : '',
      '${workspaceFolder}': this.workspacePath || '',
      '${workspaceFolderBasename}': this.workspacePath ? path.basename(this.workspacePath) : '',
      '${lineNumber}': context.lineNumber?.toString() || '',
      '${selectedText}': context.selectedText || '',
      '${execPath}': process.execPath,
      '${defaultBuildTask}': 'build'
    };

    // Resolve in strings
    for (const [key, value] of Object.entries(resolved)) {
      if (typeof value === 'string') {
        resolved[key] = this._replaceVariables(value, variables);
      } else if (Array.isArray(value)) {
        resolved[key] = value.map(item => 
          typeof item === 'string' ? this._replaceVariables(item, variables) : item
        );
      } else if (typeof value === 'object' && value !== null) {
        resolved[key] = this.resolveVariables(value, context);
      }
    }

    return resolved;
  }

  /**
   * Sostituisce variabili in una stringa
   * @private
   */
  _replaceVariables(str, variables) {
    let result = str;
    
    for (const [variable, value] of Object.entries(variables)) {
      result = result.split(variable).join(value);
    }
    
    return result;
  }

  /**
   * Valida una configurazione
   * @param {Object} config - Configurazione
   * @returns {Object} - { valid: boolean, errors: string[] }
   */
  validateConfiguration(config) {
    const errors = [];

    if (!config.name) {
      errors.push('Missing "name" field');
    }

    if (!config.type) {
      errors.push('Missing "type" field');
    }

    if (!config.request) {
      errors.push('Missing "request" field (launch or attach)');
    }

    if (config.request === 'launch' && !config.program) {
      errors.push('Missing "program" field for launch configuration');
    }

    if (config.request === 'attach' && !config.port) {
      errors.push('Missing "port" field for attach configuration');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Valida tutte le configurazioni
   */
  validateAll() {
    const results = [];
    
    for (const config of this.configurations) {
      const validation = this.validateConfiguration(config);
      results.push({ name: config.name, ...validation });
      
      if (!validation.valid) {
        console.warn(`[LaunchConfigManager] Invalid config "${config.name}":`, validation.errors);
      }
    }
    
    return results;
  }

  /**
   * Aggiunge una configurazione
   * @param {Object} config - Configurazione
   */
  addConfiguration(config) {
    const validation = this.validateConfiguration(config);
    
    if (!validation.valid) {
      throw new Error(`[LaunchConfigManager] Invalid configuration: ${validation.errors.join(', ')}`);
    }

    // Check for duplicate name
    if (this.configurations.some(c => c.name === config.name)) {
      throw new Error(`[LaunchConfigManager] Configuration "${config.name}" already exists`);
    }

    this.configurations.push(config);
    
    console.log(`[LaunchConfigManager] Added configuration: ${config.name}`);
    eventBus.emit('launch:config:added', { name: config.name });
  }

  /**
   * Rimuove una configurazione
   * @param {string} name - Nome configurazione
   */
  removeConfiguration(name) {
    const index = this.configurations.findIndex(c => c.name === name);
    
    if (index === -1) {
      return false;
    }

    this.configurations.splice(index, 1);
    
    console.log(`[LaunchConfigManager] Removed configuration: ${name}`);
    eventBus.emit('launch:config:removed', { name });
    
    return true;
  }

  /**
   * Aggiorna una configurazione
   * @param {string} name - Nome configurazione
   * @param {Object} updates - Aggiornamenti
   */
  updateConfiguration(name, updates) {
    const index = this.configurations.findIndex(c => c.name === name);
    
    if (index === -1) {
      return false;
    }

    const updatedConfig = { ...this.configurations[index], ...updates };
    const validation = this.validateConfiguration(updatedConfig);
    
    if (!validation.valid) {
      throw new Error(`[LaunchConfigManager] Invalid configuration: ${validation.errors.join(', ')}`);
    }

    this.configurations[index] = updatedConfig;
    
    console.log(`[LaunchConfigManager] Updated configuration: ${name}`);
    eventBus.emit('launch:config:updated', { name });
    
    return true;
  }

  /**
   * Crea configurazioni default per un tipo di file
   * @param {string} filePath - Percorso file
   * @returns {Array}
   */
  generateDefaultConfigs(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const configs = [];

    switch (ext) {
      case '.js':
      case '.ts':
      case '.jsx':
      case '.tsx':
        configs.push({
          name: `Debug ${path.basename(filePath)}`,
          type: 'node',
          request: 'launch',
          program: filePath,
          cwd: this.workspacePath || path.dirname(filePath),
          console: 'integratedTerminal',
          stopOnEntry: false,
          sourceMaps: true
        });
        break;

      case '.py':
        configs.push({
          name: `Debug ${path.basename(filePath)}`,
          type: 'python',
          request: 'launch',
          program: filePath,
          cwd: this.workspacePath || path.dirname(filePath),
          console: 'integratedTerminal',
          stopOnEntry: false
        });
        break;

      case '.java':
        configs.push({
          name: `Debug ${path.basename(filePath)}`,
          type: 'java',
          request: 'launch',
          mainClass: filePath,
          cwd: this.workspacePath || path.dirname(filePath)
        });
        break;
    }

    return configs;
  }

  /**
   * Ottieni configurazioni default
   * @private
   */
  _getDefaultConfigurations() {
    return [
      {
        name: 'Debug Current File (Node.js)',
        type: 'node',
        request: 'launch',
        program: '${file}',
        cwd: '${workspaceFolder}',
        console: 'integratedTerminal',
        stopOnEntry: false
      },
      {
        name: 'Run Current File (No Debug)',
        type: 'node',
        request: 'launch',
        program: '${file}',
        cwd: '${workspaceFolder}',
        console: 'integratedTerminal',
        stopOnEntry: false
      }
    ];
  }

  /**
   * Ottiene stato
   * @returns {Object}
   */
  getStatus() {
    return {
      initialized: this._initialized,
      configurations: this.configurations.length,
      compounds: this.compounds.length,
      workspace: this.workspacePath,
      configPath: this.configPath
    };
  }
}

// Modulo export
module.exports = {
  name: 'LaunchConfigManager',
  version: '1.0.0',
  
  _instance: new LaunchConfigManager(),
  
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
