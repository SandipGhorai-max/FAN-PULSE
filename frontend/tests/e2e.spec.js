import { test, expect } from '@playwright/test';

test('has title', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/FanPulse/);
});

test('fan view loads properly', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.fan-view-container')).toBeVisible();
});
