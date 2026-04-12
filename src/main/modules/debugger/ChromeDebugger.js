/**
 * ChromeDebugger - Debugger per browser Chrome/Edge via CDP
 * 
 * Features:
 * - Launch Chrome/Edge con remote debugging
 * - Connect a existing browser
 * - Breakpoints, step, continue
 * - Console evaluation
 * - Network inspection
 * - Source maps support
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const eventBus = require('../../core/EventBus');

class ChromeDebugger {
  constructor(options = {}) {
    this.browserProcess = null;
    this.wsConnection = null;
    this.cdpClient = null;
    this.isRunning = false;
    this.isPaused = false;
    
    this.config = {
      browserPath: options.browserPath || this._detectBrowserPath(),
      userDataDir: options.userDataDir || path.join(require('os').tmpdir(), 'gxcode-chrome-debug'),
      port: options.port || 9222,
      url: options.url || 'about:blank',
      headless: options.headless || false,
      sourceMaps: options.sourceMaps !== false
    };

    this._callbacks = new Map();
    this._msgId = 1;
    this._breakpoints = new Map();
    this._scripts = new Map();
  }

  /**
   * Rileva percorso browser
   * @private
   */
  _detectBrowserPath() {
    if (process.platform === 'win32') {
      // Chrome
      const chromePaths = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        path.join(process.env.LOCALAPPDATA, 'Google\\Chrome\\Application\\chrome.exe')
      ];

      // Edge
      const edgePaths = [
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
      ];

      return [...chromePaths, ...edgePaths][0];
    } else if (process.platform === 'darwin') {
      return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    } else {
      return '/usr/bin/google-chrome';
    }
  }

  /**
   * Avvia il browser con debugging
   */
  async launch(url = null) {
    if (this.isRunning) {
      throw new Error('[ChromeDebugger] Browser already running');
    }

    const targetUrl = url || this.config.url;
    
    // Ensure userDataDir exists
    await fs.mkdir(this.config.userDataDir, { recursive: true });

    const args = [
      `--remote-debugging-port=${this.config.port}`,
      `--user-data-dir=${this.config.userDataDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-default-apps',
      '--disable-extensions',
      '--disable-background-timer-throttling'
    ];

    if (this.config.headless) {
      args.push('--headless=new');
    }

    if (targetUrl !== 'about:blank') {
      args.push(targetUrl);
    }

    console.log(`[ChromeDebugger] Launching browser: ${this.config.browserPath}`);
    eventBus.emit('browser:launching', { url: targetUrl });

    return new Promise((resolve, reject) => {
      this.browserProcess = spawn(this.config.browserPath, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: true
      });

      this.browserProcess.stdout.on('data', (data) => {
        console.log('[ChromeDebugger] Browser stdout:', data.toString().trim());
      });

      this.browserProcess.stderr.on('data', (data) => {
        const msg = data.toString().trim();
        if (msg.includes('DevTools listening on')) {
          console.log('[ChromeDebugger] DevTools ready');
        }
      });

      this.browserProcess.on('error', (err) => {
        console.error('[ChromeDebugger] Browser launch error:', err.message);
        this.isRunning = false;
        reject(new Error(`Failed to launch browser: ${err.message}`));
      });

      this.browserProcess.on('exit', (code) => {
        console.log(`[ChromeDebugger] Browser exited with code ${code}`);
        this.isRunning = false;
        this.isPaused = false;
        eventBus.emit('browser:exited', { code });
      });

      // Wait for browser to be ready
      setTimeout(async () => {
        try {
          await this._connect();
          this.isRunning = true;
          eventBus.emit('browser:launched', { url: targetUrl });
          resolve({ success: true, url: targetUrl });
        } catch (err) {
          reject(err);
        }
      }, 2000);
    });
  }

  /**
   * Connette al browser
   * @private
   */
  async _connect() {
    const WebSocket = require('ws');

    // Get WebSocket URL
    const response = await fetch(`http://localhost:${this.config.port}/json/version`);
    const versionInfo = await response.json();
    
    this.wsConnection = new WebSocket(versionInfo.webSocketDebuggerUrl);

    return new Promise((resolve, reject) => {
      this.wsConnection.on('open', async () => {
        console.log('[ChromeDebugger] Connected to browser');
        
        // Create CDP client
        this.cdpClient = {
          send: (method, params = {}) => this._send(method, params),
          on: (event, callback) => this._on(event, callback)
        };

        // Enable domains
        await this._send('Runtime.enable');
        await this._send('Debugger.enable');
        await this._send('Network.enable');
        await this._send('Console.enable');

        // Setup event handlers
        this.wsConnection.on('message', (data) => {
          this._handleMessage(JSON.parse(data.toString()));
        });

        resolve();
      });

      this.wsConnection.on('error', (err) => {
        reject(new Error(`WebSocket error: ${err.message}`));
      });

      this.wsConnection.on('close', () => {
        console.log('[ChromeDebugger] WebSocket closed');
        this.isRunning = false;
      });
    });
  }

  /**
   * Invia comando CDP
   * @private
   */
  _send(method, params = {}, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const id = this._msgId++;
      
      const timeoutId = setTimeout(() => {
        this._callbacks.delete(id);
        reject(new Error(`CDP timeout: ${method}`));
      }, timeout);

      this._callbacks.set(id, { resolve, reject, timeoutId });

      this.wsConnection.send(JSON.stringify({
        id,
        method,
        params
      }));
    });
  }

  /**
   * Gestisce risposta CDP
   * @private
   */
  _on(event, callback) {
    if (!this._eventListeners) this._eventListeners = new Map();
    if (!this._eventListeners.has(event)) {
      this._eventListeners.set(event, new Set());
    }
    this._eventListeners.get(event).add(callback);
  }

  /**
   * Gestisce messaggio CDP
   * @private
   */
  _handleMessage(msg) {
    if (msg.id && this._callbacks.has(msg.id)) {
      // Response to request
      const callback = this._callbacks.get(msg.id);
      clearTimeout(callback.timeoutId);
      this._callbacks.delete(msg.id);

      if (msg.error) {
        callback.reject(new Error(msg.error.message));
      } else {
        callback.resolve(msg.result);
      }
    } else if (msg.method) {
      // Event notification
      this._handleEvent(msg.method, msg.params);
    }
  }

  /**
   * Gestisce evento CDP
   * @private
   */
  _handleEvent(method, params) {
    // Emit via eventBus
    eventBus.emit(`cdp:${method}`, params);

    // Call registered listeners
    if (this._eventListeners?.has(method)) {
      for (const callback of this._eventListeners.get(method)) {
        try {
          callback(params);
        } catch (err) {
          console.error('[ChromeDebugger] Listener error:', err.message);
        }
      }
    }

    // Handle debugger events
    switch (method) {
      case 'Debugger.paused':
        this._handlePaused(params);
        break;

      case 'Debugger.resumed':
        this._handleResumed();
        break;

      case 'Runtime.executionContextCreated':
        this._handleExecutionContextCreated(params);
        break;
    }
  }

  /**
   * Gestisce debugger paused
   * @private
   */
  _handlePaused(params) {
    this.isPaused = true;
    
    const callFrames = params.callFrames || [];
    const topFrame = callFrames[0];

    eventBus.emit('debug:paused', {
      callFrames,
      reason: params.reason,
      data: params.data,
      currentPosition: topFrame ? {
        scriptId: topFrame.location.scriptId,
        lineNumber: topFrame.location.lineNumber,
        columnNumber: topFrame.location.columnNumber,
        functionName: topFrame.functionName
      } : null
    });

    // Get variables
    if (topFrame?.scopeChain?.length > 0) {
      this._getVariablesForScope(topFrame.scopeChain[0]);
    }
  }

  /**
   * Gestisce debugger resumed
   * @private
   */
  _handleResumed() {
    this.isPaused = false;
    eventBus.emit('debug:resumed');
  }

  /**
   * Gestisce execution context created
   * @private
   */
  _handleExecutionContextCreated(params) {
    eventBus.emit('debug:context-created', params.context);
  }

  /**
   * Ottiene variabili da uno scope
   * @private
   */
  async _getVariablesForScope(scope) {
    if (!scope?.object?.objectId) return;

    try {
      const properties = await this._send('Runtime.getProperties', {
        objectId: scope.object.objectId,
        ownProperties: false
      });

      const variables = (properties.result || []).map(p => ({
        name: p.name,
        type: p.value?.type || 'unknown',
        value: p.value?.description || p.value?.value,
        objectId: p.value?.objectId
      }));

      eventBus.emit('debug:variables', variables);
    } catch (err) {
      console.error('[ChromeDebugger] Error getting variables:', err.message);
    }
  }

  /**
   * Imposta breakpoint
   */
  async setBreakpoint(url, lineNumber, condition = '') {
    try {
      const result = await this._send('Debugger.setBreakpointByUrl', {
        lineNumber,
        url,
        urlRegex: undefined,
        condition
      });

      const breakpointId = result.breakpointId;
      this._breakpoints.set(breakpointId, { url, lineNumber, condition });

      eventBus.emit('debug:breakpoint-set', { breakpointId, url, lineNumber });
      return result;
    } catch (err) {
      console.error('[ChromeDebugger] Error setting breakpoint:', err.message);
      throw err;
    }
  }

  /**
   * Rimuove breakpoint
   */
  async removeBreakpoint(breakpointId) {
    try {
      await this._send('Debugger.removeBreakpoint', { breakpointId });
      this._breakpoints.delete(breakpointId);
      eventBus.emit('debug:breakpoint-removed', { breakpointId });
    } catch (err) {
      console.error('[ChromeDebugger] Error removing breakpoint:', err.message);
      throw err;
    }
  }

  /**
   * Step over
   */
  async stepOver() {
    if (!this.isPaused) return;
    await this._send('Debugger.stepOver');
  }

  /**
   * Step into
   */
  async stepInto() {
    if (!this.isPaused) return;
    await this._send('Debugger.stepInto');
  }

  /**
   * Step out
   */
  async stepOut() {
    if (!this.isPaused) return;
    await this._send('Debugger.stepOut');
  }

  /**
   * Continue/resume
   */
  async continue() {
    if (!this.isPaused) return;
    await this._send('Debugger.resume');
  }

  /**
   * Evalua espressione
   */
  async evaluate(expression) {
    try {
      const result = await this._send('Runtime.evaluate', {
        expression,
        returnByValue: true
      });

      if (result.exceptionDetails) {
        throw new Error(result.exceptionDetails.text);
      }

      return result.result;
    } catch (err) {
      console.error('[ChromeDebugger] Evaluation error:', err.message);
      throw err;
    }
  }

  /**
   * Naviga a URL
   */
  async navigate(url) {
    await this._send('Page.navigate', { url });
  }

  /**
   * Reload page
   */
  async reload() {
    await this._send('Page.reload');
  }

  /**
   * Ferma il debugger
   */
  async stop() {
    if (this.browserProcess) {
      this.browserProcess.kill();
      this.browserProcess = null;
    }

    if (this.wsConnection) {
      this.wsConnection.close();
      this.wsConnection = null;
    }

    this.isRunning = false;
    this.isPaused = false;
    this._callbacks.clear();
    this._breakpoints.clear();

    eventBus.emit('debug:stopped');
    console.log('[ChromeDebugger] Stopped');
  }

  /**
   * Ottieni stato
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      isPaused: this.isPaused,
      breakpointCount: this._breakpoints.size,
      config: this.config
    };
  }
}

module.exports = ChromeDebugger;
