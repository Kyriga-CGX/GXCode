/**
 * SourceMapSupport - Gestione source maps per debugging
 * 
 * Features:
 * - Parsing source map files (.map)
 * - Mappatura posizione compilata → originale
 * - Mappatura posizione originale → compilata
 * - Supporto per TypeScript, Webpack, Vite
 * - Cache source maps
 * - Resolution file URLs
 */

const path = require('path');
const fs = require('fs').promises;
const eventBus = require('../../core/EventBus');

class SourceMapConsumer {
  constructor(sourceMapData) {
    this.raw = typeof sourceMapData === 'string' 
      ? JSON.parse(sourceMapData) 
      : sourceMapData;
    
    this.version = this.raw.version;
    this.file = this.raw.file;
    this.sourceRoot = this.raw.sourceRoot || '';
    this.sources = this.raw.sources || [];
    this.names = this.raw.names || [];
    this.mappings = this.raw.mappings;
    
    // Decodified mappings
    this._decoded = null;
  }

  /**
   * Trova posizione originale da posizione generata
   * @param {Object} generated - { line, column }
   * @returns {Object|null} - { source, line, column, name }
   */
  originalPositionFor(generated) {
    if (!this._decoded) {
      this._decoded = this._decodeMappings();
    }

    const line = generated.line - 1; // Convert to 0-based
    const column = generated.column || 0;

    // Find closest mapping
    let closest = null;
    let minDiff = Infinity;

    for (const mapping of this._decoded) {
      if (mapping.generatedLine === line) {
        const diff = Math.abs(mapping.generatedColumn - column);
        if (diff < minDiff && mapping.generatedColumn <= column) {
          minDiff = diff;
          closest = mapping;
        }
      }
    }

    if (!closest) {
      return null;
    }

    return {
      source: closest.source 
        ? this.sourceRoot 
          ? path.join(this.sourceRoot, closest.source) 
          : closest.source 
        : null,
      line: closest.originalLine + 1, // Convert to 1-based
      column: closest.originalColumn,
      name: closest.nameIndex !== null ? this.names[closest.nameIndex] : null
    };
  }

  /**
   * Trova posizione generata da posizione originale
   * @param {Object} original - { source, line, column }
   * @returns {Object|null} - { line, column }
   */
  generatedPositionFor(original) {
    if (!this._decoded) {
      this._decoded = this._decodeMappings();
    }

    const line = original.line - 1; // Convert to 0-based

    // Find mapping
    const mapping = this._decoded.find(m => 
      m.originalLine === line && 
      m.source === original.source
    );

    if (!mapping) {
      return null;
    }

    return {
      line: mapping.generatedLine + 1, // Convert to 1-based
      column: mapping.generatedColumn
    };
  }

  /**
   * Decodifica mappings VLQ
   * @private
   */
  _decodeMappings() {
    const mappings = [];
    const lines = this.mappings.split(';');
    
    let generatedLine = 0;
    let generatedColumn = 0;
    let sourceIndex = 0;
    let originalLine = 0;
    let originalColumn = 0;
    let nameIndex = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) {
        generatedLine++;
        continue;
      }

      const segments = this._decodeVLQLines(line);
      generatedColumn = 0;

      for (const segment of segments) {
        generatedColumn += segment[0];
        
        if (segment.length >= 4) {
          sourceIndex += segment[1];
          originalLine += segment[2];
          originalColumn += segment[3];
        }

        const mapping = {
          generatedLine,
          generatedColumn,
          sourceIndex: segment.length >= 4 ? sourceIndex : null,
          source: segment.length >= 4 ? this.sources[sourceIndex] : null,
          originalLine: segment.length >= 4 ? originalLine : null,
          originalColumn: segment.length >= 4 ? originalColumn : null,
          nameIndex: segment.length >= 5 ? (nameIndex += segment[4]) : null
        };

        mappings.push(mapping);
      }

      generatedLine++;
    }

    return mappings;
  }

  /**
   * Decodifica stringa VLQ
   * @private
   */
  _decodeVLQLines(str) {
    const segments = [];
    let current = [];
    let value = 0;
    let shift = 0;

    for (let i = 0; i < str.length; i++) {
      const char = str[i];
      
      if (char === ',') {
        if (current.length > 0) {
          segments.push(current);
          current = [];
          value = 0;
          shift = 0;
        }
        continue;
      }

      const code = this._base64Decode(char);
      value += (code & 31) << shift;
      
      if (code & 32) {
        shift += 5;
      } else {
        const shouldNegate = value & 1;
        value >>= 1;
        if (shouldNegate) {
          value = -value;
        }
        current.push(value);
        value = 0;
        shift = 0;
      }
    }

    if (current.length > 0) {
      segments.push(current);
    }

    return segments;
  }

  /**
   * Decodifica carattere base64
   * @private
   */
  _base64Decode(char) {
    const base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    return base64Chars.indexOf(char);
  }

  /**
   * Ottieni tutti i sorgenti
   * @returns {string[]}
   */
  getSources() {
    return this.sources.map(s => 
      this.sourceRoot ? path.join(this.sourceRoot, s) : s
    );
  }

  /**
   * Ottieni contenuto sorgente
   * @param {string} source - Nome sorgente
   * @returns {string|null}
   */
  getSourceContent(source) {
    if (this.raw.sourcesContent) {
      const index = this.sources.indexOf(source);
      if (index !== -1) {
        return this.raw.sourcesContent[index];
      }
    }
    return null;
  }
}

class SourceMapSupport {
  constructor() {
    this._cache = new Map(); // Map<mapPath, SourceMapConsumer>
    this._sourceCache = new Map(); // Map<sourcePath, content>
    this._config = {
      enabled: true,
      loadSourceContent: true,
      maxCacheSize: 100
    };
    this._initialized = false;
  }

  /**
   * Inizializza il supporto source maps
   */
  async init(context) {
    console.log('[SourceMapSupport] Initializing...');
    
    // Load config
    try {
      const configPath = path.join(context.userDataPath, 'sourcemap-config.json');
      const configData = await fs.readFile(configPath, 'utf-8');
      this._config = { ...this._config, ...JSON.parse(configData) };
      console.log('[SourceMapSupport] Config loaded');
    } catch (err) {
      console.log('[SourceMapSupport] Using default config');
    }

    this._initialized = true;
    eventBus.emit('sourcemap:initialized', { config: this._config });
    console.log('[SourceMapSupport] Initialized');
  }

  /**
   * Spegne il supporto
   */
  async shutdown() {
    console.log('[SourceMapSupport] Shutting down...');
    this._cache.clear();
    this._sourceCache.clear();
    this._initialized = false;
    eventBus.emit('sourcemap:shutdown');
  }

  /**
   * Carica un source map
   * @param {string} mapPath - Percorso file .map
   * @returns {Promise<SourceMapConsumer>}
   */
  async loadSourceMap(mapPath) {
    if (this._cache.has(mapPath)) {
      return this._cache.get(mapPath);
    }

    try {
      const content = await fs.readFile(mapPath, 'utf-8');
      const consumer = new SourceMapConsumer(content);
      
      this._cache.set(mapPath, consumer);
      
      // Limit cache size
      if (this._cache.size > this._config.maxCacheSize) {
        const firstKey = this._cache.keys().next().value;
        this._cache.delete(firstKey);
      }

      console.log(`[SourceMapSupport] Loaded source map: ${path.basename(mapPath)}`);
      return consumer;
    } catch (err) {
      console.error(`[SourceMapSupport] Error loading source map:`, err.message);
      throw err;
    }
  }

  /**
   * Trova source map per un file compilato
   * @param {string} compiledPath - Percorso file compilato
   * @returns {Promise<SourceMapConsumer|null>}
   */
  async findSourceMapForFile(compiledPath) {
    // Try .map file
    const mapPath = compiledPath + '.map';
    
    try {
      await fs.access(mapPath);
      return await this.loadSourceMap(mapPath);
    } catch {
      // No .map file, try inline source map in file
    }

    // Try to find source map URL in file
    try {
      const content = await fs.readFile(compiledPath, 'utf-8');
      const match = content.match(/\/\/[#@] sourceMappingURL=(.+)/);
      
      if (match) {
        const mapUrl = match[1].trim();
        
        if (mapUrl.startsWith('data:')) {
          // Inline base64 source map
          const base64Data = mapUrl.split(',')[1];
          const decoded = Buffer.from(base64Data, 'base64').toString('utf-8');
          const consumer = new SourceMapConsumer(decoded);
          this._cache.set(compiledPath, consumer);
          return consumer;
        } else {
          // Relative or absolute path
          const resolvedPath = path.resolve(path.dirname(compiledPath), mapUrl);
          return await this.loadSourceMap(resolvedPath);
        }
      }
    } catch {
      // Can't read file
    }

    return null;
  }

  /**
   * Mappa posizione compilata a originale
   * @param {string} compiledPath - Percorso file compilato
   * @param {Object} position - { line, column }
   * @returns {Promise<Object|null>} - { source, line, column, content }
   */
  async mapToOriginal(compiledPath, position) {
    const consumer = await this.findSourceMapForFile(compiledPath);
    
    if (!consumer) {
      return null;
    }

    const original = consumer.originalPositionFor(position);
    
    if (!original) {
      return null;
    }

    // Get source content if available
    let content = consumer.getSourceContent(original.source);
    
    if (!content && this._config.loadSourceContent) {
      try {
        const sourcePath = path.resolve(path.dirname(compiledPath), original.source);
        content = await fs.readFile(sourcePath, 'utf-8');
        this._sourceCache.set(original.source, content);
      } catch {
        // Can't load source
      }
    }

    return {
      ...original,
      content
    };
  }

  /**
   * Mappa posizione originale a compilata
   * @param {string} sourcePath - Percorso file originale
   * @param {Object} position - { line, column }
   * @param {string} compiledPath - Percorso file compilato
   * @returns {Promise<Object|null>} - { line, column }
   */
  async mapToCompiled(sourcePath, position, compiledPath) {
    const consumer = await this.findSourceMapForFile(compiledPath);
    
    if (!consumer) {
      return null;
    }

    return consumer.generatedPositionFor({
      source: path.basename(sourcePath),
      line: position.line,
      column: position.column || 0
    });
  }

  /**
   * Ottiene tutti i sorgenti per un file compilato
   * @param {string} compiledPath - Percorso file compilato
   * @returns {Promise<string[]>}
   */
  async getSources(compiledPath) {
    const consumer = await this.findSourceMapForFile(compiledPath);
    return consumer ? consumer.getSources() : [];
  }

  /**
   * Pulisce la cache
   * @param {string} [mapPath] - Percorso specifico o tutti
   */
  clearCache(mapPath = null) {
    if (mapPath) {
      this._cache.delete(mapPath);
    } else {
      this._cache.clear();
      this._sourceCache.clear();
    }
  }

  /**
   * Aggiorna configurazione
   */
  updateConfig(newConfig) {
    this._config = { ...this._config, ...newConfig };
    eventBus.emit('sourcemap:config-updated', { config: this._config });
  }

  /**
   * Ottieni stato
   */
  getStatus() {
    return {
      initialized: this._initialized,
      enabled: this._config.enabled,
      cacheSize: this._cache.size,
      sourceCacheSize: this._sourceCache.size
    };
  }
}

// Modulo export
module.exports = {
  name: 'SourceMapSupport',
  version: '1.0.0',
  
  _instance: new SourceMapSupport(),
  
  async init(context) {
    return this._instance.init(context);
  },
  
  async shutdown() {
    return this._instance.shutdown();
  },
  
  getInstance() {
    return this._instance;
  },
  
  SourceMapConsumer
};
