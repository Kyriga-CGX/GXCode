/**
 * LSP Bridge - Ponte tra Monaco Editor e LSP Client (main process)
 * 
 * Responsabilità:
 * - Registrare provider per Monaco
 * - Gestire completamento
 * - Gestire hover
 * - Gestire definizione
 * - Gestire diagnostici
 * - Gestire formatting
 */

class LSPBridge {
    constructor() {
        this._enabled = false;
        this._config = null;
        this._monaco = null;
        this._editor = null;
        this._currentModel = null;
        this._disposables = [];
    }

    /**
     * Inizializza il bridge
     * @param {Object} monaco - Monaco instance
     * @param {Object} editor - Monaco editor instance
     */
    async init(monaco, editor) {
        console.log('[LSPBridge] Initializing...');
        
        this._monaco = monaco;
        this._editor = editor;

        // Load config
        const savedConfig = localStorage.getItem('gx-lsp-config');
        this._config = savedConfig ? JSON.parse(savedConfig) : {
            enabled: true,
            autoStart: true,
            languages: ['typescript', 'javascript', 'python', 'html', 'css', 'json', 'markdown']
        };

        this._enabled = this._config.enabled;

        if (this._enabled) {
            this._registerProviders();
            this._registerListeners();
            console.log('[LSPBridge] Initialized and enabled');
        } else {
            console.log('[LSPBridge] Initialized but disabled');
        }
    }

    /**
     * Registra provider Monaco
     * @private
     */
    _registerProviders() {
        if (!this._monaco) return;

        // Completion Provider
        const completionProvider = this._monaco.languages.registerCompletionItemProvider('*', {
            triggerCharacters: ['.', ':', '<', '"', '/', '@'],
            provideCompletionItems: async (model, position) => {
                if (!this._enabled) return { suggestions: [] };

                const filePath = model.uri.fsPath || model.uri.path;
                const language = this._detectLanguage(filePath);

                if (!language || !this._config.languages.includes(language)) {
                    return { suggestions: [] };
                }

                try {
                    const result = await window.electronAPI.invoke('lsp:completion', 
                        filePath, 
                        position.lineNumber - 1, 
                        position.column - 1
                    );

                    if (!result.success || !result.completions) {
                        return { suggestions: [] };
                    }

                    const suggestions = result.completions.map(item => ({
                        label: item.label || item.insertText,
                        kind: this._mapCompletionKind(item.kind),
                        insertText: item.insertText || item.label,
                        detail: item.detail || '',
                        documentation: item.documentation?.value || item.documentation || '',
                        sortText: item.sortText,
                        filterText: item.filterText
                    }));

                    return { suggestions };
                } catch (err) {
                    console.error('[LSPBridge] Completion error:', err);
                    return { suggestions: [] };
                }
            }
        });

        this._disposables.push(completionProvider);

        // Hover Provider
        const hoverProvider = this._monaco.languages.registerHoverProvider('*', {
            provideHover: async (model, position) => {
                if (!this._enabled) return null;

                const filePath = model.uri.fsPath || model.uri.path;

                try {
                    const result = await window.electronAPI.invoke('lsp:hover',
                        filePath,
                        position.lineNumber - 1,
                        position.column - 1
                    );

                    if (!result.success || !result.hover) {
                        return null;
                    }

                    return {
                        contents: [
                            { value: result.hover.contents?.[0]?.value || result.hover.contents || '' }
                        ]
                    };
                } catch (err) {
                    console.error('[LSPBridge] Hover error:', err);
                    return null;
                }
            }
        });

        this._disposables.push(hoverProvider);

        // Definition Provider
        const definitionProvider = this._monaco.languages.registerDefinitionProvider('*', {
            provideDefinition: async (model, position) => {
                if (!this._enabled) return null;

                const filePath = model.uri.fsPath || model.uri.path;

                try {
                    const result = await window.electronAPI.invoke('lsp:definition',
                        filePath,
                        position.lineNumber - 1,
                        position.column - 1
                    );

                    if (!result.success || !result.definition) {
                        return null;
                    }

                    const def = result.definition;
                    const uri = this._monaco.Uri.file(def.uri || def.targetUri);
                    
                    return {
                        uri,
                        range: new this._monaco.Range(
                            def.range?.start.line + 1 || 1,
                            def.range?.start.character + 1 || 1,
                            def.range?.end.line + 1 || 1,
                            def.range?.end.character + 1 || 1
                        )
                    };
                } catch (err) {
                    console.error('[LSPBridge] Definition error:', err);
                    return null;
                }
            }
        });

        this._disposables.push(definitionProvider);

        // Signature Help Provider
        const signatureProvider = this._monaco.languages.registerSignatureHelpProvider('*', {
            signatureHelpTriggerCharacters: ['(', ','],
            provideSignatureHelp: async (model, position) => {
                if (!this._enabled) return null;

                const filePath = model.uri.fsPath || model.uri.path;

                try {
                    const result = await window.electronAPI.invoke('lsp:signature-help',
                        filePath,
                        position.lineNumber - 1,
                        position.column - 1
                    );

                    if (!result.success || !result.help || !result.help.signatures) {
                        return null;
                    }

                    return {
                        value: {
                            signatures: result.help.signatures.map(sig => ({
                                label: sig.label,
                                documentation: { value: sig.documentation?.value || '' },
                                parameters: sig.parameters || []
                            })),
                            activeSignature: result.help.activeSignature || 0,
                            activeParameter: result.help.activeParameter || 0
                        },
                        dispose: () => {}
                    };
                } catch (err) {
                    console.error('[LSPBridge] Signature error:', err);
                    return null;
                }
            }
        });

        this._disposables.push(signatureProvider);

        console.log('[LSPBridge] Providers registered');
    }

    /**
     * Registra listener eventi
     * @private
     */
    _registerListeners() {
        // Diagnostics from main process
        window.electronAPI.on('lsp:diagnostics', (data) => {
            this._handleDiagnostics(data);
        });

        // Model changed
        if (this._editor) {
            this._editor.onDidChangeModelContent((e) => {
                this._handleModelChange(e);
            });
        }
    }

    /**
     * Gestisce diagnostici
     * @private
     */
    _handleDiagnostics(data) {
        if (!this._monaco || !data.filePath || !data.diagnostics) return;

        const markers = data.diagnostics.map(diag => ({
            severity: this._mapSeverity(diag.severity),
            startLineNumber: diag.range.start.line + 1,
            startColumn: diag.range.start.character + 1,
            endLineNumber: diag.range.end.line + 1,
            endColumn: diag.range.end.character + 1,
            message: diag.message,
            source: diag.source || 'LSP'
        }));

        const uri = this._monaco.Uri.file(data.filePath);
        this._monaco.editor.setModelMarkers(this._monaco.editor.getModel(uri), 'lsp', markers);
    }

    /**
     * Gestisce cambio modello
     * @private
     */
    async _handleModelChange(e) {
        if (!this._editor || !this._enabled) return;

        const model = this._editor.getModel();
        if (!model) return;

        const filePath = model.uri.fsPath || model.uri.path;
        const content = model.getValue();

        // Notify LSP server
        await window.electronAPI.invoke('lsp:change-document', filePath, [{
            text: content
        }]);
    }

    /**
     * Mappa completion kind
     * @private
     */
    _mapCompletionKind(kind) {
        if (!this._monaco) return 1;

        const kinds = {
            'text': this._monaco.languages.CompletionItemKind.Text,
            'method': this._monaco.languages.CompletionItemKind.Method,
            'function': this._monaco.languages.CompletionItemKind.Function,
            'constructor': this._monaco.languages.CompletionItemKind.Constructor,
            'field': this._monaco.languages.CompletionItemKind.Field,
            'variable': this._monaco.languages.CompletionItemKind.Variable,
            'class': this._monaco.languages.CompletionItemKind.Class,
            'interface': this._monaco.languages.CompletionItemKind.Interface,
            'module': this._monaco.languages.CompletionItemKind.Module,
            'property': this._monaco.languages.CompletionItemKind.Property,
            'unit': this._monaco.languages.CompletionItemKind.Unit,
            'value': this._monaco.languages.CompletionItemKind.Value,
            'enum': this._monaco.languages.CompletionItemKind.Enum,
            'keyword': this._monaco.languages.CompletionItemKind.Keyword,
            'snippet': this._monaco.languages.CompletionItemKind.Snippet,
            'color': this._monaco.languages.CompletionItemKind.Color,
            'file': this._monaco.languages.CompletionItemKind.File,
            'reference': this._monaco.languages.CompletionItemKind.Reference,
            'folder': this._monaco.languages.CompletionItemKind.Folder,
            'enummember': this._monaco.languages.CompletionItemKind.EnumMember,
            'constant': this._monaco.languages.CompletionItemKind.Constant,
            'struct': this._monaco.languages.CompletionItemKind.Struct,
            'event': this._monaco.languages.CompletionItemKind.Event,
            'operator': this._monaco.languages.CompletionItemKind.Operator,
            'typeparameter': this._monaco.languages.CompletionItemKind.TypeParameter
        };

        return kinds[kind?.toLowerCase()] || this._monaco.languages.CompletionItemKind.Text;
    }

    /**
     * Mappa severità
     * @private
     */
    _mapSeverity(severity) {
        if (!this._monaco) return 4;

        const severities = {
            'error': this._monaco.MarkerSeverity.Error,
            'warning': this._monaco.MarkerSeverity.Warning,
            'info': this._monaco.MarkerSeverity.Info,
            'hint': this._monaco.MarkerSeverity.Hint
        };

        return severities[severity?.toLowerCase()] || this._monaco.MarkerSeverity.Warning;
    }

    /**
     * Rileva linguaggio da file path
     * @private
     */
    _detectLanguage(filePath) {
        const ext = filePath.split('.').pop().toLowerCase();
        
        const extToLang = {
            'js': 'javascript',
            'jsx': 'javascript',
            'ts': 'typescript',
            'tsx': 'typescript',
            'py': 'python',
            'html': 'html',
            'htm': 'html',
            'css': 'css',
            'scss': 'css',
            'less': 'css',
            'json': 'json',
            'md': 'markdown'
        };

        return extToLang[ext] || null;
    }

    /**
     * Abilita LSP
     */
    enable() {
        this._enabled = true;
        console.log('[LSPBridge] Enabled');
    }

    /**
     * Disabilita LSP
     */
    disable() {
        this._enabled = false;
        console.log('[LSPBridge] Disabled');
    }

    /**
     * Distruggi bridge
     */
    dispose() {
        this._disposables.forEach(d => d.dispose());
        this._disposables = [];
        this._enabled = false;
        console.log('[LSPBridge] Disposed');
    }
}

// Export singleton
export const lspBridge = new LSPBridge();
