import { test, expect } from '@playwright/test';

test.describe('Browser Extension Tests', () => {
  test.beforeAll(async () => {
  })

  test.beforeEach(async () => {
    // placeholder: runs before each test
  })

  test.afterEach(async () => {
    // placeholder: runs after each test
  })

  test('has title', async ({ page }) => {
    await page.goto('https://playwright.dev/');
    page.title();
    console.log('Page title:', await page.title());
    // Expect a title "to contain" a substring.
    await expect(page).toHaveTitle(/Playwright/);
  });

  test('get started link', async ({ page }) => {
    await page.goto('https://playwright.dev/');

    // Click the get started link.
    await page.getByRole('link', { name: 'Get started' }).click();

    // Expects page to have a heading with the name of Installation.
    await expect(page.getByRole('heading', { name: 'Installation' })).toBeVisible();
  });
});