/**
 * DebugSession - Coordinatore principale per le sessioni di debug
 * 
 * Responsabilità:
 * - Gestire il lifecycle della sessione di debug
 * - Coordinare BreakpointManager, CallStackManager, VariableInspector
 * - Comunicare con Chrome DevTools Protocol
 * - Emettere eventi per la UI
 */

const WebSocket = require('ws');
const { spawn } = require('child_process');
const path = require('path');
const eventBus = require('../../core/EventBus');

class DebugSession {
  constructor(options = {}) {
    this.window = options.browserWindow;
    this.child = null;
    this.ws = null;
    this.msgId = 1;
    this._callbacks = {};
    
    // Session state
    this.isActive = false;
    this.isPaused = false;
    this.currentFile = null;
    
    // Modules (will be injected)
    this.breakpointManager = null;
    this.callStackManager = null;
    this.variableInspector = null;
    this.watchManager = null;
  }

  /**
   * Inietta i moduli manager
   */
  injectModules({ breakpointManager, callStackManager, variableInspector, watchManager }) {
    this.breakpointManager = breakpointManager;
    this.callStackManager = callStackManager;
    this.variableInspector = variableInspector;
    this.watchManager = watchManager;
  }

  /**
   * Avvia una sessione di debug
   * @param {string} filePath - File da eseguire
   * @param {Array} [breakpoints] - Breakpoint iniziali
   * @returns {Promise<Object>} - Risultato
   */
  async start(filePath, breakpoints = []) {
    return new Promise((resolve, reject) => {
      console.log(`[DebugSession] Starting debug session: ${filePath}`);
      
      this.currentFile = path.resolve(filePath);
      this.isActive = true;

      // Emit event
      eventBus.emit('debug:session:start', { filePath });

      // Spawn Node.js con inspect
      this.child = spawn('node', ['--inspect-brk=0', filePath], {
        cwd: path.dirname(filePath),
        stdio: ['inherit', 'pipe', 'pipe']
      });

      // Capture WebSocket URL da stderr
      this.child.stderr.on('data', (data) => {
        const msg = data.toString();
        const match = msg.match(/ws:\/\/127\.0\.0\.1:(\d+)\/[a-f0-9-]+/);
        if (match && !this.ws) {
          this._connect(`ws://127.0.0.1:${match[1]}`, breakpoints, resolve, reject);
        }
      });

      this.child.on('exit', (code) => {
        console.log(`[DebugSession] Debug process exited with code ${code}`);
        eventBus.emit('debug:session:end', { exitCode: code });
        this._cleanup();
      });

      this.child.on('error', (err) => {
        console.error('[DebugSession] Process error:', err.message);
        eventBus.emit('debug:session:error', { error: err.message });
        reject(err);
      });
    });
  }

  /**
   * Connette al WebSocket CDP
   * @private
   */
  _connect(url, breakpoints, resolve, reject) {
    console.log(`[DebugSession] Connecting to CDP: ${url}`);
    
    this.ws = new WebSocket(url);

    this.ws.on('open', async () => {
      console.log('[DebugSession] CDP connected');
      
      try {
        // Enable debugger
        await this._sendAndAwait('Debugger.enable');
        await this._sendAndAwait('Runtime.enable');

        // Set exception breakpoints
        await this._sendAndAwait('Debugger.setPauseOnExceptions', { 
          state: 'uncaught' 
        });

        // Apply initial breakpoints
        await this._applyBreakpoints(breakpoints);

        // Resume execution
        this._send('Debugger.resume');

        eventBus.emit('debug:session:started', { 
          file: this.currentFile,
          breakpointCount: breakpoints.length
        });

        resolve({ success: true, file: this.currentFile });
      } catch (err) {
        console.error('[DebugSession] Error initializing debugger:', err.message);
        eventBus.emit('debug:session:error', { error: err.message });
        reject(err);
      }
    });

    this.ws.on('message', (data) => {
      try {
        this._handleMessage(JSON.parse(data.toString()));
      } catch (err) {
        console.error('[DebugSession] Error handling message:', err.message);
      }
    });

    this.ws.on('close', () => {
      console.log('[DebugSession] CDP connection closed');
      eventBus.emit('debug:session:close');
      this._cleanup();
    });

    this.ws.on('error', (err) => {
      console.error('[DebugSession] WebSocket error:', err.message);
      eventBus.emit('debug:session:error', { error: err.message });
    });
  }

  /**
   * Gestisce i messaggi CDP
   * @private
   */
  async _handleMessage(msg) {
    // Response to request
    if (msg.id && this._callbacks[msg.id]) {
      this._callbacks[msg.id](msg.result);
      delete this._callbacks[msg.id];
      return;
    }

    // Events
    if (msg.method) {
      await this._handleEvent(msg.method, msg.params);
    }
  }

  /**
   * Gestisce gli eventi CDP
   * @private
   */
  async _handleEvent(method, params) {
    switch (method) {
      case 'Debugger.paused':
        await this._handlePaused(params);
        break;

      case 'Debugger.resumed':
        this._handleResumed();
        break;

      case 'Debugger.scriptParsed':
        eventBus.emit('debug:script:parsed', { script: params });
        break;

      default:
        // Forward unknown events
        eventBus.emit('debug:cdp:event', { method, params });
    }
  }

  /**
   * Gestisce il pause del debugger
   * @private
   */
  async _handlePaused(params) {
    this.isPaused = true;
    console.log('[DebugSession] Debugger paused');

    const callFrames = params.callFrames || [];
    const topFrame = callFrames[0];

    if (!topFrame) {
      console.warn('[DebugSession] No call frames in pause');
      return;
    }

    // Update call stack
    if (this.callStackManager) {
      this.callStackManager.update(callFrames);
      const position = this.callStackManager.getCurrentPosition();
      
      // Emit paused event with position
      eventBus.emit('debug:paused', {
        line: position?.line || 0,
        file: position?.path || '',
        callStack: this.callStackManager.getStack()
      });
    }

    // Extract variables from scope
    if (this.variableInspector && topFrame.scopeChain) {
      const scope = topFrame.scopeChain.find(s => 
        s.type === 'local' || s.type === 'closure'
      );

      if (scope?.object?.objectId) {
        const variables = await this.variableInspector.extractVariables(
          scope.object,
          (objectId) => this._getProperties(objectId)
        );

        eventBus.emit('debug:variables', variables);
      }
    }

    // Evaluate watch expressions
    if (this.watchManager) {
      const watchResults = await this.watchManager.evaluateAll(
        (expr) => this._evaluateExpression(expr)
      );

      eventBus.emit('debug:watches', watchResults);
    }
  }

  /**
   * Gestisce il resume del debugger
   * @private
   */
  _handleResumed() {
    this.isPaused = false;
    console.log('[DebugSession] Debugger resumed');
    
    if (this.callStackManager) {
      this.callStackManager.clear();
    }
    if (this.variableInspector) {
      this.variableInspector.clear();
    }

    eventBus.emit('debug:resumed');
  }

  /**
   * Applica i breakpoint
   * @private
   */
  async _applyBreakpoints(breakpoints = []) {
    if (!this.breakpointManager || breakpoints.length === 0) {
      return;
    }

    console.log(`[DebugSession] Applying ${breakpoints.length} breakpoints`);

    for (const bp of breakpoints) {
      try {
        const cdpBreakpoint = await this._sendAndAwait('Debugger.setBreakpointByUrl', {
          lineNumber: bp.line - 1, // CDP uses 0-based
          urlRegex: '.*' + path.basename(bp.path).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
          condition: bp.condition || ''
        });

        if (cdpBreakpoint && cdpBreakpoint.breakpointId) {
          this.breakpointManager.setCdpId(bp.id, cdpBreakpoint.breakpointId);
        }
      } catch (err) {
        console.error(`[DebugSession] Error setting breakpoint at ${bp.path}:${bp.line}:`, err.message);
      }
    }
  }

  /**
   * Step over
   */
  stepOver() {
    if (!this.isPaused) {
      console.warn('[DebugSession] Cannot step: not paused');
      return;
    }
    console.log('[DebugSession] Step over');
    this._send('Debugger.stepOver');
  }

  /**
   * Step into
   */
  stepInto() {
    if (!this.isPaused) {
      console.warn('[DebugSession] Cannot step: not paused');
      return;
    }
    console.log('[DebugSession] Step into');
    this._send('Debugger.stepInto');
  }

  /**
   * Step out
   */
  stepOut() {
    if (!this.isPaused) {
      console.warn('[DebugSession] Cannot step: not paused');
      return;
    }
    console.log('[DebugSession] Step out');
    this._send('Debugger.stepOut');
  }

  /**
   * Continue/Resume
   */
  continue() {
    if (!this.isPaused) {
      console.warn('[DebugSession] Cannot continue: not paused');
      return;
    }
    console.log('[DebugSession] Continue');
    this._send('Debugger.resume');
  }

  /**
   * Ferma la sessione di debug
   */
  stop() {
    console.log('[DebugSession] Stopping debug session');
    eventBus.emit('debug:session:stopping');
    this._cleanup();
    eventBus.emit('debug:session:stopped');
  }

  /**
   * Valuta un'espressione nel contesto corrente
   * @param {string} expression - Espressione da valutare
   * @returns {Promise<*>} - Risultato
   */
  async _evaluateExpression(expression) {
    if (!this.isPaused) {
      throw new Error('Cannot evaluate: debugger not paused');
    }

    const result = await this._sendAndAwait('Runtime.evaluate', {
      expression,
      returnByValue: true
    });

    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.text);
    }

    return result.result;
  }

  /**
   * Ottiene le proprietà di un oggetto
   * @param {string} objectId - Object ID
   * @returns {Promise<Object>} - Proprietà
   */
  async _getProperties(objectId) {
    return await this._sendAndAwait('Runtime.getProperties', {
      objectId,
      ownProperties: false
    });
  }

  /**
   * Invia comando CDP e attende risposta
   * @private
   */
  _sendAndAwait(method, params = {}, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const id = this.msgId++;
      const timeoutId = setTimeout(() => {
        reject(new Error(`CDP timeout: ${method}`));
      }, timeout);

      this._callbacks[id] = (result) => {
        clearTimeout(timeoutId);
        resolve(result);
      };

      this._send(method, params, id);
    });
  }

  /**
   * Invia comando CDP
   * @private
   */
  _send(method, params = {}, id = null) {
    const messageId = id || this.msgId++;
    
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        id: messageId,
        method,
        params
      }));
    } else {
      console.warn('[DebugSession] WebSocket not connected');
    }
  }

  /**
   * Pulisce la sessione
   * @private
   */
  _cleanup() {
    if (this.child) {
      this.child.kill();
      this.child = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isActive = false;
    this.isPaused = false;
    this._callbacks = {};
    
    if (this.callStackManager) {
      this.callStackManager.clear();
    }
    if (this.variableInspector) {
      this.variableInspector.clear();
    }
  }
}

module.exports = DebugSession;
