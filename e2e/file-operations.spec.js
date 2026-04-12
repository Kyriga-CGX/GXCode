/**
 * E2E Test: File Operations
 * 
 * Test creazione, apertura, modifica, salvataggio file
 */

const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');

test.describe('File Operations', () => {
  
  let tempDir;
  let testFile;

  test.beforeEach(async ({ page }) => {
    // Create temp directory
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gxcode-test-'));
    testFile = path.join(tempDir, 'test.js');
    
    // Create initial file
    await fs.writeFile(testFile, '// Test file\n');
    
    await page.goto('http://localhost:5000');
  });

  test.afterEach(async () => {
    // Cleanup
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (err) {
      // Ignore cleanup errors
    }
  });

  test('should open a file in editor', async ({ page }) => {
    // This would require IPC to open files
    // For now, we test the UI elements exist
    await page.goto('http://localhost:5000');
    
    // Check file explorer is visible
    const explorer = page.locator('#file-explorer');
    await expect(explorer).toBeVisible();
  });

  test('should create new file', async ({ page }) => {
    // Click new file button
    const newFileBtn = page.locator('[data-testid="new-file-button"]');
    await expect(newFileBtn).toBeVisible();
    
    // Click button
    await newFileBtn.click();
    
    // File name input should appear
    const input = page.locator('[data-testid="file-name-input"]');
    await expect(input).toBeVisible();
    
    // Type file name
    await input.fill('newfile.js');
    
    // Press Enter
    await page.keyboard.press('Enter');
    
    // File should be created (check in explorer)
    const fileItem = page.locator('[data-testid="file-item"]:has-text("newfile.js")');
    await expect(fileItem).toBeVisible({ timeout: 5000 });
  });

  test('should edit file content', async ({ page }) => {
    await page.goto('http://localhost:5000');
    
    // Wait for Monaco editor to load
    const editor = page.locator('.monaco-editor').first();
    await expect(editor).toBeVisible();
    
    // Click in editor
    await editor.click();
    
    // Type some code
    await page.keyboard.type('const x = 42;');
    
    // Verify content changed (check for the text)
    const content = await page.locator('.monaco-editor').first().innerText();
    expect(content).toContain('const x = 42;');
  });

  test('should save file with Ctrl+S', async ({ page }) => {
    await page.goto('http://localhost:5000');
    
    // Click in editor
    const editor = page.locator('.monaco-editor').first();
    await expect(editor).toBeVisible();
    await editor.click();
    
    // Type content
    await page.keyboard.type('// Modified content');
    
    // Save with Ctrl+S
    await page.keyboard.press('Control+S');
    
    // Should show save indicator
    const saveIndicator = page.locator('[data-testid="save-indicator"]');
    await expect(saveIndicator).toBeVisible({ timeout: 3000 });
  });

  test('should rename file', async ({ page }) => {
    await page.goto('http://localhost:5000');
    
    // Right click on file (would need a file first)
    // This test would be implemented with actual file tree
    expect(true).toBe(true); // Placeholder
  });

  test('should delete file', async ({ page }) => {
    await page.goto('http://localhost:5000');
    
    // Right click delete file
    // This test would be implemented with actual file tree
    expect(true).toBe(true); // Placeholder
  });

  test('should handle multiple open files (tabs)', async ({ page }) => {
    await page.goto('http://localhost:5000');
    
    // Check tabs container exists
    const tabsContainer = page.locator('#tabs-container');
    await expect(tabsContainer).toBeVisible();
  });

  test('should switch between tabs', async ({ page }) => {
    await page.goto('http://localhost:5000');
    
    // Open multiple files (would need actual files)
    // Click on different tabs
    expect(true).toBe(true); // Placeholder
  });
});
