/**
 * E2E Test: Application Lifecycle
 * 
 * Test apertura/chiusura IDE, persistenza settings, recovery
 */

const { test, expect } = require('@playwright/test');

test.describe('Application Lifecycle', () => {
  
  test('should load the main page with correct title', async ({ page }) => {
    // Navigate to IDE
    await page.goto('http://localhost:5000');
    
    // Check title
    const title = await page.title();
    expect(title).toContain('GXCode');
  });

  test('should display main layout elements', async ({ page }) => {
    await page.goto('http://localhost:5000');
    
    // Check left sidebar exists
    const leftSidebar = page.locator('#left-sidebar');
    await expect(leftSidebar).toBeVisible();
    
    // Check editor area exists
    const editor = page.locator('.monaco-editor').first();
    await expect(editor).toBeVisible();
    
    // Check bottom panel exists
    const bottomPanel = page.locator('#bottom-panel');
    await expect(bottomPanel).toBeVisible();
  });

  test('should have sidebar navigation buttons', async ({ page }) => {
    await page.goto('http://localhost:5000');
    
    // Explorer button
    const explorerBtn = page.locator('[data-testid="explorer-button"]');
    await expect(explorerBtn).toBeVisible();
    
    // Search button
    const searchBtn = page.locator('[data-testid="search-button"]');
    await expect(searchBtn).toBeVisible();
    
    // Git button
    const gitBtn = page.locator('[data-testid="git-button"]');
    await expect(gitBtn).toBeVisible();
    
    // Debug button
    const debugBtn = page.locator('[data-testid="debug-button"]');
    await expect(debugBtn).toBeVisible();
    
    // Extensions button
    const extensionsBtn = page.locator('[data-testid="extensions-button"]');
    await expect(extensionsBtn).toBeVisible();
  });

  test('should switch between sidebar panels', async ({ page }) => {
    await page.goto('http://localhost:5000');
    
    // Click explorer
    await page.locator('[data-testid="explorer-button"]').click();
    const explorerPanel = page.locator('#explorer-panel');
    await expect(explorerPanel).toBeVisible();
    
    // Click search
    await page.locator('[data-testid="search-button"]').click();
    const searchPanel = page.locator('#search-panel');
    await expect(searchPanel).toBeVisible();
  });

  test('should open command palette with keyboard shortcut', async ({ page }) => {
    await page.goto('http://localhost:5000');
    
    // Press Ctrl+Shift+P
    await page.keyboard.press('Control+Shift+P');
    
    // Command palette should appear
    const palette = page.locator('[data-testid="command-palette"]');
    await expect(palette).toBeVisible({ timeout: 5000 });
  });

  test('should open quick file with Ctrl+P', async ({ page }) => {
    await page.goto('http://localhost:5000');
    
    // Press Ctrl+P
    await page.keyboard.press('Control+P');
    
    // Quick open should appear
    const quickOpen = page.locator('[data-testid="quick-open"]');
    await expect(quickOpen).toBeVisible({ timeout: 5000 });
  });
});
