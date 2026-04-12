/**
 * Auto-Correction Service v2.0 - Modulare
 * 
 * Correzione automatica errori sintassi con:
 * - Rule-based fixes (prioritario, veloce)
 * - AI-based fixes (opzionale, configurabile)
 * - Fix history tracking
 * - Statistics
 */

const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const eventBus = require('../../core/EventBus');

class AutoCorrectionService {
  constructor() {
    this.config = {
      enabled: true,
      maxRetries: 3,
      retryDelay: 1000,
      enableAICorrection: true,
      aiTimeout: 120000, // 2 minutes
      aiModel: 'qwen2.5-coder:7b',
      logLevel: 'info'
    };

    this.fixHistory = new Map();
    this._initialized = false;
  }

  /**
   * Inizializza il servizio
   */
  async init(context) {
    console.log('[AutoCorrection] Initializing service');
    
    this._initialized = true;
    
    // Load config
    try {
      const configPath = path.join(context.userDataPath, 'auto-correction-config.json');
      const configData = await fs.readFile(configPath, 'utf-8');
      this.config = { ...this.config, ...JSON.parse(configData) };
      console.log('[AutoCorrection] Config loaded');
    } catch (err) {
      console.log('[AutoCorrection] Using default config');
    }

    eventBus.emit('ai:autocorrection:initialized', { config: this.config });
  }

  /**
   * Spegne il servizio
   */
  async shutdown() {
    console.log('[AutoCorrection] Shutting down service');
    this._initialized = false;
    eventBus.emit('ai:autocorrection:shutdown');
  }

  /**
   * Abilita/disabilita
   */
  setEnabled(enabled) {
    this.config.enabled = enabled;
    this._log('info', `Service ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Configura AI correction
   */
  setAICorrection(enabled, options = {}) {
    this.config.enableAICorrection = enabled;
    if (options.model) this.config.aiModel = options.model;
    if (options.timeout) this.config.aiTimeout = options.timeout;
    
    this._log('info', `AI correction ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Valida e correggi codice
   */
  async validateAndFix(filePath, code) {
    if (!this.config.enabled) {
      return { success: true, code, fixed: false, errors: [] };
    }

    const fileName = path.basename(filePath);
    this._log('info', `Validating: ${fileName}`);

    // Syntax validation
    const validation = this._validateSyntax(code, filePath);

    if (validation.valid) {
      this._log('info', `✅ No errors in ${fileName}`);
      return { success: true, code, fixed: false, errors: [] };
    }

    this._log('warn', `⚠️ ${validation.errors.length} error(s) in ${fileName}`);

    // STEP 1: Rule-based auto-fix (fast, no AI)
    const ruleFixResult = this._applyRuleBasedFixes(code, filePath);

    if (ruleFixResult.fixed) {
      this._log('info', `✅ Rule-based fixed ${ruleFixResult.fixesApplied || 0} error(s)`);
      
      // Track fix
      this.trackFix(filePath, true, validation.errors.length);

      return {
        success: true,
        code: ruleFixResult.code,
        fixed: true,
        errors: [],
        fixedBy: 'rules'
      };
    }

    // STEP 2: AI correction (if enabled)
    if (this.config.enableAICorrection) {
      this._log('info', `Attempting AI fix for ${fileName}...`);

      try {
        const aiFixedCode = await this._requestAIFix(filePath, code, validation.errors);

        if (aiFixedCode) {
          // Verify AI fix
          const aiValidation = this._validateSyntax(aiFixedCode, filePath);

          if (aiValidation.valid) {
            this._log('info', `✅ AI fixed ${fileName}`);
            this.trackFix(filePath, true, validation.errors.length);

            return {
              success: true,
              code: aiFixedCode,
              fixed: true,
              errors: [],
              fixedBy: 'ai'
            };
          } else {
            this._log('warn', `⚠️ AI fix still has errors: ${aiValidation.errors.length}`);
          }
        }
      } catch (err) {
        this._log('error', `AI fix failed: ${err.message}`);
        this.trackFix(filePath, false, validation.errors.length);
      }
    }

    // All fixes failed, return original code with errors
    this.trackFix(filePath, false, validation.errors.length);

    return {
      success: false,
      code,
      fixed: false,
      errors: validation.errors,
      fixedBy: null
    };
  }

  /**
   * Validazione sintassi base
   * @private
   */
  _validateSyntax(code, filePath) {
    const errors = [];
    const ext = path.extname(filePath).toLowerCase();

    // Support JS/TS only
    if (!['.js', '.ts', '.jsx', '.tsx'].includes(ext)) {
      return { valid: true, errors: [] };
    }

    // Check bracket/brace balance
    const balance = this._checkBalance(code);
    if (!balance.balanced) {
      errors.push({
        type: 'syntax',
        message: balance.message,
        line: balance.line,
        column: balance.column
      });
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Controlla bilanciamento parentesi
   * @private
   */
  _checkBalance(code) {
    const stack = [];
    const lines = code.split('\n');
    const matching = { ')': '(', '}': '{', ']': '[' };

    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum];
      
      for (let colNum = 0; colNum < line.length; colNum++) {
        const char = line[colNum];

        if (char === '(' || char === '{' || char === '[') {
          stack.push({ char, line: lineNum + 1, col: colNum + 1 });
        } else if (char === ')' || char === '}' || char === ']') {
          if (stack.length === 0) {
            return {
              balanced: false,
              message: `Unexpected '${char}'`,
              line: lineNum + 1,
              column: colNum + 1
            };
          }

          const last = stack.pop();
          if (last.char !== matching[char]) {
            return {
              balanced: false,
              message: `Mismatched '${char}' (expected closing '${last.char}')`,
              line: lineNum + 1,
              column: colNum + 1
            };
          }
        }
      }
    }

    if (stack.length > 0) {
      const last = stack[stack.length - 1];
      return {
        balanced: false,
        message: `Unclosed '${last.char}'`,
        line: last.line,
        column: last.col
      };
    }

    return { balanced: true };
  }

  /**
   * Applica fix rule-based
   * @private
   */
  _applyRuleBasedFixes(code, filePath) {
    const fixes = [];
    let fixedCode = code;

    // Rule 1: Remove duplicate closing braces }); });
    const duplicateBraceRegex = /\}\s*\}\s*\)\s*\s*;/g;
    const duplicateMatches = fixedCode.match(duplicateBraceRegex);
    if (duplicateMatches) {
      fixedCode = fixedCode.replace(duplicateBraceRegex, '});');
      fixes.push({ rule: 'duplicate_brace', count: duplicateMatches.length });
    }

    // Rule 2: Fix extra closing braces
    const balance = this._checkBalance(fixedCode);
    if (!balance.balanced && balance.message.includes('Unexpected')) {
      // Remove the unexpected character
      const lines = fixedCode.split('\n');
      const lineIdx = balance.line - 1;
      const colIdx = balance.column - 1;
      
      if (lines[lineIdx] && lines[lineIdx][colIdx]) {
        lines[lineIdx] = lines[lineIdx].substring(0, colIdx) + 
                        lines[lineIdx].substring(colIdx + 1);
        fixedCode = lines.join('\n');
        fixes.push({ rule: 'extra_brace', line: balance.line });
      }
    }

    // Rule 3: Add missing semicolons after }
    const missingSemicolonRegex = /\}\n/g;
    const semicolonMatches = fixedCode.match(missingSemicolonRegex);
    if (semicolonMatches) {
      // This is a soft rule, might not always be needed
      // fixedCode = fixedCode.replace(/\}\n/g, '};\n');
    }

    return {
      code: fixedCode,
      fixed: fixes.length > 0,
      fixesApplied: fixes.length,
      fixes
    };
  }

  /**
   * Richiede fix ad AI
   * @private
   */
  async _requestAIFix(filePath, code, errors) {
    const errorDesc = errors.map(e => `Line ${e.line}: ${e.message}`).join('\n');
    
    const prompt = `Fix syntax errors in this code. Return ONLY the corrected code, no explanations.

File: ${path.basename(filePath)}
Errors:
${errorDesc}

Code:
${code.substring(0, 3000)}${code.length > 3000 ? '\n\n// [truncated]' : ''}

Return ONLY the fixed code:`;

    return new Promise((resolve, reject) => {
      const cmd = `ollama run ${this.config.aiModel} "${prompt.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`;

      const child = exec(cmd, {
        maxBuffer: 50 * 1024 * 1024
      });

      let fullResponse = '';

      child.stdout.on('data', (data) => {
        fullResponse += data.toString();
      });

      child.stderr.on('data', (data) => {
        const text = data.toString().trim();
        if (text && !/^[\u2800-\u28FF]+$/.test(text)) {
          this._log('debug', `AI stderr: ${text}`);
        }
      });

      child.on('close', (code) => {
        if (code === 0) {
          // Clean response
          let cleaned = fullResponse;
          
          // Remove markdown code blocks
          const codeBlockMatch = fullResponse.match(/```(?:javascript|typescript|js|ts)?\n([\s\S]*?)```/);
          if (codeBlockMatch) {
            cleaned = codeBlockMatch[1];
          }

          resolve(cleaned.trim());
        } else {
          reject(new Error(`AI exited with code ${code}`));
        }
      });

      child.on('error', reject);

      // Timeout
      setTimeout(() => {
        if (!child.killed) {
          child.kill();
          reject(new Error('AI fix timeout'));
        }
      }, this.config.aiTimeout);
    });
  }

  /**
   * Track fix history
   */
  trackFix(filePath, success, errorCount) {
    if (!this.fixHistory.has(filePath)) {
      this.fixHistory.set(filePath, []);
    }

    const history = this.fixHistory.get(filePath);
    history.push({
      timestamp: Date.now(),
      success,
      errorCount,
      attempts: history.length + 1
    });

    // Keep only last 10
    if (history.length > 10) {
      history.shift();
    }

    eventBus.emit('ai:autocorrection:fix', {
      file: path.basename(filePath),
      success,
      errorCount
    });
  }

  /**
   * Controlla se errori ricorrenti
   */
  hasRecurringErrors(filePath) {
    const history = this.fixHistory.get(filePath);
    if (!history || history.length < this.config.maxRetries) {
      return false;
    }

    const recent = history.slice(-this.config.maxRetries);
    return recent.every(fix => !fix.success);
  }

  /**
   * Statistiche fix
   */
  getFixStats(filePath) {
    const history = this.fixHistory.get(filePath) || [];
    
    return {
      totalAttempts: history.length,
      successfulFixes: history.filter(h => h.success).length,
      failedFixes: history.filter(h => !h.success).length,
      lastFixTimestamp: history.length > 0 ? history[history.length - 1].timestamp : null,
      successRate: history.length > 0 
        ? (history.filter(h => h.success).length / history.length * 100).toFixed(1) 
        : 0
    };
  }

  /**
   * Pulisci storico
   */
  clearHistory(filePath = null) {
    if (filePath) {
      this.fixHistory.delete(filePath);
    } else {
      this.fixHistory.clear();
    }
  }

  /**
   * Stato servizio
   */
  getStatus() {
    return {
      initialized: this._initialized,
      enabled: this.config.enabled,
      aiEnabled: this.config.enableAICorrection,
      model: this.config.aiModel,
      totalFiles: this.fixHistory.size
    };
  }

  /**
   * Log helper
   */
  _log(level, message, data = null) {
    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    const configLevel = levels[this.config.logLevel] || 1;

    if (levels[level] >= configLevel) {
      const prefix = `[AutoCorrection] [${level.toUpperCase()}]`;
      
      switch (level) {
        case 'error': console.error(prefix, message, data || ''); break;
        case 'warn': console.warn(prefix, message, data || ''); break;
        default: console.log(prefix, message, data || '');
      }
    }
  }
}

// Modulo export
module.exports = {
  name: 'AutoCorrection',
  version: '2.0.0',
  
  _instance: new AutoCorrectionService(),
  
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
