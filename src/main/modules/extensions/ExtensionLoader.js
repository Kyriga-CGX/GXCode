/**
 * ExtensionLoader - Caricamento e gestione ciclo di vita estensioni
 * 
 * Responsabilità:
 * - Scansionare directory estensioni
 * - Caricare estensioni
 * - Attivare/disattivare estensioni
 * - Gestire dipendenze
 * - Sandbox esecuzione
 */

const path = require('path');
const fs = require('fs').promises;
const eventBus = require('../../core/EventBus');
const ExtensionManifest = require('./ExtensionManifest');

class ExtensionLoader {
    constructor(extensionsDir) {
        this.extensionsDir = extensionsDir;
        this._manifestValidator = new ExtensionManifest();
        this._extensions = new Map();
        this._activatedExtensions = new Map();
    }

    /**
     * Inizializza il loader
     */
    async init() {
        console.log('[ExtensionLoader] Initializing extension loader...');
        
        // Crea directory estensioni se non esiste
        try {
            await fs.mkdir(this.extensionsDir, { recursive: true });
        } catch (err) {
            console.error('[ExtensionLoader] Failed to create extensions directory:', err.message);
        }

        console.log('[ExtensionLoader] Extension loader initialized');
    }

    /**
     * Scansiona e scopre estensioni installate
     * @returns {Promise<Array>}
     */
    async scanExtensions() {
        console.log('[ExtensionLoader] Scanning extensions...');

        try {
            const entries = await fs.readdir(this.extensionsDir, { withFileTypes: true });
            const extensions = [];

            for (const entry of entries) {
                if (entry.isDirectory()) {
                    const extPath = path.join(this.extensionsDir, entry.name);
                    const manifestPath = path.join(extPath, 'package.json');

                    try {
                        await fs.access(manifestPath);
                        const manifest = await this._manifestValidator.loadFromFile(manifestPath);
                        
                        extensions.push({
                            ...this._manifestValidator.getMetadata(manifest),
                            path: extPath,
                            manifestPath,
                            isActive: this._activatedExtensions.has(this._manifestValidator._generateId(manifest)),
                            isEnabled: this._isExtensionEnabled(entry.name)
                        });
                    } catch (err) {
                        console.warn(`[ExtensionLoader] Skipping ${entry.name}:`, err.message);
                    }
                }
            }

            this._extensions = new Map(extensions.map(e => [e.id, e]));

            eventBus.emit('extensions:scanned', { count: extensions.length });
            
            console.log(`[ExtensionLoader] Found ${extensions.length} extensions`);
            return extensions;
        } catch (err) {
            console.error('[ExtensionLoader] Scan error:', err.message);
            return [];
        }
    }

    /**
     * Carica un'estensione senza attivarla
     * @param {string} extensionId - ID estensione
     * @returns {Promise<Object>}
     */
    async loadExtension(extensionId) {
        const ext = this._extensions.get(extensionId);
        if (!ext) {
            throw new Error(`[ExtensionLoader] Extension not found: ${extensionId}`);
        }

        if (this._activatedExtensions.has(extensionId)) {
            console.log(`[ExtensionLoader] Extension already loaded: ${extensionId}`);
            return this._activatedExtensions.get(extensionId);
        }

        try {
            eventBus.emit('extension:loading', { id: extensionId });

            // Carica il modulo principale
            const mainPath = path.join(ext.path, ext.manifest.main);
            await fs.access(mainPath);

            const module = require(mainPath);

            const extensionContext = {
                id: ext.id,
                name: ext.name,
                version: ext.version,
                path: ext.path,
                subscriptions: [],
                extensionPath: ext.path,
                globalStoragePath: path.join(this.extensionsDir, ext.id, 'storage'),
                logPath: path.join(this.extensionsDir, ext.id, 'logs')
            };

            // Crea storage directory
            await fs.mkdir(extensionContext.globalStoragePath, { recursive: true });

            const extension = {
                ...ext,
                module,
                context: extensionContext,
                loadedAt: Date.now()
            };

            this._activatedExtensions.set(extensionId, extension);

            eventBus.emit('extension:loaded', { id: extensionId });
            
            console.log(`[ExtensionLoader] Extension loaded: ${extensionId}`);
            return extension;
        } catch (err) {
            console.error(`[ExtensionLoader] Failed to load extension ${extensionId}:`, err.message);
            throw err;
        }
    }

    /**
     * Attiva un'estensione
     * @param {string} extensionId - ID estensione
     * @param {Object} context - Contesto applicazione
     * @returns {Promise<Object>}
     */
    async activateExtension(extensionId, context = {}) {
        const extension = this._activatedExtensions.get(extensionId);
        if (!extension) {
            // Carica se non ancora caricata
            await this.loadExtension(extensionId);
        }

        const ext = this._activatedExtensions.get(extensionId);
        if (!ext) {
            throw new Error(`[ExtensionLoader] Extension not loaded: ${extensionId}`);
        }

        if (ext.isActive) {
            console.log(`[ExtensionLoader] Extension already activated: ${extensionId}`);
            return ext;
        }

        try {
            eventBus.emit('extension:activating', { id: extensionId });

            // Chiama activate se presente
            if (ext.module.activate && typeof ext.module.activate === 'function') {
                await ext.module.activate(ext.context, context);
            }

            ext.isActive = true;
            ext.activatedAt = Date.now();

            eventBus.emit('extension:activated', { id: extensionId });
            
            console.log(`[ExtensionLoader] Extension activated: ${extensionId}`);
            return ext;
        } catch (err) {
            console.error(`[ExtensionLoader] Failed to activate extension ${extensionId}:`, err.message);
            ext.isActive = false;
            throw err;
        }
    }

    /**
     * Disattiva un'estensione
     * @param {string} extensionId - ID estensione
     * @returns {Promise<void>}
     */
    async deactivateExtension(extensionId) {
        const ext = this._activatedExtensions.get(extensionId);
        if (!ext || !ext.isActive) {
            return;
        }

        try {
            eventBus.emit('extension:deactivating', { id: extensionId });

            // Chiama deactivate se presente
            if (ext.module.deactivate && typeof ext.module.deactivate === 'function') {
                await ext.module.deactivate();
            }

            ext.isActive = false;
            ext.activatedAt = null;

            eventBus.emit('extension:deactivated', { id: extensionId });
            
            console.log(`[ExtensionLoader] Extension deactivated: ${extensionId}`);
        } catch (err) {
            console.error(`[ExtensionLoader] Failed to deactivate extension ${extensionId}:`, err.message);
            throw err;
        }
    }

    /**
     * Installa un'estensione
     * @param {string} packagePath - Percorso pacchetto estensione
     * @returns {Promise<Object>}
     */
    async installExtension(packagePath) {
        try {
            eventBus.emit('extension:installing', { package: packagePath });

            // Estrai e valida il pacchetto
            const tempDir = path.join(this.extensionsDir, '.temp');
            await fs.mkdir(tempDir, { recursive: true });

            // Qui si potrebbe aggiungere estrazione ZIP/tar
            // Per ora assumiamo che packagePath sia già una directory
            const manifestPath = path.join(packagePath, 'package.json');
            const manifest = await this._manifestValidator.loadFromFile(manifestPath);

            const extId = this._manifestValidator._generateId(manifest);
            const destPath = path.join(this.extensionsDir, extId);

            // Copia estensione
            await this._copyDirectory(packagePath, destPath);

            eventBus.emit('extension:installed', { id: extId });
            
            console.log(`[ExtensionLoader] Extension installed: ${extId}`);
            return { success: true, id: extId };
        } catch (err) {
            console.error('[ExtensionLoader] Install error:', err.message);
            throw err;
        }
    }

    /**
     * Disinstalla un'estensione
     * @param {string} extensionId - ID estensione
     * @returns {Promise<Object>}
     */
    async uninstallExtension(extensionId) {
        const ext = this._extensions.get(extensionId);
        if (!ext) {
            throw new Error(`[ExtensionLoader] Extension not found: ${extensionId}`);
        }

        try {
            // Disattiva se attiva
            if (this._activatedExtensions.has(extensionId)) {
                await this.deactivateExtension(extensionId);
            }

            // Rimuovi directory
            await fs.rm(ext.path, { recursive: true, force: true });

            this._extensions.delete(extensionId);
            this._activatedExtensions.delete(extensionId);

            eventBus.emit('extension:uninstalled', { id: extensionId });
            
            console.log(`[ExtensionLoader] Extension uninstalled: ${extensionId}`);
            return { success: true, id: extensionId };
        } catch (err) {
            console.error(`[ExtensionLoader] Uninstall error for ${extensionId}:`, err.message);
            throw err;
        }
    }

    /**
     * Abilita estensione
     * @param {string} extensionId
     */
    async enableExtension(extensionId) {
        // Logica per abilitare (es: scrivere in config)
        eventBus.emit('extension:enabled', { id: extensionId });
    }

    /**
     * Disabilita estensione
     * @param {string} extensionId
     */
    async disableExtension(extensionId) {
        // Disattiva se attiva
        if (this._activatedExtensions.has(extensionId)) {
            await this.deactivateExtension(extensionId);
        }
        
        eventBus.emit('extension:disabled', { id: extensionId });
    }

    /**
     * Ottieni estensione per ID
     * @param {string} extensionId
     * @returns {Object|null}
     */
    getExtension(extensionId) {
        return this._activatedExtensions.get(extensionId) || null;
    }

    /**
     * Ottieni tutte le estensioni
     * @returns {Array}
     */
    getAllExtensions() {
        return Array.from(this._activatedExtensions.values());
    }

    /**
     * Ottieni estensioni attive
     * @returns {Array}
     */
    getActiveExtensions() {
        return Array.from(this._activatedExtensions.values()).filter(e => e.isActive);
    }

    /**
     * Controlla se estensione è abilitata
     * @private
     */
    _isExtensionEnabled(name) {
        // Per ora, tutte abilitate di default
        // Si potrebbe leggere da un file di configurazione
        return true;
    }

    /**
     * Copia directory (semplificata)
     * @private
     */
    async _copyDirectory(src, dest) {
        const { exec } = require('child_process');
        const util = require('util');
        const execAsync = util.promisify(exec);

        if (process.platform === 'win32') {
            await execAsync(`xcopy /E /I /Y "${src}" "${dest}"`);
        } else {
            await execAsync(`cp -R "${src}" "${dest}"`);
        }
    }
}

module.exports = ExtensionLoader;
