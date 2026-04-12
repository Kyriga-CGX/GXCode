/**
 * ExtensionManifest - Schema e validazione manifest estensioni
 * 
 * Responsabilità:
 * - Definire schema manifest
 * - Validare manifest
 * - Fornire metadati estensione
 */

const path = require('path');
const fs = require('fs').promises;

class ExtensionManifest {
    constructor() {
        this._requiredFields = [
            'name',
            'version',
            'main'
        ];

        this._optionalFields = [
            'displayName',
            'description',
            'publisher',
            'icon',
            'categories',
            'keywords',
            'license',
            'repository',
            'engines',
            'activationEvents',
            'contributes',
            'dependencies',
            'settings'
        ];
    }

    /**
     * Carica e valida manifest da file
     * @param {string} manifestPath - Percorso file manifest.json
     * @returns {Promise<Object>}
     */
    async loadFromFile(manifestPath) {
        try {
            const content = await fs.readFile(manifestPath, 'utf8');
            const manifest = JSON.parse(content);
            
            const isValid = this.validate(manifest);
            if (!isValid.valid) {
                throw new Error(`Invalid manifest: ${isValid.errors.join(', ')}`);
            }

            return manifest;
        } catch (err) {
            throw new Error(`Failed to load manifest: ${err.message}`);
        }
    }

    /**
     * Valida manifest
     * @param {Object} manifest
     * @returns {Object} - {valid: boolean, errors: string[]}
     */
    validate(manifest) {
        const errors = [];

        // Campi obbligatori
        for (const field of this._requiredFields) {
            if (!manifest[field]) {
                errors.push(`Missing required field: ${field}`);
            }
        }

        // Valida formato versione semver
        if (manifest.version && !this._isValidSemver(manifest.version)) {
            errors.push('Invalid version format (must be semver)');
        }

        // Valida engines
        if (manifest.engines) {
            if (!manifest.engines.gxcode) {
                errors.push('Missing gxcode engine version');
            }
        }

        // Valida main
        if (manifest.main && !manifest.main.endsWith('.js')) {
            errors.push('Main file must be a JavaScript file');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Ottiene metadati dell'estensione
     * @param {Object} manifest
     * @returns {Object}
     */
    getMetadata(manifest) {
        return {
            id: this._generateId(manifest),
            name: manifest.name,
            displayName: manifest.displayName || manifest.name,
            version: manifest.version,
            description: manifest.description || '',
            publisher: manifest.publisher || 'Unknown',
            icon: manifest.icon || null,
            categories: manifest.categories || [],
            keywords: manifest.keywords || [],
            license: manifest.license || 'MIT',
            repository: manifest.repository || null,
            engines: manifest.engines || {},
            activationEvents: manifest.activationEvents || [],
            settings: manifest.settings || []
        };
    }

    /**
     * Genera ID univoco per estensione
     * @private
     */
    _generateId(manifest) {
        const publisher = manifest.publisher || 'unknown';
        const name = manifest.name;
        return `${publisher.toLowerCase()}.${name.toLowerCase()}`;
    }

    /**
     * Controlla se versione è compatibile
     * @param {string} required - Versione richiesta (es: ">=1.0.0")
     * @param {string} actual - Versione attuale
     * @returns {boolean}
     */
    isVersionCompatible(required, actual) {
        if (!required) return true;

        // Semplice controllo >= (supporto base semver)
        const match = required.match(/^>=?(.+)$/);
        if (match) {
            const minVersion = match[1];
            return this._compareVersions(actual, minVersion) >= 0;
        }

        return required === actual;
    }

    /**
     * Confronta versioni semver
     * @private
     */
    _compareVersions(v1, v2) {
        const parts1 = v1.split('.').map(Number);
        const parts2 = v2.split('.').map(Number);

        for (let i = 0; i < 3; i++) {
            const p1 = parts1[i] || 0;
            const p2 = parts2[i] || 0;

            if (p1 > p2) return 1;
            if (p1 < p2) return -1;
        }

        return 0;
    }

    /**
     * Controlla se stringa è semver valido
     * @private
     */
    _isValidSemver(str) {
        return /^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?/.test(str);
    }
}

module.exports = ExtensionManifest;
