/**
 * GXCode Modules - Index
 * 
 * Punto di accesso centralizzato per tutti i moduli
 */

const path = require('path');

// Core
const EventBus = require('../core/EventBus');
const ModuleLoader = require('../core/ModuleLoader');

// Debugger Module
const DebuggerModule = require('./debugger');

// Testing Module
const TestRunnerModule = require('./testing/TestRunner');
const TestDiscoveryModule = require('./testing/TestDiscovery');

// AI Modules
const AIReactivityModule = require('./ai/AIReactivityEngine');
const AutoCorrectionModule = require('./ai/AutoCorrection');

/**
 * Registra tutti i moduli nel ModuleLoader
 * @param {ModuleLoader} loader - Istance ModuleLoader
 */
function registerAllModules(loader) {
  console.log('[Modules] Registering all modules...');
  
  // Debugger
  loader.register('Debugger', DebuggerModule);
  
  // Testing
  loader.register('TestRunner', TestRunnerModule);
  
  // AI
  loader.register('AIReactivity', AIReactivityModule);
  loader.register('AutoCorrection', AutoCorrectionModule);
  
  console.log(`[Modules] Registered ${loader.getStats().total} modules`);
}

/**
 * Ottiene un'istanza di un modulo
 * @param {string} name - Nome modulo
 * @returns {Object|null} - Istanza modulo
 */
function getModule(name) {
  const modules = {
    'Debugger': DebuggerModule,
    'TestRunner': TestRunnerModule,
    'TestDiscovery': TestDiscoveryModule,
    'AIReactivity': AIReactivityModule,
    'AutoCorrection': AutoCorrectionModule
  };
  
  return modules[name] || null;
}

module.exports = {
  EventBus,
  ModuleLoader,
  DebuggerModule,
  TestRunnerModule,
  TestDiscoveryModule,
  AIReactivityModule,
  AutoCorrectionModule,
  registerAllModules,
  getModule
};
