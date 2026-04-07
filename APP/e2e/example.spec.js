import { test, expect } from '@playwright/test';

test('verifica caricamento home', async ({ page }) => {
  await page.goto('http://localhost:5000');
  const title = await page.title();
  expect(title).toContain('GXCode');
});

test('verifica barra laterale', async ({ page }) => {
  await page.goto('http://localhost:5000');
  const sidebar = page.locator('#left-sidebar');
  await expect(sidebar).toBeVisible();
});
