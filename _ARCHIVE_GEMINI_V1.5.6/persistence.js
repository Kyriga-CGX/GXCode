const fs = require('fs');
const path = require('path');
const os = require('os');

let currentAiContext = '.GXCODE';

function setAiContext(context) {
    currentAiContext = context;
    console.log(`[GX-DISK] Context updated to: ${currentAiContext}`);
}

function getAiContext() {
    return currentAiContext;
}

function getActiveAiPath(subfolder) {
  try {
    // Hardening: Use local AppData to avoid OneDrive locks
    const localBase = path.join(os.homedir(), 'AppData', 'Local', 'GXCode', 'persistence');
    const baseDir = path.join(localBase, subfolder);
    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true });
    }
    return baseDir;
  } catch (err) {
    console.error(`[GX-DISK] Fatal error creating persistence path: ${err.message}`);
    // Fallback to a temp dir if local AppData fails
    return path.join(os.tmpdir(), 'gxcode-fallback', subfolder);
  }
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
    setAiContext, 
    getAiContext, 
    getActiveAiPath, 
    loadPersistedData, 
    savePersistedData, 
    deletePersistedData 
};
