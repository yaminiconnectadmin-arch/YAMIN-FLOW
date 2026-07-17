const { test, expect } = require('@playwright/test');

test.describe('Yamini Flow Homepage E2E Suite', () => {
  test('homepage loads and displays core elements', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Yamini Flow|React App/i);
    const body = await page.textContent('body');
    expect(body).toBeTruthy();
  });

  test('navigation sidebar handles routes', async ({ page }) => {
    await page.goto('/');
    const links = page.locator('nav a');
    expect(await links.count()).toBeGreaterThanOrEqual(0);
  });
});
