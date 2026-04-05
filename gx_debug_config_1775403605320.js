
const base = require('./playwright.config.ts'); const baseConfig = base.default || base;
module.exports = {
  testDir: 'C:/Users/Kyrig/OneDrive/Desktop/GXCODE/skill/web/testsonweb/testcreated', 
  testMatch: 'gx_debug_1775403605319_nomedeltest.spec.ts',
  testIgnore: [], 
  timeout: 0, 
  workers: 1,
  retries: 0,
  projects: [{ name: 'gx-debug', use: { browserName: 'chromium', headless: false } }],
  use: { 
    ...(typeof baseConfig !== 'undefined' && baseConfig.use ? baseConfig.use : {}),
    headless: false,
    viewport: { width: 1280, height: 720 }
  },
  reporter: [['list']]
};