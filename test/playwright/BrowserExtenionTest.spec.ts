import { expect, firefox, test } from '@playwright/test'
// import { execSync } from 'child_process'
import path from 'path'

test.describe('Browser Extension Test', () => {
  test.beforeAll(async () => {
    // console.log('Building extension...')
    // execSync('npm run build', { stdio: 'inherit' })

    // console.log('Preparing Firefox profile with extension...')
    // execSync('node scripts/prepare-firefox-profile.js', { stdio: 'inherit' })
  })

  test('extension loads in Firefox', async () => {
    const profileDir = path.resolve(process.cwd(), 'test/playwright/firefox-profile')

    // Launch Firefox with extension
    const context = await firefox.launchPersistentContext(profileDir, {
      headless: false
    })

    const page = await context.newPage()
    await page.goto('https://playwright.dev')

    // Wait and check for extension element
    await page.waitForTimeout(3000)

    const element = page.locator('#my-vue-header')
    const exists = await element.count()
    expect(exists).toBeGreaterThan(0)

    console.log(`Element count: ${exists}`)
    if (exists > 0) {
      console.log('✅ Extension loaded successfully')
    } else {
      console.log('⚠️ Extension element not found')
    }
  })
})

