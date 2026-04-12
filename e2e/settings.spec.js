/**
 * E2E Test: Settings & Configuration
 * 
 * Test persistenza settings, API keys, temi
 */

const { test, expect } = require('@playwright/test');

test.describe('Settings & Configuration', () => {
  
  test('should open settings panel', async ({ page }) => {
    await page.goto('http://localhost:5000');
    
    // Settings button (gear icon)
    const settingsBtn = page.locator('[data-testid="settings-button"]');
    await expect(settingsBtn).toBeVisible();
    
    // Click settings
    await settingsBtn.click();
    
    // Settings panel should appear
    const settingsPanel = page.locator('#settings-panel');
    await expect(settingsPanel).toBeVisible();
  });

  test('should change theme in settings', async ({ page }) => {
    await page.goto('http://localhost:5000');
    
    // Open settings
    await page.locator('[data-testid="settings-button"]').click();
    
    // Theme selector
    const themeSelector = page.locator('[data-testid="settings-theme-selector"]');
    await expect(themeSelector).toBeVisible();
    
    // Select different theme
    await themeSelector.selectOption('dark');
    
    // Theme should change
    await page.waitForTimeout(500);
    const body = page.locator('body');
    const className = await body.getAttribute('class');
    expect(className).toContain('dark');
  });

  test('should save API key in settings', async ({ page }) => {
    await page.goto('http://localhost:5000');
    
    // Open settings
    await page.locator('[data-testid="settings-button"]').click();
    
    // Navigate to AI section
    const aiSection = page.locator('[data-testid="settings-ai-section"]');
    await expect(aiSection).toBeVisible();
    
    // API key input
    const apiKeyInput = page.locator('[data-testid="settings-api-key-input"]');
    await expect(apiKeyInput).toBeVisible();
    
    // Fill API key
    await apiKeyInput.fill('test-api-key-12345');
    
    // Save button
    const saveBtn = page.locator('[data-testid="settings-save-button"]');
    await saveBtn.click();
    
    // Should show success message
    const successMsg = page.locator('[data-testid="settings-save-success"]');
    await expect(successMsg).toBeVisible({ timeout: 3000 });
  });

  test('should persist settings after reload', async ({ page }) => {
    await page.goto('http://localhost:5000');
    
    // Open settings
    await page.locator('[data-testid="settings-button"]').click();
    
    // Change a setting
    const settingToggle = page.locator('[data-testid="setting-toggle"]');
    await settingToggle.click();
    
    // Save
    await page.locator('[data-testid="settings-save-button"]').click();
    await page.waitForTimeout(500);
    
    // Reload page
    await page.reload();
    await page.waitForTimeout(1000);
    
    // Setting should be persisted
    const toggleAfterReload = page.locator('[data-testid="setting-toggle"]');
    const isChecked = await toggleAfterReload.isChecked();
    expect(isChecked).toBe(true);
  });

  test('should configure font size', async ({ page }) => {
    await page.goto('http://localhost:5000');
    
    // Open settings
    await page.locator('[data-testid="settings-button"]').click();
    
    // Font size input
    const fontSizeInput = page.locator('[data-testid="settings-font-size-input"]');
    await expect(fontSizeInput).toBeVisible();
    
    // Change font size
    await fontSizeInput.fill('16');
    
    // Font size should change
    const editor = page.locator('.monaco-editor');
    const fontSize = await editor.evaluate(el => {
      return window.getComputedStyle(el).fontSize;
    });
    
    expect(fontSize).toContain('16');
  });

  test('should configure auto-save', async ({ page }) => {
    await page.goto('http://localhost:5000');
    
    // Open settings
    await page.locator('[data-testid="settings-button"]').click();
    
    // Auto-save checkbox
    const autoSaveCheckbox = page.locator('[data-testid="setting-auto-save"]');
    await expect(autoSaveCheckbox).toBeVisible();
    
    // Toggle auto-save
    await autoSaveCheckbox.click();
    
    // Should be checked
    const isChecked = await autoSaveCheckbox.isChecked();
    expect(isChecked).toBe(true);
  });

  test('should reset settings to default', async ({ page }) => {
    await page.goto('http://localhost:5000');
    
    // Open settings
    await page.locator('[data-testid="settings-button"]').click();
    
    // Reset button
    const resetBtn = page.locator('[data-testid="settings-reset-button"]');
    await expect(resetBtn).toBeVisible();
    
    // Click reset
    await resetBtn.click();
    
    // Confirm dialog
    const confirmBtn = page.locator('[data-testid="confirm-reset-settings"]');
    await confirmBtn.click();
    
    // Should show success
    const successMsg = page.locator('[data-testid="settings-reset-success"]');
    await expect(successMsg).toBeVisible({ timeout: 3000 });
  });
});
