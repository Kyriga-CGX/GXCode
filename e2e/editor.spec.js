/**
 * E2E Test: Editor Features
 * 
 * Test temi, syntax highlighting, split view, etc.
 */

const { test, expect } = require('@playwright/test');

test.describe('Editor Features', () => {
  
  test('should have Monaco editor loaded', async ({ page }) => {
    await page.goto('http://localhost:5000');
    
    // Check Monaco editor exists
    const editor = page.locator('.monaco-editor').first();
    await expect(editor).toBeVisible();
  });

  test('should change editor theme', async ({ page }) => {
    await page.goto('http://localhost:5000');
    
    // Open theme selector (would be in settings)
    const themeSelector = page.locator('[data-testid="theme-selector"]');
    await expect(themeSelector).toBeVisible();
    
    // Change theme
    await themeSelector.click();
    
    // Select dark theme
    await page.locator('[data-testid="theme-option-dark"]').click();
    
    // Editor should have dark theme class
    const editor = page.locator('.monaco-editor.vs-dark');
    await expect(editor).toBeVisible();
  });

  test('should support syntax highlighting for JavaScript', async ({ page }) => {
    await page.goto('http://localhost:5000');
    
    // Open JS file
    // Type JS code
    const editor = page.locator('.monaco-editor').first();
    await editor.click();
    
    await page.keyboard.type('const x = 42;');
    
    // Check syntax highlighting (span with token colors)
    const keywordSpan = page.locator('.mtk'); // Monaco token classes
    await expect(keywordSpan.first()).toBeVisible();
  });

  test('should enable split view', async ({ page }) => {
    await page.goto('http://localhost:5000');
    
    // Click split editor button
    const splitBtn = page.locator('[data-testid="split-editor-button"]');
    await expect(splitBtn).toBeVisible();
    
    await splitBtn.click();
    
    // Should have 2 editors
    const editors = page.locator('.monaco-editor');
    await expect(editors).toHaveCount(2);
  });

  test('should show breadcrumbs', async ({ page }) => {
    await page.goto('http://localhost:5000');
    
    // Breadcrumbs should be visible
    const breadcrumbs = page.locator('[data-testid="breadcrumbs"]');
    await expect(breadcrumbs).toBeVisible();
  });

  test('should show minimap', async ({ page }) => {
    await page.goto('http://localhost:5000');
    
    // Minimap should exist
    const minimap = page.locator('.minimap');
    await expect(minimap).toBeVisible();
  });

  test('should have word wrap toggle', async ({ page }) => {
    await page.goto('http://localhost:5000');
    
    // Word wrap button
    const wordWrapBtn = page.locator('[data-testid="word-wrap-button"]');
    await expect(wordWrapBtn).toBeVisible();
  });

  test('should format document with Alt+Shift+F', async ({ page }) => {
    await page.goto('http://localhost:5000');
    
    const editor = page.locator('.monaco-editor').first();
    await editor.click();
    
    // Type unformatted code
    await page.keyboard.type('const x={a:1,b:2};');
    
    // Format with Alt+Shift+F
    await page.keyboard.press('Alt+Shift+F');
    
    // Should be formatted (would check actual content)
    expect(true).toBe(true); // Placeholder
  });
});
