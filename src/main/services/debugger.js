const WebSocket = require('ws');
const { spawn } = require('child_process');
const path = require('path');

class NodeDebugger {
    constructor(browserWindow) {
        this.window = browserWindow;
        this.child = null;
        this.ws = null;
        this.msgId = 1;
        this.paused = false;
        this._callbacks = {};
    }

    async start(filePath, breakpoints = []) {
        return new Promise((resolve, reject) => {
            console.log(`[Debugger] Avvio: ${filePath}`);
            this.child = spawn('node', ['--inspect-brk=0', filePath], { cwd: path.dirname(filePath), stdio: ['inherit', 'pipe', 'pipe'] });
            this.child.stderr.on('data', (data) => {
                const msg = data.toString();
                const match = msg.match(/ws:\/\/127\.0\.0\.1:(\d+)\/[a-f0-9-]+/);
                if (match && !this.ws) this.connect(match[0], breakpoints, resolve, reject);
            });
            this.child.on('exit', () => this.stop());
        });
    }

    connect(url, breakpoints, resolve) {
        this.ws = new WebSocket(url);
        this.ws.on('open', () => {
            this.send('Debugger.enable');
            this.send('Runtime.enable');
            breakpoints.forEach(bp => this.send('Debugger.setBreakpointByUrl', { lineNumber: bp.line - 1, urlRegex: '.*' + path.basename(bp.path).replace(/\./g, '\\.') }));
            this.send('Debugger.resume');
            resolve({ success: true });
        });
        this.ws.on('message', (data) => this.handleMessage(JSON.parse(data.toString())));
    }

    handleMessage(msg) {
        if (msg.id && this._callbacks[msg.id]) { this._callbacks[msg.id](msg.result); delete this._callbacks[msg.id]; return; }
        if (msg.method === 'Debugger.paused') {
            this.paused = true;
            const top = msg.params.callFrames[0];
            const scope = top.scopeChain.find(s => s.type === 'local' || s.type === 'closure');
            if (scope?.object?.objectId) {
                this.send('Runtime.getProperties', { objectId: scope.object.objectId }, (res) => {
                    const vars = (res?.result || []).map(p => ({ name: p.name, value: p.value?.description || p.value?.value || '...', type: p.value?.type || 'unknown' }));
                    this.window.webContents.send('debug-variables', vars);
                });
            }
            this.window.webContents.send('debug-paused', { line: top.location.lineNumber + 1, callStack: msg.params.callFrames.map(f => ({ functionName: f.functionName || '(anon)', location: f.location })) });
        } else if (msg.method === 'Debugger.resumed') { this.paused = false; this.window.webContents.send('debug-resumed'); }
    }

    send(method, params = {}, callback = null) {
        const id = this.msgId++;
        if (callback) this._callbacks[id] = callback;
        if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ id, method, params }));
    }

    stepOver() { if (this.paused) this.send('Debugger.stepOver'); }
    continue() { if (this.paused) this.send('Debugger.resume'); }
    stop() {
        if (this.child) this.child.kill();
        if (this.ws) this.ws.close();
        this.child = null; this.ws = null; this.paused = false;
        this.window.webContents.send('debug-resumed');
    }
}

module.exports = { NodeDebugger };
