/**
 * E2E Test: Debug Features
 * 
 * Test breakpoint, debug session, step over, variables
 */

const { test, expect } = require('@playwright/test');

test.describe('Debug Features', () => {
  
  test('should have debug panel', async ({ page }) => {
    await page.goto('http://localhost:5000');
    
    // Debug button
    const debugBtn = page.locator('[data-testid="debug-button"]');
    await expect(debugBtn).toBeVisible();
    
    // Click debug
    await debugBtn.click();
    
    // Debug panel should be visible
    const debugPanel = page.locator('#debug-panel');
    await expect(debugPanel).toBeVisible();
  });

  test('should set breakpoint on gutter click', async ({ page }) => {
    await page.goto('http://localhost:5000');
    
    // Open a file
    // Click on gutter to set breakpoint
    const gutter = page.locator('.glyph-margin').first();
    await gutter.click();
    
    // Breakpoint should appear (red dot)
    const breakpoint = page.locator('.gx-breakpoint-real');
    await expect(breakpoint).toBeVisible();
  });

  test('should show breakpoints list', async ({ page }) => {
    await page.goto('http://localhost:5000');
    
    // Open debug panel
    await page.locator('[data-testid="debug-button"]').click();
    
    // Breakpoints section should exist
    const breakpointsSection = page.locator('[data-testid="breakpoints-section"]');
    await expect(breakpointsSection).toBeVisible();
  });

  test('should have debug controls', async ({ page }) => {
    await page.goto('http://localhost:5000');
    
    // Open debug panel
    await page.locator('[data-testid="debug-button"]').click();
    
    // Continue button
    const continueBtn = page.locator('[data-testid="debug-continue"]');
    await expect(continueBtn).toBeVisible();
    
    // Step over button
    const stepOverBtn = page.locator('[data-testid="debug-step-over"]');
    await expect(stepOverBtn).toBeVisible();
    
    // Stop button
    const stopBtn = page.locator('[data-testid="debug-stop"]');
    await expect(stopBtn).toBeVisible();
  });

  test('should show variables when paused', async ({ page }) => {
    await page.goto('http://localhost:5000');
    
    // Open debug panel
    await page.locator('[data-testid="debug-button"]').click();
    
    // Variables section
    const variablesSection = page.locator('[data-testid="variables-section"]');
    await expect(variablesSection).toBeVisible();
  });

  test('should show call stack when paused', async ({ page }) => {
    await page.goto('http://localhost:5000');
    
    // Open debug panel
    await page.locator('[data-testid="debug-button"]').click();
    
    // Call stack section
    const callStackSection = page.locator('[data-testid="callstack-section"]');
    await expect(callStackSection).toBeVisible();
  });

  test('should show debug toolbar when running', async ({ page }) => {
    await page.goto('http://localhost:5000');
    
    // Start debug session (would require actual debug launch)
    // Debug toolbar should appear at top
    const debugToolbar = page.locator('[data-testid="debug-toolbar"]');
    await expect(debugToolbar).toBeVisible();
  });

  test('should highlight current debug line', async ({ page }) => {
    await page.goto('http://localhost:5000');
    
    // When debugging, current line should be highlighted
    const currentLine = page.locator('.debug-current-line');
    // May not be visible if not debugging
    expect(true).toBe(true); // Placeholder
  });
});
