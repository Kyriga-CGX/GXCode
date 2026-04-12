/**
 * Auto-Correction Service - GXCode 2026
 * Automatically detects syntax errors and requests AI to fix them.
 * Integrates with the AI Reactivity Engine for intelligent code fixes.
 */

const fs = require('fs');
const path = require('path');
const syntaxValidator = require('./syntaxValidator');
const aiReactivityEngine = require('./aiReactivityEngine');

class AutoCorrectionService {
    constructor() {
        this.maxRetries = 3;
        this.retryDelay = 1000; // 1 second between retries
        this.enabled = true;
        this.fixHistory = new Map(); // Track fixes per file
    }

    /**
     * Enable or disable auto-correction
     */
    setEnabled(enabled) {
        this.enabled = enabled;
        console.log(`[AUTO-CORRECTION] Auto-correction ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Validate and auto-fix code before/during file write
     * Returns { success: boolean, code: string, fixed: boolean, errors: Array }
     */
    async validateAndFix(filePath, code) {
        if (!this.enabled || !syntaxValidator.isSupported(filePath)) {
            return { success: true, code, fixed: false, errors: [] };
        }

        console.log(`[AUTO-CORRECTION] Validating: ${path.basename(filePath)}`);

        // First validation
        const validation = syntaxValidator.validate(code, filePath);

        if (validation.valid) {
            console.log(`[AUTO-CORRECTION] ✅ No syntax errors in ${path.basename(filePath)}`);
            return { success: true, code, fixed: false, errors: [] };
        }

        console.log(`[AUTO-CORRECTION] ⚠️ Found ${validation.errors.length} error(s) in ${path.basename(filePath)}`);

        // STEP 1: Try rule-based auto-fix (FAST, no AI needed)
        const autoFixResult = syntaxValidator.autoFix(code, filePath);

        if (autoFixResult.fixed) {
            console.log(`[AUTO-CORRECTION] ✅ Rule-based auto-fixed ${autoFixResult.appliedFixes?.length || 1} error(s)`);
            return {
                success: true,
                code: autoFixResult.code,
                fixed: true,
                errors: [],
                autoFixed: true
            };
        }

        // STEP 2: AI correction DISABLED (too slow, causes timeouts)
        // Rule-based fixes are sufficient for 95% of common errors:
        // - Duplicate closing braces }); 
        // - Unbalanced brackets
        // - Extra closing braces
        console.log(`[AUTO-CORRECTION] ⚠️ Rule-based fix failed, skipping AI (too slow)`);
        
        // Return original code with errors - let user fix manually
        return {
            success: false,
            code,
            fixed: false,
            errors: validation.errors,
            needsAIHelp: false // Disabled AI
        };
    }

    /**
     * Request AI to fix syntax errors
     */
    async requestAIFix(filePath, code, errors) {
        const errorDescriptions = errors.map(e =>
            `Line ${e.line}: ${e.message}`
        ).join('\n');

        const fixPrompt = `I have a syntax error in my TypeScript/JavaScript file. Please fix it and return ONLY the corrected code.

File: ${path.basename(filePath)}

Errors found:
${errorDescriptions}

Original code:
\`\`\`
${code}
\`\`\`

Please return ONLY the fixed code, no explanations, no markdown formatting.`;

        try {
            // Use AI Reactivity Engine to fix the code
            const fixedCode = await this.callAIForFix(fixPrompt);

            if (fixedCode && fixedCode.trim().length > 0) {
                // Extract code from response (remove any markdown formatting)
                let cleanedCode = fixedCode;

                // Remove markdown code blocks if present
                const codeBlockMatch = fixedCode.match(/```(?:typescript|javascript|ts|js)?\n([\s\S]*?)```/);
                if (codeBlockMatch) {
                    cleanedCode = codeBlockMatch[1];
                }

                return cleanedCode.trim();
            }
        } catch (error) {
            console.error('[AUTO-CORRECTION] AI request failed:', error);
        }

        return null;
    }

    /**
     * Call AI to fix code (synchronous version for simplicity)
     */
    callAIForFix(prompt) {
        return new Promise((resolve, reject) => {
            const { exec } = require('child_process');
            const model = aiReactivityEngine.config.model;

            const cmd = `ollama run ${model} "${prompt.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`;

            const child = exec(cmd, {
                maxBuffer: 50 * 1024 * 1024 // 50MB buffer
            });

            let fullResponse = '';

            child.stdout.on('data', (data) => {
                fullResponse += data.toString();
            });

            child.stderr.on('data', (data) => {
                const text = data.toString().trim();
                if (text && !/^[\u2800-\u28FF]+$/.test(text)) {
                    console.error('[AUTO-CORRECTION] Ollama stderr:', text);
                }
            });

            child.on('close', (code) => {
                if (code === 0) {
                    resolve(fullResponse);
                } else {
                    reject(new Error(`Ollama exited with code ${code}`));
                }
            });

            child.on('error', reject);

            // Timeout after 120 seconds
            setTimeout(() => {
                if (!child.killed) {
                    child.kill();
                    reject(new Error('AI fix timeout'));
                }
            }, 120000);
        });
    }

    /**
     * Track fix history for a file
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

        // Keep only last 10 fixes
        if (history.length > 10) {
            history.shift();
        }
    }

    /**
     * Check if a file has recurring errors (more than maxRetries fixes)
     */
    hasRecurringErrors(filePath) {
        const history = this.fixHistory.get(filePath);
        if (!history || history.length < this.maxRetries) {
            return false;
        }

        // Check if last maxRetries attempts all failed
        const recentFixes = history.slice(-this.maxRetries);
        return recentFixes.every(fix => !fix.success);
    }

    /**
     * Get fix statistics for a file
     */
    getFixStats(filePath) {
        const history = this.fixHistory.get(filePath) || [];
        return {
            totalAttempts: history.length,
            successfulFixes: history.filter(h => h.success).length,
            failedFixes: history.filter(h => !h.success).length,
            lastFixTimestamp: history.length > 0 ? history[history.length - 1].timestamp : null
        };
    }

    /**
     * Clear fix history for a file
     */
    clearHistory(filePath) {
        this.fixHistory.delete(filePath);
    }

    /**
     * Clear all fix history
     */
    clearAllHistory() {
        this.fixHistory.clear();
    }
}

module.exports = new AutoCorrectionService();
