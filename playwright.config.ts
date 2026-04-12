import { defineConfig, devices } from '@playwright/test';
import path from 'path';

/**
 * GXCode IDE - Playwright Configuration
 * 
 * Test E2E per l'applicazione Electron
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: /.*\.spec\.(ts|js)$/,
  
  // Timeout per singolo test
  timeout: 60 * 1000, // 60 secondi
  
  // Timeout per aspettazioni
  expect: {
    timeout: 10 * 1000
  },
  
  // Run tests in parallel
  fullyParallel: true,
  
  // Fail on CI if test.only left
  forbidOnly: !!process.env.CI,
  
  // Retry su CI
  retries: process.env.CI ? 2 : 0,
  
  // Workers
  workers: process.env.CI ? 1 : undefined,
  
  // Reporter
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list'],
    ['json', { outputFile: 'test-results/results.json' }]
  ],
  
  // Shared settings
  use: {
    // Base URL per tests
    baseURL: 'http://localhost:5000',
    
    // Trace collection
    trace: 'on-first-retry',
    
    // Screenshot on failure
    screenshot: 'only-on-failure',
    
    // Video recording
    video: 'retain-on-failure'
  },

  // Projects
  projects: [
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 }
      },
    },
  ],

  // Web server configuration (commented out for Electron app)
  // Per Electron, avviamo manualmente prima dei test
  // webServer: {
  //   command: 'npm run start',
  //   url: 'http://localhost:5000',
  //   reuseExistingServer: !process.env.CI,
  //   timeout: 120 * 1000,
  // },
});
