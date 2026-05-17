import { test, expect } from '@playwright/test'

test.describe('Playwright Website Test', () => {
    test('should have Playwright in title', async ({ page }) => {
        await page.goto('https://playwright.dev/')
        await expect(page).toHaveTitle(/Playwright/)
    })

    test('should navigate to Getting Started', async ({ page }) => {
        await page.goto('https://playwright.dev/')
        await page.getByRole('link', { name: 'Get started' }).first().click()
        await expect(page).toHaveURL(/.*intro/)
    })
})
