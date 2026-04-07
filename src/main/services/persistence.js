const fs = require('fs');
const path = require('path');
const os = require('os');

let currentAiContext = '.GXCODE';
let basePersistenceDir = os.homedir(); 

function setBaseDir(newBase) {
    basePersistenceDir = newBase;
    console.log(`[GX-DISK] Base persistence path set to: ${basePersistenceDir}`);
}

function setAiContext(context) {
    currentAiContext = context;
    console.log(`[GX-DISK] Context updated to: ${currentAiContext}`);
}

function ensureDataMigration() {
    const home = os.homedir();
    const potentialLegacyBases = [
        path.join(home, '.GXCODE'),
        path.join(home, '.gemini'),
        path.join(home, 'OneDrive', '.GXCODE'),
        path.join(process.env.APPDATA || '', 'GXCode', 'persistence') // Default Electron Roaming
    ];

    const folders = ['agents', 'skills', 'plugins'];
    console.log("[GX-DISK] Avvio controllo migrazione dati multifase...");

    for (const oldBase of potentialLegacyBases) {
        if (!fs.existsSync(oldBase)) continue;
        
        console.log(`[GX-DISK] Trovata possibile sorgente legacy: ${oldBase}`);

        for (const folder of folders) {
            const oldPath = path.join(oldBase, folder);
            const newPath = path.join(basePersistenceDir, folder);
            
            if (fs.existsSync(oldPath)) {
                if (!fs.existsSync(newPath)) {
                    try {
                        fs.mkdirSync(newPath, { recursive: true });
                    } catch (err) {
                        console.error(`[GX-DISK] Errore creazione cartella ${newPath}:`, err.message);
                        continue;
                    }
                }
                
                try {
                    const files = fs.readdirSync(oldPath).filter(f => f.endsWith('.json') || folder === 'plugins');
                    let migratedCount = 0;
                    for (const file of files) {
                        const src = path.join(oldPath, file);
                        const dest = path.join(newPath, file);
                        
                        // Migriamo solo se non esiste gi├á nel nuovo percorso
                        if (!fs.existsSync(dest)) {
                            try {
                                if (fs.lstatSync(src).isDirectory()) {
                                    // Semplice copia ricorsiva per plugin se necessario (anche se solitamente sono JSON)
                                    // In questo caso gestiamo solo file per semplicit├á, ma plugins potrebbero essere cartelle
                                    // Se plugins sono cartelle, usiamo cpSync (Node 16.7+)
                                    if (fs.cpSync) {
                                        fs.cpSync(src, dest, { recursive: true });
                                    } else {
                                        // Fallback manuale o skip? Per ora assumiamo file json
                                        fs.copyFileSync(src, dest);
                                    }
                                } else {
                                    fs.copyFileSync(src, dest);
                                }
                                migratedCount++;
                            } catch (e) {
                                console.error(`[GX-DISK] Errore copia ${file}:`, e.message);
                            }
                        }
                    }
                    if (migratedCount > 0) {
                        console.log(`[GX-DISK] Migrati ${migratedCount} elementi della cartella ${folder} da ${oldBase}`);
                    }
                } catch (e) {
                    console.error(`[GX-DISK] Errore lettura cartella ${oldPath}:`, e.message);
                }
            }
        }
    }
    console.log("[GX-DISK] Migrazione completata (o nessuna nuova sorgente trovata).");
}

function getAiContext() {
    return currentAiContext;
}

function getActiveAiPath(subfolder) {
  const baseDir = path.join(basePersistenceDir, subfolder);
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }
  return baseDir;
}

function loadPersistedData(type) {
  const dir = getActiveAiPath(type);
  const results = [];
  try {
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
    for (const file of files) {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf-8'));
        data._managedBy = currentAiContext;
        results.push(data);
      } catch (e) { console.error(`Error loading ${file}:`, e); }
    }
  } catch (e) { }
  return results;
}

function savePersistedData(type, entity) {
  const dir = getActiveAiPath(type);
  const safeName = (entity.slug || entity.name || `item_${entity.id}`).toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const filePath = path.join(dir, `${safeName}.json`);
  fs.writeFileSync(filePath, JSON.stringify(entity, null, 2), 'utf-8');
  return filePath;
}

function deletePersistedData(type, id) {
  const dir = getActiveAiPath(type);
  try {
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
    for (const file of files) {
      const p = path.join(dir, file);
      try {
        const data = JSON.parse(fs.readFileSync(p, 'utf-8'));
        if (String(data.id) === String(id) || String(data.slug) === String(id)) {
          fs.unlinkSync(p);
          console.log(`[GX-DISK] Eliminato ${type}: ${file}`);
          return true;
        }
      } catch (e) { }
    }
  } catch (e) { }
  return false;
}

module.exports = { 
    setBaseDir,
    setAiContext, 
    getAiContext, 
    getActiveAiPath, 
    loadPersistedData, 
    savePersistedData, 
    deletePersistedData,
    ensureDataMigration
};
