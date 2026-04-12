/**
 * E2E Test: Git Integration
 * 
 * Test status, commit, push, pull, branch management
 */

const { test, expect } = require('@playwright/test');

test.describe('Git Integration', () => {
  
  test('should have git panel', async ({ page }) => {
    await page.goto('http://localhost:5000');
    
    // Git button
    const gitBtn = page.locator('[data-testid="git-button"]');
    await expect(gitBtn).toBeVisible();
    
    // Click git
    await gitBtn.click();
    
    // Git panel should be visible
    const gitPanel = page.locator('#git-panel');
    await expect(gitPanel).toBeVisible();
  });

  test('should show git status', async ({ page }) => {
    await page.goto('http://localhost:5000');
    
    // Open git panel
    await page.locator('[data-testid="git-button"]').click();
    
    // Should show repository info
    const repoInfo = page.locator('[data-testid="git-repo-info"]');
    await expect(repoInfo).toBeVisible();
  });

  test('should stage files', async ({ page }) => {
    await page.goto('http://localhost:5000');
    
    // Open git panel
    await page.locator('[data-testid="git-button"]').click();
    
    // Stage button should exist
    const stageBtn = page.locator('[data-testid="stage-file-button"]');
    await expect(stageBtn).toBeVisible();
  });

  test('should commit changes', async ({ page }) => {
    await page.goto('http://localhost:5000');
    
    // Open git panel
    await page.locator('[data-testid="git-button"]').click();
    
    // Commit message input
    const commitInput = page.locator('[data-testid="commit-message-input"]');
    await expect(commitInput).toBeVisible();
    
    // Type commit message
    await commitInput.fill('Test commit');
    
    // Click commit button
    const commitBtn = page.locator('[data-testid="commit-button"]');
    await commitBtn.click();
    
    // Should show success message
    const successMsg = page.locator('[data-testid="commit-success"]');
    await expect(successMsg).toBeVisible({ timeout: 5000 });
  });

  test('should show current branch', async ({ page }) => {
    await page.goto('http://localhost:5000');
    
    // Open git panel
    await page.locator('[data-testid="git-button"]').click();
    
    // Branch selector
    const branchSelector = page.locator('[data-testid="branch-selector"]');
    await expect(branchSelector).toBeVisible();
  });

  test('should push changes', async ({ page }) => {
    await page.goto('http://localhost:5000');
    
    // Open git panel
    await page.locator('[data-testid="git-button"]').click();
    
    // Push button
    const pushBtn = page.locator('[data-testid="push-button"]');
    await expect(pushBtn).toBeVisible();
  });

  test('should pull changes', async ({ page }) => {
    await page.goto('http://localhost:5000');
    
    // Open git panel
    await page.locator('[data-testid="git-button"]').click();
    
    // Pull button
    const pullBtn = page.locator('[data-testid="pull-button"]');
    await expect(pullBtn).toBeVisible();
  });

  test('should show diff view', async ({ page }) => {
    await page.goto('http://localhost:5000');
    
    // Open git panel
    await page.locator('[data-testid="git-button"]').click();
    
    // Click on changed file
    const fileItem = page.locator('[data-testid="git-file-item"]').first();
    if (await fileItem.count() > 0) {
      await fileItem.click();
      
      // Diff view should appear
      const diffView = page.locator('[data-testid="diff-view"]');
      await expect(diffView).toBeVisible();
    }
  });
});
