/**
 * TaskRunner - Esegue tasks da tasks.json
 * 
 * Features:
 * - Parsing tasks.json (formato VSCode-compatible)
 * - Esecuzione task con variabili
 * - Output in real-time
 * - Problem matchers
 * - Task di default e custom
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const eventBus = require('../../core/EventBus');

class TaskRunner {
  constructor() {
    this._tasks = [];
    this._workspacePath = null;
    this._activeProcess = null;
    this._isRunning = false;
    this._config = {
      defaultShell: process.platform === 'win32' ? 'powershell.exe' : '/bin/bash',
      timeout: 300000, // 5 minutes
      showOutput: 'always' // 'always', 'never', 'on-error'
    };
    this._initialized = false;
  }

  /**
   * Inizializza il task runner
   */
  async init(context) {
    console.log('[TaskRunner] Initializing...');
    
    this._workspacePath = context.workspacePath || process.cwd();
    
    await this._loadTasks();
    
    this._initialized = true;
    eventBus.emit('task:runner:initialized', { taskCount: this._tasks.length });
    console.log(`[TaskRunner] Initialized with ${this._tasks.length} tasks`);
  }

  /**
   * Spegne il task runner
   */
  async shutdown() {
    console.log('[TaskRunner] Shutting down...');
    
    if (this._isRunning) {
      this.stop();
    }
    
    this._initialized = false;
    eventBus.emit('task:runner:shutdown');
  }

  /**
   * Carica i tasks da tasks.json
   * @private
   */
  async _loadTasks() {
    try {
      const tasksPath = path.join(this._workspacePath, '.gxcode', 'tasks.json');
      const content = await fs.readFile(tasksPath, 'utf-8');
      const config = JSON.parse(content);
      
      this._tasks = config.tasks || [];
      
      console.log(`[TaskRunner] Loaded ${this._tasks.length} tasks from tasks.json`);
    } catch (err) {
      // Try VSCode format
      try {
        const vscodeTasksPath = path.join(this._workspacePath, '.vscode', 'tasks.json');
        const content = await fs.readFile(vscodeTasksPath, 'utf-8');
        const config = JSON.parse(content);
        
        this._tasks = config.tasks || [];
        
        console.log(`[TaskRunner] Loaded ${this._tasks.length} tasks from .vscode/tasks.json`);
      } catch (err2) {
        // No tasks file found, use defaults
        this._tasks = this._getDefaultTasks();
        console.log('[TaskRunner] No tasks file found, using defaults');
      }
    }
  }

  /**
   * Ottieni tasks di default
   * @private
   */
  _getDefaultTasks() {
    return [
      {
        label: 'build',
        type: 'shell',
        command: 'npm run build',
        group: 'build',
        problemMatcher: [],
        presentation: { reveal: 'always' }
      },
      {
        label: 'test',
        type: 'shell',
        command: 'npm test',
        group: 'test',
        problemMatcher: [],
        presentation: { reveal: 'always' }
      },
      {
        label: 'start',
        type: 'shell',
        command: 'npm start',
        group: 'none',
        problemMatcher: [],
        presentation: { reveal: 'always' }
      }
    ];
  }

  /**
   * Ottieni tutti i tasks
   */
  getTasks() {
    return this._tasks.map(t => ({
      ...t,
      isRunning: this._isRunning && this._activeTaskLabel === t.label
    }));
  }

  /**
   * Ottieni task per label
   */
  getTaskByLabel(label) {
    return this._tasks.find(t => t.label === label) || null;
  }

  /**
   * Ottieni task di default per gruppo
   */
  getDefaultTask(group) {
    return this._tasks.find(t => t.group === group && t.isDefault) || 
           this._tasks.find(t => t.group === group) || null;
  }

  /**
   * Esegue un task
   * @param {string} taskLabel - Label del task
   * @param {Object} [options] - Opzioni
   * @returns {Promise<Object>} - Risultato esecuzione
   */
  async run(taskLabel, options = {}) {
    const task = this.getTaskByLabel(taskLabel);
    
    if (!task) {
      throw new Error(`[TaskRunner] Task "${taskLabel}" not found`);
    }

    if (this._isRunning) {
      throw new Error('[TaskRunner] Another task is already running');
    }

    this._activeTaskLabel = taskLabel;
    this._isRunning = true;
    
    eventBus.emit('task:start', { label: taskLabel });

    return new Promise((resolve, reject) => {
      try {
        const { command, args, env, cwd } = this._parseTask(task, options);
        
        const shell = typeof command === 'string' && command.includes(' ');
        const proc = shell 
          ? spawn(this._config.defaultShell, ['-c', `${command} ${(args || []).join(' ')}`], {
              cwd: cwd || this._workspacePath,
              env: { ...process.env, ...env },
              stdio: ['pipe', 'pipe', 'pipe']
            })
          : spawn(command, args || [], {
              cwd: cwd || this._workspacePath,
              env: { ...process.env, ...env },
              stdio: ['pipe', 'pipe', 'pipe']
            });

        this._activeProcess = proc;
        let output = '';
        let errorOutput = '';

        proc.stdout.on('data', (data) => {
          const chunk = data.toString();
          output += chunk;
          eventBus.emit('task:output', { label: taskLabel, data: chunk, type: 'stdout' });
        });

        proc.stderr.on('data', (data) => {
          const chunk = data.toString();
          errorOutput += chunk;
          eventBus.emit('task:output', { label: taskLabel, data: chunk, type: 'stderr' });
        });

        proc.on('close', (code) => {
          this._isRunning = false;
          this._activeProcess = null;
          
          const success = code === 0;
          
          eventBus.emit('task:end', { 
            label: taskLabel, 
            success, 
            exitCode: code,
            output,
            errorOutput 
          });

          resolve({ success, exitCode: code, output, errorOutput });
        });

        proc.on('error', (err) => {
          this._isRunning = false;
          this._activeProcess = null;
          
          eventBus.emit('task:error', { label: taskLabel, error: err.message });
          reject(err);
        });

        // Timeout
        setTimeout(() => {
          if (this._isRunning) {
            this.stop();
            eventBus.emit('task:timeout', { label: taskLabel });
            reject(new Error(`Task "${taskLabel}" timed out`));
          }
        }, options.timeout || this._config.timeout);

      } catch (err) {
        this._isRunning = false;
        reject(err);
      }
    });
  }

  /**
   * Parsa un task risolvendo variabili
   * @private
   */
  _parseTask(task, options = {}) {
    const variables = this._getVariables(options);
    
    let command = task.command || '';
    let args = task.args || [];
    let env = task.options?.env || {};
    let cwd = task.options?.cwd || this._workspacePath;

    // Resolve variables
    command = this._replaceVariables(command, variables);
    args = args.map(a => this._replaceVariables(a, variables));
    cwd = this._replaceVariables(cwd, variables);

    return { command, args, env, cwd };
  }

  /**
   * Ottieni variabili per il task
   * @private
   */
  _getVariables(options) {
    return {
      '${workspaceFolder}': this._workspacePath,
      '${workspaceFolderBasename}': path.basename(this._workspacePath),
      '${file}': options.filePath || '',
      '${fileBasename}': options.filePath ? path.basename(options.filePath) : '',
      '${fileBasenameNoExtension}': options.filePath ? path.parse(options.filePath).name : '',
      '${fileDirname}': options.filePath ? path.dirname(options.filePath) : '',
      '${lineNumber}': options.lineNumber?.toString() || '',
      '${selectedText}': options.selectedText || '',
      '${defaultBuildTask}': this.getDefaultTask('build')?.label || 'build'
    };
  }

  /**
   * Sostituisce variabili
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
   * Ferma il task corrente
   */
  stop() {
    if (this._activeProcess) {
      this._activeProcess.kill('SIGTERM');
      this._activeProcess = null;
      this._isRunning = false;
      
      eventBus.emit('task:stopped', { label: this._activeTaskLabel });
      console.log('[TaskRunner] Task stopped');
    }
  }

  /**
   * Controlla se un task è in esecuzione
   */
  isRunning() {
    return this._isRunning;
  }

  /**
   * Ottieni task corrente
   */
  getCurrentTask() {
    return this._activeTaskLabel || null;
  }

  /**
   * Ottieni stato
   */
  getStatus() {
    return {
      initialized: this._initialized,
      isRunning: this._isRunning,
      currentTask: this._activeTaskLabel,
      taskCount: this._tasks.length,
      tasks: this.getTasks()
    };
  }

  /**
   * Ricarica i tasks
   */
  async reload() {
    await this._loadTasks();
    eventBus.emit('task:reloaded', { taskCount: this._tasks.length });
  }
}

// Modulo export
module.exports = {
  name: 'TaskRunner',
  version: '1.0.0',
  
  _instance: new TaskRunner(),
  
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
