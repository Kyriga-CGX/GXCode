/**
 * GXCode IDE - v1.5.5 (Modular Evolution)
 * entry point bootstrapped via src/main/index.js
 */
const { app } = require('electron');
const path = require('path');
const os = require('os');

// --- CRITICAL PATH HARDENING (EARLIEST POSSIBLE) ---
// Redirecting userData and home path to a safe local directory to avoid OneDrive locks and cache errors
const localAppBase = path.join(process.env.LOCALAPPDATA, 'GXCode_IDE_Stable_Final');
app.setPath('userData', localAppBase);
process.env.GX_USER_DATA = localAppBase;

console.log("[GX-BOOTSTRAP] ROOT ENTRY: UserData set to:", localAppBase);

process.env.GX_MODULAR = 'true';
require('./src/main/index.js');
