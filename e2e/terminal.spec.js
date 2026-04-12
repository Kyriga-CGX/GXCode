/**
 * E2E Test: Terminal
 * 
 * Test terminale, comandi base, split
 */

const { test, expect } = require('@playwright/test');

test.describe('Terminal', () => {
  
  test('should have terminal panel', async ({ page }) => {
    await page.goto('http://localhost:5000');
    
    // Terminal button
    const terminalBtn = page.locator('[data-testid="terminal-button"]');
    await expect(terminalBtn).toBeVisible();
    
    // Click terminal
    await terminalBtn.click();
    
    // Terminal panel should be visible
    const terminalPanel = page.locator('#terminal-panel');
    await expect(terminalPanel).toBeVisible();
  });

  test('should open terminal', async ({ page }) => {
    await page.goto('http://localhost:5000');
    
    // Open terminal
    const terminalBtn = page.locator('[data-testid="terminal-button"]');
    await terminalBtn.click();
    
    // Wait for terminal to initialize
    await page.waitForTimeout(1000);
    
    // Terminal should have xterm instance
    const xterm = page.locator('.xterm');
    await expect(xterm).toBeVisible();
  });

  test('should execute basic command', async ({ page }) => {
    await page.goto('http://localhost:5000');
    
    // Open terminal
    await page.locator('[data-testid="terminal-button"]').click();
    await page.waitForTimeout(1000);
    
    // Type command
    const terminal = page.locator('.xterm textarea').first();
    await terminal.click();
    await page.keyboard.type('echo hello');
    await page.keyboard.press('Enter');
    
    // Wait for output
    await page.waitForTimeout(2000);
    
    // Should show "hello" in terminal
    const terminalContent = page.locator('.xterm');
    expect(await terminalContent.innerText()).toContain('hello');
  });

  test('should support multiple terminal sessions', async ({ page }) => {
    await page.goto('http://localhost:5000');
    
    // Open terminal
    await page.locator('[data-testid="terminal-button"]').click();
    await page.waitForTimeout(500);
    
    // Click new terminal button
    const newTerminalBtn = page.locator('[data-testid="new-terminal-button"]');
    await newTerminalBtn.click();
    await page.waitForTimeout(1000);
    
    // Should have 2 terminal instances
    const terminals = page.locator('.xterm');
    await expect(terminals).toHaveCount(2);
  });

  test('should switch between terminal sessions', async ({ page }) => {
    await page.goto('http://localhost:5000');
    
    // Open terminal
    await page.locator('[data-testid="terminal-button"]').click();
    await page.waitForTimeout(500);
    
    // Create second terminal
    await page.locator('[data-testid="new-terminal-button"]').click();
    await page.waitForTimeout(500);
    
    // Session tabs should be visible
    const sessionTabs = page.locator('[data-testid="terminal-session-tab"]');
    await expect(sessionTabs.count()).toBeGreaterThanOrEqual(2);
  });

  test('should clear terminal', async ({ page }) => {
    await page.goto('http://localhost:5000');
    
    // Open terminal
    await page.locator('[data-testid="terminal-button"]').click();
    await page.waitForTimeout(500);
    
    // Type some commands
    const terminal = page.locator('.xterm textarea').first();
    await terminal.click();
    await page.keyboard.type('echo test1');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    
    // Clear terminal
    const clearBtn = page.locator('[data-testid="clear-terminal-button"]');
    await clearBtn.click();
    
    // Terminal should be empty (or show clean prompt)
    await page.waitForTimeout(500);
    const terminalContent = page.locator('.xterm');
    const content = await terminalContent.innerText();
    expect(content).not.toContain('test1');
  });

  test('should support keyboard shortcuts', async ({ page }) => {
    await page.goto('http://localhost:5000');
    
    // Open terminal
    await page.locator('[data-testid="terminal-button"]').click();
    await page.waitForTimeout(500);
    
    // Ctrl+` should toggle terminal
    await page.keyboard.press('Control+`');
    await page.waitForTimeout(500);
    
    const terminalPanel = page.locator('#terminal-panel');
    const isVisible = await terminalPanel.isVisible();
    expect(isVisible).toBe(false);
  });
});
