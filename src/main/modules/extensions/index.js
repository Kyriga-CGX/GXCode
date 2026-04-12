/**
 * Extensions Module - Modulo principale per il sistema di estensioni
 * 
 * Coordina ExtensionLoader e ExtensionManifest
 * 
 * Responsabilità:
 * - Gestire ciclo di vita estensioni
 * - Fornire API unificata per estensioni
 * - Gestire marketplace locale
 * - Coordinare attivazione estensioni
 */

const ExtensionLoader = require('./ExtensionLoader');
const ExtensionManifest = require('./ExtensionManifest');
const eventBus = require('../../core/EventBus');
const path = require('path');

class ExtensionsModule {
    constructor() {
        this._loader = null;
        this._manifestValidator = null;
        this._initialized = false;
    }

    /**
     * Inizializza il modulo estensioni
     * @param {Object} context - Contesto applicazione
     */
    async init(context) {
        console.log('[ExtensionsModule] Initializing extensions module...');

        const extensionsDir = path.join(context.userDataPath || require('os').homedir(), 'gxcode-extensions');

        try {
            this._loader = new ExtensionLoader(extensionsDir);
            this._manifestValidator = new ExtensionManifest();

            await this._loader.init();

            // Scansiona estensioni esistenti
            await this._loader.scanExtensions();

            this._initialized = true;

            console.log('[ExtensionsModule] Extensions module initialized');
            
            eventBus.emit('extensions:module-initialized', {
                extensionsDir
            });

            return { success: true };
        } catch (err) {
            console.error('[ExtensionsModule] Initialization error:', err.message);
            this._initialized = false;
            return { success: false, error: err.message };
        }
    }

    /**
     * Spegne il modulo estensioni
     */
    async shutdown() {
        console.log('[ExtensionsModule] Shutting down extensions module...');

        // Disattiva tutte le estensioni attive
        if (this._loader) {
            const activeExts = this._loader.getActiveExtensions();
            for (const ext of activeExts) {
                try {
                    await this._loader.deactivateExtension(ext.id);
                } catch (err) {
                    console.warn(`[ExtensionsModule] Failed to deactivate ${ext.id}:`, err.message);
                }
            }
        }

        this._loader = null;
        this._manifestValidator = null;
        this._initialized = false;
        
        eventBus.emit('extensions:module-shutdown');
    }

    // === Gestione Estensioni ===

    /**
     * Scansiona estensioni
     * @returns {Promise<Array>}
     */
    async scanExtensions() {
        this._checkInitialized();
        return await this._loader.scanExtensions();
    }

    /**
     * Carica estensione
     * @param {string} extensionId
     * @returns {Promise<Object>}
     */
    async loadExtension(extensionId) {
        this._checkInitialized();
        return await this._loader.loadExtension(extensionId);
    }

    /**
     * Attiva estensione
     * @param {string} extensionId
     * @param {Object} [context]
     * @returns {Promise<Object>}
     */
    async activateExtension(extensionId, context = {}) {
        this._checkInitialized();
        return await this._loader.activateExtension(extensionId, context);
    }

    /**
     * Disattiva estensione
     * @param {string} extensionId
     * @returns {Promise<void>}
     */
    async deactivateExtension(extensionId) {
        this._checkInitialized();
        return await this._loader.deactivateExtension(extensionId);
    }

    /**
     * Installa estensione
     * @param {string} packagePath
     * @returns {Promise<Object>}
     */
    async installExtension(packagePath) {
        this._checkInitialized();
        return await this._loader.installExtension(packagePath);
    }

    /**
     * Disinstalla estensione
     * @param {string} extensionId
     * @returns {Promise<Object>}
     */
    async uninstallExtension(extensionId) {
        this._checkInitialized();
        return await this._loader.uninstallExtension(extensionId);
    }

    /**
     * Abilita estensione
     * @param {string} extensionId
     * @returns {Promise<void>}
     */
    async enableExtension(extensionId) {
        this._checkInitialized();
        return await this._loader.enableExtension(extensionId);
    }

    /**
     * Disabilita estensione
     * @param {string} extensionId
     * @returns {Promise<void>}
     */
    async disableExtension(extensionId) {
        this._checkInitialized();
        return await this._loader.disableExtension(extensionId);
    }

    // === Query ===

    /**
     * Ottieni estensione per ID
     * @param {string} extensionId
     * @returns {Object|null}
     */
    getExtension(extensionId) {
        this._checkInitialized();
        return this._loader.getExtension(extensionId);
    }

    /**
     * Ottieni tutte le estensioni
     * @returns {Array}
     */
    getAllExtensions() {
        this._checkInitialized();
        return this._loader.getAllExtensions();
    }

    /**
     * Ottieni estensioni attive
     * @returns {Array}
     */
    getActiveExtensions() {
        this._checkInitialized();
        return this._loader.getActiveExtensions();
    }

    // === Validazione ===

    /**
     * Valida manifest
     * @param {Object} manifest
     * @returns {Object}
     */
    validateManifest(manifest) {
        return this._manifestValidator.validate(manifest);
    }

    /**
     * Ottiene metadati da manifest
     * @param {Object} manifest
     * @returns {Object}
     */
    getManifestMetadata(manifest) {
        return this._manifestValidator.getMetadata(manifest);
    }

    // === Utility ===

    /**
     * Controlla se inizializzato
     * @private
     */
    _checkInitialized() {
        if (!this._initialized) {
            throw new Error('[ExtensionsModule] Extensions module not initialized');
        }
    }

    /**
     * Ottieni stato del modulo
     * @returns {Object}
     */
    getStatus() {
        return {
            initialized: this._initialized,
            totalExtensions: this._loader ? this._loader.getAllExtensions().length : 0,
            activeExtensions: this._loader ? this._loader.getActiveExtensions().length : 0
        };
    }
}

// Modulo export
module.exports = {
    name: 'Extensions',
    version: '1.0.0',

    _instance: new ExtensionsModule(),

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
