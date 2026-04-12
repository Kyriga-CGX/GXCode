/**
 * Debugger Module - Modulo principale per il debugging
 * 
 * Coordina DebugSession, BreakpointManager, CallStackManager, 
 * VariableInspector, e WatchExpressionsManager
 */

const DebugSession = require('./DebugSession');
const BreakpointManagerModule = require('./BreakpointManager');
const CallStackManagerModule = require('./CallStackManager');
const VariableInspectorModule = require('./VariableInspector');
const WatchExpressionsModule = require('./WatchExpressionsManager');

class DebuggerModule {
  constructor() {
    this._session = null;
    this._breakpointManager = null;
    this._callStackManager = null;
    this._variableInspector = null;
    this._watchManager = null;
    this._context = null;
  }

  async init(context) {
    console.log('[DebuggerModule] Initializing debugger module');
    
    this._context = context;
    
    // Initialize managers
    this._breakpointManager = BreakpointManagerModule.init(context);
    this._callStackManager = CallStackManagerModule.init(context);
    this._variableInspector = VariableInspectorModule.init(context);
    this._watchManager = WatchExpressionsModule.init(context);

    console.log('[DebuggerModule] Debugger module initialized');
  }

  async shutdown() {
    console.log('[DebuggerModule] Shutting down debugger module');
    
    if (this._session) {
      this._session.stop();
      this._session = null;
    }
    
    BreakpointManagerModule.shutdown();
    CallStackManagerModule.shutdown();
    VariableInspectorModule.shutdown();
    WatchExpressionsModule.shutdown();
  }

  /**
   * Crea una nuova sessione di debug
   * @param {Object} browserWindow - Electron BrowserWindow
   * @returns {DebugSession} - Sessione creata
   */
  createSession(browserWindow) {
    if (this._session) {
      console.warn('[DebuggerModule] Stopping existing session');
      this._session.stop();
    }

    this._session = new DebugSession({ browserWindow });
    
    // Inject managers
    this._session.injectModules({
      breakpointManager: this._breakpointManager,
      callStackManager: this._callStackManager,
      variableInspector: this._variableInspector,
      watchManager: this._watchManager
    });

    return this._session;
  }

  /**
   * Ottiene la sessione corrente
   * @returns {DebugSession|null}
   */
  getSession() {
    return this._session;
  }

  /**
   * Ottiene il breakpoint manager
   * @returns {Object}
   */
  getBreakpointManager() {
    return this._breakpointManager;
  }

  /**
   * Ottiene il watch expressions manager
   * @returns {Object}
   */
  getWatchManager() {
    return this._watchManager;
  }

  /**
   * Ottiene il call stack manager
   * @returns {Object}
   */
  getCallStackManager() {
    return this._callStackManager;
  }

  /**
   * Ottiene il variable inspector
   * @returns {Object}
   */
  getVariableInspector() {
    return this._variableInspector;
  }
}

// Modulo export
module.exports = {
  name: 'Debugger',
  version: '2.0.0',
  
  _instance: new DebuggerModule(),
  
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
