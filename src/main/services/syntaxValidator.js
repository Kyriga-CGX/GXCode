/**
 * Syntax Validator - GXCode 2026
 * Validates TypeScript/JavaScript syntax before and after file writes.
 * Supports auto-correction by detecting and reporting syntax errors.
 */

class SyntaxValidator {
    constructor() {
        this.supportedExtensions = ['.js', '.jsx', '.ts', '.tsx', '.mjs'];
    }

    /**
     * Check if file extension is supported for validation
     */
    isSupported(filePath) {
        const ext = filePath.substring(filePath.lastIndexOf('.'));
        return this.supportedExtensions.includes(ext);
    }

    /**
     * Validate JavaScript/TypeScript syntax
     * Returns { valid: boolean, errors: Array }
     */
    validate(code, filePath = '') {
        const errors = [];

        try {
            // Try to parse the code
            if (this.isTypeScriptFile(filePath)) {
                // For TypeScript, we try to use basic validation
                // since we may not have TypeScript compiler available
                this.validateTypeScriptBasic(code, errors);
            } else {
                // For JavaScript, use Function constructor for validation
                this.validateJavaScript(code, errors);
            }

            return {
                valid: errors.length === 0,
                errors
            };
        } catch (error) {
            errors.push({
                line: this.extractLineFromError(error.message),
                column: this.extractColumnFromError(error.message),
                message: error.message,
                severity: 'error',
                code: 'SYNTAX_ERROR'
            });

            return {
                valid: false,
                errors
            };
        }
    }

    /**
     * Validate JavaScript code using Function constructor
     */
    validateJavaScript(code, errors) {
        try {
            // Wrap in function to avoid execution
            new Function(code);
        } catch (error) {
            const line = this.extractLineFromError(error.message);
            const message = error.message;

            errors.push({
                line,
                column: this.extractColumnFromError(error.message),
                message: message.split('\n')[0], // First line only
                severity: 'error',
                code: 'JS_SYNTAX_ERROR'
            });
        }
    }

    /**
     * Basic TypeScript validation (checks for obvious syntax errors)
     */
    validateTypeScriptBasic(code, errors) {
        const lines = code.split('\n');

        // Check for unbalanced braces
        const braceStack = [];
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            for (let j = 0; j < line.length; j++) {
                const char = line[j];
                if (char === '{') {
                    braceStack.push({ line: i + 1, char: '{' });
                } else if (char === '}') {
                    if (braceStack.length === 0) {
                        errors.push({
                            line: i + 1,
                            column: j + 1,
                            message: `Unexpected '}' without matching '{'`,
                            severity: 'error',
                            code: 'UNBALANCED_BRACE'
                        });
                    } else {
                        braceStack.pop();
                    }
                }
            }
        }

        // Report unclosed braces
        if (braceStack.length > 0) {
            const unclosed = braceStack[braceStack.length - 1];
            errors.push({
                line: unclosed.line,
                message: `Unclosed '{' bracket`,
                severity: 'error',
                code: 'UNCLOSED_BRACE'
            });
        }

        // Check for common syntax patterns
        this.checkCommonErrors(lines, errors);
    }

    /**
     * Check for common syntax errors
     */
    checkCommonErrors(lines, errors) {
        // Check for duplicate closing braces (like }}); instead of });
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            // Pattern: extra closing brace
            if (/^\}\s*\}\s*[;,)]?\s*$/.test(line)) {
                errors.push({
                    line: i + 1,
                    message: `Possible duplicate closing brace '}}'`,
                    severity: 'error',
                    code: 'DUPLICATE_CLOSING_BRACE'
                });
            }
        }
    }

    /**
     * Extract line number from error message
     */
    extractLineFromError(errorMessage) {
        const match = errorMessage.match(/line\s+(\d+)/i) || errorMessage.match(/:(\d+):/);
        return match ? parseInt(match[1]) : 0;
    }

    /**
     * Extract column number from error message
     */
    extractColumnFromError(errorMessage) {
        const match = errorMessage.match(/column\s+(\d+)/i) || errorMessage.match(/:\d+:(\d+)/);
        return match ? parseInt(match[1]) : 0;
    }

    /**
     * Check if file is TypeScript
     */
    isTypeScriptFile(filePath) {
        return filePath.endsWith('.ts') || filePath.endsWith('.tsx');
    }

    /**
     * Generate fix suggestions for common errors
     */
    generateFixSuggestions(code, errors) {
        const fixes = [];
        const lines = code.split('\n');

        for (const error of errors) {
            if (error.code === 'DUPLICATE_CLOSING_BRACE') {
                const lineIndex = error.line - 1;

                if (lineIndex >= 0 && lineIndex < lines.length) {
                    const line = lines[lineIndex];
                    // Remove duplicate closing brace
                    const fixedLine = line.replace(/\}\s*\}/, '}');
                    fixes.push({
                        line: error.line,
                        original: line,
                        fixed: fixedLine,
                        type: 'REMOVE_DUPLICATE_BRACE'
                    });
                }
            } else if (error.code === 'UNBALANCED_BRACE') {
                // Find and remove the extra closing brace
                const lineIndex = error.line - 1;
                if (lineIndex >= 0 && lineIndex < lines.length) {
                    const line = lines[lineIndex];
                    // Remove the extra closing brace from this line
                    const fixedLine = line.replace(/\}/, '').trim();
                    if (fixedLine !== '') {
                        fixes.push({
                            line: error.line,
                            original: line,
                            fixed: fixedLine,
                            type: 'REMOVE_EXTRA_BRACE'
                        });
                    } else {
                        // If line becomes empty, remove it entirely
                        fixes.push({
                            line: error.line,
                            original: line,
                            fixed: '',
                            type: 'REMOVE_EMPTY_LINE'
                        });
                    }
                }
            } else if (error.code === 'JS_SYNTAX_ERROR' || error.code === 'SYNTAX_ERROR') {
                // JavaScript syntax error - try to find and fix common patterns
                const lineIndex = error.line - 1;
                
                if (lineIndex >= 0 && lineIndex < lines.length) {
                    const line = lines[lineIndex];
                    
                    // If line is just "});" or "}", remove it
                    if (/^\s*\}\s*\)\s*;?\s*$/.test(line)) {
                        // Check if previous non-empty line also ends with });
                        let prevLineIndex = lineIndex - 1;
                        while (prevLineIndex >= 0 && lines[prevLineIndex].trim() === '') {
                            prevLineIndex--;
                        }
                        
                        if (prevLineIndex >= 0 && /^\s*\}\s*\)\s*;?\s*$/.test(lines[prevLineIndex])) {
                            // This is a duplicate closing - remove this line
                            fixes.push({
                                line: error.line,
                                original: line,
                                fixed: '',
                                type: 'REMOVE_DUPLICATE_CLOSING'
                            });
                        }
                    } else if (/^\s*\}\s*$/.test(line)) {
                        // Just a closing brace - check if it's extra
                        let prevLineIndex = lineIndex - 1;
                        while (prevLineIndex >= 0 && lines[prevLineIndex].trim() === '') {
                            prevLineIndex--;
                        }
                        
                        if (prevLineIndex >= 0 && /^\s*\}\s*\)\s*;?\s*$/.test(lines[prevLineIndex])) {
                            // Previous line closes something, this might be extra
                            fixes.push({
                                line: error.line,
                                original: line,
                                fixed: '',
                                type: 'REMOVE_SUSPECTED_EXTRA_BRACE'
                            });
                        }
                    }
                } else if (error.line === 0 || lineIndex < 0) {
                    // Error line unknown - search from the end for suspicious patterns
                    // IMPORTANT: Start from last NON-EMPTY line
                    let lastNonEmptyLine = lines.length - 1;
                    while (lastNonEmptyLine >= 0 && lines[lastNonEmptyLine].trim() === '') {
                        lastNonEmptyLine--;
                    }
                    
                    // Search last 10 non-empty lines
                    const searchStart = Math.max(0, lastNonEmptyLine - 9);
                    for (let i = lastNonEmptyLine; i >= searchStart; i--) {
                        const line = lines[i];
                        
                        // Look for isolated "});" that might be extra
                        if (/^\s*\}\s*\)\s*;?\s*$/.test(line)) {
                            // Check if there's another similar line nearby (within 5 lines)
                            let closeCount = 0;
                            let lastCloseLine = -1;
                            for (let j = Math.max(0, i - 5); j <= Math.min(lines.length - 1, i + 5); j++) {
                                if (/^\s*\}\s*\)\s*;?\s*$/.test(lines[j])) {
                                    closeCount++;
                                    lastCloseLine = j;
                                }
                            }
                            
                            if (closeCount > 1) {
                                // Multiple closing patterns nearby - remove the LAST one (most likely duplicate)
                                fixes.push({
                                    line: lastCloseLine + 1,
                                    original: lines[lastCloseLine],
                                    fixed: '',
                                    type: 'REMOVE_DUPLICATE_CLOSING_UNKNOWN_LINE'
                                });
                                break;
                            }
                        }
                    }
                }
            }
        }

        return fixes;
    }

    /**
     * Apply fixes to code
     */
    applyFixes(code, fixes) {
        const lines = code.split('\n');

        for (const fix of fixes) {
            // IMPORTANT: Check for undefined, not falsy, because fix.fixed can be empty string ''
            if (fix.line && fix.fixed !== undefined) {
                lines[fix.line - 1] = fix.fixed;
            }
        }

        return lines.join('\n');
    }

    /**
     * Auto-fix common syntax errors
     * Returns { fixed: boolean, code: string, errors: Array }
     */
    autoFix(code, filePath = '') {
        const { valid, errors } = this.validate(code, filePath);

        if (valid) {
            return { fixed: true, code, errors: [] };
        }

        // Generate fix suggestions
        const fixes = this.generateFixSuggestions(code, errors);

        if (fixes.length > 0) {
            const fixedCode = this.applyFixes(code, fixes);

            // Validate the fixed code
            const validation = this.validate(fixedCode, filePath);

            if (validation.valid) {
                return {
                    fixed: true,
                    code: fixedCode,
                    errors: [],
                    appliedFixes: fixes
                };
            }
        }

        // Could not auto-fix
        return {
            fixed: false,
            code,
            errors,
            needsAIHelp: true
        };
    }
}

module.exports = new SyntaxValidator();
